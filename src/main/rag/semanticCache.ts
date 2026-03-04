/**
 * Persistent Semantic Cache — JSON-backed caching for RAG queries.
 * Replaces the in-memory LRU cache with durable, searchable storage.
 *
 * Features:
 *   - MD5-based cache keys from (query + options)
 *   - TTL-based expiration (configurable, default 24 hours)
 *   - Hit/miss metrics for observability
 *   - Automatic cleanup of expired entries
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { app } from 'electron';
import { createLogger } from '../services/logger';

const logger = createLogger('semantic-cache');

interface CacheEntry {
    cacheKey: string;
    query: string;
    options: string;
    response: string;
    createdAt: number;
    expiresAt: number;
    hitCount: number;
}

let cache: Map<string, CacheEntry> = new Map();
let cachePath: string = '';
let dbPath: string = '';
let isLoaded: boolean = false;

// ── Cache Stats ────────────────────────────────────────────

interface CacheStats {
    hits: number;
    misses: number;
    totalEntries: number;
}

let cacheHits = 0;
let cacheMisses = 0;

// ── Init ───────────────────────────────────────────────────

export function initSemanticCache(): void {
    dbPath = path.join(app.getPath('userData'), 'semantic_cache.json');
    loadCache();
    cleanupExpired();
    logger.info('Initialized JSON persistent cache');
}

function loadCache(): void {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf-8');
            const entries: CacheEntry[] = JSON.parse(data);
            const now = Date.now();
            for (const entry of entries) {
                if (entry.expiresAt > now) {
                    cache.set(entry.cacheKey, entry);
                }
            }
            logger.info('Loaded entries from persistent cache', { size: cache.size });
        }
    } catch (err) {
        logger.error('Failed to load cache', err);
        cache = new Map();
    }
    isLoaded = true;
}

function saveCache(): void {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(Array.from(cache.values()), null, 2));
    } catch (err) {
        logger.error('Failed to save cache', err);
    }
}

// ── Core Operations ────────────────────────────────────────

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a deterministic cache key from query + options.
 */
export function generateCacheKey(query: string, options: Record<string, unknown>): string {
    const raw = `${query.toLowerCase().trim()}:${JSON.stringify(options)}`;
    return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Get a cached response if it exists and is not expired.
 */
export function getCachedResponse(cacheKey: string): string | null {
    const entry = cache.get(cacheKey);
    
    if (!entry) {
        cacheMisses++;
        return null;
    }
    
    if (Date.now() > entry.expiresAt) {
        cache.delete(cacheKey);
        cacheMisses++;
        saveCache();
        return null;
    }

    // Increment hit count
    entry.hitCount++;
    cacheHits++;

    logger.debug('Cache HIT', { cacheKeyPrefix: cacheKey.slice(0, 8) });
    return entry.response;
}

/**
 * Store a response in the cache.
 */
export function setCachedResponse(
    cacheKey: string,
    query: string,
    options: Record<string, unknown>,
    response: string,
    ttlMs: number = DEFAULT_TTL_MS
): void {
    const now = Date.now();
    
    const entry: CacheEntry = {
        cacheKey,
        query,
        options: JSON.stringify(options),
        response,
        createdAt: now,
        expiresAt: now + ttlMs,
        hitCount: 0,
    };

    // Evict oldest if cache is too large (keep max 1000 entries)
    if (cache.size >= 1000) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, ent] of cache) {
            if (ent.createdAt < oldestTime) {
                oldestTime = ent.createdAt;
                oldestKey = key;
            }
        }
        if (oldestKey) cache.delete(oldestKey);
    }

    cache.set(cacheKey, entry);
    saveCache();

    logger.debug('Cached response', { cacheKeyPrefix: cacheKey.slice(0, 8), ttlSec: ttlMs / 1000 });
}

/**
 * Remove expired entries from the cache.
 */
export function cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of cache) {
        if (entry.expiresAt < now) {
            cache.delete(key);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        logger.info('Cleaned expired cache entries', { cleaned });
        saveCache();
    }
    
    return cleaned;
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
    cache.clear();
    cacheHits = 0;
    cacheMisses = 0;
    saveCache();
    logger.info('Cache cleared');
}

/**
 * Get cache statistics for observability.
 */
export function getCacheStats(): CacheStats {
    return {
        hits: cacheHits,
        misses: cacheMisses,
        totalEntries: cache.size,
    };
}
