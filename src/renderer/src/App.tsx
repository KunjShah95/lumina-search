import React, { useState, useEffect, useCallback } from 'react'
import ThreadSidebar from './components/ThreadSidebar'
import SearchBar from './components/SearchBar'
import FocusModes from './components/FocusModes'
import SourceCards from './components/SourceCards'
import ImageCards from './components/ImageCards'
import VideoCards from './components/VideoCards'
import AnswerPanel from './components/AnswerPanel'
import ModelPicker from './components/ModelPicker'
import SettingsPanel from './components/SettingsPanel'
import KnowledgeBasePanel from './components/KnowledgeBasePanel'
import KeyboardShortcutsPanel from './components/KeyboardShortcutsPanel'
import BookmarksPanel from './components/BookmarksPanel'
import CommandPalette from './components/CommandPalette'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import OnboardingWizard from './components/OnboardingWizard'
import { useSettingsStore } from './store/settingsStore'
import { useHistoryStore } from './store/historyStore'
import { useSearchStore } from './store/searchStore'
import { useKnowledgeBaseStore } from './store/knowledgeBaseStore'
import { useSearch } from './hooks/useSearch'

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
    const { setSettings, setOllamaModels, setLMStudioModels } = useSettingsStore()
    const { setThreads } = useHistoryStore()
    const { phase, reset, focusMode, sources, images, videos } = useSearchStore()
    const { runSearch, clearConversation } = useSearch()

    // Boot: load settings, history, Ollama models
    useEffect(() => {
        ; (async () => {
            const [settings, history, ollamaModels, lmstudioModels] = await Promise.all([
                window.api.getSettings(),
                window.api.getHistory(),
                window.api.listOllamaModels(),
                window.api.listLMStudioModels(),
            ])
            setSettings(settings)
            setThreads(history)
            setOllamaModels(ollamaModels)
            setLMStudioModels(lmstudioModels)
            if (!settings.hasCompletedOnboarding) {
                setShowOnboarding(true)
            }
        })()
    }, [])

    // Theme handling (dark/light/system)
    useEffect(() => {
        const syncTheme = () => {
            const current = useSettingsStore.getState().settings.theme
            if (current === 'system') {
                const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
                document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
            } else {
                document.documentElement.setAttribute('data-theme', current)
            }
        }

        syncTheme()

        const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
        const listener = () => {
            if (useSettingsStore.getState().settings.theme === 'system') {
                syncTheme()
            }
        }
        media?.addEventListener('change', listener)
        return () => media?.removeEventListener('change', listener)
    }, [])

    // Menu event handlers
    useEffect(() => {
        const unsubNewSearch = window.api.onMenuNewSearch(() => {
            handleNewThread()
        })
        const unsubSettings = window.api.onMenuOpenSettings(() => {
            setSettingsOpen(true)
        })
        const unsubKB = window.api.onMenuOpenKB(() => {
            setKbOpen(true)
        })
        const unsubAbout = window.api.onMenuAbout(() => {
            setAboutOpen(true)
        })

        // Keyboard shortcut: Ctrl+/ to open shortcuts, Ctrl+B for bookmarks, Ctrl+K for command palette
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
            unsubNewSearch()
            unsubSettings()
            unsubKB()
            unsubAbout()
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    const handleNewThread = useCallback(() => {
        reset()
        clearConversation()
        useHistoryStore.getState().setActiveThreadId(null)
    }, [reset, clearConversation])

    const isInSearch = phase !== 'idle'

    return (
        <div className="app">
            <ThreadSidebar open={sidebarOpen} onNewThread={handleNewThread} />

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
                        <button className="icon-btn" onClick={() => setBookmarksOpen(true)} title="Bookmarks (Ctrl+B)" aria-label="Open bookmarks">⭐</button>
                        <button className="icon-btn" onClick={() => setKbOpen(true)} title="Knowledge Base" aria-label="Open knowledge base">📚</button>
                        <button className="icon-btn" onClick={() => setShortcutsOpen(true)} title="Keyboard Shortcuts" aria-label="Show keyboard shortcuts">⌨️</button>
                        <ModelPicker />
                        <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">⚙</button>
                    </div>
                </div>

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
            </div>

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
                        <p className="about-version">Version 1.0.0</p>
                        <p className="about-desc">
                            AI-powered desktop search with parallel agent orchestration.<br />
                            Supports local models (Ollama, LM Studio) and cloud providers.
                        </p>
                        <button className="btn-primary" onClick={() => setAboutOpen(false)}>
                            Close
                        </button>
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
                    openAnalytics={() => {
                        setAnalyticsOpen(true)
                    }}
                />
            )}

            {analyticsOpen && <AnalyticsDashboard onClose={() => setAnalyticsOpen(false)} />}

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
        </div>
    )
}
