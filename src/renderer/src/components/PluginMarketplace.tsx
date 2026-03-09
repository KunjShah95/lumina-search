import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Plugin {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: 'search' | 'postprocess' | 'tool' | 'integration'
  rating: number
  downloads: number
  icon?: string
  installed: boolean
  enabled: boolean
}

interface Props {
  onClose: () => void
}

const MOCK_PLUGINS: Plugin[] = [
  {
    id: 'arxiv-search',
    name: 'ArXiv Search',
    description: 'Search academic papers directly from ArXiv.org with citation formatting',
    author: 'Lumina Team',
    version: '1.0.0',
    category: 'search',
    rating: 4.8,
    downloads: 12500,
    installed: false,
    enabled: false,
  },
  {
    id: 'github-code',
    name: 'GitHub Code Search',
    description: 'Search code repositories on GitHub with syntax highlighting',
    author: 'Open Source',
    version: '2.1.0',
    category: 'search',
    rating: 4.5,
    downloads: 8900,
    installed: false,
    enabled: false,
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo Provider',
    description: 'Official DuckDuckGo search provider integration',
    author: 'Lumina Team',
    version: '1.2.0',
    category: 'search',
    rating: 4.2,
    downloads: 25000,
    installed: true,
    enabled: true,
  },
  {
    id: 'result-ranker',
    name: 'AI Result Ranker',
    description: 'Uses ML to re-rank search results based on user preferences',
    author: 'AI Labs',
    version: '1.5.0',
    category: 'postprocess',
    rating: 4.6,
    downloads: 5600,
    installed: false,
    enabled: false,
  },
  {
    id: 'notion-sync',
    name: 'Notion Sync',
    description: 'Sync search results and highlights to your Notion workspace',
    author: 'Productivity Hub',
    version: '0.9.0',
    category: 'integration',
    rating: 4.3,
    downloads: 3200,
    installed: false,
    enabled: false,
  },
  {
    id: 'zapier',
    name: 'Zapier Integration',
    description: 'Connect search results to 5000+ apps via Zapier webhooks',
    author: 'Zapier',
    version: '2.0.0',
    category: 'integration',
    rating: 4.7,
    downloads: 18000,
    installed: false,
    enabled: false,
  },
  {
    id: 'calculator',
    name: 'Quick Calculator',
    description: 'Inline calculator tool - type math expressions for instant results',
    author: 'Lumina Team',
    version: '1.0.0',
    category: 'tool',
    rating: 4.4,
    downloads: 15000,
    installed: true,
    enabled: true,
  },
  {
    id: 'translate',
    name: 'Quick Translate',
    description: 'Translate selected text to 100+ languages instantly',
    author: 'Polyglot',
    version: '1.3.0',
    category: 'tool',
    rating: 4.1,
    downloads: 9800,
    installed: false,
    enabled: false,
  },
]

export default function PluginMarketplace({ onClose }: Props) {
  const [plugins, setPlugins] = useState<Plugin[]>(MOCK_PLUGINS)
  const [activeTab, setActiveTab] = useState<'browse' | 'installed'>('browse')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)

  const categories = [
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'postprocess', label: 'Post-Process', icon: '⚙️' },
    { id: 'tool', label: 'Tools', icon: '🛠️' },
    { id: 'integration', label: 'Integrations', icon: '🔗' },
  ]

  const filteredPlugins = plugins.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || p.category === selectedCategory
    const matchesTab = activeTab === 'browse' ? !p.installed : p.installed
    return matchesSearch && matchesCategory && matchesTab
  })

  const handleInstall = async (pluginId: string) => {
    setInstalling(pluginId)
    await new Promise((r) => setTimeout(r, 1500))
    setPlugins((prev) =>
      prev.map((p) =>
        p.id === pluginId ? { ...p, installed: true, enabled: true } : p
      )
    )
    setInstalling(null)
  }

  const handleUninstall = (pluginId: string) => {
    setPlugins((prev) =>
      prev.map((p) =>
        p.id === pluginId ? { ...p, installed: false, enabled: false } : p
      )
    )
  }

  const handleToggle = (pluginId: string) => {
    setPlugins((prev) =>
      prev.map((p) =>
        p.id === pluginId ? { ...p, enabled: !p.enabled } : p
      )
    )
  }

  return (
    <motion.div
      className="settings-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e: React.MouseEvent) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="plugin-marketplace"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          width: 800,
          maxHeight: '80vh',
          background: 'var(--bg-1)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🧩</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Plugin Marketplace</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
                Extend Lumina Search with plugins
              </p>
            </div>
          </div>
          <button
            className="settings-close"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 12,
          }}
        >
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-2)',
              color: 'var(--text-1)',
              fontSize: 14,
            }}
          />
          <button
            onClick={() => setActiveTab('browse')}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'browse' ? 'var(--accent)' : 'var(--bg-2)',
              color: activeTab === 'browse' ? 'white' : 'var(--text-1)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Browse
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'installed' ? 'var(--accent)' : 'var(--bg-2)',
              color: activeTab === 'installed' ? 'white' : 'var(--text-1)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Installed
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              width: 180,
              padding: '16px 12px',
              borderRight: '1px solid var(--border)',
              overflowY: 'auto',
            }}
          >
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: 'none',
                background: !selectedCategory ? 'var(--bg-3)' : 'transparent',
                color: 'var(--text-1)',
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: 4,
              }}
            >
              All Plugins
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: selectedCategory === cat.id ? 'var(--bg-3)' : 'transparent',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredPlugins.map((plugin) => (
                <div
                  key={plugin.id}
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{plugin.name}</span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 10,
                            background: 'var(--bg-3)',
                            color: 'var(--text-2)',
                          }}
                        >
                          v{plugin.version}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-2)' }}>
                        {plugin.description}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-3)' }}>
                        <span>⭐ {plugin.rating}</span>
                        <span>📥 {plugin.downloads.toLocaleString()}</span>
                        <span>by {plugin.author}</span>
                      </div>
                    </div>
                    <div style={{ marginLeft: 16 }}>
                      {!plugin.installed ? (
                        <button
                          onClick={() => handleInstall(plugin.id)}
                          disabled={installing === plugin.id}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 6,
                            border: 'none',
                            background: 'var(--accent)',
                            color: 'white',
                            cursor: installing === plugin.id ? 'wait' : 'pointer',
                            fontWeight: 500,
                            opacity: installing === plugin.id ? 0.7 : 1,
                          }}
                        >
                          {installing === plugin.id ? 'Installing...' : 'Install'}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleToggle(plugin.id)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: plugin.enabled ? 'var(--accent)' : 'transparent',
                              color: plugin.enabled ? 'white' : 'var(--text-1)',
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            {plugin.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                          <button
                            onClick={() => handleUninstall(plugin.id)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: '1px solid #ef4444',
                              background: 'transparent',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredPlugins.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
                  No plugins found
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
