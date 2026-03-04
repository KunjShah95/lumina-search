import { Thread, SearchResult } from '../../../main/agents/types'

export function threadToMarkdown(thread: Thread): string {
    const lines: string[] = []

    lines.push(`# ${thread.title}`)
    lines.push('')
    lines.push(`*Created: ${new Date(thread.createdAt).toLocaleString()}*`)
    if (thread.isPinned) lines.push('*📌 Pinned*')
    if (thread.isFavorite) lines.push('*⭐ Favorite*')
    lines.push('')
    lines.push('---')
    lines.push('')

    if (thread.sources.length > 0) {
        lines.push('## Sources')
        lines.push('')
        thread.sources.forEach((source, i) => {
            lines.push(`${i + 1}. [${source.title}](${source.url})`)
            lines.push(`   - ${source.domain}`)
        })
        lines.push('')
        lines.push('---')
        lines.push('')
    }

    lines.push('## Conversation')
    lines.push('')

    for (const msg of thread.messages) {
        const role = msg.role === 'user' ? '**You**' : '**Assistant**'
        lines.push(`### ${role}`)
        lines.push('')
        lines.push(msg.content)
        lines.push('')
    }

    return lines.join('\n')
}

export function downloadMarkdown(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

export function generateFilename(title: string): string {
    const sanitized = title
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 50)
    const date = new Date().toISOString().split('T')[0]
    return `lumina_${sanitized}_${date}.md`
}
