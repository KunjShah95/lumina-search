import { app, BrowserWindow, ipcMain, shell, Tray, Menu, globalShortcut, Notification, nativeImage, MenuItemConstructorOptions, dialog } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { SearchOrchestrator } from './agents/Orchestrator'
import { SearchOpts, Collection, BudgetPolicy } from './agents/types'
import { budgetPlanner } from './agents/BudgetPlanner'
import { listOllamaModels, listLMStudioModels } from './services/llm-router'
import { getSettingsFromDb, saveSettingsToDb, getAllThreads, saveThread as saveThreadDb, deleteThreadFromDb, clearAllThreads, searchThreads, initDatabase, migrateFromJson, getCollections, createCollection, deleteCollection, updateCollection } from './services/database'
import { getKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase, addDocumentToKnowledgeBase, deleteDocument, searchKnowledgeBase, searchAllKnowledgeBases, initKnowledgeBaseTables, exportKnowledgeBaseSnapshot, importKnowledgeBaseSnapshot } from './services/rag'
import { processRAGQuery, streamRAGQuery as processRAGQueryStream, RAGOptions } from './rag/orchestrator'
import { initSemanticCache, getCacheStats, clearCache } from './rag/semanticCache'
import { initObservability, getTraceStats, getRecentTraces } from './rag/observability'
import { documentIngestion } from './rag/ingestion'
import { exportToHTML } from './services/exportService'
import { autoTagThread, quickTag } from './services/tagService'
import { loadPlugins, getPlugins, installPlugin, uninstallPlugin } from './services/pluginManager'
import { scheduleSearch, cancelScheduledSearch, deleteScheduledSearch, getScheduledSearches, bootstrapScheduledSearches, setOnResultCallback } from './services/scheduler'
import { createLogger } from './services/logger'
import { validateString, validateNumber, validateFilePath, validateStringArray, validateOptional } from './services/validation'
import { getTaskQueue, TaskPriority } from './services/taskQueue'

const logger = createLogger('ipc')
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

interface WindowState {
    x?: number
    y?: number
    width: number
    height: number
    isMaximized?: boolean
}

function getWindowStatePath(): string {
    return join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): WindowState {
    try {
        const path = getWindowStatePath()
        if (fs.existsSync(path)) {
            return JSON.parse(fs.readFileSync(path, 'utf-8'))
        }
    } catch { }
    return { width: 1280, height: 800 }
}

function saveWindowState(win: BrowserWindow): void {
    try {
        const bounds = win.getBounds()
        const state: WindowState = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            isMaximized: win.isMaximized(),
        }
        fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2))
    } catch { }
}

function createWindow(): BrowserWindow {
    const state = loadWindowState()

    const win = new BrowserWindow({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#060608',
        show: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    })

    if (state.isMaximized) {
        win.maximize()
    }

    win.once('ready-to-show', () => {
        win.show()
    })

    win.on('close', (e) => {
        if (!isQuitting && process.platform !== 'darwin') {
            e.preventDefault()
            win.hide()
        }
        saveWindowState(win)
    })

    if (isDev) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173')
        win.webContents.openDevTools({ mode: 'detach' })
    } else {
        win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    return win
}

function createTray(): void {
    const icon = nativeImage.createEmpty()
    tray = new Tray(icon)
    tray.setToolTip('Lumina Search')

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show',
            click: () => {
                mainWindow?.show()
                mainWindow?.focus()
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true
                app.quit()
            }
        },
    ])

    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
        if (mainWindow?.isVisible()) {
            mainWindow.hide()
        } else {
            mainWindow?.show()
            mainWindow?.focus()
        }
    })
}

function createAppMenu(): void {
    const template: MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Search',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow?.webContents.send('menu:new-search')
                    }
                },
                { type: 'separator' },
                {
                    label: 'Knowledge Base',
                    accelerator: 'CmdOrCtrl+K',
                    click: () => {
                        mainWindow?.webContents.send('menu:open-kb')
                    }
                },
                { type: 'separator' },
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow?.webContents.send('menu:open-settings')
                    }
                },
                { type: 'separator' },
                {
                    label: 'Hide to Tray',
                    click: () => {
                        mainWindow?.hide()
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        isQuitting = true
                        app.quit()
                    }
                },
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                {
                    label: 'Always on Top',
                    type: 'checkbox',
                    click: (menuItem) => {
                        mainWindow?.setAlwaysOnTop(menuItem.checked)
                    }
                },
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Lumina Search',
                    click: () => {
                        mainWindow?.webContents.send('menu:about')
                    }
                },
            ]
        },
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}

