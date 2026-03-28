import type { ConsolidatedFinding, Finding, Verdict } from '../types.js'

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

function severityRank(severity: string): number {
  return SEVERITY_ORDER[severity] ?? 99
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
 * Deduplicates findings by file+line+rule key.
 * Keeps the finding with the highest severity.
 */
function dedup(findings: Finding[]): ConsolidatedFinding[] {
  const byKey = new Map<string, Finding>()

  for (const f of findings) {
    const key = `${f.file}:${f.line ?? 'null'}:${f.rule}`
    const existing = byKey.get(key)
    if (existing === undefined || severityRank(f.severity) < severityRank(existing.severity)) {
      byKey.set(key, f)
    }
  }

  return Array.from(byKey.values()).map(f => ({
    ...f,
    consensus: 'confirmed',
  }))
}

/**
 * Caps same rule appearing in >capCount findings — keeps first capCount, adds patternNote on last kept.
 */
function patternCap(
  findings: ConsolidatedFinding[],
  capCount: number
): ConsolidatedFinding[] {
  // Group findings by rule
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
      const overflow = group.length - capCount
      // Add patternNote to last kept finding
      const last = kept[capCount - 1]
      if (last !== undefined) {
        result.push(...kept.slice(0, capCount - 1))
        result.push({ ...last, patternNote: `(+ ${overflow} more)` })
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
 * Pure TypeScript — no LLM calls.
 */
export function consolidate(params: {
  autoPass: Finding[]
  mustFalsify: Finding[]
  verdicts: Verdict[]
  confidenceThreshold: number
  patternCapCount: number
}): ConsolidatedFinding[] {
  // 1. Apply verdicts to mustFalsify findings
  const afterVerdicts = applyVerdicts(params.mustFalsify, params.verdicts)

  // 2. Merge autoPass + survived mustFalsify
  const allFindings = [...params.autoPass, ...afterVerdicts]

  // 3. Confidence filter (Hard Rules bypass)
  const filtered = allFindings.filter(
    f => f.isHardRule || f.confidence >= params.confidenceThreshold
  )

  // 4. Dedup: same file+line+rule → keep highest severity
  const deduped = dedup(filtered)

  // 5. Pattern cap: same rule appearing in >patternCapCount files → keep patternCapCount, add note
  const capped = patternCap(deduped, params.patternCapCount)

  // 6. Sort: critical → warning → info
  return sortBySeverity(capped)
}
