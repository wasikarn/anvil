# Contributing to devflow

This guide is for developers who want to customize, extend, or contribute to the plugin.

---

## Local Development Setup (symlinks)

> **Warning:** Do not use symlinks if you have `claude plugin install wasikarn/devflow` active — both write to the same `~/.claude/` directories and will conflict. Use one or the other.

For contributors who want to edit skills and see changes take effect immediately without reinstalling the plugin. Clone the repo and symlink assets directly to `~/.claude/`.

### Prerequisites

**Required — plugin will not function without these:**

| Tool | Why | Install |
| --- | --- | --- |
| `git` | Session hooks + all Devflow skills | pre-installed / `xcode-select --install` |
| `jq` | Every hook uses it — missing breaks all hooks | `brew install jq` |
| `gh` CLI (authenticated) | Devflow skills (`build`, `review`, `respond`, `debug`, `merge-pr`) — no fallback | `brew install gh && gh auth login` |

**Required for auto-quality hooks (fire on every file edit):**

| Tool | Why | Install |
| --- | --- | --- |
| `node` / `npm` + `markdownlint-cli2` | PostToolUse hook auto-lints every `.md` Claude edits | `brew install node && npm install -g markdownlint-cli2` |
| `shellcheck` | PostToolUse hook auto-lints every `.sh` Claude writes | `brew install shellcheck` |

**Recommended — degrades gracefully without:**

| Tool | Without it | Install |
| --- | --- | --- |
| `rtk` | Devflow skills still work but use raw git/gh output (higher token cost) | `brew install rtk` |
| `python3` | `optimize-claude-md` skill cannot detect project framework | pre-installed on macOS |
| `fd` | Bootstrap agents fall back to Glob (slower) | `brew install fd` |
| `ast-grep` | Bootstrap agents fall back to Grep (less precise) | `brew install ast-grep` |

### Step 1 — Clone the repo

```bash
git clone git@github.com:wasikarn/devflow.git
cd devflow
```

### Step 2 — Install git hooks

```bash
bash scripts/install-hooks.sh
```

### Step 3 — Link skills, agents, hooks, and output styles

```bash
bash scripts/link-assets.sh
```

This symlinks all assets to `~/.claude/`:

- `skills/` → `~/.claude/skills/`
- `agents/` → `~/.claude/agents/`
- `hooks/` → `~/.claude/hooks/`
- `output-styles/` → `~/.claude/output-styles/`

### Step 4 — Enable Agent Teams

```bash
claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
```

### Step 5 — Verify symlinks

```bash
bash scripts/link-assets.sh --list
# Expected: all skills, agents, hooks, output-styles show as ✓ linked
```

### Step 6 — Restart Claude Code

Changes to symlinked files take effect immediately. Restart only needed for settings changes.

---

## Adding a New Skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter
2. Create `skills/<name>/CLAUDE.md` with contributor context (architecture, gotchas, validate commands)
3. Add `references/` directory for multi-phase skills or skills exceeding ~100 lines — move templates, checklists, and examples there
4. _(Dev mode only)_ Symlink to test locally: `bash scripts/link-assets.sh <name>`
5. Lint: `npx markdownlint-cli2 "skills/<name>/**/*.md"`

### Frontmatter fields

```yaml
---
name: skill-name                                                     # required
description: "What it does, when to use it, trigger keywords. Max 1024 chars."  # required
argument-hint: "[required-arg] [optional-arg?]"                      # recommended if skill accepts arguments
compatibility: "List required tools, e.g. Requires gh CLI and git."  # recommended if skill uses external tools
effort: high                                                         # optional: low | medium | high | max
allowed-tools: Read, Grep, Glob, Bash(git *), Bash(gh *)            # optional: auto-approved tools when active
user-invocable: false                                                # optional: hide from / menu (Claude can still auto-trigger)
context: fork                                                        # optional: run in isolated subagent context
agent: Explore                                                       # optional: subagent type when context: fork
---
```

All skills are auto-triggerable via `description` — Claude reads descriptions at startup and invokes matching skills automatically. Background skills (shared reference docs) use `user-invocable: false` to hide from the `/` menu while remaining auto-triggerable.

See [`docs/references/skills-best-practices.md`](docs/references/skills-best-practices.md) for the full spec.

---

## Adding a New Agent

Agents live at `agents/<name>.md` with YAML frontmatter. Key constraint: when distributed via the plugin, the `hooks:`, `mcpServers:`, and `permissionMode:` frontmatter fields are **silently ignored** — use `hooks/hooks.json` with `SubagentStart`/`SubagentStop` matchers for agent-specific hook behavior instead.

See [`docs/references/agent-hook-pattern.md`](docs/references/agent-hook-pattern.md) for the full pattern, examples, and the contrast with inline skill hooks.

---

## Linting & Validation

```bash
# Lint all markdown
npx markdownlint-cli2 "**/*.md"

# Lint one skill
npx markdownlint-cli2 "skills/build/**/*.md"

# Validate plugin structure (plugin.json, skill/agent frontmatter, hooks.json)
claude plugin validate

# Run full QA suite (13 gates: shellcheck, markdownlint, bats, plugin validate)
bash scripts/qa-check.sh

# Bump version (runs QA gates before release)
bash scripts/bump-version.sh <patch|minor|major>
```

The pre-commit hook runs `fix-tables.sh` + `markdownlint-cli2 --fix` on staged `.md` files automatically. Run `bash scripts/qa-check.sh` before opening a PR to catch issues early.

---

## Linking Everything

```bash
# Link all assets (skills, agents, hooks, output-styles)
bash scripts/link-assets.sh

# Link one skill only
bash scripts/link-assets.sh build

# Check all symlinks
bash scripts/link-assets.sh --list
```

---

## Repo Structure

```text
devflow/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── skills/                   # Skill entry points (SKILL.md per skill)
│   └── ...                   # 22 skills (16 user-facing + 6 background)
├── agents/                   # Custom subagent definitions (24 agents)
├── hooks/                    # Lifecycle hooks (18 hooks)
│   ├── hooks.json            # Plugin hook registry
│   └── lib/                  # Shared hook utilities
├── output-styles/            # Custom output styles
├── devflow-engine/              # TypeScript SDK for programmatic PR review
│   └── src/                  # Orchestrator, consolidator, triage, falsifier, CLI
├── scripts/                  # Dev tooling (link-assets.sh, qa-check.sh, bump-version.sh)
├── tests/
│   └── hooks/                # bats test suite for hook scripts
└── docs/
    └── references/           # Contributor reference docs (best practices, guides)
```
