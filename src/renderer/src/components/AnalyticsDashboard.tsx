/**
 * Analytics Dashboard Component
 * 
 * Displays comprehensive analytics including:
 * - Basic stats (conversations, messages, confidence)
 * - Performance metrics (latency, cache hit rate)
 * - Cost analysis (trends, forecasts, provider breakdown)
 * - System recommendations
 */

import React, { useEffect, useState } from 'react'
import { useHistoryStore } from '../store/historyStore'

interface ScheduledSummary {
    id: string
    query: string
    focusMode: string
    intervalMs: number
    lastRun: number
}

interface AggregatedMetrics {
    period: 'hourly' | 'daily' | 'monthly'
    timestamp: number
    total_queries: number
    total_embeddings: number
    total_cache_hits: number
    total_cache_misses: number
    total_errors: number
    avg_latency_ms: number
    p50_latency_ms: number
    p95_latency_ms: number
    p99_latency_ms: number
    total_tokens: number
    total_cost_usd: number
    cost_by_provider: Record<string, number>
    error_breakdown: Record<string, number>
}

interface Props {
    onClose: () => void
}

export default function AnalyticsDashboard({ onClose }: Props) {
    const { threads } = useHistoryStore()
    const [scheduled, setScheduled] = useState<ScheduledSummary[]>([])
    const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'cost'>('overview')
    const [period, setPeriod] = useState<'hourly' | 'daily' | 'monthly'>('daily')
    const [metrics, setMetrics] = useState<AggregatedMetrics[]>([])
    const [loadingMetrics, setLoadingMetrics] = useState(false)

    useEffect(() => {
        (async () => {
            try {
                const all = await window.api.getScheduledSearches()
                setScheduled(all)
            } catch {
                setScheduled([])
            }
        })()
        loadMetrics()
    }, [])

    useEffect(() => {
        loadMetrics()
    }, [period])

    const loadMetrics = async () => {
        try {
            setLoadingMetrics(true)
            const count = period === 'hourly' ? 24 : period === 'daily' ? 30 : 12
            const data = await window.api.getAnalyticsSummary(period, count)
            setMetrics(data || [])
        } catch (err) {
            console.error('Failed to load analytics metrics:', err)
            setMetrics([])
        } finally {
            setLoadingMetrics(false)
        }
    }

    const handleExport = async () => {
        try {
            const csv = await window.api.exportAnalytics({ format: 'csv' })
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `analytics-${Date.now()}.csv`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Failed to export analytics:', err)
        }
    }

    // Basic stats (existing)
    const totalThreads = threads.length
    const totalMessages = threads.reduce((sum, t) => sum + t.messages.length, 0)
    const scheduledCount = scheduled.length

    const confidences = threads
        .map(t => t.lastConfidence?.score)
        .filter((s): s is number => typeof s === 'number')
    const avgConfidence = confidences.length
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : null

    const tagCounts = threads.reduce<Record<string, number>>((acc, t) => {
        (t.tags ?? []).forEach(tag => {
            acc[tag] = (acc[tag] || 0) + 1
        })
        return acc
    }, {})
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)

    // Advanced metrics (new)
    const totalQueries = metrics.reduce((sum, m) => sum + m.total_queries, 0)
    const totalCost = metrics.reduce((sum, m) => sum + m.total_cost_usd, 0)
    const totalCacheHits = metrics.reduce((sum, m) => sum + m.total_cache_hits, 0)
    const totalCacheMisses = metrics.reduce((sum, m) => sum + m.total_cache_misses, 0)
    const cacheHitRate = (totalCacheHits + totalCacheMisses) > 0
        ? (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100
        : 0
    const avgLatency = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.avg_latency_ms, 0) / metrics.length
        : 0

    const formatCost = (cost: number): string => {
        if (cost < 0.01) return `$${(cost * 1000).toFixed(2)}m`
        if (cost < 1) return `$${(cost * 100).toFixed(2)}¢`
        return `$${cost.toFixed(2)}`
    }

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="analytics-panel">
                <div className="settings-header">
                    <span className="settings-title">📊 Analytics</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as any)}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}
                        >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="monthly">Monthly</option>
                        </select>
                        <button 
                            className="btn-ghost" 
                            onClick={handleExport}
                            style={{ padding: '4px 12px' }}
                        >
                            Export CSV
                        </button>
                        <button className="settings-close" onClick={onClose} aria-label="Close analytics">✕</button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    padding: '12px 20px', 
                    borderBottom: '1px solid var(--border)' 
                }}>
                    <button
                        className={activeTab === 'overview' ? 'tab-button active' : 'tab-button'}
                        onClick={() => setActiveTab('overview')}
                        style={{
                            padding: '6px 16px',
                            border: 'none',
                            background: activeTab === 'overview' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'overview' ? 'white' : 'var(--text)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Overview
                    </button>
                    <button
                        className={activeTab === 'performance' ? 'tab-button active' : 'tab-button'}
                        onClick={() => setActiveTab('performance')}
                        style={{
                            padding: '6px 16px',
                            border: 'none',
                            background: activeTab === 'performance' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'performance' ? 'white' : 'var(--text)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Performance
                    </button>
                    <button
                        className={activeTab === 'cost' ? 'tab-button active' : 'tab-button'}
                        onClick={() => setActiveTab('cost')}
                        style={{
                            padding: '6px 16px',
                            border: 'none',
                            background: activeTab === 'cost' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'cost' ? 'white' : 'var(--text)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Cost Analysis
                    </button>
                </div>

                <div className="analytics-body">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <>
                            <div className="analytics-cards">
                                <div className="analytics-card">
                                    <div className="analytics-card-label">Conversations</div>
                                    <div className="analytics-card-value">{totalThreads}</div>
                                </div>
                                <div className="analytics-card">
                                    <div className="analytics-card-label">Messages</div>
                                    <div className="analytics-card-value">{totalMessages}</div>
                                </div>
                                <div className="analytics-card">
                                    <div className="analytics-card-label">Scheduled searches</div>
                                    <div className="analytics-card-value">{scheduledCount}</div>
                                </div>
                                <div className="analytics-card">
                                    <div className="analytics-card-label">Avg. confidence</div>
                                    <div className="analytics-card-value">
                                        {avgConfidence !== null ? `${avgConfidence}` : '—'}
                                    </div>
                                </div>
                            </div>

                            <div className="analytics-section">
                                <div className="analytics-section-title">Top tags</div>
                                {topTags.length === 0 && (
                                    <div className="empty-state" style={{ padding: 12, fontSize: 13 }}>
                                        No tags yet. Tags are auto-generated for new answers.
                                    </div>
                                )}
                                {topTags.length > 0 && (
                                    <div className="tag-pills">
                                        {topTags.map(([tag, count]) => (
                                            <span key={tag} className="tag-pill">
                                                {tag} <span className="tag-pill-count">{count}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="analytics-section">
                                <div className="analytics-section-title">Scheduled searches</div>
                                {scheduled.length === 0 && (
                                    <div className="empty-state" style={{ padding: 12, fontSize: 13 }}>
                                        No recurring searches configured.
                                    </div>
                                )}
                                {scheduled.length > 0 && (
                                    <div className="scheduled-list">
                                        {scheduled.map(s => (
                                            <div key={s.id} className="scheduled-item">
                                                <div className="scheduled-main">
                                                    <div className="scheduled-query">{s.query}</div>
                                                    <div className="scheduled-meta">
                                                        Mode: {s.focusMode} • Every {Math.round(s.intervalMs / 60000)} min
                                                    </div>
                                                </div>
                                                <div className="scheduled-meta">
                                                    Last run:{' '}
                                                    {s.lastRun
                                                        ? new Date(s.lastRun).toLocaleString()
                                                        : 'never'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Performance Tab */}
                    {activeTab === 'performance' && (
                        <>
                            {loadingMetrics ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>Loading metrics...</div>
                            ) : (
                                <>
                                    <div className="analytics-cards">
                                        <div className="analytics-card">
                                            <div className="analytics-card-label">Total Queries</div>
                                            <div className="analytics-card-value">{totalQueries.toLocaleString()}</div>
                                        </div>
                                        <div className="analytics-card">
                                            <div className="analytics-card-label">Cache Hit Rate</div>
                                            <div className="analytics-card-value">{cacheHitRate.toFixed(1)}%</div>
                                        </div>
                                        <div className="analytics-card">
                                            <div className="analytics-card-label">Avg Latency</div>
                                            <div className="analytics-card-value">{avgLatency.toFixed(0)}ms</div>
                                        </div>
                                        <div className="analytics-card">
                                            <div className="analytics-card-label">Total Errors</div>
                                            <div className="analytics-card-value">
                                                {metrics.reduce((sum, m) => sum + m.total_errors, 0)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="analytics-section">
                                        <div className="analytics-section-title">Latency Percentiles</div>
                                        {metrics.length > 0 ? (
                                            <div style={{ padding: '12px', fontSize: '13px' }}>
                                                {metrics.slice(-7).map((m, i) => {
                                                    const date = new Date(m.timestamp).toLocaleDateString()
                                                    return (
                                                        <div key={i} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>{date}</span>
                                                            <span>
                                                                P50: {m.p50_latency_ms}ms | 
                                                                P95: {m.p95_latency_ms}ms | 
                                                                P99: {m.p99_latency_ms}ms
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="empty-state" style={{ padding: 12, fontSize: 13 }}>
                                                No performance data available yet.
                                            </div>
                                        )}
                                    </div>

                                    <div className="analytics-section">
                                        <div className="analytics-section-title">Cache Performance</div>
                                        {(totalCacheHits + totalCacheMisses) > 0 ? (
                                            <div style={{ padding: '12px', fontSize: '13px' }}>
                                                <div style={{ marginBottom: '8px' }}>
                                                    Cache Hits: <strong>{totalCacheHits.toLocaleString()}</strong>
                                                </div>
                                                <div style={{ marginBottom: '8px' }}>
                                                    Cache Misses: <strong>{totalCacheMisses.toLocaleString()}</strong>
                                                </div>
                                                <div>
                                                    Hit Rate: <strong>{cacheHitRate.toFixed(1)}%</strong>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="empty-state" style={{ padding: 12, fontSize: 13 }}>
                                                No cache data available yet.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Cost Analysis Tab */}
                    {activeTab === 'cost' && (
                        <>
                            {loadingMetrics ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>Loading cost data...</div>
                            ) : (
                                <>
                                    <div className="analytics-cards">
                                        <div className="analytics-card">
                                            <div className="analytics-card-label">Total Cost</div>
                                            <div className="analytics-card-value">{formatCost(totalCost)}</div>
                                        </div>
                                        <div className="analytics-card">
                                            <div className="analytics-card-label">Total Tokens</div>
                                            <div className="analytics-card-value">
                                                {(metrics.reduce((sum, m) => sum + m.total_tokens, 0) / 1000).toFixed(1)}K
                                            </div>
                                        </div>
                                        <div className="analytics-card">
                                            <div className="analytics-card-label">Avg Cost/Query</div>
                                            <div className="analytics-card-value">
                                                {totalQueries > 0 ? formatCost(totalCost / totalQueries) : '$0.00'}
                                            </div>
                                        </div>
                                        <div className="analytics-card">
                                            <div className="analytics-card-label">30-Day Forecast</div>
                                            <div className="analytics-card-value">
                                                {metrics.length > 0 
                                                    ? formatCost((metrics.slice(-7).reduce((sum, m) => sum + m.total_cost_usd, 0) / 7) * 30)
                                                    : '$0.00'
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="analytics-section">
                                        <div className="analytics-section-title">Cost by Provider</div>
                                        {metrics.length > 0 ? (
                                            <div style={{ padding: '12px', fontSize: '13px' }}>
                                                {(() => {
                                                    const providerCosts: Record<string, number> = {}
                                                    metrics.forEach(m => {
                                                        Object.entries(m.cost_by_provider).forEach(([provider, cost]) => {
                                                            providerCosts[provider] = (providerCosts[provider] || 0) + cost
                                                        })
                                                    })
                                                    return Object.entries(providerCosts)
                                                        .sort((a, b) => b[1] - a[1])
                                                        .map(([provider, cost]) => (
                                                            <div key={provider} style={{ 
                                                                marginBottom: '8px', 
                                                                display: 'flex', 
                                                                justifyContent: 'space-between' 
                                                            }}>
                                                                <span>{provider}</span>
                                                                <strong>{formatCost(cost)}</strong>
                                                            </div>
                                                        ))
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="empty-state" style={{ padding: 12, fontSize: 13 }}>
                                                No cost data available yet.
                                            </div>
                                        )}
                                    </div>

                                    <div className="analytics-section">
                                        <div className="analytics-section-title">Daily Cost Trend</div>
                                        {metrics.length > 0 ? (
                                            <div style={{ padding: '12px', fontSize: '13px' }}>
                                                {metrics.slice(-7).map((m, i) => {
                                                    const date = new Date(m.timestamp).toLocaleDateString()
                                                    return (
                                                        <div key={i} style={{ 
                                                            marginBottom: '8px', 
                                                            display: 'flex', 
                                                            justifyContent: 'space-between' 
                                                        }}>
                                                            <span>{date}</span>
                                                            <strong>{formatCost(m.total_cost_usd)}</strong>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="empty-state" style={{ padding: 12, fontSize: 13 }}>
                                                No trend data available yet.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="settings-footer">
                    <button className="btn-ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
}
