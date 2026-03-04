import { describe, it, expect } from 'vitest'
import { getOnlineEvalFeedback, getOnlineEvalFeedbackStats, recordOnlineEvalFeedback } from '../src/main/services/evalFeedback'

describe('Online evaluation feedback', () => {
    it('records feedback entries', () => {
        const created = recordOnlineEvalFeedback({
            threadId: 'thread_test_feedback_1',
            query: 'What is hybrid retrieval?',
            answerPreview: 'Hybrid retrieval combines BM25 and vector search...',
            vote: 'up',
            citedCorrectly: true,
            source: 'manual',
        })

        expect(created.id).toContain('fb_')
        expect(created.threadId).toBe('thread_test_feedback_1')
        expect(created.vote).toBe('up')

        const list = getOnlineEvalFeedback(10)
        expect(list.length).toBeGreaterThan(0)
    })

    it('computes aggregate feedback stats', () => {
        const stats = getOnlineEvalFeedbackStats()

        expect(stats.total).toBeGreaterThanOrEqual(1)
        expect(stats.positiveRate).toBeGreaterThanOrEqual(0)
        expect(stats.positiveRate).toBeLessThanOrEqual(1)
        expect(stats.citationCorrectRate).toBeGreaterThanOrEqual(0)
        expect(stats.citationCorrectRate).toBeLessThanOrEqual(1)
    })
})
