import { BudgetPolicy, CostEstimate } from './types'
import { createLogger } from '../services/logger'

const logger = createLogger('budget-planner')

interface PlanInput {
    query: string
    modelId: string
    contextChars: number
    maxOutputTokens?: number
    confidenceGap?: number
    sessionId?: string
    policy?: BudgetPolicy
}

interface BudgetUsageState {
    sessionTokens: Map<string, number>
    dayTokens: Map<string, number>
    monthTokens: Map<string, number>
    monthCosts: Map<string, number>
}

interface BudgetStats {
    period: string
    totalTokens: number
    totalCostUsd: number
    queryCount: number
    averageTokensPerQuery: number
    averageCostPerQuery: number
    trendLastWeek?: { tokens: number[]; costs: number[] }
}

const usageState: BudgetUsageState = {
    sessionTokens: new Map(),
    dayTokens: new Map(),
    monthTokens: new Map(),
    monthCosts: new Map(),
}

const MODEL_INPUT_COST_PER_1K: Record<string, number> = {
    openai: 0.003,
    anthropic: 0.004,
    gemini: 0.0015,
    ollama: 0,
    lmstudio: 0,
}

const MODEL_OUTPUT_COST_PER_1K: Record<string, number> = {
    openai: 0.01,
    anthropic: 0.012,
    gemini: 0.004,
    ollama: 0,
    lmstudio: 0,
}

const DEFAULT_POLICY: Required<BudgetPolicy> = {
    enabled: true,
    softLimitTokensPerQuery: 4500,
    hardLimitTokensPerQuery: 7000,
    softLimitTokensPerSession: 25000,
    hardLimitTokensPerSession: 45000,
    softLimitTokensPerDay: 120000,
    hardLimitTokensPerDay: 220000,
    softLimitTokensPerMonth: 2500000,
    hardLimitTokensPerMonth: 4000000,
    softLimitCostPerDay: 10,
    hardLimitCostPerDay: 50,
    softLimitCostPerMonth: 300,
    hardLimitCostPerMonth: 900,
}

export class BudgetPlanner {
    estimate(input: PlanInput): CostEstimate {
        const policy = this.resolvePolicy(input.policy)

        const baseInputTokens = this.estimateTokens(`${input.query}`) + this.estimateTokensFromChars(input.contextChars)
        const estimatedOutputTokens = Math.max(256, Math.min(input.maxOutputTokens ?? 900, 2048))

        let contextCompressionRatio = 1
        let estimatedInputTokens = baseInputTokens

        if (estimatedInputTokens + estimatedOutputTokens > policy.softLimitTokensPerQuery) {
            contextCompressionRatio = 0.72
            estimatedInputTokens = Math.max(128, Math.round(baseInputTokens * contextCompressionRatio))
        }

        const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens
        const provider = this.extractProvider(input.modelId)
        const projectedCostUsd = this.estimateCost(provider, estimatedInputTokens, estimatedOutputTokens)

        const sessionKey = input.sessionId || 'default'
        const dayKey = this.currentDayKey()
        const monthKey = this.currentMonthKey()
        const sessionUsed = usageState.sessionTokens.get(sessionKey) ?? 0
        const dayUsed = usageState.dayTokens.get(dayKey) ?? 0
        const monthUsed = usageState.monthTokens.get(monthKey) ?? 0
        const monthCostUsed = usageState.monthCosts.get(monthKey) ?? 0

        const hardQueryExceeded = estimatedTotalTokens > policy.hardLimitTokensPerQuery
        const hardSessionExceeded = sessionUsed + estimatedTotalTokens > policy.hardLimitTokensPerSession
        const hardDayExceeded = dayUsed + estimatedTotalTokens > policy.hardLimitTokensPerDay
        const hardMonthExceeded = monthUsed + estimatedTotalTokens > policy.hardLimitTokensPerMonth
        const hardCostExceeded = monthCostUsed + projectedCostUsd > policy.hardLimitCostPerMonth

        if (policy.enabled && (hardQueryExceeded || hardSessionExceeded || hardDayExceeded || hardMonthExceeded || hardCostExceeded)) {
            return {
                estimatedInputTokens,
                estimatedOutputTokens,
                estimatedTotalTokens,
                projectedCostUsd,
                recommendedTier: 'tier1',
                contextCompressionRatio,
                shouldBlock: true,
                reason: hardQueryExceeded
                    ? 'Hard query budget exceeded'
                    : hardSessionExceeded
                        ? 'Hard session budget exceeded'
                        : hardDayExceeded
                            ? 'Hard daily budget exceeded'
                            : hardMonthExceeded
                                ? 'Hard monthly token budget exceeded'
                                : 'Hard monthly cost budget exceeded',
            }
        }

        const recommendedTier = this.pickTier(
            input.confidenceGap ?? 0,
            estimatedTotalTokens,
            policy,
            sessionUsed,
            dayUsed,
            monthUsed,
            monthCostUsed,
            projectedCostUsd,
        )

        return {
            estimatedInputTokens,
            estimatedOutputTokens,
            estimatedTotalTokens,
            projectedCostUsd,
            recommendedTier,
            contextCompressionRatio,
            shouldBlock: false,
        }
    }

