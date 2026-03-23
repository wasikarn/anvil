# Changelog

All notable changes to this project will be documented in this file.

## [0.6.23] — 2026-03-23

### perf: domain-scoped lens injection — reduce session token usage ~60%

- **perf(dlc-review):** domain-scoped lens injection — T1→security/error-handling/typescript, T2→performance/database/api-design, T3→frontend/observability (was all→all); specialist agent cap: max 1 in priority order (test>api>migration), skip if PR<200 lines; debate broadcast now compact format (file:line+summary only)
- **perf(dlc-build):** domain-scoped lens injection for Phase 4 reviewers — same role assignment as dlc-review; phase-4-review.md Lens Selection table updated with all 8 lenses + domain column; adds missing api-design and observability lenses
- **perf(dlc-debug):** move dx-checklist.md from Load immediately → on-demand (Quick mode only); remove `{project_conventions}` injection from both Fixer prompts — CLAUDE.md is already auto-loaded, eliminating duplicate context injection

## [0.6.22] — 2026-03-23

### feat: domain expert ecosystem upgrade — review lenses, DX checklist, code-reviewer

- **feat(review-lenses):** add `api-design.md` lens — REST status Hard Rules (201/204/422), idempotency, backward-compat (removed fields, new required params), pagination, cursor vs OFFSET
- **feat(review-lenses):** add `observability.md` lens — structured logging Hard Rules (no string interpolation, no PII), correlation ID at entry points, trace propagation, metrics naming, alerting coverage
- **feat(review-lenses/frontend):** upgrade from 8 items → comprehensive lens: RSC/App Router boundary, hydration mismatches, streaming + Suspense, Server Actions security, accessibility, missing key props
- **feat(review-lenses/error-handling):** expand E1–E4 → E1–E8: add untyped error surface (E5), log-without-rethrow (E6), no retry on transient failures (E7), unbounded retry (E8); STRUCTURED ERROR TYPES, OBSERVABILITY INTEGRATION, RETRY & RESILIENCE sections
- **feat(dlc-build/reviewer-prompts):** add 3 rows to Lens Selection table — error-handling, api-design, observability; add domain-specific Rule #7 to worker prompts
- **feat(dlc-review/teammate-prompts):** add Lens Selection table + `{domain_lenses}` placeholder; upgrade Teammate 2 with DRY/SOLID/performance patterns; upgrade Teammate 3 with NAMING, DOCUMENTATION, TESTABILITY, DEBUGGING guidance
- **feat(agents/code-reviewer):** upgrade to domain expert level — add 6 inline domain lenses (security, database, TypeScript, frontend, error handling, API design) with specific patterns and confidence thresholds per lens
- **feat(dlc-debug/dx-checklist):** expand 11 → 19 DX patterns: E5–E8 (error handling), O3–O6 (structured log context, PII, correlation ID, trace propagation), P5 (non-injectable dependency)
- **feat(dlc-debug/teammate-prompts):** upgrade Fix Reviewer SAFETY section — TOCTOU pattern, null paths, race conditions, error swallowing, type safety regression; correctness causal chain tracing
- **docs:** update CLAUDE.md Docs Index with review-lenses reference; update README with domain expert capabilities for dlc-build, dlc-review, dlc-debug, and code-reviewer agent

## [0.6.21] — 2026-03-23

### fix: post-audit accuracy — workflow phase references, CLAUDE.md, README

- **fix(dlc-review):** deduplicate Phase 0.05 rows in operational.md — split into 0.05A (pr-review-bootstrap) and 0.05B (Jira fetch concurrent)
- **fix:** resolve stale Phase 0.6 references in `jira-integration.md` and `operational.md` — updated to Phase 0.05 after parallelization merge
- **fix(CLAUDE.md):** code-simplifier phase label corrected (Phase 5 → Phase 5.5); commands list updated to include `dlc-status` and `hook-test`
- **fix(README):** version badge updated to 0.6.20; Repo Structure expanded with 4 missing skills (careful, freeze, dlc-metrics, dlc-onboard); `dlc-metrics.jsonl` path corrected
- **fix(agents):** review-consolidator description updated to reflect iter 2+ usage
- **fix(dlc-build):** reference table updated — review-consolidator now shows iter 1 and iter 2+

## [0.6.20] — 2026-03-23

### Performance

- **dlc-review:** Phase 0 bootstrap and Jira fetch now run in parallel (saves 5–15s per review)
- **dlc-build Phase 1:** Explorer team spawns immediately while bootstrap runs concurrently (saves up to 60s in Full mode)
- **dlc-build Phase 2:** plan-challenger spawns speculatively during user think-time (saves one sequential round-trip)
- **dlc-build Phase 4:** review-consolidator now used for iter 2+ (2 reviewers), dispatched immediately on findings arrival
- **dlc-debug:** Investigator/DX Analyst spawn immediately while bootstrap runs concurrently
- **dlc-respond Phase 0:** Thread fetch and dismissed-patterns read now parallel
- **dlc-respond Phase 1:** fix-intent-verifier spawned per file group in parallel for PRs with 3+ groups
- **work-context:** Git state, PR fetch, and Jira search now run in a single parallel tool call round
- **qa-check.sh:** Checks 1–11 run as parallel background subshells (60–70% wall-clock reduction)
- **merge-preflight:** Checks 1–5 run as parallel background subshells

## [0.6.19] — 2026-03-23

