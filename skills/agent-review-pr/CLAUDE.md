# agent-review-pr skill

PR review skill for tathep-ai-agent-python (Python 3.12 + FastAPI + LangGraph + SQLAlchemy QB + mypy strict).
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
npx markdownlint-cli2 "skills/agent-review-pr/**/*.md"

# Verify skill symlink exists
ls -la ~/.claude/skills/agent-review-pr

# Invoke skill (run in tathep-ai-agent-python repo):
# /agent-review-pr <pr-number> [jira-key?] [Author|Reviewer]

# Project validate (run in tathep-ai-agent-python repo):
# uv run black --check . && uv run mypy .
```

## Skill System

SKILL.md frontmatter controls how Claude invokes this skill:

- `description:` — Claude matches user intent; prefer trigger-complete descriptions — wrong description = skill never auto-triggers
- `name:` — the slash command name (`/agent-review-pr`)
- `disable-model-invocation: true` — manual invocation only (heavy 7-agent dispatch)

## Project Context

- **GitHub repo:** `100-Stars-Co/tathep-ai-agent-python`
- **Jira key format:** `BEP-XXXX`
- **Validate command:** `uv run black --check . && uv run mypy .`
- **Reference modules:** `modules/conversation/` (CQRS + repository pattern), `shared/libs/invoke_with_fallback.py` (LLM resilience)
- **Scope:** `git diff develop...HEAD` — changed files only

## Gotchas

- This CLAUDE.md is **tracked in git** — changes here are shared with the team
- **Python project** — all code patterns, type hints, and tooling are Python-specific (not TypeScript)
- **mypy strict mode** — `disallow_untyped_defs=True`, `no_implicit_optional=True`; missing type hints = build failure
- **Black formatting** — 88-char line width, enforced; `uv run black --check .` must pass
- **LangGraph patterns** — agents use `StateGraph`, `Command`, `Send()` for orchestration
- **LLM calls require fallback** — production agents must use `invoke_with_fallback()`, not raw `model.invoke()`
- Reviewer comments must be in Thai mixed with English technical terms (casual Slack/PR tone)
- Submit all inline comments + decision in ONE `gh api` call — not one-by-one
- Phase 3 agents are READ-ONLY — code edits only happen in Phase 4 (Author mode)
- Hard Rules in SKILL.md bypass confidence filter — always reported unconditionally; keep criteria precise
