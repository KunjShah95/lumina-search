/**
 * Export Service - Multiple export formats
 * Handles exporting search results and threads to various formats
 */

import * as fs from 'fs'
import * as path from 'path'
import { createLogger } from './logger'

const logger = createLogger('ExportService')

export interface ExportOptions {
    includeSources?: boolean
    includeMetadata?: boolean
    includeTimestamp?: boolean
    formatting?: 'compact' | 'detailed'
}

export interface ThreadExportData {
    id: string
    title: string
    query: string
    response: string
    sources: Array<{
        url: string
        title: string
        snippet: string
    }>
    createdAt: number
    tags?: string[]
}

function formatSourcesAsJSON(sources: Array<{ url: string; title: string; snippet: string }>): string {
    return JSON.stringify(sources, null, 2)
}

function formatSourcesAsMarkdown(sources: Array<{ url: string; title: string; snippet: string }>): string {
    let md = '## Sources\n\n'
    
    sources.forEach((source, i) => {
        md += `### ${i + 1}. ${source.title}\n`
        md += `- URL: ${source.url}\n`
        md += `- ${source.snippet}\n\n`
    })
    
    return md
}

function formatThreadAsJSON(thread: ThreadExportData, options: ExportOptions): string {
    const data: any = {
        id: thread.id,
        title: thread.title,
        query: thread.query,
        response: thread.response,
    }
    
    if (options.includeSources !== false) {
        data.sources = thread.sources
    }
    
    if (options.includeTimestamp !== false) {
        data.createdAt = new Date(thread.createdAt).toISOString()
    }
    
    if (options.includeMetadata && thread.tags) {
        data.tags = thread.tags
    }
    
    return JSON.stringify(data, null, 2)
}

function formatThreadAsMarkdown(thread: ThreadExportData, options: ExportOptions): string {
    let md = `# ${thread.title}\n\n`
    
    if (options.includeTimestamp !== false) {
        md += `*Searched on ${new Date(thread.createdAt).toLocaleString()}*\n\n`
    }
    
    md += `## Query\n\n${thread.query}\n\n`
    md += `## Response\n\n${thread.response}\n\n`
    
    if (options.includeSources !== false && thread.sources.length > 0) {
        md += formatSourcesAsMarkdown(thread.sources)
    }
    
    if (options.includeMetadata && thread.tags && thread.tags.length > 0) {
        md += `\n## Tags\n\n${thread.tags.join(', ')}\n`
    }
    
    return md
}

function formatThreadAsText(thread: ThreadExportData, options: ExportOptions): string {
    let text = `${thread.title}\n${'='.repeat(50)}\n\n`
    
    if (options.includeTimestamp !== false) {
        text += `Date: ${new Date(thread.createdAt).toLocaleString()}\n\n`
    }
    
    text += `QUERY:\n${thread.query}\n\n`
    text += `RESPONSE:\n${thread.response}\n\n`
    
    if (options.includeSources !== false && thread.sources.length > 0) {
        text += `SOURCES:\n${'-'.repeat(30)}\n`
        thread.sources.forEach((source, i) => {
            text += `${i + 1}. ${source.title}\n`
            text += `   URL: ${source.url}\n`
            text += `   ${source.snippet}\n\n`
        })
    }
    
    if (options.includeMetadata && thread.tags && thread.tags.length > 0) {
        text += `\nTAGS: ${thread.tags.join(', ')}\n`
    }
    
    return text
}

function formatThreadAsHTML(thread: ThreadExportData, options: ExportOptions): string {
    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${thread.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        h1 { color: #333; border-bottom: 2px solid #7c5cfc; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .meta { color: #888; font-size: 0.9em; }
        .source { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .source-title { font-weight: bold; color: #7c5cfc; }
        .source-url { font-size: 0.85em; color: #666; }
        .source-snippet { margin-top: 8px; }
        .tags { margin-top: 20px; }
        .tag { background: #e0e0ff; color: #7c5cfc; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; margin-right: 8px; }
    </style>
</head>
<body>
    <h1>${thread.title}</h1>
    ${options.includeTimestamp !== false ? `<p class="meta">Searched on ${new Date(thread.createdAt).toLocaleString()}</p>` : ''}
    
    <h2>Query</h2>
    <p>${thread.query}</p>
    
    <h2>Response</h2>
    <p>${thread.response.replace(/\n/g, '<br>')}</p>`
    
    if (options.includeSources !== false && thread.sources.length > 0) {
        html += `
    <h2>Sources</h2>`
        thread.sources.forEach((source, i) => {
            html += `
    <div class="source">
        <div class="source-title">${i + 1}. ${source.title}</div>
        <div class="source-url"><a href="${source.url}">${source.url}</a></div>
        <div class="source-snippet">${source.snippet}</div>
    </div>`
        })
    }
    
    if (options.includeMetadata && thread.tags && thread.tags.length > 0) {
        html += `
    <div class="tags">
        ${thread.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
    </div>`
    }
    
    html += `
</body>
</html>`
    
    return html
}

export function exportThread(
    thread: ThreadExportData,
    format: 'json' | 'markdown' | 'text' | 'html',
    outputPath: string,
    options: ExportOptions = {}
): { success: boolean; path?: string; error?: string } {
    try {
        let content: string
        
        switch (format) {
            case 'json':
                content = formatThreadAsJSON(thread, options)
                break
            case 'markdown':
                content = formatThreadAsMarkdown(thread, options)
                break
            case 'text':
                content = formatThreadAsText(thread, options)
                break
            case 'html':
                content = formatThreadAsHTML(thread, options)
                break
            default:
                return { success: false, error: `Unknown format: ${format}` }
        }
        
        // Ensure directory exists
        const dir = path.dirname(outputPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        
        fs.writeFileSync(outputPath, content, 'utf-8')
        
        logger.info(`Exported thread to ${format}: ${outputPath}`)
        return { success: true, path: outputPath }
        
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        logger.error('Export failed:', errMsg)
        return { success: false, error: errMsg }
    }
}

export function exportBulkThreads(
    threads: ThreadExportData[],
    format: 'json' | 'markdown' | 'text' | 'html',
    outputDir: string,
    options: ExportOptions = {}
): { exported: number; failed: number; paths: string[] } {
    const paths: string[] = []
    let exported = 0
    let failed = 0
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }
    
    for (const thread of threads) {
        const fileName = `${thread.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}_${thread.id}.${format}`
        const filePath = path.join(outputDir, fileName)
        
        const result = exportThread(thread, format, filePath, options)
        
        if (result.success && result.path) {
            paths.push(result.path)
            exported++
        } else {
            failed++
        }
    }
    
    logger.info(`Bulk export complete: ${exported} exported, ${failed} failed`)
    return { exported, failed, paths }
}

export function getDefaultExportPath(thread: ThreadExportData, format: string): string {
    const timestamp = new Date(thread.createdAt).toISOString().replace(/[:.]/g, '-')
    const safeTitle = thread.title.replace(/[^a-z0-9]/gi, '_').substring(0, 20)
    return path.join(process.env.USERPROFILE || '/tmp', 'Downloads', `${safeTitle}_${timestamp}.${format}`)
}
