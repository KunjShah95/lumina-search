import * as fs from 'fs'
import * as path from 'path'

export interface GoldenEvalCase {
    id: string
    query: string
    generatedAnswer: string
    expectedEvidence: string[]
    latencyMs: number
    estimatedTokens: number
    maxLatencyMs?: number
    maxEstimatedTokens?: number
}

export interface EvalThresholds {
    minCaseScore: number
    minPassRate: number
    maxLatencyMsP95: number
    maxEstimatedTokensAvg: number
    maxScoreRegressionDrop: number
    maxPassRateRegressionDrop: number
}

export interface EvalCaseResult {
    id: string
    score: number
    passed: boolean
    citationCorrectness: number
    relevance: number
    latencyPass: boolean
    tokenPass: boolean
    reasons: string[]
}

export interface EvalRunSummary {
    runId: string
    createdAt: number
    datasetSize: number
    passCount: number
    passRate: number
    avgScore: number
    p95LatencyMs: number
    avgEstimatedTokens: number
}

export interface EvalRunResult {
    summary: EvalRunSummary
    thresholds: EvalThresholds
    cases: EvalCaseResult[]
}

export interface RegressionGateResult {
    pass: boolean
    reasons: string[]
}

export const DEFAULT_EVAL_THRESHOLDS: EvalThresholds = {
    minCaseScore: 0.62,
    minPassRate: 0.8,
    maxLatencyMsP95: 10000,
    maxEstimatedTokensAvg: 4500,
    maxScoreRegressionDrop: 0.05,
    maxPassRateRegressionDrop: 0.08,
}

export function runOfflineEvaluation(
    dataset: GoldenEvalCase[],
    thresholds: EvalThresholds = DEFAULT_EVAL_THRESHOLDS,
): EvalRunResult {
    const cases = dataset.map((item) => evaluateCase(item, thresholds))
    const passCount = cases.filter((c) => c.passed).length
    const passRate = dataset.length > 0 ? passCount / dataset.length : 0

    const avgScore = cases.length > 0
        ? cases.reduce((sum, c) => sum + c.score, 0) / cases.length
        : 0

    const latencies = dataset.map(d => d.latencyMs).sort((a, b) => a - b)
    const p95LatencyMs = percentile(latencies, 95)

    const avgEstimatedTokens = dataset.length > 0
        ? dataset.reduce((sum, d) => sum + d.estimatedTokens, 0) / dataset.length
        : 0

    const summary: EvalRunSummary = {
        runId: `eval_${Date.now()}`,
        createdAt: Date.now(),
        datasetSize: dataset.length,
        passCount,
        passRate: round(passRate, 4),
        avgScore: round(avgScore, 4),
        p95LatencyMs: round(p95LatencyMs, 0),
        avgEstimatedTokens: round(avgEstimatedTokens, 0),
    }

    return {
        summary,
        thresholds,
        cases,
    }
}

export function enforceRegressionGate(
    current: EvalRunResult,
    baseline: EvalRunResult,
): RegressionGateResult {
    const reasons: string[] = []

    if (current.summary.passRate < current.thresholds.minPassRate) {
        reasons.push(`Pass rate below threshold: ${current.summary.passRate} < ${current.thresholds.minPassRate}`)
    }

    if (current.summary.p95LatencyMs > current.thresholds.maxLatencyMsP95) {
        reasons.push(`p95 latency too high: ${current.summary.p95LatencyMs} > ${current.thresholds.maxLatencyMsP95}`)
    }

    if (current.summary.avgEstimatedTokens > current.thresholds.maxEstimatedTokensAvg) {
        reasons.push(`Average estimated tokens too high: ${current.summary.avgEstimatedTokens} > ${current.thresholds.maxEstimatedTokensAvg}`)
    }

    const scoreDrop = baseline.summary.avgScore - current.summary.avgScore
    if (scoreDrop > current.thresholds.maxScoreRegressionDrop) {
        reasons.push(`Average score regression too large: ${round(scoreDrop, 4)} > ${current.thresholds.maxScoreRegressionDrop}`)
    }

    const passRateDrop = baseline.summary.passRate - current.summary.passRate
    if (passRateDrop > current.thresholds.maxPassRateRegressionDrop) {
        reasons.push(`Pass rate regression too large: ${round(passRateDrop, 4)} > ${current.thresholds.maxPassRateRegressionDrop}`)
    }

    return {
        pass: reasons.length === 0,
        reasons,
    }
}

