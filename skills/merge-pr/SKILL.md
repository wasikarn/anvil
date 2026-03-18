---
name: merge-pr
description: "Automates git-flow merge and deploy for any project. Use /merge-pr to merge a feature/bugfix PR, deploy a hotfix to production, or cut a release. Handles version bumps, CHANGELOG updates, tags, backport PRs, and post-merge verification. Three modes: (1) feature/bugfix → merge to develop; (2) hotfix → deploy to production + backport; (3) release → deploy to production + backport. Requires gh CLI and a clean working tree."
argument-hint: "[pr-number?] [--hotfix?] [--release?]"
disable-model-invocation: true
compatibility: "Requires gh CLI (authenticated) and a git repository with a GitHub remote."
allowed-tools: Bash(git *), Bash(gh *), Read, Edit, Grep
---

# merge-pr — Git-flow Merge & Deploy

**Branch:** !`git branch --show-current`
**Status:** !`git status --porcelain | head -5`
**Args:** $ARGUMENTS

---

## Mode Detection

Parse args for position-independent flags:

| Priority | Condition | Mode |
| --- | --- | --- |
| 1 | `--hotfix` in $ARGUMENTS | 2: Hotfix deploy |
| 2 | `--release` in $ARGUMENTS | 3: Release deploy |
| 3 | branch starts with `hotfix/` | 2: Hotfix deploy |
| 4 | branch starts with `release/` or branch is `develop` | 3: Release deploy |
| 5 | branch starts with `feature/` or `bugfix/` | 1: Feature/bugfix merge |
| 6 | none match | Ask user which mode |

PR number: extract non-flag token from $ARGUMENTS, else auto-detect with `gh pr view --json number --jq '.number'`.

---

## Pre-execution Safety Checks

Run all checks before any merge operation. Abort immediately on failure unless noted.

| # | Check | Command | Abort condition |
| --- | --- | --- | --- |
| 0 | Remote configured | `git remote get-url origin` | fails — gh CLI needs GitHub remote |
| 1 | Clean working tree | `git status --porcelain` | output non-empty — uncommitted changes break rebase |
| 2 | Fetch remote | `git fetch origin` | fails — stale state causes wrong rebase decisions |
| 3 | PR status | `gh pr view --json isDraft,state,mergeable --jq '{isDraft,state,mergeable}'` | isDraft=true, state=MERGED, or mergeable=CONFLICTING |
| 4 | CI checks | `gh pr checks` | any failing → **warn** via `AskUserQuestion` ("CI failing — --admin will bypass. Continue?") |
| 5 | No PR found | (if auto-detect returns empty) | prompt user for PR number |
| 6 | Mode 2/3: concurrent hotfix | see command below table | any result → **warn** via `AskUserQuestion` ("Found open hotfix PR. Proceed anyway?") |

Check 6 command (concurrent hotfix detection):

```bash
gh pr list --state open --base main --json headRefName \
  --jq '.[] | select(.headRefName | startswith("hotfix/")) | .headRefName'
```

---

## Reference Loading

| File | Load when |
| --- | --- |
| [references/workflow-feature.md](references/workflow-feature.md) | Mode 1 — feature/bugfix merge |
| [references/workflow-deploy.md](references/workflow-deploy.md) | Mode 2 or 3 — hotfix/release deploy |
| [references/changelog-format.md](references/changelog-format.md) | Mode 2 or 3 — before editing CHANGELOG.md |

Load the relevant reference file now, then follow its steps exactly.

---

## Confirmation Gate

Before any merge, tag, or delete operation, show this summary then use `AskUserQuestion` with Yes/No options:

```text
=== merge-pr: Ready to execute ===
Mode:    {mode name}
Branch:  {branch} → {target}
Version: {current} → {next} (Mode 2/3 only)
Tag:     v{version} (Mode 2/3 only)
Backport: {backport_target} (Mode 2/3 only)
PR:      #{pr_number}
```

Call `AskUserQuestion` with:

- question: "Proceed with merge?"
- header: "Confirm"
- options: `[{ label: "Yes, proceed", description: "Execute merge and all follow-up steps" }, { label: "No, abort", description: "Cancel — no changes will be made" }]`

Abort cleanly if user selects "No, abort".

---

## Progress Format

Report at every step:

```text
[1/N] ✓ Step description
[2/N] ⟳ Running step...
[3/N] ✗ Error message — {recovery instructions}
```

---

## Final Summary

```text
✓ Merged: {branch} → {target}
✓ Branch deleted: {branch}
✓ Tag: v{version}       (Mode 2/3)
✓ Backport: #{pr} → {backport_target}  (Mode 2/3)
```

---

## Edge Cases

| Scenario | Action |
| --- | --- |
| Dirty working tree | Abort: "Uncommitted changes. Commit or stash first." |
| Draft PR | Abort: "PR is still draft. Mark ready for review first." |
| PR already merged | Abort: "PR already merged. Nothing to do." |
| CI checks failing | Warn via `AskUserQuestion`: "CI failing — --admin will bypass. Continue?" (Yes/No) |
| No PR found for branch | Prompt user for PR number or offer `gh pr list` |
| Rebase conflict | Abort: "Rebase conflict. Resolve manually then re-run /merge-pr" |
| Tag already exists | Abort: "Tag v{version} already exists. Bump version manually first." |
| Concurrent open hotfix PR | Warn via `AskUserQuestion`: "Found open hotfix PR #{n}. Proceed anyway?" (Yes/No) |
| Active release branch during hotfix | Auto-detect and backport to release branch instead of develop |
| Backport cherry-pick conflict | Create PR but don't auto-merge: "Backport has conflicts — manual resolution needed." |
| No GitHub remote | Abort: "No GitHub remote found. Cannot use gh CLI." |
| Not on expected branch type | Show detected mode, confirm with user before proceeding |
