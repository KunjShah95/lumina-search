import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

interface SavedSearch {
    id: string
    name: string
    query: string
    isTemplate: boolean
    starred: boolean
    lastExecuted?: string
    executeCount: number
    category?: string
    autoRefresh?: {
        enabled: boolean
        intervalSeconds: number
        lastRefreshed?: string
    }
}

interface QuickTemplate {
    name: string
    description: string
    query: string
    category: string
}

const BUILTIN_TEMPLATES: QuickTemplate[] = [
    {
        name: 'Research Paper',
        description: 'Find recent academic papers on a topic',
        query: '${topic} site:arxiv.org filetype:pdf date:2024-01-01..2026-12-31',
        category: 'Research',
    },
    {
        name: 'Code Search',
        description: 'Find code examples and implementation references',
        query: '${topic} site:github.com lang:${language} intitle:${keyword}',
        category: 'Development',
    },
    {
        name: 'News Update',
        description: 'Track latest updates in major publications',
        query: '${topic} site:reuters.com OR site:bbc.com date:2025-01-01..2026-12-31',
        category: 'News',
    },
]

interface Props {
    onClose: () => void
    onExecute: (query: string) => void
}

export default function SavedSearchesPanel({ onClose, onExecute }: Props) {
    const [searches, setSearches] = useState<SavedSearch[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'starred' | 'templates'>('all')
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
    const [showNewFolderInput, setShowNewFolderInput] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [autoRefreshConfigs, setAutoRefreshConfigs] = useState<Record<string, { enabled: boolean; intervalSeconds: number }>>({})

    const loadSearches = async () => {
        setLoading(true)
        try {
            const data = await window.api.listSavedSearches()
            setSearches(data)
            // Load auto-refresh configs for each search
            const configs: Record<string, any> = {}
            data.forEach(s => {
                if (s.autoRefresh) {
                    configs[s.id] = s.autoRefresh
                }
            })
            setAutoRefreshConfigs(configs)
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

    const handleToggleAutoRefresh = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            const config = autoRefreshConfigs[id]
            if (config?.enabled) {
                await window.api.stopSavedSearchRefresh(id)
                setAutoRefreshConfigs(prev => ({
                    ...prev,
                    [id]: { ...config, enabled: false }
                }))
            } else {
                const intervalSeconds = config?.intervalSeconds || 3600 // 1 hour default
                await window.api.enableSavedSearchRefresh(id, intervalSeconds)
                setAutoRefreshConfigs(prev => ({
                    ...prev,
                    [id]: { enabled: true, intervalSeconds }
                }))
            }
        } catch (err) {
            console.error('Failed to toggle auto-refresh:', err)
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

    const handleMoveToFolder = async (searchId: string, folderName: string, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await window.api.updateSavedSearch(searchId, { category: folderName })
            setSearches(prev => prev.map(s => s.id === searchId ? { ...s, category: folderName } : s))
        } catch (err) {
            console.error('Failed to move search:', err)
        }
    }

    const createFolder = async () => {
        if (!newFolderName.trim()) return
        // Folder creation is implicit when moving a search to it
        // Just update the UI state
        setExpandedFolders(prev => new Set([...prev, newFolderName]))
        setNewFolderName('')
        setShowNewFolderInput(false)
    }

    const toggleFolderExpanded = (folder: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev)
            if (newSet.has(folder)) {
                newSet.delete(folder)
            } else {
                newSet.add(folder)
            }
            return newSet
        })
    }

    const filteredSearches = searches.filter(s => {
        if (filter === 'starred') return s.starred
        if (filter === 'templates') return s.isTemplate
        return true
    })

    // Group searches by category (folder)
    const groupedByFolder = useMemo(() => {
        const groups: Record<string, SavedSearch[]> = { 'Unsorted': [] }
        
        filteredSearches.forEach(search => {
            const folder = search.category || 'Unsorted'
            if (!groups[folder]) groups[folder] = []
            groups[folder].push(search)
        })
        
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    }, [filteredSearches])

    const placeholdersFromQuery = (query: string): string[] => {
        const matches = query.match(/\$\{([a-zA-Z0-9_]+)\}/g) || []
        return Array.from(new Set(matches.map((m) => m.slice(2, -1))))
    }

    const runTemplate = (templateQuery: string) => {
        const placeholders = placeholdersFromQuery(templateQuery)
        let finalQuery = templateQuery

        for (const placeholder of placeholders) {
            const value = window.prompt(`Enter value for ${placeholder}`)?.trim()
            if (!value) {
                return
            }
            finalQuery = finalQuery.split(`\${${placeholder}}`).join(value)
        }

        onExecute(finalQuery)
        onClose()
    }

    const installDefaultTemplates = async () => {
        try {
            const existingNames = new Set(searches.map((s) => s.name.toLowerCase()))
            for (const template of BUILTIN_TEMPLATES) {
                if (existingNames.has(template.name.toLowerCase())) continue
                await window.api.createSavedSearch({
                    name: template.name,
                    query: template.query,
                    description: template.description,
                    isTemplate: true,
                    category: template.category,
                    tags: ['template', template.category.toLowerCase()],
                })
            }
            await loadSearches()
        } catch (err) {
            console.error('Failed to install templates:', err)
        }
    }

    const suggestedTemplates = useMemo(
        () => BUILTIN_TEMPLATES.filter((tpl) => !searches.some((s) => s.name.toLowerCase() === tpl.name.toLowerCase())),
        [searches],
    )

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

                {(filter === 'all' || filter === 'templates') && suggestedTemplates.length > 0 && (
                    <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Quick templates</span>
                            <button className="btn-ghost" onClick={() => { void installDefaultTemplates() }}>Install defaults</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {suggestedTemplates.map((template) => (
                                <button
                                    key={template.name}
                                    className="saved-search-item"
                                    onClick={() => runTemplate(template.query)}
                                    style={{ textAlign: 'left', background: 'var(--bg-2)' }}
                                >
                                    <div className="saved-search-info">
                                        <span className="saved-search-name">🧩 {template.name}</span>
                                        <span className="saved-search-query">{template.description}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="saved-searches-list">
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div>
                    ) : filteredSearches.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
                            <div style={{ fontSize: '32px', marginBottom: '16px' }}>📂</div>
                            <div>No saved searches found</div>
                        </div>
                    ) : (
                        <div style={{ padding: '12px 0' }}>
                            {groupedByFolder.map(([folder, folderSearches]) => (
                                <div key={folder}>
                                    <button
                                        onClick={() => toggleFolderExpanded(folder)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 24px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-1)',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                        }}
                                    >
                                        <span style={{ fontSize: '10px' }}>
                                            {expandedFolders.has(folder) ? '▼' : '▶'}
                                        </span>
                                        📁 {folder} ({folderSearches.length})
                                    </button>

                                    {expandedFolders.has(folder) && (
                                        <div style={{ paddingLeft: '8px' }}>
                                            {folderSearches.map(search => (
                                                <div
                                                    key={search.id}
                                                    className="saved-search-item"
                                                    onClick={() => {
                                                        if (search.isTemplate) {
                                                            runTemplate(search.query)
                                                        } else {
                                                            onExecute(search.query)
                                                            onClose()
                                                        }
                                                    }}
                                                    style={{
                                                        marginBottom: '4px',
                                                        marginRight: '12px',
                                                        marginLeft: '12px',
                                                    }}
                                                >
                                                    <div className="saved-search-info">
                                                        <span className="saved-search-name">
                                                            {search.starred && <span style={{ color: '#f59e0b', marginRight: '6px' }}>★</span>}
                                                            {search.name}
                                                        </span>
                                                        {search.autoRefresh?.enabled && (
                                                            <span style={{ fontSize: '11px', color: 'var(--text-3)', marginLeft: '6px' }}>
                                                                🔄 Auto-refresh every {search.autoRefresh.intervalSeconds / 60}m
                                                            </span>
                                                        )}
                                                        <span className="saved-search-query">{search.query}</span>
                                                    </div>
                                                    <div className="saved-search-actions" style={{ display: 'flex', gap: '4px' }}>
                                                        <button
                                                            className="btn-icon"
                                                            onClick={(e) => handleToggleAutoRefresh(search.id, e)}
                                                            title={autoRefreshConfigs[search.id]?.enabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
                                                            style={{ fontSize: '14px' }}
                                                        >
                                                            {autoRefreshConfigs[search.id]?.enabled ? '🔄' : '⏸'}
                                                        </button>
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
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* New Folder Input */}
                            {showNewFolderInput && (
                                <div style={{ padding: '8px 24px', display: 'flex', gap: '4px' }}>
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Folder name..."
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') createFolder()
                                            if (e.key === 'Escape') setShowNewFolderInput(false)
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '4px 8px',
                                            background: 'var(--bg-2)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '4px',
                                            color: 'var(--text-1)',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <button
                                        onClick={createFolder}
                                        style={{
                                            padding: '4px 8px',
                                            background: 'var(--accent)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '11px'
                                        }}
                                    >
                                        Create
                                    </button>
                                    <button
                                        onClick={() => setShowNewFolderInput(false)}
                                        style={{
                                            padding: '4px 8px',
                                            background: 'var(--bg-3)',
                                            color: 'var(--text-1)',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '11px'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="settings-footer">
                    <button className="btn-ghost" onClick={() => setShowNewFolderInput(true)}>+ Folder</button>
                    <button className="btn-ghost" onClick={loadSearches}>Refresh</button>
                    <button className="btn-primary" onClick={onClose}>Done</button>
                </div>
            </motion.div>
        </motion.div>
    )
}
