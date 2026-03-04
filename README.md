# Perplexity Local - Comprehensive Documentation

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

**A Production-Grade, Local-First AI Search Desktop Application**

*Inspired by Perplexity AI with Advanced RAG Capabilities Similar to NotebookLM*

[Features](#-features) • [Architecture](#-architecture) • [Installation](#-installation) • [Usage](#-usage) • [Development](#-development) • [API Reference](#-api-reference)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [The 5 W's and H](#-the-5-ws-and-h)
- [Features](#-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage Guide](#-usage-guide)
- [Knowledge Base (RAG)](#-knowledge-base-rag)
- [Agent System](#-agent-system)
- [API Reference](#-api-reference)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🎯 Overview

**Perplexity Local** is a sophisticated desktop application that brings the power of AI-driven search and knowledge management to your local machine. It combines web search, document analysis, and large language models (LLMs) to provide intelligent, cited answers to your queries—all while maintaining privacy and control over your data.

### Key Differentiators

- **🔒 Privacy-First**: All data stored locally, optional cloud LLM usage
- **🧠 Hybrid RAG**: Combines BM25 keyword search with semantic vector search
- **⚡ Parallel Agent Architecture**: Concurrent search across multiple providers
- **🎨 Multi-Modal Search**: Web, images, videos, academic papers, and code
- **📚 Knowledge Bases**: Create custom document collections with semantic search
- **🔄 Streaming Responses**: Real-time token streaming for instant feedback
- **🌐 Multi-Provider Support**: DuckDuckGo, Tavily, Brave Search
- **🤖 Multi-LLM Support**: OpenAI, Anthropic, Google Gemini, Ollama, LM Studio

---

## 🔍 The 5 W's and H

### **WHO** is this for?

- **Researchers** who need cited, accurate information from multiple sources
- **Developers** seeking code examples and technical documentation
- **Students** conducting academic research with scholarly sources
- **Knowledge Workers** building personal knowledge bases
- **Privacy-Conscious Users** who want local-first AI tools
- **Power Users** who need advanced search capabilities beyond Google

### **WHAT** does it do?

Perplexity Local is an AI-powered search and knowledge management system that:

1. **Searches** multiple web sources simultaneously (DuckDuckGo, Tavily, Brave)
2. **Scrapes** and extracts full content from top results
3. **Synthesizes** information using advanced LLMs with proper citations
4. **Manages** personal knowledge bases with RAG (Retrieval Augmented Generation)
5. **Streams** responses in real-time with source attribution
6. **Organizes** conversation history with search, tags, and favorites
7. **Exports** threads as Markdown, HTML, or clipboard content

### **WHEN** should you use it?

- When you need **cited, verifiable answers** instead of hallucinated responses
- When conducting **research** that requires multiple source verification
- When building a **personal knowledge base** from documents and URLs
- When you want **privacy** and don't want queries sent to cloud services
- When you need **multi-modal search** (text, images, videos, academic papers)
- When you want to **compare answers** from multiple AI models simultaneously

### **WHERE** does it run?

- **Desktop Application**: Windows 10/11, macOS, Linux
- **Local Storage**: All data stored in user's AppData/Application Support
- **Network**: Internet required for web search and cloud LLMs (optional)
- **Local LLMs**: Supports Ollama and LM Studio for offline operation

### **WHY** was it built?

**Problem Statement:**

- Traditional search engines provide links, not answers
- AI chatbots hallucinate without source verification
- Cloud-based AI tools compromise privacy
- Existing RAG solutions lack production-grade features
- No unified tool for search + knowledge management

**Solution:**
Perplexity Local combines the best of:

- **Perplexity AI**: Cited, synthesized answers from web sources
- **NotebookLM**: Personal knowledge base with RAG capabilities
- **Local-First Software**: Privacy, control, and offline capability

### **HOW** does it work?

**High-Level Flow:**

```
User Query → Agent Orchestrator → Parallel Execution
                                        ↓
                    ┌──────────────────┼──────────────────┐
                    ↓                  ↓                  ↓
              Search Agents      Scraper Agents    RAG Retrieval
              (Multi-Provider)   (Top 3 URLs)      (Vector + BM25)
                    ↓                  ↓                  ↓
                    └──────────────────┼──────────────────┘
                                       ↓
                            Context Builder Agent
                                       ↓
                            LLM Synthesis Agent
                                       ↓
                          Streaming Response with Citations
```

**Technical Architecture:**

1. **Query Processing**: Optional query rewriting for complex questions
2. **Parallel Search**: Concurrent requests to multiple search providers
3. **Result Merging**: Deduplication, scoring, and ranking
4. **Content Extraction**: Parallel scraping of top URLs using Jina.ai Reader
5. **Context Building**: Structured prompt with sources and citations
6. **LLM Synthesis**: Streaming token generation with inline citations
7. **Follow-Up Generation**: AI-generated related questions
8. **Persistence**: Thread saved to local JSON database

---

## ✨ Features

### 🔍 **AI-Powered Multi-Modal Search**

#### Web Search

- **Providers**: DuckDuckGo (free), Tavily (advanced), Brave Search
- **Parallel Execution**: Query all providers simultaneously
- **Smart Ranking**: Quality-based scoring (Wikipedia, GitHub, Stack Overflow boosted)
- **Deduplication**: Intelligent URL normalization and merging
- **Full-Text Extraction**: Scrapes top 3 results for comprehensive context

#### Image Search

- **Sources**: DuckDuckGo Images, Brave Image Search
- **Features**: Thumbnail previews, source attribution, click-to-open
- **Filtering**: Domain-based filtering and relevance scoring

#### Video Search

- **Sources**: YouTube, Vimeo, DuckDuckGo Video
- **Metadata**: Duration, views, channel information
- **Thumbnails**: High-quality preview images

#### Academic Search

- **Focus Mode**: Optimized for scholarly content
- **Sources**: arXiv, Google Scholar, academic databases
- **Citation Style**: Formal, research-oriented responses

#### Code Search

- **Focus Mode**: Developer-centric results
- **Sources**: GitHub, Stack Overflow, official documentation
- **Features**: Syntax highlighting, code examples, step-by-step guides

#### Reddit Search

- **Focus Mode**: Community perspectives and discussions
- **Features**: Real user experiences, opinion aggregation

### 🤖 **Multi-LLM Support**

#### Cloud Models

- **OpenAI**: GPT-4o, GPT-4o Mini
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku
- **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash

#### Local Models

- **Ollama**: Any model (llama3, mistral, codellama, etc.)
- **LM Studio**: Custom local models
- **Auto-Detection**: Automatically discovers available models

#### Model Features

- **Streaming**: Real-time token generation
- **Temperature Control**: Adjustable creativity (0.0 - 2.0)
- **Top-P Sampling**: Nucleus sampling for diversity
- **Max Tokens**: Configurable response length
- **System Prompts**: Custom instructions per focus mode

### 📚 **Knowledge Base (RAG System)**

#### Document Management

- **Supported Formats**: PDF, TXT, MD, DOCX, DOC, CSV, JSON, EPUB, URLs
- **Chunking**: Intelligent 1000-character chunks with overlap
- **Metadata**: Source tracking, timestamps, file size

#### Hybrid Retrieval

- **Vector Search**: OpenAI embeddings (text-embedding-ada-002)
- **BM25 Keyword Search**: Okapi BM25 probabilistic ranking
- **Fusion**: Reciprocal Rank Fusion (RRF) for optimal results
- **Configurable Weights**: Adjust semantic vs. keyword balance

#### Multi-KB Search

- **Cross-KB Queries**: Search across multiple knowledge bases
- **Selective Search**: Choose specific KBs or search all
- **Result Aggregation**: Merged results with KB attribution

#### Advanced Features

- **Semantic Cache**: Persistent query caching with TTL (24h default)
- **Web Augmentation**: Combine local docs with web search
- **Conversation History**: Multi-turn context awareness
- **Observability**: Langfuse integration for tracing and monitoring

### 💬 **Thread Management**

#### Organization

- **Auto-Titling**: AI-generated thread titles from first query
- **Search**: Full-text search across all conversations
- **Pinning**: Pin important threads to top
- **Favorites**: Star threads for quick access
- **Tags**: Auto-classification (coding, research, science, etc.)

#### Export Options

- **Markdown**: Clean, readable format with sources
- **HTML**: Styled export for web viewing
- **JSON**: Structured data for programmatic access
- **Clipboard**: Quick copy for sharing

#### Source Management

- **Bookmarks**: Save important sources across threads
- **Citation Tracking**: Click citations to highlight sources
- **Full-Text Preview**: Hover to see scraped content
- **External Links**: Open sources in browser

### 🖥️ **Desktop Features**

#### System Integration

- **System Tray**: Minimize to tray, quick access
- **Global Hotkey**: Ctrl+Shift+Space to toggle window
- **Native Notifications**: Search completion alerts
- **Window State**: Remembers position and size

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New Search |
| `Ctrl/Cmd + K` | Open Knowledge Base |
| `Ctrl/Cmd + ,` | Settings |
| `Ctrl/Cmd + Q` | Quit |
| `Ctrl/Cmd + Shift + Space` | Global Toggle |
| `Enter` | Submit Search |
| `Shift + Enter` | New Line |
| `Esc` | Cancel Search |

#### UI/UX

- **Dark/Light Theme**: System-aware theme switching
- **Responsive Layout**: Adapts to window size
- **Loading States**: Skeleton screens and progress indicators
- **Error Handling**: Graceful degradation with user feedback

### 🔧 **Advanced Capabilities**

#### Query Rewriting

- **Heuristic Detection**: Identifies complex queries
- **LLM Decomposition**: Breaks into 2-4 sub-queries
- **Triggers**: Comparisons, multi-topic questions, long queries

#### Answer Comparison

- **Multi-Model Execution**: Run same query on multiple LLMs
- **Side-by-Side**: Compare responses, duration, token count
- **Benchmarking**: Evaluate model performance

#### Confidence Scoring

- **Metrics**: Source coverage, citation density, completeness, coherence
- **Labels**: High (80-100), Medium (50-79), Low (0-49)
- **Reasoning**: Explains score breakdown

#### Citation Graph

- **Inter-Source Links**: Extracts links between scraped pages
- **Network Analysis**: Identifies authoritative sources
- **Visualization**: Graph of source relationships

#### Follow-Up Questions

- **AI-Generated**: 3 contextual follow-up questions
- **One-Click**: Click to run follow-up search
- **Conversation Flow**: Maintains context across turns

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Search Orchestrator (Master)              │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Phase 0: Query Rewrite (Optional)               │ │ │
│  │  │  - Heuristic Detection                           │ │ │
│  │  │  - LLM Decomposition                             │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Phase 1: Parallel Search                        │ │ │
│  │  │  - SearchAgent × N (DuckDuckGo, Tavily, Brave)   │ │ │
│  │  │  - Concurrent Execution                          │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Phase 2: Result Merging                         │ │ │
│  │  │  - ResultMergerAgent                             │ │ │
│  │  │  - Deduplication, Scoring, Ranking               │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Phase 3: Parallel Scraping                      │ │ │
│  │  │  - ScraperAgent × 3 (Top URLs)                   │ │ │
│  │  │  - Jina.ai Reader API                            │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Phase 4: Context Building                       │ │ │
│  │  │  - ContextBuilderAgent                           │ │ │
│  │  │  - Focus Mode Instructions                       │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Phase 5: LLM Synthesis                          │ │ │
│  │  │  - LLMSynthesisAgent                             │ │ │
│  │  │  - Streaming Token Generation                    │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Phase 6: Follow-Up Generation (Parallel)        │ │ │
│  │  │  - FollowUpAgent                                 │ │ │
│  │  │  - Non-Blocking Execution                        │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              RAG Orchestrator (Hybrid)                 │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Semantic Cache (SQLite)                         │ │ │
│  │  │  - MD5 Cache Keys                                │ │ │
│  │  │  - TTL Expiration (24h)                          │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Concurrent Retrieval                            │ │ │
│  │  │  - Vector Search (OpenAI Embeddings)             │ │ │
│  │  │  - BM25 Keyword Search                           │ │ │
│  │  │  - Web Search (Optional)                         │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Hybrid Fusion (RRF)                             │ │ │
│  │  │  - Reciprocal Rank Fusion                        │ │ │
│  │  │  - Configurable Weights                          │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  LLM Generation (Streaming)                      │ │ │
│  │  │  - OpenAI GPT-4o                                 │ │ │
│  │  │  - Conversation History Support                  │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Observability (Langfuse)                        │ │ │
│  │  │  - Trace Creation                                │ │ │
│  │  │  - Span Tracking                                 │ │ │
│  │  │  - Metrics Collection                            │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Service Layer                         │ │
│  │  - LLM Router (Multi-Provider)                         │ │
│  │  - Database (JSON Storage)                             │ │
│  │  - Vector Store (JSON + Embeddings)                    │ │
│  │  - Export Service (Markdown, HTML, JSON)               │ │
│  │  - Tag Service (Auto-Classification)                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↕
                         IPC Bridge
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                  Electron Renderer Process                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    React Application                    │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  State Management (Zustand)                      │ │ │
│  │  │  - searchStore                                   │ │ │
│  │  │  - settingsStore                                 │ │ │
│  │  │  - historyStore                                  │ │ │
│  │  │  - knowledgeBaseStore                            │ │ │
│  │  │  - bookmarkStore                                 │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Components                                      │ │ │
│  │  │  - SearchBar (Voice Input, KB Picker)            │ │ │
│  │  │  - FocusModes (Mode Selector)                    │ │ │
│  │  │  - SourceCards (Bookmarks, Citations)            │ │ │
│  │  │  - AnswerPanel (Markdown, TTS, Export)           │ │ │
│  │  │  - ThreadSidebar (Search, Filter, Pin)           │ │ │
│  │  │  - SettingsPanel (API Keys, Preferences)         │ │ │
│  │  │  - KnowledgeBasePanel (CRUD, Upload)             │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Hooks                                           │ │ │
│  │  │  - useSearch (Main Search Logic)                 │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Agent System

#### 1. **SearchOrchestrator** (Master Coordinator)

- **Responsibility**: Coordinates entire search pipeline
- **Phases**: Query rewrite → Search → Merge → Scrape → Build → Synthesize → Follow-up
- **Event Emission**: Streams progress events to UI

#### 2. **SearchAgent** (Multi-Provider)

- **Providers**: DuckDuckGo, Tavily, Brave
- **Focus Modes**: Applies mode-specific query modifiers
- **Parallel Execution**: Concurrent requests to all providers

#### 3. **ResultMergerAgent**

- **Deduplication**: URL normalization (www, trailing slash, protocol)
- **Scoring**: Quality domain boost, snippet length analysis
- **Ranking**: Top-N selection (default: 8)

#### 4. **ScraperAgent**

- **API**: Jina.ai Reader (free, markdown conversion)
- **Timeout**: 12 seconds per URL
- **Truncation**: 4000 characters max per page

#### 5. **ContextBuilderAgent**

- **Prompt Engineering**: Focus mode instructions
- **Source Formatting**: Numbered citations with metadata
- **Rules**: Citation requirements, conflict handling

#### 6. **LLMSynthesisAgent**

- **Streaming**: Async generator for real-time tokens
- **History**: Last 4 messages (2 turns) for context
- **Multi-Provider**: Routes to appropriate LLM service

#### 7. **FollowUpAgent**

- **Generation**: 3 contextual follow-up questions
- **Filtering**: Validates question format (ends with ?)
- **Non-Blocking**: Runs in parallel with main response

#### 8. **QueryRewriteAgent** (Optional)

- **Heuristics**: Detects complex queries (comparisons, multi-topic)
- **Decomposition**: LLM-driven sub-query generation
- **Output**: 2-4 targeted sub-queries

#### 9. **ConfidenceScorer** (Optional)

- **Metrics**: Source coverage, citation density, completeness, coherence
- **Scoring**: Weighted average (0-100)
- **Labels**: High/Medium/Low with reasoning

#### 10. **CitationGraphBuilder** (Optional)

- **Extraction**: Parses links between scraped sources
- **Graph**: Nodes (sources) and edges (links)
- **Analysis**: Identifies authoritative sources

#### 11. **AnswerComparator** (Optional)

- **Multi-Model**: Runs query on multiple LLMs simultaneously
- **Metrics**: Duration, token count, answer quality
- **Use Case**: Model benchmarking and comparison

### RAG System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      RAG Pipeline                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Query Processing                                   │ │
│  │     - Generate cache key (MD5)                         │ │
│  │     - Check semantic cache                             │ │
│  │     - Create observability trace                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  2. Concurrent Retrieval (Parallel)                    │ │
│  │     ┌──────────────────┬──────────────────┬──────────┐ │ │
│  │     │ Vector Search    │ BM25 Search      │ Web      │ │ │
│  │     │ (Embeddings)     │ (Keywords)       │ Search   │ │ │
│  │     │ - OpenAI API     │ - TF-IDF         │ - Tavily │ │ │
│  │     │ - Cosine Sim     │ - Okapi BM25     │ (Opt)    │ │ │
│  │     │ - Top-K: 5       │ - Top-K: 5       │ Top-3    │ │ │
│  │     └──────────────────┴──────────────────┴──────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  3. Hybrid Fusion (RRF)                                │ │
│  │     - Reciprocal Rank Fusion                           │ │
│  │     - Configurable weights (vector: 0.6, bm25: 0.4)    │ │
│  │     - Deduplication by chunk ID                        │ │
│  │     - Top-K final results: 5                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  4. Context Assembly                                   │ │
│  │     - Format retrieved chunks                          │ │
│  │     - Add web search results (if enabled)              │ │
│  │     - Include conversation history                     │ │
│  │     - Build system prompt                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  5. LLM Generation (Streaming)                         │ │
│  │     - OpenAI GPT-4o (default)                          │ │
│  │     - Stream tokens to UI                              │ │
│  │     - Track token count                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  6. Post-Processing                                    │ │
│  │     - Cache response (24h TTL)                         │ │
│  │     - Finalize observability trace                     │ │
│  │     - Return sources metadata                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input
    ↓
[SearchBar Component]
    ↓
useSearch Hook
    ↓
IPC: 'search' event
    ↓
[Main Process]
    ↓
SearchOrchestrator.run()
    ↓
┌─────────────────────────────────────┐
│ For each phase:                     │
│   1. Execute agent(s)               │
│   2. Emit AgentEvent                │
│   3. Send to renderer via IPC       │
└─────────────────────────────────────┘
    ↓
[Renderer Process]
    ↓
Event Listener in useSearch
    ↓
Update Zustand Store
    ↓
React Re-render
    ↓
UI Update (Sources, Answer, etc.)
```

---

## 🛠️ Technology Stack

### Frontend (Renderer Process)

- **Framework**: React 18.2
- **State Management**: Zustand 4.5
- **Styling**: Custom CSS (no framework)
- **Markdown**: react-markdown, remark-gfm, rehype-highlight
- **Build Tool**: Vite 5.1

### Backend (Main Process)

- **Runtime**: Electron 28.2
- **Language**: TypeScript 5.3
- **Build Tool**: electron-vite 2.0

### AI/ML

- **LLM Providers**:
  - OpenAI SDK 4.28
  - Anthropic SDK 0.20
  - Google Generative AI 0.3
- **Embeddings**: OpenAI text-embedding-ada-002
- **Vector Search**: Custom JSON-based vector store
- **BM25**: Custom implementation (Okapi BM25)

### Search Providers

- **DuckDuckGo**: HTML scraping (free)
- **Tavily**: Official SDK 0.0.2
- **Brave**: REST API

### Storage

- **Database**: JSON files (data.json, vector_store.json, cache.json)
- **Location**: Electron userData directory
- **Persistence**: Synchronous writes with error handling

### Utilities

- **PDF Parsing**: pdf-parse 2.4.5
- **UUID**: uuid 13.0
- **Caching**: lru-cache 11.2.6
- **Observability**: Langfuse 3.0 (optional)

### Development

- **Testing**: Vitest 1.2
- **Packaging**: electron-builder 24.9
- **Linting**: TypeScript strict mode

---

## 📦 Installation

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Operating System**: Windows 10/11, macOS 10.15+, or Linux

### Option 1: Download Pre-Built Binary

1. Navigate to the `release` folder in the project
2. Download the appropriate executable:
   - **Windows**: `Perplexity Local-1.0.0-x64.exe`
   - **macOS**: `Perplexity Local-1.0.0-arm64.dmg` or `.zip`
   - **Linux**: `Perplexity Local-1.0.0-x64.AppImage` or `.deb`
3. Run the installer or portable executable
4. Launch the application

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/perplexity-local.git
cd perplexity-local

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package as executable
npm run electron:build
```

### Post-Installation

1. **Launch the application**
2. **Configure API keys** (optional):
   - Open Settings (Ctrl/Cmd + ,)
   - Add API keys for cloud LLMs and search providers
3. **Install local LLMs** (optional):
   - Install [Ollama](https://ollama.ai) or [LM Studio](https://lmstudio.ai)
   - Models will be auto-detected

---

## ⚙️ Configuration

### Settings Panel

Access via `Ctrl/Cmd + ,` or Settings button.

#### **AI Models**

| Setting | Description | Default |
|---------|-------------|---------|
| Default Model | Primary LLM for synthesis | `openai:gpt-4o-mini` |
| Temperature | Creativity (0.0 = deterministic, 2.0 = creative) | `0.7` |
| Top-P | Nucleus sampling threshold | `0.9` |
| Max Tokens | Maximum response length | `2048` |

#### **Search Providers**

| Provider | API Key Required | Features |
|----------|------------------|----------|
| DuckDuckGo | No | Free, unlimited, basic results |
| Tavily | Yes | Advanced search, better quality |
| Brave | Yes | Privacy-focused, high quality |

**Configuration:**

- Select default provider(s)
- Add API keys in respective fields
- Enable/disable parallel search

#### **API Keys**

| Service | Environment Variable | Purpose |
|---------|---------------------|---------|
| OpenAI | `OPENAI_API_KEY` | GPT models, embeddings |
| Anthropic | `ANTHROPIC_API_KEY` | Claude models |
| Google AI | `GOOGLE_AI_KEY` | Gemini models |
| Tavily | `TAVILY_API_KEY` | Advanced web search |
| Brave | `BRAVE_API_KEY` | Brave Search API |
| Langfuse | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | Observability (optional) |

**How to Add:**

1. Open Settings
2. Navigate to "API Keys" section
3. Paste keys in respective fields
4. Click "Save Settings"

#### **Advanced Settings**

| Setting | Description | Default |
|---------|-------------|---------|
| Max Search Results | Number of sources to scrape | `8` |
| Scrape Timeout | Seconds before scraping fails | `12` |
| Cache TTL | Semantic cache expiration (hours) | `24` |
| Enable Observability | Langfuse tracing | `false` |

### Environment Variables

Create a `.env` file in the project root:

```env
# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_KEY=AI...

# Search Providers
TAVILY_API_KEY=tvly-...
BRAVE_API_KEY=BSA...

# Observability (Optional)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

### Local LLM Setup

#### Ollama

```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3

# Start Ollama server (runs on http://localhost:11434)
ollama serve
```

#### LM Studio

1. Download from [lmstudio.ai](https://lmstudio.ai)
2. Install and launch
3. Download models from the UI
4. Start local server (default: <http://localhost:1234>)

**Auto-Detection:**
Perplexity Local automatically detects running Ollama/LM Studio instances and lists available models in the Model Picker.

---

## 📖 Usage Guide

### Basic Search

1. **Enter a query** in the search bar
2. **Select a focus mode** (Web, Images, Videos, Academic, Code, Reddit)
3. **Press Enter** or click the search button
4. **View results**:
   - Sources appear as cards
   - Answer streams in real-time with citations
   - Follow-up questions appear below

### Focus Modes

#### 🌐 Web (Default)

- General-purpose web search
- Comprehensive, well-structured answers
- Balanced source selection

#### 🖼️ Images

- Image search from DuckDuckGo/Brave
- Thumbnail grid view
- Click to open full image

#### 🎬 Videos

- YouTube and video platform search
- Metadata: duration, views, channel
- Click to watch

#### 📚 Academic

- Scholarly articles and papers
- Formal, research-oriented language
- Citation of studies and sources

#### 💻 Code

- Developer documentation and examples
- Syntax-highlighted code blocks
- Step-by-step technical guides

#### 🗣️ Reddit

- Community discussions and opinions
- Real user experiences
- Aggregated perspectives

#### 🧠 Hybrid RAG

- Combines local knowledge base with web search
- Semantic + keyword search
- Best for queries related to your documents

### Knowledge Base Workflow

#### Creating a Knowledge Base

1. Open Knowledge Base panel (Ctrl/Cmd + K)
2. Click "New Knowledge Base"
3. Enter name and description
4. Click "Create"

#### Adding Documents

**Upload Files:**

1. Select a knowledge base
2. Click "Add Document"
3. Choose file (PDF, TXT, MD, DOCX, CSV, JSON, EPUB)
4. Wait for processing (chunking + embedding)

**Add URL:**

1. Select a knowledge base
2. Click "Add from URL"
3. Enter URL and name
4. Content is scraped and processed

**Drag & Drop:**

1. Drag files directly into the KB panel
2. Files are automatically processed

#### Searching Knowledge Bases

**Single KB:**

1. Select a knowledge base from the list
2. Switch to "Hybrid RAG" focus mode
3. Enter your query
4. Results combine local docs + web search

**Multi-KB:**

1. Click "Select Multiple" in KB panel
2. Check desired knowledge bases
3. Search queries across all selected KBs
4. Results show KB attribution

#### Managing Documents

- **View**: Click document to see chunks and metadata
- **Delete**: Click trash icon to remove
- **Search**: Use search bar to filter documents

### Thread Management

#### Viewing Threads

- **Sidebar**: All threads listed chronologically
- **Search**: Filter by title or content
- **Favorites**: Toggle star filter to show only favorites
- **Pinned**: Pinned threads appear at top

#### Thread Actions

| Action | How | Description |
|--------|-----|-------------|
| Pin | Click pin icon | Keep thread at top of list |
| Favorite | Click star icon | Mark as important |
| Delete | Click trash icon | Remove thread permanently |
| Export | Click export in answer panel | Save as Markdown/HTML/JSON |
| Copy | Click copy button | Copy answer to clipboard |

#### Exporting Threads

1. Open a thread
2. Click the export menu (⋮) in answer panel
3. Choose format:
   - **Markdown**: Clean, readable format
   - **HTML**: Styled for web viewing
   - **JSON**: Structured data
   - **Clipboard**: Quick copy

### Bookmarks

- **Add**: Click star icon on source cards
- **View**: Open Bookmarks panel
- **Remove**: Click X on bookmarked source
- **Clear All**: Remove all bookmarks at once

### Voice Input

1. Click microphone icon in search bar
2. Allow microphone permissions
3. Speak your query
4. Click stop when finished
5. Query is transcribed and submitted

### Text-to-Speech

1. After receiving an answer
2. Click speaker icon in answer panel
3. Answer is read aloud
4. Click again to stop

---

## 🧠 Knowledge Base (RAG)

### Architecture

The RAG system uses a **hybrid retrieval** approach combining:

1. **Vector Search**: Semantic similarity using OpenAI embeddings
2. **BM25 Search**: Keyword-based probabilistic ranking
3. **Reciprocal Rank Fusion (RRF)**: Merges results from both methods

### Document Ingestion Pipeline

```
File Upload
    ↓
File Type Detection
    ↓
Content Extraction
    ├─ PDF: pdf-parse
    ├─ DOCX: mammoth (if implemented)
    ├─ TXT/MD: fs.readFile
    ├─ URL: Jina.ai Reader
    └─ CSV/JSON: JSON.parse
    ↓
Text Chunking
    ├─ Chunk Size: 1000 characters
    ├─ Overlap: 200 characters
    └─ Preserve sentence boundaries
    ↓
Embedding Generation
    ├─ Model: text-embedding-ada-002
    ├─ Batch Size: 10 chunks
    └─ Retry Logic: 3 attempts
    ↓
Vector Store Persistence
    ├─ File: vector_store.json
    └─ Structure: { id, text, source, kbId, vector }
    ↓
BM25 Index Update
    ├─ Tokenization: Lowercase, stopword removal
    ├─ TF-IDF Calculation
    └─ Document Frequency Update
```

### Retrieval Process

#### 1. Vector Search

```typescript
// Cosine similarity calculation
function cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (magnitudeA * magnitudeB)
}

// Top-K retrieval
const results = chunks
    .map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
```

#### 2. BM25 Search

```typescript
// Okapi BM25 formula
function bm25Score(
    queryTerms: string[],
    document: string[],
    avgDocLength: number,
    k1: number = 1.5,
    b: number = 0.75
): number {
    let score = 0
    for (const term of queryTerms) {
        const tf = document.filter(t => t === term).length
        const idf = Math.log((totalDocs - docFreq[term] + 0.5) / (docFreq[term] + 0.5))
        const numerator = tf * (k1 + 1)
        const denominator = tf + k1 * (1 - b + b * (document.length / avgDocLength))
        score += idf * (numerator / denominator)
    }
    return score
}
```

#### 3. Reciprocal Rank Fusion

```typescript
function reciprocalRankFusion(
    vectorResults: Result[],
    bm25Results: Result[],
    k: number = 60
): Result[] {
    const scores = new Map<string, number>()
    
    vectorResults.forEach((result, rank) => {
        const rrfScore = 1 / (k + rank + 1)
        scores.set(result.id, (scores.get(result.id) || 0) + rrfScore * 0.6)
    })
    
    bm25Results.forEach((result, rank) => {
        const rrfScore = 1 / (k + rank + 1)
        scores.set(result.id, (scores.get(result.id) || 0) + rrfScore * 0.4)
    })
    
    return Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id, score]) => ({ id, score }))
}
```

### Semantic Cache

**Purpose**: Avoid redundant LLM calls for similar queries

**Implementation**:

- **Cache Key**: MD5 hash of (query + options)
- **Storage**: JSON file (cache.json)
- **TTL**: 24 hours (configurable)
- **Eviction**: Automatic cleanup on startup

**Cache Hit Flow**:

```
Query → Generate Cache Key → Check Cache
    ↓ (Hit)
Return Cached Response (instant)
    ↓ (Miss)
Execute RAG Pipeline → Cache Response → Return
```

### Observability

**Langfuse Integration** (optional):

- **Traces**: One per RAG query
- **Spans**: Retrieval (vector, BM25, web), generation, caching
- **Metrics**: Latency, token count, cache hit rate
- **Errors**: Logged with stack traces

**Setup**:

1. Sign up at [langfuse.com](https://langfuse.com)
2. Get API keys
3. Add to `.env`:

   ```env
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   ```

4. Enable in Settings

**Dashboard**: View traces, latency, and performance metrics in Langfuse UI

---

## 🤖 Agent System

### Agent Communication

Agents communicate via **AgentEvent** objects:

```typescript
interface AgentEvent {
    type: 'phase' | 'sources' | 'images' | 'videos' | 'token' | 'followups' | 'done' | 'error'
    label?: string           // Phase description
    sources?: SearchResult[] // Search results
    images?: ImageResult[]   // Image results
    videos?: VideoResult[]   // Video results
    token?: string           // Streaming token
    followups?: string[]     // Follow-up questions
    message?: string         // Error message
}
```

### Event Flow

```
SearchOrchestrator
    ↓
yield { type: 'phase', label: '🔍 Searching...' }
    ↓
SearchAgent.run() × N (parallel)
    ↓
yield { type: 'sources', sources: [...] }
    ↓
ScraperAgent.run() × 3 (parallel)
    ↓
yield { type: 'phase', label: '🧠 Synthesizing...' }
    ↓
LLMSynthesisAgent.stream()
    ↓
for each token:
    yield { type: 'token', token: '...' }
    ↓
yield { type: 'followups', followups: [...] }
    ↓
yield { type: 'done' }
```

### Custom Agent Development

To create a custom agent:

```typescript
// src/main/agents/CustomAgent.ts
export class CustomAgent {
    async run(input: string): Promise<Output> {
        // Your logic here
        return output
    }
}

// Integrate into Orchestrator
// src/main/agents/Orchestrator.ts
import { CustomAgent } from './CustomAgent'

async *run(query: string, opts: SearchOpts) {
    // ... existing phases
    
    yield { type: 'phase', label: '🔧 Running custom agent...' }
    const customAgent = new CustomAgent()
    const result = await customAgent.run(query)
    
    // ... continue pipeline
}
```

---

## 🔌 API Reference

### IPC API (Renderer ↔ Main)

#### Search

```typescript
// Start a search
window.api.search(
    query: string,
    opts: SearchOpts,
    onEvent: (event: AgentEvent) => void
): string // Returns request ID

// Cancel a search
window.api.cancelSearch(requestId: string): void
```

#### Settings

```typescript
// Get settings
window.api.getSettings(): Promise<AppSettings>

// Save settings
window.api.setSettings(settings: AppSettings): Promise<void>
```

#### Threads

```typescript
// Get all threads
window.api.getThreads(): Promise<Thread[]>

// Save a thread
window.api.saveThread(thread: Thread): Promise<void>

// Delete a thread
window.api.deleteThread(id: string): Promise<void>

// Clear all threads
window.api.clearHistory(): Promise<void>

// Search threads
window.api.searchThreads(query: string): Promise<Thread[]>
```

#### Knowledge Bases

```typescript
// Get all knowledge bases
window.api.getKnowledgeBases(): Promise<KnowledgeBase[]>

// Create a knowledge base
window.api.createKnowledgeBase(
    name: string,
    description: string
): Promise<KnowledgeBase>

// Delete a knowledge base
window.api.deleteKnowledgeBase(id: string): Promise<void>

// Add document
window.api.addDocument(
    kbId: string,
    doc: Document
): Promise<void>

// Delete document
window.api.deleteDocument(
    kbId: string,
    docId: string
): Promise<void>

// Search knowledge base
window.api.searchKnowledgeBase(
    kbId: string,
    query: string
): Promise<SearchResult[]>

// Search all knowledge bases
window.api.searchAllKnowledgeBases(
    query: string
): Promise<CrossKBSearchResult[]>
```

#### Models

```typescript
// List Ollama models
window.api.listOllamaModels(): Promise<string[]>

// List LM Studio models
window.api.listLMStudioModels(): Promise<string[]>
```

#### RAG

```typescript
// Stream RAG query
window.api.streamRAGQuery(
    query: string,
    options: RAGOptions,
    onEvent: (event: RAGStreamEvent) => void
): void

// Get cache stats
window.api.getCacheStats(): Promise<CacheStats>

// Clear cache
window.api.clearCache(): Promise<void>

// Get trace stats
window.api.getTraceStats(): Promise<TraceStats>
```

### Type Definitions

```typescript
interface SearchOpts {
    focusMode: FocusMode
    providers: SearchProvider[]
    maxResults?: number
    conversationHistory?: Message[]
}

type FocusMode = 
    | 'web' 
    | 'image' 
    | 'video' 
    | 'academic' 
    | 'code' 
    | 'reddit' 
    | 'hybrid-rag'

type SearchProvider = 'duckduckgo' | 'tavily' | 'brave'

interface AppSettings {
    defaultModel: string
    temperature: number
    topP: number
    maxTokens: number
    searchProvider: SearchProvider
    tavilyKey: string
    braveKey: string
    openaiKey: string
    anthropicKey: string
    googleAIKey: string
}

interface Thread {
    id: string
    title: string
    messages: Message[]
    sources: SearchResult[]
    createdAt: number
    updatedAt: number
    isPinned?: boolean
    isFavorite?: boolean
    tags?: string[]
}

interface Message {
    role: 'user' | 'assistant'
    content: string
}

interface SearchResult {
    url: string
    title: string
    snippet: string
    domain: string
    favicon?: string
    fullText?: string
    score?: number
}

interface RAGOptions {
    useLocalContext: boolean
    useWebSearch: boolean
    kbId?: string
    kbIds?: string[]
    conversationHistory?: Message[]
}
```

---

## 💻 Development

### Project Structure

```
perplexity-local/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── agents/              # Agent system
│   │   │   ├── Orchestrator.ts  # Master coordinator
│   │   │   ├── SearchAgent.ts   # Multi-provider search
│   │   │   ├── ScraperAgent.ts  # Content extraction
│   │   │   ├── ContextBuilder.ts
│   │   │   ├── LLMSynthesis.ts
│   │   │   ├── FollowUpAgent.ts
│   │   │   ├── QueryRewriteAgent.ts
│   │   │   ├── ResultMerger.ts
│   │   │   ├── AnswerComparator.ts
│   │   │   ├── CitationGraph.ts
│   │   │   ├── confidenceScorer.ts
│   │   │   └── types.ts
│   │   ├── rag/                 # RAG system
│   │   │   ├── orchestrator.ts  # RAG pipeline
│   │   │   ├── vectorStore.ts   # Vector search
│   │   │   ├── bm25.ts          # Keyword search
│   │   │   ├── ingestion.ts     # Document processing
│   │   │   ├── semanticCache.ts # Query caching
│   │   │   ├── observability.ts # Tracing
│   │   │   └── webSearch.ts     # Web augmentation
│   │   ├── services/            # Core services
│   │   │   ├── llm-router.ts    # Multi-LLM routing
│   │   │   ├── database.ts      # JSON storage
│   │   │   ├── storage.ts       # Legacy storage
│   │   │   ├── exportService.ts # Export utilities
│   │   │   ├── tagService.ts    # Auto-tagging
│   │   │   ├── clipboardMonitor.ts
│   │   │   ├── pageMonitor.ts
│   │   │   ├── pluginManager.ts
│   │   │   └── scheduler.ts
│   │   └── index.ts             # Main entry point
│   ├── preload/                 # Preload scripts
│   │   └── index.ts             # IPC bridge
│   └── renderer/                # React frontend
│       ├── src/
│       │   ├── components/      # React components
│       │   │   ├── SearchBar.tsx
│       │   │   ├── FocusModes.tsx
│       │   │   ├── SourceCards.tsx
│       │   │   ├── AnswerPanel.tsx
│       │   │   ├── ThreadSidebar.tsx
│       │   │   ├── SettingsPanel.tsx
│       │   │   ├── KnowledgeBasePanel.tsx
│       │   │   ├── ModelPicker.tsx
│       │   │   ├── ImageCards.tsx
│       │   │   ├── VideoCards.tsx
│       │   │   ├── BookmarksPanel.tsx
│       │   │   └── KeyboardShortcutsPanel.tsx
│       │   ├── store/           # Zustand stores
│       │   │   ├── searchStore.ts
│       │   │   ├── settingsStore.ts
│       │   │   ├── historyStore.ts
│       │   │   ├── knowledgeBaseStore.ts
│       │   │   └── bookmarkStore.ts
│       │   ├── hooks/           # Custom hooks
│       │   │   └── useSearch.ts
│       │   ├── utils/           # Utilities
│       │   │   └── export.ts
│       │   ├── App.tsx          # Root component
│       │   ├── main.tsx         # Entry point
│       │   ├── index.css        # Global styles
│       │   └── global.d.ts      # Type definitions
│       └── index.html
├── tests/                       # Test files
├── out/                         # Build output
├── release/                     # Packaged executables
├── resources/                   # App resources
├── electron.vite.config.ts      # Vite config
├── tsconfig.json                # TypeScript config
├── vitest.config.ts             # Test config
├── package.json
└── README.md
```

### Development Workflow

```bash
# Install dependencies
npm install

# Run in development mode (hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Package as executable
npm run electron:build
```

### Adding a New Feature

1. **Define Types** (if needed):

   ```typescript
   // src/main/agents/types.ts
   export interface NewFeature {
       id: string
       data: string
   }
   ```

2. **Create Agent** (if applicable):

   ```typescript
   // src/main/agents/NewAgent.ts
   export class NewAgent {
       async run(input: string): Promise<Output> {
           // Implementation
       }
   }
   ```

3. **Add IPC Handler**:

   ```typescript
   // src/main/index.ts
   ipcMain.handle('new-feature', async (event, args) => {
       // Handle request
       return result
   })
   ```

4. **Expose in Preload**:

   ```typescript
   // src/preload/index.ts
   contextBridge.exposeInMainWorld('api', {
       newFeature: (args) => ipcRenderer.invoke('new-feature', args)
   })
   ```

5. **Add Type Definition**:

   ```typescript
   // src/renderer/src/global.d.ts
   interface Window {
       api: {
           newFeature: (args: Args) => Promise<Result>
       }
   }
   ```

6. **Create UI Component**:

   ```typescript
   // src/renderer/src/components/NewFeature.tsx
   export default function NewFeature() {
       const handleClick = async () => {
           const result = await window.api.newFeature(args)
       }
       return <button onClick={handleClick}>New Feature</button>
   }
   ```

7. **Integrate into App**:

   ```typescript
   // src/renderer/src/App.tsx
   import NewFeature from './components/NewFeature'
   
   export default function App() {
       return (
           <div>
               <NewFeature />
           </div>
       )
   }
   ```

### Code Style

- **TypeScript**: Strict mode enabled
- **Naming**: camelCase for variables/functions, PascalCase for classes/components
- **Async**: Use async/await, avoid callbacks
- **Error Handling**: Try-catch blocks, graceful degradation
- **Comments**: JSDoc for public APIs, inline for complex logic

---

## 🧪 Testing

### Test Structure

```
tests/
├── agents/
│   ├── SearchAgent.test.ts
│   ├── ResultMerger.test.ts
│   └── ContextBuilder.test.ts
├── rag/
│   ├── vectorStore.test.ts
│   ├── bm25.test.ts
│   └── orchestrator.test.ts
├── services/
│   ├── llm-router.test.ts
│   └── database.test.ts
└── __mocks__/
    └── electron.ts
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- SearchAgent.test.ts

# Run in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run offline evaluation benchmark
npm run eval:offline

# Run regression gate (CI release blocker)
npm run eval:gate

# Generate weekly evaluation dashboard/report
npm run eval:weekly
```

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { SearchAgent } from '../src/main/agents/SearchAgent'

describe('SearchAgent', () => {
    it('should search DuckDuckGo', async () => {
        const agent = new SearchAgent('duckduckgo')
        const results = await agent.run('test query')
        
        expect(results).toBeDefined()
        expect(results.length).toBeGreaterThan(0)
        expect(results[0]).toHaveProperty('url')
        expect(results[0]).toHaveProperty('title')
    })
    
    it('should handle errors gracefully', async () => {
        const agent = new SearchAgent('invalid' as any)
        const results = await agent.run('test')
        
        expect(results).toEqual([])
    })
})
```

---

## 🚀 Deployment

### Building Executables

```bash
# Build for current platform
npm run electron:build

# Build for specific platform
npm run electron:build -- --win
npm run electron:build -- --mac
npm run electron:build -- --linux
```

### Build Configuration

Edit `package.json`:

```json
{
  "build": {
    "appId": "com.perplexitylocal.app",
    "productName": "Perplexity Local",
    "directories": {
      "output": "release"
    },
    "files": ["out/**/*"],
    "win": {
      "target": ["portable", "nsis"],
      "icon": "resources/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "resources/icon.icns"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "resources/icon.png"
    }
  }
}
```

### Distribution

1. **GitHub Releases**:
   - Tag version: `git tag v1.0.0`
   - Push tag: `git push origin v1.0.0`
   - Upload executables from `release/` folder

2. **Auto-Update** (future):
   - Implement electron-updater
   - Host releases on GitHub or custom server

---

## 🐛 Troubleshooting

### Common Issues

#### 1. **Search Returns No Results**

**Symptoms**: Empty source cards, no answer generated

**Solutions**:

- Check internet connection
- Verify search provider API keys (Tavily, Brave)
- Try switching to DuckDuckGo (no API key required)
- Check console for error messages

#### 2. **LLM Not Responding**

**Symptoms**: Stuck on "Synthesizing..." phase

**Solutions**:

- Verify API keys in Settings
- Check API quota/billing (OpenAI, Anthropic, Google)
- Try switching to a different model
- For local models, ensure Ollama/LM Studio is running

#### 3. **Knowledge Base Upload Fails**

**Symptoms**: Document upload shows error

**Solutions**:

- Check file format (PDF, TXT, MD, DOCX supported)
- Ensure file size < 10MB
- Verify OpenAI API key (required for embeddings)
- Check console for specific error

#### 4. **Electron App Won't Start**

**Symptoms**: Application crashes on launch

**Solutions**:

- Delete `userData` folder:
  - Windows: `%APPDATA%\perplexity-local`
  - macOS: `~/Library/Application Support/perplexity-local`
  - Linux: `~/.config/perplexity-local`
- Reinstall application
- Check for conflicting processes on ports 11434 (Ollama) or 1234 (LM Studio)

#### 5. **Slow Performance**

**Symptoms**: Laggy UI, slow searches

**Solutions**:

- Reduce max search results in Settings
- Disable web scraping (faster but less context)
- Use faster LLM (GPT-4o Mini, Claude Haiku)
- Clear semantic cache
- Reduce knowledge base size

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
export DEBUG=perplexity:*

# Run application
npm run dev
```

View logs:

- **Windows**: `%APPDATA%\perplexity-local\logs`
- **macOS**: `~/Library/Logs/perplexity-local`
- **Linux**: `~/.config/perplexity-local/logs`

### Reporting Bugs

1. Check existing issues on GitHub
2. Collect information:
   - OS and version
   - Application version
   - Steps to reproduce
   - Error messages/logs
3. Create a new issue with details

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/perplexity-local.git`
3. Create a branch: `git checkout -b feature/your-feature`
4. Make changes and commit: `git commit -m "Add your feature"`
5. Push to your fork: `git push origin feature/your-feature`
6. Open a Pull Request

### Contribution Guidelines

- **Code Style**: Follow existing patterns, use TypeScript
- **Tests**: Add tests for new features
- **Documentation**: Update README and inline comments
- **Commits**: Use clear, descriptive commit messages
- **PR Description**: Explain what, why, and how

### Areas for Contribution

- **New Search Providers**: Add support for more search APIs
- **LLM Providers**: Integrate additional LLM services
- **Document Formats**: Support more file types (EPUB, HTML, etc.)
- **UI Improvements**: Enhance design, add themes
- **Performance**: Optimize search, caching, rendering
- **Testing**: Increase test coverage
- **Documentation**: Improve guides, add tutorials

---

## 🗺️ Roadmap

### Version 1.1 (Q2 2026)

- [ ] **Auto-Update**: Electron-updater integration
- [ ] **Plugin System**: Load custom search/processing plugins
- [ ] **Advanced Filters**: Date range, domain filtering
- [ ] **Export Formats**: PDF, DOCX export
- [ ] **Themes**: Custom color schemes

### Version 1.2 (Q3 2026)

- [ ] **Collaborative KBs**: Share knowledge bases
- [ ] **Cloud Sync**: Optional cloud backup
- [ ] **Mobile App**: React Native companion app
- [ ] **Browser Extension**: Quick search from browser
- [ ] **API Server**: REST API for programmatic access

### Version 2.0 (Q4 2026)

- [ ] **Multi-User**: User accounts and permissions
- [ ] **Advanced RAG**: Graph RAG, multi-hop reasoning
- [ ] **Real-Time Monitoring**: Live web page tracking
- [ ] **Scheduled Searches**: Automated recurring searches
- [ ] **AI Agents**: Custom agent workflows

---

## 📄 License

MIT License

Copyright (c) 2024 Perplexity Local Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🙏 Acknowledgments

- **Perplexity AI**: Inspiration for cited search
- **NotebookLM**: RAG architecture inspiration
- **Jina.ai**: Free web scraping API
- **Ollama**: Local LLM infrastructure
- **Electron**: Cross-platform desktop framework
- **React**: UI framework
- **OpenAI**: Embeddings and LLM API
- **Anthropic**: Claude LLM
- **Google**: Gemini LLM

---

## 📞 Support

- **Documentation**: This README
- **Issues**: [GitHub Issues](https://github.com/yourusername/perplexity-local/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/perplexity-local/discussions)
- **Email**: <support@perplexitylocal.com>

---

<div align="center">

**Built with ❤️ by the Perplexity Local Team**

[⬆ Back to Top](#perplexity-local---comprehensive-documentation)

</div>
