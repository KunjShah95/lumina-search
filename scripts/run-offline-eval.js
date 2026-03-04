const fs = require('fs')
const path = require('path')

function round(v, d) {
  const m = Math.pow(10, d)
  return Math.round(v * m) / m
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

function scoreCitation(answer, expected) {
  if (!expected.length) return 1
  const lower = answer.toLowerCase()
  const m = expected.filter(e => lower.includes(String(e).toLowerCase())).length
  return round(m / expected.length, 4)
}

function scoreRelevance(query, answer) {
  const terms = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3)
  if (!terms.length) return 0.6
  const lower = answer.toLowerCase()
  let covered = 0
  for (const t of terms) {
    if (lower.includes(t)) covered++
  }
  const coverage = covered / terms.length
  const lengthFactor = Math.min(answer.length / 700, 1)
  return round(coverage * 0.75 + lengthFactor * 0.25, 4)
}

function evaluateCase(item, thresholds) {
  const citation = scoreCitation(item.generatedAnswer, item.expectedEvidence || [])
  const relevance = scoreRelevance(item.query, item.generatedAnswer)
  const score = round(citation * 0.55 + relevance * 0.45, 4)

  const latencyLimit = item.maxLatencyMs || thresholds.maxLatencyMsP95
  const tokenLimit = item.maxEstimatedTokens || thresholds.maxEstimatedTokensAvg

  const latencyPass = item.latencyMs <= latencyLimit
  const tokenPass = item.estimatedTokens <= tokenLimit
  const passed = score >= thresholds.minCaseScore && latencyPass && tokenPass

  const reasons = []
  if (score < thresholds.minCaseScore) reasons.push(`score ${score} < ${thresholds.minCaseScore}`)
  if (!latencyPass) reasons.push(`latency ${item.latencyMs} > ${latencyLimit}`)
  if (!tokenPass) reasons.push(`tokens ${item.estimatedTokens} > ${tokenLimit}`)

  return {
    id: item.id,
    score,
    passed,
    citationCorrectness: citation,
    relevance,
    latencyPass,
    tokenPass,
    reasons,
  }
}

