import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
    initDatabase,
    createKnowledgeBase,
    addDocumentToKnowledgeBase,
    deleteKnowledgeBase,
    exportKnowledgeBaseSnapshot,
    importKnowledgeBaseSnapshot,
} from '../src/main/services/database'

describe('Knowledge Base Snapshots', () => {
    it('exports and imports a snapshot successfully', async () => {
        initDatabase()
        const kb = createKnowledgeBase('snapshot-test-kb', 'kb for snapshot test')

        await addDocumentToKnowledgeBase(
            kb.id,
            'doc-1.md',
            'md',
            'This is document content for snapshot roundtrip.',
        )

        const outFile = path.join('/tmp/electron-test/userData', `snapshot_${Date.now()}.json`)
        const exported = exportKnowledgeBaseSnapshot(kb.id, outFile)

        expect(exported.success).toBe(true)
        expect(fs.existsSync(exported.filePath)).toBe(true)
        expect(exported.manifest.docCount).toBeGreaterThan(0)

        const imported = importKnowledgeBaseSnapshot(exported.filePath)
        expect(imported.success).toBe(true)
        expect(imported.compatibility.compatible).toBe(true)

        deleteKnowledgeBase(kb.id)
    })

    it('detects corrupted snapshots via hash validation', async () => {
        initDatabase()
        const kb = createKnowledgeBase('snapshot-corruption-kb', 'kb for corruption test')

        await addDocumentToKnowledgeBase(
            kb.id,
            'doc-2.md',
            'md',
            'Original content before corruption check.',
        )

        const outFile = path.join('/tmp/electron-test/userData', `snapshot_corrupt_${Date.now()}.json`)
        const exported = exportKnowledgeBaseSnapshot(kb.id, outFile)

        const raw = fs.readFileSync(exported.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        parsed.knowledgeBase.documents[0].content = 'Tampered content that should fail hash validation.'
        fs.writeFileSync(exported.filePath, JSON.stringify(parsed, null, 2), 'utf-8')

        const imported = importKnowledgeBaseSnapshot(exported.filePath)
        expect(imported.success).toBe(false)
        expect(imported.errors?.join(' ')).toContain('Hash mismatch')

        deleteKnowledgeBase(kb.id)
    })
})
