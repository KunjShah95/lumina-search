# GitHub Release Setup Guide for Lumina Search

## 🎯 Overview

This guide walks through creating a professional GitHub release for Lumina Search v1.0.0 with Windows executable.

## 📋 Prerequisites

- ✅ Electron app built and tested
- ✅ Version in `package.json` set to v1.0.0
- ✅ Node.js v18+ and npm installed
- ✅ Git repository initialized and ready
- ✅ GitHub repository created
- ✅ Sufficient disk space for build artifacts (~500MB)

## 🔨 Step 1: Build the Windows Installer

### Option A: Build Both (Installer + Portable)

```bash
cd "c:\perplexity local"
npm run build:win
```

This creates:

- `Lumina Search-1.0.0.exe` - Windows installer (NSIS)
- `Lumina Search-1.0.0-sa.exe` - Standalone portable executable
- `Lumina Search-1.0.0.exe.blockmap` - Delta update metadata

### Option B: Build Only Installer

```bash
npm run build:win-installer
```

Output: `Lumina Search-1.0.0.exe`

### Option C: Build Only Portable (No Installation)

```bash
npm run build:win-portable
```

Output: `Lumina Search-1.0.0-sa.exe` (Standalone)

## ✅ Step 2: Verify Build Artifacts

After building, verify files exist:

```bash
PS> dir "release\" -Filter "*.exe"

Directory: C:\perplexity local\release

Mode                 LastWriteTime         Length Name
----                 -----------           ------ ----
-a---           3/4/2026  10:30 AM    188743456 Lumina Search-1.0.0.exe
-a---           3/4/2026  10:31 AM    188743456 Lumina Search-1.0.0-sa.exe
-a---           3/4/2026  10:32 AM           1234 Lumina Search-1.0.0.exe.blockmap
```

Files should be:

- **Installer**: ~180 MB
- **Portable**: ~180 MB
- **Blockmap**: ~1-3 KB

## 📦 Step 3: Create Checksums (Optional but Recommended)

Generate SHA256 checksums for security verification:

```bash
# PowerShell
Get-FileHash -Path "release\Lumina Search-1.0.0.exe" -Algorithm SHA256 | Format-List

# Result example:
# Algorithm : SHA256
# Hash      : ABC123DEF456...
# Path      : C:\perplexity local\release\Lumina Search-1.0.0.exe
```

Save these hashes for the release notes.

## 🚀 Step 4: Create GitHub Release

### Option A: Using GitHub Web UI

