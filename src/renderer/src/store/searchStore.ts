import { create } from 'zustand'
import { SearchResult, FocusMode, SearchProvider } from '../../../main/agents/types'

export type SearchPhase = 'idle' | 'searching' | 'reading' | 'synthesizing' | 'done' | 'error'

interface ImageResult {
    url: string
    title: string
    thumbnail: string
    domain: string
    source: string
}

interface VideoResult {
    url: string
    title: string
    thumbnail: string
    channel: string
    duration: string
    views: string
}

interface SearchState {
    query: string
    phase: SearchPhase
    phaseLabel: string
    sources: SearchResult[]
    images: ImageResult[]
    videos: VideoResult[]
    answer: string
    followUps: string[]
    error: string | null
    isStreaming: boolean
    threadId: string | null
    focusMode: FocusMode
    activeProvider: SearchProvider
    activeSource: number | null

    setQuery: (q: string) => void
    setPhase: (p: SearchPhase, label?: string) => void
    setSources: (s: SearchResult[]) => void
    setImages: (i: ImageResult[]) => void
    setVideos: (v: VideoResult[]) => void
    appendToken: (t: string) => void
    setFollowUps: (f: string[]) => void
    setError: (e: string | null) => void
    setStreaming: (s: boolean) => void
    setThreadId: (id: string | null) => void
    setFocusMode: (m: FocusMode) => void
    setActiveProvider: (p: SearchProvider) => void
    setActiveSource: (index: number | null) => void
    reset: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
    query: '',
    phase: 'idle',
    phaseLabel: '',
    sources: [],
    images: [],
    videos: [],
    answer: '',
    followUps: [],
    error: null,
    isStreaming: false,
    threadId: null,
    focusMode: 'web',
    activeProvider: 'duckduckgo',
    activeSource: null,

    setQuery: (query) => set({ query }),
    setPhase: (phase, phaseLabel = '') => set({ phase, phaseLabel }),
    setSources: (sources) => set({ sources }),
    setImages: (images) => set({ images }),
    setVideos: (videos) => set({ videos }),
    appendToken: (text) => set((s) => ({ answer: s.answer + text })),
    setFollowUps: (followUps) => set({ followUps }),
    setError: (error) => set({ error }),
    setStreaming: (isStreaming) => set({ isStreaming }),
    setThreadId: (threadId) => set({ threadId }),
    setFocusMode: (focusMode) => set({ focusMode }),
    setActiveProvider: (activeProvider) => set({ activeProvider }),
    setActiveSource: (activeSource) => set({ activeSource }),
    reset: () => set({
        phase: 'idle', phaseLabel: '', sources: [], images: [], videos: [], answer: '',
        followUps: [], error: null, isStreaming: false, activeSource: null,
    }),
}))
