import { runClaudeSubprocess } from '../../claude-subprocess.js'
import type { ResolvedConfig } from '../../config.js'
import { DX_ANALYST_PROMPT } from '../prompts/dx-analyst.js'
import { INVESTIGATOR_PROMPT } from '../prompts/investigator.js'
import {
  InvestigationResultSchema,
  investigationResultJsonSchema,
  type DxFinding,
  type InvestigationResult,
  type RootCause,
} from '../schemas/investigation.js'

// Investigator returns root cause + fix plan items (no DX)
const investigatorOutputSchema = {
  type: 'object',
  properties: {
    rootCause: investigationResultJsonSchema.properties.rootCause,
    fixPlan: investigationResultJsonSchema.properties.fixPlan,
  },
  required: ['rootCause', 'fixPlan'],
} as const

// DX Analyst returns only dxFindings
const dxAnalystOutputSchema = {
  type: 'object',
  properties: {
    dxFindings: investigationResultJsonSchema.properties.dxFindings,
  },
  required: ['dxFindings'],
} as const

async function runInvestigator(params: {
  bugDescription: string
  config: ResolvedConfig
}): Promise<{ rootCause: RootCause; fixPlan: InvestigationResult['fixPlan'] }> {
  const result = await runClaudeSubprocess({
    systemPrompt: INVESTIGATOR_PROMPT,
    userMessage: `Investigate this bug and return root cause + fix plan as JSON.\n\nBUG:\n${params.bugDescription}`,
    allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
    outputSchema: investigatorOutputSchema as Record<string, unknown>,
    maxTurns: 15,
    maxBudgetUsd: params.config.maxBudgetPerReviewer,
  })

  const raw = result.structuredOutput
  if (raw === undefined || raw === null) {
    throw new Error('[sdk-investigate] investigator returned no structured output')
  }

  const parsed = InvestigationResultSchema.pick({ rootCause: true, fixPlan: true }).safeParse(raw)
  if (!parsed.success) {
    throw new Error(`[sdk-investigate] investigator schema failed: ${JSON.stringify(parsed.error.issues)}`)
  }

  return parsed.data
}

async function runDxAnalyst(params: {
  bugDescription: string
  config: ResolvedConfig
}): Promise<DxFinding[]> {
  let result: Awaited<ReturnType<typeof runClaudeSubprocess>>
  try {
    result = await runClaudeSubprocess({
      systemPrompt: DX_ANALYST_PROMPT,
      userMessage: `Audit the affected area of this bug for DX issues. Return findings as JSON.\n\nBUG:\n${params.bugDescription}`,
      allowedTools: ['Read', 'Grep', 'Glob'],
      outputSchema: dxAnalystOutputSchema as Record<string, unknown>,
      maxTurns: 10,
      maxBudgetUsd: params.config.maxBudgetFalsification,
    })
  } catch (err) {
    console.warn(`[sdk-investigate] dx-analyst failed — returning empty: ${String(err)}`)
    return []
  }

  const raw = result.structuredOutput
  if (raw === undefined || raw === null) {
    console.warn('[sdk-investigate] dx-analyst returned no structured output — returning empty DX findings')
    return []
  }

  const parsed = InvestigationResultSchema.pick({ dxFindings: true }).safeParse(raw)
  if (!parsed.success) {
    console.warn(`[sdk-investigate] dx-analyst schema failed — returning empty: ${JSON.stringify(parsed.error.issues)}`)
    return []
  }

  return parsed.data.dxFindings
}

export async function runInvestigation(params: {
  bugDescription: string
  quickMode: boolean
  config: ResolvedConfig
}): Promise<InvestigationResult> {
  if (params.quickMode) {
    // Quick mode: Investigator only, no DX analysis
    const { rootCause, fixPlan } = await runInvestigator({
      bugDescription: params.bugDescription,
      config: params.config,
    })
    return { rootCause, dxFindings: [], fixPlan }
  }

  // Full mode: Investigator + DX Analyst in parallel
  const [investigatorResult, dxFindings] = await Promise.all([
    runInvestigator({ bugDescription: params.bugDescription, config: params.config }),
    runDxAnalyst({ bugDescription: params.bugDescription, config: params.config }),
  ])

  // Merge actionable DX findings into fix plan as [dx] items
  const dxFixItems = dxFindings
    .filter(f => f.severity !== 'info')
    .map(f => ({ type: 'dx' as const, description: f.recommendation, file: f.file, line: f.line }))

  return {
    rootCause: investigatorResult.rootCause,
    dxFindings,
    fixPlan: [...investigatorResult.fixPlan, ...dxFixItems],
  }
}
