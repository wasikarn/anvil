# video-review-pr skill

PR review skill for tathep-video-processing (TypeScript 5.9 + Bun + Hono + Effect-TS + Drizzle ORM + Vitest + Clean Architecture DDD).
SKILL.md is the agent entry point; references/ provides supporting detail.

## Docs Index

Prefer reading before editing — key references:

| Reference | When to use |
| --- | --- |
| `references/checklist.md` | Adding/updating review criteria for a rule |
| `references/examples.md` | Adding ✅/❌ code examples for a rule |

## Skill Architecture

- `SKILL.md` — agent entry point; defines phase workflow, Hard Rules, and 7-agent dispatch
- `references/checklist.md` — 12-rule criteria with 🔴/🟡/🔵 severity markers; loaded by Phase 3 agents
- `references/examples.md` — ✅/❌ code examples per rule; evidence agents use when flagging issues

## Validate After Changes

```bash
# Lint all markdown in this skill
npx markdownlint-cli2 "skills/video-review-pr/**/*.md"

# Verify skill symlink exists
ls -la ~/.claude/skills/video-review-pr

# Invoke skill (run in tathep-video-processing repo):
# /video-review-pr <pr-number> [jira-key?] [Author|Reviewer]

# Project validate (run in tathep-video-processing repo):
# bun run check && bun run test
```

## Skill System

SKILL.md frontmatter controls how Claude invokes this skill:

- `description:` — Claude matches user intent; prefer trigger-complete descriptions — wrong description = skill never auto-triggers
- `name:` — the slash command name (`/video-review-pr`)
- `disable-model-invocation: true` — manual invocation only (heavy 7-agent dispatch)

## Project Context

- **GitHub repo:** `100-Stars-Co/tathep-video-processing`
- **Jira key format:** `BEP-XXXX`
- **Validate command:** `bun run check && bun run test`
- **Scope:** `git diff develop...HEAD` — changed files only
- **Default branch:** `develop` (NOT `main`)

## Gotchas

- This CLAUDE.md is **tracked in git** — changes here are shared with the team
- **Default branch is `develop`** — PRs target `develop`, not `main`; diff scope is `develop...HEAD`
- **Bun runtime** — `bun run test` (NEVER `bun test`), `import.meta.dir` (not `__dirname`)
- **Biome linter** — replaces ESLint/Prettier; `bun run fix` before commit; `biome-ignore` is forbidden
- **DDD/Hexagonal architecture** — domain layer has zero external dependencies; ports in domain, adapters in infrastructure
- **Effect-TS** — `Effect.gen`, `Layer` for DI, `pipe` for composition; no raw try-catch where Effect fits
- **Drizzle ORM** — type-safe at compile time; no raw SQL
- **3 services** — HTTP server (Hono), Redis consumer (Streams), BullMQ worker; review must consider which service is affected
- **85% coverage threshold** — enforced by Vitest config
- Reviewer comments must be in Thai mixed with English technical terms (casual Slack/PR tone)
- Submit all inline comments + decision in ONE `gh api` call — not one-by-one
- Phase 3 agents are READ-ONLY — code edits only happen in Phase 4 (Author mode)
- Hard Rules in SKILL.md bypass confidence filter — always reported unconditionally; keep criteria precise