function run() {
  const repoRoot = process.cwd()
  const evalDir = path.join(repoRoot, 'resources', 'eval')
  const datasetPath = path.join(evalDir, 'golden-queries.json')
  const baselinePath = path.join(evalDir, 'baseline.json')
  const resultsDir = path.join(evalDir, 'results')
  const reportsDir = path.join(evalDir, 'reports')

  fs.mkdirSync(resultsDir, { recursive: true })
  fs.mkdirSync(reportsDir, { recursive: true })

  const thresholds = {
    minCaseScore: 0.62,
    minPassRate: 0.8,
    maxLatencyMsP95: 10000,
    maxEstimatedTokensAvg: 4500,
    maxScoreRegressionDrop: 0.05,
    maxPassRateRegressionDrop: 0.08,
  }

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'))
  const cases = dataset.map(item => evaluateCase(item, thresholds))
  const passCount = cases.filter(c => c.passed).length
  const summary = {
    runId: `eval_${Date.now()}`,
    createdAt: Date.now(),
    datasetSize: dataset.length,
    passCount,
    passRate: round(dataset.length ? passCount / dataset.length : 0, 4),
    avgScore: round(cases.length ? cases.reduce((s, c) => s + c.score, 0) / cases.length : 0, 4),
    p95LatencyMs: round(percentile(dataset.map(d => d.latencyMs), 95), 0),
    avgEstimatedTokens: round(dataset.length ? dataset.reduce((s, d) => s + d.estimatedTokens, 0) / dataset.length : 0, 0),
  }

  const runResult = { summary, thresholds, cases }

  const stamp = new Date(summary.createdAt).toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(resultsDir, `eval-${stamp}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(runResult, null, 2), 'utf-8')

  const md = [
    '# Lumina Offline Evaluation Report',
    '',
    `Run ID: ${summary.runId}`,
    `Created: ${new Date(summary.createdAt).toISOString()}`,
    '',
    `- Pass rate: ${(summary.passRate * 100).toFixed(2)}%`,
    `- Avg score: ${summary.avgScore.toFixed(3)}`,
    `- p95 latency: ${summary.p95LatencyMs}ms`,
    `- Avg estimated tokens: ${summary.avgEstimatedTokens}`,
    '',
  ].join('\n')

  const mdPath = path.join(reportsDir, `eval-${stamp}.md`)
  fs.writeFileSync(mdPath, md, 'utf-8')

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'))
  const scoreDrop = baseline.summary.avgScore - summary.avgScore
  const passRateDrop = baseline.summary.passRate - summary.passRate

  const gateReasons = []
  if (summary.passRate < thresholds.minPassRate) gateReasons.push('pass rate below threshold')
  if (summary.p95LatencyMs > thresholds.maxLatencyMsP95) gateReasons.push('latency threshold exceeded')
  if (summary.avgEstimatedTokens > thresholds.maxEstimatedTokensAvg) gateReasons.push('token threshold exceeded')
  if (scoreDrop > thresholds.maxScoreRegressionDrop) gateReasons.push('score regression too large')
  if (passRateDrop > thresholds.maxPassRateRegressionDrop) gateReasons.push('pass-rate regression too large')

  const shouldGate = process.argv.includes('--gate')
  if (shouldGate && gateReasons.length > 0) {
    console.error('Evaluation gate failed:', gateReasons.join('; '))
    process.exit(2)
  }

  // weekly dashboard
  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'))
  const parsed = files.map(f => JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf-8')))
    .sort((a, b) => a.summary.createdAt - b.summary.createdAt)
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const weekly = parsed.filter(r => r.summary.createdAt >= sevenDaysAgo)
  const target = weekly.length ? weekly : parsed
  const avgPass = target.length ? target.reduce((s, r) => s + r.summary.passRate, 0) / target.length : 0
  const avgScore = target.length ? target.reduce((s, r) => s + r.summary.avgScore, 0) / target.length : 0
  const latest = target[target.length - 1]

  let feedbackSummary = {
    total: 0,
    positiveRate: 0,
    citationCorrectRate: 0,
    last7dCount: 0,
  }

  const feedbackPath = path.join(evalDir, 'online-feedback.json')
  if (fs.existsSync(feedbackPath)) {
    try {
      const feedback = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8'))
      if (Array.isArray(feedback) && feedback.length > 0) {
        const positives = feedback.filter(f => f.vote === 'up').length
        const withCitation = feedback.filter(f => typeof f.citedCorrectly === 'boolean')
        const citationCorrect = withCitation.filter(f => f.citedCorrectly === true).length
        const sevenDaysAgoFeedback = now - 7 * 24 * 60 * 60 * 1000
        const last7dCount = feedback.filter(f => typeof f.createdAt === 'number' && f.createdAt >= sevenDaysAgoFeedback).length

        feedbackSummary = {
          total: feedback.length,
          positiveRate: positives / feedback.length,
          citationCorrectRate: withCitation.length > 0 ? citationCorrect / withCitation.length : 0,
          last7dCount,
        }
      }
    } catch {
      // Ignore malformed feedback file to keep weekly dashboard generation resilient.
    }
  }

  const dashboard = [
    '# Lumina Weekly Evaluation Dashboard',
    '',
    `Generated: ${new Date(now).toISOString()}`,
    `Runs considered: ${target.length}`,
    '',
    `- Average pass rate: ${(avgPass * 100).toFixed(2)}%`,
    `- Average score: ${avgScore.toFixed(3)}`,
    latest ? `- Latest p95 latency: ${latest.summary.p95LatencyMs}ms` : '- Latest p95 latency: n/a',
    latest ? `- Latest avg estimated tokens: ${latest.summary.avgEstimatedTokens}` : '- Latest avg estimated tokens: n/a',
    '',
    '## Online feedback summary',
    `- Total feedback entries: ${feedbackSummary.total}`,
    `- Positive vote rate: ${(feedbackSummary.positiveRate * 100).toFixed(2)}%`,
    `- Citation correct rate: ${(feedbackSummary.citationCorrectRate * 100).toFixed(2)}%`,
    `- Entries in last 7 days: ${feedbackSummary.last7dCount}`,
    '',
  ].join('\n')

  const weeklyPath = path.join(reportsDir, `weekly-eval-${new Date(now).toISOString().slice(0, 10)}.md`)
  fs.writeFileSync(weeklyPath, dashboard, 'utf-8')

  console.log(`Offline evaluation completed: ${jsonPath}`)
  console.log(`Weekly dashboard: ${weeklyPath}`)
}

run()
