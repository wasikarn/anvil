/**
 * Thin wrapper around `claude -p` (non-interactive mode).
 * Runs Claude via the CLI using subscription OAuth — no ANTHROPIC_API_KEY required.
 *
 * Usage:
 *   const result = await runClaudeSubprocess({
 *     systemPrompt: SOME_PROMPT,
 *     userMessage: 'Do X and return JSON.',
 *     allowedTools: ['Read', 'Grep', 'Glob'],
 *     outputSchema: someJsonSchema,
 *     maxTurns: 5,
 *     maxBudgetUsd: 0.15,
 *   })
 *   const data = SomeSchema.safeParse(result.structuredOutput)
 */
import { execFile } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface SubprocessParams {
  systemPrompt: string
  userMessage: string
  allowedTools?: string[]
  outputSchema?: Record<string, unknown>
  maxTurns?: number
  maxBudgetUsd?: number
}

export interface SubprocessResult {
  /** Final text response (when no --json-schema, or as fallback) */
  text: string
  /** Parsed structured output — present when --json-schema was used */
  structuredOutput: unknown
}

interface ClaudeJsonOutput {
  type?: string
  subtype?: string
  result?: string
  structured_output?: unknown
  is_error?: boolean
}

export async function runClaudeSubprocess(params: SubprocessParams): Promise<SubprocessResult> {
  const tmpPath = join(tmpdir(), `anvil-sys-${randomUUID()}.txt`)

  try {
    await writeFile(tmpPath, params.systemPrompt, 'utf8')

    const args: string[] = [
      '-p', params.userMessage,
      '--output-format', 'json',
      '--system-prompt-file', tmpPath,
      '--dangerously-skip-permissions',
    ]

    if (params.allowedTools && params.allowedTools.length > 0) {
      args.push('--allowedTools', params.allowedTools.join(','))
    }

    if (params.outputSchema !== undefined) {
      args.push('--json-schema', JSON.stringify(params.outputSchema))
    }

    if (params.maxTurns !== undefined) {
      args.push('--max-turns', String(params.maxTurns))
    }

    if (params.maxBudgetUsd !== undefined) {
      args.push('--max-budget-usd', String(params.maxBudgetUsd))
    }

    const stdout = await new Promise<string>((resolve, reject) => {
      execFile('claude', args, { encoding: 'utf8', timeout: 300_000 }, (err, out, stderr) => {
        if (out) {
          // stdout takes priority — claude outputs JSON even on non-zero exit
          resolve(out)
        } else if (err) {
          reject(new Error(`[claude-subprocess] no output: ${err.message}${stderr ? `\n${stderr}` : ''}`))
        } else {
          resolve('')
        }
      })
    })

    let output: ClaudeJsonOutput
    try {
      output = JSON.parse(stdout) as ClaudeJsonOutput
    } catch {
      throw new Error(`[claude-subprocess] invalid JSON: ${stdout.slice(0, 200)}`)
    }

    if (output.is_error === true) {
      const sub = output.subtype ?? 'unknown'
      throw new Error(`[claude-subprocess] ${sub}`)
    }

    return {
      text: output.result ?? '',
      structuredOutput: output.structured_output,
    }
  } finally {
    unlink(tmpPath).catch(() => { /* ignore cleanup errors */ })
  }
}
