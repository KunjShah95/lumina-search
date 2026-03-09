import { AgentEvent, SearchOpts, SearchResult, ImageResult, VideoResult, SearchProvider } from './types'
import { SearchAgent } from './SearchAgent'
import { ResultMergerAgent } from './ResultMerger'
import { ScraperAgent } from './ScraperAgent'
import { ContextBuilderAgent } from './ContextBuilder'
import { LLMSynthesisAgent } from './LLMSynthesis'
import { FollowUpAgent } from './FollowUpAgent'
import { shouldRewrite, rewriteQuery } from './QueryRewriteAgent'
import { scoreAnswer, shouldTriggerRepair } from './confidenceScorer'
import { budgetPlanner } from './BudgetPlanner'
import { compareModels } from './AnswerComparator'
import { buildCitationGraph } from './CitationGraph'
import { buildMemoryContext, maybeRememberFromQuery } from '../services/memoryProfile'
import { createLogger } from '../services/logger'

const logger = createLogger('Orchestrator')

/**
 * SearchOrchestrator — Master coordinator agent.
 *
 * Pipeline:
 *   [OPTIONAL]    QueryRewriteAgent            → sub-queries (Phase 0)
 *   [PARALLEL]    SearchAgent × N providers    → raw results
 *   [SEQUENTIAL]  ResultMergerAgent            → ranked, deduped top-N
 *   [PARALLEL]    ScraperAgent × 3 URLs        → full page text
 *   [SEQUENTIAL]  ContextBuilderAgent          → citation prompt
 *   [SEQUENTIAL]  LLMSynthesisAgent            → streamed answer
 *   [PARALLEL]    FollowUpAgent (non-blocking) → 3 follow-up chips
 *   [OPTIONAL]    ConfidenceScorer             → answer quality score
 *   [OPTIONAL]    CitationGraph                → source link graph
 *   [OPTIONAL]    AnswerComparator             → multi-model comparison
 *
 * For Image/Video modes:
 *   [PARALLEL]    SearchAgent × N providers    → images/videos
 */
