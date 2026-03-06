/**
 * Optimized Vector Search Service
 * High-performance similarity search with caching and batching
 */

import { createLogger } from './logger'
import * as crypto from 'crypto'

const logger = createLogger('OptimizedVectorSearch')

export interface VectorEntry {
    id: string
    vector: number[]
    metadata: Record<string, any>
}

export interface SearchResult {
    id: string
    score: number
    metadata: Record<string, any>
}

export interface VectorSearchOptions {
    topK?: number
    minScore?: number
    filter?: (metadata: Record<string, any>) => boolean
    useCache?: boolean
}

const DEFAULT_TOP_K = 10
const CACHE_MAX_SIZE = 1000

// In-memory vector store (for production, use LanceDB)
let vectorStore: Map<string, VectorEntry[]> = new Map()
let searchCache: Map<string, SearchResult[]> = new Map()

// Performance metrics
let totalSearches = 0
let cacheHits = 0

export function initOptimizedVectorSearch(): void {
    vectorStore.clear()
    searchCache.clear()
    logger.info('Optimized vector search initialized')
}

function normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    if (magnitude === 0) return vector
    return vector.map(val => val / magnitude)
}

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    
    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

function euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let sum = 0
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i]
        sum += diff * diff
    }
    return Math.sqrt(sum)
}

export function addVector(id: string, vector: number[], metadata: Record<string, any> = {}): void {
    const normalized = normalizeVector(vector)
    
    const entry: VectorEntry = {
        id,
        vector: normalized,
        metadata,
    }
    
    // Store in collections by metadata category for faster filtering
    const collection = metadata.collection || 'default'
    
    if (!vectorStore.has(collection)) {
        vectorStore.set(collection, [])
    }
    
    vectorStore.get(collection)!.push(entry)
    
    // Invalidate cache when adding new vectors
    searchCache.clear()
    
    logger.info(`Added vector ${id} to collection ${collection}`)
}

export function addVectors(entries: Array<{ id: string; vector: number[]; metadata?: Record<string, any> }>): void {
    const startTime = Date.now()
    
    for (const entry of entries) {
        addVector(entry.id, entry.vector, entry.metadata || {})
    }
    
    logger.info(`Batch added ${entries.length} vectors in ${Date.now() - startTime}ms`)
}

export function searchVectors(
    query: number[],
    options: VectorSearchOptions = {}
): SearchResult[] {
    const {
        topK = DEFAULT_TOP_K,
        minScore = 0,
        filter,
        useCache = true,
    } = options
    
    totalSearches++
    
    // Generate cache key
    const normalizedQuery = normalizeVector(query)
    const cacheKey = generateCacheKey(normalizedQuery, options)
    
    // Check cache
    if (useCache && searchCache.has(cacheKey)) {
        cacheHits++
        return searchCache.get(cacheKey)!
    }
    
    const startTime = Date.now()
    const allResults: SearchResult[] = []
    
    // Search across all collections
    for (const [collection, entries] of vectorStore) {
        for (const entry of entries) {
            // Apply filter if provided
            if (filter && !filter(entry.metadata)) {
                continue
            }
            
            // Calculate similarity (using cosine similarity for normalized vectors)
            const score = cosineSimilarity(normalizedQuery, entry.vector)
            
            if (score >= minScore) {
                allResults.push({
                    id: entry.id,
                    score,
                    metadata: entry.metadata,
                })
            }
        }
    }
    
    // Sort by score descending
    allResults.sort((a, b) => b.score - a.score)
    
    // Limit results
    const results = allResults.slice(0, topK)
    
    // Cache results
    if (useCache && searchCache.size < CACHE_MAX_SIZE) {
        searchCache.set(cacheKey, results)
    }
    
    const searchTime = Date.now() - startTime
    
    if (totalSearches % 100 === 0) {
        logger.info(`Vector search stats: ${totalSearches} searches, ${cacheHits} cache hits, last search: ${searchTime}ms`)
    }
    
    return results
}

function generateCacheKey(query: number[], options: VectorSearchOptions): string {
    // Quantize query to reduce key variations
    const quantized = query.map(v => Math.round(v * 100) / 100)
    const data = JSON.stringify({ query: quantized, options })
    return crypto.createHash('md5').update(data).digest('hex')
}

export function deleteVector(id: string): boolean {
    for (const [collection, entries] of vectorStore) {
        const index = entries.findIndex(e => e.id === id)
        if (index !== -1) {
            entries.splice(index, 1)
            searchCache.clear()
            logger.info(`Deleted vector ${id}`)
            return true
        }
    }
    return false
}

export function deleteCollection(collection: string): number {
    const entries = vectorStore.get(collection)
    if (!entries) return 0
    
    const count = entries.length
    vectorStore.delete(collection)
    searchCache.clear()
    
    logger.info(`Deleted collection ${collection} with ${count} vectors`)
    return count
}

export function getCollectionSize(collection: string): number {
    return vectorStore.get(collection)?.length || 0
}

export function getAllCollections(): string[] {
    return Array.from(vectorStore.keys())
}

export function clearAllVectors(): void {
    vectorStore.clear()
    searchCache.clear()
    logger.info('Cleared all vector data')
}

export function getSearchStats(): {
    totalSearches: number
    cacheHits: number
    cacheHitRate: number
    totalVectors: number
    cacheSize: number
} {
    const totalVectors = Array.from(vectorStore.values()).reduce((sum, arr) => sum + arr.length, 0)
    return {
        totalSearches,
        cacheHits,
        cacheHitRate: totalSearches > 0 ? cacheHits / totalSearches : 0,
        totalVectors,
        cacheSize: searchCache.size,
    }
}

export function resetStats(): void {
    totalSearches = 0
    cacheHits = 0
}

// Batch search for multiple queries
export function batchSearch(
    queries: Array<{ query: number[]; options?: VectorSearchOptions }>
): Array<SearchResult[]> {
    const startTime = Date.now()
    
    const results = queries.map(({ query, options }) => searchVectors(query, options))
    
    const totalTime = Date.now() - startTime
    logger.info(`Batch searched ${queries.length} queries in ${totalTime}ms (avg: ${totalTime / queries.length}ms)`)
    
    return results
}

// Approximate nearest neighbors using partitioning (faster for large datasets)
export function approximateSearch(
    query: number[],
    options: VectorSearchOptions = {}
): SearchResult[] {
    const { topK = DEFAULT_TOP_K, minScore = 0 } = options
    
    const normalized = normalizeVector(query)
    
    // Sample from collections for approximate results
    const sampled: SearchResult[] = []
    
    for (const [collection, entries] of vectorStore) {
        // Take first 100 from each collection as sample
        const sample = entries.slice(0, 100)
        
        for (const entry of sample) {
            const score = cosineSimilarity(normalized, entry.vector)
            if (score >= minScore) {
                sampled.push({
                    id: entry.id,
                    score,
                    metadata: entry.metadata,
                })
            }
        }
    }
    
    // Sort and limit
    sampled.sort((a, b) => b.score - a.score)
    return sampled.slice(0, topK)
}
