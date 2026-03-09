/**
 * Batch Search Service
 * Handles executing multiple search queries in parallel or sequential order
 */

import { createLogger } from './logger'
import { SearchOrchestrator } from '../agents/Orchestrator'
import { SearchOpts, FocusMode, SearchProvider } from '../agents/types'

const logger = createLogger('BatchSearch')

export interface BatchSearchItem {
  id: string
  query: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  executionTimeMs?: number
}

export interface BatchSearchOptions {
  queries: string[]
  concurrency?: number
  sequential?: boolean
  searchOptions?: Partial<SearchOpts>
  onProgress?: (item: BatchSearchItem) => void
}

export interface BatchSearchResult {
  id: string
  items: BatchSearchItem[]
  totalQueries: number
  completedCount: number
  failedCount: number
  totalExecutionTimeMs: number
}

export class BatchSearchManager {
  private readonly MAX_BATCH_HISTORY = 20
  private activeBatches: Map<string, BatchSearchResult> = new Map()
  private orchestrator: SearchOrchestrator | null = null

  constructor() {
    logger.info('BatchSearchManager initialized')
  }

  setOrchestrator(orchestrator: SearchOrchestrator): void {
    this.orchestrator = orchestrator
  }

  async executeBatch(options: BatchSearchOptions): Promise<BatchSearchResult> {
    const batchId = `batch_${Date.now()}`
    const concurrency = options.concurrency || 3
    const sequential = options.sequential || false

    const items: BatchSearchItem[] = options.queries.map((query, index) => ({
      id: `batch_${batchId}_item_${index}`,
      query,
      status: 'pending',
    }))

    const result: BatchSearchResult = {
      id: batchId,
      items,
      totalQueries: items.length,
      completedCount: 0,
      failedCount: 0,
      totalExecutionTimeMs: 0,
    }

    this.activeBatches.set(batchId, result)
    this.pruneBatchHistory()
    logger.info(`Starting batch search: ${batchId} with ${items.length} queries`)

    const startTime = Date.now()

    if (sequential) {
      await this.executeSequential(result, options)
    } else {
      await this.executeParallel(result, options, concurrency)
    }

    result.totalExecutionTimeMs = Date.now() - startTime
    logger.info(`Batch search completed: ${batchId} in ${result.totalExecutionTimeMs}ms`)

    return result
  }

  private async executeSequential(
    result: BatchSearchResult,
    options: BatchSearchOptions
  ): Promise<void> {
    for (const item of result.items) {
      await this.executeSingleSearch(result, item, options)
    }
  }

  private async executeParallel(
    result: BatchSearchResult,
    options: BatchSearchOptions,
    concurrency: number
  ): Promise<void> {
    const queue = [...result.items]
    const workerCount = Math.max(1, Math.min(concurrency, queue.length))

    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item) {
          break
        }

        await this.executeSingleSearch(result, item, options)
      }
    })

    await Promise.all(workers)
  }

  private async executeSingleSearch(
    result: BatchSearchResult,
    item: BatchSearchItem,
    options: BatchSearchOptions
  ): Promise<void> {
    item.status = 'running'
    options.onProgress?.(item)

    const startTime = Date.now()

    try {
      if (!this.orchestrator) {
        throw new Error('Search orchestrator not configured')
      }

      const searchOpts: SearchOpts = {
        providers: options.searchOptions?.providers || ['duckduckgo'],
        model: options.searchOptions?.model || 'ollama:llama3.2',
        maxSources: options.searchOptions?.maxSources || 8,
        scrapePages: options.searchOptions?.scrapePages ?? true,
        focusMode: options.searchOptions?.focusMode || 'general' as FocusMode,
        ...options.searchOptions,
      }

      const events: any[] = []
      for await (const event of this.orchestrator.run(item.query, searchOpts)) {
        events.push(event)
        if (event.type === 'done') break
      }

      const response = events

      item.result = response
      item.status = 'completed'
      item.executionTimeMs = Date.now() - startTime

      logger.info(`Batch item completed: ${item.id} in ${item.executionTimeMs}ms`)
    } catch (error) {
      item.status = 'failed'
      item.error = error instanceof Error ? error.message : String(error)
      item.executionTimeMs = Date.now() - startTime

      logger.error(`Batch item failed: ${item.id}`, error)
    }

    if (item.status === 'completed') {
      result.completedCount += 1
    } else if (item.status === 'failed') {
      result.failedCount += 1
    }

    options.onProgress?.(item)
  }

  private pruneBatchHistory(): void {
    if (this.activeBatches.size <= this.MAX_BATCH_HISTORY) {
      return
    }

    const removableCount = this.activeBatches.size - this.MAX_BATCH_HISTORY
    const keysToRemove = Array.from(this.activeBatches.keys()).slice(0, removableCount)
    for (const key of keysToRemove) {
      this.activeBatches.delete(key)
    }
  }

  getBatchResult(batchId: string): BatchSearchResult | undefined {
    return this.activeBatches.get(batchId)
  }

  cancelBatch(batchId: string): boolean {
    const batch = this.activeBatches.get(batchId)
    if (!batch) return false

    batch.items.forEach((item) => {
      if (item.status === 'pending' || item.status === 'running') {
        item.status = 'failed'
        item.error = 'Batch cancelled'
      }
    })

    logger.info(`Batch cancelled: ${batchId}`)
    return true
  }

  clearCompletedBatch(batchId: string): boolean {
    const deleted = this.activeBatches.delete(batchId)
    if (deleted) {
      logger.info(`Batch cleared from memory: ${batchId}`)
    }
    return deleted
  }

  getActiveBatches(): BatchSearchResult[] {
    return Array.from(this.activeBatches.values())
  }
}

let instance: BatchSearchManager | null = null

export function getBatchSearchManager(): BatchSearchManager {
  if (!instance) {
    instance = new BatchSearchManager()
  }
  return instance
}

export function resetBatchSearchManager(): void {
  instance = null
}
