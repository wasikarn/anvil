#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolveConfig } from './config.js'
import { runFalsification } from './review/agents/falsifier.js'
import { consolidate } from './review/consolidator.js'
import { readDiff, readPrDiff } from './review/diff-reader.js'
import { formatJson, formatMarkdown } from './review/output.js'
import { runReview } from './review/orchestrator.js'
import { triage } from './review/triage.js'
import type { ReviewReport } from './types.js'

// ─── review subcommand ────────────────────────────────────────────────────────

interface ParsedReviewArgs {
  pr: number | undefined
  branch: string | undefined
  baseBranch: string | undefined
  output: 'json' | 'markdown'
  falsification: boolean
  hardRulesPath: string | undefined
  budget: number | undefined
  dismissedPatternsPath: string | undefined
}

function parseArgs(args: string[]): ParsedReviewArgs {
  const result: ParsedReviewArgs = {
    pr: undefined,
    branch: undefined,
    baseBranch: undefined,
    output: 'json',
    falsification: true,
    hardRulesPath: undefined,
    budget: undefined,
    dismissedPatternsPath: undefined,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue

    if (arg === '--no-falsification') {
      result.falsification = false
      continue
    }

    // Flags that consume the next argument
    const next = args[i + 1]

    if (arg === '--pr') {
      if (next === undefined) {
        console.error(`[sdk-review] --pr requires a value`)
        process.exit(1)
      }
      const n = parseInt(next, 10)
      if (Number.isNaN(n) || n <= 0) {
        console.error(`[sdk-review] --pr must be a positive integer, got: ${next}`)
        process.exit(1)
      }
      result.pr = n
      i++
    } else if (arg === '--branch') {
      if (next === undefined) {
        console.error(`[sdk-review] --branch requires a value`)
        process.exit(1)
      }
      result.branch = next
      i++
    } else if (arg === '--base-branch') {
      if (next === undefined) {
        console.error(`[sdk-review] --base-branch requires a value`)
        process.exit(1)
      }
      result.baseBranch = next
      i++
    } else if (arg === '--output') {
      if (next === undefined) {
        console.error(`[sdk-review] --output requires a value`)
        process.exit(1)
      }
      if (next === 'json' || next === 'markdown') {
        result.output = next
      } else {
        console.error(`[sdk-review] Unknown --output value: ${next}. Expected json or markdown.`)
        process.exit(1)
      }
      i++
    } else if (arg === '--hard-rules') {
      if (next === undefined) {
        console.error(`[sdk-review] --hard-rules requires a value`)
        process.exit(1)
      }
      result.hardRulesPath = next
      i++
    } else if (arg === '--budget') {
      if (next === undefined) {
        console.error(`[sdk-review] --budget requires a value`)
        process.exit(1)
      }
      const parsed = parseFloat(next)
      if (Number.isNaN(parsed) || parsed <= 0) {
        console.error(`[sdk-review] --budget must be a positive number, got: ${next}`)
        process.exit(1)
      }
      result.budget = parsed
      i++
    } else if (arg === '--dismissed') {
      if (next === undefined) {
        console.error('[sdk-review] --dismissed requires a path')
        process.exit(1)
      }
      result.dismissedPatternsPath = next
      i++
    } else if (arg.startsWith('--')) {
      console.warn(`[sdk-review] unknown flag: ${arg}`)
    }
  }

  return result
}

function loadHardRules(path: string | undefined): string {
  if (path !== undefined && path.length > 0) {
    if (!existsSync(path)) {
      console.error(`[sdk-review] --hard-rules path not found: ${path}`)
      process.exit(1)
    }
    return readFileSync(path, 'utf8')
  }
  // Look in cwd
  const defaults = ['hard-rules.md', '.build/hard-rules.md', 'docs/hard-rules.md']
  for (const p of defaults) {
    if (existsSync(p)) return readFileSync(p, 'utf8')
  }
  return ''
}

function loadDismissedPatterns(path: string | undefined): string {
  if (path === undefined) return ''
  if (!existsSync(path)) {
    console.warn(`[sdk-review] --dismissed path not found: ${path} — proceeding without dismissed patterns`)
    return ''
  }
  return readFileSync(path, 'utf8')
}

