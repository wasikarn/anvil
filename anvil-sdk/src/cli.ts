#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolveConfig, type EffortLevel } from './config.js'
import { runFalsification } from './review/agents/falsifier.js'
import { consolidate, findingKey } from './review/consolidator.js'
import { readDiff, readPrDiff } from './review/diff-reader.js'
import { formatJson, formatMarkdown } from './review/output.js'
import { runReview } from './review/orchestrator.js'
import { triage } from './review/triage.js'
import type { ReviewReport } from './types.js'

// ─── generic flag parser ──────────────────────────────────────────────────────

type FlagType = 'string' | 'positiveInt' | 'positiveFloat' | 'boolean' | 'enum'

interface FlagSpec {
  flag: string
  field: string
  type: FlagType
  enum?: string[]
  required?: boolean
  errorPrefix: string
  onError?: 'exit' | 'warn'
  /** boolean flags only: sets field to false instead of true */
  negate?: boolean
}

function parseFlags<T extends Record<string, unknown>>(
  args: string[],
  specs: FlagSpec[],
  defaults: T,
): T {
  const result = { ...defaults }
  const specByFlag = new Map(specs.map(s => [s.flag, s]))

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue
    const spec = specByFlag.get(arg)
    if (spec === undefined) {
      if (arg.startsWith('--')) console.warn(`unknown flag: ${arg}`)
      continue
    }

    if (spec.type === 'boolean') {
      ;(result as Record<string, unknown>)[spec.field] = spec.negate !== true
      continue
    }

    const next = args[i + 1]
    if (next === undefined || next.startsWith('--')) {
      const msg = `${spec.errorPrefix} ${spec.flag} requires a value`
      if (spec.required === true || spec.onError === 'exit') {
        console.error(msg); process.exit(1)
      } else {
        console.warn(msg + ' — using default')
      }
      continue
    }

    let parsed: unknown
    if (spec.type === 'string') {
      parsed = next
    } else if (spec.type === 'enum') {
      if (spec.enum?.includes(next) === true) {
        parsed = next
      } else {
        const msg = `${spec.errorPrefix} ${spec.flag} must be ${spec.enum?.join('|')}, got: ${next}`
        if (spec.required === true || spec.onError === 'exit') { console.error(msg); process.exit(1) }
        else { console.warn(msg + ' — using default'); continue }
      }
    } else if (spec.type === 'positiveInt') {
      const n = parseInt(next, 10)
      if (Number.isNaN(n) || n <= 0) {
        const msg = `${spec.errorPrefix} ${spec.flag} must be a positive integer, got: ${next}`
        if (spec.required === true || spec.onError === 'exit') { console.error(msg); process.exit(1) }
        else { console.warn(msg + ' — using default'); continue }
      } else {
        parsed = n
      }
    } else if (spec.type === 'positiveFloat') {
      const n = parseFloat(next)
      if (Number.isNaN(n) || n <= 0) {
        const msg = `${spec.errorPrefix} ${spec.flag} must be a positive number, got: ${next}`
        if (spec.onError === 'exit') { console.error(msg); process.exit(1) }
        else { console.warn(msg + ' — using default'); continue }
      } else {
        parsed = n
      }
    }

    if (parsed !== undefined) {
      ;(result as Record<string, unknown>)[spec.field] = parsed
      i++
    }
  }

  return result
}

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
  effort: EffortLevel | undefined
}

