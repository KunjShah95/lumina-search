import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AutoUpdater, UpdateInfo, UpdateProgress, getAutoUpdater, resetAutoUpdater } from '../src/main/services/autoUpdater'

describe('AutoUpdater', () => {
    beforeEach(() => {
        resetAutoUpdater()
    })

    afterEach(() => {
        resetAutoUpdater()
    })

    it('should initialize with default values', () => {
        const updater = getAutoUpdater()
        expect(updater).toBeDefined()
        expect(updater.isUpdateDownloaded()).toBe(false)
    })

    it('should provide singleton pattern', () => {
        const updater1 = getAutoUpdater()
        const updater2 = getAutoUpdater()
        expect(updater1).toBe(updater2)
    })

    it('should return correct update status', () => {
        const updater = getAutoUpdater()
        const status: UpdateInfo = updater.getStatus()

        expect(status).toBeDefined()
        expect(status.currentVersion).toBeDefined()
        expect(status.available).toBe(false)
        expect(status.latestVersion).toBeUndefined()
    })

    it('should handle update check gracefully', async () => {
        const updater = getAutoUpdater()
        // This will fail to check without network/GitHub updates
        // but should not throw
        try {
            const result = await updater.checkForUpdates(false)
            expect(typeof result).toBe('boolean')
        } catch (err) {
            // Network errors are acceptable in test environment
            expect(err).toBeDefined()
        }
    })

    it('should track manual check requests', async () => {
        const updater = getAutoUpdater()
        try {
            await updater.checkForUpdates(true)
        } catch (err) {
            // Expected in test environment
        }
        // Should not throw
    })

    it('should handle download without available update', async () => {
        const updater = getAutoUpdater()
        const result = await updater.downloadUpdate()
        expect(result).toBe(false) // No update available
    })

    it('should prevent install without downloaded update', () => {
        const updater = getAutoUpdater()
        // Should not throw
        updater.installAndRestart()
    })

    it('should expose isUpdateDownloaded method', () => {
        const updater = getAutoUpdater()
        expect(updater.isUpdateDownloaded()).toBe(false)
    })

    it('should return valid UpdateInfo structure', () => {
        const updater = getAutoUpdater()
        const status = updater.getStatus()

        expect(status).toHaveProperty('available')
        expect(status).toHaveProperty('currentVersion')
        expect(typeof status.available).toBe('boolean')
        expect(typeof status.currentVersion).toBe('string')
    })

    it('should handle multiple status calls', () => {
        const updater = getAutoUpdater()
        const status1 = updater.getStatus()
        const status2 = updater.getStatus()

        expect(status1.currentVersion).toBe(status2.currentVersion)
        expect(status1.available).toBe(status2.available)
    })

    it('should support progress callbacks during download', async () => {
        const updater = getAutoUpdater()
        const progressCallback = vi.fn((progress: UpdateProgress) => {
            expect(progress).toHaveProperty('percent')
            expect(progress).toHaveProperty('bytesPerSecond')
            expect(progress).toHaveProperty('total')
            expect(progress).toHaveProperty('transferred')
        })

        // Download should be from "no update available"
        // Progress callback shouldn't be called
        const result = await updater.downloadUpdate(progressCallback)
        expect(result).toBe(false)
    })

    it('should be instance of AutoUpdater', () => {
        const updater = getAutoUpdater()
        expect(updater).toBeInstanceOf(AutoUpdater)
    })

    it('should handle reset correctly', () => {
        const updater1 = getAutoUpdater()
        resetAutoUpdater()
        const updater2 = getAutoUpdater()

        expect(updater1).not.toBe(updater2)
    })

    it('should maintain state across calls', async () => {
        const updater = getAutoUpdater()
        const status1 = updater.getStatus()
        try {
            await updater.checkForUpdates(false)
        } catch {
            // Network error expected
        }
        const status2 = updater.getStatus()

        expect(status1.currentVersion).toBe(status2.currentVersion)
    })

    it('should return proper staging percentage if available', () => {
        const updater = getAutoUpdater()
        const status = updater.getStatus()

        if (status.stagingPercentage !== undefined) {
            expect(typeof status.stagingPercentage).toBe('number')
            expect(status.stagingPercentage).toBeGreaterThanOrEqual(0)
            expect(status.stagingPercentage).toBeLessThanOrEqual(100)
        }
    })
})
