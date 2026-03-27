# Debug Artifact Templates

## debug-context.md

```markdown
# Debug Context

Bug: {description}
Severity: {P0/P1/P2}
Mode: {Full/Quick}
Project: {project_name}
Validate: {validate_command}
Started: {date}
Branch: {branch_name}

## Reproduction Steps
{from user description}

## Hard Rules
{project_hard_rules}

## Jira Context
{ticket title, priority, and key description — leave blank if no Jira key}

## Shared Context
{populated by Bootstrap step in Phase 2}

## Progress
- [ ] Phase 1: Triage
- [ ] Phase 2: Investigation
- [ ] Phase 3: Fix + Harden
- [ ] Phase 4: Fix Review (if --review or P0)
- [ ] Phase 5: Ship
```

## investigation.md

```markdown
# Investigation Report

## Root Cause
{Investigator findings — hypothesis, evidence, file:line}
**Recurrence Risk:** [Low/Medium/High] — [reason]

## DX Findings
| # | Sev | Category | File | Line | Issue | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Critical | Silent failure | ... | ... | ... | ... |

## Existing Resilience (0-2 items)
- [mechanism that already worked, e.g., "Error boundary in `ErrorHandler.ts:15` prevented cascade"]

## Fix Plan
1. [Bug] Fix root cause: {description}
2. [Test] Add regression test: {description}
3. [DX] {each DX improvement as separate item}
```

## Debug Summary

```markdown
## Debug Summary

**Bug:** {description}
**Root Cause:** {one-line}
**Fix:** {commit refs}
**DX Improvements:** {count} items (Critical: X, Warning: Y)
**Resolution Confidence:** [High/Medium/Low] — [reason]

### Commits
| # | Type | Description |
| --- | --- | --- |
| 1 | fix | ... |
| 2 | test | ... |
| 3 | dx | ... |

### Completion Options
1. Create PR
2. Commit to current branch
3. Keep for manual review
```
