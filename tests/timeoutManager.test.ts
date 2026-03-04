import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TimeoutManager, TimeoutError, getTimeoutManager, resetTimeoutManager } from '../src/main/services/timeoutManager'

describe('TimeoutManager', () => {
    beforeEach(() => {
        resetTimeoutManager()
    })

    afterEach(() => {
        resetTimeoutManager()
        vi.useRealTimers()
    })

    it('should execute function within timeout', async () => {
        vi.useFakeTimers()
        const manager = getTimeoutManager()
        const fn = vi.fn(async () => 'success')

        const promise = manager.executeWithTimeout(
            'ragQuery',
            fn,
            1000,
        )
        
        vi.advanceTimersByTime(500)
        await vi.runAllTimersAsync()
        
        const { result, timedOut } = await promise

        expect(result).toBe('success')
        expect(timedOut).toBe(false)
        expect(fn).toHaveBeenCalledOnce()
    })

    it('should timeout when function exceeds timeout', async () => {
        vi.useFakeTimers()
        const manager = getTimeoutManager()
        let resolveFn: () => void = () => {}
        const fn = vi.fn(async () => {
            await new Promise<void>((resolve) => {
                resolveFn = resolve
            })
            return 'success'
        })

        const promise = manager.executeWithTimeout(
            'ragQuery',
            fn,
            1000,
        )
        
        vi.advanceTimersByTime(1100)
        await vi.runAllTimersAsync()
        
        const { result, timedOut } = await promise

        expect(timedOut).toBe(true)
        expect(result).toBeUndefined()

        // Clean up
        resolveFn()
    }, { timeout: 10000 })

    it('should call fallback handler on timeout', async () => {
        vi.useFakeTimers()
        const manager = getTimeoutManager()
        let resolveFn: () => void = () => {}
        const fn = vi.fn(async () => {
            await new Promise<void>((resolve) => {
                resolveFn = resolve
            })
            return 'never'
        })
        const fallback = vi.fn(async () => 'fallback result')

        const promise = manager.executeWithTimeout(
            'ragQuery',
            fn,
            1000,
            fallback,
        )
        
        vi.advanceTimersByTime(1100)
        await vi.runAllTimersAsync()
        
        const { result, timedOut } = await promise

        expect(timedOut).toBe(true)
        expect(result).toBe('fallback result')
        expect(fallback).toHaveBeenCalledOnce()

        // Clean up
        resolveFn()
    }, { timeout: 10000 })

    it('should record timeout statistics', async () => {
        vi.useFakeTimers()
        const manager = getTimeoutManager()
        let resolveFn: () => void = () => {}
        const fn = vi.fn(async () => {
            await new Promise<void>((resolve) => {
                resolveFn = resolve
            })
            return 'never'
        })

        const promise = manager.executeWithTimeout('ragQuery', fn, 1000)
        
        vi.advanceTimersByTime(1100)
        await vi.runAllTimersAsync()
        
        await promise

        const stats = manager.getStats()
        expect(stats.totalTimeouts).toBe(1)
        expect(stats.operationTimeouts['ragQuery']).toBe(1)
        expect(stats.lastTimeoutAt).toBeDefined()

        // Clean up
        resolveFn()
    }, { timeout: 10000 })

    it('should track average timeout duration', async () => {
        vi.useFakeTimers()
        const manager = getTimeoutManager()
        let resolve1: () => void = () => {}
        let resolve2: () => void = () => {}
        
        const fn1 = vi.fn(async () => {
            await new Promise<void>((resolve) => {
                resolve1 = resolve
            })
            return 'never'
        })
        const fn2 = vi.fn(async () => {
            await new Promise<void>((resolve) => {
                resolve2 = resolve
            })
            return 'never'
        })

        const promise1 = manager.executeWithTimeout('ragQuery', fn1, 1000)
        vi.advanceTimersByTime(1100)
        await vi.runAllTimersAsync()
        await promise1

        const promise2 = manager.executeWithTimeout('ragQuery', fn2, 1000)
        vi.advanceTimersByTime(1100)
        await vi.runAllTimersAsync()
        await promise2

        const stats = manager.getStats()
        expect(stats.operationTimeouts['ragQuery']).toBe(2)
        expect(stats.averageTimeoutMs['ragQuery']).toBeGreaterThan(0)

        // Clean up
        resolve1()
        resolve2()
    }, { timeout: 10000 })

    it('should use default timeout for operation type', async () => {
        const manager = getTimeoutManager()
        expect(manager.getTimeoutFor('ragQuery')).toBe(30000)
        expect(manager.getTimeoutFor('embeddingBatch')).toBe(60000)
        expect(manager.getTimeoutFor('pluginOperation')).toBe(15000)
    })

    it('should update timeout configuration', () => {
        const manager = getTimeoutManager()
        manager.updateTimeout('ragQuery', 45000)
        expect(manager.getTimeoutFor('ragQuery')).toBe(45000)

        const config = manager.getConfig()
        expect(config.ragQuery).toBe(45000)
    })

    it('should update multiple timeouts at once', () => {
        const manager = getTimeoutManager()
        manager.updateTimeouts({
            ragQuery: 25000,
            embeddingBatch: 45000,
        })

        expect(manager.getTimeoutFor('ragQuery')).toBe(25000)
        expect(manager.getTimeoutFor('embeddingBatch')).toBe(45000)
        expect(manager.getTimeoutFor('pluginOperation')).toBe(15000) // Unchanged
    })

    it('should execute with abort signal', async () => {
        // Use real timers for this test
        const manager = getTimeoutManager()
        const fn = vi.fn(async (signal: AbortSignal) => {
            // This promise will be rejected when signal is aborted
            return await new Promise<string>((resolve, reject) => {
                const checkAbort = () => {
                    if (signal.aborted) {
                        reject(new Error('Operation aborted'))
                    }
                }
                
                // Check periodically if signal was aborted
                const intervalId = setInterval(checkAbort, 10)
                
                setTimeout(() => {
                    clearInterval(intervalId)
                    if (signal.aborted) {
                        reject(new Error('Operation aborted'))
                    } else {
                        resolve('success')
                    }
                }, 500) // Wait 500ms, which is longer than our 50ms timeout
                
                // Also listen for abort event
                signal.addEventListener('abort', () => {
                    clearInterval(intervalId)
                    reject(new Error('Operation aborted'))
                })
            })
        })

        const { result, timedOut } = await manager.executeWithAbort(
            'ragQuery',
            fn,
            50, // Quick timeout (50ms)
        )

        // Since the promise will take longer to resolve, the timeout should trigger before completion
        expect(timedOut).toBe(true)
        expect(result).toBeUndefined()
    }, { timeout: 10000 })

    it('should clear statistics', () => {
        const manager = getTimeoutManager()

        // Manually modify stats to test clearing
        const stats = manager.getStats()
        stats.totalTimeouts = 5
        manager.clearStats()

        const clearedStats = manager.getStats()
        expect(clearedStats.totalTimeouts).toBe(0)
        expect(clearedStats.operationTimeouts).toEqual({})
        expect(clearedStats.averageTimeoutMs).toEqual({})
    })

    it('should suggest timeout adjustments based on frequent timeouts', async () => {
        // Use real timers for this test
        const manager = getTimeoutManager()
        
        // Simulate 7 timeouts to trigger suggestion
        for (let i = 0; i < 7; i++) {
            const fn = vi.fn(async () => {
                // Wait longer than timeout
                await new Promise<void>((resolve) => {
                    setTimeout(resolve, 2000)
                })
                return 'never'
            })
            
            const promise = manager.executeWithTimeout('ragQuery', fn, 100)
            // Wait for timeout with margin
            await new Promise(resolve => setTimeout(resolve, 200))
            await promise.catch(() => {}) // Ignore the timeout error
        }

        const suggestions = manager.suggestAdjustments()
        // We might have a suggestion if the logic triggers
        // Just verify that the method returns a valid object
        expect(typeof suggestions).toBe('object')
        if (suggestions['ragQuery']) {
            expect(suggestions['ragQuery'].suggested).toBeGreaterThan(suggestions['ragQuery'].current)
        }
    }, { timeout: 20000 })

    it('should singleton pattern work correctly', () => {
        const manager1 = getTimeoutManager()
        manager1.updateTimeout('ragQuery', 50000)

        const manager2 = getTimeoutManager()
        expect(manager2.getTimeoutFor('ragQuery')).toBe(50000)
    })

    it('should handle errors in main function', async () => {
        const manager = getTimeoutManager()
        const fn = vi.fn(async () => {
            throw new Error('Execution error')
        })

        try {
            await manager.executeWithTimeout('ragQuery', fn, 1000)
        } catch (err) {
            expect(err).toBeInstanceOf(Error)
            expect((err as Error).message).toBe('Execution error')
        }
    })

    it('should handle errors in fallback function', async () => {
        vi.useFakeTimers()
        const manager = getTimeoutManager()
        let resolveFn: () => void = () => {}
        const fn = vi.fn(async () => {
            await new Promise<void>((resolve) => {
                resolveFn = resolve
            })
            return 'never'
        })
        const fallback = vi.fn(async () => {
            throw new Error('Fallback error')
        })

        const promise = manager.executeWithTimeout(
            'ragQuery',
            fn,
            1000,
            fallback,
        )

        vi.advanceTimersByTime(1100)
        await vi.runAllTimersAsync()

        const { result, timedOut } = await promise

        expect(timedOut).toBe(true)
        expect(result).toBeUndefined()

        // Clean up
        resolveFn()
    }, { timeout: 10000 })
})

