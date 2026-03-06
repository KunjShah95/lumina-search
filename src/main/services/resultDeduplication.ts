/**
 * Search Result Deduplication Service
 * Removes duplicate and near-duplicate results from search output
 */

import { createLogger } from './logger'

const logger = createLogger('Deduplication')

export interface DedupeOptions {
    threshold?: number  // Similarity threshold 0-1 (default 0.85)
    useDomainGrouping?: boolean  // Group results by domain
    maxPerDomain?: number  // Max results per domain
}

export interface SearchResult {
    url: string
    title: string
    snippet: string
    domain: string
    [key: string]: any
}

// Compute Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = []
        for (let j = 0; j <= a.length; j++) {
            matrix[i][j] = 0
        }
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                )
            }
        }
    }
    
    return matrix[b.length][a.length]
}

// Compute Jaccard similarity between two strings
function jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/))
    const setB = new Set(b.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...setA].filter(x => setB.has(x)))
    const union = new Set([...setA, ...setB])
    
    return intersection.size / union.size
}

// Compute cosine similarity using character n-grams
function cosineSimilarity(a: string, b: string): number {
    const n = 3 // trigrams
    
    function getNGrams(str: string): Map<string, number> {
        const ngrams = new Map<string, number>()
        const lower = str.toLowerCase()
        
        for (let i = 0; i <= lower.length - n; i++) {
            const gram = lower.substring(i, i + n)
            ngrams.set(gram, (ngrams.get(gram) || 0) + 1)
        }
        
        return ngrams
    }
    
    const ngramsA = getNGrams(a)
    const ngramsB = getNGrams(b)
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (const [gram, countA] of ngramsA) {
        const countB = ngramsB.get(gram) || 0
        dotProduct += countA * countB
        normA += countA * countA
    }
    
    for (const count of ngramsB.values()) {
        normB += count * count
    }
    
    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Check if two URLs are likely the same page
function isSameURL(url1: string, url2: string): boolean {
    try {
        const u1 = new URL(url1)
        const u2 = new URL(url2)
        
        // Same domain and path
        if (u1.hostname === u2.hostname && u1.pathname === u2.pathname) {
            return true
        }
        
        // Same domain with common variations
        const base1 = u1.hostname.replace(/^www\./, '')
        const base2 = u2.hostname.replace(/^www\./, '')
        
        return base1 === base2 && u1.pathname.split('/').slice(0, 3).join('/') === u2.pathname.split('/').slice(0, 3).join('/')
    } catch {
        return false
    }
}

// Compute overall similarity between two results
function computeSimilarity(a: SearchResult, b: SearchResult, threshold: number): number {
    // URL match is a strong indicator
    if (isSameURL(a.url, b.url)) {
        return 1.0
    }
    
    // Title similarity
    const titleSim = cosineSimilarity(a.title, b.title)
    if (titleSim > threshold) {
        return titleSim
    }
    
    // Snippet similarity
    const snippetSim = jaccardSimilarity(a.snippet, b.snippet)
    
    // Combined score
    return (titleSim * 0.6 + snippetSim * 0.4)
}

export function deduplicateResults(
    results: SearchResult[],
    options: DedupeOptions = {}
): SearchResult[] {
    const {
        threshold = 0.85,
        useDomainGrouping = true,
        maxPerDomain = 3,
    } = options
    
    if (results.length === 0) {
        return []
    }
    
    logger.info(`Deduplicating ${results.length} results (threshold: ${threshold})`)
    
    // First, remove exact URL duplicates
    const urlSeen = new Set<string>()
    const uniqueURL: SearchResult[] = []
    
    for (const result of results) {
        if (!urlSeen.has(result.url)) {
            urlSeen.add(result.url)
            uniqueURL.push(result)
        }
    }
    
    // If domain grouping enabled, limit per domain
    if (useDomainGrouping) {
        const domainCount = new Map<string, number>()
        const domainLimited: SearchResult[] = []
        
        for (const result of uniqueURL) {
            const domain = result.domain || new URL(result.url).hostname
            const count = domainCount.get(domain) || 0
            
            if (count < maxPerDomain) {
                domainLimited.push(result)
                domainCount.set(domain, count + 1)
            }
        }
        
        logger.info(`After domain grouping: ${domainLimited.length} results`)
        return domainLimited
    }
    
    // Remove near-duplicates using similarity
    const deduplicated: SearchResult[] = []
    
    for (const result of uniqueURL) {
        let isDuplicate = false
        
        for (const existing of deduplicated) {
            const similarity = computeSimilarity(result, existing, threshold)
            
            if (similarity >= threshold) {
                // Keep the one with more complete data
                if (result.snippet.length > existing.snippet.length) {
                    const index = deduplicated.indexOf(existing)
                    deduplicated[index] = result
                }
                isDuplicate = true
                break
            }
        }
        
        if (!isDuplicate) {
            deduplicated.push(result)
        }
    }
    
    logger.info(`After dedup: ${deduplicated.length} unique results`)
    
    return deduplicated
}

// Group results by domain for display
export function groupByDomain(results: SearchResult[]): Map<string, SearchResult[]> {
    const groups = new Map<string, SearchResult[]>()
    
    for (const result of results) {
        const domain = result.domain || 'unknown'
        
        if (!groups.has(domain)) {
            groups.set(domain, [])
        }
        
        groups.get(domain)!.push(result)
    }
    
    // Sort domains by number of results
    const sortedGroups = new Map(
        [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
    )
    
    return sortedGroups
}

// Find potential duplicate clusters
export function findDuplicateClusters(
    results: SearchResult[],
    threshold: number = 0.7
): Array<{ original: SearchResult; duplicates: SearchResult[] }> {
    const clusters: Array<{ original: SearchResult; duplicates: SearchResult[] }> = []
    
    for (let i = 0; i < results.length; i++) {
        const duplicates: SearchResult[] = []
        
        for (let j = i + 1; j < results.length; j++) {
            const similarity = computeSimilarity(results[i], results[j], threshold)
            
            if (similarity >= threshold) {
                duplicates.push(results[j])
            }
        }
        
        if (duplicates.length > 0) {
            clusters.push({ original: results[i], duplicates })
        }
    }
    
    return clusters
}
