/**
 * Timeout Manager Service
 * 
 * Configurable timeouts for long-running operations with graceful degradation.
 * Prevents queries from hanging indefinitely and enables fallback strategies.
 */

import { createLogger } from './logger'

const logger = createLogger('timeout-manager')

export class TimeoutError extends Error {
    constructor(
        public operation: string,
        public timeoutMs: number,
        message?: string,
    ) {
        super(message || `Operation '${operation}' exceeded ${timeoutMs}ms timeout`)
        this.name = 'TimeoutError'
    }
}

export interface TimeoutConfig {
    ragQuery: number
    embeddingBatch: number
    pluginOperation: number
    fileIngestion: number
    knowledgeBaseSearch: number
    modelInference: number
}

export interface TimeoutStats {
    totalTimeouts: number
    operationTimeouts: Record<string, number>
    averageTimeoutMs: Record<string, number>
    lastTimeoutAt?: Date
}

/**
 * Timeout Manager - Singleton class
 */
export class TimeoutManager {
    private config: TimeoutConfig
    private stats: TimeoutStats = {
        totalTimeouts: 0,
        operationTimeouts: {},
        averageTimeoutMs: {},
    }

    constructor(config?: Partial<TimeoutConfig>) {
        // Default timeout configuration
        this.config = {
            ragQuery: 30000, // 30 seconds
            embeddingBatch: 60000, // 60 seconds
            pluginOperation: 15000, // 15 seconds
            fileIngestion: 120000, // 2 minutes
            knowledgeBaseSearch: 10000, // 10 seconds
            modelInference: 45000, // 45 seconds
            ...config,
        }

        logger.info('TimeoutManager initialized', { timeouts: this.config })
    }

    /**
     * Execute function with timeout
     * Returns partial result if timeout occurs
     */
    async executeWithTimeout<T>(
        operation: string,
        fn: () => Promise<T>,
        timeoutMs?: number,
        onTimeout?: (elapsed: number) => Promise<T | undefined>,
    ): Promise<{ result: T | undefined; timedOut: boolean; elapsedMs: number }> {
        const timeout = timeoutMs || this.getTimeoutFor(operation)
        const startTime = Date.now()

        try {
            const result = await Promise.race([
                fn(),
                new Promise<never>((_resolve, reject) =>
                    setTimeout(
                        () => reject(new TimeoutError(operation, timeout)),
                        timeout,
                    ),
                ),
            ])

            const elapsedMs = Date.now() - startTime
            return { result, timedOut: false, elapsedMs }
        } catch (err) {
            const elapsedMs = Date.now() - startTime

            // Check if it's our timeout error
            if (err instanceof TimeoutError) {
                logger.warn('Operation timed out', {
                    operation,
                    timeoutMs: timeout,
                    elapsedMs,
                })

                this.recordTimeout(operation, elapsedMs)

                // Try fallback if provided
                if (onTimeout) {
                    try {
                        const fallbackResult = await onTimeout(elapsedMs)
                        return { result: fallbackResult, timedOut: true, elapsedMs }
                    } catch (fallbackErr) {
                        logger.error('Fallback handler failed', fallbackErr, {
                            operation,
                        })
                        return { result: undefined, timedOut: true, elapsedMs }
                    }
                }

                return { result: undefined, timedOut: true, elapsedMs }
            }

            // Other errors are re-thrown
            throw err
        }
    }

    /**
     * Abort a running operation after timeout
     */
    async executeWithAbort<T>(
        operation: string,
        fn: (signal: AbortSignal) => Promise<T>,
        timeoutMs?: number,
    ): Promise<{ result: T | undefined; timedOut: boolean; elapsedMs: number }> {
        const timeout = timeoutMs || this.getTimeoutFor(operation)
        const startTime = Date.now()
        const controller = new AbortController()

        const timeoutHandle = setTimeout(() => {
            controller.abort()
        }, timeout)

        try {
            const result = await fn(controller.signal)
            clearTimeout(timeoutHandle)
            const elapsedMs = Date.now() - startTime
            return { result, timedOut: false, elapsedMs }
        } catch (err) {
            clearTimeout(timeoutHandle)
            const elapsedMs = Date.now() - startTime

            if (controller.signal.aborted) {
                logger.warn('Operation aborted due to timeout', {
                    operation,
                    timeoutMs: timeout,
                    elapsedMs,
                })
                this.recordTimeout(operation, elapsedMs)
                return { result: undefined, timedOut: true, elapsedMs }
            }

            throw err
        }
    }

