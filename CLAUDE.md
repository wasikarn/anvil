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
| `pr-review-bootstrap` | haiku | Fetch PR diff + Jira AC in one pass before review |
| `review-consolidator` | haiku | Dedup/sort multi-reviewer findings into single ranked table |
| `skill-validator` | sonnet | Validates SKILL.md against best practices |
| `code-reviewer` | sonnet | General-purpose code reviewer with cross-session persistent memory |

## Hooks

Hooks live at `hooks/`. Two sources of truth:

### Plugin hooks (`hooks/hooks.json`) — distributed automatically with the plugin

| Event | Matcher | Script |
| --- | --- | --- |
| `SessionStart` | `startup` | `check-deps.sh`, `session-start-context.sh` |
| `UserPromptSubmit` | — | `skill-routing.sh` |
| `PreToolUse` | `Edit\|Write` | `protect-files.sh` |
| `PostToolUse` | `Edit\|Write` | _(inline markdownlint)_ |
| `PostToolUse` | `Write` | `shellcheck-written-scripts.sh` |
| `TaskCompleted` | `review-debate\|dev-loop\|respond` | `task-gate.sh` |
| `TeammateIdle` | `review-pr\|dev-loop\|respond\|debug-` | `idle-nudge.sh` |
| `PostCompact` | — | `post-compact-context.sh` |
| `PostToolUseFailure` | `Bash` | `bash-failure-hint.sh` |
| `StopFailure` | `rate_limit\|...` | `stop-failure-log.sh` |
| `SubagentStop` | reviewer agent names | `subagent-stop-gate.sh` |

`task-gate.sh` and `idle-nudge.sh` use `GATE_PATTERN`/`NUDGE_PATTERN` env vars for filtering. `TaskCompleted`/`TeammateIdle` matchers may be unsupported — scripts self-filter as fallback.

### Project hooks (`.claude/settings.json`) — active only in this repo

These are already configured in `.claude/settings.json` (checked into the repo). They duplicate the plugin hooks above so contributors working via symlinks get the same behavior without having the plugin installed.

### Personal hooks (not distributed with plugin)

The following scripts exist in `hooks/` but are **not registered in `hooks.json`**. They are configured in the author's global `~/.claude/settings.json` for personal use and should NOT be added to the plugin manifest:

`play-sound.sh`, `qmd-pre-search.sh`, `bash-blockers.sh`, `auto-test-env.sh`, `patch-plugin-skills.sh`, `session-start-mcp-cleanup.sh`, `session-summary-hook.sh`, `session-end.sh`, `subagent-start-context.sh`, `permission-auto-approve.sh`, `instructions-loaded-log.sh`

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
- `compatibility:` recommended for skills with external tool dependencies (not required, but contributors need to know what to install)
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

- `context: fork` + `agent` field runs skills in isolated subagent — used by `env-heal` (haiku, general-purpose). Other skills avoid it for real-time streaming visibility and follow-up interaction
- Pre-commit hook auto-fixes staged `.md` files — runs `scripts/fix-tables.sh` + `markdownlint-cli2 --fix`; no manual fix needed before commit
- `disable-model-invocation: true` removes description from context entirely (skill never auto-triggers); `user-invocable: false` hides from menu but keeps context — different effects
- Run `/optimize-context` when this file feels stale
