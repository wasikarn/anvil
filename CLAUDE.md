# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

**Plugin name:** `devflow` · **Repo:** `wasikarn/devflow`

A Claude Code plugin — skills, agents, hooks, output styles, and scripts for structured development and PR review workflows. Each skill is a self-contained prompt workflow installed via `claude plugin install devflow`.

## Docs Index

Prefer reading source before editing — key references:

| Reference | Contents |
| --- | --- |
| [`docs/references/skills-best-practices.md`](docs/references/skills-best-practices.md) | Full frontmatter spec, description rules, substitutions (`$0`/`$1`/`!`), context budget |
| [`docs/references/skill-creation-guide.md`](docs/references/skill-creation-guide.md) | 5 golden rules, creation workflow, skill brief template, anti-patterns |
| `skills/<name>/references/checklist.md` | Per-skill review criteria with severity markers (review-pr skills) |
| `skills/<name>/references/examples.md` | Per-skill ✅/❌ code examples for all 12 rules (review-pr skills) |
| [`skills/df-review-conventions/SKILL.md`](skills/df-review-conventions/SKILL.md) | Comment labels, dedup protocol, strengths, PR size thresholds |
| [`skills/df-build/references/review-lenses/`](skills/df-build/references/review-lenses/) | 8 domain lenses injected into reviewers at Phase 6 — `frontend`, `security`, `database`, `performance`, `typescript`, `error-handling`, `api-design`, `observability`. Shared by both `build` and `review`. |

<important if="editing or creating skills">

## Skill Structure

`skills/<name>/SKILL.md` (entry point) · `CLAUDE.md` (contributor context) · `references/` (on-demand docs) · `scripts/` (helpers)

</important>

## Skills in This Repo

| Skill | Purpose |
| --- | --- |
| `df-build` | Full development loop (Research → Plan → Implement → Review → Ship) |
| `df-review` | Adversarial PR review with 3-reviewer debate |
| `df-debug` | Parallel root cause analysis + DX hardening |
| `df-respond` | Address PR review comments as author |
| `df-merge` | Git-flow merge and deploy (feature/hotfix/release modes) |
| `df-refactor` | Safe refactoring — runs tests before/after; modes: `--simplify`, `--extract`, `--restructure` |
| `df-tests` | Framework-aware test generation (vitest/jest/bun/japa); self-reviews via test-quality-reviewer |
| `df-docs` | API, README, and inline JSDoc/TSDoc documentation generation |
| `df-audit` | Security + dependency audit; `--deps`, `--security`, `--all` |
| `df-metrics` | Retrospective report from devflow-metrics.jsonl — iteration counts, finding categories, Hard Rule candidates |
| `df-dashboard` | Terminal-friendly metrics summary from all devflow tracking files; anomaly alerts |
| `df-status` | Show active Devflow session artifacts and current phase |
| `df-onboard` | Bootstrap a new project into the devflow ecosystem — scaffold hard-rules.md and build directories |
| `df-qa` | Run QA check suite to verify all hooks, skills, and plugin structure |
| `df-setup` | Post-install setup — installs devflow-engine dependencies and runs smoke test |
| `df-optimize` | Audit and optimize CLAUDE.md files |
| `df-analyze` | Audit project against official Claude Code features and score adoption coverage |
| `df-promote` | Review auto-detected Hard Rule candidates and approve/reject/defer each one |
| `df-systems` | Causal Loop Diagram analysis for architecture decisions |
| `df-env-heal` | Scan and fix environment variable mismatches |
| `df-careful` | Enter careful mode — elevated confirmation threshold for destructive operations |
| `df-freeze` | Freeze a file or pattern from being edited for the session |
| `df-test-patterns` | Test quality patterns for frontend and backend testing |
| `df-review-rules` | _(background)_ 12-point review framework — preloaded into reviewer agents |
| `df-review-conventions` | _(background)_ Comment labels, dedup protocol, PR size thresholds — preloaded into reviewer agents |
| `df-review-output` | _(background)_ PR review output format templates — preloaded into reviewer agents |
| `df-review-examples` | _(background)_ Code pattern examples for all 12 rules — preloaded into reviewer agents |
| `df-debate` | _(background)_ Adversarial debate rules and consensus criteria — preloaded into reviewer agents |
| `df-jira` | _(background)_ Jira detection, fetch, and skill-specific integration — preloaded into jira-summary-poster agent |

## Agents

Custom subagents live at `agents/<name>.md` with YAML frontmatter. Distributed automatically via plugin.

Key fields: `description` (include "proactively" to auto-trigger), `memory` (`user`/`project`/`local` for cross-session persistence), `skills` (preload into agent context). All fields: `name`, `tools`/`disallowedTools`, `model`, `hooks`, `permissionMode`, `maxTurns`, `background`, `isolation`.

> **Plugin limitation:** `hooks`, `mcpServers`, and `permissionMode` are silently ignored when agents are loaded from a plugin. To use these fields, copy the agent to `.claude/agents/` instead.

| Agent | Model | Purpose |
| --- | --- | --- |
| `commit-finalizer` | haiku | Fast git commit with conventional commits format |
| `review-consolidator` | haiku | Dedup/sort multi-reviewer findings into single ranked table |
| `falsification-agent` | sonnet | Challenges review findings before consolidation |
| `plan-challenger` | sonnet | Challenges build Phase 3 plan for YAGNI/scope/ordering issues |
| `test-quality-reviewer` | sonnet | Test quality reviewer (T1–T9): behavior, mock fidelity, edge cases |
| `silent-failure-hunter` | sonnet | Hunts for silent failures — swallowed exceptions, empty catch blocks |
| `code-reviewer` | sonnet | General-purpose code reviewer with cross-session persistent memory |
| `type-design-analyzer` | sonnet | TypeScript type design quality — 4 dimensions rated 1-10 |

