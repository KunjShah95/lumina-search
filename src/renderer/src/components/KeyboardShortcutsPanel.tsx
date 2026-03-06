import React, { useState, useEffect } from 'react'

interface KeyboardShortcut {
    id: string
    name: string
    description: string
    keys: string[]
    action: string
    enabled: boolean
    default: boolean
}

interface Props {
    onClose: () => void
}

export default function KeyboardShortcutsPanel({ onClose }: Props) {
    const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [recordingKeys, setRecordingKeys] = useState<string | null>(null)

    useEffect(() => {
        // Load default shortcuts
        const defaults: KeyboardShortcut[] = [
            { id: 'focus-search', name: 'Focus Search Bar', description: 'Focus the search input', keys: ['Ctrl', 'K'], action: 'search:focus', enabled: true, default: true },
            { id: 'new-search', name: 'New Search', description: 'Start a new search', keys: ['Ctrl', 'N'], action: 'search:new', enabled: true, default: true },
            { id: 'toggle-window', name: 'Toggle Window', description: 'Show/hide the application window', keys: ['Ctrl', 'Shift', 'Space'], action: 'window:toggle', enabled: true, default: true },
            { id: 'open-settings', name: 'Open Settings', description: 'Open the settings panel', keys: ['Ctrl', ','], action: 'settings:open', enabled: true, default: true },
            { id: 'open-knowledge-base', name: 'Open Knowledge Base', description: 'Open the knowledge base panel', keys: ['Ctrl', 'Shift', 'K'], action: 'knowledge-base:open', enabled: true, default: true },
            { id: 'submit-search', name: 'Submit Search', description: 'Submit the current search query', keys: ['Enter'], action: 'search:submit', enabled: true, default: true },
            { id: 'new-line', name: 'New Line in Search', description: 'Add a new line in search input', keys: ['Shift', 'Enter'], action: 'search:newline', enabled: true, default: true },
            { id: 'cancel-search', name: 'Cancel Search', description: 'Cancel the current search', keys: ['Escape'], action: 'search:cancel', enabled: true, default: true },
            { id: 'toggle-sidebar', name: 'Toggle Sidebar', description: 'Show/hide the sidebar', keys: ['Ctrl', 'B'], action: 'sidebar:toggle', enabled: true, default: true },
        ]
        setShortcuts(defaults)
    }, [])

    const toggleShortcut = (id: string) => {
        setShortcuts(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
    }

    const resetShortcut = (id: string) => {
        const defaultKeys: Record<string, string[]> = {
            'focus-search': ['Ctrl', 'K'],
            'new-search': ['Ctrl', 'N'],
            'toggle-window': ['Ctrl', 'Shift', 'Space'],
            'open-settings': ['Ctrl', ','],
            'open-knowledge-base': ['Ctrl', 'Shift', 'K'],
            'submit-search': ['Enter'],
            'new-line': ['Shift', 'Enter'],
            'cancel-search': ['Escape'],
            'toggle-sidebar': ['Ctrl', 'B'],
        }
        setShortcuts(prev => prev.map(s => s.id === id ? { ...s, keys: defaultKeys[id] || s.keys } : s))
    }

    const resetAll = () => {
        setShortcuts(prev => prev.map(s => {
            const defaultKeys: Record<string, string[]> = {
                'focus-search': ['Ctrl', 'K'],
                'new-search': ['Ctrl', 'N'],
                'toggle-window': ['Ctrl', 'Shift', 'Space'],
                'open-settings': ['Ctrl', ','],
                'open-knowledge-base': ['Ctrl', 'Shift', 'K'],
                'submit-search': ['Enter'],
                'new-line': ['Shift', 'Enter'],
                'cancel-search': ['Escape'],
                'toggle-sidebar': ['Ctrl', 'B'],
            }
            return { ...s, keys: defaultKeys[s.id] || s.keys, enabled: true }
        }))
    }

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="shortcuts-panel" style={{ minWidth: 500 }}>
                <div className="kb-header">
                    <h2 className="kb-title">⌨️ Keyboard Shortcuts</h2>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>
                
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                    <button 
                        className="btn-ghost" 
                        onClick={resetAll}
                        style={{ fontSize: '0.85em' }}
                    >
                        Reset All to Defaults
                    </button>
                </div>

                <div className="shortcuts-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {shortcuts.map((shortcut) => (
                        <div key={shortcut.id} className="shortcut-item" style={{ opacity: shortcut.enabled ? 1 : 0.5 }}>
                            <div className="shortcut-keys">
                                {shortcut.keys.map((key, j) => (
                                    <React.Fragment key={j}>
                                        <kbd className="shortcut-key">{key}</kbd>
                                        {j < shortcut.keys.length - 1 && <span className="shortcut-plus">+</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                            <div style={{ flex: 1, marginLeft: 16 }}>
                                <div style={{ fontWeight: 500, fontSize: '0.9em' }}>{shortcut.name}</div>
                                <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{shortcut.description}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={shortcut.enabled}
                                        onChange={() => toggleShortcut(shortcut.id)}
                                        style={{ margin: 0 }}
                                    />
                                </label>
                                {shortcut.default && (
                                    <button 
                                        className="btn-ghost" 
                                        onClick={() => resetShortcut(shortcut.id)}
                                        style={{ padding: '4px 8px', fontSize: '0.75em' }}
                                        title="Reset to default"
                                    >
                                        ↺
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ padding: 16, borderTop: '1px solid var(--border)', fontSize: '0.8em', color: 'var(--text-muted)' }}>
                    Use Ctrl on Windows/Linux, Cmd on macOS. Shortcuts can be customized per shortcut.
                </div>
            </div>
        </div>
    )
}
