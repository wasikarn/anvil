---
name: project-onboarder
description: "Bootstraps a new project into the dev-loop ecosystem. Detects the project stack, scaffolds .claude/skills/review-rules/hard-rules.md with stack-appropriate starter rules, and writes .claude/dlc-build/validate-command.md as project config. Artifact paths are managed by scripts/artifact-dir.sh. Run once on a new project before the first dlc-build or dlc-review invocation."
tools: Read, Glob, Grep, Bash, Write
model: sonnet
maxTurns: 15
---

# Project Onboarder

Set up a new project for the dev-loop ecosystem. One-time setup that enables dlc-build, dlc-review,
and dlc-debug to work correctly from the first invocation.

## Steps

### 1. Detect Project Stack

```bash
cat package.json 2>/dev/null
ls -1 go.mod requirements.txt pyproject.toml Cargo.toml 2>/dev/null
```

Identify:

- **Language:** TypeScript / Go / Python / Rust / other
- **Framework:** AdonisJS / Next.js / Express / FastAPI / etc.
- **Test runner:** Vitest / Jest / Go test / Pytest / Japa
- **Architecture:** Clean Architecture / MVC / feature-based / etc.

```bash
rtk tree --gitignore -L 3 --dirsfirst --prune
```

### 2. Check Existing Setup

```bash
ls -la .claude/ 2>/dev/null
ls -la .claude/skills/review-rules/ 2>/dev/null
ls -la .claude/dlc-build/validate-command.md 2>/dev/null
```

Note what already exists — do not overwrite existing files.

### 3. Scaffold Directory Structure

Create required directories if they do not exist:

```bash
mkdir -p .claude/skills/review-rules
mkdir -p .claude/dlc-build
```

Note: Skill artifacts (research.md, debug-context.md, etc.) are stored at the path
returned by `scripts/artifact-dir.sh <skill-name>` — created automatically on first use.
`.claude/dlc-build/` is for project-level config only (validate-command.md).

### 4. Write Hard Rules

If `.claude/skills/review-rules/hard-rules.md` does not exist, create it with stack-appropriate
starter rules.

**Base rules (all stacks):**

```markdown
# Hard Rules — {Project Name}

Rules that CANNOT be bypassed via debate. Every violation is Critical.

## Universal
- No secrets or credentials in source code — use environment variables
- No empty catch blocks — errors must be logged or re-thrown
- No SQL string concatenation with user input — use parameterized queries

## {Stack-specific rules below — customize for your project}
```

**TypeScript additions:**

```markdown
## TypeScript
- No `as any` without a justification comment explaining why the type is unknown
- No `!` non-null assertion without a guard or comment explaining why null is impossible
- No `@ts-ignore` — use `@ts-expect-error` with a reason comment instead
```

**AdonisJS additions:**

```markdown
## AdonisJS
- All database queries must use the Query Builder or Lucid ORM — no raw SQL
- All HTTP handlers must validate request body using VineJS validators
- All migrations must implement both `up()` and `down()` methods
```

**Next.js additions:**

```markdown
## Next.js
- No `useEffect` with missing dependencies — use exhaustive-deps lint rule
- No `fetch` in components without error boundaries
- All API routes must validate input before processing
```

**Effect-TS additions (if detected):**

```markdown
## Effect-TS
- No raw try/catch in Effect code — use Effect.tryPromise or Effect.try
- No direct Promise usage in Effect pipelines — wrap with Effect.promise
- All effects must be run through a Layer — no direct service construction
```

### 5. Write Validate Command Hint

Write `.claude/dlc-build/validate-command.md`:

```markdown
# Validate Command

The validate command for this project is:

{auto-detected or placeholder}

## Auto-detected
{result of: cat package.json | jq '.scripts.test // .scripts.validate // .scripts.check'}

Replace this file content with the actual validate command if auto-detection is incorrect.
```

### 6. Output Onboarding Summary

```markdown
## dev-loop Onboarding Complete

**Project:** {name}
**Stack:** {language} / {framework} / {test runner}
**Architecture:** {detected pattern}

### Files Created
- `.claude/skills/review-rules/hard-rules.md` — {created | already existed}
- `.claude/dlc-build/validate-command.md` — {created | already existed}

### Validate Command
`{command}` — verify this is correct before running dlc-build

### Next Steps
1. Review and customize `.claude/skills/review-rules/hard-rules.md` for your project's conventions
2. Run `/dlc-build` with a simple task to verify the setup works end-to-end
3. Run `/dlc-review` on your next PR to verify review pipeline loads Hard Rules correctly

### Hard Rules Preview
{first 10 lines of the generated hard-rules.md}
```
