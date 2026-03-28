# Prompt C: SDK Fast-Path สำหรับ review + build Phase 6

**Opportunity:** ใช้ `anvil-sdk review` ก่อน spawn Agent Teams — เหมือน pattern ที่ `debug` skill ทำกับ `investigate`
**Impact:** ประหยัด ~50-70% token ของ review phase (ไม่มี debate overhead)
**Files ที่แก้:**

- `skills/review/references/phase-3.md` — ใส่เป็น Step 0 ก่อน team creation
- `skills/build/references/phase-6-review.md` — ใส่เป็น Step 0 ก่อน spawn reviewers

---

## Block ที่เพิ่มใน phase-3.md (review skill)

เพิ่มก่อน "Step 1: Create Team" ปัจจุบัน:

```markdown
### Step 0: SDK Fast-Path (try before spawning Agent Teams)

**Try the SDK Reviewer first — faster, lower token cost, deterministic structured output:**

\`\`\`bash
SDK_DIR="${CLAUDE_SKILL_DIR}/../../anvil-sdk"

if [ ! -d "$SDK_DIR/node_modules" ]; then
  (cd "$SDK_DIR" && npm install --silent 2>/dev/null)
fi

sdk_result=$(cd "$SDK_DIR" && node_modules/.bin/tsx src/cli.ts review \
  --pr {pr_number} \
  --output json \
  2>&1)
sdk_exit=$?
\`\`\`

**If `sdk_exit=0` and `sdk_result` is valid JSON with `findings[]`:**

Parse as `ReviewReport` JSON and use directly:

- Map `findings[]` → review table per [review-output-format](../../review-output-format/SKILL.md)
- Map `strengths[]` → Strengths section
- Use `verdict` field (`"APPROVE"` | `"REQUEST_CHANGES"`) for final decision
- Use `summary` for counts: `critical`, `warning`, `info`
- If `noiseWarning: true` → prepend `⚠ Low signal` notice per review-conventions
- Report: `SDK Review: {summary.critical} critical · {summary.warning} warning · {summary.info} info · ${cost.total_usd.toFixed(4)}`

**Skip Agent Teams spawning** — proceed directly to Phase 5 (Convergence) with SDK result.

**If `sdk_exit != 0` or result is not valid JSON:**

Log `SDK review failed (exit {sdk_exit}) — falling back to Agent Teams` and continue to Step 1.
```

---

## Block ที่เพิ่มใน phase-6-review.md (build skill)

เพิ่มก่อน "Step 1: Spawn Reviewers" ปัจจุบัน:

```markdown
### Step 0: SDK Fast-Path

**Before spawning reviewer Agent Teams, try SDK first:**

\`\`\`bash
SDK_DIR="${CLAUDE_SKILL_DIR}/../../anvil-sdk"

if [ ! -d "$SDK_DIR/node_modules" ]; then
  (cd "$SDK_DIR" && npm install --silent 2>/dev/null)
fi

# Resolve diff source: PR number (if in PR mode) or branch
SDK_TARGET=""
[ -n "{pr_number}" ] && SDK_TARGET="--pr {pr_number}"
[ -z "$SDK_TARGET" ] && SDK_TARGET="--branch {current_branch}"

# {hard_rules_path} = path จาก build context: .build/hard-rules.md (หรือ path ที่ skill รู้อยู่แล้ว)
sdk_result=$(cd "$SDK_DIR" && node_modules/.bin/tsx src/cli.ts review \
  $SDK_TARGET \
  ${HARD_RULES_PATH:+--hard-rules "$HARD_RULES_PATH"} \
  --output json \
  2>&1)
sdk_exit=$?
\`\`\`

**If `sdk_exit=0` and `sdk_result` is valid JSON with `findings[]`:**

- Parse as `ReviewReport` — use `findings[]` and `strengths[]` directly as review output
- Skip reviewer Agent Teams spawning
- Skip debate phase (SDK findings already falsified internally)
- Proceed to Phase 7 (Falsification Pass) with SDK findings pre-loaded
- If `noiseWarning: true` → prepend `⚠ Low signal` notice per review-conventions
- Report: `SDK Review (iter {N}): {summary.critical}c · {summary.warning}w · {summary.info}i`

**If `sdk_exit != 0`:** Log failure and continue with standard Agent Teams spawn.
```

---

## Mapping: ReviewReport JSON → Skill Output Format

| `ReviewReport` field | Skill output | หมายเหตุ |
| --------------------- | -------------- | --------- |
| `findings[].severity` | 🔴/🟡/🔵 | critical→🔴, warning→🟡, info→🔵 |
| `findings[].rule` | Rule column | `#rule` format |
| `findings[].file` | File column | backtick wrap |
| `findings[].line` | Line column | null → `—` |
| `findings[].issue` + `fix` | Issue column | รวมกัน: "issue — fix: ..." |
| `findings[].isHardRule` | Hard Rule badge | เพิ่ม `[HR]` ถ้า true |
| `findings[].confidence` | Confidence | แสดงเป็น `C:NN` |
| `findings[].consensus` | Consensus | SDK ใช้ `"N/M"` (e.g., `"2/3"`) → แสดงตรงๆ; fallback `"confirmed"` → แสดงเป็น `SDK` |
| `strengths[]` | Strengths section | ใส่ทุกรายการ |
| `verdict` | Final verdict | `"REQUEST_CHANGES"` หรือ `"APPROVE"` |
| `noiseWarning` | Signal warning | true → prepend warning notice |

---

## ข้อแตกต่างจาก Agent Teams

| ด้าน | Agent Teams | SDK Fast-Path |
| ------ | ------------- | --------------- |
| Debate | มี (2 rounds) | ไม่มี (falsification แทน) |
| Hard Rules | cannot be dropped | cannot be dropped (เหมือนกัน) |
| Output format | markdown table | JSON → map เป็น markdown |
| Strengths | per-reviewer | merged + deduped |
| Jira AC check | ได้ (Phase 2) | ยังไม่รองรับ (ต้อง Agent Teams ถ้า Jira key ให้มา) |
| Adonisjs lens | ตาม project detection | อัตโนมัติ (SDK detect เอง) |

---

## เงื่อนไขที่ควร Skip Fast-Path (force Agent Teams)

```markdown
**Force Agent Teams (skip SDK fast-path) ถ้า:**
- `$1` มี Jira key → ต้องการ AC verification ที่ Agent Teams ทำได้
- PR มี >500 changed lines → SDK อาจ truncate diff
- `--full` debate ต้องการ explicitly → user ระบุมา
```

---

## Fallback Safety

SDK fast-path ล้มเหลวเงียบๆ เสมอ (ไม่ crash skill):

```bash
# ไม่ใช้ || true ก่อน sdk_exit=$? เพราะจะ reset exit code เป็น 0 เสมอ
sdk_result=$(... 2>&1)
sdk_exit=$?

# Validate JSON: ใช้ jq (ถ้ามี) หรือ node เป็น fallback — ไม่พึ่ง python3
_is_valid_json() {
  if command -v jq >/dev/null 2>&1; then
    echo "$1" | jq -e '.findings' >/dev/null 2>&1
  else
    echo "$1" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.exit(Array.isArray(d.findings)?0:1)" 2>/dev/null
  fi
}

if [ $sdk_exit -ne 0 ] || ! _is_valid_json "$sdk_result"; then
  echo "SDK review failed — falling back to Agent Teams"
  # continue to Step 1
fi
```
