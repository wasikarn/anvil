import { describe, expect, it } from 'bun:test'
import { FindingSchema, FindingArraySchema, FindingResultSchema } from './finding.js'
import { ZodError } from 'zod'

function validFinding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    severity: 'warning',
    rule: 'NO_ANY',
    file: 'src/foo.ts',
    line: 42,
    confidence: 80,
    issue: 'uses any type',
    fix: 'replace with unknown',
    isHardRule: false,
    ...overrides,
  }
}

describe('FindingSchema — valid inputs', () => {
  it('valid finding with all required fields parses correctly', () => {
    const result = FindingSchema.parse(validFinding())
    expect(result.rule).toBe('NO_ANY')
    expect(result.severity).toBe('warning')
    expect(result.confidence).toBe(80)
    expect(result.isHardRule).toBe(false)
  })

  it('line: null is accepted (nullable field)', () => {
    const result = FindingSchema.parse(validFinding({ line: null }))
    expect(result.line).toBeNull()
  })

  it('severity: critical is valid', () => {
    const result = FindingSchema.parse(validFinding({ severity: 'critical' }))
    expect(result.severity).toBe('critical')
  })

  it('severity: warning is valid', () => {
    const result = FindingSchema.parse(validFinding({ severity: 'warning' }))
    expect(result.severity).toBe('warning')
  })

  it('severity: info is valid', () => {
    const result = FindingSchema.parse(validFinding({ severity: 'info' }))
    expect(result.severity).toBe('info')
  })

  it('confidence at lower bound (0) is accepted', () => {
    const result = FindingSchema.parse(validFinding({ confidence: 0 }))
    expect(result.confidence).toBe(0)
  })

  it('confidence at upper bound (100) is accepted', () => {
    const result = FindingSchema.parse(validFinding({ confidence: 100 }))
    expect(result.confidence).toBe(100)
  })

  it('isHardRule: true is accepted', () => {
    const result = FindingSchema.parse(validFinding({ isHardRule: true }))
    expect(result.isHardRule).toBe(true)
  })
})

describe('FindingSchema — invalid inputs', () => {
  it('missing required field (rule) → throws ZodError', () => {
    const data = validFinding()
    delete (data as Record<string, unknown>).rule
    expect(() => FindingSchema.parse(data)).toThrow(ZodError)
  })

  it('missing required field (file) → throws ZodError', () => {
    const data = validFinding()
    delete (data as Record<string, unknown>).file
    expect(() => FindingSchema.parse(data)).toThrow(ZodError)
  })

  it('missing required field (issue) → throws ZodError', () => {
    const data = validFinding()
    delete (data as Record<string, unknown>).issue
    expect(() => FindingSchema.parse(data)).toThrow(ZodError)
  })

  it('missing required field (fix) → throws ZodError', () => {
    const data = validFinding()
    delete (data as Record<string, unknown>).fix
    expect(() => FindingSchema.parse(data)).toThrow(ZodError)
  })

  it('invalid severity value → throws ZodError', () => {
    expect(() => FindingSchema.parse(validFinding({ severity: 'HIGH' }))).toThrow(ZodError)
    expect(() => FindingSchema.parse(validFinding({ severity: 'error' }))).toThrow(ZodError)
    expect(() => FindingSchema.parse(validFinding({ severity: '' }))).toThrow(ZodError)
  })

  it('confidence above 100 → throws ZodError', () => {
    expect(() => FindingSchema.parse(validFinding({ confidence: 101 }))).toThrow(ZodError)
  })

  it('confidence below 0 → throws ZodError', () => {
    expect(() => FindingSchema.parse(validFinding({ confidence: -1 }))).toThrow(ZodError)
  })

  it('confidence non-integer → throws ZodError', () => {
    expect(() => FindingSchema.parse(validFinding({ confidence: 75.5 }))).toThrow(ZodError)
  })

  it('line non-integer → throws ZodError', () => {
    expect(() => FindingSchema.parse(validFinding({ line: 1.5 }))).toThrow(ZodError)
  })
})

describe('FindingArraySchema', () => {
  it('array of valid findings parses correctly', () => {
    const findings = [validFinding(), validFinding({ severity: 'critical', rule: 'NO_SECRETS' })]
    const result = FindingArraySchema.parse(findings)
    expect(result).toHaveLength(2)
    const second = result[1]
    expect(second?.rule).toBe('NO_SECRETS')
  })

  it('empty array is valid', () => {
    const result = FindingArraySchema.parse([])
    expect(result).toEqual([])
  })

  it('array with one invalid finding → throws ZodError', () => {
    const findings = [validFinding(), validFinding({ confidence: 200 })]
    expect(() => FindingArraySchema.parse(findings)).toThrow(ZodError)
  })
})

describe('FindingResultSchema', () => {
  it('valid result with findings array parses correctly', () => {
    const result = FindingResultSchema.parse({ findings: [validFinding()] })
    expect(result.findings).toHaveLength(1)
  })

  it('strengths field is optional — absent is valid', () => {
    const result = FindingResultSchema.parse({ findings: [] })
    expect(result.strengths).toBeUndefined()
  })

  it('strengths field accepts string array when present', () => {
    const result = FindingResultSchema.parse({
      findings: [],
      strengths: ['good error handling', 'well-typed'],
    })
    expect(result.strengths).toHaveLength(2)
  })

  it('missing findings field → throws ZodError', () => {
    expect(() => FindingResultSchema.parse({})).toThrow(ZodError)
  })

  it('findings with invalid entry → throws ZodError', () => {
    expect(() => FindingResultSchema.parse({
      findings: [validFinding({ severity: 'CRITICAL' })],
    })).toThrow(ZodError)
  })
})
