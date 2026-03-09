import React, { useState, useEffect, useCallback, Component, ReactNode, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ThreadSidebar from './components/ThreadSidebar'
import SearchBar from './components/SearchBar'
import FocusModes from './components/FocusModes'
import SourceCards from './components/SourceCards'
import ImageCards from './components/ImageCards'
import VideoCards from './components/VideoCards'
import AnswerPanel from './components/AnswerPanel'
import ModelPicker from './components/ModelPicker'
import SettingsPanel from './components/SettingsPanel'
import QuickSettingsBar from './components/QuickSettingsBar'
import { useSettingsStore } from './store/settingsStore'
import { useHistoryStore } from './store/historyStore'
import { useSearchStore } from './store/searchStore'
import { useKnowledgeBaseStore } from './store/knowledgeBaseStore'
import { useSearch } from './hooks/useSearch'

// Lazy load heavy components for better bundle size
const KnowledgeBasePanel = lazy(() => import('./components/KnowledgeBasePanel'))
const KeyboardShortcutsPanel = lazy(() => import('./components/KeyboardShortcutsPanel'))
const BookmarksPanel = lazy(() => import('./components/BookmarksPanel'))
const CommandPalette = lazy(() => import('./components/CommandPalette'))
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'))
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard'))
const SavedSearchesPanel = lazy(() => import('./components/SavedSearchesPanel'))
const PDFExportDialog = lazy(() => import('./components/PDFExportDialog'))
const APIServerControl = lazy(() => import('./components/APIServerControl'))
const BatchSearchPanel = lazy(() => import('./components/BatchSearchPanel'))

// Loading fallback for lazy components
function LazyLoader() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-3)'
        }}>
            <div className="loading-spinner" />
        </div>
    )
}

// Error Boundary for stability
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
    constructor(props: { children: ReactNode }) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('React Error Boundary caught:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    padding: 40,
                    textAlign: 'center',
                    background: 'var(--bg-1)',
                    color: 'var(--text-0)',
                }}>
                    <h2 style={{ marginBottom: 16 }}>Something went wrong</h2>
                    <p style={{ color: 'var(--text-2)', marginBottom: 24 }}>
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '12px 24px',
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 16,
                        }}
                    >
                        Reload App
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

const EXAMPLES = [
    'How does the James Webb Telescope take photos?',
    'What is the difference between RAG and fine-tuning?',
    'React performance optimization best practices?',
    'Explain quantum entanglement simply',
]

