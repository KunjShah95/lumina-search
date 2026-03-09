import { contextBridge, ipcRenderer } from 'electron'
import { AgentEvent, AppSettings, SearchOpts, Thread, Collection, BudgetPolicy, CostEstimate, OnlineEvalFeedback, MemoryFact } from '../main/agents/types'

// Safe IPC invoke wrapper with error handling
async function safeInvoke<T>(channel: string, ...args: any[]): Promise<T> {
    try {
        return await ipcRenderer.invoke(channel, ...args)
    } catch (error) {
        console.error(`IPC Error [${channel}]:`, error)
        throw error
    }
}

// Safe IPC send wrapper
function safeSend(channel: string, ...args: any[]): void {
    try {
        ipcRenderer.send(channel, ...args)
    } catch (error) {
        console.error(`IPC Send Error [${channel}]:`, error)
    }
}

// Expose safe API to renderer via contextBridge
contextBridge.exposeInMainWorld('api', {
    // ── Search (streaming) ─────────────────────────────────
    search: (
        query: string,
        opts: SearchOpts,
        onEvent: (event: AgentEvent) => void
    ): string => {
        const requestId = `s_${Date.now()}_${Math.random().toString(36).slice(2)}`

        const cleanup = () => {
            ipcRenderer.removeListener(`search:error:${requestId}`, errorHandler)
            ipcRenderer.removeListener(`search:event:${requestId}`, eventHandler)
        }

        // Setup error handler for this search
        const errorHandler = (_e: any, error: any) => {
            console.error('Search error:', error)
            onEvent({ type: 'error', message: error?.message || 'Search failed' })
            cleanup()
        }

        const eventHandler = (_e: any, event: AgentEvent) => {
            onEvent(event)

            if (event?.type === 'done' || event?.type === 'error') {
                cleanup()
            }
        }

        ipcRenderer.on(`search:error:${requestId}`, errorHandler)
        ipcRenderer.on(`search:event:${requestId}`, eventHandler)
        safeSend('search:start', { query, opts, requestId })

        return requestId
    },
    cancelSearch: (requestId: string) => {
        ipcRenderer.removeAllListeners(`search:event:${requestId}`)
        ipcRenderer.removeAllListeners(`search:error:${requestId}`)
    },

    // ── Settings ───────────────────────────────────────────
    getSettings: (): Promise<AppSettings> => safeInvoke('settings:get'),
    setSettings: (settings: AppSettings): Promise<boolean> => safeInvoke('settings:set', settings),
    getUpdaterStatus: (): Promise<{
        available: boolean
        currentVersion: string
        latestVersion?: string
        releaseName?: string
        releaseNotes?: string
        stagingPercentage?: number
    }> => safeInvoke('updater:status'),
    checkForUpdates: (): Promise<boolean> => safeInvoke('updater:check'),
    downloadUpdate: (): Promise<boolean> => safeInvoke('updater:download'),
    installUpdate: (): Promise<boolean> => safeInvoke('updater:install'),
    skipUpdateVersion: (version: string): Promise<boolean> => safeInvoke('updater:skip-version', version),
    // ── History ────────────────────────────────────────────
    getHistory: (): Promise<Thread[]> => safeInvoke('history:get'),
    saveThread: (thread: Thread): Promise<boolean> => safeInvoke('history:save', thread),
    deleteThread: (id: string): Promise<boolean> => safeInvoke('history:delete', id),
    clearHistory: (): Promise<boolean> => safeInvoke('history:clear'),

    // ── Ollama ─────────────────────────────────────────────
    listOllamaModels: (): Promise<string[]> => safeInvoke('ollama:list-models'),

    // ── LM Studio ─────────────────────────────────────────
    listLMStudioModels: (): Promise<string[]> => safeInvoke('lmstudio:list-models'),

    // ── Cost planner ───────────────────────────────────────
    estimateCost: (query: string, selectedMode?: string, budgetPolicy?: BudgetPolicy): Promise<CostEstimate> =>
        safeInvoke('cost:estimate', query, selectedMode, budgetPolicy),

    // ── Evaluation harness ─────────────────────────────────
    runOfflineEval: (datasetPath?: string, baselinePath?: string, gate?: boolean) =>
        safeInvoke('eval:offline:run', datasetPath, baselinePath, gate),
    generateWeeklyEvalReport: (resultsDir?: string, reportsDir?: string) =>
        safeInvoke('eval:weekly:report', resultsDir, reportsDir),
    recordEvalFeedback: (payload: {
        threadId: string
        query?: string
        answerPreview?: string
        vote: 'up' | 'down'
        citedCorrectly?: boolean
        notes?: string
        source?: 'manual' | 'prompt'
    }): Promise<OnlineEvalFeedback> => ipcRenderer.invoke('eval:feedback:record', payload),
    listEvalFeedback: (limit?: number): Promise<OnlineEvalFeedback[]> => ipcRenderer.invoke('eval:feedback:list', limit),
    getEvalFeedbackStats: (): Promise<{ total: number; positiveRate: number; citationCorrectRate: number; last7dCount: number }> =>
        ipcRenderer.invoke('eval:feedback:stats'),

    // ── Personalization memory (opt-in) ─────────────────────
    addMemoryFact: (payload: {
        threadId: string
        key?: string
        value: string
        tags?: string[]
        ttlDays?: number
        source?: 'manual' | 'auto'
    }): Promise<MemoryFact> => ipcRenderer.invoke('memory:add', payload),
    listMemoryFacts: (threadId?: string, includeExpired?: boolean): Promise<MemoryFact[]> =>
        ipcRenderer.invoke('memory:list', threadId, includeExpired),
    deleteMemoryFact: (id: string): Promise<boolean> => ipcRenderer.invoke('memory:delete', id),
    clearThreadMemories: (threadId: string): Promise<{ deleted: number }> => ipcRenderer.invoke('memory:clear-thread', threadId),
    pruneExpiredMemories: (): Promise<{ deleted: number }> => ipcRenderer.invoke('memory:prune-expired'),
    previewMemoryContext: (threadId: string, query: string, maxFacts?: number): Promise<{ memories: MemoryFact[]; text: string }> =>
        ipcRenderer.invoke('memory:preview-context', threadId, query, maxFacts),

    // ── Window controls ────────────────────────────────────
    minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),

    // ── Menu events ────────────────────────────────────────
    onMenuNewSearch: (callback: () => void) => {
        ipcRenderer.on('menu:new-search', callback)
        return () => ipcRenderer.removeListener('menu:new-search', callback)
    },
    onMenuOpenSettings: (callback: () => void) => {
        ipcRenderer.on('menu:open-settings', callback)
        return () => ipcRenderer.removeListener('menu:open-settings', callback)
    },
    onMenuAbout: (callback: () => void) => {
        ipcRenderer.on('menu:about', callback)
        return () => ipcRenderer.removeListener('menu:about', callback)
    },
    onMenuOpenKB: (callback: () => void) => {
        ipcRenderer.on('menu:open-kb', callback)
        return () => ipcRenderer.removeListener('menu:open-kb', callback)
    },

    // ── Knowledge Base ───────────────────────────────────────
    getKnowledgeBases: () => ipcRenderer.invoke('kb:get-all'),
    createKnowledgeBase: (name: string, description: string) => ipcRenderer.invoke('kb:create', name, description),
    deleteKnowledgeBase: (id: string) => ipcRenderer.invoke('kb:delete', id),
    addDocumentToKB: (kbId: string, name: string, type: string, content: string, sourceUrl?: string) =>
        ipcRenderer.invoke('kb:add-document', kbId, name, type, content, sourceUrl),
    deleteDocument: (docId: string) => ipcRenderer.invoke('kb:delete-document', docId),
    searchKnowledgeBase: (kbId: string, query: string) => ipcRenderer.invoke('kb:search', kbId, query),
    searchAllKnowledgeBases: (query: string, kbIds?: string[]) => ipcRenderer.invoke('kb:search-all', query, kbIds),
    exportKBSnapshot: (kbId: string, targetFilePath?: string) => ipcRenderer.invoke('kb:snapshot:export', kbId, targetFilePath),
    importKBSnapshot: (snapshotFilePath: string) => ipcRenderer.invoke('kb:snapshot:import', snapshotFilePath),
    ragQuery: (query: string, options: { useLocalContext: boolean; useWebSearch: boolean; kbId?: string; kbIds?: string[] }) => ipcRenderer.invoke('rag:query', query, options),
    ragQueryStream: (query: string, options: { useLocalContext: boolean; useWebSearch: boolean; kbId?: string; kbIds?: string[] }, callback: (event: any) => void) => {
        ipcRenderer.send('rag:query:stream', { query, options });
        const handler = (_event: any, data: any) => {
            callback(data);

            if (data?.type === 'done' || data?.type === 'error') {
                ipcRenderer.removeListener('rag:stream:event', handler);
            }
        };
        ipcRenderer.on('rag:stream:event', handler);
        return {
            cancel: () => {
                ipcRenderer.removeListener('rag:stream:event', handler);
            }
        };
    },

    // ── File Ingestion (drag-and-drop) ──────────────────────
    ingestFile: (filePath: string, kbId: string) => ipcRenderer.invoke('rag:ingest-file', filePath, kbId),
    ingestFiles: (filePaths: string[], kbId: string) => ipcRenderer.invoke('rag:ingest-files', filePaths, kbId),

    // ── Cache & Observability ──────────────────────────────
    getCacheStats: () => ipcRenderer.invoke('rag:cache-stats'),
    clearRAGCache: () => ipcRenderer.invoke('rag:cache-clear'),
    getTraceStats: () => ipcRenderer.invoke('rag:trace-stats'),
    getRecentTraces: (limit?: number) => ipcRenderer.invoke('rag:recent-traces', limit),

    // ── Thread utilities ─────────────────────────────────────
    autoTagThread: (thread: Thread): Promise<string[]> => ipcRenderer.invoke('thread:auto-tag', thread),
    exportThreadPDF: (thread: Thread): Promise<{ success: boolean; filePath?: string }> =>
        ipcRenderer.invoke('thread:export-pdf', thread),

    // ── Scheduler ────────────────────────────────────────────
    createScheduledSearch: (query: string, focusMode: string, intervalMs: number) =>
        ipcRenderer.invoke('scheduler:create', query, focusMode, intervalMs),
    getScheduledSearches: () => ipcRenderer.invoke('scheduler:get-all'),
    cancelScheduledSearch: (id: string) => ipcRenderer.invoke('scheduler:cancel', id),
    deleteScheduledSearch: (id: string) => ipcRenderer.invoke('scheduler:delete', id),

    // Analytics
    getAnalyticsEvents: (options?: { startDate?: number; endDate?: number; eventTypes?: string[]; format?: 'json' | 'csv' }) =>
        ipcRenderer.invoke('analytics:get-events', options ?? {}),
    getAnalyticsSummary: (period: 'hourly' | 'daily' | 'monthly', count?: number) =>
        ipcRenderer.invoke('analytics:get-summary', period, count),
    exportAnalytics: (options?: { startDate?: number; endDate?: number; eventTypes?: string[]; format?: 'json' | 'csv' }) =>
        ipcRenderer.invoke('analytics:export', options ?? { format: 'json' }),
    clearAnalytics: () => ipcRenderer.invoke('analytics:clear-all'),

    // ── v1.1.0 Search Analytics ────────────────────────────────
    searchAnalyticsRecord: (params: {
        query: string
        resultCount: number
        executionTimeMs: number
        sourcesUsed: string[]
        llmModel?: string
        success?: boolean
    }) => ipcRenderer.invoke('search-analytics:record', params),
    searchAnalyticsGet: () => ipcRenderer.invoke('search-analytics:get'),
    searchAnalyticsInsights: (options?: { timeRangeMs?: number }) => ipcRenderer.invoke('search-analytics:insights', options),
    searchAnalyticsRate: (recordId: string, rating: number, notes?: string) =>
        ipcRenderer.invoke('search-analytics:rate', recordId, rating, notes),

    // ── Saved Searches (v1.1.0) ────────────────────────────────
    listSavedSearches: (filter?: any) => ipcRenderer.invoke('saved-searches:list', filter),
    createSavedSearch: (params: any) => ipcRenderer.invoke('saved-searches:create', params),
    updateSavedSearch: (id: string, updates: any) => ipcRenderer.invoke('saved-searches:update', id, updates),
    deleteSavedSearch: (id: string) => ipcRenderer.invoke('saved-searches:delete', id),
    executeSavedSearch: (id: string) => ipcRenderer.invoke('saved-searches:execute', id),
    toggleSavedSearchStar: (id: string) => ipcRenderer.invoke('saved-searches:toggle-star', id),
    duplicateSavedSearch: (id: string, newName?: string) => ipcRenderer.invoke('saved-searches:duplicate', id, newName),
    getSavedSearchStats: () => ipcRenderer.invoke('saved-searches:get-stats'),
    enableSavedSearchRefresh: (id: string, intervalSeconds: number) => ipcRenderer.invoke('saved-searches:enable-refresh', id, intervalSeconds),
    stopSavedSearchRefresh: (id: string) => ipcRenderer.invoke('saved-searches:stop-refresh', id),
    exportSavedSearches: (filter?: any) => ipcRenderer.invoke('saved-searches:export', filter),
    importSavedSearches: (jsonData: string) => ipcRenderer.invoke('saved-searches:import', jsonData),

    // ── PDF Export (v1.1.0) ────────────────────────────────────
    generateAdvancedPDF: (thread: Thread, options: any) => ipcRenderer.invoke('pdf-export:generate', thread, options),

    // ── API Server (v1.1.0) ────────────────────────────────────
    getAPIServerStatus: () => ipcRenderer.invoke('api-server:get-status'),
    toggleAPIServer: (active: boolean) => ipcRenderer.invoke('api-server:toggle', active),
    getAPIServerConfig: () => ipcRenderer.invoke('api-server:get-config'),
    updateAPIServerConfig: (config: any) => ipcRenderer.invoke('api-server:update-config', config),

    // ── Plugins ──────────────────────────────────────────────
    listPlugins: () => ipcRenderer.invoke('plugins:list'),
    installPlugin: (sourcePath: string) => ipcRenderer.invoke('plugins:install', sourcePath),
    uninstallPlugin: (name: string) => ipcRenderer.invoke('plugins:uninstall', name),

    // ── Collections / Smart Collections ──────────────────────
    getCollections: (): Promise<Collection[]> => ipcRenderer.invoke('collections:get-all'),
    createCollection: (name: string, description: string, filterQuery?: string): Promise<Collection> =>
        ipcRenderer.invoke('collections:create', name, description, filterQuery),
    updateCollection: (collection: Collection): Promise<boolean> =>
        ipcRenderer.invoke('collections:update', collection),
    deleteCollection: (id: string): Promise<boolean> =>
        ipcRenderer.invoke('collections:delete', id),

    // ── Batch search ─────────────────────────────────────────
    executeBatchSearch: (payload: {
        queries: string[]
        concurrency?: number
        sequential?: boolean
        searchOptions?: Partial<SearchOpts>
    }) => ipcRenderer.invoke('batch-search:execute', payload),
    getBatchSearchResult: (batchId: string) => ipcRenderer.invoke('batch-search:get', batchId),
    listBatchSearches: () => ipcRenderer.invoke('batch-search:list'),
    cancelBatchSearch: (batchId: string) => ipcRenderer.invoke('batch-search:cancel', batchId),
})


