/**
 * PDF Export Service
 * Exports search threads and results to PDF with proper citations
 */

import * as path from 'path'
import * as fs from 'fs'
import { app, dialog, BrowserWindow } from 'electron'
import { createLogger } from './logger'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

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
      const pdfDoc = await this.createPDFDocument(thread, options)
      const pdfBytes = await pdfDoc.save()
      const pdfPath = await this.savePDF(pdfBytes, thread.title)

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
      const pdfDoc = await this.createBulkPDFDocument(threads, options)
      const pdfBytes = await pdfDoc.save()
      const pdfPath = await this.savePDF(pdfBytes, 'compiled-report')

      logger.info(`Generated bulk PDF for ${threads.length} threads`)
      return pdfPath
    } catch (error) {
      logger.error(`Failed to generate bulk PDF:`, error)
      throw error
    }
  }

  /**
   * Create PDF document for a single thread
   */
  private async createPDFDocument(thread: ThreadForExport, options: PDFExportOptions): Promise<PDFDocument> {
    const { pageSize = 'a4', citationFormat = 'apa', author = 'Lumina Search', includeMetadata = true } = options
    
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    
    const pageWidth = pageSize === 'letter' ? 612 : 595
    const pageHeight = pageSize === 'letter' ? 792 : 842
    const margin = 50
    const contentWidth = pageWidth - (margin * 2)
    
    let page = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin
    
    // Title
    y -= 30
    const titleSize = 18
    page.drawText(this.escapePDFText(thread.title), {
      x: margin,
      y,
      size: titleSize,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: contentWidth,
    })
    y -= titleSize + 10
    
    // Metadata
    if (includeMetadata) {
      const metadataText = [
        `Query: ${this.escapePDFText(thread.query)}`,
        `Model: ${thread.model}`,
        `Execution Time: ${thread.executionTime}ms`,
        options.includeTimestamp !== false ? `Generated: ${thread.createdAt.toLocaleString()}` : '',
      ].filter(Boolean).join(' | ')
      
      page.drawText(metadataText, {
        x: margin,
        y,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4),
        maxWidth: contentWidth,
      })
      y -= 25
    }
    
    // Divider
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    })
    y -= 20
    
    // Response content
    page.drawText('Response', {
      x: margin,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    })
    y -= 20
    
    // Wrap and draw response text
    const responseLines = this.wrapText(thread.response, font, 11, contentWidth)
    for (const line of responseLines) {
      if (y < margin + 40) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
      page.drawText(line, {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: contentWidth,
      })
      y -= 14
    }
    
    y -= 20
    
    // Sources
    if (y < margin + 60) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
    
    page.drawText('Sources & References', {
      x: margin,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    })
    y -= 20
    
    // Draw sources
    for (let i = 0; i < thread.results.length; i++) {
      const result = thread.results[i]
      const sourceText = `${i + 1}. ${this.escapePDFText(result.title)}`
      const urlText = `   ${this.escapePDFText(result.url)}`
      
      const titleLines = this.wrapText(sourceText, boldFont, 10, contentWidth)
      for (const line of titleLines) {
        if (y < margin + 20) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        page.drawText(line, {
          x: margin,
          y,
          size: 10,
          font: boldFont,
          color: rgb(0.1, 0.1, 0.1),
          maxWidth: contentWidth,
        })
        y -= 12
      }
      
      const urlLines = this.wrapText(urlText, font, 8, contentWidth)
      for (const line of urlLines) {
        if (y < margin + 20) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        page.drawText(line, {
          x: margin,
          y,
          size: 8,
          font,
          color: rgb(0.3, 0.3, 0.8),
          maxWidth: contentWidth,
        })
        y -= 10
      }
      
      y -= 10
    }
    
    // Bibliography
    y -= 20
    if (y < margin + 40) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
    
    page.drawText(`Bibliography (${citationFormat.toUpperCase()})`, {
      x: margin,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    })
    y -= 20
    
    const citations = this.formatCitations(thread.results, citationFormat)
    for (let i = 0; i < citations.length; i++) {
      const citationText = `${i + 1}. ${citations[i]}`
      const citationLines = this.wrapText(citationText, font, 9, contentWidth)
      
      for (const line of citationLines) {
        if (y < margin + 20) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        page.drawText(line, {
          x: margin,
          y,
          size: 9,
          font,
          color: rgb(0.3, 0.3, 0.3),
          maxWidth: contentWidth,
        })
        y -= 11
      }
      y -= 5
    }
    
    // Footer
    const totalPages = pdfDoc.getPageCount()
    for (let i = 0; i < totalPages; i++) {
      const footerPage = pdfDoc.getPage(i)
      footerPage.drawText(`Generated by Lumina Search - Page ${i + 1} of ${totalPages}`, {
        x: margin,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })
    }
    
    return pdfDoc
  }

  /**
   * Create PDF document for multiple threads
   */
  private async createBulkPDFDocument(threads: ThreadForExport[], options: PDFExportOptions): Promise<PDFDocument> {
    const pdfDoc = await PDFDocument.create()
    
    // Add cover page
    const coverPage = pdfDoc.addPage()
    const { width, height } = coverPage.getSize()
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    
    coverPage.drawText('Lumina Search Research Report', {
      x: 50,
      y: height - 150,
      size: 24,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    })
    
    coverPage.drawText(`Compiled Search Results & Responses`, {
      x: 50,
      y: height - 180,
      size: 14,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
    
    coverPage.drawText(`${threads.length} thread${threads.length !== 1 ? 's' : ''}`, {
      x: 50,
      y: height - 210,
      size: 12,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
    
    coverPage.drawText(new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }), {
      x: 50,
      y: height - 240,
      size: 12,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
    
    // Add each thread
    for (const thread of threads) {
      const threadDoc = await this.createPDFDocument(thread, options)
      const copiedPages = await pdfDoc.copyPages(threadDoc, threadDoc.getPageIndices())
      for (const copiedPage of copiedPages) {
        pdfDoc.addPage(copiedPage)
      }
    }
    
    return pdfDoc
  }

  /**
   * Save PDF bytes to file
   */
  private async savePDF(pdfBytes: Uint8Array, title: string): Promise<string> {
    const userDataPath = app?.getPath?.('userData') || process.cwd()
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)
    const timestamp = Date.now()
    const fileName = `${sanitizedTitle}_${timestamp}.pdf`
    const filePath = path.join(userDataPath, 'exports', fileName)
    
    // Ensure directory exists
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    fs.writeFileSync(filePath, pdfBytes)
    logger.info(`PDF saved to: ${filePath}`)
    
    return filePath
  }

  /**
   * Wrap text to fit within width
   */
  private wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const width = font.widthOfTextAtSize(testLine, fontSize)
      
      if (width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    
    if (currentLine) {
      lines.push(currentLine)
    }
    
    return lines
  }

  /**
   * Escape text for PDF
   */
  private escapePDFText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\n/g, ' ')
      .substring(0, 500) // Limit length
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
