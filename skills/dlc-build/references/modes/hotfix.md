# Mode: Hotfix

Loaded by Phase 0 after Hotfix mode is confirmed. For urgent production bugs only.

## Branch Strategy

- Branch from: `main`
- Branch prefix: `hotfix/`
- PR target: `main` (+ mandatory backport PR to `develop` after merge)

```text
git checkout main && git pull
git checkout -b hotfix/ABC-XXX-{slug}   # Jira key present
# No Jira key → ask user: "Branch name? (e.g. hotfix/short-description)"
# Then: git checkout -b hotfix/{slug}
```

Slug rules: lowercase, hyphens only, max 40 chars.

**Backport:** After merging to `main`, open a second PR targeting `develop` via cherry-pick. If conflicts arise, note them in the PR and assign resolution to the author.

## Phase 2 Pre-Steps

Before writing plan tasks:

1. **Reproduce locally** — run the app and trigger the bug. Document exact steps:
   - Input / request that causes the bug
   - Observed vs expected behaviour
2. **Identify root cause** — pinpoint the suspected `file:line` with reasoning.
3. **Incident checklist** — answer all four before proceeding:
   - How many users / what percentage of traffic is affected?
   - Is the issue still actively occurring right now?
   - Is a workaround available for affected users?
   - Have stakeholders / on-call been notified?
4. **Scope gate** — confirm the fix is limited to the broken code path only. No refactoring, no unrelated improvements. If you spot something else broken, note it as a follow-up ticket.

Plan tasks must fix the root cause only.
