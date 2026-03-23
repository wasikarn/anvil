# Mode 2 & 3: Hotfix / Release Deploy Workflow

Both modes share the same production deploy pattern. Differences are documented inline.

| Step | Mode 2 (Hotfix) | Mode 3 (Release) |
| --- | --- | --- |
| Source branch | `hotfix/*` | `release/*` or `develop` |
| Target PR base | `main` | `main` |
| Version bump | patch (1.2.3 → 1.2.4) | minor (1.2.3 → 1.3.0) |
| CHANGELOG section | `### Fixed` | `### Added`, `### Changed`, etc. |
| Backport target | release branch (if active) else `develop` | `develop` (skip if origin was `develop`) |
| fix_shas capture | Yes — before version bump | No |

On any step failure → load [rollback-guide.md](rollback-guide.md) and show the matching recovery procedure.

---

## Pre-deploy Safety Checks (Mode 2/3 only)

Already performed in SKILL.md pre-checks: dirty tree, CI, concurrent hotfix.

---

## [1/14] Prepare branch

**Mode 2 (hotfix):** Rebase with `main` if not up-to-date:

```bash
git fetch origin
git log --oneline origin/main..HEAD
```

If behind: `git rebase origin/main`
Abort on conflict: "Rebase conflict with main. Resolve manually then re-run /merge-pr"

**Mode 3 (release from develop):** If on `develop`, create and push release branch first:

```bash
git checkout -b release/v{next_minor}
git push -u origin release/v{next_minor}
```

If already on `release/*` → skip branch creation, use current branch.

---

## [2/14] Detect version + compute next

Load [version-detector.md](version-detector.md) and follow Steps 1–2:

- Detect `{version_file}` and read `{current_version}`
- Compute `{next_version}` (patch for Mode 2, minor for Mode 3)

---

## [3/14] Capture fix_shas (Mode 2 only)

**Mode 2 only — skip this step for Mode 3.**

Before the version bump commit, capture fix commit SHAs in chronological order:

```bash
git log --reverse --pretty=%H origin/main..HEAD
```

Store as `{fix_shas}` (space-separated, chronological oldest-first). These are the commits to
backport — must be captured BEFORE the version bump commit.

---

## [4/14] Generate CHANGELOG

Load [changelog-writer.md](changelog-writer.md) and follow its algorithm (Steps 1–9).

Inputs available: `{next_version}`, `{fix_shas}` (Mode 2), today's date.
Output: `{changelog_file}` updated with new version section, `[Unreleased]` section removed.

No user prompt — show generated section in progress output and proceed.

---

## [5/14] Write version bump

Load [version-detector.md](version-detector.md) and follow Steps 3–4:

- Write `{next_version}` to `{version_file}` using the Edit tool
- Verify write-back — abort if mismatch

---

## [6/14] Commit version bump + capture SHA

```bash
git commit -am "chore: bump version to {next_version}"
```

Immediately after:

```bash
git rev-parse HEAD
```

Store as `{version_bump_sha}` (required for Mode 3 backport cherry-pick).

---

## [7/14] Confirmation Gate

```text
=== merge-pr: Ready to execute ===
Mode:    {Hotfix|Release} deploy
Branch:  {branch} → main
Version: {current_version} → {next_version}
Tag:     v{next_version}
Backport: {backport_target}
PR:      #{pr_number}
```

Call `AskUserQuestion` (question: "Proceed with merge?", header: "Confirm",
options: Yes/No as defined in SKILL.md § Confirmation Gate). Abort if "No, abort".

---

## [8/14] Create/update PR to main and merge

Check if PR to main already exists:

```bash
gh pr list --head {branch} --base main --json number --jq '.[0].number'
```

If no PR exists, create one:

```bash
gh pr create --base main --head {branch} --title "chore: release v{next_version}" --body "Release v{next_version}"
```

Note: do NOT use `--fill` together with `--title` — they conflict.

Merge:

