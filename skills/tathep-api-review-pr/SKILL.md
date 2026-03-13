---
name: tathep-api-review-pr
description: "PR review skill for tathep-platform-api (AdonisJS 5.9 + Effect-TS + Clean Architecture + Japa tests). Dispatches 7 parallel specialized agents, verifies Jira AC, then fixes issues (Author) or submits inline comments (Reviewer). Triggers: review PR, check PR, code review, /tathep-api-review-pr."
argument-hint: "[pr-number] [jira-key?] [Author|Reviewer]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(gh *), Bash(git *)
compatibility: "Requires gh CLI and git. Run from within the tathep-platform-api repo."
---

# PR Review — tathep-platform-api

Invoke as `/tathep-api-review-pr [pr-number] [jira-key?] [Author|Reviewer]`

**PR:** #$0 | **Jira:** $1 | **Mode:** $2 (default: Author)
**Today:** !`date +%Y-%m-%d`
**PR context:** !`bash "${CLAUDE_SKILL_DIR}/../../scripts/pr-context.sh" $0 develop 2>/dev/null`

**Args:** `$0`=PR# (required) · `$1`=Jira key or Author/Reviewer · `$2`=Author/Reviewer
**Role:** Tech Lead — improve code health via architecture, mentoring, team standards. Not a linter. Explain *why*, cite patterns, respect valid approaches.

Read CLAUDE.md first — auto-loaded, contains full project patterns and conventions.

## Project Config

| Key | Value |
| --- | --- |
| GitHub repo | `100-Stars-Co/bd-eye-platform-api` |
| Validate | `npm run validate:all` |
| Scope | `git diff develop...HEAD` |
| Reference modules | `Questionnaire/` (simple), `Sms/` (gold standard) |

## References

| File | Content |
| --- | --- |
| [review-workflow.md](../../references/review-workflow.md) | Shared phase workflow — follow this |
| [checklist.md](references/checklist.md) | 12-point review criteria |
| [examples.md](references/examples.md) | Project-specific code examples |
| [review-output-format.md](../../references/review-output-format.md) | Output format |
| [review-conventions.md](../../references/review-conventions.md) | Comment labels, dedup, strengths |

## Hard Rules

Flag unconditionally — no confidence filter, always report:

- `as any` / `as unknown as T` → Critical (destroys type safety — runtime errors slip past the compiler)
- `throw new Error(...)` → Critical (use `XxxException.staticMethod()` — bypasses Effect-TS error channel; caller can't handle typed errors)
- `new MyService()` inside UseCase/Controller → Critical (use `@inject` — breaks DI container; service can't be swapped or mocked)
- empty `catch {}` / swallowed errors → Critical (silent failures hide production bugs — errors vanish with no trace)
- nesting > 2 levels (try/catch = level 0) → Critical (see `.claude/rules/conditional-logic.md` — use guard clauses, extract function, or lookup table)
- `.innerJoin()` → Critical (use `whereHas`/subquery — inner joins break Lucid ORM lazy-load conventions)
- query inside loop → Critical (N+1 — exponential DB load; preload or batch instead)
- `console.log` → Critical (use `Logger` from `App/Helpers/Logger` — console logs vanish in production, no structured context)
- bare string DI paths `'App/Services/X'` → Critical (use `InjectPaths` constant — breaks silently on rename, no type checking)
- unbounded `.all()` or raw query without `.limit()` or pagination on large-data tables → Warning (OOM/timeout risk at scale — use `.paginate()`, keyset, or explicit `.limit()`)

`feature-dev:code-reviewer` applies TypeScript advanced type principles (generics, branded types, discriminated unions, type guards — NO `as any`) and Clean Code principles (SRP, early returns, naming intent, function size).

## SQL Performance

When the PR diff includes `*Repository*`, `*Migration*`, or raw SQL files, dispatch a sql-optimization agent in Phase 3 alongside the other agents:

> Invoke `/sql-optimization` with the changed query code.
> Focus: index coverage on WHERE/ORDER BY/JOIN columns, unbounded queries, batch ops vs loop writes, pagination pattern (keyset vs OFFSET for large tables).
> Output findings in `[#3 Query Performance] file:line — issue → fix` format and report to lead.

## Project Constraints

- Flag changed files with missing tests (Critical)

## Reviewer Examples

**Comment style:** Thai mixed with English technical terms — casual Slack/PR tone.
Examples: "inject ผ่าน @inject แทน new ได้เลยครับ", "logic พวกนี้ควรอยู่ใน UseCase นะ ไม่ใช่ Controller", "ตรงนี้ silent catch อยู่ ควร surface error ขึ้นมาด้วยครับ"

**Strengths:** "DI ผ่าน @inject ถูกต้อง", "Effect pipe composition สะอาดดี", "test isolation ด้วย beginGlobalTransaction ครบ"

---

**Read [review-workflow.md](../../references/review-workflow.md) and follow the phase workflow.** Use the Project Config, Hard Rules, and References above as inputs.
