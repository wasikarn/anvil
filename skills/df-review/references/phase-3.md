# Phase 3: Create Team and Independent Review

## SDK Fast-Path (try before spawning Agent Teams)

**Auto-escalation — evaluate signals in priority order:**

**Force `--full` (3 reviewers + debate) ถ้า:**

- `--full` flag ระบุมา explicitly
- Security/infra files changed: `auth/`, `migrations/`, `.env*`, CI/CD configs (`*.yml` in `.github/`), public API route handlers
- PR มี >400 changed lines AND (Jira key present OR security/infra files detected)

**Use `--quick` (2 reviewers + falsification, no debate) ถ้า:**

- PR มี >400 changed lines (large diff — SDK อาจ truncate, 400 LOC = empirical review-quality cliff)
- Jira key present (ต้องการ AC verification)

**Force SDK-only (--micro flag):**

ถ้า `--micro` flag ระบุมา → ข้ามการตรวจ force-Agent-Teams conditions ข้างบน และ:

1. ลองรัน Review Engine ก่อน (ตาม block ด้านล่าง)
2. ถ้า SDK สำเร็จ → แสดงผลและ skip Phase 4, 5 (ไม่มี debate, ไม่มี falsification)
3. ถ้า SDK ล้มเหลว → spawn Teammate 1 (Correctness & Security) คนเดียว → skip Phase 4, 5

**2 reviewers, no debate (--quick flag):**

ถ้า `--quick` flag ระบุมา → ข้ามการตรวจ force-Agent-Teams conditions ข้างบน และ:

1. ลองรัน Review Engine ก่อน
2. ถ้า SDK สำเร็จ → แสดงผลและ skip Phase 4 (ไม่มี debate) → proceed to Phase 5 (falsification)
3. ถ้า SDK ล้มเหลว → spawn Teammate 1 (Correctness & Security) + Teammate 2 (Architecture & Performance) เท่านั้น → skip Phase 4 → proceed to Phase 5

**Otherwise, try the devflow-engine resolve first (determines review mode from PR signals):**

```bash
ENGINE_DIR="${CLAUDE_SKILL_DIR}/../../devflow-engine"

if [ -d "$ENGINE_DIR" ] && [ -d "$ENGINE_DIR/node_modules" ]; then
  # Build resolve args — note: $0 is skill template substitution for PR number (not shell $0)
  RESOLVE_ARGS="--pr $0"
  DISMISSED_FILE="$(bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" review)/review-dismissed.md"
  if [ -f "$DISMISSED_FILE" ]; then
    RESOLVE_ARGS="$RESOLVE_ARGS --dismissed $DISMISSED_FILE"
  fi
  # Check for Jira key in arguments
  echo "$ARGUMENTS" | grep -qE '[A-Z]+-[0-9]+' && RESOLVE_ARGS="$RESOLVE_ARGS --jira"
  # Pass explicit mode flags from user args
  echo "$ARGUMENTS" | grep -q '\-\-micro' && RESOLVE_ARGS="$RESOLVE_ARGS --micro"
  echo "$ARGUMENTS" | grep -q '\-\-quick' && RESOLVE_ARGS="$RESOLVE_ARGS --quick"
  echo "$ARGUMENTS" | grep -q '\-\-full'  && RESOLVE_ARGS="$RESOLVE_ARGS --full"
  # Extract --focused area using perl (portable; grep -oP is macOS-incompatible)
  focused_area=$(echo "$ARGUMENTS" | perl -ne 'if (/--focused\s+(\S+)/) { print $1; exit }')
  [ -n "$focused_area" ] && RESOLVE_ARGS="$RESOLVE_ARGS --focused $focused_area"

  # Capture stdout only; redirect stderr to /dev/null to prevent tsx warnings corrupting JSON
  resolve_result=$(cd "$ENGINE_DIR" && bun src/cli.ts resolve $RESOLVE_ARGS 2>/dev/null)
  resolve_exit=$?

  _extract_mode() {
    if command -v jq >/dev/null 2>&1; then
      echo "$1" | jq -r '.mode' 2>/dev/null
    else
      echo "$1" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).mode)" 2>/dev/null
    fi
  }

  if [ "$resolve_exit" -eq 0 ]; then
    resolved_mode=$(_extract_mode "$resolve_result")
    echo "Review Engine: mode=$resolved_mode score=$(echo "$resolve_result" | jq -r '.score // "?"' 2>/dev/null)"
  else
    echo "devflow-engine resolve failed (exit $resolve_exit) — falling back to rule-based escalation"
    resolve_exit=1
  fi
else
  echo "devflow-engine not available — falling back to rule-based escalation"
  resolve_exit=1
fi

# Fallback: if engine unavailable or failed, use rule-based prose escalation (existing logic below)
```

