import { create } from 'zustand'
import { Thread } from '../../../main/agents/types'

interface HistoryState {
    threads: Thread[]
    activeThreadId: string | null
    searchQuery: string
    filterFavorites: boolean
    currentThread: Thread | null
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
    currentThread: null,
    searchQuery: '',
    filterFavorites: false,

    setThreads: (threads) => set((s) => ({
        threads,
        currentThread: threads.find(t => t.id === s.activeThreadId) || null
    })),
    setActiveThreadId: (activeThreadId) => set((s) => ({
        activeThreadId,
        currentThread: s.threads.find(t => t.id === activeThreadId) || null
    })),

    upsertThread: (thread) => set((s) => {
        const idx = s.threads.findIndex(t => t.id === thread.id)
        let nextThreads = [...s.threads]
        if (idx === -1) {
            nextThreads = [thread, ...s.threads]
        } else {
            nextThreads[idx] = thread
        }
        return {
            threads: nextThreads,
            currentThread: s.activeThreadId === thread.id ? thread : s.currentThread
        }
    }),

    removeThread: (id) => set((s) => {
        const nextThreads = s.threads.filter(t => t.id !== id)
        const nextActiveId = s.activeThreadId === id ? null : s.activeThreadId
        return {
            threads: nextThreads,
            activeThreadId: nextActiveId,
            currentThread: nextActiveId ? nextThreads.find(t => t.id === nextActiveId) || null : null
        }
    }),

    togglePin: (id) => set((s) => {
        const nextThreads = s.threads.map(t =>
            t.id === id ? { ...t, isPinned: !t.isPinned } : t
        )
        return {
            threads: nextThreads,
            currentThread: s.activeThreadId === id ? nextThreads.find(t => t.id === id) || null : s.currentThread
        }
    }),

    toggleFavorite: (id) => set((s) => {
        const nextThreads = s.threads.map(t =>
            t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
        )
        return {
            threads: nextThreads,
            currentThread: s.activeThreadId === id ? nextThreads.find(t => t.id === id) || null : s.currentThread
        }
    }),

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
