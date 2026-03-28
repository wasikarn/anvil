export type { Finding } from './review/schemas/finding.js'
export type { Verdict } from './review/schemas/verdict.js'

import type { Finding } from './review/schemas/finding.js'

export type ReviewRole = 'correctness' | 'architecture' | 'dx'
export type Severity = 'critical' | 'warning' | 'info'
export type VerdictType = 'SUSTAINED' | 'DOWNGRADED' | 'REJECTED'

export interface FileDiff {
  path: string
  hunks: string
  language: string
  /** Total lines in the diff (additions + deletions). Used for workload estimation. */
  diffLineCount: number
}

export interface DiffBucket {
  role: ReviewRole
  files: FileDiff[]
  totalLines: number
}

export interface ConsolidatedFinding extends Finding {
  consensus: string
  patternNote?: string
}

export interface ReviewReport {
  pr: string
  summary: { critical: number; warning: number; info: number }
  findings: ConsolidatedFinding[]
  strengths: string[]
  verdict: 'APPROVE' | 'REQUEST_CHANGES'
  noiseWarning?: boolean
  cost: { total_usd: number; per_reviewer: number[] }
  tokens: { total: number; per_reviewer: number[] }
}

export interface TriagedFindings {
  autoPass: Finding[]
  autoDrop: Finding[]
  mustFalsify: Finding[]
}

export interface ReviewerResult {
  findings: Finding[]
  strengths: string[]
  cost: number
  tokens: number
}
