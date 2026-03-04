import React from 'react'
import { useSearchStore } from '../store/searchStore'
import { useBookmarkStore } from '../store/bookmarkStore'

export default function SourceCards() {
    const { sources, activeSource, setActiveSource } = useSearchStore()
    const { bookmarks, addBookmark, removeBookmark, isBookmarked } = useBookmarkStore()
    
    if (!sources.length) return null

    const openUrl = (url: string) => {
        window.open(url, '_blank')
    }

    const toggleBookmark = (e: React.MouseEvent, source: typeof sources[0]) => {
        e.stopPropagation()
        if (isBookmarked(source.url)) {
            removeBookmark(source.url)
        } else {
            addBookmark({
                url: source.url,
                title: source.title,
                snippet: source.snippet,
                domain: source.domain,
            })
        }
    }

    return (
        <div className="sources-section">
            <div className="sources-label">
                📎 Sources
                {bookmarks.length > 0 && <span className="bookmark-count">({bookmarks.length} saved)</span>}
            </div>
            <div className="source-cards-row">
                {sources.map((source, i) => (
                    <div
                        key={`${source.url}-${i}`}
                        data-source-index={i + 1}
                        className={`source-card ${activeSource === i + 1 ? 'active' : ''}`}
                        onClick={() => openUrl(source.url)}
                        onMouseEnter={() => setActiveSource(i + 1)}
                        onMouseLeave={() => setActiveSource(null)}
                        title={source.title}
                    >
                        <div className="source-card-header">
                            <img
                                className="source-favicon"
                                src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=32`}
                                alt={source.domain}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                            <span className="source-domain">{source.domain}</span>
                            <span className="source-num">[{i + 1}]</span>
                            <button 
                                className={`source-bookmark-btn ${isBookmarked(source.url) ? 'bookmarked' : ''}`}
                                onClick={(e) => toggleBookmark(e, source)}
                                title={isBookmarked(source.url) ? 'Remove bookmark' : 'Bookmark'}
                            >
                                {isBookmarked(source.url) ? '★' : '☆'}
                            </button>
                        </div>
                        <div className="source-title">{source.title}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}
