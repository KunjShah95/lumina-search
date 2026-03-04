import React, { useEffect, useState } from 'react'
import { useHistoryStore } from '../store/historyStore'

interface ScheduledSummary {
    id: string
    query: string
    focusMode: string
    intervalMs: number
    lastRun: number
}

interface Props {
    onClose: () => void
}

export default function AnalyticsDashboard({ onClose }: Props) {
    const { threads } = useHistoryStore()
    const [scheduled, setScheduled] = useState<ScheduledSummary[]>([])

    useEffect(() => {
        (async () => {
            try {
                const all = await window.api.getScheduledSearches()
                setScheduled(all)
            } catch {
                setScheduled([])
            }
        })()
    }, [])

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

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="analytics-panel">
                <div className="settings-header">
                    <span className="settings-title">📊 Analytics</span>
                    <button className="settings-close" onClick={onClose} aria-label="Close analytics">✕</button>
                </div>
                <div className="analytics-body">
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
                </div>
                <div className="settings-footer">
                    <button className="btn-ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
}

