import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import crypto from 'crypto'
import { Thread, Message, SearchResult, AppSettings, DEFAULT_SETTINGS, Document, Collection } from '../agents/types'
import { addDocumentChunks, initVectorStore, deleteDocumentChunks } from '../rag/vectorStore'

const userDataPath = app.getPath('userData')
const dbPath = path.join(userDataPath, 'data.json')

interface StorageData {
    threads: Thread[]
    settings: AppSettings
    knowledgeBases: KnowledgeBase[]
    collections: Collection[]
}

interface KnowledgeBase {
    id: string
    name: string
    description: string
    documents: Document[]
    createdAt: number
    updatedAt: number
}

const SNAPSHOT_VERSION = 'lumina-kb-snapshot-v1'

interface KBSnapshotManifest {
    snapshotVersion: string
    exportedAt: number
    kbId: string
    kbName: string
    docCount: number
    hashAlgorithm: 'sha256'
    kbHash: string
    documentHashes: Record<string, string>
}

interface KBSnapshotFile {
    manifest: KBSnapshotManifest
    knowledgeBase: KnowledgeBase
}

interface SnapshotCompatibilityReport {
    compatible: boolean
    snapshotVersion?: string
    reason?: string
}

export interface SnapshotExportResult {
    success: boolean
    filePath: string
    manifest: KBSnapshotManifest
}

export interface SnapshotImportResult {
    success: boolean
    kbId?: string
    importedDocuments?: number
    compatibility: SnapshotCompatibilityReport
    errors?: string[]
}

let data: StorageData = {
    threads: [],
    settings: { ...DEFAULT_SETTINGS },
    knowledgeBases: [],
    collections: [],
}

function loadData(): StorageData {
    try {
        if (fs.existsSync(dbPath)) {
            const raw = fs.readFileSync(dbPath, 'utf-8')
            const parsed = JSON.parse(raw)
            data = {
                threads: parsed.threads || [],
                settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
                knowledgeBases: parsed.knowledgeBases || [],
                collections: parsed.collections || [],
            }
        }
    } catch { }
    return data
}

function saveData(): void {
    try {
        fs.mkdirSync(userDataPath, { recursive: true })
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
    } catch (e) {
        console.error('Failed to save data:', e)
    }
}

export function initDatabase(): void {
    loadData()
}

// ── Thread Operations ────────────────────────────────────────
export function getAllThreads(): Thread[] {
    return data.threads.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return b.updatedAt - a.updatedAt
    })
}

export function saveThread(thread: Thread): void {
    const idx = data.threads.findIndex(t => t.id === thread.id)
    if (idx !== -1) {
        data.threads[idx] = thread
    } else {
        data.threads.unshift(thread)
    }
    data.threads = data.threads.slice(0, 200)
    saveData()
}

export function deleteThreadFromDb(id: string): void {
    data.threads = data.threads.filter(t => t.id !== id)
    saveData()
}

export function clearAllThreads(): void {
    data.threads = []
    saveData()
}

export function searchThreads(query: string): Thread[] {
    if (!query.trim()) return getAllThreads()
    const q = query.toLowerCase()
    return data.threads.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.messages.some(m => m.content.toLowerCase().includes(q))
    )
}

// ── Settings Operations ────────────────────────────────────────
export function getSettingsFromDb(): AppSettings {
    return data.settings
}

export function saveSettingsToDb(settings: AppSettings): void {
    data.settings = settings
    saveData()
}

