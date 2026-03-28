import type { ResolvedConfig } from '../config.js'
import type { DiffBucket, FileDiff, ReviewerResult, ReviewRole } from '../types.js'
import { runReviewer } from './agents/reviewer.js'
import { mapToDomains } from './domain-mapper.js'

const ADONIS_PATH_RE = /(?:app\/(?:controllers|models|validators|services)|start\/routes)/

function detectAdonisProject(files: FileDiff[]): boolean {
  return files.some(f => ADONIS_PATH_RE.test(f.path))
}

export async function runReview(params: {
  files: FileDiff[]
  hardRules: string
  dismissedPatterns: string
  config: ResolvedConfig
}): Promise<{ results: ReviewerResult[]; roles: ReviewRole[]; totalCost: number; totalTokens: number }> {
  const buckets = mapToDomains(params.files)
  const activeBuckets = buckets.filter((b: DiffBucket) => b.files.length > 0)
  const isAdonisProject = detectAdonisProject(params.files)

  const settled = await Promise.allSettled(
    activeBuckets.map((bucket: DiffBucket) =>
      runReviewer({
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
      console.warn(`[sdk-review] reviewer failed: ${String(r.reason)}`)
      return { findings: [], strengths: [], cost: 0, tokens: 0 }
    }
    return r.value
  })

  // roles[i] corresponds to results[i] — preserves reviewer attribution
  const roles: ReviewRole[] = activeBuckets.map((b: DiffBucket) => b.role)

  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0)

  return { results, roles, totalCost, totalTokens }
}