function registerGlobalShortcut(): void {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
        if (mainWindow) {
            if (mainWindow.isVisible() && mainWindow.isFocused()) {
                mainWindow.hide()
            } else {
                mainWindow.show()
                mainWindow.focus()
            }
        }
    })
}

function showNotification(title: string, body: string): void {
    if (Notification.isSupported()) {
        new Notification({ title, body }).show()
    }
}

// ── IPC: Search (streaming) ────────────────────────────────
ipcMain.on('search:start', async (event, { query, opts, requestId }: { query: string; opts: SearchOpts; requestId: string }) => {
    try {
        validateString(query, 'query', { minLength: 1, maxLength: 2000 })
        validateString(requestId, 'requestId', { minLength: 1, maxLength: 256 })
        if (!opts || typeof opts !== 'object') {
            throw new Error('Invalid SearchOpts')
        }
        
        const orchestrator = new SearchOrchestrator()
        for await (const agentEvent of orchestrator.run(query, opts)) {
            if (!event.sender.isDestroyed()) {
                event.sender.send(`search:event:${requestId}`, agentEvent)
            }
            if (agentEvent.type === 'done') {
                showNotification('Search Complete', `Finished: ${query.slice(0, 50)}`)
            }
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('search:start validation/execution failed', err)
        if (!event.sender.isDestroyed()) {
            event.sender.send(`search:event:${requestId}`, { type: 'error', message })
        }
    }
})

// ── IPC: Window controls ─────────────────────────────────────
ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
    } else {
        mainWindow?.maximize()
    }
})

ipcMain.handle('window:close', () => {
    mainWindow?.hide()
})

// ── IPC: Settings ──────────────────────────────────────────
ipcMain.handle('settings:get', () => getSettingsFromDb())
ipcMain.handle('settings:set', (_e, settings) => { 
    try {
        if (!settings || typeof settings !== 'object') {
            throw new Error('Invalid settings object')
        }
        saveSettingsToDb(settings)
        return true
    } catch (err) {
        logger.error('settings:set validation failed', err)
        throw err
    }
})

// ── IPC: History ───────────────────────────────────────────
ipcMain.handle('history:get', () => getAllThreads())
ipcMain.handle('history:save', (_e, thread) => { saveThreadDb(thread); return true })
ipcMain.handle('history:delete', (_e, id: string) => {
    try {
        const validated = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        deleteThreadFromDb(validated)
        return true
    } catch (err) {
        logger.error('history:delete validation failed', err)
        throw err
    }
})
ipcMain.handle('history:clear', () => { clearAllThreads(); return true })

// ── IPC: Search threads ─────────────────────────────────────
ipcMain.handle('history:search', (_e, query: string) => {
    try {
        const validated = validateString(query, 'query', { minLength: 1, maxLength: 2000 })
        return searchThreads(validated)
    } catch (err) {
        logger.error('history:search validation failed', err)
        throw err
    }
})

// ── IPC: Collections / Smart Collections ─────────────────────
ipcMain.handle('collections:get-all', () => getCollections())
ipcMain.handle('collections:create', (_e, name: string, description: string, filterQuery?: string) => {
    try {
        const validName = validateString(name, 'name', { minLength: 1, maxLength: 256 })
        const validDesc = validateString(description, 'description', { maxLength: 1024 })
        const validQuery = validateOptional(filterQuery, (v) => validateString(v, 'filterQuery', { maxLength: 2000 }))
        return createCollection(validName, validDesc, validQuery)
    } catch (err) {
        logger.error('collections:create validation failed', err)
        throw err
    }
})
ipcMain.handle('collections:update', (_e, collection: Collection) => {
    try {
        if (!collection || typeof collection !== 'object') {
            throw new Error('Invalid collection object')
        }
        if (collection.id) validateString(collection.id, 'collection.id', { minLength: 1, maxLength: 256 })
        if (collection.name) validateString(collection.name, 'collection.name', { minLength: 1, maxLength: 256 })
        updateCollection(collection)
        return true
    } catch (err) {
        logger.error('collections:update validation failed', err)
        throw err
    }
})
ipcMain.handle('collections:delete', (_e, id: string) => {
    try {
        const validId = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        deleteCollection(validId)
        return true
    } catch (err) {
        logger.error('collections:delete validation failed', err)
        throw err
    }
})

