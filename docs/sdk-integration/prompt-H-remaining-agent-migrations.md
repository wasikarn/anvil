# Prompt H: Remaining Agent Migrations — Challenger, Investigator, Verifier

> **Status: IMPLEMENTED** — migrate ครบทุก agent + ลบ SDK dependencies แล้ว

**Opportunity:** Migrate challenger, investigator (+ dx-analyst), verifier จาก Agent SDK `query()` ไปใช้ `runClaudeSubprocess()` จาก Prompt F
**Impact:** ลบ `@anthropic-ai/claude-agent-sdk` และ `@anthropic-ai/sdk` ออกได้ทั้งหมด — เหลือแค่ `zod` dependency
**Files ที่แก้:**

- `anvil-sdk/src/plan/agents/challenger.ts`
- `anvil-sdk/src/investigate/agents/investigation.ts`
- `anvil-sdk/src/fix-intent-verify/agents/verifier.ts`
- `anvil-sdk/src/review/agents/falsifier.ts` — regression fix: เปลี่ยนจาก `@anthropic-ai/sdk` กลับเป็น subprocess
- `anvil-sdk/package.json` — ลบ `@anthropic-ai/claude-agent-sdk` และ `@anthropic-ai/sdk`
- `anvil-sdk/smoke-test.ts` — เพิ่ม no-SDK-imports tests

**ขึ้นอยู่กับ:** **Prompt F ต้อง execute ก่อน** — ใช้ `runClaudeSubprocess()` จาก `src/claude-subprocess.ts`

---

## Migration Pattern (เหมือนกันทุก agent)

```text
ก่อน:
  import type { AgentDefinition, SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk'
  import { query } from '@anthropic-ai/claude-agent-sdk'
  function createXxx(model): AgentDefinition { return { prompt, tools, model, maxTurns } }
  async function runXxx(params): Promise<Result> {
    const agent = createXxx(params.config.model)
    for await (const msg of query({ agents: { xxx: agent }, ..., outputFormat: { json_schema } })) {
      if (msg.type === 'result' && msg.subtype === 'success') { parse msg.structured_output }
    }
  }

หลัง:
  import { runClaudeSubprocess } from '../../claude-subprocess.js'
  async function runXxx(params): Promise<Result> {
    const result = await runClaudeSubprocess({
      systemPrompt: SOME_PROMPT,
      userMessage: '...',
      allowedTools: ['Read', 'Grep', 'Glob'],
      outputSchema: someJsonSchema,
      maxTurns: N,
      maxBudgetUsd: params.config.maxBudgetXxx,
    })
    const parsed = SomeSchema.safeParse(result.structuredOutput)
    // result.structuredOutput ← parsed JSON object (no JSON.parse needed)
  }
```

---

## Step 1: falsifier.ts — Regression Fix

`falsifier.ts` ถูก migrate เป็น `@anthropic-ai/sdk` ใน Prompt B (เพื่อ prompt caching) — ซึ่งต้องการ `ANTHROPIC_API_KEY`
ต้อง revert เป็น subprocess เพื่อให้ทำงานได้โดยไม่ต้องการ key

```typescript
// ก่อน — @anthropic-ai/sdk (regression)
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()
const response = await client.messages.create({
  model: MODEL_ID[params.config.model],
  system: [{ type: 'text', text: FALSIFICATION_PROMPT, cache_control: { type: 'ephemeral' } }],
  output_config: { format: { type: 'json_schema', schema: verdictResultJsonSchema } },
  messages: [{ role: 'user', content: findingsSummary }],
})

// หลัง — subprocess (ไม่ต้องการ API key)
import { runClaudeSubprocess } from '../../claude-subprocess.js'
const result = await runClaudeSubprocess({
  systemPrompt: FALSIFICATION_PROMPT,
  userMessage: `Challenge each of the following ${N} findings...\n\nFINDINGS:\n${findingsSummary}`,
  outputSchema: verdictResultJsonSchema as Record<string, unknown>,
  maxTurns: 1,  // single-turn call, no tools needed
  maxBudgetUsd: params.config.maxBudgetFalsification,
})
const parsed = VerdictResultSchema.safeParse(result.structuredOutput)
```

**หมายเหตุ:** สูญเสีย prompt caching บน `FALSIFICATION_PROMPT` (~600 tokens) — trade-off ที่ยอมรับได้

---

## Step 2: challenger.ts

