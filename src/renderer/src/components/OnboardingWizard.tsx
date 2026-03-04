import React, { useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'

interface Props {
    onComplete: () => void
    onSkip: () => void
}

const STEPS = [
    'Welcome',
    'Models',
    'Appearance',
] as const

export default function OnboardingWizard({ onComplete, onSkip }: Props) {
    const [step, setStep] = useState(0)
    const { settings, setSettings } = useSettingsStore()

    const next = () => {
        if (step < STEPS.length - 1) setStep(step + 1)
        else onComplete()
    }

    const prev = () => {
        if (step > 0) setStep(step - 1)
    }

    return (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onSkip()}>
            <div className="settings-panel">
                <div className="settings-header">
                    <span className="settings-title">✨ Welcome to Lumina Search</span>
                    <button className="settings-close" onClick={onSkip} aria-label="Skip onboarding">✕</button>
                </div>
                <div className="settings-body">
                    {step === 0 && (
                        <div>
                            <div className="settings-section-title">Getting started</div>
                            <p style={{ fontSize: 14, color: 'var(--text-1)', marginBottom: 12 }}>
                                This short setup helps you pick models and appearance. You can always change these later in Settings.
                            </p>
                            <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text-1)' }}>
                                <li>Connect local models (Ollama / LM Studio) or cloud APIs.</li>
                                <li>Choose your default search provider.</li>
                                <li>Pick a theme (dark, light, or system).</li>
                            </ul>
                        </div>
                    )}
                    {step === 1 && (
                        <div>
                            <div className="settings-section-title">Models</div>
                            <div className="settings-field">
                                <label className="settings-label">Default Model ID</label>
                                <input
                                    className="settings-input"
                                    value={settings.defaultModel}
                                    onChange={(e) => setSettings({ ...settings, defaultModel: e.target.value })}
                                />
                            </div>
                            <div className="settings-field">
                                <label className="settings-label">Ollama URL</label>
                                <input
                                    className="settings-input"
                                    value={settings.ollamaUrl}
                                    onChange={(e) => setSettings({ ...settings, ollamaUrl: e.target.value })}
                                />
                            </div>
                            <div className="settings-field">
                                <label className="settings-label">LM Studio URL</label>
                                <input
                                    className="settings-input"
                                    value={settings.lmstudioUrl}
                                    onChange={(e) => setSettings({ ...settings, lmstudioUrl: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <div>
                            <div className="settings-section-title">Appearance</div>
                            <div className="settings-field">
                                <label className="settings-label">Theme</label>
                                <select
                                    className="settings-input"
                                    value={settings.theme}
                                    onChange={(e) => setSettings({ ...settings, theme: e.target.value as any })}
                                >
                                    <option value="dark">Dark</option>
                                    <option value="light">Light</option>
                                    <option value="system">System</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
                <div className="settings-footer">
                    <button className="btn-ghost" onClick={onSkip}>Skip</button>
                    {step > 0 && (
                        <button className="btn-ghost" onClick={prev}>
                            Back
                        </button>
                    )}
                    <button className="btn-primary" onClick={next}>
                        {step === STEPS.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    )
}

