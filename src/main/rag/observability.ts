/**
 * Observability / Tracing — Langfuse integration for RAG pipeline monitoring.
 *
 * Provides:
 *   - Trace creation for each RAG query
 *   - Span tracking for retrieval (local + web), generation, and caching
 *   - Latency, token count, and error logging
 *   - Graceful no-op when LANGFUSE keys are not set
 */

import { createLogger } from '../services/logger';

const logger = createLogger('observability');

interface TraceSpan {
    name: string;
    startTime: number;
    endTime?: number;
    metadata?: Record<string, unknown>;
    status: 'running' | 'ok' | 'error';
    error?: string;
}

interface RAGTrace {
    id: string;
    query: string;
    startTime: number;
    endTime?: number;
    spans: TraceSpan[];
    metadata: Record<string, unknown>;
    cacheHit: boolean;
    totalTokens?: number;
}

// In-memory trace buffer — flushed to Langfuse or console
const traceBuffer: RAGTrace[] = [];
const MAX_BUFFER_SIZE = 100;

// ── Langfuse Client ────────────────────────────────────────

let langfuseClient: any = null;
let langfuseEnabled = false;

export async function initObservability(): Promise<void> {
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

    if (secretKey && publicKey) {
        try {
            // Dynamic import to avoid hard dependency
            const { Langfuse } = await import('langfuse');
            langfuseClient = new Langfuse({
                secretKey,
                publicKey,
                baseUrl,
            });
            langfuseEnabled = true;
            logger.info('Langfuse tracing enabled');
        } catch (err) {
            logger.warn('Langfuse not available — running in local-only mode', {
                error: err instanceof Error ? err.message : String(err),
            });
            langfuseEnabled = false;
        }
    } else {
        logger.info('No Langfuse keys — running in local trace mode (console only)');
    }
}

// ── Trace API ──────────────────────────────────────────────

export function createTrace(query: string): RAGTrace {
    const trace: RAGTrace = {
        id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        query,
        startTime: Date.now(),
        spans: [],
        metadata: {},
        cacheHit: false,
    };

    return trace;
}

export function startSpan(trace: RAGTrace, name: string, metadata?: Record<string, unknown>): TraceSpan {
    const span: TraceSpan = {
        name,
        startTime: Date.now(),
        status: 'running',
        metadata,
    };
    trace.spans.push(span);
    return span;
}

export function endSpan(span: TraceSpan, status: 'ok' | 'error' = 'ok', error?: string): void {
    span.endTime = Date.now();
    span.status = status;
    if (error) span.error = error;
}

export function finalizeTrace(trace: RAGTrace, metadata?: Record<string, unknown>): void {
    trace.endTime = Date.now();
    if (metadata) {
        trace.metadata = { ...trace.metadata, ...metadata };
    }

    const totalLatency = trace.endTime - trace.startTime;

    // Log locally
    const spanSummary = trace.spans.map(s => {
        const lat = (s.endTime || Date.now()) - s.startTime;
        return `  [${s.status.toUpperCase()}] ${s.name}: ${lat}ms`;
    }).join('\n');

    logger.info('Trace finalized', {
        traceId: trace.id,
        queryPreview: `${trace.query.slice(0, 50)}...`,
        totalLatencyMs: totalLatency,
        cache: trace.cacheHit ? 'HIT' : 'MISS',
        spanCount: trace.spans.length,
        spanSummary,
    });

    // Buffer for batch send
    traceBuffer.push(trace);
    if (traceBuffer.length > MAX_BUFFER_SIZE) {
        traceBuffer.shift(); // drop oldest
    }

    // Send to Langfuse if enabled
    if (langfuseEnabled && langfuseClient) {
        try {
            const lfTrace = langfuseClient.trace({
                id: trace.id,
                name: 'rag-query',
                input: trace.query,
                metadata: trace.metadata,
            });

            for (const span of trace.spans) {
                lfTrace.span({
                    name: span.name,
                    startTime: new Date(span.startTime),
                    endTime: span.endTime ? new Date(span.endTime) : undefined,
                    metadata: span.metadata,
                    statusMessage: span.error,
                    level: span.status === 'error' ? 'ERROR' : 'DEFAULT',
                });
            }

            // Flush asynchronously
            langfuseClient.flush().catch((err: unknown) => {
                logger.warn('Langfuse flush error', {
                    error: err instanceof Error ? err.message : String(err),
                });
            });
        } catch (err) {
            logger.warn('Failed to send trace to Langfuse', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
}

// ── Metrics ────────────────────────────────────────────────

export function getRecentTraces(limit: number = 20): RAGTrace[] {
    return traceBuffer.slice(-limit);
}

export function getTraceStats(): {
    totalTraces: number;
    avgLatencyMs: number;
    cacheHitRate: number;
    errorRate: number;
} {
    if (traceBuffer.length === 0) {
        return { totalTraces: 0, avgLatencyMs: 0, cacheHitRate: 0, errorRate: 0 };
    }

    const completed = traceBuffer.filter(t => t.endTime);
    const totalLatency = completed.reduce((sum, t) => sum + ((t.endTime || 0) - t.startTime), 0);
    const cacheHits = traceBuffer.filter(t => t.cacheHit).length;
    const errors = traceBuffer.filter(t => t.spans.some(s => s.status === 'error')).length;

    return {
        totalTraces: traceBuffer.length,
        avgLatencyMs: completed.length > 0 ? Math.round(totalLatency / completed.length) : 0,
        cacheHitRate: traceBuffer.length > 0 ? cacheHits / traceBuffer.length : 0,
        errorRate: traceBuffer.length > 0 ? errors / traceBuffer.length : 0,
    };
}
