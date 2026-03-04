import { streamLLM } from '../services/llm-router'
import { getSettings } from '../services/storage'

export class FollowUpAgent {
    async run(query: string, context: string, modelId: string): Promise<string[]> {
        const settings = getSettings()
        const prompt = `The user just asked: "${query}"

Generate exactly 3 short, interesting follow-up questions they might want to ask next.
Return ONLY the questions, one per line, no numbering, no bullets, no extra text.`

        let fullText = ''
        try {
            for await (const token of streamLLM(modelId, context, [{ role: 'user', content: prompt }], settings)) {
                fullText += token
                if (fullText.length > 500) break // Safety limit
            }
        } catch { return [] }

        return fullText
            .split('\n')
            .map(q => q.replace(/^[\d\.\-\*\s]+/, '').trim())
            .filter(q => q.length > 10 && q.endsWith('?'))
            .slice(0, 3)
    }
}
