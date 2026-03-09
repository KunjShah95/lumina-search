import { SearchResult, FocusMode, SearchProvider, ImageResult, VideoResult, SearchOperatorFilters } from './types'
import { getSettings } from '../services/storage'
import { getTimeoutManager } from '../services/timeoutManager'

export class SearchAgent {
    constructor(private provider: SearchProvider, private operators?: SearchOperatorFilters) { }

    async run(query: string, focusMode: FocusMode = 'web'): Promise<SearchResult[]> {
        const focusQuery = this.applyFocusMode(query, focusMode)
        const enhancedQuery = this.applyOperators(focusQuery)
        switch (this.provider) {
            case 'tavily': return this.searchTavily(enhancedQuery)
            case 'brave': return this.searchBrave(enhancedQuery)
            case 'duckduckgo': return this.searchDDG(enhancedQuery)
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

    private applyOperators(query: string): string {
        if (!this.operators) return query

        let enhancedQuery = query

        // Add site restrictions
        if (this.operators.sites?.length) {
            // For multiple sites, create OR queries when provider supports it
            const siteQuery = this.operators.sites.map(s => `site:${s}`).join(' OR ')
            enhancedQuery = `${enhancedQuery} ${siteQuery}`
        }

        // Add filetype filters
        if (this.operators.fileTypes?.length) {
            const fileQuery = this.operators.fileTypes.map(f => `filetype:${f}`).join(' OR ')
            enhancedQuery = `${enhancedQuery} ${fileQuery}`
        }

        // Add language filters (when supported)
        if (this.operators.languages?.length) {
            // Most providers support language codes
            enhancedQuery = `${enhancedQuery} language:${this.operators.languages[0]}`
        }

        // Add intitle operator
        if (this.operators.intitleTerms?.length) {
            const intitleQuery = this.operators.intitleTerms.map(t => `intitle:${t}`).join(' ')
            enhancedQuery = `${enhancedQuery} ${intitleQuery}`
        }

        // Add exclude terms
        if (this.operators.excludeTerms?.length) {
            const excludeQuery = this.operators.excludeTerms.map(t => `-${t}`).join(' ')
            enhancedQuery = `${enhancedQuery} ${excludeQuery}`
        }

        // Add exact phrase
        if (this.operators.exactPhrase) {
            enhancedQuery = `${enhancedQuery} "${this.operators.exactPhrase}"`
        }

        return enhancedQuery.trim()
    }

    private filterResultsByOperators(results: SearchResult[]): SearchResult[] {
        if (!this.operators) return results

        return results.filter(result => {
            // Filter by site
            if (this.operators!.sites?.length) {
                const matchesSite = this.operators!.sites.some(site => 
                    result.domain.includes(site) || result.url.includes(site)
                )
                if (!matchesSite) return false
            }

            // Filter by file type (check URL extension)
            if (this.operators!.fileTypes?.length) {
                const urlLower = result.url.toLowerCase()
                const matchesType = this.operators!.fileTypes.some(ext => 
                    urlLower.endsWith(`.${ext.toLowerCase()}`) || 
                    urlLower.includes(`/file/`) && urlLower.includes(`.${ext}`)
                )
                if (!matchesType) return false
            }

            // Filter by date range (if result has date metadata)
            if (this.operators!.dateRange) {
                // Most providers don't return dates in basic results
                // This would need provider-specific handling
            }

            // Filter out excluded terms from snippets
            if (this.operators!.excludeTerms?.length) {
                const textLower = (result.title + ' ' + result.snippet).toLowerCase()
                const hasExcludedTerm = this.operators!.excludeTerms.some(term => 
                    textLower.includes(term.toLowerCase())
                )
                if (hasExcludedTerm) return false
            }

            // Check for exact phrase in results
            if (this.operators!.exactPhrase) {
                const textLower = (result.title + ' ' + result.snippet).toLowerCase()
                if (!textLower.includes(this.operators!.exactPhrase.toLowerCase())) {
                    return false
                }
            }

            // Check for intitle terms
            if (this.operators!.intitleTerms?.length) {
                const titleLower = result.title.toLowerCase()
                const hasIntitleTerm = this.operators!.intitleTerms.some(term =>
                    titleLower.includes(term.toLowerCase())
                )
                if (!hasIntitleTerm) return false
            }

            return true
        })
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
        
        // Build Tavily-specific parameters for operators
        const requestBody: any = {
            api_key: settings.tavilyKey,
            query,
            search_depth: 'basic',
            max_results: 10,
            include_answer: false,
        }

        // Add date range if specified (Tavily supports days parameter)
        if (this.operators?.dateRange) {
            const now = new Date()
            const daysAgo = Math.floor((now.getTime() - this.operators.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
            if (daysAgo > 0 && daysAgo < 365) {
                requestBody.days = daysAgo
            }
        }

        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) throw new Error(`Tavily ${response.status}`)
        const data = await response.json() as { results: { url: string; title: string; content: string; score: number }[] }
        const results = data.results.map(r => ({
            link: r.url,
            source: 'tavily',
            url: r.url,
            title: r.title,
            snippet: r.content,
            domain: this.getDomain(r.url),
            score: r.score,
        }))
        return this.filterResultsByOperators(results)
    }

    private async searchBrave(query: string): Promise<SearchResult[]> {
        const settings = getSettings()
        if (!settings.braveKey) throw new Error('No Brave API key configured')
        
        // Build URL with parameters
        let url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`
        
        // Brave supports freshness parameter for date filtering
        if (this.operators?.dateRange) {
            const now = new Date()
            const daysAgo = Math.floor((now.getTime() - this.operators.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
            if (daysAgo <= 1) {
                url += '&freshness=pd'  // past day
            } else if (daysAgo <= 7) {
                url += '&freshness=pw'  // past week
            } else if (daysAgo <= 30) {
                url += '&freshness=pm'  // past month
            } else if (daysAgo <= 365) {
                url += '&freshness=py'  // past year
            }
        }

        const timeoutMs = getTimeoutManager().getTimeoutFor('search:agent') || 30000
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json', 'X-Subscription-Token': settings.braveKey },
            signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) throw new Error(`Brave ${response.status}`)
        const data = await response.json() as { web?: { results: { url: string; title: string; description: string }[] } }
        const results = (data.web?.results ?? []).map(r => ({
            link: r.url,
            source: 'brave',
            url: r.url,
            title: r.title,
            snippet: r.description,
            domain: this.getDomain(r.url),
        }))
        return this.filterResultsByOperators(results)
    }

    private async searchDDG(query: string): Promise<SearchResult[]> {
        try {
            // Build URL with operator-enhanced query
            let url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
            
            // Add region/language parameter if specified (DuckDuckGo uses 'kl' parameter)
            if (this.operators?.languages?.length) {
                const langMap: Record<string, string> = {
                    'en': 'us-en', 'en-us': 'us-en', 'en-gb': 'uk-en',
                    'es': 'es-es', 'fr': 'fr-fr', 'de': 'de-de',
                    'it': 'it-it', 'pt': 'pt-pt', 'ja': 'jp-jp',
                    'zh': 'cn-zh', 'ko': 'kr-kr', 'ru': 'ru-ru'
                }
                const region = langMap[this.operators.languages[0].toLowerCase()] || 'us-en'
                url += `&kl=${region}`
            }
            
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
                    link: data.AbstractURL,
                    source: 'duckduckgo',
                    url: data.AbstractURL,
                    title: data.Heading ?? query,
                    snippet: data.Abstract,
                    domain: this.getDomain(data.AbstractURL),
                })
            }
            for (const topic of (data.RelatedTopics ?? []).slice(0, 9)) {
                if (topic.FirstURL) {
                    results.push({
                        link: topic.FirstURL,
                        source: 'duckduckgo',
                        url: topic.FirstURL,
                        title: topic.Text?.split(' - ')[0] ?? query,
                        snippet: topic.Text ?? '',
                        domain: this.getDomain(topic.FirstURL),
                    })
                }
            }
            return this.filterResultsByOperators(results)
        } catch { return [] }
    }

    private getDomain(url: string): string {
        try { return new URL(url).hostname.replace('www.', '') }
        catch { return url }
    }
}
