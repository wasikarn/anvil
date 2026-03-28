# Phase 3: Create Team and Independent Review

## SDK Fast-Path (try before spawning Agent Teams)

**Try the SDK Review Engine first (faster, deterministic, lower token cost):**

```bash
SDK_DIR="${CLAUDE_SKILL_DIR}/../../anvil-sdk"

# Auto-install dependencies on first use
if [ ! -d "$SDK_DIR/node_modules" ]; then
  (cd "$SDK_DIR" && npm install --silent 2>/dev/null)
fi

# Build CLI args
SDK_ARGS="--pr $0 --output json"

# Pass dismissed patterns if file exists
DISMISSED_FILE="$(bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" review)/review-dismissed.md"
if [ -f "$DISMISSED_FILE" ]; then
  SDK_ARGS="$SDK_ARGS --dismissed $DISMISSED_FILE"
fi

# Pass hard rules if loaded in Phase 2
if [ -f "{hard_rules_path}" ]; then
  SDK_ARGS="$SDK_ARGS --hard-rules {hard_rules_path}"
fi

# Run SDK reviewer
sdk_result=$(cd "$SDK_DIR" && node_modules/.bin/tsx src/cli.ts review $SDK_ARGS 2>&1)
sdk_exit=$?
```

If `sdk_exit=0` and `sdk_result` is valid JSON (starts with `{`):

**Use SDK output directly:**

- Parse `sdk_result` as the review report JSON
- Map `findings[]` to the standard findings table format per [review-output-format](../../review-output-format/SKILL.md)
- Report: `SDK Review Engine: {critical} critical · {warning} warnings · {info} info · cost $X`
- **Skip Agent Teams spawning (Phases 3-5)** — proceed directly to Phase 6 (action phase)

**If `sdk_exit != 0` or result is not valid JSON**, log `SDK review failed (exit {sdk_exit}) — falling back to Agent Teams` and continue with the steps below.

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

**Conditional specialist agent** — spawn at most 1, evaluated in priority order. Skip all specialists if PR has < 200 lines changed (from diff stat).

| Priority | Condition | Agent to spawn |
| --- | --- | --- |
| 1 | Test files changed (`*.spec.*`, `*.test.*`) OR new exported functions without spec changes | `test-quality-reviewer` |
| 2 | Controller/route/handler/interface/DTO files changed | `api-contract-auditor` |
| 3 | Migration files changed (`*.migration.*`, files with `CREATE TABLE` / `ALTER TABLE` / `addColumn`) | `migration-reviewer` |

Evaluate in priority order — spawn the **first matching condition only**. The specialist agent sends findings to the team lead and enters the same debate pipeline as standard teammates.

Insert into each teammate prompt:

- Project Hard Rules (from Phase 2)
- PR number
- `{bootstrap_context}` from Bootstrap (if available)
- AC summary if Jira AC was parsed (Bootstrap)
- Known dismissed patterns: if `{review_memory_dir}/review-dismissed.md` exists, include last 10 entries as `{dismissed_patterns}` — teammates skip re-raising these patterns without new evidence

All teammates are READ-ONLY.

## Step 3: Wait for all reviews

Wait for all 3 teammates to complete. Track progress: show each teammate's status and key finding. **CHECKPOINT** — all 3 reviews must complete before proceeding to Phase 4 debate.
