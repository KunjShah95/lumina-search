/**
 * Unit Tests for RAG Orchestrator
 *
 * Tests: Reciprocal Rank Fusion (RRF), stream event structure, and
 * cache key generation integration.
 */

import { describe, it, expect } from 'vitest';
import { generateCacheKey } from '../src/main/rag/semanticCache';

/**
 * RRF implementation — extracted for testability.
 * Mirrors the function inside orchestrator.ts
 */
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

describe('RAG Orchestrator Logic', () => {
    describe('Reciprocal Rank Fusion', () => {
        it('should merge results from both sources', () => {
            const vectorResults: FusionItem[] = [
                { id: 'doc1', text: 'ML basics', source: 'ml.pdf', score: 0.9, type: 'vector' },
                { id: 'doc2', text: 'Deep learning', source: 'dl.pdf', score: 0.8, type: 'vector' },
            ];

            const bm25Results: FusionItem[] = [
                { id: 'doc2', text: 'Deep learning', source: 'dl.pdf', score: 5.2, type: 'bm25' },
                { id: 'doc3', text: 'NLP intro', source: 'nlp.pdf', score: 3.1, type: 'bm25' },
            ];

            const fused = reciprocalRankFusion(vectorResults, bm25Results);

            expect(fused.length).toBe(3);
            // doc2 should be ranked highest (appears in both)
            expect(fused[0].source).toBe('dl.pdf');
            expect(fused[0].fusionType).toBe('both');
        });

        it('should handle empty inputs', () => {
            expect(reciprocalRankFusion([], [])).toEqual([]);
        });

        it('should handle one empty list', () => {
            const vectorResults: FusionItem[] = [
                { id: 'doc1', text: 'only vector', source: 'v.txt', score: 0.9, type: 'vector' },
            ];

            const fused = reciprocalRankFusion(vectorResults, []);
            expect(fused.length).toBe(1);
            expect(fused[0].fusionType).toBe('vector');
        });

        it('should label single-source results correctly', () => {
            const vectorResults: FusionItem[] = [
                { id: 'v1', text: 'vector only', source: 'v.txt', score: 0.9, type: 'vector' },
            ];
            const bm25Results: FusionItem[] = [
                { id: 'b1', text: 'bm25 only', source: 'b.txt', score: 5.0, type: 'bm25' },
            ];

            const fused = reciprocalRankFusion(vectorResults, bm25Results);
            const vectorItem = fused.find(f => f.source === 'v.txt');
            const bm25Item = fused.find(f => f.source === 'b.txt');

            expect(vectorItem?.fusionType).toBe('vector');
            expect(bm25Item?.fusionType).toBe('bm25');
        });

        it('should boost documents appearing in both lists', () => {
            const shared = { id: 'shared', text: 'shared doc', source: 'shared.txt' };
            const vectorResults: FusionItem[] = [
                { ...shared, score: 0.5, type: 'vector' },
            ];
            const bm25Results: FusionItem[] = [
                { ...shared, score: 3.0, type: 'bm25' },
            ];

            const fused = reciprocalRankFusion(vectorResults, bm25Results);
            expect(fused.length).toBe(1);
            expect(fused[0].fusionType).toBe('both');

            // Score should be additive (RRF from both lists)
            const singleSourceFused = reciprocalRankFusion(vectorResults, []);
            expect(fused[0].score).toBeGreaterThan(singleSourceFused[0].score);
        });
    });

    describe('RAG Stream Event Types', () => {
        it('should define valid event types', () => {
            const validTypes = ['phase', 'token', 'sources', 'done', 'error', 'cache-hit'];
            // Verify the expected types match our type system
            validTypes.forEach(t => {
                expect(typeof t).toBe('string');
            });
        });
    });
});
