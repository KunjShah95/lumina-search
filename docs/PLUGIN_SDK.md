# Lumina Search Plugin SDK

This document describes how to create plugins for Lumina Search.

## Overview

Lumina Search supports extensible plugins that can:
- Add custom search providers
- Post-process search results
- Add custom tools and utilities
- Create integrations with external services
- Add custom UI components

## Quick Start

```bash
# Navigate to plugins directory
cd ~/LuminaSearch/plugins

# Create a new plugin
mkdir my-plugin && cd my-plugin
npm init -y
```

## Plugin Structure

Each plugin must have a `manifest.json` file in its root directory:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "type": "search|postprocess|tool|integration",
  "entryPoint": "index.js",
  "permissions": ["storage", "network", "notifications"],
  "settings": {
    "apiKey": {
      "type": "string",
      "required": false,
      "encrypted": true
    }
  }
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique plugin identifier |
| `version` | string | Yes | Semantic version (1.0.0) |
| `description` | string | Yes | Short description |
| `author` | string | Yes | Author name/email |
| `type` | string | Yes | Plugin type |
| `entryPoint` | string | Yes | Main entry file |
| `permissions` | array | No | Required permissions |
| `settings` | object | No | Settings schema |
| `dependencies` | object | No | NPM dependencies |

## Plugin Types

### Search Plugins

Search plugins add new search providers:

```javascript
// search-plugin/index.js
module.exports = {
  manifest: {
    name: 'my-search',
    type: 'search',
    version: '1.0.0',
    description: 'Custom search provider'
  },
  
  // Initialize plugin
  init(context) {
    console.log('Plugin initialized')
  },
   
  // Search function
  async search(query, options = {}) {
    // options: { limit: 10, offset: 0, language: 'en' }
    
    // Your search implementation
    const response = await fetch('https://api.example.com/search', {
      method: 'POST',
      body: JSON.stringify({ q: query, ...options })
    })
    
    const data = await response.json()
    
    return {
      results: data.items.map(item => ({
        url: item.url,
        title: item.title,
        snippet: item.description,
        domain: new URL(item.url).hostname,
        score: item.relevance,
        metadata: item
      })),
      total: data.total,
      nextPage: data.nextPage
    }
  },
  
  // Optional: Image search
  async searchImages(query) {
    return []
  },
  
  // Optional: Video search  
  async searchVideos(query) {
    return []
  }
}
```

### Post-Process Plugins

Post-process plugins modify search results:

```javascript
// postprocess-plugin/index.js
module.exports = {
  manifest: {
    name: 'my-postprocess',
    type: 'postprocess'
  },
   
  // Process results after search
  async process(query, results, context) {
    // Add relevance scoring
    const scored = results.map(r => ({
      ...r,
      score: r.score * context.userEngagement
    }))
    
    // Filter by domain
    const filtered = scored.filter(r => !context.blockedDomains.includes(r.domain))
    
    // Add custom annotations
    return filtered.map(r => ({
      ...r,
      annotations: {
        verified: await checkDomain(r.domain),
        category: await categorize(r)
      }
    }))
  },
  
  // Runs before results are displayed
  async onDisplay(query, results, container) {
    // Add custom UI elements
    container.querySelector('.results').classList.add('enhanced')
  }
}
```

### Tool Plugins

Tool plugins add custom utilities:

```javascript
// tool-plugin/index.js
module.exports = {
  manifest: {
    name: 'my-tool',
    type: 'tool'
  },
   
  // Define available actions
  actions: {
    'summarize': {
      name: 'Summarize Text',
      description: 'Generate a summary of selected text',
      inputs: [{ name: 'text', type: 'string', required: true }],
      async execute({ text }) {
        const summary = await callSummarizationAPI(text)
        return { result: summary, length: summary.length }
      }
    },
    
    'translate': {
      name: 'Translate',
      description: 'Translate text to another language',
      inputs: [
        { name: 'text', type: 'string', required: true },
        { name: 'target', type: 'string', required: true }
      ],
      async execute({ text, target }) {
        return await translateAPI(text, target)
      }
    },
    
    'calculator': {
      name: 'Calculator',
      description: 'Evaluate mathematical expressions',
      inputs: [{ name: 'expression', type: 'string', required: true }],
      execute({ expression }) {
        const result = Function('"use strict"; return (' + expression + ')')()
        return { result, display: `${expression} = ${result}` }
      }
    }
  }
}
```

### Integration Plugins

