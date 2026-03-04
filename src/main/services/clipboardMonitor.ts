/**
 * Clipboard Monitor — Watch clipboard for URLs/text, offer search/KB actions.
 */
import { clipboard } from 'electron'

export interface ClipboardSuggestion {
    type: 'url' | 'text'
    content: string
    timestamp: number
}

let lastClipboardContent = ''
let monitorInterval: ReturnType<typeof setInterval> | null = null
let onSuggestionCallback: ((suggestion: ClipboardSuggestion) => void) | null = null

const URL_REGEX = /^https?:\/\/[^\s]+$/

/**
 * Start monitoring the clipboard for new interesting content.
 */
export function startClipboardMonitor(
    onSuggestion: (suggestion: ClipboardSuggestion) => void,
    intervalMs: number = 2000
): void {
    stopClipboardMonitor()
    lastClipboardContent = clipboard.readText()
    onSuggestionCallback = onSuggestion

    monitorInterval = setInterval(() => {
        const current = clipboard.readText().trim()
        if (!current || current === lastClipboardContent) return
        lastClipboardContent = current

        // Ignore very short or very long content
        if (current.length < 10 || current.length > 5000) return

        const isUrl = URL_REGEX.test(current)
        const suggestion: ClipboardSuggestion = {
            type: isUrl ? 'url' : 'text',
            content: current,
            timestamp: Date.now(),
        }

        onSuggestion(suggestion)
    }, intervalMs)
}

/**
 * Stop monitoring the clipboard.
 */
export function stopClipboardMonitor(): void {
    if (monitorInterval) {
        clearInterval(monitorInterval)
        monitorInterval = null
    }
    onSuggestionCallback = null
}

/**
 * Check if the monitor is currently active.
 */
export function isMonitorActive(): boolean {
    return monitorInterval !== null
}
