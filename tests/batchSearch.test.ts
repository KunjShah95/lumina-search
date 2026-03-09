import { describe, it, expect, beforeEach } from 'vitest'
import { getBatchSearchManager, resetBatchSearchManager } from '../src/main/services/batchSearch'

class MockOrchestrator {
  async *run(query: string): AsyncGenerator<any, void, unknown> {
    yield { type: 'phase', label: `searching:${query}` }

    if (query.toLowerCase().includes('fail')) {
      throw new Error(`simulated failure for ${query}`)
    }

    yield { type: 'token', text: `answer:${query}` }
    yield { type: 'done' }
  }
}

describe('BatchSearchManager', () => {
  beforeEach(() => {
    resetBatchSearchManager()
  })

  it('executes a batch and tracks completed/failed counts', async () => {
    const manager = getBatchSearchManager()
    manager.setOrchestrator(new MockOrchestrator() as any)

    const result = await manager.executeBatch({
      queries: ['typescript basics', 'react fail case', 'vitest guide'],
      concurrency: 2,
      sequential: false,
    })

    expect(result.totalQueries).toBe(3)
    expect(result.completedCount).toBe(2)
    expect(result.failedCount).toBe(1)
    expect(result.items.every((i) => i.status === 'completed' || i.status === 'failed')).toBe(true)
    expect(result.totalExecutionTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('supports sequential execution mode', async () => {
    const manager = getBatchSearchManager()
    manager.setOrchestrator(new MockOrchestrator() as any)

    const result = await manager.executeBatch({
      queries: ['query one', 'query two'],
      sequential: true,
    })

    expect(result.failedCount).toBe(0)
    expect(result.completedCount).toBe(2)
    expect(result.items.map((i) => i.status)).toEqual(['completed', 'completed'])
  })

  it('caps retained batch history to avoid unbounded growth', async () => {
    const manager = getBatchSearchManager()
    manager.setOrchestrator(new MockOrchestrator() as any)

    for (let i = 0; i < 25; i += 1) {
      await manager.executeBatch({
        queries: [`query-${i}`],
      })
    }

    const active = manager.getActiveBatches()
    expect(active.length).toBeLessThanOrEqual(20)
  })
})
