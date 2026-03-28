import type { ConsolidatedFinding, Finding, ReviewRole, Severity, Verdict } from '../types.js'

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

function severityRank(severity: Severity): number {
  return SEVERITY_ORDER[severity]
}

// Mirrors review-consolidator haiku agent thresholds exactly
const ROLE_CONFIDENCE: Record<ReviewRole, number> = {
  correctness: 75,
  architecture: 80,
  dx: 85,
}

/**
 * Applies falsification verdicts to mustFalsify findings.
 * - REJECTED → remove finding
 * - DOWNGRADED → update severity to verdict.newSeverity
 * - SUSTAINED → keep unchanged
 * - No verdict → keep unchanged
 */
function applyVerdicts(findings: Finding[], verdicts: Verdict[]): Finding[] {
  const verdictByIndex = new Map<number, Verdict>()
  for (const v of verdicts) {
    verdictByIndex.set(v.findingIndex, v)
  }

  const result: Finding[] = []
  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i]
    if (finding === undefined) continue

    const verdict = verdictByIndex.get(i)
    if (verdict === undefined || verdict.verdict === 'SUSTAINED') {
      result.push(finding)
    } else if (verdict.verdict === 'DOWNGRADED') {
      const newSeverity = verdict.newSeverity ?? finding.severity
      result.push({ ...finding, severity: newSeverity })
    }
    // REJECTED: skip (do not push)
  }
  return result
}

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
    const entry = perReviewer[i]
    if (entry === undefined) continue
    const { findings } = entry
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
    consensus: `${reviewerSet.size}/${totalReviewers}`,
  }))
}

/**
 * Caps same rule appearing in >capCount findings — keeps first capCount, adds patternNote with file names on last kept.
 */
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
    // Sort by severity within group so critical findings are kept over info
    const sorted = [...group].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    if (sorted.length <= capCount) {
      result.push(...sorted)
    } else {
      const kept = sorted.slice(0, capCount)
      const overflow = sorted.slice(capCount)
      // Include overflow file names (up to 3) to match haiku agent output
      const overflowFiles = overflow
        .map(f => f.file.split('/').pop() ?? f.file)
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

function sortBySeverity(findings: ConsolidatedFinding[]): ConsolidatedFinding[] {
  return [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

/**
 * Applies falsification verdicts and consolidates findings.
 * Accepts per-reviewer findings (with roles) to enable:
 * - Role-based confidence thresholds
 * - Consensus tracking (N/M)
 * - Pattern cap with file names
 * Pure TypeScript — no LLM calls.
 *
 * @param perReviewer - One entry per reviewer that ran (include reviewers with empty findings).
 *   `perReviewer.length` is used as M in the N/M consensus ratio. Omitting a reviewer
 *   inflates the ratio (e.g., "2/2" instead of "2/3").
 */
export function consolidate(params: {
  perReviewer: Array<{ role: ReviewRole; findings: Finding[] }>
  autoPass: Finding[]
  verdicts: Verdict[]
  patternCapCount: number
}): ConsolidatedFinding[] {
  const totalReviewers = params.perReviewer.length

  // 1. Apply verdicts to all mustFalsify findings (across all reviewers)
  const allMustFalsify = params.perReviewer.flatMap(r => r.findings)
  const afterVerdicts = applyVerdicts(allMustFalsify, params.verdicts)

  // Rebuild per-reviewer buckets after verdicts (preserves reviewer attribution + DOWNGRADED severity)
  // Use survivedMap so DOWNGRADED findings carry their updated severity into the per-reviewer buckets
  const survivedMap = new Map(afterVerdicts.map(f => [`${f.file}:${f.line ?? 'null'}:${f.rule}`, f]))
  const perReviewerFiltered = params.perReviewer.map(r => ({
    role: r.role,
    findings: r.findings
      .map(f => survivedMap.get(`${f.file}:${f.line ?? 'null'}:${f.rule}`))
      .filter((f): f is Finding => f !== undefined),
  }))

  // 2. Confidence filter — role-based thresholds, Hard Rules bypass
  const perReviewerConfFiltered = perReviewerFiltered.map(r => ({
    role: r.role,
    findings: r.findings.filter(f => {
      if (f.isHardRule) return true
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
