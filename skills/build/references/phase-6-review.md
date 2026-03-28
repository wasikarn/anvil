# Phase 6: Review

Load [reviewer-prompts.md](reviewer-prompts.md), [review-conventions](../../review-conventions/SKILL.md), [review-output-format](../../review-output-format/SKILL.md) before starting.

## Stage 1: Spec Compliance (Always First)

Before spawning any Stage 2 reviewers, lead runs Stage 1 compliance check directly.

Stage 1 checks (in order):

1. **must_haves coverage** — are all truths from Phase 5 verified in the diff?
2. **hard-rules.md compliance** — every rule respected? Cite violations with file:line.
3. **Test file presence** — for every new behavior in diff, is there a corresponding test file change?
   A diff with only production code changes (no test file) fails Stage 1 immediately.
   Exception: Micro mode with no test framework in the project.
4. **Scope fidelity** (mode-dependent):
   - Full: does diff match ADDED/MODIFIED/REMOVED from research.md? Flag out-of-scope changes.
   - Quick: does diff stay within the files from research.md Context section?
   - Micro: skip scope fidelity (no research.md exists for Micro)

**Stage 1 FAIL:** Return to Phase 4 immediately. Do NOT proceed to Stage 2.
Mandatory path: Phase 4 (fix) → **Phase 5 (verify again)** → Phase 6 Stage 1 (check again).
Increment `iteration_count` in anvil-context.md before returning to Phase 4.

**Stage 1 PASS:** Proceed to Stage 2.

---

## Stage 2: Code Quality

**Try the SDK Review Engine first (faster, deterministic, lower token cost):**

```bash
SDK_DIR="${CLAUDE_SKILL_DIR}/../../anvil-sdk"

# Auto-install dependencies on first use
if [ ! -d "$SDK_DIR/node_modules" ]; then
  (cd "$SDK_DIR" && npm install --silent 2>/dev/null)
fi

# Build CLI args
SDK_ARGS="--base-branch {base_branch} --output json"

# Pass dismissed patterns if file exists
DISMISSED_FILE="$(bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" review)/review-dismissed.md"
if [ -f "$DISMISSED_FILE" ]; then
  SDK_ARGS="$SDK_ARGS --dismissed $DISMISSED_FILE"
fi

# Run SDK reviewer
sdk_result=$(cd "$SDK_DIR" && node_modules/.bin/tsx src/cli.ts review $SDK_ARGS 2>&1)
sdk_exit=$?
```

If `sdk_exit=0` and `sdk_result` is valid JSON (starts with `{`):

**Use SDK output directly:**

- Parse `sdk_result` as the review report JSON
- Map `findings[]` to the standard findings table format per [review-output-format](../../review-output-format/SKILL.md)
- Write to `{artifacts_dir}/review-findings-{iteration}.md`
- Report: `SDK Review Engine: {critical} critical · {warning} warnings · {info} info · cost $X`
- **Skip the Agent Teams reviewer spawning below** — proceed directly to Phase 6 output section

**If `sdk_exit != 0` or result is not valid JSON**, log `SDK review failed (exit {sdk_exit}) — falling back to Agent Teams` and continue with the Agent Teams workflow below.

---

**Fallback — Agent Teams:**

Check diff before spawning reviewers (combine staged + unstaged to catch all changed files):

```bash
git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null
```

Deduplicate the combined list before checking conditions.

| Condition | Reviewer spawned |
| ----------- | ----------------- |
| `**/migrations/**` in diff | migration-reviewer |
| `**/routes/**` or `**/controllers/**` in diff | api-contract-auditor |
| `try\|catch\|async` in diff content | error-handling reviewer |
| `.ts` type definitions (`interface\|type\|enum`) in diff | typescript reviewer |
| `*.test.*` or `*.spec.*` in diff | test-quality-reviewer |
| Always | general code-reviewer |

Skip inapplicable reviewers — reduces wasted tokens for PRs that don't touch those domains.

