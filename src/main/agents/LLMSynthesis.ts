import { Message } from './types'
import { streamLLM } from '../services/llm-router'
import { getSettings } from '../services/storage'

export class LLMSynthesisAgent {
    constructor(private modelId: string) { }

    async *stream(
        query: string,
        systemPrompt: string,
        conversationHistory: Message[] = []
    ): AsyncGenerator<string> {
        const settings = getSettings()
        // Include last 4 messages (2 turns) for context
        const history = conversationHistory.slice(-4)
        const messages: Message[] = [
            ...history,
            { role: 'user', content: query },
        ]
        yield* streamLLM(this.modelId, systemPrompt, messages, settings)
    }
}
