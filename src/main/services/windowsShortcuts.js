/**
 * Windows Shortcuts Setup
 * 
 * This script creates Windows shortcuts for Lumina Search application.
 * Can be run as a post-installation step or standalone.
 */

const { app, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

/**
 * Create desktop shortcut
 */
function createDesktopShortcut() {
    try {
        const desktopPath = path.join(os.homedir(), 'Desktop')
        const appPath = process.execPath
        const iconPath = path.join(process.resourcesPath ?? '', 'icon.png')
        const shortcutPath = path.join(desktopPath, 'Lumina Search.lnk')

        if (!fs.existsSync(desktopPath)) {
            console.warn('Desktop folder not found')
            return false
        }

        // On Windows, we use PowerShell to create shortcuts
        const ps = require('child_process').spawn('powershell.exe', [
            '-Command',
            `
            $WshShell = New-Object -ComObject WScript.Shell
            $Shortcut = $WshShell.CreateShortcut('${shortcutPath}')
            $Shortcut.TargetPath = '${appPath}'
            $Shortcut.WorkingDirectory = '${path.dirname(appPath)}'
            $Shortcut.Description = 'Lumina Search - AI-powered local desktop search'
            if (Test-Path '${iconPath}') {
                $Shortcut.IconLocation = '${iconPath}'
            }
            $Shortcut.Save()
            `
        ])

        ps.on('close', (code) => {
            if (code === 0) {
                console.log('Desktop shortcut created successfully')
                return true
            } else {
                console.error('Failed to create desktop shortcut')
                return false
            }
        })

        return true
    } catch (err) {
        console.error('Error creating desktop shortcut:', err)
        return false
    }
}

/**
 * Create Start Menu shortcut
 */
function createStartMenuShortcut() {
    try {
        const startMenuPath = path.join(
            os.getenv('APPDATA') ?? '',
            'Microsoft\\Windows\\Start Menu\\Programs'
        )
        const appPath = process.execPath
        const iconPath = path.join(process.resourcesPath ?? '', 'icon.png')
        const shortcutPath = path.join(startMenuPath, 'Lumina Search.lnk')

        if (!fs.existsSync(startMenuPath)) {
            console.warn('Start Menu folder not found')
            return false
        }

        // On Windows, we use PowerShell to create shortcuts
        const ps = require('child_process').spawn('powershell.exe', [
            '-Command',
            `
            $WshShell = New-Object -ComObject WScript.Shell
            $Shortcut = $WshShell.CreateShortcut('${shortcutPath}')
            $Shortcut.TargetPath = '${appPath}'
            $Shortcut.WorkingDirectory = '${path.dirname(appPath)}'
            $Shortcut.Description = 'Lumina Search - AI-powered local desktop search'
            if (Test-Path '${iconPath}') {
                $Shortcut.IconLocation = '${iconPath}'
            }
            $Shortcut.Save()
            `
        ])

        ps.on('close', (code) => {
            if (code === 0) {
                console.log('Start Menu shortcut created successfully')
                return true
            } else {
                console.error('Failed to create Start Menu shortcut')
                return false
            }
        })

        return true
    } catch (err) {
        console.error('Error creating Start Menu shortcut:', err)
        return false
    }
}

/**
 * Remove shortcuts
 */
function removeShortcuts() {
    try {
        const desktopPath = path.join(os.homedir(), 'Desktop', 'Lumina Search.lnk')
        const startMenuPath = path.join(
            os.getenv('APPDATA') ?? '',
            'Microsoft\\Windows\\Start Menu\\Programs\\Lumina Search.lnk'
        )

        if (fs.existsSync(desktopPath)) {
            fs.unlinkSync(desktopPath)
            console.log('Desktop shortcut removed')
        }

        if (fs.existsSync(startMenuPath)) {
            fs.unlinkSync(startMenuPath)
            console.log('Start Menu shortcut removed')
        }

        return true
    } catch (err) {
        console.error('Error removing shortcuts:', err)
        return false
    }
}

/**
 * Setup shortcuts (creates them)
 */
function setupShortcuts() {
    console.log('Setting up Windows shortcuts...')
    const desktopOk = createDesktopShortcut()
    const startMenuOk = createStartMenuShortcut()
    
    if (desktopOk && startMenuOk) {
        console.log('All shortcuts created successfully')
        return true
    } else {
        console.warn('Some shortcuts may have failed to create')
        return false
    }
}

module.exports = {
    createDesktopShortcut,
    createStartMenuShortcut,
    removeShortcuts,
    setupShortcuts,
}

// If run directly
if (require.main === module) {
    const action = process.argv[2]
    
    if (action === 'remove') {
        removeShortcuts()
    } else {
        setupShortcuts()
    }
}
