/**
 * PDF Export Service
 * Exports search threads and results to PDF with proper citations
 */

import * as path from 'path'
import { createLogger } from './logger'

const logger = createLogger('PDFExport')

export interface SearchResultForExport {
  url: string
  title: string
  snippet: string
  source: string
  thumbnail?: string
}

export interface ThreadForExport {
  id: string
  title: string
  query: string
  response: string
  results: SearchResultForExport[]
  createdAt: Date
  model: string
  executionTime: number
}

export interface PDFExportOptions {
  title?: string
  author?: string
  includeTableOfContents?: boolean
  citationFormat?: 'apa' | 'mla' | 'chicago' | 'harvard'
  includeTimestamp?: boolean
  theme?: 'light' | 'dark'
  pageSize?: 'letter' | 'a4'
  includeMetadata?: boolean
}

export class PDFExportManager {
  constructor() {
    logger.info('PDFExportManager initialized')
  }

  /**
   * Generate PDF from thread
   */
  async generateThreadPDF(thread: ThreadForExport, options: PDFExportOptions = {}): Promise<string> {
    try {
      const htmlContent = this.generateHTMLForThread(thread, options)
      const pdfPath = await this.convertHTMLtoPDF(htmlContent, options)

      logger.info(`Generated PDF for thread: ${thread.id}`)
      return pdfPath
    } catch (error) {
      logger.error(`Failed to generate PDF:`, error)
      throw error
    }
  }

  /**
   * Generate PDF from multiple threads
   */
  async generateBulkPDF(threads: ThreadForExport[], options: PDFExportOptions = {}): Promise<string> {
    try {
      const htmlContent = this.generateHTMLForBulk(threads, options)
      const pdfPath = await this.convertHTMLtoPDF(htmlContent, options)

      logger.info(`Generated bulk PDF for ${threads.length} threads`)
      return pdfPath
    } catch (error) {
      logger.error(`Failed to generate bulk PDF:`, error)
      throw error
    }
  }

  /**
   * Generate HTML representation of thread
   */
  private generateHTMLForThread(thread: ThreadForExport, options: PDFExportOptions): string {
    const {
      author = 'Lumina Search',
      citationFormat = 'apa',
      includeTimestamp = true,
      theme = 'light',
      includeMetadata = true,
    } = options

    const dateStr = thread.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const timeStr = thread.createdAt.toLocaleTimeString('en-US')

    const citations = this.formatCitations(thread.results, citationFormat)

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${thread.title}</title>
        <style>
            ${this.getStylesheet(theme)}
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="header">
                <h1>${this.escapeHTML(thread.title)}</h1>
                ${
                  includeMetadata
                    ? `
                    <div class="metadata">
                        <p><strong>Query:</strong> ${this.escapeHTML(thread.query)}</p>
                        <p><strong>Model:</strong> ${this.escapeHTML(thread.model)}</p>
                        <p><strong>Execution Time:</strong> ${thread.executionTime}ms</p>
                        ${includeTimestamp ? `<p><strong>Generated:</strong> ${dateStr} at ${timeStr}</p>` : ''}
                    </div>
                    `
                    : ''
                }
                ${author ? `<p class="author">By ${this.escapeHTML(author)}</p>` : ''}
            </div>

            <!-- Main Response -->
            <div class="response-section">
                <h2>Response</h2>
                <div class="response-content">
                    ${this.formatResponseText(thread.response)}
                </div>
            </div>

            <!-- Sources -->
            <div class="sources-section">
                <h2>Sources &amp; References</h2>
                <ol class="sources-list">
                    ${thread.results
                      .map(
                        (result, index) => `
                        <li class="source-item">
                            <a href="${this.escapeHTML(result.url)}" target="_blank" rel="noopener">
                                ${this.escapeHTML(result.title)}
                            </a>
                            <p class="source-url">${this.escapeHTML(result.url)}</p>
                            <p class="source-snippet">${this.escapeHTML(result.snippet)}</p>
                            <p class="source-meta">Source: ${this.escapeHTML(result.source)}</p>
                        </li>
                    `
                      )
                      .join('')}
                </ol>
            </div>

            <!-- Citations -->
            <div class="citations-section">
                <h2>Bibliography (${citationFormat.toUpperCase()})</h2>
                <ol class="citations-list">
                    ${citations.map((citation) => `<li class="citation">${citation}</li>`).join('')}
                </ol>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p>
                    Generated by <strong>Lumina Search</strong>
                    ${includeTimestamp ? ` on ${dateStr} at ${timeStr}` : ''}
                </p>
                <p class="footer-small">
                    This document contains citations of external sources. 
                    Please verify information from original sources.
                </p>
            </div>
        </div>
    </body>
    </html>
    `
  }

  /**
   * Generate HTML for multiple threads
   */
  private generateHTMLForBulk(threads: ThreadForExport[], options: PDFExportOptions): string {
    const { author = 'Lumina Search', theme = 'light', includeTableOfContents = true } = options

    const toc = includeTableOfContents
      ? `
        <div class="table-of-contents">
            <h2>Table of Contents</h2>
            <ol>
                ${threads.map((t, i) => `<li><a href="#thread-${i}">${this.escapeHTML(t.title)}</a></li>`).join('')}
            </ol>
        </div>
        <div class="page-break"></div>
    `
      : ''

    const threadsHTML = threads
      .map(
        (thread, index) => `
        <div class="thread-section" id="thread-${index}">
            ${this.generateHTMLForThread(thread, options)}
            <div class="page-break"></div>
        </div>
    `
      )
      .join('')

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lumina Search - Compiled Reports</title>
        <style>
            ${this.getStylesheet(theme)}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="cover-page">
                <h1>Lumina Search Research Report</h1>
                <p class="subtitle">Compiled Search Results & Responses</p>
                <p>${threads.length} thread${threads.length !== 1 ? 's' : ''}</p>
                <p class="author">Generated by ${this.escapeHTML(author)}</p>
                <p class="date">${new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}</p>
            </div>
            <div class="page-break"></div>

            ${toc}

            ${threadsHTML}
        </div>
    </body>
    </html>
    `
  }

