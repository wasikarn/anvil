import { readFileSync } from 'node:fs'
import { runClaudeSubprocess } from '../../claude-subprocess.js'
import { MODEL_ID } from '../../config.js'
import type { ResolvedConfig } from '../../config.js'
import { PLAN_CHALLENGE_PROMPT } from '../prompts/challenger.js'
import { ChallengeResultSchema, challengeResultJsonSchema, type ChallengeResult } from '../schemas/challenge.js'

export async function runPlanChallenge(params: {
  planPath: string
  researchPath: string | undefined
  config: ResolvedConfig
}): Promise<ChallengeResult> {
  const planContent = readFileSync(params.planPath, 'utf8')
  const researchContent =
    params.researchPath !== undefined ? readFileSync(params.researchPath, 'utf8') : '(no research.md provided)'

  const invoke = (): ReturnType<typeof runClaudeSubprocess> => runClaudeSubprocess({
    systemPrompt: PLAN_CHALLENGE_PROMPT,
    userMessage: `Challenge this implementation plan.\n\nPLAN:\n${planContent}\n\nRESEARCH:\n${researchContent}\n\nReturn verdicts as JSON.`,
    allowedTools: ['Read', 'Grep', 'Glob'],
    outputSchema: challengeResultJsonSchema as Record<string, unknown>,
    maxTurns: 5,
    maxBudgetUsd: params.config.maxBudgetFalsification,
    model: MODEL_ID[params.config.model],
  })

  let result: Awaited<ReturnType<typeof runClaudeSubprocess>>
  try {
    result = await invoke()
  } catch (firstErr) {
    const msg = String(firstErr)
    if (msg.includes('rate_limit') || msg.includes('overload')) {
      // One retry on transient server errors — 5s backoff is sufficient for rate limit windows
      console.warn(`[sdk-plan-challenge] transient error — retrying once in 5s: ${msg}`)
      await new Promise(res => setTimeout(res, 5_000))
      result = await invoke()
    } else {
      throw firstErr
    }
  }

  const raw = result.structuredOutput
  if (raw === undefined || raw === null) {
    throw new Error('[sdk-plan-challenge] no structured output — budget may have been exceeded')
  }

  const parsed = ChallengeResultSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`[sdk-plan-challenge] schema validation failed: ${JSON.stringify(parsed.error.issues)}`)
  }

  return parsed.data
}