```bash
gh pr merge --admin --merge --delete-branch
```

---

## [9/14] Checkout main and pull

Required before tagging — local checkout is still on the deploy branch after remote merge:

```bash
git checkout main && git pull origin main
```

---

## [10/14] Delete local deploy branch

```bash
git branch -d {deploy_branch}
```

Use `-d` (not `-D`) to confirm the branch was fully merged. If `-d` fails → warn and continue
(tag and backport are still needed).

---

## [11/14] Create and push annotated tag

```bash
git tag -a v{next_version} -m "Release v{next_version}"
git push origin v{next_version}
```

Abort if tag already exists: "Tag v{next_version} already exists. Investigate before continuing."

---

## [12/14] Post-merge integrations

Load [post-merge-integrations.md](post-merge-integrations.md) and follow Steps 1–3:

- Detect `{repo}` via `gh repo view`
- Create GitHub Release with CHANGELOG notes (auto, non-blocking)
- Post Jira comment if `{jira_key}` in `$ARGUMENTS` (auto, non-blocking)

---

## [13/14] Backport

**Detect backport target:**

Mode 2 (hotfix):

```bash
git branch -r | grep "origin/release/" | head -1
```

If result non-empty → backport to that release branch (strip `origin/` prefix).
Else → backport to `develop`.

Mode 3 (release):

If origin was `develop` (we created the release branch here) → SKIP backport entirely.
If origin was `release/*` → backport to `develop` using **merge** (not cherry-pick — see rationale below).

**Create backport branch:**

```bash
git checkout -b backport/{original_branch_suffix}
```

Example: `hotfix/ABC-456-fix-crash` → `backport/hotfix-ABC-456-fix-crash`

**Apply changes:**

```bash
# Mode 2: cherry-pick fix commits (hotfix commits not in develop)
git cherry-pick $fix_shas   # unquoted — shell word-splitting enumerates SHAs

# Mode 3: merge from tag (NOT cherry-pick)
# Rationale: develop already has all feature commits — only the version bump from
# the release branch is missing. git merge uses 3-way merge and cleanly selects
# the version bump without conflicts. Cherry-picking {version_bump_sha} causes
# CHANGELOG conflicts because develop doesn't yet have the version section.
git merge v{next_version}
```

**Mode 2 conflict:** `git cherry-pick --abort`. The backport branch now has no commits. Push the empty branch and create the PR — the engineer will resolve conflicts in the PR by pushing fixes manually.

**Mode 3 conflict:** `git merge --abort`. Investigate why — develop should already contain all feature commits. If unresolvable, push the empty branch and create the PR for manual resolution.

**Push and create PR:**

```bash
git push -u origin backport/{suffix}

gh pr create --base {backport_target} --head backport/{suffix} \
  --title "backport: {original_branch_suffix}" \
  --body "Backport of {original_branch} to {backport_target}"
```

If no conflict → auto-merge:

```bash
gh pr merge --admin --merge --delete-branch
```

If conflict occurred → do NOT auto-merge. Report:
"Backport PR #{n} created but has conflicts — load rollback-guide.md for resolution steps."

---

## [14/14] Post-merge verification + final summary

```bash
git tag -l v{next_version}
git branch -r | grep {deploy_branch} || echo "remote branch deleted ✓"
# If backport was auto-merged (no conflict):
gh pr list --base {backport_target} --state merged --search "backport"

# If backport has conflicts (PR open, not merged):
gh pr list --base {backport_target} --state open --search "backport"
```

Print final summary:

```text
✓ Merged: {branch} → main
✓ Branch deleted: {branch}
✓ Tag: v{next_version}
✓ GitHub Release: v{next_version}
✓ Backport: #{backport_pr} → {backport_target}   (if no conflict)
⚠ Backport: PR #{backport_pr} created with conflicts — resolve manually   (if conflict occurred)
✓ Jira: {jira_key} commented   (if applicable)
```
