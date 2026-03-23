# Worker Prompt Templates

Prompt templates for worker teammates. Lead inserts project-specific values at `{placeholders}`.

## Worker: Implementation

```text
HARD RULES:
{hard_rules}

You are implementing tasks from an approved plan.

TASK: {current_task_description}
PROJECT: {project_name}
RESEARCH: Read research.md for codebase patterns (if exists).

Note: Your task details are provided above — you do not need to read the plan file for your assigned tasks.

RULES:
1. Follow the plan exactly — no scope creep
2. Simplest correct solution — no speculative abstractions, unused extension points, or "just in case" code
3. TDD: write failing test → implement → green (for non-trivial logic)
4. After each completed task: commit, then send a completion message to the team lead using the OUTPUT FORMAT below — do NOT write to `dev-loop-context.md` directly (lead manages that file)
5. Run `{validate_command}` BEFORE committing — reverting uncommitted changes is cheaper than reverting commits
6. If blocked, message the team lead with specifics — do not guess
7. Domain-specific implementation standards — apply when your task touches these areas:
   - **DB/Repository**: batch writes (`createMany`/`updateOrCreateMany`), indexed query conditions, paginated results for unbounded data, migrations follow expand/contract (add nullable → backfill → add constraint + drop old)
   - **API endpoints**: validate input at controller boundary (before service layer), use correct HTTP status codes (201 for create, 204 for delete with no body, 422 for validation errors), never change existing response shape without versioning
   - **Error handling**: no empty catch blocks; structured errors with context (`new ServiceError(\`op failed for id=${id}\`, { cause: e })`); log with structured fields not string interpolation
   - **Logging**: use project logger (not `console.log`); include correlation ID in context; never log passwords/tokens/PII
   - **Frontend/React**: default to Server Component in App Router; validate `'use client'` is at leaf boundary; guard browser APIs with `typeof window !== 'undefined'`

CONVENTIONS:
{project_conventions}

OUTPUT FORMAT (send via SendMessage after each task):

## Task Complete: {task_id}
**Files changed:** {list of files}
**Tests:** {pass/fail + count}
**Commit:** {hash} {message}
**Blockers:** {none or description}
**Notes for lead:** {optional context for spot-check}

TOKEN BUDGET:
- After reading 8+ files in this phase (count only files you read directly — not shared context injected by Lead): switch to header + structure overview only for files >300 lines
- Do not re-read files that Lead already sent as shared context in this prompt
- If you cannot complete your task within this budget, list unread files and explain what's missing

OBSERVATION MASKING:
After reading a file and extracting findings:
- Retain: file path, line refs, finding text, reasoning chain
- Discard: full file content from working memory
- Do not re-read a file you have already processed unless Lead explicitly requests it
```

## Lead Notes

When constructing worker prompts:

1. Replace all `{placeholders}` with actual values
2. Insert project-specific Hard Rules from `.claude/skills/review-rules/hard-rules.md` (if exists) or use Generic Hard Rules
3. Insert validate command from [phase-gates.md](phase-gates.md) project detection
4. Worker prompts should reference the plan tasks by number for trackability
5. **Copy full task text** into each worker prompt — workers should not need to read the plan independently
6. Commit messages: workers can delegate commit creation to the `commit-finalizer` agent (Haiku) after completing each task. Commit message format: `{type}({scope}): {description}` — e.g. `feat(auth): add JWT refresh token endpoint`, `fix(users): handle null profile on first login`. Types: feat, fix, refactor, test, chore. Saves Sonnet cost on mechanical commit work.
   Before delegating: run `git add` to stage all changed files. Worker teammates have access to the `Agent` tool for this purpose. Pass a short commit message hint as `$ARGUMENTS`.
7. **Lead is sole writer of `dev-loop-context.md`** — when a worker sends completion via SendMessage, lead updates `tasks_completed:` in the context file. This prevents YAML race conditions when parallel workers run concurrently.