async function runReviewCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  const hardRules = loadHardRules(parsed.hardRulesPath)
  const config = resolveConfig({
    ...(parsed.budget !== undefined && { budgetUsd: parsed.budget }),
    noFalsification: !parsed.falsification,
  })

  let files: ReturnType<typeof readDiff>
  try {
    if (parsed.pr !== undefined) {
      files = readPrDiff(parsed.pr)
    } else {
      const diffTarget: { branch?: string; baseBranch?: string } = {}
      if (parsed.branch !== undefined) diffTarget.branch = parsed.branch
      if (parsed.baseBranch !== undefined) diffTarget.baseBranch = parsed.baseBranch
      files = readDiff(diffTarget)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[sdk-review] failed to read diff: ${message}`)
    process.exit(1)
  }

  if (files.length === 0) {
    console.error(
      'No diff found. Make sure you are in a git repo with uncommitted changes or specify --branch.',
    )
    process.exit(1)
  }

  // Run reviewers in parallel
  const { results, roles, totalCost, totalTokens } = await runReview({
    files,
    hardRules,
    dismissedPatterns: loadDismissedPatterns(parsed.dismissedPatternsPath),
    config,
  })

  // Build per-reviewer buckets (preserves attribution for role-based thresholds + consensus)
  // roles[i] must be defined — undefined means orchestrator/results mismatch
  const perReviewer = results.map((r, i) => {
    const role = roles[i]
    if (role === undefined) throw new Error(`[sdk-review] roles[${i}] undefined — results/roles mismatch`)
    return { role, findings: r.findings }
  })

  // Triage merged findings to find autoPass/mustFalsify split
  const allFindings = results.flatMap(r => r.findings)
  const { autoPass, autoDrop: _autoDrop, mustFalsify } = triage(allFindings)

  // Falsification
  let verdicts: Awaited<ReturnType<typeof runFalsification>> = []
  if (!config.noFalsification && mustFalsify.length > 0) {
    verdicts = await runFalsification({ findings: mustFalsify, config })
  }

  // Consolidate with full attribution — key-based Set prevents silent bug if objects were spread
  const mustFalsifyKeys = new Set(mustFalsify.map(f => `${f.file}:${f.line ?? 'null'}:${f.rule}`))
  const perReviewerMustFalsify = perReviewer.map(r => ({
    role: r.role,
    findings: r.findings.filter(f => mustFalsifyKeys.has(`${f.file}:${f.line ?? 'null'}:${f.rule}`)),
  }))

  const consolidated = consolidate({
    perReviewer: perReviewerMustFalsify,
    autoPass,
    verdicts,
    patternCapCount: config.patternCapCount,
  })

  // Build report
  const critical = consolidated.filter(f => f.severity === 'critical').length
  const warning = consolidated.filter(f => f.severity === 'warning').length
  const info = consolidated.filter(f => f.severity === 'info').length

  // Collect and deduplicate strengths across all reviewers (cap at 5)
  const allStrengths = results.flatMap(r => r.strengths)
  const strengths = [...new Set(allStrengths)].slice(0, 5)

  const totalSignal = critical + warning + info
  const noiseWarning = totalSignal > 0 && (critical + warning) / totalSignal < config.signalThreshold

  const report: ReviewReport = {
    pr: parsed.pr !== undefined ? `#${parsed.pr}` : (parsed.branch ?? 'HEAD'),
    summary: { critical, warning, info },
    findings: consolidated,
    strengths,
    verdict: critical > 0 ? 'REQUEST_CHANGES' : 'APPROVE',
    ...(noiseWarning && { noiseWarning: true }),
    cost: {
      total_usd: totalCost,
      per_reviewer: results.map(r => r.cost),
    },
    tokens: {
      total: totalTokens,
      per_reviewer: results.map(r => r.tokens),
    },
  }

  if (parsed.output === 'markdown') {
    console.log(formatMarkdown(report))
  } else {
    console.log(formatJson(report))
  }
}

// ─── plan-challenge subcommand ────────────────────────────────────────────────

interface ParsedPlanChallengeArgs {
  planFile: string | undefined
  researchFile: string | undefined
  output: 'json'
  budget: number | undefined
}

