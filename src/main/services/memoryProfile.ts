import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { MemoryFact } from '../agents/types'

const userDataPath = app.getPath('userData')
const memoryPath = path.join(userDataPath, 'memory-profile.json')

interface MemoryStore {
    memories: MemoryFact[]
}

const store: MemoryStore = {
    memories: [],
}

function loadStore(): void {
    try {
        if (!fs.existsSync(memoryPath)) {
            return
        }

        const raw = fs.readFileSync(memoryPath, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<MemoryStore>
        store.memories = Array.isArray(parsed.memories) ? parsed.memories : []
    } catch {
        store.memories = []
    }
}

function saveStore(): void {
    try {
        fs.mkdirSync(path.dirname(memoryPath), { recursive: true })
        fs.writeFileSync(memoryPath, JSON.stringify(store, null, 2), 'utf-8')
    } catch {
        // no-op
    }
}

function isExpired(memory: MemoryFact, now: number = Date.now()): boolean {
    return typeof memory.expiresAt === 'number' && memory.expiresAt <= now
}

function normalizeText(v: string): string {
    return v.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreMemory(memory: MemoryFact, query: string): number {
    const q = normalizeText(query)
    if (!q) return 0

    const queryTokens = new Set(q.split(' ').filter(t => t.length > 2))
    const valueTokens = new Set(normalizeText(memory.value).split(' ').filter(t => t.length > 2))

    let overlap = 0
    for (const token of queryTokens) {
        if (valueTokens.has(token)) overlap++
    }

    const overlapScore = queryTokens.size > 0 ? overlap / queryTokens.size : 0
    const recencyBoost = Math.max(0, 1 - ((Date.now() - memory.updatedAt) / (1000 * 60 * 60 * 24 * 120)))
    return overlapScore * 0.8 + recencyBoost * 0.2
}

function getActiveMemories(now: number = Date.now()): MemoryFact[] {
    return store.memories.filter(m => !isExpired(m, now))
}

export function initMemoryProfileStore(): void {
    loadStore()
    pruneExpiredMemories()
}

export function addMemoryFact(input: {
    threadId: string
    key?: string
    value: string
    tags?: string[]
    source?: 'manual' | 'auto'
    ttlDays?: number
}): MemoryFact {
    if (!input.threadId || !input.value?.trim()) {
        throw new Error('threadId and value are required for memory fact')
    }

    const now = Date.now()
    const ttlDays = typeof input.ttlDays === 'number' && Number.isFinite(input.ttlDays) && input.ttlDays > 0
        ? input.ttlDays
        : undefined

    const memory: MemoryFact = {
        id: `mem_${now}_${Math.random().toString(36).slice(2)}`,
        createdAt: now,
        updatedAt: now,
        threadId: input.threadId,
        key: input.key?.trim() || undefined,
        value: input.value.trim(),
        tags: input.tags?.filter(Boolean),
        source: input.source ?? 'manual',
        expiresAt: ttlDays ? now + Math.round(ttlDays * 24 * 60 * 60 * 1000) : undefined,
    }

    store.memories.push(memory)
    saveStore()
    return memory
}

export function listMemoryFacts(threadId?: string, includeExpired: boolean = false): MemoryFact[] {
    const base = includeExpired ? store.memories : getActiveMemories()
    const filtered = threadId ? base.filter(m => m.threadId === threadId) : base
    return [...filtered].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function deleteMemoryFact(id: string): boolean {
    const before = store.memories.length
    store.memories = store.memories.filter(m => m.id !== id)
    const changed = store.memories.length !== before
    if (changed) saveStore()
    return changed
}

export function clearThreadMemories(threadId: string): number {
    const before = store.memories.length
    store.memories = store.memories.filter(m => m.threadId !== threadId)
    const deleted = before - store.memories.length
    if (deleted > 0) saveStore()
    return deleted
}

export function pruneExpiredMemories(now: number = Date.now()): number {
    const before = store.memories.length
    store.memories = store.memories.filter(m => !isExpired(m, now))
    const deleted = before - store.memories.length
    if (deleted > 0) saveStore()
    return deleted
}

export function buildMemoryContext(input: {
    threadId: string
    query: string
    maxFacts?: number
}): { memories: MemoryFact[]; text: string } {
    const maxFacts = Math.max(1, Math.min(10, input.maxFacts ?? 5))

    const ranked = getActiveMemories()
        .filter(m => m.threadId === input.threadId)
        .map(m => ({ memory: m, score: scoreMemory(m, input.query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxFacts)
        .map(item => item.memory)

    if (ranked.length === 0) {
        return { memories: [], text: '' }
    }

    const lines = ranked.map((memory, idx) => {
        const label = memory.key ? `${memory.key}: ` : ''
        return `- (${idx + 1}) ${label}${memory.value}`
    })

    return {
        memories: ranked,
        text: [
            'USER MEMORY (opt-in personalization; use only when relevant):',
            ...lines,
        ].join('\n'),
    }
}

export function maybeRememberFromQuery(input: {
    threadId: string
    query: string
    ttlDays?: number
}): MemoryFact | null {
    const text = input.query.trim()
    const lower = text.toLowerCase()

    const markers = [
        'remember that ',
        'remember this: ',
        'my preference is ',
        'i prefer ',
    ]

    const marker = markers.find(m => lower.startsWith(m))
    if (!marker) return null

    const value = text.slice(marker.length).trim()
    if (!value) return null

    return addMemoryFact({
        threadId: input.threadId,
        key: 'user_preference',
        value,
        source: 'auto',
        ttlDays: input.ttlDays,
    })
}

initMemoryProfileStore()
