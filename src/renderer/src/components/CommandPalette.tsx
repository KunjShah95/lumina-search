import React, { useEffect, useMemo, useState } from 'react'
import { useHistoryStore } from '../store/historyStore'
import { useSearchStore } from '../store/searchStore'
import { useSettingsStore } from '../store/settingsStore'

interface Props {
    onClose: () => void
    openSettings: () => void
    openKB: () => void
    openBookmarks: () => void
    openAnalytics: () => void
}

interface Command {
    id: string
    label: string
    group: string
    run: () => void
}

export default function CommandPalette({ onClose, openSettings, openKB, openBookmarks, openAnalytics }: Props) {
    const [query, setQuery] = useState('')
    const { threads, setActiveThreadId } = useHistoryStore()
    const { setFocusMode } = useSearchStore()
    const { settings, setSettings } = useSettingsStore()

    const commands = useMemo<Command[]>(() => {
        const base: Command[] = [
            {
                id: 'new-search',
                label: 'New search',
                group: 'General',
                run: () => {
                    useHistoryStore.getState().setActiveThreadId(null)
                    onClose()
                },
            },
            {
                id: 'open-settings',
                label: 'Open settings',
                group: 'General',
                run: () => {
                    openSettings()
                    onClose()
                },
            },
            {
                id: 'open-kb',
                label: 'Open knowledge base',
                group: 'Knowledge',
                run: () => {
                    openKB()
                    onClose()
                },
            },
            {
                id: 'open-bookmarks',
                label: 'Open bookmarks',
                group: 'Knowledge',
                run: () => {
                    openBookmarks()
                    onClose()
                },
            },
            {
                id: 'toggle-theme',
                label: `Toggle theme (currently ${settings.theme})`,
                group: 'Appearance',
                run: () => {
                    const next = settings.theme === 'dark' ? 'light' : settings.theme === 'light' ? 'system' : 'dark'
                    const updated = { ...settings, theme: next }
                    setSettings(updated)
                    window.api.setSettings(updated)
                    onClose()
                },
            },
            {
                id: 'open-analytics',
                label: 'Open analytics dashboard',
                group: 'Insights',
                run: () => {
                    openAnalytics()
                    onClose()
                },
            },
            {
                id: 'focus-web',
                label: 'Set focus mode: Web',
                group: 'Focus mode',
                run: () => {
                    setFocusMode('web')
                    onClose()
                },
            },
            {
                id: 'focus-local',
                label: 'Set focus mode: Local documents',
                group: 'Focus mode',
                run: () => {
                    setFocusMode('local')
                    onClose()
                },
            },
            {
                id: 'focus-all',
                label: 'Set focus mode: Hybrid (All)',
                group: 'Focus mode',
                run: () => {
                    setFocusMode('all')
                    onClose()
                },
            },
        ]

        const threadCommands: Command[] = threads.slice(0, 20).map(t => ({
            id: `thread-${t.id}`,
            label: `Open conversation: ${t.title}`,
            group: 'Conversations',
            run: () => {
                setActiveThreadId(t.id)
                onClose()
            },
        }))

        return [...base, ...threadCommands]
    }, [threads, onClose, openSettings, openKB, openBookmarks, openAnalytics, settings, setSettings, setFocusMode, setActiveThreadId])

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim()
        if (!q) return commands
        return commands
            .map(cmd => {
                const hay = `${cmd.label} ${cmd.group}`.toLowerCase()
                const score = hay.includes(q) ? 1 : 0
                return { cmd, score }
            })
            .filter(({ score }) => score > 0)
            .map(({ cmd }) => cmd)
    }, [commands, query])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="shortcuts-panel command-palette">
                <div className="kb-header">
                    <h2 className="kb-title">⌘ Command Palette</h2>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>
                <div className="command-palette-body">
                    <input
                        autoFocus
                        className="settings-input"
                        placeholder="Type a command or search conversations..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="command-list">
                        {filtered.length === 0 && (
                            <div className="empty-state" style={{ padding: 16, fontSize: 13 }}>
                                No matching commands.
                            </div>
                        )}
                        {filtered.map(cmd => (
                            <button
                                key={cmd.id}
                                className="command-item"
                                onClick={cmd.run}
                            >
                                <span className="command-label">{cmd.label}</span>
                                <span className="command-group">{cmd.group}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

