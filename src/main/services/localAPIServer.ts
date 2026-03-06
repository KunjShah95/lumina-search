/**
 * Local JSON API Server
 * Provides REST API for Lumina Search operations
 * Runs on configurable port (default: 8080)
 */

import * as http from 'http'
import * as url from 'url'
import { createLogger } from './logger'

const logger = createLogger('LocalAPIServer')

export interface APIConfig {
  port: number
  host?: string
  enableWebhooks?: boolean
  requireAPIKey?: boolean
  apiKeys?: Set<string>
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
  requestId: string
}

export interface WebhookConfig {
  url: string
  events: string[]
  active: boolean
  secret?: string
}

type RequestHandler = (
  params: Record<string, any>,
  body: any,
  headers: Record<string, any>
) => Promise<any>

export class LocalAPIServer {
  private server: http.Server | null = null
  private config: APIConfig
  private handlers: Map<string, RequestHandler> = new Map()
  private webhooks: Map<string, WebhookConfig> = new Map()
  private requestCounter = 0

  constructor(config: APIConfig = { port: 8080 }) {
    this.config = {
      enableWebhooks: true,
      requireAPIKey: false,
      apiKeys: new Set(),
      ...config,
    }

    this.registerDefaultHandlers()
  }

  /**
   * Start the API server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer(async (req, res) => {
          await this.handleRequest(req, res)
        })

        this.server.listen(this.config.port, this.config.host || 'localhost', () => {
          logger.info(`Local API Server started on http://${this.config.host || 'localhost'}:${this.config.port}`)
          resolve()
        })

        this.server.on('error', (error) => {
          logger.error('Server error:', error)
          reject(error)
        })
      } catch (error) {
        logger.error('Failed to start server:', error)
        reject(error)
      }
    })
  }

  /**
   * Stop the API server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Local API Server stopped')
          this.server = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Register a request handler
   */
  registerHandler(endpoint: string, handler: RequestHandler): void {
    this.handlers.set(endpoint.toLowerCase(), handler)
    logger.info(`Registered endpoint: ${endpoint}`)
  }

  /**
   * Register webhooks
   */
  registerWebhook(id: string, config: WebhookConfig): boolean {
    this.webhooks.set(id, config)
    logger.info(`Registered webhook: ${id}`)
    return true
  }

  /**
   * Trigger webhook
   */
  private async triggerWebhook(event: string, data: any): Promise<void> {
    const activeWebhooks = Array.from(this.webhooks.values()).filter(
      (w) => w.active && w.events.includes(event)
    )

    for (const webhook of activeWebhooks) {
      try {
        const body = JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString(),
        })

        const options = new url.URL(webhook.url)
        const req = http.request(
          {
            hostname: options.hostname,
            port: options.port,
            path: options.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
              'X-Webhook-Secret': webhook.secret || '',
            },
          },
          (res) => {
            logger.info(`Webhook ${webhook.url} responded with ${res.statusCode}`)
          }
        )

        req.on('error', (error) => {
          logger.error(`Webhook error for ${webhook.url}:`, error)
        })

