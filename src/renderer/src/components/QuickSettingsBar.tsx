import React from 'react'
import { SearchProvider } from '../../../main/agents/types'
import { useSettingsStore } from '../store/settingsStore'
import { useSearchStore } from '../store/searchStore'

const PROVIDERS: Array<{ value: SearchProvider; label: string }> = [
    { value: 'duckduckgo', label: 'DuckDuckGo' },
    { value: 'tavily', label: 'Tavily' },
    { value: 'brave', label: 'Brave' },
]

export default function QuickSettingsBar() {
    const { settings, setSettings } = useSettingsStore()
    const { focusMode, setFocusMode } = useSearchStore()

    const updateProvider = async (provider: SearchProvider) => {
        const next = { ...settings, defaultProvider: provider }
        setSettings(next)
        await window.api.setSettings(next)
    }

    const updateTheme = async (theme: 'dark' | 'light' | 'system' | 'amoled') => {
        const next = { ...settings, theme }
        setSettings(next)
        await window.api.setSettings(next)
    }

    return (
        <div className="quick-settings-bar" aria-label="Quick settings">
            <label className="quick-settings-item">
                <span>Model</span>
                <select
                    value={settings.defaultModel}
                    onChange={async (e) => {
                        const next = { ...settings, defaultModel: e.target.value }
                        setSettings(next)
                        await window.api.setSettings(next)
                    }}
                >
                    <option value="openai:gpt-4o-mini">GPT-4o Mini</option>
                    <option value="openai:gpt-4o">GPT-4o</option>
                    <option value="anthropic:claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
                    <option value="gemini:gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="ollama:llama3.2">Ollama Llama 3.2</option>
                    <option value="lmstudio:local-model">LM Studio Local</option>
                </select>
            </label>

            <label className="quick-settings-item">
                <span>Provider</span>
                <select value={settings.defaultProvider} onChange={(e) => updateProvider(e.target.value as SearchProvider)}>
                    {PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
            </label>

            <label className="quick-settings-item">
                <span>Mode</span>
                <select
                    value={focusMode}
                    onChange={(e) => setFocusMode(e.target.value as 'web' | 'local' | 'all' | 'hybrid-rag')}
                >
                    <option value="web">🌐 Web</option>
                    <option value="local">📄 Local</option>
                    <option value="all">🔍 All</option>
                    <option value="hybrid-rag">🧠 Hybrid RAG</option>
                </select>
            </label>

            <label className="quick-settings-item">
                <span>Theme</span>
                <select value={settings.theme} onChange={(e) => updateTheme(e.target.value as 'dark' | 'light' | 'system' | 'amoled')}>
                    <option value="dark">Dark</option>
                    <option value="amoled">AMOLED</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                </select>
            </label>
        </div>
    )
}
