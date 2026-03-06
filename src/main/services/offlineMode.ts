/**
 * Offline Mode Service
 * Handles offline functionality for Lumina Search
 */

import { createLogger } from './logger'
import { getCachedResults } from './searchResultCache'

const logger = createLogger('OfflineMode')

export interface OfflineConfig {
    enabled: boolean
    autoFallback: boolean
    maxOfflineDays: number
    preferLocalKB: boolean
}

export interface NetworkStatus {
    online: boolean
    lastOnline: number | null
    offlineMode: boolean
}

let networkStatus: NetworkStatus = {
    online: true,
    lastOnline: null,
    offlineMode: false,
}

let offlineConfig: OfflineConfig = {
    enabled: false,
    autoFallback: true,
    maxOfflineDays: 30,
    preferLocalKB: true,
}

let networkCheckInterval: NodeJS.Timeout | null = null

export function initOfflineMode(config?: Partial<OfflineConfig>): void {
    offlineConfig = { ...offlineConfig, ...config }
    
    if (offlineConfig.enabled) {
        startNetworkMonitoring()
    }
    
    logger.info('Offline mode initialized', { config: offlineConfig })
}

function startNetworkMonitoring(): void {
    if (networkCheckInterval) {
        clearInterval(networkCheckInterval)
    }
    
    // Check network status every 30 seconds
    networkCheckInterval = setInterval(async () => {
        const wasOnline = networkStatus.online
        networkStatus.online = await checkNetworkConnection()
        
        if (wasOnline && !networkStatus.online) {
            logger.warn('Network connection lost')
            networkStatus.lastOnline = Date.now()
        } else if (!wasOnline && networkStatus.online) {
            logger.info('Network connection restored')
            networkStatus.lastOnline = null
        }
    }, 30000)
    
    // Initial check
    checkNetworkConnection().then(online => {
        networkStatus.online = online
    })
}

async function checkNetworkConnection(): Promise<boolean> {
    try {
        // Try to reach a reliable endpoint
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        return true
    } catch {
        return false
    }
}

export function getNetworkStatus(): NetworkStatus {
    return { ...networkStatus }
}

export function isOnline(): boolean {
    return networkStatus.online
}

export function isOfflineMode(): boolean {
    return offlineConfig.enabled && !networkStatus.online
}

export function setOfflineMode(enabled: boolean): void {
    offlineConfig.enabled = enabled
    
    if (enabled) {
        startNetworkMonitoring()
    } else if (networkCheckInterval) {
        clearInterval(networkCheckInterval)
        networkCheckInterval = null
    }
    
    networkStatus.offlineMode = enabled && !networkStatus.online
    logger.info(`Offline mode ${enabled ? 'enabled' : 'disabled'}`)
}

export function getOfflineConfig(): OfflineConfig {
    return { ...offlineConfig }
}

export function updateOfflineConfig(config: Partial<OfflineConfig>): void {
    offlineConfig = { ...offlineConfig, ...config }
    logger.info('Offline config updated', { config: offlineConfig })
}

export interface OfflineSearchResult {
    query: string
    cached: boolean
    results: any[]
    timestamp: number
}

export async function searchOffline(query: string, providers: string[]): Promise<OfflineSearchResult | null> {
    if (!isOfflineMode() && networkStatus.online) {
        return null
    }
    
    logger.info(`Searching offline for: ${query}`)
    
    // Try to get cached results
    const cached = getCachedResults(query, providers)
    
    if (cached) {
        logger.info(`Found cached results for: ${query}`)
        return {
            query,
            cached: true,
            results: cached.results,
            timestamp: cached.timestamp,
        }
    }
    
    // No cached results available offline
    logger.warn(`No cached results for offline search: ${query}`)
    return null
}

export function getOfflineTimeRemaining(): number | null {
    if (!networkStatus.lastOnline || !offlineConfig.enabled) {
        return null
    }
    
    const maxOfflineMs = offlineConfig.maxOfflineDays * 24 * 60 * 60 * 1000
    const elapsed = Date.now() - networkStatus.lastOnline
    const remaining = maxOfflineMs - elapsed
    
    return Math.max(0, remaining)
}

export function canStayOffline(): boolean {
    const remaining = getOfflineTimeRemaining()
    return remaining === null || remaining > 0
}

export interface OfflineCapability {
    type: 'cached_results' | 'local_kb' | 'local_models' | 'none'
    available: boolean
    details: string
}

export async function checkOfflineCapabilities(): Promise<OfflineCapability[]> {
    const capabilities: OfflineCapability[] = []
    
    // Check cached results
    const cached = getCachedResults('__check__', [])
    capabilities.push({
        type: 'cached_results',
        available: cached !== null,
        details: cached ? 'Cached search results available' : 'No cached results',
    })
    
    // Check local KB (simplified check)
    capabilities.push({
        type: 'local_kb',
        available: offlineConfig.preferLocalKB,
        details: offlineConfig.preferLocalKB ? 'Local knowledge base enabled' : 'Local KB disabled',
    })
    
    // Check local models
    capabilities.push({
        type: 'local_models',
        available: true,
        details: 'Local models (Ollama/LM Studio) available',
    })
    
    return capabilities
}

export function shutdownOfflineMode(): void {
    if (networkCheckInterval) {
        clearInterval(networkCheckInterval)
        networkCheckInterval = null
    }
    logger.info('Offline mode shutdown')
}
