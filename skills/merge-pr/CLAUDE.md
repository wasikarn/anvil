# merge-pr skill

Automates git-flow merge and deploy workflows for any project following git-flow branching.

## Architecture

```text
skills/merge-pr/
  SKILL.md                              — entry point: mode detection, safety checks, confirmation gate
  references/workflow-feature.md        — Mode 1: feature/bugfix → develop (6 steps)
  references/workflow-deploy.md         — Mode 2+3: hotfix/release → main + tag + backport (14 steps)
  references/changelog-format.md        — Keep a Changelog template and rules
  references/version-detector.md        — auto-detect version file (package.json, pyproject.toml, setup.cfg)
  references/changelog-writer.md        — hybrid CHANGELOG generation (9-step algorithm)
  references/post-merge-integrations.md — GitHub Release + Jira comment (auto, non-blocking)
  references/rollback-guide.md          — per-step recovery commands (loaded on failure only)
```

SKILL.md loads reference files on-demand — only the relevant mode's file is loaded per invocation.

## Modes

| Mode | Trigger | Target | Risk |
| --- | --- | --- | --- |
| 1: Feature/Bugfix | `feature/*`, `bugfix/*` | develop | Low |
| 2: Hotfix | `hotfix/*` or `--hotfix` | main | High |
| 3: Release | `release/*`, `develop`, or `--release` | main | High |

## Design Decisions

- `disable-model-invocation: true` — merge/tag/delete are irreversible; user must explicitly invoke
- `--admin` bypass on `gh pr merge` — bypasses required reviews/CI; CI failures warn but don't abort
- fix_shas captured BEFORE version bump commit (step 2 in deploy workflow) — version bump SHA must not be cherry-picked into backport
- Cherry-pick uses unquoted `$fix_shas` — shell word-splitting required to enumerate multiple SHAs
- Annotated tags (`git tag -a`) — carries message, shows author/date in `git log`
- Hotfix backport → release branch (if active) instead of develop — release will merge to develop anyway (Atlassian git-flow)
- `git branch -d` (not `-D`) for local cleanup — confirms branch was merged before deleting
- `version-detector.md` loaded on-demand — reads and writes version file for package.json, pyproject.toml, setup.cfg; verifies write-back before committing
- `changelog-writer.md` loaded on-demand — hybrid algorithm: moves [Unreleased] entries + supplements from git log; categorizes by conventional commit prefix; no AskUserQuestion
- `post-merge-integrations.md` loaded after tag push — creates GitHub Release with CHANGELOG section as notes; posts Jira comment if jira-key in args; both non-blocking
- `rollback-guide.md` loaded on failure — read-only recovery guide per step; does not execute commands

## Validate After Changes

```bash
# Lint markdown
npx markdownlint-cli2 "skills/merge-pr/**/*.md"

# Verify symlink
ls -la ~/.claude/skills/merge-pr

# Re-link after changes
bash scripts/link-skill.sh merge-pr
```

## Gotchas

- `gh pr create --fill` and `--title` conflict — use `--title` + `--body` directly
- `git cherry-pick $fix_shas` must be unquoted — quoted `"$fix_shas"` passes as single argument
- After `gh pr merge --delete-branch`, local branch still exists — step 9 deletes it explicitly
- `git checkout main && git pull` required BEFORE tagging — local is still on deploy branch post-merge
- `git log --pretty=%H origin/main..HEAD` captures all commits including future version-bump — capture BEFORE committing version bump