## Pre-spawn Diff Check

Before spawning reviewers, check diff size to determine lens injection level:

```bash
git diff {base_branch}...HEAD --name-only | wc -l
```

| Diff files | Lens injection |
| --- | --- |
| <30 | Domain-scoped — inject assigned lenses per reviewer per [reviewer-prompts.md](reviewer-prompts.md) Lens Selection table |
| 30–50 | Reduced — inject max 1 lens per reviewer: Correctness→security, Architecture→performance, DX→frontend (if applicable) |
| >50 | Skip all lenses — use Hard Rules only; notify user: "Large diff (N files) — lenses skipped" |

## Lens Selection

Lenses are domain-scoped per [reviewer-prompts.md](reviewer-prompts.md) — each reviewer receives only their assigned lenses. Detect applicable lenses using keywords in `git diff {base_branch}...HEAD`, then assign to the appropriate reviewer only.

| Reviewer | Lens file | Inject when diff contains |
| --- | --- | --- |
| Correctness & Security | `security.md` | `auth`, `token`, `password`, `secret`, `jwt`, `cookie`, `csrf`, `sql`, `query`, `exec`, `eval` |
| Correctness & Security | `error-handling.md` | `try`, `catch`, `async`, `.catch(`, `Promise`, `new Error`, `throw` |
| Correctness & Security | `typescript.md` | `.ts`, `.tsx`, `interface`, `type`, `as any`, `generic`, `<T>`, `extends` |
| Architecture & Performance | `performance.md` | `SELECT`, `findAll`, `findMany`, `loop`, `forEach`, `map`, `filter`, `sort`, `cache`, `index` |
| Architecture & Performance | `database.md` | `migration`, `schema`, `ALTER`, `CREATE TABLE`, `DROP`, `knex`, `prisma`, `typeorm`, `sequelize` |
| Architecture & Performance | `api-design.md` | `router`, `controller`, `handler`, `endpoint`, `route`, `REST`, `GraphQL`, `resolver` |
| DX & Testing | `frontend.md` | `.tsx`, `.jsx`, `useState`, `useEffect`, `component`, `render`, `style`, `css` |
| DX & Testing | `observability.md` | `logger`, `log.`, `metric`, `trace`, `span`, `monitor`, `alert`, `newrelic`, `datadog` |

## Review Scale (Iteration 1)

Mode caps per [workflow-modes.md](workflow-modes.md): Micro=1 reviewer, Quick=1–2, Full=3+debate.
Within those caps, scale by diff size:

Determine diff size first: `git diff {base_branch}...HEAD --stat | tail -1`

| Diff size | Reviewers | Debate | Notes |
| --- | --- | --- | --- |
| ≤50 lines | 1 (lead self-review) | None | Use Solo Self-Review Checklist from operational.md |
| 51–200 | 2 (Correctness + Architecture) | 1 round | Skip DX reviewer |
| 201–400 | 3 (full set) | Full (2 rounds max) | Standard review |
| 400+ | 3 (full set) | Full (2 rounds max) | Flag PR size to user |

> **Quick mode override:** In Quick mode, use lead self-review (Solo Self-Review Checklist) for diffs ≤100 lines — no teammate spawning. Only spawn reviewers for Quick mode diffs >100 lines.
> **Micro mode:** Always 1 reviewer (general only) — no debate regardless of diff size.

Load debate protocol for 2-round debate cases: [debate-protocol](../../debate-protocol/SKILL.md) (shared with review — always available).

**CONTEXT-REQUEST handling:** If a reviewer sends a `CONTEXT-REQUEST:` message before submitting findings, lead reads the requested file and sends the relevant section back via SendMessage. Reviewer proceeds after receiving context. If context unavailable, respond: "Proceed without it — note low-confidence in the finding."

## Iteration 2: Focused Review

- 2 reviewers (Correctness + Architecture)
- Review ONLY commits after last review point
- 1 debate round max

## Iteration 3: Spot-Check

