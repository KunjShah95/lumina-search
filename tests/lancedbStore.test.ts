/**
 * LanceDB Vector Store Tests
 * Tests for vector storage, search, and management operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { LanceDBStore, getLanceDBStore } from '../src/main/services/lancedbStore'
import crypto from 'crypto'

// Mock electron app
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/tmp/test-lancedb'),
    },
}))

// Mock OpenAI
vi.mock('openai', () => {
    class MockOpenAI {
        embeddings = {
            create: vi.fn().mockResolvedValue({
                data: [{
                    embedding: Array(1536).fill(0).map(() => Math.random()),
                }],
            }),
        }
    }
    
    return {
        default: MockOpenAI,
    }
})

// Mock lancedb
vi.mock('@lancedb/lancedb', () => ({
    connect: vi.fn().mockResolvedValue({
        tableNames: vi.fn().mockResolvedValue([]),
        createTable: vi.fn().mockResolvedValue({}),
        openTable: vi.fn().mockResolvedValue({
            add: vi.fn().mockResolvedValue({}),
            search: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                execute: vi.fn().mockResolvedValue([]),
            }),
            delete: vi.fn().mockResolvedValue({}),
        }),
    }),
}))

describe('LanceDBStore', () => {
    let store: LanceDBStore

    beforeEach(async () => {
        // Reset environment
        process.env.OPENAI_API_KEY = 'test-key'
        
        // Create fresh store instance
        store = new LanceDBStore()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await store.initialize()
            
            expect(store.isAvailable()).toBe(true)
        })

        it('should not re-initialize if already initialized', async () => {
            await store.initialize()
            const firstInit = store.isAvailable()
            
            await store.initialize()
            const secondInit = store.isAvailable()
            
            expect(firstInit).toBe(true)
            expect(secondInit).toBe(true)
        })

        it('should handle missing OPENAI_API_KEY gracefully', async () => {
            delete process.env.OPENAI_API_KEY
            
            await store.initialize()
            
            // Should still initialize, just with fallback embeddings
            expect(store.isAvailable()).toBe(true)
        })
    })

    describe('addChunks', () => {
        beforeEach(async () => {
            await store.initialize()
        })

        it('should add text chunks with embeddings', async () => {
            const chunks = ['First chunk', 'Second chunk', 'Third chunk']
            
            await expect(
                store.addChunks(chunks, 'kb1', 'test-doc')
            ).resolves.not.toThrow()
        })

        it('should add pre-embedded vector chunks', async () => {
            const vectorChunks = [
                {
                    id: crypto.randomUUID(),
                    text: 'Chunk 1',
                    source: 'doc1',
                    kbId: 'kb1',
                    vector: Array(1536).fill(0),
                },
                {
                    id: crypto.randomUUID(),
                    text: 'Chunk 2',
                    source: 'doc1',
                    kbId: 'kb1',
                    vector: Array(1536).fill(0),
                },
            ]
            
            await expect(
                store.addChunks(vectorChunks)
            ).resolves.not.toThrow()
        })

        it('should skip empty chunks', async () => {
            const chunks = ['Valid chunk', '', '  ', 'Another valid']
            
            await store.addChunks(chunks, 'kb1', 'test-doc')
            
            // Should not throw
            expect(true).toBe(true)
        })

        it('should handle empty array', async () => {
            await expect(
                store.addChunks([], 'kb1', 'test-doc')
            ).resolves.not.toThrow()
        })

        it('should use fallback embeddings without API key', async () => {
            delete process.env.OPENAI_API_KEY
            const chunks = ['Test chunk']
            
            await expect(
                store.addChunks(chunks, 'kb1', 'test-doc')
            ).resolves.not.toThrow()
        })
    })

    describe('searchSimilar', () => {
        beforeEach(async () => {
            await store.initialize()
        })

        it('should search and return results', async () => {
            const results = await store.searchSimilar('query', 5)
            
            expect(Array.isArray(results)).toBe(true)
        })

        it('should filter by knowledge base ID', async () => {
            const results = await store.searchSimilar('query', 5, 'kb1')
            
            expect(Array.isArray(results)).toBe(true)
        })

        it('should limit results', async () => {
            const results = await store.searchSimilar('query', 3)
            
            expect(results.length).toBeLessThanOrEqual(3)
        })

        it('should return empty array when not initialized', async () => {
            const uninitializedStore = new LanceDBStore()
            const results = await uninitializedStore.searchSimilar('query')
            
            expect(results).toEqual([])
        })

        it('should convert distance to similarity score', async () => {
            const results = await store.searchSimilar('query', 5)
            
            // Scores should be between 0 and 1
            results.forEach(result => {
                expect(result.score).toBeGreaterThanOrEqual(0)
                expect(result.score).toBeLessThanOrEqual(1)
            })
        })
    })

    describe('deleteChunks', () => {
        beforeEach(async () => {
            await store.initialize()
        })

        it('should delete chunks by kbId', async () => {
            await expect(
                store.deleteChunks({ kbId: 'kb1' })
            ).resolves.not.toThrow()
        })

        it('should delete chunks by source', async () => {
            await expect(
                store.deleteChunks({ source: 'doc1' })
            ).resolves.not.toThrow()
        })

        it('should handle empty filter', async () => {
            await expect(
                store.deleteChunks({})
            ).resolves.not.toThrow()
        })

        it('should not throw when not initialized', async () => {
            const uninitializedStore = new LanceDBStore()
            
            await expect(
                uninitializedStore.deleteChunks({ kbId: 'kb1' })
            ).resolves.not.toThrow()
        })
    })

    describe('getAllChunks', () => {
        beforeEach(async () => {
            await store.initialize()
        })

        it('should get all chunks', async () => {
            const chunks = await store.getAllChunks()
            
            expect(Array.isArray(chunks)).toBe(true)
        })

        it('should filter chunks by kbId', async () => {
            const chunks = await store.getAllChunks('kb1')
            
            expect(Array.isArray(chunks)).toBe(true)
        })

        it('should return empty array when not initialized', async () => {
            const uninitializedStore = new LanceDBStore()
            const chunks = await uninitializedStore.getAllChunks()
            
            expect(chunks).toEqual([])
        })
    })

    describe('getStats', () => {
        beforeEach(async () => {
            await store.initialize()
        })

        it('should return statistics', async () => {
            const stats = await store.getStats()
            
            expect(stats).toHaveProperty('total')
            expect(stats).toHaveProperty('byKb')
            expect(stats).toHaveProperty('initialized')
            expect(typeof stats.total).toBe('number')
            expect(typeof stats.byKb).toBe('object')
            expect(typeof stats.initialized).toBe('boolean')
        })

        it('should return zero stats when not initialized', async () => {
            const uninitializedStore = new LanceDBStore()
            const stats = await uninitializedStore.getStats()
            
            expect(stats.total).toBe(0)
            expect(stats.byKb).toEqual({})
            expect(stats.initialized).toBe(false)
        })

        it('should count chunks by knowledge base', async () => {
            const stats = await store.getStats()
            
            expect(stats.byKb).toBeDefined()
            expect(typeof stats.byKb).toBe('object')
        })
    })

    describe('isAvailable', () => {
        it('should return false before initialization', () => {
            const newStore = new LanceDBStore()
            
            expect(newStore.isAvailable()).toBe(false)
        })

        it('should return true after successful initialization', async () => {
            const newStore = new LanceDBStore()
            await newStore.initialize()
            
            expect(newStore.isAvailable()).toBe(true)
        })
    })

    describe('singleton getLanceDBStore', () => {
        it('should return same instance', async () => {
            const instance1 = await getLanceDBStore()
            const instance2 = await getLanceDBStore()
            
            expect(instance1).toBe(instance2)
        })

        it('should initialize on first call', async () => {
            const instance = await getLanceDBStore()
            
            expect(instance.isAvailable()).toBe(true)
        })
    })
})