    registerUsage(sessionId: string, consumedTokens: number, costUsd?: number): void {
        if (!Number.isFinite(consumedTokens) || consumedTokens <= 0) return

        const dayKey = this.currentDayKey()
        const monthKey = this.currentMonthKey()
        const currentSession = usageState.sessionTokens.get(sessionId) ?? 0
        const currentDay = usageState.dayTokens.get(dayKey) ?? 0
        const currentMonth = usageState.monthTokens.get(monthKey) ?? 0
        const currentMonthCost = usageState.monthCosts.get(monthKey) ?? 0

        usageState.sessionTokens.set(sessionId, currentSession + consumedTokens)
        usageState.dayTokens.set(dayKey, currentDay + consumedTokens)
        usageState.monthTokens.set(monthKey, currentMonth + consumedTokens)

        if (costUsd && Number.isFinite(costUsd) && costUsd > 0) {
            usageState.monthCosts.set(monthKey, currentMonthCost + costUsd)
            logger.info('Budget usage registered', {
                sessionId,
                tokens: consumedTokens,
                costUsd: Number(costUsd.toFixed(4)),
                monthTotalTokens: currentMonth + consumedTokens,
                monthTotalCost: Number((currentMonthCost + costUsd).toFixed(2)),
            })
        }
    }

    selectModelForTier(baseModelId: string, tier: 'tier1' | 'tier2' | 'tier3'): string {
        if (tier === 'tier2') return baseModelId

        if (baseModelId.startsWith('openai:')) {
            if (tier === 'tier1') {
                if (baseModelId.includes('gpt-4o')) return baseModelId.replace('gpt-4o', 'gpt-4o-mini')
                if (baseModelId.includes('gpt-4.1')) return baseModelId.replace('gpt-4.1', 'gpt-4.1-mini')
            }
            if (tier === 'tier3') {
                if (baseModelId.includes('gpt-4o-mini')) return baseModelId.replace('gpt-4o-mini', 'gpt-4o')
                if (baseModelId.includes('gpt-4.1-mini')) return baseModelId.replace('gpt-4.1-mini', 'gpt-4.1')
                if (baseModelId.includes('gpt-4.1-nano')) return baseModelId.replace('gpt-4.1-nano', 'gpt-4.1-mini')
            }
            return baseModelId
        }

        if (baseModelId.startsWith('anthropic:')) {
            if (tier === 'tier1' && baseModelId.includes('sonnet')) return baseModelId.replace('sonnet', 'haiku')
            if (tier === 'tier3' && baseModelId.includes('haiku')) return baseModelId.replace('haiku', 'sonnet')
            if (tier === 'tier3' && baseModelId.includes('sonnet')) return baseModelId.replace('sonnet', 'opus')
            return baseModelId
        }

        if (baseModelId.startsWith('gemini:')) {
            if (tier === 'tier1' && baseModelId.includes('pro')) return baseModelId.replace('pro', 'flash')
            if (tier === 'tier3' && baseModelId.includes('flash')) return baseModelId.replace('flash', 'pro')
            return baseModelId
        }

        return baseModelId
    }

    estimateTokens(text: string): number {
        if (!text) return 0
        return Math.max(1, Math.ceil(text.length / 4))
    }

    estimateTokensFromChars(chars: number): number {
        if (!Number.isFinite(chars) || chars <= 0) return 0
        return Math.max(1, Math.ceil(chars / 4))
    }

