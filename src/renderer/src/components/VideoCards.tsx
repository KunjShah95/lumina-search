import React from 'react'

interface VideoResult {
    url: string
    title: string
    thumbnail: string
    channel: string
    duration: string
    views: string
}

interface Props {
    videos: VideoResult[]
}

export default function VideoCards({ videos }: Props) {
    if (!videos.length) return null

    const openUrl = (url: string) => {
        window.open(url, '_blank')
    }

    return (
        <div className="videos-section">
            <div className="sources-label">🎬 Videos</div>
            <div className="video-cards-grid">
                {videos.map((video, i) => (
                    <div
                        key={`${video.url}-${i}`}
                        className="video-card"
                        onClick={() => openUrl(video.url)}
                        title={video.title}
                    >
                        <div className="video-thumbnail-wrap">
                            <img
                                className="video-thumbnail"
                                src={video.thumbnail}
                                alt={video.title}
                                loading="lazy"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                }}
                            />
                            {video.duration && (
                                <span className="video-duration">{video.duration}</span>
                            )}
                        </div>
                        <div className="video-info">
                            <div className="video-title">{video.title}</div>
                            {video.channel && (
                                <div className="video-channel">{video.channel}</div>
                            )}
                            {video.views && (
                                <div className="video-views">{video.views}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
