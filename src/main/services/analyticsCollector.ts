import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { createLogger } from './logger';

const logger = createLogger('analytics');

// ============================================================================
// Types
// ============================================================================

export type EventType = 
  | 'query'
  | 'embedding'
  | 'cache_hit'
  | 'cache_miss'
  | 'error'
  | 'budget_update';

export interface AnalyticsEvent {
  id?: number;
  timestamp: number;
  type: EventType;
  duration_ms?: number;
  tokens_used?: number;
  cost_usd?: number;
  model?: string;
  provider?: string;
  error_type?: string;
  metadata?: Record<string, unknown>;
}

export interface AggregatedMetrics {
  period: 'hourly' | 'daily' | 'monthly';
  timestamp: number;
  total_queries: number;
  total_embeddings: number;
  total_cache_hits: number;
  total_cache_misses: number;
  total_errors: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  cost_by_provider: Record<string, number>;
  error_breakdown: Record<string, number>;
}

export interface ExportOptions {
  startDate?: number;
  endDate?: number;
  eventTypes?: EventType[];
  format?: 'json' | 'csv';
}

interface StorageData {
  events: AnalyticsEvent[];
  nextId: number;
}

// ============================================================================
// Analytics Collector
// ============================================================================

export class AnalyticsCollector {
  private data: StorageData = { events: [], nextId: 1 };
  private filePath: string = '';
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly TTL_DAYS = 90; // Keep events for 90 days
  private readonly CLEANUP_INTERVAL_MS = 1000 * 60 * 60; // 1 hour
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(private dbPath?: string) {}

  /**
   * Initialize the analytics service
   */
  initialize(): void {
    try {
      // Default to user data directory
      const userDataPath = app.getPath('userData');
      const defaultPath = path.join(userDataPath, 'analytics.json');
      this.filePath = this.dbPath || defaultPath;

      logger.info('Initializing analytics collector', { filePath: this.filePath });

      this.loadData();
      this.startCleanupScheduler();

      logger.info('Analytics collector initialized successfully');
    } catch (err) {
      logger.error('Failed to initialize analytics collector', { error: err });
      throw err;
    }
  }

