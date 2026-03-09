/**
 * Citation Graph Builder — Extract inter-source links from scraped pages.
 */
import { SearchResult } from './types'

export interface CitationNode {
    url: string
    title: string
    domain: string
    linksTo: string[]
    linkedFrom: string[]
}

export interface CitationGraph {
    nodes: CitationNode[]
    edges: { from: string; to: string }[]
}

/**
 * Build a citation graph by extracting links between scraped sources.
 */
export function buildCitationGraph(sources: SearchResult[]): CitationGraph {
    const urlSet = new Set(sources.map(s => normalizeUrl(s.url)))
    const nodes: Map<string, CitationNode> = new Map()

    // Initialize nodes
    for (const src of sources) {
        const normalized = normalizeUrl(src.url)
        nodes.set(normalized, {
            url: src.url,
            title: src.title,
            domain: src.domain,
            linksTo: [],
            linkedFrom: [],
        })
    }

    const edges: { from: string; to: string }[] = []

    // Extract inter-source links from fullText
    for (const src of sources) {
        if (!src.fullText) continue

        const fromUrl = normalizeUrl(src.url)
        const fromNode = nodes.get(fromUrl)
        if (!fromNode) continue

        // Find URLs in the scraped text that match other sources
        for (const targetUrl of urlSet) {
            if (targetUrl === fromUrl) continue

            // Check if the target URL (or its domain) appears in the source text
            const targetDomain = getDomain(targetUrl)
            if (
                src.fullText.includes(targetUrl) ||
                src.fullText.includes(targetDomain)
            ) {
                fromNode.linksTo.push(targetUrl)

                const targetNode = nodes.get(targetUrl)
                if (targetNode) {
                    targetNode.linkedFrom.push(fromUrl)
                }

                edges.push({ from: fromUrl, to: targetUrl })
            }
        }
    }

    return {
        nodes: Array.from(nodes.values()),
        edges,
    }
}

/**
 * Get the most connected (hub) nodes in the graph.
 */
export function getHubNodes(graph: CitationGraph, topN: number = 3): CitationNode[] {
    return [...graph.nodes]
        .sort((a, b) => {
            const aConnections = a.linksTo.length + a.linkedFrom.length
            const bConnections = b.linksTo.length + b.linkedFrom.length
            return bConnections - aConnections
        })
        .slice(0, topN)
}

// Exported URL utility functions for testing
export function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url)
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '')
    } catch {
        return url
    }
}

export function getDomain(url: string): string {
    try {
        return new URL(url).hostname.replace('www.', '')
    } catch {
        return url
    }
}
