import { z } from 'zod'

export const VerdictSchema = z.object({
  findingIndex: z.number().int().min(0),
  originalSummary: z.string(),
  verdict: z.enum(['SUSTAINED', 'DOWNGRADED', 'REJECTED']),
  newSeverity: z.enum(['critical', 'warning', 'info']).optional(),
  rationale: z.string(),
})

export const VerdictArraySchema = z.array(VerdictSchema)

// Wrapped schema for SDK outputFormat — Claude API requires top-level type:object (not array)
export const VerdictResultSchema = z.object({ verdicts: VerdictArraySchema })

// Manually crafted JSON schema — avoids z.toJSONSchema() $schema field and anyOf quirks
export const verdictResultJsonSchema = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          findingIndex: { type: 'integer', minimum: 0 },
          originalSummary: { type: 'string' },
          verdict: { type: 'string', enum: ['SUSTAINED', 'DOWNGRADED', 'REJECTED'] },
          newSeverity: { type: 'string', enum: ['critical', 'warning', 'info'] },
          rationale: { type: 'string' },
        },
        required: ['findingIndex', 'originalSummary', 'verdict', 'rationale'],
      },
    },
  },
  required: ['verdicts'],
} as const

export type Verdict = z.infer<typeof VerdictSchema>