1. Go to [github.com/KunjShah95/lumina-search](https://github.com/KunjShah95/lumina-search)
2. Click **Releases** (right sidebar)
3. Click **Create a new release** or **Draft a new release**
4. Fill in:
   - **Tag version**: `v1.0.0`
   - **Release title**: `Lumina Search v1.0.0 - Production Release`
   - **Description**: (See Release Notes Template below)
5. Upload files:
   - Drag & drop or click **Attach binaries**
   - Select all `.exe` files from `release/`
6. **Publish release** ✅

### Option B: Using GitHub CLI

```bash
# Install GitHub CLI if not already done
# winget install GitHub.cli

# Authenticate
gh auth login

# Create release with assets
gh release create v1.0.0 `
  --title "Lumina Search v1.0.0 - Production Release" `
  --notes-file RELEASE_NOTES.md `
  release/Lumina*Search-1.0.0.exe `
  release/Lumina*Search-1.0.0-sa.exe
```

### Option C: Using Git Tags + Push

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Lumina Search v1.0.0 - Production Release"

# Push to GitHub
git push origin v1.0.0

# Then create release manually on GitHub with uploaded files
```

## 📝 Release Notes Template

Use this text for your GitHub release description:

```markdown
# 🚀 Lumina Search v1.0.0 - Production Release

**The most powerful local AI search tool for Windows.**

## ✨ What's New

### 🎯 Core Features
- **Multi-Provider Web Search**: DuckDuckGo, Tavily, Brave (simultaneous querying)
- **Hybrid RAG System**: Combines BM25 keyword search + Vector embeddings
- **Knowledge Base Management**: Upload PDFs, docs, URLs, and search locally
- **Multi-LLM Support**: OpenAI, Anthropic, Google Gemini, Ollama, LM Studio
- **Real-Time Streaming**: Responses stream token-by-token with citations
- **Privacy First**: All data stored locally, optional cloud LLM usage

### 🔍 Search Capabilities
- **Web Search**: Multi-modal (text, images, videos, academic, code, Reddit)
- **Focus Modes**: General, Academic, Code, Reddit, Business
- **Query Rewriting**: Intelligent decomposition of complex queries
- **Citation Tracking**: Full source attribution and verification
- **Confidence Scoring**: AI-powered answer quality assessment

### 🖥️ Desktop Features
- **System Integration**: System tray, global hotkey, native notifications
- **Thread Management**: Auto-titling, search, pins, favorites, tags
- **Export Options**: Markdown, HTML, JSON formats
- **Dark/Light Theme**: System-aware theme switching
- **Responsive UI**: Full keyboard shortcuts and responsive layout

### 🧠 Advanced AI Features
- **Answer Comparison**: Run same query on multiple LLMs
- **Follow-Up Questions**: AI-generated contextual suggestions
- **Semantic Cache**: 24-hour query result caching
- **Citation Graph**: Network visualization of source relationships
- **Observability**: Langfuse integration for tracing

## 📥 Installation

### Windows 10/11

#### Option 1: Installer (Recommended)
1. Download: `Lumina Search-1.0.0.exe`
2. Run the installer
3. Follow on-screen instructions
4. Creates Start Menu shortcuts & system integration

**File Size**: ~180 MB

#### Option 2: Portable (No Installation)
1. Download: `Lumina Search-1.0.0-sa.exe`
2. Run directly - no installation needed
3. Stores data in the same folder

**File Size**: ~180 MB

## 🔧 System Requirements

- **OS**: Windows 10/11 (x64)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB for app + documents
- **Internet**: Required for web search & cloud LLMs (optional for local-only mode)

## 🎛️ Configuration

### First Launch
1. Open Settings (Ctrl+,)
2. Configure API keys:
   - **LLM**: OpenAI, Anthropic, Google, or local (Ollama/LM Studio)
   - **Search**: Tavily API (optional, uses free DuckDuckGo by default)
   - **Embeddings**: OpenAI key for vector search
3. Create your first Knowledge Base
4. Start searching!

### Popular Configurations

**Privacy-First Local Mode**
- Use DuckDuckGo (free, no API key)
- Use Ollama/LM Studio (local LLM)
- Use local embeddings (offline)
- Result: 100% offline operation

**Cloud-Enhanced Mode**
- Use Tavily for web search
- Use OpenAI GPT-4o for synthesis
- Use cloud embeddings
- Result: Best accuracy & capabilities

## 📊 Architecture Highlights

- **Parallel Agent Orchestration**: Concurrent execution of search, scraping, & LLM synthesis
- **Hybrid Retrieval**: BM25 + Vector search with Reciprocal Rank Fusion (RRF)
- **Stream Processing**: Token-by-token response generation
- **Semantic Caching**: MD5-keyed query result caching with 24h TTL
- **Langfuse Integration**: Production observability & tracing

## 🐛 Known Issues

*(None known in v1.0.0)*

## 📚 Documentation

- Full README: [README.md](https://github.com/KunjShah95/lumina-search)
- Release Guide: [RELEASE_GUIDE.md](https://github.com/KunjShah95/lumina-search/blob/main/RELEASE_GUIDE.md)
- Architecture Docs: [In README](https://github.com/KunjShah95/lumina-search#-architecture)

## 🤝 Contributing

This project is open-source under MIT license. Contributions welcome!

- Report bugs: [GitHub Issues](https://github.com/KunjShah95/lumina-search/issues)
- Suggest features: [GitHub Discussions](https://github.com/KunjShah95/lumina-search/discussions)
- Submit PRs: [GitHub PRs](https://github.com/KunjShah95/lumina-search/pulls)

## 📄 License

MIT License - See [LICENSE](https://github.com/KunjShah95/lumina-search/blob/main/LICENSE)

## 🙏 Credits

Built with:
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Langfuse](https://langfuse.com/)

---

**Download now and bring AI search to your desktop!** 🚀

Questions? Open an issue or start a discussion!
```

## 📋 Step 5: Prepare Release Announcement

### Social Media Announcement

Post on X/Twitter:

```
🚀 LAUNCH: Lumina Search v1.0.0 is LIVE!

The power of Perplexity + NotebookLM in your Windows desktop.

✅ Parallel web search across multiple providers
✅ Personal knowledge base with hybrid RAG
✅ Any LLM: OpenAI, Claude, Gemini, Ollama
✅ 100% privacy-first architecture

Download now: https://github.com/KunjShah95/lumina-search/releases/tag/v1.0.0

#AI #LocalFirst #Privacy #OpenSource
```

### GitHub Announcement

1. Create GitHub Discussion:
   - Category: **Announcements**
   - Title: "Lumina Search v1.0.0 is Live!"
   - Link to release

2. Pin release to repository home

3. Add to GitHub Project (if using)

## ✅ Verification Checklist

Before publishing:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds without errors: `npm run build`
- [ ] `.exe` files exist in `release/` folder
- [ ] File sizes are correct (~180 MB)
- [ ] Git tag created: `git tag v1.0.0`
- [ ] README up-to-date
- [ ] License file included
- [ ] Release notes complete and accurate
- [ ] Social media posts scheduled/ready

## 🔐 Security Notes

- Code is open-source (review before download)
- Installer is not signed (you'll see Windows security warning - this is normal for open-source)
- All data stored locally by default
- No telemetry unless explicitly enabled

## 🎓 Post-Release Activities

1. **Monitor downloads**: Track release download metrics
2. **Gather feedback**: Watch issues & discussions for bugs/requests
3. **Update roadmap**: Plan next features based on feedback
4. **Plan v1.0.1**: Bug fixes + minor improvements
5. **Community engagement**: Respond to issues & PRs promptly

## 📞 Support

Users encountering issues should:

1. Check existing issues
2. Check GitHub Discussions
3. Open new issue with:
   - Windows version
   - Lumina Search version
   - Detailed error message
   - Steps to reproduce

---

**You're ready to release!** 🎉

Next: Run the build command and upload files to GitHub.
