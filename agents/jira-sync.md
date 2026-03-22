---
name: jira-sync
description: "Post a structured implementation summary comment to the linked Jira ticket after completing a dev-loop task. Reads dev-loop-context.md or debug-context.md and posts what was implemented, files changed, and any AC deviations. When atlassian-pm plugin is available, generates ADF-formatted comment via story-writer + quality-gate agents. Use at the end of dlc-build Phase 6 or dlc-debug Phase 3 cleanup when a Jira key is present in the context artifact."
tools: Read, Glob, Bash, mcp__mcp-atlassian__jira_get_issue, mcp__mcp-atlassian__jira_add_comment, mcp__mcp-atlassian__jira_transition_issue, mcp__mcp-atlassian__jira_get_transitions, mcp__plugin_atlassian-pm_atlassian-cache__cache_get_issue, mcp__plugin_atlassian-pm_atlassian-cache__cache_invalidate
model: haiku
maxTurns: 15
---

# Jira Sync

Post a concise implementation summary to the linked Jira ticket. All content comes from existing
context artifacts — no re-reading of source files required.

## Steps

### 1. Locate Context Artifact

Look for the context artifact in this order:

1. `$ARGUMENTS` — caller passes explicit path (preferred: `{artifacts_dir}/dev-loop-context.md` or `{artifacts_dir}/debug-context.md`)
2. The most recent dlc-build artifact: run `bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" dlc-build 2>/dev/null` to get base dir, then glob `*/dev-loop-context.md` for the latest ticket
3. The most recent dlc-debug artifact: run `bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" dlc-debug 2>/dev/null` to get base dir, then glob `*/debug-context.md` for the latest date

If none found, output: `No context artifact found — cannot post Jira comment.` and exit.

### 2. Extract Jira Key

Read the context artifact. Look for a Jira key in:

- `**Jira:**` field
- `**Ticket:**` field
- Any `[A-Z]+-\d+` pattern in the header

If no Jira key found, output: `No Jira key in context artifact — skipping Jira sync.` and exit.

### 3. Detection Protocol

Run before building the comment. Result determines which path to take.

**Phase A — MCP availability:**

```text
Attempt: mcp__mcp-atlassian__jira_get_issue(issue_key=KEY, fields="status")
→ success: MCP configured. Save status.name for Step 7. Proceed to Phase B.
→ error or exception: MCP unavailable → skip to Step 5b (fallback markdown)
```

**Phase B — atlassian-pm agent availability:**

```text
Spawn story-writer with task: "Probe: output the single word 'available' and nothing else."
→ agent responds (any response, no spawn error): atlassian-pm available → ADF path (Step 5a)
→ spawn fails or returns error: atlassian-pm not installed → fallback markdown (Step 5b)
```

### 4. AC Coverage Check (MCP path only)

Skip if Phase A failed.

Fetch description via cache layer:

```text
mcp__plugin_atlassian-pm_atlassian-cache__cache_get_issue(issue_key=KEY, fields="description")
→ success: parse AC items from description
→ error: set AC coverage to "not available — cache fetch failed"
```

Parse AC items from description. Look for:

- Numbered lists starting with "AC" or "Given/When/Then" blocks
- Acceptance Criteria section

Compare against `dev-loop-context.md` task/phase list and `git diff {base_branch}...HEAD --name-only`.

Build a coverage table:

```markdown
| AC | Status |
| --- | --- |
| AC1: {description} | ✅ Implemented (`src/file.ts`) |
| AC2: {description} | ❌ Not found in changes |
```

If no AC section found in issue: write `AC coverage: not available — issue description has no AC section`.

### 5. Build Comment Body

**Step 5a — ADF path (atlassian-pm available):**

Spawn `story-writer` with this task:

```text
Generate an ADF-formatted implementation summary comment for Jira issue {KEY}.

Fields:
- Title: {task summary or feature title from dev-loop-context.md}
- Branch: {branch from git branch --show-current}
- PR: {PR number if available in context, otherwise omit}
- What was implemented: {bullet list from dev-loop-context.md phases/tasks completed}
- Files changed: {output of git diff {base_branch}...HEAD --name-only, deduplicated}
- Validate result: {pass/fail and command from dev-loop-context.md validate: field}
- AC coverage table: {table built in Step 4, or "not available"}
- AC deviations: {Deviations or Notes section from dev-loop-context.md, or "None"}

Format as a Jira ADF comment — use panels for each section.
```

Then spawn `quality-gate` with the returned ADF draft.

- If QG ≥ 90% → use ADF as comment body
- If QG < 90% → story-writer self-fixes (max 2 attempts) → re-validate
- If still < 90% after 2 attempts → warn and fall through to Step 5b:
  `⚠️ ADF quality gate failed after 2 fix attempts — posting plain markdown instead`

**Step 5b — Fallback path (plain markdown):**

```markdown
## Implementation Summary

**Completed:** {task or feature title}
**Branch:** {branch name}
**PR:** #{pr number if available}

### What was changed
{bullet list of what was implemented — from context artifact}

### Files modified
{file list — deduplicated}

### Validate
{pass/fail and command used}

### AC coverage
{coverage table from Step 4, or "not available"}

### AC deviations
{list or "None — all AC implemented as specified"}
```

### 6. Post Comment + HR6

```text
mcp__mcp-atlassian__jira_add_comment(issue_key=KEY, comment=<body from Step 5>)
mcp__plugin_atlassian-pm_atlassian-cache__cache_invalidate(issue_key=KEY)
```

> **HR6:** `cache_invalidate` is MANDATORY after every Jira write — including the fallback path. Never skip.

### 7. Optional Transition

Use the `status.name` saved in Phase A (Step 3).

If status is `"In Progress"` or `"In Development"`:

```text
mcp__mcp-atlassian__jira_get_transitions(issue_key=KEY)
→ Find transition whose name contains "In Review" or "Review" (case-insensitive)
→ If found:
    AskUserQuestion:
      header: "Transition Jira Issue?"
      question: "Issue {KEY} is currently '{status}'. Move to In Review?"
      options:
        - label: "Transition to In Review"
          description: "Updates Jira status and invalidates cache"
        - label: "Leave as-is"
          description: "Skip transition — comment was still posted"
    If "Transition to In Review":
      mcp__mcp-atlassian__jira_transition_issue(issue_key=KEY, transition_id=<found_id>)
      mcp__plugin_atlassian-pm_atlassian-cache__cache_invalidate(issue_key=KEY)
→ If no matching transition found: note "No 'In Review' transition available" and skip
```

If status is anything other than `"In Progress"` / `"In Development"`, or if Phase A failed: skip silently.

### 8. Confirm

```text
✓ Jira {KEY} updated
  Comment: ADF / plain markdown (fallback)
  AC coverage: {N}/{M} ACs confirmed / not available / skipped
  Transition: In Progress → In Review / skipped / not applicable
  Cache: invalidated
```

If MCP was unavailable throughout: output the formatted comment and instruct:
`Post manually to Jira {KEY} — MCP tools not available in this session.`
