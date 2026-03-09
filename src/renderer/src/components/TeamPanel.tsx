import React, { useState } from 'react'
import { motion } from 'framer-motion'

interface Workspace {
  id: string
  name: string
  description?: string
  members: WorkspaceMember[]
  sharedKBs: string[]
}

interface WorkspaceMember {
  id: string
  email: string
  name: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  joinedAt: string
}

interface Props {
  onClose: () => void
  workspaces?: Workspace[]
  currentWorkspace?: Workspace | null
}

const MOCK_WORKSPACE: Workspace = {
  id: 'ws_1',
  name: 'Research Team',
  description: 'Shared research and knowledge management',
  members: [
    { id: '1', email: 'john@example.com', name: 'John Smith', role: 'owner', joinedAt: '2024-01-15' },
    { id: '2', email: 'jane@example.com', name: 'Jane Doe', role: 'editor', joinedAt: '2024-02-20' },
    { id: '3', email: 'bob@example.com', name: 'Bob Wilson', role: 'viewer', joinedAt: '2024-03-10' },
  ],
  sharedKBs: ['kb_1', 'kb_2'],
}

const ACTIVITY_MOCK = [
  { id: '1', user: 'Jane Doe', action: 'shared knowledge base', target: 'AI Research Papers', time: '2 hours ago' },
  { id: '2', user: 'John Smith', action: 'added member', target: 'bob@example.com', time: '5 hours ago' },
  { id: '3', user: 'Bob Wilson', action: 'performed search', target: 'RAG evaluation metrics', time: '1 day ago' },
  { id: '4', user: 'Jane Doe', action: 'updated knowledge base', target: 'ML Benchmarks', time: '2 days ago' },
]

const ROLE_COLORS: Record<string, string> = {
  owner: '#f59e0b',
  admin: '#8b5cf6',
  editor: '#22c55e',
  viewer: '#6b7280',
}

export default function TeamPanel({ onClose, workspaces = [MOCK_WORKSPACE], currentWorkspace = MOCK_WORKSPACE }: Props) {
  const [activeTab, setActiveTab] = useState<'members' | 'activity' | 'settings'>('members')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer')

  const workspace = currentWorkspace || workspaces[0]

  const handleInvite = () => {
    if (inviteEmail) {
      alert(`Invitation sent to ${inviteEmail} as ${inviteRole}`)
      setInviteEmail('')
      setShowInvite(false)
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
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          width: 700,
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
            <span style={{ fontSize: 24 }}>👥</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{workspace?.name || 'Team'}</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
                {workspace?.members.length} members · {workspace?.sharedKBs.length} shared knowledge bases
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

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['members', 'activity', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '14px',
                border: 'none',
                background: activeTab === tab ? 'var(--bg-2)' : 'transparent',
                color: activeTab === tab ? 'var(--text-1)' : 'var(--text-3)',
                cursor: 'pointer',
                fontWeight: 500,
                textTransform: 'capitalize',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {activeTab === 'members' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Team Members</h3>
                <button
                  onClick={() => setShowInvite(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--accent)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  + Invite Member
                </button>
              </div>

              {showInvite && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: 'var(--bg-2)',
                    marginBottom: 16,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="email"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-1)',
                      color: 'var(--text-1)',
                    }}
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-1)',
                      color: 'var(--text-1)',
                    }}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    onClick={handleInvite}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'var(--accent)',
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Send Invite
                  </button>
                  <button
                    onClick={() => setShowInvite(false)}
                    style={{
                      padding: '8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-2)',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {workspace?.members.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: 'var(--bg-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'var(--bg-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        color: 'var(--text-1)',
                      }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {member.name}
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 10,
                            background: ROLE_COLORS[member.role],
                            color: 'white',
                            textTransform: 'capitalize',
                          }}
                        >
                          {member.role}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{member.email}</div>
                    </div>
                    {member.role !== 'owner' && (
                      <button
                        style={{
                          padding: '6px 12px',
                          borderRadius: 4,
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--text-2)',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Recent Activity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ACTIVITY_MOCK.map((activity) => (
                  <div
                    key={activity.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: 'var(--bg-2)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--bg-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {activity.user.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13 }}>
                        <strong>{activity.user}</strong> {activity.action}{' '}
                        <span style={{ color: 'var(--accent)' }}>{activity.target}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Workspace Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: 'var(--bg-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>Allow member invites</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Allow members to invite others to this workspace
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked style={{ width: 20, height: 20 }} />
                </div>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: 'var(--bg-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>Require approval</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Require owner approval for new members
                    </div>
                  </div>
                  <input type="checkbox" style={{ width: 20, height: 20 }} />
                </div>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: 'var(--bg-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>Default KB sharing</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Default permission for shared knowledge bases
                    </div>
                  </div>
                  <select
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-1)',
                      color: 'var(--text-1)',
                    }}
                  >
                    <option value="view">View only</option>
                    <option value="edit">Can edit</option>
                    <option value="none">No sharing</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
