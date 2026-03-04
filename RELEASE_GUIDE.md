# Lumina Search - Release & Deployment Guide

## Overview

This guide covers building, testing, and releasing Lumina Search with automatic updates and Windows shortcuts.

## Prerequisites

- **Node.js**: v18+ with npm
- **Windows SDK**: For NSIS installer generation
- **Git**: For version control
- **GitHub**: For release hosting and updater endpoint

## Build & Release Workflow

### 1. Development Build

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start dev server with live reload
npm run dev

# Run tests
npm test

# Build for development
npm run build
```

**Output:**

- Main bundle: `dist/main.js` (~193 KB)
- Preload bundle: `dist/preload.js` (~7 KB)
- Renderer bundles: `dist/index.html` + assets (~1 MB)

### 2. Pre-Release Testing

```bash
# Run full test suite
npm test                           # Must pass 100%

# Build artifacts
npm run build                      # Zero errors required

# Optional: Type checking
npx tsc --noEmit                   # Verify types

# Optional: Linting
npm run lint                       # Code quality check
```

**Acceptance Criteria:**

- ✅ 86/86 tests passing
- ✅ Build completes in <5 seconds
- ✅ No TypeScript errors
- ✅ Main bundle <200 KB

### 3. Creating a Release

#### 3a. Update Version

```bash
# Update package.json version (semantic versioning)
# Example: 0.1.0 → 0.1.1 (patch), 0.1.0 → 0.2.0 (minor), 0.1.0 → 1.0.0 (major)

npm version patch          # Auto-commits + tags
# or
npm version minor
# or
npm version major
```

#### 3b. Build Installers

```bash
npm run build:win          # Build Windows installer + portable EXE
# OR (for all platforms)
npm run build              # Uses electron-builder config from package.json
```

**Output Files** (in `release/` directory):

```text
release/
├── Lumina Search {version}-sa.exe    # Standalone portable executable
├── Lumina Search {version}.exe       # NSIS installer (recommended)
├── Lumina Search {version}.exe.blockmap  # Delta update metadata
└── latest.yml              # Update manifest (for electron-updater)
```

**File Details:**

| File | Purpose | Size | Delivery |
| ---- | ------- | ---- | -------- |
| `.exe` (installer) | Standard Windows installer, creates shortcuts | ~180 MB | Primary |
| `-sa.exe` (portable) | Standalone, no installation required | ~180 MB | Alternative |
| `.blockmap` | Delta update metadata, ~1-2 KB | ~2 KB | Auto-downloaded |
| `latest.yml` | Update manifest with hashes + version info | ~1 KB | Served by GitHub |

### 4. Publishing Release

#### 4a. GitHub Release

```bash
# Create GitHub release tag
git push origin v0.1.1               # Push version tag

# Create GitHub Release manually or via GitHub CLI:
gh release create v0.1.1 \
  --title "Lumina Search 0.1.1" \
  --notes "Feature: Auto-update support. Fix: Windows shortcuts" \
  --prerelease=false \
  release/Lumina\ Search\ 0.1.1.exe \
  release/Lumina\ Search\ 0.1.1-sa.exe
```

#### 4b. Configure electron-updater

The auto-updater looks for releases at:

```url
https://github.com/{owner}/{repo}/releases/download/v{version}/{filename}
```

Example:

```url
https://github.com/KunjShah95/perplexity-local/releases/download/v0.1.1/Lumina%20Search%200.1.1.exe.blockmap
```

**Electron-updater Configuration** (in `package.json`):

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "KunjShah95",
      "repo": "perplexity-local"
    },
    "files": [
      "dist/**/*",
      "package.json"
    ]
  }
}
```

### 5. Staged Rollout

Gradually release to users to catch issues early:

```bash
# Release to 10% of user base first
npm run publish:staged -- --percentage=10

# Monitor for errors via Observability dashboard
# If stable, increase percentage
npm run publish:staged -- --percentage=50

# Full release
npm run publish:staged -- --percentage=100
```

Or manually via GitHub Release metadata:

```json
{
  "stagingPercentage": 10
}
```

## Installation Flow

### First-Time User

1. Download `Lumina Search 0.1.1.exe` from GitHub Releases
2. Run installer
3. Select installation directory (can customize)
4. ✅ Desktop shortcut created automatically
5. ✅ Start Menu entry created automatically
6. Launch via shortcut or Start Menu

**Installer Features:**

- Per-user installation (no admin required)
- Customizable installation directory
- Auto-creates Windows shortcuts
- Auto-download enabled for updates
- Delta patching for smaller downloads