- 1 reviewer (Correctness)
- Verify specific fixes only — no full review, no debate
- Binary output: pass or fail with specific issues

## Confidence Filter (all iterations)

Drop findings below the role threshold before consolidation. Hard Rule violations bypass this filter — always report. Thresholds: per [reviewer-shared-rules.md](reviewer-shared-rules.md).

**Debate early-exit:** After debate round 1, if ≥90% of findings have consensus (all reviewers agree) → skip round 2. Only run round 2 when genuine disagreement remains.

## Review Output

Write findings to `{artifacts_dir}/review-findings-{iteration}.md` per [review-output-format](../../review-output-format/SKILL.md).

- **Iter 1 (3 reviewers):** After falsification pass (Phase 7), dispatch `review-consolidator` with the post-verdict findings table.
- **Iter 2+ (2 reviewers):** Dispatch `review-consolidator` immediately when the second reviewer's findings arrive — lead reads findings while agent runs in parallel. No falsification pass.
- **1 reviewer:** Lead consolidates inline (no agent).

If agent errors → dedup, pattern-cap, sort, and signal-check inline per [review-conventions](../../review-conventions/SKILL.md).

**Phase 6 status line** (output before findings table — no prose paragraph):
`### Phase 6 Complete — N findings consolidated · Proceeding to Phase 8`

**GATE:** Findings consolidated → update `Phase: review` in anvil-context.md → proceed to Assess.

## Phase 7: Falsification Pass (Agent Teams fallback, Full mode iter 1 only)

> Skip this phase if Stage 2 used the SDK Review Engine — falsification was already applied internally.

After debate completes but **before** dispatching `review-consolidator`, spawn the `falsification-agent` (defined in `agents/falsification-agent.md`) with the raw pre-consolidation findings table inline.

**Spawn condition:** Full mode iter 1 only (3 reviewers). Skip for: Quick/Hotfix mode, iter 2+ reviews.

Pass to the agent:

- Raw findings table from all reviewers (inline in the prompt)
- Diff access via the agent's Read/Grep/Glob tools

**Apply verdicts before dispatching `review-consolidator`:**

| Verdict | Action |
| --- | --- |
| SUSTAINED | Pass through unchanged |
| DOWNGRADED {new severity} | Update severity in findings table |
| REJECTED | Remove from findings table |

Note rejected count in the Phase 6 status line: `(N findings rejected by Falsification Pass)`.

Then proceed to dispatch `review-consolidator` with the post-verdict findings table.

## Lead Notes

**Task context injection (B1):** When constructing reviewer prompts, populate `TASK_CONTEXT` from:

- `Description`: task description from `anvil-context.md` → `task:` field
- `AC items`: Jira AC list from `anvil-context.md` → Jira context section, or "none"
- `Plan summary`: read plan file path from `anvil-context.md` → `plan_file:` field; read that file and extract top 5 task titles (one line, max 10 words each). If `plan_file` is empty, set Plan summary to "plan file path not in context."

**Severity calibration injection (SA):** Before spawning reviewers, construct a `SEVERITY CALIBRATION` block and inject it into each reviewer prompt:

```text
SEVERITY CALIBRATION — examples from this project:
Critical: {most recent Critical example from {review_memory_dir}/review-dismissed.md}
Warning: {most recent Warning example}
Suggestion: {most recent Suggestion example}

Anchor to these before assigning any severity. When in doubt, use Warning over Critical.
```

**Example source priority:**

1. Read the centralized review dismissed log — path: `bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" review` → `review-dismissed.md` — if it exists, find the most recent entry per severity level (Critical, Warning, Suggestion) and use the `Finding` column text as the example.
2. If the file does not exist or has no entry for a severity level, use hardcoded fallback:
   - Critical: "SQL injection via unsanitized user input in query builder"
   - Warning: "Missing null check on optional field that is null in 10% of production calls"
   - Suggestion: `Variable name 'data' is ambiguous — rename to reflect content type`
