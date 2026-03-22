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

---

## Pre-deploy Safety Checks (Mode 2/3 only)

Run BEFORE creating any branch to avoid dangling remote branches on abort:

1. Dirty tree check (already done in SKILL.md pre-checks)
2. CI check (already done in SKILL.md pre-checks)
3. Concurrent hotfix check (already done in SKILL.md pre-checks)

---

## Shared Steps

### [1/15] Read current version

```bash
node -e "console.log(require('./package.json').version)"
```

Store as `{current_version}`.

**Mode 2:** next = patch increment (1.2.3 → 1.2.4)
**Mode 3:** next = minor increment (1.2.3 → 1.3.0), reset patch to 0

---

### [2/15] Prepare branch

**Mode 2 (hotfix):** Rebase with `main` if not up-to-date:

```bash
git fetch origin
git log --oneline origin/main..HEAD
```

If behind: `git rebase origin/main`
Abort on conflict: "Rebase conflict with main. Resolve manually then re-run /merge-pr"

Then capture fix commit SHAs BEFORE the version bump commit (required for cherry-pick order):

```bash
git log --reverse --pretty=%H origin/main..HEAD
```

Store as `{fix_shas}` (space-separated, chronological oldest-first). These are the commits to backport.

**Mode 3 (release from develop):** If on `develop`, create and push release branch first:

```bash
git checkout -b release/v{next_minor}
git push -u origin release/v{next_minor}
```

If already on `release/*` → skip branch creation, use current branch.

---

### [3/15] Bump version in package.json

Edit `package.json` — update the `"version"` field to `{next_version}`.

Use `Read` to get current content, then `Edit` to replace the version string. Do not use `npm version` (it auto-commits and may interfere).

Verify:

```bash
node -e "console.log(require('./package.json').version)"
```

---

### [4/15] Update CHANGELOG.md

Load [changelog-format.md](changelog-format.md) for format reference.

Generate draft entries from git log:

**Mode 2:**

```bash
git log --pretty=format:"- %s" {fix_shas}
```

(Pass space-separated SHAs, one per invocation via `git show --format="- %s" --no-patch SHA` if multi-line needed)

**Mode 3:**

```bash
git log --pretty=format:"- %s" origin/main..HEAD
```

Add new section at the top of CHANGELOG.md (after the `# Changelog` header):

```markdown
## [{next_version}] - {today_date}
### Fixed          ← Mode 2
### Added          ← Mode 3 (use appropriate sections)
- {generated entries — edit as needed}
```

Show draft to user, then call `AskUserQuestion` (question: "Review CHANGELOG entries — proceed?",
header: "CHANGELOG", options: `[{ label: "Looks good, continue" }, { label: "Abort" }]`).
Abort if "Abort".

---

### [5/15] Commit version bump

```bash
git commit -am "chore: bump version to {next_version}"
```

---

### [6/15] Show confirmation gate

```text
=== merge-pr: Ready to execute ===
Mode:    {Hotfix|Release} deploy
Branch:  {branch} → main
Version: {current} → {next_version}
Tag:     v{next_version}
Backport: {backport_target}
```

Call `AskUserQuestion` (question: "Proceed with merge?", header: "Confirm",
options: Yes/No as defined in SKILL.md § Confirmation Gate). Abort if "No, abort".

---

### [7/15] Create/update PR to main and merge

Check if PR to main already exists:

```bash
gh pr list --head {branch} --base main --json number --jq '.[0].number'
```

If no PR exists, create one:

```bash
gh pr create --base main --head {branch} --title "chore: release v{next_version}" --body "Release v{next_version}"
```

Note: do NOT use `--fill` together with `--title` — they conflict. Use `--title` + `--body` directly.

Merge:

```bash
gh pr merge --admin --merge --delete-branch
```

---

### [8/15] Checkout main and pull

Required before tagging — local checkout is still on the deploy branch after remote merge:

```bash
git checkout main && git pull origin main
```

---

### [9/15] Delete local deploy branch

```bash
git branch -d {deploy_branch}
```

Use `-d` (not `-D`) to confirm the branch was fully merged. If `-d` fails → partial-failure: warn user and continue (do not abort — tag and backport are still needed).

---

### [10/15] Create and push annotated tag

```bash
git tag -a v{next_version} -m "Release v{next_version}"
git push origin v{next_version}
```

Abort if tag already exists: "Tag v{next_version} already exists. This should not happen — investigate before continuing."

---

### [11/15] Detect backport target

**Mode 2 (hotfix):**

```bash
git branch -r | grep "origin/release/" | head -1
```

If result non-empty → backport to that release branch (strip `origin/` prefix).
Else → backport to `develop`.

**Mode 3 (release):**

If origin was `develop` (user ran from develop and we created the release branch) → SKIP backport entirely. Develop is already the ancestor.

If origin was `release/*` → backport version-bump commit(s) to `develop`.

To detect: check if `{backport_target}` == `develop` and original branch was `develop` → skip.

---

### [12/15] Create backport branch

```bash
git checkout -b backport/{original_branch_suffix}
```

Example: `hotfix/ABC-456-fix-crash` → `backport/hotfix-ABC-456-fix-crash`

---

### [13/15] Cherry-pick commits

**Mode 2:** Cherry-pick all `{fix_shas}` in chronological order (oldest-first, captured in step 2):

```bash
git cherry-pick $fix_shas
```

Note: `$fix_shas` must be unquoted for shell word-splitting to enumerate SHAs correctly.

**Mode 3:** Cherry-pick the version-bump commit only:

```bash
git cherry-pick {version_bump_sha}
```

On conflict → abort cherry-pick: `git cherry-pick --abort`. Continue to step 14 but skip auto-merge.

---

### [14/15] Push backport branch and create/merge PR

Push:

```bash
git push -u origin backport/{suffix}
```

Create PR:

```bash
gh pr create --base {backport_target} --head backport/{suffix} --title "backport: {original_branch_suffix}" --body "Backport of {original_branch} to {backport_target}"
```

If no cherry-pick conflict → merge immediately:

```bash
gh pr merge --admin --merge --delete-branch
```

If cherry-pick conflict occurred → do NOT auto-merge. Report: "Backport PR #{n} created but has conflicts — manual resolution needed before merging."

---

### [15/15] Post-merge verification

```bash
git tag -l v{next_version}
git branch -r | grep {deploy_branch} || echo "remote branch deleted ✓"
gh pr list --base {backport_target} --state merged --search "backport"
```

Report results in final summary:

```text
✓ Merged: {branch} → main
✓ Branch deleted: {branch}
✓ Tag: v{next_version}
✓ Backport: #{backport_pr} → {backport_target}
```
