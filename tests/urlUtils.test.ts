/**
 * URL Utility Tests
 * Tests for URL normalization and domain extraction functions
 */

import { describe, it, expect } from 'vitest'
import { normalizeUrl, getDomain } from '../src/main/agents/CitationGraph'

describe('normalizeUrl', () => {
    it('should normalize URL with trailing slash', () => {
        const url = 'https://example.com/path/'
        const normalized = normalizeUrl(url)
        
        expect(normalized).toBe('https://example.com/path')
    })

    it('should preserve URL without trailing slash', () => {
        const url = 'https://example.com/path'
        const normalized = normalizeUrl(url)
        
        expect(normalized).toBe('https://example.com/path')
    })

    it('should normalize URL with query parameters', () => {
        const url = 'https://example.com/path?key=value'
        const normalized = normalizeUrl(url)
        
        expect(normalized).toBe('https://example.com/path')
    })

    it('should normalize URL with hash fragment', () => {
        const url = 'https://example.com/path#section'
        const normalized = normalizeUrl(url)
        
        expect(normalized).toBe('https://example.com/path')
    })

    it('should preserve protocol', () => {
        const httpUrl = 'http://example.com/path/'
        const httpsUrl = 'https://example.com/path/'
        
        expect(normalizeUrl(httpUrl)).toBe('http://example.com/path')
        expect(normalizeUrl(httpsUrl)).toBe('https://example.com/path')
    })

    it('should preserve subdomain', () => {
        const url = 'https://api.example.com/v1/endpoint/'
        const normalized = normalizeUrl(url)
        
        expect(normalized).toBe('https://api.example.com/v1/endpoint')
    })

    it('should handle root URL', () => {
        const url = 'https://example.com/'
        const normalized = normalizeUrl(url)
        
        expect(normalized).toBe('https://example.com')
    })

    it('should handle URL with port', () => {
        const url = 'https://example.com:8080/path/'
        const normalized = normalizeUrl(url)
        
        expect(normalized).toBe('https://example.com:8080/path')
    })

    it('should return original string for invalid URL', () => {
        const invalid = 'not-a-valid-url'
        const normalized = normalizeUrl(invalid)
        
        expect(normalized).toBe(invalid)
    })

    it('should handle URL with multiple path segments', () => {
        const url = 'https://example.com/path/to/resource/'
        const normalized = normalizeUrl(url)
        
        expect(normalized).toBe('https://example.com/path/to/resource')
    })

    it('should handle URL with special characters in path', () => {
        const url = 'https://example.com/path%20with%20spaces/'
        const normalized = normalizeUrl(url)
        
        expect(normalized).toBe('https://example.com/path%20with%20spaces')
    })
})

describe('getDomain', () => {
    it('should extract domain from URL', () => {
        const url = 'https://example.com/path'
        const domain = getDomain(url)
        
        expect(domain).toBe('example.com')
    })

    it('should remove www prefix', () => {
        const url = 'https://www.example.com/path'
        const domain = getDomain(url)
        
        expect(domain).toBe('example.com')
    })

    it('should preserve subdomain (non-www)', () => {
        const url = 'https://api.example.com/path'
        const domain = getDomain(url)
        
        expect(domain).toBe('api.example.com')
    })

    it('should handle URL with port', () => {
        const url = 'https://example.com:8080/path'
        const domain = getDomain(url)
        
        expect(domain).toBe('example.com')
    })

    it('should handle URL with query parameters', () => {
        const url = 'https://example.com/path?key=value'
        const domain = getDomain(url)
        
        expect(domain).toBe('example.com')
    })

    it('should handle URL with hash fragment', () => {
        const url = 'https://example.com/path#section'
        const domain = getDomain(url)
        
        expect(domain).toBe('example.com')
    })

    it('should return original string for invalid URL', () => {
        const invalid = 'not-a-valid-url'
        const domain = getDomain(invalid)
        
        expect(domain).toBe(invalid)
    })

    it('should handle localhost', () => {
        const url = 'http://localhost:3000/path'
        const domain = getDomain(url)
        
        expect(domain).toBe('localhost')
    })

    it('should handle IP address', () => {
        const url = 'http://192.168.1.1/path'
        const domain = getDomain(url)
        
        expect(domain).toBe('192.168.1.1')
    })

    it('should handle multiple subdomains with www', () => {
        const url = 'https://www.api.example.com/path'
        const domain = getDomain(url)
        
        expect(domain).toBe('api.example.com')
    })

    it('should handle different TLDs', () => {
        const domains = [
            'https://example.org/path',
            'https://example.co.uk/path',
            'https://example.io/path'
        ]
        
        expect(getDomain(domains[0])).toBe('example.org')
        expect(getDomain(domains[1])).toBe('example.co.uk')
        expect(getDomain(domains[2])).toBe('example.io')
    })

    it('should handle URL with authentication', () => {
        const url = 'https://user:pass@example.com/path'
        const domain = getDomain(url)
        
        expect(domain).toBe('example.com')
    })
})
