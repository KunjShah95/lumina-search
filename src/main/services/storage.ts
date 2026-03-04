import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { AppSettings, DEFAULT_SETTINGS, Thread } from '../agents/types'

const userDataPath = app.getPath('userData')
const settingsPath = path.join(userDataPath, 'settings.json')
const historyPath = path.join(userDataPath, 'history.json')

// ── Settings ──────────────────────────────────────────────
export function getSettings(): AppSettings {
    try {
        if (fs.existsSync(settingsPath)) {
            const raw = fs.readFileSync(settingsPath, 'utf-8')
            return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
        }
    } catch { }
    return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: AppSettings): void {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

// ── Thread History ─────────────────────────────────────────
export function getHistory(): Thread[] {
    try {
        if (fs.existsSync(historyPath)) {
            const raw = fs.readFileSync(historyPath, 'utf-8')
            return JSON.parse(raw)
        }
    } catch { }
    return []
}

export function saveThread(thread: Thread): void {
    const history = getHistory()
    const idx = history.findIndex(t => t.id === thread.id)
    if (idx !== -1) {
        history[idx] = thread
    } else {
        history.unshift(thread)
    }
    // Keep last 200 threads
    const trimmed = history.slice(0, 200)
    fs.mkdirSync(path.dirname(historyPath), { recursive: true })
    fs.writeFileSync(historyPath, JSON.stringify(trimmed, null, 2))
}

export function deleteThread(id: string): void {
    const history = getHistory().filter(t => t.id !== id)
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2))
}

export function clearHistory(): void {
    fs.writeFileSync(historyPath, '[]')
}
