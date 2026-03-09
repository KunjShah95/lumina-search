/**
 * Workspace Service - Manages collaborative workspaces and teams
 */

import * as crypto from 'crypto'
import { createLogger } from './logger'

const logger = createLogger('WorkspaceService')

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface WorkspaceMember {
  id: string
  email: string
  name: string
  role: WorkspaceRole
  joinedAt: Date
  avatar?: string
}

export interface Workspace {
  id: string
  name: string
  description?: string
  createdAt: Date
  ownerId: string
  members: WorkspaceMember[]
  sharedKBs: string[]
  settings: WorkspaceSettings
  isActive: boolean
}

export interface WorkspaceSettings {
  allowMemberInvites: boolean
  requireApproval: boolean
  shareKBDefault: 'none' | 'view' | 'edit'
}

export interface ActivityLog {
  id: string
  workspaceId: string
  userId: string
  userName: string
  action: 'member_added' | 'member_removed' | 'role_changed' | 'kb_shared' | 'kb_unshared' | 'search_shared' | 'settings_changed'
  target?: string
  targetType?: 'member' | 'kb' | 'search' | 'settings'
  timestamp: Date
  metadata?: Record<string, any>
}

export class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map()
  private activityLogs: Map<string, ActivityLog[]> = new Map()

  constructor() {
    logger.info('WorkspaceManager initialized')
  }

  /**
   * Create a new workspace
   */
  createWorkspace(params: {
    name: string
    description?: string
    ownerId: string
    ownerEmail: string
    ownerName: string
  }): Workspace {
    const workspace: Workspace = {
      id: `ws_${crypto.randomUUID()}`,
      name: params.name,
      description: params.description,
      createdAt: new Date(),
      ownerId: params.ownerId,
      members: [
        {
          id: params.ownerId,
          email: params.ownerEmail,
          name: params.ownerName,
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
      sharedKBs: [],
      settings: {
        allowMemberInvites: true,
        requireApproval: false,
        shareKBDefault: 'view',
      },
      isActive: true,
    }

    this.workspaces.set(workspace.id, workspace)
    this.activityLogs.set(workspace.id, [])

    logger.info(`Created workspace: ${workspace.id}`)
    return workspace
  }

  /**
   * Get workspace by ID
   */
  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id)
  }

  /**
   * Get all workspaces for a user
   */
  getUserWorkspaces(userId: string): Workspace[] {
    return Array.from(this.workspaces.values()).filter(
      (ws) => ws.isActive && ws.members.some((m) => m.id === userId)
    )
  }

  /**
   * Invite member to workspace
   */
  inviteMember(
    workspaceId: string,
    params: {
      email: string
      name: string
      role: WorkspaceRole
      inviterId: string
    }
  ): { success: boolean; member?: WorkspaceMember; error?: string } {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    const inviter = workspace.members.find((m) => m.id === params.inviterId)
    if (!inviter || !['owner', 'admin'].includes(inviter.role)) {
      return { success: false, error: 'No permission to invite members' }
    }

    if (workspace.members.some((m) => m.email === params.email)) {
      return { success: false, error: 'Member already exists' }
    }

    const member: WorkspaceMember = {
      id: `member_${crypto.randomUUID()}`,
      email: params.email,
      name: params.name,
      role: params.role,
      joinedAt: new Date(),
    }

    workspace.members.push(member)

    this.logActivity(workspaceId, {
      userId: params.inviterId,
      userName: inviter.name,
      action: 'member_added',
      target: params.email,
      targetType: 'member',
    })

    logger.info(`Invited ${params.email} to workspace ${workspaceId}`)
    return { success: true, member }
  }

  /**
   * Remove member from workspace
   */
  removeMember(
    workspaceId: string,
    params: {
      memberId: string
      removerId: string
    }
  ): { success: boolean; error?: string } {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    const remover = workspace.members.find((m) => m.id === params.removerId)
    if (!remover || !['owner', 'admin'].includes(remover.role)) {
      return { success: false, error: 'No permission to remove members' }
    }

    const memberIndex = workspace.members.findIndex((m) => m.id === params.memberId)
    if (memberIndex === -1) {
      return { success: false, error: 'Member not found' }
    }

    const member = workspace.members[memberIndex]
    if (member.role === 'owner') {
      return { success: false, error: 'Cannot remove owner' }
    }

    workspace.members.splice(memberIndex, 1)

    this.logActivity(workspaceId, {
      userId: params.removerId,
      userName: remover.name,
      action: 'member_removed',
      target: member.email,
      targetType: 'member',
    })

    logger.info(`Removed ${member.email} from workspace ${workspaceId}`)
    return { success: true }
  }

  /**
   * Update member role
   */
  updateMemberRole(
    workspaceId: string,
    params: {
      memberId: string
      newRole: WorkspaceRole
      updaterId: string
    }
  ): { success: boolean; error?: string } {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    const updater = workspace.members.find((m) => m.id === params.updaterId)
    if (!updater || updater.role !== 'owner') {
      return { success: false, error: 'Only owner can change roles' }
    }

    const member = workspace.members.find((m) => m.id === params.memberId)
    if (!member) {
      return { success: false, error: 'Member not found' }
    }

    const oldRole = member.role
    member.role = params.newRole

    this.logActivity(workspaceId, {
      userId: params.updaterId,
      userName: updater.name,
      action: 'role_changed',
      target: member.email,
      targetType: 'member',
      metadata: { oldRole, newRole: params.newRole },
    })

    return { success: true }
  }

  /**
   * Share knowledge base with workspace
   */
  shareKnowledgeBase(
    workspaceId: string,
    params: {
      kbId: string
      shareWith: string
      permission: 'view' | 'edit'
      sharerId: string
    }
  ): { success: boolean; error?: string } {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    if (!workspace.sharedKBs.includes(params.kbId)) {
      workspace.sharedKBs.push(params.kbId)
    }

    const sharer = workspace.members.find((m) => m.id === params.sharerId)
    this.logActivity(workspaceId, {
      userId: params.sharerId,
      userName: sharer?.name || 'Unknown',
      action: 'kb_shared',
      target: params.kbId,
      targetType: 'kb',
      metadata: { shareWith: params.shareWith, permission: params.permission },
    })

    return { success: true }
  }

  /**
   * Unshare knowledge base
   */
  unshareKnowledgeBase(
    workspaceId: string,
    params: {
      kbId: string
      unshareFrom: string
      sharerId: string
    }
  ): { success: boolean; error?: string } {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    workspace.sharedKBs = workspace.sharedKBs.filter((id) => id !== params.kbId)

    const sharer = workspace.members.find((m) => m.id === params.sharerId)
    this.logActivity(workspaceId, {
      userId: params.sharerId,
      userName: sharer?.name || 'Unknown',
      action: 'kb_unshared',
      target: params.kbId,
      targetType: 'kb',
    })

    return { success: true }
  }

  /**
   * Get activity log for workspace
   */
  getActivityLog(workspaceId: string, limit = 50): ActivityLog[] {
    const logs = this.activityLogs.get(workspaceId) || []
    return logs.slice(-limit).reverse()
  }

  /**
   * Log activity
   */
  private logActivity(workspaceId: string, params: Omit<ActivityLog, 'id' | 'workspaceId' | 'timestamp'>): void {
    const log: ActivityLog = {
      id: `activity_${crypto.randomUUID()}`,
      workspaceId,
      ...params,
      timestamp: new Date(),
    }

    const logs = this.activityLogs.get(workspaceId) || []
    logs.push(log)
    this.activityLogs.set(workspaceId, logs)
  }

  /**
   * Delete workspace
   */
  deleteWorkspace(workspaceId: string, deleterId: string): { success: boolean; error?: string } {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    if (workspace.ownerId !== deleterId) {
      return { success: false, error: 'Only owner can delete workspace' }
    }

    workspace.isActive = false
    return { success: true }
  }

  /**
   * Export workspace data
   */
  exportWorkspace(workspaceId: string): string {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      throw new Error('Workspace not found')
    }

    return JSON.stringify(workspace, null, 2)
  }
}

let instance: WorkspaceManager | null = null

export function getWorkspaceManager(): WorkspaceManager {
  if (!instance) {
    instance = new WorkspaceManager()
  }
  return instance
}

export function resetWorkspaceManager(): void {
  instance = null
}
