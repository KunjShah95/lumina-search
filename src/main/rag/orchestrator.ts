/**
 * RAG Orchestrator — Production-grade hybrid pipeline.
 *
 * Features:
 *   1. Persistent semantic cache (SQLite)
 *   2. BM25 keyword search + vector semantic search (true hybrid retrieval)
 *   3. Concurrent local + web retrieval
 *   4. Streaming token generation via OpenAI
 *   5. Observability tracing (Langfuse-compatible)
 *   6. Graceful error handling with fallbacks
 */

import crypto from 'crypto';
import OpenAI from 'openai';
import { searchSimilar, getAllChunks } from './vectorStore';
import { performWebSearch } from './webSearch';
import { bm25Engine } from './bm25';
import {
    generateCacheKey, getCachedResponse, setCachedResponse
} from './semanticCache';
import {
    createTrace, startSpan, endSpan, finalizeTrace
} from './observability';
import { createLogger } from '../services/logger';

const logger = createLogger('rag-orchestrator');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
});

export interface RAGOptions {
    useLocalContext: boolean;
    useWebSearch: boolean;
    kbId?: string;
    kbIds?: string[];  // Search across multiple KBs
    conversationHistory?: { role: string; content: string }[];  // Multi-turn support
}

export interface RAGStreamEvent {
    type: 'phase' | 'token' | 'sources' | 'done' | 'error' | 'cache-hit';
    label?: string;
    text?: string;
    sources?: RAGSourceInfo[];
    message?: string;
    answer?: string;
}

export interface RAGSourceInfo {
    type: 'local' | 'web' | 'bm25';
    title: string;
    url?: string;
    score: number;
    snippet: string;
}

// ── Non-Streaming Query (backward compat) ──────────────────

export async function processRAGQuery(query: string, options: RAGOptions): Promise<string> {
    let fullAnswer = '';
    for await (const event of streamRAGQuery(query, options)) {
        if (event.type === 'token' && event.text) {
            fullAnswer += event.text;
        }
        if (event.type === 'cache-hit' && event.answer) {
            return event.answer;
        }
        if (event.type === 'error') {
            throw new Error(event.message || 'RAG query failed');
        }
    }
    return fullAnswer;
}

// ── Streaming Query (new) ──────────────────────────────────

export async function* streamRAGQuery(
    query: string,
    options: RAGOptions
): AsyncGenerator<RAGStreamEvent> {
    const trace = createTrace(query);

    // ── 1. Cache Check ──────────────────────────────────────
    const cacheSpan = startSpan(trace, 'cache-check');
    const cacheKey = generateCacheKey(query, options as unknown as Record<string, unknown>);
    const cached = getCachedResponse(cacheKey);
    endSpan(cacheSpan, 'ok');

    if (cached) {
        trace.cacheHit = true;
        yield { type: 'cache-hit', answer: cached };
        finalizeTrace(trace, { cacheHit: true });
        return;
    }

    yield { type: 'phase', label: '🔍 Retrieving context...' };

    // ── 2. Parallel Retrieval ───────────────────────────────
    const contexts: string[] = [];
    const allSources: RAGSourceInfo[] = [];

    const retrievalPromises: Promise<void>[] = [];

    // 2a. Local vector + BM25 hybrid
    if (options.useLocalContext) {
        retrievalPromises.push(
            (async () => {
                const effectiveKbId = options.kbId;
                const effectiveKbIds = options.kbIds;
                const localSpan = startSpan(trace, 'local-retrieval', { kbId: effectiveKbId, kbIds: effectiveKbIds });
                try {
                    let vectorResults: { text: string; source: string; score: number }[] = [];
                    let bm25Results: { text: string; source: string; score: number }[] = [];

                    if (effectiveKbIds && effectiveKbIds.length > 0) {
                        // Multi-KB search: search across specified KBs
                        const allVectorResults: { text: string; source: string; score: number }[] = [];
                        for (const kbId of effectiveKbIds) {
                            const results = await searchSimilar(query, 5, kbId);
                            allVectorResults.push(...results);
                        }
                        // Sort by score and take top 5
                        vectorResults = allVectorResults
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 5);

                        // BM25 across all targeted KBs
                        const allChunks = effectiveKbIds.flatMap(kbId => getAllChunks(kbId));
                        bm25Engine.index(allChunks);
                        bm25Results = bm25Engine.search(query, 5);
                    } else {
                        // Single KB or all KBs
                        vectorResults = await searchSimilar(query, 5, effectiveKbId);
                        const allChunks = getAllChunks(effectiveKbId);
                        bm25Engine.index(allChunks);
                        bm25Results = bm25Engine.search(query, 5, effectiveKbId);
                    }

                    // Reciprocal Rank Fusion to merge results
                    const fusedResults = reciprocalRankFusion(
                        vectorResults.map(r => ({ id: `${r.source}:${r.text.slice(0, 50)}`, ...r, type: 'vector' as const })),
                        bm25Results.map(r => ({ id: `${r.source}:${r.text.slice(0, 50)}`, ...r, type: 'bm25' as const })),
                        60 // k parameter
                    );

                    if (fusedResults.length > 0) {
                        const formattedLocal = fusedResults
                            .slice(0, 5)
                            .map(r => `[Local Document: ${r.source}]\n${r.text}`)
                            .join('\n\n');
                        contexts.push(`### Relevant Local Files\n${formattedLocal}`);

                        allSources.push(...fusedResults.slice(0, 5).map(r => ({
                            type: r.fusionType === 'bm25' ? 'bm25' as const : 'local' as const,
                            title: r.source,
                            score: r.score,
                            snippet: r.text.slice(0, 200),
                        })));
                    }

                    endSpan(localSpan, 'ok', undefined);
                } catch (error) {
                    endSpan(localSpan, 'error', String(error));
                    logger.error('Local context retrieval failed', error, {
                        kbId: effectiveKbId,
                        kbIds: effectiveKbIds,
                    });
                }
            })()
        );
    }

    // 2b. Web search
    if (options.useWebSearch) {
        retrievalPromises.push(
            (async () => {
                const webSpan = startSpan(trace, 'web-retrieval');
                try {
                    const webResults = await performWebSearch(query, 3);
                    if (webResults && webResults.length > 0) {
                        const formattedWeb = webResults
                            .map(res => `[Web: ${res.title}](${res.url})\n${res.content}`)
                            .join('\n\n');
                        contexts.push(`### Relevant Web Results\n${formattedWeb}`);

                        allSources.push(...webResults.map(r => ({
                            type: 'web' as const,
                            title: r.title,
                            url: r.url,
                            score: r.score,
                            snippet: r.content.slice(0, 200),
                        })));
                    }
                    endSpan(webSpan, 'ok');
                } catch (error) {
                    endSpan(webSpan, 'error', String(error));
                    logger.error('Web search failed', error);
                }
            })()
        );
    }

    await Promise.all(retrievalPromises);

    // Emit source information
    if (allSources.length > 0) {
        yield { type: 'sources', sources: allSources };
    }

    // ── 3. LLM Generation (Streaming) ───────────────────────
    yield { type: 'phase', label: '🧠 Generating answer...' };

    const contextData = contexts.length > 0
        ? `Here is the relevant information to answer the user's query:\n\n${contexts.join('\n\n---\n\n')}`
        : '';

    // Build conversation context for multi-turn
    const conversationContext = options.conversationHistory && options.conversationHistory.length > 0
        ? `\n\nPrevious conversation context:\n${options.conversationHistory.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 300)}`).join('\n')}`
        : '';

    const systemPrompt = `You are Lumina Search, an intelligent RAG assistant.
