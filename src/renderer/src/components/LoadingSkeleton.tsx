import React from 'react'

export default function LoadingSkeleton() {
    return (
        <div className="skeleton-container">
            <div className="skeleton-card">
                <div className="skeleton-line skeleton-title"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line skeleton-short"></div>
            </div>
            <div className="skeleton-card">
                <div className="skeleton-line skeleton-title"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line skeleton-short"></div>
            </div>
            <div className="skeleton-card">
                <div className="skeleton-line skeleton-title"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line skeleton-short"></div>
            </div>
        </div>
    )
}
