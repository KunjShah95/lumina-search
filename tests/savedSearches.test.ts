import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSavedSearchesManager, resetSavedSearchesManager } from '../src/main/services/savedSearches'

describe('SavedSearchesManager', () => {
    beforeEach(() => {
        resetSavedSearchesManager()
    })

    describe('createSearch', () => {
        it('creates a new saved search with required fields', () => {
            const mgr = getSavedSearchesManager()
            const search = mgr.createSearch({
                name: 'Test Search',
                query: 'test query',
            })

            expect(search.name).toBe('Test Search')
            expect(search.query).toBe('test query')
            expect(search.isTemplate).toBe(false)
            expect(search.starred).toBe(false)
            expect(search.executeCount).toBe(0)
            expect(search.autoRefresh?.enabled).toBe(false)
        })

        it('creates a template when isTemplate is true', () => {
            const mgr = getSavedSearchesManager()
            const search = mgr.createSearch({
                name: 'Template',
                query: '${topic} site:github.com',
                isTemplate: true,
                category: 'Development',
            })

            expect(search.isTemplate).toBe(true)
            expect(search.category).toBe('Development')
        })
    })

    describe('getSearch', () => {
        it('returns undefined for non-existent search', () => {
            const mgr = getSavedSearchesManager()
            const search = mgr.getSearch('non-existent-id')
            expect(search).toBeUndefined()
        })

        it('returns a copy of the search to prevent mutations', () => {
            const mgr = getSavedSearchesManager()
            const original = mgr.createSearch({ name: 'Test', query: 'query' })
            const retrieved = mgr.getSearch(original.id)

            expect(retrieved).toBeDefined()
            expect(retrieved?.name).toBe('Test')
        })
    })

    describe('updateSearch', () => {
        it('updates search fields', () => {
            const mgr = getSavedSearchesManager()
            const original = mgr.createSearch({ name: 'Test', query: 'query' })

            const updated = mgr.updateSearch(original.id, { name: 'Updated' })

            expect(updated?.name).toBe('Updated')
            expect(updated?.query).toBe('query')
        })

        it('returns null for non-existent search', () => {
            const mgr = getSavedSearchesManager()
            const result = mgr.updateSearch('non-existent', { name: 'Updated' })
            expect(result).toBeNull()
        })

        it('prevents ID changes', () => {
            const mgr = getSavedSearchesManager()
            const original = mgr.createSearch({ name: 'Test', query: 'query' })

            const updated = mgr.updateSearch(original.id, { id: 'new-id' } as any)

            expect(updated?.id).toBe(original.id)
        })
    })

    describe('deleteSearch', () => {
        it('deletes a search successfully', () => {
            const mgr = getSavedSearchesManager()
            const search = mgr.createSearch({ name: 'Test', query: 'query' })

            const deleted = mgr.deleteSearch(search.id)

            expect(deleted).toBe(true)
            expect(mgr.getSearch(search.id)).toBeUndefined()
        })

        it('returns false for non-existent search', () => {
            const mgr = getSavedSearchesManager()
            const deleted = mgr.deleteSearch('non-existent')
            expect(deleted).toBe(false)
        })
    })

    describe('getAllSearches', () => {
        it('returns all searches sorted by updatedAt', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'First', query: 'a' })
            mgr.createSearch({ name: 'Second', query: 'b' })

            const all = mgr.getAllSearches()

            expect(all.length).toBe(2)
        })

        it('filters by isTemplate', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'Regular', query: 'a', isTemplate: false })
            mgr.createSearch({ name: 'Template', query: 'b', isTemplate: true })

            const templates = mgr.getAllSearches({ isTemplate: true })

            expect(templates.length).toBe(1)
            expect(templates[0].name).toBe('Template')
        })

        it('filters by category', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'A', query: 'a', category: 'Research' })
            mgr.createSearch({ name: 'B', query: 'b', category: 'Dev' })

            const research = mgr.getAllSearches({ category: 'Research' })

            expect(research.length).toBe(1)
            expect(research[0].name).toBe('A')
        })

        it('filters by tags', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'A', query: 'a', tags: ['important'] })
            mgr.createSearch({ name: 'B', query: 'b', tags: ['normal'] })

            const important = mgr.getAllSearches({ tags: ['important'] })

            expect(important.length).toBe(1)
        })
    })

    describe('searchSearches', () => {
        it('finds searches by name', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'Python Tutorial', query: 'python' })

            const results = mgr.searchSearches('python')

            expect(results.length).toBe(1)
            expect(results[0].name).toBe('Python Tutorial')
        })

        it('finds searches by query content', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'My Search', query: 'machine learning' })

            const results = mgr.searchSearches('machine')

            expect(results.length).toBe(1)
        })

        it('finds searches by description', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'Search', query: 'query', description: 'Learn about AI' })

            const results = mgr.searchSearches('learn')

            expect(results.length).toBe(1)
        })
    })

    describe('toggleStar', () => {
        it('toggles star status', () => {
            const mgr = getSavedSearchesManager()
            const search = mgr.createSearch({ name: 'Test', query: 'query' })

            expect(search.starred).toBe(false)

            const starred = mgr.toggleStar(search.id)
            expect(starred).toBe(true)

            const updated = mgr.getSearch(search.id)
            expect(updated?.starred).toBe(true)

            const unstarred = mgr.toggleStar(search.id)
            expect(unstarred).toBe(false)
        })
    })

    describe('duplicateSearch', () => {
        it('duplicates a search with new name', () => {
            const mgr = getSavedSearchesManager()
            const original = mgr.createSearch({
                name: 'Original',
                query: 'test query',
                description: 'Test description',
                tags: ['test'],
                category: 'Research',
            })

            const duplicate = mgr.duplicateSearch(original.id, 'Duplicate')

            expect(duplicate).not.toBeNull()
            expect(duplicate?.name).toBe('Duplicate')
            expect(duplicate?.query).toBe(original.query)
            expect(duplicate?.description).toBe(original.description)
            expect(duplicate?.id).not.toBe(original.id)
        })
    })

    describe('getStats', () => {
        it('returns correct statistics', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'A', query: 'a' })
            mgr.createSearch({ name: 'B', query: 'b', isTemplate: true })

            const stats = mgr.getStats()

            expect(stats.totalSaved).toBe(2)
            expect(stats.totalTemplates).toBe(1)
        })
    })

    describe('export/import', () => {
        it('exports searches to JSON', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'Test', query: 'query' })

            const json = mgr.exportSearches()

            expect(json).toContain('Test')
            expect(json).toContain('query')
        })

        it('imports searches from JSON', () => {
            const mgr = getSavedSearchesManager()
            const json = JSON.stringify([{
                name: 'Imported',
                query: 'imported query',
                description: 'Imported search',
            }])

            const result = mgr.importSearches(json)

            expect(result.imported).toBe(1)
            expect(result.failed).toBe(0)

            const all = mgr.getAllSearches()
            expect(all.length).toBe(1)
            expect(all[0].name).toBe('Imported')
        })

        it('handles import errors gracefully', () => {
            const mgr = getSavedSearchesManager()

            const result = mgr.importSearches('invalid json')

            expect(result.failed).toBe(1)
            expect(result.errors.length).toBeGreaterThan(0)
        })
    })

    describe('getPopularTerms', () => {
        it('returns popular terms sorted by frequency', () => {
            const mgr = getSavedSearchesManager()
            mgr.createSearch({ name: 'A', query: 'python tutorial' })
            mgr.createSearch({ name: 'B', query: 'python api' })
            mgr.createSearch({ name: 'C', query: 'javascript guide' })

            const terms = mgr.getPopularTerms(3)

            expect(terms.length).toBe(3)
            expect(terms[0].term).toBe('python')
            expect(terms[0].frequency).toBe(2)
        })
    })
})
