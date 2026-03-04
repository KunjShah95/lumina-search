import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { AppSettings, Message } from '../agents/types'

export async function* streamLLM(
    modelId: string,
    systemPrompt: string,
    messages: Message[],
    settings: AppSettings
): AsyncGenerator<string> {
    const [provider, ...modelParts] = modelId.split(':')
    const model = modelParts.join(':')

    const llmSettings = {
        temperature: settings.temperature,
        topP: settings.topP,
        maxTokens: settings.maxTokens,
    }

    switch (provider) {
        case 'ollama':
            yield* streamOllama(model, systemPrompt, messages, settings, llmSettings)
            break
        case 'lmstudio':
            yield* streamLMStudio(model, systemPrompt, messages, settings, llmSettings)
            break
        case 'openai':
            yield* streamOpenAI(model, systemPrompt, messages, settings, llmSettings)
            break
        case 'anthropic':
            yield* streamAnthropic(model, systemPrompt, messages, settings, llmSettings)
            break
        case 'gemini':
            yield* streamGemini(model, systemPrompt, messages, settings)
            break
        default:
            throw new Error(`Unknown LLM provider: "${provider}". Use format provider:model.`)
    }
}

// ── Ollama ─────────────────────────────────────────────────
async function* streamOllama(
    model: string,
    system: string,
    messages: Message[],
    settings: AppSettings,
    llmSettings: { temperature: number; topP: number; maxTokens: number }
): AsyncGenerator<string> {
    const url = `${settings.ollamaUrl.replace('localhost', '127.0.0.1')}/api/chat`
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            stream: true,
            options: {
                temperature: llmSettings.temperature,
                top_p: llmSettings.topP,
                num_predict: llmSettings.maxTokens,
            },
            messages: [
                { role: 'system', content: system },
                ...messages
            ],
        }),
        signal: AbortSignal.timeout(120000),
    })

    if (!response.ok || !response.body) {
        throw new Error(`Ollama error: ${response.status} ${await response.text()}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
            if (!line.trim()) continue
            try {
                const parsed = JSON.parse(line)
                if (parsed.message?.content) yield parsed.message.content
                if (parsed.done) return
            } catch { }
        }
    }
}

// ── LM Studio ────────────────────────────────────────────────
async function* streamLMStudio(
    model: string,
    system: string,
    messages: Message[],
    settings: AppSettings,
    llmSettings: { temperature: number; topP: number; maxTokens: number }
): AsyncGenerator<string> {
    const url = `${settings.lmstudioUrl.replace('localhost', '127.0.0.1')}/v1/chat/completions`
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            stream: true,
            temperature: llmSettings.temperature,
            top_p: llmSettings.topP,
            max_tokens: llmSettings.maxTokens,
            messages: [
                { role: 'system', content: system },
                ...messages
            ],
        }),
        signal: AbortSignal.timeout(120000),
    })

    if (!response.ok || !response.body) {
        throw new Error(`LM Studio error: ${response.status} ${await response.text()}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
            if (!line.trim() || !line.startsWith('data:')) continue
            if (line.includes('[DONE]')) return
            try {
                const jsonStr = line.slice(5).trim()
                const parsed = JSON.parse(jsonStr)
                if (parsed.choices?.[0]?.delta?.content) {
                    yield parsed.choices[0].delta.content
                }
            } catch { }
        }
    }
}

// ── OpenAI ─────────────────────────────────────────────────
async function* streamOpenAI(
    model: string,
    system: string,
    messages: Message[],
    settings: AppSettings,
    llmSettings: { temperature: number; topP: number; maxTokens: number }
): AsyncGenerator<string> {
    if (!settings.openaiKey) throw new Error('OpenAI API key required')
    const client = new OpenAI({ apiKey: settings.openaiKey })

    const stream = await client.chat.completions.create({
        model,
        stream: true,
        temperature: llmSettings.temperature,
        top_p: llmSettings.topP,
        max_tokens: llmSettings.maxTokens,
        messages: [
            { role: 'system', content: system },
            ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
    })

    for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content
        if (text) yield text
    }
}

// ── Anthropic ──────────────────────────────────────────────
async function* streamAnthropic(
    model: string,
    system: string,
    messages: Message[],
    settings: AppSettings,
    llmSettings: { temperature: number; topP: number; maxTokens: number }
): AsyncGenerator<string> {
    if (!settings.anthropicKey) throw new Error('Anthropic API key required')
    const client = new Anthropic({ apiKey: settings.anthropicKey })

    const stream = client.messages.stream({
        model,
        max_tokens: llmSettings.maxTokens,
        temperature: llmSettings.temperature,
        top_p: llmSettings.topP,
        system,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield event.delta.text
        }
    }
}

// ── Google Gemini ──────────────────────────────────────────
async function* streamGemini(
    model: string,
    system: string,
    messages: Message[],
    settings: AppSettings
): AsyncGenerator<string> {
    if (!settings.geminiKey) throw new Error('Google AI API key required')
    const genAI = new GoogleGenerativeAI(settings.geminiKey)
    const genModel = genAI.getGenerativeModel({ model })

    const history: { role: 'user' | 'model'; parts: { text: string }[] }[] = messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }))

    const allMessages = [{ role: 'user' as const, parts: [{ text: system }] }, ...history]
    const lastMessage = messages[messages.length - 1]?.content ?? ''

    const chat = genModel.startChat({ history: allMessages })
    const result = await chat.sendMessageStream(lastMessage)

    for await (const chunk of result.stream) {
        yield chunk.text()
    }
}

// ── Ollama Model Discovery ─────────────────────────────────
export async function listOllamaModels(ollamaUrl: string): Promise<string[]> {
    try {
        const response = await fetch(`${ollamaUrl.replace('localhost', '127.0.0.1')}/api/tags`, {
            signal: AbortSignal.timeout(3000),
        })
        if (!response.ok) return []
        const data = await response.json() as { models: { name: string }[] }
        return (data.models || []).map(m => `ollama:${m.name}`)
    } catch {
        return []
    }
}

// ── LM Studio Model Discovery ────────────────────────────────
export async function listLMStudioModels(lmstudioUrl: string): Promise<string[]> {
    try {
        const response = await fetch(`${lmstudioUrl.replace('localhost', '127.0.0.1')}/v1/models`, {
            signal: AbortSignal.timeout(3000),
        })
        if (!response.ok) return []
        const data = await response.json() as { data: { id: string }[] }
        return (data.data || []).map(m => `lmstudio:${m.id}`)
    } catch {
        return []
    }
}
