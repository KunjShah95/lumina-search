import { describe, it, expect } from 'vitest'
import { budgetPlanner } from '../src/main/agents/BudgetPlanner'

describe('BudgetPlanner', () => {
    it('estimates tokens and projected cost', () => {
        const estimate = budgetPlanner.estimate({
            query: 'Explain vector databases for RAG',
            modelId: 'openai:gpt-4o-mini',
            contextChars: 4000,
            sessionId: 'test-session-a',
        })

        expect(estimate.estimatedInputTokens).toBeGreaterThan(0)
        expect(estimate.estimatedOutputTokens).toBeGreaterThan(0)
        expect(estimate.estimatedTotalTokens).toBe(
            estimate.estimatedInputTokens + estimate.estimatedOutputTokens,
        )
        expect(estimate.projectedCostUsd).toBeGreaterThanOrEqual(0)
        expect(estimate.shouldBlock).toBe(false)
    })

    it('blocks request when hard query limit is exceeded', () => {
        const estimate = budgetPlanner.estimate({
            query: 'Large query',
            modelId: 'openai:gpt-4o',
            contextChars: 30000,
            sessionId: 'test-session-b',
            policy: {
                hardLimitTokensPerQuery: 600,
                softLimitTokensPerQuery: 400,
            },
        })

        expect(estimate.shouldBlock).toBe(true)
        expect(estimate.reason).toContain('Hard query budget exceeded')
    })

    it('routes to a lower tier model when requested', () => {
        const cheaper = budgetPlanner.selectModelForTier('openai:gpt-4o', 'tier1')
        expect(cheaper).toBe('openai:gpt-4o-mini')

        const upgraded = budgetPlanner.selectModelForTier('openai:gpt-4o-mini', 'tier3')
        expect(upgraded).toBe('openai:gpt-4o')
    })

    it('applies context compression when soft budget is under pressure', () => {
        const estimate = budgetPlanner.estimate({
            query: 'Need a long evidence-backed answer',
            modelId: 'openai:gpt-4o-mini',
            contextChars: 12000,
            sessionId: 'test-session-c',
            policy: {
                softLimitTokensPerQuery: 2000,
                hardLimitTokensPerQuery: 9000,
            },
        })

        expect(estimate.contextCompressionRatio).toBeLessThan(1)
        expect(estimate.shouldBlock).toBe(false)
    })
})
