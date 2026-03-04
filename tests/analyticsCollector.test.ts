import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AnalyticsCollector } from '../src/main/services/analyticsCollector'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

describe('AnalyticsCollector', () => {
  let analytics: AnalyticsCollector
  let dbPath: string

  beforeEach(() => {
    // Create temp directory for test analytics
    const tempDir = path.join(os.tmpdir(), 'test-analytics')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    dbPath = path.join(tempDir, `analytics-test-${Date.now()}.json`)
    analytics = new AnalyticsCollector(dbPath)
    analytics.initialize()
  })

  afterEach(() => {
    analytics.shutdown()
    
    // Clean up test file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  describe('Event Recording', () => {
    it('should record query events', () => {
      const timestamp = Date.now()
      
      analytics.recordEvent({
        timestamp,
        type: 'query',
        duration_ms: 1500,
        tokens_used: 250,
        cost_usd: 0.005,
        model: 'gpt-4',
        provider: 'openai'
      })

      const events = analytics.getEvents({ 
        startDate: timestamp - 1000, 
        endDate: timestamp + 1000,
        eventTypes: ['query']
      })
      
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('query')
    })

    it('should record embedding events', () => {
      const timestamp = Date.now()
      
      analytics.recordEvent({
        timestamp,
        type: 'embedding',
        duration_ms: 500,
        tokens_used: 100,
        cost_usd: 0.001,
        model: 'text-embedding-3-small',
        provider: 'openai'
      })

      const events = analytics.getEvents({ 
        startDate: timestamp - 1000, 
        endDate: timestamp + 1000,
        eventTypes: ['embedding']
      })
      
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('embedding')
    })

    it('should record cache events', () => {
      const timestamp = Date.now()
      
      analytics.recordEvent({ timestamp, type: 'cache_hit' })
      analytics.recordEvent({ timestamp: timestamp + 1, type: 'cache_miss' })

      const events = analytics.getEvents({ 
        startDate: timestamp - 1000, 
        endDate: timestamp + 1000,
        eventTypes: ['cache_hit', 'cache_miss']
      })
      
      expect(events).toHaveLength(2)
    })
  })

  describe('Event Filtering', () => {
    beforeEach(() => {
      const now = Date.now()
      analytics.recordEvent({ timestamp: now - 1000 * 60 * 60 * 2, type: 'query' })
      analytics.recordEvent({ timestamp: now - 1000 * 60 * 30, type: 'embedding' })
      analytics.recordEvent({ timestamp: now, type: 'cache_hit' })
    })

    it('should filter by date range', () => {
      const now = Date.now()
      const oneHourAgo = now - 1000 * 60 * 60
      
      const events = analytics.getEvents({ 
        startDate: oneHourAgo,
        endDate: now + 1000
      })
      
      expect(events.length).toBeGreaterThanOrEqual(2)
    })

    it('should filter by event type', () => {
      const now = Date.now()
      
      const queryEvents = analytics.getEvents({ 
        startDate: now - 1000 * 60 * 60 * 3,
        endDate: now + 1000,
        eventTypes: ['query']
      })
      
      expect(queryEvents.every(e => e.type === 'query')).toBe(true)
    })

    it('should handle empty results', () => {
      const now = Date.now()
      
      const events = analytics.getEvents({ 
        startDate: now + 1000 * 60 * 60,
        endDate: now + 2000 * 60 * 60,
        eventTypes: ['query']
      })
      
      expect(events).toEqual([])
    })
  })

  describe('Metrics Aggregation', () => {
    beforeEach(() => {
      const now = Date.now()
      const oneHourMs = 1000 * 60 * 60
      
      // Record multiple events with varying latencies (500, 600, ..., 1400ms)
      for (let i = 0; i < 10; i++) {
        analytics.recordEvent({
          timestamp: now - oneHourMs + (i * 60 * 1000),
          type: 'query',
          duration_ms: 500 + i * 100,
          tokens_used: 100 + i * 10,
          cost_usd: 0.001 + i * 0.0001,
          provider: i < 5 ? 'openai' : 'anthropic'
        })
      }

      // Add cache and error events
      analytics.recordEvent({ timestamp: now - 30 * 60 * 1000, type: 'cache_hit' })
      analytics.recordEvent({ timestamp: now - 30 * 60 * 1000, type: 'cache_hit' })
      analytics.recordEvent({ timestamp: now - 30 * 60 * 1000, type: 'cache_miss' })
      analytics.recordEvent({ timestamp: now - 30 * 60 * 1000, type: 'error', error_type: 'timeout' })
      analytics.recordEvent({ timestamp: now - 30 * 60 * 1000, type: 'error', error_type: 'rate_limit' })
    })

    it('should compute basic metrics', () => {
      const now = Date.now()
      const oneHourMs = 1000 * 60 * 60
      
      const metrics = analytics.computeMetrics('hourly', now - oneHourMs * 2, now + oneHourMs)
      
      expect(metrics).not.toBeNull()
      expect(metrics!.total_queries).toBeGreaterThan(0)
      expect(metrics!.total_cache_hits).toBeGreaterThan(0)
      expect(metrics!.total_errors).toBeGreaterThan(0)
    })

    it('should compute latency percentiles', () => {
      const now = Date.now()
      const oneHourMs = 1000 * 60 * 60
      
      const metrics = analytics.computeMetrics('hourly', now - oneHourMs, now)
      
      expect(metrics).not.toBeNull()
      expect(metrics!.p50_latency_ms).toBeGreaterThan(0)
      expect(metrics!.p95_latency_ms).toBeGreaterThanOrEqual(metrics!.p50_latency_ms)
      expect(metrics!.p99_latency_ms).toBeGreaterThanOrEqual(metrics!.p95_latency_ms)
    })

    it('should compute average latency', () => {
      const now = Date.now()
      const oneHourMs = 1000 * 60 * 60
      
      const metrics = analytics.computeMetrics('hourly', now - oneHourMs, now)
      
      expect(metrics).not.toBeNull()
      expect(metrics!.avg_latency_ms).toBeGreaterThan(0)
    })

    it('should aggregate tokens and costs', () => {
      const now = Date.now()
      const oneHourMs = 1000 * 60 * 60
      
      const metrics = analytics.computeMetrics('hourly', now - oneHourMs, now)
      
      expect(metrics).not.toBeNull()
      expect(metrics!.total_tokens).toBeGreaterThan(0)
      expect(metrics!.total_cost_usd).toBeGreaterThan(0)
    })

    it('should compute cost by provider', () => {
      const now = Date.now()
      const oneHourMs = 1000 * 60 * 60
      
      const metrics = analytics.computeMetrics('hourly', now - oneHourMs, now)
      
      expect(metrics).not.toBeNull()
      expect(metrics!.cost_by_provider).toBeDefined()
      expect(Object.keys(metrics!.cost_by_provider).length).toBeGreaterThan(0)
    })

    it('should compute error breakdown', () => {
      const now = Date.now()
      const oneHourMs = 1000 * 60 * 60
      
      const metrics = analytics.computeMetrics('hourly', now - oneHourMs, now)
      
      expect(metrics).not.toBeNull()
      expect(metrics!.error_breakdown).toBeDefined()
    })
  })

  describe('Data Export', () => {
    beforeEach(() => {
      const now = Date.now()
      analytics.recordEvent({ timestamp: now, type: 'query', duration_ms: 500 })
      analytics.recordEvent({ timestamp: now, type: 'embedding', duration_ms: 300 })
    })

    it('should export events as JSON', () => {
      const json = analytics.export({ format: 'json' })
      
      expect(json).toBeDefined()
      const parsed = JSON.parse(json)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBeGreaterThan(0)
    })

    it('should export events as CSV', () => {
      const csv = analytics.export({ format: 'csv' })
      
      expect(csv).toBeDefined()
      expect(csv).toContain(',')
    })

    it('should clear all analytics data', () => {
      let events = analytics.getEvents()
      expect(events.length).toBeGreaterThan(0)
      
      analytics.clearAll()
      
      events = analytics.getEvents()
      expect(events).toEqual([])
    })
  })

  describe('TTL Cleanup', () => {
    it('should handle shutdown gracefully', () => {
      const now = Date.now()
      analytics.recordEvent({ timestamp: now, type: 'query' })
      
      expect(() => {
        analytics.shutdown()
      }).not.toThrow()
    })
  })

  describe('Summary Retrieval', () => {
    beforeEach(() => {
      const now = Date.now()
      const oneHourMs = 1000 * 60 * 60
      
      // Add events across multiple hours
      for (let hour = 0; hour < 5; hour++) {
        analytics.recordEvent({
          timestamp: now - (hour * oneHourMs),
          type: 'query',
          duration_ms: 1000 + hour * 100,
          cost_usd: 0.01
        })
      }
    })

    it('should retrieve hourly summary', () => {
      const summary = analytics.getSummary('hourly', 5)
      expect(Array.isArray(summary)).toBe(true)
    })

    it('should retrieve daily summary', () => {
      const summary = analytics.getSummary('daily', 7)
      expect(Array.isArray(summary)).toBe(true)
    })

    it('should retrieve monthly summary', () => {
      const summary = analytics.getSummary('monthly', 12)
      expect(Array.isArray(summary)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid event types gracefully', () => {
      const badEvent: any = {
        timestamp: Date.now(),
        type: 'invalid_type'
      }
      
      expect(() => {
        analytics.recordEvent(badEvent)
      }).not.toThrow()
    })

    it('should retrieve empty results for non-existent events', () => {
      const events = analytics.getEvents({ eventTypes: ['nonexistent'] as any })
      expect(Array.isArray(events)).toBe(true)
    })

    it('should handle exports without error', () => {
      const now = Date.now()
      analytics.recordEvent({ timestamp: now, type: 'query' })
      
      expect(() => {
        analytics.export({ format: 'json' })
      }).not.toThrow()
    })
  })
})