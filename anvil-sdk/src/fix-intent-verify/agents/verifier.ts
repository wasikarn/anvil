import { runClaudeSubprocess } from '../../claude-subprocess.js'
import type { ResolvedConfig } from '../../config.js'
import { VERIFIER_PROMPT } from '../prompts/verifier.js'
import type { VerifierResult } from '../schemas/verifier.js'
import { VerifierResultSchema, verifierResultJsonSchema } from '../schemas/verifier.js'

export async function runIntentVerification(params: {
  pr: number
  triageContent: string
  config: ResolvedConfig
}): Promise<VerifierResult> {
  let result: Awaited<ReturnType<typeof runClaudeSubprocess>>
  try {
    result = await runClaudeSubprocess({
      systemPrompt: VERIFIER_PROMPT,
      userMessage: `Verify fix intent for PR #${params.pr}. Triage:\n${params.triageContent}`,
      allowedTools: ['Read', 'Bash'],
      outputSchema: verifierResultJsonSchema as Record<string, unknown>,
      maxTurns: 8,
      maxBudgetUsd: params.config.maxBudgetVerification,
    })
  } catch (err) {
    // Budget exceeded and similar non-fatal errors — caller (respond lead) proceeds without verification
    const msg = String(err)
    if (msg.includes('budget') || msg.includes('rate_limit') || msg.includes('overload')) {
      console.warn(`[fix-intent-verify] non-fatal error — returning empty verdicts: ${msg}`)
      return { verdicts: [], summary: { addressed: 0, partial: 0, misaligned: 0 } }
    }
    throw err
  }

  const raw = result.structuredOutput
  if (raw === undefined || raw === null) {
    throw new Error('[fix-intent-verify] no structured output — budget may have been exceeded')
  }

  const parsed = VerifierResultSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`[fix-intent-verify] schema validation failed: ${JSON.stringify(parsed.error.issues)}`)
  }

  return parsed.data
}
