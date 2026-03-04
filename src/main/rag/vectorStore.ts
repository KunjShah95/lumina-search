import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import OpenAI from 'openai';
import { createLogger } from '../services/logger';
import * as lancedbStore from '../services/lancedbStore';

const logger = createLogger('vector-store');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

interface VectorChunk {
    id: string;
    text: string;
    source: string;
    kbId: string;
    vector: number[];
}

let chunks: VectorChunk[] = [];
let dbPath: string = '';
let useLanceDB = false;

function toLogMeta(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
        };
    }
    return { error: err };
}

function getDbPath(): string {
    if (!dbPath) {
        dbPath = path.join(app.getPath('userData'), 'vector_store.json');
    }
    return dbPath;
}

function loadVectorStore(): void {
    try {
        const filePath = getDbPath();
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            chunks = JSON.parse(data);
            logger.info('Loaded chunks from vector store', { count: chunks.length });
        }
    } catch (err) {
        logger.error('Failed to load vector store', err);
        chunks = [];
    }
}

function saveVectorStore(): void {
    try {
        fs.writeFileSync(getDbPath(), JSON.stringify(chunks, null, 2));
    } catch (err) {
        logger.error('Failed to save vector store', err);
    }
}

async function migrateJSONtoLanceDB(): Promise<void> {
    try {
        if (chunks.length === 0) {
            logger.info('No chunks to migrate from JSON');
            return;
        }

        const store = await lancedbStore.getLanceDBStore();
        logger.info('Starting migration of JSON chunks to LanceDB', { count: chunks.length });

        // Batch upsert chunks to LanceDB
        const batchSize = 100;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            await store.addChunks(batch);
            logger.info('Migrated batch to LanceDB', { start: i, count: batch.length });
        }

        logger.info('Migration to LanceDB complete', { total: chunks.length });
    } catch (err) {
        logger.error('Failed to migrate JSON chunks to LanceDB, falling back to JSON', err);
        // Continue with JSON fallback
    }
}

export async function initVectorStore(): Promise<void> {
    try {
        // Initialize LanceDB
        const store = await lancedbStore.getLanceDBStore();
        useLanceDB = true;
        logger.info('LanceDB initialized successfully');

        // Load JSON chunks for migration
        loadVectorStore();

        // Migrate existing JSON chunks to LanceDB if any
        if (chunks.length > 0) {
            await migrateJSONtoLanceDB();
        }

        logger.info('Vector store initialized with LanceDB', { chunkCount: chunks.length, useLanceDB });
    } catch (err) {
        logger.warn('Could not initialize LanceDB, falling back to JSON-only mode', toLogMeta(err));
        useLanceDB = false;
        loadVectorStore();
        logger.info('Vector store initialized in JSON fallback mode', { count: chunks.length });
    }
}

function cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
}

async function embedText(text: string): Promise<number[]> {
    if (!process.env.OPENAI_API_KEY) {
        logger.warn('No OPENAI_API_KEY - using random embeddings');
        return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text,
        });
        return response.data[0].embedding;
    } catch (err) {
        logger.error('Embedding failed', err);
        return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
}

export async function addDocumentChunks(
    kbIdOrDocName: string,
    docsOrTexts: string[] | { id: string; text: string; source: string; vector: number[] }[],
    docName?: string
): Promise<void> {
    const newChunks: VectorChunk[] = [];

    // Determine if we're receiving raw text chunks or pre-processed vector records
    if (typeof docsOrTexts[0] === 'string' || docsOrTexts[0].constructor.name === 'String') {
        // Text chunks mode
        const texts = docsOrTexts as string[];
        const docNameStr = docName || kbIdOrDocName;

        for (const text of texts) {
            if (!text.trim()) continue;
            const vector = await embedText(text);
            newChunks.push({
                id: crypto.randomUUID(),
                text,
                source: docNameStr,
                kbId: kbIdOrDocName,
                vector,
            });
        }

        // Update in-memory chunks
        chunks = [...chunks, ...newChunks];
        saveVectorStore();

        // Also add to LanceDB if available
        if (useLanceDB) {
            try {
                const store = await lancedbStore.getLanceDBStore();
                await store.addChunks(newChunks);
                logger.info('Added chunks to LanceDB', { count: newChunks.length, document: docNameStr });
            } catch (err) {
                logger.warn('Failed to add chunks to LanceDB, falling back to JSON', toLogMeta(err));
            }
        }

        logger.info('Added chunks for document', { count: newChunks.length, document: docNameStr, useLanceDB });
    } else {
        // Pre-processed records mode
        const records = docsOrTexts as { id: string; text: string; source: string; vector: number[] }[];
        const docNameStr = docName || kbIdOrDocName;

        for (const record of records) {
            newChunks.push({
                id: record.id,
                text: record.text,
                source: record.source,
                kbId: kbIdOrDocName,
                vector: record.vector,
            });
        }

        // Update in-memory chunks
        chunks = [...chunks, ...newChunks];
        saveVectorStore();

        // Also add to LanceDB if available
        if (useLanceDB) {
            try {
                const store = await lancedbStore.getLanceDBStore();
                await store.addChunks(newChunks);
                logger.info('Added pre-processed chunks to LanceDB', { count: newChunks.length, document: docNameStr });
            } catch (err) {
                logger.warn('Failed to add pre-processed chunks to LanceDB, falling back to JSON', toLogMeta(err));
            }
        }

        logger.info('Added pre-processed chunks for document', { count: newChunks.length, document: docNameStr, useLanceDB });
    }
}

