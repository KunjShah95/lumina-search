import React, { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '../store/settingsStore'

const CLOUD_MODELS = [
    { id: 'openai:gpt-4o', name: 'GPT-4o', tag: 'OpenAI' },
    { id: 'openai:gpt-4o-mini', name: 'GPT-4o Mini', tag: 'OpenAI' },
    { id: 'anthropic:claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Anthropic' },
    { id: 'anthropic:claude-3-haiku-20240307', name: 'Claude 3 Haiku', tag: 'Anthropic' },
    { id: 'gemini:gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'Google' },
    { id: 'gemini:gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Google' },
]

export default function ModelPicker() {
    const [open, setOpen] = useState(false)
    const { model, setModel, ollamaModels, lmstudioModels } = useSettingsStore()
    const ref = useRef<HTMLDivElement>(null)

    const isLocal = model.startsWith('ollama:') || model.startsWith('lmstudio:')
    const displayName = model.includes(':') ? model.split(':').slice(1).join(':') : model

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [])

    const select = (id: string) => { setModel(id); setOpen(false) }

    return (
        <div className="model-picker" ref={ref}>
            <button className="model-trigger" onClick={() => setOpen(!open)} title={model}>
                <span className={`model-dot ${isLocal ? 'local' : 'cloud'}`} />
                <span className="model-name">{displayName}</span>
                <span style={{ opacity: 0.5, fontSize: 10 }}>▾</span>
            </button>

            {open && (
                <div className="model-dropdown">
                    {/* Local models - Ollama */}
                    {ollamaModels.length > 0 && (
                        <>
                            <div className="model-group-label">🟢 Local (Ollama)</div>
                            {ollamaModels.map(m => (
                                <div key={m} className={`model-option ${model === m ? 'selected' : ''}`} onClick={() => select(m)}>
                                    <span className="model-dot local" />
                                    <span className="model-option-name">{m.replace('ollama:', '')}</span>
                                    {model === m && <span>✓</span>}
                                </div>
                            ))}
                            <div className="model-divider" />
                        </>
                    )}

                    {/* Local models - LM Studio */}
                    {lmstudioModels.length > 0 && (
                        <>
                            <div className="model-group-label">🔵 Local (LM Studio)</div>
                            {lmstudioModels.map(m => (
                                <div key={m} className={`model-option ${model === m ? 'selected' : ''}`} onClick={() => select(m)}>
                                    <span className="model-dot local" />
                                    <span className="model-option-name">{m.replace('lmstudio:', '')}</span>
                                    {model === m && <span>✓</span>}
                                </div>
                            ))}
                            <div className="model-divider" />
                        </>
                    )}

                    {/* Cloud models */}
                    <div className="model-group-label">☁️ Cloud</div>
                    {CLOUD_MODELS.map(m => (
                        <div key={m.id} className={`model-option ${model === m.id ? 'selected' : ''}`} onClick={() => select(m.id)}>
                            <span className="model-dot cloud" />
                            <span className="model-option-name">{m.name}</span>
                            <span className="model-option-tag">{m.tag}</span>
                            {model === m.id && <span>✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
