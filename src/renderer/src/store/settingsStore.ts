import { create } from 'zustand'
import { AppSettings, DEFAULT_SETTINGS } from '../../../main/agents/types'

interface SettingsState {
    settings: AppSettings
    loaded: boolean
    model: string
    ollamaModels: string[]
    lmstudioModels: string[]
    setSettings: (s: AppSettings) => void
    setModel: (m: string) => void
    setOllamaModels: (models: string[]) => void
    setLMStudioModels: (models: string[]) => void
    setLoaded: (b: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
    settings: DEFAULT_SETTINGS,
    loaded: false,
    model: DEFAULT_SETTINGS.defaultModel,
    ollamaModels: [],
    lmstudioModels: [],
    setSettings: (settings) => set({ settings, model: settings.defaultModel }),
    setModel: (model) => set({ model }),
    setOllamaModels: (ollamaModels) => set({ ollamaModels }),
    setLMStudioModels: (lmstudioModels) => set({ lmstudioModels }),
    setLoaded: (loaded) => set({ loaded }),
}))
