/**
 * Auto-Update Service
 *
 * Manages application updates using electron-updater.
 * Checks for updates on startup and provides manual update endpoints.
 */

import { app, ipcMain, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'
import { createLogger } from './logger'

const logger = createLogger('auto-updater')

export interface UpdateInfo {
    available: boolean
    currentVersion: string
    latestVersion?: string
    releaseName?: string
    releaseNotes?: string
    stagingPercentage?: number
}

export interface UpdateProgress {
    percent: number
    bytesPerSecond: number
    total: number
    transferred: number
}

type UpdateCallback = (progress: UpdateProgress) => void

/**
 * Auto-Updater Service
 */
export class AutoUpdater {
    private readonly enabled = app.isPackaged
    private updateAvailable = false
    private updateDownloaded = false
    private latestVersion = ''
    private releaseName = ''
    private releaseNotes = ''
    private progressCallback: UpdateCallback | null = null
    private manualCheckRequested = false
    private stagingPercentage = 0

    constructor() {
        this.initializeAutoUpdater()
        this.setupEventListeners()
    }

    /**
     * Initialize electron-updater
     */
    private initializeAutoUpdater(): void {
        try {
            if (!this.enabled) {
                logger.info('Auto-updater disabled in development mode')
                return
            }

            // Configure auto-updater
            autoUpdater.allowDowngrade = false
            autoUpdater.allowPrerelease = false
            autoUpdater.autoDownload = false
            autoUpdater.autoInstallOnAppQuit = true

            logger.info('Auto-updater initialized', {
                currentVersion: app.getVersion(),
                appPath: app.getAppPath(),
            })
        } catch (err) {
            // Test environment or running without electron context
            logger.warn('Auto-updater initialization failed (may be test environment)', {
                error: err instanceof Error ? err.message : String(err)
            })
        }
    }

    /**
     * Setup electron-updater event listeners
     */
    private setupEventListeners(): void {
        try {
            if (!this.enabled) {
                return
            }

            // Check for update available
            autoUpdater.on('update-available', (info) => {
                this.updateAvailable = true
                this.latestVersion = info.version
                this.releaseName = info.releaseName ?? `v${info.version}`
                this.releaseNotes = typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
                this.stagingPercentage = info.stagingPercentage ?? 0

                logger.info('Update available', {
                    currentVersion: app.getVersion(),
                    latestVersion: this.latestVersion,
                    releaseName: this.releaseName,
                    stagingPercentage: this.stagingPercentage,
                    files: info.files.length,
                })

                // Show notification for manual check, or if user opted in
                if (this.manualCheckRequested) {
                    this.showUpdateNotification()
                }
            })

            // No update available
            autoUpdater.on('update-not-available', () => {
                this.updateAvailable = false

                logger.info('No update available', { currentVersion: app.getVersion() })

                if (this.manualCheckRequested) {
                    this.showNotification(
                        'Lumina Search is Up to Date',
                        `You're running the latest version (${app.getVersion()})`,
                    )
                }
            })

            // Update download progress
            autoUpdater.on('download-progress', (progress) => {
                const progressData: UpdateProgress = {
                    percent: progress.percent,
                    bytesPerSecond: progress.bytesPerSecond,
                    total: progress.total,
                    transferred: progress.transferred,
                }

                logger.info('Update download progress', {
                    percent: progressData.percent.toFixed(2),
                    bytesPerSecond: (progressData.bytesPerSecond / 1024).toFixed(2),
                    transferred: (progressData.transferred / 1024 / 1024).toFixed(2),
                    total: (progressData.total / 1024 / 1024).toFixed(2),
                })

                this.progressCallback?.(progressData)
            })

            // Update downloaded
            autoUpdater.on('update-downloaded', () => {
                this.updateDownloaded = true

                logger.info('Update downloaded successfully', {
                    latestVersion: this.latestVersion,
                })

                this.showDownloadedNotification()
            })

            // Update error
            autoUpdater.on('error', (err) => {
                logger.error('Update check failed', err, {
                    currentVersion: app.getVersion(),
                    manualCheck: this.manualCheckRequested,
                })

                if (this.manualCheckRequested) {
                    this.showNotification(
                        'Update Check Failed',
                        'Could not check for updates. Please try again later.',
                    )
                }
            })
        } catch (err) {
            logger.warn('Failed to show notification (may be test environment)', {
                error: err instanceof Error ? err.message : String(err)
            })
        }
    }

    /**
     * Check for updates
     */
    async checkForUpdates(manual = false): Promise<boolean> {
        this.manualCheckRequested = manual
        logger.info('Checking for updates', { manual })

        try {
            if (!this.enabled) {
                return false
            }

            await autoUpdater.checkForUpdates()
            return this.updateAvailable
        } catch (err) {
            logger.warn('Check for updates failed (may be test environment)', {
                error: err instanceof Error ? err.message : String(err),
            })
            // In test environment or offline, return false
            return false
        }
    }

    /**
     * Download update
     */
    async downloadUpdate(onProgress?: UpdateCallback): Promise<boolean> {
        if (!this.updateAvailable) {
            logger.warn('No update available to download')
            return false
        }

        this.progressCallback = onProgress ?? null

        try {
            if (!this.enabled) {
                return false
            }

            logger.info('Starting update download', { version: this.latestVersion })
            await autoUpdater.downloadUpdate()
            return true
        } catch (err) {
            logger.warn('Update download failed (may be test environment)', {
                error: err instanceof Error ? err.message : String(err)
            })
            return false
        }
    }

    /**
     * Install update and restart
     */
    installAndRestart(): void {
        if (!this.updateDownloaded) {
            logger.warn('No downloaded update to install')
            return
        }

        try {
            if (!this.enabled) {
                return
            }

            logger.info('Installing update and restarting', { version: this.latestVersion })
            autoUpdater.quitAndInstall()
        } catch (err) {
            logger.warn('Install and restart failed (may be test environment)', {
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }

    /**
     * Get update status
     */
    getStatus(): UpdateInfo {
        try {
            return {
                available: this.updateAvailable,
                currentVersion: app.getVersion(),
                latestVersion: this.updateAvailable ? this.latestVersion : undefined,
                releaseName: this.updateAvailable ? this.releaseName : undefined,
                releaseNotes: this.updateAvailable ? this.releaseNotes : undefined,
                stagingPercentage: this.stagingPercentage,
            }
        } catch (err) {
            // Test environment - return default values
            return {
                available: this.updateAvailable,
                currentVersion: '1.0.0',
                latestVersion: this.updateAvailable ? this.latestVersion : undefined,
                releaseName: this.updateAvailable ? this.releaseName : undefined,
                releaseNotes: this.updateAvailable ? this.releaseNotes : undefined,
                stagingPercentage: this.stagingPercentage,
            }
        }
    }

    /**
     * Check if update is downloaded
     */
    isUpdateDownloaded(): boolean {
        return this.updateDownloaded
    }

    /**
     * Show update available notification
     */
    private showUpdateNotification(): void {
        this.showNotification(
            'Update Available',
            `Lumina Search ${this.latestVersion} is available. Click to download and install.`,
        )
    }

    /**
     * Show update downloaded notification
     */
    private showDownloadedNotification(): void {
        this.showNotification(
            'Update Ready',
            `Lumina Search ${this.latestVersion} is ready to install. Restart the app to apply.`,
        )
    }

    /**
     * Show generic notification
     */
    private showNotification(title: string, body: string): void {
        try {
            if (!Notification.isSupported()) {
                return
            }

            new Notification({
                title,
                body,
                urgency: 'normal',
                silent: false,
            }).show()
        } catch (err) {
            logger.warn('Failed to show notification (may be test environment)', {
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }
}

// Singleton instance
let updaterInstance: AutoUpdater | null = null

/**
 * Get or create auto-updater instance
 */
export function getAutoUpdater(): AutoUpdater {
    if (!updaterInstance) {
        updaterInstance = new AutoUpdater()
    }
    return updaterInstance
}

/**
 * Reset auto-updater (for testing)
 */
export function resetAutoUpdater(): void {
    updaterInstance = null
}

/**
 * Register IPC handlers
 */
export function registerAutoUpdateHandlers(): void {
    const updater = getAutoUpdater()

    ipcMain.handle('updater:status', () => {
        try {
            return updater.getStatus()
        } catch (err) {
            logger.error('updater:status failed', err)
            throw err
        }
    })

    ipcMain.handle('updater:check', () => {
        try {
            return updater.checkForUpdates(true)
        } catch (err) {
            logger.error('updater:check failed', err)
            throw err
        }
    })

    ipcMain.handle('updater:download', () => {
        try {
            return updater.downloadUpdate()
        } catch (err) {
            logger.error('updater:download failed', err)
            throw err
        }
    })

    ipcMain.handle('updater:install', () => {
        try {
            updater.installAndRestart()
            return true
        } catch (err) {
            logger.error('updater:install failed', err)
            throw err
        }
    })

    ipcMain.handle('updater:skip-version', (_e, version: string) => {
        try {
            // In production, you could store skipped versions in settings
            logger.info('User skipped update', { version })
            return true
        } catch (err) {
            logger.error('updater:skip-version failed', err)
            throw err
        }
    })

    logger.info('Auto-updater IPC handlers registered')
}