  /**
   * Format citations based on citation style
   */
  private formatCitations(results: SearchResultForExport[], format: 'apa' | 'mla' | 'chicago' | 'harvard'): string[] {
    return results.map((result) => {
      switch (format) {
        case 'apa':
          return this.formatAPACitation(result)
        case 'mla':
          return this.formatMLACitation(result)
        case 'chicago':
          return this.formatChicagoCitation(result)
        case 'harvard':
          return this.formatHarvardCitation(result)
        default:
          return this.formatAPACitation(result)
      }
    })
  }

  /**
   * Format citation in APA style
   */
  private formatAPACitation(result: SearchResultForExport): string {
    try {
      const url = new URL(result.url)
      const domain = url.hostname
      const date = new Date().getFullYear()

      return `${this.escapeHTML(result.title)}. Retrieved from ${this.escapeHTML(result.url)} (${date})`
    } catch {
      return `${this.escapeHTML(result.title)}. ${this.escapeHTML(result.url)}`
    }
  }

  /**
   * Format citation in MLA style
   */
  private formatMLACitation(result: SearchResultForExport): string {
    try {
      const url = new URL(result.url)
      const domain = url.hostname
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

      return `${this.escapeHTML(result.title)}. ${this.escapeHTML(domain)}, ${date}, ${this.escapeHTML(result.url)}.`
    } catch {
      return `${this.escapeHTML(result.title)}. ${this.escapeHTML(result.url)}`
    }
  }

  /**
   * Format citation in Chicago style
   */
  private formatChicagoCitation(result: SearchResultForExport): string {
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    return `${this.escapeHTML(result.title)}. Accessed ${date}. ${this.escapeHTML(result.url)}.`
  }

  /**
   * Format citation in Harvard style
   */
  private formatHarvardCitation(result: SearchResultForExport): string {
    try {
      const url = new URL(result.url)
      const domain = url.hostname

      return `${domain}, (${new Date().getFullYear()}). ${this.escapeHTML(result.title)}. Available at: ${this.escapeHTML(result.url)}`
    } catch {
      return `${result.source}, (${new Date().getFullYear()}). ${this.escapeHTML(result.title)}. ${this.escapeHTML(result.url)}`
    }
  }

  /**
   * Format response text as HTML (preserve basic structure)
   */
  private formatResponseText(text: string): string {
    return text
      .split('\n')
      .map((line) => {
        line = this.escapeHTML(line)
        // Add basic paragraph tags
        if (line.trim()) {
          return `<p>${line}</p>`
        }
        return ''
      })
      .join('')
  }

