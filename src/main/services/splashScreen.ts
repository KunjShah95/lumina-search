/**
 * Splash Screen Service
 * 
 * Manages a splash screen window during app startup.
 * Shows progress updates as initialization tasks complete.
 */

import { BrowserWindow, app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

export class SplashScreen {
    private splashWindow: BrowserWindow | null = null

    /**
     * Create and show splash screen
     */
    async create(): Promise<void> {
        this.splashWindow = new BrowserWindow({
            width: 600,
            height: 400,
            minWidth: 400,
            minHeight: 300,
            show: false,
            frame: false,
            alwaysOnTop: true,
            center: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: false,
                sandbox: false,
            },
        })

        const splashHtml = this.getSplashHtml()
        this.splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)

        this.splashWindow.once('ready-to-show', () => {
            this.splashWindow?.show()
        })

        this.splashWindow.on('closed', () => {
            this.splashWindow = null
        })
    }

    /**
     * Update splash screen with progress
     */
    updateProgress(message: string, progress: number): void {
        if (!this.splashWindow || this.splashWindow.isDestroyed()) {
            return
        }

        const clampedProgress = Math.max(0, Math.min(100, progress))
        try {
            this.splashWindow.webContents.executeJavaScript(`
                updateProgress('${message.replace(/'/g, "\\'")}', ${clampedProgress})
            `)
        } catch (err) {
            // Splash window may be closed
        }
    }

    /**
     * Close splash screen
     */
    async close(): Promise<void> {
        if (this.splashWindow && !this.splashWindow.isDestroyed()) {
            // Fade out effect
            for (let i = 1; i >= 0; i -= 0.1) {
                this.splashWindow.setOpacity(i)
                await new Promise((resolve) => setTimeout(resolve, 30))
            }
            this.splashWindow.close()
        }
        this.splashWindow = null
    }

    /**
     * Get splash screen HTML content
     */
    private getSplashHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #0f0f11 0%, #1a1a1e 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #ffffff;
        }
        
        .splash-container {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 30px;
        }
        
        .logo {
            font-size: 48px;
            font-weight: 700;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .title {
            font-size: 24px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }
        
        .progress-container {
            width: 280px;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .progress-bar {
            width: 100%;
            height: 3px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
            width: 0%;
            transition: width 0.3s ease;
            box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
        }
        
        .progress-text {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.6);
            font-weight: 500;
            letter-spacing: 0.5px;
        }
        
        .progress-percentage {
            font-size: 13px;
            color: #8b5cf6;
            font-weight: 600;
        }
        
        .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid rgba(139, 92, 246, 0.2);
            border-top: 2px solid #8b5cf6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 10px auto;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .footer {
            position: absolute;
            bottom: 20px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.4);
        }
    </style>
</head>
<body>
    <div class="splash-container">
        <div class="logo">✨ Lumina</div>
        <div class="title">Search & Discover</div>
        <div class="spinner"></div>
        
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="progress-text" id="progressMessage">Initializing...</div>
                <div class="progress-percentage" id="progressPercent">0%</div>
            </div>
        </div>
    </div>
    
    <div class="footer">Powered by local AI • No data sent to cloud</div>
    
    <script>
        function updateProgress(message, progress) {
            document.getElementById('progressFill').style.width = progress + '%';
            document.getElementById('progressMessage').textContent = message;
            document.getElementById('progressPercent').textContent = progress + '%';
        }
    </script>
</body>
</html>`
    }
}

// Singleton instance
let splashScreenInstance: SplashScreen | null = null

/**
 * Get or create splash screen instance
 */
export function getSplashScreen(): SplashScreen {
    if (!splashScreenInstance) {
        splashScreenInstance = new SplashScreen()
    }
    return splashScreenInstance
}

/**
 * Reset splash screen (for testing)
 */
export function resetSplashScreen(): void {
    splashScreenInstance = null
}