export class SearchOrchestrator {
    async *run(query: string, opts: SearchOpts): AsyncGenerator<AgentEvent> {
        const { focusMode } = opts

        if (focusMode === 'image') {
            yield { type: 'phase', label: '🖼️ Searching images...' }
            const provider = opts.providers[0] || 'duckduckgo'
            const agent = new SearchAgent(provider, opts.operators)
            const images = await agent.searchImages(query)
            yield { type: 'images', data: images }
            yield { type: 'done' }
            return
        }

        if (focusMode === 'video') {
            yield { type: 'phase', label: '🎬 Searching videos...' }
            const provider = opts.providers[0] || 'duckduckgo'
            const agent = new SearchAgent(provider, opts.operators)
            const videos = await agent.searchVideos(query)
            yield { type: 'videos', data: videos }
            yield { type: 'done' }
            return
        }

        // ── Phase 0: Query Rewriting (optional) ──────────────────
        let queries = [query]
        if (shouldRewrite(query)) {
            yield { type: 'phase', label: '🔄 Decomposing query...' }
            try {
                queries = await rewriteQuery(query, opts.model)
                if (queries.length > 1) {
                    yield { type: 'sub-queries', data: queries }
                }
            } catch {
                queries = [query]
            }
        }

        // ── Phase 1: Parallel web search ──────────────────────
        yield { type: 'phase', label: '🔍 Searching the web...' }

        const providers = opts.providers.length > 0 ? opts.providers : ['duckduckgo' as const]

        // Incremental mode: yield results as each provider completes
        if (opts.incremental) {
            const allSearchPromises = queries.flatMap(q =>
                providers.map(p => ({
                    query: q,
                    provider: p,
                    promise: new SearchAgent(p, opts.operators).run(q, focusMode)
                }))
            )

            const completedResults: SearchResult[] = []

            for (const searchPromise of allSearchPromises) {
                try {
                    const results = await searchPromise.promise
                    if (results.length > 0) {
                        completedResults.push(...results)
                        // Yield partial results immediately
                        const partialMerged = new ResultMergerAgent().run(completedResults, opts.maxSources)
                        yield { type: 'sources', data: partialMerged, partial: true }
                    }
                } catch (err) {
                    // Continue with other providers
                    logger.warn(`Incremental search failed for ${searchPromise.provider}`, { error: String(err) })
                }
            }
        }

        // Standard mode: wait for all providers
        const searchSettled = await Promise.allSettled(
            queries.flatMap(q =>
                providers.map(p => new SearchAgent(p, opts.operators).run(q, focusMode))
            )
        )

        const allResults: SearchResult[] = searchSettled
            .filter((r): r is PromiseFulfilledResult<SearchResult[]> => r.status === 'fulfilled')
            .flatMap(r => r.value)

        if (allResults.length === 0) {
            yield { type: 'error', message: 'No search results found. Check your API keys or network.' }
            return
        }

        // Yield final merged results
        const merged = new ResultMergerAgent().run(allResults, opts.maxSources)
        yield { type: 'sources', data: merged, partial: false }

        // ── Phase 3: Parallel page scraping ───────────────────
        if (opts.scrapePages && merged.length > 0) {
            yield { type: 'phase', label: '📖 Reading sources...' }
            const scrapeTargets = merged.slice(0, 3)
            const scrapedSettled = await Promise.allSettled(
                scrapeTargets.map(r => new ScraperAgent().run(r.url))
            )
            scrapedSettled.forEach((result, i) => {
                if (result.status === 'fulfilled' && result.value && merged[i]) {
                    merged[i].fullText = result.value
                }
            })
        }

        // ── Phase 3.5: Citation Graph ─────────────────────────
        const graph = buildCitationGraph(merged)
        if (graph.edges.length > 0) {
            yield { type: 'citations', data: graph.nodes }
        }

        // ── Phase 4: Sequential context building ─────────────
        yield { type: 'phase', label: '🧠 Synthesizing answer...' }
        const memoryContext = this.resolveMemoryContext(query, opts)
        const context = new ContextBuilderAgent().run(merged, focusMode, {
            memoryContext,
        })
        const contextChars = context.length

        const initialPlan = budgetPlanner.estimate({
            query,
            modelId: opts.model,
            contextChars,
            sessionId: opts.sessionId,
            policy: opts.budgetPolicy,
            confidenceGap: 0,
        })

        yield { type: 'cost', data: initialPlan }

        if (initialPlan.shouldBlock) {
            yield { type: 'error', message: initialPlan.reason || 'Budget limit exceeded' }
            return
        }

        const plannedModel = budgetPlanner.selectModelForTier(opts.model, initialPlan.recommendedTier)
        const plannedContext = initialPlan.contextCompressionRatio < 1
            ? this.compressContext(context, initialPlan.contextCompressionRatio)
            : context

        // ── Phase 5: Start follow-up suggestions in background ─
        const followUpPromise = new FollowUpAgent().run(query, plannedContext, plannedModel)

        // ── Phase 5.5: Multi-Model Comparison (if compare mode) ─
        if (focusMode === 'compare' && opts.compareModels && opts.compareModels.length > 1) {
            yield { type: 'phase', label: '⚖️ Comparing models...' }
            const systemPrompt = `You are a helpful AI assistant. Answer the following question based on this context:\n\n${plannedContext}`
            const results = await compareModels(query, systemPrompt, opts.compareModels, opts.conversationHistory)
            yield {
                type: 'comparison',
                data: results.map(r => ({ model: r.model, answer: r.answer, duration: r.duration }))
            }
            yield { type: 'done' }
            return
        }

        // ── Phase 6: Sequential LLM stream ───────────────────
        const llmAgent = new LLMSynthesisAgent(plannedModel)
        let fullAnswer = ''
        for await (const token of llmAgent.stream(query, plannedContext, opts.conversationHistory)) {
            fullAnswer += token
            yield { type: 'token', text: token }
        }

        budgetPlanner.registerUsage(opts.sessionId || 'default', this.estimateAnswerTokens(fullAnswer))

        // ── Phase 7: Confidence Scoring ───────────────────────
        const confidence = scoreAnswer(fullAnswer, merged, query)
        yield { type: 'confidence', data: confidence }

        // ── Phase 7.5: Auto-repair loop (v2) ─────────────────
        if (shouldTriggerRepair(confidence)) {
            try {
                yield { type: 'phase', label: '🛠️ Repairing answer quality...' }

                const repairProviders = this.expandProviders(providers)
                const repairQueries = this.expandQueriesForRepair(query)

                const repairSettled = await Promise.allSettled(
                    repairQueries.flatMap(q =>
                        repairProviders.map(p => new SearchAgent(p).run(q, focusMode))
                    )
                )

                const repairResults: SearchResult[] = repairSettled
                    .filter((r): r is PromiseFulfilledResult<SearchResult[]> => r.status === 'fulfilled')
                    .flatMap(r => r.value)

                const repairedMerged = new ResultMergerAgent().run(
                    [...allResults, ...repairResults],
                    Math.max(opts.maxSources + 3, 8)
                )

                if (opts.scrapePages && repairedMerged.length > 0) {
                    const scrapeTargets = repairedMerged.slice(0, 5)
                    const scrapedSettled = await Promise.allSettled(
                        scrapeTargets.map(r => new ScraperAgent().run(r.url))
                    )
                    scrapedSettled.forEach((result, i) => {
                        if (result.status === 'fulfilled' && result.value && repairedMerged[i]) {
                            repairedMerged[i].fullText = result.value
                        }
                    })
                }

                const strictContext = new ContextBuilderAgent().run(repairedMerged, focusMode, {
                    strictCitations: true,
                    repairPass: true,
                    memoryContext,
                })

                const repairPlan = budgetPlanner.estimate({
                    query,
                    modelId: plannedModel,
                    contextChars: strictContext.length,
                    sessionId: opts.sessionId,
                    policy: opts.budgetPolicy,
                    confidenceGap: Math.max(0, (70 - confidence.score) / 100),
                })
                yield { type: 'cost', data: repairPlan }

                if (repairPlan.shouldBlock) {
                    // Continue with original answer if repair budget is exhausted.
                    yield { type: 'phase', label: '⚠️ Repair skipped due to budget limits.' }
                } else {
                    const repairedModel = budgetPlanner.selectModelForTier(plannedModel, 'tier3')
                    const repairAgent = new LLMSynthesisAgent(repairedModel)
                    let repairedAnswer = ''
                    const repairContext = repairPlan.contextCompressionRatio < 1
                        ? this.compressContext(strictContext, repairPlan.contextCompressionRatio)
                        : strictContext

                    for await (const token of repairAgent.stream(query, repairContext, opts.conversationHistory)) {
                        repairedAnswer += token
                    }

                    const repairedConfidence = scoreAnswer(repairedAnswer, repairedMerged, query)
                    if (repairedConfidence.score > confidence.score) {
                        const repairHeader = '\n\n---\n\n### Revised answer (quality repair pass)\n\n'
                        yield { type: 'token', text: repairHeader }
                        yield { type: 'token', text: repairedAnswer }
                        fullAnswer += `${repairHeader}${repairedAnswer}`
                        yield { type: 'confidence', data: repairedConfidence }
                        budgetPlanner.registerUsage(opts.sessionId || 'default', this.estimateAnswerTokens(repairedAnswer))
                    }
                }
            } catch (err) {
                logger.warn('Auto-repair pass failed (non-critical)', { error: String(err) })
                yield { type: 'phase', label: '⚠️ Quality repair pass failed, returning original answer.' }
            }
        }

        // ── Phase 8: Yield follow-ups after stream ends ───────
        try {
            const followUps = await followUpPromise
            if (followUps.length > 0) {
                yield { type: 'followups', data: followUps }
            }
        } catch { /* non-critical */ }

        this.captureMemoryCandidate(query, opts)

        yield { type: 'done' }
    }

