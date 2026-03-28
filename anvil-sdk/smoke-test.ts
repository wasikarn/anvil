/**
 * Smoke test — validates non-LLM components of the SDK Review Engine.
 * Run with: node_modules/.bin/tsx smoke-test.ts
 */
import { readDiff } from './src/review/diff-reader.js'
import { mapToDomains } from './src/review/domain-mapper.js'
import { triage } from './src/review/triage.js'
import { consolidate } from './src/review/consolidator.js'
import { formatJson, formatMarkdown } from './src/review/output.js'
import type { Finding, ReviewReport } from './src/types.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ❌ ${name}: ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

console.log('\n=== SDK Review Engine Smoke Test ===\n')

// --- diff-reader ---
console.log('diff-reader')
test('readDiff returns array', () => {
  const files = readDiff({})
  assert(Array.isArray(files), 'expected array')
})

// --- domain-mapper ---
console.log('\ndomain-mapper')
const mockFiles = [
  { path: 'src/auth/guard.ts', hunks: '@@\n+const x = 1', language: 'typescript', diffLineCount: 1 },
  { path: 'src/components/Button.tsx', hunks: '@@\n+export {}', language: 'typescript', diffLineCount: 1 },
  { path: 'migrations/001.sql', hunks: '@@\n+CREATE TABLE', language: 'sql', diffLineCount: 1 },
  { path: 'src/unknown.py', hunks: '@@\n+pass', language: 'python', diffLineCount: 1 },
]
const buckets = mapToDomains(mockFiles)
test('returns 3 buckets', () => assert(buckets.length === 3, `got ${buckets.length}`))
test('correctness bucket has auth file', () => {
  const c = buckets.find(b => b.role === 'correctness')
  assert(c !== undefined && c.files.some(f => f.path.includes('guard')), 'missing auth file')
})
test('dx bucket has tsx file', () => {
  const d = buckets.find(b => b.role === 'dx')
  assert(d !== undefined && d.files.some(f => f.path.endsWith('.tsx')), 'missing tsx file')
})
test('architecture bucket has sql file', () => {
  const a = buckets.find(b => b.role === 'architecture')
  assert(a !== undefined && a.files.some(f => f.path.endsWith('.sql')), 'missing sql file')
})
test('unknown .py defaults to correctness', () => {
  const c = buckets.find(b => b.role === 'correctness')
  assert(c !== undefined && c.files.some(f => f.path.endsWith('.py')), 'missing .py in correctness')
})

// --- triage ---
console.log('\ntriage')
const mockFindings: Finding[] = [
  { severity: 'critical', rule: 'HR-no-any', file: 'a.ts', line: 1, confidence: 95, issue: 'any', fix: 'fix', isHardRule: true },
  { severity: 'info', rule: 'R8', file: 'b.ts', line: 2, confidence: 70, issue: 'style', fix: 'fix', isHardRule: false },
  { severity: 'info', rule: 'R9', file: 'c.ts', line: 3, confidence: 60, issue: 'noise', fix: 'fix', isHardRule: false },
  { severity: 'warning', rule: 'R3', file: 'd.ts', line: null, confidence: 85, issue: 'arch', fix: 'fix', isHardRule: false },
]
const { autoPass, autoDrop, mustFalsify } = triage(mockFindings)
test('Hard Rule critical confidence 95 → autoPass', () => assert(autoPass.length === 1, `got ${autoPass.length}`))
// autoDrop: severity === 'info' AND confidence <= 79 (both R8 and R9 qualify)
test('info confidence 60 → autoDrop', () => assert(autoDrop.some(f => f.rule === 'R9'), 'R9 missing from autoDrop'))
test('info confidence 70 → autoDrop (confidence 70 <= 79)', () => assert(autoDrop.some(f => f.rule === 'R8'), 'R8 missing from autoDrop'))
test('warning confidence 85 → mustFalsify', () => assert(mustFalsify.some(f => f.rule === 'R3'), 'R3 missing from mustFalsify'))
// Hard Rule with info severity + low confidence must NOT be auto-dropped — goes to mustFalsify
test('Hard Rule info confidence 75 → mustFalsify (never auto-dropped)', () => {
  const hardRuleInfo: Finding = { severity: 'info', rule: 'HR-low', file: 'e.ts', line: 5, confidence: 75, issue: 'x', fix: 'y', isHardRule: true }
  const { autoPass: ap, autoDrop: ad, mustFalsify: mf } = triage([hardRuleInfo])
  assert(ad.length === 0, `Hard Rule should not be auto-dropped, got autoDrop.length=${ad.length}`)
  assert(ap.length === 0, `conf < 90 should not be autoPass`)
  assert(mf.length === 1, `Hard Rule info low-conf should be in mustFalsify`)
})
test('no finding in multiple buckets', () => {
  const total = autoPass.length + autoDrop.length + mustFalsify.length
  assert(total === mockFindings.length, `total ${total} != ${mockFindings.length}`)
})