### Subsequent Updates

**Automatic:**

1. App checks for updates on startup
2. If available, shows notification
3. User chooses "Download Later" or "Download Now"
4. Downloads delta patch (background, non-blocking)
5. Shows installation prompt
6. Installs on next app restart (or manual restart)

**Manual Check:**

1. User opens "Settings → Check for Updates"
2. App queries GitHub releases
3. If available, follows automatic flow
4. If up-to-date, shows confirmation message

## Windows Shortcuts

### Automatic Creation (via NSIS Installer)

The NSIS installer automatically creates shortcuts:

```nsis
createDesktopShortcut: true      # Desktop shortcut
createStartMenuShortcut: true    # Start Menu entry
shortcutName: "Lumina Search"
```

**Desktop Shortcut:**

- Location: `%USERPROFILE%\Desktop\Lumina Search.lnk`
- Target: Application executable
- Working Directory: Installation directory
- Icon: `icon.png` from resources

**Start Menu Shortcut:**

- Location: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Lumina Search.lnk`
- Properties: Same as desktop shortcut

### Manual Shortcut Creation

```bash
# Run directly via Node.js
npm run create-shortcuts

# Or from PowerShell (admin not required)
npm run script -- src/main/services/windowsShortcuts.js
```

### Shortcut Properties

**Target Path:**

```cmd
C:\Program Files\Lumina Search\Lumina Search.exe
```

**Working Directory:**

```cmd
C:\Program Files\Lumina Search
```

**Icon:**

```cmd
C:\Program Files\Lumina Search\resources\icon.png
```

**Shortcut Arguments:** (none)

## Update Mechanism

### How electron-updater Works

1. **Check Phase** (on startup + hourly background):
   - Queries GitHub releases API
   - Downloads `latest.yml` manifest
   - Compares versions

2. **Download Phase** (user-initiated):
   - Checks `.blockmap` for delta updates
   - If available, downloads only changed blocks (60-80% smaller)
   - Falls back to full binary if delta unavailable
   - Saves patch to `%TEMP%\Lumina Search Updates`

3. **Install Phase** (user-initiated):
   - Validates patch checksum (SHA-256)
   - Applies patch to application
   - Creates backup of current version
   - Restarts application (or defers)

4. **Rollback** (if install fails):
   - Restores backup version
   - Logs error for debugging

### Configuration

**Automatic Updates** (`package.json`):

```json
{
  "build": {
    "win": {
      "target": ["nsis", "portable"]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Lumina Search",
      "installerIcon": "resources/icon.ico",
      "uninstallerIcon": "resources/icon.ico",
      "installerHeaderIcon": "resources/icon.ico"
    }
  }
}
```

**Update Check Intervals** (`src/main/services/autoUpdater.ts`):

```typescript
// On startup (non-blocking)
autoUpdater.checkForUpdates()

// Hourly background check (optional)
setInterval(() => {
  autoUpdater.checkForUpdates()
}, 60 * 60 * 1000)
```

## IPC Endpoints

The renderer process communicates with auto-updater via IPC:

### `update:check`

Check for updates immediately.

**Request:**

```typescript
window.electronAPI.invoke('update:check')
```

**Response:**

```typescript
{
  hasUpdate: true,
  currentVersion: "0.1.0",
  latestVersion: "0.1.1"
}
```

### `update:download`

Download available update (if update detected).

**Request:**

```typescript
window.electronAPI.invoke('update:download')
```

**Response:**

```typescript
true  // Download started
```

**Progress Callback:**

```typescript
window.electronAPI.on('update:progress', (progress) => {
  console.log(`Downloaded ${progress.percent}%`)
})
```

### `update:install`

Install downloaded update.

**Request:**

```typescript
window.electronAPI.invoke('update:install', {
  relaunchNow: true  // Auto-restart or defer
})
```

**Response:**

```typescript
{
  installed: true,
  willRelaunch: true
}
```

### `update:cancel`

Cancel ongoing download.

**Request:**

```typescript
window.electronAPI.invoke('update:cancel')
```

**Response:**

```typescript
true  // Cancelled
```

### `update:status`

Get current update status.

**Request:**

```typescript
window.electronAPI.invoke('update:status')
```

**Response:**

```typescript
{
  hasUpdate: true,
  downloadPercent: 45,
  status: 'downloading'
}
```

## Troubleshooting

### Issue: Update Check Fails

**Symptoms:** Notification says "Failed to check for updates"

**Solutions:**

```typescript
// 1. Check network connectivity
fetch('https://api.github.com')
  .then(() => console.log('Network OK'))
  .catch(() => console.log('No internet'))

