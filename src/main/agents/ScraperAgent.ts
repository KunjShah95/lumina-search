export class ScraperAgent {
    async run(url: string): Promise<string> {
        try {
            // Jina.ai Reader API — free, converts any URL to clean markdown
            const response = await fetch(`https://r.jina.ai/${url}`, {
                headers: {
                    'Accept': 'text/plain',
                    'User-Agent': 'LuminaSearch/1.0',
                    'X-Return-Format': 'markdown',
                },
                signal: AbortSignal.timeout(12000),
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
