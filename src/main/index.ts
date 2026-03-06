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
import { initVectorStore, getVectorStoreStats, getVectorStoreMode } from './rag/vectorStore'
import { documentIngestion } from './rag/ingestion'
import { exportToHTML } from './services/exportService'
import { autoTagThread, quickTag } from './services/tagService'
import { loadPlugins, getPlugins, installPlugin, uninstallPlugin } from './services/pluginManager'
import { scheduleSearch, cancelScheduledSearch, deleteScheduledSearch, getScheduledSearches, bootstrapScheduledSearches, setOnResultCallback } from './services/scheduler'
import { createLogger } from './services/logger'
import { validateString, validateNumber, validateFilePath, validateStringArray, validateOptional } from './services/validation'
import { getTaskQueue, TaskPriority } from './services/taskQueue'
import { getSplashScreen } from './services/splashScreen'
import { getBootstrap } from './services/bootstrap'
import { getTimeoutManager } from './services/timeoutManager'
import { getAutoUpdater, registerAutoUpdateHandlers } from './services/autoUpdater'
import { DEFAULT_EVAL_THRESHOLDS, enforceRegressionGate, EvalRunResult, generateWeeklyEvalDashboard, GoldenEvalCase, runOfflineEvaluation, writeEvalRunArtifacts } from './services/evalHarness'
import { getOnlineEvalFeedback, getOnlineEvalFeedbackStats, recordOnlineEvalFeedback } from './services/evalFeedback'
import { addMemoryFact, buildMemoryContext, clearThreadMemories, deleteMemoryFact, initMemoryProfileStore, listMemoryFacts, pruneExpiredMemories } from './services/memoryProfile'
import {
    initSearchOperators,
    initSavedSearches,
    initSearchAnalytics,
    initPDFExport,
    initLocalAPIServer,
    stopLocalAPIServer,
    getSearchOperators,
    getSavedSearches,
    getSearchAnalytics,
    getPDFExport,
    getLocalAPIServer,
} from './services/v1.1.0-init'

// ─────────────────────────────────────────────────────────────
// GLOBAL STABILITY HANDLERS
// ─────────────────────────────────────────────────────────────

const stabilityLogger = createLogger('Stability')

// Global error handlers for uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    stabilityLogger.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
    })

    // Attempt graceful recovery if possible
    try {
        // Save any pending data
        stabilityLogger.warn('Attempting graceful recovery from uncaught exception')

        // Write crash info to file for debugging
        const crashInfo = {
            type: 'uncaughtException',
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            memoryUsage: process.memoryUsage(),
        }
        const crashFile = join(app.getPath('userData'), 'crash_reports')
        if (!fs.existsSync(crashFile)) {
            fs.mkdirSync(crashFile, { recursive: true })
        }
        fs.writeFileSync(
            join(crashFile, `crash_${Date.now()}.json`),
            JSON.stringify(crashInfo, null, 2)
        )
    } catch (e) {
        stabilityLogger.error('Failed to write crash report:', String(e))
    }
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    stabilityLogger.error('Unhandled Promise Rejection:', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        timestamp: new Date().toISOString(),
    })
})

// Memory monitoring to prevent crashes from memory leaks
let memoryWarningCount = 0
const MAX_MEMORY_MB = 2048 // 2GB limit
const MEMORY_CHECK_INTERVAL = 60000 // Check every minute

function startMemoryMonitor(): void {
    setInterval(() => {
        const memUsage = process.memoryUsage()
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
        const rssMB = Math.round(memUsage.rss / 1024 / 1024)

        if (rssMB > MAX_MEMORY_MB) {
            memoryWarningCount++
            stabilityLogger.error('Memory Critical:', {
                heapUsed: heapUsedMB,
                heapTotal: heapTotalMB,
                rss: rssMB,
                warnings: memoryWarningCount,
            })

            // Force garbage collection if available
            if (global.gc) {
                stabilityLogger.warn('Forcing garbage collection')
                global.gc()
            }

            // If memory is critically high, attempt to reduce memory
            if (memoryWarningCount > 5 && mainWindow) {
                stabilityLogger.warn('Clearing renderer cache to free memory')
                mainWindow.webContents.send('memory:cleanup')
            }
        } else if (rssMB > MAX_MEMORY_MB * 0.8) {
            stabilityLogger.warn('Memory High:', {
                heapUsed: heapUsedMB,
                heapTotal: heapTotalMB,
                rss: rssMB,
            })
        }
    }, MEMORY_CHECK_INTERVAL)
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    stabilityLogger.warn('Another instance is already running. Exiting.')
    app.quit()
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
}

