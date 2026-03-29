import { runClaudeSubprocess } from '../../claude-subprocess.js'
import { MODEL_ID } from '../../config.js'
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

// Lens assignment per role — keyword-gated to avoid injecting irrelevant domain guidance.
// Mirrors the Lens Selection table in skills/build/references/phase-6-review.md.
// Each role has a fallback lens injected when no keywords match, ensuring reviewers always
// receive at least one domain lens.
//
// correctness: security (auth/token/…), error-handling (try/catch/…), typescript (.ts/.tsx/…) [+ adonisjs]
// architecture: performance (SELECT/loop/…), database (migration/schema/…), api-design (router/…), observability (logger/…) [+ adonisjs]
// dx: frontend (.tsx/.jsx/useState/…), typescript (.ts/.tsx/…), error-handling (try/catch/…)

function getLensesForRole(role: ReviewRole, isAdonisProject: boolean, diffContent: string): string {
  const parts: string[] = []
  switch (role) {
    case 'correctness':
      if (/auth|token|password|secret|jwt|cookie|csrf|sql|query|exec|eval/i.test(diffContent))
        parts.push(SECURITY_LENS)
      if (/try|catch|async|\.catch\(|Promise|new Error|throw/i.test(diffContent))
        parts.push(ERROR_HANDLING_LENS)
      if (/\.tsx?|interface\b|as any|<[A-Z]\w*>|extends\b/i.test(diffContent))
        parts.push(TYPESCRIPT_LENS)
      // Fallback: TypeScript lens is always relevant for TS projects
      if (parts.length === 0) parts.push(TYPESCRIPT_LENS)
      if (isAdonisProject) parts.push(ADONISJS_LENS)
      break
    case 'architecture':
      if (/SELECT|findAll|findMany|loop|forEach|\.map\(|\.filter\(|sort|cache|index/i.test(diffContent))
        parts.push(PERFORMANCE_LENS)
      if (/migration|schema|ALTER|CREATE TABLE|DROP|knex|prisma|typeorm|sequelize/i.test(diffContent))
        parts.push(DATABASE_LENS)
      if (/router|controller|handler|endpoint|route|REST|GraphQL|resolver/i.test(diffContent))
        parts.push(API_DESIGN_LENS)
      if (/logger|log\.|metric|trace|span|monitor|alert|newrelic|datadog/i.test(diffContent))
        parts.push(OBSERVABILITY_LENS)
      // Fallback: performance lens applies broadly to any code change
      if (parts.length === 0) parts.push(PERFORMANCE_LENS)
      if (isAdonisProject) parts.push(ADONISJS_LENS)
      break
    case 'dx':
      if (/\.tsx|\.jsx|useState|useEffect|component|render|style|css/i.test(diffContent))
        parts.push(FRONTEND_LENS)
      if (/\.tsx?|interface\b|as any|<[A-Z]\w*>|extends\b/i.test(diffContent))
        parts.push(TYPESCRIPT_LENS)
      if (/try|catch|async|\.catch\(|Promise|new Error|throw/i.test(diffContent))
        parts.push(ERROR_HANDLING_LENS)
      // Fallback: TypeScript lens applies to any TS change
      if (parts.length === 0) parts.push(TYPESCRIPT_LENS)
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
  const diffContent = params.bucket.files
    .map(f => `### ${f.path}\n\`\`\`${f.language}\n${f.hunks}\n\`\`\``)
    .join('\n\n')

  const lensContent = getLensesForRole(params.bucket.role, params.isAdonisProject, diffContent)

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
      model: MODEL_ID[params.config.model],
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
    cost: result.costUsd,
    tokens: result.tokens,
  }
}