// --- consolidator ---
console.log('\nconsolidator')
test('consolidate with no verdicts returns autoPass findings', () => {
  const result = consolidate({
    autoPass: [mockFindings[0]!],
    mustFalsify: [],
    verdicts: [],
    confidenceThreshold: 80,
    patternCapCount: 3,
  })
  assert(result.length === 1, `got ${result.length}`)
})
test('consolidate sorts critical before warning', () => {
  const result = consolidate({
    autoPass: [mockFindings[3]!, mockFindings[0]!],
    mustFalsify: [],
    verdicts: [],
    confidenceThreshold: 80,
    patternCapCount: 3,
  })
  assert(result[0]?.severity === 'critical', `first is ${result[0]?.severity}`)
})
test('REJECTED verdict removes finding', () => {
  const result = consolidate({
    autoPass: [],
    mustFalsify: [mockFindings[3]!],
    verdicts: [{ findingIndex: 0, originalSummary: 'arch', verdict: 'REJECTED', rationale: 'false positive' }],
    confidenceThreshold: 80,
    patternCapCount: 3,
  })
  assert(result.length === 0, `expected 0, got ${result.length}`)
})
test('DOWNGRADED verdict updates severity', () => {
  const result = consolidate({
    autoPass: [],
    mustFalsify: [mockFindings[3]!],
    verdicts: [{ findingIndex: 0, originalSummary: 'arch', verdict: 'DOWNGRADED', newSeverity: 'info', rationale: 'minor' }],
    confidenceThreshold: 80,
    patternCapCount: 3,
  })
  assert(result[0]?.severity === 'info', `expected info, got ${result[0]?.severity}`)
})

// --- output ---
console.log('\noutput')
const mockReport: ReviewReport = {
  pr: 'feature/test',
  summary: { critical: 1, warning: 0, info: 0 },
  findings: [],
  strengths: [],
  verdict: 'REQUEST_CHANGES',
  cost: { total_usd: 0.1234, per_reviewer: [0.04, 0.04, 0.04] },
  tokens: { total: 5000, per_reviewer: [1500, 2000, 1500] },
}
test('formatJson produces valid JSON', () => {
  const json = formatJson(mockReport)
  const parsed = JSON.parse(json) as unknown
  assert(typeof parsed === 'object' && parsed !== null, 'not an object')
})
test('formatMarkdown contains PR name', () => {
  const md = formatMarkdown(mockReport)
  assert(md.includes('feature/test'), 'PR name missing')
})
test('formatMarkdown contains verdict', () => {
  const md = formatMarkdown(mockReport)
  assert(md.includes('REQUEST_CHANGES'), 'verdict missing')
})
test('formatMarkdown contains cost', () => {
  const md = formatMarkdown(mockReport)
  assert(md.includes('0.1234'), 'cost missing')
})

// --- summary ---
console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
