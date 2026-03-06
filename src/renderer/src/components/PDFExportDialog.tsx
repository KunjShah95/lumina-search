import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Thread } from '../../../main/agents/types'

interface Props {
    thread: Thread
    onClose: () => void
}

export default function PDFExportDialog({ thread, onClose }: Props) {
    const [title, setTitle] = useState(thread.title || 'Search Results')
    const [author, setAuthor] = useState('User')
    const [citationFormat, setCitationFormat] = useState<'apa' | 'mla' | 'chicago' | 'harvard'>('apa')
    const [theme, setTheme] = useState<'light' | 'dark'>('light')
    const [exporting, setExporting] = useState(false)
    const [result, setResult] = useState<{ success: boolean; filePath?: string } | null>(null)

    const handleExport = async () => {
        setExporting(true)
        setResult(null)
        try {
            const res = await window.api.generateAdvancedPDF(thread, {
                title,
                author,
                citationFormat,
                theme
            })
            setResult(res)
        } catch (err) {
            console.error('PDF export failed:', err)
            setResult({ success: false })
        } finally {
            setExporting(false)
        }
    }

    return (
        <motion.div
            className="settings-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e: React.MouseEvent) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                className="pdf-export-dialog"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
            >
                <div className="settings-header">
                    <span className="settings-title">📄 Export to PDF</span>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="pdf-export-body">
                    <div className="settings-group">
                        <label className="settings-label">Document Title</label>
                        <input
                            type="text"
                            className="settings-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="settings-group">
                        <label className="settings-label">Author Name</label>
                        <input
                            type="text"
                            className="settings-input"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                        />
                    </div>

                    <div className="settings-row">
                        <div className="settings-group" style={{ flex: 1 }}>
                            <label className="settings-label">Citation Format</label>
                            <select
                                className="settings-select"
                                value={citationFormat}
                                onChange={(e: any) => setCitationFormat(e.target.value)}
                            >
                                <option value="apa">APA</option>
                                <option value="mla">MLA</option>
                                <option value="chicago">Chicago</option>
                                <option value="harvard">Harvard</option>
                            </select>
                        </div>
                        <div className="settings-group" style={{ flex: 1 }}>
                            <label className="settings-label">PDF Theme</label>
                            <select
                                className="settings-select"
                                value={theme}
                                onChange={(e: any) => setTheme(e.target.value)}
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark (Modern)</option>
                            </select>
                        </div>
                    </div>

                    {result && (
                        <div className={`export-result ${result.success ? 'success' : 'error'}`} style={{
                            padding: '12px',
                            borderRadius: '6px',
                            marginTop: '16px',
                            background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${result.success ? 'var(--accent)' : '#ef4444'}`,
                            fontSize: '13px'
                        }}>
                            {result.success ? (
                                <div style={{ color: 'var(--accent)' }}>
                                    ✓ PDF exported successfully to:<br />
                                    <span style={{ fontSize: '11px', opacity: 0.8 }}>{result.filePath}</span>
                                </div>
                            ) : (
                                <div style={{ color: '#ef4444' }}>✗ Failed to export PDF. Please try again.</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="settings-footer">
                    <button className="btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="btn-primary"
                        onClick={handleExport}
                        disabled={exporting}
                    >
                        {exporting ? 'Generating...' : 'Export PDF'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}