Integration plugins connect to external services:

```javascript
// integration-plugin/index.js
module.exports = {
  manifest: {
    name: 'notion-integration',
    type: 'integration',
    permissions: ['storage', 'network']
  },
   
  // OAuth or API connection
  async connect(credentials) {
    // Handle OAuth flow or API key
    this.apiClient = new NotionClient(credentials.token)
    return { connected: true }
  },
   
  async disconnect() {
    this.apiClient = null
  },
   
  // Sync data from external service
  async sync() {
    const pages = await this.apiClient.getPages()
    return { imported: pages.length }
  },
   
  // Actions available in the app
  actions: {
    'save-to-notion': async (data) => {
      await this.apiClient.createPage(data)
    }
  }
}
```

## Plugin Hooks

Plugins can register to receive lifecycle events:

```javascript
// hooks.js
module.exports = {
  // Called before search starts
  'search:before': async (query, options) => {
    // Modify query or options
    return { query, options }
  },
   
  // Called after search completes
  'search:after': async (results, query) => {
    // Log or modify results
    return results
  },
   
  // Called when app starts
  'app:start': async (context) => {
    console.log('App started')
  },
   
  // Called when app closes
  'app:stop': async () => {
    // Cleanup
  },
   
  // Called when user copies text
  'clipboard:copy': async (text) => {
    // Process copied text
    return text
  },
   
  // Called when exporting
  'export:before': async (format, data) => {
    return data
  },
   
  // Called after export
  'export:after': async (format, filePath) => {
    // Notify or upload
  }
}
```

### Available Hooks

| Hook | Arguments | Description |
|------|-----------|--------------|
| `app:start` | context | App initialization |
| `app:stop` | - | App shutdown |
| `search:before` | query, options | Before search |
| `search:after` | results, query | After search |
| `search:error` | error, query | On search error |
| `results:display` | results, container | Before display |
| `clipboard:copy` | text | On text copy |
| `clipboard:paste` | text | On text paste |
| `export:before` | format, data | Before export |
| `export:after` | format, path | After export |
| `settings:change` | key, value | On settings change |
| `theme:change` | theme | On theme change |

## Custom Search Operators

Plugins can add custom search operators:

```javascript
// operator-plugin/index.js
module.exports = {
  manifest: {
    name: 'custom-operator',
    type: 'tool'
  },
   
  operators: {
    // Handle site:operator
    'site:': async (value, query) => {
      return { modifiedQuery: `${query} site:${value}` }
    },
    
    // Handle filetype:operator  
    'filetype:': async (value, query) => {
      return { 
        modifiedQuery: query,
        filters: { fileType: value }
      }
    },
    
    // Handle custom operators
    'category:': async (value, query) => {
      return { 
        modifiedQuery: query,
        filters: { category: value }
      }
    }
  }
}
```

## Configuration

Plugins can expose settings:

```javascript
module.exports = {
  manifest: {
    name: 'configurable-plugin',
    type: 'tool'
  },
   
  // Plugin settings schema
  settings: {
    apiKey: {
      type: 'string',
      required: true,
      encrypted: true,
      description: 'API key for the service'
    },
    maxResults: {
      type: 'number',
      default: 10,
      min: 1,
      max: 100,
      description: 'Maximum results to return'
    },
    region: {
      type: 'select',
      default: 'us',
      options: ['us', 'eu', 'asia'],
      description: 'API region'
    },
    enableCache: {
      type: 'boolean',
      default: true,
      description: 'Enable result caching'
    }
  },
   
  // Validate settings
  validate(settings) {
    if (!settings.apiKey) {
      throw new Error('API key is required')
    }
    if (settings.maxResults > 100) {
      throw new Error('Max results cannot exceed 100')
    }
    return true
  },
   
  // Called when settings change
  onSettingsChange(newSettings, oldSettings) {
    // Reinitialize API client
    this.apiClient = null
  }
}
```

## Plugin API Context

Plugins receive a context object with useful methods:

```javascript
{
  app: {
    version: '1.1.0',
    platform: 'windows|mac|linux',
    dataPath: '/path/to/data',
    logsPath: '/path/to/logs'
  },
  settings: {
    theme: 'dark',
    language: 'en',
    defaultProvider: 'duckduckgo'
  },
  storage: {
    get(key),           // Get value
    set(key, value),    // Set value
    delete(key),        // Delete value
    clear()             // Clear all
  },
  http: {
    fetch(url, opts),   // HTTP requests
    get(url, params),
    post(url, data)
  },
  events: {
    emit(name, data),  // Emit event
    on(name, handler)  // Listen for event
  },
  ui: {
    showNotification(msg, type),
    showModal(component, props),
    addCommand(id, config)
  },
  logger: {
    info(msg, meta),
    warn(msg, meta),
    error(msg, meta)
  }
}
```

