# Skills Best Practices

Researched 2026-03-11 from official Claude Code docs (`code.claude.com/docs/en/skills`).

## Supported Frontmatter Fields

All fields are optional. Only `description` is recommended.

| Field | Description | Max |
| --- | --- | --- |
| `name` | Display name / slash command trigger. Lowercase letters, numbers, hyphens. | 64 chars |
| `description` | What it does + when to use it. Claude uses this for auto-invocation. | 1024 chars |
| `argument-hint` | Hint shown during `/` autocomplete (e.g. `[issue-number]`). | — |
| `disable-model-invocation` | `true` = only user can invoke. Removes description from context. | — |
| `user-invocable` | `false` = hides from `/` menu. Claude can still auto-invoke. | — |
| `allowed-tools` | Tools auto-approved when skill is active (e.g. `Read, Grep, Bash(gh *)`). | — |
| `model` | Model override when skill is active (e.g. `sonnet`, `opus`, `haiku`). | — |
| `context` | `fork` = run in isolated subagent context. | — |
| `agent` | Subagent type when `context: fork` (e.g. `Explore`, `Plan`, custom agent). | — |
| `hooks` | Lifecycle hooks scoped to this skill. See hooks docs for format. | — |
| `compatibility` | Prerequisites (CLIs, env, repo context). From agentskills.io spec. | 500 chars |
| `license` | License identifier. From agentskills.io spec. | — |
| `metadata` | Arbitrary metadata object. From agentskills.io spec. | — |

## disable-model-invocation vs user-invocable

| Setting | In context? | `/` menu | Auto-invoke |
| --------- | ------------ | ---------- | ------------- |
| (default) | ✅ | ✅ | ✅ |
| `disable-model-invocation: true` | ❌ | ✅ | ❌ |
| `user-invocable: false` | ✅ | ❌ | ✅ |

## Description Rules

1. Max **1024 chars** — use the full budget for auto-invoked skills
2. Cover **what** it does AND **when** to use it
3. **Third person** — injected into system prompt
4. Include **specific trigger keywords** users would naturally say
5. No XML tags

**Good pattern:**

```yaml
description: "Summarize PR changes. Use when user asks for PR summary, code review overview, or wants to understand what changed in a PR."
```

## Description Context Budget

- **2% of context window** (floor: 16,000 chars) at startup
- If many skills are installed and exceed budget, some are excluded — run `/context` to check
- Override: `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var

## String Substitutions

| Variable | Description |
| --- | --- |
| `$ARGUMENTS` | All arguments passed when invoking. Appended as `ARGUMENTS: <value>` if not present in content. |
| `$ARGUMENTS[N]` / `$N` | Access specific argument by 0-based index (e.g. `$0` = first arg). |
| `${CLAUDE_SESSION_ID}` | Current session ID. |
| `${CLAUDE_SKILL_DIR}` | Directory containing the skill's SKILL.md. Use for referencing bundled scripts/files. |
| `` !`cmd` `` | Shell injection — command runs before content is sent to Claude, output replaces placeholder. |

## File Structure

```text
skills/<name>/
  SKILL.md         # Entry point. Keep under ~500 lines / 5k tokens.
  CLAUDE.md        # Local maintenance context (tracked in git)
  references/      # Supporting docs — loaded on demand, no size limit
  scripts/         # Pre-written scripts > asking Claude to generate inline
```

**Progressive disclosure:**

| Level | Content | When loaded |
| ------- | --------- | ------------ |
| 1 — Metadata | `name` + `description` | Always, at startup |
| 2 — Instructions | SKILL.md body | On invoke |
| 3 — Resources | `references/` files | When accessed |

## Content Principles

- **Single default** over multiple options: "use pdfplumber; for OCR use pdf2image instead"
- **High freedom** (guidelines) for flexible tasks; **low freedom** (exact commands) for fragile ops
- **File references one level deep** — avoid nested chains; Claude may `head -100` partial reads
- **Reference files explicitly** — state what each file contains and when to load it
- **Consistent terminology** — pick one term and never vary it
- **Pre-written scripts** beat asking Claude to generate code inline
- **No time-sensitive info** — don't write "before August 2025 use X"
- **Include a feedback loop** — run validator → fix → repeat pattern in workflows

## Skill Discovery / Installation

Precedence (highest wins): Enterprise → Personal `~/.claude/skills/` → Project `.claude/skills/` → Plugin

```bash
bash scripts/link-skill.sh <name>   # install one
bash scripts/link-skill.sh          # install all
bash scripts/link-skill.sh --list   # check symlink status
```
