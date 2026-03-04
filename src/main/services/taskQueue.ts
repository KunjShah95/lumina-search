/**
 * Task Queue Service
 * 
 * Bounded queue for CPU-intensive tasks (PDF ingestion, embedding generation).
 * Prevents main-thread starvation through concurrency limiting.
 * 
 * Features:
 * - Configurable max concurrency (default: 3)
 * - Priority-based execution (CRITICAL > HIGH > NORMAL > LOW)
 * - Automatic retry on transient failures
 * - Metrics tracking (pending, active, completed, failed)
 */

import { createLogger } from './logger'

const logger = createLogger('task-queue')

export enum TaskPriority {
    CRITICAL = 0,
    HIGH = 1,
    NORMAL = 2,
    LOW = 3,
}

export interface Task<TResult> {
    id: string
    name: string
    priority: TaskPriority
    execute: () => Promise<TResult>
    retries?: number
    maxRetries?: number
    onProgress?: (progress: number) => void
}

export interface QueueMetrics {
    pending: number
    active: number
    completed: number
    failed: number
    totalProcessingTimeMs: number
    averageTaskDurationMs: number
}

interface InternalTask<TResult> extends Task<TResult> {
    attempt: number
    startTime?: number
    endTime?: number
    error?: Error
    result?: TResult
}

/**
 * TaskQueue implementation with bounded concurrency
 */
export class TaskQueue {
    private queue: InternalTask<unknown>[] = []
    private active: Map<string, InternalTask<unknown>> = new Map()
    private completed: Map<string, InternalTask<unknown>> = new Map()
    private failed: Map<string, InternalTask<unknown>> = new Map()
    
    private maxConcurrency: number
    private totalProcessingTimeMs = 0
    private taskDurations: number[] = []
    private processingScheduled = false
    
    private resolvers: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map()

    constructor(maxConcurrency: number = 3) {
        this.maxConcurrency = maxConcurrency
        logger.info(`TaskQueue initialized with max concurrency: ${maxConcurrency}`)
    }

    /**
     * Enqueue a new task
     */
    async enqueue<TResult>(task: Task<TResult>): Promise<TResult> {
        const internalTask: InternalTask<TResult> = {
            ...task,
            attempt: 0,
            maxRetries: task.maxRetries ?? 2,
        }

        return new Promise((resolve, reject) => {
            this.queue.push(internalTask)
            this.resolvers.set(task.id, { resolve, reject })

            // Sort by priority
            this.queue.sort((a, b) => a.priority - b.priority)

            logger.info(`Task enqueued: ${task.name}`, {
                taskId: task.id,
                priority: TaskPriority[task.priority],
                queueLength: this.queue.length,
            })

            this.scheduleProcessQueue()
        })
    }

    private scheduleProcessQueue(): void {
        if (this.processingScheduled) return
        this.processingScheduled = true

        queueMicrotask(() => {
            this.processingScheduled = false
            void this.processQueue()
        })
    }

    /**
     * Process tasks from queue respecting concurrency limit
     */
    private async processQueue(): Promise<void> {
        while (this.queue.length > 0 && this.active.size < this.maxConcurrency) {
            const task = this.queue.shift()
            if (!task) break

            this.active.set(task.id, task)
            task.startTime = Date.now()

            logger.info(`Task started: ${task.name}`, {
                taskId: task.id,
                attempt: task.attempt + 1,
                maxRetries: task.maxRetries,
                activeCount: this.active.size,
            })

            this.executeTask(task).then(() => {
                this.scheduleProcessQueue()
            })
        }
    }

