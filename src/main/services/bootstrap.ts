/**
 * Bootstrap Service
 * 
 * Handles asynchronous initialization of application components.
 * Runs during startup before showing the main window.
 * 
 * Tasks:
 * - Database initialization
 * - Semantic cache restoration
 * - Observability setup
 * - Plugin loading
 * - Scheduler bootstrap
 */

import { createLogger } from './logger'
import { getSplashScreen } from './splashScreen'

const logger = createLogger('bootstrap')

export interface BootstrapProgress {
    current: number
    total: number
    message: string
}

type InitializationTask = {
    name: string
    weight: number // Progress contribution (0-100)
    execute: () => Promise<void>
}

/**
 * Application bootstrap manager
 */
export class Bootstrap {
    private tasks: InitializationTask[] = []
    private currentProgress = 0
    private totalWeight = 0

    /**
     * Register an initialization task
     */
    registerTask(name: string, weight: number, execute: () => Promise<void>): void {
        this.tasks.push({ name, weight, execute })
        this.totalWeight += weight
    }

    /**
     * Execute all registered tasks with progress tracking
     */
    async initialize(): Promise<void> {
        const splashScreen = getSplashScreen()
        logger.info('Starting application bootstrap', { taskCount: this.tasks.length })

        for (const task of this.tasks) {
            try {
                splashScreen.updateProgress(task.name, this.currentProgress)
                logger.info(`Bootstrap task started: ${task.name}`)

                const startTime = Date.now()
                await task.execute()
                const duration = Date.now() - startTime

                this.currentProgress += (task.weight / this.totalWeight) * 100
                splashScreen.updateProgress(task.name, Math.min(this.currentProgress, 100))

                logger.info(`Bootstrap task completed: ${task.name}`, { durationMs: duration })
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err))
                logger.error(`Bootstrap task failed: ${task.name}`, error)
                throw new Error(`Initialization failed at step '${task.name}': ${error.message}`)
            }
        }

        logger.info('Bootstrap complete', { totalDurationMs: this.currentProgress })
        await splashScreen.close()
    }

    /**
     * Get current progress
     */
    getProgress(): BootstrapProgress {
        return {
            current: Math.round(this.currentProgress),
            total: 100,
            message: '',
        }
    }

    /**
     * Clear all registered tasks
     */
    reset(): void {
        this.tasks = []
        this.currentProgress = 0
        this.totalWeight = 0
    }
}

// Singleton instance
let bootstrapInstance: Bootstrap | null = null

/**
 * Get or create bootstrap instance
 */
export function getBootstrap(): Bootstrap {
    if (!bootstrapInstance) {
        bootstrapInstance = new Bootstrap()
    }
    return bootstrapInstance
}

/**
 * Reset bootstrap (for testing)
 */
export function resetBootstrap(): void {
    bootstrapInstance = null
}
