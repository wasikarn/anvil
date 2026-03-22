# Mode: Quick

Loaded by Phase 0 after Quick mode is confirmed. Covers bug fixes, small refactors, and PR comment fixes.

## Branch Strategy

- Branch from: `develop`
- Branch prefix: `bugfix/`
- PR target: `develop`

```text
git checkout develop && git pull
git checkout -b bugfix/ABC-XXX-{slug}   # Jira key present
# No Jira key → ask user: "Branch name? (e.g. bugfix/short-description)"
# Then: git checkout -b bugfix/{slug}
```

Slug rules: lowercase, hyphens only, max 40 chars.

## Phase 2 Pre-Steps

Apply the reproduce pre-steps **only when the task is a bug fix**. For refactors and PR comment fixes, skip directly to Phase 2.

### If task is a bug fix

Before writing plan tasks:

1. **Reproduce locally** — run the app and trigger the bug. Document exact steps:
   - Input / request that causes the bug
   - Observed vs expected behaviour
2. **Identify root cause** — pinpoint the suspected `file:line` with reasoning. State your hypothesis explicitly.
3. **Confirm reproduction** — do not proceed to Phase 2 until the bug is reproducible.

Plan tasks must fix the root cause, not just the visible symptom.
