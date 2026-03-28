import { runClaudeSubprocess } from '../../claude-subprocess.js'
import type { ResolvedConfig } from '../../config.js'
import type { DiffBucket, ReviewRole, ReviewerResult } from '../../types.js'
import { ADONISJS_LENS } from '../lenses/adonisjs.js'
import { API_DESIGN_LENS } from '../lenses/api-design.js'
import { DATABASE_LENS } from '../lenses/database.js'
import { ERROR_HANDLING_LENS } from '../lenses/error-handling.js'
import { FRONTEND_LENS } from '../lenses/frontend.js'
import { OBSERVABILITY_LENS } from '../lenses/observability.js'
import { PERFORMANCE_LENS } from '../lenses/performance.js'
import { SECURITY_LENS } from '../lenses/security.js'
import { TYPESCRIPT_LENS } from '../lenses/typescript.js'
import { buildReviewer1Prompt } from '../prompts/reviewer-1.js'
import { buildReviewer2Prompt } from '../prompts/reviewer-2.js'
import { buildReviewer3Prompt } from '../prompts/reviewer-3.js'
import { SHARED_RULES } from '../prompts/shared-rules.js'
import { FindingResultSchema, findingResultJsonSchema } from '../schemas/finding.js'

// Lens assignment per role:
// correctness: security, error-handling, typescript [+ adonisjs if detected]
// architecture: performance, database, api-design, observability [+ adonisjs if detected]
// dx: frontend, typescript, error-handling

function getLensesForRole(role: ReviewRole, isAdonisProject: boolean): string {
  const parts: string[] = []
  switch (role) {
    case 'correctness':
      parts.push(SECURITY_LENS, ERROR_HANDLING_LENS, TYPESCRIPT_LENS)
      if (isAdonisProject) parts.push(ADONISJS_LENS)
      break
    case 'architecture':
      parts.push(PERFORMANCE_LENS, DATABASE_LENS, API_DESIGN_LENS, OBSERVABILITY_LENS)
      if (isAdonisProject) parts.push(ADONISJS_LENS)
      break
    case 'dx':
      parts.push(FRONTEND_LENS, TYPESCRIPT_LENS, ERROR_HANDLING_LENS)
      break
  }
  return parts.join('\n\n')
}

export async function runReviewer(params: {
  bucket: DiffBucket
  hardRules: string
  dismissedPatterns: string
  isAdonisProject: boolean
  config: ResolvedConfig
}): Promise<ReviewerResult> {
  const lensContent = getLensesForRole(params.bucket.role, params.isAdonisProject)
  const diffContent = params.bucket.files
    .map(f => `### ${f.path}\n\`\`\`${f.language}\n${f.hunks}\n\`\`\``)
    .join('\n\n')

  const promptConfig = {
    diffContent,
    sharedRules: SHARED_RULES,
    hardRules: params.hardRules,
    lensContent,
    dismissedPatterns: params.dismissedPatterns,
  }

  let systemPrompt: string
  switch (params.bucket.role) {
    case 'correctness':
      systemPrompt = buildReviewer1Prompt(promptConfig)
      break
    case 'architecture':
      systemPrompt = buildReviewer2Prompt(promptConfig)
      break
    case 'dx':
      systemPrompt = buildReviewer3Prompt(promptConfig)
      break
  }

  let result: Awaited<ReturnType<typeof runClaudeSubprocess>>
  try {
    result = await runClaudeSubprocess({
      systemPrompt,
      userMessage: 'Review the code changes in your context and return findings as JSON.',
      allowedTools: ['Read', 'Grep', 'Glob'],
      outputSchema: findingResultJsonSchema as Record<string, unknown>,
      maxTurns: params.config.maxTurnsReviewer,
      maxBudgetUsd: params.config.maxBudgetPerReviewer,
    })
  } catch (err) {
    console.warn(`[sdk-review] reviewer (${params.bucket.role}) failed: ${String(err)}`)
    return { findings: [], strengths: [], cost: 0, tokens: 0 }
  }

  const raw = result.structuredOutput
  if (raw === undefined || raw === null) {
    console.warn(`[sdk-review] reviewer (${params.bucket.role}) returned no structured output — skipping`)
    return { findings: [], strengths: [], cost: 0, tokens: 0 }
  }

  const parsed = FindingResultSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(`[sdk-review] reviewer (${params.bucket.role}) schema failed — skipping`)
    return { findings: [], strengths: [], cost: 0, tokens: 0 }
  }

  return {
    findings: parsed.data.findings,
    strengths: parsed.data.strengths ?? [],
    cost: 0,
    tokens: 0,
  }
}
