import { contextBridge, ipcRenderer } from 'electron'
import { AgentEvent, AppSettings, SearchOpts, Thread, Collection, BudgetPolicy, CostEstimate } from '../main/agents/types'

// Expose safe API to renderer via contextBridge
contextBridge.exposeInMainWorld('api', {
    // ── Search (streaming) ─────────────────────────────────
    search: (
        query: string,
        opts: SearchOpts,
        onEvent: (event: AgentEvent) => void
    ): string => {
        const requestId = `s_${Date.now()}_${Math.random().toString(36).slice(2)}`
        ipcRenderer.on(`search:event:${requestId}`, (_e, event: AgentEvent) => onEvent(event))
        ipcRenderer.send('search:start', { query, opts, requestId })
        return requestId
    },
    cancelSearch: (requestId: string) => {
        ipcRenderer.removeAllListeners(`search:event:${requestId}`)
    },

    // ── Settings ───────────────────────────────────────────
    getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    setSettings: (settings: AppSettings): Promise<boolean> => ipcRenderer.invoke('settings:set', settings),

    // ── History ────────────────────────────────────────────
    getHistory: (): Promise<Thread[]> => ipcRenderer.invoke('history:get'),
    saveThread: (thread: Thread): Promise<boolean> => ipcRenderer.invoke('history:save', thread),
    deleteThread: (id: string): Promise<boolean> => ipcRenderer.invoke('history:delete', id),
    clearHistory: (): Promise<boolean> => ipcRenderer.invoke('history:clear'),

    // ── Ollama ─────────────────────────────────────────────
    listOllamaModels: (): Promise<string[]> => ipcRenderer.invoke('ollama:list-models'),

    // ── LM Studio ─────────────────────────────────────────
    listLMStudioModels: (): Promise<string[]> => ipcRenderer.invoke('lmstudio:list-models'),

    // ── Cost planner ───────────────────────────────────────
    estimateCost: (query: string, selectedMode?: string, budgetPolicy?: BudgetPolicy): Promise<CostEstimate> =>
        ipcRenderer.invoke('cost:estimate', query, selectedMode, budgetPolicy),

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
        const requestId = `rag_stream_${Date.now()}`;
        ipcRenderer.send('rag:query:stream', { query, options });
        const handler = (_event: any, data: any) => callback(data);
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
})
