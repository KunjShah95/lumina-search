/**
 * Unit Tests for BM25 Keyword Search Engine
 *
 * Tests: tokenization, indexing, scoring, filtering by kbId, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BM25Engine } from '../src/main/rag/bm25';

describe('BM25Engine', () => {
    let engine: BM25Engine;

    beforeEach(() => {
        engine = new BM25Engine();
    });

    describe('Tokenization & Indexing', () => {
        it('should index documents and return results', () => {
            engine.index([
                { id: '1', text: 'JavaScript is a programming language', source: 'doc1.txt', kbId: 'kb1' },
                { id: '2', text: 'Python is another programming language', source: 'doc2.txt', kbId: 'kb1' },
            ]);

            const results = engine.search('JavaScript programming');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].source).toBe('doc1.txt');
        });

        it('should handle empty query', () => {
            engine.index([
                { id: '1', text: 'Some document content', source: 'doc.txt', kbId: 'kb1' },
            ]);

            const results = engine.search('');
            expect(results).toEqual([]);
        });

        it('should handle empty index', () => {
            engine.index([]);
            const results = engine.search('anything');
            expect(results).toEqual([]);
        });

        it('should strip stopwords and punctuation', () => {
            engine.index([
                { id: '1', text: 'The quick brown fox jumps over the lazy dog', source: 'fox.txt', kbId: 'kb1' },
            ]);

            // "the" and "over" are stopwords — only "quick brown fox jumps lazy dog" should be indexed
            const results = engine.search('quick fox');
            expect(results.length).toBe(1);
            expect(results[0].score).toBeGreaterThan(0);
        });
    });

    describe('Scoring & Ranking', () => {
        it('should rank more relevant documents higher', () => {
            engine.index([
                { id: '1', text: 'machine learning deep learning neural networks', source: 'ml.txt', kbId: 'kb1' },
                { id: '2', text: 'cooking recipes baking bread ovens', source: 'food.txt', kbId: 'kb1' },
                { id: '3', text: 'machine learning algorithms classification', source: 'ml2.txt', kbId: 'kb1' },
            ]);

            const results = engine.search('machine learning algorithms', 3);
            expect(results.length).toBe(2); // food.txt should not match
            expect(results[0].source).toBe('ml2.txt'); // best match
            expect(results[0].score).toBeGreaterThan(results[1].score);
        });

        it('should respect limit parameter', () => {
            engine.index([
                { id: '1', text: 'document one with keyword', source: 'doc1.txt', kbId: 'kb1' },
                { id: '2', text: 'document two with keyword', source: 'doc2.txt', kbId: 'kb1' },
                { id: '3', text: 'document three with keyword', source: 'doc3.txt', kbId: 'kb1' },
            ]);

            const results = engine.search('keyword', 2);
            expect(results.length).toBe(2);
        });
    });

    describe('Knowledge Base Filtering', () => {
        it('should filter results by kbId', () => {
            engine.index([
                { id: '1', text: 'React framework components', source: 'react.txt', kbId: 'kb1' },
                { id: '2', text: 'React hooks and state management', source: 'hooks.txt', kbId: 'kb2' },
                { id: '3', text: 'Vue framework components', source: 'vue.txt', kbId: 'kb1' },
            ]);

            const results = engine.search('React components', 5, 'kb1');
            expect(results.length).toBe(2);
            expect(results[0].source).toBe('react.txt');
            expect(results[1].source).toBe('vue.txt');
        });

        it('should return all results when kbId is not specified', () => {
            engine.index([
                { id: '1', text: 'shared keyword document', source: 'doc1.txt', kbId: 'kb1' },
                { id: '2', text: 'shared keyword paper', source: 'doc2.txt', kbId: 'kb2' },
            ]);

            const results = engine.search('shared keyword');
            expect(results.length).toBe(2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle documents with special characters', () => {
            engine.index([
                { id: '1', text: 'C++ && JavaScript => multi-language support!', source: 'lang.txt', kbId: 'kb1' },
            ]);

            const results = engine.search('JavaScript');
            expect(results.length).toBe(1);
        });

        it('should handle very long documents', () => {
            const longText = Array(1000).fill('word').join(' ') + ' unique_term';
            engine.index([
                { id: '1', text: longText, source: 'long.txt', kbId: 'kb1' },
            ]);

            const results = engine.search('unique_term');
            expect(results.length).toBe(1);
        });

        it('should handle re-indexing', () => {
            engine.index([
                { id: '1', text: 'first index', source: 'first.txt', kbId: 'kb1' },
            ]);

            engine.index([
                { id: '2', text: 'second index different content', source: 'second.txt', kbId: 'kb1' },
            ]);

            const results = engine.search('first');
            expect(results.length).toBe(0); // first doc should be gone after re-indexing

            const results2 = engine.search('second');
            expect(results2.length).toBe(1);
        });
    });
});
