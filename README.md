# claude-code-skills

A Claude Code plugin — 8 workflow skills, 7 custom agents, lifecycle hooks, and 2 output styles for structured development and PR review workflows.

**Plugin name:** `claude-code-skills` · **Repo:** `wasikarn/claude-code-skills`

---

## Quick Start

```bash
# 1. Install prerequisites (macOS)
brew install jq gh rtk && gh auth login

# 2. Install the plugin
claude plugin install wasikarn/claude-code-skills

# 3. Enable Agent Teams (required for DLC skills)
claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
```

Then restart Claude Code. On the next session start, the plugin will warn you if any tools are still missing.

---

## Prerequisites

| Tool | Required | Install |
| --- | --- | --- |
| `jq` | Yes — all workflow hooks | `brew install jq` / `apt install jq` |
| `git` | Yes — all DLC skills | pre-installed on most systems |
| `gh` CLI | Yes — dlc-build, dlc-review, dlc-respond, dlc-debug, merge-pr | `brew install gh` then `gh auth login` |
| `rtk` | Yes — token-optimized output in DLC skills | `brew install rtk` |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Yes — enables Agent Teams for all DLC skills | `claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1` |
| `shellcheck` | Optional — auto-validates shell scripts you write | `brew install shellcheck` |
| `node` / `npx` | Optional — auto-lints markdown files | `brew install node` |

> Hooks degrade gracefully — missing optional tools are skipped silently, not blocked.

---

## Installation

```bash
claude plugin install wasikarn/claude-code-skills
```

Verify:

```bash
claude plugin list
# Expected: claude-code-skills appears in the list
```

Skills are namespaced after plugin install:

```bash
/claude-code-skills:dlc-build
/claude-code-skills:dlc-review
/claude-code-skills:dlc-debug
/claude-code-skills:dlc-respond
/claude-code-skills:merge-pr
/claude-code-skills:optimize-context
/claude-code-skills:env-heal
/claude-code-skills:systems-thinking
```

---

## Skills

### DLC Workflow Skills

These four skills form a complete development loop powered by Agent Teams.

#### `dlc-build` — Full Development Loop

Use when implementing a feature, bugfix, or Jira ticket. Runs Research → Plan → Implement → Review → Ship.

```bash
/claude-code-skills:dlc-build "add rate limiting to the API"
/claude-code-skills:dlc-build BEP-1234          # auto-fetches Jira AC
/claude-code-skills:dlc-build BEP-1234 --quick  # skip research for small fixes
/claude-code-skills:dlc-build BEP-1234 --hotfix # urgent production incident
```

#### `dlc-review` — Adversarial PR Review

Use when reviewing a pull request. Three agents independently review then debate findings to reduce false positives.

```bash
/claude-code-skills:dlc-review 42               # PR number
/claude-code-skills:dlc-review 42 BEP-1234      # with Jira AC verification
/claude-code-skills:dlc-review 42 Author        # apply fixes directly
/claude-code-skills:dlc-review 42 Reviewer      # post GitHub comments
```

#### `dlc-respond` — Address PR Review Comments

Use after receiving PR review feedback. Fetches open threads, fixes each issue, commits, and replies to reviewers.

```bash
/claude-code-skills:dlc-respond 42
/claude-code-skills:dlc-respond 42 BEP-1234     # with Jira context
```

#### `dlc-debug` — Parallel Root Cause Analysis

Use when debugging a complex bug. Investigator traces root cause while DX Analyst audits observability and error handling in parallel.

```bash
/claude-code-skills:dlc-debug "NullPointerException in UserService"
/claude-code-skills:dlc-debug BEP-5678          # from Jira bug ticket
/claude-code-skills:dlc-debug BEP-5678 --quick  # skip DX analysis
```

---

### Utility Skills

#### `merge-pr` — Git-flow Merge & Deploy

Use to merge a PR, deploy a hotfix, or cut a release following git-flow conventions.

```bash
/claude-code-skills:merge-pr 42          # feature/bugfix → develop
/claude-code-skills:merge-pr --hotfix    # hotfix → main + backport
/claude-code-skills:merge-pr --release   # release → main + tag
```

#### `optimize-context` — Audit CLAUDE.md

Use to audit and improve a CLAUDE.md file — scores quality, removes bloat, and adds missing context.

```bash
/claude-code-skills:optimize-context
```

#### `env-heal` — Fix Environment Variables

Use when env vars are missing from schema or `.env.example`, or when the app crashes at startup due to missing config.

```bash
/claude-code-skills:env-heal             # full scan and fix
/claude-code-skills:env-heal --quick     # schema vs .env.example only
```

#### `systems-thinking` — Causal Loop Analysis

Use before major architecture decisions to map feedback loops and second-order effects.

```bash
/claude-code-skills:systems-thinking "should we move to microservices?"
```

---

## What's Included

### Agents (7)

| Agent | Model | Purpose |
| --- | --- | --- |
| `commit-finalizer` | haiku | Fast git commit with conventional commits format |
| `dev-loop-bootstrap` | haiku | Pre-gather context before dlc-build explorer spawns |
| `dlc-debug-bootstrap` | haiku | Pre-gather debug context before dlc-debug Investigator spawns |
| `pr-review-bootstrap` | sonnet | Fetch PR diff + Jira AC in one pass before review |
| `review-consolidator` | haiku | Dedup/sort multi-reviewer findings into single ranked table |
| `skill-validator` | sonnet | Validates SKILL.md against best practices |
| `tathep-reviewer` | sonnet | Code reviewer with persistent memory (tathep projects) |

### Hooks — Distributed via Plugin

These hooks are active automatically after plugin install:

| Hook | Event | Purpose |
| --- | --- | --- |
| `check-deps.sh` | SessionStart | Warn if required tools are missing |
| `session-start-context.sh` | SessionStart | Inject git branch + uncommitted changes into context |
| `skill-routing.sh` | UserPromptSubmit | Auto-suggest relevant skills based on prompt keywords |
| `protect-files.sh` | PreToolUse[Edit\|Write] | Block Claude from editing `.claude/settings.json` directly |
| `shellcheck-written-scripts.sh` | PostToolUse[Write] | Auto-validate shell scripts Claude writes |
| `task-gate.sh` | TaskCompleted | Require file:line evidence before agent tasks complete |
| `idle-nudge.sh` | TeammateIdle | Nudge idle teammates during Agent Teams workflows |

### Output Styles (2)

| Style | Description |
| --- | --- |
| `thai-tech-lead` | Thai language, concise, architecture-focused |
| `coding-mentor` | Explains decisions inline while coding |

### Commands (1)

| Command | Description |
| --- | --- |
| `analyze-claude-features` | Analyze Claude Code features and capabilities |

---

## Troubleshooting

### DLC skills do nothing / no agents spawn

Enable Agent Teams:

```bash
claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
```

Then restart Claude Code.

### Skills not triggering automatically

The `skill-routing.sh` hook detects keywords in your prompt and suggests relevant skills. Verify it's active:

```bash
claude plugin list
# claude-code-skills should appear
```

If the plugin is installed but skills still don't trigger, try invoking manually with the `/claude-code-skills:` prefix.

### Jira context not loading

Jira integration is optional. DLC skills work without it. If you want Jira context, configure one of:

- `mcp-atlassian` MCP server (direct Jira API)
- `jira-cache-server` MCP server (cached, faster)

If neither is configured, skills skip Jira context silently and continue normally.

### Plugin skills show as `claude-code-skills:skill-name`

This is correct — skills installed via plugin are namespaced automatically.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up a local development environment, add new skills, and run the linter.
