import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import OpenAI from 'openai';
import { createLogger } from '../services/logger';

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

export async function initVectorStore(): Promise<void> {
    loadVectorStore();
    logger.info('Vector store initialized', { count: chunks.length });
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

        chunks = [...chunks, ...newChunks];
        saveVectorStore();
        logger.info('Added chunks for document', { count: newChunks.length, document: docNameStr });
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

        chunks = [...chunks, ...newChunks];
        saveVectorStore();
        logger.info('Added pre-processed chunks for document', { count: newChunks.length, document: docNameStr });
    }
}

export async function searchSimilar(
    queryText: string,
    limit: number = 5,
    kbId?: string
): Promise<{ text: string; source: string; score: number }[]> {
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

    return results;
}

export function clearKnowledgeBaseChunks(kbId: string): void {
    chunks = chunks.filter(c => c.kbId !== kbId);
    saveVectorStore();
}

export function deleteDocumentChunks(docId: string): void {
    chunks = chunks.filter(c => c.source !== docId);
    saveVectorStore();
}

export function getAllChunks(kbId?: string): { id: string; text: string; source: string; kbId: string }[] {
    const filtered = kbId ? chunks.filter(c => c.kbId === kbId) : chunks;
    return filtered.map(({ id, text, source, kbId }) => ({ id, text, source, kbId }));
}