> Full agent list: see [agents/](agents/) — 27 agents total.

<important if="editing or adding hooks">

## Hooks

Hooks live at `hooks/`. All hooks are registered in `hooks/hooks.json` and distributed automatically when the plugin is installed — no manual configuration required.

| Event | Matcher | Script |
| --- | --- | --- |
| `SessionStart` | `startup` | `check-deps.sh`, `session-start-context.sh` |
| `PreToolUse` | `Edit\|Write` | `protect-files.sh` |
| `PreToolUse` | `Bash` | `safe-command-approver.sh` |
| `PostToolUseFailure` | `Bash` | `bash-failure-hint.sh` |
| `PostToolUseFailure` | `Edit\|Write` | `edit-write-failure-hint.sh` |
| `TaskCompleted` | `review-debate` | `task-gate.sh` |
| `TaskCompleted` | `devflow` | `task-gate.sh` |
| `TaskCompleted` | `respond` | `task-gate.sh` |
| `SubagentStart` | reviewer agents | `subagent-start-context.sh` |
| `PreCompact` | — | `pre-compact-save.sh` |
| `PostCompact` | — | `post-compact-context.sh` |
| `TeammateIdle` | `review-pr` | `idle-nudge.sh` |
| `TeammateIdle` | `devflow` | `idle-nudge.sh` |
| `TeammateIdle` | `respond` | `idle-nudge.sh` |
| `TeammateIdle` | `debug-` | `idle-nudge.sh` |

> Full hook list: see [hooks/hooks.json](hooks/hooks.json) — 16 hooks total.

</important>

## Output Styles

Custom output styles at `output-styles/<name>.md` with frontmatter (`name`, `description`, `keep-coding-instructions`). Replace default coding instructions unless `keep-coding-instructions: true`.

| Style | Description |
| --- | --- |
| `senior-software-engineer` | Thai, pragmatic senior engineer tone with trade-off focus |
| `senior-software-engineer-en` | English version of above |
| `coding-mentor` | Thai, teaches through doing — adds "Why" explanations |
| `coding-mentor-en` | English version of above |

## Plugin

Plugin manifest at `.claude-plugin/plugin.json`. Install:

```bash
claude plugin install devflow
claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
```

<important if="adding a new skill">

## Adding a New Skill

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full step-by-step guide. Key rules for Claude when editing:

- `description:` must be trigger-complete (what + when + keywords) — max 1024 chars
- `compatibility:` recommended for skills with external tool dependencies (not required, but contributors need to know what to install)
- Pre-commit hook auto-fixes staged `.md` files — no manual lint needed before commit

</important>

## Skill Comparison & Agent Teams Constraints

| Aspect | review | build | debug-parallel | respond |
| --- | --- | --- | --- | --- |
| Scope | PR review + debate | Full dev loop | Debug + DX harden | PR comment response |
| Execution | 3 teammates (debate) | Dynamic roster per phase | Investigator + DX + Fixer | 1 Fixer per file group |
| Loop | None | Implement-Review (max 3 iter) | Fix-only (max 3 attempts) | Fix-only (max 3 per thread) |

All four require `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (degrades gracefully). One team per session; team cleanup by lead; Hard Rules cannot be dropped via debate.

## devflow-engine

TypeScript SDK at `devflow-engine/` — programmatic PR review pipeline (orchestrator, triage, consolidator, falsifier, CLI). `private: true`; not published to npm. Uses `bun test` (built-in).

**Resilience (v1.8.1):** `runClaudeSubprocess` retries transient API errors (rate_limit_exceeded, server_error, overloaded_error) up to 3× with exponential backoff (1s/2s). Returns `budgetExceeded: true` signal instead of throwing — caller can skip re-run. Override delay via `DEVFLOW_RETRY_DELAY_MS=0` in tests.

| Task | Command |
| --- | --- |
| Run SDK tests | `cd devflow-engine && bun test` |
| Watch tests | `cd devflow-engine && bun test --watch` |
| Run CLI review | `cd devflow-engine && bun run review -- --pr <number>` |

## Repo Commands

| Task | Command |
| --- | --- |
| Lint all markdown | `npx markdownlint-cli2 "**/*.md"` |
| Validate plugin | `claude plugin validate` (checks plugin.json, frontmatter, hooks.json) |
| Run full QA | `bash scripts/qa-check.sh` (13 gates: shellcheck, markdownlint, bats, plugin validate) |
| Bump version | `bash scripts/bump-version.sh <patch\|minor\|major>` (runs QA gates before release) |

**Contributor dev mode only** (do not use if plugin is installed — will conflict):

| Task | Command |
| --- | --- |
| Link one skill | `bash scripts/link-assets.sh <name>` |
| Link everything | `bash scripts/link-assets.sh` (skills, agents, hooks, output-styles) |
| Check link status | `bash scripts/link-assets.sh --list` |

<important if="editing this repo">

## Gotchas

- `context: fork` + `agent` field runs skills in isolated subagent — used by `env-heal` (haiku, general-purpose). Other skills avoid it for real-time streaming visibility and follow-up interaction
- Pre-commit hook auto-fixes staged `.md` files — runs `scripts/fix-tables.sh` + `markdownlint-cli2 --fix`; no manual fix needed before commit
- `user-invocable: false` hides from `/` menu but keeps description in context — Claude can still auto-trigger these skills
- Run `/optimize-claude-md` when this file feels stale
</important>
