import { describe, it, expect } from 'vitest'
import { scoreAnswer, shouldTriggerRepair } from '../src/main/agents/confidenceScorer'
import { SearchResult } from '../src/main/agents/types'

describe('Quality Engine (v2 heuristics)', () => {
    const sources: SearchResult[] = [
        {
            url: 'https://docs.example.com/ai-updates-2025',
            title: 'AI Platform Update 2025',
            snippet: 'Published in 2025. Introduces new retrieval pipeline and stronger citation policy.',
            domain: 'docs.example.com',
        },
        {
            url: 'https://research.example.org/rag-benchmarks-2024',
            title: 'RAG Benchmarks 2024',
            snippet: 'A 2024 benchmark on citation fidelity and retrieval robustness.',
            domain: 'research.example.org',
        },
    ]

    it('computes all v2 quality metrics', () => {
        const answer = `## Summary\nThe system improved citation fidelity [1] and retrieval quality [2].`
        const score = scoreAnswer(answer, sources, 'How did retrieval quality improve?')

        expect(score.metrics).toHaveProperty('citationCoverage')
        expect(score.metrics).toHaveProperty('sourceDiversity')
        expect(score.metrics).toHaveProperty('contradictionSafety')
        expect(score.metrics).toHaveProperty('freshnessScore')

        expect(score.score).toBeGreaterThanOrEqual(0)
        expect(score.score).toBeLessThanOrEqual(100)
    })

    it('triggers repair when citation coverage is weak', () => {
        const answer = 'This is an uncited answer with broad claims and no references.'
        const score = scoreAnswer(answer, sources, 'What changed?')

        expect(shouldTriggerRepair(score, 80)).toBe(true)
    })

    it('does not force repair for well-cited, coherent answer', () => {
        const answer = `## Findings\nThe 2025 update introduces stricter evidence checks [1].\n\nBenchmark evidence from 2024 supports quality gains [2].`
        const score = scoreAnswer(answer, sources, 'What is the evidence?')

        expect(shouldTriggerRepair(score, 40)).toBe(false)
    })
})
