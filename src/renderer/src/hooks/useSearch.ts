import { useRef, useCallback } from 'react'
import { useSearchStore } from '../store/searchStore'
import { useSettingsStore } from '../store/settingsStore'
import { useHistoryStore } from '../store/historyStore'
import { useKnowledgeBaseStore } from '../store/knowledgeBaseStore'
import { AgentEvent, Message, Thread } from '../../../main/agents/types'

export function useSearch() {
    const activeRequestId = useRef<string | null>(null)
    const conversationHistory = useRef<Message[]>([])

    const {
        setPhase, setSources, appendSources, setImages, setVideos, appendToken, setFollowUps,
        setError, setStreaming, setThreadId, focusMode, reset,
    } = useSearchStore()
    const { model, settings } = useSettingsStore()
    const { upsertThread, setActiveThreadId } = useHistoryStore()
    const { activeKB, selectedKBIds } = useKnowledgeBaseStore()

    const runSearch = useCallback((query: string, threadId?: string, searchRequestId?: string) => {
        // Cancel any running search
        if (activeRequestId.current) {
            window.api.cancelSearch(activeRequestId.current)
            activeRequestId.current = null
        }

        // Reset state
        reset()
        setStreaming(true)

        const id = threadId ?? `thread_${Date.now()}`
        setThreadId(id)
        setActiveThreadId(id)

        // Track search start time for analytics
        const analyticsRequestId = searchRequestId ?? `analytics_${Date.now()}`
        if (!(window as any).__searchStartTime) {
            (window as any).__searchStartTime = {}
        }
        (window as any).__searchStartTime[analyticsRequestId] = Date.now()

        // Persist user message
        conversationHistory.current.push({ role: 'user', content: query })

        let answerBuffer = ''

        // Handle RAG focus modes: local, all, hybrid-rag — all use streaming
        if (focusMode === 'local' || focusMode === 'all' || focusMode === 'hybrid-rag') {
            const isAllMode = focusMode === 'all'
            const searchLabel = isAllMode
                ? `🔍 Searching across ${selectedKBIds.length || 'all'} knowledge bases...`
                : '🔍 Searching local knowledge base...'
            setPhase('searching', searchLabel)

            const useWeb = isAllMode;

            // Build RAG options
            const ragOptions: { useLocalContext: boolean; useWebSearch: boolean; kbId?: string; kbIds?: string[] } = {
                useLocalContext: true,
                useWebSearch: useWeb,
            }

            if (isAllMode && selectedKBIds.length > 0) {
                // Multi-KB search: pass all selected KB IDs
                ragOptions.kbIds = selectedKBIds
            } else if (!isAllMode && activeKB) {
                // Single KB search
                ragOptions.kbId = activeKB.id
            }
            // If 'all' mode with no selection, kbId/kbIds are undefined → searches everything

            const streamHandle = window.api.ragQueryStream(
                query,
                ragOptions,
                (event) => {
                    switch (event.type) {
                        case 'phase':
                            setPhase('searching', event.label || '')
                            break
                        case 'token':
                            answerBuffer += (event.text || '')
                            appendToken(event.text || '')
                            break
                        case 'sources':
                            // Convert RAG sources to SearchResult format for display
                            if (event.sources) {
                                const mappedSources = event.sources.map((s: any) => ({
                                    link: s.url || '',
                                    source: 'rag',
                                    url: s.url || '',
                                    title: s.title,
                                    snippet: s.snippet,
                                    domain: s.url ? new URL(s.url).hostname : 'local',
                                    score: s.score,
                                }))
                                setSources(mappedSources)
                            }
                            setPhase('synthesizing', '🧠 Generating answer...')
                            break
                        case 'cache-hit':
                            if (event.answer) {
                                answerBuffer = event.answer
                                appendToken(event.answer)
                            }
                            setPhase('done')
                            setStreaming(false)
                            {
                                conversationHistory.current.push({ role: 'assistant', content: answerBuffer })
                                const et = useHistoryStore.getState().threads.find(t => t.id === id)
                                const thread: Thread = {
                                    id, title: query.slice(0, 60),
                                    createdAt: et?.createdAt ?? Date.now(), updatedAt: Date.now(),
                                    messages: [...conversationHistory.current],
                                    sources: useSearchStore.getState().sources,
                                    isPinned: et?.isPinned ?? false, isFavorite: et?.isFavorite ?? false,
                                }
                                upsertThread(thread)
                                window.api.saveThread(thread)
                                window.api.autoTagThread(thread).then((tags) => {
                                    if (!tags || tags.length === 0) return
                                    const current = useHistoryStore.getState().threads.find(t => t.id === id)
                                    if (!current) return
                                    const updated: Thread = { ...current, tags }
                                    useHistoryStore.getState().upsertThread(updated)
                                    window.api.saveThread(updated)
                                }).catch(() => { /* non-critical */ })
                            }
                            break
                        case 'done':
                            setPhase('done')
                            setStreaming(false)
                            {
                                conversationHistory.current.push({ role: 'assistant', content: answerBuffer })
                                const et = useHistoryStore.getState().threads.find(t => t.id === id)
                                const thread: Thread = {
                                    id, title: query.slice(0, 60),
                                    createdAt: et?.createdAt ?? Date.now(), updatedAt: Date.now(),
                                    messages: [...conversationHistory.current],
                                    sources: useSearchStore.getState().sources,
                                    isPinned: et?.isPinned ?? false, isFavorite: et?.isFavorite ?? false,
                                }
                                upsertThread(thread)
                                window.api.saveThread(thread)
                                window.api.autoTagThread(thread).then((tags) => {
                                    if (!tags || tags.length === 0) return
                                    const current = useHistoryStore.getState().threads.find(t => t.id === id)
                                    if (!current) return
                                    const updated: Thread = { ...current, tags }
                                    useHistoryStore.getState().upsertThread(updated)
                                    window.api.saveThread(updated)
                                }).catch(() => { /* non-critical */ })
                            }
                            break
                        case 'error':
                            setPhase('error')
                            setError(event.message || 'RAG query failed')
                            setStreaming(false)
                            break
                    }
                }
            )

            activeRequestId.current = `rag_${Date.now()}`
            return
        }

        setPhase('searching', '🔍 Searching the web...')

        let lastConfidence: any = null

        // Get operator filters from searchStore and map to SearchOperatorFilters format
        const { filters } = useSearchStore.getState()
        const operators = filters.site || filters.filetype || filters.language || filters.dateRange ? {
            sites: filters.site,
            fileTypes: filters.filetype,
            languages: filters.language,
            dateRange: filters.dateRange,
        } : undefined

        const requestId = window.api.search(
            query,
            {
                providers: [settings.defaultProvider],
                model,
                maxSources: settings.maxSources,
                scrapePages: settings.scrapePages,
                focusMode,
                sessionId: id,
                memoryPolicy: {
                    enabled: settings.memoryEnabled,
                    ttlDays: settings.memoryTtlDays,
                    maxFactsPerQuery: settings.memoryMaxFactsPerQuery,
                },
                conversationHistory: conversationHistory.current.slice(-6),
                operators,
            },
            (event: AgentEvent) => {
                switch (event.type) {
                    case 'phase':
                        setPhase('searching', event.label)
                        break
                    case 'sources':
                        // Handle incremental/partial results from providers
                        if (event.partial) {
                            appendSources(event.data)
                        } else {
                            setSources(event.data)
                        }
                        if (focusMode !== 'image' && focusMode !== 'video') {
                            setPhase('synthesizing', '🧠 Synthesizing answer...')
                        }
                        break
                    case 'images':
                        setImages(event.data)
                        break
                    case 'videos':
                        setVideos(event.data)
                        break
                    case 'token':
                        const text = event.text || ''
                        answerBuffer += text
                        appendToken(text)
                        break
                    case 'followups':
                        setFollowUps(event.data)
                        break
                    case 'confidence':
                        lastConfidence = event.data
                        break
                    case 'done':
                        setPhase('done')
                        setStreaming(false)
                        // Persist assistant message
                        conversationHistory.current.push({ role: 'assistant', content: answerBuffer })
                        // Preserve existing thread metadata if updating
                        const existingThread = useHistoryStore.getState().threads.find(t => t.id === id)
                        const currentSources = useSearchStore.getState().sources
                        const thread: Thread = {
                            id,
                            title: query.slice(0, 60),
                            createdAt: existingThread?.createdAt ?? Date.now(),
                            updatedAt: Date.now(),
                            messages: [...conversationHistory.current],
                            sources: currentSources,
                            isPinned: existingThread?.isPinned ?? false,
                            isFavorite: existingThread?.isFavorite ?? false,
                            lastConfidence: lastConfidence ?? existingThread?.lastConfidence,
                        }
                        upsertThread(thread)
                        window.api.saveThread(thread)

                        // Record search analytics
                        const searchStartTime = (window as any).__searchStartTime?.[id]
                        if (searchStartTime) {
                            const executionTime = Date.now() - searchStartTime
                            window.api.searchAnalyticsRecord({
                                query,
                                resultCount: currentSources.length,
                                executionTimeMs: executionTime,
                                sourcesUsed: [settings.defaultProvider],
                                llmModel: model,
                                success: currentSources.length > 0,
                            }).catch(() => { /* non-critical */ })
                            delete (window as any).__searchStartTime?.[id]
                        }

                        // Trigger auto-tagging in the background
                        window.api.autoTagThread(thread).then((tags) => {
                            if (!tags || tags.length === 0) return
                            const current = useHistoryStore.getState().threads.find(t => t.id === id)
                            if (!current) return
                            const updated: Thread = { ...current, tags }
                            useHistoryStore.getState().upsertThread(updated)
                            window.api.saveThread(updated)
                        }).catch(() => { /* non-critical */ })
                        break
                    case 'error':
                        setPhase('error')
                        setError(event.message)
                        setStreaming(false)
                        break
                }
            }
        )

        activeRequestId.current = requestId
    }, [model, settings, focusMode])

    const cancelSearch = useCallback(() => {
        if (activeRequestId.current) {
            window.api.cancelSearch(activeRequestId.current)
            activeRequestId.current = null
            setStreaming(false)
            setPhase('idle')
        }
    }, [])

    const clearConversation = useCallback(() => {
        conversationHistory.current = []
    }, [])

    return { runSearch, cancelSearch, clearConversation }
}
