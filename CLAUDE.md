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
| [`skills/review-conventions/SKILL.md`](skills/review-conventions/SKILL.md) | Comment labels, dedup protocol, strengths, PR size thresholds |
| [`skills/build/references/review-lenses/`](skills/build/references/review-lenses/) | 8 domain lenses injected into reviewers at Phase 6 — `frontend`, `security`, `database`, `performance`, `typescript`, `error-handling`, `api-design`, `observability`. Shared by both `build` and `review`. |

<important if="editing or creating skills">

## Skill Structure

`skills/<name>/SKILL.md` (entry point) · `CLAUDE.md` (contributor context) · `references/` (on-demand docs) · `scripts/` (helpers)

</important>

## Skills in This Repo

| Skill | Purpose |
| --- | --- |
| `optimize-claude-md` | Audit and optimize CLAUDE.md files |
| `env-heal` | Scan and fix environment variable mismatches |
| `merge-pr` | Git-flow merge and deploy (feature/hotfix/release modes) |
| `build` | Full development loop (Research → Plan → Implement → Review → Ship) |
| `review` | Adversarial PR review with 3-reviewer debate |
| `debug` | Parallel root cause analysis + DX hardening |
| `metrics` | Run retrospective report from devflow-metrics.jsonl — iteration counts, finding categories, recurrent issues |
| `onboard` | Bootstrap a new project into the devflow ecosystem — scaffold hard-rules.md and build directories |
| `respond` | Address PR review comments as author |
| `systems-thinking` | Causal Loop Diagram analysis for architecture decisions |
| `careful` | Enter careful mode — elevated confirmation threshold for destructive operations |
| `freeze` | Freeze a file or pattern from being edited for the session |
| `status` | Show active Devflow session artifacts and current phase |
| `plugin-qa` | Run QA check suite to verify all hooks, skills, and plugin structure |
| `analyze-claude-features` | Audit project against official Claude Code features and score adoption coverage |
| `promote-hard-rule` | Review auto-detected Hard Rule candidates (from metrics-analyst) and approve/reject/defer each one — never auto-applies |
| `review-rules` | _(background)_ 12-point review framework — preloaded into reviewer agents |
| `review-conventions` | _(background)_ Comment labels, dedup protocol, PR size thresholds — preloaded into reviewer agents |
| `review-output-format` | _(background)_ PR review output format templates — preloaded into reviewer agents |
| `review-examples` | _(background)_ Code pattern examples for all 12 rules — preloaded into reviewer agents |
| `debate-protocol` | _(background)_ Adversarial debate rules and consensus criteria — preloaded into reviewer agents |
| `jira-integration` | _(background)_ Jira detection, fetch, and skill-specific integration — preloaded into jira-summary-poster agent |

## Agents

Custom subagents live at `agents/<name>.md` with YAML frontmatter. Distributed automatically via plugin.

Key fields: `description` (include "proactively" to auto-trigger), `memory` (`user`/`project`/`local` for cross-session persistence), `skills` (preload into agent context). All fields: `name`, `tools`/`disallowedTools`, `model`, `hooks`, `permissionMode`, `maxTurns`, `background`, `isolation`.

> **Plugin limitation:** `hooks`, `mcpServers`, and `permissionMode` are silently ignored when agents are loaded from a plugin. To use these fields, copy the agent to `.claude/agents/` instead.

Current agents (24):

| Agent | Model | Purpose |
| --- | --- | --- |
| `commit-finalizer` | haiku | Fast git commit with conventional commits format |
| `devflow-build-bootstrap` | haiku | Pre-gather Phase 2 context before build explorer spawns |
| `build-research-summarizer` | haiku | Compress research.md to JSON summary after Phase 2 gate — eliminates re-reads at later phases |
| `devflow-debug-bootstrap` | haiku | Pre-gather debug context before debug Investigator spawns |
| `devflow-respond-bootstrap` | haiku | Pre-gather open PR threads + affected files before respond Fixers spawn |
| `pr-review-bootstrap` | haiku | Fetch PR diff + Jira AC in one pass before review |
| `review-consolidator` | haiku | Dedup/sort multi-reviewer findings into single ranked table |
| `research-validator` | haiku | Validate research.md completeness (file:line evidence gate) before Phase 2→3 |
| `fix-intent-verifier` | haiku | Verify each respond fix addresses reviewer intent (ADDRESSED/PARTIAL/MISALIGNED) |
| `jira-summary-poster` | haiku | Post structured implementation summary to Jira after build/debug completes |
| `work-context` | haiku | Session start digest: active sprint tickets + PRs awaiting action + unmerged branches |
| `merge-preflight` | haiku | Pre-merge go/no-go safety checklist before merge-pr Confirmation Gate |
| `metrics-analyst` | haiku | Retrospective from devflow-metrics.jsonl: iteration patterns, recurring findings, Hard Rule candidates |
| `falsification-agent` | sonnet | Challenges review findings before consolidation — outputs SUSTAINED/DOWNGRADED/REJECTED per finding |
| `plan-challenger` | sonnet | Challenges build Phase 3 plan for YAGNI/scope/ordering issues before implementation |
| `test-quality-reviewer` | sonnet | Dedicated test quality reviewer (T1–T9): behavior vs implementation, mock fidelity, edge cases, assertion presence (Hard Rule), boundary operators, stale contracts, test isolation |
| `code-explorer` | sonnet | Trace feature execution paths: entry points → data layer, map abstraction layers, identify extension points — read-only, explicit trigger only |
| `comment-analyzer` | sonnet | Verify comment accuracy against code, detect stale references and comment rot — explicit trigger; build lead may optionally spawn after Phase 4 |
| `code-simplifier` | sonnet | Post-review polish: flatten nesting, remove redundant comments, improve naming — no behavior changes; triggered optionally in build Phase 7 (optional) or standalone |
| `migration-reviewer` | sonnet | Reviews DB migration files (M1–M10): DDL safety, reversibility, FK indexes, table-lock risk, zero-downtime violations, expand/contract, data batching, index types, deadlock risk |
| `api-contract-auditor` | sonnet | Detects API breaking changes (A1–A10): removed/renamed fields, changed status codes, new required params, type narrowing, enum reordering, idempotency, pagination, error envelopes, deprecation |
| `skill-validator` | sonnet | Validates SKILL.md against best practices |
| `project-onboarder` | sonnet | Bootstrap a new project into devflow: scaffold hard-rules.md + build directory |
| `code-reviewer` | sonnet | General-purpose code reviewer with cross-session persistent memory |