    /**
     * Get timeout for operation type
     */
    getTimeoutFor(operation: string): number {
        const timeoutMs = (this.config as any)[operation]
        if (!timeoutMs) {
            logger.warn('Unknown operation for timeout', { operation })
            return 30000 // Default 30s
        }
        return timeoutMs
    }

    /**
     * Update timeout configuration
     */
    updateTimeout(operation: keyof TimeoutConfig, timeoutMs: number): void {
        this.config[operation] = timeoutMs
        logger.info('Timeout updated', { operation, timeoutMs })
    }

    /**
     * Update multiple timeouts at once
     */
    updateTimeouts(updates: Partial<TimeoutConfig>): void {
        Object.assign(this.config, updates)
        logger.info('Multiple timeouts updated', { updates })
    }

    /**
     * Get current configuration
     */
    getConfig(): TimeoutConfig {
        return { ...this.config }
    }

    /**
     * Record timeout event
     */
    private recordTimeout(operation: string, elapsedMs: number): void {
        this.stats.totalTimeouts++
        this.stats.operationTimeouts[operation] = (this.stats.operationTimeouts[operation] || 0) + 1
        this.stats.lastTimeoutAt = new Date()

        // Update average
        const count = this.stats.operationTimeouts[operation]
        const prevAvg = this.stats.averageTimeoutMs[operation] || 0
        this.stats.averageTimeoutMs[operation] = (prevAvg * (count - 1) + elapsedMs) / count
    }

    /**
     * Get timeout statistics
     */
    getStats(): TimeoutStats {
        return {
            ...this.stats,
            operationTimeouts: { ...this.stats.operationTimeouts },
            averageTimeoutMs: { ...this.stats.averageTimeoutMs },
        }
    }

    /**
     * Clear statistics
     */
    clearStats(): void {
        this.stats = {
            totalTimeouts: 0,
            operationTimeouts: {},
            averageTimeoutMs: {},
        }
        logger.info('Timeout statistics cleared')
    }

    /**
     * Suggest timeout adjustment based on stats
     */
    suggestAdjustments(): Record<string, { current: number; suggested: number; reason: string }> {
        const suggestions: Record<string, { current: number; suggested: number; reason: string }> = {}

        for (const [operation, avgElapsed] of Object.entries(this.stats.averageTimeoutMs)) {
            const current = this.getTimeoutFor(operation)
            const timeoutCount = this.stats.operationTimeouts[operation] || 0

            // If this operation times out frequently, increase timeout
            if (timeoutCount > 5) {
                const suggested = Math.ceil(avgElapsed * 1.5)
                if (suggested > current) {
                    suggestions[operation] = {
                        current,
                        suggested,
                        reason: `Frequent timeouts (${timeoutCount}x). Average: ${avgElapsed}ms`,
                    }
                }
            }

            // If operation never times out and completes well before limit, can decrease
            if (timeoutCount === 0 && avgElapsed < current * 0.5) {
                const suggested = Math.ceil(current * 0.75)
                suggestions[operation] = {
                    current,
                    suggested,
                    reason: `Always completes early. Max observed: ${avgElapsed}ms`,
                }
            }
        }

        return suggestions
    }
}

// Singleton instance
let managerInstance: TimeoutManager | null = null

/**
 * Get or create timeout manager instance
 */
export function getTimeoutManager(config?: Partial<TimeoutConfig>): TimeoutManager {
    if (!managerInstance) {
        managerInstance = new TimeoutManager(config)
    }
    return managerInstance
}

/**
 * Reset manager (for testing)
 */
export function resetTimeoutManager(): void {
    managerInstance = null
}
