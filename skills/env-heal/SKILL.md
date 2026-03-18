---
name: env-heal
description: "Scans codebase for environment variable references, cross-references with validation schema, auto-fixes and tests. Use when env vars are missing from schema or .env.example, when environment variable errors appear at startup, or when .env files are out of sync. Triggers: heal env, fix env, env heal, env check, check env, validate env, missing env var, env not defined, environment variable error, .env out of sync."
context: fork
agent: general-purpose
argument-hint: "[--quick?] [--dry-run?]"
compatibility: "Run from within the tathep-platform-api repo"
model: haiku
---

# Self-Healing Env Validation

Scan the entire codebase for environment variable references, cross-reference against the validation schema and `.env.example`, then auto-fix discrepancies and verify with tests.

## Mode Selection

Check `$ARGUMENTS` for `--quick`:

- **`--quick` mode:** Skip Phase 1 (full codebase scan) and Phase 4 (classify required vs optional). Go directly to Phase 2 → Phase 3 → Phase 5 → Phase 6 → Phase 7. This provides a fast schema-vs-example consistency check without scanning the entire codebase.
- **Full mode (default):** Run all phases (1 through 7).

## Phases 1-3: Discover, Read Schema, Gap Analysis

Run the consolidated scan script:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/classify-env-gaps.sh [project-root] [schema-file] [example-file]
```

Defaults: `schema-file` = `env.ts`, `example-file` = `.env.example`. In `--quick` mode, `code_vars` will be empty (no codebase scan).

Parse the JSON output. Key fields:

- `schema_vars`, `example_vars`, `code_vars` — discovered variable lists
- `gaps.in_code_not_schema` → needs validation added to env.ts
- `gaps.in_code_not_example` → needs entry added to .env.example
- `gaps.in_schema_not_code` → potentially stale, flag for review
- `gaps.in_example_not_code` → potentially stale, flag for review
- `gap_count` — total gaps found

If `gap_count` is 0, skip to Phase 7 (summary report with zero gaps).

## Phase 4: Determine Required vs Optional

> **Skipped in `--quick` mode.** All vars default to optional.

For each missing variable, check test fixtures and configuration:

```bash
# Check test helpers, factories, .env.test for the var
grep -rn 'VAR_NAME' test/ spec/ __tests__/ .env.test 2>/dev/null
```

- If the var appears in test fixtures with a value → likely **required** with that default
- If the var is used with a fallback/default in code (`?? 'default'`, `|| 'fallback'`, second arg to `Env.get`) → **optional**
- If no fallback and no test fixture → **required**, use empty string placeholder

## Phase 5: Auto-Fix

### Add to env.ts schema

For each var missing from schema, add the appropriate validation rule:

- Name contains `PORT`, `TIMEOUT`, `LIMIT`, `COUNT`, `SIZE` → `Env.schema.number.optional()`
- Name contains `ENABLE`, `DISABLE`, `DEBUG`, `VERBOSE`, `USE_` → `Env.schema.boolean.optional()`
- Name contains `URL`, `HOST`, `ENDPOINT` → `Env.schema.string.optional({ format: 'url' })` (if schema supports format) or `Env.schema.string.optional()`
- Otherwise → `Env.schema.string.optional()`

If Phase 4 determined the var is **required**, use `.required()` instead of `.optional()`.

Preserve existing file ordering and section groupings.

### Add to .env.example

For each var missing from .env.example:

- Add a line `VAR_NAME=` (empty) or `VAR_NAME=<default>` if a sensible default was found
- Place it near related vars (group by prefix: `DB_*`, `REDIS_*`, `AWS_*`, etc.)
- Add a comment if the purpose isn't obvious from the name

## Phase 6: Test & Validate

Run the project test suite:

```bash
rtk test node ace test   # AdonisJS
# or
rtk test bun run test    # Next.js projects
```

If tests fail:

1. Read the error output
2. Determine if the failure is related to the env changes
3. Adjust defaults or required/optional status accordingly
4. Re-run tests
5. Repeat up to 3 times — if still failing, revert changes and report what went wrong

## Phase 7: Summary Report

Output the report using the template in [references/report-template.md](references/report-template.md). Omit sections with zero items.

## Constraints

- Never add actual secret values — use empty strings or placeholder patterns like `your-key-here`.
- Preserve existing file structure, ordering, and comments.
- If unsure whether a var is required or optional, default to optional.
- Skip `node_modules/`, `dist/`, `build/`, `.next/` directories.
