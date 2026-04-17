# Mode 1: Feature/Bugfix Merge Workflow

Merge a `feature/*` or `bugfix/*` branch into `develop` via PR.

## Steps

**[1/6] Verify base branch**

Check that `develop` exists on remote:

```bash
git branch -r | grep origin/develop
```

Abort if missing: "Remote branch `develop` not found."

**[2/6] Check if rebase needed**

```bash
git fetch origin
git log --oneline origin/develop..HEAD
```

If HEAD is already up-to-date with `origin/develop` → skip rebase. If behind:

```bash
git rebase origin/develop
```

Abort on conflict: "Rebase conflict with develop. Resolve manually then re-run /merge-pr"

**[3/6] Get PR number**

Use PR number from $ARGUMENTS if provided. Otherwise auto-detect:

```bash
gh pr view --json number --jq '.number'
```

If empty → prompt: "No PR found for this branch. Enter PR number (or press Enter to view open PRs):"
If user presses Enter: `gh pr list --base develop --state open`

**[4/6] Show confirmation gate**

```text
=== merge-pr: Ready to execute ===
Mode:   Feature/bugfix merge
Branch: {branch} → develop
PR:     #{pr_number}
```

Follow SKILL.md § Confirmation Gate. If `{auto_confirm}` (`--yes`/`-y` in `$ARGUMENTS`), append
`Auto-confirm: on — proceeding without prompt.` and skip `AskUserQuestion`. Otherwise call
`AskUserQuestion` (question: "Proceed with merge?", header: "Confirm", Yes/No). Abort if "No, abort".

**[5/6] Merge PR**

```bash
gh pr merge {pr_number} --admin --merge --delete-branch
```

`--admin` bypasses required reviews and CI gates. `--merge` creates a merge commit (preserves history per git-flow). `--delete-branch` removes the remote branch.

If merge fails → report error output and abort. Do not attempt cleanup.

**[6/6] Final summary**

```text
✓ Merged: {branch} → develop
✓ Branch deleted: {branch}
PR #{pr_number} is now closed.
```
