import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
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
        intitleTerms?: string[]
        sources?: string[]
        excludeTerms?: string[]
        exactPhrase?: string
    }
}

interface Props { isInline?: boolean; placeholder?: string }

const POPULAR_SUGGESTIONS = [
    'how to use React hooks',
    'how to use React Router',
    'how to use Redux',
    'how to use regex in JavaScript',
    'TypeScript utility types examples',
    'best SQL database indexing practices',
    'python tutorials for beginners',
    'node.js performance optimization tips',
]

const CODE_SUGGESTIONS = [
    'TypeScript generics explained with examples',
    'React state management best practices',
    'Node.js stream vs buffer differences',
    'How to write Vitest unit tests',
]

const ACADEMIC_SUGGESTIONS = [
    'latest large language model benchmarks',
    'systematic review methodology examples',
    'transformer architecture explained',
    'RAG evaluation metrics precision recall',
]

export default function SearchBar({ isInline = false, placeholder }: Props) {
    const [value, setValue] = useState('')
    const [recentSearches, setRecentSearches] = useState<string[]>([])
    const [showRecentSearches, setShowRecentSearches] = useState(false)
    const [activeRecentIndex, setActiveRecentIndex] = useState(-1)
    const [querySuggestions, setQuerySuggestions] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
    const [showKBPicker, setShowKBPicker] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const [showOperators, setShowOperators] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const kbPickerRef = useRef<HTMLDivElement>(null)
    const recognitionRef = useRef<any>(null)
    const { isStreaming, phase, focusMode, setFocusMode, setFilters } = useSearchStore()
    const { runSearch, cancelSearch } = useSearch()
    const { activeKB, knowledgeBases, selectedKBIds, toggleKBSelection, selectAllKBs, clearKBSelection } = useKnowledgeBaseStore()

    const escapeRegExp = useCallback((text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), [])

    const buildQueryWithOperators = useCallback((parsed: ParsedSearchQuery): string => {
        const parts: string[] = []
        if (parsed.baseQuery) parts.push(parsed.baseQuery)
        if (parsed.operators.exactPhrase) parts.push(`"${parsed.operators.exactPhrase}"`)
        if (parsed.operators.sites?.length) parts.push(...parsed.operators.sites.map((s) => `site:${s}`))
        if (parsed.operators.fileTypes?.length) parts.push(...parsed.operators.fileTypes.map((f) => `filetype:${f}`))
        if (parsed.operators.languages?.length) parts.push(...parsed.operators.languages.map((l) => `lang:${l}`))
        if (parsed.operators.intitleTerms?.length) parts.push(...parsed.operators.intitleTerms.map((t) => `intitle:${t}`))
        if (parsed.operators.dateRange) {
            const start = parsed.operators.dateRange.start.toISOString().slice(0, 10)
            const end = parsed.operators.dateRange.end.toISOString().slice(0, 10)
            parts.push(`date:${start}..${end}`)
        }
        if (parsed.operators.sources?.length) parts.push(...parsed.operators.sources.map((s) => `source:${s}`))
        if (parsed.operators.excludeTerms?.length) parts.push(...parsed.operators.excludeTerms.map((t) => `-${t}`))
        return parts.join(' ').trim()
    }, [])

    const removeOperatorToken = useCallback((token: string) => {
        setValue((prev) => {
            let next = prev

            if (token.startsWith('lang:')) {
                const lang = token.slice(5)
                next = next
                    .replace(new RegExp(`(^|\\s)lang:${escapeRegExp(lang)}(?=\\s|$)`, 'gi'), ' ')
                    .replace(new RegExp(`(^|\\s)language:${escapeRegExp(lang)}(?=\\s|$)`, 'gi'), ' ')
            } else if (token.startsWith('-')) {
                const term = token.slice(1)
                next = next
                    .replace(new RegExp(`(^|\\s)-${escapeRegExp(term)}(?=\\s|$)`, 'gi'), ' ')
                    .replace(new RegExp(`(^|\\s)!${escapeRegExp(term)}(?=\\s|$)`, 'gi'), ' ')
            } else if (token.startsWith('date:')) {
                next = next.replace(/(^|\s)date:\d{4}(?:-\d{2}-\d{2})?\.\.\d{4}(?:-\d{2}-\d{2})?(?=\s|$)/gi, ' ')
            } else {
                next = next.replace(new RegExp(`(^|\\s)${escapeRegExp(token)}(?=\\s|$)`, 'gi'), ' ')
            }

            return next.replace(/\s+/g, ' ').trim()
        })
    }, [escapeRegExp])

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
        const langAliasMatch = query.match(/lang:([^\s,]+)/gi)
        if (langMatch || langAliasMatch) {
            result.operators.languages = [
                ...(langMatch ?? []).map(l => l.replace(/language:/gi, '')),
                ...(langAliasMatch ?? []).map(l => l.replace(/lang:/gi, '')),
            ]
        }

        const intitleMatch = query.match(/intitle:([^\s]+)/gi)
        if (intitleMatch) {
            result.operators.intitleTerms = intitleMatch.map(t => t.replace(/intitle:/gi, ''))
        }

        const dateMatch = query.match(/date:(\d{4}(?:-\d{2}-\d{2})?)\.\.(\d{4}(?:-\d{2}-\d{2})?)/i)
        if (dateMatch) {
            const parseDate = (v: string): Date => {
                if (/^\d{4}$/.test(v)) return new Date(Number(v), 0, 1)
                return new Date(v)
            }
            const d1 = parseDate(dateMatch[1])
            const d2 = parseDate(dateMatch[2])
            if (!Number.isNaN(d1.getTime()) && !Number.isNaN(d2.getTime())) {
                result.operators.dateRange = d1 <= d2
                    ? { start: d1, end: d2 }
                    : { start: d2, end: d1 }
            }
        }

        const sourceMatch = query.match(/source:([^\s,]+)/gi)
        if (sourceMatch) {
            result.operators.sources = sourceMatch.map(s => s.replace(/source:/gi, ''))
        }

        const excludeMatches = query.match(/!(\S+)/g)
        const minusExcludeMatches = query.match(/(^|\s)-([a-zA-Z0-9_\-]+)/g)
        const excludesFromBang = (excludeMatches ?? []).map(e => e.substring(1))
        const excludesFromMinus = (minusExcludeMatches ?? []).map(e => e.trim().substring(1))
        const allExcludes = Array.from(new Set([...excludesFromBang, ...excludesFromMinus]))
        if (allExcludes.length > 0) {
            result.operators.excludeTerms = allExcludes
        }

        const quotedMatch = query.match(/"([^"]+)"/g)
        if (quotedMatch) {
            result.operators.exactPhrase = quotedMatch.map(q => q.replace(/"/g, '')).join(' ')
        }

        let cleanQuery = query
            .replace(/site:[^\s]+/gi, '')
            .replace(/filetype:[^\s]+/gi, '')
            .replace(/language:[^\s,]+/gi, '')
            .replace(/lang:[^\s,]+/gi, '')
            .replace(/intitle:[^\s]+/gi, '')
            .replace(/date:\d{4}(?:-\d{2}-\d{2})?\.\.\d{4}(?:-\d{2}-\d{2})?/gi, '')
            .replace(/source:[^\s,]+/gi, '')
            .replace(/!(\S+)/g, '')
            .replace(/(^|\s)-([a-zA-Z0-9_\-]+)/g, ' ')
            .replace(/"([^"]+)"/g, '')
            .replace(/\s+/g, ' ')
            .trim()

        result.baseQuery = cleanQuery

        return result
    }, [])

    const saveRecentSearch = useCallback((query: string) => {
        const trimmed = query.trim()
        if (!trimmed) return
        setRecentSearches((prev) => {
            const next = [trimmed, ...prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10)
            localStorage.setItem('lumina.recentSearches', JSON.stringify(next))
            return next
        })
    }, [])

    const removeRecentSearch = useCallback((query: string) => {
        setRecentSearches((prev) => {
            const next = prev.filter((q) => q !== query)
            localStorage.setItem('lumina.recentSearches', JSON.stringify(next))
            return next
        })
    }, [])

    const clearRecentSearches = useCallback(() => {
        setRecentSearches([])
        localStorage.removeItem('lumina.recentSearches')
        setShowRecentSearches(false)
        setActiveRecentIndex(-1)
    }, [])

    const executeSearch = useCallback((rawQuery: string) => {
        const q = rawQuery.trim()
        if (!q || isStreaming) return

        const parsed = parseSearchOperators(q)

        // Build operator filters from parsed query
        const newFilters: any = {}
        if (parsed.operators.sites?.length) {
            newFilters.site = parsed.operators.sites
        }
        if (parsed.operators.fileTypes?.length) {
            newFilters.filetype = parsed.operators.fileTypes
        }
        if (parsed.operators.languages?.length) {
            newFilters.language = parsed.operators.languages
        }
        if (parsed.operators.dateRange) {
            newFilters.dateRange = parsed.operators.dateRange
        }
        
        if (Object.keys(newFilters).length > 0) {
            setFilters(newFilters)
        }

        const compiledQuery = buildQueryWithOperators(parsed)

        saveRecentSearch(q)
        runSearch(compiledQuery || parsed.baseQuery)
        setShowRecentSearches(false)
        setActiveRecentIndex(-1)
        setShowSuggestions(false)
        setActiveSuggestionIndex(-1)
        if (!isInline) setValue('')
    }, [isStreaming, parseSearchOperators, setFilters, saveRecentSearch, runSearch, isInline, buildQueryWithOperators])

    const handleSubmit = useCallback(() => {
        executeSearch(value)
    }, [value, executeSearch])

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
        if (showSuggestions && querySuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveSuggestionIndex((prev) => (prev + 1) % querySuggestions.length)
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveSuggestionIndex((prev) => (prev <= 0 ? querySuggestions.length - 1 : prev - 1))
                return
            }
            if (e.key === 'Tab') {
                e.preventDefault()
                const top = querySuggestions[Math.max(activeSuggestionIndex, 0)]
                if (top) {
                    setValue(top)
                    setShowSuggestions(false)
                    setActiveSuggestionIndex(-1)
                }
                return
            }
            if (e.key === 'Enter' && !e.shiftKey && activeSuggestionIndex >= 0 && activeSuggestionIndex < querySuggestions.length) {
                e.preventDefault()
                const selected = querySuggestions[activeSuggestionIndex]
                setValue(selected)
                executeSearch(selected)
                return
            }
            if (e.key === 'Escape') {
                e.preventDefault()
                setShowSuggestions(false)
                setActiveSuggestionIndex(-1)
                return
            }
        }

        if (showRecentSearches && recentSearches.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveRecentIndex((prev) => (prev + 1) % recentSearches.length)
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveRecentIndex((prev) => (prev <= 0 ? recentSearches.length - 1 : prev - 1))
                return
            }
            if (e.key === 'Escape') {
                e.preventDefault()
                setShowRecentSearches(false)
                setActiveRecentIndex(-1)
                return
            }
            if (e.key === 'Enter' && activeRecentIndex >= 0 && activeRecentIndex < recentSearches.length) {
                e.preventDefault()
                const selected = recentSearches[activeRecentIndex]
                setValue(selected)
                executeSearch(selected)
                return
            }
        }

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

    // Load recent searches once
    useEffect(() => {
        try {
            const raw = localStorage.getItem('lumina.recentSearches')
            if (!raw) return
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
                setRecentSearches(parsed.filter((q) => typeof q === 'string').slice(0, 10))
            }
        } catch {
            // ignore malformed localStorage
        }
    }, [])

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }, [value])

    // Query auto-suggestions (debounced)
    useEffect(() => {
        const trimmed = value.trim()
        if (trimmed.length < 2) {
            setQuerySuggestions([])
            setShowSuggestions(false)
            setActiveSuggestionIndex(-1)
            return
        }

        const timer = setTimeout(() => {
            const q = trimmed.toLowerCase()
            const contextPool = focusMode === 'code'
                ? CODE_SUGGESTIONS
                : focusMode === 'academic'
                    ? ACADEMIC_SUGGESTIONS
                    : POPULAR_SUGGESTIONS

            const historyMatches = recentSearches
                .filter((s) => s.toLowerCase().includes(q))
                .slice(0, 3)

            const popularMatches = contextPool
                .filter((s) => s.toLowerCase().includes(q))
                .slice(0, 5)

            const merged = Array.from(new Set([...historyMatches, ...popularMatches])).slice(0, 8)
            setQuerySuggestions(merged)
            setShowSuggestions(merged.length > 0)
            setShowRecentSearches(false)
            setActiveSuggestionIndex(merged.length > 0 ? 0 : -1)
        }, 300)

        return () => clearTimeout(timer)
    }, [value, recentSearches, focusMode])

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

    const parsedPreview = useMemo(() => parseSearchOperators(value.trim()), [value, parseSearchOperators])
    const activeOperatorChips: Array<{ key: string; label: string; token: string }> = useMemo(() => {
        const chips: Array<{ key: string; label: string; token: string }> = []
        parsedPreview.operators.sites?.forEach((site) => chips.push({ key: `site-${site}`, label: `site:${site}`, token: `site:${site}` }))
        parsedPreview.operators.fileTypes?.forEach((f) => chips.push({ key: `file-${f}`, label: `filetype:${f}`, token: `filetype:${f}` }))
        parsedPreview.operators.languages?.forEach((l) => chips.push({ key: `lang-${l}`, label: `lang:${l}`, token: `lang:${l}` }))
        parsedPreview.operators.intitleTerms?.forEach((t) => chips.push({ key: `intitle-${t}`, label: `intitle:${t}`, token: `intitle:${t}` }))
        parsedPreview.operators.sources?.forEach((s) => chips.push({ key: `source-${s}`, label: `source:${s}`, token: `source:${s}` }))
        parsedPreview.operators.excludeTerms?.forEach((t) => chips.push({ key: `exclude-${t}`, label: `-${t}`, token: `-${t}` }))
        if (parsedPreview.operators.exactPhrase) {
            chips.push({ key: 'exact-phrase', label: `"${parsedPreview.operators.exactPhrase}"`, token: `"${parsedPreview.operators.exactPhrase}"` })
        }
        if (parsedPreview.operators.dateRange) {
            const start = parsedPreview.operators.dateRange.start.toISOString().slice(0, 10)
            const end = parsedPreview.operators.dateRange.end.toISOString().slice(0, 10)
            chips.push({ key: `date-${start}-${end}`, label: `date:${start}..${end}`, token: `date:${start}..${end}` })
        }
        return chips
    }, [parsedPreview])

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
                        onFocus={() => {
                            if (value.trim().length >= 2 && querySuggestions.length > 0) {
                                setShowSuggestions(true)
                                setShowRecentSearches(false)
                            } else if (recentSearches.length > 0) {
                                setShowRecentSearches(true)
                                setShowSuggestions(false)
                            }
                        }}
                        onBlur={() => {
                            setTimeout(() => {
                                setShowRecentSearches(false)
                                setShowSuggestions(false)
                            }, 120)
                        }}
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

                {activeOperatorChips.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 14px 10px' }}>
                        {activeOperatorChips.map((chip) => (
                            <button
                                key={chip.key}
                                className="suggestion-chip"
                                onClick={() => removeOperatorToken(chip.token)}
                                title="Remove filter"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                            >
                                {chip.label} ✕
                            </button>
                        ))}
                    </div>
                )}

                {showRecentSearches && recentSearches.length > 0 && (
                    <div className="recent-searches-dropdown">
                        <div className="recent-searches-header">
                            <span>Recent searches</span>
                            <button className="recent-clear-btn" onClick={clearRecentSearches}>Clear</button>
                        </div>
                        <div className="recent-searches-list">
                            {recentSearches.map((query, idx) => (
                                <button
                                    key={`${query}-${idx}`}
                                    className={`recent-search-item ${activeRecentIndex === idx ? 'active' : ''}`}
                                    onMouseEnter={() => setActiveRecentIndex(idx)}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        setValue(query)
                                        executeSearch(query)
                                    }}
                                >
                                    <span className="recent-search-query">🕐 {query}</span>
                                    <span
                                        className="recent-search-remove"
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            removeRecentSearch(query)
                                        }}
                                        role="button"
                                        aria-label={`Remove ${query}`}
                                    >
                                        ✕
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {showSuggestions && querySuggestions.length > 0 && (
                    <div className="recent-searches-dropdown" style={{ marginTop: 0 }} role="listbox" aria-label="Search suggestions">
                        <div className="recent-searches-header">
                            <span>💡 Suggestions</span>
                            <span style={{ opacity: 0.8 }}>Tab to accept</span>
                        </div>
                        <div className="recent-searches-list">
                            {querySuggestions.map((suggestion, idx) => (
                                <button
                                    key={`${suggestion}-${idx}`}
                                    className={`recent-search-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                                    onMouseEnter={() => setActiveSuggestionIndex(idx)}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        setValue(suggestion)
                                        executeSearch(suggestion)
                                    }}
                                    role="option"
                                    aria-selected={activeSuggestionIndex === idx}
                                >
                                    <span className="recent-search-query">{suggestion}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
