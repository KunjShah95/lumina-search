/**
 * Search Analytics Service
 * Tracks search history, analyzes patterns, and provides insights
 */

import * as crypto from 'crypto'
import { createLogger } from './logger'

const logger = createLogger('SearchAnalytics')

export interface SearchRecord {
  id: string
  queryHash: string
  originalQuery: string
  executedAt: Date
  resultCount: number
  executionTimeMs: number
  sourcesUsed: string[]
  llmModel?: string
  userRating?: number // 1-5 star rating
  success: boolean // Did the user find what they needed
  notes?: string
}

export interface SearchAnalytics {
  totalSearches: number
  uniqueQueries: number
  averageExecutionTime: number
  successRate: number
  topQueries: Array<{ query: string; count: number; avgTime: number }>
  topSources: Array<{ source: string; count: number }>
  searchTrend: Array<{ date: string; count: number }>
  timeOfDayAnalysis: Record<string, number>
  dayOfWeekAnalysis: Record<string, number>
  averageRating: number
  totalResultsRetrieved: number
}

export class SearchAnalyticsManager {
  private records: Map<string, SearchRecord> = new Map()
  private queryHashMap: Map<string, Set<string>> = new Map() // Maps query to record IDs

  constructor() {
    logger.info('SearchAnalyticsManager initialized')
  }

