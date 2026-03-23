# Phase 4: Review

Load [reviewer-prompts.md](reviewer-prompts.md), [../../../references/review-conventions.md](../../../references/review-conventions.md), [../../../references/review-output-format.md](../../../references/review-output-format.md) before starting.

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

Determine diff size first: `git diff {base_branch}...HEAD --stat | tail -1`

| Diff size | Reviewers | Debate | Notes |
| --- | --- | --- | --- |
| ≤50 lines | 1 (lead self-review) | None | Use Solo Self-Review Checklist from operational.md |
| 51–200 | 2 (Correctness + Architecture) | 1 round | Skip DX reviewer |
| 201–400 | 3 (full set) | Full (2 rounds max) | Standard review |
| 400+ | 3 (full set) | Full (2 rounds max) | Flag PR size to user |

> **Quick mode override:** In Quick mode, use lead self-review (Solo Self-Review Checklist) for diffs ≤100 lines — no teammate spawning. Only spawn reviewers for Quick mode diffs >100 lines.

Load debate protocol for 2-round debate cases: [../../../references/debate-protocol.md](../../../references/debate-protocol.md) (shared with dlc-review — always available).

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

Write findings to `{artifacts_dir}/review-findings-{iteration}.md` per [../../../references/review-output-format.md](../../../references/review-output-format.md).

- **Iter 1 (3 reviewers):** After falsification pass (Phase 4.5), dispatch `review-consolidator` with the post-verdict findings table.
- **Iter 2+ (2 reviewers):** Dispatch `review-consolidator` immediately when the second reviewer's findings arrive — lead reads findings while agent runs in parallel. No falsification pass.
- **1 reviewer:** Lead consolidates inline (no agent).

If agent errors → dedup, pattern-cap, sort, and signal-check inline per [review-conventions.md](../../../references/review-conventions.md).

**Phase 4 status line** (output before findings table — no prose paragraph):
`### Phase 4 Complete — N findings consolidated · Proceeding to Phase 5`

**GATE:** Findings consolidated → update `Phase: review` in dev-loop-context.md → proceed to Assess.

## Phase 4.5: Falsification Pass (Full mode iter 1 only)

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

Note rejected count in the Phase 4 status line: `(N findings rejected by Falsification Pass)`.

Then proceed to dispatch `review-consolidator` with the post-verdict findings table.

## Lead Notes

**Task context injection (B1):** When constructing reviewer prompts, populate `TASK_CONTEXT` from:

- `Description`: task description from `dev-loop-context.md` → `task:` field
- `AC items`: Jira AC list from `dev-loop-context.md` → Jira context section, or "none"
- `Plan summary`: read plan file path from `dev-loop-context.md` → `plan_file:` field; read that file and extract top 5 task titles (one line, max 10 words each). If `plan_file` is empty, set Plan summary to "plan file path not in context."

**Severity calibration injection (SA):** Before spawning reviewers, construct a `SEVERITY CALIBRATION` block and inject it into each reviewer prompt:

```text
SEVERITY CALIBRATION — examples from this project:
Critical: {most recent Critical example from {review_memory_dir}/review-dismissed.md}
Warning: {most recent Warning example}
Suggestion: {most recent Suggestion example}

Anchor to these before assigning any severity. When in doubt, use Warning over Critical.
```

**Example source priority:**

1. Read the centralized dlc-review dismissed log — path: `bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" dlc-review` → `review-dismissed.md` — if it exists, find the most recent entry per severity level (Critical, Warning, Suggestion) and use the `Finding` column text as the example.
2. If the file does not exist or has no entry for a severity level, use hardcoded fallback:
   - Critical: "SQL injection via unsanitized user input in query builder"
   - Warning: "Missing null check on optional field that is null in 10% of production calls"
   - Suggestion: `Variable name 'data' is ambiguous — rename to reflect content type`