// ─────────────────────────────────────────────────────────────
// APP LOGGING SETUP
// ─────────────────────────────────────────────────────────────

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
            label: 'Show Lumina Search',
            click: () => {
                mainWindow?.show()
                mainWindow?.focus()
            }
        },
        {
            label: 'New Search',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
                mainWindow?.show()
                mainWindow?.focus()
                mainWindow?.webContents.send('menu:new-search')
            }
        },
        { type: 'separator' },
        {
            label: 'Search Providers',
            submenu: [
                { label: 'DuckDuckGo', type: 'radio', checked: true, click: () => setDefaultProvider('duckduckgo') },
                { label: 'Tavily', type: 'radio', click: () => setDefaultProvider('tavily') },
                { label: 'Brave Search', type: 'radio', click: () => setDefaultProvider('brave') },
            ]
        },
        { type: 'separator' },
        {
            label: 'Focus Mode',
            submenu: [
                { label: 'Web Search', type: 'radio', checked: true, click: () => setFocusMode('web') },
                { label: 'Local KB', type: 'radio', click: () => setFocusMode('local') },
                { label: 'All (Hybrid)', type: 'radio', click: () => setFocusMode('all') },
                { label: 'Images', type: 'radio', click: () => setFocusMode('image') },
                { label: 'Videos', type: 'radio', click: () => setFocusMode('video') },
            ]
        },
        { type: 'separator' },
        {
            label: 'Toggle Dark Mode',
            click: () => {
                const current = getSettingsFromDb()
                current.theme = current.theme === 'dark' ? 'light' : 'dark'
                saveSettingsToDb(current)
                mainWindow?.webContents.send('settings:changed', current)
            }
        },
        { type: 'separator' },
        {
            label: 'Settings',
            click: () => {
                mainWindow?.show()
                mainWindow?.webContents.send('menu:open-settings')
            }
        },
        {
            label: 'Knowledge Base',
            click: () => {
                mainWindow?.show()
                mainWindow?.webContents.send('menu:open-kb')
            }
        },
        { type: 'separator' },
        {
            label: 'Quit Lumina Search',
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

    // Double-click to show window
    tray.on('double-click', () => {
        mainWindow?.show()
        mainWindow?.focus()
    })
}

function setDefaultProvider(provider: string): void {
    const settings = getSettingsFromDb()
    settings.defaultProvider = provider as any
    saveSettingsToDb(settings)
    mainWindow?.webContents.send('settings:changed', settings)
    logger.info(`Default provider changed to: ${provider}`)
}

