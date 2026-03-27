import { execSync } from 'node:child_process'
import { extname } from 'node:path'
import type { FileDiff } from '../../types.js'

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

  // Skip deleted files (path /dev/null)
  if (block.includes('+++ /dev/null')) return null
  if (path === '/dev/null') return null

  // Skip binary files
  if (block.includes('Binary files')) return null

  // Count added/removed lines (lines starting with + or -, excluding +++ and ---)
  const lines = block.split('\n')
  let linesChanged = 0
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
        linesChanged++
      }
      // Count removed lines: starts with - but not ---
      if (line.startsWith('-') && !line.startsWith('---')) {
        linesChanged++
      }
    }
  }

  const hunks = hunkLines.join('\n')
  const language = detectLanguage(path)

  return { path, hunks, language, linesChanged }
}

/**
 * Reads git diff for a PR number or branch and returns parsed file diffs.
 * Runs `git diff` once — callers receive pre-parsed data, no redundant re-reads.
 */
export function readDiff(target: { pr?: string; branch?: string; baseBranch?: string }): FileDiff[] {
  const base = target.baseBranch ?? 'origin/main'

  let command: string
  if (target.branch) {
    command = `git diff $(git merge-base HEAD ${base})...HEAD`
  } else {
    // pr mode: assume PR is checked out locally
    command = `git diff ${base}...HEAD`
  }

  let output: string
  try {
    output = execSync(command, { encoding: 'utf8', shell: '/bin/sh' })
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
