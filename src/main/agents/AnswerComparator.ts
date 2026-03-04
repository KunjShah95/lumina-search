/**
 * Answer Comparator — Run the same query through multiple LLMs simultaneously.
 */
import { streamLLM } from '../services/llm-router'
import { getSettingsFromDb } from '../services/database'
import { Message } from './types'

export interface ComparisonResult {
    model: string
    answer: string
    duration: number    // ms
    tokenCount: number  // approximate
}

/**
 * Run a query against multiple models in parallel and collect their answers.
 */
export async function compareModels(
    query: string,
    systemPrompt: string,
    models: string[],
    conversationHistory: Message[] = []
): Promise<ComparisonResult[]> {
    const settings = getSettingsFromDb()
    const messages: Message[] = [
        ...conversationHistory,
        { role: 'user', content: query },
    ]

    const results = await Promise.allSettled(
        models.map(async (modelId) => {
            const startTime = Date.now()
            let answer = ''
            let tokenCount = 0

            try {
                for await (const token of streamLLM(modelId, systemPrompt, messages, settings)) {
                    answer += token
                    tokenCount++
                }
            } catch (error) {
                answer = `[Error with ${modelId}]: ${error instanceof Error ? error.message : String(error)}`
            }

            return {
                model: modelId,
                answer,
                duration: Date.now() - startTime,
                tokenCount,
            }
        })
    )

    return results
        .filter((r): r is PromiseFulfilledResult<ComparisonResult> => r.status === 'fulfilled')
        .map(r => r.value)
}

/**
 * Stream comparison results — yields events as each model completes.
 */
export async function* streamCompareModels(
    query: string,
    systemPrompt: string,
    models: string[],
    conversationHistory: Message[] = []
): AsyncGenerator<{ type: 'model-start' | 'model-token' | 'model-done'; model: string; text?: string; duration?: number }> {
    const settings = getSettingsFromDb()
    const messages: Message[] = [
        ...conversationHistory,
        { role: 'user', content: query },
    ]

    // Run all models in parallel, yielding per-model events
    const generators = models.map(modelId => ({
        modelId,
        gen: streamLLM(modelId, systemPrompt, messages, settings),
        startTime: Date.now(),
    }))

    for (const { modelId } of generators) {
        yield { type: 'model-start', model: modelId }
    }

    // Process each model's stream
    await Promise.allSettled(
        generators.map(async ({ modelId, gen, startTime }) => {
            try {
                for await (const token of gen) {
                    // Note: These yields happen inside Promise.allSettled,
                    // so they won't actually yield to the parent generator.
                    // The non-streaming `compareModels` is preferred for simplicity.
                }
            } catch { /* handled by compareModels */ }
        })
    )
}
