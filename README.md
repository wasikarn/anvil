<div align="center">

# claude-code-skills

**A Claude Code plugin for structured development, PR review, and debugging — powered by Agent Teams.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)](https://github.com/wasikarn/claude-code-skills/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-8-blue?style=flat-square)](#skills)
[![Agents](https://img.shields.io/badge/agents-7-purple?style=flat-square)](#agents)
[![Hooks](https://img.shields.io/badge/hooks-8-orange?style=flat-square)](#hooks)

<p>
  <a href="#quick-start">Quick Start</a> •
  <a href="#skills">Skills</a> •
  <a href="#agents">Agents</a> •
  <a href="#hooks">Hooks</a> •
  <a href="#jira-integration">Jira</a> •
  <a href="#recommended-ecosystem">Ecosystem</a> •
  <a href="#troubleshooting">Troubleshooting</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

</div>

---

## What's Inside

| Component | Count | Purpose |
| --- | --- | --- |
| **Skills** | 8 | Workflow automation — dev loop, PR review, debugging, utilities |
| **Agents** | 7 | Specialized subagents for bootstrapping, reviewing, and committing |
| **Hooks** | 8 | Lifecycle automation — dependency checks, skill routing, quality gates |
| **Output Styles** | 2 | Senior Software Engineer, Coding Mentor |
| **Commands** | 1 | `analyze-claude-features` |

---

## Quick Start

```bash
# 1. Install prerequisites
brew install jq gh rtk && gh auth login

# 2. Install the plugin
claude plugin install wasikarn/claude-code-skills

# 3. Enable Agent Teams (required for all DLC skills)
claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
```

Restart Claude Code. On next session start, the plugin warns you about any missing tools automatically.

---

## Prerequisites

| Tool | Required | Install |
| --- | --- | --- |
| `jq` | Yes — all workflow hooks | `brew install jq` / `apt install jq` |
| `git` | Yes — all DLC skills | pre-installed on most systems |
| `gh` CLI | Yes — DLC skills + merge-pr | `brew install gh` → `gh auth login` |
| `rtk` | Yes — token-optimized output | `brew install rtk` |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Yes — enables Agent Teams | `claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1` |
| `shellcheck` | Optional | `brew install shellcheck` |
| `node` / `npx` | Optional — auto markdown lint | `brew install node` |

> Hooks degrade gracefully — missing optional tools are skipped silently.

---

## Skills

### DLC Workflow Skills

The four DLC skills form a complete development loop. Each runs a team of specialized agents that work in parallel, debate findings, and produce structured output.

```text
┌─────────────────────────────────────────────────────────────────┐
│                     DLC Workflow Overview                       │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  dlc-build   │  dlc-review  │ dlc-respond  │     dlc-debug     │
│              │              │              │                   │
│ Research     │ Reviewer A   │ Fetch open   │ Investigator      │
│ → Plan       │ Reviewer B   │ threads      │ (root cause)      │
│ → Implement  │ Reviewer C   │ → Fix each   │ + DX Analyst      │
│ → Review     │ ↓ Debate     │ → Commit     │ (observability)   │
│ → Ship       │ → Consensus  │ → Reply      │ → Fixer           │
└──────────────┴──────────────┴──────────────┴───────────────────┘
```

---

#### `dlc-build` — Full Development Loop

The primary workflow for any coding task. Runs Research → Plan → Implement → Review → Ship with an iterative fix-review loop.

**When to use:** New features, bug fixes, refactors, Jira tickets, CI failures, production hotfixes.

```bash
/claude-code-skills:dlc-build "add rate limiting to the API"
/claude-code-skills:dlc-build PROJ-1234           # auto-fetches Jira AC
/claude-code-skills:dlc-build PROJ-1234 --quick   # skip research for small fixes
/claude-code-skills:dlc-build PROJ-1234 --hotfix  # urgent production incident
```

| Mode | When to use |
| --- | --- |
| _(default)_ | Full loop — research, plan, implement, review |
| `--quick` | Small fix with clear scope — skip research phase |
| `--hotfix` | Branches from `main`, creates backport PR to `develop` |

---

#### `dlc-review` — Adversarial PR Review

Three agents independently review a PR, then debate their findings in rounds to eliminate false positives. Final output is a single ranked table with evidence-backed findings.

**When to use:** Reviewing any pull request — quick standards check, architecture review, or thorough multi-perspective analysis.

```bash
/claude-code-skills:dlc-review 42                  # PR number
/claude-code-skills:dlc-review 42 PROJ-1234        # with Jira AC verification
/claude-code-skills:dlc-review 42 Author           # apply fixes directly to the branch
/claude-code-skills:dlc-review 42 Reviewer         # post findings as GitHub review comments
```

| Mode | When to use |
| --- | --- |
| `Author` | You own the PR and want fixes applied automatically |
| `Reviewer` | You are reviewing someone else's PR and want GitHub comments posted |

---

#### `dlc-respond` — Address PR Review Comments

Fetches all open GitHub review threads on a PR, groups them by file, fixes each issue in parallel, commits changes, and posts replies to close each thread.

**When to use:** After receiving PR review feedback and needing to address all comments systematically.

```bash
/claude-code-skills:dlc-respond 42
/claude-code-skills:dlc-respond 42 PROJ-1234   # with Jira AC context for prioritization
```

---

#### `dlc-debug` — Parallel Root Cause Analysis

Two agents run in parallel: an Investigator traces the root cause through logs, stack traces, and code, while a DX Analyst audits observability, error handling, and test coverage in the affected area. A Fixer agent then applies the fix.

**When to use:** Complex bugs, production incidents, or when you want to harden the affected area alongside the fix.

```bash
/claude-code-skills:dlc-debug "NullPointerException in UserService"
/claude-code-skills:dlc-debug PROJ-5678          # from a Jira bug ticket
/claude-code-skills:dlc-debug PROJ-5678 --quick  # fix only, skip DX analysis
```

---

### Utility Skills

#### `merge-pr` — Git-flow Merge & Deploy

Automates the full merge and release process following git-flow conventions: version bumps, CHANGELOG updates, tags, backport PRs, and post-merge verification.

```bash
/claude-code-skills:merge-pr 42           # feature/bugfix → develop
/claude-code-skills:merge-pr --hotfix     # hotfix → main + backport to develop
/claude-code-skills:merge-pr --release    # release → main + tag + backport
```

**Requires:** `gh` CLI (authenticated), clean working tree, GitHub remote.

---

#### `optimize-context` — Audit CLAUDE.md

Scores a CLAUDE.md file across quality dimensions, identifies bloat and gaps, and rewrites sections to be more useful for Claude. Safe to run — use `--dry-run` to preview changes.

```bash
/claude-code-skills:optimize-context
/claude-code-skills:optimize-context --dry-run    # preview without editing
/claude-code-skills:optimize-context --coverage   # include coverage analysis
```

---

#### `env-heal` — Fix Environment Variables

Scans the codebase for all env var references, cross-references against the validation schema and `.env.example`, classifies gaps, auto-fixes discrepancies, and runs tests to verify.

```bash
/claude-code-skills:env-heal              # full scan and fix
/claude-code-skills:env-heal --quick      # schema vs .env.example only
/claude-code-skills:env-heal --dry-run    # preview changes without applying
```

**Supports:** AdonisJS (`Env.schema`), dotenv (`.env.example`), and any Node.js project.

---

#### `systems-thinking` — Causal Loop Analysis

Helps think through complex architecture decisions by mapping causal loops, identifying feedback cycles, and surfacing second-order effects before committing to a direction.

```bash
/claude-code-skills:systems-thinking "should we move to microservices?"
/claude-code-skills:systems-thinking "what happens if we remove the cache layer?"
```

---

## Agents

Specialized subagents that the DLC skills and other workflows spawn automatically. You can also invoke them directly.

| Agent | Model | Invoked by | Purpose |
| --- | --- | --- | --- |
| `commit-finalizer` | Haiku | Manually | Fast git commit — formats conventional commit messages |
| `dev-loop-bootstrap` | Haiku | `dlc-build` Phase 1 | Pre-gathers project structure and type definitions |
| `dlc-debug-bootstrap` | Haiku | `dlc-debug` Phase 0 | Pre-gathers stack trace context and affected files |
| `pr-review-bootstrap` | Haiku | `dlc-review` Phase 0 | Fetches PR diff, Jira AC, and groups changed files |
| `review-consolidator` | Haiku | `dlc-review` Phase 4 | Deduplicates and ranks findings from multiple reviewers |
| `skill-validator` | Sonnet | Manually | Validates SKILL.md frontmatter and description quality |
| `code-reviewer` | Sonnet | Manually | General-purpose code reviewer with cross-session persistent memory |

---

## Hooks

These hooks are distributed automatically with the plugin and activate on install. No manual configuration required.

| Hook | Event | What it does |
| --- | --- | --- |
| `check-deps.sh` | `SessionStart` | Warns in context if `jq`, `gh`, or `rtk` are missing |
| `session-start-context.sh` | `SessionStart` | Injects current git branch and uncommitted file count |
| `skill-routing.sh` | `UserPromptSubmit` | Detects workflow keywords and suggests the right skill before responding |
| `protect-files.sh` | `PreToolUse[Edit\|Write]` | Blocks Claude from editing `.claude/settings.json` directly |
| _(inline)_ | `PostToolUse[Edit\|Write]` | Auto-lints `.md` files with `markdownlint-cli2 --fix` |
| `shellcheck-written-scripts.sh` | `PostToolUse[Write]` | Auto-validates `.sh` files Claude writes |
| `task-gate.sh` | `TaskCompleted` | Requires `file:line` evidence before agent tasks are marked complete |
| `idle-nudge.sh` | `TeammateIdle` | Nudges idle Agent Teams teammates back on task |

### Skill Routing Keywords

`skill-routing.sh` detects these patterns and injects a skill hint before Claude responds:

| Pattern | Suggested skill |
| --- | --- |
| `bug`, `broken`, `failing`, `crash`, `test fail` | `dlc-debug` |
| `ready to merge`, `feature complete`, `ready for PR` | `dlc-review` → ship workflow |
| `review PR`, `review pull request`, `review code` | `dlc-review` |
| `implement`, `add feature`, `build component`, `create page` | `dlc-build` |

---

## Output Styles

Activate an output style to change how Claude communicates throughout a session.

| Style | How to activate | Description |
| --- | --- | --- |
| `senior-software-engineer` | `/output-style senior-software-engineer` | Thai language, English for code and technical terms. Pragmatic senior engineer tone — trade-offs, production quality, practical solutions. |
| `coding-mentor` | `/output-style coding-mentor` | Thai language, teaches through doing. Adds concise "Why" explanations after significant changes. Good for onboarding and exploring new codebases. |

---

## Jira Integration

DLC skills auto-fetch Jira context when you pass a ticket key (e.g. `PROJ-123`). Configure one MCP server to enable:

| MCP Server | Notes | Install |
| --- | --- | --- |
| `mcp-atlassian` | Direct Jira API | [sooperset/mcp-atlassian](https://github.com/sooperset/mcp-atlassian) |
| `jira-cache-server` | Cached, faster | [wasikarn/jira-cache-server](https://github.com/wasikarn/jira-cache-server) |

> If neither is configured, skills skip Jira context silently and continue normally. Jira is never a blocker.

---

## Recommended Ecosystem

The plugin works standalone, but these tools are worth installing to get the most out of the DLC workflow.

### Complementary Claude Code Plugins

Install via `claude plugin install <name>`:

| Plugin | Why it's worth installing |
| --- | --- |
| `superpowers@claude-plugins-official` | Structured workflow skills — brainstorming before building, TDD, systematic debugging, verification before claiming done. Prevents the common failure modes that make AI-generated code unreliable. |
| `claude-mem@thedotmack` | Cross-session persistent memory. Claude remembers past decisions, recurring patterns, and project context across conversations — no more re-explaining the same constraints every session. |
| `qmd@qmd` | Local semantic search over your codebase and docs. Index `.ts`/`.tsx`/`.md` files; Claude searches by meaning, not just keywords. Speeds up `dlc-build` research phase significantly. |
| `feature-dev@claude-plugins-official` | Specialized subagents for feature exploration and architecture analysis. Pairs well with `dlc-build` for larger features. |
| `commit-commands@claude-plugins-official` | Quick `/commit` and `/commit-push-pr` skills. Saves friction for the Ship phase of `dlc-build`. |
| `playwright@claude-plugins-official` | Browser automation via MCP. Useful for `dlc-debug` when diagnosing UI bugs or end-to-end test failures. |
| `typescript-lsp@claude-plugins-official` | TypeScript language server integration. Claude gets real-time type errors, go-to-definition, and rename-symbol — reduces hallucinated type signatures in TypeScript projects. |
| `pr-review-toolkit@claude-plugins-official` | Additional review agents (silent-failure hunter, type-design analyzer, test coverage analyzer). Complements `dlc-review`'s three-reviewer debate. |

### Nice to Have: MCP Servers

These MCP servers integrate directly with the DLC skills when present. All are optional — skills degrade gracefully if absent.

| MCP Server | When it helps | Install |
| --- | --- | --- |
| `context7` | Auto-fetches up-to-date library docs during `dlc-build` research phase. No more hallucinated API signatures — Claude reads the actual current docs for any npm/PyPI package. | [upstash/context7-mcp](https://github.com/upstash/context7-mcp) |
| `sequential-thinking` | Structured multi-step reasoning for complex architecture decisions. Useful in `systems-thinking` skill and `dlc-build` planning phase when the problem has many unknowns. | `claude mcp add sequential-thinking` |
| `figma` | Pulls Figma frames and component data directly into context. If your team designs in Figma before coding, this lets `dlc-build` use the actual design spec rather than a description of it. | [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP) |
| `mcp-atlassian` | Already covered in [Jira Integration](#jira-integration) — also gives access to Confluence pages, which `dlc-build` uses as additional acceptance criteria context. | [sooperset/mcp-atlassian](https://github.com/sooperset/mcp-atlassian) |

---

## Troubleshooting

### DLC skills do nothing / no agents spawn

Agent Teams must be enabled:

```bash
claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
```

Restart Claude Code after setting.

### Skills not triggering automatically

`skill-routing.sh` detects keywords and suggests skills. If it's not triggering, verify the plugin is installed:

```bash
claude plugin list
# Expected: claude-code-skills appears
```

If missing, reinstall: `claude plugin install wasikarn/claude-code-skills`

### Warning about missing tools at session start

Install the flagged tools:

```bash
brew install jq gh rtk
gh auth login
```

Then restart Claude Code to dismiss the warning.

### Jira context not loading

Jira is optional. If you want it, configure `mcp-atlassian` or `jira-cache-server`. See [Jira Integration](#jira-integration).

### Plugin skills show as `claude-code-skills:skill-name`

This is correct. Skills installed via plugin are namespaced automatically to avoid conflicts.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, how to add new skills, and linting instructions.

---

## License

[MIT](LICENSE) — © [kobig](https://github.com/wasikarn)