// ── IPC: Ollama model list ─────────────────────────────────
ipcMain.handle('ollama:list-models', async () => {
    const settings = getSettingsFromDb()
    return listOllamaModels(settings.ollamaUrl)
})

// ── IPC: LM Studio model list ────────────────────────────────
ipcMain.handle('lmstudio:list-models', async () => {
    const settings = getSettingsFromDb()
    return listLMStudioModels(settings.lmstudioUrl)
})

// ── IPC: Cost estimate ────────────────────────────────────────
ipcMain.handle('cost:estimate', (_e, query: string, selectedMode?: string, budgetPolicy?: BudgetPolicy) => {
    try {
        const validQuery = validateString(query, 'query', { minLength: 1, maxLength: 5000 })
        const mode = (selectedMode || 'web').toLowerCase()
        const contextCharsByMode: Record<string, number> = {
            local: 5000,
            all: 7000,
            'hybrid-rag': 7000,
            academic: 4500,
            code: 4200,
            web: 3000,
            reddit: 2500,
            compare: 5200,
        }

        const contextChars = contextCharsByMode[mode] ?? 3000
        const settings = getSettingsFromDb()

        return budgetPlanner.estimate({
            query: validQuery,
            modelId: settings.defaultModel,
            contextChars,
            policy: budgetPolicy,
            sessionId: 'ipc-preview',
            confidenceGap: 0.1,
        })
    } catch (err) {
        logger.error('cost:estimate validation failed', err)
        throw err
    }
})

// ── IPC: Knowledge Base ──────────────────────────────────────
ipcMain.handle('kb:get-all', () => getKnowledgeBases())

ipcMain.handle('kb:create', (_e, name: string, description: string) => {
    try {
        const validName = validateString(name, 'name', { minLength: 1, maxLength: 256 })
        const validDesc = validateString(description, 'description', { maxLength: 1024 })
        return createKnowledgeBase(validName, validDesc)
    } catch (err) {
        logger.error('kb:create validation failed', err)
        throw err
    }
})

ipcMain.handle('kb:delete', (_e, id: string) => {
    try {
        const validId = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        deleteKnowledgeBase(validId)
        return true
    } catch (err) {
        logger.error('kb:delete validation failed', err)
        throw err
    }
})

ipcMain.handle('kb:add-document', (_e, kbId: string, name: string, type: string, content: string, sourceUrl?: string) => {
    try {
        const validKbId = validateString(kbId, 'kbId', { minLength: 1, maxLength: 256 })
        const validName = validateString(name, 'name', { minLength: 1, maxLength: 256 })
        const validType = validateString(type, 'type', { minLength: 1, maxLength: 32 })
        const validContent = validateString(content, 'content', { minLength: 1, maxLength: 10000000 })
        const validUrl = validateOptional(sourceUrl, (v) => validateString(v, 'sourceUrl', { maxLength: 2048 }))
        return addDocumentToKnowledgeBase(validKbId, validName, validType as any, validContent, validUrl)
    } catch (err) {
        logger.error('kb:add-document validation failed', err)
        throw err
    }
})

ipcMain.handle('kb:delete-document', (_e, docId: string) => {
    try {
        const validDocId = validateString(docId, 'docId', { minLength: 1, maxLength: 256 })
        deleteDocument(validDocId)
        return true
    } catch (err) {
        logger.error('kb:delete-document validation failed', err)
        throw err
    }
})

ipcMain.handle('kb:search', (_e, kbId: string, query: string) => {
    try {
        const validKbId = validateString(kbId, 'kbId', { minLength: 1, maxLength: 256 })
        const validQuery = validateString(query, 'query', { minLength: 1, maxLength: 2000 })
        return searchKnowledgeBase(validKbId, validQuery)
    } catch (err) {
        logger.error('kb:search validation failed', err)
        throw err
    }
})

ipcMain.handle('kb:search-all', (_e, query: string, kbIds?: string[]) => {
    try {
        const validQuery = validateString(query, 'query', { minLength: 1, maxLength: 2000 })
        const validKbIds = validateOptional(kbIds, (v) => validateStringArray(v, 'kbIds', { maxLength: 100 }))
        return searchAllKnowledgeBases(validQuery, validKbIds)
    } catch (err) {
        logger.error('kb:search-all validation failed', err)
        throw err
    }
})

