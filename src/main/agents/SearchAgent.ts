import { SearchResult, FocusMode, SearchProvider, ImageResult, VideoResult } from './types'
import { getSettings } from '../services/storage'
import { getTimeoutManager } from '../services/timeoutManager'

export class SearchAgent {
    constructor(private provider: SearchProvider) { }

    async run(query: string, focusMode: FocusMode = 'web'): Promise<SearchResult[]> {
        const focusQuery = this.applyFocusMode(query, focusMode)
        switch (this.provider) {
            case 'tavily': return this.searchTavily(focusQuery)
            case 'brave': return this.searchBrave(focusQuery)
            case 'duckduckgo': return this.searchDDG(focusQuery)
        }
    }

    async searchImages(query: string): Promise<ImageResult[]> {
        const settings = getSettings()

        if (settings.braveKey) {
            return this.searchBraveImages(query, settings.braveKey)
        }

        return this.searchDDGImages(query)
    }

    async searchVideos(query: string): Promise<VideoResult[]> {
        const settings = getSettings()

        if (settings.braveKey) {
            return this.searchBraveVideos(query, settings.braveKey)
        }

        return this.searchDDGVideos(query)
    }

    private applyFocusMode(query: string, mode: FocusMode): string {
        const modifiers: Record<FocusMode, string> = {
            web: query,
            academic: `${query} research paper study`,
            code: `${query} code example documentation`,
            reddit: `${query} site:reddit.com`,
            image: `${query} images photos`,
            video: `${query} videos movies`,
            'hybrid-rag': '',
            local: '',
            all: '',
            compare: ''
        }
        return modifiers[mode]
    }

    private async searchBraveImages(query: string, apiKey: string): Promise<ImageResult[]> {
        try {
            const url = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=20`
            const timeoutMs = getTimeoutManager().getTimeoutFor('search:agent') || 30000
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
                signal: AbortSignal.timeout(timeoutMs),
            })
            if (!response.ok) return []
            const data = await response.json() as { results?: Array<{ url: string; title: string; thumbnail: { src: string }; metadata?: { source: string } }> }
            return (data.results ?? []).map(r => ({
                url: r.url,
                title: r.title,
                thumbnail: r.thumbnail?.src ?? '',
                domain: r.metadata?.source ?? this.getDomain(r.url),
                source: r.metadata?.source ?? this.getDomain(r.url),
            }))
        } catch { return [] }
    }

    private async searchBraveVideos(query: string, apiKey: string): Promise<VideoResult[]> {
        try {
            const url = `https://api.search.brave.com/res/v1/videos/search?q=${encodeURIComponent(query)}&count=10`
            const timeoutMs = getTimeoutManager().getTimeoutFor('search:agent') || 30000
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
                signal: AbortSignal.timeout(timeoutMs),
            })
            if (!response.ok) return []
            const data = await response.json() as { results?: Array<{ url: string; title: string; thumbnail: { src: string }; channel?: { name: string }; duration?: string; meta?: { hot_rate?: string } }> }
            return (data.results ?? []).map(r => ({
                url: r.url,
                title: r.title,
                thumbnail: r.thumbnail?.src ?? '',
                channel: r.channel?.name ?? '',
                duration: r.duration ?? '',
                views: r.meta?.hot_rate ?? '',
            }))
        } catch { return [] }
    }

    private async searchDDGImages(query: string): Promise<ImageResult[]> {
        return []
    }

    private async searchDDGVideos(query: string): Promise<VideoResult[]> {
        return []
    }

    private async searchTavily(query: string): Promise<SearchResult[]> {
        const settings = getSettings()
        if (!settings.tavilyKey) throw new Error('No Tavily API key configured')
        const timeoutMs = getTimeoutManager().getTimeoutFor('search:agent') || 30000
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: settings.tavilyKey,
                query,
                search_depth: 'basic',
                max_results: 10,
                include_answer: false,
            }),
            signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) throw new Error(`Tavily ${response.status}`)
        const data = await response.json() as { results: { url: string; title: string; content: string; score: number }[] }
        return data.results.map(r => ({
            url: r.url,
            title: r.title,
            snippet: r.content,
            domain: this.getDomain(r.url),
            score: r.score,
        }))
    }

    private async searchBrave(query: string): Promise<SearchResult[]> {
        const settings = getSettings()
        if (!settings.braveKey) throw new Error('No Brave API key configured')
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`
        const timeoutMs = getTimeoutManager().getTimeoutFor('search:agent') || 30000
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json', 'X-Subscription-Token': settings.braveKey },
            signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) throw new Error(`Brave ${response.status}`)
        const data = await response.json() as { web?: { results: { url: string; title: string; description: string }[] } }
        return (data.web?.results ?? []).map(r => ({
            url: r.url,
            title: r.title,
            snippet: r.description,
            domain: this.getDomain(r.url),
        }))
    }

    private async searchDDG(query: string): Promise<SearchResult[]> {
        try {
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
            const timeoutMs = getTimeoutManager().getTimeoutFor('search:agent') || 20000
            const response = await fetch(url, {
                headers: { 'User-Agent': 'LuminaSearch/1.0' },
                signal: AbortSignal.timeout(timeoutMs),
            })
            const data = await response.json() as {
                Heading?: string; Abstract?: string; AbstractURL?: string;
                RelatedTopics?: Array<{ FirstURL?: string; Text?: string }>
            }
            const results: SearchResult[] = []
            if (data.Abstract && data.AbstractURL) {
                results.push({
                    url: data.AbstractURL,
                    title: data.Heading ?? query,
                    snippet: data.Abstract,
                    domain: this.getDomain(data.AbstractURL),
                })
            }
            for (const topic of (data.RelatedTopics ?? []).slice(0, 9)) {
                if (topic.FirstURL) {
                    results.push({
                        url: topic.FirstURL,
                        title: topic.Text?.split(' - ')[0] ?? query,
                        snippet: topic.Text ?? '',
                        domain: this.getDomain(topic.FirstURL),
                    })
                }
            }
            return results
        } catch { return [] }
    }

    private getDomain(url: string): string {
        try { return new URL(url).hostname.replace('www.', '') }
        catch { return url }
    }
}
