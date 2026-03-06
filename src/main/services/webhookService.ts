/**
 * Webhook Service
 * Manages webhooks for external integrations and notifications
 */

import * as http from 'http'
import * as https from 'https'
import { createLogger } from './logger'
import { v4 as uuidv4 } from 'uuid'

const logger = createLogger('WebhookService')

export interface Webhook {
  id: string
  name: string
  url: string
  events: WebhookEvent[]
  active: boolean
  secret?: string
  createdAt: Date
  lastTriggered?: Date
  failureCount: number
  headers?: Record<string, string>
}

export type WebhookEvent = 
  | 'search.completed'
  | 'search.failed'
  | 'thread.created'
  | 'thread.deleted'
  | 'knowledgebase.created'
  | 'knowledgebase.updated'
  | 'export.completed'
  | 'scheduler.triggered'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, any>
  source: string
}

export class WebhookManager {
  private webhooks: Map<string, Webhook> = new Map()
  private readonly MAX_RETRIES = 3
  private readonly TIMEOUT_MS = 10000

  constructor() {
    logger.info('WebhookManager initialized')
  }

  /**
   * Create a new webhook
   */
  createWebhook(params: {
    name: string
    url: string
    events: WebhookEvent[]
    secret?: string
    headers?: Record<string, string>
  }): Webhook {
    const webhook: Webhook = {
      id: `webhook_${uuidv4()}`,
      name: params.name,
      url: params.url,
      events: params.events,
      active: true,
      secret: params.secret,
      createdAt: new Date(),
      failureCount: 0,
      headers: params.headers,
    }

    this.webhooks.set(webhook.id, webhook)
    logger.info(`Created webhook: ${webhook.id} (${webhook.name})`)

    return webhook
  }

  /**
   * Get webhook by ID
   */
  getWebhook(id: string): Webhook | undefined {
    return this.webhooks.get(id)
  }

  /**
   * Get all webhooks
   */
  getAllWebhooks(): Webhook[] {
    return Array.from(this.webhooks.values())
  }

  /**
   * Get active webhooks for an event
   */
  getWebhooksForEvent(event: WebhookEvent): Webhook[] {
    return Array.from(this.webhooks.values()).filter(
      (w) => w.active && w.events.includes(event)
    )
  }

  /**
   * Update webhook
   */
  updateWebhook(id: string, updates: Partial<Webhook>): Webhook | null {
    const webhook = this.webhooks.get(id)
    if (!webhook) {
      logger.warn(`Webhook not found: ${id}`)
      return null
    }

    const updated: Webhook = {
      ...webhook,
      ...updates,
      id: webhook.id, // Prevent ID change
      createdAt: webhook.createdAt, // Prevent timestamp change
    }

    this.webhooks.set(id, updated)
    logger.info(`Updated webhook: ${id}`)

    return updated
  }

  /**
   * Delete webhook
   */
  deleteWebhook(id: string): boolean {
    const deleted = this.webhooks.delete(id)
    if (deleted) {
      logger.info(`Deleted webhook: ${id}`)
    }
    return deleted
  }

  /**
   * Enable/disable webhook
   */
  toggleWebhook(id: string, active: boolean): boolean {
    const webhook = this.webhooks.get(id)
    if (!webhook) return false

    webhook.active = active
    webhook.failureCount = 0 // Reset failure count on toggle
    logger.info(`Webhook ${id} ${active ? 'enabled' : 'disabled'}`)

    return true
  }

  /**
   * Trigger webhook(s) for an event
   */
  async trigger(event: WebhookEvent, data: Record<string, any>): Promise<{
    triggered: number
    failed: number
    results: Array<{ webhookId: string; success: boolean; statusCode?: number; error?: string }>
  }> {
    const webhooks = this.getWebhooksForEvent(event)
    
    if (webhooks.length === 0) {
      return { triggered: 0, failed: 0, results: [] }
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      source: 'lumina-search',
    }

    const results: Array<{ webhookId: string; success: boolean; statusCode?: number; error?: string }> = []
    let triggered = 0
    let failed = 0

    for (const webhook of webhooks) {
      const result = await this.sendWebhook(webhook, payload)
      results.push(result)

      if (result.success) {
        triggered++
        webhook.lastTriggered = new Date()
        webhook.failureCount = 0
      } else {
        failed++
        webhook.failureCount++
        
        // Disable webhook if too many failures
        if (webhook.failureCount >= this.MAX_RETRIES) {
          webhook.active = false
          logger.error(`Webhook ${webhook.id} disabled due to repeated failures`)
        }
      }
    }

    logger.info(`Webhook event '${event}': ${triggered} triggered, ${failed} failed`)
    return { triggered, failed, results }
  }

