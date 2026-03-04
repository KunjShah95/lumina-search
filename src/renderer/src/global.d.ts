import { AgentEvent, AppSettings, SearchOpts, Thread, BudgetPolicy, CostEstimate } from '../../main/agents/types'

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

interface CrossKBSearchResult {
    kbId: string
    kbName: string
    document: Document
    matchScore: number
}

interface RAGStreamEvent {
    type: 'phase' | 'token' | 'sources' | 'done' | 'error' | 'cache-hit'
    label?: string
    text?: string
    sources?: RAGSourceInfo[]
    message?: string
    answer?: string
}

interface RAGSourceInfo {
    type: 'local' | 'web' | 'bm25'
    title: string
    url?: string
    score: number
    snippet: string
}

interface IngestResult {
    success: boolean
    chunksCreated?: number
    error?: string
}

interface IngestBatchResult {
    file: string
    success: boolean
    chunks?: number
    error?: string
}

interface CacheStats {
    hits: number
    misses: number
    totalEntries: number
}

interface TraceStats {
    totalTraces: number
    avgLatencyMs: number
    cacheHitRate: number
    errorRate: number
}

interface KBSnapshotExportResult {
    success: boolean
    filePath: string
    manifest: {
        snapshotVersion: string
        exportedAt: number
        kbId: string
        kbName: string
        docCount: number
        hashAlgorithm: 'sha256'
        kbHash: string
        documentHashes: Record<string, string>
    }
}

interface KBSnapshotImportResult {
    success: boolean
    kbId?: string
    importedDocuments?: number
    compatibility: {
        compatible: boolean
        snapshotVersion?: string
        reason?: string
    }
    errors?: string[]
}

declare global {
    interface Window {
        api: {
            search: (query: string, opts: SearchOpts, onEvent: (e: AgentEvent) => void) => string
            cancelSearch: (requestId: string) => void
            getSettings: () => Promise<AppSettings>
            setSettings: (settings: AppSettings) => Promise<boolean>
            getHistory: () => Promise<Thread[]>
            saveThread: (thread: Thread) => Promise<boolean>
            deleteThread: (id: string) => Promise<boolean>
            clearHistory: () => Promise<boolean>
            listOllamaModels: () => Promise<string[]>
            listLMStudioModels: () => Promise<string[]>
            estimateCost: (query: string, selectedMode?: string, budgetPolicy?: BudgetPolicy) => Promise<CostEstimate>
            minimizeWindow: () => Promise<void>
            maximizeWindow: () => Promise<void>
            closeWindow: () => Promise<void>
            onMenuNewSearch: (callback: () => void) => () => void
            onMenuOpenSettings: (callback: () => void) => () => void
            onMenuOpenKB: (callback: () => void) => () => void
            onMenuAbout: (callback: () => void) => () => void
            getKnowledgeBases: () => Promise<KnowledgeBase[]>
            createKnowledgeBase: (name: string, description: string) => Promise<KnowledgeBase>
            deleteKnowledgeBase: (id: string) => Promise<boolean>
            addDocumentToKB: (kbId: string, name: string, type: string, content: string, sourceUrl?: string) => Promise<Document>
            deleteDocument: (docId: string) => Promise<boolean>
            searchKnowledgeBase: (kbId: string, query: string) => Promise<Document[]>
            searchAllKnowledgeBases: (query: string, kbIds?: string[]) => Promise<CrossKBSearchResult[]>
            exportKBSnapshot: (kbId: string, targetFilePath?: string) => Promise<KBSnapshotExportResult>
            importKBSnapshot: (snapshotFilePath: string) => Promise<KBSnapshotImportResult>
            ragQuery: (query: string, options: { useLocalContext: boolean; useWebSearch: boolean; kbId?: string; kbIds?: string[] }) => Promise<string>
            ragQueryStream: (query: string, options: { useLocalContext: boolean; useWebSearch: boolean; kbId?: string; kbIds?: string[] }, callback: (event: RAGStreamEvent) => void) => { cancel: () => void }
            // File ingestion (drag-and-drop)
            ingestFile: (filePath: string, kbId: string) => Promise<IngestResult>
            ingestFiles: (filePaths: string[], kbId: string) => Promise<IngestBatchResult[]>
            // Cache & observability
            getCacheStats: () => Promise<CacheStats>
            clearRAGCache: () => Promise<boolean>
            getTraceStats: () => Promise<TraceStats>
            getRecentTraces: (limit?: number) => Promise<any[]>
        }
    }
}

export { }
