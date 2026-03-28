import { runClaudeSubprocess } from '../../claude-subprocess.js'
import type { ResolvedConfig } from '../../config.js'
import type { Finding, Verdict } from '../../types.js'
import { findingKey } from '../consolidator.js'
import { FALSIFICATION_PROMPT } from '../prompts/falsifier.js'
import { VerdictResultSchema, verdictResultJsonSchema } from '../schemas/verdict.js'

export async function runFalsification(params: {
  findings: Finding[]
  config: ResolvedConfig
}): Promise<Verdict[]> {
  if (params.findings.length === 0) return []

  const findingsSummary = params.findings
    .map((f, i) => {
      const key = findingKey(f)
      return `[${i}] ${f.severity} | ${f.rule} | ${f.file}:${f.line ?? '?'} — ${f.issue} [key:${key}]`
    })
    .join('\n')

  let result: Awaited<ReturnType<typeof runClaudeSubprocess>>
  try {
    result = await runClaudeSubprocess({
      systemPrompt: FALSIFICATION_PROMPT,
      userMessage: `Challenge each of the following ${params.findings.length} findings. Return verdicts as JSON.\n\nFINDINGS:\n${findingsSummary}`,
      outputSchema: verdictResultJsonSchema as Record<string, unknown>,
      maxTurns: 1,
      maxBudgetUsd: params.config.maxBudgetFalsification,
    })
  } catch (err) {
    // Non-fatal: budget exceeded, rate limit, etc. — findings pass through unchanged
    console.warn(`[sdk-review] falsifier failed — skipping: ${String(err)}`)
    return []
  }

  const raw = result.structuredOutput
  if (raw === undefined || raw === null) {
    console.warn('[sdk-review] falsifier returned no structured output — skipping')
    return []
  }

  const parsed = VerdictResultSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(`[sdk-review] verdicts failed schema validation — skipping: ${JSON.stringify(parsed.error.issues)}`)
    return []
  }

  return parsed.data.verdicts
}
