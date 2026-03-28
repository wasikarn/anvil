# Prompt D: Consolidator Upgrade — Role-Based Thresholds + Consensus Tracking

**Opportunity:** เพิ่ม 3 capabilities ที่ขาดใน `consolidator.ts` เพื่อให้เทียบเท่า `review-consolidator` haiku agent
**Impact:** ตัด haiku agent call ออกจาก review pipeline ทั้งหมด — ไม่มี LLM overhead สำหรับ consolidation อีกต่อไป
**Files ที่แก้:**

- `anvil-sdk/src/review/orchestrator.ts` — return `roles[]` alongside `results[]`
- `anvil-sdk/src/review/consolidator.ts` — เพิ่ม role-based thresholds, consensus N/M, pattern cap with file names
- `anvil-sdk/src/cli.ts` — ส่ง per-reviewer roles เข้า `consolidate()`

---

## ช่องว่างระหว่าง TypeScript กับ Haiku Agent

| Capability | `review-consolidator` haiku agent | `consolidator.ts` ปัจจุบัน |
| ----------- | ----------------------------------- | --------------------------- |
| Confidence filter | Role-based: correctness/security=75, architecture/performance=80, dx/testing=85 | Single `confidenceThreshold` (default 80) ใช้ทุก role |
| Consensus tracking | `N/M` (e.g., `2/3`) — N=ผู้ review ที่เจอ, M=ทั้งหมด | `"confirmed"` ทุก finding |
| Pattern cap note | `(+ 2 more: auth.ts, users.ts)` — มีชื่อไฟล์ | `(+ 2 more)` — ไม่มีชื่อไฟล์ |

---

## Root Cause: Reviewer Attribution ถูกทิ้งก่อน Triage

ใน `cli.ts` บรรทัด 187:

```typescript
// ปัจจุบัน — attribution หาย
const allFindings = results.flatMap(r => r.findings)
const { autoPass, mustFalsify } = triage(allFindings)
```

`results[i]` รู้ role (ผ่าน bucket) แต่หลัง `flatMap` ข้อมูลนั้นหาย
แก้โดยส่ง per-reviewer findings เข้า `consolidate()` โดยตรง แทนที่จะ merge ก่อน

---

## Step 1: orchestrator.ts — return `roles[]`

เพิ่ม `roles: ReviewRole[]` ใน return type ของ `runReview()`:

```typescript
// เพิ่ม import
import type { DiffBucket, FileDiff, ReviewerResult, ReviewRole } from '../types.js'

export async function runReview(params: {
  files: FileDiff[]
  hardRules: string
  dismissedPatterns: string
  config: ResolvedConfig
}): Promise<{ results: ReviewerResult[]; roles: ReviewRole[]; totalCost: number; totalTokens: number }> {
  const buckets = mapToDomains(params.files)
  const activeBuckets = buckets.filter(b => b.files.length > 0)  // ← same filter as before
  const isAdonisProject = detectAdonisProject(params.files)

  const settled = await Promise.allSettled(
    activeBuckets.map(bucket =>
      runSingleReviewer({ bucket, hardRules: params.hardRules, dismissedPatterns: params.dismissedPatterns, isAdonisProject, config: params.config })
    )
  )

  const results: ReviewerResult[] = settled.map(r => {
    if (r.status === 'rejected') {
      console.warn(`[sdk-review] reviewer failed:`, r.reason)
      return { findings: [], strengths: [], cost: 0, tokens: 0 }
    }
    return r.value
  })

  // roles[i] corresponds to results[i] — preserves reviewer attribution
  const roles: ReviewRole[] = activeBuckets.map(b => b.role)

  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0)

  return { results, roles, totalCost, totalTokens }
}
```

---

## Step 2: consolidator.ts — Role-Based Thresholds

เพิ่ม role-based confidence thresholds แทนที่ single threshold:

```typescript
import type { ConsolidatedFinding, Finding, ReviewRole, ReviewerResult, Severity, Verdict } from '../types.js'

// Mirrors review-consolidator haiku agent thresholds exactly
const ROLE_CONFIDENCE: Record<ReviewRole, number> = {
  correctness: 75,
  architecture: 80,
  dx: 85,
}
```

---

## Step 3: consolidator.ts — Consensus Tracking ใน dedup()

เปลี่ยน input ของ `consolidate()` เป็น per-reviewer findings พร้อม role:

