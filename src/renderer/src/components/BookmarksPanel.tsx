import React from 'react'
import { useBookmarkStore } from '../store/bookmarkStore'

interface Props {
    onClose: () => void
}

export default function BookmarksPanel({ onClose }: Props) {
    const { bookmarks, removeBookmark, clearBookmarks } = useBookmarkStore()

    const openUrl = (url: string) => {
        window.open(url, '_blank')
    }

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bookmarks-panel">
                <div className="kb-header">
                    <h2 className="kb-title">⭐ Bookmarked Sources</h2>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>
                <div className="bookmarks-content">
                    {bookmarks.length === 0 ? (
                        <div className="kb-empty-state">
                            <div className="kb-empty-icon">⭐</div>
                            <p>No bookmarked sources yet</p>
                            <p className="kb-empty-hint">Click the star icon on sources to save them for later</p>
                        </div>
                    ) : (
                        <>
                            <div className="bookmarks-actions">
                                <button className="btn-ghost" onClick={clearBookmarks}>
                                    Clear All
                                </button>
                            </div>
                            <div className="bookmarks-list">
                                {bookmarks.map((source, i) => (
                                    <div key={i} className="bookmark-item">
                                        <div className="bookmark-info" onClick={() => openUrl(source.url)}>
                                            <div className="bookmark-title">{source.title}</div>
                                            <div className="bookmark-domain">{source.domain}</div>
                                        </div>
                                        <div className="bookmark-actions">
                                            <button 
                                                className="source-bookmark-btn bookmarked"
                                                onClick={() => removeBookmark(source.url)}
                                                title="Remove bookmark"
                                            >
                                                ★
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
