/**
 * Search Operators Service
 * Handles advanced search syntax parsing and query compilation
 * Supports: site:, filetype:, date:, language:, source:, exact phrases, etc.
 */

import { createLogger } from './logger'

const logger = createLogger('SearchOperators')

export interface ParsedSearchQuery {
  baseQuery: string                      // Main search terms
  operators: {
    sites?: string[]                     // site:domain.com
    fileTypes?: string[]                 // filetype:pdf
    dateRange?: { start: Date; end: Date } // date:2024..2025
    languages?: string[]                 // language:en,fr
    sources?: string[]                   // source:web,docs
    excludeTerms?: string[]              // !exclude
    exactPhrase?: string                 // "exact match"
    customOperators?: Record<string, string[]>
  }
}

export interface SearchOperatorConfig {
  name: string
  aliases: string[]
  description: string
  handler: (value: string) => any
  validator?: (value: string) => boolean
}

export class SearchOperatorsManager {
  private operators: Map<string, SearchOperatorConfig> = new Map()
  private builtInOperators: SearchOperatorConfig[] = []

  constructor() {
    this.initializeBuiltInOperators()
  }

  private initializeBuiltInOperators(): void {
    // Site operator: site:example.com
    this.registerOperator({
      name: 'site',
      aliases: ['domain', 'host'],
      description: 'Restrict search to specific domain',
      validator: (value) => /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/.test(value),
      handler: (value) => value.toLowerCase(),
    })

    // File type operator: filetype:pdf
    this.registerOperator({
      name: 'filetype',
      aliases: ['type', 'ext', 'format'],
      description: 'Filter results by file type',
      validator: (value) => /^[a-zA-Z0-9]{1,4}$/.test(value),
      handler: (value) => value.toLowerCase(),
    })

    // Date range operator: date:2024..2025
    this.registerOperator({
      name: 'date',
      aliases: ['published', 'since'],
      description: 'Filter by date range (YYYY..YYYY or YYYY-MM-DD..YYYY-MM-DD)',
      validator: (value) => /^\d{4}(-\d{2}-\d{2})?(\.\.\d{4}|\.\.\d{4}-\d{2}-\d{2})?$/.test(value),
      handler: (value) => this.parseDateRange(value),
    })

    // Language operator: language:en,fr
    this.registerOperator({
      name: 'language',
      aliases: ['lang'],
      description: 'Filter by language codes (ISO 639-1)',
      validator: (value) => /^[a-z]{2}(-[a-z]{2})?(,[a-z]{2}(-[a-z]{2})?)*$/.test(value),
      handler: (value) => value.split(',').map((l) => l.trim()),
    })

    // Source operator: source:web,docs,video
    this.registerOperator({
      name: 'source',
      aliases: ['type', 'media'],
      description: 'Filter by source type (web, docs, images, videos, academic)',
      validator: (value) => {
        const valid = ['web', 'docs', 'images', 'videos', 'academic', 'code']
        return value.split(',').every((s) => valid.includes(s.trim()))
      },
      handler: (value) => value.split(',').map((s) => s.trim()),
    })

    // Exclude operator: !exclude-term
    this.registerOperator({
      name: '!',
      aliases: ['exclude', 'not'],
      description: 'Exclude terms from search results',
      handler: (value) => value,
    })
  }

  registerOperator(config: SearchOperatorConfig): void {
    this.operators.set(config.name, config)
    config.aliases.forEach((alias) => {
      this.operators.set(alias, config)
    })
    logger.info(`Registered search operator: ${config.name}`)
  }