    private pickTier(
        confidenceGap: number,
        estimatedTotalTokens: number,
        policy: Required<BudgetPolicy>,
        sessionUsed: number,
        dayUsed: number,
        monthUsed: number,
        monthCostUsed: number,
        projectedCostUsd: number,
    ): 'tier1' | 'tier2' | 'tier3' {
        const sessionHeadroom = policy.hardLimitTokensPerSession - sessionUsed
        const dayHeadroom = policy.hardLimitTokensPerDay - dayUsed
        const monthHeadroom = policy.hardLimitTokensPerMonth - monthUsed
        const monthCostHeadroom = policy.hardLimitCostPerMonth - monthCostUsed

        // Budget pressure forces cheaper tiers first (monthly constraints are strongest)
        if (
            estimatedTotalTokens > policy.softLimitTokensPerQuery ||
            sessionHeadroom < policy.softLimitTokensPerSession * 0.25 ||
            dayHeadroom < policy.softLimitTokensPerDay * 0.2 ||
            monthHeadroom < policy.softLimitTokensPerMonth * 0.15 ||
            monthCostHeadroom < policy.softLimitCostPerMonth * 0.2
        ) {
            return 'tier1'
        }

        // Cost-aware routing
        if (monthCostHeadroom < policy.softLimitCostPerMonth * 0.5) {
            return 'tier1'
        }

        // Confidence-driven routing
        if (confidenceGap > 0.35) return 'tier3'
        if (confidenceGap > 0.15) return 'tier2'
        return 'tier1'
    }

    private resolvePolicy(policy?: BudgetPolicy): Required<BudgetPolicy> {
        return {
            ...DEFAULT_POLICY,
            ...(policy || {}),
            enabled: policy?.enabled ?? true,
        }
    }

    private extractProvider(modelId: string): string {
        const provider = modelId.split(':')[0]
        return provider || 'openai'
    }

    private estimateCost(provider: string, inputTokens: number, outputTokens: number): number {
        const inRate = MODEL_INPUT_COST_PER_1K[provider] ?? MODEL_INPUT_COST_PER_1K.openai
        const outRate = MODEL_OUTPUT_COST_PER_1K[provider] ?? MODEL_OUTPUT_COST_PER_1K.openai

        const inputCost = (inputTokens / 1000) * inRate
        const outputCost = (outputTokens / 1000) * outRate
        return Number((inputCost + outputCost).toFixed(6))
    }

    private currentDayKey(): string {
        return new Date().toISOString().slice(0, 10)
    }

    private currentMonthKey(): string {
        return new Date().toISOString().slice(0, 7)
    }

    /**
     * Get current budget statistics for the month
     */
    getBudgetStats(): BudgetStats {
        const monthKey = this.currentMonthKey()
        const monthTokens = usageState.monthTokens.get(monthKey) ?? 0
        const monthCosts = usageState.monthCosts.get(monthKey) ?? 0
        const sessions = Array.from(usageState.sessionTokens.entries()).filter(
            ([, v]) => Number.isFinite(v) && v > 0,
        ).length

        return {
            period: `${monthKey}-01 to ${monthKey}-31`,
            totalTokens: monthTokens,
            totalCostUsd: Number(monthCosts.toFixed(2)),
            queryCount: sessions,
            averageTokensPerQuery: sessions > 0 ? Math.round(monthTokens / sessions) : 0,
            averageCostPerQuery:
                sessions > 0 ? Number((monthCosts / sessions).toFixed(4)) : 0,
        }
    }

    /**
     * Get remaining budget headroom
     */
    getRemainingBudget(policy?: BudgetPolicy): {
        tokensRemaining: number
        costRemaining: number
        percentTokens: number
        percentCost: number
    } {
        const resolvedPolicy = this.resolvePolicy(policy)
        const monthKey = this.currentMonthKey()
        const monthTokens = usageState.monthTokens.get(monthKey) ?? 0
        const monthCosts = usageState.monthCosts.get(monthKey) ?? 0

        const tokensRemaining = Math.max(0, resolvedPolicy.hardLimitTokensPerMonth - monthTokens)
        const costRemaining = Math.max(0, resolvedPolicy.hardLimitCostPerMonth - monthCosts)
        const percentTokens = Math.round(
            (tokensRemaining / resolvedPolicy.hardLimitTokensPerMonth) * 100,
        )
        const percentCost = Math.round((costRemaining / resolvedPolicy.hardLimitCostPerMonth) * 100)

        return { tokensRemaining, costRemaining, percentTokens, percentCost }
    }

    /**
     * Clear month statistics (useful for testing or month rollover)
     */
    clearMonthlyStats(monthKey?: string): void {
        const key = monthKey || this.currentMonthKey()
        usageState.monthTokens.delete(key)
        usageState.monthCosts.delete(key)
        logger.info('Cleared monthly budget stats', { monthKey: key })
    }

    /**
     * Clear all statistics
     */
    clearAllStats(): void {
        usageState.sessionTokens.clear()
        usageState.dayTokens.clear()
        usageState.monthTokens.clear()
        usageState.monthCosts.clear()
        logger.info('Cleared all budget stats')
    }
}

export const budgetPlanner = new BudgetPlanner()
