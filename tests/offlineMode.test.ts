import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/main/services/searchResultCache', () => ({
    getCachedResults: vi.fn(),
}))

describe('offlineMode service', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('enables and disables offline mode config', async () => {
        const offline = await import('../src/main/services/offlineMode')

        offline.setOfflineMode(true)
        expect(offline.getOfflineConfig().enabled).toBe(true)

        offline.setOfflineMode(false)
        expect(offline.getOfflineConfig().enabled).toBe(false)
    })

    it('returns null for offline search when online and offline mode disabled', async () => {
        const offline = await import('../src/main/services/offlineMode')

        offline.setOfflineMode(false)
        const result = await offline.searchOffline('test query', ['duckduckgo'])
        expect(result).toBeNull()
    })

    it('returns cached offline results when offline mode is enabled and cache exists', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('offline'))
        const cache = await import('../src/main/services/searchResultCache')
        const mocked = vi.mocked(cache.getCachedResults)
        mocked.mockReturnValueOnce({
            query: 'cached query',
            providers: ['duckduckgo'],
            results: [{ title: 'Cached', url: 'https://example.com' }],
            timestamp: Date.now(),
        } as any)

        const offline = await import('../src/main/services/offlineMode')
        offline.setOfflineMode(true)
        await new Promise((resolve) => setTimeout(resolve, 0))

        const result = await offline.searchOffline('cached query', ['duckduckgo'])
        expect(result).toBeTruthy()
        expect(result?.cached).toBe(true)
        expect(result?.results.length).toBe(1)
        fetchSpy.mockRestore()
    })

    it('computes offline capabilities shape', async () => {
        const offline = await import('../src/main/services/offlineMode')
        const capabilities = await offline.checkOfflineCapabilities()

        expect(Array.isArray(capabilities)).toBe(true)
        expect(capabilities.some((c) => c.type === 'cached_results')).toBe(true)
        expect(capabilities.some((c) => c.type === 'local_kb')).toBe(true)
        expect(capabilities.some((c) => c.type === 'local_models')).toBe(true)
    })
})
