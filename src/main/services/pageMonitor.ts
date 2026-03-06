/**
 * Web Page Monitor — Track URL content changes, detect diffs.
 */
import crypto from 'crypto'
import { getTimeoutManager } from './timeoutManager'

export interface MonitoredPage {
    id: string
    url: string
    title: string
    lastHash: string
    lastChecked: number
    lastChanged: number
    checkIntervalMs: number
    isActive: boolean
}

export interface PageChangeEvent {
    pageId: string
    url: string
    title: string
    previousHash: string
    newHash: string
    detectedAt: number
}

let monitoredPages: MonitoredPage[] = []
let checkIntervals: Map<string, ReturnType<typeof setInterval>> = new Map()
let onChangeCallback: ((event: PageChangeEvent) => void) | null = null

/**
 * Add a URL to monitor for content changes.
 */
export function addMonitoredPage(
    url: string,
    title: string,
    checkIntervalMs: number = 3600000 // default 1 hour
): MonitoredPage {
    const page: MonitoredPage = {
        id: `mon_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        url,
        title,
        lastHash: '',
        lastChecked: 0,
        lastChanged: 0,
        checkIntervalMs,
        isActive: true,
    }

    monitoredPages.push(page)

    if (onChangeCallback) {
        startPageCheck(page)
    }

    return page
}

/**
 * Remove a monitored page.
 */
export function removeMonitoredPage(pageId: string): void {
    const interval = checkIntervals.get(pageId)
    if (interval) {
        clearInterval(interval)
        checkIntervals.delete(pageId)
    }
    monitoredPages = monitoredPages.filter(p => p.id !== pageId)
}

/**
 * Get all monitored pages.
 */
export function getMonitoredPages(): MonitoredPage[] {
    return [...monitoredPages]
}

/**
 * Start the monitoring system.
 */
export function startMonitoring(onChange: (event: PageChangeEvent) => void): void {
    onChangeCallback = onChange
    for (const page of monitoredPages) {
        if (page.isActive) {
            startPageCheck(page)
        }
    }
}

/**
 * Stop all monitoring.
 */
export function stopMonitoring(): void {
    for (const [, interval] of checkIntervals) {
        clearInterval(interval)
    }
    checkIntervals.clear()
    onChangeCallback = null
}

/**
 * Manually check a specific page now.
 */
export async function checkPageNow(pageId: string): Promise<boolean> {
    const page = monitoredPages.find(p => p.id === pageId)
    if (!page) return false
    return await checkForChanges(page)
}

// ── Internal ───────────────────────────────────────────────────

function startPageCheck(page: MonitoredPage): void {
    // Initial check
    checkForChanges(page).catch(console.error)

    // Periodic checks
    const interval = setInterval(() => {
        checkForChanges(page).catch(console.error)
    }, page.checkIntervalMs)

    checkIntervals.set(page.id, interval)
}

async function checkForChanges(page: MonitoredPage): Promise<boolean> {
    try {
        const timeoutMs = getTimeoutManager().getTimeoutFor('search:scraper') || 20000
        const response = await fetch(page.url, {
            signal: AbortSignal.timeout(timeoutMs),
            headers: { 'User-Agent': 'LuminaSearch/1.0 PageMonitor' },
        })

        if (!response.ok) return false

        const text = await response.text()
        // Strip dynamic elements (timestamps, ads) for better diff
        const cleaned = text
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/\s+/g, ' ')
            .trim()

        const newHash = crypto.createHash('md5').update(cleaned).digest('hex')

        page.lastChecked = Date.now()

        if (page.lastHash && page.lastHash !== newHash) {
            const event: PageChangeEvent = {
                pageId: page.id,
                url: page.url,
                title: page.title,
                previousHash: page.lastHash,
                newHash,
                detectedAt: Date.now(),
            }

            page.lastHash = newHash
            page.lastChanged = Date.now()

            if (onChangeCallback) {
                onChangeCallback(event)
            }
            return true
        }

        page.lastHash = newHash
        return false
    } catch (error) {
        console.error(`Page monitor check failed for ${page.url}:`, error)
        return false
    }
}
