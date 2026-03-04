/**
 * Plugin Manager — Load and manage external plugins.
 */
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface PluginManifest {
    name: string
    version: string
    description: string
    author: string
    type: 'search' | 'postprocess' | 'tool'
    entryPoint: string
}

export interface LoadedPlugin {
    manifest: PluginManifest
    path: string
    isActive: boolean
    loadedAt: number
    error?: string
}

let loadedPlugins: LoadedPlugin[] = []

/**
 * Get the plugins directory.
 */
export function getPluginsDir(): string {
    const dir = path.join(app.getPath('userData'), 'plugins')
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    return dir
}

/**
 * Scan and load all plugins from the plugins directory.
 */
export function loadPlugins(): LoadedPlugin[] {
    const pluginsDir = getPluginsDir()
    loadedPlugins = []

    try {
        const entries = fs.readdirSync(pluginsDir, { withFileTypes: true })

        for (const entry of entries) {
            if (!entry.isDirectory()) continue

            const pluginDir = path.join(pluginsDir, entry.name)
            const manifestPath = path.join(pluginDir, 'manifest.json')

            if (!fs.existsSync(manifestPath)) continue

            try {
                const manifestRaw = fs.readFileSync(manifestPath, 'utf-8')
                const manifest: PluginManifest = JSON.parse(manifestRaw)

                // Validate manifest
                if (!manifest.name || !manifest.type || !manifest.entryPoint) {
                    loadedPlugins.push({
                        manifest: manifest as PluginManifest,
                        path: pluginDir,
                        isActive: false,
                        loadedAt: Date.now(),
                        error: 'Invalid manifest: missing required fields',
                    })
                    continue
                }

                loadedPlugins.push({
                    manifest,
                    path: pluginDir,
                    isActive: true,
                    loadedAt: Date.now(),
                })
            } catch (error) {
                loadedPlugins.push({
                    manifest: { name: entry.name, version: '0.0.0', description: '', author: '', type: 'tool', entryPoint: '' },
                    path: pluginDir,
                    isActive: false,
                    loadedAt: Date.now(),
                    error: `Failed to parse manifest: ${error}`,
                })
            }
        }
    } catch (error) {
        console.error('Failed to scan plugins directory:', error)
    }

    return loadedPlugins
}

/**
 * Get all loaded plugins.
 */
export function getPlugins(): LoadedPlugin[] {
    return [...loadedPlugins]
}

/**
 * Get plugins by type.
 */
export function getPluginsByType(type: PluginManifest['type']): LoadedPlugin[] {
    return loadedPlugins.filter(p => p.isActive && p.manifest.type === type)
}

/**
 * Install a plugin from a directory path (copy to plugins dir).
 */
export function installPlugin(sourcePath: string): LoadedPlugin | null {
    const manifestPath = path.join(sourcePath, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
        return null
    }

    try {
        const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        const destDir = path.join(getPluginsDir(), manifest.name.replace(/[^a-z0-9-_]/gi, '_'))

        // Copy plugin directory
        fs.cpSync(sourcePath, destDir, { recursive: true })

        const plugin: LoadedPlugin = {
            manifest,
            path: destDir,
            isActive: true,
            loadedAt: Date.now(),
        }

        loadedPlugins.push(plugin)
        return plugin
    } catch (error) {
        console.error('Plugin install failed:', error)
        return null
    }
}

/**
 * Uninstall a plugin.
 */
export function uninstallPlugin(name: string): boolean {
    const plugin = loadedPlugins.find(p => p.manifest.name === name)
    if (!plugin) return false

    try {
        fs.rmSync(plugin.path, { recursive: true, force: true })
        loadedPlugins = loadedPlugins.filter(p => p.manifest.name !== name)
        return true
    } catch (error) {
        console.error('Plugin uninstall failed:', error)
        return false
    }
}
