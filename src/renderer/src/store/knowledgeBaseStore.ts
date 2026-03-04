import { create } from 'zustand'

interface Document {
    id: string
    name: string
    type: 'pdf' | 'txt' | 'md' | 'doc' | 'url'
    content: string
    chunks: string[]
    createdAt: number
    updatedAt: number
    sourceUrl?: string
    size: number
}

interface KnowledgeBase {
    id: string
    name: string
    description: string
    documents: Document[]
    createdAt: number
    updatedAt: number
}

interface KnowledgeBaseState {
    knowledgeBases: KnowledgeBase[]
    activeKB: KnowledgeBase | null
    selectedKBIds: string[]  // For multi-KB search
    isLoading: boolean
    setKnowledgeBases: (kbs: KnowledgeBase[]) => void
    setActiveKB: (kb: KnowledgeBase | null) => void
    setLoading: (loading: boolean) => void
    addKB: (kb: KnowledgeBase) => void
    removeKB: (id: string) => void
    addDocument: (doc: Document) => void
    removeDocument: (docId: string) => void
    toggleKBSelection: (id: string) => void
    selectAllKBs: () => void
    clearKBSelection: () => void
    setSelectedKBIds: (ids: string[]) => void
}

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set, get) => ({
    knowledgeBases: [],
    activeKB: null,
    selectedKBIds: [],
    isLoading: false,

    setKnowledgeBases: (knowledgeBases) => set({ knowledgeBases }),
    setActiveKB: (activeKB) => set({ activeKB }),
    setLoading: (isLoading) => set({ isLoading }),

    addKB: (kb) => set((state) => ({
        knowledgeBases: [kb, ...state.knowledgeBases]
    })),

    removeKB: (id) => set((state) => ({
        knowledgeBases: state.knowledgeBases.filter(kb => kb.id !== id),
        activeKB: state.activeKB?.id === id ? null : state.activeKB,
        selectedKBIds: state.selectedKBIds.filter(kbId => kbId !== id),
    })),

    addDocument: (doc) => set((state) => {
        if (!state.activeKB) return state
        return {
            activeKB: {
                ...state.activeKB,
                documents: [doc, ...state.activeKB.documents]
            },
            knowledgeBases: state.knowledgeBases.map(kb =>
                kb.id === state.activeKB?.id
                    ? { ...kb, documents: [doc, ...kb.documents] }
                    : kb
            )
        }
    }),

    removeDocument: (docId) => set((state) => {
        if (!state.activeKB) return state
        return {
            activeKB: {
                ...state.activeKB,
                documents: state.activeKB.documents.filter(d => d.id !== docId)
            }
        }
    }),

    toggleKBSelection: (id) => set((state) => {
        const isSelected = state.selectedKBIds.includes(id)
        return {
            selectedKBIds: isSelected
                ? state.selectedKBIds.filter(kbId => kbId !== id)
                : [...state.selectedKBIds, id],
        }
    }),

    selectAllKBs: () => set((state) => ({
        selectedKBIds: state.knowledgeBases.map(kb => kb.id),
    })),

    clearKBSelection: () => set({ selectedKBIds: [] }),

    setSelectedKBIds: (ids) => set({ selectedKBIds: ids }),
}))
