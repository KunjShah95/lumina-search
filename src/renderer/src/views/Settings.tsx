import { useState } from 'react'
import { useAppSettings } from '../hooks/useAppSettings'

interface MemoryManagementProps {
    onAddMemory: (fact: {
        threadId: string
        key?: string
        value: string
        tags?: string[]
        ttlDays?: number
        source?: 'manual' | 'auto'
    }) => void
    onDeleteMemory: (id: string) => void
}

export function MemoryManagement({ onAddMemory, onDeleteMemory }: MemoryManagementProps) {
    const [threadId, setThreadId] = useState('')
    const [key, setKey] = useState('')
    const [value, setValue] = useState('')
    const [tags, setTags] = useState<string[]>([])
    const [ttlDays, setTtlDays] = useState(30)
    const { settings } = useAppSettings()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!threadId || !value.trim()) return
        onAddMemory({
            threadId,
            key,
            value: value.trim(),
            tags,
            ttlDays,
            source: 'manual',
        })
        setThreadId('')
        setKey('')
        setValue('')
        setTags([])
    }

    const handleClear = () => {
        onAddMemory({
            threadId,
            value: '',
            tags: [],
            ttlDays: 0,
            source: 'manual',
        })
    }

    return (
        <div className="memory-management">
            <h2>Memory Management</h2>
            
            <form onSubmit={handleSubmit} className="memory-form">
                <input
                    type="text"
                    placeholder="Thread ID (optional)"
                    value={threadId}
                    onChange={(e) => setThreadId(e.target.value)}
                    required
                />
                <input
                    type="text"
                    placeholder="Key (optional, e.g., 'style')"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                />
                <textarea
                    placeholder="Memory value (e.g., 'Prefer concise answers with bullet points.')"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                />
                
                {tags.length > 0 && (
                    <div className="tags">
                        {tags.map((tag, idx) => (
                            <span key={idx} className="tag">{tag}</span>
                        ))}
                    </div>
                )}
                
                <input
                    type="number"
                    placeholder="TTL days (optional)"
                    value={ttlDays}
                    onChange={(e) => setTtlDays(Number(e.target.value))}
                />
                
                <button type="submit" className="btn btn-primary">
                    Add Memory
                </button>
                
                <button type="button" onClick={handleClear} className="btn btn-secondary">
                    Clear Thread
                </button>
            </form>
            
            <div className="memory-preview">
                <h3>Preview</h3>
                {settings.memoryEnabled && (
                    <pre>{`Memory enabled\nTTL: ${settings.memoryTtlDays ?? 30} days\nMax facts/query: ${settings.memoryMaxFactsPerQuery ?? 5}`}</pre>
                )}
            </div>
        </div>
    )
}
