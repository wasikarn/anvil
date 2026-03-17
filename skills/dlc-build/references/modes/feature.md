# Mode: Feature (Full)

Loaded by Phase 0 after Full mode is confirmed.

## Branch Strategy

- Branch from: `develop`
- Branch prefix: `feature/`
- PR target: `develop`

```text
git checkout develop && git pull
git checkout -b feature/BEP-XXX-{slug}   # Jira key present
git checkout -b feature/{slug}            # No Jira key — ask user for name
```

Slug rules: lowercase, hyphens only, max 40 chars.

## Phase 1 Discovery Guidance

Before dispatching explorer teammates, answer these questions from the task description and any Jira context:

1. What domain does this touch? (auth, billing, media, video processing, etc.)
2. What API contracts or DB schemas will change?
3. Who are the downstream consumers of those contracts?
4. Are there dependencies on in-flight branches or unreleased changes?

Inject these answers into the explorer prompt as explicit constraints. Remind explorers to:

- Map call graphs from entry point to affected layers
- Identify all files that import the changed module
- Note any schema or migration files that will need updating
