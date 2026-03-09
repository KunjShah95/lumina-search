import { describe, it, expect, beforeEach } from 'vitest'
import { getSearchOperatorsInstance, resetSearchOperators } from '../src/main/services/searchOperators'

describe('SearchOperatorsManager', () => {
    beforeEach(() => {
        resetSearchOperators()
    })

    it('parses site and filetype operators and cleans base query', () => {
        const mgr = getSearchOperatorsInstance()
        const parsed = mgr.parseSearchQuery('TypeScript handbook site:stackoverflow.com filetype:pdf')

        expect(parsed.baseQuery).toBe('TypeScript handbook')
        expect(parsed.operators.sites).toEqual(['stackoverflow.com'])
        expect(parsed.operators.fileTypes).toEqual(['pdf'])
    })

    it('parses language alias and exclude terms', () => {
        const mgr = getSearchOperatorsInstance()
        const parsed = mgr.parseSearchQuery('react hooks lang:en !beginner !course')

        expect(parsed.baseQuery).toBe('react hooks')
        expect(parsed.operators.languages).toEqual(['en'])
        expect(parsed.operators.excludeTerms).toEqual(['beginner', 'course'])
    })

    it('parses date ranges and normalizes reversed ranges', () => {
        const mgr = getSearchOperatorsInstance()
        const parsed = mgr.parseSearchQuery('llm eval date:2025..2024')

        expect(parsed.baseQuery).toBe('llm eval')
        expect(parsed.operators.dateRange).toBeTruthy()
        expect(parsed.operators.dateRange!.start.getFullYear()).toBe(2024)
        expect(parsed.operators.dateRange!.end.getFullYear()).toBe(2025)
    })

    it('captures exact quoted phrase', () => {
        const mgr = getSearchOperatorsInstance()
        const parsed = mgr.parseSearchQuery('vector db "hybrid search ranking" site:github.com')

        expect(parsed.baseQuery).toBe('vector db')
        expect(parsed.operators.exactPhrase).toBe('hybrid search ranking')
        expect(parsed.operators.sites).toEqual(['github.com'])
    })
})
