# Phase 4: Review

Load [reviewer-prompts.md](reviewer-prompts.md), [../../references/review-conventions.md](../../references/review-conventions.md), [../../references/review-output-format.md](../../references/review-output-format.md) before starting.

## Review Scale (Iteration 1)

Determine diff size first: `git diff {base_branch}...HEAD --stat | tail -1`

| Diff size | Reviewers | Debate | Notes |
| --- | --- | --- | --- |
| ≤50 lines | 1 (lead self-review) | None | Use Solo Self-Review Checklist from operational.md |
| 51–200 | 2 (Correctness + Architecture) | 1 round | Skip DX reviewer |
| 201–400 | 3 (full set) | Full (2 rounds max) | Standard review |
| 400+ | 3 (full set) | Full (2 rounds max) | Flag PR size to user |

> **Quick mode override:** In Quick mode, use lead self-review (Solo Self-Review Checklist) for diffs ≤100 lines — no teammate spawning. Only spawn reviewers for Quick mode diffs >100 lines.

Load debate protocol for 2-round debate cases: check `../dlc-review/references/debate-protocol.md` first; if not found (dlc-review not installed), use built-in fallback: each reviewer presents findings → others respond once → lead consolidates with consensus notes.

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

Drop findings below the role threshold before consolidation. Hard Rule violations bypass this filter — always report.

| Reviewer role | Confidence threshold |
| --- | --- |
| Correctness & Security | 75 |
| Architecture & Performance | 80 |
| DX & Testing | 85 |

**Debate early-exit:** After debate round 1, if ≥90% of findings have consensus (all reviewers agree) → skip round 2. Only run round 2 when genuine disagreement remains.

## Review Output

Write findings to `.claude/dlc-build/review-findings-{iteration}.md` per [../../references/review-output-format.md](../../references/review-output-format.md). Full mode iter 1 with 3 reviewers: dispatch `review-consolidator` agent with raw findings inline — removes main context bias from ranking and saves Sonnet tokens on mechanical dedup work. For 1–2 reviewer cases, lead consolidates inline (no agent). If agent errors → dedup, pattern-cap, sort, and signal-check inline per [review-conventions.md](../../references/review-conventions.md).

**GATE:** Findings consolidated → update `Phase: review` in dev-loop-context.md → proceed to Assess.
