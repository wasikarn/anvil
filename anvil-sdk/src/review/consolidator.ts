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
 * Caps same rule appearing in >3 files — keeps 3, adds patternNote on last kept.
 */
function patternCap(findings: ConsolidatedFinding[], capCount: number): ConsolidatedFinding[] {
  // Group by rule, tracking unique files per rule
  const ruleFiles = new Map<string, Set<string>>()
  for (const f of findings) {
    const set = ruleFiles.get(f.rule) ?? new Set<string>()
    set.add(f.file)
    ruleFiles.set(f.rule, set)
  }

  // Rules that exceed the cap
  const cappedRules = new Set<string>()
  for (const [rule, files] of ruleFiles.entries()) {
    if (files.size > capCount) {
      cappedRules.add(rule)
    }
  }

  if (cappedRules.size === 0) return findings

  const result: ConsolidatedFinding[] = []
  // Track how many unique files we've kept per capped rule
  const keptFiles = new Map<string, Set<string>>()

  for (const f of findings) {
    if (!cappedRules.has(f.rule)) {
      result.push(f)
      continue
    }

    const kept = keptFiles.get(f.rule) ?? new Set<string>()
    if (kept.has(f.file)) {
      // Same file already counted — always include (avoids dropping within same file)
      result.push(f)
      continue
    }

    const totalFiles = ruleFiles.get(f.rule)?.size ?? 0
    if (kept.size < capCount) {
      kept.add(f.file)
      keptFiles.set(f.rule, kept)

      if (kept.size === capCount) {
        const extra = totalFiles - capCount
        result.push({ ...f, patternNote: `(+ ${extra} more file${extra === 1 ? '' : 's'})` })
      } else {
        result.push(f)
      }
    }
    // else: beyond cap — drop
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
