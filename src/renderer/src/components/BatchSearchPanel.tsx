import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSettingsStore } from '../store/settingsStore'
import { FocusMode } from '../../../main/agents/types'

type BatchStatus = 'idle' | 'running' | 'done' | 'error'

interface BatchSearchItem {
  id: string
  query: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  executionTimeMs?: number
}

interface BatchSearchResult {
  id: string
  items: BatchSearchItem[]
  totalQueries: number
  completedCount: number
  failedCount: number
  totalExecutionTimeMs: number
}

interface Props {
  onClose: () => void
}

export default function BatchSearchPanel({ onClose }: Props) {
  const { settings, model } = useSettingsStore()
  const [rawQueries, setRawQueries] = useState('')
  const [focusMode, setFocusMode] = useState<FocusMode>('web')
  const [concurrency, setConcurrency] = useState(3)
  const [sequential, setSequential] = useState(false)
  const [status, setStatus] = useState<BatchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BatchSearchResult | null>(null)

  const parsedQueries = useMemo(
    () => rawQueries.split(/\r?\n/).map((q) => q.trim()).filter(Boolean),
    [rawQueries]
  )

  const runBatch = async () => {
    if (parsedQueries.length === 0) return

    setStatus('running')
    setError(null)
    setResult(null)

    try {
      const response = await window.api.executeBatchSearch({
        queries: parsedQueries,
        concurrency: sequential ? 1 : concurrency,
        sequential,
        searchOptions: {
          providers: [settings.defaultProvider],
          model,
          maxSources: settings.maxSources,
          scrapePages: settings.scrapePages,
          focusMode,
        },
      })

      setResult(response)
      setStatus('done')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const appendQueriesFromText = (text: string) => {
    if (!text.trim()) return

    const incoming = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^"|"$/g, ''))

    if (incoming.length === 0) return

    setRawQueries((prev) => {
      const base = prev.trim() ? prev.split(/\r?\n/).map((q) => q.trim()).filter(Boolean) : []
      const merged = Array.from(new Set([...base, ...incoming]))
      return merged.join('\n')
    })
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      appendQueriesFromText(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read clipboard')
    }
  }

  const importFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      appendQueriesFromText(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read selected file')
    } finally {
      event.target.value = ''
    }
  }

  const exportResults = (format: 'json' | 'csv') => {
    if (!result) return

    let content = ''
    let mime = 'application/json'
    let ext = 'json'

    if (format === 'json') {
      content = JSON.stringify(result, null, 2)
    } else {
      mime = 'text/csv;charset=utf-8'
      ext = 'csv'
      const header = 'query,status,executionTimeMs,error'
      const rows = result.items.map((item) => {
        const query = `"${item.query.replace(/"/g, '""')}"`
        const err = `"${(item.error ?? '').replace(/"/g, '""')}"`
        return `${query},${item.status},${item.executionTimeMs ?? 0},${err}`
      })
      content = [header, ...rows].join('\n')
    }

    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lumina-batch-results-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      className="settings-overlay"
      onClick={(e) => e.currentTarget === e.target && onClose()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="settings-panel"
        style={{ width: '840px', maxWidth: '94vw', maxHeight: '86vh' }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
      >
        <div className="settings-header">
          <h2>Batch Search</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content" style={{ overflowY: 'auto' }}>
          <div className="setting-group">
            <label className="setting-label">Queries (one per line)</label>
            <textarea
              className="settings-textarea"
              rows={7}
              value={rawQueries}
              onChange={(e) => setRawQueries(e.target.value)}
              placeholder={'What is TypeScript?\nReact hooks best practices\nVitest mocking examples'}
            />
            <p className="setting-hint">Detected {parsedQueries.length} valid quer{parsedQueries.length === 1 ? 'y' : 'ies'}.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="clear-history-btn" onClick={() => { void pasteFromClipboard() }}>
                Paste from clipboard
              </button>
              <label className="clear-history-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                Import TXT/CSV
                <input
                  type="file"
                  accept=".txt,.csv,text/plain,text/csv"
                  onChange={importFromFile}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          <div className="setting-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="setting-label">Execution mode</label>
              <select
                className="settings-select"
                value={sequential ? 'sequential' : 'parallel'}
                onChange={(e) => setSequential(e.target.value === 'sequential')}
              >
                <option value="parallel">Parallel</option>
                <option value="sequential">Sequential</option>
              </select>
            </div>
            <div>
              <label className="setting-label">Concurrency</label>
              <input
                className="settings-input"
                type="number"
                min={1}
                max={10}
                value={sequential ? 1 : concurrency}
                onChange={(e) => setConcurrency(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                disabled={sequential}
              />
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">Focus mode</label>
            <select
              className="settings-select"
              value={focusMode}
              onChange={(e) => setFocusMode(e.target.value as FocusMode)}
            >
              <option value="web">Web</option>
              <option value="academic">Academic</option>
              <option value="code">Code</option>
              <option value="reddit">Reddit</option>
              <option value="all">All</option>
              <option value="local">Local</option>
            </select>
          </div>

          <div className="setting-group">
            <button className="btn-primary" onClick={runBatch} disabled={parsedQueries.length === 0 || status === 'running'}>
              {status === 'running' ? 'Running batch…' : 'Run batch search'}
            </button>
          </div>

          {error && (
            <div className="setting-group">
              <div style={{ color: 'var(--error)', fontSize: 13 }}>{error}</div>
            </div>
          )}

          {result && (
            <div className="setting-group">
              <label className="setting-label">Summary</label>
              <div style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: 10 }}>
                Completed {result.completedCount}/{result.totalQueries} · Failed {result.failedCount} · Total {Math.round(result.totalExecutionTimeMs / 1000)}s
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button className="clear-history-btn" onClick={() => exportResults('json')}>Export JSON</button>
                <button className="clear-history-btn" onClick={() => exportResults('csv')}>Export CSV</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                {result.items.map((item) => (
                  <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{item.query}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {item.status.toUpperCase()} · {(item.executionTimeMs ?? 0)} ms
                      {item.error ? ` · ${item.error}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