  /**
   * Send webhook HTTP request
   */
  private async sendWebhook(
    webhook: Webhook,
    payload: WebhookPayload
  ): Promise<{ webhookId: string; success: boolean; statusCode?: number; error?: string }> {
    return new Promise((resolve) => {
      try {
        const urlObj = new URL(webhook.url)
        const isHttps = urlObj.protocol === 'https:'
        const client = isHttps ? https : http

        const body = JSON.stringify(payload)
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body).toString(),
          'X-Webhook-Event': payload.event,
          'X-Webhook-Source': payload.source,
          ...webhook.headers,
        }

        // Add signature if secret is configured
        if (webhook.secret) {
          const crypto = require('crypto')
          const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(body)
            .digest('hex')
          headers['X-Webhook-Signature'] = `sha256=${signature}`
        }

        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers,
          timeout: this.TIMEOUT_MS,
        }

        const req = client.request(options, (res) => {
          const success = res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false
          
          logger.info(`Webhook ${webhook.id} responded with ${res.statusCode}`)
          
          resolve({
            webhookId: webhook.id,
            success,
            statusCode: res.statusCode,
          })
        })

        req.on('error', (error) => {
          logger.error(`Webhook ${webhook.id} error:`, error.message)
          resolve({
            webhookId: webhook.id,
            success: false,
            error: error.message,
          })
        })

        req.on('timeout', () => {
          req.destroy()
          resolve({
            webhookId: webhook.id,
            success: false,
            error: 'Request timeout',
          })
        })

        req.write(body)
        req.end()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Webhook ${webhook.id} error:`, errorMessage)
        resolve({
          webhookId: webhook.id,
          success: false,
          error: errorMessage,
        })
      }
    })
  }

  /**
   * Test webhook - sends a test ping
   */
  async testWebhook(id: string): Promise<{ success: boolean; message: string }> {
    const webhook = this.webhooks.get(id)
    if (!webhook) {
      return { success: false, message: 'Webhook not found' }
    }

    const result = await this.trigger('search.completed', {
      test: true,
      message: 'This is a test webhook from Lumina Search',
    })

    if (result.failed > 0) {
      return { success: false, message: 'Webhook test failed' }
    }

    return { success: true, message: 'Webhook test successful' }
  }

  /**
   * Export webhooks to JSON
   */
  exportWebhooks(): string {
    return JSON.stringify(
      Array.from(this.webhooks.values()).map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        lastTriggered: w.lastTriggered?.toISOString(),
      })),
      null,
      2
    )
  }

  /**
   * Import webhooks from JSON
   */
  importWebhooks(jsonData: string): { imported: number; failed: number; errors: string[] } {
    const errors: string[] = []
    let imported = 0
    let failed = 0

    try {
      const data = JSON.parse(jsonData)
      if (!Array.isArray(data)) {
        throw new Error('Expected array of webhooks')
      }

      data.forEach((item, index) => {
        try {
          this.createWebhook({
            name: item.name,
            url: item.url,
            events: item.events,
            secret: item.secret,
            headers: item.headers,
          })
          imported++
        } catch (error) {
          failed++
          errors.push(`Item ${index}: ${error instanceof Error ? error.message : String(error)}`)
        }
      })
    } catch (error) {
      failed = 1
      errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`)
    }

    logger.info(`Imported ${imported} webhooks, ${failed} failed`)
    return { imported, failed, errors }
  }
}

let instance: WebhookManager | null = null

export function getWebhookManager(): WebhookManager {
  if (!instance) {
    instance = new WebhookManager()
  }
  return instance
}

export function resetWebhookManager(): void {
  instance = null
}
