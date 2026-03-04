import { AgentEvent, AppSettings, SearchOpts, Thread, BudgetPolicy, CostEstimate, Collection, OnlineEvalFeedback, MemoryFact } from '../../main/agents/types'

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

interface ScheduledSearch {
    id: string
    query: string
    focusMode: string
    intervalMs: number
    lastRun: number
}

interface UpdateStatus {
    available: boolean
    currentVersion: string
    latestVersion?: string
    releaseName?: string
    releaseNotes?: string
    stagingPercentage?: number
}

declare global {
    interface Window {
        api: {
            search: (query: string, opts: SearchOpts, onEvent: (e: AgentEvent) => void) => string
            cancelSearch: (requestId: string) => void
            getSettings: () => Promise<AppSettings>
            setSettings: (settings: AppSettings) => Promise<boolean>
            getUpdaterStatus: () => Promise<UpdateStatus>
            checkForUpdates: () => Promise<boolean>
            downloadUpdate: () => Promise<boolean>
            installUpdate: () => Promise<boolean>
            skipUpdateVersion: (version: string) => Promise<boolean>
            getHistory: () => Promise<Thread[]>
            saveThread: (thread: Thread) => Promise<boolean>
            deleteThread: (id: string) => Promise<boolean>
            clearHistory: () => Promise<boolean>
            listOllamaModels: () => Promise<string[]>
            listLMStudioModels: () => Promise<string[]>
            estimateCost: (query: string, selectedMode?: string, budgetPolicy?: BudgetPolicy) => Promise<CostEstimate>
            runOfflineEval: (datasetPath?: string, baselinePath?: string, gate?: boolean) => Promise<any>
            generateWeeklyEvalReport: (resultsDir?: string, reportsDir?: string) => Promise<{ reportPath: string }>
            recordEvalFeedback: (payload: {
                threadId: string
                query?: string
                answerPreview?: string
                vote: 'up' | 'down'
                citedCorrectly?: boolean
                notes?: string
                source?: 'manual' | 'prompt'
            }) => Promise<OnlineEvalFeedback>
            listEvalFeedback: (limit?: number) => Promise<OnlineEvalFeedback[]>
            getEvalFeedbackStats: () => Promise<{ total: number; positiveRate: number; citationCorrectRate: number; last7dCount: number }>
            addMemoryFact: (payload: {
                threadId: string
                key?: string
                value: string
                tags?: string[]
                ttlDays?: number
                source?: 'manual' | 'auto'
            }) => Promise<MemoryFact>
            listMemoryFacts: (threadId?: string, includeExpired?: boolean) => Promise<MemoryFact[]>
            deleteMemoryFact: (id: string) => Promise<boolean>
            clearThreadMemories: (threadId: string) => Promise<{ deleted: number }>
            pruneExpiredMemories: () => Promise<{ deleted: number }>
            previewMemoryContext: (threadId: string, query: string, maxFacts?: number) => Promise<{ memories: MemoryFact[]; text: string }>
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
            // Thread utilities
            autoTagThread: (thread: Thread) => Promise<string[]>
            exportThreadPDF: (thread: Thread) => Promise<{ success: boolean; filePath?: string }>
            // Scheduler
            createScheduledSearch: (query: string, focusMode: string, intervalMs: number) => Promise<ScheduledSearch>
            getScheduledSearches: () => Promise<ScheduledSearch[]>
            cancelScheduledSearch: (id: string) => Promise<boolean>
            deleteScheduledSearch: (id: string) => Promise<boolean>
            // Analytics
            getAnalyticsEvents: (options?: { startDate?: number; endDate?: number; eventTypes?: string[]; format?: 'json' | 'csv' }) => Promise<any[]>
            getAnalyticsSummary: (period: 'hourly' | 'daily' | 'monthly', count?: number) => Promise<any[]>
            exportAnalytics: (options?: { startDate?: number; endDate?: number; eventTypes?: string[]; format?: 'json' | 'csv' }) => Promise<string>
            clearAnalytics: () => Promise<{ success: boolean }>
            // Plugins
            listPlugins: () => Promise<any[]>
            installPlugin: (sourcePath: string) => Promise<any>
            uninstallPlugin: (name: string) => Promise<boolean>
            // Collections
            getCollections: () => Promise<Collection[]>
            createCollection: (name: string, description: string, filterQuery?: string) => Promise<Collection>
            updateCollection: (collection: Collection) => Promise<boolean>
            deleteCollection: (id: string) => Promise<boolean>
        }
    }
}

export { }