export function parsePlanChallengeArgs(args: string[]): ParsedPlanChallengeArgs {
  const result: ParsedPlanChallengeArgs = {
    planFile: undefined,
    researchFile: undefined,
    output: 'json',
    budget: undefined,
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue
    const next = args[i + 1]
    if (arg === '--plan-file') {
      if (next === undefined) {
        console.error('[sdk-plan-challenge] --plan-file requires a value')
        process.exit(1)
      }
      result.planFile = next
      i++
    } else if (arg === '--research-file') {
      if (next === undefined) {
        console.error('[sdk-plan-challenge] --research-file requires a value')
        process.exit(1)
      }
      result.researchFile = next
      i++
    } else if (arg === '--budget') {
      if (next !== undefined) {
        const n = parseFloat(next)
        if (!Number.isNaN(n)) {
          result.budget = n
          i++
        }
      }
    }
  }
  return result
}

async function runPlanChallengeCommand(args: string[]): Promise<void> {
  const parsed = parsePlanChallengeArgs(args)
  if (parsed.planFile === undefined) {
    console.error('[sdk-plan-challenge] --plan-file is required')
    process.exit(1)
  }
  if (!existsSync(parsed.planFile)) {
    console.error(`[sdk-plan-challenge] plan file not found: ${parsed.planFile}`)
    process.exit(1)
  }
  if (parsed.researchFile !== undefined && !existsSync(parsed.researchFile)) {
    console.error(`[sdk-plan-challenge] research file not found: ${parsed.researchFile}`)
    process.exit(1)
  }
  const config = resolveConfig({ ...(parsed.budget !== undefined && { budgetUsd: parsed.budget }) })
  const { runPlanChallenge } = await import('./plan/agents/challenger.js')
  const result = await runPlanChallenge({
    planPath: parsed.planFile,
    researchPath: parsed.researchFile,
    config,
  })
  console.log(JSON.stringify(result, null, 2))
}

// ─── investigate subcommand ───────────────────────────────────────────────────

interface ParsedInvestigateArgs {
  bug: string | undefined
  quick: boolean
  output: 'json'
  budget: number | undefined
}

export function parseInvestigateArgs(args: string[]): ParsedInvestigateArgs {
  const result: ParsedInvestigateArgs = { bug: undefined, quick: false, output: 'json', budget: undefined }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue
    if (arg === '--quick') {
      result.quick = true
      continue
    }
    const next = args[i + 1]
    if (arg === '--bug') {
      if (next === undefined) {
        console.error('[sdk-investigate] --bug requires a value')
        process.exit(1)
      }
      result.bug = next
      i++
    } else if (arg === '--budget') {
      if (next !== undefined) {
        const n = parseFloat(next)
        if (!Number.isNaN(n)) {
          result.budget = n
          i++
        }
      }
    }
  }
  return result
}

async function runInvestigateCommand(args: string[]): Promise<void> {
  const parsed = parseInvestigateArgs(args)
  if (parsed.bug === undefined) {
    console.error('[sdk-investigate] --bug is required')
    process.exit(1)
  }
  const config = resolveConfig({ ...(parsed.budget !== undefined && { budgetUsd: parsed.budget }) })
  const { runInvestigation } = await import('./investigate/agents/investigation.js')
  const result = await runInvestigation({
    bugDescription: parsed.bug,
    quickMode: parsed.quick,
    config,
  })
  console.log(JSON.stringify(result, null, 2))
}

// ─── falsify subcommand ───────────────────────────────────────────────────────

interface ParsedFalsifyArgs {
  findingsFile: string | undefined
  output: 'json'
  budget: number | undefined
}

export function parseFalsifyArgs(args: string[]): ParsedFalsifyArgs {
  const result: ParsedFalsifyArgs = { findingsFile: undefined, output: 'json', budget: undefined }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue
    const next = args[i + 1]
    if (arg === '--findings-file') {
      if (next === undefined) {
        console.error('[sdk-falsify] --findings-file requires a value')
        process.exit(1)
      }
      result.findingsFile = next
      i++
    } else if (arg === '--budget') {
      if (next !== undefined) {
        const n = parseFloat(next)
        if (!Number.isNaN(n)) {
          result.budget = n
          i++
        }
      }
    }
  }
  return result
}

