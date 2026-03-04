import React from 'react'

interface ImageResult {
    url: string
    title: string
    thumbnail: string
    domain: string
    source: string
}

interface Props {
    images: ImageResult[]
}

export default function ImageCards({ images }: Props) {
    if (!images.length) return null

    const openUrl = (url: string) => {
        window.open(url, '_blank')
    }

    return (
        <div className="images-section">
            <div className="sources-label">🖼️ Images</div>
            <div className="image-cards-grid">
                {images.map((img, i) => (
                    <div
                        key={`${img.url}-${i}`}
                        className="image-card"
                        onClick={() => openUrl(img.url)}
                        title={img.title}
                    >
                        <img
                            className="image-thumbnail"
                            src={img.thumbnail}
                            alt={img.title}
                            loading="lazy"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                            }}
                        />
                        <div className="image-title">{img.title}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}
