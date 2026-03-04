import React from 'react'
import { useSearchStore } from '../store/searchStore'
import { FocusMode } from '../../../main/agents/types'

const MODES: { id: FocusMode; label: string; icon: string }[] = [
    { id: 'web', label: 'Web', icon: '🌐' },
    { id: 'image', label: 'Images', icon: '🖼️' },
    { id: 'video', label: 'Videos', icon: '🎬' },
    { id: 'academic', label: 'Academic', icon: '📚' },
    { id: 'code', label: 'Code', icon: '💻' },
    { id: 'reddit', label: 'Reddit', icon: '🗣️' },
    { id: 'hybrid-rag', label: 'Hybrid RAG', icon: '🧠' },
]

export default function FocusModes() {
    const { focusMode, setFocusMode } = useSearchStore()
    return (
        <div className="focus-modes">
            {MODES.map(m => (
                <button
                    key={m.id}
                    className={`focus-btn ${focusMode === m.id ? 'active' : ''}`}
                    onClick={() => setFocusMode(m.id)}
                >
                    <span>{m.icon}</span>
                    {m.label}
                </button>
            ))}
        </div>
    )
}