    /**
     * Execute a single task with retry logic
     */
    private async executeTask<TResult>(task: InternalTask<TResult>): Promise<void> {
        try {
            task.attempt++
            const result = await task.execute()

            task.result = result
            task.endTime = Date.now()

            const duration = task.endTime - (task.startTime ?? Date.now())
            this.taskDurations.push(duration)
            this.totalProcessingTimeMs += duration

            this.active.delete(task.id)
            this.completed.set(task.id, task)

            const resolver = this.resolvers.get(task.id)
            resolver?.resolve(result)
            this.resolvers.delete(task.id)

            logger.info(`Task completed: ${task.name}`, {
                taskId: task.id,
                durationMs: duration,
                attempt: task.attempt,
            })
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            task.error = error

            if (task.attempt < (task.maxRetries ?? 0) + 1) {
                // Retry
                logger.warn(`Task failed, retrying: ${task.name}`, {
                    taskId: task.id,
                    attempt: task.attempt,
                    maxRetries: task.maxRetries,
                    error: error.message,
                })

                // Re-enqueue with exponential backoff
                const backoffMs = Math.min(1000 * Math.pow(2, task.attempt - 1), 10000)
                await new Promise((resolve) => setTimeout(resolve, backoffMs))

                this.active.delete(task.id)
                this.queue.unshift(task) // Re-prioritize
                this.queue.sort((a, b) => a.priority - b.priority)
            } else {
                // Final failure
                task.endTime = Date.now()
                const duration = task.endTime - (task.startTime ?? Date.now())
                this.taskDurations.push(duration)
                this.totalProcessingTimeMs += duration

                this.active.delete(task.id)
                this.failed.set(task.id, task)

                const resolver = this.resolvers.get(task.id)
                resolver?.reject(error)
                this.resolvers.delete(task.id)

                logger.error(`Task failed permanently: ${task.name}`, error, {
                    taskId: task.id,
                    attempt: task.attempt,
                    maxRetries: task.maxRetries,
                })
            }
        }
    }

    /**
     * Get queue metrics
     */
    getMetrics(): QueueMetrics {
        return {
            pending: this.queue.length,
            active: this.active.size,
            completed: this.completed.size,
            failed: this.failed.size,
            totalProcessingTimeMs: this.totalProcessingTimeMs,
            averageTaskDurationMs:
                this.taskDurations.length > 0
                    ? Math.round(
                          this.taskDurations.reduce((a, b) => a + b, 0) / this.taskDurations.length,
                      )
                    : 0,
        }
    }

    /**
     * Get detailed metrics including task history
     */
    getDetailedMetrics(): QueueMetrics & {
        recentCompletedTasks: Array<{ id: string; name: string; durationMs: number }>
        recentFailedTasks: Array<{ id: string; name: string; error: string }>
    } {
        const metrics = this.getMetrics()

        const recentCompletedTasks = Array.from(this.completed.values())
            .slice(-10)
            .map((t) => ({
                id: t.id,
                name: t.name,
                durationMs: (t.endTime ?? 0) - (t.startTime ?? 0),
            }))

        const recentFailedTasks = Array.from(this.failed.values())
            .slice(-10)
            .map((t) => ({
                id: t.id,
                name: t.name,
                error: t.error?.message ?? 'Unknown error',
            }))

        return {
            ...metrics,
            recentCompletedTasks,
            recentFailedTasks,
        }
    }

    /**
     * Clear completed and failed task history
     */
    clearHistory(): void {
        this.completed.clear()
        this.failed.clear()
        this.taskDurations = []
        this.totalProcessingTimeMs = 0
        logger.info('Task queue history cleared')
    }

    /**
     * Get current status summary
     */
    getStatus(): {
        status: 'idle' | 'processing'
        queueLength: number
        activeCount: number
    } {
        return {
            status: this.active.size > 0 ? 'processing' : 'idle',
            queueLength: this.queue.length,
            activeCount: this.active.size,
        }
    }
}

// Singleton instance
let globalQueue: TaskQueue | null = null

/**
 * Get or create global task queue instance
 */
export function getTaskQueue(maxConcurrency: number = 3): TaskQueue {
    if (!globalQueue) {
        globalQueue = new TaskQueue(maxConcurrency)
    }
    return globalQueue
}

/**
 * Reset global queue (mainly for testing)
 */
export function resetTaskQueue(): void {
    globalQueue = null
}