```typescript
/**
 * Deduplicates findings from multiple reviewers, tracking consensus (N/M).
 * N = number of reviewers who raised this finding
 * M = total number of reviewers (including those with empty findings)
 */
function dedup(
  perReviewer: Array<{ role: ReviewRole; findings: Finding[] }>,
  totalReviewers: number
): ConsolidatedFinding[] {
  // Map: key → { finding (highest severity), reviewerIndices that found it }
  const byKey = new Map<string, { finding: Finding; reviewerSet: Set<number> }>()

  for (let i = 0; i < perReviewer.length; i++) {
    const { findings } = perReviewer[i]!
    for (const f of findings) {
      const key = `${f.file}:${f.line ?? 'null'}:${f.rule}`
      const existing = byKey.get(key)
      if (existing === undefined) {
        byKey.set(key, { finding: f, reviewerSet: new Set([i]) })
      } else {
        // Keep highest severity
        if (severityRank(f.severity) < severityRank(existing.finding.severity)) {
          existing.finding = f
        }
        existing.reviewerSet.add(i)
      }
    }
  }

  return Array.from(byKey.values()).map(({ finding, reviewerSet }) => ({
    ...finding,
    consensus: `${reviewerSet.size}/${totalReviewers}`,  // e.g., "2/3", "1/3"
  }))
}
```

---

## Step 4: consolidator.ts — Pattern Cap with File Names

```typescript
function patternCap(
  findings: ConsolidatedFinding[],
  capCount: number
): ConsolidatedFinding[] {
  const byRule = new Map<string, ConsolidatedFinding[]>()
  for (const f of findings) {
    const bucket = byRule.get(f.rule) ?? []
    bucket.push(f)
    byRule.set(f.rule, bucket)
  }

  const result: ConsolidatedFinding[] = []
  for (const [, group] of byRule) {
    if (group.length <= capCount) {
      result.push(...group)
    } else {
      const kept = group.slice(0, capCount)
      const overflow = group.slice(capCount)
      // Include overflow file names (up to 3) to match haiku agent output
      const overflowFiles = overflow
        .map(f => f.file.split('/').pop() ?? f.file)  // basename only
        .slice(0, 3)
      const overflowNote = overflow.length > 3
        ? `(+ ${overflow.length} more: ${overflowFiles.join(', ')}, ...)`
        : `(+ ${overflow.length} more: ${overflowFiles.join(', ')})`

      const last = kept[capCount - 1]
      if (last !== undefined) {
        result.push(...kept.slice(0, capCount - 1))
        result.push({ ...last, patternNote: overflowNote })
      } else {
        result.push(...kept)
      }
    }
  }
  return result
}
```

---

## Step 5: consolidator.ts — New `consolidate()` Signature

```typescript
/**
 * Applies falsification verdicts and consolidates findings.
 * Accepts per-reviewer findings (with roles) to enable:
 * - Role-based confidence thresholds
 * - Consensus tracking (N/M)
 * - Pattern cap with file names
 * Pure TypeScript — no LLM calls.
 */
export function consolidate(params: {
  perReviewer: Array<{ role: ReviewRole; findings: Finding[] }>
  autoPass: Finding[]           // Hard Rule findings that bypass falsification
  verdicts: Verdict[]
  patternCapCount: number
}): ConsolidatedFinding[] {
  const totalReviewers = params.perReviewer.length

  // 1. Apply verdicts to all mustFalsify findings (across all reviewers)
  const allMustFalsify = params.perReviewer.flatMap(r => r.findings)
  const afterVerdicts = applyVerdicts(allMustFalsify, params.verdicts)

  // Rebuild per-reviewer buckets after verdicts (preserves reviewer attribution)
  // f.line is nullable — use ?? 'null' to match the key format used in cli.ts
  const survivedKeys = new Set(afterVerdicts.map(f => `${f.file}:${f.line ?? 'null'}:${f.rule}`))
  const perReviewerFiltered = params.perReviewer.map(r => ({
    role: r.role,
    findings: r.findings.filter(f => survivedKeys.has(`${f.file}:${f.line ?? 'null'}:${f.rule}`)),
  }))

  // 2. Confidence filter — role-based thresholds, Hard Rules bypass
  const perReviewerConfFiltered = perReviewerFiltered.map(r => ({
    role: r.role,
    findings: r.findings.filter(f => {
      if (f.isHardRule) return true  // Hard Rules always pass
      return f.confidence >= ROLE_CONFIDENCE[r.role]
    }),
  }))

  // 3. Dedup mustFalsify survivors: same file+line+rule → keep highest severity, track N/M
  //    autoPass findings are NOT included here — they bypass debate entirely
  const deduped = dedup(perReviewerConfFiltered, totalReviewers)

  // 4. Merge autoPass findings AFTER dedup (they never participated in reviewer debate)
  //    Mark as consensus "auto" to distinguish from debate-processed findings
  const autoPassAsCF: ConsolidatedFinding[] = params.autoPass.map(f => ({
    ...f,
    consensus: 'auto',
  }))

  // 5. Combine deduped mustFalsify + autoPass before pattern cap
  const allDeduped = [...deduped, ...autoPassAsCF]

  // 6. Pattern cap: same rule in >capCount files → keep capCount, add file names note
  const capped = patternCap(allDeduped, params.patternCapCount)

  // 7. Sort: critical → warning → info
  return sortBySeverity(capped)
}
```

---