## UI Extensions

Plugins can add custom UI elements:

```javascript
module.exports = {
  manifest: {
    name: 'ui-extension',
    type: 'tool'
  },
   
  // Add commands to command palette
  commands: [
    {
      id: 'my-plugin-action',
      label: 'My Plugin Action',
      shortcut: 'Ctrl+Shift+M',
      handler: () => this.doSomething()
    }
  ],
   
  // Add sidebar panel
  sidebarPanel: {
    id: 'my-panel',
    title: 'My Panel',
    icon: '📊',
    component: './SidebarPanel.jsx',
    position: 'left'
  },
   
  // Add to settings
  settingsSections: [
    {
      id: 'my-plugin',
      title: 'My Plugin',
      component: './Settings.jsx'
    }
  ]
}
```

## Installation

### Manual Installation

1. Create a folder in `~/LuminaSearch/plugins/`
2. Add your `manifest.json` and plugin code
3. Restart Lumina Search
4. The plugin will be auto-loaded

### Via Marketplace

1. Open Settings > Plugins > Marketplace
2. Browse or search for plugins
3. Click Install
4. Configure settings if needed

## Publishing

To share your plugin:

1. Create a GitHub repository with your plugin
2. Add plugin.json to the root
3. Submit to the plugin registry

```json
// plugin.json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "description": "Does amazing things",
  "repository": "https://github.com/username/my-awesome-plugin",
  "license": "MIT",
  "tags": ["search", "productivity"]
}
```

## Testing

```javascript
// test/plugin.test.js
const { test, expect } = require('vitest')

test('search returns results', async () => {
  const plugin = require('./index.js')
  const results = await plugin.search('test query')
  
  expect(results.results).toBeDefined()
  expect(results.results.length).toBeGreaterThan(0)
})
```

## Best Practices

1. **Error Handling** - Always wrap async operations in try/catch
2. **Performance** - Cache expensive operations, use pagination
3. **Validation** - Validate all user inputs
4. **Logging** - Use context.logger for debugging
5. **Versioning** - Follow semantic versioning
6. **Security** - Never expose API keys in code
7. **UX** - Show loading states and error messages
8. **Testing** - Write unit tests for core functionality

## Example: Complete Weather Plugin

```
plugins/weather-search/
├── manifest.json
├── index.js
├── settings.json
└── test/
    └── index.test.js
```

```json
// manifest.json
{
  "name": "weather-search",
  "version": "1.0.0",
  "description": "Search weather information",
  "author": "Example",
  "type": "search",
  "entryPoint": "index.js",
  "settings": {
    "apiKey": {
      "type": "string",
      "required": true,
      "encrypted": true
    },
    "units": {
      "type": "select",
      "default": "imperial",
      "options": ["imperial", "metric"]
    }
  }
}
```

```javascript
// index.js
module.exports = {
  manifest: {
    name: 'weather-search',
    type: 'search',
    version: '1.0.0',
    description: 'Search weather information'
  },
   
  async search(query, options = {}) {
    const city = query.replace(/weather\s+(in|at)?\s*/i, '').trim()
    const units = options.settings?.units || 'imperial'
    
    const response = await fetch(
      `https://api.weather.com/v3/wx?city=${city}&units=${units}`,
      { headers: { 'Authorization': `Bearer ${options.settings.apiKey}` } }
    )
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      results: [{
        url: `https://weather.com/${city}`,
        title: `Weather in ${city}`,
        snippet: `${data.current.temp}° - ${data.current.condition}`,
        domain: 'weather.com',
        score: 1.0,
        metadata: data
      }]
    }
  }
}
```

## Troubleshooting

### Plugin Not Loading

1. Check `~/LuminaSearch/logs/` for errors
2. Verify manifest.json is valid JSON
3. Ensure entryPoint file exists

### API Errors

1. Verify API keys in settings
2. Check network connectivity
3. Review rate limits

### Performance Issues

1. Add pagination to search results
2. Cache frequently accessed data
3. Use async/await properly

---

For more help, visit: https://github.com/KunjShah95/lumina-search