// ── IPC: KB snapshots ───────────────────────────────────────
ipcMain.handle('kb:snapshot:export', (_e, kbId: string, targetFilePath?: string) => {
    try {
        const validKbId = validateString(kbId, 'kbId', { minLength: 1, maxLength: 256 })
        const validTarget = validateOptional(targetFilePath, (v) => validateFilePath(v, 'targetFilePath'))
        return exportKnowledgeBaseSnapshot(validKbId, validTarget)
    } catch (err) {
        logger.error('kb:snapshot:export validation failed', err)
        throw err
    }
})

ipcMain.handle('kb:snapshot:import', (_e, snapshotFilePath: string) => {
    try {
        const validPath = validateFilePath(snapshotFilePath, 'snapshotFilePath')
        return importKnowledgeBaseSnapshot(validPath)
    } catch (err) {
        logger.error('kb:snapshot:import validation failed', err)
        throw err
    }
})

// ── IPC: Hybrid RAG Query ──────────────────────────────────
ipcMain.handle('rag:query', async (_e, query: string, options: RAGOptions) => {
    try {
        const validQuery = validateString(query, 'query', { minLength: 1, maxLength: 2000 })
        if (!options || typeof options !== 'object') {
            throw new Error('Invalid RAGOptions')
        }
        return processRAGQuery(validQuery, options)
    } catch (err) {
        logger.error('rag:query validation failed', err)
        throw err
    }
})

// ── IPC: Hybrid RAG Query (Streaming) ─────────────────────────
ipcMain.on('rag:query:stream', async (event, { query, options }: { query: string; options: RAGOptions }) => {
    try {
        for await (const chunk of processRAGQueryStream(query, options)) {
            if (!event.sender.isDestroyed()) {
                event.sender.send('rag:stream:event', chunk)
            }
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        if (!event.sender.isDestroyed()) {
            event.sender.send('rag:stream:event', { type: 'error', message })
        }
    }
})

// ── IPC: File Upload / Ingestion ──────────────────────────────
const taskQueue = getTaskQueue(3) // max 3 concurrent ingestion tasks

ipcMain.handle('rag:ingest-file', async (_e, filePath: string, kbId: string) => {
    try {
        const validFilePath = validateFilePath(filePath, 'filePath')
        const validKbId = validateString(kbId, 'kbId', { minLength: 1, maxLength: 256 })
        
        // Queue ingestion as a HIGH priority task
        const result = await taskQueue.enqueue({
            id: `ingest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: `Ingest: ${validFilePath.split('\\').pop() || validFilePath}`,
            priority: TaskPriority.HIGH,
            execute: async () => {
                const { content, type, name } = await documentIngestion.parseFile(validFilePath)
                const doc = await addDocumentToKnowledgeBase(validKbId, name, type, content, undefined)
                return { success: true, chunksCreated: doc.chunks.length }
            },
            maxRetries: 1,
        })
        
        return result
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('rag:ingest-file failed', err)
        return { success: false, error: message }
    }
})

ipcMain.handle('rag:ingest-files', async (_e, filePaths: string[], kbId: string) => {
    try {
        const validFilePaths = validateStringArray(filePaths, 'filePaths', { maxLength: 100 })
        const validKbId = validateString(kbId, 'kbId', { minLength: 1, maxLength: 256 })
        for (const filePath of validFilePaths) {
            validateFilePath(filePath, 'filePath')
        }
        
        // Queue all files as separate NORMAL priority tasks
        const results: { file: string; success: boolean; chunks?: number; error?: string }[] = []
        const taskPromises = validFilePaths.map((filePath) =>
            taskQueue
                .enqueue({
                    id: `ingest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    name: `Ingest: ${filePath.split('\\').pop() || filePath}`,
                    priority: TaskPriority.NORMAL,
                    execute: async () => {
                        const { content, type, name } = await documentIngestion.parseFile(filePath)
                        const doc = await addDocumentToKnowledgeBase(validKbId, name, type, content, undefined)
                        return { file: filePath, success: true, chunks: doc.chunks.length }
                    },
                    maxRetries: 1,
                })
                .then((result) => {
                    results.push(result)
                })
                .catch((err: unknown) => {
                    results.push({
                        file: filePath,
                        success: false,
                        error: err instanceof Error ? err.message : String(err),
                    })
                }),
        )
        
        await Promise.all(taskPromises)
        return results
    } catch (err: unknown) {
        logger.error('rag:ingest-files validation failed', err)
        return [{ file: 'unknown', success: false, error: err instanceof Error ? err.message : String(err) }]
    }
})


