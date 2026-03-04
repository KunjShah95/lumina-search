import { describe, it, expect } from 'vitest'
import {
    addMemoryFact,
    buildMemoryContext,
    clearThreadMemories,
    deleteMemoryFact,
    listMemoryFacts,
    maybeRememberFromQuery,
    pruneExpiredMemories,
} from '../src/main/services/memoryProfile'

describe('Memory profile service', () => {
    it('stores and retrieves thread-scoped memory facts', () => {
        const threadId = `thread_mem_${Date.now()}`

        const created = addMemoryFact({
            threadId,
            key: 'style',
            value: 'Prefer concise answers with bullet points.',
            tags: ['style', 'format'],
            source: 'manual',
            ttlDays: 14,
        })

        const facts = listMemoryFacts(threadId)
        expect(facts.length).toBeGreaterThan(0)
        expect(facts[0].threadId).toBe(threadId)
        expect(facts.some(f => f.id === created.id)).toBe(true)

        const context = buildMemoryContext({
            threadId,
            query: 'Please answer in bullet points and keep it short',
            maxFacts: 5,
        })

        expect(context.memories.length).toBeGreaterThan(0)
        expect(context.text).toContain('USER MEMORY')

        const deleted = deleteMemoryFact(created.id)
        expect(deleted).toBe(true)
    })

    it('can auto-capture explicit remember statements', () => {
        const threadId = `thread_auto_${Date.now()}`
        const captured = maybeRememberFromQuery({
            threadId,
            query: 'Remember that I prefer examples in TypeScript.',
            ttlDays: 30,
        })

        expect(captured).not.toBeNull()
        expect(captured?.source).toBe('auto')

        const facts = listMemoryFacts(threadId)
        expect(facts.length).toBeGreaterThan(0)

        clearThreadMemories(threadId)
    })

    it('prunes expired memory entries', () => {
        const threadId = `thread_exp_${Date.now()}`
        addMemoryFact({
            threadId,
            value: 'Temporary preference',
            source: 'manual',
            ttlDays: 1,
        })

        const pruned = pruneExpiredMemories(Date.now() + 3 * 24 * 60 * 60 * 1000)
        expect(pruned).toBeGreaterThanOrEqual(1)

        const remaining = listMemoryFacts(threadId)
        expect(remaining.length).toBe(0)
    })
})
