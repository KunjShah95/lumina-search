# Lumina Search Plugin SDK

This document describes how to create plugins for Lumina Search.

## Overview

Lumina Search supports extensible plugins that can:
- Add custom search providers
- Post-process search results
- Add custom tools and utilities

## Plugin Structure

Each plugin must have a `manifest.json` file in its root directory:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "type": "search|postprocess|tool",
  "entryPoint": "index.js"
}
```

## Plugin Types

### Search Plugins

Search plugins can add new search providers:

```javascript
// search-plugin/index.js
module.exports = {
  // Plugin metadata
  manifest: {
    name: 'my-search',
    type: 'search'
  },
  
  // Search function
  async search(query, options) {
    // Your search implementation
    return {
      results: [
        {
          url: 'https://example.com',
          title: 'Example Result',
          snippet: 'Description here...',
          domain: 'example.com'
        }
      ]
    }
  }
}
```

### Post-Process Plugins

Post-process plugins can modify search results:

```javascript
// postprocess-plugin/index.js
module.exports = {
  manifest: {
    name: 'my-postprocess',
    type: 'postprocess'
  },
  
  // Process results after search
  async process(query, results, context) {
    // Modify or filter results
    return results.map(r => ({
      ...r,
      title: `[Custom] ${r.title}`
    }))
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
    'summarize': async (text) => {
      // Summarize text
      return 'Summary...'
    },
    'translate': async (text, targetLang) => {
      // Translate text
      return 'Translated...'
    }
  }
}
```

## Plugin Hooks

Plugins can register to receive events:

```javascript
// hooks.js
module.exports = {
  // Called before search starts
  'search:before': async (query, options) => {
    console.log('Search starting:', query)
    return { query, options }
  },
  
  // Called after search completes
  'search:after': async (results, query) => {
    console.log('Search complete:', results.length, 'results')
    return results
  },
  
  // Called when exporting
  'export:format': async (format, data) => {
    console.log('Exporting as:', format)
    return data
  }
}
```

## Custom Search Operators

Plugins can add custom search operators:

```javascript
// operator-plugin/index.js
module.exports = {
  manifest: {
    name: 'custom-operator',
    type: 'tool'
  },
  
  // Register custom operators
  operators: {
    'custom:': async (value, query) => {
      // Handle custom:operator syntax
      return { filtered: true, value }
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
      description: 'API key for the service'
    },
    maxResults: {
      type: 'number',
      default: 10,
      description: 'Maximum results to return'
    }
  },
  
  // Validate settings
  validate(settings) {
    if (!settings.apiKey) {
      throw new Error('API key is required')
    }
    return true
  }
}
```

## Installation

1. Create a folder in `~/LuminaSearch/plugins/`
2. Add your `manifest.json` and plugin code
3. Restart Lumina Search
4. The plugin will be auto-loaded

## Example: Weather Search Plugin

```
plugins/weather-search/
├── manifest.json
└── index.js
```

```json
{
  "name": "weather-search",
  "version": "1.0.0",
  "description": "Search weather information",
  "author": "Example",
  "type": "search",
  "entryPoint": "index.js"
}
```

```javascript
// index.js
module.exports = {
  manifest: {
    name: 'weather-search',
    type: 'search'
  },
  
  async search(query) {
    const city = query.replace('weather in ', '').trim()
    const response = await fetch(`https://api.weather.com?q=${city}`)
    const data = await response.json()
    
    return {
      results: [{
        url: `https://weather.com/${city}`,
        title: `Weather in ${city}`,
        snippet: `Temperature: ${data.temp}°F, ${data.condition}`,
        domain: 'weather.com'
      }]
    }
  }
}
```

## Best Practices

1. **Error Handling** - Always wrap async operations in try/catch
2. **Performance** - Cache expensive operations when possible
3. **Validation** - Validate all user inputs
4. **Logging** - Use console.log for debugging (logs are captured)
5. **Versioning** - Follow semantic versioning

## API Reference

### Plugin Context

Plugins receive a context object:

```javascript
{
  app: {
    version: '1.1.0',
    dataPath: '/path/to/data'
  },
  settings: {
    theme: 'dark',
    language: 'en'
  },
  storage: {
    get(key),
    set(key, value)
  },
  http: {
    fetch(url, options)
  }
}
```

### Settings Storage

```javascript
// Save plugin-specific data
context.storage.set('myPlugin.lastQuery', query)

// Retrieve data
const lastQuery = context.storage.get('myPlugin.lastQuery')
```

---

For more help, visit: https://github.com/KunjShah95/lumina-search
