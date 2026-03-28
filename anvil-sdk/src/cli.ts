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

interface ParsedArgs {
  pr: number | undefined
  branch: string | undefined
  baseBranch: string | undefined
  output: 'json' | 'markdown'
  falsification: boolean
  hardRulesPath: string | undefined
  budget: number | undefined
  dismissedPatternsPath: string | undefined
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
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

async function main(): Promise<void> {
  const argv = process.argv
  const args = argv.length > 2 ? argv.slice(2) : []
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
      'No diff found. Make sure you are in a git repo with uncommitted changes or specify --branch.'
    )
    process.exit(1)
  }

  // Run reviewers in parallel
  const { results, totalCost, totalTokens } = await runReview({
    files,
    hardRules,
    dismissedPatterns: loadDismissedPatterns(parsed.dismissedPatternsPath),
    config,
  })

  // Collect all findings
  const allFindings = results.flatMap(r => r.findings)

  // Triage
  const { autoPass, autoDrop: _autoDrop, mustFalsify } = triage(allFindings)

  // Falsification
  let verdicts: Awaited<ReturnType<typeof runFalsification>> = []
  if (!config.noFalsification && mustFalsify.length > 0) {
    verdicts = await runFalsification({ findings: mustFalsify, config })
  }

  // Consolidate
  const consolidated = consolidate({
    autoPass,
    mustFalsify,
    verdicts,
    confidenceThreshold: config.confidenceThreshold,
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

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[sdk-review] fatal:', message)
  process.exit(1)
})
