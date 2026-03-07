# Lumina Search v1.1.0 - Developer Getting Started Guide

**For**: Developers integrating or extending Lumina Search v1.1.0  
**Version**: 1.1.0  
**Last Updated**: March 5, 2026

---

## Quick Overview

Lumina Search v1.1.0 adds 6 major new systems. This guide shows how to use them.

### The 6 New Systems

1. **🔍 Advanced Search Operators** - Parse `site:`, `filetype:`, `date:`, etc.
2. **💾 Saved Searches** - Store, manage, and auto-refresh searches
3. **📊 Search Analytics** - Track, analyze, and visualize search patterns
4. **📄 PDF Export** - Generate professional PDFs with proper citations
5. **🌐 Local API Server** - RESTful API for programmatic access
6. **⚡ CLI Tool** - Command-line interface for terminal usage

---

## 1. Search Operators

### What It Does

Parses advanced search syntax like `site:github.com "exact phrase" filetype:pdf`

### How to Use

```typescript
import { getSearchOperators } from './services/searchOperators'

// Get the singleton instance
const operators = getSearchOperators()

// Parse a search query
const parsed = operators.parseQuery(
  'machine learning site:arxiv.org filetype:pdf date:2024..2025'
)

// Result structure:
{
  baseQuery: 'machine learning',
  operators: {
    sites: ['arxiv.org'],
    fileTypes: ['pdf'],
    dateRange: { start: Date(2024), end: Date(2025) },
    customOperators: {}
  }
}
```

### Available Operators

```typescript
// Get list of all operators
const operatorDocs = operators.getOperatorList()
// Returns: [{ name: 'site', description: '...', example: 'site:github.com' }, ...]
```

### Integration in UI

```typescript
// In search handler
async function handleSearch(userInput: string) {
  const parsed = operators.parseQuery(userInput)
  
  // Use operators to filter search
  const searchOptions = operators.compileQueryForSearch(parsed)
  
  // searchOptions = { q: 'machine learning', sites: [...], fileTypes: [...] }
  const results = await executeSearch(searchOptions)
}
```

### Operator Reference

| Operator | Syntax | Example |
|----------|--------|---------|
| Site | `site:domain.com` | `site:github.com` |
| File Type | `filetype:ext` | `filetype:pdf` |
| Date Range | `date:YYYY..YYYY` | `date:2024..2025` |
| Language | `language:code` | `language:en,fr` |
| Source | `source:type` | `source:web,docs` |
| Exclude | `!term` | `!spam !ads` |
| Exact | `"phrase"` | `"machine learning"` |

---

## 2. Saved Searches

### What It Does

Stores search templates and enables quick re-running with auto-refresh

### How to Use

```typescript
import { getSavedSearchesManager } from './services/savedSearches'

const manager = getSavedSearchesManager()

// Create a saved search
const saved = manager.createSearch({
  name: 'Machine Learning Papers',
  query: 'machine learning site:arxiv.org',
  description: 'Latest ML research',
  tags: ['research', 'machine-learning'],
  isTemplate: true,
  category: 'research'
})

// List all searches
const allSearches = manager.getAllSearches()

// Filter searches
const mlSearches = manager.getAllSearches({
  tags: ['machine-learning']
})

// Update a search
manager.updateSearch(saved.id, {
  query: 'deep learning site:arxiv.org',
  description: 'Updated description'
})

// Star a search
manager.toggleStar(saved.id)

// Delete a search
manager.deleteSearch(saved.id)
```

### Auto-Refresh

```typescript
// Enable auto-refresh (refreshes every hour)
manager.enableAutoRefresh(
  saved.id,
  3600, // 3600 seconds = 1 hour
  async (search) => {
    // This callback runs every hour
    console.log(`Refreshing: ${search.name}`)
    const results = await executeSearch(search.query)
    // Update results, send notifications, etc.
  }
)

// Disable auto-refresh
manager.stopAutoRefresh(saved.id)
```

### Track Usage

```typescript
// Record when a search is executed
manager.recordExecution(saved.id, executionTimeMs)

// Get statistics
const stats = manager.getStats()
// {
//   totalSaved: 10,
//   totalTemplates: 3,
//   mostUsed: [...],
//   averageExecutionTime: 1250
// }
```

### Import/Export

```typescript
// Export to JSON
const jsonData = manager.exportSearches()
fs.writeFileSync('searches.json', jsonData)

// Import from JSON
const result = manager.importSearches(jsonData)
// { imported: 10, failed: 0, errors: [] }

// Export only templates
const templates = manager.exportSearches({ isTemplate: true })
```

---

## 3. Search Analytics

### What It Does

Tracks search history and provides insights into search patterns

