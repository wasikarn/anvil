# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

**Plugin name:** `dev-loop` · **Repo:** `wasikarn/dev-loop`

A Claude Code plugin — skills, agents, hooks, output styles, and scripts for structured development and PR review workflows. Each skill is a self-contained prompt workflow installed via `claude plugin install dev-loop`.

## Docs Index

Prefer reading source before editing — key references:

| Reference | Contents |
| --- | --- |
| [`references/skills-best-practices.md`](references/skills-best-practices.md) | Full frontmatter spec, description rules, substitutions (`$0`/`$1`/`!`), context budget |
| [`references/skill-creation-guide.md`](references/skill-creation-guide.md) | 5 golden rules, creation workflow, skill brief template, anti-patterns |
| `skills/<name>/references/checklist.md` | Per-skill review criteria with severity markers (review-pr skills) |
| `skills/<name>/references/examples.md` | Per-skill ✅/❌ code examples for all 12 rules (review-pr skills) |
| [`references/review-conventions.md`](references/review-conventions.md) | Comment labels, dedup protocol, strengths, PR size thresholds |

<important if="editing or creating skills">

## Skill Structure

Each skill lives at `skills/<skill-name>/` with this layout:

```text
skills/<name>/
  SKILL.md          # Agent entry point — required; loaded when skill is invoked
  CLAUDE.md         # Contributor context — read by Claude when editing this repo
  references/       # Supporting docs loaded into agent context from SKILL.md
  scripts/          # Helper scripts referenced from SKILL.md or CLAUDE.md
```

</important>

## Skills in This Repo

| Skill | Purpose |
| --- | --- |
| `optimize-context` | Audit and optimize CLAUDE.md files |
| `env-heal` | Scan and fix environment variable mismatches |
| `merge-pr` | Git-flow merge and deploy (feature/hotfix/release modes) |
| `dlc-build` | Full development loop (Research → Plan → Implement → Review → Ship) |
| `dlc-review` | Adversarial PR review with 3-reviewer debate |
| `dlc-debug` | Parallel root cause analysis + DX hardening |
| `dlc-metrics` | Run retrospective report from dlc-metrics.jsonl — iteration counts, finding categories, recurrent issues |
| `dlc-onboard` | Bootstrap a new project into the dev-loop ecosystem — scaffold hard-rules.md and dlc-build directories |
| `dlc-respond` | Address PR review comments as author |
| `systems-thinking` | Causal Loop Diagram analysis for architecture decisions |

Commands live at `commands/<name>.md`. Current: `analyze-claude-features`.

## Agents

Custom subagents live at `agents/<name>.md` with YAML frontmatter. Distributed automatically via plugin.

Key fields: `description` (include "proactively" to auto-trigger), `memory` (`user`/`project`/`local` for cross-session persistence), `skills` (preload into agent context). All fields: `name`, `tools`/`disallowedTools`, `model`, `hooks`, `permissionMode`, `maxTurns`, `background`, `isolation`.

> **Plugin limitation:** `hooks`, `mcpServers`, and `permissionMode` are silently ignored when agents are loaded from a plugin. To use these fields, copy the agent to `.claude/agents/` instead.

Current agents (20):

| Agent | Model | Purpose |
| --- | --- | --- |
| `commit-finalizer` | haiku | Fast git commit with conventional commits format |
| `dev-loop-bootstrap` | haiku | Pre-gather Phase 1 context before dlc-build explorer spawns |
| `dlc-debug-bootstrap` | haiku | Pre-gather debug context before dlc-debug Investigator spawns |
| `dlc-respond-bootstrap` | haiku | Pre-gather open PR threads + affected files before dlc-respond Fixers spawn |
| `pr-review-bootstrap` | haiku | Fetch PR diff + Jira AC in one pass before review |
| `review-consolidator` | haiku | Dedup/sort multi-reviewer findings into single ranked table |
| `research-validator` | haiku | Validate research.md completeness (file:line evidence gate) before Phase 1→2 |
| `fix-intent-verifier` | haiku | Verify each dlc-respond fix addresses reviewer intent (ADDRESSED/PARTIAL/MISALIGNED) |
| `jira-sync` | haiku | Post structured implementation summary to Jira after dlc-build/dlc-debug completes |
| `work-context` | haiku | Session start digest: active sprint tickets + PRs awaiting action + unmerged branches |
| `merge-preflight` | haiku | Pre-merge go/no-go safety checklist before merge-pr Confirmation Gate |
| `metrics-analyst` | haiku | Retrospective from dlc-metrics.jsonl: iteration patterns, recurring findings, Hard Rule candidates |
| `falsification-agent` | sonnet | Challenges review findings before consolidation — outputs SUSTAINED/DOWNGRADED/REJECTED per finding |
| `plan-challenger` | sonnet | Challenges dlc-build Phase 2 plan for YAGNI/scope/ordering issues before implementation |
| `test-quality-reviewer` | sonnet | Dedicated test quality reviewer (T1–T9): behavior vs implementation, mock fidelity, edge cases, assertion presence (Hard Rule), boundary operators, stale contracts, test isolation |
| `migration-reviewer` | sonnet | Reviews DB migration files (M1–M10): DDL safety, reversibility, FK indexes, table-lock risk, zero-downtime violations, expand/contract, data batching, index types, deadlock risk |
| `api-contract-auditor` | sonnet | Detects API breaking changes (A1–A10): removed/renamed fields, changed status codes, new required params, type narrowing, enum reordering, idempotency, pagination, error envelopes, deprecation |
| `skill-validator` | sonnet | Validates SKILL.md against best practices |
| `project-onboarder` | sonnet | Bootstrap a new project into dev-loop: scaffold hard-rules.md + dlc-build directory |
| `code-reviewer` | sonnet | General-purpose code reviewer with cross-session persistent memory |