async function runFalsifyCommand(args: string[]): Promise<void> {
  const parsed = parseFalsifyArgs(args)
  if (parsed.findingsFile === undefined) {
    console.error('[sdk-falsify] --findings-file is required')
    process.exit(1)
  }
  if (!existsSync(parsed.findingsFile)) {
    console.error(`[sdk-falsify] findings file not found: ${parsed.findingsFile}`)
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(parsed.findingsFile, 'utf8')) as unknown
  // Accept either { findings: [...] } or [...] directly
  const findings = Array.isArray(raw)
    ? raw
    : (raw as Record<string, unknown>).findings ?? []
  const config = resolveConfig({ ...(parsed.budget !== undefined && { budgetUsd: parsed.budget }) })
  const verdicts = await runFalsification({ findings: findings as Parameters<typeof runFalsification>[0]['findings'], config })
  console.log(JSON.stringify({ verdicts }, null, 2))
}

// ─── fix-intent-verify subcommand ────────────────────────────────────────────

interface ParsedFixIntentVerifyArgs {
  pr: number | undefined
  triageFile: string | undefined
  budget: number | undefined
}

export function parseFixIntentVerifyArgs(args: string[]): ParsedFixIntentVerifyArgs {
  const result: ParsedFixIntentVerifyArgs = { pr: undefined, triageFile: undefined, budget: undefined }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue
    const next = args[i + 1]
    if (arg === '--pr') {
      if (next === undefined) {
        console.error('[sdk-fix-intent-verify] --pr requires a value')
        process.exit(1)
      }
      const n = parseInt(next, 10)
      if (Number.isNaN(n) || n <= 0) {
        console.error(`[sdk-fix-intent-verify] --pr must be a positive integer, got: ${next}`)
        process.exit(1)
      }
      result.pr = n
      i++
    } else if (arg === '--triage-file') {
      if (next === undefined) {
        console.error('[sdk-fix-intent-verify] --triage-file requires a value')
        process.exit(1)
      }
      result.triageFile = next
      i++
    } else if (arg === '--budget') {
      if (next === undefined || next.startsWith('--')) {
        console.warn('[sdk-fix-intent-verify] --budget requires a value — using default')
      } else {
        const n = parseFloat(next)
        if (Number.isNaN(n) || n <= 0) {
          console.warn(`[sdk-fix-intent-verify] --budget must be a positive number, got: ${next} — using default`)
        } else {
          result.budget = n
          i++
        }
      }
    }
  }
  return result
}

async function runFixIntentVerifyCommand(args: string[]): Promise<void> {
  const parsed = parseFixIntentVerifyArgs(args)
  if (parsed.pr === undefined) {
    console.error('[sdk-fix-intent-verify] --pr is required')
    process.exit(1)
  }
  if (parsed.triageFile === undefined) {
    console.error('[sdk-fix-intent-verify] --triage-file is required')
    process.exit(1)
  }
  if (!existsSync(parsed.triageFile)) {
    console.error(`[sdk-fix-intent-verify] triage file not found: ${parsed.triageFile}`)
    process.exit(1)
  }
  const triageContent = readFileSync(parsed.triageFile, 'utf8')
  const config = resolveConfig({ ...(parsed.budget !== undefined && { budgetUsd: parsed.budget }) })
  const { runIntentVerification } = await import('./fix-intent-verify/agents/verifier.js')
  const result = await runIntentVerification({ pr: parsed.pr, triageContent, config })
  console.log(JSON.stringify(result, null, 2))
}

// ─── main dispatcher ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv
  const subcommand = argv[2]
  const args = argv.length > 3 ? argv.slice(3) : []

  if (subcommand === 'plan-challenge') {
    await runPlanChallengeCommand(args)
    return
  }
  if (subcommand === 'investigate') {
    await runInvestigateCommand(args)
    return
  }
  if (subcommand === 'falsify') {
    await runFalsifyCommand(args)
    return
  }
  if (subcommand === 'fix-intent-verify') {
    await runFixIntentVerifyCommand(args)
    return
  }

  // Default: review (existing behavior — pass all args from argv[2] onwards)
  await runReviewCommand(argv.length > 2 ? argv.slice(2) : [])
}

// Only run when executed directly (not when imported by smoke-test or other modules)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sdk] fatal:', message)
    process.exit(1)
  })
}
