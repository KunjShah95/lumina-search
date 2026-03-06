/**
 * Data Migration Service
 * Migrates data from JSON storage to PostgreSQL
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { createLogger } from './logger'
import { 
    getAllThreadsPostgres, 
    saveThreadPostgres, 
    getKnowledgeBasesPostgres, 
    saveKnowledgeBasePostgres,
    getSettingPostgres,
    setSettingPostgres,
    isPostgresConnected,
    getPostgresStats,
    recordSearchAnalyticsPostgres,
} from './postgresDB'
import { getAllThreads, getSettingsFromDb } from './database'

const logger = createLogger('Migration')

const MIGRATION_STATE_KEY = 'migration_state'
const CURRENT_VERSION = 3

interface MigrationState {
    version: number
    lastMigration: number
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    error?: string
}

export async function migrateFromJsonToPostgres(): Promise<{
    success: boolean
    migrated: number
    errors: string[]
}> {
    const errors: string[] = []
    let migrated = 0
    
    if (!isPostgresConnected()) {
        logger.warn('PostgreSQL not connected, skipping migration')
        return { success: false, migrated: 0, errors: ['PostgreSQL not connected'] }
    }
    
    try {
        // Check migration state
        const migrationState = await getMigrationState()
        
        if (migrationState?.status === 'completed') {
            logger.info('Migration already completed')
            return { success: true, migrated: 0, errors: [] }
        }
        
        // Mark migration as in progress
        await setMigrationState({ status: 'in_progress' })
        
        // Migrate threads
        const threadsMigrated = await migrateThreads()
        migrated += threadsMigrated
        logger.info(`Migrated ${threadsMigrated} threads`)
        
        // Migrate knowledge bases
        const kbMigrated = await migrateKnowledgeBases()
        migrated += kbMigrated
        logger.info(`Migrated ${kbMigrated} knowledge bases`)
        
        // Migrate settings
        await migrateSettings()
        
        // Mark migration as completed
        await setMigrationState({ 
            status: 'completed', 
            version: CURRENT_VERSION,
            lastMigration: Date.now(),
        })
        
        logger.info(`Migration completed: ${migrated} items migrated`)
        return { success: true, migrated, errors }
        
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        
        await setMigrationState({ 
            status: 'failed', 
            error: errorMsg,
        })
        
        logger.error('Migration failed:', errorMsg)
        return { success: false, migrated, errors }
    }
}

async function migrateThreads(): Promise<number> {
    let count = 0
    
    try {
        // Get existing threads from PostgreSQL
        const existingThreads = await getAllThreadsPostgres()
        const existingIds = new Set(existingThreads.map(t => t.id))
        
        // Get threads from JSON (fallback)
        const jsonThreads = getAllThreads()
        
        for (const thread of jsonThreads) {
            if (!existingIds.has(thread.id)) {
                await saveThreadPostgres(thread)
                count++
            }
        }
        
        // Also migrate from old JSON file if exists
        const oldDbPath = path.join(app.getPath('userData'), 'data.json')
        if (fs.existsSync(oldDbPath)) {
            try {
                const raw = fs.readFileSync(oldDbPath, 'utf-8')
                const parsed = JSON.parse(raw)
                
                if (parsed.threads && Array.isArray(parsed.threads)) {
                    for (const thread of parsed.threads) {
                        if (!existingIds.has(thread.id)) {
                            await saveThreadPostgres(thread)
                            count++
                        }
                    }
                }
            } catch (e) {
                logger.warn('Could not read old data.json', { error: String(e) })
            }
        }
        
    } catch (error) {
        logger.error('Thread migration failed:', error)
    }
    
    return count
}

async function migrateKnowledgeBases(): Promise<number> {
    let count = 0
    
    try {
        const existingKB = await getKnowledgeBasesPostgres()
        const existingIds = new Set(existingKB.map(kb => kb.id))
        
        // Try to get KB from old JSON file
        const oldDbPath = path.join(app.getPath('userData'), 'data.json')
        if (fs.existsSync(oldDbPath)) {
            const raw = fs.readFileSync(oldDbPath, 'utf-8')
            const parsed = JSON.parse(raw)
            
            if (parsed.knowledgeBases && Array.isArray(parsed.knowledgeBases)) {
                for (const kb of parsed.knowledgeBases) {
                    if (!existingIds.has(kb.id)) {
                        await saveKnowledgeBasePostgres(kb)
                        count++
                    }
                }
            }
        }
        
    } catch (error) {
        logger.error('Knowledge base migration failed:', error)
    }
    
    return count
}

async function migrateSettings(): Promise<void> {
    try {
        const settings = getSettingsFromDb()
        await setSettingPostgres('app_settings', settings)
        
        // Also check old JSON
        const oldDbPath = path.join(app.getPath('userData'), 'data.json')
        if (fs.existsSync(oldDbPath)) {
            const raw = fs.readFileSync(oldDbPath, 'utf-8')
            const parsed = JSON.parse(raw)
            
            if (parsed.settings) {
                for (const [key, value] of Object.entries(parsed.settings)) {
                    await setSettingPostgres(`legacy_${key}`, value)
                }
            }
        }
        
    } catch (error) {
        logger.error('Settings migration failed:', error)
    }
}

async function getMigrationState(): Promise<MigrationState | null> {
    try {
        const state = await getSettingPostgres(MIGRATION_STATE_KEY)
        return state as MigrationState | null
    } catch {
        return null
    }
}

async function setMigrationState(state: Partial<MigrationState>): Promise<void> {
    try {
        const current = await getMigrationState() || {
            version: 0,
            lastMigration: 0,
            status: 'pending' as const,
        }
        
        const merged = { ...current, ...state }
        
        // Use direct JSON string to avoid type issues
        await setSettingPostgres(MIGRATION_STATE_KEY, JSON.stringify(merged))
    } catch (error) {
        logger.error('Failed to set migration state:', error)
    }
}

export async function runMigrationIfNeeded(): Promise<void> {
    // Always try to migrate since PostgreSQL is now default
    await migrateFromJsonToPostgres()
}

export async function getMigrationStats(): Promise<{
    needsMigration: boolean
    postgresStats: {
        threads: number
        knowledgeBases: number
        documents: number
        embeddings: number
        searchAnalytics: number
    }
    migrationState: MigrationState | null
}> {
    const state = await getMigrationState()
    const pgStats = await getPostgresStats()
    
    const needsMigration = state?.status !== 'completed'
    
    return {
        needsMigration,
        postgresStats: pgStats,
        migrationState: state,
    }
}