export default function App() {
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [aboutOpen, setAboutOpen] = useState(false)
    const [kbOpen, setKbOpen] = useState(false)
    const [shortcutsOpen, setShortcutsOpen] = useState(false)
    const [bookmarksOpen, setBookmarksOpen] = useState(false)
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
    const [analyticsOpen, setAnalyticsOpen] = useState(false)
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [savedSearchesOpen, setSavedSearchesOpen] = useState(false)
    const [pdfExportOpen, setPdfExportOpen] = useState(false)
    const [apiControlOpen, setApiControlOpen] = useState(false)
    const [batchSearchOpen, setBatchSearchOpen] = useState(false)

    const { settings, setSettings, setOllamaModels, setLMStudioModels } = useSettingsStore()
    const { currentThread, setThreads } = useHistoryStore()
    const { phase, reset, focusMode, sources, images, videos } = useSearchStore()
    const { runSearch, clearConversation } = useSearch()

    // Boot: load settings, history, Ollama models
    useEffect(() => {
        (async () => {
            const [s, h, om, lm] = await Promise.all([
                window.api.getSettings(),
                window.api.getHistory(),
                window.api.listOllamaModels(),
                window.api.listLMStudioModels(),
            ])
            setSettings(s)
            setThreads(h)
            setOllamaModels(om)
            setLMStudioModels(lm)
            if (!s.hasCompletedOnboarding) {
                setShowOnboarding(true)
            }
        })()
    }, [])

    // Register menu handlers
    useEffect(() => {
        const cleanupNewSearch = window.api.onMenuNewSearch(() => {
            handleNewThread()
        })
        const cleanupSettings = window.api.onMenuOpenSettings(() => setSettingsOpen(true))
        const cleanupKB = window.api.onMenuOpenKB(() => setKbOpen(true))
        const cleanupAbout = window.api.onMenuAbout(() => setAboutOpen(true))

        // Keyboard shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault()
                setShortcutsOpen(true)
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !e.shiftKey) {
                e.preventDefault()
                setBookmarksOpen(true)
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K') && !e.shiftKey) {
                e.preventDefault()
                setCommandPaletteOpen(true)
            }
        }
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            cleanupNewSearch()
            cleanupSettings()
            cleanupKB()
            cleanupAbout()
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    const handleNewThread = useCallback(() => {
        reset()
        clearConversation()
        useHistoryStore.getState().setActiveThreadId(null)
    }, [reset, clearConversation])

    const handleExecuteSavedSearch = (query: string) => {
        runSearch(query)
    }

    const handleSaveCurrentSearch = async () => {
        const { query: currentQuery } = useSearchStore.getState()
        const { filters } = useSearchStore.getState()
        const { settings } = useSettingsStore.getState()
        
        const searchName = window.prompt('Save this search as:', currentQuery.slice(0, 50))
        if (!searchName) return

        try {
            await window.api.createSavedSearch({
                name: searchName,
                query: currentQuery,
                description: `Created on ${new Date().toLocaleString()}`,
                filters: filters || {},
                isTemplate: false,
                category: 'Recent Searches',
            })
            alert('✅ Search saved successfully!')
        } catch (err) {
            alert(`Failed to save search: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    const isInSearch = phase !== 'idle'

    return (
        <ErrorBoundary>
            <div className="app">
                <ThreadSidebar open={sidebarOpen} onNewThread={handleNewThread} onOpenAnalytics={() => setAnalyticsOpen(true)} />

                <div className="main-content">
                    {/* Topbar */}
                    <div className="topbar">
                        <div className="topbar-left">
                            <button
                                className="sidebar-toggle"
                                onClick={() => setSidebarOpen(o => !o)}
                                title="Toggle sidebar"
                                aria-label="Toggle conversation sidebar"
                            >
                                ☰
                            </button>
                            <div className="topbar-brand">
                                <div className="topbar-brand-dot" />
                                Lumina Search
                            </div>
                        </div>
                        <div className="topbar-right">
                            <button className="icon-btn" onClick={() => setSavedSearchesOpen(true)} title="Saved Searches">⭐</button>
                            <button className="icon-btn" onClick={() => setBookmarksOpen(true)} title="Bookmarks (Ctrl+B)">🔖</button>
                            <button className="icon-btn" onClick={() => setKbOpen(true)} title="Knowledge Base">📚</button>
                            <button className="icon-btn" onClick={() => setShortcutsOpen(true)} title="Keyboard Shortcuts">⌨️</button>
                            <ModelPicker />
                            <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">⚙</button>
                        </div>
                    </div>

                    <QuickSettingsBar />

                    {/* Page */}
                    <div className="page-scroll">
                        {!isInSearch ? (
                            <div className="home-area">
                                <div className="home-hero">
                                    <div className="home-logo">✦</div>
                                    <h1 className="home-title">Lumina Search</h1>
                                    <p className="home-subtitle">
                                        AI-powered search driven by parallel agents.<br />
                                        Use local models or cloud — your choice.
                                    </p>
                                </div>

                                <div style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                                    <FocusModes />
                                    <SearchBar />
                                    <div className="suggestions">
                                        {EXAMPLES.map((q) => (
                                            <button key={q} className="suggestion-chip" onClick={() => runSearch(q)}>{q}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="results-area">
                                    {focusMode === 'image' && images.length > 0 && <ImageCards images={images} />}
                                    {focusMode === 'video' && videos.length > 0 && <VideoCards videos={videos} />}
                                    {focusMode !== 'image' && focusMode !== 'video' && (
                                        <>
                                            {focusMode === 'hybrid-rag' && (
                                                <div className="rag-mode-badge">
                                                    <span className="rag-badge-icon">🧠</span>
                                                    <span>Hybrid RAG — Local Documents + Web Search</span>
                                                </div>
                                            )}
                                            {focusMode !== 'hybrid-rag' && <SourceCards />}
                                            <AnswerPanel />
                                        </>
                                    )}
                                </div>
                                <div className="search-inline-wrap">
                                    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <FocusModes />
                                        <SearchBar isInline placeholder="Ask a follow-up..." />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* v1.1.0 Quick Access Footer */}
                    <div className="quick-access-footer" style={{
                        position: 'fixed',
                        bottom: 0,
                        right: 0,
                        padding: '12px 20px',
                        display: 'flex',
                        gap: '12px',
                        zIndex: 10,
                        pointerEvents: 'none'
                    }}>
                        <div style={{ pointerEvents: 'auto', display: 'flex', gap: '8px' }}>
                            {currentThread && (
                                <button className="footer-btn" onClick={() => handleSaveCurrentSearch()} title="Save current search">💾 Save</button>
                            )}
                            <button className="footer-btn" onClick={() => setBatchSearchOpen(true)} title="Batch Search">🗂 Batch</button>
                            <button className="footer-btn" onClick={() => setApiControlOpen(true)} title="API Server">🚀 AI Server</button>
                            <button className="footer-btn" onClick={() => setAnalyticsOpen(true)} title="Analytics">📊 Trends</button>
                            {currentThread && (
                                <button className="footer-btn highlight" onClick={() => setPdfExportOpen(true)}>📄 Export PDF</button>
                            )}
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
                    {kbOpen && <KnowledgeBasePanel onClose={() => setKbOpen(false)} onSelectForRAG={(kbId) => {
                        const kb = useKnowledgeBaseStore.getState().knowledgeBases.find(k => k.id === kbId);
                        if (kb) {
                            useKnowledgeBaseStore.getState().setActiveKB(kb);
                            useSearchStore.getState().setFocusMode('local');
                        }
                        setKbOpen(false);
                    }} />}
                    {aboutOpen && (
                        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && setAboutOpen(false)}>
                            <div className="about-panel">
                                <div className="about-logo">✦</div>
                                <h2 className="about-title">Lumina Search</h2>
                                <p className="about-version">Version 1.1.0</p>
                                <p className="about-desc">
                                    Advanced AI-powered desktop search with parallel agent orchestration.<br />
                                    Local documents + Web intelligence at your fingertips.
                                </p>
                                <button className="btn-primary" onClick={() => setAboutOpen(false)}>Close</button>
                            </div>
                        </div>
                    )}
                    {shortcutsOpen && <KeyboardShortcutsPanel onClose={() => setShortcutsOpen(false)} />}
                    {bookmarksOpen && <BookmarksPanel onClose={() => setBookmarksOpen(false)} />}
                    {commandPaletteOpen && (
                        <CommandPalette
                            onClose={() => setCommandPaletteOpen(false)}
                            openSettings={() => setSettingsOpen(true)}
                            openKB={() => setKbOpen(true)}
                            openBookmarks={() => setBookmarksOpen(true)}
                            openAnalytics={() => setAnalyticsOpen(true)}
                        />
                    )}
                    {analyticsOpen && <AnalyticsDashboard onClose={() => setAnalyticsOpen(false)} />}
                    {savedSearchesOpen && <SavedSearchesPanel onClose={() => setSavedSearchesOpen(false)} onExecute={handleExecuteSavedSearch} />}
                    {pdfExportOpen && currentThread && <PDFExportDialog thread={currentThread} onClose={() => setPdfExportOpen(false)} />}
                    {apiControlOpen && <APIServerControl onClose={() => setApiControlOpen(false)} />}
                    {batchSearchOpen && <BatchSearchPanel onClose={() => setBatchSearchOpen(false)} />}
                    {showOnboarding && (
                        <OnboardingWizard
                            onComplete={async () => {
                                const current = useSettingsStore.getState().settings
                                const updated = { ...current, hasCompletedOnboarding: true }
                                useSettingsStore.getState().setSettings(updated)
                                await window.api.setSettings(updated)
                                setShowOnboarding(false)
                            }}
                            onSkip={() => setShowOnboarding(false)}
                        />
                    )}
                </AnimatePresence>
            </div>
        </ErrorBoundary>
    )
}
