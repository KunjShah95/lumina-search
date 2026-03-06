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
      await this.executeSingleSearch(item, options)
    }
  }

  private async executeParallel(
    result: BatchSearchResult,
    options: BatchSearchOptions,
    concurrency: number
  ): Promise<void> {
    const queue = [...result.items]
    const running: Promise<void>[] = []

    const runItem = async (item: BatchSearchItem): Promise<void> => {
      await this.executeSingleSearch(item, options)
    }

    while (queue.length > 0 || running.length > 0) {
      while (running.length < concurrency && queue.length > 0) {
        const item = queue.shift()!
        running.push(runItem(item))
      }

      if (running.length > 0) {
        await Promise.race(running)
        const completed = running.filter((p) => (p as any).status === 'completed')
        for (const p of completed) {
          running.splice(running.indexOf(p), 1)
        }
      }
    }

    await Promise.all(running)
  }

  private async executeSingleSearch(
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

    options.onProgress?.(item)
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
