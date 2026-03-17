# Workflow Modes

Classification criteria for Full, Quick, and Hotfix mode. Lead auto-classifies at Phase 0; user can override.

## Mode Selection

| Mode | When | Phases | Estimated sessions |
| --- | --- | --- | --- |
| **Full** | Multi-file feature, architectural change, new domain | All (0-6) | 9-14 |
| **Quick** | Bug fix, small refactor, fix PR comments, single-file change | Skip Phase 1 | 6-10 |
| **Hotfix** | Urgent production bug, `--hotfix` flag | Skip Phase 1, branch from `main` | 4-8 |

## Auto-Classification Rules

**Full mode** — any of:

- Task mentions "new feature", "add endpoint", "new module", "redesign", "migration"
- Task references a Jira epic or multi-story ticket
- Task requires touching 3+ files across different layers
- Task involves schema change or API contract change
- User explicitly passes `--full`

**Quick mode** — all of:

- Task is a bug fix, refactor, or PR comment fix
- Scope is 1-2 files in the same layer
- No schema or API contract changes
- No new domain concepts introduced
- User explicitly passes `--quick`

**Hotfix mode** — any of:

- User explicitly passes `--hotfix`
- Task mentions "production", "P0", "urgent fix", "hotfix", "incident"
- Bug is actively impacting users in production

**Ambiguous** — ask user: "This could be Full or Quick. Full adds a research phase (~2-3 explorer sessions). Which do you prefer?"

## Mode Differences

| Aspect | Full | Quick | Hotfix |
| --- | --- | --- | --- |
| Phase 1 (Research) | 2-3 explorer teammates | Skipped | Skipped |
| Phase 2 (Plan) | From research.md | From task description | Minimal — broken path only |
| Phase 3 (Implement) | May use parallel workers | Usually 1 worker | 1 worker, minimal scope |
| Phase 4 (Review) | Scaled by diff size (see below) | Scaled by diff size (see below) | 2 reviewers max (no DX) |
| Branch | `feature/` or `fix/` from `develop` | `fix/` from `develop` | `hotfix/` from `main` |
| PR target | `develop` | `develop` | `main` + backport to `develop` |
| Artifacts | research.md + plan.md | plan.md only | plan.md only |

## Branch Setup (Phase 0 Step 2.5)

Check `branch` from Project JSON against `base_branch`:

```text
--hotfix mode?
├→ Switch to main first: git checkout main && git pull
├→ Jira key found? → create: hotfix/BEP-XXX-{slug}
└→ No Jira key?   → create: hotfix/{slug}

Already on a feature/fix/hotfix branch (not base)?
└→ Proceed as-is — assume intentional

On base branch (main/develop)?
├→ Jira key found?
│   ├→ Full mode  → create: feature/BEP-XXX-{slug}
│   └→ Quick mode → create: fix/BEP-XXX-{slug}
└→ No Jira key?
    └→ Ask user: "Branch name? (e.g. feature/short-description)"
```

**Slug rules:** lowercase, hyphens only, max 40 chars. Run: `git checkout -b {branch_name}`

**GATE (Hotfix):** On `hotfix/*` branch from `main` → proceed.
**GATE (Normal):** Branch is a non-base branch → proceed.

## Review Scale (Iteration 1)

Scale review intensity by diff size to avoid over-spending tokens on small changes:

| Diff size | Reviewers | Debate | Notes |
| --- | --- | --- | --- |
| ≤50 lines | 1 (lead self-review) | None | Use Solo Self-Review Checklist in operational.md |
| 51–200 | 2 (Correctness + Architecture) | 1 round | Skip DX reviewer |
| 201–400 | 3 (full set) | Full (2 rounds max) | Standard review |
| 400+ | 3 (full set) | Full (2 rounds max) | Flag PR size to user |

Hotfix mode is always capped at 2 reviewers (Correctness + Architecture) regardless of diff size.

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
- `/dlc-build "BEP-1234" --hotfix` → forces Hotfix mode (branch from main, minimal scope)