        req.write(body)
        req.end()
      } catch (error) {
        logger.error(`Failed to trigger webhook:`, error)
      }
    }
  }

  /**
   * Handle incoming requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const requestId = `req_${++this.requestCounter}`
    const startTime = Date.now()

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    try {
      const parsedUrl = new url.URL(req.url || '/', `http://${req.headers.host}`)
      const pathname = decodeURIComponent(parsedUrl.pathname).toLowerCase()
      const method = req.method?.toUpperCase()

      logger.info(`${method} ${pathname} [${requestId}]`)

      // Check API key if required
      if (this.config.requireAPIKey) {
        const apiKey = req.headers['authorization']?.replace('Bearer ', '')
        if (!apiKey || !this.config.apiKeys?.has(apiKey)) {
          this.sendResponse(res, 401, { error: 'Unauthorized' }, requestId)
          return
        }
      }

      // Parse query parameters
      const params: Record<string, any> = {}
      parsedUrl.searchParams.forEach((value, key) => {
        params[key] = value
      })

      // Parse request body
      let body: any = null
      if (method !== 'GET' && method !== 'HEAD') {
        body = await this.parseBody(req)
      }

      // Route to handler
      const handler = this.handlers.get(pathname)

      if (!handler) {
        this.sendResponse(res, 404, { error: 'Endpoint not found' }, requestId)
        return
      }

      // Execute handler
      const result = await handler(params, body, req.headers as Record<string, any>)

      // Trigger webhooks if applicable
      if (pathname.includes('search')) {
        await this.triggerWebhook('search:completed', { query: params.q, results: result })
      }

      this.sendResponse(res, 200, result, requestId)
    } catch (error) {
      logger.error(`Request error [${requestId}]:`, error)
      this.sendResponse(
        res,
        500,
        { error: error instanceof Error ? error.message : 'Internal server error' },
        requestId
      )
    } finally {
      const duration = Date.now() - startTime
      logger.info(`Request completed [${requestId}] in ${duration}ms`)
    }
  }

  /**
   * Parse request body
   */
  private parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = ''

      req.on('data', (chunk) => {
        data += chunk
        if (data.length > 1e6) {
          // 1MB limit
          reject(new Error('Request body too large'))
        }
      })

      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : null)
        } catch {
          resolve(data)
        }
      })

      req.on('error', reject)
    })
  }

  /**
   * Send API response
   */
  private sendResponse(res: http.ServerResponse, statusCode: number, data: any, requestId: string): void {
    const response: APIResponse = {
      success: statusCode >= 200 && statusCode < 300,
      data: statusCode < 400 ? data : undefined,
      error: statusCode >= 400 ? data.error : undefined,
      timestamp: new Date().toISOString(),
      requestId,
    }

    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(response, null, 2))
  }

  /**
   * Register default API endpoints
   */
  private registerDefaultHandlers(): void {
    // Health check
    this.registerHandler('/api/v1/health', async () => {
      return {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }
    })

    // Search endpoint (placeholder - will be connected to actual search)
    this.registerHandler('/api/v1/search', async (params) => {
      if (!params.q) {
        throw new Error('Missing query parameter: q')
      }

      // This will be connected to actual search logic
      return {
        query: params.q,
        results: [],
        executionTime: 0,
        resultCount: 0,
      }
    })

    // Saved searches list
    this.registerHandler('/api/v1/search/saved', async (params) => {
      // This will be connected to saved searches manager
      return {
        searches: [],
        total: 0,
      }
    })

    // Create saved search
    this.registerHandler('/api/v1/search/saved', async (params, body) => {
      if (!body?.name || !body?.query) {
        throw new Error('Missing required fields: name, query')
      }

      return {
        id: `search_${Date.now()}`,
        name: body.name,
        query: body.query,
        created: new Date().toISOString(),
      }
    })

    // Search history
    this.registerHandler('/api/v1/search/history', async (params) => {
      const limit = Math.min(parseInt(params.limit || '100'), 1000)
      const offset = parseInt(params.offset || '0')

      return {
        history: [],
        total: 0,
        limit,
        offset,
      }
    })

    // Analytics endpoint
    this.registerHandler('/api/v1/analytics', async (params) => {
      const startDate = params.startDate ? new Date(params.startDate) : undefined
      const endDate = params.endDate ? new Date(params.endDate) : undefined

      return {
        totalSearches: 0,
        uniqueQueries: 0,
        averageExecutionTime: 0,
        successRate: 0,
        topQueries: [],
        topSources: [],
        startDate,
        endDate,
      }
    })

    // Export PDF
    this.registerHandler('/api/v1/export/pdf', async (params, body) => {
      if (!body?.threadId) {
        throw new Error('Missing required field: threadId')
      }

      // PDF generation will be handled by PDFExportManager
      return {
        success: true,
        message: 'PDF export started',
        threadId: body.threadId,
      }
    })

    // List supported export formats
    this.registerHandler('/api/v1/export/formats', async () => {
      return {
        formats: [
          {name: 'PDF', ext: 'pdf', citationFormats: ['apa', 'mla', 'chicago', 'harvard']},
          {name: 'Markdown', ext: 'md'},
          {name: 'HTML', ext: 'html'},
          {name: 'JSON', ext: 'json'},
        ],
      }
    })

    // Webhooks management
    this.registerHandler('/api/v1/webhooks/register', async (params, body) => {
      if (!body?.url || !body?.events) {
        throw new Error('Missing required fields: url, events')
      }

      const webhookId = `webhook_${Date.now()}`
      this.registerWebhook(webhookId, {
        url: body.url,
        events: body.events,
        active: true,
        secret: body.secret,
      })

      return {
        id: webhookId,
        registered: true,
      }
    })

    // List webhooks
    this.registerHandler('/api/v1/webhooks', async () => {
      return {
        webhooks: Array.from(this.webhooks.entries()).map(([id, config]) => ({
          id,
          ...config,
        })),
      }
    })

    logger.info('Default API endpoints registered')
  }

  /**
   * Get server status
   */
  isRunning(): boolean {
    return this.server !== null && !this.server.listening
  }

  /**
   * Add API key
   */
  addAPIKey(key: string): void {
    this.config.apiKeys?.add(key)
    logger.info('API key added')
  }

  /**
   * Remove API key
   */
  removeAPIKey(key: string): void {
    this.config.apiKeys?.delete(key)
    logger.info('API key removed')
  }
}

// Singleton instance
let instance: LocalAPIServer | null = null

export function getLocalAPIServer(config?: APIConfig): LocalAPIServer {
  if (!instance) {
    instance = new LocalAPIServer(config)
  }
  return instance
}

export function resetLocalAPIServer(): Promise<void> {
  return new Promise(async (resolve) => {
    if (instance) {
      await instance.stop()
      instance = null
    }
    resolve()
  })
}
