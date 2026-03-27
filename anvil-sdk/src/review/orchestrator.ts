import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk'
import type { ResolvedConfig } from '../config.js'
import type { DiffBucket, FileDiff, ReviewerResult } from '../types.js'
import { createReviewer } from './agents/reviewer.js'
import { mapToDomains } from './domain-mapper.js'
import type { Finding } from './schemas/finding.js'
import { findingArrayJsonSchema } from './schemas/finding.js'

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
    if (msg.type === 'result' && msg.subtype === 'success') {
      const result = msg as SDKResultSuccess

      const raw = result.structured_output
      if (Array.isArray(raw)) {
        findings = raw as Finding[]
      }

      totalCost = result.total_cost_usd
      totalTokens = result.usage.input_tokens + result.usage.output_tokens
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

  const results = await Promise.all(
    buckets.map(bucket =>
      runSingleReviewer({
        bucket,
        hardRules: params.hardRules,
        dismissedPatterns: params.dismissedPatterns,
        config: params.config,
      })
    )
  )

  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0)

  return { results, totalCost, totalTokens }
}
