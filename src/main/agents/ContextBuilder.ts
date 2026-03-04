import { SearchResult, FocusMode } from './types'

interface ContextBuildOptions {
    strictCitations?: boolean
    repairPass?: boolean
    memoryContext?: string
}

export class ContextBuilderAgent {
    run(sources: SearchResult[], focusMode: FocusMode, options: ContextBuildOptions = {}): string {
        const modeInstructions: Record<FocusMode, string> = {
            web: 'Provide a comprehensive, well-structured answer with key facts and context.',
            academic: 'Focus on academic and scientific accuracy. Use formal language and cite studies.',
            code: 'Prioritize code examples, documentation links, and step-by-step technical explanations.',
            reddit: 'Summarize community perspectives, common opinions, and real user experiences.',
            image: '',
            video: '',
            'hybrid-rag': '',
            local: '',
            all: '',
            compare: 'Compare and contrast different perspectives. Highlight key differences and similarities.',
        }

        const strictCitationRules = options.strictCitations
            ? `
- Every major claim must include an inline citation [n].
- Do not include claims that are not supported by the provided sources.
- If evidence is insufficient, explicitly state uncertainty instead of guessing.
- Prefer sources with newer publication signals when evidence conflicts.`
            : ''

        const repairHint = options.repairPass
            ? `
- This is a repair pass: prioritize factual precision, citation completeness, and conflict acknowledgement.`
            : ''

        const memoryHint = options.memoryContext
            ? `

${options.memoryContext}`
            : ''

        const sourceBlocks = sources.map((s, i) => {
            const content = s.fullText
                ? `${s.snippet}\n\n${s.fullText.slice(0, 1500)}`
                : s.snippet
            return `[${i + 1}] **${s.title}**\nURL: ${s.url}\n\n${content}`
        }).join('\n\n---\n\n')

        return `You are an AI research assistant that synthesizes web search results into accurate, cited answers.

RULES:
- ${modeInstructions[focusMode]}
- Cite every claim using [1], [2], [3] inline, matching the source numbers below.
- Format your response in clean markdown with headers where appropriate.
- If sources provide conflicting information, acknowledge both perspectives.
- Do NOT begin with phrases like "Based on the sources" or "According to the results".
- Be precise, factual, and genuinely helpful.${strictCitationRules}${repairHint}${memoryHint}

SEARCH SOURCES (${sources.length} results):

${sourceBlocks}`
    }
}
