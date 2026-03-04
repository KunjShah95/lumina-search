import React from 'react'

interface Props {
    onClose: () => void
}

const shortcuts = [
    { keys: ['Ctrl/Cmd', 'K'], description: 'Focus search bar' },
    { keys: ['Ctrl/Cmd', 'N'], description: 'New search' },
    { keys: ['Ctrl/Cmd', 'Shift', 'Space'], description: 'Toggle window visibility' },
    { keys: ['Ctrl/Cmd', ','], description: 'Open settings' },
    { keys: ['Ctrl/Cmd', 'K'], description: 'Open knowledge base' },
    { keys: ['Enter'], description: 'Submit search' },
    { keys: ['Shift', 'Enter'], description: 'New line in search' },
    { keys: ['Esc'], description: 'Cancel search / Close panel' },
]

export default function KeyboardShortcutsPanel({ onClose }: Props) {
    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="shortcuts-panel">
                <div className="kb-header">
                    <h2 className="kb-title">⌨️ Keyboard Shortcuts</h2>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>
                <div className="shortcuts-list">
                    {shortcuts.map((shortcut, i) => (
                        <div key={i} className="shortcut-item">
                            <div className="shortcut-keys">
                                {shortcut.keys.map((key, j) => (
                                    <React.Fragment key={j}>
                                        <kbd className="shortcut-key">{key}</kbd>
                                        {j < shortcut.keys.length - 1 && <span className="shortcut-plus">+</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                            <span className="shortcut-desc">{shortcut.description}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
