import Anthropic from '@anthropic-ai/sdk'
import type { ModelName, ResolvedConfig } from '../../config.js'
import type { Finding, Verdict } from '../../types.js'
import { FALSIFICATION_PROMPT } from '../prompts/falsifier.js'
import { VerdictResultSchema, verdictResultJsonSchema } from '../schemas/verdict.js'

const MODEL_MAP: Record<ModelName, string> = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
}

export async function runFalsification(params: {
  findings: Finding[]
  config: ResolvedConfig
}): Promise<Verdict[]> {
  if (params.findings.length === 0) return []

  const client = new Anthropic()

  const findingsSummary = params.findings
    .map((f, i) => `[${i}] ${f.severity} | ${f.rule} | ${f.file}:${f.line ?? '?'} — ${f.issue}`)
    .join('\n')

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: MODEL_MAP[params.config.model],
      max_tokens: 2048,
      // Stable system prompt cached after first call (~600+ tokens → 0.1x on repeat)
      system: [
        {
          type: 'text',
          text: FALSIFICATION_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: verdictResultJsonSchema as Record<string, unknown>,
        },
      },
      messages: [
        {
          role: 'user',
          content: `Challenge each of the following ${params.findings.length} findings. Return verdicts as JSON.\n\nFINDINGS:\n${findingsSummary}`,
        },
      ],
    })
  } catch (err) {
    // Non-fatal: budget exceeded, rate limit, etc. — findings pass through unchanged
    console.warn(`[sdk-review] falsifier API call failed — skipping: ${String(err)}`)
    return []
  }

  if (process.env.SDK_DEBUG) {
    const usage = response.usage as unknown as Record<string, number>
    console.error(
      `[falsifier] tokens: input=${usage.input_tokens} cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`,
    )
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (textBlock === undefined) {
    console.warn('[sdk-review] falsifier returned no text block — skipping')
    return []
  }

  let parsed: ReturnType<typeof VerdictResultSchema.safeParse>
  try {
    parsed = VerdictResultSchema.safeParse(JSON.parse(textBlock.text))
  } catch {
    console.warn('[sdk-review] falsifier returned invalid JSON — skipping')
    return []
  }

  if (!parsed.success) {
    console.warn(
      `[sdk-review] verdicts failed schema validation — skipping: ${JSON.stringify(parsed.error.issues)}`,
    )
    return []
  }

  return parsed.data.verdicts
}
