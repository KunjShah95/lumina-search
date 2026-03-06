/**
 * Keyboard Shortcuts Manager
 * Manages customizable keyboard shortcuts for the application
 */

import { createLogger } from './logger'

const logger = createLogger('KeyboardShortcuts')

export interface KeyboardShortcut {
  id: string
  name: string
  description: string
  keys: string[]
  action: string
  enabled: boolean
  default: boolean
}

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: 'focus-search',
    name: 'Focus Search Bar',
    description: 'Focus the search input',
    keys: ['Ctrl', 'K'],
    action: 'search:focus',
    enabled: true,
    default: true,
  },
  {
    id: 'new-search',
    name: 'New Search',
    description: 'Start a new search',
    keys: ['Ctrl', 'N'],
    action: 'search:new',
    enabled: true,
    default: true,
  },
  {
    id: 'toggle-window',
    name: 'Toggle Window',
    description: 'Show/hide the application window',
    keys: ['Ctrl', 'Shift', 'Space'],
    action: 'window:toggle',
    enabled: true,
    default: true,
  },
  {
    id: 'open-settings',
    name: 'Open Settings',
    description: 'Open the settings panel',
    keys: ['Ctrl', ','],
    action: 'settings:open',
    enabled: true,
    default: true,
  },
  {
    id: 'open-knowledge-base',
    name: 'Open Knowledge Base',
    description: 'Open the knowledge base panel',
    keys: ['Ctrl', 'Shift', 'K'],
    action: 'knowledge-base:open',
    enabled: true,
    default: true,
  },
  {
    id: 'submit-search',
    name: 'Submit Search',
    description: 'Submit the current search query',
    keys: ['Enter'],
    action: 'search:submit',
    enabled: true,
    default: true,
  },
  {
    id: 'new-line',
    name: 'New Line in Search',
    description: 'Add a new line in search input',
    keys: ['Shift', 'Enter'],
    action: 'search:newline',
    enabled: true,
    default: true,
  },
  {
    id: 'cancel-search',
    name: 'Cancel Search',
    description: 'Cancel the current search',
    keys: ['Escape'],
    action: 'search:cancel',
    enabled: true,
    default: true,
  },
  {
    id: 'toggle-sidebar',
    name: 'Toggle Sidebar',
    description: 'Show/hide the sidebar',
    keys: ['Ctrl', 'B'],
    action: 'sidebar:toggle',
    enabled: true,
    default: true,
  },
  {
    id: 'focus-next',
    name: 'Focus Next Element',
    description: 'Move focus to the next element',
    keys: ['Tab'],
    action: 'focus:next',
    enabled: true,
    default: true,
  },
  {
    id: 'focus-prev',
    name: 'Focus Previous Element',
    description: 'Move focus to the previous element',
    keys: ['Shift', 'Tab'],
    action: 'focus:prev',
    enabled: true,
    default: true,
  },
  {
    id: 'select-result-1',
    name: 'Select Result 1-9',
    description: 'Quick select search result 1-9',
    keys: ['Ctrl', '1'],
    action: 'result:select-1',
    enabled: true,
    default: true,
  },
]

