import { create } from 'zustand'
import type { Collection, Thread } from '../../../main/agents/types'

interface CollectionState {
    collections: Collection[]
    activeCollectionId: string | null
    setCollections: (c: Collection[]) => void
    setActiveCollectionId: (id: string | null) => void
    loadCollections: () => Promise<void>
    createCollection: (name: string, description: string, filterQuery?: string) => Promise<void>
    deleteCollection: (id: string) => Promise<void>
    updateCollection: (collection: Collection) => Promise<void>
    filterThreads: (threads: Thread[]) => Thread[]
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
    collections: [],
    activeCollectionId: null,

    setCollections: (collections) => set({ collections }),

    setActiveCollectionId: (activeCollectionId) => set({ activeCollectionId }),

    async loadCollections() {
        try {
            const cols = await window.api.getCollections()
            set({ collections: cols })
        } catch {
            set({ collections: [] })
        }
    },

    async createCollection(name, description, filterQuery) {
        const col = await window.api.createCollection(name, description, filterQuery)
        set((s) => ({ collections: [col, ...s.collections] }))
    },

    async deleteCollection(id) {
        await window.api.deleteCollection(id)
        set((s) => ({
            collections: s.collections.filter(c => c.id !== id),
            activeCollectionId: s.activeCollectionId === id ? null : s.activeCollectionId,
        }))
    },

    async updateCollection(collection) {
        await window.api.updateCollection(collection)
        set((s) => ({
            collections: s.collections.map(c => c.id === collection.id ? collection : c),
        }))
    },

    filterThreads(threads) {
        const { activeCollectionId, collections } = get()
        if (!activeCollectionId) return threads

        const col = collections.find(c => c.id === activeCollectionId)
        if (!col || !col.filterQuery) return threads

        return threads.filter(t => matchesSmartCollection(t, col.filterQuery!))
    },
}))

// ── Smart collection query evaluation ─────────────────────────

function matchesSmartCollection(thread: Thread, query: string): boolean {
    const parts = query.split(/\s+AND\s+/i).map(p => p.trim()).filter(Boolean)
    if (parts.length === 0) return true

    return parts.every(part => {
        // tag:research
        if (part.toLowerCase().startsWith('tag:')) {
            const tag = part.slice(4).trim().toLowerCase()
            if (!tag) return true
            const tags = (thread.tags ?? []).map(t => t.toLowerCase())
            return tags.includes(tag)
        }

        // created_at > last_30_days
        const createdMatch = part.match(/^created_at\s*>\s*last_(\d+)_days$/i)
        if (createdMatch) {
            const days = parseInt(createdMatch[1], 10)
            if (!Number.isFinite(days) || days <= 0) return true
            const threshold = Date.now() - days * 24 * 60 * 60 * 1000
            return thread.createdAt >= threshold
        }

        // Fallback: substring match on title
        const q = part.toLowerCase()
        return thread.title.toLowerCase().includes(q)
    })
}