### How to Use

```typescript
import { getSearchAnalyticsManager } from './services/searchAnalytics'

const analytics = getSearchAnalyticsManager()

// Record a search
const record = analytics.recordSearch({
  originalQuery: 'machine learning',
  resultCount: 42,
  executionTimeMs: 1250,
  sourcesUsed: ['web', 'docs'],
  llmModel: 'gpt-4',
  success: true
})

// Rate the search result
analytics.rateSearch(record.id, 5, 'Excellent results!')

// Mark as successful/unsuccessful
analytics.markSearchSuccess(record.id, true)
```

### Get Analytics Data

```typescript
// Get dashboard data
const dashboard = analytics.getAnalytics()
// {
//   totalSearches: 250,
//   uniqueQueries: 180,
//   averageExecutionTime: 1250,
//   successRate: 0.92,
//   topQueries: [...],
//   searchTrend: [...],
//   timeOfDayAnalysis: { morning: 60, afternoon: 85, ... },
//   dayOfWeekAnalysis: { Monday: 45, ... }
// }

// Get recent history
const history = analytics.getHistory({
  limit: 50,
  offset: 0,
  query: 'machine learning',
  minRating: 4
})

// Find your most-used searches
const duplicates = analytics.getSearchDuplicates()
// Returns searches that have been executed multiple times
```

### Performance Insights

```typescript
// Find problematic searches
const insights = analytics.getPerformanceInsights()
// {
//   slowestQueries: [...],
//   fastestQueries: [...],
//   lowSuccessQueries: [...]
// }
```

### Cleanup

```typescript
// Clean old data (keep last 90 days)
const count = analytics.clearOlderThan(90)
console.log(`Cleared ${count} old records`)

// Get stats summary
const summary = analytics.getStatsSummary()
// {
//   todaySearches: 15,
//   thisWeekSearches: 85,
//   thisMonthSearches: 250,
//   allTimeSearches: 1000
// }
```

---

## 4. PDF Export

### What It Does

Generates professional PDF exports with proper citations

### How to Use

```typescript
import { getPDFExportManager } from './services/pdfExport'

const exporter = getPDFExportManager()

// Your thread data
const thread = {
  id: 'thread_123',
  title: 'Machine Learning Research',
  query: 'machine learning',
  response: 'AI-generated response...',
  model: 'gpt-4',
  executionTime: 1250,
  createdAt: new Date(),
  results: [
    {
      url: 'https://arxiv.org/paper',
      title: 'Paper Title',
      snippet: 'Abstract...',
      source: 'web'
    }
  ]
}

// Export to PDF
const pdfPath = await exporter.generateThreadPDF(thread, {
  title: 'My Research Report',
  author: 'John Doe',
  citationFormat: 'apa',
  includeTimestamp: true,
  theme: 'light',
  includeMetadata: true
})

console.log(`PDF generated: ${pdfPath}`)
```

### Citation Formats

```typescript
// APA
const apaPath = await exporter.generateThreadPDF(thread, {
  citationFormat: 'apa'
})

// MLA
const mlaPath = await exporter.generateThreadPDF(thread, {
  citationFormat: 'mla'
})

// Chicago
const chicagoPath = await exporter.generateThreadPDF(thread, {
  citationFormat: 'chicago'
})

// Harvard
const harvardPath = await exporter.generateThreadPDF(thread, {
  citationFormat: 'harvard'
})
```

### Bulk Export

```typescript
// Export multiple threads at once
const threads = [thread1, thread2, thread3]

const pdfPath = await exporter.generateBulkPDF(threads, {
  title: 'Research Report - March 2026',
  author: 'Research Team',
  citationFormat: 'apa',
  includeTableOfContents: true
})
```

### Themes

```typescript
// Light theme (default)
const light = await exporter.generateThreadPDF(thread, {
  theme: 'light'
})

// Dark theme
const dark = await exporter.generateThreadPDF(thread, {
  theme: 'dark'
})
```

---

## 5. Local API Server

### What It Does

Provides RESTful API for programmatic access to Lumina

### How to Use

```typescript
import { getLocalAPIServer } from './services/localAPIServer'

// Create server (default port 8080)
const server = getLocalAPIServer({ 
  port: 8080,
  host: 'localhost',
  enableWebhooks: true
})

// Start server
await server.start()
console.log('API running on http://localhost:8080')

// Register custom handler
server.registerHandler('/api/v1/custom', async (params, body) => {
  return {
    message: 'Hello from custom endpoint',
    params,
    body
  }
})

// Stop server when done
await server.stop()
```

### API Security

