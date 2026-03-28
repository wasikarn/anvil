import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk'
import type { ResolvedConfig } from '../config.js'
import type { DiffBucket, FileDiff, ReviewerResult } from '../types.js'
import { createReviewer } from './agents/reviewer.js'
import { mapToDomains } from './domain-mapper.js'
import { type Finding, FindingResultSchema, findingResultJsonSchema } from './schemas/finding.js'

const ADONIS_PATH_RE = /(?:app\/(?:controllers|models|validators|services)|start\/routes)/

function detectAdonisProject(files: FileDiff[]): boolean {
  return files.some(f => ADONIS_PATH_RE.test(f.path))
}

async function runSingleReviewer(params: {
  bucket: DiffBucket
  hardRules: string
  dismissedPatterns: string
  isAdonisProject: boolean
  config: ResolvedConfig
}): Promise<ReviewerResult> {
  const agent = createReviewer({
    bucket: params.bucket,
    hardRules: params.hardRules,
    dismissedPatterns: params.dismissedPatterns,
    isAdonisProject: params.isAdonisProject,
    model: params.config.model,
  })

  let totalCost = 0
  let totalTokens = 0
  let findings: Finding[] = []
  let strengths: string[] = []

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
        schema: findingResultJsonSchema as Record<string, unknown>,
      },
    },
  })) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        const result = msg as SDKResultSuccess

        const raw = result.structured_output
        if (raw === undefined || raw === null) {
          throw new Error('[sdk-review] reviewer returned no structured_output — budget may have been exceeded or outputFormat was rejected')
        }
        const parsed = FindingResultSchema.safeParse(raw)
        if (parsed.success) {
          findings = parsed.data.findings
          strengths = parsed.data.strengths ?? []
        } else {
          throw new Error(`[sdk-review] structured_output failed schema validation: ${JSON.stringify(parsed.error.issues)}`)
        }

        totalCost = result.total_cost_usd
        totalTokens = result.usage.input_tokens + result.usage.output_tokens
      } else {
        // Surface error subtypes so Promise.allSettled captures them
        throw new Error(`[sdk-review] reviewer ended with subtype: ${msg.subtype}`)
      }
    }
  }

  return { findings, strengths, cost: totalCost, tokens: totalTokens }
}

export async function runReview(params: {
  files: FileDiff[]
  hardRules: string
  dismissedPatterns: string
  config: ResolvedConfig
}): Promise<{ results: ReviewerResult[]; totalCost: number; totalTokens: number }> {
  const buckets = mapToDomains(params.files)
  const isAdonisProject = detectAdonisProject(params.files)

  const settled = await Promise.allSettled(
    buckets
      .filter(b => b.files.length > 0)
      .map(bucket =>
        runSingleReviewer({
          bucket,
          hardRules: params.hardRules,
          dismissedPatterns: params.dismissedPatterns,
          isAdonisProject,
          config: params.config,
        })
      )
  )

  const results: ReviewerResult[] = settled.map(r => {
    if (r.status === 'rejected') {
      console.warn(`[sdk-review] reviewer failed:`, r.reason)
      return { findings: [], strengths: [], cost: 0, tokens: 0 }
    }
    return r.value
  })

  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0)

  return { results, totalCost, totalTokens }
}
