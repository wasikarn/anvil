# PR Template

## Phase 6 Summary (present before completion options)

```markdown
## Implementation Complete

**Task:** {task_description}
**Mode:** {Full|Quick}
**Iterations:** {count}/3
**Final status:** Critical: 0, Warning: {Y}, Info: {Z}

### Iteration History
| Iter | Critical | Warning | Action |
| --- | --- | --- | --- |
| 1 | ... | ... | ... |
| 2 | ... | ... | ... |
```

## PR Title

English, under 70 chars, start with verb — derived from the plan problem statement.

## PR Description (Thai)

```markdown
## สิ่งที่เปลี่ยนแปลง
{สรุปสิ่งที่แก้/เพิ่ม จาก plan problem statement — 2-3 ประโยค}

## เหตุผล
{ทำไมต้องทำ และ approach ที่เลือก จาก plan rationale}

## วิธีทดสอบ
{test strategy จาก plan — unit/integration/manual steps}

## Jira
{BEP-XXXX หรือ N/A}

## AC Checklist
{แสดงก็ต่อเมื่อมี Jira key — ดึงจาก .claude/dlc-build/dev-loop-context.md}
- [x] {AC1 description}
- [x] {AC2 description}
```

Run: `gh pr create --title "{title}" --body "{description}" --base {base_branch}`

## Hotfix Backport (--hotfix mode only)

After the hotfix PR is created (targeting `main`), create a backport PR to `develop`:

```bash
# Create backport branch from develop
git checkout develop && git pull
git checkout -b backport/{hotfix-branch-name}
git cherry-pick {fix_commit_sha(s)}

# Push and open backport PR
gh pr create \
  --title "backport: {original_hotfix_title}" \
  --body "Backport of #{hotfix_pr_number} to develop.\n\nOriginal: #{hotfix_pr_number}" \
  --base develop
```

If cherry-pick conflicts → note the conflict in backport PR description, assign to author.
