import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { ResolvedConfig } from '../../config.js'
import type { Finding, Verdict } from '../../types.js'
import { FALSIFICATION_PROMPT } from '../prompts/falsifier.js'
import { VerdictArraySchema, verdictArrayJsonSchema } from '../schemas/verdict.js'

function createFalsifier(model: 'sonnet' | 'opus' | 'haiku'): AgentDefinition {
  return {
    description: 'Challenges review findings — goal is REJECT, not confirm',
    prompt: FALSIFICATION_PROMPT,
    tools: ['Read', 'Grep', 'Glob'],
    model,
    maxTurns: 3,
  }
}

export async function runFalsification(params: {
  findings: Finding[]
  config: ResolvedConfig
}): Promise<Verdict[]> {
  if (params.findings.length === 0) return []

  const agent = createFalsifier(params.config.model)
  const findingsSummary = params.findings
    .map((f, i) => `[${i}] ${f.severity} | ${f.rule} | ${f.file}:${f.line ?? '?'} — ${f.issue}`)
    .join('\n')

  const verdicts: Verdict[] = []

  for await (const msg of query({
    prompt: `Challenge each of the following ${params.findings.length} findings. Return verdicts as JSON.\n\nFINDINGS:\n${findingsSummary}`,
    options: {
      agents: { falsifier: agent },
      agent: 'falsifier',
      allowedTools: ['Read', 'Grep', 'Glob'],
      // NOTE: permissionMode and allowDangerouslySkipPermissions are silently ignored
      // when run inside a Claude Code plugin. This SDK is designed for CLI use only.
      // Run via: npx tsx anvil-sdk/src/cli.ts review ...
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: params.config.maxTurnsFalsification,
      maxBudgetUsd: params.config.maxBudgetFalsification,
      outputFormat: {
        type: 'json_schema',
        schema: verdictArrayJsonSchema as Record<string, unknown>,
      },
    },
  })) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        const raw = msg.structured_output
        const parsed = VerdictArraySchema.safeParse(raw)
        if (parsed.success) {
          verdicts.push(...parsed.data)
        } else {
          throw new Error(`[sdk-review] verdicts failed schema validation: ${JSON.stringify(parsed.error.issues)}`)
        }
      } else {
        throw new Error(`[sdk-review] falsifier ended with subtype: ${msg.subtype}`)
      }
    }
  }

  return verdicts
}