**If `$resolve_exit` = 0:** Use `$resolved_mode` directly as the review mode — skip the rule-based escalation below.

**If `$resolve_exit` ≠ 0:** Apply rule-based escalation:

---

## Pre-spawn: Diff Scope Check

Before spawning reviewers, count changed files from the already-loaded PR diff stat header:

| Diff files (from header) | Lens injection |
| --- | --- |
| <30 | Domain-scoped — inject assigned lenses per teammate per [teammate-prompts.md](teammate-prompts.md) lens table |
| 30–50 | Reduced — inject max 1 lens per teammate: T1→security, T2→performance, T3→frontend (if applicable) |
| >50 | Skip all lenses — Hard Rules only; notify user: "Large diff (N files) — lenses skipped, Hard Rules only" |

Use the file count from `PR diff stat` in the skill header (`!gh pr diff $0 --stat`). Parse the summary line (e.g., "12 files changed") — do not run a new git command.

## Step 1: Severity Calibration Block

Before creating the team, construct the `SEVERITY CALIBRATION` block to inject into each reviewer prompt:

1. Read `{review_memory_dir}/review-confirmed.md` if it exists — find the most recent **confirmed** finding per severity level and use the `Finding` column as the positive anchor (what a real finding looks like at that severity).
2. Read `{review_memory_dir}/review-dismissed.md` if it exists — find the most recent dismissed entry per severity level for the `KNOWN FALSE POSITIVES` suppression block.
3. If files are absent or a severity level has no entries, use hardcoded fallbacks:
   - Critical: "SQL injection via unsanitized user input in query builder"
   - Warning: "Missing null check on optional field that is null in 10% of production calls"
   - Suggestion: `Variable name 'data' is ambiguous — rename to reflect content type`

Inject into each teammate prompt (append after `{bootstrap_context}` block) — use confirmed
examples as positive anchors, dismissed as suppression:

```text
SEVERITY CALIBRATION — examples from this project:
Critical: {example}
Warning: {example}
Suggestion: {example}

Anchor to these before assigning any severity. When in doubt, use Warning over Critical.
```

## Step 2: Create the team

Create an agent team named `review-pr-$0` with 3 reviewer teammates using prompts from [teammate-prompts.md](teammate-prompts.md):

