import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk'
import type { DiffBucket, ReviewRole } from '../../types.js'
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

// Lens assignment per role:
// correctness: security, error-handling, typescript
// architecture: performance, database, api-design, observability
// dx: frontend, typescript, error-handling

function getLensesForRole(role: ReviewRole): string {
  switch (role) {
    case 'correctness':
      return [SECURITY_LENS, ERROR_HANDLING_LENS, TYPESCRIPT_LENS].join('\n\n')
    case 'architecture':
      return [PERFORMANCE_LENS, DATABASE_LENS, API_DESIGN_LENS, OBSERVABILITY_LENS].join('\n\n')
    case 'dx':
      return [FRONTEND_LENS, TYPESCRIPT_LENS, ERROR_HANDLING_LENS].join('\n\n')
  }
}

export function createReviewer(params: {
  bucket: DiffBucket
  hardRules: string
  dismissedPatterns: string
}): AgentDefinition {
  const lensContent = getLensesForRole(params.bucket.role)

  // Build diff content from bucket files
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

  // Pick prompt builder based on role
  let prompt: string
  switch (params.bucket.role) {
    case 'correctness':
      prompt = buildReviewer1Prompt(promptConfig)
      break
    case 'architecture':
      prompt = buildReviewer2Prompt(promptConfig)
      break
    case 'dx':
      prompt = buildReviewer3Prompt(promptConfig)
      break
  }

  return {
    description: `Code reviewer: ${params.bucket.role}`,
    prompt,
    tools: ['Read', 'Grep', 'Glob'],
    model: 'claude-sonnet-4-5',
  }
}
