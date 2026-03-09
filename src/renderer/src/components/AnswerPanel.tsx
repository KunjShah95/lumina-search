import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useSearchStore } from '../store/searchStore'
import { useSearch } from '../hooks/useSearch'
import { useHistoryStore } from '../store/historyStore'
import { threadToMarkdown, downloadMarkdown, generateFilename } from '../utils/export'
import { encodeThreadToShareLink } from '../utils/shareCode'
import NoteEditor from './NoteEditor'

export default function AnswerPanel() {
    const { answer, phase, phaseLabel, isStreaming, followUps, error, sources, threadId, focusMode } = useSearchStore()
    const { runSearch } = useSearch()
    const { threads } = useHistoryStore()
    const [activeCitation, setActiveCitation] = useState<number | null>(null)
    const [showExportMenu, setShowExportMenu] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const speechRef = useRef<SpeechSynthesisUtterance | null>(null)
    const [showNotes, setShowNotes] = useState(false)
    const [feedbackVote, setFeedbackVote] = useState<'up' | 'down' | null>(null)
    const [citationFeedback, setCitationFeedback] = useState<boolean | null>(null)
    const [feedbackSaved, setFeedbackSaved] = useState(false)
    const [copyStatus, setCopyStatus] = useState<string | null>(null)

    const copyAnswer = useCallback(() => {
        navigator.clipboard.writeText(answer)
        setCopyStatus('Copied answer')
    }, [answer])

    const copyWithCitations = useCallback(() => {
        const sourceLines = sources.map((s, i) => `[${i + 1}] ${s.title}${s.url ? ` - ${s.url}` : ''}`)
        const payload = sourceLines.length > 0
            ? `${answer}\n\nSources:\n${sourceLines.join('\n')}`
            : answer
        navigator.clipboard.writeText(payload)
        setCopyStatus('Copied with citations')
    }, [answer, sources])

    const copyAsMarkdown = useCallback(() => {
        const thread = threads.find(t => t.id === threadId)
        if (!thread) return
        const markdown = threadToMarkdown(thread)
        navigator.clipboard.writeText(markdown)
        setCopyStatus('Copied as Markdown')
    }, [threadId, threads])

    const copyAsHTML = useCallback(() => {
        const thread = threads.find(t => t.id === threadId)
        if (!thread) return
        const html = `<h1>${thread.title}</h1>\n\n${thread.messages.map(m => `**${m.role}:** ${m.content}`).join('\n\n')}`
        navigator.clipboard.writeText(html)
        setCopyStatus('Copied as HTML')
    }, [threadId, threads])

    const copyAsJSON = useCallback(() => {
        const thread = threads.find(t => t.id === threadId)
        if (!thread) return
        navigator.clipboard.writeText(JSON.stringify(thread, null, 2))
        setCopyStatus('Copied as JSON')
    }, [threadId, threads])

    const exportThread = useCallback(() => {
        const thread = threads.find(t => t.id === threadId)
        if (!thread) return
        const markdown = threadToMarkdown(thread)
        const filename = generateFilename(thread.title)
        downloadMarkdown(markdown, filename)
    }, [threadId, threads])

    const shareAnswer = useCallback(async () => {
        const thread = threads.find(t => t.id === threadId)
        if (!thread) return

        try {
            await navigator.clipboard.writeText(
                `🔍 ${thread.title}\n\n${thread.messages.find(m => m.role === 'assistant')?.content.slice(0, 500)}...\n\nSources: ${thread.sources.map(s => s.url).join(', ')}`
            )
            setCopyStatus('Copied share snippet')
        } catch (err) {
            console.error('Failed to share:', err)
        }
    }, [threadId, threads])

    const copyShareCode = useCallback(async () => {
        const thread = threads.find(t => t.id === threadId)
        if (!thread) return

        const shareLink = encodeThreadToShareLink(thread)
        await navigator.clipboard.writeText(shareLink)
        setCopyStatus('Copied share code')
    }, [threadId, threads])

    const exportAsPDF = useCallback(async () => {
        const thread = threads.find(t => t.id === threadId)
        if (!thread) return
        try {
            await window.api.exportThreadPDF(thread)
        } catch (err) {
            console.error('Failed to export PDF:', err)
        }
    }, [threadId, threads])

    const toggleSpeech = useCallback(() => {
        if (isSpeaking) {
            window.speechSynthesis.cancel()
            setIsSpeaking(false)
            return
        }

        if (!answer) return

        const utterance = new SpeechSynthesisUtterance(answer)
        utterance.rate = 1.0
        utterance.pitch = 1.0

        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)

        speechRef.current = utterance
        window.speechSynthesis.speak(utterance)
    }, [answer, isSpeaking])

    const scrollToSource = (index: number) => {
        const card = document.querySelector(`[data-source-index="${index}"]`)
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }

    const handleCitationClick = (index: number) => {
        scrollToSource(index)
    }

    const handleCitationHover = (index: number | null) => {
        setActiveCitation(index)
        useSearchStore.getState().setActiveSource(index)
    }

    const submitFeedback = useCallback(async (vote: 'up' | 'down', citedCorrectly?: boolean) => {
        if (!threadId || !answer) return
        try {
            await window.api.recordEvalFeedback({
                threadId,
                query: threads.find(t => t.id === threadId)?.messages.find(m => m.role === 'user')?.content,
                answerPreview: answer.slice(0, 500),
                vote,
                citedCorrectly,
                source: 'manual',
            })
            setFeedbackSaved(true)
        } catch (err) {
            console.error('Failed to save evaluation feedback', err)
        }
    }, [threadId, answer, threads])

    const readingMeta = useMemo(() => {
        const words = answer.trim() ? answer.trim().split(/\s+/).length : 0
        const codeBlocks = (answer.match(/```[\s\S]*?```/g) || []).length
        const wpm = 200
        const base = words > 0 ? Math.ceil(words / wpm) : 0
        const withCode = Math.max(0, Math.ceil(base + codeBlocks * 0.5))
        return {
            words,
            minutes: withCode,
            show: words >= 100,
        }
    }, [answer])

    useEffect(() => {
        if (!copyStatus) return
        const t = setTimeout(() => setCopyStatus(null), 1400)
        return () => clearTimeout(t)
    }, [copyStatus])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
                e.preventDefault()
                copyWithCitations()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [copyWithCitations])

    return (
        <div className="answer-section">
            {/* Phase label */}
            {(phase === 'searching' || phase === 'synthesizing') && (
                <div className="phase-label" style={{ marginBottom: 16 }}>
                    <div className="phase-spinner" />
                    {phaseLabel}
                </div>
            )}

            {/* Error state */}
            {phase === 'error' && error && (
                <div className="answer-body" style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Answer */}
            {(answer || (phase === 'searching' || phase === 'synthesizing' || phase === 'error')) && (
                <>
                    <div className="answer-header">
                        <span className="answer-label">
                            ✦ Answer
                            {focusMode === 'local' && <span className="focus-badge">📄 Local</span>}
                            {focusMode === 'web' && <span className="focus-badge">🌐 Web</span>}
                            {focusMode === 'all' && <span className="focus-badge">🔍 All</span>}
                            {readingMeta.show && (
                                <span className="focus-badge" style={{ marginLeft: 6, background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border)' }}>
                                    📖 ~{Math.max(1, readingMeta.minutes)} min · {readingMeta.words} words
                                </span>
                            )}
                        </span>
                        <div className="answer-actions">
                            {answer && (
                                <>
                                    <button
                                        className={`action-btn ${isSpeaking ? 'speaking' : ''}`}
                                        onClick={toggleSpeech}
                                        title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                                    >
                                        {isSpeaking ? '🔊' : '🔈'}
                                    </button>
                                    <button
                                        className="action-btn"
                                        onClick={() => setShowNotes(true)}
                                        title="Open notes editor"
                                    >
                                        📝 Notes
                                    </button>
                                    <button className="action-btn" onClick={copyAnswer} title="Copy as text">
                                        📋 Copy
                                    </button>
                                    <button className="action-btn" onClick={copyWithCitations} title="Copy with citations (Ctrl+Shift+C)">
                                        🔗 Copy + Cite
                                    </button>
                                    <div className="export-dropdown">
                                        <button
                                            className="action-btn"
                                            onClick={() => setShowExportMenu(!showExportMenu)}
                                        >
                                            📥 Export ▾
                                        </button>
                                        {showExportMenu && (
                                            <div className="export-menu">
                                                <button onClick={exportThread}>📄 Download Markdown</button>
                                                <button onClick={exportAsPDF}>🖨 Export as PDF</button>
                                                <button onClick={copyAsMarkdown}>📝 Copy as Markdown</button>
                                                <button onClick={copyAsHTML}>🌐 Copy as HTML</button>
                                                <button onClick={copyAsJSON}>📋 Copy as JSON</button>
                                                <button onClick={shareAnswer}>🔗 Share</button>
                                                <button onClick={copyShareCode}>🧾 Copy share code</button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {copyStatus && (
                        <div style={{ marginBottom: 8, color: 'var(--text-2)', fontSize: 12 }}>
                            ✅ {copyStatus}
                        </div>
                    )}
                    <div className="answer-layout">
                        <div className="answer-body">
                            {answer ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeHighlight]}
                                    components={{
                                        a: ({ href, children }) => (
                                            <a href={href} onClick={(e) => { e.preventDefault(); if (href) window.open(href, '_blank') }}>
                                                {children}
                                            </a>
                                        ),
                                        p: ({ children }) => {
                                            if (typeof children === 'string') {
                                                const parts = children.split(/(\[\d+\])/)
                                                return (
                                                    <p>
                                                        {parts.map((part, i) => {
                                                            const match = part.match(/\[(\d+)\]/)
                                                            if (match) {
                                                                const num = parseInt(match[1], 10)
                                                                if (num > 0 && num <= sources.length) {
                                                                    return (
                                                                        <button
                                                                            key={i}
                                                                            className={`citation-badge ${activeCitation === num ? 'active' : ''}`}
                                                                            onClick={() => handleCitationClick(num)}
                                                                            onMouseEnter={() => handleCitationHover(num)}
                                                                            onMouseLeave={() => handleCitationHover(null)}
                                                                        >
                                                                            [{num}]
                                                                        </button>
                                                                    )
                                                                }
                                                            }
                                                            return <span key={i}>{part}</span>
                                                        })}
                                                    </p>
                                                )
                                            }
                                            return <p>{children}</p>
                                        },
                                    }}
                                >
                                    {answer}
                                </ReactMarkdown>
                            ) : (
                                <div style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Generating answer...</div>
                            )}
                            {isStreaming && <span className="stream-cursor" />}
                        </div>
                        {sources.length > 0 && (
                            <div className="source-viewer-pane">
                                <div className="sources-label">Active source</div>
                                {activeCitation && sources[activeCitation - 1] ? (
                                    <div className="source-viewer-card">
                                        <div className="source-viewer-title">
                                            {sources[activeCitation - 1].title}
                                        </div>
                                        <div className="source-viewer-meta">
                                            {sources[activeCitation - 1].domain}
                                        </div>
                                        <div className="source-viewer-snippet">
                                            {sources[activeCitation - 1].snippet}
                                        </div>
                                        {sources[activeCitation - 1].url && (
                                            <button
                                                className="btn-primary"
                                                style={{ marginTop: 12 }}
                                                onClick={() => window.open(sources[activeCitation - 1].url, '_blank')}
                                            >
                                                Open Source
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="source-viewer-empty">
                                        Hover or click a citation to inspect its source.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Follow-up chips */}
            {followUps.length > 0 && phase === 'done' && (
                <div className="followups-section" style={{ marginTop: 20 }}>
                    <div className="followups-label">↳ Follow-up questions</div>
                    <div className="followup-chips">
                        {followUps.map((q, i) => (
                            <button
                                key={i}
                                className="followup-chip"
                                onClick={() => runSearch(q)}
                            >
                                <span className="followup-chip-icon">⤷</span>
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Online evaluation prompt */}
            {phase === 'done' && answer && threadId && (
                <div className="followups-section" style={{ marginTop: 14 }}>
                    <div className="followups-label">✅ Was this answer helpful and cited correctly?</div>
                    <div className="followup-chips" style={{ gap: 8 }}>
                        <button
                            className={`followup-chip ${feedbackVote === 'up' ? 'active' : ''}`}
                            onClick={() => {
                                setFeedbackVote('up')
                                submitFeedback('up', citationFeedback === null ? undefined : citationFeedback)
                            }}
                        >
                            👍 Helpful
                        </button>
                        <button
                            className={`followup-chip ${feedbackVote === 'down' ? 'active' : ''}`}
                            onClick={() => {
                                setFeedbackVote('down')
                                submitFeedback('down', citationFeedback === null ? undefined : citationFeedback)
                            }}
                        >
                            👎 Not helpful
                        </button>
                        <button
                            className={`followup-chip ${citationFeedback === true ? 'active' : ''}`}
                            onClick={() => {
                                setCitationFeedback(true)
                                if (feedbackVote) void submitFeedback(feedbackVote, true)
                            }}
                        >
                            📌 Citations correct
                        </button>
                        <button
                            className={`followup-chip ${citationFeedback === false ? 'active' : ''}`}
                            onClick={() => {
                                setCitationFeedback(false)
                                if (feedbackVote) void submitFeedback(feedbackVote, false)
                            }}
                        >
                            ⚠️ Citation issue
                        </button>
                    </div>
                    {feedbackSaved && (
                        <div style={{ marginTop: 6, color: 'var(--text-3)', fontSize: 12 }}>
                            Thanks — feedback recorded for weekly quality tracking.
                        </div>
                    )}
                </div>
            )}
            {showNotes && <NoteEditor onClose={() => setShowNotes(false)} />}
        </div>
    )
}