  /**
   * Record a new search
   */
  recordSearch(params: {
    originalQuery: string
    resultCount: number
    executionTimeMs: number
    sourcesUsed: string[]
    llmModel?: string
    success?: boolean
  }): SearchRecord {
    const id = `search_record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const queryHash = this.hashQuery(params.originalQuery)

    const record: SearchRecord = {
      id,
      queryHash,
      originalQuery: params.originalQuery,
      executedAt: new Date(),
      resultCount: params.resultCount,
      executionTimeMs: params.executionTimeMs,
      sourcesUsed: params.sourcesUsed,
      llmModel: params.llmModel,
      success: params.success !== false,
    }

    this.records.set(id, record)

    // Update query hash map
    if (!this.queryHashMap.has(queryHash)) {
      this.queryHashMap.set(queryHash, new Set())
    }
    this.queryHashMap.get(queryHash)!.add(id)

    logger.info(`Recorded search: ${id} (${params.originalQuery.substring(0, 50)}...)`)
    return { ...record }
  }

  /**
   * Rate a search result
   */
  rateSearch(id: string, rating: number, notes?: string): boolean {
    const record = this.records.get(id)
    if (!record) {
      logger.warn(`Cannot rate: record not found (${id})`)
      return false
    }

    if (rating < 1 || rating > 5) {
      logger.warn(`Invalid rating: ${rating}`)
      return false
    }

    record.userRating = rating
    record.notes = notes
    logger.info(`Rated search ${id}: ${rating} stars`)

    return true
  }

  /**
   * Mark search as successful/unsuccessful
   */
  markSearchSuccess(id: string, success: boolean): boolean {
    const record = this.records.get(id)
    if (!record) return false

    record.success = success
    return true
  }

  /**
   * Get analytics for a date range
   */
  getAnalytics(startDate?: Date, endDate?: Date): SearchAnalytics {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    const end = endDate || new Date()

    // Filter records by date
    const records = Array.from(this.records.values()).filter((r) => r.executedAt >= start && r.executedAt <= end)

    if (records.length === 0) {
      return {
        totalSearches: 0,
        uniqueQueries: 0,
        averageExecutionTime: 0,
        successRate: 0,
        topQueries: [],
        topSources: [],
        searchTrend: [],
        timeOfDayAnalysis: {},
        dayOfWeekAnalysis: {},
        averageRating: 0,
        totalResultsRetrieved: 0,
      }
    }

    // Calculate metrics
    const totalSearches = records.length
    const uniqueQueries = new Set(records.map((r) => r.originalQuery)).size

    const totalTime = records.reduce((sum, r) => sum + r.executionTimeMs, 0)
    const averageExecutionTime = totalTime / totalSearches

    const successCount = records.filter((r) => r.success).length
    const successRate = successCount / totalSearches

    const totalResultsRetrieved = records.reduce((sum, r) => sum + r.resultCount, 0)

    // Top queries
    const queryStats: Record<string, { count: number; times: number[] }> = {}
    records.forEach((r) => {
      if (!queryStats[r.originalQuery]) {
        queryStats[r.originalQuery] = { count: 0, times: [] }
      }
      queryStats[r.originalQuery].count++
      queryStats[r.originalQuery].times.push(r.executionTimeMs)
    })

    const topQueries = Object.entries(queryStats)
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgTime: stats.times.reduce((a, b) => a + b, 0) / stats.times.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Top sources
    const sourceStats: Record<string, number> = {}
    records.forEach((r) => {
      r.sourcesUsed.forEach((source) => {
        sourceStats[source] = (sourceStats[source] || 0) + 1
      })
    })

    const topSources = Object.entries(sourceStats)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    // Search trend (by day)
    const trendMap: Record<string, number> = {}
    records.forEach((r) => {
      const dateKey = r.executedAt.toISOString().split('T')[0]
      trendMap[dateKey] = (trendMap[dateKey] || 0) + 1
    })

    const searchTrend = Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Time of day analysis
    const timeOfDayMap: Record<string, number> = {}
    records.forEach((r) => {
      const hour = r.executedAt.getHours()
      const period =
        hour < 6
          ? 'night'
          : hour < 12
            ? 'morning'
            : hour < 18
              ? 'afternoon'
              : 'evening'
      timeOfDayMap[period] = (timeOfDayMap[period] || 0) + 1
    })

    // Day of week analysis
    const dayOfWeekMap: Record<string, number> = {}
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    records.forEach((r) => {
      const dayName = days[r.executedAt.getDay()]
      dayOfWeekMap[dayName] = (dayOfWeekMap[dayName] || 0) + 1
    })

    // Average rating
    const ratedSearches = records.filter((r) => r.userRating !== undefined)
    const averageRating =
      ratedSearches.length > 0 ? ratedSearches.reduce((sum, r) => sum + (r.userRating ?? 0), 0) / ratedSearches.length : 0

    return {
      totalSearches,
      uniqueQueries,
      averageExecutionTime,
      successRate,
      topQueries,
      topSources,
      searchTrend,
      timeOfDayAnalysis: timeOfDayMap,
      dayOfWeekAnalysis: dayOfWeekMap,
      averageRating,
      totalResultsRetrieved,
    }
  }

  /**
   * Get search history with optional filtering
   */
  getHistory(filter?: {
    limit?: number
    offset?: number
    query?: string
    startDate?: Date
    endDate?: Date
    source?: string
    minRating?: number
  }): SearchRecord[] {
    let results = Array.from(this.records.values())

    // Apply filters
    if (filter?.startDate) {
      results = results.filter((r) => r.executedAt >= filter.startDate!)
    }

    if (filter?.endDate) {
      results = results.filter((r) => r.executedAt <= filter.endDate!)
    }

    if (filter?.query) {
      const lowerQuery = filter.query.toLowerCase()
      results = results.filter((r) => r.originalQuery.toLowerCase().includes(lowerQuery))
    }

    if (filter?.source) {
      results = results.filter((r) => r.sourcesUsed.includes(filter.source!))
    }

    if (filter?.minRating !== undefined) {
      results = results.filter((r) => (r.userRating ?? 0) >= filter.minRating!)
    }

    // Sort by date descending
    results.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())

    // Apply pagination
    const offset = filter?.offset || 0
    const limit = filter?.limit || 100

    return results.slice(offset, offset + limit)
  }

  /**
   * Get duplicate/similar searches
   */
  getSearchDuplicates(): Array<{ hash: string; query: string; count: number; records: SearchRecord[] }> {
    const duplicates: Array<{ hash: string; query: string; count: number; records: SearchRecord[] }> = []

    this.queryHashMap.forEach((recordIds, hash) => {
      if (recordIds.size > 1) {
        const records = Array.from(recordIds)
          .map((id) => this.records.get(id)!)
          .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())

        duplicates.push({
          hash,
          query: records[0].originalQuery,
          count: records.length,
          records,
        })
      }
    })

    return duplicates.sort((a, b) => b.count - a.count)
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(): {
    slowestQueries: SearchRecord[]
    fastestQueries: SearchRecord[]
    lowSuccessQueries: SearchRecord[]
  } {
    const records = Array.from(this.records.values())

    const slowestQueries = [...records]
      .sort((a, b) => b.executionTimeMs - a.executionTimeMs)
      .slice(0, 5)

    const fastestQueries = [...records]
      .sort((a, b) => a.executionTimeMs - b.executionTimeMs)
      .slice(0, 5)

    const lowSuccessQueries = [...records].filter((r) => !r.success).slice(0, 5)

    return { slowestQueries, fastestQueries, lowSuccessQueries }
  }

  /**
   * Clear old records
   */
  clearOlderThan(days: number): number {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    let count = 0

    this.records.forEach((record, id) => {
      if (record.executedAt < cutoffDate) {
        // Remove from query hash map
        const hashes = Array.from(this.queryHashMap.entries()).filter(([_, ids]) => ids.has(id))
        hashes.forEach(([hash, ids]) => {
          ids.delete(id)
          if (ids.size === 0) {
            this.queryHashMap.delete(hash)
          }
        })

        // Remove record
        this.records.delete(id)
        count++
      }
    })

    logger.info(`Cleared ${count} old search records`)
    return count
  }

  /**
   * Export analytics to JSON
   */
  exportAnalytics(startDate?: Date, endDate?: Date): string {
    const analytics = this.getAnalytics(startDate, endDate)
    const history = this.getHistory({ limit: 10000 })

    return JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        analytics,
        recentSearches: history.map((r) => ({
          ...r,
          executedAt: r.executedAt.toISOString(),
        })),
      },
      null,
      2
    )
  }

  /**
   * Import analytics data
   */
  importAnalytics(jsonData: string): { imported: number; errors: string[] } {
    const errors: string[] = []
    let imported = 0

    try {
      const data = JSON.parse(jsonData)
      if (!data.recentSearches || !Array.isArray(data.recentSearches)) {
        throw new Error('Invalid format: missing recentSearches array')
      }

      data.recentSearches.forEach((item: any, index: number) => {
        try {
          this.recordSearch({
            originalQuery: item.originalQuery,
            resultCount: item.resultCount,
            executionTimeMs: item.executionTimeMs,
            sourcesUsed: item.sourcesUsed,
            llmModel: item.llmModel,
            success: item.success,
          })

          if (item.userRating) {
            const lastId = Array.from(this.records.keys()).pop()
            if (lastId) {
              this.rateSearch(lastId, item.userRating, item.notes)
            }
          }

          imported++
        } catch (error) {
          errors.push(`Item ${index}: ${error instanceof Error ? error.message : String(error)}`)
        }
      })
    } catch (error) {
      errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`)
    }

    logger.info(`Imported ${imported} analytics records`)
    return { imported, errors }
  }

  /**
   * Get statistics summary
   */
  getStatsSummary(): {
    todaySearches: number
    thisWeekSearches: number
    thisMonthSearches: number
    allTimeSearches: number
  } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const allRecords = Array.from(this.records.values())

    return {
      todaySearches: allRecords.filter((r) => r.executedAt >= today).length,
      thisWeekSearches: allRecords.filter((r) => r.executedAt >= thisWeek).length,
      thisMonthSearches: allRecords.filter((r) => r.executedAt >= thisMonth).length,
      allTimeSearches: allRecords.length,
    }
  }

  /**
   * Hash query for grouping similar searches
   */
  private hashQuery(query: string): string {
    // Normalize query: lowercase, trim, remove extra spaces
    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ')
    return crypto.createHash('sha256').update(normalized).digest('hex')
  }

  /**
   * Generate AI insights from analytics
   */
  generateInsights(timeRangeMs?: number): {
    summary: string
    insights: string[]
    recommendations: string[]
  } {
    const startDate = timeRangeMs ? new Date(Date.now() - timeRangeMs) : undefined
    const analytics = this.getAnalytics(startDate)

    const insights: string[] = []
    const recommendations: string[] = []

    if (analytics.totalSearches === 0) {
      return {
        summary: 'No search data available',
        insights: [],
        recommendations: [],
      }
    }

    // Generate insights
    if (analytics.successRate < 0.5) {
      insights.push(`Low success rate: ${Math.round(analytics.successRate * 100)}% - consider refining search queries`)
    }

    if (analytics.averageExecutionTime > 5000) {
      insights.push(`Slow average response time: ${analytics.averageExecutionTime.toFixed(0)}ms`)
      recommendations.push('Try more specific search queries to reduce response time')
    }

    if (analytics.topQueries.length > 0) {
      const topQuery = analytics.topQueries[0]
      insights.push(`Most popular search: "${topQuery.query}" (${topQuery.count} times)`)
    }

    if (analytics.topSources.length > 0) {
      const topSource = analytics.topSources[0]
      insights.push(`Primary source: ${topSource.source} (${Math.round((topSource.count / analytics.totalSearches) * 100)}% of searches)`)
    }

    const summary = `${analytics.totalSearches} searches, ${analytics.uniqueQueries} unique queries, ${Math.round(analytics.successRate * 100)}% success rate`

    return { summary, insights, recommendations }
  }

  /**
   * Clear all analytics data
   */
  clearData(): void {
    this.records.clear()
    this.queryHashMap.clear()
    logger.info('All analytics data cleared')
  }
}

// Singleton instance
let instance: SearchAnalyticsManager | null = null

export function getSearchAnalyticsManager(): SearchAnalyticsManager {
  if (!instance) {
    instance = new SearchAnalyticsManager()
  }
  return instance
}

export function resetSearchAnalyticsManager(): void {
  instance = null
}
