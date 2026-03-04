/**
 * Confidence Scorer — Score answer quality based on source coverage,
 * citation density, and coherence metrics.
 */
import { SearchResult } from './types'

export interface ConfidenceScore {
    score: number          // 0-100
    label: 'high' | 'medium' | 'low'
    reasoning: string
    metrics: {
        sourceCoverage: number   // 0-1
        citationDensity: number  // 0-1
        answerCompleteness: number // 0-1
        coherence: number        // 0-1
        citationCoverage: number // 0-1
        sourceDiversity: number  // 0-1
        contradictionSafety: number // 0-1 (higher is better)
        freshnessScore: number   // 0-1
    }
}

/**
 * Score an answer's confidence based on multiple heuristic signals.
 */
export function scoreAnswer(
    answer: string,
    sources: SearchResult[],
    query: string
): ConfidenceScore {
    const citationCoverage = computeCitationCoverage(answer, sources)
    const sourceDiversity = computeSourceDiversity(sources)
    const contradictionSafety = computeContradictionSafety(answer)
    const freshnessScore = computeFreshnessScore(sources)

    const metrics = {
        sourceCoverage: citationCoverage,
        citationDensity: computeCitationDensity(answer, sources),
        answerCompleteness: computeCompleteness(answer, query),
        coherence: computeCoherence(answer),
        citationCoverage,
        sourceDiversity,
        contradictionSafety,
        freshnessScore,
    }

    // Weighted average for v2 quality signals.
    const score = Math.round(
        metrics.citationCoverage * 20 +
        metrics.sourceDiversity * 15 +
        metrics.contradictionSafety * 20 +
        metrics.freshnessScore * 10 +
        metrics.citationDensity * 10 +
        metrics.answerCompleteness * 15 +
        metrics.coherence * 10
    )

    const label: ConfidenceScore['label'] =
        score >= 70 ? 'high' :
            score >= 40 ? 'medium' : 'low'

    const reasoning = generateReasoning(metrics, label)

    return { score, label, reasoning, metrics }
}

/**
 * Repair trigger policy for low-quality answers.
 */
export function shouldTriggerRepair(score: ConfidenceScore, threshold: number = 65): boolean {
    return (
        score.score < threshold ||
        score.metrics.citationCoverage < 0.45 ||
        score.metrics.sourceDiversity < 0.35 ||
        score.metrics.contradictionSafety < 0.5
    )
}

/**
 * How many unique sources are referenced in the answer?
 */
function computeSourceCoverage(answer: string, sources: SearchResult[]): number {
    if (sources.length === 0) return 0.3 // Partial credit if no sources to cite

    // Numbered citation style: [1], [2], ...
    const numbered = Array.from(answer.matchAll(/\[(\d+)\]/g)).map(m => Number(m[1]))
    if (numbered.length > 0) {
        const uniqueNumbers = new Set(numbered.filter(n => Number.isFinite(n) && n > 0))
        const numberedCoverage = Math.min(uniqueNumbers.size / Math.max(sources.length, 1), 1)
        if (numberedCoverage >= 0.5) return numberedCoverage
    }

    let cited = 0
    for (const src of sources) {
        // Check if any part of the source domain/title appears in the answer
        const indicators = [
            src.domain,
            src.title.split(' ').slice(0, 3).join(' '),
            src.url,
        ].filter(Boolean)

        const isCited = indicators.some(ind =>
            answer.toLowerCase().includes(ind.toLowerCase().slice(0, 20))
        )

        // Also check bracket citations like [Source: ...]
        const bracketCited = answer.includes(`[${src.title}`) ||
            answer.includes(`[${src.domain}`) ||
            answer.includes(`[Web:`) ||
            answer.includes(`[Local`)

        if (isCited || bracketCited) cited++
    }

    return Math.min(cited / Math.max(sources.length, 1), 1)
}

/**
 * Citation coverage (v2 naming) — aliasing source coverage behavior.
 */
function computeCitationCoverage(answer: string, sources: SearchResult[]): number {
    return computeSourceCoverage(answer, sources)
}

/**
 * Source diversity by unique domains.
 */
function computeSourceDiversity(sources: SearchResult[]): number {
    if (sources.length === 0) return 0
    const uniqueDomains = new Set(sources.map(s => s.domain).filter(Boolean))
    const denom = Math.min(Math.max(sources.length, 1), 5)
    return Math.min(uniqueDomains.size / denom, 1)
}

/**
 * Heuristic contradiction safety score.
 * Detects explicit contradiction cues in answer text.
 */
