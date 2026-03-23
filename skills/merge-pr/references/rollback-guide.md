# Rollback Guide

Loaded when a step fails. This guide is **read-only** — it presents recovery commands for the user
to run manually. Do not execute these commands automatically.

Identify which step failed and follow the corresponding recovery procedure.

---

## Before Confirmation Gate (Steps 1–6)

No irreversible git operations have run.

- No rollback needed
- Fix the issue (e.g., resolve lint, correct version format) and re-run `/merge-pr`

---

## After version bump commit, before merge (between Steps 6–8)

The version bump commit exists locally but has not been pushed or merged.

```bash
git reset HEAD~1                      # undo the version bump commit
git checkout -- {version_file}        # restore the version file to its original state
```

Then fix the issue and re-run `/merge-pr`.

---

## After merge to main, before tag (between Steps 8–11)

The PR is already merged (`state=MERGED`). **Do NOT re-run `/merge-pr`** — the skill will abort on
`PR already merged`. Tag and backport manually:

```bash
git checkout main
git pull origin main
git tag -a v{version} -m "Release v{version}"
git push origin v{version}
```

Then create the backport branch manually (see backport steps below).

---

## After tag created locally, before push (mid-Step 11)

```bash
git tag -d v{version}   # delete local tag only
```

Then retry `git tag -a v{version} -m "..." && git push origin v{version}`.

---

## After tag pushed to origin (after Step 11)

⚠️ Destructive — only do this if the release must be fully retracted.

```bash
git push origin :refs/tags/v{version}   # delete remote tag
git tag -d v{version}                   # delete local tag
```

Confirm with the user before executing this.

---

## After backport cherry-pick conflict (Step 13)

```bash
git cherry-pick --abort
git checkout {previous_branch}           # e.g. main or develop
git branch -d backport/{suffix}          # delete local backport branch
```

If the backport branch was already pushed:

```bash
git push origin --delete backport/{suffix}
```

Resolve conflicts manually in the source branch, then re-create the backport PR.

---

## After backport branch pushed with conflict (Step 13, PR created but not merged)

The backport PR exists on GitHub. Resolve conflicts directly in the PR:

1. Check out the backport branch
2. Resolve conflicts manually
3. Push the resolved commits
4. Merge the PR via GitHub UI or `gh pr merge`
