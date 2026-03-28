# Prompt B: Falsifier — Direct API + Prompt Caching

**Opportunity:** เปลี่ยน `query()` (Agent SDK) → `client.messages.create()` (Direct API) + `cache_control`
**Impact:** `FALSIFICATION_PROMPT` (~280 tokens) ถูก cache หลัง call แรก — cache read ราคา ~0.1x
**File ที่แก้:** `anvil-sdk/src/review/agents/falsifier.ts`

---

## เหตุผลที่ทำได้

Falsifier **ไม่ใช้ file tools จริงๆ** — มันรับ findings เป็น text ใน user message ล้วนๆ
ไม่มี `Read`, `Grep`, `Glob` ใน `createFalsifier()`:

```typescript
// ปัจจุบัน — tools ว่างเปล่า แต่ยังใช้ query() อยู่
function createFalsifier(model: ModelName): AgentDefinition {
  return {
    description: 'Challenges review findings — goal is REJECT, not confirm',
    prompt: FALSIFICATION_PROMPT,
    tools: ['Read', 'Grep', 'Glob'],  // ← ไม่ได้ใช้จริง
    model,
    maxTurns: 3,
  }
}
```

เมื่อไม่มี file tools → Agent SDK เป็น overhead ที่ไม่จำเป็น → เปลี่ยนเป็น direct API ได้เลย

---

## System Prompt (FALSIFICATION_PROMPT) — ไม่เปลี่ยน

```text
You are challenging review findings before they are finalized.
Your job is to REJECT findings, not confirm them.

For each finding, challenge it on three grounds:
1. Intentional design: Can this be explained by intentional design rather than a bug?
2. Contradicting evidence: Is there evidence in the diff that directly contradicts this finding?
3. Severity inflation: Is the severity inflated? What is the minimum defensible severity?

RULES:
- REJECTED = finding is invalid or not supported by diff evidence
- DOWNGRADED = finding is valid but severity is too high — format: "DOWNGRADED (Critical→Warning)"
- SUSTAINED = finding survives all three challenges at original severity
- Burden of proof is on the finding — if uncertain whether to REJECT or DOWNGRADE, choose DOWNGRADE
- Hard Rule violations are almost never REJECTED

Return a JSON object:
{
  "verdicts": [
    {
      "findingIndex": <number>,
      "originalSummary": "<copy of finding summary>",
      "verdict": "SUSTAINED" | "DOWNGRADED" | "REJECTED",
      "newSeverity": "critical" | "warning" | "info",  (only if DOWNGRADED)
      "rationale": "<one line>"
    }
  ]
}

If findings list is empty: return { "verdicts": [] }
```

> **หมายเหตุ:** เพิ่ม wrapper object `{ "verdicts": [...] }` แทน array ตรงๆ เพื่อรองรับ JSON Schema validation ที่ต้องการ `type: "object"` ที่ root

---

## Implementation Sketch

```typescript
import Anthropic from '@anthropic-ai/sdk'

const MODEL_MAP: Record<ModelName, string> = {
  opus:   'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5',
}

export async function runFalsification(params: {
  findings: Finding[]
  config: ResolvedConfig
}): Promise<Verdict[]> {
  if (params.findings.length === 0) return []

  const client = new Anthropic()

  const findingsSummary = params.findings
    .map((f, i) => `[${i}] ${f.severity} | ${f.rule} | ${f.file}:${f.line ?? '?'} — ${f.issue}`)
    .join('\n')

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: MODEL_MAP[params.config.model],
      max_tokens: 2048,
      // Stable system prompt cached after first call (~280 tokens → 0.1x on repeat)
      system: [
        {
          type: 'text',
          text: FALSIFICATION_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: verdictResultJsonSchema as Record<string, unknown>,
        },
      },
      messages: [
        {
          role: 'user',
          content: `Challenge each of the following ${params.findings.length} findings. Return verdicts as JSON.\n\nFINDINGS:\n${findingsSummary}`,
        },
      ],
    })
  } catch (err) {
    // Non-fatal: budget exceeded, rate limit, etc. — findings pass through unchanged
    console.warn(`[sdk-review] falsifier API call failed — skipping: ${String(err)}`)
    return []
  }

  const textBlock = response.content.find(b => b.type === 'text')
  if (textBlock === undefined || textBlock.type !== 'text') {
    console.warn('[sdk-review] falsifier returned no text block — skipping')
    return []
  }

  const parsed = VerdictResultSchema.safeParse(JSON.parse(textBlock.text))
  if (!parsed.success) {
    console.warn(`[sdk-review] verdicts failed schema validation — skipping: ${JSON.stringify(parsed.error.issues)}`)
    return []
  }

  return parsed.data.verdicts
}
```

