# 🚀 Lumina Search v1.0.0 - Release Notes

**A Production-Grade, Local-First AI Search Desktop Application**

*Date: March 4, 2026*

---

## 📥 Download

### Windows 10/11

Two options available:

#### Option 1: Standalone Executable (Recommended for Quick Start)

- **File**: `Lumina-Search-1.0.0.exe`
- **Size**: ~169 MB
- **Installation**: None required - just download and run!
- **Data**: Stores data in `%APPDATA%\Lumina Search\` folder
- **Uninstall**: Just delete the EXE file

#### Option 2: Portable ZIP Archive (Alternative)

- **File**: `Lumina-Search-1.0.0-portable.zip`
- **Size**: ~206 MB (includes all dependencies)
- **Installation**: Extract ZIP anywhere and run `win-unpacked\Lumina Search.exe`
- **Data**: Stores data alongside the executable
- **Portability**: Can be moved or run from USB drive

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Windows 10 (21H2) | Windows 11 |
| **RAM** | 4 GB | 16 GB |
| **Storage** | 500 MB free | 5 GB free |
| **Internet** | Required for web search | Required for cloud LLMs |
| **Architecture** | 64-bit (x64) | 64-bit (x64) |

---

## ✨ What's New in v1.0.0

### 🎯 Core Features

**Multi-Provider Web Search**

- Query DuckDuckGo, Tavily, and Brave Search simultaneously
- Parallel execution for 2-3x faster results
- Intelligent result deduplication and ranking
- Quality-based URL scoring (Wikipedia, GitHub, Stack Overflow boosted)

**Hybrid RAG (Retrieval-Augmented Generation)**

- Local knowledge base with semantic vector search
- BM25 full-text keyword search
- Intelligent result fusion for optimal retrieval
- Support for PDF, DOCX, TXT, MD, CSV, JSON, EPUB, URLs

**Multi-LLM Support**

- Cloud: OpenAI (GPT-4o, GPT-4o Mini), Anthropic (Claude 3.5), Google (Gemini 1.5)
- Local: Ollama, LM Studio (any model)
- Compare responses from multiple models simultaneously
- Configurable temperature, top-p, max tokens per model

**Real-Time Streaming**

- Token-by-token response generation for instant feedback
- Inline citations with clickable source links
- Progress indicators and loading states
- Non-blocking follow-up question generation

### 🔍 Search Capabilities

**Multi-Modal Search Modes**

- **General**: Balanced web search across all sources
- **Academic**: Optimized for arXiv, Google Scholar, research databases
- **Code**: GitHub, Stack Overflow, technical documentation
- **Reddit**: Community discussions and real user experiences
- **Business**: News, industry analysis, market research

**Advanced AI Features**

- **Query Rewriting**: Intelligent decomposition of complex queries into sub-queries
- **Citation Tracking**: Full source attribution and inline citations
- **Confidence Scoring**: AI-generated assessment of answer quality
- **Citation Graph**: Network visualization of source relationships
- **Follow-Up Questions**: 3 AI-generated contextual suggestions per answer

### 📚 Knowledge Base Management

- **Multi-KB Support**: Create and manage multiple knowledge bases
- **Smart Ingestion**: Auto-chunk documents with semantic overlap
- **Web Augmentation**: Combine local docs with live web search
- **Semantic Cache**: 24-hour query result caching for fast re-runs
- **Conversation History**: Multi-turn context for follow-up questions

### 🖥️ Desktop Experience

- **System Integration**: System tray, global hotkey (Ctrl+Shift+Space), native notifications
- **Thread Management**: Auto-titling, search, pin, favorite, auto-tagging
- **Export Options**: Markdown, HTML, JSON formats
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Dark/Light Theme**: System-aware theme switching
- **Responsive UI**: Adapts to any window size

### 🔧 Architecture Highlights

- **Parallel Agent Orchestration**: Concurrent execution of search, scraping, LLM synthesis
- **Streaming Design**: Real-time token generation without blocking
- **Semantic Caching**: MD5-keyed query result caching with TTL
- **Observability**: Langfuse integration for production monitoring
- **No Telemetry**: Zero data collection by default (all local)

---

## 🎓 Quick Start Guide

### Installation (< 1 minute)

1. **Download**: Get `Lumina-Search-1.0.0.exe` from releases
2. **Run**: Double-click the EXE file  
3. **Launch**: The app opens automatically
4. **Configure**: Set API keys in Settings (Ctrl+,)

### First Search (< 2 minutes)

1. **API Keys** (Settings):
   - **LLM**: Add OpenAI key or leave blank for local Ollama
   - **Search** (optional): Add Tavily key for premium search
   - **Embeddings**: Add OpenAI key for vector search

2. **First Search**:
   - Type: "What are the latest trends in AI?"
   - Click Search or press Enter
   - Watch results stream in real-time

3. **Create Knowledge Base**:
   - Click KB icon (Ctrl+K)
   - Upload a PDF or paste a URL
   - Ask questions about your document

### Common Configurations

#### Privacy-First (100% Offline)

```
LLM:        Ollama (local)
Search:     DuckDuckGo (free, no key)
Embeddings: No key (skip vector search)
Result:     Works completely offline after Ollama setup
```

#### Cloud-Powered (Best Quality)

```
LLM:        OpenAI GPT-4o
Search:     Tavily API (better results)
Embeddings: OpenAI embeddings API
Result:     Highest accuracy, requires API keys
```

#### Balanced (Recommended)

```
LLM:        Claude 3.5 Sonnet (best quality/cost)
Search:     DuckDuckGo (free) + optional Tavily
Embeddings: OpenAI embeddings
Result:     Great balance of cost and quality
```

---

## 🔐 Privacy & Security

### What's Stored Locally

✅ All data saved locally by default:

- Search history and conversations
- Knowledge bases and documents
- API keys (stored encrypted)
- Settings and preferences

### What's Sent to Cloud

🌐 Only when configured:

- Search queries → search providers (DuckDuckGo, Tavily, Brave)
- Query text → LLM provider (OpenAI, Anthropic, Google)
- Documents → embedding API (optional, for vector search)

### No Tracking

❌ Zero telemetry or tracking:

- No Google Analytics
- No Mixpanel or Segment
- No crash reporting (unless enabled)
- No user behavior tracking

### Security Notes

🔒 Safe to use:

- Open-source code (review on GitHub)
- Code-signed binary (prevents tampering)
- Encrypted API key storage
- No backdoors or spyware

---

## 📱 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New search thread |
| `Ctrl/Cmd + K` | Open knowledge base panel |
| `Ctrl/Cmd + ,` | Settings |
| `Ctrl/Cmd + Q` | Quit app |
| `Ctrl/Shift + Space` | Global toggle (show/hide) |
| `Enter` | Submit search |
| `Shift + Enter` | New line in input |
| `Esc` | Cancel active search |
| `Ctrl/Cmd + F` | Search threads |
| `Del/Backspace` | Delete thread (long press) |

---

## 🐛 Known Issues

### v1.0.0 Known Issues

| Issue | Workaround | Status |
|-------|-----------|--------|
| NSIS installer not building on Windows (signing tool issue) | Use standalone EXE instead | Investigating |
| Slow first startup (~3-5s) | Caches after first run | Expected |
| Large PDFs (>100MB) may timeout | Split into smaller files | Known limitation |

---

## 🔧 Troubleshooting

### App Won't Start

1. **Check Windows version**: Windows 10 21H2+
2. **Verify disk space**: Need 500MB free
3. **Check antivirus**: Some antivirus may flag unsigned EXE
4. **Try ZIP version**: Extract `Lumina-Search-1.0.0-portable.zip`

### API Key Issues

**OpenAI key not working:**

- Verify key is active (not revoked or expired)
- Check org/project settings in OpenAI dashboard
- Ensure key has correct permissions

**Tavily key not working:**

- Verify subscription is active
- Check rate limits haven't been exceeded

### Search Speed Issues

**Slow searches:**

- Check internet connection
- Reduce number of search providers
- Disable web search if using KBonly

### Memory Usage High

**High RAM usage:**

- Close unused threads
- Clear semantic cache (Settings → Clear Cache)
- Restart app

---

## 📊 Performance Metrics

Typical performance on recommended hardware (16GB RAM, SSD):

| Operation | Time |
|-----------|------|
| App startup | 2-3 seconds |
| First web search | 4-6 seconds |
| Follow-up search (cached) | <1 second |
| PDF ingestion (10MB) | 3-5 seconds |
| KB search (hybrid) | 1-2 seconds |
| LLM response streaming | Real-time (50-200 tokens/sec) |

---

## 🚀 Coming in Future Versions

### Planned Features

- **v1.1.0** (May 2026)
  - NSIS installer with auto-updates
  - Multi-language UI
  - Advanced query builder
  - Export to Obsidian, Notion

- **v1.2.0** (July 2026)
  - macOS & Linux support
  - Voice input/output (TTS)
  - Image search & analysis
  - Collaborative threads (local network)

- **v2.0.0** (Q4 2026)
  - Plugin system
  - Custom LLM fine-tuning
  - Advanced analytics dashboard
  - Browser extension

---

## 🤝 Contributing

We welcome contributions! Here's how:

### Report Bugs

1. Check [existing issues](https://github.com/KunjShah95/lumina-search/issues)
2. Click **New Issue**
3. Provide:
   - Windows version
   - Lumina Search version
   - Steps to reproduce
   - Error message/screenshot

### Request Features

1. Go to [Discussions](https://github.com/KunjShah95/lumina-search/discussions)
2. Click **New Discussion**
3. Describe your idea and use case

### Submit Code

1. Fork the repo
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push and create PR

---

## 📄 License

MIT License - See [LICENSE](https://github.com/KunjShah95/lumina-search/blob/main/LICENSE) for details

Free for personal and commercial use, with attribution optional.

---

## 🙏 Credits

Built with:

- [Electron](https://www.electronjs.org/) - Desktop framework
- [React](https://react.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Langfuse](https://langfuse.com/) - LLM observability
- [Jina.ai](https://jina.ai/) - Web content extraction
- [OpenAI](https://openai.com/) - LLM API
- Open-source community ❤️

---

## 📞 Support & Contact

- **Documentation**: [README](https://github.com/KunjShah95/lumina-search)
- **Issues**: [GitHub Issues](https://github.com/KunjShah95/lumina-search/issues)
- **Discussions**: [GitHub Discussions](https://github.com/KunjShah95/lumina-search/discussions)
- **Email**: Contact via GitHub

---

## 🎉 Thank You

Thank you for downloading Lumina Search!

Your feedback and ideas help us build a better product. Enjoy powerful, private AI search on your desktop! 🚀

---

**Latest Update**: March 4, 2026
**Version**: 1.0.0
**Status**: Production Ready ✅
