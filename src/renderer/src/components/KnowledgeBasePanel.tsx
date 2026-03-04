import React, { useState, useCallback, useRef } from 'react'
import { useKnowledgeBaseStore } from '../store/knowledgeBaseStore'

interface Props {
    onClose: () => void
    onSelectForRAG?: (kbId: string) => void
}

export default function KnowledgeBasePanel({ onClose, onSelectForRAG }: Props) {
    const { knowledgeBases, activeKB, setActiveKB, addKB, removeKB, removeDocument } = useKnowledgeBaseStore()
    const [newKBName, setNewKBName] = useState('')
    const [showNewKB, setShowNewKB] = useState(false)
    const [showAddDoc, setShowAddDoc] = useState(false)
    const [docName, setDocName] = useState('')
    const [docContent, setDocContent] = useState('')
    const [docUrl, setDocUrl] = useState('')
    const [isDragging, setIsDragging] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const loadKBs = useCallback(async () => {
        const kbs = await window.api.getKnowledgeBases()
        useKnowledgeBaseStore.getState().setKnowledgeBases(kbs)
    }, [])

    React.useEffect(() => {
        loadKBs()
    }, [loadKBs])

    const createKB = async () => {
        if (!newKBName.trim()) return
        const kb = await window.api.createKnowledgeBase(newKBName.trim(), '')
        addKB(kb)
        setNewKBName('')
        setShowNewKB(false)
    }

    const deleteKB = async (id: string) => {
        await window.api.deleteKnowledgeBase(id)
        removeKB(id)
    }

    const addDoc = async () => {
        if (!activeKB || !docName.trim() || !docContent.trim()) return
        const doc = await window.api.addDocumentToKB(
            activeKB.id,
            docName.trim(),
            'txt',
            docContent.trim(),
            docUrl.trim() || undefined
        )
        useKnowledgeBaseStore.getState().addDocument(doc)
        setDocName('')
        setDocContent('')
        setDocUrl('')
        setShowAddDoc(false)
    }

    const deleteDoc = async (docId: string) => {
        await window.api.deleteDocument(docId)
        removeDocument(docId)
    }

    // ── Drag-and-Drop File Upload ────────────────────────────

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        if (!activeKB) {
            setUploadStatus({ message: 'Please select a knowledge base first', type: 'error' })
            return
        }

        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return

        await processFiles(files)
    }, [activeKB])

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeKB || !e.target.files) return

        const files = Array.from(e.target.files)
        if (files.length === 0) return

        await processFiles(files)
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = ''
    }, [activeKB])

    const processFiles = async (files: File[]) => {
        if (!activeKB) return

        const supportedExts = ['.pdf', '.txt', '.md', '.doc']
        const validFiles = files.filter(f => {
            const ext = '.' + f.name.split('.').pop()?.toLowerCase()
            return supportedExts.includes(ext)
        })

        if (validFiles.length === 0) {
            setUploadStatus({ message: 'No supported files found. Supported: PDF, TXT, MD, DOC', type: 'error' })
            return
        }

        setIsUploading(true)
        setUploadStatus({ message: `Processing ${validFiles.length} file(s)...`, type: 'info' })

        let successCount = 0
        let errorCount = 0

        try {
            // Electron injects .path into File objects. We map them to an array of paths.
            const filePaths = validFiles.map((f: any) => f.path).filter(Boolean)

            if (filePaths.length > 0) {
                // Use the new backend ingestion API
                const results = await window.api.ingestFiles(filePaths, activeKB.id)
                successCount = results.filter((r: any) => r.success).length
                errorCount = results.filter((r: any) => !r.success).length

                // Log any errors returned from the backend
                results.forEach((r: any) => {
                    if (!r.success) console.error(`Failed to ingest ${r.file}:`, r.error)
                })
            } else {
                setUploadStatus({ message: 'Could not resolve file paths. Are you running in browser?', type: 'error' })
            }
        } catch (err) {
            console.error('Batch ingestion failed:', err)
            errorCount = validFiles.length
        }

        setIsUploading(false)

        if (errorCount === 0) {
            setUploadStatus({
                message: `✅ Successfully added ${successCount} document(s)`,
                type: 'success'
            })
        } else {
            setUploadStatus({
                message: `⚠️ ${successCount} succeeded, ${errorCount} failed`,
                type: 'error'
            })
        }

        // Auto-clear status after 4s
        setTimeout(() => setUploadStatus(null), 4000)

        // Refresh KB list
        await loadKBs()
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const getDocIcon = (type: string) => {
        switch (type) {
            case 'pdf': return '📄'
            case 'md': return '📝'
            case 'doc': return '📃'
            case 'url': return '🔗'
            default: return '📄'
        }
    }

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="kb-panel">
                <div className="kb-header">
                    <h2 className="kb-title">📚 Knowledge Base</h2>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="kb-content">
                    <div className="kb-sidebar">
                        <div className="kb-section-title">Your Knowledge Bases</div>

                        <button className="kb-new-btn" onClick={() => setShowNewKB(true)}>
                            + New Knowledge Base
                        </button>

                        {showNewKB && (
                            <div className="kb-new-form">
                                <input
                                    className="settings-input"
                                    placeholder="Knowledge base name..."
                                    value={newKBName}
                                    onChange={(e) => setNewKBName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && createKB()}
                                />
                                <div className="kb-new-actions">
                                    <button className="btn-ghost" onClick={() => setShowNewKB(false)}>Cancel</button>
                                    <button className="btn-primary" onClick={createKB}>Create</button>
                                </div>
                            </div>
                        )}

                        <div className="kb-list">
                            {knowledgeBases.map(kb => (
                                <div
                                    key={kb.id}
                                    className={`kb-item ${activeKB?.id === kb.id ? 'active' : ''}`}
                                    onClick={() => setActiveKB(kb)}
                                >
                                    <div className="kb-item-name">{kb.name}</div>
                                    <div className="kb-item-meta">{kb.documents.length} documents</div>
                                    <button
                                        className="kb-delete-btn"
                                        onClick={(e) => { e.stopPropagation(); deleteKB(kb.id) }}
                                    >🗑️</button>
                                </div>
                            ))}
                            {knowledgeBases.length === 0 && (
                                <div className="kb-empty">No knowledge bases yet</div>
                            )}
                        </div>
                    </div>

                    <div className="kb-main">
                        {activeKB ? (
                            <>
                                <div className="kb-doc-header">
                                    <h3>{activeKB.name}</h3>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="btn-ghost"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            📁 Browse Files
                                        </button>
                                        <button className="btn-primary" onClick={() => setShowAddDoc(true)}>
                                            + Add Document
                                        </button>
                                    </div>
                                </div>

                                {/* Hidden file input */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.txt,.md,.doc"
                                    style={{ display: 'none' }}
                                    onChange={handleFileSelect}
                                />

                                {/* Upload status */}
                                {uploadStatus && (
                                    <div className={`kb-upload-status kb-upload-status--${uploadStatus.type}`}>
                                        {isUploading && <span className="kb-upload-spinner" />}
                                        {uploadStatus.message}
                                    </div>
                                )}

                                {/* Drag-and-drop zone */}
                                <div
                                    className={`kb-dropzone ${isDragging ? 'kb-dropzone--active' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <div className="kb-dropzone-icon">{isDragging ? '📥' : '📎'}</div>
                                    <div className="kb-dropzone-text">
                                        {isDragging
                                            ? 'Drop files here to upload'
                                            : 'Drag & drop PDF, TXT, or MD files here'}
                                    </div>
                                    <div className="kb-dropzone-hint">
                                        Supported formats: .pdf, .txt, .md, .doc
                                    </div>
                                </div>

                                {showAddDoc && (
                                    <div className="kb-add-doc-form">
                                        <input
                                            className="settings-input"
                                            placeholder="Document name..."
                                            value={docName}
                                            onChange={(e) => setDocName(e.target.value)}
                                        />
                                        <textarea
                                            className="settings-textarea"
                                            placeholder="Paste content or notes here..."
                                            value={docContent}
                                            onChange={(e) => setDocContent(e.target.value)}
                                            rows={6}
                                        />
                                        <input
                                            className="settings-input"
                                            placeholder="Source URL (optional)..."
                                            value={docUrl}
                                            onChange={(e) => setDocUrl(e.target.value)}
                                        />
                                        <div className="kb-new-actions">
                                            <button className="btn-ghost" onClick={() => setShowAddDoc(false)}>Cancel</button>
                                            <button className="btn-primary" onClick={addDoc}>Add Document</button>
                                        </div>
                                    </div>
                                )}

                                <div className="kb-documents">
                                    {activeKB.documents.map(doc => (
                                        <div key={doc.id} className="kb-doc-item">
                                            <div className="kb-doc-info">
                                                <div className="kb-doc-name">
                                                    {getDocIcon(doc.type)} {doc.name}
                                                </div>
                                                <div className="kb-doc-meta">
                                                    {formatSize(doc.size)} • {new Date(doc.createdAt).toLocaleDateString()}
                                                    {doc.sourceUrl && <a href={doc.sourceUrl} target="_blank" rel="noopener"> • Source</a>}
                                                </div>
                                            </div>
                                            <div className="kb-doc-actions">
                                                <button
                                                    className="kb-use-btn"
                                                    onClick={() => onSelectForRAG?.(activeKB.id)}
                                                    title="Use in search"
                                                >🔍</button>
                                                <button
                                                    className="kb-delete-btn"
                                                    onClick={() => deleteDoc(doc.id)}
                                                >🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                    {activeKB.documents.length === 0 && (
                                        <div className="kb-empty">No documents in this knowledge base</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="kb-empty-state">
                                <div className="kb-empty-icon">📚</div>
                                <p>Select a knowledge base or create a new one</p>
                                <p className="kb-empty-hint">Knowledge bases let you store documents and use them as context for AI answers (RAG)</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
