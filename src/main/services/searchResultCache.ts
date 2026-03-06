/**
 * Search Result Cache
 * Caches web search results for faster repeated queries
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { app } from 'electron'
import { createLogger } from './logger'

const logger = createLogger('SearchResultCache')

export interface CachedSearchResult {
  query: string
  providers: string[]
  results: SearchResult[]
  timestamp: number
  expiresAt: number
  hitCount: number
}

export interface SearchResult {
  url: string
  title: string
  snippet: string
  domain: string
}

export interface CacheStats {
  hits: number
  misses: number
  totalEntries: number
  hitRate: number
}

let cache: Map<string, CachedSearchResult> = new Map()
let cachePath: string = ''
let hits = 0
let misses = 0

const DEFAULT_TTL_DAYS = 7
const MAX_CACHE_SIZE = 1000

export function initSearchResultCache(): void {
  const userDataPath = app?.getPath?.('userData') || process.cwd()
  cachePath = path.join(userDataPath, 'search_result_cache.json')
  loadCache()
  cleanupExpired()
  logger.info('Search result cache initialized')
}

function loadCache(): void {
  try {
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, 'utf-8')
      const entries: CachedSearchResult[] = JSON.parse(data)
      const now = Date.now()
      
      for (const entry of entries) {
        if (entry.expiresAt > now) {
          cache.set(generateCacheKey(entry.query, entry.providers), entry)
        }
      }
      
      logger.info(`Loaded ${cache.size} entries from search result cache`)
    }
  } catch (err) {
    logger.error('Failed to load search result cache', err)
    cache = new Map()
  }
}

function saveCache(): void {
  try {
    const entries = Array.from(cache.values())
    fs.writeFileSync(cachePath, JSON.stringify(entries, null, 2))
  } catch (err) {
    logger.error('Failed to save search result cache', err)
  }
}

function generateCacheKey(query: string, providers: string[]): string {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ')
  const keyData = `${normalized}:${providers.sort().join(',')}`
  return crypto.createHash('md5').update(keyData).digest('hex')
}

function cleanupExpired(): void {
  const now = Date.now()
  let cleaned = 0
  
  cache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      cache.delete(key)
      cleaned++
    }
  })
  
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} expired search cache entries`)
    saveCache()
  }
}

function evictOldestIfNeeded(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    let oldestKey = ''
    let oldestTime = Date.now()
    
    cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    })
    
    if (oldestKey) {
      cache.delete(oldestKey)
      logger.info('Evicted oldest cache entry')
    }
  }
}

export function getCachedResults(query: string, providers: string[]): CachedSearchResult | null {
  const key = generateCacheKey(query, providers)
  const cached = cache.get(key)
  
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      hits++
      cached.hitCount++
      logger.info(`Search cache HIT for: ${query.substring(0, 50)}...`)
      return cached
    } else {
      cache.delete(key)
    }
  }
  
  misses++
  logger.info(`Search cache MISS for: ${query.substring(0, 50)}...`)
  return null
}

export function setCachedResults(
  query: string,
  providers: string[],
  results: SearchResult[],
  ttlDays: number = DEFAULT_TTL_DAYS
): void {
  const key = generateCacheKey(query, providers)
  const now = Date.now()
  
  evictOldestIfNeeded()
  
  const entry: CachedSearchResult = {
    query,
    providers,
    results,
    timestamp: now,
    expiresAt: now + ttlDays * 24 * 60 * 60 * 1000,
    hitCount: 0,
  }
  
  cache.set(key, entry)
  saveCache()
  
  logger.info(`Cached search results for: ${query.substring(0, 50)}... (${results.length} results)`)
}

export function getCacheStats(): CacheStats {
  const total = hits + misses
  return {
    hits,
    misses,
    totalEntries: cache.size,
    hitRate: total > 0 ? hits / total : 0,
  }
}

export function clearSearchCache(): void {
  cache.clear()
  hits = 0
  misses = 0
  saveCache()
  logger.info('Search result cache cleared')
}

export function invalidateCache(query?: string): number {
  let invalidated = 0
  
  if (query) {
    const key = generateCacheKey(query, [])
    if (cache.has(key)) {
      cache.delete(key)
      invalidated = 1
    }
  } else {
    invalidated = cache.size
    cache.clear()
  }
  
  saveCache()
  return invalidated
}

export function getCacheSize(): number {
  return cache.size
}