export class KeyboardShortcutsManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private listeners: Map<string, Array<(action: string) => void>> = new Map()
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null

  constructor() {
    this.loadDefaults()
  }

  private loadDefaults(): void {
    DEFAULT_SHORTCUTS.forEach((shortcut) => {
      this.shortcuts.set(shortcut.id, { ...shortcut })
    })
    logger.info(`Loaded ${DEFAULT_SHORTCUTS.length} default keyboard shortcuts`)
  }

  /**
   * Get all shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * Get enabled shortcuts only
   */
  getEnabledShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values()).filter((s) => s.enabled)
  }

  /**
   * Get shortcut by ID
   */
  getShortcut(id: string): KeyboardShortcut | undefined {
    return this.shortcuts.get(id)
  }

  /**
   * Update a shortcut
   */
  updateShortcut(id: string, updates: Partial<KeyboardShortcut>): KeyboardShortcut | null {
    const shortcut = this.shortcuts.get(id)
    if (!shortcut) {
      logger.warn(`Shortcut not found: ${id}`)
      return null
    }

    const updated: KeyboardShortcut = {
      ...shortcut,
      ...updates,
      id: shortcut.id, // Prevent ID change
    }

    this.shortcuts.set(id, updated)
    logger.info(`Updated shortcut: ${id}`)

    return updated
  }

  /**
   * Toggle shortcut enabled state
   */
  toggleShortcut(id: string, enabled: boolean): boolean {
    const shortcut = this.shortcuts.get(id)
    if (!shortcut) return false

    shortcut.enabled = enabled
    logger.info(`Shortcut ${id} ${enabled ? 'enabled' : 'disabled'}`)

    return true
  }

  /**
   * Reset shortcut to default
   */
  resetToDefault(id: string): boolean {
    const defaultShortcut = DEFAULT_SHORTCUTS.find((s) => s.id === id)
    if (!defaultShortcut) {
      logger.warn(`Default shortcut not found: ${id}`)
      return false
    }

    this.shortcuts.set(id, { ...defaultShortcut })
    logger.info(`Reset shortcut to default: ${id}`)

    return true
  }

  /**
   * Reset all shortcuts to defaults
   */
  resetAllToDefaults(): void {
    this.shortcuts.clear()
    this.loadDefaults()
    logger.info('All shortcuts reset to defaults')
  }

  /**
   * Register a custom shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut)
    logger.info(`Registered custom shortcut: ${shortcut.id}`)
  }

  /**
   * Unregister a custom shortcut
   */
  unregisterShortcut(id: string): boolean {
    const shortcut = this.shortcuts.get(id)
    if (!shortcut || shortcut.default) {
      return false
    }

    this.shortcuts.delete(id)
    logger.info(`Unregistered custom shortcut: ${id}`)

    return true
  }

  /**
   * Add action listener
   */
  onAction(action: string, callback: (action: string) => void): void {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, [])
    }
    this.listeners.get(action)!.push(callback)
  }

  /**
   * Remove action listener
   */
  offAction(action: string, callback: (action: string) => void): void {
    const callbacks = this.listeners.get(action)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Start listening for keyboard events
   */
  startListening(): void {
    if (this.keydownHandler) return

    this.keydownHandler = (e: KeyboardEvent) => {
      this.handleKeyDown(e)
    }

    document.addEventListener('keydown', this.keydownHandler)
    logger.info('Keyboard shortcuts listener started')
  }

  /**
   * Stop listening for keyboard events
   */
  stopListening(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler)
      this.keydownHandler = null
      logger.info('Keyboard shortcuts listener stopped')
    }
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const pressedKeys: string[] = []
    
    if (e.ctrlKey) pressedKeys.push('Ctrl')
    if (e.shiftKey) pressedKeys.push('Shift')
    if (e.altKey) pressedKeys.push('Alt')
    if (e.metaKey) pressedKeys.push('Meta')
    
    const key = e.key.toLowerCase()
    if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
      pressedKeys.push(key.toUpperCase())
    }

    // Check for matching shortcut
    for (const shortcut of this.getEnabledShortcuts()) {
      if (this.keysMatch(shortcut.keys, pressedKeys)) {
        e.preventDefault()
        this.triggerAction(shortcut.action)
        return
      }
    }
  }

  /**
   * Check if pressed keys match shortcut keys
   */
  private keysMatch(shortcutKeys: string[], pressedKeys: string[]): boolean {
    if (shortcutKeys.length !== pressedKeys.length) return false
    
    const sortedShortcut = [...shortcutKeys].sort()
    const sortedPressed = [...pressedKeys].sort()
    
    return sortedShortcut.every((key, i) => key === sortedPressed[i])
  }

  /**
   * Trigger an action
   */
  private triggerAction(action: string): void {
    const callbacks = this.listeners.get(action)
    if (callbacks) {
      callbacks.forEach((callback) => callback(action))
    }
  }

  /**
   * Export shortcuts to JSON
   */
  exportShortcuts(): string {
    const custom = Array.from(this.shortcuts.values()).filter((s) => !s.default)
    return JSON.stringify(custom, null, 2)
  }

  /**
   * Import shortcuts from JSON
   */
  importShortcuts(jsonData: string): { imported: number; errors: string[] } {
    const errors: string[] = []
    let imported = 0

    try {
      const data = JSON.parse(jsonData)
      if (!Array.isArray(data)) {
        throw new Error('Expected array of shortcuts')
      }

      data.forEach((item) => {
        try {
          this.registerShortcut({
            id: item.id,
            name: item.name,
            description: item.description,
            keys: item.keys,
            action: item.action,
            enabled: item.enabled ?? true,
            default: false,
          })
          imported++
        } catch (error) {
          errors.push(`Item ${item.id}: ${error instanceof Error ? error.message : String(error)}`)
        }
      })
    } catch (error) {
      errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`)
    }

    logger.info(`Imported ${imported} custom shortcuts`)
    return { imported, errors }
  }
}

let instance: KeyboardShortcutsManager | null = null

export function getKeyboardShortcutsManager(): KeyboardShortcutsManager {
  if (!instance) {
    instance = new KeyboardShortcutsManager()
  }
  return instance
}

export function resetKeyboardShortcutsManager(): void {
  instance?.stopListening()
  instance = null
}
