import React, { useCallback, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useHistoryStore } from '../store/historyStore'

interface Props {
    onClose: () => void
}

export default function NoteEditor({ onClose }: Props) {
    const { threads, activeThreadId, upsertThread } = useHistoryStore()
    const thread = useMemo(
        () => threads.find(t => t.id === activeThreadId) ?? null,
        [threads, activeThreadId],
    )
    const [value, setValue] = useState(thread?.notes ?? '')

    const save = useCallback(() => {
        if (!thread) return
        const updated = { ...thread, notes: value }
        upsertThread(updated)
        window.api.saveThread(updated)
        onClose()
    }, [thread, value, upsertThread, onClose])

    if (!thread) {
        return null
    }

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="note-editor-panel">
                <div className="settings-header">
                    <span className="settings-title">📝 Notes for “{thread.title}”</span>
                    <button className="settings-close" onClick={onClose} aria-label="Close notes editor">✕</button>
                </div>
                <div className="note-editor-body">
                    <div className="note-editor-column">
                        <label className="settings-label">Markdown notes</label>
                        <textarea
                            className="settings-textarea"
                            placeholder="Write notes, summaries, or follow-ups…"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            rows={14}
                        />
                    </div>
                    <div className="note-editor-column note-editor-preview">
                        <div className="note-preview-header">Preview</div>
                        <div className="note-preview-body">
                            {value ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {value}
                                </ReactMarkdown>
                            ) : (
                                <div style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 13 }}>
                                    Notes preview will appear here.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="settings-footer">
                    <button className="btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={save}>Save Notes</button>
                </div>
            </div>
        </div>
    )
}

