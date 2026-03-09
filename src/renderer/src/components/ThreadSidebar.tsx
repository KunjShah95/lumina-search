import React, { useEffect, useState } from 'react'
import { useHistoryStore } from '../store/historyStore'
import { useSearchStore } from '../store/searchStore'
import { useSearch } from '../hooks/useSearch'
import { Thread } from '../../../main/agents/types'
import { useCollectionStore } from '../store/collectionStore'
import CollectionsPanel from './CollectionsPanel'
import { decodeShareInput, looksLikeShareInput } from '../utils/shareCode'

interface Props {
    open: boolean
    onNewThread: () => void
    onOpenAnalytics: () => void
}

export default function ThreadSidebar({ open, onNewThread }: Props) {
    const {
        threads,
        activeThreadId, setActiveThreadId, removeThread,
        togglePin, toggleFavorite, searchQuery, setSearchQuery,
        filterFavorites, setFilterFavorites, getFilteredThreads
    } = useHistoryStore()
    const { reset } = useSearchStore()
    const { clearConversation, runSearch } = useSearch()
    const { collections, activeCollectionId, setActiveCollectionId, loadCollections, filterThreads } = useCollectionStore()
    const [collectionsOpen, setCollectionsOpen] = useState(false)
    const [pinnedSearches, setPinnedSearches] = useState<any[]>([])
    const [loadingSearches, setLoadingSearches] = useState(false)

    useEffect(() => {
        loadCollections()
        loadPinnedSearches()
    }, [loadCollections])

    const loadPinnedSearches = async () => {
        setLoadingSearches(true)
        try {
            const searches = await window.api.listSavedSearches({ })
            const pinned = searches.filter((s: any) => s.starred && !s.isTemplate)
            setPinnedSearches(pinned)
        } catch (err) {
            console.error('Failed to load pinned searches:', err)
        } finally {
            setLoadingSearches(false)
        }
    }

    const executePinnedSearch = (query: string) => {
        runSearch(query)
    }

    const baseThreads = getFilteredThreads()
    const filteredThreads = filterThreads(baseThreads)

    const loadThread = (thread: Thread) => {
        setActiveThreadId(thread.id)
    }

    const deleteThread = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        removeThread(id)
        await window.api.deleteThread(id)
    }

    const clearAll = async () => {
        await window.api.clearHistory()
        useHistoryStore.setState({ threads: [], activeThreadId: null })
    }

    const importShareCode = async () => {
        const raw = window.prompt('Paste a Lumina share code or link')
        if (!raw) return

        if (!looksLikeShareInput(raw)) {
            alert('That does not look like a valid Lumina share code.')
            return
        }

        try {
            const imported = decodeShareInput(raw)
            useHistoryStore.getState().upsertThread(imported)
            useHistoryStore.getState().setActiveThreadId(imported.id)
            await window.api.saveThread(imported)
            alert('✅ Shared thread imported successfully.')
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to import share code.')
        }
    }

    const handleNewThread = () => {
        reset()
        clearConversation()
        setActiveThreadId(null)
        onNewThread()
    }

    const grouped = groupByDate(filteredThreads)
    const favoriteThreads = filteredThreads.filter((t) => t.isFavorite)

    const persistThreadMutation = async (threadId: string, mutate: (thread: Thread) => Thread) => {
        const thread = threads.find((t) => t.id === threadId)
        if (!thread) return
        const updated = mutate(thread)
        await window.api.saveThread(updated)
    }

    const handleTogglePin = async (e: React.MouseEvent, thread: Thread) => {
        e.stopPropagation()
        togglePin(thread.id)
        await persistThreadMutation(thread.id, (t) => ({ ...t, isPinned: !t.isPinned }))
    }

    const handleToggleFavorite = async (e: React.MouseEvent, thread: Thread) => {
        e.stopPropagation()
        toggleFavorite(thread.id)
        await persistThreadMutation(thread.id, (t) => ({ ...t, isFavorite: !t.isFavorite }))
    }

    const exportFavorites = (format: 'json' | 'csv') => {
        const favorites = threads.filter((t) => t.isFavorite)
        if (favorites.length === 0) return

        let content = ''
        let mime = 'application/json'
        let ext = 'json'

        if (format === 'json') {
            content = JSON.stringify(
                favorites.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, tags: t.tags ?? [] })),
                null,
                2,
            )
        } else {
            mime = 'text/csv;charset=utf-8'
            ext = 'csv'
            const header = 'id,title,updatedAt,tags'
            const rows = favorites.map((t) => {
                const safeTitle = `"${t.title.replace(/"/g, '""')}"`
                const safeTags = `"${(t.tags ?? []).join('|').replace(/"/g, '""')}"`
                return `${t.id},${safeTitle},${new Date(t.updatedAt).toISOString()},${safeTags}`
            })
            content = [header, ...rows].join('\n')
        }

        const blob = new Blob([content], { type: mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `lumina-favorites.${ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`sidebar ${open ? '' : 'closed'}`} role="navigation" aria-label="Conversation history">
            <div className="sidebar-header">
                <div className="sidebar-brand">
                    <div className="logo-icon">✦</div>
                    Lumina Search
                </div>
            </div>

            <button className="new-thread-btn" onClick={handleNewThread}>
                + New Search
            </button>

            {/* Search & Filter */}
            <div className="sidebar-search">
                <input
                    type="text"
                    className="sidebar-search-input"
                    placeholder="Search threads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                    className={`sidebar-filter-btn ${filterFavorites ? 'active' : ''}`}
                    onClick={() => setFilterFavorites(!filterFavorites)}
                    title="Filter favorites"
                >
                    ⭐
                </button>
            </div>

            {/* Collections selector */}
            <div className="sidebar-collections-row">
                <select
                    className="sidebar-collections-select"
                    value={activeCollectionId ?? ''}
                    onChange={(e) => {
                        const val = e.target.value || null
                        setActiveCollectionId(val)
                    }}
                >
                    <option value="">All conversations</option>
                    {collections.map(col => (
                        <option key={col.id} value={col.id}>
                            {col.name}
                        </option>
                    ))}
                </select>
                <button
                    className="sidebar-filter-btn"
                    onClick={() => setCollectionsOpen(true)}
                    title="Manage collections"
                >
                    📂
                </button>
            </div>

            <div className="sidebar-threads">
                {/* Pinned Saved Searches */}
                {pinnedSearches.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                        <div className="sidebar-section-label">📌 Pinned Searches</div>
                        {pinnedSearches.map(search => (
                            <div
                                key={search.id}
                                className="thread-item"
                                onClick={() => executePinnedSearch(search.query)}
                                style={{ cursor: 'pointer' }}
                            >
                                <span className="thread-item-icons">
                                    <span style={{ fontSize: '12px' }}>⭐</span>
                                </span>
                                <span className="thread-item-title" style={{ fontSize: '12px' }}>
                                    {search.name}
                                </span>
                                <div className="thread-item-actions">
                                    <button
                                        className="thread-delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            window.api.toggleSavedSearchStar(search.id).then(() => loadPinnedSearches())
                                        }}
                                        title="Unpin"
                                    >✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {favoriteThreads.length > 0 && !filterFavorites && !searchQuery.trim() && (
                    <div>
                        <div className="sidebar-section-label">Favorites</div>
                        {favoriteThreads.slice(0, 5).map(thread => (
                            <div
                                key={`fav-${thread.id}`}
                                className={`thread-item ${activeThreadId === thread.id ? 'active' : ''}`}
                                onClick={() => loadThread(thread)}
                            >
                                <span className="thread-item-icons">
                                    <span className="thread-icon-fav" title="Favorite">⭐</span>
                                </span>
                                <span className="thread-item-title">{thread.title}</span>
                            </div>
                        ))}
                    </div>
                )}

                {Object.entries(grouped).map(([label, ts]) => (
                    <div key={label}>
                        <div className="sidebar-section-label">{label}</div>
                        {ts.map(thread => (
                            <div
                                key={thread.id}
                                className={`thread-item ${activeThreadId === thread.id ? 'active' : ''} ${thread.isPinned ? 'pinned' : ''}`}
                                onClick={() => loadThread(thread)}
                            >
                                <span className="thread-item-icons">
                                    {thread.isPinned && <span className="thread-icon-pin" title="Pinned">📌</span>}
                                    {thread.isFavorite && <span className="thread-icon-fav" title="Favorite">⭐</span>}
                                    {!thread.isPinned && !thread.isFavorite && <span className="thread-item-icon">◎</span>}
                                </span>
                                <span className="thread-item-title">{thread.title}</span>
                                <div className="thread-item-actions">
                                    <button
                                        className="thread-action-btn"
                                        onClick={(e) => { void handleTogglePin(e, thread) }}
                                        title={thread.isPinned ? 'Unpin' : 'Pin'}
                                    >
                                        {thread.isPinned ? '📍' : '📌'}
                                    </button>
                                    <button
                                        className="thread-action-btn"
                                        onClick={(e) => { void handleToggleFavorite(e, thread) }}
                                        title={thread.isFavorite ? 'Unfavorite' : 'Favorite'}
                                    >
                                        {thread.isFavorite ? '★' : '☆'}
                                    </button>
                                    <button
                                        className="thread-delete-btn"
                                        onClick={(e) => deleteThread(e, thread.id)}
                                        title="Delete thread"
                                    >✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
                {filteredThreads.length === 0 && threads.length > 0 && (
                    <div className="empty-state" style={{ padding: '40px 16px', fontSize: 13 }}>
                        No threads match your search.
                    </div>
                )}
                {threads.length === 0 && (
                    <div className="empty-state" style={{ padding: '40px 16px', fontSize: 13 }}>
                        No history yet.<br />Start searching!
                    </div>
                )}
            </div>

            {threads.length > 0 && (
                <div className="sidebar-footer">
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <button className="clear-history-btn" onClick={() => { void importShareCode() }}>
                            Import share code
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <button className="clear-history-btn" onClick={() => exportFavorites('json')}>
                            Export favorites JSON
                        </button>
                        <button className="clear-history-btn" onClick={() => exportFavorites('csv')}>
                            Export CSV
                        </button>
                    </div>
                    <button className="clear-history-btn" onClick={clearAll}>
                        Clear all history
                    </button>
                </div>
            )}

            {collectionsOpen && <CollectionsPanel onClose={() => setCollectionsOpen(false)} />}
        </div>
    )
}

function groupByDate(threads: Thread[]): Record<string, Thread[]> {
    const now = Date.now()
    const DAY = 86400000
    const groups: Record<string, Thread[]> = {}

    for (const t of threads) {
        const diff = now - t.updatedAt
        let label = 'Older'
        if (diff < DAY) label = 'Today'
        else if (diff < 2 * DAY) label = 'Yesterday'
        else if (diff < 7 * DAY) label = 'This week'
        else if (diff < 30 * DAY) label = 'This month'
            ; (groups[label] ??= []).push(t)
    }
    return groups
}
