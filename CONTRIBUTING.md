# Contributing to dev-loop

This guide is for developers who want to customize, extend, or contribute to the plugin.

---

## Local Development Setup (symlinks)

> **Warning:** Do not use symlinks if you have `claude plugin install wasikarn/dev-loop` active — both write to the same `~/.claude/` directories and will conflict. Use one or the other.

For contributors who want to edit skills and see changes take effect immediately without reinstalling the plugin. Clone the repo and symlink assets directly to `~/.claude/`.

### Prerequisites

**Required — plugin will not function without these:**

| Tool | Why | Install |
| --- | --- | --- |
| `git` | Session hooks + all DLC skills | pre-installed / `xcode-select --install` |
| `jq` | Every hook uses it — missing breaks all hooks | `brew install jq` |
| `gh` CLI (authenticated) | DLC skills (`dlc-build`, `dlc-review`, `dlc-respond`, `dlc-debug`, `merge-pr`) — no fallback | `brew install gh && gh auth login` |

**Required for auto-quality hooks (fire on every file edit):**

| Tool | Why | Install |
| --- | --- | --- |
| `node` / `npm` + `markdownlint-cli2` | PostToolUse hook auto-lints every `.md` Claude edits | `brew install node && npm install -g markdownlint-cli2` |
| `shellcheck` | PostToolUse hook auto-lints every `.sh` Claude writes | `brew install shellcheck` |

**Recommended — degrades gracefully without:**

| Tool | Without it | Install |
| --- | --- | --- |
| `rtk` | DLC skills still work but use raw git/gh output (higher token cost) | `brew install rtk` |
| `python3` | `optimize-context` skill cannot detect project framework | pre-installed on macOS |
| `fd` | Bootstrap agents fall back to Glob (slower) | `brew install fd` |
| `ast-grep` | Bootstrap agents fall back to Grep (less precise) | `brew install ast-grep` |

### Step 1 — Clone the repo

```bash
git clone git@github.com:wasikarn/dev-loop.git
cd dev-loop
```

### Step 2 — Link skills, agents, hooks, and output styles

```bash
bash scripts/link-skill.sh
```

This symlinks all assets to `~/.claude/`:

- `skills/` → `~/.claude/skills/`
- `agents/` → `~/.claude/agents/`
- `hooks/` → `~/.claude/hooks/`
- `output-styles/` → `~/.claude/output-styles/`
- `commands/` → `~/.claude/commands/`

### Step 3 — Enable Agent Teams

```bash
claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
```

### Step 4 — Verify symlinks

```bash
bash scripts/link-skill.sh --list
# Expected: all skills, agents, hooks, commands, output-styles show as ✓ linked
```

### Step 5 — Restart Claude Code

Changes to symlinked files take effect immediately. Restart only needed for settings changes.

---

## Adding a New Skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter
2. Create `skills/<name>/CLAUDE.md` with contributor context (architecture, gotchas, validate commands)
3. Add `references/` directory for multi-phase skills or skills exceeding ~100 lines — move templates, checklists, and examples there
4. _(Dev mode only)_ Symlink to test locally: `bash scripts/link-skill.sh <name>`
5. Lint: `npx markdownlint-cli2 "skills/<name>/**/*.md"`

### Frontmatter fields

```yaml
---
name: skill-name                                                     # required
description: "What it does, when to use it, trigger keywords. Max 1024 chars."  # required
argument-hint: "[required-arg] [optional-arg?]"                      # recommended if skill accepts arguments
compatibility: "List required tools, e.g. Requires gh CLI and git."  # recommended if skill uses external tools
---
```

See [`references/skills-best-practices.md`](references/skills-best-practices.md) for the full spec.

---

## Linting & Validation

```bash
# Lint all markdown
npx markdownlint-cli2 "**/*.md"

# Lint one skill
npx markdownlint-cli2 "skills/dlc-build/**/*.md"

# Validate plugin structure (plugin.json, skill/agent frontmatter, hooks.json)
claude plugin validate
```

The pre-commit hook runs `fix-tables.sh` + `markdownlint-cli2 --fix` on staged `.md` files automatically. Run `claude plugin validate` before opening a PR to catch frontmatter issues early.

---

## Linking Everything

```bash
# Link all assets (skills, agents, hooks, output-styles, commands)
bash scripts/link-skill.sh

# Link one skill only
bash scripts/link-skill.sh dlc-build

# Check all symlinks
bash scripts/link-skill.sh --list
```

---

## Repo Structure

```text
dev-loop/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── skills/                   # Skill entry points (SKILL.md per skill)
├── agents/                   # Custom subagent definitions
├── hooks/                    # Lifecycle hooks
│   └── hooks.json            # Plugin hook registry
├── output-styles/            # Custom output styles
├── commands/                 # Slash commands
├── scripts/                  # Dev tooling (link-skill.sh, fix-tables.sh)
└── references/               # Shared reference docs (not symlinked)
```
