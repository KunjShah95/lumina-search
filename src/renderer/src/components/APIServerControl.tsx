import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface APIStatus {
    active: boolean
    port: number
    endpoints: number
    webhooks: number
}

interface Props {
    onClose: () => void
}

export default function APIServerControl({ onClose }: Props) {
    const [status, setStatus] = useState<APIStatus | null>(null)
    const [config, setConfig] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState(false)

    const loadData = async () => {
        setLoading(true)
        try {
            const [s, c] = await Promise.all([
                window.api.getAPIServerStatus(),
                window.api.getAPIServerConfig()
            ])
            setStatus(s)
            setConfig(c)
        } catch (err) {
            console.error('Failed to load API server data:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleToggle = async () => {
        if (!status) return
        setToggling(true)
        try {
            const active = await window.api.toggleAPIServer(!status.active)
            setStatus(prev => prev ? { ...prev, active } : null)
        } catch (err) {
            console.error('Failed to toggle API server:', err)
        } finally {
            setToggling(false)
        }
    }

    const handleUpdateConfig = async (newConfig: any) => {
        try {
            await window.api.updateAPIServerConfig(newConfig)
            setConfig((prev: any) => ({ ...prev, ...newConfig }))
        } catch (err) {
            console.error('Failed to update API config:', err)
        }
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
                className="api-server-panel"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
            >
                <div className="settings-header">
                    <span className="settings-title">🚀 Local API Server</span>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="api-server-body">
                    <div className="api-status-card" style={{
                        background: 'var(--bg-2)',
                        padding: '20px',
                        borderRadius: '12px',
                        marginBottom: '24px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <div style={{ fontSize: '14px', color: 'var(--text-3)', marginBottom: '4px' }}>Server Status</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: status?.active ? '#22c55e' : '#64748b',
                                    boxShadow: status?.active ? '0 0 8px #22c55e' : 'none'
                                }} />
                                <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-1)' }}>
                                    {status?.active ? 'Running' : 'Stopped'}
                                </span>
                            </div>
                        </div>
                        <button
                            className={`btn-${status?.active ? 'ghost' : 'primary'}`}
                            onClick={handleToggle}
                            disabled={toggling}
                        >
                            {toggling ? '...' : status?.active ? 'Stop Server' : 'Start Server'}
                        </button>
                    </div>

                    <div className="settings-group">
                        <label className="settings-label">Server Port</label>
                        <input
                            type="number"
                            className="settings-input"
                            value={config?.port || 8080}
                            onChange={(e) => handleUpdateConfig({ port: parseInt(e.target.value) })}
                        />
                        <p className="settings-hint">The port the server will listen on (default: 8080)</p>
                    </div>

                    <div className="settings-row">
                        <div style={{ fontSize: '14px' }}>
                            <div style={{ color: 'var(--text-1)', fontWeight: 500 }}>Authentication</div>
                            <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>Require an API key for all requests</div>
                        </div>
                        <input
                            type="checkbox"
                            checked={config?.authEnabled}
                            onChange={(e) => handleUpdateConfig({ authEnabled: e.target.checked })}
                        />
                    </div>

                    <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px', fontWeight: 600 }}>📡 Server Info</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                            <div>Endpoints: <span style={{ color: 'var(--accent)' }}>{status?.endpoints || 0}</span></div>
                            <div>Webhooks: <span style={{ color: 'var(--accent)' }}>{status?.webhooks || 0}</span></div>
                            <div style={{ gridColumn: 'span 2' }}>Base URL: <code style={{ color: 'var(--accent)', background: 'var(--bg-3)', padding: '2px 4px', borderRadius: '4px' }}>http://localhost:{config?.port || 8080}/api/v1</code></div>
                        </div>
                    </div>
                </div>

                <div className="settings-footer">
                    <button className="btn-primary" onClick={onClose}>Close</button>
                </div>
            </motion.div>
        </motion.div>
    )
}
