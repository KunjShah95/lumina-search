import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { addDocumentChunks } from './vectorStore';
import { createLogger } from '../services/logger';

const logger = createLogger('ingestion');

type PdfParseFn = (dataBuffer: Buffer) => Promise<{ text: string }>;

let pdfParseFn: PdfParseFn | null = null;

function getPdfParse(): PdfParseFn {
    if (pdfParseFn) {
        return pdfParseFn;
    }

    // NOTE:
    // Newer pdf-parse releases (v2+) rely on Web API polyfills (DOMMatrix, ImageData, Path2D)
    // and newer Node APIs (e.g. process.getBuiltinModule) that may not be available in
    // the Electron runtime Node version. Lazy-loading avoids app startup crash and scopes
    // incompatibility to PDF ingestion only.
    try {
        const mod = require('pdf-parse');
        const resolved = (mod?.default ?? mod) as PdfParseFn;
        if (typeof resolved !== 'function') {
            throw new Error('pdf-parse did not export a parser function');
        }
        pdfParseFn = resolved;
        return pdfParseFn;
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
            `Failed to initialize PDF parser in current runtime (Node ${process.versions.node}). ${reason}`
        );
    }
}

// Initialize the OpenAI client for generating embeddings
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
});

export interface Chunk {
    id: string;
    content: string;
    metadata: {
        source: string;
        sourceType: 'pdf' | 'txt' | 'md' | 'url';
        url?: string;
        title?: string;
    };
    vector?: number[];
}

const CHUNK_SIZE = 1000;

export class DocumentIngestion {
    async processFile(filePath: string): Promise<number> {
        const ext = path.extname(filePath).toLowerCase();
        const content = await this.readFile(filePath, ext);
        const chunks = this.splitText(content);

        const chunkObjects: Chunk[] = chunks.map((text, idx) => ({
            id: `chunk_${Date.now()}_${idx}`,
            content: text,
            metadata: {
                source: filePath,
                sourceType: this.getSourceType(ext),
                title: path.basename(filePath),
            },
        }));

        const records = await this.generateEmbeddings(chunkObjects);

        if (records.length > 0) {
            // records mapped to vectorStore requirement
            const vectorRecords = records.map(r => ({
                id: r.id,
                text: r.content,
                source: r.metadata.title || r.metadata.source,
                vector: r.vector!
            }));
            // Ingestion is standalone - no KB context
            await addDocumentChunks(filePath, vectorRecords);
            return records.length;
        }

        return 0;
    }

    async parseFile(filePath: string): Promise<{ content: string; type: 'pdf' | 'txt' | 'md' | 'url'; name: string }> {
        const ext = path.extname(filePath).toLowerCase();
        const content = await this.readFile(filePath, ext);
        if (!content) throw new Error("Could not parse file content");
        return {
            content,
            type: this.getSourceType(ext),
            name: path.basename(filePath)
        }
    }

    private async generateEmbeddings(chunks: Chunk[]): Promise<Chunk[]> {
        if (chunks.length === 0) return [];

        const batchSize = 10;
        const processedChunks: Chunk[] = [];

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const inputTexts = batch.map(c => c.content);

            try {
                // Ignore empty keys during local dev without explicit intent
                if (!process.env.OPENAI_API_KEY) {
                    logger.warn('OPENAI_API_KEY missing - skipping real embeddings. Creating dummy embeddings for test.');
                    batch.forEach(c => c.vector = Array(1536).fill(Math.random()));
                } else {
                    const response = await openai.embeddings.create({
                        model: "text-embedding-ada-002",
                        input: inputTexts,
                    });

                    response.data.forEach((data, index) => {
                        batch[index].vector = data.embedding;
                    });
                }
                processedChunks.push(...batch);
            } catch (error) {
                logger.error('Error generating embeddings for batch', error, { batchSize: batch.length });
            }
        }
        return processedChunks;
    }

    private async readFile(filePath: string, ext: string): Promise<string> {
        try {
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const parsePdf = getPdfParse();
                const data = await parsePdf(dataBuffer);
                return data.text;
            } else {
                return fs.readFileSync(filePath, 'utf-8');
            }
        } catch (error) {
            logger.error('Error reading file', error, { filePath });
            return '';
        }
    }

    private splitText(text: string): string[] {
        if (!text || text.trim().length === 0) return [];

        const chunks: string[] = [];
        const paragraphs = text.split(/\n\n+/);
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            const trimmed = paragraph.trim();
            if (!trimmed) continue;

            if (currentChunk.length + trimmed.length < CHUNK_SIZE) {
                currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                currentChunk = trimmed;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    private getSourceType(ext: string): 'pdf' | 'txt' | 'md' | 'url' {
        switch (ext) {
            case '.pdf': return 'pdf';
            case '.md': return 'md';
            case '.url': return 'url';
            default: return 'txt';
        }
    }
}

export const documentIngestion = new DocumentIngestion();
