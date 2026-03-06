import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useSearchStore } from '../store/searchStore'
import { useSearch } from '../hooks/useSearch'
import { useKnowledgeBaseStore } from '../store/knowledgeBaseStore'
import { AnimatePresence } from 'framer-motion'
import SearchOperatorsGuide from './SearchOperatorsGuide'

interface ParsedSearchQuery {
    baseQuery: string
    operators: {
        sites?: string[]
        fileTypes?: string[]
        dateRange?: { start: Date; end: Date }
        languages?: string[]
        sources?: string[]
        excludeTerms?: string[]
        exactPhrase?: string
    }
}

interface Props { isInline?: boolean; placeholder?: string }

export default function SearchBar({ isInline = false, placeholder }: Props) {
    const [value, setValue] = useState('')
    const [showKBPicker, setShowKBPicker] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const [showOperators, setShowOperators] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const kbPickerRef = useRef<HTMLDivElement>(null)
    const recognitionRef = useRef<any>(null)
    const { isStreaming, phase, focusMode, setFocusMode, setFilters } = useSearchStore()
    const { runSearch, cancelSearch } = useSearch()
    const { activeKB, knowledgeBases, selectedKBIds, toggleKBSelection, selectAllKBs, clearKBSelection } = useKnowledgeBaseStore()

    const parseSearchOperators = useCallback((query: string): ParsedSearchQuery => {
        const result: ParsedSearchQuery = {
            baseQuery: query,
            operators: {},
        }

        const siteMatch = query.match(/site:([^\s]+)/gi)
        if (siteMatch) {
            result.operators.sites = siteMatch.map(s => s.replace(/site:/gi, ''))
        }

        const filetypeMatch = query.match(/filetype:([^\s]+)/gi)
        if (filetypeMatch) {
            result.operators.fileTypes = filetypeMatch.map(f => f.replace(/filetype:/gi, ''))
        }

        const langMatch = query.match(/language:([^\s,]+)/gi)
        if (langMatch) {
            result.operators.languages = langMatch.map(l => l.replace(/language:/gi, ''))
        }

        const sourceMatch = query.match(/source:([^\s,]+)/gi)
        if (sourceMatch) {
            result.operators.sources = sourceMatch.map(s => s.replace(/source:/gi, ''))
        }

        const excludeMatches = query.match(/!(\S+)/g)
        if (excludeMatches) {
            result.operators.excludeTerms = excludeMatches.map(e => e.substring(1))
        }

        const quotedMatch = query.match(/"([^"]+)"/g)
        if (quotedMatch) {
            result.operators.exactPhrase = quotedMatch.map(q => q.replace(/"/g, '')).join(' ')
        }

        let cleanQuery = query
            .replace(/site:[^\s]+/gi, '')
            .replace(/filetype:[^\s]+/gi, '')
            .replace(/language:[^\s,]+/gi, '')
            .replace(/source:[^\s,]+/gi, '')
            .replace(/!(\S+)/g, '')
            .replace(/"([^"]+)"/g, '')
            .replace(/\s+/g, ' ')
            .trim()

        result.baseQuery = cleanQuery

        return result
    }, [])

    const handleSubmit = useCallback(() => {
        const q = value.trim()
        if (!q || isStreaming) return

        const parsed = parseSearchOperators(q)

        if (parsed.operators.sites?.length) {
            setFilters({ domain: parsed.operators.sites[0] })
        }

        runSearch(parsed.baseQuery)
        if (!isInline) setValue('')
    }, [value, isStreaming, runSearch, isInline, parseSearchOperators, setFilters])

    const startVoiceInput = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
            alert('Voice input is not supported in this browser')
            return
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onstart = () => setIsListening(true)
        recognition.onresult = (event: any) => {
            let transcript = ''
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript
            }
            setValue(transcript)
        }
        recognition.onerror = () => setIsListening(false)
        recognition.onend = () => setIsListening(false)

        recognition.start()
        recognitionRef.current = recognition
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    const toggleFocusMode = (mode: 'local' | 'web' | 'all') => {
        if (mode === 'local' && !activeKB) {
            return;
        }
        if (mode === 'all') {
            if (selectedKBIds.length === 0 && knowledgeBases.length > 0) {
                selectAllKBs()
            }
        }
        setFocusMode(mode);
    }

    const insertOperator = (syntax: string) => {
        setValue(prev => {
            const trimmed = prev.trim()
            return trimmed ? `${trimmed} ${syntax}` : syntax
        })
        setShowOperators(false)
        textareaRef.current?.focus()
    }

    // Close KB picker on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (kbPickerRef.current && !kbPickerRef.current.contains(e.target as Node)) {
                setShowKBPicker(false)
            }
        }
        if (showKBPicker) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showKBPicker])

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }, [value])

    // Global shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                textareaRef.current?.focus()
            }
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                if (e.key === '1') {
                    e.preventDefault();
                    toggleFocusMode('web');
                } else if (e.key === '2') {
                    e.preventDefault();
                    toggleFocusMode('local');
                } else if (e.key === '3') {
                    e.preventDefault();
                    toggleFocusMode('all');
                }
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const selectedCount = selectedKBIds.length
    const totalDocs = knowledgeBases
        .filter(kb => selectedKBIds.includes(kb.id))
        .reduce((sum, kb) => sum + kb.documents.length, 0)

    return (
        <div className={`search-container ${isInline ? 'search-inline-wrap' : ''}`} style={isInline ? { maxWidth: '100%', padding: 0 } : {}}>
            <AnimatePresence>
                {showOperators && (
                    <div className="operators-guide-popover">
                        <SearchOperatorsGuide
                            onClose={() => setShowOperators(false)}
                            onSelectOperator={insertOperator}
                        />
                    </div>
                )}
            </AnimatePresence>

            <div className="search-box">
                {!isInline && (
                    <div className="focus-mode-toggle">
                        <button
                            className={`focus-btn ${focusMode === 'local' ? 'active' : ''}`}
                            onClick={() => toggleFocusMode('local')}
                            title={activeKB ? `Search in: ${activeKB.name}` : 'Select a knowledge base first'}
                            disabled={!activeKB}
                        >
                            📄 Local
                        </button>
                        <button
                            className={`focus-btn ${focusMode === 'web' ? 'active' : ''}`}
                            onClick={() => toggleFocusMode('web')}
                        >
                            🌐 Web
                        </button>
                        <div className="kb-picker-wrapper" ref={kbPickerRef}>
                            <button
                                className={`focus-btn ${focusMode === 'all' ? 'active' : ''}`}
                                onClick={() => {
                                    toggleFocusMode('all')
                                    if (focusMode === 'all') {
                                        setShowKBPicker(!showKBPicker)
                                    } else {
                                        setShowKBPicker(true)
                                    }
                                }}
                                disabled={knowledgeBases.length === 0}
                                title={knowledgeBases.length === 0 ? 'Create knowledge bases first' : `Search across ${selectedCount || 'all'} knowledge bases`}
                            >
                                🔍 All KBs
                                {selectedCount > 0 && focusMode === 'all' && (
                                    <span className="kb-count-badge">{selectedCount}</span>
                                )}
                            </button>

                            {showKBPicker && (
                                <div className="kb-picker-dropdown">
                                    <div className="kb-picker-header">
                                        <span className="kb-picker-title">Select Knowledge Bases</span>
                                        <div className="kb-picker-actions">
                                            <button className="kb-picker-action-btn" onClick={selectAllKBs}>Select All</button>
                                            <button className="kb-picker-action-btn" onClick={clearKBSelection}>Clear</button>
                                        </div>
                                    </div>
                                    <div className="kb-picker-list">
                                        {knowledgeBases.map(kb => (
                                            <label key={kb.id} className={`kb-picker-item ${selectedKBIds.includes(kb.id) ? 'selected' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedKBIds.includes(kb.id)}
                                                    onChange={() => toggleKBSelection(kb.id)}
                                                    className="kb-picker-checkbox"
                                                />
                                                <div className="kb-picker-item-info">
                                                    <span className="kb-picker-item-name">{kb.name}</span>
                                                    <span className="kb-picker-item-meta">{kb.documents.length} docs</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {selectedCount > 0 && (
                                        <div className="kb-picker-footer">
                                            {selectedCount} KB{selectedCount !== 1 ? 's' : ''} selected · {totalDocs} document{totalDocs !== 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="search-input-row">
                    <button
                        className={`action-btn ${showOperators ? 'active' : ''}`}
                        onClick={() => setShowOperators(!showOperators)}
                        title="Search Operators Guide"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                    >
                        ⚡
                    </button>
                    <button
                        className={`voice-input-btn ${isListening ? 'listening' : ''}`}
                        onClick={isListening ? () => recognitionRef.current?.stop() : startVoiceInput}
                        title={isListening ? 'Stop listening' : 'Voice input'}
                    >
                        {isListening ? '⏺' : '🎤'}
                    </button>
                    <span className="search-icon">⌕</span>
                    <textarea
                        ref={textareaRef}
                        className="search-input"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            focusMode === 'all' && selectedCount > 0
                                ? `Search across ${selectedCount} knowledge base${selectedCount !== 1 ? 's' : ''}...`
                                : placeholder ?? 'Ask anything...'
                        }
                        rows={1}
                        autoFocus={!isInline}
                    />
                    {isStreaming ? (
                        <button className="search-submit" onClick={cancelSearch} title="Stop">◼</button>
                    ) : (
                        <button className="search-submit" onClick={handleSubmit} disabled={!value.trim()} title="Search (Enter)">↑</button>
                    )}
                </div>

                {!isInline && (
                    <div className="search-footer">
                        <span className="search-hint">⏎ to search · ⚡ for operators · ⌘K to focus</span>
                        {focusMode === 'all' && selectedCount > 0 && (
                            <span className="search-hint kb-selection-hint">
                                🔍 {selectedCount} KB{selectedCount !== 1 ? 's' : ''} · {totalDocs} docs
                            </span>
                        )}
                        <div className="search-operator-chips" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            {['site:github.com', 'filetype:pdf', '!exclude'].map(op => (
                                <button
                                    key={op}
                                    className="suggestion-chip"
                                    onClick={() => insertOperator(op + ' ')}
                                    style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-3)', cursor: 'pointer' }}
                                >
                                    {op}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
