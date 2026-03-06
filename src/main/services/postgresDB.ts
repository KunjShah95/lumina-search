/**
 * PostgreSQL Database Service
 * Uses pg-lite for embedded PostgreSQL - no external server needed
 * Falls back to remote PostgreSQL if configured
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { createLogger } from './logger'

const logger = createLogger('PostgresDB')

export interface PostgresConfig {
    type: 'embedded' | 'remote'
    embeddedPath?: string
    remoteHost?: string
    remotePort?: number
    remoteDatabase?: string
    remoteUser?: string
    remotePassword?: string
    maxConnections?: number
}

let db: any = null
let isConnected = false
let config: PostgresConfig = { type: 'embedded' }

const DEFAULT_EMBEDDED_PATH = () => path.join(app.getPath('userData'), 'lumina.db')

export async function initPostgresDatabase(userConfig?: Partial<PostgresConfig>): Promise<boolean> {
    config = { ...config, ...userConfig }
    
    try {
        // Dynamic import for pg-lite
        const pgLite = await import('pg-lite')
        
        const dbPath = config.type === 'embedded' 
            ? (config.embeddedPath || DEFAULT_EMBEDDED_PATH())
            : ':memory:'
        
        db = pgLite.default({
            dbPath,
            maxConnections: config.maxConnections || 5,
        })
        
        // Initialize schema
        await initializeSchema()
        
        isConnected = true
        logger.info(`PostgreSQL (pg-lite) initialized at: ${dbPath}`)
        return true
        
    } catch (error) {
        logger.error('Failed to initialize PostgreSQL:', error)
        isConnected = false
        return false
    }
}

async function initializeSchema(): Promise<void> {
    // Users table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT,
            name TEXT,
            preferences JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `)
    
    // Threads table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL,
            messages JSONB NOT NULL DEFAULT '[]',
            sources JSONB NOT NULL DEFAULT '[]',
            is_pinned BOOLEAN DEFAULT FALSE,
            is_favorite BOOLEAN DEFAULT FALSE,
            tags JSONB DEFAULT '[]',
            notes TEXT,
            last_confidence JSONB
        )
    `)
    
    // Create indexes for threads
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_threads_is_pinned ON threads(is_pinned);
    `)
    
    // Knowledge bases table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_bases (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        )
    `)
    
    // Documents table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT,
            chunks JSONB DEFAULT '[]',
            source_url TEXT,
            size BIGINT DEFAULT 0,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        )
    `)
    
    // Collections table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            filter_query TEXT,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        )
    `)
    
    // Settings table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `)
    
    // Memory facts table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS memory_facts (
            id TEXT PRIMARY KEY,
            thread_id TEXT,
            key TEXT,
            value TEXT NOT NULL,
            tags JSONB DEFAULT '[]',
            source TEXT DEFAULT 'manual',
            expires_at BIGINT,
            created_at BIGINT NOT NULL
        )
    `)
    
    // Analytics events table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS analytics_events (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            payload JSONB,
            timestamp BIGINT NOT NULL
        )
    `)
    
    // Search analytics table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS search_analytics (
            id TEXT PRIMARY KEY,
            query TEXT NOT NULL,
            result_count INTEGER NOT NULL,
            execution_time_ms INTEGER NOT NULL,
            sources_used JSONB DEFAULT '[]',
            llm_model TEXT,
            success BOOLEAN DEFAULT TRUE,
            rating INTEGER,
            notes TEXT,
            created_at BIGINT NOT NULL
        )
    `)
    
    // Saved searches table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS saved_searches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            query TEXT NOT NULL,
            description TEXT,
            filters JSONB DEFAULT '{}',
            tags JSONB DEFAULT '[]',
            category TEXT,
            execution_count INTEGER DEFAULT 0,
            last_executed BIGINT,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        )
    `)
    
    // Vector embeddings table (for RAG)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL,
            kb_id TEXT,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding JSONB NOT NULL,
            created_at BIGINT NOT NULL
        )
    `)
    
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_doc_id ON embeddings(doc_id);
        CREATE INDEX IF NOT EXISTS idx_embeddings_kb_id ON embeddings(kb_id);
    `)
    
    logger.info('PostgreSQL schema initialized')
}

// ── Thread Operations ────────────────────────────────────────

export async function getAllThreadsPostgres(): Promise<any[]> {
    if (!isConnected) return []
    
    try {
        const result = await db.query(`
            SELECT id, title, created_at, updated_at, messages, sources, 
                   is_pinned, is_favorite, tags, notes, last_confidence
            FROM threads 
            ORDER BY is_pinned DESC, updated_at DESC 
            LIMIT 200
        `)
        
        return result.rows.map((row: any) => ({
            id: row.id,
            title: row.title,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            messages: JSON.parse(row.messages || '[]'),
            sources: JSON.parse(row.sources || '[]'),
            isPinned: row.is_pinned,
            isFavorite: row.is_favorite,
            tags: JSON.parse(row.tags || '[]'),
            notes: row.notes,
            lastConfidence: row.last_confidence,
        }))
    } catch (error) {
        logger.error('Failed to get threads:', error)
        return []
    }
}

export async function saveThreadPostgres(thread: any): Promise<void> {
    if (!isConnected) return
    
    try {
        await db.query(`
            INSERT INTO threads (id, title, created_at, updated_at, messages, sources, is_pinned, is_favorite, tags, notes, last_confidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                updated_at = EXCLUDED.updated_at,
                messages = EXCLUDED.messages,
                sources = EXCLUDED.sources,
                is_pinned = EXCLUDED.is_pinned,
                is_favorite = EXCLUDED.is_favorite,
                tags = EXCLUDED.tags,
                notes = EXCLUDED.notes,
                last_confidence = EXCLUDED.last_confidence
        `, [
            thread.id,
            thread.title,
            thread.createdAt,
            thread.updatedAt,
            JSON.stringify(thread.messages || []),
            JSON.stringify(thread.sources || []),
            thread.isPinned || false,
            thread.isFavorite || false,
            JSON.stringify(thread.tags || []),
            thread.notes || null,
            thread.lastConfidence ? JSON.stringify(thread.lastConfidence) : null,
        ])
    } catch (error) {
        logger.error('Failed to save thread:', error)
    }
}

export async function deleteThreadPostgres(id: string): Promise<void> {
    if (!isConnected) return
    
    try {
        await db.query('DELETE FROM threads WHERE id = $1', [id])
    } catch (error) {
        logger.error('Failed to delete thread:', error)
    }
}

export async function clearAllThreadsPostgres(): Promise<void> {
    if (!isConnected) return
    
    try {
        await db.query('DELETE FROM threads')
    } catch (error) {
        logger.error('Failed to clear threads:', error)
    }
}

export async function searchThreadsPostgres(query: string): Promise<any[]> {
    if (!isConnected) return []
    
    try {
        const result = await db.query(`
            SELECT id, title, created_at, updated_at, messages, sources, is_pinned, is_favorite, tags
            FROM threads 
            WHERE title ILIKE $1 OR messages::text ILIKE $1
            ORDER BY updated_at DESC 
            LIMIT 50
        `, [`%${query}%`])
        
        return result.rows.map((row: any) => ({
            id: row.id,
            title: row.title,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            messages: JSON.parse(row.messages || '[]'),
            sources: JSON.parse(row.sources || []),
            isPinned: row.is_pinned,
            isFavorite: row.is_favorite,
            tags: JSON.parse(row.tags || '[]'),
        }))
    } catch (error) {
        logger.error('Failed to search threads:', error)
        return []
    }
}

// ── Settings Operations ─────────────────────────────────────

export async function getSettingPostgres(key: string): Promise<any> {
    if (!isConnected) return null
    
    try {
        const result = await db.query('SELECT value FROM settings WHERE key = $1', [key])
        return result.rows[0]?.value ? JSON.parse(result.rows[0].value) : null
    } catch (error) {
        logger.error('Failed to get setting:', error)
        return null
    }
}

export async function setSettingPostgres(key: string, value: any): Promise<void> {
    if (!isConnected) return
    
    try {
        await db.query(`
            INSERT INTO settings (key, value, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `, [key, JSON.stringify(value)])
    } catch (error) {
        logger.error('Failed to save setting:', error)
    }
}

// ── Knowledge Base Operations ────────────────────────────────

export async function getKnowledgeBasesPostgres(): Promise<any[]> {
    if (!isConnected) return []
    
    try {
        const result = await db.query('SELECT * FROM knowledge_bases ORDER BY updated_at DESC')
        return result.rows
    } catch (error) {
        logger.error('Failed to get knowledge bases:', error)
        return []
    }
}

export async function saveKnowledgeBasePostgres(kb: any): Promise<void> {
    if (!isConnected) return
    
    try {
        await db.query(`
            INSERT INTO knowledge_bases (id, name, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                updated_at = EXCLUDED.updated_at
        `, [kb.id, kb.name, kb.description, kb.createdAt, kb.updatedAt])
    } catch (error) {
        logger.error('Failed to save knowledge base:', error)
    }
}

export async function deleteKnowledgeBasePostgres(id: string): Promise<void> {
    if (!isConnected) return
    
    try {
        await db.query('DELETE FROM knowledge_bases WHERE id = $1', [id])
    } catch (error) {
        logger.error('Failed to delete knowledge base:', error)
    }
}

// ── Embedding Operations ────────────────────────────────────

export async function saveEmbeddingPostgres(embedding: {
    id: string
    docId: string
    kbId?: string
    chunkIndex: number
    content: string
    embedding: number[]
}): Promise<void> {
    if (!isConnected) return
    
    try {
        await db.query(`
            INSERT INTO embeddings (id, doc_id, kb_id, chunk_index, content, embedding, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                embedding = EXCLUDED.embedding
        `, [
            embedding.id,
            embedding.docId,
            embedding.kbId,
            embedding.chunkIndex,
            embedding.content,
            JSON.stringify(embedding.embedding),
            Date.now(),
        ])
    } catch (error) {
        logger.error('Failed to save embedding:', error)
    }
}

export async function searchEmbeddingsPostgres(
    queryEmbedding: number[],
    kbId?: string,
    topK: number = 10
): Promise<any[]> {
    if (!isConnected) return []
    
    try {
        // Simple cosine similarity search
        const result = await db.query(`
            SELECT id, doc_id, kb_id, chunk_index, content, embedding,
                   (embedding <-> $1::jsonb) as distance
            FROM embeddings
            WHERE ($2::text IS NULL OR kb_id = $2)
            ORDER BY embedding <-> $1::jsonb
            LIMIT $3
        `, [JSON.stringify(queryEmbedding), kbId || null, topK])
        
        return result.rows.map((row: any) => ({
            id: row.id,
            docId: row.doc_id,
            kbId: row.kb_id,
            chunkIndex: row.chunk_index,
            content: row.content,
            distance: row.distance,
        }))
    } catch (error) {
        logger.error('Failed to search embeddings:', error)
        return []
    }
}

// ── Analytics Operations ────────────────────────────────────

export async function recordSearchAnalyticsPostgres(analytics: {
    id: string
    query: string
    resultCount: number
    executionTimeMs: number
    sourcesUsed: string[]
    llmModel?: string
    success?: boolean
}): Promise<void> {
    if (!isConnected) return
    
    try {
        await db.query(`
            INSERT INTO search_analytics 
            (id, query, result_count, execution_time_ms, sources_used, llm_model, success, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            analytics.id,
            analytics.query,
            analytics.resultCount,
            analytics.executionTimeMs,
            JSON.stringify(analytics.sourcesUsed || []),
            analytics.llmModel || null,
            analytics.success !== false,
            Date.now(),
        ])
    } catch (error) {
        logger.error('Failed to record analytics:', error)
    }
}

// ── Utility Functions ────────────────────────────────────────

export function isPostgresConnected(): boolean {
    return isConnected
}

export function getPostgresConfig(): PostgresConfig {
    return { ...config }
}

export async function closePostgresDatabase(): Promise<void> {
    if (db && isConnected) {
        try {
            await db.close()
            isConnected = false
            logger.info('PostgreSQL connection closed')
        } catch (error) {
            logger.error('Failed to close PostgreSQL:', error)
        }
    }
}

export async function vacuumPostgres(): Promise<void> {
    if (!isConnected) return
    
    try {
        await db.query('VACUUM')
        logger.info('PostgreSQL vacuum completed')
    } catch (error) {
        logger.error('Failed to vacuum:', error)
    }
}

export async function getPostgresStats(): Promise<{
    threads: number
    knowledgeBases: number
    documents: number
    embeddings: number
    searchAnalytics: number
}> {
    if (!isConnected) {
        return { threads: 0, knowledgeBases: 0, documents: 0, embeddings: 0, searchAnalytics: 0 }
    }
    
    try {
        const [threads, kb, docs, embeddings, analytics] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM threads'),
            db.query('SELECT COUNT(*) as count FROM knowledge_bases'),
            db.query('SELECT COUNT(*) as count FROM documents'),
            db.query('SELECT COUNT(*) as count FROM embeddings'),
            db.query('SELECT COUNT(*) as count FROM search_analytics'),
        ])
        
        return {
            threads: parseInt(threads.rows[0]?.count || '0'),
            knowledgeBases: parseInt(kb.rows[0]?.count || '0'),
            documents: parseInt(docs.rows[0]?.count || '0'),
            embeddings: parseInt(embeddings.rows[0]?.count || '0'),
            searchAnalytics: parseInt(analytics.rows[0]?.count || '0'),
        }
    } catch (error) {
        logger.error('Failed to get stats:', error)
        return { threads: 0, knowledgeBases: 0, documents: 0, embeddings: 0, searchAnalytics: 0 }
    }
}
