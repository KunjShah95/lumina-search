import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SavedSearch {
    id: string
    name: string
    query: string
    isTemplate: boolean
    starred: boolean
    lastExecuted?: string
    executeCount: number
}

interface Props {
    onClose: () => void
    onExecute: (query: string) => void
}

export default function SavedSearchesPanel({ onClose, onExecute }: Props) {
    const [searches, setSearches] = useState<SavedSearch[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'starred' | 'templates'>('all')

    const loadSearches = async () => {
        setLoading(true)
        try {
            const data = await window.api.listSavedSearches()
            setSearches(data)
        } catch (err) {
            console.error('Failed to load saved searches:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSearches()
    }, [])

    const handleToggleStar = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await window.api.toggleSavedSearchStar(id)
            setSearches(prev => prev.map(s => s.id === id ? { ...s, starred: !s.starred } : s))
        } catch (err) {
            console.error('Failed to toggle star:', err)
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this saved search?')) return
        try {
            await window.api.deleteSavedSearch(id)
            setSearches(prev => prev.filter(s => s.id !== id))
        } catch (err) {
            console.error('Failed to delete search:', err)
        }
    }

    const filteredSearches = searches.filter(s => {
        if (filter === 'starred') return s.starred
        if (filter === 'templates') return s.isTemplate
        return true
    })

    return (
        <motion.div
            className="settings-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e: React.MouseEvent) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                className="saved-searches-panel"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
            >
                <div className="settings-header">
                    <span className="settings-title">⭐ Saved Searches</span>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: '8px', padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
                    <button
                        className={`tab-button ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                        style={{ background: filter === 'all' ? 'var(--bg-3)' : 'transparent', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-1)' }}
                    >
                        All
                    </button>
                    <button
                        className={`tab-button ${filter === 'starred' ? 'active' : ''}`}
                        onClick={() => setFilter('starred')}
                        style={{ background: filter === 'starred' ? 'var(--bg-3)' : 'transparent', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-1)' }}
                    >
                        Starred
                    </button>
                    <button
                        className={`tab-button ${filter === 'templates' ? 'active' : ''}`}
                        onClick={() => setFilter('templates')}
                        style={{ background: filter === 'templates' ? 'var(--bg-3)' : 'transparent', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-1)' }}
                    >
                        Templates
                    </button>
                </div>

                <div className="saved-searches-list">
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div>
                    ) : filteredSearches.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
                            <div style={{ fontSize: '32px', marginBottom: '16px' }}>📂</div>
                            <div>No saved searches found</div>
                        </div>
                    ) : (
                        filteredSearches.map(search => (
                            <div
                                key={search.id}
                                className="saved-search-item"
                                onClick={() => {
                                    onExecute(search.query)
                                    onClose()
                                }}
                            >
                                <div className="saved-search-info">
                                    <span className="saved-search-name">
                                        {search.starred && <span style={{ color: '#f59e0b', marginRight: '6px' }}>★</span>}
                                        {search.name}
                                    </span>
                                    <span className="saved-search-query">{search.query}</span>
                                </div>
                                <div className="saved-search-actions">
                                    <button
                                        className="btn-icon"
                                        onClick={(e) => handleToggleStar(search.id, e)}
                                        title={search.starred ? 'Unstar' : 'Star'}
                                    >
                                        {search.starred ? '★' : '☆'}
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={(e) => handleDelete(search.id, e)}
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="settings-footer">
                    <button className="btn-ghost" onClick={loadSearches}>Refresh</button>
                    <button className="btn-primary" onClick={onClose}>Done</button>
                </div>
            </motion.div>
        </motion.div>
    )
}
