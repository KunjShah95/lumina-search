/**
 * Windows Platform Optimizations
 * Specific performance and compatibility improvements for Windows
 */

import { app, powerMonitor } from 'electron'
import * as path from 'path'
import * as os from 'os'
import { createLogger } from './logger'

const logger = createLogger('WindowsOptimizations')

export interface WindowsConfig {
    hardwareAcceleration: boolean
    gpuRasterization: boolean
    offScreenRendering: boolean
    disableHardwareAcceleration: boolean
}

const DEFAULT_WINDOWS_CONFIG: WindowsConfig = {
    hardwareAcceleration: true,
    gpuRasterization: true,
    offScreenRendering: false,
    disableHardwareAcceleration: false,
}

let windowsConfig: WindowsConfig = { ...DEFAULT_WINDOWS_CONFIG }

export function initWindowsOptimizations(): void {
    if (process.platform !== 'win32') {
        return
    }

    logger.info('Applying Windows-specific optimizations')

    // Apply GPU optimizations
    applyGPUOptimizations()

    // Apply memory optimizations
    applyMemoryOptimizations()

    // Setup power management
    setupPowerManagement()

    // Apply network optimizations
    applyNetworkOptimizations()

    logger.info('Windows optimizations applied', {
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
    })
}

function applyGPUOptimizations(): void {
    // Disable hardware acceleration if needed for problematic GPUs
    if (windowsConfig.disableHardwareAcceleration) {
        app.disableHardwareAcceleration()
        logger.info('Hardware acceleration disabled')
    }

    // Experimental flags for better performance
    app.commandLine.appendSwitch('enable-gpu-rasterization')
    app.commandLine.appendSwitch('enable-zero-copy')
    app.commandLine.appendSwitch('ignore-gpu-blocklist')

    // Memory optimizations
    app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048')

    // Smooth scrolling
    app.commandLine.appendSwitch('enable-smooth-scrolling')

    // PDF viewer optimizations
    app.commandLine.appendSwitch('disable-pdf-extension')

    // Background tabs optimization
    app.commandLine.appendSwitch('disable-background-timer-throttling')
    app.commandLine.appendSwitch('disable-renderer-backgrounding')
}

function applyMemoryOptimizations(): void {
    // Reduce memory footprint on Windows
    const totalMemoryGB = os.totalmem() / 1024 / 1024 / 1024

    if (totalMemoryGB < 8) {
        // Low memory system - apply aggressive optimizations
        app.commandLine.appendSwitch('js-flags', '--max-old-space-size=1024')
        app.commandLine.appendSwitch('disable-accelerated-2d-canvas')
        app.commandLine.appendSwitch('disable-gpu-compositing')
        logger.info('Applied low-memory optimizations')
    } else if (totalMemoryGB < 16) {
        // Medium memory - balanced
        app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048')
        logger.info('Applied medium-memory optimizations')
    } else {
        // High memory - enable all features
        app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096')
        logger.info('Applied high-memory optimizations')
    }
}

function setupPowerManagement(): void {
    // Handle power save mode
    powerMonitor.on('on-ac', () => {
        logger.info('Power state: AC - enabling full performance')
        // Restore full performance
    })

    powerMonitor.on('on-battery', () => {
        logger.info('Power state: Battery - reducing performance')
        // Reduce polling intervals
    })

    // Handle system sleep/wake
    powerMonitor.on('suspend', () => {
        logger.info('System suspending - saving state')
    })

    powerMonitor.on('resume', () => {
        logger.info('System resuming - restoring state')
    })
}

function applyNetworkOptimizations(): void {
    // Connection pooling
    app.commandLine.appendSwitch('max-connections-per-proxy', '32')
    app.commandLine.appendSwitch('maxCachedConnections', '16')

    // Faster DNS
    app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess')

    // Disable background network requests
    app.commandLine.appendSwitch('disable-background-networking')
}

export function getWindowsConfig(): WindowsConfig {
    return { ...windowsConfig }
}

export function updateWindowsConfig(updates: Partial<WindowsConfig>): void {
    windowsConfig = { ...windowsConfig, ...updates }
    logger.info('Windows config updated', { config: windowsConfig })
}

export function getSystemInfo(): {
    platform: string
    arch: string
    cpus: number
    totalMemory: number
    freeMemory: number
    uptime: number
    isWindows: boolean
} {
    return {
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
        freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024),
        uptime: os.uptime(),
        isWindows: process.platform === 'win32',
    }
}

export function optimizeForSystem(): void {
    const systemInfo = getSystemInfo()
    
    if (systemInfo.isWindows) {
        initWindowsOptimizations()
    }
}
