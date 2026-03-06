# Lumina Search API Documentation

**Version**: 1.1.0  
**Base URL**: `http://localhost:8080`  
**Authentication**: Optional (API key in Bearer token)  
**Format**: JSON  

---

## Quick Start

### 1. Start the API Server

```typescript
import { getLocalAPIServer } from './services/localAPIServer'

const server = getLocalAPIServer({ port: 8080 })
await server.start()
```

### 2. Make Requests

```bash
# Health check
curl http://localhost:8080/api/v1/health

# Execute search
curl -X POST http://localhost:8080/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"q":"machine learning"}'
```

### 3. Response Format

All responses follow this format:

```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "timestamp": "2026-03-05T10:30:00Z",
  "requestId": "req_12345"
}
```

---

## Authentication

### Optional API Key

Enable authentication when starting the server:

```typescript
const server = getLocalAPIServer({
  port: 8080,
  requireAPIKey: true,
  apiKeys: new Set(['your-secret-key-here'])
})

server.addAPIKey('another-key')
```

### Using API Key

```bash
curl http://localhost:8080/api/v1/search \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{"q":"query"}'
```

---

## Endpoints

### System

#### Health Check

```
GET /api/v1/health
```

Returns server status and uptime.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 3600,
    "timestamp": "2026-03-05T10:30:00Z"
  }
}
```

---

### Search

#### Execute Search

```
POST /api/v1/search
```

Execute a search query with optional operators.

**Request Body:**

```json
{
  "q": "machine learning",
  "site": ["github.com", "arxiv.org"],
  "filetype": "pdf",
  "language": ["en", "fr"],
  "source": ["web", "docs"],
  "model": "gpt-4"
}
```

**Query Parameters:**

- `q` (required) - Search query
- `site` - Restrict to domain(s)
- `filetype` - File type filter
- `language` - Language codes (ISO 639-1)
- `source` - Source type(s): web|docs|images|videos|academic
- `model` - LLM model to use
- `excludeTerms` - Terms to exclude

**Response:**

```json
{
  "success": true,
  "data": {
    "query": "machine learning",
    "results": [
      {
        "url": "https://example.com",
        "title": "Article Title",
        "snippet": "...",
        "source": "web",
        "thumbnail": "..."
      }
    ],
    "response": "AI-generated summary with citations",
    "citations": [
      {
        "url": "https://example.com",
        "title": "Article Title",
        "source": "web"
      }
    ],
    "executionTime": 1250,
    "resultCount": 42,
    "model": "gpt-4"
  }
}
```

**Examples:**

```bash
# Basic search
curl -X POST http://localhost:8080/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"q":"python programming"}'

# Advanced search
curl -X POST http://localhost:8080/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "q": "machine learning",
    "site": ["github.com"],
    "language": ["en"],
    "source": ["web", "docs"],
    "model": "gpt-4"
  }'
```

---

### Search Operators

#### List Available Operators

```
GET /api/v1/search/operators
```

Get list of all available search operators with examples.

**Response:**

```json
{
  "success": true,
  "data": {
    "operators": [
      {
        "name": "site",
        "aliases": ["domain", "host"],
        "description": "Restrict search to specific domain",
        "example": "site:github.com",
        "syntax": "site:domain.com"
      },
      {
        "name": "filetype",
        "aliases": ["type", "ext", "format"],
        "description": "Filter results by file type",
        "example": "filetype:pdf",
        "syntax": "filetype:ext"
      },
      {
        "name": "date",
        "aliases": ["published", "since"],
        "description": "Filter by date range",
        "example": "date:2024..2025",
        "syntax": "date:YYYY..YYYY"
      }
    ]
  }
}
```

---

### Saved Searches

#### List Saved Searches

```
GET /api/v1/search/saved
```

Get all saved searches with optional filtering.

**Query Parameters:**

- `limit` - Number of results (default: 100, max: 1000)
- `offset` - Pagination offset (default: 0)
- `isTemplate` - Filter by template status (true|false)
- `category` - Filter by category
- `search` - Search saved search names

**Response:**

```json
{
  "success": true,
  "data": {
    "searches": [
      {
        "id": "search_123456789",
        "name": "Machine Learning Research",
        "query": "machine learning site:arxiv.org",
        "description": "Latest ML papers",
        "tags": ["research", "ml"],
        "isTemplate": true,
        "category": "research",
        "starred": true,
        "createdAt": "2026-03-01T10:00:00Z",
        "updatedAt": "2026-03-05T10:00:00Z",
        "lastExecuted": "2026-03-05T09:00:00Z",
        "executeCount": 15,
        "executionTimeMs": 1250,
        "autoRefresh": {
          "enabled": true,
          "intervalSeconds": 3600,
          "lastRefreshed": "2026-03-05T10:00:00Z"
        }
      }
    ],
    "total": 1,
    "limit": 100,
    "offset": 0
  }
}
```

#### Create Saved Search

```
POST /api/v1/search/saved
```

Create a new saved search or template.

**Request Body:**

```json
{
  "name": "Machine Learning Research",
  "query": "machine learning site:arxiv.org",
  "description": "Latest ML papers",
  "tags": ["research", "ml"],
  "isTemplate": true,
  "category": "research"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "search_123456789",
    "name": "Machine Learning Research",
    "query": "machine learning site:arxiv.org",
    "created": "2026-03-05T10:30:00Z"
  }
}
```

#### Get Single Saved Search

```
GET /api/v1/search/saved/{id}
```

Retrieve a specific saved search by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "search_123456789",
    "name": "Machine Learning Research",
    "query": "machine learning site:arxiv.org",
    "starred": true,
    /* ... full search object ... */
  }
}
```

