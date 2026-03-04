import { useSettingsStore } from '../store/settingsStore'
import { AppSettings } from '../../../main/agents/types'

export function useAppSettings() {
    const settings = useSettingsStore((state) => state.settings)
    const setSettings = useSettingsStore((state) => state.setSettings)

    const updateSettings = async (partial: Partial<AppSettings>) => {
        const next = { ...settings, ...partial }
        setSettings(next)
        await window.api.setSettings(next)
        return next
    }

    return {
        settings,
        updateSettings,
    }
}