// ── Knowledge Base Operations ────────────────────────────────
export function getKnowledgeBases(): KnowledgeBase[] {
    return data.knowledgeBases.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createKnowledgeBase(name: string, description: string = ''): KnowledgeBase {
    const kb: KnowledgeBase = {
        id: `kb_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name,
        description,
        documents: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    }
    data.knowledgeBases.push(kb)
    saveData()
    return kb
}

export function deleteKnowledgeBase(id: string): void {
    data.knowledgeBases = data.knowledgeBases.filter(kb => kb.id !== id)
    saveData()
}

export async function addDocumentToKnowledgeBase(
    kbId: string,
    name: string,
    type: Document['type'],
    content: string,
    sourceUrl?: string
): Promise<Document> {
    const kb = data.knowledgeBases.find(k => k.id === kbId)
    if (!kb) throw new Error('Knowledge base not found')

    const chunks = chunkText(content)
    const doc: Document = {
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name,
        type,
        content,
        chunks,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceUrl,
        size: content.length,
    }

    kb.documents.push(doc)
    kb.updatedAt = Date.now()

    await addDocumentChunks(kbId, chunks, doc.id);

    saveData()
    return doc
}

export function deleteDocument(docId: string): void {
    for (const kb of data.knowledgeBases) {
        const doc = kb.documents.find(d => d.id === docId);
        if (doc) {
            deleteDocumentChunks(docId);
        }
        kb.documents = kb.documents.filter(d => d.id !== docId)
    }
    saveData()
}

export function searchKnowledgeBase(kbId: string, query: string): Document[] {
    const kb = data.knowledgeBases.find(k => k.id === kbId)
    if (!kb) return []

    const q = query.toLowerCase()
    return kb.documents.filter(doc =>
        doc.name.toLowerCase().includes(q) ||
        doc.content.toLowerCase().includes(q)
    )
}

export interface CrossKBSearchResult {
    kbId: string
    kbName: string
    document: Document
    matchScore: number
}

export function searchAllKnowledgeBases(query: string, kbIds?: string[]): CrossKBSearchResult[] {
    const q = query.toLowerCase()
    const results: CrossKBSearchResult[] = []

    const targetKBs = kbIds && kbIds.length > 0
        ? data.knowledgeBases.filter(kb => kbIds.includes(kb.id))
        : data.knowledgeBases

    for (const kb of targetKBs) {
        for (const doc of kb.documents) {
            const nameMatch = doc.name.toLowerCase().includes(q)
            const contentMatch = doc.content.toLowerCase().includes(q)

            if (nameMatch || contentMatch) {
                // Simple relevance scoring: name matches score higher
                let matchScore = 0
                if (nameMatch) matchScore += 2
                if (contentMatch) {
                    // Count occurrences for scoring
                    const occurrences = (doc.content.toLowerCase().match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
                    matchScore += Math.min(occurrences, 10) / 10
                }

                results.push({
                    kbId: kb.id,
                    kbName: kb.name,
                    document: doc,
                    matchScore,
                })
            }
        }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore)
}

export function exportKnowledgeBaseSnapshot(kbId: string, targetFilePath?: string): SnapshotExportResult {
    const kb = data.knowledgeBases.find(k => k.id === kbId)
    if (!kb) {
        throw new Error('Knowledge base not found')
    }

    const documentHashes: Record<string, string> = {}
    for (const doc of kb.documents) {
        documentHashes[doc.id] = sha256(`${doc.id}:${doc.name}:${doc.updatedAt}:${doc.content}`)
    }

    const kbHashPayload = JSON.stringify({
        id: kb.id,
        name: kb.name,
        updatedAt: kb.updatedAt,
        documentHashes: Object.entries(documentHashes).sort((a, b) => a[0].localeCompare(b[0])),
    })

    const manifest: KBSnapshotManifest = {
        snapshotVersion: SNAPSHOT_VERSION,
        exportedAt: Date.now(),
        kbId: kb.id,
        kbName: kb.name,
        docCount: kb.documents.length,
        hashAlgorithm: 'sha256',
        kbHash: sha256(kbHashPayload),
        documentHashes,
    }

    const snapshot: KBSnapshotFile = {
        manifest,
        knowledgeBase: kb,
    }

    const snapshotsDir = path.join(userDataPath, 'kb-snapshots')
    const filePath = targetFilePath || path.join(snapshotsDir, `${kb.id}_${Date.now()}.json`)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8')

    return {
        success: true,
        filePath,
        manifest,
    }
}

export function importKnowledgeBaseSnapshot(snapshotFilePath: string): SnapshotImportResult {
    try {
        if (!fs.existsSync(snapshotFilePath)) {
            return {
                success: false,
                compatibility: { compatible: false, reason: 'Snapshot file does not exist' },
                errors: ['Snapshot file does not exist'],
            }
        }

        const raw = fs.readFileSync(snapshotFilePath, 'utf-8')
        const parsed = JSON.parse(raw) as KBSnapshotFile

        const compatibility = checkSnapshotCompatibility(parsed)
        if (!compatibility.compatible) {
            return {
                success: false,
                compatibility,
                errors: [compatibility.reason || 'Incompatible snapshot'],
            }
        }

        const validation = validateSnapshotHashes(parsed)
        if (!validation.valid) {
            return {
                success: false,
                compatibility,
                errors: validation.errors,
            }
        }

        const incoming = parsed.knowledgeBase
        const existingIndex = data.knowledgeBases.findIndex(k => k.id === incoming.id)
        const normalized: KnowledgeBase = {
            ...incoming,
            updatedAt: Date.now(),
            documents: incoming.documents || [],
        }

        if (existingIndex >= 0) {
            data.knowledgeBases[existingIndex] = normalized
        } else {
            data.knowledgeBases.push(normalized)
        }

        saveData()

        return {
            success: true,
            kbId: normalized.id,
            importedDocuments: normalized.documents.length,
            compatibility,
        }
    } catch (error) {
        return {
            success: false,
            compatibility: { compatible: false, reason: 'Failed to parse snapshot file' },
            errors: [error instanceof Error ? error.message : String(error)],
        }
    }
}

export async function initKnowledgeBaseTables(): Promise<void> {
    await initVectorStore();
}

// ── Collections & Smart Collections ─────────────────────────

export function getCollections(): Collection[] {
    return data.collections.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createCollection(
    name: string,
    description: string = '',
    filterQuery?: string
): Collection {
    const now = Date.now()
    const collection: Collection = {
        id: `col_${now}_${Math.random().toString(36).slice(2)}`,
        name,
        description,
        filterQuery,
        createdAt: now,
        updatedAt: now,
    }
    data.collections.push(collection)
    saveData()
    return collection
}

export function updateCollection(collection: Collection): void {
    const idx = data.collections.findIndex(c => c.id === collection.id)
    const next = { ...collection, updatedAt: Date.now() }
    if (idx === -1) {
        data.collections.push(next)
    } else {
        data.collections[idx] = next
    }
    saveData()
}

export function deleteCollection(id: string): void {
    data.collections = data.collections.filter(c => c.id !== id)
    saveData()
}

// ── Migration ────────────────────────────────────────────────
export function migrateFromJson(): void {
    // No-op, data is already loaded
}

// Helper function
function chunkText(text: string): string[] {
    const chunks: string[] = []
    const sentences = text.split(/[.!?]+/).filter(s => s.trim())

    let currentChunk = ''
    for (const sentence of sentences) {
        const trimmed = sentence.trim()
        if (!trimmed) continue

        if (currentChunk.length + trimmed.length < 1000) {
            currentChunk += (currentChunk ? '. ' : '') + trimmed
        } else {
            if (currentChunk) chunks.push(currentChunk)
            currentChunk = trimmed
        }
    }

    if (currentChunk) chunks.push(currentChunk)
    return chunks
}

function sha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex')
}

function checkSnapshotCompatibility(snapshot: KBSnapshotFile): SnapshotCompatibilityReport {
    const version = snapshot?.manifest?.snapshotVersion
    if (!version) {
        return { compatible: false, reason: 'Missing snapshot version' }
    }

    if (version !== SNAPSHOT_VERSION) {
        return {
            compatible: false,
            snapshotVersion: version,
            reason: `Unsupported snapshot version: ${version}`,
        }
    }

    if (!snapshot.knowledgeBase || !snapshot.manifest) {
        return { compatible: false, snapshotVersion: version, reason: 'Missing snapshot payload sections' }
    }

    return { compatible: true, snapshotVersion: version }
}

function validateSnapshotHashes(snapshot: KBSnapshotFile): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const kb = snapshot.knowledgeBase
    const manifest = snapshot.manifest

    for (const doc of kb.documents || []) {
        const expected = manifest.documentHashes?.[doc.id]
        if (!expected) {
            errors.push(`Missing hash for document ${doc.id}`)
            continue
        }

        const actual = sha256(`${doc.id}:${doc.name}:${doc.updatedAt}:${doc.content}`)
        if (actual !== expected) {
            errors.push(`Hash mismatch for document ${doc.id}`)
        }
    }

    const recomputedKbHash = sha256(JSON.stringify({
        id: kb.id,
        name: kb.name,
        updatedAt: kb.updatedAt,
        documentHashes: Object.entries(manifest.documentHashes || {}).sort((a, b) => a[0].localeCompare(b[0])),
    }))

    if (manifest.kbHash !== recomputedKbHash) {
        errors.push('KB manifest hash mismatch')
    }

    return { valid: errors.length === 0, errors }
}
