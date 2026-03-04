import { describe, it, expect, beforeEach } from 'vitest'
import { TaskQueue, TaskPriority, resetTaskQueue, getTaskQueue } from '../src/main/services/taskQueue'

describe('Task Queue', () => {
    beforeEach(() => {
        resetTaskQueue()
    })

    it('should execute tasks with bounded concurrency', async () => {
        const queue = new TaskQueue(2)
        const executedTasks: string[] = []
        const activeTasks: number[] = []
        let maxActive = 0

        // Create 5 tasks with simulated delays
        const promises = []
        for (let i = 0; i < 5; i++) {
            const promise = queue.enqueue({
                id: `task-${i}`,
                name: `Task ${i}`,
                priority: TaskPriority.NORMAL,
                execute: async () => {
                    activeTasks.push(queue.getStatus().activeCount)
                    maxActive = Math.max(maxActive, queue.getStatus().activeCount)
                    executedTasks.push(`task-${i}`)
                    // Simulate work
                    await new Promise((resolve) => setTimeout(resolve, 10))
                    return i
                },
            })
            promises.push(promise)
        }

        const results = await Promise.all(promises)

        expect(results).toEqual([0, 1, 2, 3, 4])
        expect(executedTasks.length).toBe(5)
        expect(maxActive).toBeLessThanOrEqual(2)
    })

    it('should prioritize tasks correctly', async () => {
        const queue = new TaskQueue(1)
        const executionOrder: string[] = []

        // Enqueue tasks in reverse priority order
        const low = queue.enqueue({
            id: 'low',
            name: 'Low Priority',
            priority: TaskPriority.LOW,
            execute: async () => {
                executionOrder.push('low')
                return 'low'
            },
        })

        const normal = queue.enqueue({
            id: 'normal',
            name: 'Normal Priority',
            priority: TaskPriority.NORMAL,
            execute: async () => {
                executionOrder.push('normal')
                return 'normal'
            },
        })

        const high = queue.enqueue({
            id: 'high',
            name: 'High Priority',
            priority: TaskPriority.HIGH,
            execute: async () => {
                executionOrder.push('high')
                return 'high'
            },
        })

        const critical = queue.enqueue({
            id: 'critical',
            name: 'Critical Priority',
            priority: TaskPriority.CRITICAL,
            execute: async () => {
                executionOrder.push('critical')
                return 'critical'
            },
        })

        await Promise.all([critical, high, normal, low])

        expect(executionOrder).toEqual(['critical', 'high', 'normal', 'low'])
    })

    it('should track metrics correctly', async () => {
        const queue = new TaskQueue(2)

        const promises = []
        for (let i = 0; i < 3; i++) {
            promises.push(
                queue.enqueue({
                    id: `task-${i}`,
                    name: `Task ${i}`,
                    priority: TaskPriority.NORMAL,
                    execute: async () => {
                        await new Promise((resolve) => setTimeout(resolve, 5))
                        return i
                    },
                }),
            )
        }

        // Check metrics after completion
        await Promise.all(promises)
        const metrics = queue.getMetrics()

        expect(metrics.pending).toBe(0)
        expect(metrics.active).toBe(0)
        expect(metrics.completed).toBe(3)
        expect(metrics.failed).toBe(0)
        expect(metrics.averageTaskDurationMs).toBeGreaterThan(0)
    })

    it('should retry failed tasks', async () => {
        const queue = new TaskQueue(1)
        let attempts = 0

        const promise = queue.enqueue({
            id: 'retry-task',
            name: 'Retry Task',
            priority: TaskPriority.NORMAL,
            maxRetries: 2,
            execute: async () => {
                attempts++
                if (attempts < 2) {
                    throw new Error('First attempt fails')
                }
                return 'success'
            },
        })

        const result = await promise
        expect(result).toBe('success')
        expect(attempts).toBe(2)

        const metrics = queue.getMetrics()
        expect(metrics.completed).toBe(1)
        expect(metrics.failed).toBe(0)
    })

    it('should handle permanent failures', async () => {
        const queue = new TaskQueue(1)
        let attempts = 0

        const promise = queue.enqueue({
            id: 'fail-task',
            name: 'Fail Task',
            priority: TaskPriority.NORMAL,
            maxRetries: 1,
            execute: async () => {
                attempts++
                throw new Error('Always fails')
            },
        })

        try {
            await promise
            expect.fail('Should have thrown')
        } catch (err) {
            expect(err).toBeInstanceOf(Error)
        }

        expect(attempts).toBe(2) // 1 initial + 1 retry
        const metrics = queue.getMetrics()
        expect(metrics.failed).toBe(1)
    })

    it('should provide singleton instance through getTaskQueue', () => {
        const queue1 = getTaskQueue(3)
        const queue2 = getTaskQueue(3)
        expect(queue1).toBe(queue2)
    })

    it('should get detailed metrics with recent tasks', async () => {
        const queue = new TaskQueue(1)

        const promises = []
        for (let i = 0; i < 3; i++) {
            promises.push(
                queue.enqueue({
                    id: `task-${i}`,
                    name: `Task ${i}`,
                    priority: TaskPriority.NORMAL,
                    execute: async () => i,
                }),
            )
        }

        await Promise.all(promises)
        const detailed = queue.getDetailedMetrics()

        expect(detailed.completed).toBe(3)
        expect(detailed.recentCompletedTasks.length).toBe(3)
        expect(detailed.recentCompletedTasks[0].name).toContain('Task')
    })
})
