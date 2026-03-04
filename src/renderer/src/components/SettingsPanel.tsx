import React, { useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { AppSettings, SearchProvider } from '../../../main/agents/types'

interface Props { onClose: () => void }

export default function SettingsPanel({ onClose }: Props) {
    const { settings, setSettings } = useSettingsStore()
    const [form, setForm] = useState<AppSettings>({ ...settings })
    const [saved, setSaved] = useState(false)

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
                                <option value="light">Light</option>
                                <option value="system">System</option>
                            </select>
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
