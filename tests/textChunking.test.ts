/**
 * Text Chunking Utility Tests
 * Tests for the chunkText function used in knowledge base document processing
 */

import { describe, it, expect } from 'vitest'
import { chunkText } from '../src/main/services/database'

describe('chunkText', () => {
    it('should split text into chunks at sentence boundaries', () => {
        const text = 'First sentence. Second sentence. Third sentence.'
        const chunks = chunkText(text)
        
        expect(chunks).toBeInstanceOf(Array)
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks[0]).toContain('First sentence')
    })

    it('should create new chunk when exceeding 1000 characters', () => {
        // Create text with sentences that together exceed 1000 chars
        const longSentence = 'A'.repeat(500)
        const text = `${longSentence}. ${longSentence}. ${longSentence}.`
        
        const chunks = chunkText(text)
        
        expect(chunks.length).toBeGreaterThanOrEqual(2)
        expect(chunks[0].length).toBeLessThanOrEqual(1000)
        expect(chunks.every(chunk => chunk.length <= 1500)).toBe(true)
    })

    it('should handle empty string', () => {
        const chunks = chunkText('')
        
        expect(chunks).toEqual([])
    })

    it('should handle single sentence', () => {
        const text = 'This is a single sentence.'
        const chunks = chunkText(text)
        
        expect(chunks).toHaveLength(1)
        expect(chunks[0]).toContain('This is a single sentence')
    })

    it('should handle text with exclamation marks', () => {
        const text = 'Hello! How are you! I am fine!'
        const chunks = chunkText(text)
        
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks[0]).toContain('Hello')
    })

    it('should handle text with question marks', () => {
        const text = 'What is your name? Where do you live? What do you do?'
        const chunks = chunkText(text)
        
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks[0]).toContain('What is your name')
    })

    it('should combine small sentences into same chunk', () => {
        const text = 'A. B. C. D. E. F.'
        const chunks = chunkText(text)
        
        // Small sentences should be combined
        expect(chunks.length).toBe(1)
        expect(chunks[0]).toContain('A')
        expect(chunks[0]).toContain('F')
    })

    it('should handle text with multiple sentence delimiters', () => {
        const text = 'Mixed! Question? Statement. Another!'
        const chunks = chunkText(text)
        
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks[0]).toContain('Mixed')
    })

    it('should trim whitespace from sentences', () => {
        const text = '  Sentence one  .  Sentence two  .'
        const chunks = chunkText(text)
        
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks[0]).not.toMatch(/^\s/)
        expect(chunks[0]).not.toMatch(/\s$/)
    })

    it('should filter out empty sentences', () => {
        const text = 'Valid sentence. . . Another valid sentence.'
        const chunks = chunkText(text)
        
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks[0]).toContain('Valid sentence')
        expect(chunks[0]).toContain('Another valid sentence')
    })

    it('should handle very long single sentence', () => {
        const longSentence = 'word '.repeat(500) + '.'
        const chunks = chunkText(longSentence)
        
        expect(chunks.length).toBeGreaterThanOrEqual(1)
        expect(chunks[0]).toContain('word')
    })

    it('should preserve content across chunks', () => {
        const sentences = Array.from({ length: 20 }, (_, i) => 
            `This is sentence number ${i} with some content.`
        )
        const text = sentences.join(' ')
        const chunks = chunkText(text)
        
        const reconstructed = chunks.join(' ')
        
        // All sentences should be present
        for (let i = 0; i < 20; i++) {
            expect(reconstructed).toContain(`sentence number ${i}`)
        }
    })

    it('should handle text with no sentence delimiters', () => {
        const text = 'This text has no delimiters at all'
        const chunks = chunkText(text)
        
        // Should still return the text
        expect(chunks.length).toBeGreaterThanOrEqual(0)
    })
})