- **Teammate 1 — Correctness & Security:** Focus on correctness (#1, #2), type safety (#10), error handling (#12)
- **Teammate 2 — Architecture & Performance:** Focus on N+1 (#3), DRY (#4), flatten (#5), SOLID (#6), elegance (#7)
- **Teammate 3 — DX & Testing:** Focus on naming (#8), docs (#9), testability (#11), debugging (#12)

**Conditional specialist agents** — spawn at most 1 primary specialist (Priority 1-3), plus up to 2 secondary specialists (Priority 4-5). Skip all specialists if PR has < 200 lines changed (from diff stat).

| Priority | Condition | Agent to spawn |
| --- | --- | --- |
| 1 | Test files changed (`*.spec.*`, `*.test.*`) OR new exported functions without spec changes | `test-quality-reviewer` |
| 2 | Controller/route/handler/interface/DTO files changed | `api-contract-auditor` |
| 3 | Migration files changed (`*.migration.*`, files with `CREATE TABLE` / `ALTER TABLE` / `addColumn`) | `migration-reviewer` |
| 4 | `try/catch`, `.catch()`, optional chaining (`?.`), or nullish coalescing (`??`) changed | `silent-failure-hunter` |
| 5 | TypeScript `interface`, `type`, or `class` definitions changed | `type-design-analyzer` |

Evaluate in priority order — spawn the **first matching condition only** from Priority 1-3 (primary). Additionally, evaluate Priority 4-5 independently and spawn up to 2 secondary specialists if conditions match. All specialist agents send findings to the team lead and enter the same debate pipeline as standard teammates.

**Severity mapping:** `silent-failure-hunter` uses `CRITICAL/HIGH/MEDIUM` — map to pipeline labels before consolidation: `CRITICAL → Critical`, `HIGH → Warning`, `MEDIUM → Suggestion`.

## Advisor Mode (--advisor)

ถ้า `--advisor` flag ระบุมา → ใช้ cost-intelligent review pattern:

**Phase 3-Advisor Flow:**

1. **Detect mode** — fast, balanced (default), or conservative
2. **Spawn fast reviewers** — same 3 teammates but with confidence scoring enabled
3. **Collect findings with confidence** — each finding includes 0.0-1.0 score
4. **Escalation gate** — findings with confidence < threshold OR security/arch patterns → advisor-consultant (Opus)
5. **Advisor consultation** — Opus analyzes uncertain findings, returns verdict
6. **Skip Phase 4 (debate)** — advisor replaces debate for uncertain items
7. **Proceed to Phase 5** — falsification agent still runs on all findings

**Configuration by mode:**

| Mode | Executor | Threshold | Escalate On |
|------|----------|-----------|-------------|
| fast | Haiku | 0.6 | Security patterns only |
| balanced | Sonnet | 0.7 | Security + Architecture + confidence < 0.7 |
| conservative | Sonnet | 0.8 | Any confidence < 0.8 |

**Auto-escalate patterns (always to advisor):**

- Security: `sql-injection`, `xss`, `auth-bypass`, `secrets`
- Architecture: `breaking-change`, `api-contract`, `circular-dependency`
- Complexity: Files with >500 changed lines

**Cost impact:**

- Escalation rate typically 10-30%
- Cost savings 35-80% vs standard 3×Opus review
- Latency +10-20% due to advisor round-trip

See [phase-advisor.md](phase-advisor.md) for full implementation.

## --focused Mode: Specialist-Only Review

ถ้า `--focused [area]` flag ระบุมา → ข้าม 3 main reviewers, spawn เฉพาะ specialist ที่ตรงกับ area:

| area | Agent |
| --- | --- |
| `errors` | `silent-failure-hunter` |
| `types` | `type-design-analyzer` |
| `tests` | `test-quality-reviewer` |
| `api` | `api-contract-auditor` |
| `migrations` | `migration-reviewer` |

Specialist ส่งผลโดยตรงไปยัง lead → skip Phase 4 (debate) → proceed to Phase 5 (falsification) → Phase 6 (action).
ถ้า area ไม่ตรงกับ table → แจ้ง user: "Unknown area '{area}'. Valid areas: errors, types, tests, api, migrations"

Insert into each teammate prompt:

- Project Hard Rules (from Phase 2)
- PR number
- `{bootstrap_context}` from Bootstrap (if available)
- AC summary if Jira AC was parsed (Bootstrap)
- Known dismissed patterns: if `{review_memory_dir}/review-dismissed.md` exists, include last 10 entries as `{dismissed_patterns}` — teammates skip re-raising these patterns without new evidence

All teammates are READ-ONLY.

## Step 3: Wait for all reviews

ถ้า `--focused` flag → wait for **1 specialist** only, then skip directly to Phase 6 (no debate).
ถ้า `--quick` flag → wait for **2 teammates** only (T1 + T2), then skip Phase 4.

Wait for all 3 teammates to complete. Track progress: show each teammate's status and key finding. **CHECKPOINT** — all 3 reviews must complete before proceeding to Phase 4 debate.