<important if="editing or adding hooks">

## Hooks

Hooks live at `hooks/`. All hooks are registered in `hooks/hooks.json` and distributed automatically when the plugin is installed — no manual configuration required.

| Event | Matcher | Script |
| --- | --- | --- |
| `SessionStart` | `startup` | `check-deps.sh`, `session-start-context.sh`, `cleanup-artifacts.sh` (async) |
| `UserPromptSubmit` | — | `skill-routing.sh` |
| `PreToolUse` | `Edit\|Write` | `protect-files.sh` |
| `PreToolUse` | `Skill` | `skill-usage-tracker.sh` |
| `PreToolUse` | `Bash` | `safe-command-approver.sh` |
| `PostToolUse` | `Edit\|Write` | _(inline markdownlint)_ |
| `PostToolUse` | `Write` | `shellcheck-written-scripts.sh` |
| `TaskCompleted` | `review-debate\|devflow\|respond` | `task-gate.sh` |
| `TeammateIdle` | `review-pr\|devflow\|respond\|debug-` | `idle-nudge.sh` |
| `PostCompact` | — | `post-compact-context.sh` |
| `PreCompact` | — | `pre-compact-save.sh` |
| `PostToolUseFailure` | `Bash` | `bash-failure-hint.sh` |
| `StopFailure` | `rate_limit\|...` | `stop-failure-log.sh` |
| `SubagentStop` | reviewer agent names | `subagent-stop-gate.sh` |
| `SubagentStart` | reviewer agent names | `subagent-start-context.sh` |
| `SessionEnd` | — | `session-end-cleanup.sh` (async) |

Notes: `task-gate.sh`/`idle-nudge.sh` use `GATE_PATTERN`/`NUDGE_PATTERN` env vars. `stop-failure-log.sh`: file logging via `LOG=1`, macOS notify via `NOTIFY=1`. Markdownlint + shellcheck hooks degrade gracefully if tools missing.

</important>

## Output Styles

Custom output styles live at `output-styles/<name>.md` with frontmatter (`name`, `description`, `keep-coding-instructions`). Distributed automatically via plugin.

Output styles replace the default system prompt's coding instructions unless `keep-coding-instructions: true`. Use for consistent formatting/tone across sessions.

Current styles: `senior-software-engineer` (Thai language, pragmatic senior engineer tone with trade-off focus), `coding-mentor` (Thai language, teaches through doing — adds "Why" explanations after significant changes, good for onboarding)

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

| Aspect | review | build | debug | respond |
| --- | --- | --- | --- | --- |
| Scope | PR review + debate | Full dev loop | Debug + DX harden | PR comment response |
| Execution | 3 teammates (debate) | Dynamic roster per phase | Investigator + DX + Fixer | 1 Fixer per file group |
| Loop | None | Implement-Review (max 3 iter) | Fix-only (max 3 attempts) | Fix-only (max 3 per thread) |

All four require `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (degrades gracefully). One team per session; team cleanup by lead; Hard Rules cannot be dropped via debate.

## devflow-sdk

TypeScript SDK at `devflow-sdk/` — programmatic PR review pipeline (orchestrator, triage, consolidator, falsifier, CLI). `private: true`; not published to npm. Uses `vitest` for tests.

| Task | Command |
| --- | --- |
| Run SDK tests | `cd devflow-sdk && npm test` |
| Watch tests | `cd devflow-sdk && npm run test:watch` |
| Run CLI review | `cd devflow-sdk && npm run review -- --pr <number>` |

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
