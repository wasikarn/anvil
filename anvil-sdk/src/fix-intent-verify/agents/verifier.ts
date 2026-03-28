import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { ModelName, ResolvedConfig } from '../../config.js'
import { VERIFIER_PROMPT } from '../prompts/verifier.js'
import type { VerifierResult } from '../schemas/verifier.js'
import { VerifierResultSchema, verifierResultJsonSchema } from '../schemas/verifier.js'

export function createIntentVerifier(model: ModelName): AgentDefinition {
  return {
    description: 'Verifies each fix addresses reviewer intent — outputs ADDRESSED/PARTIAL/MISALIGNED',
    prompt: VERIFIER_PROMPT,
    tools: ['Read', 'Bash'],  // Bash for: gh pr view (thread text), git diff
    model,
    maxTurns: 8,
  }
}

export async function runIntentVerification(params: {
  pr: number
  triageContent: string
  config: ResolvedConfig
}): Promise<VerifierResult> {
  const agent = createIntentVerifier(params.config.model)

  for await (const msg of query({
    prompt: `Verify fix intent for PR #${params.pr}. Triage:\n${params.triageContent}`,
    options: {
      agents: { 'fix-intent-verifier': agent },
      agent: 'fix-intent-verifier',
      allowedTools: ['Read', 'Bash'],
      // NOTE: permissionMode and allowDangerouslySkipPermissions are silently ignored
      // when run inside a Claude Code plugin. This SDK is designed for CLI use only.
      // Run via: npx tsx anvil-sdk/src/cli.ts fix-intent-verify ...
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 8,
      maxBudgetUsd: params.config.maxBudgetVerification,
      outputFormat: {
        type: 'json_schema',
        schema: verifierResultJsonSchema as Record<string, unknown>,
      },
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      const raw = msg.structured_output
      if (raw === undefined || raw === null) {
        throw new Error('[fix-intent-verify] no structured_output — budget may have been exceeded')
      }
      const parsed = VerifierResultSchema.safeParse(raw)
      if (!parsed.success) {
        throw new Error(`[fix-intent-verify] schema validation failed: ${JSON.stringify(parsed.error.issues)}`)
      }
      return parsed.data
    }
    else if (msg.type === 'result') {
      // Budget-related failures are non-fatal per spec — caller (respond lead) proceeds without verification
      if (msg.subtype === 'error_max_budget_usd' || msg.subtype === 'error_max_structured_output_retries') {
        console.warn(`[fix-intent-verify] ${msg.subtype} — returning empty verdicts, caller should proceed without verification`)
        return { verdicts: [], summary: { addressed: 0, partial: 0, misaligned: 0 } }
      }
      throw new Error(`[fix-intent-verify] ended with: ${msg.subtype}`)
    }
  }

  throw new Error('[fix-intent-verify] no result message received')
}