function setFocusMode(mode: string): void {
    mainWindow?.webContents.send('focus-mode:changed', mode)
    logger.info(`Focus mode changed to: ${mode}`)
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

ipcMain.handle('budget:stats', () => {
    try {
        return budgetPlanner.getBudgetStats()
    } catch (err) {
        logger.error('budget:stats failed', err)
        throw err
    }
})

ipcMain.handle('budget:remaining', (_e, policy?: BudgetPolicy) => {
    try {
        return budgetPlanner.getRemainingBudget(policy)
    } catch (err) {
        logger.error('budget:remaining failed', err)
        throw err
    }
})

ipcMain.handle('budget:register-usage', (_e, sessionId: string, tokenCount: number, costUsd?: number) => {
    try {
        const validSessionId = validateString(sessionId, 'sessionId', { minLength: 1, maxLength: 256 })
        const validTokens = validateNumber(tokenCount, 'tokenCount', { min: 0 })
        budgetPlanner.registerUsage(validSessionId, validTokens, costUsd)
        return true
    } catch (err) {
        logger.error('budget:register-usage failed', err)
        throw err
    }
})

ipcMain.handle('budget:clear-monthly', (_e, monthKey?: string) => {
    try {
        budgetPlanner.clearMonthlyStats(monthKey)
        return true
    } catch (err) {
        logger.error('budget:clear-monthly failed', err)
        throw err
    }
})

// ── IPC: Timeout Configuration ────────────────────────────────
ipcMain.handle('timeout:config', () => {
    try {
        const timeoutManager = getTimeoutManager()
        return timeoutManager.getConfig()
    } catch (err) {
        logger.error('timeout:config failed', err)
        throw err
    }
})

ipcMain.handle('timeout:update', (_e, operation: string, timeoutMs: number) => {
    try {
        const validOp = validateString(operation, 'operation', { minLength: 1, maxLength: 100 })
        const validMs = validateNumber(timeoutMs, 'timeoutMs', { min: 100, max: 600000 })

        const timeoutManager = getTimeoutManager()
        timeoutManager.updateTimeout(validOp as any, validMs)
        return timeoutManager.getConfig()
    } catch (err) {
        logger.error('timeout:update failed', err)
        throw err
    }
})

ipcMain.handle('timeout:stats', () => {
    try {
        const timeoutManager = getTimeoutManager()
        return timeoutManager.getStats()
    } catch (err) {
        logger.error('timeout:stats failed', err)
        throw err
    }
})

ipcMain.handle('timeout:suggestions', () => {
    try {
        const timeoutManager = getTimeoutManager()
        return timeoutManager.suggestAdjustments()
    } catch (err) {
        logger.error('timeout:suggestions failed', err)
        throw err
    }
})

ipcMain.handle('timeout:clear-stats', () => {
    try {
        const timeoutManager = getTimeoutManager()
        timeoutManager.clearStats()
        return true
    } catch (err) {
        logger.error('timeout:clear-stats failed', err)
        throw err
    }
})

// ── IPC: Auto-updater ─────────────────────────────────────
// Register all auto-updater IPC handlers
registerAutoUpdateHandlers()

// ── IPC: Evaluation harness ────────────────────────────────
ipcMain.handle('eval:offline:run', (_e, datasetPath?: string, baselinePath?: string, gate?: boolean) => {
    try {
        const root = process.cwd()
        const effectiveDataset = validateOptional(datasetPath, (v) => validateFilePath(v, 'datasetPath'))
            ?? join(root, 'resources', 'eval', 'golden-queries.json')
        const effectiveBaseline = validateOptional(baselinePath, (v) => validateFilePath(v, 'baselinePath'))
            ?? join(root, 'resources', 'eval', 'baseline.json')

        if (!fs.existsSync(effectiveDataset)) {
            throw new Error(`Dataset not found: ${effectiveDataset}`)
        }

        const dataset = JSON.parse(fs.readFileSync(effectiveDataset, 'utf-8')) as GoldenEvalCase[]
        const runResult = runOfflineEvaluation(dataset, DEFAULT_EVAL_THRESHOLDS)

        const outputDir = join(root, 'resources', 'eval', 'results')
        const artifacts = writeEvalRunArtifacts(runResult, outputDir)

        const shouldGate = gate === true
        if (shouldGate && fs.existsSync(effectiveBaseline)) {
            const baseline = JSON.parse(fs.readFileSync(effectiveBaseline, 'utf-8')) as EvalRunResult
            const regression = enforceRegressionGate(runResult, baseline)
            return {
                ...artifacts,
                runResult,
                regression,
            }
        }

        return {
            ...artifacts,
            runResult,
            regression: { pass: true, reasons: [] },
        }
    } catch (err) {
        logger.error('eval:offline:run failed', err)
        throw err
    }
})

ipcMain.handle('eval:weekly:report', (_e, resultsDir?: string, reportsDir?: string) => {
    try {
        const root = process.cwd()
        const effectiveResults = validateOptional(resultsDir, (v) => validateFilePath(v, 'resultsDir'))
            ?? join(root, 'resources', 'eval', 'results')
        const effectiveReports = validateOptional(reportsDir, (v) => validateFilePath(v, 'reportsDir'))
            ?? join(root, 'resources', 'eval', 'reports')

        const reportPath = generateWeeklyEvalDashboard(effectiveResults, effectiveReports)
        return { reportPath }
    } catch (err) {
        logger.error('eval:weekly:report failed', err)
        throw err
    }
})

ipcMain.handle('eval:feedback:record', (_e, payload: {
    threadId: string
    query?: string
    answerPreview?: string
    vote: 'up' | 'down'
    citedCorrectly?: boolean
    notes?: string
    source?: 'manual' | 'prompt'
}) => {
    try {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid feedback payload')
        }

        const threadId = validateString(payload.threadId, 'threadId', { minLength: 1, maxLength: 256 })
        const vote = validateString(payload.vote, 'vote', { pattern: /^(up|down)$/ }) as 'up' | 'down'
        const query = validateOptional(payload.query, (v) => validateString(v, 'query', { maxLength: 5000 }))
        const answerPreview = validateOptional(payload.answerPreview, (v) => validateString(v, 'answerPreview', { maxLength: 5000 }))
        const notes = validateOptional(payload.notes, (v) => validateString(v, 'notes', { maxLength: 2000 }))
        const source = validateOptional(payload.source, (v) => validateString(v, 'source', { pattern: /^(manual|prompt)$/ })) as 'manual' | 'prompt' | undefined

        const citedCorrectly = typeof payload.citedCorrectly === 'boolean' ? payload.citedCorrectly : undefined

        return recordOnlineEvalFeedback({
            threadId,
            query,
            answerPreview,
            vote,
            citedCorrectly,
            notes,
            source: source ?? 'manual',
        })
    } catch (err) {
        logger.error('eval:feedback:record failed', err)
        throw err
    }
})

ipcMain.handle('eval:feedback:list', (_e, limit?: number) => {
    try {
        const safeLimit = typeof limit === 'number' ? validateNumber(limit, 'limit', { min: 1, max: 1000, isInteger: true }) : undefined
        return getOnlineEvalFeedback(safeLimit)
    } catch (err) {
        logger.error('eval:feedback:list failed', err)
        throw err
    }
})

ipcMain.handle('eval:feedback:stats', () => {
    try {
        return getOnlineEvalFeedbackStats()
    } catch (err) {
        logger.error('eval:feedback:stats failed', err)
        throw err
    }
})

// ── IPC: Memory profile (opt-in personalization) ────────────
ipcMain.handle('memory:add', (_e, payload: {
    threadId: string
    key?: string
    value: string
    tags?: string[]
    ttlDays?: number
    source?: 'manual' | 'auto'
}) => {
    try {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid memory payload')
        }

        const threadId = validateString(payload.threadId, 'threadId', { minLength: 1, maxLength: 256 })
        const value = validateString(payload.value, 'value', { minLength: 1, maxLength: 2000 })
        const key = validateOptional(payload.key, (v) => validateString(v, 'key', { maxLength: 128 }))
        const tags = validateOptional(payload.tags, (v) => validateStringArray(v, 'tags', { maxLength: 50 }))
        const ttlDays = typeof payload.ttlDays === 'number'
            ? validateNumber(payload.ttlDays, 'ttlDays', { min: 1, max: 3650 })
            : undefined
        const source = validateOptional(payload.source, (v) => validateString(v, 'source', { pattern: /^(manual|auto)$/ })) as 'manual' | 'auto' | undefined

        return addMemoryFact({
            threadId,
            key,
            value,
            tags,
            ttlDays,
            source,
        })
    } catch (err) {
        logger.error('memory:add failed', err)
        throw err
    }
})