  /**
   * Get CSS stylesheet
   */
  private getStylesheet(theme: 'light' | 'dark'): string {
    if (theme === 'dark') {
      return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #e0e0e0;
            background-color: #1a1a1a;
            line-height: 1.6;
            font-size: 11pt;
        }

        .container {
            max-width: 8.5in;
            margin: 0 auto;
            padding: 1in;
        }

        h1 {
            font-size: 28pt;
            margin-bottom: 0.5in;
            color: #ffffff;
            border-bottom: 3px solid #6366f1;
            padding-bottom: 0.25in;
        }

        h2 {
            font-size: 18pt;
            margin-top: 0.5in;
            margin-bottom: 0.25in;
            color: #a0e7e5;
        }

        p {
            margin-bottom: 0.1in;
        }

        .metadata {
            background-color: #2a2a2a;
            padding: 0.25in;
            margin-bottom: 0.5in;
            border-left: 3px solid #6366f1;
            font-size: 10pt;
        }

        .response-content {
            background-color: #2a2a2a;
            padding: 0.25in;
            margin-bottom: 0.5in;
            border-left: 3px solid #6366f1;
        }

        .source-item {
            margin-bottom: 0.3in;
            padding: 0.15in;
            background-color: #2a2a2a;
            border-radius: 4px;
        }

        .source-url {
            color: #6366f1;
            font-size: 9pt;
            word-break: break-all;
        }

        .source-snippet {
            color: #b0b0b0;
            font-size: 9pt;
            font-style: italic;
        }

        .footer {
            margin-top: 0.5in;
            border-top: 1px solid #404040;
            padding-top: 0.25in;
            font-size: 9pt;
            color: #808080;
        }

        .page-break {
            page-break-after: always;
        }

        a {
            color: #6366f1;
        }
      `
    }

    // Light theme (default)
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #333333;
            background-color: #ffffff;
            line-height: 1.6;
            font-size: 11pt;
        }

        .container {
            max-width: 8.5in;
            margin: 0 auto;
            padding: 1in;
        }

        h1 {
            font-size: 28pt;
            margin-bottom: 0.5in;
            color: #1a1a1a;
            border-bottom: 3px solid #6366f1;
            padding-bottom: 0.25in;
        }

        h2 {
            font-size: 18pt;
            margin-top: 0.5in;
            margin-bottom: 0.25in;
            color: #4f46e5;
        }

        p {
            margin-bottom: 0.1in;
        }

        .metadata {
            background-color: #f3f4f6;
            padding: 0.25in;
            margin-bottom: 0.5in;
            border-left: 3px solid #6366f1;
            font-size: 10pt;
        }

        .response-content {
            background-color: #f9fafb;
            padding: 0.25in;
            margin-bottom: 0.5in;
            border-left: 3px solid #6366f1;
        }

        .source-item {
            margin-bottom: 0.3in;
            padding: 0.15in;
            background-color: #f3f4f6;
            border-radius: 4px;
        }

        .source-url {
            color: #6366f1;
            font-size: 9pt;
            word-break: break-all;
        }

        .source-snippet {
            color: #6b7280;
            font-size: 9pt;
            font-style: italic;
        }

        .footer {
            margin-top: 0.5in;
            border-top: 1px solid #d1d5db;
            padding-top: 0.25in;
            font-size: 9pt;
            color: #9ca3af;
        }

        .page-break {
            page-break-after: always;
        }

        a {
            color: #6366f1;
        }

        .cover-page {
            text-align: center;
            padding: 2in 0;
        }

        .cover-page h1 {
            font-size: 36pt;
            margin-bottom: 1in;
            border: none;
        }

        .cover-page .subtitle {
            font-size: 16pt;
            color: #6366f1;
            margin-bottom: 0.5in;
        }

        .table-of-contents ol {
            margin-left: 0.5in;
        }

        .table-of-contents li {
            margin-bottom: 0.15in;
        }
    `
  }

  /**
   * Convert HTML to PDF (placeholder - requires pdf-lib or similar)
   */
  private async convertHTMLtoPDF(htmlContent: string, options: PDFExportOptions): Promise<string> {
    // This is a placeholder. In a real implementation, you would use:
    // - puppeteer + headless Chrome
    // - html2pdf.js
    // - jsPDF + html2canvas
    // - electron's webContents.printToPDF()

    // For now, return a mock path
    const fileName = `lumina_search_${Date.now()}.pdf`
    const filePath = path.join(process.env.TEMP || '/tmp', fileName)

    logger.info(`PDF export path: ${filePath}`)
    logger.warn(`Note: Actual PDF generation requires PDF library integration`)

    // TODO: Implement actual PDF generation
    return filePath
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (char) => map[char])
  }
}

// Singleton instance
let instance: PDFExportManager | null = null

export function getPDFExportManager(): PDFExportManager {
  if (!instance) {
    instance = new PDFExportManager()
  }
  return instance
}

export function resetPDFExportManager(): void {
  instance = null
}
