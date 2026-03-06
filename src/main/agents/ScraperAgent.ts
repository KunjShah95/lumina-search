import { createLogger } from '../services/logger'
import { getTimeoutManager } from '../services/timeoutManager'

const logger = createLogger('ScraperAgent')

export class ScraperAgent {
    async run(url: string): Promise<string> {
        try {
            // Jina.ai Reader API — free, converts any URL to clean markdown
            const timeoutMs = getTimeoutManager().getTimeoutFor('search:scraper') || 20000
            const response = await fetch(`https://r.jina.ai/${url}`, {
                headers: {
                    'Accept': 'text/event-stream',
                    'X-Return-Format': 'markdown',
                },
                signal: AbortSignal.timeout(timeoutMs),
            })
            if (!response.ok) return ''
            const text = await response.text()
            // Trim to avoid context overflow
            return text.slice(0, 4000).trim()
        } catch {
            return ''
        }
    }
}