export async function searchSimilar(
    queryText: string,
    limit: number = 5,
    kbId?: string
): Promise<{ text: string; source: string; score: number }[]> {
    // Try LanceDB-based search if available
    if (useLanceDB) {
        try {
            const store = await lancedbStore.getLanceDBStore();
            const results = await store.searchSimilar(queryText, limit, kbId);
            logger.info('Searched similar chunks via LanceDB', {
                query: queryText.substring(0, 50),
                limit,
                kbId,
                resultCount: results.length,
            });
            return results;
        } catch (err) {
            logger.warn('LanceDB search failed, falling back to JSON search', toLogMeta(err));
            useLanceDB = false;
        }
    }

    // Fallback to JSON-based search
    const queryEmbedding = await embedText(queryText);

    let searchChunks = chunks;
    if (kbId) {
        searchChunks = chunks.filter(c => c.kbId === kbId);
    }

    const results = searchChunks
        .map(chunk => ({
            ...chunk,
            score: cosineSimilarity(queryEmbedding, chunk.vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ text, source, score }) => ({ text, source, score }));

    logger.info('Searched similar chunks via JSON fallback', {
        query: queryText.substring(0, 50),
        limit,
        kbId,
        resultCount: results.length,
    });

    return results;
}

export async function clearKnowledgeBaseChunks(kbId: string): Promise<void> {
    chunks = chunks.filter(c => c.kbId !== kbId);
    saveVectorStore();

    if (useLanceDB) {
        try {
            const store = await lancedbStore.getLanceDBStore();
            await store.deleteChunks({ kbId });
            logger.info('Cleared knowledge base from LanceDB', { kbId });
        } catch (err) {
            logger.warn('Failed to clear knowledge base from LanceDB', toLogMeta(err));
        }
    }
}

export async function deleteDocumentChunks(docId: string): Promise<void> {
    chunks = chunks.filter(c => c.source !== docId);
    saveVectorStore();

    if (useLanceDB) {
        try {
            const store = await lancedbStore.getLanceDBStore();
            await store.deleteChunks({ source: docId });
            logger.info('Deleted document chunks from LanceDB', { docId });
        } catch (err) {
            logger.warn('Failed to delete document chunks from LanceDB', toLogMeta(err));
        }
    }
}

export function getAllChunks(kbId?: string): { id: string; text: string; source: string; kbId: string }[] {
    const filtered = kbId ? chunks.filter(c => c.kbId === kbId) : chunks;
    return filtered.map(({ id, text, source, kbId }) => ({ id, text, source, kbId }));
}

export async function getVectorStoreStats(): Promise<{
    mode: 'lancedb' | 'json';
    totalChunks: number;
    lancedbStats?: { [key: string]: any };
}> {
    try {
        if (useLanceDB) {
            const store = await lancedbStore.getLanceDBStore();
            const stats = await store.getStats();
            return {
                mode: 'lancedb',
                totalChunks: chunks.length,
                lancedbStats: stats,
            };
        }
    } catch (err) {
        logger.warn('Failed to get LanceDB stats', toLogMeta(err));
    }

    return {
        mode: 'json',
        totalChunks: chunks.length,
    };
}

export function getVectorStoreMode(): 'lancedb' | 'json' {
    return useLanceDB ? 'lancedb' : 'json';
}
