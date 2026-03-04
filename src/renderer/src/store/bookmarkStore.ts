import { create } from 'zustand'

interface BookmarkedSource {
    url: string
    title: string
    snippet: string
    domain: string
    bookmarkedAt: number
}

interface BookmarkState {
    bookmarks: BookmarkedSource[]
    addBookmark: (source: Omit<BookmarkedSource, 'bookmarkedAt'>) => void
    removeBookmark: (url: string) => void
    isBookmarked: (url: string) => boolean
    clearBookmarks: () => void
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
    bookmarks: [],

    addBookmark: (source) => set((state) => ({
        bookmarks: [
            { ...source, bookmarkedAt: Date.now() },
            ...state.bookmarks.filter(b => b.url !== source.url)
        ]
    })),

    removeBookmark: (url) => set((state) => ({
        bookmarks: state.bookmarks.filter(b => b.url !== url)
    })),

    isBookmarked: (url) => get().bookmarks.some(b => b.url === url),

    clearBookmarks: () => set({ bookmarks: [] }),
}))
