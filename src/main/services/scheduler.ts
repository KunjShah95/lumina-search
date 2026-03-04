/**
 * Scheduler — Run searches at recurring intervals.
 */
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { SearchOrchestrator } from '../agents/Orchestrator'
import { SearchOpts, SearchResult, AgentEvent } from '../agents/types'
import { getSettingsFromDb } from './database'

export interface ScheduledSearch {
    id: string
    query: string
    focusMode: string
    intervalMs: number
    lastRun: number
    lastResults: SearchResult[]
    createdAt: number
    isActive: boolean
}

let scheduledSearches: ScheduledSearch[] = []
let runningIntervals: Map<string, ReturnType<typeof setInterval>> = new Map()
let onResultCallback: ((search: ScheduledSearch, results: SearchResult[]) => void) | null = null

function getStoragePath(): string {
    const userData = app.getPath('userData')
    return path.join(userData, 'scheduled-searches.json')
}

function loadScheduledSearches(): void {
    try {
        const p = getStoragePath()
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf-8')
            const parsed = JSON.parse(raw) as ScheduledSearch[]
            scheduledSearches = parsed || []
        }
    } catch (err) {
        console.error('Failed to load scheduled searches:', err)
        scheduledSearches = []
    }
}

function persistScheduledSearches(): void {
    try {
        const p = getStoragePath()
        fs.mkdirSync(path.dirname(p), { recursive: true })
        fs.writeFileSync(p, JSON.stringify(scheduledSearches, null, 2))
    } catch (err) {
        console.error('Failed to persist scheduled searches:', err)
    }
}

/**
 * Create a new scheduled search.
 */
export function scheduleSearch(
    query: string,
    focusMode: string = 'web',
    intervalMs: number = 3600000 // 1 hour default
): ScheduledSearch {
    const search: ScheduledSearch = {
        id: `sched_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        query,
        focusMode,
        intervalMs,
        lastRun: 0,
        lastResults: [],
        createdAt: Date.now(),
        isActive: true,
    }

    scheduledSearches.push(search)
    persistScheduledSearches()
    startScheduledSearch(search)

    return search
}

/**
 * Cancel a scheduled search.
 */
export function cancelScheduledSearch(id: string): void {
    const interval = runningIntervals.get(id)
    if (interval) {
        clearInterval(interval)
        runningIntervals.delete(id)
    }
    const search = scheduledSearches.find(s => s.id === id)
    if (search) {
        search.isActive = false
        persistScheduledSearches()
    }
}

/**
 * Delete a scheduled search.
 */
export function deleteScheduledSearch(id: string): void {
    cancelScheduledSearch(id)
    scheduledSearches = scheduledSearches.filter(s => s.id !== id)
    persistScheduledSearches()
}

/**
 * Get all scheduled searches.
 */
export function getScheduledSearches(): ScheduledSearch[] {
    return [...scheduledSearches]
}

/**
 * Set the callback for when a scheduled search produces new results.
 */
export function setOnResultCallback(cb: (search: ScheduledSearch, results: SearchResult[]) => void): void {
    onResultCallback = cb
}

/**
 * Bootstrap all active scheduled searches (call on app start).
 */
export function bootstrapScheduledSearches(): void {
    // Load from disk once at startup
    if (scheduledSearches.length === 0) {
        loadScheduledSearches()
    }

    for (const search of scheduledSearches) {
        if (search.isActive) {
            startScheduledSearch(search)
        }
    }
}

/**
 * Stop all scheduled searches.
 */
export function stopAllScheduledSearches(): void {
    for (const [, interval] of runningIntervals) {
        clearInterval(interval)
    }
    runningIntervals.clear()
}

// ── Internal ───────────────────────────────────────────────────

function startScheduledSearch(search: ScheduledSearch): void {
    const run = async () => {
        const settings = getSettingsFromDb()
        const orchestrator = new SearchOrchestrator()

        const opts: SearchOpts = {
            providers: [settings.defaultProvider],
            model: settings.defaultModel,
            maxSources: 5,
            scrapePages: false,
            focusMode: search.focusMode as any,
        }

        const results: SearchResult[] = []

        try {
            for await (const event of orchestrator.run(search.query, opts)) {
                if (event.type === 'sources') {
                    results.push(...event.data)
                }
            }

            // Check if there are new results (compare with last run)
            const newUrls = results
                .map(r => r.url)
                .filter(url => !search.lastResults.some(lr => lr.url === url))

            search.lastRun = Date.now()
            search.lastResults = results

            if (newUrls.length > 0 && onResultCallback) {
                onResultCallback(search, results.filter(r => newUrls.includes(r.url)))
            }
        } catch (error) {
            console.error(`Scheduled search "${search.query}" failed:`, error)
        }
    }

    // Run immediately on first schedule
    run()

    const interval = setInterval(run, search.intervalMs)
    runningIntervals.set(search.id, interval)
}
