---
name: work-context
description: "Session start work context digest — fetches active sprint tickets from Jira, open PRs awaiting your action, and recent unmerged local branches. Outputs a prioritized daily action table. Use proactively at session start or when resuming work after an interruption."
tools: Bash, Read
model: haiku
disallowedTools: Edit, Write
maxTurns: 10
---

# Work Context

Quickly reconstruct your work state at session start. One agent call replaces 4-5 manual lookups.

## Steps

### 1. Git State

```bash
git branch --show-current
git log --oneline -5
git stash list
git status --short
```

List all local branches with unpushed commits:

```bash
git branch -v | grep -v "^*" | awk '{print $1, $3}' | grep -v "\[gone\]" | head -10
```

### 2. Open PRs Awaiting Action

```bash
# PRs where you are the author and review was requested / changes requested
gh pr list --author "@me" --state open \
  --json number,title,reviewDecision,statusCheckRollup,updatedAt \
  --jq '.[] | {number, title, decision: .reviewDecision, ci: (.statusCheckRollup[0].state // "unknown"), updated: .updatedAt}' \
  2>/dev/null | head -10

# PRs where you are the requested reviewer
gh pr list --search "review-requested:@me" --state open \
  --json number,title,author,updatedAt \
  --jq '.[] | {number, title, author: .author.login, updated: .updatedAt}' \
  2>/dev/null | head -10
```

### 3. Active Jira Tickets (In Progress)

Fetch tickets assigned to the current user with status "In Progress":

```text
mcp__mcp-atlassian__jira_search(jql="assignee = currentUser() AND status = 'In Progress' ORDER BY updated DESC", fields=["summary","status","priority"], limit=5)
```

If `sprint-planner` agent (atlassian-pm plugin) is available, also fetch sprint context:
sprint name, days remaining, and total story points — append as a one-line header above the ticket table.

If MCP not available, skip this section — output:
`[Jira: skipped — install atlassian-pm plugin for Jira integration]`

### 4. Output Daily Digest

Return this block:

```markdown
## Work Context — {date}

### Active Branch
`{branch}` — {last commit summary}

### PRs Needing Your Action

| # | PR | Status | Action Needed |
| --- | --- | --- | --- |
| 1 | #42 Fix null check | CHANGES_REQUESTED | Address reviewer comments |
| 2 | #38 Add pagination | APPROVED | Ready to merge |

### Review Requests

| # | PR | From | Updated |
| --- | --- | --- | --- |
| 1 | #45 Refactor auth | teammate | 2h ago |

### Active Jira Tickets

| Key | Summary | Priority |
| --- | --- | --- |
| ABC-123 | Add health check endpoint | High |

### Unmerged Local Branches
{list of branches with last commit or "None"}
```

Omit sections where nothing was found. Keep output scannable — this is a quick orientation, not a report.
