import * as fs from 'fs'
import * as path from 'path'
import { OnlineEvalFeedback } from '../agents/types'

const EVAL_DIR = path.join(process.cwd(), 'resources', 'eval')
const FEEDBACK_FILE = path.join(EVAL_DIR, 'online-feedback.json')

interface OnlineFeedbackStats {
    total: number
    positiveRate: number
    citationCorrectRate: number
    last7dCount: number
}

function ensureFile(): void {
    fs.mkdirSync(EVAL_DIR, { recursive: true })
    if (!fs.existsSync(FEEDBACK_FILE)) {
        fs.writeFileSync(FEEDBACK_FILE, '[]', 'utf-8')
    }
}

export function recordOnlineEvalFeedback(input: Omit<OnlineEvalFeedback, 'id' | 'createdAt'>): OnlineEvalFeedback {
    ensureFile()
    const current = getOnlineEvalFeedback()

    const feedback: OnlineEvalFeedback = {
        id: `fb_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        createdAt: Date.now(),
        threadId: input.threadId,
        query: input.query,
        answerPreview: input.answerPreview,
        vote: input.vote,
        citedCorrectly: input.citedCorrectly,
        notes: input.notes,
        source: input.source,
    }

    current.push(feedback)
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(current, null, 2), 'utf-8')
    return feedback
}

export function getOnlineEvalFeedback(limit?: number): OnlineEvalFeedback[] {
    ensureFile()
    const raw = fs.readFileSync(FEEDBACK_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as OnlineEvalFeedback[]
    const sorted = [...parsed].sort((a, b) => b.createdAt - a.createdAt)

    if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
        return sorted.slice(0, limit)
    }

    return sorted
}

export function getOnlineEvalFeedbackStats(): OnlineFeedbackStats {
    const all = getOnlineEvalFeedback()

    if (all.length === 0) {
        return {
            total: 0,
            positiveRate: 0,
            citationCorrectRate: 0,
            last7dCount: 0,
        }
    }

    const positives = all.filter(f => f.vote === 'up').length
    const withCitation = all.filter(f => typeof f.citedCorrectly === 'boolean')
    const citationCorrect = withCitation.filter(f => f.citedCorrectly === true).length

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const last7dCount = all.filter(f => f.createdAt >= sevenDaysAgo).length

    return {
        total: all.length,
        positiveRate: round(positives / all.length, 4),
        citationCorrectRate: withCitation.length > 0 ? round(citationCorrect / withCitation.length, 4) : 0,
        last7dCount,
    }
}

function round(v: number, d: number): number {
    const m = Math.pow(10, d)
    return Math.round(v * m) / m
}
