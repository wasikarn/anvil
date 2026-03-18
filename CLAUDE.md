# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

**Plugin name:** `claude-code-skills` · **Repo:** `wasikarn/claude-code-skills`

A Claude Code plugin — skills, agents, hooks, output styles, and scripts for structured development and PR review workflows. Each skill is a self-contained prompt workflow installed via `claude plugin install wasikarn/claude-code-skills` or symlinked directly to `~/.claude/`.

## Docs Index

Prefer reading source before editing — key references:

| Reference | Contents |
| --- | --- |
| [`references/skills-best-practices.md`](references/skills-best-practices.md) | Full frontmatter spec, description rules, substitutions (`$0`/`$1`/`!`), context budget |
| [`references/skill-creation-guide.md`](references/skill-creation-guide.md) | 5 golden rules, creation workflow, skill brief template, anti-patterns |
| `skills/<name>/references/checklist.md` | Per-skill review criteria with severity markers (review-pr skills) |
| `skills/<name>/references/examples.md` | Per-skill ✅/❌ code examples for all 12 rules (review-pr skills) |
| [`references/review-conventions.md`](references/review-conventions.md) | Comment labels, dedup protocol, strengths, PR size thresholds |

## Skill Structure

Each skill lives at `skills/<skill-name>/` with this layout:

```text
skills/<name>/
  SKILL.md          # Agent entry point — required; loaded when skill is invoked
  CLAUDE.md         # Contributor context — read by Claude when editing this repo
  references/       # Supporting docs loaded into agent context from SKILL.md
  scripts/          # Helper scripts referenced from SKILL.md or CLAUDE.md
```

### SKILL.md Frontmatter