#### Update Saved Search

```
PUT /api/v1/search/saved/{id}
```

Modify an existing saved search.

**Request Body:**

```json
{
  "name": "Updated Name",
  "description": "New description",
  "tags": ["new", "tags"]
}
```

#### Delete Saved Search

```
DELETE /api/v1/search/saved/{id}
```

Remove a saved search.

**Response:**

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "search_123456789"
  }
}
```

#### Star/Unstar Search

```
POST /api/v1/search/saved/{id}/star
```

Toggle favorite status.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "search_123456789",
    "starred": true
  }
}
```

#### Duplicate Search

```
POST /api/v1/search/saved/{id}/duplicate
```

Create a copy of a saved search.

**Request Body:**

```json
{
  "newName": "Machine Learning Research (Copy)"
}
```

---

### Search History & Analytics

#### Get Search History

```
GET /api/v1/search/history
```

Retrieve search history with filtering and pagination.

**Query Parameters:**

- `limit` - Results per page (default: 100, max: 1000)
- `offset` - Page offset (default: 0)
- `query` - Filter by query text
- `startDate` - From date (ISO 8601)
- `endDate` - To date (ISO 8601)
- `source` - Filter by source
- `minRating` - Minimum star rating (1-5)

**Response:**

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "record_123456789",
        "originalQuery": "machine learning",
        "executedAt": "2026-03-05T10:00:00Z",
        "resultCount": 42,
        "executionTimeMs": 1250,
        "sourcesUsed": ["web", "docs"],
        "llmModel": "gpt-4",
        "userRating": 5,
        "notes": "Great results",
        "success": true
      }
    ],
    "total": 150,
    "limit": 100,
    "offset": 0
  }
}
```

#### Rate Search Result

```
POST /api/v1/search/{id}/rate
```

Submit a rating and feedback for a search.

**Request Body:**

```json
{
  "rating": 5,
  "notes": "Excellent results, very helpful"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "record_123456789",
    "rating": 5,
    "recorded": true
  }
}
```

#### Get Analytics Dashboard

```
GET /api/v1/analytics
```

Comprehensive search analytics and insights.

**Query Parameters:**

- `startDate` - From date (ISO 8601, default: 30 days ago)
- `endDate` - To date (ISO 8601, default: today)

**Response:**

```json
{
  "success": true,
  "data": {
    "totalSearches": 250,
    "uniqueQueries": 180,
    "averageExecutionTime": 1250,
    "successRate": 0.92,
    "totalResultsRetrieved": 8500,
    "topQueries": [
      {
        "query": "machine learning",
        "count": 15,
        "avgTime": 1250
      }
    ],
    "topSources": [
      {
        "source": "web",
        "count": 200
      },
      {
        "source": "docs",
        "count": 150
      }
    ],
    "searchTrend": [
      {
        "date": "2026-03-05",
        "count": 25
      }
    ],
    "timeOfDayAnalysis": {
      "morning": 60,
      "afternoon": 85,
      "evening": 75,
      "night": 30
    },
    "dayOfWeekAnalysis": {
      "Monday": 45,
      "Tuesday": 42
    },
    "averageRating": 4.2
  }
}
```

---

### Export

#### Get Supported Formats

```
GET /api/v1/export/formats
```

List all export formats and options.

**Response:**

```json
{
  "success": true,
  "data": {
    "formats": [
      {
        "name": "PDF",
        "ext": "pdf",
        "citationFormats": ["apa", "mla", "chicago", "harvard"],
        "options": ["light", "dark"]
      },
      {
        "name": "Markdown",
        "ext": "md"
      },
      {
        "name": "HTML",
        "ext": "html"
      }
    ]
  }
}
```

#### Export to PDF

```
POST /api/v1/export/pdf
```

Generate PDF export of a thread or search results.

**Request Body:**

```json
{
  "threadId": "thread_123456789",
  "citationFormat": "apa",
  "includeTableOfContents": true,
  "theme": "light",
  "author": "John Doe"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "threadId": "thread_123456789",
    "filePath": "/tmp/lumina_export_1234567890.pdf",
    "format": "pdf",
    "citations": "apa",
    "pages": 5
  }
}
```

#### Export to Markdown

```
POST /api/v1/export/markdown
```

Generate Markdown export with proper formatting.

---

### Webhooks

#### Register Webhook

```
POST /api/v1/webhooks/register
```

Register a webhook for event notifications.

**Request Body:**

```json
{
  "url": "https://webhook.site/abc123def456",
  "events": ["search:completed", "export:finished"],
  "active": true,
  "secret": "webhook_secret_key"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "webhook_123456789",
    "url": "https://webhook.site/abc123def456",
    "registered": true,
    "createdAt": "2026-03-05T10:30:00Z"
  }
}
```

#### List Webhooks

```
GET /api/v1/webhooks
```

Get all registered webhooks.

**Response:**

```json
{
  "success": true,
  "data": {
    "webhooks": [
      {
        "id": "webhook_123456789",
        "url": "https://webhook.site/abc123def456",
        "events": ["search:completed"],
        "active": true
      }
    ]
  }
}
```

#### Update Webhook

```
PUT /api/v1/webhooks/{id}
```

Modify webhook configuration.

#### Delete Webhook

```
DELETE /api/v1/webhooks/{id}
```

Remove a webhook.

---

### Webhook Events

#### search:completed

Triggered when a search finishes.

```json
{
  "event": "search:completed",
  "data": {
    "query": "machine learning",
    "resultCount": 42,
    "executionTime": 1250,
    "timestamp": "2026-03-05T10:30:00Z"
  },
  "timestamp": "2026-03-05T10:30:00Z"
}
```

#### export:finished

Triggered when export completes.

```json
{
  "event": "export:finished",
  "data": {
    "threadId": "thread_123456789",
    "format": "pdf",
    "filePath": "/path/to/file.pdf",
    "timestamp": "2026-03-05T10:30:00Z"
  },
  "timestamp": "2026-03-05T10:30:00Z"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "timestamp": "2026-03-05T10:30:00Z",
  "requestId": "req_12345"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 404 | Not Found - Endpoint or resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Example Error Response

```json
{
  "success": false,
  "error": "Missing query parameter: q",
  "timestamp": "2026-03-05T10:30:00Z",
  "requestId": "req_12345"
}
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Execute search
const response = await fetch('http://localhost:8080/api/v1/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer api-key-here'
  },
  body: JSON.stringify({
    q: 'machine learning',
    site: ['github.com'],
    model: 'gpt-4'
  })
})

const data = await response.json()
console.log(data.data.results)
```

### Python

```python
import requests
import json

url = 'http://localhost:8080/api/v1/search'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer api-key-here'
}
payload = {
    'q': 'machine learning',
    'site': ['github.com'],
    'model': 'gpt-4'
}

response = requests.post(url, headers=headers, json=payload)
data = response.json()
print(data['data']['results'])
```

### cURL

```bash
curl -X POST http://localhost:8080/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer api-key-here" \
  -d '{
    "q": "machine learning",
    "site": ["github.com"],
    "model": "gpt-4"
  }'
```

---

## Rate Limiting

Currently unlimited. Rate limiting coming in v1.2.0 with:

- 100 requests per minute per IP
- 1000 requests per hour per API key
- 10000 requests per day per API key

---

## SDK & Libraries

### Official SDKs (Coming Soon)

- **JavaScript/TypeScript**: `@luminasearch/sdk`
- **Python**: `luminasearch-py`
- **Go**: `luminasearch-go`

---

## Changelog

### v1.1.0 (Current)

- Initial API release
- 15+ endpoints
- Webhook support
- Full search analytics

### v1.2.0 (Planned)

- Rate limiting
- Advanced filtering
- Batch operations
- Scheduled searches API

---

## Support & Feedback

- 📖 **Documentation**: [GitHub Wiki](https://github.com/KunjShah95/lumina-search/wiki)
- 🐛 **Report Issues**: [GitHub Issues](https://github.com/KunjShah95/lumina-search/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/KunjShah95/lumina-search/discussions)
- 👥 **Community**: [Discord](https://discord.gg/luminasearch)

---

**Last Updated**: March 5, 2026  
**API Version**: v1.1.0  
**Status**: ✅ Production-Ready
