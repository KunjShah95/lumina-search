import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { clearCache, initSemanticCache, getCachedResponse, setCachedResponse, getCacheStats, generateCacheKey } from '../src/main/rag/semanticCache';

// Mock fs and electron native modules
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/mocked/userData')
    }
}));

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => false),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
    }
}));

describe('Persistent Semantic Cache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
        initSemanticCache();
    });

    it('should initialize successfully with an empty cache', () => {
        expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('semantic_cache.json'));
        const stats = getCacheStats();
        expect(stats.totalEntries).toBe(0);
    });

    it('should set an entry in the cache and retrieve it', () => {
        const query = 'what is relativistic physics?';
        const options = { focusMode: 'all' };
        const key = generateCacheKey(query, options);

        // Ensure cache miss initially
        const miss = getCachedResponse(key);
        expect(miss).toBeNull();

        const statsMiss = getCacheStats();
        expect(statsMiss.misses).toBe(1);

        // Set Cache
        setCachedResponse(key, query, options, 'It studies frames of reference');

        // Retrieve Cache (Hit)
        const hit = getCachedResponse(key);
        expect(hit).not.toBeNull();
        expect(hit).toBe('It studies frames of reference');

        const statsHit = getCacheStats();
        expect(statsHit.hits).toBe(1);
        expect(statsHit.totalEntries).toBe(1);
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should clear the cache correctly', () => {
        const key = generateCacheKey('test', {});
        setCachedResponse(key, 'test', {}, 'answer');

        let stats = getCacheStats();
        expect(stats.totalEntries).toBe(1);

        clearCache();

        stats = getCacheStats();
        expect(stats.totalEntries).toBe(0);
    });
});
