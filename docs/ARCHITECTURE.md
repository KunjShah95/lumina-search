# Lumina Search Architecture

This document provides visual architecture references for contributors.

## Component Diagram

```mermaid
flowchart TB
  subgraph Renderer[Renderer Process]
    UI[React UI\nSearchBar • AnswerPanel • Sidebar]
    Store[Zustand Stores\nsearch/settings/history/kb]
    IPCClient[IPC Client API]
    UI --> Store --> IPCClient
  end

  subgraph Main[Main Process]
    IPCServer[IPC Handlers]
    Orch[Search Orchestrator]
    SearchAgents[Search Agents\nDuckDuckGo • Tavily • Brave]
    Scraper[Scraper Agent]
    RAG[RAG Orchestrator\nVector + BM25 + Fusion]
    LLM[LLM Router\nOpenAI • Anthropic • Gemini • Local]
    DB[(SQLite/JSON Storage)]

    IPCServer --> Orch
    Orch --> SearchAgents --> Scraper
    Orch --> RAG --> LLM
    Orch --> DB
    RAG --> DB
  end

  IPCClient <--> IPCServer
```

## Search Sequence Diagram

```mermaid
sequenceDiagram
  participant U as User
  participant R as Renderer
  participant M as Main IPC
  participant O as Orchestrator
  participant S as Search Agents
  participant C as Scraper
  participant L as LLM

  U->>R: Enter query + submit
  R->>M: search:start
  M->>O: run(query, opts)
  O->>S: parallel web search
  S-->>O: source results
  O->>C: scrape top pages
  C-->>O: full text snippets
  O->>L: synthesize with citations
  L-->>R: streaming tokens
  O-->>R: sources/followups/done events
```

## Data Flow Diagram

```mermaid
flowchart LR
  Q[Query] --> SR[Search Results]
  SR --> SD[Scraped Documents]
  Q --> VR[Vector Retrieval]
  Q --> BR[BM25 Retrieval]
  VR --> HF[Hybrid Fusion]
  BR --> HF
  SD --> CTX[Context Builder]
  HF --> CTX
  CTX --> GEN[LLM Generation]
  GEN --> ANS[Answer + Citations]
  ANS --> HIST[(Thread History)]
```

## Code Map

- `src/main/agents/` — orchestration, search, scrape, synthesis.
- `src/main/rag/` — retrieval, ingestion, cache, observability.
- `src/main/services/` — settings, analytics, export, scheduler, api server.
- `src/renderer/src/components/` — UI components.
- `src/renderer/src/store/` — app state stores.
- `src/preload/index.ts` — safe IPC bridge.