ipcMain.handle('memory:list', (_e, threadId?: string, includeExpired?: boolean) => {
    try {
        const validThreadId = validateOptional(threadId, (v) => validateString(v, 'threadId', { minLength: 1, maxLength: 256 }))
        const shouldIncludeExpired = includeExpired === true
        return listMemoryFacts(validThreadId, shouldIncludeExpired)
    } catch (err) {
        logger.error('memory:list failed', err)
        throw err
    }
})

ipcMain.handle('memory:delete', (_e, id: string) => {
    try {
        const validId = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        return deleteMemoryFact(validId)
    } catch (err) {
        logger.error('memory:delete failed', err)
        throw err
    }
})

ipcMain.handle('memory:clear-thread', (_e, threadId: string) => {
    try {
        const validThreadId = validateString(threadId, 'threadId', { minLength: 1, maxLength: 256 })
        return { deleted: clearThreadMemories(validThreadId) }
    } catch (err) {
        logger.error('memory:clear-thread failed', err)
        throw err
    }
})

ipcMain.handle('memory:prune-expired', () => {
    try {
        return { deleted: pruneExpiredMemories() }
    } catch (err) {
        logger.error('memory:prune-expired failed', err)
        throw err
    }
})

ipcMain.handle('memory:preview-context', (_e, threadId: string, query: string, maxFacts?: number) => {
    try {
        const validThreadId = validateString(threadId, 'threadId', { minLength: 1, maxLength: 256 })
        const validQuery = validateString(query, 'query', { minLength: 1, maxLength: 5000 })
        const validMaxFacts = typeof maxFacts === 'number'
            ? validateNumber(maxFacts, 'maxFacts', { min: 1, max: 10, isInteger: true })
            : undefined
        return buildMemoryContext({ threadId: validThreadId, query: validQuery, maxFacts: validMaxFacts })
    } catch (err) {
        logger.error('memory:preview-context failed', err)
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

// ── IPC: App status ──────────────────────────────────────────
ipcMain.handle('app:ready', () => appInitialized)
ipcMain.handle('app:init-error', () => (initializationError ? { error: initializationError.message } : null))

ipcMain.handle('rag:cache-clear', () => { clearCache(); return true })
ipcMain.handle('rag:trace-stats', () => getTraceStats())
ipcMain.handle('rag:recent-traces', (_e, limit?: number) => getRecentTraces(limit))
ipcMain.handle('rag:vector-store-stats', async () => getVectorStoreStats())
ipcMain.handle('rag:vector-store-mode', () => getVectorStoreMode())

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

// ── IPC: Analytics ──────────────────────────────────────────────
ipcMain.handle('analytics:get-events', (_e, options: {
    startDate?: number
    endDate?: number
    eventTypes?: string[]
    format?: 'json' | 'csv'
}) => {
    try {
        const { getAnalyticsCollector } = require('./services/analyticsCollector')
        const analytics = getAnalyticsCollector()

        return analytics.getEvents({
            startDate: options.startDate,
            endDate: options.endDate,
            eventTypes: options.eventTypes as any,
            format: options.format
        })
    } catch (err) {
        logger.error('analytics:get-events failed', { error: err })
        throw err
    }
})

ipcMain.handle('analytics:get-summary', (_e, period: 'hourly' | 'daily' | 'monthly', count?: number) => {
    try {
        const validPeriod = validateString(period, 'period', { pattern: /^(hourly|daily|monthly)$/ }) as 'hourly' | 'daily' | 'monthly'
        const validCount = count !== undefined
            ? validateNumber(count, 'count', { min: 1, max: 365, isInteger: true })
            : undefined

        const { getAnalyticsCollector } = require('./services/analyticsCollector')
        const analytics = getAnalyticsCollector()

        return analytics.getSummary(validPeriod, validCount)
    } catch (err) {
        logger.error('analytics:get-summary failed', { error: err })
        throw err
    }
})

ipcMain.handle('analytics:export', (_e, options: {
    startDate?: number
    endDate?: number
    eventTypes?: string[]
    format?: 'json' | 'csv'
}) => {
    try {
        const { getAnalyticsCollector } = require('./services/analyticsCollector')
        const analytics = getAnalyticsCollector()

        return analytics.export({
            startDate: options.startDate,
            endDate: options.endDate,
            eventTypes: options.eventTypes as any,
            format: options.format || 'json'
        })
    } catch (err) {
        logger.error('analytics:export failed', { error: err })
        throw err
    }
})

ipcMain.handle('analytics:clear-all', () => {
    try {
        const { getAnalyticsCollector } = require('./services/analyticsCollector')
        const analytics = getAnalyticsCollector()
        analytics.clearAll()
        return { success: true }
    } catch (err) {
        logger.error('analytics:clear-all failed', { error: err })
        throw err
    }
})

// ── IPC: v1.1.0 Search Operators ──────────────────────────────
ipcMain.handle('search-operators:parse', (_e, query: string) => {
    try {
        const validQuery = validateString(query, 'query', { minLength: 1, maxLength: 2000 })
        const operators = getSearchOperators()
        return operators.parseSearchQuery(validQuery)
    } catch (err) {
        logger.error('search-operators:parse failed', err)
        throw err
    }
})

ipcMain.handle('search-operators:validate', (_e, query: string) => {
    try {
        const validQuery = validateString(query, 'query', { minLength: 1, maxLength: 2000 })
        const operators = getSearchOperators()
        return operators.validateQuery(validQuery)
    } catch (err) {
        logger.error('search-operators:validate failed', err)
        throw err
    }
})

ipcMain.handle('search-operators:list', () => {
    try {
        const operators = getSearchOperators()
        return operators.getAvailableOperators()
    } catch (err) {
        logger.error('search-operators:list failed', err)
        throw err
    }
})

// ── IPC: v1.1.0 Saved Searches ────────────────────────────────
ipcMain.handle('saved-searches:create', (_e, params: {
    name: string
    query: string
    description?: string
    filters?: Record<string, any>
    tags?: string[]
    category?: string
}) => {
    try {
        const validName = validateString(params.name, 'name', { minLength: 1, maxLength: 255 })
        const validQuery = validateString(params.query, 'query', { minLength: 1, maxLength: 2000 })

        const manager = getSavedSearches()
        const search = manager.createSearch({
            name: validName,
            query: validQuery,
            description: params.description,
            filters: params.filters,
            tags: params.tags,
            category: params.category,
        })

        // Persist to database
        const settings = getSettingsFromDb()
        if (!settings.savedSearches) {
            settings.savedSearches = {}
        }
        settings.savedSearches[search.id] = search
        saveSettingsToDb(settings)

        return search
    } catch (err) {
        logger.error('saved-searches:create failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:list', () => {
    try {
        const manager = getSavedSearches()
        return manager.getAllSearches()
    } catch (err) {
        logger.error('saved-searches:list failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:get', (_e, id: string) => {
    try {
        const validId = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        const manager = getSavedSearches()
        return manager.getSearch(validId)
    } catch (err) {
        logger.error('saved-searches:get failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:update', (_e, id: string, updates: Record<string, any>) => {
    try {
        const validId = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        const manager = getSavedSearches()
        const updated = manager.updateSearch(validId, updates)

        // Persist to database
        const settings = getSettingsFromDb()
        if (settings.savedSearches) {
            settings.savedSearches[validId] = updated
            saveSettingsToDb(settings)
        }

        return updated
    } catch (err) {
        logger.error('saved-searches:update failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:delete', (_e, id: string) => {
    try {
        const validId = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        const manager = getSavedSearches()
        const success = manager.deleteSearch(validId)

        // Persist to database
        if (success) {
            const settings = getSettingsFromDb()
            if (settings.savedSearches) {
                delete settings.savedSearches[validId]
                saveSettingsToDb(settings)
            }
        }

        return success
    } catch (err) {
        logger.error('saved-searches:delete failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:execute', (_e, id: string) => {
    try {
        const validId = validateString(id, 'id', { minLength: 1, maxLength: 256 })
        const manager = getSavedSearches()
        return manager.executeSearch(validId)
    } catch (err) {
        logger.error('saved-searches:execute failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:get-stats', () => {
    try {
        const manager = getSavedSearches()
        return manager.getStats()
    } catch (err) {
        logger.error('saved-searches:get-stats failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:toggle-star', (_e, id: string) => {
    try {
        const manager = getSavedSearches()
        return manager.toggleStar(id)
    } catch (err) {
        logger.error('saved-searches:toggle-star failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:duplicate', (_e, id: string, newName?: string) => {
    try {
        const manager = getSavedSearches()
        return manager.duplicateSearch(id, newName)
    } catch (err) {
        logger.error('saved-searches:duplicate failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:enable-refresh', (_e, id: string, intervalSeconds: number) => {
    try {
        const manager = getSavedSearches()
        return manager.enableAutoRefresh(id, intervalSeconds, async (search: any) => {
            if (mainWindow) {
                mainWindow.webContents.send('saved-searches:refresh-triggered', search)
            }
        })
    } catch (err) {
        logger.error('saved-searches:enable-refresh failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:stop-refresh', (_e, id: string) => {
    try {
        const manager = getSavedSearches()
        return manager.stopAutoRefresh(id)
    } catch (err) {
        logger.error('saved-searches:stop-refresh failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:export', (_e, filter) => {
    try {
        const manager = getSavedSearches()
        return manager.exportSearches(filter)
    } catch (err) {
        logger.error('saved-searches:export failed', err)
        throw err
    }
})

ipcMain.handle('saved-searches:import', (_e, jsonData: string) => {
    try {
        const manager = getSavedSearches()
        return manager.importSearches(jsonData)
    } catch (err) {
        logger.error('saved-searches:import failed', err)
        throw err
    }
})

// ── IPC: v1.1.0 Search Analytics ──────────────────────────────
ipcMain.handle('search-analytics:record', (_e, params: {
    query: string
    resultCount: number
    executionTimeMs: number
    sourcesUsed: string[]
    llmModel?: string
    success?: boolean
}) => {
    try {
        const validQuery = validateString(params.query, 'query', { minLength: 1, maxLength: 2000 })
        const validCount = validateNumber(params.resultCount, 'resultCount', { min: 0 })
        const validTime = validateNumber(params.executionTimeMs, 'executionTimeMs', { min: 0 })

        const manager = getSearchAnalytics()
        const record = manager.recordSearch({
            originalQuery: validQuery,
            resultCount: validCount,
            executionTimeMs: validTime,
            sourcesUsed: params.sourcesUsed || [],
            llmModel: params.llmModel,
            success: params.success,
        })

        return record
    } catch (err) {
        logger.error('search-analytics:record failed', err)
        throw err
    }
})

ipcMain.handle('search-analytics:get', () => {
    try {
        const manager = getSearchAnalytics()
        return manager.getAnalytics()
    } catch (err) {
        logger.error('search-analytics:get failed', err)
        throw err
    }
})

ipcMain.handle('search-analytics:insights', (_e, options?: { timeRangeMs?: number }) => {
    try {
        const manager = getSearchAnalytics()
        return manager.generateInsights(options?.timeRangeMs)
    } catch (err) {
        logger.error('search-analytics:insights failed', err)
        throw err
    }
})

ipcMain.handle('search-analytics:rate', (_e, recordId: string, rating: number, notes?: string) => {
    try {
        const validId = validateString(recordId, 'recordId', { minLength: 1, maxLength: 256 })
        const validRating = validateNumber(rating, 'rating', { min: 1, max: 5 })

        const manager = getSearchAnalytics()
        return manager.rateSearch(validId, validRating, notes)
    } catch (err) {
        logger.error('search-analytics:rate failed', err)
        throw err
    }
})

ipcMain.handle('search-analytics:clear', () => {
    try {
        const manager = getSearchAnalytics()
        manager.clearData()
        return true
    } catch (err) {
        logger.error('search-analytics:clear failed', err)
        throw err
    }
})

// ── IPC: v1.1.0 PDF Export ────────────────────────────────────
ipcMain.handle('pdf-export:generate', async (_e, thread, options) => {
    try {
        const manager = getPDFExport()
        return manager.generateThreadPDF(thread, options)
    } catch (err) {
        logger.error('pdf-export:generate failed', err)
        throw err
    }
})

// ── IPC: v1.1.0 API Server ───────────────────────────────────
ipcMain.handle('api-server:get-status', () => {
    try {
        const server = getLocalAPIServer()
        return {
            active: server.isRunning(),
            port: server.getPort(),
            endpoints: server.getEndpointCount(),
            webhooks: server.getWebhookCount()
        }
    } catch (err) {
        logger.error('api-server:get-status failed', err)
        throw err
    }
})

ipcMain.handle('api-server:toggle', async (_e, active) => {
    try {
        const server = getLocalAPIServer()
        if (active) {
            await server.start()
        } else {
            await server.stop()
        }
        return server.isRunning()
    } catch (err) {
        logger.error('api-server:toggle failed', err)
        throw err
    }
})

ipcMain.handle('api-server:get-config', () => {
    try {
        const server = getLocalAPIServer()
        return server.getConfig()
    } catch (err) {
        logger.error('api-server:get-config failed', err)
        throw err
    }
})

ipcMain.handle('api-server:update-config', (_e, config) => {
    try {
        const server = getLocalAPIServer()
        server.updateConfig(config)
        return true
    } catch (err) {
        logger.error('api-server:update-config failed', err)
        throw err
    }
})

ipcMain.handle('pdf-export:bulk', async (_e, threadIds: string[], options?: Record<string, any>) => {
    try {
        const validIds = validateStringArray(threadIds, 'threadIds', { minLength: 1, maxLength: 50 })
        const threads = getAllThreads()
        const selectedThreads = threads.filter(t => validIds.includes(t.id))

        if (selectedThreads.length === 0) {
            throw new Error('No threads found for export')
        }

        const manager = getPDFExport()
        const pdfPath = await manager.generateBulkPDF(
            selectedThreads.map(t => ({
                id: t.id,
                title: t.title,
                query: t.title,
                response: t.messages[t.messages.length - 1]?.content || '',
                results: [],
                createdAt: new Date(t.createdAt),
                model: 'unknown',
                executionTime: 0,
            })),
            options
        )

        return { success: true, path: pdfPath }
    } catch (err) {
        logger.error('pdf-export:bulk failed', err)
        throw err
    }
})

// ── IPC: v1.1.0 Local API Server ──────────────────────────────
ipcMain.handle('api-server:status', () => {
    try {
        const server = getLocalAPIServer()
        const settings = getSettingsFromDb()
        return {
            enabled: settings.apiServerEnabled || false,
            port: settings.apiServerPort || 8080,
            running: !!server,
        }
    } catch (err) {
        logger.error('api-server:status failed', err)
        throw err
    }
})

ipcMain.handle('api-server:enable', (_e, enable: boolean) => {
    try {
        const settings = getSettingsFromDb()
        settings.apiServerEnabled = enable
        saveSettingsToDb(settings)
        return { success: true, enabled: enable }
    } catch (err) {
        logger.error('api-server:enable failed', err)
        throw err
    }
})

ipcMain.handle('api-server:set-port', (_e, port: number) => {
    try {
        const validPort = validateNumber(port, 'port', { min: 1024, max: 65535 })
        const settings = getSettingsFromDb()
        settings.apiServerPort = validPort
        saveSettingsToDb(settings)
        return { success: true, port: validPort }
    } catch (err) {
        logger.error('api-server:set-port failed', err)
        throw err
    }
})

// ── IPC: v1.1.0 Batch Search ──────────────────────────────
ipcMain.handle('batch-search:execute', async (_e, options: {
    queries: string[]
    concurrency?: number
    sequential?: boolean
}) => {
    try {
        const { getBatchSearchManager } = await import('./services/batchSearch')
        const batchManager = getBatchSearchManager()

        const result = await batchManager.executeBatch({
            queries: options.queries,
            concurrency: options.concurrency || 3,
            sequential: options.sequential || false,
        })

        return result
    } catch (err) {
        logger.error('batch-search:execute failed', err)
        throw err
    }
})

ipcMain.handle('batch-search:status', (_e, batchId: string) => {
    try {
        const { getBatchSearchManager } = require('./services/batchSearch')
        const batchManager = getBatchSearchManager()
        return batchManager.getBatchResult(batchId)
    } catch (err) {
        logger.error('batch-search:status failed', err)
        throw err
    }
})

ipcMain.handle('batch-search:cancel', (_e, batchId: string) => {
    try {
        const { getBatchSearchManager } = require('./services/batchSearch')
        const batchManager = getBatchSearchManager()
        return { success: batchManager.cancelBatch(batchId) }
    } catch (err) {
        logger.error('batch-search:cancel failed', err)
        throw err
    }
})

// ── IPC: Webhooks ───────────────────────────────────────────
ipcMain.handle('webhooks:list', () => {
    try {
        const { getWebhookManager } = require('./services/webhookService')
        const webhookManager = getWebhookManager()
        return webhookManager.getAllWebhooks()
    } catch (err) {
        logger.error('webhooks:list failed', err)
        throw err
    }
})

ipcMain.handle('webhooks:create', (_e, params: {
    name: string
    url: string
    events: string[]
    secret?: string
    headers?: Record<string, string>
}) => {
    try {
        const { getWebhookManager } = require('./services/webhookService')
        const webhookManager = getWebhookManager()
        return webhookManager.createWebhook(params)
    } catch (err) {
        logger.error('webhooks:create failed', err)
        throw err
    }
})

ipcMain.handle('webhooks:update', (_e, id: string, updates: Record<string, any>) => {
    try {
        const { getWebhookManager } = require('./services/webhookService')
        const webhookManager = getWebhookManager()
        return webhookManager.updateWebhook(id, updates)
    } catch (err) {
        logger.error('webhooks:update failed', err)
        throw err
    }
})

ipcMain.handle('webhooks:delete', (_e, id: string) => {
    try {
        const { getWebhookManager } = require('./services/webhookService')
        const webhookManager = getWebhookManager()
        return { success: webhookManager.deleteWebhook(id) }
    } catch (err) {
        logger.error('webhooks:delete failed', err)
        throw err
    }
})

ipcMain.handle('webhooks:toggle', (_e, id: string, active: boolean) => {
    try {
        const { getWebhookManager } = require('./services/webhookService')
        const webhookManager = getWebhookManager()
        return { success: webhookManager.toggleWebhook(id, active) }
    } catch (err) {
        logger.error('webhooks:toggle failed', err)
        throw err
    }
})

ipcMain.handle('webhooks:test', (_e, id: string) => {
    try {
        const { getWebhookManager } = require('./services/webhookService')
        const webhookManager = getWebhookManager()
        return webhookManager.testWebhook(id)
    } catch (err) {
        logger.error('webhooks:test failed', err)
        throw err
    }
})

ipcMain.handle('webhooks:trigger', async (_e, event: string, data: Record<string, any>) => {
    try {
        const { getWebhookManager } = require('./services/webhookService')
        const webhookManager = getWebhookManager()
        return await webhookManager.trigger(event as any, data)
    } catch (err) {
        logger.error('webhooks:trigger failed', err)
        throw err
    }
})

// ── App lifecycle ──────────────────────────────────────────
let appInitialized = false
let initializationError: Error | null = null

app.whenReady().then(async () => {
    try {
        // Apply Windows optimizations early
        if (process.platform === 'win32') {
            const { optimizeForSystem } = await import('./services/windowsOptimizations')
            optimizeForSystem()
        }

        // Show splash screen immediately
        const splashScreen = getSplashScreen()
        await splashScreen.create()

        // Register initialization tasks
        const bootstrap = getBootstrap()
        bootstrap.reset() // Clear any previous tasks

        bootstrap.registerTask('Initializing database...', 25, async () => {
            initDatabase()
            await initKnowledgeBaseTables()
        })

        bootstrap.registerTask('Loading cache...', 20, async () => {
            initSemanticCache()
        })

        bootstrap.registerTask('Initializing vector store...', 15, async () => {
            await initVectorStore()
        })

        bootstrap.registerTask('Initializing budget planner...', 5, async () => {
            // Pre-populate budget stats on boot
            const stats = budgetPlanner.getBudgetStats()
            logger.info('Budget planner initialized', {
                currentMonth: stats.period,
                tokens: stats.totalTokens,
                cost: stats.totalCostUsd,
            })
        })

        bootstrap.registerTask('Initializing PostgreSQL database...', 20, async () => {
            const { initPostgresDatabase } = await import('./services/postgresDB')
            const pgReady = await initPostgresDatabase()
            if (pgReady) {
                logger.info('PostgreSQL database ready')
            } else {
                logger.warn('PostgreSQL failed, falling back to JSON storage')
            }
        })

        bootstrap.registerTask('Initializing timeout manager...', 3, async () => {
            const timeoutManager = getTimeoutManager()
            const config = timeoutManager.getConfig()
            logger.info('Timeout manager initialized', {
                ragQuery: config.ragQuery,
                embeddingBatch: config.embeddingBatch,
                pluginOperation: config.pluginOperation,
            })
        })

        bootstrap.registerTask('Initializing personalization memory...', 2, async () => {
            initMemoryProfileStore()
        })

        bootstrap.registerTask('Setting up observability...', 15, async () => {
            await initObservability()
        })

        bootstrap.registerTask('Migrating user data...', 10, async () => {
            migrateFromJson()
        })

        bootstrap.registerTask('Loading plugins...', 15, async () => {
            loadPlugins()
            setOnResultCallback((search, results) => {
                const title = `Scheduled search: "${search.query}"`
                const body = `${results.length} new result(s) found.`
                showNotification(title, body)
            })
        })

        bootstrap.registerTask('Bootstrapping scheduler...', 15, async () => {
            bootstrapScheduledSearches()
        })

        // ─── v1.1.0 Services Initialization ───────────────────
        bootstrap.registerTask('Initializing search operators...', 5, async () => {
            await initSearchOperators()
        })

        bootstrap.registerTask('Initializing saved searches...', 5, async () => {
            await initSavedSearches()
        })

        bootstrap.registerTask('Initializing search analytics...', 5, async () => {
            await initSearchAnalytics()
        })

        bootstrap.registerTask('Initializing PDF export service...', 3, async () => {
            await initPDFExport()
        })

        bootstrap.registerTask('Starting local API server...', 5, async () => {
            await initLocalAPIServer()
        })

        bootstrap.registerTask('Checking for updates...', 4, async () => {
            const updater = getAutoUpdater()
            const available = await updater.checkForUpdates(false)
            if (available) {
                const status = updater.getStatus()
                logger.info('Update available', {
                    latestVersion: status.latestVersion,
                    currentVersion: status.currentVersion,
                })
            }
        })

        // Execute all initialization tasks
        await bootstrap.initialize()
        appInitialized = true
        logger.info('Application initialization complete')

        // Start memory monitoring for stability
        startMemoryMonitor()

        // Now create main window
        mainWindow = createWindow()
        createTray()
        createAppMenu()
        registerGlobalShortcut()

        // Window stability: prevent crashes from renderer errors
        if (mainWindow) {
            mainWindow.webContents.on('render-process-gone', (event, details) => {
                logger.error('Renderer process crashed:', {
                    reason: details.reason,
                    exitCode: details.exitCode,
                })

                // Attempt to recover
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.reload()
                }
            })

            mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
                logger.error('Failed to load:', { errorCode, errorDescription })
            })

            mainWindow.webContents.on('render-process-gone', (_event, details) => {
                logger.error('Renderer process gone:', details)
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.reload()
                }
            })
        }

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                mainWindow = createWindow()
            } else {
                mainWindow?.show()
            }
        })
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        initializationError = error
        logger.error('Application initialization failed', error)
        // Still create window to show error UI
        const splashScreen = getSplashScreen()
        await splashScreen.close()
        mainWindow = createWindow()
        if (mainWindow) {
            mainWindow.webContents.send('app:init-error', { message: error.message })
        }
    }
})

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
    stabilityLogger.info(`Received ${signal}, performing graceful shutdown...`)

    try {
        // Stop accepting new requests
        isQuitting = true

        // Save any pending data
        stabilityLogger.info('Saving pending data...')

        // Close main window if open
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeAllListeners('close')
            mainWindow.close()
        }

        // Cleanup services
        await stopLocalAPIServer()

        // Unregister shortcuts
        globalShortcut.unregisterAll()

        stabilityLogger.info('Graceful shutdown complete')
        app.exit(0)
    } catch (error) {
        stabilityLogger.error('Error during shutdown:', String(error))
        app.exit(1)
    }
}

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        gracefulShutdown('window-all-closed')
    }
})

app.on('before-quit', () => {
    isQuitting = true
})

app.on('will-quit', async () => {
    globalShortcut.unregisterAll()
    // Cleanup v1.1.0 services
    await stopLocalAPIServer()
})
