/**
 * Smoke test — validates non-LLM components of the SDK Review Engine.
 * Run with: node_modules/.bin/tsx smoke-test.ts
 */
import { readDiff } from './src/review/diff-reader.js'
import { mapToDomains } from './src/review/domain-mapper.js'
import { triage } from './src/review/triage.js'
import { consolidate } from './src/review/consolidator.js'
import { formatJson, formatMarkdown } from './src/review/output.js'
import type { Finding, ReviewReport, ReviewRole } from './src/types.js'
import { ChallengeResultSchema } from './src/plan/schemas/challenge.js'
import { InvestigationResultSchema } from './src/investigate/schemas/investigation.js'
import { parsePlanChallengeArgs, parseInvestigateArgs, parseFalsifyArgs } from './src/cli.js'

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
    perReviewer: [],
    autoPass: [mockFindings[0]!],
    verdicts: [],
    patternCapCount: 3,
  })
  assert(result.length === 1, `got ${result.length}`)
})
test('consolidate sorts critical before warning', () => {
  const result = consolidate({
    perReviewer: [],
    autoPass: [mockFindings[3]!, mockFindings[0]!],
    verdicts: [],
    patternCapCount: 3,
  })
  assert(result[0]?.severity === 'critical', `first is ${result[0]?.severity}`)
})
test('REJECTED verdict removes finding', () => {
  const finding3 = mockFindings[3]
  if (finding3 === undefined) throw new Error('mockFindings[3] missing')
  const result = consolidate({
    perReviewer: [{ role: 'correctness' as ReviewRole, findings: [finding3] }],
    autoPass: [],
    verdicts: [{ findingIndex: 0, originalSummary: 'arch', verdict: 'REJECTED', rationale: 'false positive' }],
    patternCapCount: 3,
  })
  assert(result.length === 0, `expected 0, got ${result.length}`)
})
test('DOWNGRADED verdict updates severity', () => {
  const finding3 = mockFindings[3]
  if (finding3 === undefined) throw new Error('mockFindings[3] missing')
  const result = consolidate({
    perReviewer: [{ role: 'correctness' as ReviewRole, findings: [finding3] }],
    autoPass: [],
    verdicts: [{ findingIndex: 0, originalSummary: 'arch', verdict: 'DOWNGRADED', newSeverity: 'info', rationale: 'minor' }],
    patternCapCount: 3,
  })
  assert(result[0]?.severity === 'info', `expected info, got ${result[0]?.severity}`)
})
test('role-based threshold: dx finding confidence=82 dropped (threshold=85)', () => {
  const finding: Finding = { severity: 'warning', rule: 'R-dx', file: 'x.ts', line: 1, confidence: 82, issue: 'x', fix: 'y', isHardRule: false }
  const result = consolidate({
    perReviewer: [{ role: 'dx' as ReviewRole, findings: [finding] }],
    autoPass: [],
    verdicts: [],
    patternCapCount: 3,
  })
  assert(result.length === 0, `dx confidence=82 should be dropped (threshold=85), got ${result.length}`)
})
test('role-based threshold: correctness finding confidence=74 dropped (threshold=75)', () => {
  const finding: Finding = { severity: 'warning', rule: 'R-cor', file: 'x.ts', line: 1, confidence: 74, issue: 'x', fix: 'y', isHardRule: false }
  const result = consolidate({
    perReviewer: [{ role: 'correctness' as ReviewRole, findings: [finding] }],
    autoPass: [],
    verdicts: [],
    patternCapCount: 3,
  })
  assert(result.length === 0, `correctness confidence=74 should be dropped (threshold=75), got ${result.length}`)
})
test('role-based threshold: correctness confidence=75 passes (boundary)', () => {
  const finding: Finding = { severity: 'warning', rule: 'R-cor75', file: 'x.ts', line: 1, confidence: 75, issue: 'x', fix: 'y', isHardRule: false }
  const result = consolidate({
    perReviewer: [{ role: 'correctness' as ReviewRole, findings: [finding] }],
    autoPass: [],
    verdicts: [],
    patternCapCount: 3,
  })
  assert(result.length === 1, `correctness confidence=75 should pass (75 >= 75), got ${result.length}`)
})
test('consensus "2/3" when 2 of 3 reviewers raise same finding', () => {
  const f: Finding = { severity: 'warning', rule: 'R-dup', file: 'a.ts', line: 10, confidence: 80, issue: 'x', fix: 'y', isHardRule: false }
  const result = consolidate({
    perReviewer: [
      { role: 'correctness' as ReviewRole, findings: [f] },
      { role: 'architecture' as ReviewRole, findings: [f] },
      { role: 'dx' as ReviewRole, findings: [] },
    ],
    autoPass: [],
    verdicts: [],
    patternCapCount: 3,
  })
  assert(result.length === 1, `expected 1 deduped finding, got ${result.length}`)
  assert(result[0]?.consensus === '2/3', `expected "2/3", got "${result[0]?.consensus}"`)
})
test('autoPass finding gets consensus "auto"', () => {
  const f: Finding = { severity: 'critical', rule: 'HR-1', file: 'a.ts', line: 1, confidence: 95, issue: 'x', fix: 'y', isHardRule: true }
  const result = consolidate({
    perReviewer: [],
    autoPass: [f],
    verdicts: [],
    patternCapCount: 3,
  })
  assert(result[0]?.consensus === 'auto', `expected "auto", got "${result[0]?.consensus}"`)
})
test('pattern cap note includes file basenames', () => {
  const makeF = (file: string): Finding => ({ severity: 'warning', rule: 'R-cap', file, line: 1, confidence: 80, issue: 'x', fix: 'y', isHardRule: false })
  const result = consolidate({
    perReviewer: [{ role: 'correctness' as ReviewRole, findings: [makeF('src/a.ts'), makeF('src/b.ts'), makeF('src/c.ts'), makeF('src/d.ts')] }],
    autoPass: [],
    verdicts: [],
    patternCapCount: 2,
  })
  const withNote = result.find(r => r.patternNote !== undefined)
  if (withNote === undefined) throw new Error('expected patternNote on a finding')
  const note = withNote.patternNote ?? ''
  assert(note.includes('c.ts') || note.includes('d.ts'), `patternNote missing filenames: "${note}"`)
})
test('Hard Rule confidence=40 passes (bypasses threshold)', () => {
  const finding: Finding = { severity: 'warning', rule: 'HR-low', file: 'x.ts', line: 1, confidence: 40, issue: 'x', fix: 'y', isHardRule: true }
  const result = consolidate({
    perReviewer: [{ role: 'dx' as ReviewRole, findings: [finding] }],
    autoPass: [],
    verdicts: [],
    patternCapCount: 3,
  })
  assert(result.length === 1, `Hard Rule should bypass threshold, got ${result.length}`)
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

// --- plan/schemas/challenge ---
console.log('\nplan/schemas/challenge')
test('ChallengeResultSchema parses valid output', () => {
  const result = ChallengeResultSchema.safeParse({
    minimal: [
      { taskNumber: 1, taskName: 'Add repo', verdict: 'SUSTAINED', ground: '—', rationale: 'Required by Truth 1' },
      { taskNumber: 2, taskName: 'Extract base', verdict: 'CHALLENGED', ground: 'YAGNI', rationale: 'Only one use case' },
    ],
    missingTasks: ['Migration rollback not in plan'],
    dependencyIssues: [],
    clean: [
      { area: 'AuthService', issue: 'Returns generic Error', evidence: 'research.md:45', recommendation: 'Add AuthError type first' },
    ],
    recommendation: 'READY after addressing 2 items',
  })
  assert(result.success, `schema failed: ${JSON.stringify(result.error?.issues)}`)
})
test('ChallengeResultSchema rejects missing recommendation', () => {
  const result = ChallengeResultSchema.safeParse({ minimal: [], missingTasks: [], dependencyIssues: [], clean: [] })
  assert(!result.success, 'should fail without recommendation')
})

// --- investigate/schemas/investigation ---
console.log('\ninvestigate/schemas/investigation')
test('InvestigationResultSchema parses valid output', () => {
  const result = InvestigationResultSchema.safeParse({
    rootCause: {
      hypothesis: 'Null pointer in UserService.findById',
      confidence: 'high',
      evidence: [{ file: 'src/user.service.ts', line: 42, snippet: 'return user.profile.name' }],
      alternativeHypotheses: [],
    },
    dxFindings: [
      { severity: 'warning', category: 'error-handling', file: 'src/user.service.ts', line: 42, issue: 'No null guard', recommendation: 'Add optional chaining' },
    ],
    fixPlan: [
      { type: 'bug', description: 'Add null guard on user.profile', file: 'src/user.service.ts', line: 42 },
      { type: 'test', description: 'Add test for null profile case', file: 'src/user.service.spec.ts', line: null },
    ],
  })
  assert(result.success, `schema failed: ${JSON.stringify(result.error?.issues)}`)
})
test('InvestigationResultSchema rejects invalid confidence', () => {
  const result = InvestigationResultSchema.safeParse({
    rootCause: { hypothesis: 'x', confidence: 'very-high', evidence: [], alternativeHypotheses: [] },
    dxFindings: [],
    fixPlan: [],
  })
  assert(!result.success, 'should reject invalid confidence level')
})

// --- plan-challenge CLI args ---
console.log('\nplan-challenge CLI args')
test('parsePlanChallengeArgs returns plan path', () => {
  const result = parsePlanChallengeArgs(['--plan-file', 'plan.md'])
  assert(result.planFile === 'plan.md', `expected plan.md, got ${result.planFile}`)
})
test('parsePlanChallengeArgs returns research path', () => {
  const result = parsePlanChallengeArgs(['--plan-file', 'plan.md', '--research-file', 'research.md'])
  assert(result.researchFile === 'research.md', `expected research.md, got ${result.researchFile}`)
})
test('parsePlanChallengeArgs defaults researchFile to undefined', () => {
  const result = parsePlanChallengeArgs(['--plan-file', 'plan.md'])
  assert(result.researchFile === undefined, 'expected undefined researchFile')
})

// --- investigate CLI args ---
console.log('\ninvestigate CLI args')
test('parseInvestigateArgs returns bug description', () => {
  const result = parseInvestigateArgs(['--bug', 'NPE in UserService'])
  assert(result.bug === 'NPE in UserService', `got ${result.bug}`)
})
test('parseInvestigateArgs defaults quick to false', () => {
  const result = parseInvestigateArgs(['--bug', 'test'])
  assert(result.quick === false, 'expected quick=false')
})
test('parseInvestigateArgs parses --quick flag', () => {
  const result = parseInvestigateArgs(['--bug', 'test', '--quick'])
  assert(result.quick === true, 'expected quick=true')
})

// --- falsify CLI args ---
console.log('\nfalsify CLI args')
test('parseFalsifyArgs returns findings file path', () => {
  const result = parseFalsifyArgs(['--findings-file', '/tmp/findings.json'])
  assert(result.findingsFile === '/tmp/findings.json', `got ${result.findingsFile}`)
})
test('parseFalsifyArgs defaults findingsFile to undefined', () => {
  const result = parseFalsifyArgs([])
  assert(result.findingsFile === undefined, 'expected undefined findingsFile')
})

// --- summary ---
console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
