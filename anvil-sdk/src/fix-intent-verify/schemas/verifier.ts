import { z } from 'zod'

export const VerifierVerdictSchema = z.object({
  threadIndex: z.number().int().min(0),
  file: z.string(),
  issueSummary: z.string(),
  verdict: z.enum(['ADDRESSED', 'PARTIAL', 'MISALIGNED']),
  reviewerConcern: z.string(),
  appliedChange: z.string(),
  gap: z.string().optional(),
  rationale: z.string(),
})

export const VerifierResultSchema = z.object({
  verdicts: z.array(VerifierVerdictSchema),
  summary: z.object({
    addressed: z.number().int().min(0),
    partial: z.number().int().min(0),
    misaligned: z.number().int().min(0),
  }),
})

// Manually crafted JSON schema — avoids z.toJSONSchema() $schema field and anyOf quirks.
// minimum: 0 constraints are intentionally added beyond the spec to enforce valid cardinality.
export const verifierResultJsonSchema = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          threadIndex:     { type: 'integer', minimum: 0 },
          file:            { type: 'string' },
          issueSummary:    { type: 'string' },
          verdict:         { type: 'string', enum: ['ADDRESSED', 'PARTIAL', 'MISALIGNED'] },
          reviewerConcern: { type: 'string' },
          appliedChange:   { type: 'string' },
          gap:             { type: 'string' },
          rationale:       { type: 'string' },
        },
        required: ['threadIndex', 'file', 'issueSummary', 'verdict', 'reviewerConcern', 'appliedChange', 'rationale'],
      },
    },
    summary: {
      type: 'object',
      properties: {
        addressed:  { type: 'integer', minimum: 0 },
        partial:    { type: 'integer', minimum: 0 },
        misaligned: { type: 'integer', minimum: 0 },
      },
      required: ['addressed', 'partial', 'misaligned'],
    },
  },
  required: ['verdicts', 'summary'],
} as const

export type VerifierVerdict = z.infer<typeof VerifierVerdictSchema>
export type VerifierResult = z.infer<typeof VerifierResultSchema>