// ── IPC: Task Queue metrics ──────────────────────────────────
ipcMain.handle('queue:metrics', () => taskQueue.getDetailedMetrics())
ipcMain.handle('queue:status', () => taskQueue.getStatus())
ipcMain.handle('queue:clear-history', () => {
    taskQueue.clearHistory()
    return true
})
ipcMain.handle('rag:cache-clear', () => { clearCache(); return true })
ipcMain.handle('rag:trace-stats', () => getTraceStats())
ipcMain.handle('rag:recent-traces', (_e, limit?: number) => getRecentTraces(limit))

// ── IPC: Thread utilities (tagging, export) ───────────────────
ipcMain.handle('thread:auto-tag', async (_e, thread) => {
    try {
        const tags = await autoTagThread(thread)
        return tags
    } catch {
        return quickTag(thread)
    }
})

ipcMain.handle('thread:export-pdf', async (_e, thread) => {
    if (!mainWindow) {
        throw new Error('Main window not ready')
    }

    const html = exportToHTML(thread)

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Conversation as PDF',
        defaultPath: `${thread.title || 'conversation'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })

    if (canceled || !filePath) {
        return { success: false }
    }

    const win = new BrowserWindow({
        show: false,
        webPreferences: {
            sandbox: false,
        },
    })

    try {
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
        const pdfBuffer = await win.webContents.printToPDF({})
        fs.writeFileSync(filePath, pdfBuffer)
        return { success: true, filePath }
    } finally {
        win.destroy()
    }
})

// ── IPC: Scheduler (recurring searches) ───────────────────────
ipcMain.handle('scheduler:create', (_e, query: string, focusMode: string, intervalMs: number) => {
    try {
        const validQuery = validateString(query, 'query', { minLength: 1, maxLength: 2000 })
        const validFocusMode = validateString(focusMode, 'focusMode', { minLength: 1, maxLength: 32 })
        const validInterval = validateNumber(intervalMs, 'intervalMs', { min: 60000, isInteger: true })
        return scheduleSearch(validQuery, validFocusMode, validInterval)
    } catch (err) {
        logger.error('scheduler:create validation failed', err)
        throw err
    }
})

ipcMain.handle('scheduler:get-all', () => getScheduledSearches())
ipcMain.handle('scheduler:cancel', (_e, id: string) => {
    try {
        const validId = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        cancelScheduledSearch(validId)
        return true
    } catch (err) {
        logger.error('scheduler:cancel validation failed', err)
        throw err
    }
})
ipcMain.handle('scheduler:delete', (_e, id: string) => {
    try {
        const validId = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        deleteScheduledSearch(validId)
        return true
    } catch (err) {
        logger.error('scheduler:delete validation failed', err)
        throw err
    }
})

// ── IPC: Plugins ──────────────────────────────────────────────
ipcMain.handle('plugins:list', () => getPlugins())
ipcMain.handle('plugins:install', (_e, sourcePath: string) => {
    try {
        const validPath = validateFilePath(sourcePath, 'sourcePath')
        return installPlugin(validPath)
    } catch (err) {
        logger.error('plugins:install validation failed', err)
        throw err
    }
})
ipcMain.handle('plugins:uninstall', (_e, name: string) => {
    try {
        const validName = validateString(name, 'name', { minLength: 1, maxLength: 256 })
        return uninstallPlugin(validName)
    } catch (err) {
        logger.error('plugins:uninstall validation failed', err)
        throw err
    }
})

// ── App lifecycle ──────────────────────────────────────────
app.whenReady().then(async () => {
    initDatabase()
    await initKnowledgeBaseTables()
    initSemanticCache()
    await initObservability()
    migrateFromJson()

    // Load plugins and bootstrap scheduler before showing UI
    loadPlugins()
    setOnResultCallback((search, results) => {
        const title = `Scheduled search: "${search.query}"`
        const body = `${results.length} new result(s) found.`
        showNotification(title, body)
    })
    bootstrapScheduledSearches()

    mainWindow = createWindow()
    createTray()
    createAppMenu()
    registerGlobalShortcut()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createWindow()
        } else {
            mainWindow?.show()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
    isQuitting = true
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
})
