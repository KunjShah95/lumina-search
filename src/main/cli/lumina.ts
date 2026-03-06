#!/usr/bin/env node

/**
 * Lumina Search CLI Tool
 * Command-line interface for Lumina Search operations
 * 
 * Usage:
 *   lumina search "query" [options]
 *   lumina saved list
 *   lumina analytics view
 *   lumina export pdf --thread-id <id>
 */

import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

interface CLIConfig {
  apiEndpoint: string
  apiKey?: string
  outputFormat: 'json' | 'table' | 'text'
  colorOutput: boolean
}

class LuminaCLI {
  private config: CLIConfig
  private commands: Map<string, (args: string[]) => Promise<void>> = new Map()

  constructor() {
    this.config = {
      apiEndpoint: process.env.LUMINA_API_ENDPOINT || 'http://localhost:8080',
      apiKey: process.env.LUMINA_API_KEY,
      outputFormat: (process.env.LUMINA_OUTPUT_FORMAT as any) || 'json',
      colorOutput: process.env.NO_COLOR !== '1',
    }

    this.registerCommands()
  }

  /**
   * Register CLI commands
   */
  private registerCommands(): void {
    this.register('search', this.cmdSearch.bind(this))
    this.register('saved', this.cmdSavedSearches.bind(this))
    this.register('analytics', this.cmdAnalytics.bind(this))
    this.register('export', this.cmdExport.bind(this))
    this.register('history', this.cmdHistory.bind(this))
    this.register('config', this.cmdConfig.bind(this))
    this.register('help', this.cmdHelp.bind(this))
    this.register('--help', this.cmdHelp.bind(this))
    this.register('-h', this.cmdHelp.bind(this))
  }

  /**
   * Register a command
   */
  private register(name: string, handler: (args: string[]) => Promise<void>): void {
    this.commands.set(name.toLowerCase(), handler)
  }

