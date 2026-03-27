# Mode: Micro

Loaded by Phase 1 after Micro mode is confirmed (blast-radius score 0–2).
Covers isolated changes with zero or minimal blast radius: single-file fixes, config tweaks, trivial refactors.

## Branch Strategy

- Branch from: `develop`
- Branch prefix: `fix/` or `chore/`
- PR target: `develop`

```text
git checkout develop && git pull
git checkout -b fix/ABC-XXX-{slug}   # Jira key present
# No Jira key → ask user: "Branch name? (e.g. fix/short-description)"
# Then: git checkout -b fix/{slug}
```

Slug rules: lowercase, hyphens only, max 40 chars.

## Mode Constraints

Per [workflow-modes.md](../workflow-modes.md) Mode Capability Matrix:

- Phase 2 (Research): **Skip** — proceed directly to Phase 3
- Phase 3 (Plan): 1 must_haves truth, no plan gate, no plan-challenger
- Phase 4 (Implement): 1 worker, `effort: low`
- Phase 5 (Verify): Lightweight — 1 truth check, no loop (escalate immediately on fail)
- Phase 6 (Review): Stage 2 → 1 reviewer (self-review for diffs ≤50 lines), no debate
- Phase 8 Simplify sub-step: Skip
- Phase 9 (metrics-analyst): Skip

## Key Differences from Quick

| | Micro | Quick |
| --- | --- | --- |
| Research (Phase 2) | None | Lite (WHAT/WHY) |
| Plan gate (Phase 3) | None | None |
| Plan-challenger | Skip | Skip |
| Verify loop (Phase 5) | None (escalate immediately) | 1 re-entry loop allowed |
| Reviewers (Phase 6) | 1 | 1–2 |
| Simplify (Phase 8 sub-step) | Skip | Optional |
| Metrics | Skip | Skip |

## Phase 3 Pre-Steps

Skip research entirely. Lead writes the plan directly from task description:

- 1 must_haves truth (minimum viable verification)
- Minimal task list — typically 2–4 tasks (test + impl)
- No architecture analysis needed for Micro tasks
