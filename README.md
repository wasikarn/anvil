# dotclaude

Personal Claude Code configuration — skills, agents, hooks, output styles, and scripts. Symlinked to `~/.claude/` for immediate effect across all sessions.

## Quick Start

```bash
# New machine setup
bash scripts/install.sh

# Link all assets (skills, agents, hooks, output-styles, commands, scripts, dotfiles)
bash scripts/link-skill.sh

# Link one skill
bash scripts/link-skill.sh <name>

# Check symlink status
bash scripts/link-skill.sh --list
```

## Contents

### Skills (23)

| Category | Skills | Description |
| --- | --- | --- |
| **PR Review** | `tathep-api-review-pr`, `tathep-web-review-pr`, `tathep-admin-review-pr`, `tathep-video-review-pr`, `tathep-agent-review-pr` | Project-specific PR review — 7 parallel agents, Jira AC verification, 12-point checklist, QG scoring |
| **Spec-Driven Dev** | `spec-kit`, `speckit-constitution`, `speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-tasks`, `speckit-implement`, `speckit-analyze`, `speckit-checklist`, `speckit-taskstoissues` | 6-step SDD workflow from requirements to working code |
| **Team Workflows** | `team-debug`, `team-dev-loop`, `team-review-pr` | Multi-agent team patterns — debugging, dev loop, review |
| **Thinking** | `systems-thinking` | Causal Loop Diagram analysis for architecture decisions and bottleneck diagnosis |
| **Database** | `postgresql-schema-design` | Schema design, data types, indexing strategies, FK gotchas |
| **Utilities** | `deep-research-workflow`, `optimize-context`, `env-heal` | Research-first workflow, CLAUDE.md optimizer, env var healing |

### Agents (4)

| Agent | Model | Purpose |
| --- | --- | --- |
| `commit-finalizer` | haiku | Fast git commit with conventional commits format |
| `pr-review-bootstrap` | sonnet | Fetch PR diff + Jira AC in one pass before review |
| `tathep-reviewer` | sonnet | Code reviewer with persistent memory + preloaded skills |
| `skill-validator` | sonnet | Validates SKILL.md against best practices |

### Hooks (9)

| Hook | Event | Purpose |
| --- | --- | --- |
| `session-start-context.sh` | SessionStart | Inject git state + project detection |
| `post-compact-context.sh` | SessionStart[compact] | Re-inject context after compaction |
| `auto-test-env.sh` | PostToolUse[Edit\|Write] | Auto-detect test framework after file edits |
| `protect-files.sh` | PreToolUse[Edit\|Write] | Block edits to protected config files |
| `session-summary-hook.sh` | PostToolUse[Bash] | Track session activity |
| `dev-loop-idle-nudge.sh` | Stop | Nudge dev-loop team to continue |
| `dev-loop-task-gate.sh` | Stop | Gate dev-loop completion |
| `review-debate-idle-nudge.sh` | Stop | Nudge review-debate to continue |
| `review-debate-task-gate.sh` | Stop | Gate review-debate completion |

### Output Styles (2)

| Style | Description |
| --- | --- |
| `thai-tech-lead` | Thai language, concise, architecture-focused |
| `coding-mentor` | Explains decisions inline while coding |

### Commands (1)

| Command | Description |
| --- | --- |
| `analyze-claude-features` | Analyze Claude Code features and capabilities |

### Scripts (6)

| Script | Description |
| --- | --- |
| `install.sh` | New machine setup — prerequisites, settings.json from template, symlinks |
| `link-skill.sh` | Symlink manager — links all asset types + dotfiles to `~/.claude/` |
| `detect-project.sh` | Auto-detect current project type for context injection |
| `pr-context.sh` | Fetch PR context (diff, Jira, AC) for review agents |
| `classify-env-gaps.sh` | Classify missing env vars by severity |
| `fix-tables.py` | Fix markdown table formatting |

### Dotfiles

| File | Symlink Target | Description |
| --- | --- | --- |
| `global-CLAUDE.md` | `~/.claude/CLAUDE.md` | Global instructions for all projects |
| `statusline.sh` | `~/.claude/statusline.sh` | Custom status line display |
| `global-settings.template.json` | *(template only)* | Settings template for new machine setup |

## Repo Structure

```text
dotclaude/
├── skills/           → ~/.claude/skills/
├── agents/           → ~/.claude/agents/
├── hooks/            → ~/.claude/hooks/
├── output-styles/    → ~/.claude/output-styles/
├── commands/         → ~/.claude/commands/
├── scripts/          → ~/.claude/scripts/
├── references/       # Shared reference docs (not symlinked)
├── global-CLAUDE.md  → ~/.claude/CLAUDE.md
├── statusline.sh     → ~/.claude/statusline.sh
└── global-settings.template.json  # Template for settings.json
```

## New Machine Setup

```bash
git clone git@github.com:wasikarn/dotclaude.git ~/Codes/Personals/dotclaude
cd ~/Codes/Personals/dotclaude
bash scripts/install.sh
```

The install script will:

1. Check prerequisites (git, jq, node/bun)
2. Generate `~/.claude/settings.json` from template
3. Create required directories
4. Run `link-skill.sh` to symlink everything
