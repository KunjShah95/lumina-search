/**
 * Query Rewrite Agent — Decompose complex queries into sub-queries.
 *
 * For example: "Compare React and Vue performance" →
 *   ["React performance benchmarks", "Vue performance benchmarks", "React vs Vue comparison"]
 */
import { streamLLM } from '../services/llm-router'
import { getSettingsFromDb } from '../services/database'

/**
 * Heuristic: Should this query be decomposed?
 */
export function shouldRewrite(query: string): boolean {
    const triggers = [
        /\bcompare\b/i, /\bvs\.?\b/i, /\bversus\b/i,
        /\bdifference between\b/i, /\bpros and cons\b/i,
        /\band\b.*\band\b/i, // multiple "and"s
        /\bstep[- ]by[- ]step\b/i,
        /\bhow does .+ work .+ and\b/i,
        /\bwhat are .+ and .+\b/i,
    ]

    // Long queries or queries with comparison/multi-topic markers
    if (query.length > 80) return true
    return triggers.some(rx => rx.test(query))
}

/**
 * Decompose a complex query into 2-4 sub-queries using LLM.
 */
export async function rewriteQuery(query: string, model?: string): Promise<string[]> {
    const settings = getSettingsFromDb()
    const modelId = model || settings.defaultModel

    const systemPrompt = `You are a search query optimizer. Given a complex user query, decompose it into 2-4 simpler, targeted sub-queries that together would provide comprehensive results.

Rules:
- Output ONLY the sub-queries, one per line
- No numbering, no bullets, no explanation
- Each sub-query should be a standalone search query
- Keep sub-queries concise (under 60 chars each)
- If the query is already simple, return it unchanged on one line`

    const userMessage = `Decompose this query:\n"${query}"`

    try {
        let result = ''
        for await (const token of streamLLM(modelId, systemPrompt, [{ role: 'user', content: userMessage }], settings)) {
            result += token
        }

        const subQueries = result
            .split('\n')
            .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
            .filter(line => line.length > 3 && line.length < 150)
            .slice(0, 4)

        return subQueries.length > 0 ? subQueries : [query]
    } catch (error) {
        console.error('Query rewriting failed, using original:', error)
        return [query]
    }
}

/**
 * Expand a query with conversational context for better retrieval.
 */
export function expandWithContext(
    query: string,
    conversationHistory: { role: string; content: string }[]
): string {
    if (conversationHistory.length === 0) return query

    // Take last 2 exchanges for context
    const recentContext = conversationHistory
        .slice(-4)
        .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
        .join(' | ')

    return `${query} [Context: ${recentContext}]`
}
