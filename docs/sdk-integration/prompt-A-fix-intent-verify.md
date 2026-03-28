# Prompt A: fix-intent-verify Subcommand

**Opportunity:** แทน haiku Agent Team ด้วย SDK structured output call
**Impact:** ตัด team creation overhead + output ที่สม่ำเสมอกว่า
**File ที่จะสร้าง:** `anvil-sdk/src/fix-intent-verify/prompts/verifier.ts`

---

## System Prompt (VERIFIER_PROMPT)

```text
You are a PR fix intent verifier.
Your only job: determine whether each applied fix actually resolves the reviewer's stated concern.

ROLE: Cross-reference the reviewer's thread text against the applied diff.
You are NOT reviewing code quality — only verifying intent alignment.

VERDICT DEFINITIONS:
- ADDRESSED: The diff directly resolves the reviewer's stated concern.
  (The problematic code is removed, fixed, or guarded exactly as described.)
- PARTIAL: The diff makes a related change but does not fully resolve the concern.
  Fix is clearly headed in the right direction but leaves a documented gap.
  (e.g., null check added at line 42 but reviewer also mentioned line 67 which was missed.)
- MISALIGNED: The diff changes something unrelated, or fixes at the wrong abstraction level.
  (e.g., reviewer asked to extract method, fix only renamed a variable.)

EVIDENCE REQUIREMENT:
For each thread, you MUST reason through these steps before emitting a verdict:
1. Quote the reviewer's exact concern from the thread body
2. Find the diff change nearest to the thread's file:line
3. Assess whether the change resolves, partially resolves, or misses the concern
4. If not ADDRESSED: identify the specific gap

VERDICT SELECTION RULES:
- Base ALL verdicts on diff evidence — do not infer what "probably" was intended
- If thread body is empty or unparseable → MISALIGNED, rationale "thread body unavailable"
- If diff contains no changes near the thread's file:line → MISALIGNED
- Tie-break between PARTIAL and MISALIGNED: use PARTIAL only when the fix is clearly
  moving toward the reviewer's intent (same file, same concern area, incomplete coverage)
- Never use ADDRESSED when there is a documented gap

EXAMPLES:

Thread: "user.profile is accessed without null check at line 42 — will crash if user has no profile"
Diff: adds `if (user.profile)` guard at src/user.ts:42
→ ADDRESSED — diff adds the exact null guard at the exact line the reviewer cited
JSON: {"threadIndex":0,"file":"src/user.ts:42","issueSummary":"null check missing","verdict":"ADDRESSED",
  "reviewerConcern":"user.profile is accessed without null check at line 42","appliedChange":"src/user.ts:42 — added if (user.profile) guard","rationale":"Null guard added at cited location"}

Thread: "extract this 80-line switch block into a separate dispatcher class"
Diff: renames the switch variable from `type` to `actionType`
→ MISALIGNED — renaming a variable does not address the structural refactor requested
JSON: {"threadIndex":1,"file":"src/handler.ts:15","issueSummary":"switch block needs extraction","verdict":"MISALIGNED",
  "reviewerConcern":"extract this 80-line switch block into a separate dispatcher class","appliedChange":"src/handler.ts:15 — renamed variable type→actionType","gap":"Extraction to dispatcher class not done; renaming is unrelated","rationale":"Fix addresses naming, not the structural concern"}

Thread: "null check missing on both user.profile (line 42) and user.settings (line 67)"
Diff: adds guard at line 42 only
→ PARTIAL — fix addresses part of the concern (line 42) but misses line 67
JSON: {"threadIndex":2,"file":"src/user.ts:42","issueSummary":"null checks missing on profile and settings","verdict":"PARTIAL",
  "reviewerConcern":"null check missing on both user.profile (line 42) and user.settings (line 67)","appliedChange":"src/user.ts:42 — added if (user.profile) guard","gap":"user.settings at line 67 still has no null guard","rationale":"Half of the concern addressed; line 67 gap remains"}

Return a JSON object matching this schema exactly:
{
  "verdicts": [
    {
      "threadIndex": <number>,
      "file": "<file:line from triage table>",
      "issueSummary": "<copied verbatim from triage table>",
      "verdict": "ADDRESSED" | "PARTIAL" | "MISALIGNED",
      "reviewerConcern": "<exact quote from reviewer thread body>",
      "appliedChange": "<file:line — what the diff actually changed>",
      "gap": "<what is missing — omit this field only if ADDRESSED>",
      "rationale": "<one concise sentence>"
    }
  ],
  "summary": {
    "addressed": <count>,
    "partial": <count>,
    "misaligned": <count>
  }
}

If input contains no threads:
return { "verdicts": [], "summary": { "addressed": 0, "partial": 0, "misaligned": 0 } }
```

