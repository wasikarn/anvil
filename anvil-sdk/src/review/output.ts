import type { ConsolidatedFinding, ReviewReport } from '../types.js'

/**
 * Format ReviewReport as JSON string (pretty-printed).
 */
export function formatJson(report: ReviewReport): string {
  return JSON.stringify(report, null, 2)
}

function formatFinding(f: ConsolidatedFinding): string {
  const label = f.severity.toUpperCase()
  const location = f.line !== null && f.line !== undefined ? `${f.file}:${f.line}` : f.file
  const lines: string[] = [
    `### [${label}] ${f.rule} — ${location}`,
    `**Issue:** ${f.issue}`,
    `**Fix:** ${f.fix}`,
    `**Confidence:** ${f.confidence}%`,
    `**Rule:** ${f.rule}${f.isHardRule ? ' 🚨 Hard Rule' : ''}`,
  ]
  if (f.patternNote) {
    lines.push(`**Pattern:** ${f.patternNote}`)
  }
  return lines.join('\n')
}

/**
 * Format ReviewReport as a markdown table matching the Anvil review output format.
 *
 * Format:
 * # PR Review — {report.pr}
 *
 * ## Summary
 * | Severity | Count |
 * | --- | --- |
 * | 🔴 Critical | N |
 * | 🟡 Warning | N |
 * | 🔵 Info | N |
 *
 * **Verdict:** APPROVE ✅ | REQUEST_CHANGES ❌
 *
 * ## Findings
 *
 * ### [CRITICAL] {rule} — {file}:{line}
 * **Issue:** {issue}
 * **Fix:** {fix}
 * **Confidence:** {confidence}%
 * **Rule:** {rule}{isHardRule ? ' 🚨 Hard Rule' : ''}
 * {patternNote if present}
 * {crossDomain if present: > Cross-domain: {crossDomain}}
 *
 * ## Cost
 * Total: ${cost.total_usd.toFixed(4)} | Tokens: {tokens.total.toLocaleString()}
 */
export function formatMarkdown(report: ReviewReport): string {
  const verdictLabel =
    report.verdict === 'APPROVE' ? 'APPROVE ✅' : 'REQUEST_CHANGES ❌'

  const summaryTable = [
    '| Severity | Count |',
    '| --- | --- |',
    `| 🔴 Critical | ${report.summary.critical} |`,
    `| 🟡 Warning | ${report.summary.warning} |`,
    `| 🔵 Info | ${report.summary.info} |`,
  ].join('\n')

  const findingsSections =
    report.findings.length > 0
      ? report.findings.map(formatFinding).join('\n\n')
      : '_No findings._'

  const complexityNote = report.complexity === 'trivial'
    ? '\n> ⚡ Trivial PR — single reviewer (< 50 diff lines, 1 domain). Findings show 1/1 consensus.'
    : ''

  const noiseNote = report.noiseWarning
    ? '\n> ⚠️ High finding count detected — review for false positives before acting on all items.'
    : ''

  const strengthsSection = report.strengths.length > 0
    ? ['## Strengths', '', ...report.strengths.map(s => `- ${s}`), ''].join('\n')
    : ''

  const sections = [
    `# PR Review — ${report.pr}${complexityNote}`,
    '',
    '## Summary',
    summaryTable,
    '',
    `**Verdict:** ${verdictLabel}${noiseNote}`,
    '',
    '## Findings',
    '',
    findingsSections,
    '',
  ]

  if (strengthsSection) sections.push(strengthsSection)

  sections.push(
    '## Cost',
    `Reviewers: $${(report.cost.total_usd - report.cost.falsification_usd).toFixed(4)} | Falsification: $${report.cost.falsification_usd.toFixed(4)} | Total: $${report.cost.total_usd.toFixed(4)} | Tokens: ${report.tokens.total.toLocaleString()}`,
  )

  return sections.join('\n')
}
