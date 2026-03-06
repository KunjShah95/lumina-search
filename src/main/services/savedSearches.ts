/**
 * Saved Searches Service
 * Manages saved search templates, quick searches, and auto-refresh capabilities
 */

import { createLogger } from './logger'

const logger = createLogger('SavedSearches')

export interface SavedSearch {
  id: string
  name: string
  description?: string
  query: string
  filters?: Record<string, any>
  tags?: string[]
  isTemplate: boolean
  createdAt: Date
  updatedAt: Date
  lastExecuted?: Date
  executeCount: number
  executionTimeMs?: number
  autoRefresh?: {
    enabled: boolean
    intervalSeconds: number
    lastRefreshed?: Date
  }
  starred: boolean
  category?: string
}

export interface SavedSearchStats {
  totalSaved: number
  totalTemplates: number
  mostUsed: SavedSearch[]
  recentlyUsed: SavedSearch[]
  averageExecutionTime: number
}

export class SavedSearchesManager {
  private searches: Map<string, SavedSearch> = new Map()
  private autoRefreshIntervals: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    logger.info('SavedSearchesManager initialized')
  }

  /**
   * Create a new saved search
   */
  createSearch(params: {
    name: string
    query: string
    description?: string
    filters?: Record<string, any>
    tags?: string[]
    isTemplate?: boolean
    category?: string
  }): SavedSearch {
    const id = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const search: SavedSearch = {
      id,
      name: params.name,
      description: params.description,
      query: params.query,
      filters: params.filters,
      tags: params.tags || [],
      isTemplate: params.isTemplate || false,
      createdAt: new Date(),
      updatedAt: new Date(),
      executeCount: 0,
      starred: false,
      category: params.category,
      autoRefresh: {
        enabled: false,
        intervalSeconds: 3600, // 1 hour default
      },
    }

    this.searches.set(id, search)
    logger.info(`Created saved search: ${id} (${params.name})`)

    return search
  }

  /**
   * Get a saved search by ID
   */
  getSearch(id: string): SavedSearch | undefined {
    const search = this.searches.get(id)
    if (!search) {
      logger.warn(`Search not found: ${id}`)
      return undefined
    }
    return { ...search } // Return copy to prevent mutations
  }

  /**
   * Update a saved search
   */
  updateSearch(id: string, updates: Partial<SavedSearch>): SavedSearch | null {
    const search = this.searches.get(id)
    if (!search) {
      logger.warn(`Cannot update: search not found (${id})`)
      return null
    }

    const updated: SavedSearch = {
      ...search,
      ...updates,
      id: search.id, // Prevent ID change
      createdAt: search.createdAt, // Prevent timestamp change
      updatedAt: new Date(),
    }

    this.searches.set(id, updated)
    logger.info(`Updated saved search: ${id}`)

    return { ...updated }
  }

  /**
   * Delete a saved search
   */
  deleteSearch(id: string): boolean {
    // Stop auto-refresh if enabled
    this.stopAutoRefresh(id)

    const deleted = this.searches.delete(id)
    if (deleted) {
      logger.info(`Deleted saved search: ${id}`)
    } else {
      logger.warn(`Cannot delete: search not found (${id})`)
    }

    return deleted
  }

  /**
   * Get all saved searches
   */
  getAllSearches(filter?: { isTemplate?: boolean; category?: string; tags?: string[] }): SavedSearch[] {
    let results = Array.from(this.searches.values())

    if (filter?.isTemplate !== undefined) {
      results = results.filter((s) => s.isTemplate === filter.isTemplate)
    }

    if (filter?.category) {
      results = results.filter((s) => s.category === filter.category)
    }

    if (filter?.tags?.length) {
      results = results.filter((s) => {
        const searchTags = s.tags || []
        return filter.tags!.some((t) => searchTags.includes(t))
      })
    }

    return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  /**
   * Search saved searches by name or query
   */
  searchSearches(query: string): SavedSearch[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.searches.values()).filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.query.toLowerCase().includes(lowerQuery) ||
        s.description?.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Record search execution
   */
  recordExecution(id: string, executionTimeMs: number): boolean {
    const search = this.searches.get(id)
    if (!search) return false

    search.executeCount++
    search.lastExecuted = new Date()
    search.executionTimeMs = executionTimeMs
    search.updatedAt = new Date()

    logger.info(`Recorded execution for search: ${id} (${executionTimeMs}ms)`)
    return true
  }

  /**
   * Execute a saved search
   */
  executeSearch(id: string): SavedSearch | null {
    const search = this.getSearch(id)
    if (!search) {
      logger.warn(`Cannot execute: search not found (${id})`)
      return null
    }

    // Record execution
    this.recordExecution(id, 0) // Duration will be tracked by caller

    return search
  }

  /**
   * Get statistics about saved searches
   */
  getStats(): SavedSearchStats {
    const searches = Array.from(this.searches.values())

    // Sort by execute count descending
    const mostUsed = [...searches].sort((a, b) => b.executeCount - a.executeCount).slice(0, 5)

    // Sort by lastExecuted descending
    const recently = [...searches]
      .filter((s) => s.lastExecuted)
      .sort((a, b) => (b.lastExecuted?.getTime() ?? 0) - (a.lastExecuted?.getTime() ?? 0))
      .slice(0, 5)

    const totalExecuted = searches.filter((s) => s.executeCount > 0)
    const avgTime =
      totalExecuted.length > 0
        ? totalExecuted.reduce((sum, s) => sum + (s.executionTimeMs ?? 0), 0) / totalExecuted.length
        : 0

    return {
      totalSaved: searches.length,
      totalTemplates: searches.filter((s) => s.isTemplate).length,
      mostUsed,
      recentlyUsed: recently,
      averageExecutionTime: avgTime,
    }
  }

  /**
   * Toggle star status
   */
  toggleStar(id: string): boolean {
    const search = this.searches.get(id)
    if (!search) return false

    search.starred = !search.starred
    search.updatedAt = new Date()

    logger.info(`Toggled star for search: ${id} (starred: ${search.starred})`)
    return search.starred
  }

  /**
   * Duplicate a search
   */
  duplicateSearch(id: string, newName?: string): SavedSearch | null {
    const original = this.searches.get(id)
    if (!original) {
      logger.warn(`Cannot duplicate: search not found (${id})`)
      return null
    }

    return this.createSearch({
      name: newName || `${original.name} (Copy)`,
      query: original.query,
      description: original.description,
      filters: original.filters ? { ...original.filters } : undefined,
      tags: original.tags ? [...original.tags] : undefined,
      isTemplate: original.isTemplate,
      category: original.category,
    })
  }

  /**
   * Enable auto-refresh for a search
   */
  enableAutoRefresh(
    id: string,
    intervalSeconds: number,
    onRefresh: (search: SavedSearch) => Promise<void>
  ): boolean {
    const search = this.searches.get(id)
    if (!search) return false

    // Stop existing interval if any
    this.stopAutoRefresh(id)

    // Update search config
    if (!search.autoRefresh) {
      search.autoRefresh = { enabled: false, intervalSeconds: 3600 }
    }

    search.autoRefresh.enabled = true
    search.autoRefresh.intervalSeconds = intervalSeconds

    // Set up interval
    const interval = setInterval(async () => {
      try {
        search.autoRefresh!.lastRefreshed = new Date()
        await onRefresh(search)
        logger.info(`Auto-refreshed search: ${id}`)
      } catch (error) {
        logger.error(`Error auto-refreshing search ${id}:`, error)
      }
    }, intervalSeconds * 1000)

    this.autoRefreshIntervals.set(id, interval)
    logger.info(`Enabled auto-refresh for search: ${id} (interval: ${intervalSeconds}s)`)

    return true
  }

  /**
   * Disable auto-refresh for a search
   */
  stopAutoRefresh(id: string): boolean {
    const interval = this.autoRefreshIntervals.get(id)
    if (!interval) return false

    clearInterval(interval)
    this.autoRefreshIntervals.delete(id)

    const search = this.searches.get(id)
    if (search && search.autoRefresh) {
      search.autoRefresh.enabled = false
    }

    logger.info(`Stopped auto-refresh for search: ${id}`)
    return true
  }

  /**
   * Export saves searches to JSON
   */
  exportSearches(filter?: { isTemplate?: boolean }): string {
    const searches = this.getAllSearches(filter)
    return JSON.stringify(
      searches.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        lastExecuted: s.lastExecuted?.toISOString(),
        autoRefresh: s.autoRefresh
          ? {
              ...s.autoRefresh,
              lastRefreshed: s.autoRefresh.lastRefreshed?.toISOString(),
            }
          : undefined,
      })),
      null,
      2
    )
  }

  /**
   * Import saved searches from JSON
   */
  importSearches(jsonData: string): { imported: number; failed: number; errors: string[] } {
    const errors: string[] = []
    let imported = 0
    let failed = 0

    try {
      const data = JSON.parse(jsonData)
      if (!Array.isArray(data)) {
        throw new Error('Expected array of searches')
      }

      data.forEach((item, index) => {
        try {
          this.createSearch({
            name: item.name,
            query: item.query,
            description: item.description,
            filters: item.filters,
            tags: item.tags,
            isTemplate: item.isTemplate,
            category: item.category,
          })
          imported++
        } catch (error) {
          failed++
          errors.push(`Item ${index}: ${error instanceof Error ? error.message : String(error)}`)
        }
      })
    } catch (error) {
      failed = 1
      errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`)
    }

    logger.info(`Imported ${imported} searches, ${failed} failed`)
    return { imported, failed, errors }
  }

  /**
   * Clear all auto-refresh intervals (cleanup)
   */
  cleanup(): void {
    this.autoRefreshIntervals.forEach((interval) => clearInterval(interval))
    this.autoRefreshIntervals.clear()
    logger.info('SavedSearchesManager cleanup completed')
  }

  /**
   * Get popular search terms across all saved searches
   */
  getPopularTerms(limit: number = 10): Array<{ term: string; frequency: number }> {
    const termFreq: Record<string, number> = {}

    this.searches.forEach((search) => {
      // Split query into words
      const words = search.query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)

      words.forEach((word) => {
        // Remove special chars
        const clean = word.replace(/[^\w]/g, '')
        if (clean) {
          termFreq[clean] = (termFreq[clean] || 0) + 1
        }
      })
    })

    return Object.entries(termFreq)
      .map(([term, frequency]) => ({ term, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit)
  }
}

// Singleton instance
let instance: SavedSearchesManager | null = null

export function getSavedSearchesManager(): SavedSearchesManager {
  if (!instance) {
    instance = new SavedSearchesManager()
  }
  return instance
}

export function resetSavedSearchesManager(): void {
  instance?.cleanup()
  instance = null
}
