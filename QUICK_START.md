# Quick Start - Building & Releasing Lumina Search

## Development Workflow

### 1. Start Development Server

```bash
npm run dev
```

This starts electron-vite in development mode with hot reload. Changes to TypeScript, React, and styles reload automatically.

### 2. Run Tests

```bash
# Run all tests once
npm test

# Watch mode (re-run on file changes)
npm run test:watch
```

### 3. Build for Testing

```bash
# Build all bundles (main, preload, renderer)
npm run build

# Build + run in preview mode (production build)
npm run preview
```

## Release Workflow

### Step 1: Update Version

```bash
# Increment version number
npm version patch      # 1.0.0 → 1.0.1
npm version minor      # 1.0.0 → 1.1.0
npm version major      # 1.0.0 → 2.0.0
```

This auto-commits the version change.

### Step 2: Build Windows Installers

```bash
# Build both NSIS installer + portable EXE
npm run build:win

# Or build specific target
npm run build:win-installer    # Creates .exe installer only
npm run build:win-portable     # Creates portable .exe only
```

**Output:** Release files in `release/` directory:

```text
release/
├── Lumina Search-1.0.1-x64.exe          # Portable executable
├── Lumina Search-SetUp-1.0.1.exe        # NSIS installer
├── Lumina Search-1.0.1-x64.exe.blockmap # Delta update metadata
└── latest.yml                             # Update manifest
```

### Step 3: Test Installer

```bash
# On a clean Windows VM or test machine:
1. Download: Lumina Search-SetUp-1.0.1.exe
2. Run installer
3. Verify shortcuts created:
   - Desktop: "Lumina Search" shortcut
   - Start Menu: "Lumina Search" entry
4. Launch app from shortcut
5. Navigate to Settings → About
6. Verify version shows your new version
```

### Step 4: Create GitHub Release

```bash
# Push version tag (auto-created by npm version)
git push origin v1.0.1

# Create release via GitHub CLI:
gh release create v1.0.1 \
  --title "Lumina Search 1.0.1" \
  --notes "Release notes here" \
  release/Lumina\ Search-SetUp-1.0.1.exe \
  release/Lumina\ Search-1.0.1-x64.exe

# Or manually on GitHub.com:
# 1. Go to Releases → Create new release
# 2. Select tag: v1.0.1
# 3. Upload .exe files
# 4. Publish
```

### Step 5: Monitor Updates

Users will receive notifications to update. Track:

```bash
# Check observability/analytics dashboard for:
- % of users updated
- Any errors during download/install
- Performance impact of new version
```

## Windows Shortcut Management

### Verify Shortcuts (After Installation)

```bash
# Check desktop shortcut
ls "$env:USERPROFILE\Desktop\Lumina*.lnk"

# Check Start Menu shortcut
ls "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Lumina*.lnk"
```

### Create Shortcuts Manually

```bash
# Creates desktop + Start Menu shortcuts
npm run create-shortcuts

# Remove shortcuts
npm run remove-shortcuts
```

### Shortcut Properties

Both shortcuts point to:

- **Target:** `<install-dir>\Lumina Search.exe`
- **Start In:** `<install-dir>`
- **Description:** "Lumina Search - AI-powered local search"
- **Icon:** `<install-dir>\resources\icon.png`

## Auto-Update Testing

### Test Update Check

```bash
# In Renderer DevTools console:
window.electronAPI.invoke('update:check')
  .then(result => console.log('Update check:', result))
```

### Test Update Download

```bash
# Download available updates
window.electronAPI.invoke('update:download')
  .then(result => console.log('Download started:', result))

// Listen for progress
window.electronAPI.on('update:progress', (progress) => {
  console.log(`Progress: ${progress.percent}%`)
})
```

### Test Update Install

```bash
# Install and restart
window.electronAPI.invoke('update:install', {
  relaunchNow: true
})
  .then(result => console.log('Installing:', result))
```

## Troubleshooting

### Build Fails

```bash
# Clean build
rm -r dist out release
npm run build
```

### Tests Fail

```bash
# Reinstall dependencies
rm -r node_modules package-lock.json
npm install --legacy-peer-deps

# Run tests with verbose output
npm test -- --reporter=verbose
```

### Installer Won't Create Shortcuts

```bash
# Verify NSIS config in package.json
npm run build:win-installer

# Check installer log (during install)
# Look for lines like: "Creating shortcut..."

# Manual shortcut creation
npm run create-shortcuts
```

### Updates Not Detected

```bash
# Check network connectivity
curl https://api.github.com

# Verify GitHub releases
https://github.com/KunjShah95/lumina-search/releases

# Check electron-updater logs
# Add to main/index.ts:
// autoUpdater.logger = require('electron-log')
```

## Performance Benchmarks

```text
Build time:        ~3 seconds
Test time:         ~3 seconds
Installer size:    ~180 MB
Portable EXE size: ~175 MB
Main bundle:       ~193 KB
```

## Available Scripts

```bash
npm run dev                 # Start development server
npm run build              # Build bundles
npm run preview            # Build + run preview
npm run electron:build     # Full electron build (old, use build:win)
npm test                   # Run tests
npm run test:watch        # Watch mode tests
npm run build:win         # Build both NSIS + portable
npm run build:win-installer   # Build NSIS installer only
npm run build:win-portable    # Build portable EXE only
npm run create-shortcuts  # Create Windows shortcuts
npm run remove-shortcuts  # Remove Windows shortcuts
```

## Common Tasks

### "I've made changes and want to test before release"

```bash
npm run build          # Build bundles
npm test              # Verify tests pass
npm run preview       # Run built version
```

### "I want to build an installer for testing"

```bash
npm run build:win-installer
# Test: Install from release/Lumina\ Search-SetUp-*.exe
```

### "I'm ready to release a new version"

```bash
npm version minor          # Bump version
npm run build:win          # Build installers
git push origin <version>  # Push to GitHub
# Then create release on GitHub with .exe files
```

### "Users are complaining about missing shortcuts"

```bash
npm run create-shortcuts
# This creates both desktop and Start Menu shortcuts for current user
```

### "I need to check if update system is working"

```bash
# In app, open DevTools (F12)
# In console:
window.electronAPI.invoke('update:check')
window.electronAPI.invoke('update:status')
```

## Notes

- **legacy-peer-deps flag**: Required due to LanceDB/vectordb Apache Arrow conflicts. Safe to use.
- **Installer**: NSIS is non-interactive (user chooses directory). Shortcuts created automatically.
- **Delta updates**: Only work between adjacent versions. First update usually full binary (~180 MB).
- **Code signing**: Optional for production. Configure in package.json `win.certificateFile` if needed.

## Next Release Checklist

- [ ] Run full test suite (`npm test`)
- [ ] Update version (`npm version <major|minor|patch>`)
- [ ] Test in preview mode (`npm run preview`)
- [ ] Build installers (`npm run build:win`)
- [ ] Test installer on clean Windows VM
- [ ] Verify shortcuts created
- [ ] Push version tag (`git push origin vX.X.X`)
- [ ] Create GitHub release
- [ ] Monitor update adoption via observability
- [ ] Check error rates in first 24 hours
