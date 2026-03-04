import React, { useEffect, useState } from 'react'
import { useCollectionStore } from '../store/collectionStore'

interface Props {
    onClose: () => void
}

export default function CollectionsPanel({ onClose }: Props) {
    const {
        collections,
        activeCollectionId,
        setActiveCollectionId,
        loadCollections,
        createCollection,
        deleteCollection,
    } = useCollectionStore()

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [filterQuery, setFilterQuery] = useState('')

    useEffect(() => {
        loadCollections()
    }, [loadCollections])

    const handleCreate = async () => {
        if (!name.trim()) return
        await createCollection(name.trim(), description.trim(), filterQuery.trim() || undefined)
        setName('')
        setDescription('')
        setFilterQuery('')
    }

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="settings-panel">
                <div className="settings-header">
                    <span className="settings-title">📂 Collections</span>
                    <button className="settings-close" onClick={onClose} aria-label="Close collections">✕</button>
                </div>
                <div className="settings-body">
                    <div className="settings-section">
                        <div className="settings-section-title">New smart collection</div>
                        <div className="settings-field">
                            <label className="settings-label">Name</label>
                            <input
                                className="settings-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Research last 30 days"
                            />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Description (optional)</label>
                            <input
                                className="settings-input"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Short description"
                            />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Filter query</label>
                            <input
                                className="settings-input"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder='Examples: tag:research AND created_at > last_30_days'
                            />
                            <div className="settings-hint">
                                Supported filters: <code>tag:&lt;tag&gt;</code>, <code>created_at &gt; last_30_days</code>.
                                Combine with <code>AND</code>.
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                            <button className="btn-primary" onClick={handleCreate}>
                                Create
                            </button>
                        </div>
                    </div>

                    <div className="settings-section">
                        <div className="settings-section-title">Saved collections</div>
                        {collections.length === 0 && (
                            <div className="empty-state" style={{ padding: 12, fontSize: 13 }}>
                                No collections yet. Create one using the form above.
                            </div>
                        )}
                        {collections.length > 0 && (
                            <div className="scheduled-list">
                                {collections.map(col => (
                                    <div key={col.id} className="scheduled-item">
                                        <div className="scheduled-main">
                                            <div className="scheduled-query">{col.name}</div>
                                            <div className="scheduled-meta">
                                                {col.description || 'Smart collection'}{col.filterQuery ? ` • ${col.filterQuery}` : ''}
                                            </div>
                                        </div>
                                        <div className="scheduled-meta" style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                className={`btn-ghost ${activeCollectionId === col.id ? 'active' : ''}`}
                                                onClick={() =>
                                                    setActiveCollectionId(
                                                        activeCollectionId === col.id ? null : col.id
                                                    )
                                                }
                                            >
                                                {activeCollectionId === col.id ? 'Active' : 'Activate'}
                                            </button>
                                            <button
                                                className="btn-ghost"
                                                onClick={() => deleteCollection(col.id)}
                                            >
                                                Delete
                                            </button>
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

