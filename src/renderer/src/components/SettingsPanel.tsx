import React, { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { AppSettings, SearchProvider } from '../../../main/agents/types'

interface Props { onClose: () => void }

export default function SettingsPanel({ onClose }: Props) {
    const { settings, setSettings } = useSettingsStore()
    const [form, setForm] = useState<AppSettings>({ ...settings })
    const [saved, setSaved] = useState(false)
    const [updaterStatus, setUpdaterStatus] = useState<{
        available: boolean
        currentVersion: string
        latestVersion?: string
        releaseName?: string
        releaseNotes?: string
        stagingPercentage?: number
    } | null>(null)
    const [updateBusy, setUpdateBusy] = useState(false)
    const [updateMessage, setUpdateMessage] = useState('')

    const set = (key: keyof AppSettings, value: string | boolean | number) => {
        setForm(f => ({ ...f, [key]: value }))
    }

    const save = async () => {
        await window.api.setSettings(form)
        setSettings(form)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const searchProviders: { value: SearchProvider; label: string }[] = [
        { value: 'duckduckgo', label: 'DuckDuckGo (Free)' },
        { value: 'tavily', label: 'Tavily (API Key)' },
        { value: 'brave', label: 'Brave Search (API Key)' },
    ]

    useEffect(() => {
        ; (async () => {
            try {
                const status = await window.api.getUpdaterStatus()
                setUpdaterStatus(status)
            } catch {
                setUpdateMessage('Update status unavailable in current environment.')
            }
        })()
    }, [])

    const refreshUpdaterStatus = async () => {
        const status = await window.api.getUpdaterStatus()
        setUpdaterStatus(status)
        return status
    }

    const handleCheckUpdates = async () => {
        setUpdateBusy(true)
        setUpdateMessage('')
        try {
            const available = await window.api.checkForUpdates()
            const status = await refreshUpdaterStatus()
            setUpdateMessage(
                available && status.latestVersion
                    ? `Update available: ${status.latestVersion}`
                    : `No updates found. Current version: ${status.currentVersion}`,
            )
        } catch {
            setUpdateMessage('Failed to check for updates.')
        } finally {
            setUpdateBusy(false)
        }
    }

    const handleDownloadUpdate = async () => {
        setUpdateBusy(true)
        setUpdateMessage('')
        try {
            const started = await window.api.downloadUpdate()
            setUpdateMessage(started ? 'Update download started.' : 'No update available to download.')
        } catch {
            setUpdateMessage('Failed to start update download.')
        } finally {
            setUpdateBusy(false)
        }
    }

    const handleInstallUpdate = async () => {
        setUpdateBusy(true)
        setUpdateMessage('')
        try {
            const accepted = await window.api.installUpdate()
            setUpdateMessage(accepted ? 'Installing update. App may restart shortly.' : 'No downloaded update to install.')
        } catch {
            setUpdateMessage('Failed to install update.')
        } finally {
            setUpdateBusy(false)
        }
    }

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="settings-panel">
                <div className="settings-header">
                    <span className="settings-title">⚙ Settings</span>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="settings-body">
                    {/* Search */}
                    <div>
                        <div className="settings-section-title">Search</div>
                        <div className="settings-field">
                            <label className="settings-label">Search Provider</label>
                            <select
                                className="settings-input"
                                value={form.defaultProvider}
                                onChange={e => set('defaultProvider', e.target.value as SearchProvider)}
                            >
                                {searchProviders.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Tavily API Key</label>
                            <input className="settings-input" type="password" value={form.tavilyKey}
                                onChange={e => set('tavilyKey', e.target.value)} placeholder="tvly-..." />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Brave Search API Key</label>
                            <input className="settings-input" type="password" value={form.braveKey}
                                onChange={e => set('braveKey', e.target.value)} placeholder="BSA..." />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Max Sources</label>
                            <input className="settings-input" type="number" min={3} max={20} value={form.maxSources}
                                onChange={e => set('maxSources', Number(e.target.value))} style={{ fontFamily: 'var(--font)' }} />
                        </div>
                    </div>

                    {/* Cloud LLMs */}
                    <div>
                        <div className="settings-section-title">Cloud LLM Keys</div>
                        <div className="settings-field">
                            <label className="settings-label">OpenAI API Key</label>
                            <input className="settings-input" type="password" value={form.openaiKey}
                                onChange={e => set('openaiKey', e.target.value)} placeholder="sk-..." />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Anthropic API Key</label>
                            <input className="settings-input" type="password" value={form.anthropicKey}
                                onChange={e => set('anthropicKey', e.target.value)} placeholder="sk-ant-..." />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Google AI (Gemini) Key</label>
                            <input className="settings-input" type="password" value={form.geminiKey}
                                onChange={e => set('geminiKey', e.target.value)} placeholder="AIza..." />
                        </div>
                    </div>

                    {/* Local LLMs */}
                    <div>
                        <div className="settings-section-title">Local Models</div>
                        <div className="settings-field">
                            <label className="settings-label">Ollama Base URL</label>
                            <input className="settings-input" value={form.ollamaUrl}
                                onChange={e => set('ollamaUrl', e.target.value)} />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">LM Studio Base URL</label>
                            <input className="settings-input" value={form.lmstudioUrl}
                                onChange={e => set('lmstudioUrl', e.target.value)} />
                        </div>
                    </div>

                    {/* Model Settings */}
                    <div>
                        <div className="settings-section-title">Model Settings</div>
                        <div className="settings-field">
                            <label className="settings-label">Temperature ({form.temperature})</label>
                            <input
                                className="settings-input"
                                type="range"
                                min={0}
                                max={2}
                                step={0.1}
                                value={form.temperature}
                                onChange={e => set('temperature', Number(e.target.value))}
                            />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Top P ({form.topP})</label>
                            <input
                                className="settings-input"
                                type="range"
                                min={0}
                                max={1}
                                step={0.1}
                                value={form.topP}
                                onChange={e => set('topP', Number(e.target.value))}
                            />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">Max Tokens</label>
                            <input className="settings-input" type="number" min={256} max={128000} value={form.maxTokens}
                                onChange={e => set('maxTokens', Number(e.target.value))} style={{ fontFamily: 'var(--font)' }} />
                        </div>
                    </div>

                    {/* Appearance */}
                    <div>
                        <div className="settings-section-title">Appearance</div>
                        <div className="settings-field">
                            <label className="settings-label">Theme</label>
                            <select
                                className="settings-input"
                                value={form.theme}
                                onChange={e => set('theme', e.target.value as 'dark' | 'light' | 'system')}
                            >
                                <option value="dark">Dark</option>
                                <option value="amoled">AMOLED Dark</option>
                                <option value="light">Light</option>
                                <option value="system">System</option>
                            </select>
                        </div>
                        {form.theme === 'amoled' && (
                            <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginTop: 4 }}>
                                Pure black theme optimized for OLED displays
                            </div>
                        )}
                    </div>

                    {/* Updates */}
                    <div>
                        <div className="settings-section-title">Updates</div>
                        <div className="settings-field">
                            <label className="settings-label">Current Version</label>
                            <div className="settings-input" style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                                {updaterStatus?.currentVersion ?? 'Unknown'}
                            </div>
                        </div>
                        {updaterStatus?.available && updaterStatus.latestVersion && (
                            <div className="settings-field">
                                <label className="settings-label">Latest Version</label>
                                <div className="settings-input" style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                                    {updaterStatus.latestVersion}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn-ghost" onClick={handleCheckUpdates} disabled={updateBusy}>
                                Check Updates
                            </button>
                            <button className="btn-ghost" onClick={handleDownloadUpdate} disabled={updateBusy || !updaterStatus?.available}>
                                Download Update
                            </button>
                            <button className="btn-primary" onClick={handleInstallUpdate} disabled={updateBusy}>
                                Install Update
                            </button>
                        </div>
                        {updateMessage && <div style={{ marginTop: 10, opacity: 0.9 }}>{updateMessage}</div>}
                    </div>

                    {/* v1.1.0: API Server */}
                    <div>
                        <div className="settings-section-title">API Server (v1.1.0)</div>
                        <div className="settings-field">
                            <label className="settings-label">
                                <input
                                    type="checkbox"
                                    checked={form.apiServerEnabled}
                                    onChange={e => set('apiServerEnabled', e.target.checked)}
                                    style={{ marginRight: 8 }}
                                />
                                Enable Local API Server
                            </label>
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">API Server Port</label>
                            <input
                                className="settings-input"
                                type="number"
                                min={1024}
                                max={65535}
                                value={form.apiServerPort}
                                onChange={e => set('apiServerPort', Number(e.target.value))}
                                style={{ fontFamily: 'var(--font)' }}
                            />
                        </div>
                        <div className="settings-field">
                            <label className="settings-label">
                                <input
                                    type="checkbox"
                                    checked={form.apiServerRequireAuth}
                                    onChange={e => set('apiServerRequireAuth', e.target.checked)}
                                    style={{ marginRight: 8 }}
                                />
                                Require API Key Authentication
                            </label>
                        </div>
                        <div style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginTop: 8 }}>
                            Access API at http://localhost:{form.apiServerPort}/api/v1
                        </div>
                    </div>

                    {/* v1.1.0: Search Operators Help */}
                    <div>
                        <div className="settings-section-title">Search Operators (v1.1.0)</div>
                        <div style={{ fontSize: '0.85em', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            <div><code style={{ background: 'var(--bg-2)', padding: '2px 4px', borderRadius: 3 }}>site:example.com</code> - Search within a domain</div>
                            <div><code style={{ background: 'var(--bg-2)', padding: '2px 4px', borderRadius: 3 }}>filetype:pdf</code> - Filter by file type</div>
                            <div><code style={{ background: 'var(--bg-2)', padding: '2px 4px', borderRadius: 3 }}>language:en</code> - Filter by language</div>
                            <div><code style={{ background: 'var(--bg-2)', padding: '2px 4px', borderRadius: 3 }}>source:web</code> - Filter by source type</div>
                            <div><code style={{ background: 'var(--bg-2)', padding: '2px 4px', borderRadius: 3 }}>!exclude</code> - Exclude terms</div>
                            <div><code style={{ background: 'var(--bg-2)', padding: '2px 4px', borderRadius: 3 }}>"exact phrase"</code> - Exact match</div>
                        </div>
                    </div>
                </div>

                <div className="settings-footer">
                    <button className="btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={save}>
                        {saved ? '✓ Saved!' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}
