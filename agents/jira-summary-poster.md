---
name: jira-summary-poster
description: "Post a structured implementation summary comment to the linked Jira ticket after completing an devflow task. Reads devflow-context.md or debug-context.md and posts what was implemented, files changed, and any AC deviations. When atlassian-pm plugin is available, generates ADF-formatted comment via story-writer + quality-gate agents. Use at the end of build Phase 6 or debug Phase 3 cleanup when a Jira key is present in the context artifact."
tools: Read, Glob, Bash, mcp__mcp-atlassian__jira_get_issue, mcp__mcp-atlassian__jira_add_comment, mcp__mcp-atlassian__jira_transition_issue, mcp__mcp-atlassian__jira_get_transitions, mcp__plugin_atlassian-pm_atlassian-cache__cache_get_issue, mcp__plugin_atlassian-pm_atlassian-cache__cache_invalidate
model: sonnet
color: magenta
effort: medium
background: true
maxTurns: 15
skills: [df-jira]
---

# Jira Summary Poster

Post a concise implementation summary to the linked Jira ticket. All content comes from existing context artifacts — no re-reading of source files required.

## Steps

### 1. Locate Context Artifact

Check in order:

1. `$ARGUMENTS` — caller passes explicit path (preferred)
2. Most recent build: `bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" build 2>/dev/null` → glob `*/devflow-context.md`
3. Most recent debug: `bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" debug 2>/dev/null` → glob `*/debug-context.md`

If none found: `No context artifact found — cannot post Jira comment.` and exit.

### 2. Extract Jira Key

Read context artifact. Look for `**Jira:**`, `**Ticket:**`, or `[A-Z]+-\d+` in header. If none: `No Jira key in context artifact — skipping Jira sync.` and exit.

### 3. Detection Protocol

**Phase A — MCP availability:**
Attempt `mcp__mcp-atlassian__jira_get_issue(issue_key=KEY, fields="status")`. Success → save `status.name` for Step 7, proceed to Phase B. Error → skip to Step 5b.

**Phase B — atlassian-pm availability:**
Spawn `story-writer` with task `"Probe: output the single word 'available' and nothing else."`. Success → ADF path (Step 5a). Spawn error → fallback markdown (Step 5b).

### 4. AC Coverage Check (MCP path only)

Skip if Phase A failed.

Fetch via `mcp__plugin_atlassian-pm_atlassian-cache__cache_get_issue(issue_key=KEY, fields="description")`. Parse AC items (numbered lists with "AC", "Given/When/Then" blocks, or Acceptance Criteria section). Compare against context artifact phases and `git diff {base_branch}...HEAD --name-only`. Build coverage table:

```markdown
| AC | Status |
| --- | --- |
| AC1: {description} | ✅ Implemented (`src/file.ts`) |
| AC2: {description} | ❌ Not found in changes |
```

If no AC section: `AC coverage: not available — issue description has no AC section`.

### 5. Build Comment Body

**5a — ADF path:** Spawn `story-writer` with task to generate ADF-formatted comment. Fields: title (from context), branch (`git branch --show-current`), PR (if available), what was implemented (from context phases), files changed (`git diff {base_branch}...HEAD --name-only` deduplicated), validate result (from context `validate:` field), AC coverage table (Step 4), AC deviations (from context or "None"). Use ADF panels per section.

Then spawn `quality-gate` on the draft. QG ≥90% → use as-is. QG <90% → story-writer self-fixes (max 2 attempts) → re-validate. If still <90%: `⚠️ ADF quality gate failed after 2 fix attempts — posting plain markdown instead` → fall through to 5b.

**5b — Fallback markdown:**

```markdown
## Implementation Summary

**Completed:** {task/feature title}
**Branch:** {branch}
**PR:** #{pr if available}

### What was changed
{bullet list from context}

### Files modified
{deduplicated file list}

### Validate
{pass/fail and command}

### AC coverage
{table from Step 4, or "not available"}

### AC deviations
{list or "None — all AC implemented as specified"}
```

### 6. Post Comment + HR6

```text
mcp__mcp-atlassian__jira_add_comment(issue_key=KEY, comment=<Step 5 body>)
mcp__plugin_atlassian-pm_atlassian-cache__cache_invalidate(issue_key=KEY)
```

> **HR6:** `cache_invalidate` is MANDATORY after every Jira write — including the fallback path. Never skip.

### 7. Optional Transition

Use `status.name` from Phase A. Parse `$ARGUMENTS` for `--done` flag → target = "Done"; otherwise target = "In Review".

If status is `"In Progress"` or `"In Development"`: fetch transitions, find matching target (case-insensitive). If found, ask user to confirm transition. On approval: `jira_transition_issue` + `cache_invalidate`. If no matching transition: note and skip. If status is anything else or Phase A failed: skip silently.

### 8. Confirm

```text
✓ Jira {KEY} updated
  Comment: ADF / plain markdown (fallback)
  AC coverage: {N}/{M} confirmed / not available / skipped
  Transition: In Progress → In Review / skipped / not applicable
  Cache: invalidated
```

If MCP unavailable throughout: output the formatted comment with header `Post manually to Jira {KEY} — MCP tools not available in this session.`

## Output Format

Success: `✅ Posted to [JIRA-KEY] — comment ID: [id]`. ADF fallback: `⚠️ ADF failed, posted as markdown to [JIRA-KEY]`. MCP unavailable: prints comment content with header `Post this manually to [JIRA-KEY]:`.
