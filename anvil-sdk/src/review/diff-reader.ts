import { execSync } from 'node:child_process'
import { extname } from 'node:path'
import type { FileDiff } from '../types.js'

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.sql': 'sql',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.sh': 'shell',
}

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return LANGUAGE_MAP[ext] ?? 'unknown'
}

function parseFileBlock(block: string): FileDiff | null {
  // Extract file path from +++ b/... line
  const pathMatch = block.match(/^\+\+\+ b\/(.+)$/m)
  const rawPath = pathMatch?.[1]
  if (!rawPath) return null

  const path = rawPath.trim()

  // Skip binary files
  if (block.includes('Binary files')) return null

  // Count added/removed lines (lines starting with + or -, excluding +++ and ---)
  const lines = block.split('\n')
  let diffLineCount = 0
  const hunkLines: string[] = []
  let inHunk = false

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunk = true
      hunkLines.push(line)
      continue
    }
    if (inHunk) {
      hunkLines.push(line)
      // Count added lines: starts with + but not +++
      if (line.startsWith('+') && !line.startsWith('+++')) {
        diffLineCount++
      }
      // Count removed lines: starts with - but not ---
      if (line.startsWith('-') && !line.startsWith('---')) {
        diffLineCount++
      }
    }
  }

  const hunks = hunkLines.join('\n')
  const language = detectLanguage(path)

  return { path, hunks, language, diffLineCount }
}

const SAFE_REF = /^[\w/.-]+$/

/**
 * Reads git diff for the current branch and returns parsed file diffs.
 * Caller is responsible for checking out the branch/PR before calling.
 * Runs `git diff` once — callers receive pre-parsed data, no redundant re-reads.
 */
export function readDiff(target: { branch?: string; baseBranch?: string }): FileDiff[] {
  if (target.branch !== undefined && !SAFE_REF.test(target.branch)) {
    throw new Error(`Unsafe branch name: ${target.branch}`)
  }
  if (target.baseBranch !== undefined && !SAFE_REF.test(target.baseBranch)) {
    throw new Error(`Unsafe base branch name: ${target.baseBranch}`)
  }

  const base = target.baseBranch ?? 'origin/main'
  const mergeBase = execSync(`git merge-base HEAD ${base}`, { encoding: 'utf8' }).trim()

  let output: string
  try {
    output = execSync(`git diff ${mergeBase}...HEAD`, { encoding: 'utf8' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`git diff failed: ${message}`)
  }

  if (!output.trim()) return []

  // Split by "diff --git" to get per-file blocks (first element will be empty)
  const blocks = output.split(/^diff --git /m).filter(b => b.trim().length > 0)

  const results: FileDiff[] = []
  for (const block of blocks) {
    const parsed = parseFileBlock(block)
    if (parsed !== null) {
      results.push(parsed)
    }
  }

  return results
}

// Test with: npx tsx src/review/diff-reader.ts (manual)