function parseArgs(args: string[]): ParsedReviewArgs {
  return parseFlags(args, [
    { flag: '--pr', field: 'pr', type: 'positiveInt', errorPrefix: '[sdk-review]', onError: 'exit' },
    { flag: '--branch', field: 'branch', type: 'string', errorPrefix: '[sdk-review]', onError: 'exit' },
    { flag: '--base-branch', field: 'baseBranch', type: 'string', errorPrefix: '[sdk-review]', onError: 'exit' },
    { flag: '--output', field: 'output', type: 'enum', enum: ['json', 'markdown'], errorPrefix: '[sdk-review]', onError: 'exit' },
    { flag: '--hard-rules', field: 'hardRulesPath', type: 'string', errorPrefix: '[sdk-review]', onError: 'exit' },
    { flag: '--budget', field: 'budget', type: 'positiveFloat', errorPrefix: '[sdk-review]', onError: 'exit' },
    { flag: '--dismissed', field: 'dismissedPatternsPath', type: 'string', errorPrefix: '[sdk-review]', onError: 'exit' },
    { flag: '--no-falsification', field: 'falsification', type: 'boolean', negate: true, errorPrefix: '[sdk-review]' },
    { flag: '--effort', field: 'effort', type: 'enum', enum: ['low', 'medium', 'high'], errorPrefix: '[sdk-review]', onError: 'exit' },
  ], {
    pr: undefined as number | undefined,
    branch: undefined as string | undefined,
    baseBranch: undefined as string | undefined,
    output: 'json' as 'json' | 'markdown',
    falsification: true as boolean,
    hardRulesPath: undefined as string | undefined,
    budget: undefined as number | undefined,
    dismissedPatternsPath: undefined as string | undefined,
    effort: undefined as EffortLevel | undefined,
  })
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
    ...(parsed.effort !== undefined && { effort: parsed.effort }),
    ...(parsed.budget !== undefined && { budgetUsd: parsed.budget }),
    ...(parsed.hardRulesPath !== undefined && { hardRulesPath: parsed.hardRulesPath }),
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
  const { autoPass, autoDrop: _autoDrop, mustFalsify } = triage(
    perReviewer.flatMap(r => r.findings),
    { autoPassThreshold: config.autoPassThreshold, autoDropThreshold: config.autoDropThreshold },
  )

  // Falsification
  let verdicts: Awaited<ReturnType<typeof runFalsification>> = []
  if (!config.noFalsification && mustFalsify.length > 0) {
    verdicts = await runFalsification({ findings: mustFalsify, config })
  }

  // Consolidate with full attribution — key-based Set prevents silent bug if objects were spread
  const mustFalsifyKeys = new Set(mustFalsify.map(findingKey))
  const perReviewerMustFalsify = perReviewer.map(r => ({
    role: r.role,
    findings: r.findings.filter(f => mustFalsifyKeys.has(findingKey(f))),
  }))

  const consolidated = consolidate({
    perReviewer: perReviewerMustFalsify,
    autoPass,
    verdicts,
    patternCapCount: config.patternCapCount,
  })

  // Build report
  let critical = 0, warning = 0, info = 0
  for (const f of consolidated) {
    if (f.severity === 'critical') critical++
    else if (f.severity === 'warning') warning++
    else info++
  }

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
  budget: number | undefined
}

export function parsePlanChallengeArgs(args: string[]): ParsedPlanChallengeArgs {
  return parseFlags(args, [
    { flag: '--plan-file', field: 'planFile', type: 'string', required: true, errorPrefix: '[sdk-plan-challenge]', onError: 'exit' },
    { flag: '--research-file', field: 'researchFile', type: 'string', errorPrefix: '[sdk-plan-challenge]', onError: 'exit' },
    { flag: '--budget', field: 'budget', type: 'positiveFloat', errorPrefix: '[sdk-plan-challenge]' },
  ], {
    planFile: undefined as string | undefined,
    researchFile: undefined as string | undefined,
    budget: undefined as number | undefined,
  })
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
  budget: number | undefined
}

export function parseInvestigateArgs(args: string[]): ParsedInvestigateArgs {
  return parseFlags(args, [
    { flag: '--bug', field: 'bug', type: 'string', required: true, errorPrefix: '[sdk-investigate]', onError: 'exit' },
    { flag: '--quick', field: 'quick', type: 'boolean', errorPrefix: '[sdk-investigate]' },
    { flag: '--budget', field: 'budget', type: 'positiveFloat', errorPrefix: '[sdk-investigate]' },
  ], {
    bug: undefined as string | undefined,
    quick: false as boolean,
    budget: undefined as number | undefined,
  })
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
  budget: number | undefined
}

export function parseFalsifyArgs(args: string[]): ParsedFalsifyArgs {
  return parseFlags(args, [
    { flag: '--findings-file', field: 'findingsFile', type: 'string', errorPrefix: '[sdk-falsify]', onError: 'exit' },
    { flag: '--budget', field: 'budget', type: 'positiveFloat', errorPrefix: '[sdk-falsify]' },
  ], {
    findingsFile: undefined as string | undefined,
    budget: undefined as number | undefined,
  })
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
  return parseFlags(args, [
    { flag: '--pr', field: 'pr', type: 'positiveInt', required: true, errorPrefix: '[sdk-fix-intent-verify]', onError: 'exit' },
    { flag: '--triage-file', field: 'triageFile', type: 'string', required: true, errorPrefix: '[sdk-fix-intent-verify]', onError: 'exit' },
    { flag: '--budget', field: 'budget', type: 'positiveFloat', errorPrefix: '[sdk-fix-intent-verify]' },
  ], {
    pr: undefined as number | undefined,
    triageFile: undefined as string | undefined,
    budget: undefined as number | undefined,
  })
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