  /**
   * Load data from JSON file
   */
  private loadData(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.data = { events: [], nextId: 1 };
      }
    } catch (err) {
      logger.warn('Failed to load analytics data, starting fresh', { error: err });
      this.data = { events: [], nextId: 1 };
    }
  }

  /**
   * Save data to JSON file (debounced)
   */
  private saveData(): void {
    // Debounce saves to avoid excessive disk writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      try {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
      } catch (err) {
        logger.error('Failed to save analytics data', { error: err });
      }
    }, 1000);
  }

  /**
   * Force immediate save
   */
  private flushData(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      logger.error('Failed to flush analytics data', { error: err });
    }
  }

  /**
   * Record a new analytics event
   */
  recordEvent(event: Omit<AnalyticsEvent, 'id'>): void {
    try {
      const newEvent: AnalyticsEvent = {
        ...event,
        id: this.data.nextId++
      };
      this.data.events.push(newEvent);
      
      // Keep max 100,000 events to prevent unbounded growth
      if (this.data.events.length > 100000) {
        this.data.events = this.data.events.slice(-50000);
      }

      logger.debug('Analytics event recorded', { type: event.type });
      this.saveData();
    } catch (err) {
      logger.warn('Failed to record analytics event', { error: err });
    }
  }

  /**
   * Get events with optional filtering
   */
  getEvents(options: ExportOptions = {}): AnalyticsEvent[] {
    const { startDate, endDate, eventTypes } = options;

    let filtered = this.data.events;

    if (startDate) {
      filtered = filtered.filter(e => e.timestamp >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(e => e.timestamp <= endDate);
    }

    if (eventTypes && eventTypes.length > 0) {
      filtered = filtered.filter(e => eventTypes.includes(e.type));
    }

    // Return most recent first, limited to 10,000
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10000);
  }

  /**
   * Compute aggregated metrics for a time period
   */
  computeMetrics(
    period: 'hourly' | 'daily' | 'monthly',
    startDate: number,
    endDate: number
  ): AggregatedMetrics | null {
    try {
      // Get all events in the period
      const events = this.getEvents({ startDate, endDate });

      if (events.length === 0) {
        return {
          period,
          timestamp: startDate,
          total_queries: 0,
          total_embeddings: 0,
          total_cache_hits: 0,
          total_cache_misses: 0,
          total_errors: 0,
          avg_latency_ms: 0,
          p50_latency_ms: 0,
          p95_latency_ms: 0,
          p99_latency_ms: 0,
          total_tokens: 0,
          total_cost_usd: 0,
          cost_by_provider: {},
          error_breakdown: {}
        };
      }

      // Count event types
      const total_queries = events.filter(e => e.type === 'query').length;
      const total_embeddings = events.filter(e => e.type === 'embedding').length;
      const total_cache_hits = events.filter(e => e.type === 'cache_hit').length;
      const total_cache_misses = events.filter(e => e.type === 'cache_miss').length;
      const total_errors = events.filter(e => e.type === 'error').length;

      // Latency statistics (for queries and embeddings)
      const latencies = events
        .filter(e => e.duration_ms !== undefined)
        .map(e => e.duration_ms!)
        .sort((a, b) => a - b);

      const avg_latency_ms = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

      const p50_latency_ms = this.percentile(latencies, 0.50);
      const p95_latency_ms = this.percentile(latencies, 0.95);
      const p99_latency_ms = this.percentile(latencies, 0.99);

      // Token and cost aggregation
      const total_tokens = events
        .filter(e => e.tokens_used !== undefined)
        .reduce((sum, e) => sum + e.tokens_used!, 0);

      const total_cost_usd = events
        .filter(e => e.cost_usd !== undefined)
        .reduce((sum, e) => sum + e.cost_usd!, 0);

      // Cost by provider
      const cost_by_provider: Record<string, number> = {};
      events
        .filter(e => e.provider && e.cost_usd !== undefined)
        .forEach(e => {
          const provider = e.provider!;
          cost_by_provider[provider] = (cost_by_provider[provider] || 0) + e.cost_usd!;
        });

      // Error breakdown
      const error_breakdown: Record<string, number> = {};
      events
        .filter(e => e.type === 'error' && e.error_type)
        .forEach(e => {
          const errorType = e.error_type!;
          error_breakdown[errorType] = (error_breakdown[errorType] || 0) + 1;
        });

      return {
        period,
        timestamp: startDate,
        total_queries,
        total_embeddings,
        total_cache_hits,
        total_cache_misses,
        total_errors,
        avg_latency_ms: Math.round(avg_latency_ms * 100) / 100,
        p50_latency_ms: Math.round(p50_latency_ms * 100) / 100,
        p95_latency_ms: Math.round(p95_latency_ms * 100) / 100,
        p99_latency_ms: Math.round(p99_latency_ms * 100) / 100,
        total_tokens,
        total_cost_usd: Math.round(total_cost_usd * 10000) / 10000,
        cost_by_provider,
        error_breakdown
      };
    } catch (err) {
      logger.error('Failed to compute metrics', { error: err });
      return null;
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil(sortedArr.length * p) - 1;
    return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
  }

  /**
   * Get aggregated metrics for multiple periods
   */
  getSummary(period: 'hourly' | 'daily' | 'monthly', count: number = 24): AggregatedMetrics[] {
    try {
      const now = Date.now();
      const results: AggregatedMetrics[] = [];

      let intervalMs: number;
      switch (period) {
        case 'hourly':
          intervalMs = 1000 * 60 * 60; // 1 hour
          break;
        case 'daily':
          intervalMs = 1000 * 60 * 60 * 24; // 1 day
          break;
        case 'monthly':
          intervalMs = 1000 * 60 * 60 * 24 * 30; // ~30 days
          break;
      }

      // Compute metrics for each period
      for (let i = 0; i < count; i++) {
        const endDate = now - (i * intervalMs);
        const startDate = endDate - intervalMs;

        const metrics = this.computeMetrics(period, startDate, endDate);
        if (metrics) {
          results.push(metrics);
        }
      }

      return results.reverse(); // Oldest first
    } catch (err) {
      logger.error('Failed to get summary', { error: err });
      return [];
    }
  }

  /**
   * Export events to CSV or JSON
   */
  export(options: ExportOptions = {}): string {
    const events = this.getEvents(options);
    const format = options.format || 'json';

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    } else {
      // CSV format
      const headers = [
        'id', 'timestamp', 'type', 'duration_ms', 'tokens_used',
        'cost_usd', 'model', 'provider', 'error_type'
      ];

      const rows = events.map(event => [
        event.id,
        event.timestamp,
        event.type,
        event.duration_ms ?? '',
        event.tokens_used ?? '',
        event.cost_usd ?? '',
        event.model ?? '',
        event.provider ?? '',
        event.error_type ?? ''
      ]);

      return [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
    }
  }

  /**
   * Clear all analytics data
   */
  clearAll(): void {
    try {
      this.data = { events: [], nextId: 1 };
      this.flushData();
      logger.info('All analytics data cleared');
    } catch (err) {
      logger.error('Failed to clear analytics data', { error: err });
    }
  }

  /**
   * Start TTL-based cleanup scheduler
   */
  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEvents();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Remove events older than TTL
   */
  private cleanupOldEvents(): void {
    try {
      const cutoffTime = Date.now() - (this.TTL_DAYS * 24 * 60 * 60 * 1000);
      const originalLength = this.data.events.length;
      
      this.data.events = this.data.events.filter(e => e.timestamp >= cutoffTime);

      const deletedCount = originalLength - this.data.events.length;
      if (deletedCount > 0) {
        logger.info('Cleaned up old analytics events', {
          deletedCount,
          cutoffDate: new Date(cutoffTime).toISOString()
        });
        this.flushData();
      }
    } catch (err) {
      logger.warn('Failed to cleanup old events', { error: err });
    }
  }

  /**
   * Shutdown the analytics service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Flush any pending saves
    this.flushData();
    logger.info('Analytics collector shut down');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let analyticsInstance: AnalyticsCollector | null = null;

export function getAnalyticsCollector(): AnalyticsCollector {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsCollector();
    analyticsInstance.initialize();
  }
  return analyticsInstance;
}

export function shutdownAnalytics(): void {
  if (analyticsInstance) {
    analyticsInstance.shutdown();
    analyticsInstance = null;
  }
}