```typescript
// Optional: Enable API key authentication
const server = getLocalAPIServer({
  port: 8080,
  requireAPIKey: true
})

// Add API keys
server.addAPIKey('secret-key-123')
server.addAPIKey('another-key-456')

// Remove API key
server.removeAPIKey('secret-key-123')

// Client makes requests with key
// Authorization: Bearer secret-key-123
```

### Webhooks

```typescript
// Register webhook for events
server.registerWebhook('search_complete', {
  url: 'https://webhook.site/abc123',
  events: ['search:completed', 'export:finished'],
  active: true,
  secret: 'webhook_secret'
})

// Server automatically triggers webhooks when events happen
// Webhook receives:
// {
//   event: 'search:completed',
//   data: { query: '...', resultCount: 42, ... },
//   timestamp: '2026-03-05T10:30:00Z'
// }
```

### Making API Requests

```bash
# Health check
curl http://localhost:8080/api/v1/health

# Search
curl -X POST http://localhost:8080/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret-key-123" \
  -d '{ "q": "machine learning" }'

# List saved searches
curl http://localhost:8080/api/v1/search/saved

# Get analytics
curl http://localhost:8080/api/v1/analytics?startDate=2026-03-01
```

### In Application Code

```typescript
// From any part of your app, use the API
async function remoteSearch(query) {
  const response = await fetch('http://localhost:8080/api/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer secret-key-123'
    },
    body: JSON.stringify({ q: query })
  })
  return await response.json()
}

const result = await remoteSearch('machine learning')
console.log(result.data.results)
```

---

## 6. CLI Tool

### What It Does

Command-line interface for searching and managing Lumina from terminal

### Installation

```bash
# Make script executable
chmod +x src/main/cli/lumina.ts

# Or install globally (in package.json scripts)
npm install -g luminasearch-cli
```

### Basic usage

```bash
# Search
lumina search "machine learning"

# View saved searches
lumina saved list

# Create saved search
lumina saved create --name "ML Research" --query "machine learning site:arxiv.org"

# View analytics
lumina analytics view --days=30

# Export to PDF
lumina export pdf --thread-id=abc123 --citations=apa

# View help
lumina help
```

### Environment Setup

```bash
# Configure endpoint
export LUMINA_API_ENDPOINT=http://localhost:8080
export LUMINA_API_KEY=your-secret-key

# Disable colors
export NO_COLOR=1

# Set output format
export LUMINA_OUTPUT_FORMAT=json
```

### Configuration

```bash
# View current config
lumina config get

# Set API endpoint
lumina config set apiEndpoint http://api.example.com:8080

# Set output format
lumina config set outputFormat table
```

### Advanced Examples

```bash
# Search with specific model
lumina search "AI safety" --model=gpt-4

# Search with multiple sources
lumina search "deep learning" --source=web,docs,videos

# Export multiple searches
lumina saved export json > searches.json

# View analytics for last 7 days
lumina analytics view --days=7

# Export to markdown
lumina export markdown --thread-id=abc123

# See all available commands
lumina --help
```

---

## Integration Guide: Putting It All Together

### Complete Example: Search → Save → Analyze → Export

```typescript
import { getSearchOperators } from './services/searchOperators'
import { getSavedSearchesManager } from './services/savedSearches'
import { getSearchAnalyticsManager } from './services/searchAnalytics'
import { getPDFExportManager } from './services/pdfExport'

async function completeSearchFlow() {
  const operators = getSearchOperators()
  const saved = getSavedSearchesManager()
  const analytics = getSearchAnalyticsManager()
  const exporter = getPDFExportManager()

  // 1. Parse advanced search query
  const userInput = 'machine learning site:arxiv.org filetype:pdf date:2024..2025'
  const parsed = operators.parseQuery(userInput)
  
  // 2. Execute search (simplified)
  const startTime = Date.now()
  const results = await executeSearch(parsed)
  const executionTime = Date.now() - startTime
  
  // 3. Record analytics
  analytics.recordSearch({
    originalQuery: userInput,
    resultCount: results.length,
    executionTimeMs: executionTime,
    sourcesUsed: ['web'],
    success: true
  })
  
  // 4. Save as template
  const savedSearch = saved.createSearch({
    name: 'ML Papers 2024',
    query: userInput,
    isTemplate: true,
    tags: ['research', 'ml']
  })
  
  // 5. Enable auto-refresh
  saved.enableAutoRefresh(savedSearch.id, 86400, async (search) => {
    console.log(`Auto-refreshing: ${search.name}`)
  })
  
  // 6. Export results to PDF
  const pdfPath = await exporter.generateThreadPDF({
    id: 'thread_123',
    title: 'Machine Learning Research',
    query: userInput,
    response: 'AI summary of results...',
    results,
    model: 'gpt-4',
    executionTime,
    createdAt: new Date()
  }, {
    citationFormat: 'apa',
    author: 'Research Team'
  })
  
  // 7. Get analytics
  const dashboard = analytics.getAnalytics()
  console.log(`Total searches: ${dashboard.totalSearches}`)
  console.log(`Success rate: ${(dashboard.successRate * 100).toFixed(1)}%`)
  
  return {
    savedSearch,
    pdfPath,
    analytics: dashboard
  }
}
```

