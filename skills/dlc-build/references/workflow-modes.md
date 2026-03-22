# Workflow Modes

Classification criteria for Full, Quick, and Hotfix mode. Lead auto-classifies at Phase 0; user can override.

## Mode Selection

| Mode | When | Phases | Estimated sessions |
| --- | --- | --- | --- |
| **Full** | Multi-file feature, architectural change, new domain | All (0-6) | 9-14 |
| **Quick** | Bug fix, small refactor, fix PR comments, single-file change | Skip Phase 1 | 6-10 |
| **Hotfix** | Urgent production bug, `--hotfix` flag | Skip Phase 1, branch from `main` | 4-8 |

## Mode Decision Tree

Use this deterministic tree to classify mode. Apply top-to-bottom; first match wins.

```text
--hotfix flag OR task mentions "production"/"P0"/"urgent fix"/"hotfix"/"incident"?
└─ YES → HOTFIX mode

--quick flag?
└─ YES → QUICK mode

--full flag?
└─ YES → FULL mode

Task involves ANY of:
  - "new feature" / "add endpoint" / "new module" / "redesign"
  - Schema change (migration) or API contract change
  - Jira epic or multi-story ticket
  - Touching 3+ files across different architectural layers?
└─ YES → FULL mode

Task is ALL of:
  - Bug fix, refactor, or PR comment fix
  - Scope is 1-2 files in the same layer
  - No schema or API contract changes
  - No new domain concepts?
└─ YES → QUICK mode

Otherwise → AMBIGUOUS: ask user
  "This could be Full or Quick. Full adds a research phase (~2-3 explorer sessions). Which do you prefer?"
```

## Mode Differences

| Aspect | Full | Quick | Hotfix |
| --- | --- | --- | --- |
| Phase 4 (Review) | Scaled by diff size (see below) | Scaled by diff size (see below) | 2 reviewers max (no DX) |
| Artifacts | research.md + plan.md | plan.md only | plan.md only |

## Review Scale (Iteration 1)

Scale review intensity by diff size to avoid over-spending tokens on small changes:

| Diff size | Reviewers | Debate | Notes |
| --- | --- | --- | --- |
| ≤50 lines | 1 (lead self-review) | None | Use Solo Self-Review Checklist in operational.md |
| 51–200 | 2 (Correctness + Architecture) | 1 round | Skip DX reviewer |
| 201–400 | 3 (full set) | Full (2 rounds max) | Standard review |
| 400+ | 3 (full set) | Full (2 rounds max) | Flag PR size to user |

Hotfix mode is always capped at 2 reviewers (Correctness + Architecture) regardless of diff size.

**Quick mode override:** In Quick mode, use lead self-review (Solo Self-Review Checklist from operational.md) for diffs ≤100 lines — no teammate spawning. Only spawn reviewers for Quick mode diffs >100 lines.

## Hotfix Constraints

- Branch from `main` (not `develop`) — `git checkout main && git pull`
- Scope is the broken code path **only** — no refactoring, no unrelated improvements
- Review uses 2 reviewers max (Correctness + Architecture, skip DX)
- After merge to `main`: mandatory backport PR to `develop`
- Backport via cherry-pick; if conflicts → note in PR, assign to author

## User Override

User can always override classification:

- `/dlc-build "simple bug" --full` → forces Full mode (extra research won't hurt)
- `/dlc-build "big feature" --quick` → forces Quick mode (lead warns about risk but complies)
- `/dlc-build "ABC-1234" --hotfix` → forces Hotfix mode (branch from main, minimal scope)
