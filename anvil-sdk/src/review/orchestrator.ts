import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk'
import type { ResolvedConfig } from '../config.js'
import type { DiffBucket, FileDiff, ReviewerResult } from '../types.js'
import { createReviewer } from './agents/reviewer.js'
import { mapToDomains } from './domain-mapper.js'
import type { Finding } from './schemas/finding.js'
import { FindingArraySchema, findingArrayJsonSchema } from './schemas/finding.js'

async function runSingleReviewer(params: {
  bucket: DiffBucket
  hardRules: string
  dismissedPatterns: string
  config: ResolvedConfig
}): Promise<ReviewerResult> {
  const agent = createReviewer({
    bucket: params.bucket,
    hardRules: params.hardRules,
    dismissedPatterns: params.dismissedPatterns,
    model: params.config.model,
  })

  let totalCost = 0
  let totalTokens = 0
  let findings: Finding[] = []

  for await (const msg of query({
    prompt: 'Review the code changes in your context and return findings as JSON.',
    options: {
      agents: { reviewer: agent },
      agent: 'reviewer',
      allowedTools: ['Read', 'Grep', 'Glob'],
      // NOTE: permissionMode and allowDangerouslySkipPermissions are silently ignored
      // when run inside a Claude Code plugin. This SDK is designed for CLI use only.
      // Run via: npx tsx anvil-sdk/src/cli.ts review ...
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: params.config.maxTurnsReviewer,
      maxBudgetUsd: params.config.maxBudgetPerReviewer,
      outputFormat: {
        type: 'json_schema',
        schema: findingArrayJsonSchema as Record<string, unknown>,
      },
    },
  })) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        const result = msg as SDKResultSuccess

        const raw = result.structured_output
        const parsed = FindingArraySchema.safeParse(raw)
        if (parsed.success) {
          findings = parsed.data
        } else {
          console.warn('[sdk-review] structured_output failed validation:', parsed.error.issues)
        }

        totalCost = result.total_cost_usd
        totalTokens = result.usage.input_tokens + result.usage.output_tokens
      } else {
        // Surface error subtypes so Promise.allSettled captures them
        throw new Error(`[sdk-review] reviewer ended with subtype: ${msg.subtype}`)
      }
    }
  }

  return { findings, cost: totalCost, tokens: totalTokens }
}

export async function runReview(params: {
  files: FileDiff[]
  hardRules: string
  dismissedPatterns: string
  config: ResolvedConfig
}): Promise<{ results: ReviewerResult[]; totalCost: number; totalTokens: number }> {
  const buckets = mapToDomains(params.files)

  const settled = await Promise.allSettled(
    buckets
      .filter(b => b.files.length > 0)
      .map(bucket =>
        runSingleReviewer({
          bucket,
          hardRules: params.hardRules,
          dismissedPatterns: params.dismissedPatterns,
          config: params.config,
        })
      )
  )

  const results: ReviewerResult[] = settled.map(r => {
    if (r.status === 'rejected') {
      console.warn(`[sdk-review] reviewer failed:`, r.reason)
      return { findings: [], cost: 0, tokens: 0 }
    }
    return r.value
  })

  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0)

  return { results, totalCost, totalTokens }
}
