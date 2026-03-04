import React, { useEffect, useState } from 'react'
import { useHistoryStore } from '../store/historyStore'
import { useSearchStore } from '../store/searchStore'
import { useSearch } from '../hooks/useSearch'
import { Thread } from '../../../main/agents/types'
import { useCollectionStore } from '../store/collectionStore'
import CollectionsPanel from './CollectionsPanel'

interface Props {
    open: boolean
    onNewThread: () => void
}

export default function ThreadSidebar({ open, onNewThread }: Props) {
    const {
        threads,
        activeThreadId, setActiveThreadId, removeThread,
        togglePin, toggleFavorite, searchQuery, setSearchQuery,
        filterFavorites, setFilterFavorites, getFilteredThreads
    } = useHistoryStore()
    const { reset } = useSearchStore()
    const { clearConversation } = useSearch()
    const { collections, activeCollectionId, setActiveCollectionId, loadCollections, filterThreads } = useCollectionStore()
    const [collectionsOpen, setCollectionsOpen] = useState(false)

    useEffect(() => {
        loadCollections()
    }, [loadCollections])

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

    const handleNewThread = () => {
        reset()
        clearConversation()
        setActiveThreadId(null)
        onNewThread()
    }

    const grouped = groupByDate(filteredThreads)

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
                                        onClick={(e) => { e.stopPropagation(); togglePin(thread.id) }}
                                        title={thread.isPinned ? 'Unpin' : 'Pin'}
                                    >
                                        {thread.isPinned ? '📍' : '📌'}
                                    </button>
                                    <button
                                        className="thread-action-btn"
                                        onClick={(e) => { e.stopPropagation(); toggleFavorite(thread.id) }}
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