export function writeEvalRunArtifacts(result: EvalRunResult, outDir: string): { jsonPath: string; markdownPath: string } {
    fs.mkdirSync(outDir, { recursive: true })

    const datePart = new Date(result.summary.createdAt).toISOString().replace(/[:.]/g, '-')
    const base = `eval-${datePart}`
    const jsonPath = path.join(outDir, `${base}.json`)
    const markdownPath = path.join(outDir, `${base}.md`)

    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8')
    fs.writeFileSync(markdownPath, renderEvalMarkdown(result), 'utf-8')

    return { jsonPath, markdownPath }
}

export function generateWeeklyEvalDashboard(resultsDir: string, reportsDir: string): string {
    fs.mkdirSync(resultsDir, { recursive: true })
    fs.mkdirSync(reportsDir, { recursive: true })

    const files = fs.readdirSync(resultsDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.join(resultsDir, f))

    const parsed = files
        .map((fp) => {
            try {
                const raw = fs.readFileSync(fp, 'utf-8')
                return JSON.parse(raw) as EvalRunResult
            } catch {
                return null
            }
        })
        .filter((x): x is EvalRunResult => Boolean(x))
        .sort((a, b) => a.summary.createdAt - b.summary.createdAt)

    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const weekly = parsed.filter(p => p.summary.createdAt >= sevenDaysAgo)

    const target = weekly.length > 0 ? weekly : parsed
    const avgPassRate = target.length > 0 ? target.reduce((s, r) => s + r.summary.passRate, 0) / target.length : 0
    const avgScore = target.length > 0 ? target.reduce((s, r) => s + r.summary.avgScore, 0) / target.length : 0
    const latest = target[target.length - 1]

    const evalRoot = path.dirname(resultsDir)
    const onlineFeedbackPath = path.join(evalRoot, 'online-feedback.json')
    let onlineTotal = 0
    let onlinePositiveRate = 0
    let onlineCitationRate = 0

    if (fs.existsSync(onlineFeedbackPath)) {
        try {
            const feedback = JSON.parse(fs.readFileSync(onlineFeedbackPath, 'utf-8')) as Array<{ vote?: string; citedCorrectly?: boolean }>
            onlineTotal = feedback.length
            if (onlineTotal > 0) {
                onlinePositiveRate = feedback.filter(f => f.vote === 'up').length / onlineTotal
                const citationSet = feedback.filter(f => typeof f.citedCorrectly === 'boolean')
                onlineCitationRate = citationSet.length > 0
                    ? citationSet.filter(f => f.citedCorrectly === true).length / citationSet.length
                    : 0
            }
        } catch {
            // Ignore malformed feedback file; keep dashboard generation resilient.
        }
    }

    const lines = [
        '# Lumina Weekly Evaluation Dashboard',
        '',
        `Generated: ${new Date(now).toISOString()}`,
        `Runs considered: ${target.length}`,
        '',
        '## KPI Snapshot',
        '',
        `- Average pass rate: ${(avgPassRate * 100).toFixed(2)}%`,
        `- Average quality score: ${avgScore.toFixed(3)}`,
        latest ? `- Latest run p95 latency: ${latest.summary.p95LatencyMs}ms` : '- Latest run p95 latency: n/a',
        latest ? `- Latest run avg estimated tokens: ${latest.summary.avgEstimatedTokens}` : '- Latest run avg estimated tokens: n/a',
        `- Online feedback samples: ${onlineTotal}`,
        `- Online positive rate: ${(onlinePositiveRate * 100).toFixed(2)}%`,
        `- Online citation-correct rate: ${(onlineCitationRate * 100).toFixed(2)}%`,
        '',
        '## Recent Runs',
        '',
        '| Run ID | Created At | Pass Rate | Avg Score | P95 Latency (ms) | Avg Tokens |',
        '| --- | --- | ---: | ---: | ---: | ---: |',
        ...target.slice(-10).reverse().map((r) =>
            `| ${r.summary.runId} | ${new Date(r.summary.createdAt).toISOString()} | ${(r.summary.passRate * 100).toFixed(2)}% | ${r.summary.avgScore.toFixed(3)} | ${r.summary.p95LatencyMs} | ${r.summary.avgEstimatedTokens} |`,
        ),
        '',
    ]

    const dashboardPath = path.join(reportsDir, `weekly-eval-${new Date(now).toISOString().slice(0, 10)}.md`)
    fs.writeFileSync(dashboardPath, lines.join('\n'), 'utf-8')
    return dashboardPath
}

