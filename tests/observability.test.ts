import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createTrace,
    startSpan,
    endSpan,
    finalizeTrace,
    getTraceStats,
    getRecentTraces
} from '../src/main/rag/observability';

// We don't want Langfuse enabled for pure unit tests, but we test the buffer and logic.

describe('RAG Observability', () => {

    it('should create a trace and verify initial state', () => {
        const query = 'What is the speed of light?';
        const trace = createTrace(query);

        expect(trace.query).toBe(query);
        expect(trace.startTime).toBeLessThanOrEqual(Date.now());
        expect(trace.spans).toEqual([]);
        expect(trace.cacheHit).toBe(false);
    });

    it('should track spans correctly within a trace', () => {
        const trace = createTrace('How do black holes work?');

        const spanLocal = startSpan(trace, 'local-retrieval', { kbId: '123' });
        expect(trace.spans.length).toBe(1);
        expect(spanLocal.name).toBe('local-retrieval');
        expect(spanLocal.status).toBe('running');

        endSpan(spanLocal, 'ok');
        expect(spanLocal.status).toBe('ok');
        expect(spanLocal.endTime).toBeDefined();

        const spanLlm = startSpan(trace, 'llm-generation');
        endSpan(spanLlm, 'error', 'API Rate Limit');
        expect(spanLlm.status).toBe('error');
        expect(spanLlm.error).toBe('API Rate Limit');
    });

    it('should finalize trace and update traceBuffer metrics properly', async () => {
        const previousStats = getTraceStats();
        const initialTotal = previousStats.totalTraces;

        const trace = createTrace('Explain quantum entanglement.');
        const span = startSpan(trace, 'retrieval');
        endSpan(span, 'ok');

        // Finalize trace (adds to buffer)
        finalizeTrace(trace, { sourceCount: 2 });

        expect(trace.endTime).toBeDefined();
        expect(trace.metadata.sourceCount).toBe(2);

        const newStats = getTraceStats();
        expect(newStats.totalTraces).toBe(initialTotal + 1);

        // Retrieve the recent trace
        const recent = getRecentTraces(1);
        expect(recent.length).toBe(1);
        expect(recent[0].id).toBe(trace.id);
    });

});