    private resolveMemoryContext(query: string, opts: SearchOpts): string {
        if (!opts.memoryPolicy?.enabled || !opts.sessionId) {
            return ''
        }

        const { text } = buildMemoryContext({
            threadId: opts.sessionId,
            query,
            maxFacts: opts.memoryPolicy.maxFactsPerQuery,
        })

        return text
    }

    private captureMemoryCandidate(query: string, opts: SearchOpts): void {
        if (!opts.memoryPolicy?.enabled || !opts.sessionId) {
            return
        }

        maybeRememberFromQuery({
            threadId: opts.sessionId,
            query,
            ttlDays: opts.memoryPolicy.ttlDays,
        })
    }

    private expandProviders(providers: SearchProvider[]): SearchProvider[] {
        const fallbackProviders: SearchProvider[] = ['duckduckgo', 'brave']
        const merged = [...providers]
        for (const provider of fallbackProviders) {
            if (!merged.includes(provider)) merged.push(provider)
        }
        return merged
    }

    private expandQueriesForRepair(query: string): string[] {
        const expanded = [
            query,
            `${query} with explicit evidence and citations`,
        ]
        return Array.from(new Set(expanded))
    }

    private compressContext(context: string, ratio: number): string {
        if (ratio >= 1) return context
        const targetLength = Math.max(600, Math.floor(context.length * ratio))
        if (context.length <= targetLength) return context

        const head = Math.floor(targetLength * 0.6)
        const tail = targetLength - head
        return `${context.slice(0, head)}\n\n[...context compressed for budget...]\n\n${context.slice(-tail)}`
    }

    private estimateAnswerTokens(answer: string): number {
        if (!answer) return 0
        return Math.max(1, Math.ceil(answer.length / 4))
    }
}