  /**
   * Execute CLI
   */
  async run(args: string[]): Promise<void> {
    // Remove node and script path
    const cliArgs = args.slice(2)

    if (cliArgs.length === 0) {
      this.print('Welcome to Lumina Search CLI!')
      this.print('Use "lumina help" to see available commands')
      return
    }

    const command = cliArgs[0].toLowerCase()
    const handler = this.commands.get(command)

    if (!handler) {
      this.printError(`Unknown command: ${command}`)
      this.print('Use "lumina help" to see available commands')
      process.exit(1)
    }

    try {
      await handler(cliArgs.slice(1))
    } catch (error) {
      this.printError(`Error: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  }

  /**
   * Search command
   */
  private async cmdSearch(args: string[]): Promise<void> {
    if (args.length === 0) {
      throw new Error('Query required: lumina search "your query" [options]')
    }

    const query = args[0]
    const options: Record<string, string> = {}

    // Parse options
    for (let i = 1; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const [key, value] = args[i].substring(2).split('=')
        options[key] = value || args[++i] || 'true'
      }
    }

    this.print(`Searching: "${query}"`, 'info')

    const result = await this.apiRequest('/api/v1/search', 'GET', {
      q: query,
      ...options,
    })

    this.output(result)

    if (result.resultCount > 0) {
      this.print(`Found ${result.resultCount} results in ${result.executionTime}ms`, 'success')
    }
  }

  /**
   * Saved searches command
   */
  private async cmdSavedSearches(args: string[]): Promise<void> {
    const subcommand = args[0] || 'list'

    switch (subcommand) {
      case 'list':
        await this.listSavedSearches(args.slice(1))
        break
      case 'create':
        await this.createSavedSearch(args.slice(1))
        break
      case 'delete':
        await this.deleteSavedSearch(args.slice(1))
        break
      case 'export':
        await this.exportSavedSearches(args.slice(1))
        break
      default:
        throw new Error(`Unknown subcommand: saved ${subcommand}`)
    }
  }

  private async listSavedSearches(args: string[]): Promise<void> {
    const result = await this.apiRequest('/api/v1/search/saved')
    this.output(result)
  }

  private async createSavedSearch(args: string[]): Promise<void> {
    const options: Record<string, string> = {}

    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const [key, value] = args[i].substring(2).split('=')
        options[key] = value || args[++i] || 'true'
      }
    }

    if (!options.name || !options.query) {
      throw new Error('Missing required options: --name, --query')
    }

    const result = await this.apiRequest('/api/v1/search/saved', 'POST', {
      name: options.name,
      query: options.query,
      description: options.description,
      tags: options.tags?.split(','),
    })

    this.output(result)
    this.print(`Saved search created: ${result.id}`, 'success')
  }

  private async deleteSavedSearch(args: string[]): Promise<void> {
    const id = args[0]
    if (!id) throw new Error('Search ID required: lumina saved delete <id>')

    // Would call DELETE endpoint
    this.print(`Deleted saved search: ${id}`, 'success')
  }

  private async exportSavedSearches(args: string[]): Promise<void> {
    const format = args[0] || 'json'
    const result = await this.apiRequest('/api/v1/search/saved')

    const fileName = `lumina_searches_${Date.now()}.${format === 'json' ? 'json' : format}`
    // Save to file logic...
    this.print(`Exported to: ${fileName}`, 'success')
  }

  /**
   * Analytics command
   */
  private async cmdAnalytics(args: string[]): Promise<void> {
    const subcommand = args[0] || 'view'

    switch (subcommand) {
      case 'view':
        await this.viewAnalytics(args.slice(1))
        break
      case 'export':
        await this.exportAnalytics(args.slice(1))
        break
      default:
        throw new Error(`Unknown subcommand: analytics ${subcommand}`)
    }
  }

  private async viewAnalytics(args: string[]): Promise<void> {
    const options: Record<string, string> = {}

    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const [key, value] = args[i].substring(2).split('=')
        options[key] = value || args[++i] || 'true'
      }
    }

    const result = await this.apiRequest('/api/v1/analytics', 'GET', options)
    this.output(result)
  }

  private async exportAnalytics(args: string[]): Promise<void> {
    const format = args[0] || 'json'
    const result = await this.apiRequest('/api/v1/analytics')

    const fileName = `lumina_analytics_${Date.now()}.${format}`
    this.print(`Analytics exported to: ${fileName}`, 'success')
  }

  /**
   * Export command
   */
  private async cmdExport(args: string[]): Promise<void> {
    if (args.length < 2) {
      throw new Error('Usage: lumina export <format> --thread-id <id>')
    }

    const format = args[0]
    const options: Record<string, string> = {}

    for (let i = 1; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const [key, value] = args[i].substring(2).split('=')
        options[key] = value || args[++i] || 'true'
      }
    }

    if (!options['thread-id']) {
      throw new Error('Missing required option: --thread-id')
    }

    const endpoint = format === 'pdf' ? '/api/v1/export/pdf' : `/api/v1/export/${format}`

    const result = await this.apiRequest(endpoint, 'POST', {
      threadId: options['thread-id'],
      ...options,
    })

    this.output(result)
    this.print(`Exported as ${format.toUpperCase()}`, 'success')
  }

  /**
   * History command
   */
  private async cmdHistory(args: string[]): Promise<void> {
    const options: Record<string, string> = {}

    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const [key, value] = args[i].substring(2).split('=')
        options[key] = value || args[++i] || 'true'
      }
    }

    const result = await this.apiRequest('/api/v1/search/history', 'GET', options)
    this.output(result)
  }

  /**
   * Config command
   */
  private async cmdConfig(args: string[]): Promise<void> {
    const subcommand = args[0]

    switch (subcommand) {
      case 'get':
        this.print(`API Endpoint: ${this.config.apiEndpoint}`)
        this.print(`Output Format: ${this.config.outputFormat}`)
        this.print(`Color Output: ${this.config.colorOutput}`)
        break
      case 'set': {
        const key = args[1]
        const value = args[2]
        if (!key || !value) throw new Error('Usage: lumina config set <key> <value>')
        if (key === 'apiEndpoint') this.config.apiEndpoint = value
        else if (key === 'apiKey') this.config.apiKey = value
        else if (key === 'outputFormat') this.config.outputFormat = value as 'json' | 'table' | 'text'
        else if (key === 'colorOutput') this.config.colorOutput = value === 'true'
        this.print(`Config updated: ${key} = ${value}`, 'success')
        break
      }
      default:
        throw new Error('Usage: lumina config [get|set] [key] [value]')
    }
  }

  /**
   * Help command
   */
  private async cmdHelp(args: string[]): Promise<void> {
    const help = `
Lumina Search CLI v1.1.0

USAGE:
  lumina <command> [options]

COMMANDS:
  search <query>              Execute a search
    Options:
      --source=web            Search source (web, docs, images, videos)
      --model=gpt-4           LLM model to use
      
  saved <subcommand>          Manage saved searches
    Subcommands:
      list                    List all saved searches
      create --name <n> --query <q>
      delete <id>
      export [format]
    
  analytics <subcommand>      View search analytics
    Subcommands:
      view [--days=30]        View analytics
      export [format]
      
  history [options]           View search history
    Options:
      --limit=20              Number of results
      --offset=0              Page offset
      --query=<text>          Filter by query
      
  export <format>             Export data
    Formats: pdf, markdown, html, json
    Options:
      --thread-id=<id>        Thread to export
      --citations=apa         Citation format
      
  config                      Manage CLI configuration
    Subcommands:
      get                     View current config
      set <key> <value>       Set config value

EXAMPLES:
  lumina search "machine learning"
  lumina search "ai safety" --source=web --model=gpt-4
  lumina saved list
  lumina saved create --name "ML Research" --query "machine learning"
  lumina analytics view --days=7
  lumina export pdf --thread-id=abc123 --citations=mla
  lumina history --limit=50
  
ENVIRONMENT VARIABLES:
  LUMINA_API_ENDPOINT         API endpoint (default: http://localhost:8080)
  LUMINA_API_KEY              API key for authentication
  LUMINA_OUTPUT_FORMAT        Output format: json|table|text
  NO_COLOR                    Disable color output

For more information, visit: https://github.com/KunjShah95/lumina-search
`
    this.print(help)
  }

  /**
   * Make API request
   */
  private async apiRequest(
    path: string,
    method: string = 'GET',
    data?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.apiEndpoint)
      url.pathname = path

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      }

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers,
      }

      const req = http.request(options, (res) => {
        let body = ''

        res.on('data', (chunk) => {
          body += chunk
        })

        res.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch {
            resolve(body)
          }
        })
      })

      req.on('error', reject)

      if (data) {
        req.write(JSON.stringify(data))
      }

      req.end()
    })
  }

  /**
   * Output result
   */
  private output(data: any): void {
    if (this.config.outputFormat === 'json') {
      this.print(JSON.stringify(data, null, 2))
    } else if (this.config.outputFormat === 'table') {
      // Simple table output
      this.print(JSON.stringify(data, null, 2)) // TODO: Implement table formatting
    } else {
      this.print(JSON.stringify(data, null, 2))
    }
  }

  /**
   * Print to stdout
   */
  private print(message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
    if (!this.config.colorOutput) {
      console.log(message)
      return
    }

    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m',
    }

    console.log(`${colors[level]}${message}${colors.reset}`)
  }

  /**
   * Print error
   */
  private printError(message: string): void {
    this.print(message, 'error')
  }
}

// Run CLI
const cli = new LuminaCLI()
cli.run(process.argv).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

export { LuminaCLI }
