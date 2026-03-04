import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
    DEFAULT_EVAL_THRESHOLDS,
    EvalRunResult,
    GoldenEvalCase,
    enforceRegressionGate,
    generateWeeklyEvalDashboard,
    runOfflineEvaluation,
    writeEvalRunArtifacts,
} from '../src/main/services/evalHarness'

describe('Evaluation Harness', () => {
    const dataset: GoldenEvalCase[] = [
        {
            id: 'case_1',
            query: 'How does Lumina do hybrid retrieval?',
            generatedAnswer: 'Lumina combines bm25 and vector search with reciprocal rank fusion.',
            expectedEvidence: ['bm25', 'vector', 'reciprocal rank fusion'],
            latencyMs: 3200,
            estimatedTokens: 1800,
        },
        {
            id: 'case_2',
            query: 'What should happen during provider outage?',
            generatedAnswer: 'Use circuit breaker and fallback to local model with retries.',
            expectedEvidence: ['circuit breaker', 'fallback', 'retries'],
            latencyMs: 4200,
            estimatedTokens: 2200,
        },
    ]

    it('runs offline evaluation and computes summary metrics', () => {
        const result = runOfflineEvaluation(dataset)

        expect(result.summary.datasetSize).toBe(2)
        expect(result.summary.passRate).toBeGreaterThan(0)
        expect(result.summary.avgScore).toBeGreaterThan(0)
        expect(result.summary.p95LatencyMs).toBeGreaterThan(0)
        expect(result.cases.length).toBe(2)
    })

    it('enforces regression gates vs baseline', () => {
        const current = runOfflineEvaluation(dataset)

        const baseline: EvalRunResult = {
            summary: {
                runId: 'baseline',
                createdAt: Date.now() - 10000,
                datasetSize: 2,
                passCount: 2,
                passRate: 0.95,
                avgScore: 0.9,
                p95LatencyMs: 5000,
                avgEstimatedTokens: 2500,
            },
            thresholds: DEFAULT_EVAL_THRESHOLDS,
            cases: [],
        }

        const gate = enforceRegressionGate(current, baseline)
        expect(typeof gate.pass).toBe('boolean')
        expect(Array.isArray(gate.reasons)).toBe(true)
    })

    it('writes report artifacts and weekly dashboard', () => {
        const result = runOfflineEvaluation(dataset)

        const outDir = path.join('/tmp/electron-test/userData', `eval_artifacts_${Date.now()}`)
        const { jsonPath, markdownPath } = writeEvalRunArtifacts(result, outDir)

        expect(fs.existsSync(jsonPath)).toBe(true)
        expect(fs.existsSync(markdownPath)).toBe(true)

        const dashboardPath = generateWeeklyEvalDashboard(outDir, outDir)
        expect(fs.existsSync(dashboardPath)).toBe(true)
    })
})