// 2. Verify GitHub releases API
https://api.github.com/repos/{owner}/{repo}/releases/latest

// 3. Check firewall/proxy settings
// May need to configure electron-updater proxy:
autoUpdater.httpRequest('GET', url, { 
  headers: {
    'User-Agent': 'electron-updater'
  }
})
```

### Issue: Shortcut Not Created

**Symptoms:** Desktop/Start Menu shortcut missing after installation

**Manual Fix:**

```powershell
# Run as regular user (no admin)
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Lumina Search.lnk")
$Shortcut.TargetPath = "C:\Program Files\Lumina Search\Lumina Search.exe"
$Shortcut.Description = "AI-powered local search"
$Shortcut.Save()
```

### Issue: Delta Update Not Applied

**Symptoms:** Download shows "Full binary update" instead of delta

**Causes:**

1. `.blockmap` file missing from release
2. Previous version too old (delta only works between adjacent versions)
3. Binary changed too much

**Solution:**

```bash
# Ensure .blockmap is in release/
ls -la release/*.blockmap

# Full update works fine, just slower
# Usually only first update is full, subsequent are deltas
```

### Issue: App Won't Restart After Update

**Symptoms:** Installation completes but app doesn't restart

**Solutions:**

```typescript
// Force restart via IPC
window.electronAPI.invoke('update:install', {
  relaunchNow: true  // Must be true
})

// Or manual restart in main process
app.relaunch()
app.exit(0)
```

## Performance Metrics

### Build Size

```text
Main bundle:     193.57 KB (+8.79 KB auto-updater)
Preload bundle:  7.43 KB
Renderer bundle: 1,070.67 KB
Installer:       ~180 MB (with Electron)
Portable EXE:    ~175 MB
```

### Update Download Sizes

| Scenario | Size | Time | Type |
| -------- | ---- | ---- | ---- |
| First Update | ~180 MB | 2-5 min | Full binary |
| Subsequent (delta) | 5-20 MB | 10-30 sec | Delta patch |
| Security patch | 1-5 MB | 3-10 sec | Delta patch |
| Hotfix | 500 KB - 2 MB | 1-5 sec | Delta patch |

### Startup Performance

```text
App launch (no update): 2-3 seconds
Update check (background): 100-500 ms (non-blocking)
Update download: 10-30 seconds per MB (depends on network)
Update install: 5-30 seconds (depends on app size)
```

## Security Considerations

### Code Signing (Optional)

For production releases, sign binaries:

```bash
# Install Windows signing certificate
# Then configure in package.json:
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "password"
    }
  }
}

# Build will auto-sign binaries
npm run build:win
```

### Update Validation

electron-updater automatically validates:

- ✅ SHA-256 checksum of download
- ✅ Release file permissions
- ✅ Staged rollout percentage
- ✅ Version number integrity

### User Data Protection

Installation safety:

- ✅ Backup current version before install
- ✅ `deleteAppDataOnUninstall: false` (preserve user data)
- ✅ Non-destructive update process
- ✅ Automatic rollback on failure

## Monitoring & Analytics

### Track Update Success Rate

```typescript
// In update:install handler
ipcMain.handle('update:install', async (event, { relaunchNow }) => {
  try {
    await autoUpdater.quitAndInstall()
    analytics.track('update:installed', {
      version: app.getVersion(),
      timestamp: Date.now(),
    })
  } catch (err) {
    analytics.track('update:failed', {
      error: err.message,
      version: app.getVersion(),
    })
  }
})
```

### Monitor Staged Rollout

```typescript
// Track adoption by version
analytics.track('app:version', {
  version: app.getVersion(),
  update_staged_percentage: stagingPercentage,
})
```

## Next Steps

1. **Build installer:** `npm run build:win`
2. **Test on clean Windows VM:** Install + verify shortcuts + check updates
3. **Create GitHub release:** Upload `.exe` files
4. **Monitor for issues:** Check observability dashboard
5. **Next release:** Repeat process with new version

## Resources

- [electron-updater docs](https://www.electron.build/auto-update)
- [Electron security best practices](https://www.electronjs.org/docs/tutorial/security)
- [NSIS installer docs](https://nsis.sourceforge.io/Main_Page)
- [Windows shortcut properties](https://learn.microsoft.com/en-us/windows/win32/shell/links)
