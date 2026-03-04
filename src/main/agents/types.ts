export interface SearchResult {
    url: string
    title: string
    snippet: string
    domain: string
    favicon?: string
    fullText?: string
    score?: number
}

export interface BudgetPolicy {
    enabled?: boolean
    hardLimitTokensPerQuery?: number
    softLimitTokensPerQuery?: number
    hardLimitTokensPerSession?: number
    softLimitTokensPerSession?: number
    hardLimitTokensPerDay?: number
    softLimitTokensPerDay?: number
}

export interface CostEstimate {
    estimatedInputTokens: number
    estimatedOutputTokens: number
    estimatedTotalTokens: number
    projectedCostUsd: number
    recommendedTier: 'tier1' | 'tier2' | 'tier3'
    contextCompressionRatio: number
    shouldBlock: boolean
    reason?: string
}

export interface ImageResult {
    url: string
    title: string
    thumbnail: string
    domain: string
    source: string
}

export interface VideoResult {
    url: string
    title: string
    thumbnail: string
    channel: string
    duration: string
    views: string
}

export interface Document {
    id: string
    name: string
    type: 'pdf' | 'txt' | 'md' | 'doc' | 'url' | 'csv' | 'json' | 'docx' | 'epub'
    content: string
    chunks: string[]
    createdAt: number
    updatedAt: number
    sourceUrl?: string
    size: number
}

export interface KnowledgeBase {
    id: string
    name: string
    description: string
    documents: Document[]
    createdAt: number
    updatedAt: number
}

export type FocusMode = 'web' | 'academic' | 'code' | 'reddit' | 'image' | 'video' | 'hybrid-rag' | 'local' | 'all' | 'compare'

export type SearchProvider = 'tavily' | 'brave' | 'duckduckgo'

// ── Confidence Score ────────────────────────────────────────
export interface ConfidenceScore {
    score: number
    label: 'high' | 'medium' | 'low'
    reasoning: string
    metrics: {
        sourceCoverage: number
        citationDensity: number
        answerCompleteness: number
        coherence: number
        citationCoverage: number
        sourceDiversity: number
        contradictionSafety: number
        freshnessScore: number
    }
}

// ── Citation Graph ──────────────────────────────────────────
export interface CitationNode {
    url: string
    title: string
    domain: string
    linksTo: string[]
    linkedFrom: string[]
}

// ── Agent Events ────────────────────────────────────────────
export type AgentEvent =
    | { type: 'phase'; label: string }
    | { type: 'sources'; data: SearchResult[] }
    | { type: 'images'; data: ImageResult[] }
    | { type: 'videos'; data: VideoResult[] }
    | { type: 'token'; text: string }
    | { type: 'followups'; data: string[] }
    | { type: 'confidence'; data: ConfidenceScore }
    | { type: 'comparison'; data: { model: string; answer: string; duration: number }[] }
    | { type: 'citations'; data: CitationNode[] }
    | { type: 'sub-queries'; data: string[] }
    | { type: 'cost'; data: CostEstimate }
    | { type: 'done' }
    | { type: 'error'; message: string }

export interface Message {
    role: 'user' | 'assistant'
    content: string
}

export interface Thread {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messages: Message[]
    sources: SearchResult[]
    isPinned?: boolean
    isFavorite?: boolean
    tags?: string[]
    notes?: string
    lastConfidence?: ConfidenceScore
}

// ── Collections & Smart Collections ─────────────────────────

/**
 * A saved conversation collection.
 *
 * - When `filterQuery` is provided, the collection is considered a
 *   "smart collection" whose contents are computed from thread data.
 * - When `filterQuery` is omitted, the collection can be treated as
 *   a simple named bucket (manual collection) on the renderer side.
 */
export interface Collection {
    id: string
    name: string
    description?: string
    filterQuery?: string
    createdAt: number
    updatedAt: number
}

export interface SearchOpts {
    providers: SearchProvider[]
    model: string
    maxSources: number
    scrapePages: boolean
    focusMode: FocusMode
    conversationHistory?: Message[]
    compareModels?: string[]  // For compare mode
    sessionId?: string
    budgetPolicy?: BudgetPolicy
}

export interface AppSettings {
    tavilyKey: string
    braveKey: string
    openaiKey: string
    anthropicKey: string
    geminiKey: string
    ollamaUrl: string
    lmstudioUrl: string
    defaultModel: string
    defaultProvider: SearchProvider
    maxSources: number
    scrapePages: boolean
    theme: 'dark' | 'light' | 'system'
    temperature: number
    topP: number
    maxTokens: number
    hasCompletedOnboarding?: boolean
    clipboardMonitorEnabled?: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
    tavilyKey: '',
    braveKey: '',
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
    ollamaUrl: 'http://127.0.0.1:11434',
    lmstudioUrl: 'http://127.0.0.1:1234',
    defaultModel: 'ollama:llama3.2',
    defaultProvider: 'duckduckgo',
    maxSources: 8,
    scrapePages: true,
    theme: 'dark',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096,
    hasCompletedOnboarding: false,
    clipboardMonitorEnabled: false,
}