function computeContradictionSafety(answer: string): number {
    const lower = answer.toLowerCase()
    const contradictionCueCount = (
        (lower.match(/\bhowever\b/g) || []).length +
        (lower.match(/\bon the other hand\b/g) || []).length +
        (lower.match(/\bcontradict\w*\b/g) || []).length +
        (lower.match(/\bin contrast\b/g) || []).length
    )

    // If text contains both strong affirmative and strong negative assertions,
    // lightly penalize unless clearly acknowledged with citations.
    const hasStrongAffirmative = /\b(always|definitely|certainly|is|are)\b/.test(lower)
    const hasStrongNegative = /\b(never|cannot|can't|is not|are not|no)\b/.test(lower)
    const hasCitations = /\[[^\]]+\]/.test(answer)

    let score = 1
    if (contradictionCueCount > 2) score -= 0.15
    if (hasStrongAffirmative && hasStrongNegative && !hasCitations) score -= 0.2

    return Math.max(0, Math.min(1, score))
}

/**
 * Freshness based on recency hints (year tokens) in title/snippet.
 */
function computeFreshnessScore(sources: SearchResult[]): number {
    if (sources.length === 0) return 0.4

    const currentYear = new Date().getFullYear()
    let total = 0

    for (const src of sources) {
        const text = `${src.title} ${src.snippet}`
        const years = Array.from(text.matchAll(/\b(20\d{2})\b/g)).map(m => Number(m[1]))

        if (years.length === 0) {
            total += 0.55
            continue
        }

        const newestYear = Math.max(...years)
        const age = currentYear - newestYear

        if (age <= 1) total += 1
        else if (age <= 3) total += 0.8
        else if (age <= 6) total += 0.6
        else total += 0.35
    }

    return Math.max(0, Math.min(1, total / sources.length))
}

/**
 * Citation density: ratio of citations to answer length.
 */
function computeCitationDensity(answer: string, sources: SearchResult[]): number {
    const bracketMatches = answer.match(/\[([^\]]+)\]/g) || []
    const paragraphs = answer.split(/\n\n+/).filter(p => p.trim().length > 20)

    if (paragraphs.length === 0) return 0

    // Ideal: at least one citation per 2 paragraphs
    const idealCitations = Math.ceil(paragraphs.length / 2)
    const ratio = Math.min(bracketMatches.length / Math.max(idealCitations, 1), 1)

    return ratio
}

/**
 * Answer completeness: does the answer address the query terms?
 */
function computeCompleteness(answer: string, query: string): number {
    const queryWords = query.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3) // Skip short words

    if (queryWords.length === 0) return 0.5

    const answerLower = answer.toLowerCase()
    let covered = 0

    for (const word of queryWords) {
        if (answerLower.includes(word)) covered++
    }

    const wordCoverage = covered / queryWords.length

    // Also check answer length relative to query complexity
    const lengthScore = Math.min(answer.length / (queryWords.length * 100), 1)

    return (wordCoverage * 0.7 + lengthScore * 0.3)
}

/**
 * Coherence: structural quality signals.
 */
function computeCoherence(answer: string): number {
    let score = 0.5 // baseline

    // Has markdown structure (headers, lists, code blocks)
    if (/^#{1,3}\s/m.test(answer)) score += 0.1
    if (/^[-*]\s/m.test(answer)) score += 0.1
    if (/```/.test(answer)) score += 0.05

    // Reasonable length (not too short, not absurdly long)
    if (answer.length > 200 && answer.length < 10000) score += 0.1

    // Has multiple paragraphs
    const paragraphs = answer.split(/\n\n+/).filter(p => p.trim())
    if (paragraphs.length >= 2) score += 0.1

    // No error indicators
    if (/\b(error|failed|unavailable|cannot)\b/i.test(answer)) score -= 0.15

    // No mock/placeholder indicators
    if (/\b(mock|placeholder|lorem ipsum|todo)\b/i.test(answer)) score -= 0.2

    return Math.max(0, Math.min(1, score))
}

function generateReasoning(metrics: ConfidenceScore['metrics'], label: string): string {
    const parts: string[] = []

    if (metrics.citationCoverage >= 0.7) parts.push('Good citation coverage')
    else if (metrics.citationCoverage < 0.3) parts.push('Low citation coverage')

    if (metrics.sourceDiversity >= 0.6) parts.push('Diverse sources')
    else if (metrics.sourceDiversity < 0.35) parts.push('Low source diversity')

    if (metrics.contradictionSafety < 0.55) parts.push('Potentially conflicting claims')

    if (metrics.freshnessScore >= 0.7) parts.push('Fresh supporting evidence')
    else if (metrics.freshnessScore < 0.45) parts.push('Potentially stale evidence')

    if (metrics.citationDensity >= 0.6) parts.push('Well-cited')
    else if (metrics.citationDensity < 0.2) parts.push('Few citations')

    if (metrics.answerCompleteness >= 0.7) parts.push('Query well-addressed')
    else if (metrics.answerCompleteness < 0.4) parts.push('Partial query coverage')

    if (metrics.coherence >= 0.7) parts.push('Well-structured')

    return parts.join(' · ') || `${label} confidence`
}