### IPC Integration (Electron)

```typescript
// In main/index.ts

import { ipcMain } from 'electron'
import { getSearchOperators } from './services/searchOperators'
import { getSavedSearchesManager } from './services/savedSearches'
import { getSearchAnalyticsManager } from './services/searchAnalytics'

// Search operators
ipcMain.handle('search:parseOperators', (_, query) => {
  return getSearchOperators().parseQuery(query)
})

// Saved searches
ipcMain.handle('saved:list', () => {
  return getSavedSearchesManager().getAllSearches()
})

ipcMain.handle('saved:create', (_, params) => {
  return getSavedSearchesManager().createSearch(params)
})

ipcMain.handle('saved:delete', (_, id) => {
  return getSavedSearchesManager().deleteSearch(id)
})

// Analytics
ipcMain.handle('analytics:get', (_, startDate, endDate) => {
  return getSearchAnalyticsManager().getAnalytics(startDate, endDate)
})

ipcMain.handle('analytics:record', (_, params) => {
  return getSearchAnalyticsManager().recordSearch(params)
})
```

### React Component Example

```typescript
// In renderer/src/components/SearchOperatorsGuide.tsx

import { useIPC } from '../hooks/useIPC'

export function SearchOperatorsGuide() {
  const { invoke } = useIPC()
  const [description, setDescription] = useState('')

  useEffect(() => {
    invoke('search:parseOperators', `site:github.com "javascript"`).then((parsed) => {
      setDescription(JSON.stringify(parsed, null, 2))
    })
  }, [invoke])

  return (
    <div>
      <h2> Advanced Search Guide</h2>
      <p>Learn about search operators:</p>
      <pre>{description}</pre>
      
      <h3>Examples</h3>
      <ul>
        <li><code>site:github.com</code> - Search GitHub only</li>
        <li><code>filetype:pdf</code> - PDF files only</li>
        <li><code>date:2024..2025</code> - Date range</li>
      </ul>
    </div>
  )
}
```

---

## Troubleshooting

### Services Not Loading?

```typescript
// Make sure to import correctly
import { getSearchOperators } from './services/searchOperators'
// NOT: import { SearchOperatorsManager } from './services/searchOperators'

const operators = getSearchOperators() // Correct
```

### API Server Not Responding?

```bash
# Check if server is running
curl http://localhost:8080/api/v1/health

# Check port is available
lsof -i :8080

# Try different port
export LUMINA_API_PORT=8081
```

### Analytics Data Lost?

```typescript
// Data is in-memory. To persist:
const analytics = getSearchAnalyticsManager()
const json = analytics.exportAnalytics()
fs.writeFileSync('analytics.json', json)

// Later, restore:
const data = fs.readFileSync('analytics.json', 'utf-8')
analytics.importAnalytics(data)
```

---

## Performance Tips

1. **Cleanup old data regularly**

   ```typescript
   analytics.clearOlderThan(90) // Keep last 90 days
   ```

2. **Use pagination for large datasets**

   ```typescript
   analytics.getHistory({ limit: 100, offset: 0 })
   ```

3. **Cache frequently accessed data**

   ```typescript
   const saved = manager.getAllSearches()
   // Don't call repeatedly, cache results
   ```

4. **Disable webhooks if not needed**

   ```typescript
   const server = getLocalAPIServer({ enableWebhooks: false })
   ```

---

## Reference Documentation

- [Full API Docs](API.md)
- [Development Roadmap](DEVELOPMENT_ROADMAP.md)
- [Changelog v1.1.0](CHANGELOG_v1.1.0.md)
- [Development Summary](DEVELOPMENT_SUMMARY_v1.1.0.md)

---

## Next Steps

1. ✅ Familiarize yourself with all 6 systems
2. 🔧 Integrate services into your codebase  
3. 📱 Build UI components for each feature
4. ✔️ Write unit tests for integration
5. 🚀 Deploy to production

---

**Need help?**

- File an issue on [GitHub](https://github.com/KunjShah95/lumina-search/issues)
- Join [Discord community](https://discord.gg/luminasearch)
- Read the full [API documentation](API.md)

---

**Happy coding!** 🚀✨
