import { Document } from '../agents/types'

// Re-export from database
export {
    getKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    addDocumentToKnowledgeBase,
    deleteDocument,
    searchKnowledgeBase,
    searchAllKnowledgeBases,
    initKnowledgeBaseTables,
    exportKnowledgeBaseSnapshot,
    importKnowledgeBaseSnapshot,
} from './database'

export type { CrossKBSearchResult, SnapshotExportResult, SnapshotImportResult } from './database'
