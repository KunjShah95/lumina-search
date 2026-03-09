import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const mockApp = {
    getPath: vi.fn(() => '/tmp/test-user-data')
}

vi.mock('electron', () => ({
    app: mockApp
}))

describe('SearchResultCache', () => {
    let cache: typeof import('../src/main/services/searchResultCache')
    
    beforeEach(async () => {
        vi.resetModules()
        const { initSearchResultCache, clearSearchCache } = await import('../src/main/services/searchResultCache')
        initSearchResultCache()
        clearSearchCache()
    })

    describe('getCachedResults', () => {
        it('returns null for non-existent query', async () => {
            const { getCachedResults } = await import('../src/main/services/searchResultCache')
            const result = getCachedResults('nonexistent query', ['duckduckgo'])
            expect(result).toBeNull()
        })
    })

    describe('setCachedResults', () => {
        it('caches search results', async () => {
            const { setCachedResults, getCachedResults, clearSearchCache } = await import('../src/main/services/searchResultCache')
            clearSearchCache()

            const mockResults = [
                { url: 'https://example.com', title: 'Example', snippet: 'Test', domain: 'example.com' }
            ]

            setCachedResults('test query', ['duckduckgo'], mockResults, 7)
            const cached = getCachedResults('test query', ['duckduckgo'])

            expect(cached).not.toBeNull()
            expect(cached?.results.length).toBe(1)
            expect(cached?.results[0].title).toBe('Example')
        })

        it('returns null for different query', async () => {
            const { setCachedResults, getCachedResults, clearSearchCache } = await import('../src/main/services/searchResultCache')
            clearSearchCache()

            setCachedResults('test query', ['duckduckgo'], [{ url: 'a', title: 'b', snippet: 'c', domain: 'd' }])
            const cached = getCachedResults('different query', ['duckduckgo'])

            expect(cached).toBeNull()
        })
    })

    describe('getCacheStats', () => {
        it('tracks hits and misses', async () => {
            const { getCachedResults, setCachedResults, getCacheStats, clearSearchCache } = await import('../src/main/services/searchResultCache')
            clearSearchCache()

            setCachedResults('query1', ['duckduckgo'], [{ url: 'a', title: 'b', snippet: 'c', domain: 'd' }])
            getCachedResults('query1', ['duckduckgo']) // hit
            getCachedResults('query2', ['duckduckgo']) // miss

            const stats = getCacheStats()

            expect(stats.hits).toBeGreaterThan(0)
            expect(stats.misses).toBeGreaterThan(0)
            expect(stats.hitRate).toBeGreaterThan(0)
            expect(stats.hitRate).toBeLessThan(1)
        })
    })

    describe('invalidateCache', () => {
        it('invalidates specific query', async () => {
            const { setCachedResults, getCachedResults, invalidateCache, clearSearchCache } = await import('../src/main/services/searchResultCache')
            clearSearchCache()

            setCachedResults('test query', ['duckduckgo'], [{ url: 'a', title: 'b', snippet: 'c', domain: 'd' }])
            
            const invalidated = invalidateCache('test query')

            expect(invalidated).toBe(1)
            expect(getCachedResults('test query', ['duckduckgo'])).toBeNull()
        })

        it('clears all when no query specified', async () => {
            const { setCachedResults, invalidateCache, getCacheStats, clearSearchCache } = await import('../src/main/services/searchResultCache')
            clearSearchCache()

            setCachedResults('query1', ['duckduckgo'], [{ url: 'a', title: 'b', snippet: 'c', domain: 'd' }])
            setCachedResults('query2', ['duckduckgo'], [{ url: 'e', title: 'f', snippet: 'g', domain: 'h' }])

            const invalidated = invalidateCache()

            expect(invalidated).toBe(2)
            expect(getCacheStats().totalEntries).toBe(0)
        })
    })
})