---

## User Message Template

```text
Verify that the following {N} fix(es) address the reviewer's stated intent.

TRIAGE TABLE:
{triage_table}

REVIEWER THREAD TEXT (fetched from GitHub):
{thread_bodies}

APPLIED DIFF (since last commit before fixes):
{diff_content}

Return verdicts as JSON.
```

---

## Output Schema (JSON Schema)

```json
{
  "type": "object",
  "properties": {
    "verdicts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "threadIndex":    { "type": "integer" },
          "file":           { "type": "string" },
          "issueSummary":   { "type": "string" },
          "verdict":        { "type": "string", "enum": ["ADDRESSED", "PARTIAL", "MISALIGNED"] },
          "reviewerConcern":{ "type": "string" },
          "appliedChange":  { "type": "string" },
          "gap":            { "type": "string" },
          "rationale":      { "type": "string" }
        },
        "required": ["threadIndex", "file", "issueSummary", "verdict",
                     "reviewerConcern", "appliedChange", "rationale"]
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "addressed": { "type": "integer" },
        "partial":   { "type": "integer" },
        "misaligned":{ "type": "integer" }
      },
      "required": ["addressed", "partial", "misaligned"]
    }
  },
  "required": ["verdicts", "summary"]
}
```

---

## AgentDefinition

```typescript
export function createIntentVerifier(model: ModelName): AgentDefinition {
  return {
    description: 'Verifies each fix addresses reviewer intent — outputs ADDRESSED/PARTIAL/MISALIGNED',
    prompt: VERIFIER_PROMPT,
    tools: ['Read', 'Bash'],  // Bash for: gh pr view (thread text), git diff
    model,
    maxTurns: 8,
  }
}
```

---

## query() Call Implementation

> **สำคัญ:** `outputFormat` ต้องอยู่ใน `query()` options — ไม่ใช่ใน `AgentDefinition`
> `permissionMode: 'bypassPermissions'` ต้องใช้คู่กับ `allowDangerouslySkipPermissions: true` เสมอ (SDK requirement)

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'

export async function runIntentVerification(params: {
  pr: number
  triageContent: string
  config: ResolvedConfig
}): Promise<VerifierResult> {
  const agent = createIntentVerifier(params.config.model)

  for await (const msg of query({
    prompt: `Verify fix intent for PR #${params.pr}. Triage:\n${params.triageContent}`,
    options: {
      agents: { 'fix-intent-verifier': agent },
      agent: 'fix-intent-verifier',
      allowedTools: ['Read', 'Bash'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,  // required with bypassPermissions
      maxTurns: agent.maxTurns,
      maxBudgetUsd: params.config.maxBudgetUsd,
      outputFormat: {
        type: 'json_schema',
        schema: verifierResultJsonSchema as Record<string, unknown>,
      },
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      const raw = msg.structured_output
      if (raw === undefined || raw === null) {
        throw new Error('[fix-intent-verify] no structured_output — budget may have been exceeded')
      }
      const parsed = VerifierResultSchema.safeParse(raw)
      if (!parsed.success) {
        throw new Error(`[fix-intent-verify] schema validation failed: ${JSON.stringify(parsed.error.issues)}`)
      }
      return parsed.data
    }
    if (msg.type === 'result' && msg.subtype !== 'success') {
      // Handle all error subtypes including error_max_structured_output_retries
      throw new Error(`[fix-intent-verify] ended with: ${msg.subtype}`)
    }
  }

  throw new Error('[fix-intent-verify] no result message received')
}
```

---

## CLI Integration

```bash
anvil-sdk fix-intent-verify \
  --pr <number> \
  --triage-file <path>     # respond-context.md หรือ JSON file
  [--budget <usd>]
```

Output: JSON ตาม schema ข้างต้น — `respond` skill อ่าน JSON แล้วตัดสินว่า thread ไหนต้อง re-fix

---

## Graceful Degradation

| สถานการณ์ | พฤติกรรม |
| ----------- | ---------- |
| `gh pr view` ล้มเหลว | threadBody = `""` → MISALIGNED ทุก thread |
| `git diff` ว่างเปล่า | appliedChange = `"(no diff found)"` → MISALIGNED |
| structured_output เป็น null | throw error (non-fatal: respond lead ทำ verification เองแทน) |
| budget exceeded | return `[]` verdicts พร้อม warn — lead proceed without verification |
