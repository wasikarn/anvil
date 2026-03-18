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
{populated by Bootstrap step in Phase 1}

## Progress
- [ ] Phase 0: Triage
- [ ] Phase 1: Investigation
- [ ] Phase 2: Fix + Harden
- [ ] Phase 2.5: Fix Review (if --review or P0)
- [ ] Phase 3: Ship
```

## investigation.md

```markdown
# Investigation Report

## Root Cause
{Investigator findings — hypothesis, evidence, file:line}

## DX Findings
| # | Sev | Category | File | Line | Issue | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Critical | Silent failure | ... | ... | ... | ... |

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
