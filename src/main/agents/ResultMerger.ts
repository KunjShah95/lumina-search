import { SearchResult } from './types'

export class ResultMergerAgent {
    run(results: SearchResult[], maxResults: number = 8): SearchResult[] {
        // Deduplicate by URL
        const seen = new Set<string>()
        const unique = results.filter(r => {
            const key = this.normalizeUrl(r.url)
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })

        // Score and rank
        const scored = unique.map(r => ({
            ...r,
            score: this.computeScore(r),
        }))

        return scored
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, maxResults)
    }

    private computeScore(r: SearchResult): number {
        let score = r.score ?? 0.5
        // Boost quality domains
        const qualityDomains = ['wikipedia.org', 'github.com', 'stackoverflow.com', 'arxiv.org', 'docs.', 'developer.']
        if (qualityDomains.some(d => r.domain.includes(d))) score += 0.2
        // Boost if snippet is substantial
        if (r.snippet.length > 200) score += 0.1
        // Penalize very short snippets
        if (r.snippet.length < 50) score -= 0.2
        return score
    }

    private normalizeUrl(url: string): string {
        try {
            const u = new URL(url)
            return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, '')
        } catch { return url }
    }
}
