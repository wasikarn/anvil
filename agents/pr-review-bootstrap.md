---
name: pr-review-bootstrap
description: "Bootstraps PR review context by fetching PR diff, Jira issue, and AC in one fast pass. Use at the START of any PR review session before dispatching review agents. Accepts PR number or branch name as input. Returns structured review context: changed files, Jira AC, PR description, and file groups for parallel agent dispatch."
tools: Bash, Read, mcp__jira-cache-server__cache_get_issue, mcp__mcp-atlassian__jira_get_issue
model: haiku
argument-hint: "[pr-number-or-branch] [jira-key?]"
disallowedTools: Edit, Write
maxTurns: 15
---

# PR Review Bootstrap

Gather all context needed for a PR review in one pass. Output a structured block that the main session can use directly to dispatch review agents — no redundant tool calls.

## Steps

### 1. Get PR Info

```bash
gh pr view --json number,title,body,headRefName,baseRefName,url
rtk gh pr diff
git diff --name-only origin/main...HEAD
```

### 2. Extract Jira Ticket

Look for ticket ID in:

- Branch name (e.g. `feature/PROJ-123-...`)
- PR title (e.g. `[PROJ-123]` or `PROJ-123:`)
- PR body

If found, fetch ticket using fallback order:

1. `jira-cache-server` → `cache_get_issue` (preferred)
2. `mcp-atlassian` → `jira_get_issue` (fallback)
3. Neither available → skip Jira section, continue without AC

Extract acceptance criteria from the issue description or custom fields.

### 3. Group Changed Files

Categorize changed files by concern:

- `domain/` or `app/` → business logic
- `infrastructure/` or `providers/` → adapters/DB/HTTP
- `tests/` or `*.spec.*` or `*.test.*` → tests
- `*.tsx` / `*.jsx` → UI components
- config files → configuration

### 4. Output Structured Context

Return this exact block — nothing else:

```markdown
## PR Review Context

**PR:** #[number] — [title]
**Branch:** [head] → [base]
**URL:** [url]

### Jira: [TICKET-ID]
**Summary:** [one line]
**Acceptance Criteria:**
[AC list, verbatim from Jira]

### Changed Files ([count] files)
**Business Logic:** [files]
**Infrastructure:** [files]
**Tests:** [files]
**UI:** [files]
**Config:** [files]

### Suggested Agent Groups (for parallel dispatch)
- Group A: [files] → code-reviewer + silent-failure-hunter
- Group B: [files] → pr-test-analyzer
- Group C: [files] → type-design-analyzer (if new types)

### PR Diff Summary
[3-5 bullet points describing what changed at a high level]
```

If no Jira ticket found, skip that section. Keep output concise — this is input to another agent, not a human report.