<important if="editing or adding hooks">

## Hooks

Hooks live at `hooks/`. All hooks are registered in `hooks/hooks.json` and distributed automatically when the plugin is installed — no manual configuration required.

| Event | Matcher | Script |
| --- | --- | --- |
| `SessionStart` | `startup` | `check-deps.sh`, `session-start-context.sh`, `cleanup-artifacts.sh` (async) |
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

Notes:

- `task-gate.sh` and `idle-nudge.sh` use `GATE_PATTERN`/`NUDGE_PATTERN` env vars for filtering. `TaskCompleted`/`TeammateIdle` matchers may be unsupported — scripts self-filter as fallback.
- `stop-failure-log.sh` — file logging is opt-in via `LOG=1` env var; macOS notification via `NOTIFY=1`
- `shellcheck-written-scripts.sh` and the inline markdownlint hook both degrade gracefully — they `exit 0` silently if `shellcheck`/`markdownlint-cli2` are not installed. No noise for end-users who skip these optional tools.

</important>

## Output Styles

Custom output styles live at `output-styles/<name>.md` with frontmatter (`name`, `description`, `keep-coding-instructions`). Distributed automatically via plugin.

Output styles replace the default system prompt's coding instructions unless `keep-coding-instructions: true`. Use for consistent formatting/tone across sessions.

Current styles: `senior-software-engineer` (Thai language, pragmatic senior engineer tone with trade-off focus), `coding-mentor` (Thai language, teaches through doing — adds "Why" explanations after significant changes, good for onboarding)

## Plugin

Plugin manifest at `.claude-plugin/plugin.json`. Install:

```bash
claude plugin install dev-loop
claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
```

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is required for all DLC skills (dlc-build, dlc-review, dlc-respond, dlc-debug) to spawn Agent Teams.

<important if="adding a new skill">

## Adding a New Skill

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full step-by-step guide. Key rules for Claude when editing:

- `description:` must be trigger-complete (what + when + keywords) — max 1024 chars
- `disable-model-invocation: true` for side-effect skills (deploy, PR review, merge)
- `compatibility:` recommended for skills with external tool dependencies (not required, but contributors need to know what to install)
- Pre-commit hook auto-fixes staged `.md` files — no manual lint needed before commit

</important>

## Repo Commands

| Task | Command |
| --- | --- |
| Lint all markdown | `npx markdownlint-cli2 "**/*.md"` |
| Validate plugin | `claude plugin validate` (checks plugin.json, frontmatter, hooks.json) |

**Contributor dev mode only** (do not use if plugin is installed — will conflict):

| Task | Command |
| --- | --- |
| Link one skill | `bash scripts/link-skill.sh <name>` |
| Link everything | `bash scripts/link-skill.sh` (skills, agents, hooks, output-styles) |
| Check link status | `bash scripts/link-skill.sh --list` |

<important if="editing this repo">

## Gotchas

- `context: fork` + `agent` field runs skills in isolated subagent — used by `env-heal` (haiku, general-purpose). Other skills avoid it for real-time streaming visibility and follow-up interaction
- Pre-commit hook auto-fixes staged `.md` files — runs `scripts/fix-tables.sh` + `markdownlint-cli2 --fix`; no manual fix needed before commit
- `disable-model-invocation: true` removes description from context entirely (skill never auto-triggers); `user-invocable: false` hides from menu but keeps context — different effects
- Run `/optimize-context` when this file feels stale

</important>
