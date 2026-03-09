import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('SearchOperators', () => {
    let operators: typeof import('../src/main/services/searchOperators')
    
    beforeEach(async () => {
        vi.resetModules()
        const { resetSearchOperators } = await import('../src/main/services/searchOperators')
        resetSearchOperators()
        operators = await import('../src/main/services/searchOperators')
    })

    describe('parseSearchQuery', () => {
        it('parses site operator', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            const parsed = mgr.parseSearchQuery('test site:github.com')

            expect(parsed.baseQuery).toBe('test')
            expect(parsed.operators.sites).toContain('github.com')
        })

        it('parses multiple site operators', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            const parsed = mgr.parseSearchQuery('react site:github.com site:npmjs.com')

            expect(parsed.operators.sites).toHaveLength(2)
            expect(parsed.operators.sites).toContain('github.com')
            expect(parsed.operators.sites).toContain('npmjs.com')
        })

        it('parses filetype operator', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            const parsed = mgr.parseSearchQuery('python filetype:pdf')

            expect(parsed.baseQuery).toBe('python')
            expect(parsed.operators.fileTypes).toContain('pdf')
        })

        it('parses date range', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            const parsed = mgr.parseSearchQuery('AI date:2024..2025')

            expect(parsed.operators.dateRange).toBeDefined()
            expect(parsed.operators.dateRange?.start.getFullYear()).toBe(2024)
            expect(parsed.operators.dateRange?.end.getFullYear()).toBe(2025)
        })

        it('parses language operator', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            const parsed = mgr.parseSearchQuery('tutorial lang:en,es')

            expect(parsed.operators.languages).toEqual(['en', 'es'])
        })

        it('parses exclude terms', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            const parsed = mgr.parseSearchQuery('react !vue !angular')

            expect(parsed.operators.excludeTerms).toContain('vue')
            expect(parsed.operators.excludeTerms).toContain('angular')
        })

        it('parses quoted phrase as exact match', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            const parsed = mgr.parseSearchQuery('"hello world" test')

            expect(parsed.operators.exactPhrase).toBe('hello world')
            expect(parsed.baseQuery).toContain('test')
        })

        it('handles empty query', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            const parsed = mgr.parseSearchQuery('')

            expect(parsed.baseQuery).toBe('')
            expect(Object.keys(parsed.operators).length).toBeGreaterThanOrEqual(0)
        })
    })

    describe('validateQuery', () => {
        it('returns true for valid query with operators', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            
            expect(mgr.validateQuery('test site:github.com')).toBe(true)
        })

        it('returns true for plain query', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            
            expect(mgr.validateQuery('plain query')).toBe(true)
        })

        it('returns false for empty query', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            
            expect(mgr.validateQuery('')).toBe(false)
        })
    })

    describe('getAvailableOperators', () => {
        it('returns list of operators', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            
            const ops = mgr.getAvailableOperators()
            
            expect(ops.length).toBeGreaterThan(0)
            expect(ops[0]).toHaveProperty('name')
            expect(ops[0]).toHaveProperty('description')
            expect(ops[0]).toHaveProperty('example')
        })

        it('does not duplicate aliased operators', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            
            const ops = mgr.getAvailableOperators()
            const names = ops.map(o => o.name)
            const uniqueNames = new Set(names)
            
            expect(names.length).toBe(uniqueNames.size)
        })
    })

    describe('compileQueryForSearch', () => {
        it('compiles query with all operators', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            
            const parsed = mgr.parseSearchQuery('test site:github.com filetype:pdf date:2024..2025 !spam')
            const compiled = mgr.compileQueryForSearch(parsed)
            
            expect(compiled.q).toBe('test')
            expect(compiled.sites).toContain('github.com')
            expect(compiled.fileTypes).toContain('pdf')
            expect(compiled.dateRange).toBeDefined()
            expect(compiled.excludeTerms).toContain('spam')
        })
    })

    describe('buildSearchUrl', () => {
        it('builds DuckDuckGo URL', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            
            const parsed = mgr.parseSearchQuery('test site:github.com !spam')
            const url = mgr.buildSearchUrl(parsed, 'duckduckgo')
            
            expect(url).toContain('duckduckgo.com')
            expect(url).toContain('test')
        })

        it('builds Brave Search URL', async () => {
            const { getSearchOperatorsInstance } = operators
            const mgr = getSearchOperatorsInstance()
            
            const parsed = mgr.parseSearchQuery('test')
            const url = mgr.buildSearchUrl(parsed, 'brave')
            
            expect(url).toContain('search.brave.com')
            expect(url).toContain('test')
        })
    })
})
