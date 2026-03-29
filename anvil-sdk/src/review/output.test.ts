import { describe, expect, it } from 'vitest'
import { formatJson, formatMarkdown } from './output.js'
import type { ReviewReport } from '../types.js'

function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    pr: '#42',
    summary: { critical: 1, warning: 2, info: 0 },
    findings: [
      {
        severity: 'critical',
        rule: 'NULL_CHECK',
        file: 'src/foo.ts',
        line: 10,
        confidence: 90,
        issue: 'possible null deref',
        fix: 'add null check',
        isHardRule: true,
        consensus: '2/3',
      },
    ],
    strengths: ['Good test coverage'],
    verdict: 'REQUEST_CHANGES',
    complexity: 'standard',
    cost: { total_usd: 0.0150, per_reviewer: [0.0100, 0.0030, 0.0010], falsification_usd: 0.0010 },
    tokens: { total: 5000, per_reviewer: [3000, 1500, 500], falsification: 500 },
    ...overrides,
  }
}

describe('formatJson', () => {
  it('returns valid JSON', () => {
    const json = formatJson(makeReport())
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('round-trips the report', () => {
    const report = makeReport()
    const parsed = JSON.parse(formatJson(report)) as ReviewReport
    expect(parsed.pr).toBe('#42')
    expect(parsed.verdict).toBe('REQUEST_CHANGES')
    expect(parsed.cost.falsification_usd).toBe(0.0010)
  })
})

describe('formatMarkdown', () => {
  it('includes PR identifier in header', () => {
    const md = formatMarkdown(makeReport())
    expect(md).toContain('# PR Review — #42')
  })

  it('shows REQUEST_CHANGES verdict', () => {
    const md = formatMarkdown(makeReport({ verdict: 'REQUEST_CHANGES' }))
    expect(md).toContain('REQUEST_CHANGES ❌')
  })

  it('shows APPROVE verdict', () => {
    const md = formatMarkdown(makeReport({ verdict: 'APPROVE' }))
    expect(md).toContain('APPROVE ✅')
  })

  it('shows per-phase cost breakdown', () => {
    const md = formatMarkdown(makeReport())
    expect(md).toContain('Reviewers:')
    expect(md).toContain('Falsification:')
    expect(md).toContain('Total:')
  })

  it('reviewer cost = total minus falsification', () => {
    const report = makeReport()
    const md = formatMarkdown(report)
    const reviewerCost = (report.cost.total_usd - report.cost.falsification_usd).toFixed(4)
    expect(md).toContain(`Reviewers: $${reviewerCost}`)
  })

  it('shows Hard Rule badge on hard rule findings', () => {
    const md = formatMarkdown(makeReport())
    expect(md).toContain('🚨 Hard Rule')
  })

  it('shows _No findings._ when findings is empty', () => {
    const md = formatMarkdown(makeReport({ findings: [], summary: { critical: 0, warning: 0, info: 0 } }))
    expect(md).toContain('_No findings._')
  })

  it('includes summary table with counts', () => {
    const md = formatMarkdown(makeReport())
    expect(md).toContain('| 🔴 Critical | 1 |')
    expect(md).toContain('| 🟡 Warning | 2 |')
    expect(md).toContain('| 🔵 Info | 0 |')
  })

  it('includes file:line location in finding header', () => {
    const md = formatMarkdown(makeReport())
    expect(md).toContain('src/foo.ts:10')
  })

  it('omits line number when line is null', () => {
    const finding = makeReport().findings[0]
    if (finding === undefined) throw new Error('fixture missing finding')
    const report = makeReport({ findings: [{ ...finding, line: null }] })
    const md = formatMarkdown(report)
    expect(md).toContain('src/foo.ts\n')
  })

  it('renders strengths section when strengths are present', () => {
    const md = formatMarkdown(makeReport({ strengths: ['Good null guards at auth.ts:42'] }))
    expect(md).toContain('## Strengths')
    expect(md).toContain('- Good null guards at auth.ts:42')
  })

  it('omits strengths section when strengths is empty', () => {
    const md = formatMarkdown(makeReport({ strengths: [] }))
    expect(md).not.toContain('## Strengths')
  })

  it('renders noise warning when noiseWarning is true', () => {
    const md = formatMarkdown(makeReport({ noiseWarning: true }))
    expect(md).toContain('⚠️ High finding count detected')
  })

  it('omits noise warning when noiseWarning is false/undefined', () => {
    const md = formatMarkdown(makeReport({ noiseWarning: false }))
    expect(md).not.toContain('⚠️ High finding count detected')
  })
})
