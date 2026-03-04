/**
 * Export Service — Export threads as Markdown, HTML, or clipboard.
 */
import { clipboard } from 'electron'
import { Thread, SearchResult } from '../agents/types'

// ── Markdown Export ────────────────────────────────────────────
export function exportToMarkdown(thread: Thread): string {
    const lines: string[] = []

    lines.push(`# ${thread.title}`)
    lines.push(``)
    lines.push(`*Exported on ${new Date().toLocaleString()}*`)
    lines.push(`*Created: ${new Date(thread.createdAt).toLocaleString()}*`)
    lines.push(``)

    if (thread.tags && thread.tags.length > 0) {
        lines.push(`**Tags:** ${thread.tags.map(t => `\`${t}\``).join(' ')}`)
        lines.push(``)
    }

    lines.push(`---`)
    lines.push(``)

    // Messages
    for (const msg of thread.messages) {
        if (msg.role === 'user') {
            lines.push(`## 💬 You`)
            lines.push(``)
            lines.push(msg.content)
        } else {
            lines.push(`## 🤖 Assistant`)
            lines.push(``)
            lines.push(msg.content)
        }
        lines.push(``)
        lines.push(`---`)
        lines.push(``)
    }

    // Sources
    if (thread.sources && thread.sources.length > 0) {
        lines.push(`## 📚 Sources`)
        lines.push(``)
        for (const src of thread.sources) {
            lines.push(`- [${src.title}](${src.url}) — *${src.domain}*`)
            if (src.snippet) {
                lines.push(`  > ${src.snippet.slice(0, 200)}`)
            }
        }
        lines.push(``)
    }

    // Notes
    if (thread.notes) {
        lines.push(`## 📝 Notes`)
        lines.push(``)
        lines.push(thread.notes)
        lines.push(``)
    }

    return lines.join('\n')
}

// ── HTML Export ─────────────────────────────────────────────────
export function exportToHTML(thread: Thread): string {
    const messages = thread.messages.map(msg => {
        const roleLabel = msg.role === 'user' ? '💬 You' : '🤖 Assistant'
        const roleClass = msg.role === 'user' ? 'user' : 'assistant'
        const escapedContent = escapeHtml(msg.content)
            .replace(/\n/g, '<br/>')
        return `<div class="message ${roleClass}"><h3>${roleLabel}</h3><div class="content">${escapedContent}</div></div>`
    }).join('\n')

    const sources = thread.sources && thread.sources.length > 0
        ? `<div class="sources"><h3>📚 Sources</h3><ul>${thread.sources.map(s =>
            `<li><a href="${escapeHtml(s.url)}" target="_blank">${escapeHtml(s.title)}</a> — <em>${escapeHtml(s.domain)}</em></li>`
        ).join('')}</ul></div>`
        : ''

    const tags = thread.tags && thread.tags.length > 0
        ? `<div class="tags">${thread.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</div>`
        : ''

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(thread.title)} — Lumina Search</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a0f; color: #e0e0e8; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.7; }
  h1 { font-size: 1.8em; margin-bottom: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .meta { color: #888; font-size: 0.85em; margin-bottom: 24px; }
  .tags { margin-bottom: 16px; }
  .tag { background: rgba(99,102,241,0.15); color: #a5b4fc; padding: 3px 10px; border-radius: 12px; font-size: 0.8em; margin-right: 6px; }
  hr { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 20px 0; }
  .message { margin-bottom: 24px; padding: 16px; border-radius: 12px; }
  .message.user { background: rgba(99,102,241,0.08); border-left: 3px solid #6366f1; }
  .message.assistant { background: rgba(255,255,255,0.03); border-left: 3px solid #22c55e; }
  .message h3 { font-size: 0.9em; margin-bottom: 8px; color: #a5b4fc; }
  .message.assistant h3 { color: #86efac; }
  .content { white-space: pre-wrap; }
  .sources { margin-top: 24px; }
  .sources h3 { margin-bottom: 12px; }
  .sources ul { list-style: none; }
  .sources li { padding: 6px 0; }
  .sources a { color: #818cf8; text-decoration: none; }
  .sources a:hover { text-decoration: underline; }
  .sources em { color: #888; font-size: 0.85em; }
</style>
</head>
<body>
<h1>${escapeHtml(thread.title)}</h1>
<p class="meta">Created: ${new Date(thread.createdAt).toLocaleString()} · Exported: ${new Date().toLocaleString()}</p>
${tags}
<hr/>
${messages}
${sources}
</body>
</html>`
}

// ── Clipboard Copy ─────────────────────────────────────────────
export function copyThreadToClipboard(thread: Thread): void {
    const md = exportToMarkdown(thread)
    clipboard.writeText(md)
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
