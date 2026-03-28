# Prompt F: Claude Subprocess Utility + Reviewer Migration

> **Status: IMPLEMENTED** — สร้าง `src/claude-subprocess.ts` + migrate reviewer แล้วใน commit หลัง prompt docs ถูกสร้าง

**Opportunity:** สร้าง reusable `runClaudeSubprocess()` ที่ใช้ `claude -p` (non-interactive CLI) แทน `@anthropic-ai/sdk` — ใช้ subscription OAuth จาก Keychain, ไม่ต้องการ `ANTHROPIC_API_KEY`
**Impact:** Reviewer migrate จาก Agent SDK `query()` มาใช้ subprocess — ไม่ต้องการ API key + Agent SDK dependency เริ่มถูกลดทอน
**Files ที่สร้าง/แก้:**

- **NEW** `anvil-sdk/src/claude-subprocess.ts` — generic subprocess utility
- `anvil-sdk/src/review/agents/reviewer.ts` — rewrite เป็น `runReviewer()` ที่ return `ReviewerResult` โดยตรง
- `anvil-sdk/src/review/orchestrator.ts` — เปลี่ยนให้ใช้ `runReviewer` แทน `createReviewer` + `query`
- `anvil-sdk/smoke-test.ts` — เพิ่ม no-SDK-imports tests

**ขึ้นอยู่กับ:** ไม่มี. แต่ Prompt H ต้องใช้ `claude-subprocess.ts` จาก Prompt นี้

---

## ทำไมต้อง `claude -p` แทน `@anthropic-ai/sdk`

| | `@anthropic-ai/sdk` | `claude -p` subprocess |
| --- | --- | --- |
| API Key | **ต้องการ** `ANTHROPIC_API_KEY` | **ไม่ต้องการ** — ใช้ OAuth จาก Keychain |
| Plugin context | ทำงานได้แต่ต้องการ key | ทำงานได้ทันทีหลัง install plugin |
| Prompt caching | มี (`cache_control: ephemeral`) | **ไม่มี** — trade-off ที่ยอมรับได้ |
| Tool dispatch | ต้องเขียน manual executor | `--allowedTools` — claude จัดการเอง |
| Structured output | `output_config.format.json_schema` | `--json-schema` + `.structured_output` |

---

## Step 1: สร้าง src/claude-subprocess.ts

```typescript
import { execFile } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface SubprocessParams {
  systemPrompt: string
  userMessage: string
  allowedTools?: string[]          // e.g. ['Read', 'Grep', 'Glob']
  outputSchema?: Record<string, unknown>
  maxTurns?: number
  maxBudgetUsd?: number
}

export interface SubprocessResult {
  text: string           // result field from JSON output
  structuredOutput: unknown  // structured_output when --json-schema used
}

export async function runClaudeSubprocess(params: SubprocessParams): Promise<SubprocessResult>
```

### CLI Args ที่ใช้

```bash
claude \
  -p "<userMessage>" \
  --output-format json \
  --system-prompt-file <tmpFile> \       # ← temp file หลีกเลี่ยง arg length limit
  --dangerously-skip-permissions \       # ← non-interactive, matches old SDK behavior
  --allowedTools "Read,Grep,Glob" \      # ← optional
  --json-schema '<schema json>' \        # ← optional, output ไปที่ .structured_output
  --max-turns 5 \
  --max-budget-usd 0.15
```

### Output Format

```json
{
  "type": "result",
  "subtype": "success",
  "result": "text response",
  "structured_output": { ... },
  "is_error": false
}
```

Error case (budget exceeded):

```json
{
  "type": "result",
  "subtype": "error_max_budget_usd",
  "is_error": true
}
```

---

## Step 2: reviewer.ts — rewrite เป็น runReviewer()

```typescript
// ก่อน — export function createReviewer() ที่ return AgentDefinition
// หลัง — export async function runReviewer() ที่ return ReviewerResult โดยตรง

import { runClaudeSubprocess } from '../../claude-subprocess.js'
import type { ResolvedConfig } from '../../config.js'
import type { DiffBucket, ReviewRole, ReviewerResult } from '../../types.js'
// ... lens imports, prompt builders, schema imports

export async function runReviewer(params: {
  bucket: DiffBucket
  hardRules: string
  dismissedPatterns: string
  isAdonisProject: boolean
  config: ResolvedConfig
}): Promise<ReviewerResult> {
  // build systemPrompt from lens + diff + rules (เหมือนเดิม)
  const result = await runClaudeSubprocess({
    systemPrompt,
    userMessage: 'Review the code changes in your context and return findings as JSON.',
    allowedTools: ['Read', 'Grep', 'Glob'],
    outputSchema: findingResultJsonSchema as Record<string, unknown>,
    maxTurns: params.config.maxTurnsReviewer,
    maxBudgetUsd: params.config.maxBudgetPerReviewer,
  })
  // parse result.structuredOutput ผ่าน FindingResultSchema
  // return { findings, strengths, cost: 0, tokens: 0 }
  // Note: cost/tokens ไม่มีจาก subprocess — ค่าเป็น 0
}
```

---

## Step 3: orchestrator.ts — ใช้ runReviewer แทน createReviewer + query

```typescript
// ก่อน
import { createReviewer } from './agents/reviewer.js'
import { query } from '@anthropic-ai/claude-agent-sdk'
// ...
async function runSingleReviewer(params): Promise<ReviewerResult> {
  const agent = createReviewer({ ... })
  for await (const msg of query({ ... })) { ... }
}

// หลัง
import { runReviewer } from './agents/reviewer.js'
// ...
// runSingleReviewer ถูกลบ — เรียก runReviewer โดยตรงใน Promise.allSettled
const settled = await Promise.allSettled(
  activeBuckets.map(bucket => runReviewer({ bucket, hardRules, dismissedPatterns, isAdonisProject, config }))
)
```

---

## หมายเหตุสำคัญ

**Prompt caching สูญหาย:** `claude -p` ไม่รองรับ `cache_control` — reviewer prompt (~2000+ tokens) จะไม่ถูก cache ต่างจาก falsifier เดิมที่มี cache
**Trade-off ที่ยอมรับ:** ไม่ต้องการ API key > ลด cost จาก caching — reviewer runs ไม่บ่อยพอที่ cache จะมีผลมาก

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