## Step 6: cli.ts — อัปเดต call site

เปลี่ยน consolidate call ใน `runReviewCommand()`:

```typescript
// ก่อน:
const allFindings = results.flatMap(r => r.findings)
const { autoPass, autoDrop: _autoDrop, mustFalsify } = triage(allFindings)
// ...
const consolidated = consolidate({
  autoPass,
  mustFalsify,
  verdicts,
  confidenceThreshold: config.confidenceThreshold,
  patternCapCount: config.patternCapCount,
})

// หลัง:
// Triage per-reviewer (preserve attribution)
const { results, roles, totalCost, totalTokens } = await runReview({ ... })

// roles[i] ต้อง defined เสมอ — ถ้าไม่ใช่แสดงว่า orchestrator กับ results มี misalignment
const perReviewer = results.map((r, i) => {
  const role = roles[i]
  if (role === undefined) throw new Error(`[sdk-review] roles[${i}] undefined — results/roles mismatch`)
  return { role, findings: r.findings }
})

// Triage merged to find autoPass/mustFalsify split
const allFindings = results.flatMap(r => r.findings)
const { autoPass, autoDrop: _autoDrop, mustFalsify } = triage(allFindings)

// Falsify only mustFalsify (unchanged)
let verdicts: Awaited<ReturnType<typeof runFalsification>> = []
if (!config.noFalsification && mustFalsify.length > 0) {
  verdicts = await runFalsification({ findings: mustFalsify, config })
}

// Consolidate with full attribution
// ใช้ key-based Set แทน reference equality (.includes) — ป้องกัน silent bug ถ้า objects ถูก spread
const mustFalsifyKeys = new Set(mustFalsify.map(f => `${f.file}:${f.line ?? 'null'}:${f.rule}`))
const perReviewerMustFalsify = perReviewer.map(r => ({
  role: r.role,
  findings: r.findings.filter(f => mustFalsifyKeys.has(`${f.file}:${f.line ?? 'null'}:${f.rule}`)),
}))

const consolidated = consolidate({
  perReviewer: perReviewerMustFalsify,
  autoPass,
  verdicts,
  patternCapCount: config.patternCapCount,
})
```

> **หมายเหตุ:** ลบ `confidenceThreshold` ออกจาก params — ตอนนี้ใช้ `ROLE_CONFIDENCE` map ใน consolidator แทน
> ถ้า `config.confidenceThreshold` ยังใช้ที่อื่น ให้คงไว้ใน config แต่ไม่ส่งเข้า consolidate

---

## ผลลัพธ์ที่ได้

**ก่อน** (ตัวอย่าง `ConsolidatedFinding`):

```json
{
  "rule": "no-null-check",
  "file": "src/auth.ts",
  "severity": "critical",
  "consensus": "confirmed",
  "patternNote": "(+ 2 more)"
}
```

**หลัง:**

```json
{
  "rule": "no-null-check",
  "file": "src/auth.ts",
  "severity": "critical",
  "consensus": "2/3",
  "patternNote": "(+ 2 more: users.ts, profile.ts)"
}
```

---

## สิ่งที่ถูกตัดออก

| เดิม | ใหม่ |
| ------ | ------ |
| `review-consolidator` haiku agent call (LLM) | Pure TypeScript ใน `consolidator.ts` |
| Single `confidenceThreshold: 80` ทุก role | Role-specific: correctness=75, architecture=80, dx=85 |
| `consensus: "confirmed"` | `consensus: "2/3"` (actual reviewer count) |
| `(+ N more)` | `(+ N more: file1.ts, file2.ts)` |

---

## Backward Compatibility

`ConsolidatedFinding.consensus` เปลี่ยนจาก `"confirmed"` → `"N/M"` string
— `ReviewReport` type ไม่เปลี่ยน (consensus field เป็น `string` อยู่แล้ว)
— Skills ที่ parse output ต้องรองรับ pattern ใหม่ (`/^\d+\/\d+$/` แทน `"confirmed"`)
— `review-output-format/SKILL.md` ควร update ตัวอย่าง Consensus column

---

## Smoke Test Coverage

เพิ่ม test case ใน smoke-test ที่มีอยู่:

```typescript
// Test: role-based threshold — dx finding at confidence=82 must be DROPPED (threshold=85, 82 < 85)
// Test: role-based threshold — correctness finding at confidence=74 must be DROPPED (threshold=75, 74 < 75)
// Test: correctness finding at confidence=75 must PASS (boundary: 75 >= 75)
// Test: consensus "2/3" when 2 of 3 reviewers raise same file:line:rule
// Test: autoPass finding gets consensus "auto", not "N/M"
// Test: pattern cap note includes actual file basenames: "(+ 2 more: auth.ts, users.ts)"
// Test: Hard Rule at confidence=40 still passes (bypasses threshold entirely)
// Test: DOWNGRADED finding with new severity re-checked against role threshold
```
