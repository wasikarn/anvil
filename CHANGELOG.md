# Changelog

All notable changes to this project will be documented in this file.

## [0.6.13] — 2026-03-22

### Add good/bad examples to 5 skills

- fix(examples): correct broken relative links in dlc-review and optimize-context examples
- docs(skills): add good/bad examples to 5 skills
- feat: add domain expert persona to all 8 SKILL.md files
- docs: add Good/Bad examples and templates to all skills and reference docs
- feat(skills): add effort field and ultrathink to analysis-heavy skills
- feat(scripts): add -y flag to bump-version.sh for non-interactive release

## [0.6.12] — 2026-03-20

### Artifact Path Refactor

- refactor(docs): make artifact-dir.sh single source of truth for artifact path
- fix(scripts): move artifact storage out of ~/.claude/projects/ namespace

## [0.6.11] — 2026-03-20

### Add QA check script and integrate with bump-version

- feat(scripts): add qa-check.sh and integrate into bump-version pre-release gate

## [0.6.10] — 2026-03-20

### Shellcheck Hook Fixes

- fix(hooks): resolve shellcheck SC2001/SC1003 in post-compact-context and stop-failure-log

## [0.6.9] — 2026-03-20

### Fix task-gate and idle-nudge false-positive block when env vars unset

- fix(hooks): guard against empty GATE_PATTERN/NUDGE_PATTERN causing false-positive block

## [0.6.8] — 2026-03-20

### Auto-generate CHANGELOG entry in bump-version

- feat(scripts): auto-generate CHANGELOG entry on bump-version

## [0.6.6] — 2026-03-20

### Fixed

- Broken relative links in `dlc-build/references/phase-0-triage.md` and `phase-4-review.md` (2-level `../../references/` → 3-level `../../../references/` from within `references/` subdir)
- Broken `debate-protocol.md` link in `dlc-review/SKILL.md` and `dlc-build/SKILL.md` (was pointing to non-existent `dlc-review/references/debate-protocol.md`)

### Added

- MIT `LICENSE` file (referenced by README badge)

## [0.6.5] — 2026-03-20

### Fixed

- `artifact-dir.sh`: suffix ending with `-` (e.g. `pr-` when PR number is empty) now falls back to base dir instead of creating a malformed directory name

## [0.6.4] — 2026-03-20

### Fixed

- `check-deps.sh`: false positive atlassian-pm "not installed" warning — settings.json stores the key as `"atlassian-pm"` (without `@scope` suffix); added plugin cache directory fallback

## [0.6.3] — 2026-03-20

### Fixed

- `check-deps.sh`: corrected atlassian-pm install command and detection logic

## [0.6.2] — 2026-03-20

### Fixed

- Bootstrap and onboarder agents: stale `.claude/` artifact paths updated to centralized `~/.claude/projects/` convention

## [0.6.1] — 2026-03-20

### Fixed

- `marketplace.json`: added `metadata.description` to fix plugin validator warning

## [0.6.0] — 2026-03-20

### Added

- `scripts/bump-version.sh`: automated version bumping with semver validation, color output, git tag, push, and GitHub release creation; shows Fresh install vs Update paths in next-steps

## [0.5.0] — 2026-03-20

### Added

- Centralized artifact paths: all skill-generated files now stored at `~/.claude/projects/<encoded-project>/dev-loop/<skill>/` instead of polluting the target project directory
- `scripts/artifact-dir.sh`: single source of truth for artifact path computation; called via `!` shell substitution in SKILL.md headers

### Changed

- `dlc-build`, `dlc-review`, `dlc-debug`, `dlc-respond` SKILL.md files updated to use `{artifacts_dir}` header variable
- All phase reference files updated to use `{artifacts_dir}` instead of hardcoded `.claude/dlc-build/` paths

## [0.4.0] — 2026-03-19

### Added

- `/dlc-metrics` skill: surfaces `metrics-analyst` agent for retrospective reports from `dlc-metrics.jsonl`
- `/dlc-onboard` skill: surfaces `project-onboarder` agent for bootstrapping new projects

### Changed

- Skills table in CLAUDE.md updated to include new skills

## [0.3.1] — 2026-03-19

### Fixed

- `commit-finalizer` agent: documented pre-conditions and Agent tool access for workers
- `pr-review-bootstrap`: removed dead cross-plugin agent references from output

## [0.3.0] — 2026-03-19

### Added

- `dlc-debug`: Jira sync call and metrics logging in Phase 3
- `jira-sync` agent: posts structured implementation summary to Jira after dlc-build/dlc-debug

## [0.2.0] — 2026-03-19

### Added

- `dlc-metrics` agent (`metrics-analyst`): retrospective report from `~/.claude/dlc-metrics.jsonl`
- `dlc-onboard` agent (`project-onboarder`): bootstrap new project into dev-loop ecosystem
- `work-context` agent: session start digest (active sprint tickets, open PRs, unmerged branches)
- `jira-sync` agent, `merge-preflight` agent, `metrics-analyst` agent, `plan-challenger` agent
- `test-quality-reviewer`, `migration-reviewer`, `api-contract-auditor` agents
- `fix-intent-verifier`, `falsification-agent`, `research-validator`, `review-consolidator` agents
- `dlc-respond-bootstrap`, `dlc-debug-bootstrap` agents

## [0.1.0] — 2026-03-19

### Added

- **Skills:** `dlc-build`, `dlc-review`, `dlc-respond`, `dlc-debug`, `merge-pr`, `optimize-context`, `env-heal`, `systems-thinking`
- **Agents:** `commit-finalizer`, `dev-loop-bootstrap`, `dlc-debug-bootstrap`, `pr-review-bootstrap`, `review-consolidator`, `skill-validator`, `code-reviewer`
- **Hooks:** `check-deps`, `session-start-context`, `skill-routing`, `protect-files`, `task-gate`, `idle-nudge`, `post-compact-context`, `bash-failure-hint`, `stop-failure-log`, `subagent-stop-gate`, `shellcheck-written-scripts`
- **Output styles:** `senior-software-engineer`, `coding-mentor`
- **Commands:** `analyze-claude-features`
- Plugin manifest at `.claude-plugin/plugin.json`
