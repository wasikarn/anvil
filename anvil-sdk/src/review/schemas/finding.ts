import { z } from 'zod'

export const FindingSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']),
  rule: z.string(),
  file: z.string(),
  line: z.number().int().nullable(),
  confidence: z.number().int().min(0).max(100),
  issue: z.string(),
  fix: z.string(),
  isHardRule: z.boolean(),
  crossDomain: z.string().optional(),
})

export const FindingArraySchema = z.array(FindingSchema)

// Wrapped schema for SDK outputFormat — Claude API requires top-level type:object (not array)
export const FindingResultSchema = z.object({
  findings: FindingArraySchema,
  strengths: z.array(z.string()).optional(),
})

// Manually crafted JSON schema for Claude API outputFormat.
// Avoids z.toJSONSchema() quirks: $schema field, anyOf for nullable, large integer bounds.
// line is omitted from required (Claude sends null → Zod coerces to null, validation still works).
export const findingResultJsonSchema = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
          rule: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          issue: { type: 'string' },
          fix: { type: 'string' },
          isHardRule: { type: 'boolean' },
          crossDomain: { type: 'string' },
        },
        required: ['severity', 'rule', 'file', 'confidence', 'issue', 'fix', 'isHardRule'],
      },
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['findings'],
} as const

export type Finding = z.infer<typeof FindingSchema>
