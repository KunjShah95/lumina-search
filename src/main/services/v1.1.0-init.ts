/**
 * v1.1.0 Services Initialization
 * Bootstraps all new services introduced in v1.1.0
 * 
 * Services:
 * - Search Operators: Advanced query parsing (site:, filetype:, date:, etc.)
 * - Saved Searches: Save and auto-refresh search queries
 * - Search Analytics: Track search patterns and metrics
 * - PDF Export: Export threads to PDF with citations
 * - Local API Server: REST API for local access
 */

import { createLogger } from './logger'
import { getSettingsFromDb } from './database'

const logger = createLogger('v1.1.0-init')

// ─── Singleton instances ───────────────────────────────────

let searchOperatorsInstance: any
let savedSearchesInstance: any
let searchAnalyticsInstance: any
let pdfExportInstance: any
let localAPIServerInstance: any

// ─── Initialization Functions ───────────────────────────────

/**
 * Initialize Search Operators service
 */
export async function initSearchOperators(): Promise<void> {
  try {
    if (!searchOperatorsInstance) {
      const { SearchOperatorsManager } = await import('./searchOperators')
      searchOperatorsInstance = new SearchOperatorsManager()
    }
    logger.info('Search Operators initialized')
  } catch (error) {
    logger.error('Failed to initialize Search Operators:', error)
    throw error
  }
}

/**
 * Initialize Saved Searches service
 */
export async function initSavedSearches(): Promise<void> {
  try {
    if (!savedSearchesInstance) {
      const { SavedSearchesManager } = await import('./savedSearches')
      savedSearchesInstance = new SavedSearchesManager()
      
      // Load saved searches from database if they exist
      const settings = getSettingsFromDb()
      if (settings.savedSearches) {
        logger.info(`Loaded ${Object.keys(settings.savedSearches).length} saved searches`)
      }
    }
    logger.info('Saved Searches initialized')
  } catch (error) {
    logger.error('Failed to initialize Saved Searches:', error)
    throw error
  }
}

/**
 * Initialize Search Analytics service
 */
export async function initSearchAnalytics(): Promise<void> {
  try {
    if (!searchAnalyticsInstance) {
      const { SearchAnalyticsManager } = await import('./searchAnalytics')
      searchAnalyticsInstance = new SearchAnalyticsManager()
    }
    logger.info('Search Analytics initialized')
  } catch (error) {
    logger.error('Failed to initialize Search Analytics:', error)
    throw error
  }
}

/**
 * Initialize PDF Export service
 */
export async function initPDFExport(): Promise<void> {
  try {
    if (!pdfExportInstance) {
      const { PDFExportManager } = await import('./pdfExport')
      pdfExportInstance = new PDFExportManager()
    }
    logger.info('PDF Export initialized')
  } catch (error) {
    logger.error('Failed to initialize PDF Export:', error)
    throw error
  }
}

/**
 * Initialize Local API Server
 */
export async function initLocalAPIServer(): Promise<void> {
  try {
    if (!localAPIServerInstance) {
      const { LocalAPIServer } = await import('./localAPIServer')
      const settings = getSettingsFromDb()
      
      const port = settings.apiServerPort || 8080
      const requireAuth = settings.apiServerRequireAuth || false
      
      localAPIServerInstance = new LocalAPIServer({
        port,
        host: 'localhost',
        enableWebhooks: true,
        requireAPIKey: requireAuth,
      })
      
      // Register standard handlers
      registerAPIHandlers(localAPIServerInstance)
      
      // Start server only if enabled in settings
      if (settings.apiServerEnabled) {
        await localAPIServerInstance.start()
      }
    }
    logger.info('Local API Server initialized')
  } catch (error) {
    logger.error('Failed to initialize Local API Server:', error)
    throw error
  }
}

/**
 * Stop Local API Server gracefully
 */
export async function stopLocalAPIServer(): Promise<void> {
  if (localAPIServerInstance) {
    try {
      await localAPIServerInstance.stop()
      logger.info('Local API Server stopped')
    } catch (error) {
      logger.error('Error stopping API Server:', error)
    }
  }
}

// ─── Getter Functions for Services ────────────────────────────

export function getSearchOperators() {
  if (!searchOperatorsInstance) {
    throw new Error('Search Operators not initialized. Call initSearchOperators() first.')
  }
  return searchOperatorsInstance
}

export function getSavedSearches() {
  if (!savedSearchesInstance) {
    throw new Error('Saved Searches not initialized. Call initSavedSearches() first.')
  }
  return savedSearchesInstance
}

export function getSearchAnalytics() {
  if (!searchAnalyticsInstance) {
    throw new Error('Search Analytics not initialized. Call initSearchAnalytics() first.')
  }
  return searchAnalyticsInstance
}

export function getPDFExport() {
  if (!pdfExportInstance) {
    throw new Error('PDF Export not initialized. Call initPDFExport() first.')
  }
  return pdfExportInstance
}

export function getLocalAPIServer() {
  if (!localAPIServerInstance) {
    throw new Error('Local API Server not initialized. Call initLocalAPIServer() first.')
  }
  return localAPIServerInstance
}

// ─── API Handler Registration ───────────────────────────────

/**
 * Register all standard API handlers
 */
function registerAPIHandlers(apiServer: any): void {
  try {
    // Search endpoint
    apiServer.registerHandler('/api/v1/search', async (params: any) => {
      const { q, source, limit } = params
      return {
        query: q,
        results: [],
        resultCount: 0,
        executionTimeMs: 0,
      }
    })

    // Saved searches endpoints
    apiServer.registerHandler('/api/v1/saved-searches', async () => {
      const manager = getSavedSearches()
      return manager.getAllSearches?.() || []
    })

    // Analytics endpoint
    apiServer.registerHandler('/api/v1/analytics', async () => {
      const manager = getSearchAnalytics()
      return manager.getAnalytics?.() || {}
    })

    // Export endpoint
    apiServer.registerHandler('/api/v1/export/pdf', async (params: any) => {
      const { threadId, citationFormat } = params
      const manager = getPDFExport()
      // Will be implemented when context is available
      return { success: true, path: '' }
    })

    // Health check
    apiServer.registerHandler('/api/v1/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() }
    })

    logger.info('API handlers registered')
  } catch (error) {
    logger.error('Failed to register API handlers:', error)
  }
}

// ─── Composite Initialization ─────────────────────────────────

/**
 * Initialize all v1.1.0 services
 */
export async function initializeAllV110Services(): Promise<void> {
  try {
    logger.info('Initializing v1.1.0 services...')
    
    await initSearchOperators()
    await initSavedSearches()
    await initSearchAnalytics()
    await initPDFExport()
    await initLocalAPIServer()
    
    logger.info('All v1.1.0 services initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize v1.1.0 services:', error)
    throw error
  }
}

/**
 * Cleanup all v1.1.0 services
 */
export async function cleanupAllV110Services(): Promise<void> {
  try {
    logger.info('Cleaning up v1.1.0 services...')
    await stopLocalAPIServer()
    logger.info('v1.1.0 services cleaned up')
  } catch (error) {
    logger.error('Error during cleanup:', error)
  }
}