```typescript
// หลัง
import { runClaudeSubprocess } from '../../claude-subprocess.js'

export async function runPlanChallenge(params): Promise<ChallengeResult> {
  const planContent = readFileSync(params.planPath, 'utf8')
  const researchContent = params.researchPath !== undefined
    ? readFileSync(params.researchPath, 'utf8') : '(no research.md provided)'

  const result = await runClaudeSubprocess({
    systemPrompt: PLAN_CHALLENGE_PROMPT,
    userMessage: `Challenge this implementation plan.\n\nPLAN:\n${planContent}\n\nRESEARCH:\n${researchContent}\n\nReturn verdicts as JSON.`,
    allowedTools: ['Read', 'Grep', 'Glob'],
    outputSchema: challengeResultJsonSchema as Record<string, unknown>,
    maxTurns: 5,
    maxBudgetUsd: params.config.maxBudgetFalsification,
  })

  const parsed = ChallengeResultSchema.safeParse(result.structuredOutput)
  if (!parsed.success) throw new Error(`[sdk-plan-challenge] schema failed: ...`)
  return parsed.data
}
```

---

## Step 3: investigation.ts — Investigator + DX Analyst

มี 2 agents ที่ต้อง migrate: `runInvestigator()` และ `runDxAnalyst()` — แต่ละตัวเป็น independent `runClaudeSubprocess()` call
ยังคง `Promise.all([runInvestigator(), runDxAnalyst()])` เหมือนเดิม

```typescript
// runInvestigator
const result = await runClaudeSubprocess({
  systemPrompt: INVESTIGATOR_PROMPT,
  userMessage: `Investigate this bug...\n\nBUG:\n${params.bugDescription}`,
  allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],  // Bash for git log/blame
  outputSchema: investigatorOutputSchema as Record<string, unknown>,
  maxTurns: 15,
  maxBudgetUsd: params.config.maxBudgetPerReviewer,
})

// runDxAnalyst — non-fatal: ถ้า error ให้ return [] แทน throw
try {
  const result = await runClaudeSubprocess({ ... dxAnalystOutputSchema ..., maxTurns: 10 })
} catch (err) {
  console.warn(`[sdk-investigate] dx-analyst failed — returning empty: ${String(err)}`)
  return []
}
```

---

## Step 4: verifier.ts — Non-fatal Budget Errors

verifier มี graceful degradation พิเศษ — ต้อง handle ผ่าน try/catch แทน subtype check

```typescript
export async function runIntentVerification(params): Promise<VerifierResult> {
  let result: Awaited<ReturnType<typeof runClaudeSubprocess>>
  try {
    result = await runClaudeSubprocess({
      systemPrompt: VERIFIER_PROMPT,
      userMessage: `Verify fix intent for PR #${params.pr}. Triage:\n${params.triageContent}`,
      allowedTools: ['Read', 'Bash'],
      outputSchema: verifierResultJsonSchema as Record<string, unknown>,
      maxTurns: 8,
      maxBudgetUsd: params.config.maxBudgetVerification,
    })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('budget') || msg.includes('rate_limit') || msg.includes('overload')) {
      console.warn(`[fix-intent-verify] non-fatal error — returning empty verdicts: ${msg}`)
      return { verdicts: [], summary: { addressed: 0, partial: 0, misaligned: 0 } }
    }
    throw err
  }
  // parse result.structuredOutput ผ่าน VerifierResultSchema
}
```

---

## Step 5: ลบ SDK dependencies

```json
// package.json หลัง
"dependencies": {
  "zod": "^4.0.0"
}
```

```bash
cd anvil-sdk && npm install  # removes 7 packages
```

---

## Smoke Tests เพิ่ม

```typescript
test('no @anthropic-ai/claude-agent-sdk imports remain', () => {
  const result = execSync('grep -r "claude-agent-sdk" src/ --include="*.ts" -l 2>/dev/null || true', ...)
  assert(result.trim() === '', `Agent SDK imports found in: ${result}`)
})

test('no @anthropic-ai/sdk imports remain', () => {
  const result = execSync("grep -rl \"@anthropic-ai/sdk\" src/ --include='*.ts' 2>/dev/null || true", ...)
  assert(result.trim() === '', `Anthropic SDK imports found in: ${result}`)
})
```

---

## Verify

```bash
cd anvil-sdk
grep -r "claude-agent-sdk" src/ --include="*.ts"   # ต้องว่างเปล่า
grep -r "@anthropic-ai/sdk" src/ --include="*.ts"  # ต้องว่างเปล่า
npx tsc --noEmit
node_modules/.bin/tsx smoke-test.ts
npm ls @anthropic-ai/claude-agent-sdk               # ต้องไม่มี
npm ls @anthropic-ai/sdk                            # ต้องไม่มี
```