Required: `name`, `description` (max 1024 chars, cover what + when + triggers). Optional: `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `context`, `agent`, `hooks`, `compatibility`. Substitutions: `$ARGUMENTS`, `$N`, `${CLAUDE_SKILL_DIR}`, `` !`command` ``.

Full spec + examples: [references/skills-best-practices.md](references/skills-best-practices.md)

## Skills in This Repo

| Skill | Purpose |
| --- | --- |
| `optimize-context` | Audit and optimize CLAUDE.md files |
| `env-heal` | Scan and fix environment variable mismatches |
| `merge-pr` | Git-flow merge and deploy (feature/hotfix/release modes) |
| `dlc-build` | Full development loop (Research → Plan → Implement → Review → Ship) |
| `dlc-review` | Adversarial PR review with 3-reviewer debate |
| `dlc-respond` | Address PR review comments as author |
| `dlc-debug` | Parallel root cause analysis + DX hardening |
| `systems-thinking` | Causal Loop Diagram analysis for architecture decisions |

Commands live at `commands/<name>.md` (symlinked to `~/.claude/commands/`). Current: `analyze-claude-features`.

## Agents

Custom subagents live at `agents/<name>.md` with YAML frontmatter. Symlinked to `~/.claude/agents/` via `link-skill.sh`.

Key fields: `description` (include "proactively" to auto-trigger), `memory` (`user`/`project`/`local` for cross-session persistence), `skills` (preload into agent context). All fields: `name`, `tools`/`disallowedTools`, `model`, `hooks`, `permissionMode`, `maxTurns`, `background`, `isolation`.

Current agents (7):

| Agent | Model | Purpose |
| --- | --- | --- |
| `commit-finalizer` | haiku | Fast git commit with conventional commits format |
| `dev-loop-bootstrap` | haiku | Pre-gather Phase 1 context before dlc-build explorer spawns |
| `dlc-debug-bootstrap` | haiku | Pre-gather debug context before dlc-debug Investigator spawns |
| `pr-review-bootstrap` | sonnet | Fetch PR diff + Jira AC in one pass before review |
| `review-consolidator` | haiku | Dedup/sort multi-reviewer findings into single ranked table |
| `skill-validator` | sonnet | Validates SKILL.md against best practices |
| `code-reviewer` | sonnet | General-purpose code reviewer with persistent memory + preloaded skills |

## Hooks

Hooks live at `hooks/`. Two sources of truth:

### Plugin hooks (`hooks/hooks.json`) — distributed automatically with the plugin

| Event | Matcher | Script | What it does |
| --- | --- | --- | --- |
| `SessionStart` | `startup` | `check-deps.sh` | Warn if required tools (`jq`, `gh`, `rtk`) are missing |
| `SessionStart` | `startup` | `session-start-context.sh` | Inject git branch + uncommitted changes into context |
| `UserPromptSubmit` | — | `skill-routing.sh` | Detect keywords, suggest relevant skill before responding |
| `PreToolUse` | `Edit\|Write` | `protect-files.sh` | Block edits to `.claude/settings.json` |
| `PostToolUse` | `Edit\|Write` | _(inline)_ | Auto-lint `.md` files with `markdownlint-cli2 --fix` |
| `PostToolUse` | `Write` | `shellcheck-written-scripts.sh` | Auto-validate `.sh` files Claude writes |
| `TaskCompleted` | `review-debate\|dev-loop\|respond` | `task-gate.sh` | Require file:line evidence before agent tasks complete |
| `TeammateIdle` | `review-pr\|dev-loop\|respond\|debug-` | `idle-nudge.sh` | Nudge idle Agent Teams teammates back on task |

`task-gate.sh` and `idle-nudge.sh` are parameterized via `GATE_PATTERN`/`NUDGE_PATTERN` env vars set in each matcher's command string.

### Project hooks (`.claude/settings.json`) — active only in this repo

These are already configured in `.claude/settings.json` (checked into the repo). They duplicate the plugin hooks above so contributors working via symlinks get the same behavior without having the plugin installed.

### Personal hooks (not distributed with plugin)

The following scripts exist in `hooks/` but are **not registered in `hooks.json`**. They are configured in the author's global `~/.claude/settings.json` for personal use and should NOT be added to the plugin manifest:

| Script | Purpose |
| --- | --- |
| `play-sound.sh` | Play sound effects on hook events (async, no perf impact) |
| `qmd-pre-search.sh` | Inject QMD search results before Grep tool calls |
| `bash-blockers.sh` | Block dangerous bash commands |
| `auto-test-env.sh` | Auto-detect test environment |
| `patch-plugin-skills.sh` | Patch plugin skills after install |
| `post-compact-context.sh` | Inject context after compaction |
| `session-start-mcp-cleanup.sh` | Clean up stale MCP connections on session start |
| `session-summary-hook.sh` | Generate session summary on session end |

## Output Styles

Custom output styles live at `output-styles/<name>.md` with frontmatter (`name`, `description`, `keep-coding-instructions`). Symlinked to `~/.claude/output-styles/` via `link-skill.sh`.

Output styles replace the default system prompt's coding instructions unless `keep-coding-instructions: true`. Use for consistent formatting/tone across sessions.

Current styles: `senior-software-engineer` (Thai language, pragmatic senior engineer tone with trade-off focus), `coding-mentor` (Thai language, teaches through doing — adds "Why" explanations after significant changes, good for onboarding)

## Plugin

Plugin manifest at `.claude-plugin/plugin.json`. Install:

```bash
claude plugin install wasikarn/claude-code-skills
claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
```

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is required for all DLC skills (dlc-build, dlc-review, dlc-respond, dlc-debug) to spawn Agent Teams.

## Adding a New Skill

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full step-by-step guide. Key rules for Claude when editing:

- `description:` must be trigger-complete (what + when + keywords) — max 1024 chars
- `disable-model-invocation: true` for side-effect skills (deploy, PR review, merge)
- `compatibility:` must list all required external tools
- Pre-commit hook auto-fixes staged `.md` files — no manual lint needed before commit

## Repo Commands

| Task | Command |
| --- | --- |
| Lint all markdown | `npx markdownlint-cli2 "**/*.md"` |
| Link one skill | `bash scripts/link-skill.sh <name>` |
| Link everything | `bash scripts/link-skill.sh` (skills, agents, hooks, output-styles) |
| Check all links | `bash scripts/link-skill.sh --list` |
| Sync docs cache | `bash scripts/sync-docs.sh` (fetches Claude Code official docs to `~/.claude/docs/`) |

## Gotchas

- `context: fork` + `agent` field runs skills in isolated subagent — available but not used in this repo (removed for real-time streaming visibility and follow-up interaction)
- Pre-commit hook auto-fixes staged `.md` files — runs `scripts/fix-tables.sh` + `markdownlint-cli2 --fix`; no manual fix needed before commit
- `disable-model-invocation: true` removes description from context entirely (skill never auto-triggers); `user-invocable: false` hides from menu but keeps context — different effects
- Run `/optimize-context` when this file feels stale