function evaluateCase(item: GoldenEvalCase, thresholds: EvalThresholds): EvalCaseResult {
    const reasons: string[] = []

    const citationCorrectness = scoreCitationCorrectness(item.generatedAnswer, item.expectedEvidence)
    const relevance = scoreRelevance(item.query, item.generatedAnswer)

    const latencyLimit = item.maxLatencyMs ?? thresholds.maxLatencyMsP95
    const tokenLimit = item.maxEstimatedTokens ?? thresholds.maxEstimatedTokensAvg

    const latencyPass = item.latencyMs <= latencyLimit
    const tokenPass = item.estimatedTokens <= tokenLimit

    if (!latencyPass) reasons.push(`Latency ${item.latencyMs}ms exceeds ${latencyLimit}ms`)
    if (!tokenPass) reasons.push(`Estimated tokens ${item.estimatedTokens} exceeds ${tokenLimit}`)

    const score = round(citationCorrectness * 0.55 + relevance * 0.45, 4)

    if (score < thresholds.minCaseScore) {
        reasons.push(`Case score ${score} below minimum ${thresholds.minCaseScore}`)
    }

    return {
        id: item.id,
        score,
        passed: score >= thresholds.minCaseScore && latencyPass && tokenPass,
        citationCorrectness,
        relevance,
        latencyPass,
        tokenPass,
        reasons,
    }
}

function scoreCitationCorrectness(answer: string, expectedEvidence: string[]): number {
    if (expectedEvidence.length === 0) return 1

    const lowerAnswer = answer.toLowerCase()
    const matched = expectedEvidence.filter((e) => lowerAnswer.includes(e.toLowerCase())).length

    return round(matched / expectedEvidence.length, 4)
}

function scoreRelevance(query: string, answer: string): number {
    const queryTerms = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)

    if (queryTerms.length === 0) return 0.6

    const lowerAnswer = answer.toLowerCase()
    let covered = 0
    for (const term of queryTerms) {
        if (lowerAnswer.includes(term)) covered++
    }

    const termCoverage = covered / queryTerms.length
    const lengthFactor = Math.min(answer.length / 700, 1)

    return round(termCoverage * 0.75 + lengthFactor * 0.25, 4)
}

function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0
    const idx = Math.ceil((p / 100) * values.length) - 1
    return values[Math.max(0, Math.min(idx, values.length - 1))]
}

function round(v: number, digits: number): number {
    const m = Math.pow(10, digits)
    return Math.round(v * m) / m
}

function renderEvalMarkdown(result: EvalRunResult): string {
    const lines = [
        '# Lumina Offline Evaluation Report',
        '',
        `Run ID: ${result.summary.runId}`,
        `Created: ${new Date(result.summary.createdAt).toISOString()}`,
        '',
        '## Summary',
        '',
        `- Dataset size: ${result.summary.datasetSize}`,
        `- Pass count: ${result.summary.passCount}`,
        `- Pass rate: ${(result.summary.passRate * 100).toFixed(2)}%`,
        `- Average score: ${result.summary.avgScore.toFixed(3)}`,
        `- p95 latency: ${result.summary.p95LatencyMs}ms`,
        `- Average estimated tokens: ${result.summary.avgEstimatedTokens}`,
        '',
        '## Case Results',
        '',
        '| Case | Score | Passed | Citation | Relevance | Latency | Tokens |',
        '| --- | ---: | :---: | ---: | ---: | :---: | :---: |',
        ...result.cases.map(c => `| ${c.id} | ${c.score.toFixed(3)} | ${c.passed ? '✅' : '❌'} | ${c.citationCorrectness.toFixed(3)} | ${c.relevance.toFixed(3)} | ${c.latencyPass ? '✅' : '❌'} | ${c.tokenPass ? '✅' : '❌'} |`),
        '',
    ]

    return lines.join('\n')
}