### feat: add code-explorer + comment-analyzer agents, error-handling review lens, jira-sync ADF + atlassian-pm integration

- feat(agents): improve jira-sync — ADF via atlassian-pm spawn, HR6 cache_invalidate, AC coverage check, optional transition
- feat(dlc-build): add error-handling review lens + Lens Selection table; add code-explorer + comment-analyzer to CLAUDE.md
- feat(agents): add comment-analyzer — verify comment accuracy and detect comment rot
- feat(agents): add code-explorer — trace feature execution paths and architecture

## [0.6.18] — 2026-03-23

### feat(agents): add code-simplifier — post-review polish pass + dlc-build Phase 5 integration

- docs: add code-simplifier to agents table in CLAUDE.md
- fix(dlc-build): clarify code-simplifier invocation syntax and validate fallback in Step 5.5
- feat(dlc-build): add Step 5.5 optional simplification pass before shipping
- fix(agents): tighten code-simplifier git scope and naming constraint
- feat(agents): add code-simplifier — post-review polish pass (clarity + maintainability, no behavior changes)

## [0.6.17] — 2026-03-23

### dlc-build: Clarifying Questions Gate + Architecture Options (data-driven expert recommendations)

- docs(dlc-build): add Gotchas for new gates; update user-facing docs
- docs(dlc-build): update phase-gates.md for ClarifyQ and ArchOpts gates
- docs(dlc-build): update reference table, phase flow, gate summary for new steps
- feat(dlc-build): add Architecture Options step to Phase 2 (Full mode)
- feat(dlc-build): add architect-prompts.md for Phase 2 Architecture Options
- feat(dlc-build): add Step 3.5 Clarifying Questions Gate after research

## [0.6.16] — 2026-03-23

### Hook Tests + Skill Docs + Gotchas + Analytics + /careful + /freeze + Permission Router

- docs: update hooks table and README for v0.6.16 release
- feat(hooks): add permission-router.sh — auto-approve safe read-only commands
- feat(skills): add on-demand hook skills /careful and /freeze
- docs: wrap critical CLAUDE.md sections with <important if> tags; add positive routing test
- feat(hooks): add skill-usage-tracker.sh for PreToolUse analytics
- docs(skills): add Gotchas sections to all 10 SKILL.md files
- feat(commands): add hook-test and dlc-status commands
- docs: add user-facing skill guides to docs/skills/
- test(hooks): tighten command-not-found assertion to match hint-specific text
- feat(scripts): integrate bats test suite into qa-check.sh
- test(hooks): add bats tests for skill-routing.sh
- test(hooks): add bats tests for bash-failure-hint.sh
- test(hooks): add bats tests for common.sh utility functions

## [0.6.15] — 2026-03-22

### Hook Performance + Shared Library

- chore: add .shellcheckrc to fix SC1091/SC2034 false positives from shared lib migration
- docs: fix README version badge (was stuck at 0.6.13, plugin.json already at 0.6.14)
- perf(hooks): replace echo|grep subprocesses with bash builtins
- refactor(hooks): extract shared lib and apply consistency rules
- feat(hooks): add cleanup-artifacts.sh — auto-purge stale artifact files on SessionStart
- chore: remove stale [Unreleased] section from CHANGELOG

## [Unreleased]

### perf(hooks): replace echo|grep subprocesses with bash builtins

- perf(hooks): replace `echo "$VAR" | grep -qiE` with `shopt -s nocasematch; [[ =~ ]]` in `task-gate.sh`, `subagent-stop-gate.sh`, `idle-nudge.sh`
- perf(hooks): replace 6× `echo "$ERROR" | grep -qi` chains with single `shopt nocasematch` block + `[[ == *glob* ]]` in `bash-failure-hint.sh` (hottest PostToolUseFailure path)
- perf(hooks): replace `echo "$PROMPT" | tr '[:upper:]' '[:lower:]'` with `${PROMPT,,}` bash 4+ builtin (falls back to `tr` on bash 3.2) in `skill-routing.sh` (hottest UserPromptSubmit path)

### refactor(hooks): extract shared lib and apply consistency rules

- refactor(hooks): extract shared lib (`hooks/lib/common.sh`) with `require_jq`, `has_evidence`, `jq_fields`; apply consistency rules across 9 hook scripts

### feat(hooks): auto-cleanup stale artifact files on session start

- feat(hooks): add `cleanup-artifacts.sh` — removes `.md` artifact files older than `DEV_LOOP_ARTIFACT_TTL_DAYS` days (default: 7) from `~/.claude/plugins/data/dev-loop-dev-loop/`
- chore(hooks): register cleanup hook as async `SessionStart` in `hooks.json`
- docs(CLAUDE.md): update hooks table to include `cleanup-artifacts.sh`

## [0.6.14] — 2026-03-22

### feat(agents): extend metrics-analyst to parse and report new quality signal fields

- feat(agents): extend metrics-analyst to parse and report new quality signal fields
- feat(dlc-review): add Comprehension Gate (Phase 5.5) for Author mode
- feat(dlc-build): add Comprehension Gate (Step 1.5) and extend metrics schema in Phase 6
- feat(dlc-build): add AC quality check in Phase 0 triage (Step 1e)
- fix(hooks): re-inject hard-rules.md after context compaction
- docs: update README and CHANGELOG to reflect current state
- chore: replace hardcoded BEP prefix and personal username with generic examples

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