---

## Cache Verification

เพิ่ม logging เพื่อ verify cache hit ใน development:

```typescript
if (process.env.SDK_DEBUG) {
  const usage = response.usage as Record<string, number>
  console.error(`[falsifier] tokens: input=${usage.input_tokens} cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`)
}
```

ถ้า `cache_read_input_tokens > 0` บน call ที่ 2 ขึ้นไป แสดงว่า cache ทำงานถูกต้อง

---

## Trade-offs

| ด้าน | query() (ปัจจุบัน) | direct API (ใหม่) |
| ------ | ------------------- | ------------------ |
| Token cost (repeat calls) | full price | ~0.1x สำหรับ system prompt |
| Error handling | SDK จัดการ | ต้องเขียน try/catch เอง |
| Retry logic | อัตโนมัติ (SDK default 2 retries) | ต้องเพิ่มเอง หรือใช้ `maxRetries` option |
| Code complexity | ต่ำ | เพิ่มขึ้นเล็กน้อย (~20 บรรทัด) |
| Streaming | ไม่จำเป็น (output สั้น) | ไม่จำเป็น |

---

## Cache Minimum Token Warning

`cache_control` จะ cache จริงเมื่อ prefix ยาว ≥ ~1024 tokens
`FALSIFICATION_PROMPT` ปัจจุบัน ≈ 280 tokens — **ต่ำกว่า threshold**

ทางออก: เพิ่ม few-shot examples ลงใน `FALSIFICATION_PROMPT` เพื่อให้ถึง 1024 tokens:

```text
EXAMPLES:

Finding [0]: critical | no-null-check | src/user.ts:42 — user.profile accessed without null guard
Challenge:
- Intentional design? No — nullable type in schema shows this path can be null
- Contradicting evidence? None in diff
- Severity inflation? Critical is appropriate — crash on production traffic
Output:
{"findingIndex":0,"originalSummary":"user.profile accessed without null guard","verdict":"SUSTAINED","rationale":"Nullable schema confirms null path exists; critical severity correct for production crash risk"}

Finding [1]: warning | magic-number | src/config.ts:15 — hardcoded 30000 timeout
Challenge:
- Intentional design? Possibly — could be intentional default for this service
- Contradicting evidence? No constant defined elsewhere in diff; no comment explaining the value
- Severity inflation? Warning → Info is defensible — no crash risk, purely style concern
Output:
{"findingIndex":1,"originalSummary":"hardcoded 30000 timeout","verdict":"DOWNGRADED","newSeverity":"info","rationale":"Intentional default plausible; no crash risk makes Info the minimum defensible severity"}

Finding [2]: critical | sql-injection | src/search.ts:88 — query built with string concat
Challenge:
- Intentional design? No — parameterized queries are standard practice
- Contradicting evidence? Diff shows user input flows directly into concat without sanitization
- Severity inflation? Critical is correct — direct injection vector with no mitigation
Output:
{"findingIndex":2,"originalSummary":"query built with string concat","verdict":"SUSTAINED","rationale":"Unmitigated user input in SQL concat; critical severity appropriate for direct injection vector"}
```

**สำคัญ:**

- `Output:` ในแต่ละ example แสดง JSON ของ verdict นั้น (เป็น array element)
- final output จริงจะ wrap ทั้งหมดเป็น `{ "verdicts": [...] }` ตาม schema — `output_config` บังคับ format นี้
- examples เป็น per-finding reasoning ไม่ใช่ full output — ช่วยป้องกัน example pollution (model output text แทน JSON)

Few-shot examples เหล่านี้แสดง reasoning + JSON output พร้อมกัน ช่วยให้ prompt ยาวพอสำหรับ caching
