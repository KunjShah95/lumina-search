import { create } from 'zustand'
import { Thread } from '../../../main/agents/types'

interface HistoryState {
    threads: Thread[]
    activeThreadId: string | null
    searchQuery: string
    filterFavorites: boolean
    setThreads: (t: Thread[]) => void
    setActiveThreadId: (id: string | null) => void
    upsertThread: (t: Thread) => void
    removeThread: (id: string) => void
    togglePin: (id: string) => void
    toggleFavorite: (id: string) => void
    setSearchQuery: (q: string) => void
    setFilterFavorites: (v: boolean) => void
    getFilteredThreads: () => Thread[]
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
    threads: [],
    activeThreadId: null,
    searchQuery: '',
    filterFavorites: false,

    setThreads: (threads) => set({ threads }),
    setActiveThreadId: (activeThreadId) => set({ activeThreadId }),

    upsertThread: (thread) => set((s) => {
        const idx = s.threads.findIndex(t => t.id === thread.id)
        if (idx === -1) return { threads: [thread, ...s.threads] }
        const next = [...s.threads]
        next[idx] = thread
        return { threads: next }
    }),

    removeThread: (id) => set((s) => ({
        threads: s.threads.filter(t => t.id !== id),
        activeThreadId: s.activeThreadId === id ? null : s.activeThreadId,
    })),

    togglePin: (id) => set((s) => ({
        threads: s.threads.map(t => 
            t.id === id ? { ...t, isPinned: !t.isPinned } : t
        ),
    })),

    toggleFavorite: (id) => set((s) => ({
        threads: s.threads.map(t => 
            t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
        ),
    })),

    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setFilterFavorites: (filterFavorites) => set({ filterFavorites }),

    getFilteredThreads: () => {
        const { threads, searchQuery, filterFavorites } = get()
        let filtered = [...threads]
        
        if (filterFavorites) {
            filtered = filtered.filter(t => t.isFavorite)
        }
        
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(t => 
                t.title.toLowerCase().includes(q) ||
                t.messages.some(m => m.content.toLowerCase().includes(q))
            )
        }
        
        filtered.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1
            if (!a.isPinned && b.isPinned) return 1
            return b.updatedAt - a.updatedAt
        })
        
        return filtered
    },
}))
