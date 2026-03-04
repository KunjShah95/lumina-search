/**
 * Tag Service — Auto-classify threads using LLM.
 */
import { Thread } from '../agents/types'
import { streamLLM } from './llm-router'
import { getSettingsFromDb } from './database'

export const PREDEFINED_TAGS = [
    'coding', 'research', 'news', 'science', 'math',
    'creative', 'business', 'health', 'education', 'technology',
    'philosophy', 'history', 'design', 'debugging', 'general',
] as const

export type Tag = typeof PREDEFINED_TAGS[number]

/**
 * Auto-tag a thread using the configured LLM.
 * Returns 1-3 tags from the predefined list.
 */
export async function autoTagThread(thread: Thread, model?: string): Promise<string[]> {
    const settings = getSettingsFromDb()
    const modelId = model || settings.defaultModel

    // Build a compact summary of the thread for classification
    const summary = thread.messages
        .slice(0, 4)
        .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n')

    const systemPrompt = `You are a thread classifier. Given a conversation, output 1-3 tags from this exact list: ${PREDEFINED_TAGS.join(', ')}.
Output ONLY the tags separated by commas. No explanation. No extra text.`

    const userMessage = `Classify this conversation:\n\n${summary}`

    try {
        let result = ''
        for await (const token of streamLLM(modelId, systemPrompt, [{ role: 'user', content: userMessage }], settings)) {
            result += token
        }

        // Parse: filter to only valid predefined tags
        const parsed = result
            .toLowerCase()
            .split(/[,\n]+/)
            .map(t => t.trim())
            .filter(t => (PREDEFINED_TAGS as readonly string[]).includes(t))
            .slice(0, 3)

        return parsed.length > 0 ? parsed : ['general']
    } catch (error) {
        console.error('Auto-tagging failed:', error)
        return ['general']
    }
}

/**
 * Heuristic-based quick tagging (no LLM needed).
 * Fallback when LLM is unavailable.
 */
export function quickTag(thread: Thread): string[] {
    const text = thread.messages.map(m => m.content).join(' ').toLowerCase()
    const tags: string[] = []

    const rules: [string, RegExp][] = [
        ['coding', /\b(code|function|class|api|bug|error|debug|typescript|javascript|python|react|node)\b/i],
        ['research', /\b(research|study|paper|journal|findings|hypothesis|analysis)\b/i],
        ['science', /\b(physics|chemistry|biology|quantum|molecule|atom|genome|evolution)\b/i],
        ['math', /\b(equation|calculus|algebra|theorem|proof|integral|derivative|matrix)\b/i],
        ['news', /\b(news|breaking|report|announced|launched|released|update)\b/i],
        ['health', /\b(health|medical|disease|treatment|symptoms|diagnosis|exercise|nutrition)\b/i],
        ['business', /\b(business|startup|revenue|market|investment|strategy|management)\b/i],
        ['design', /\b(design|ui|ux|layout|color|typography|wireframe|figma)\b/i],
        ['creative', /\b(write|story|poem|creative|art|music|novel|fiction)\b/i],
        ['education', /\b(learn|teach|course|tutorial|explain|understand|concept)\b/i],
        ['technology', /\b(ai|machine learning|cloud|server|database|network|blockchain)\b/i],
        ['debugging', /\b(error|bug|fix|issue|crash|exception|stack trace|undefined)\b/i],
    ]

    for (const [tag, regex] of rules) {
        if (regex.test(text) && tags.length < 3) {
            tags.push(tag)
        }
    }

    return tags.length > 0 ? tags : ['general']
}