Your goal is to provide accurate, concise, and helpful answers.
You will be provided with context retrieved from local documents and the internet.
Always base your answer on the provided context if it is relevant.
Always cite your sources using inline brackets e.g. [Local Document: resume.pdf] or [Web: News Article].
If the context does not contain the answer, you can state that, but still try to provide a helpful response.
Format your answer in clean Markdown with headers where appropriate.${conversationContext}`;

    const userMessage = `${contextData}\n\nUser Query: ${query}`;

    if (!process.env.OPENAI_API_KEY) {
        const mock = `**[Mock RAG Answer]**\n\nNo OPENAI_API_KEY configured. Received ${contexts.length > 0 ? allSources.length + ' source chunks' : 'no context'}.\n\nTo use Hybrid RAG, set your OpenAI API key in Settings → API Keys.`;
        yield { type: 'token', text: mock };
        yield { type: 'done' };
        setCachedResponse(cacheKey, query, options as unknown as Record<string, unknown>, mock);
        finalizeTrace(trace, { mock: true });
        return;
    }

    const genSpan = startSpan(trace, 'llm-generation', { model: 'gpt-4-turbo-preview' });
    let fullAnswer = '';

    try {
        const stream = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            model: 'gpt-4-turbo-preview',
            temperature: 0.2,
            stream: true,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
                fullAnswer += delta;
                yield { type: 'token', text: delta };
            }
        }

        endSpan(genSpan, 'ok');
    } catch (error) {
        endSpan(genSpan, 'error', String(error));
        yield { type: 'error', message: `LLM generation failed: ${error}` };
        finalizeTrace(trace, { error: String(error) });
        return;
    }

    // ── 4. Cache & Finalize ─────────────────────────────────
    setCachedResponse(cacheKey, query, options as unknown as Record<string, unknown>, fullAnswer);
    yield { type: 'done' };
    finalizeTrace(trace, { answerLength: fullAnswer.length, sourceCount: allSources.length });
}

// ── Reciprocal Rank Fusion ─────────────────────────────────

interface FusionItem {
    id: string;
    text: string;
    source: string;
    score: number;
    type: 'vector' | 'bm25';
}

interface FusedResult {
    text: string;
    source: string;
    score: number;
    fusionType: 'vector' | 'bm25' | 'both';
}

function reciprocalRankFusion(
    vectorResults: FusionItem[],
    bm25Results: FusionItem[],
    k: number = 60
): FusedResult[] {
    const scoreMap = new Map<string, { score: number; text: string; source: string; types: Set<string> }>();

    // Score from vector results
    vectorResults.forEach((item, rank) => {
        const key = item.id;
        const rrf = 1 / (k + rank + 1);
        const existing = scoreMap.get(key);
        if (existing) {
            existing.score += rrf;
            existing.types.add('vector');
        } else {
            scoreMap.set(key, { score: rrf, text: item.text, source: item.source, types: new Set(['vector']) });
        }
    });

    // Score from BM25 results
    bm25Results.forEach((item, rank) => {
        const key = item.id;
        const rrf = 1 / (k + rank + 1);
        const existing = scoreMap.get(key);
        if (existing) {
            existing.score += rrf;
            existing.types.add('bm25');
        } else {
            scoreMap.set(key, { score: rrf, text: item.text, source: item.source, types: new Set(['bm25']) });
        }
    });

    return Array.from(scoreMap.values())
        .sort((a, b) => b.score - a.score)
        .map(item => ({
            text: item.text,
            source: item.source,
            score: item.score,
            fusionType: item.types.size > 1 ? 'both' : (item.types.has('vector') ? 'vector' : 'bm25'),
        }));
}
