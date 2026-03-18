# Contributing to claude-code-skills

This guide is for developers who want to customize, extend, or contribute to the plugin.

---

## Local Development Setup (symlinks)

Instead of installing via `claude plugin install`, you can clone the repo and symlink everything directly to `~/.claude/` for immediate effect on every change.

### Prerequisites

| Tool | Required | Install |
| --- | --- | --- |
| `git` | Yes | `brew install git` |
| `jq` | Yes | `brew install jq` |
| `gh` CLI | Yes | `brew install gh` then `gh auth login` |
| `rtk` | Yes | `brew install rtk` |
| `node` / `npm` | Optional — markdown linting | `brew install node` |
| `shellcheck` | Optional — shell script validation | `brew install shellcheck` |

### Step 1 — Clone the repo

```bash
git clone git@github.com:wasikarn/claude-code-skills.git
cd claude-code-skills
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
3. Add `references/` docs if the skill needs supporting material
4. Symlink: `bash scripts/link-skill.sh <name>`
5. Lint: `npx markdownlint-cli2 "skills/<name>/**/*.md"`

### Required frontmatter fields

```yaml
---
name: skill-name
description: "What it does, when to use it, trigger keywords. Max 1024 chars."
argument-hint: "[required-arg] [optional-arg?]"
compatibility: "List required tools, e.g. Requires gh CLI and git."
---
```

See [`references/skills-best-practices.md`](references/skills-best-practices.md) for the full spec.

---

## Linting

```bash
# Lint all markdown
npx markdownlint-cli2 "**/*.md"

# Lint one skill
npx markdownlint-cli2 "skills/dlc-build/**/*.md"
```

The pre-commit hook runs `fix-tables.sh` + `markdownlint-cli2 --fix` on staged `.md` files automatically.

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
claude-code-skills/
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