  parseQuery(query: string): ParsedSearchQuery {
    const result: ParsedSearchQuery = {
      baseQuery: query,
      operators: {
        customOperators: {},
      },
    }

    if (!query) return result

    // Parse operator syntax: operator:value
    const operatorPattern = /(\w+):([^\s]+)/g
    const excludeTermPattern = /!(\S+)/g
    let match

    const operatorsFound: Record<string, string[]> = {}

    // Extract quoted phrases first
    const quotedPhrases: string[] = []
    const processedQuery = query.replace(/"([^"]+)"/g, (_, phrase) => {
      quotedPhrases.push(phrase)
      return ``
    })

    if (quotedPhrases.length > 0) {
      result.operators.exactPhrase = quotedPhrases.join(' ')
    }

    // Parse standard operators
    while ((match = operatorPattern.exec(processedQuery)) !== null) {
      const opName = match[1].toLowerCase()
      const opValue = match[2]

      if (this.operators.has(opName)) {
        const config = this.operators.get(opName)!
        const baseOpName = config.name

        // Validate operator value
        if (config.validator && !config.validator(opValue)) {
          logger.warn(`Invalid value for operator ${opName}: ${opValue}`)
          continue
        }

        // Handle specific operators
        switch (baseOpName) {
          case 'site':
            result.operators.sites = result.operators.sites || []
            result.operators.sites.push(config.handler(opValue))
            break
          case 'filetype':
            result.operators.fileTypes = result.operators.fileTypes || []
            result.operators.fileTypes.push(config.handler(opValue))
            break
          case 'date':
            result.operators.dateRange = config.handler(opValue)
            break
          case 'language':
            result.operators.languages = config.handler(opValue)
            break
          case 'source':
            result.operators.sources = config.handler(opValue)
            break
          default:
            if (!operatorsFound[baseOpName]) {
              operatorsFound[baseOpName] = []
            }
            operatorsFound[baseOpName].push(opValue)
        }
      }
    }

    // Parse exclude terms (prefixed with !)
    while ((match = excludeTermPattern.exec(processedQuery)) !== null) {
      result.operators.excludeTerms = result.operators.excludeTerms || []
      result.operators.excludeTerms.push(match[1])
    }

    // Remove operators from base query
    let cleanQuery = processedQuery
    cleanQuery = cleanQuery.replace(operatorPattern, '').trim()
    cleanQuery = cleanQuery.replace(excludeTermPattern, '').trim()

    result.baseQuery = cleanQuery
    result.operators.customOperators = operatorsFound

    return result
  }

  private parseDateRange(value: string): { start: Date; end: Date } | null {
    try {
      const parts = value.split('..')
      if (parts.length !== 2) return null

      const start = this.parseDate(parts[0])
      const end = this.parseDate(parts[1])

      if (!start || !end) return null

      // Sort to ensure start < end
      if (start > end) {
        return { start: end, end: start }
      }

      return { start, end }
    } catch {
      return null
    }
  }

  private parseDate(dateStr: string): Date | null {
    try {
      let date: Date

      if (dateStr.match(/^\d{4}$/)) {
        // Year only
        date = new Date(parseInt(dateStr), 0, 1)
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD
        date = new Date(dateStr)
      } else {
        return null
      }

      return isNaN(date.getTime()) ? null : date
    } catch {
      return null
    }
  }

  getOperatorList(): Array<{ name: string; description: string; example: string }> {
    const operators: Array<{ name: string; description: string; example: string }> = []
    const seen = new Set<string>()

    this.operators.forEach((config) => {
      if (!seen.has(config.name)) {
        seen.add(config.name)
        operators.push({
          name: config.name,
          description: config.description,
          example: this.getExampleForOperator(config.name),
        })
      }
    })

    return operators
  }

  private getExampleForOperator(name: string): string {
    const examples: Record<string, string> = {
      site: 'site:github.com',
      filetype: 'filetype:pdf',
      date: 'date:2024..2025',
      language: 'language:en,fr',
      source: 'source:web,docs',
      '!': '!spam !ads',
    }
    return examples[name] || `${name}:value`
  }

  compileQueryForSearch(parsed: ParsedSearchQuery, provider?: string): Record<string, any> {
    const compiled: Record<string, any> = {}

    if (parsed.baseQuery) {
      compiled.q = parsed.baseQuery
    }

    if (parsed.operators.sites?.length) {
      compiled.sites = parsed.operators.sites
    }

    if (parsed.operators.fileTypes?.length) {
      compiled.fileTypes = parsed.operators.fileTypes
    }

    if (parsed.operators.dateRange) {
      compiled.dateRange = parsed.operators.dateRange
    }

    if (parsed.operators.languages?.length) {
      compiled.languages = parsed.operators.languages
    }

    if (parsed.operators.sources?.length) {
      compiled.sources = parsed.operators.sources
    }

    if (parsed.operators.excludeTerms?.length) {
      compiled.excludeTerms = parsed.operators.excludeTerms
    }

    if (parsed.operators.exactPhrase) {
      compiled.exactPhrase = parsed.operators.exactPhrase
    }

    return compiled
  }

  buildSearchUrl(parsed: ParsedSearchQuery, provider: 'duckduckgo' | 'brave' | 'tavily'): string {
    let url = ''
    const q = []

    if (parsed.baseQuery) {
      q.push(parsed.baseQuery)
    }

    // Build provider-specific URL
    switch (provider) {
      case 'duckduckgo':
        if (parsed.operators.sites?.length) {
          q.push(...parsed.operators.sites.map((s) => `site:${s}`))
        }
        if (parsed.operators.excludeTerms?.length) {
          q.push(...parsed.operators.excludeTerms.map((t) => `-${t}`))
        }
        url = `https://duckduckgo.com/?q=${encodeURIComponent(q.join(' '))}`
        break

      case 'brave':
        if (parsed.operators.sites?.length) {
          q.push(...parsed.operators.sites.map((s) => `site:${s}`))
        }
        if (parsed.operators.excludeTerms?.length) {
          q.push(...parsed.operators.excludeTerms.map((t) => `-${t}`))
        }
        url = `https://search.brave.com/search?q=${encodeURIComponent(q.join(' '))}`
        break

      case 'tavily':
        // Tavily has its own API, doesn't use URL-based operators
        url = `/api/tavily/search?q=${encodeURIComponent(parsed.baseQuery)}`
        break
    }

    return url
  }

  /**
   * Public method: Parse a search query with operators
   */
  parseSearchQuery(query: string): ParsedSearchQuery {
    return this.parseQuery(query)
  }

  /**
   * Public method: Validate if a query has valid operators
   */
  validateQuery(query: string): boolean {
    try {
      const parsed = this.parseSearchQuery(query)
      return !!parsed && !!(parsed.baseQuery || Object.keys(parsed.operators).length > 0)
    } catch {
      return false
    }
  }

  /**
   * Public method: Get all available operators
   */
  getAvailableOperators(): Array<{ name: string; description: string; example: string }> {
    return this.getOperatorList()
  }
}

// Singleton instance
let instance: SearchOperatorsManager | null = null

export function getSearchOperatorsInstance(): SearchOperatorsManager {
  if (!instance) {
    instance = new SearchOperatorsManager()
  }
  return instance
}

export function resetSearchOperators(): void {
  instance = null
}
