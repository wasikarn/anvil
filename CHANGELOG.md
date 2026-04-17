# Changelog

All notable changes to this project will be documented in this file.

## [1.10.0] — 2026-04-17

### df-merge-pr auto-confirm + docs

- feat: `--yes` / `-y` flag on `/df-merge-pr` — skips the Confirmation Gate, CI-failing prompt, and concurrent-hotfix prompt; hard aborts (dirty tree, draft PR, rebase conflict, tag exists) still fire
- docs: SKILL.md documents `{auto_confirm}` behavior explicitly; workflow-feature.md and workflow-deploy.md gates follow the same bypass
- docs: deploy workflow notes that `--yes` does not bypass tag-exists / rebase-conflict aborts — only the confirmation prompt

## [1.9.0] — 2026-04-14

### Advisor Strategy mode for df-review

- feat: add `--advisor` flag for cost-intelligent PR review
- feat: new `advisor-consultant` agent (Opus) for deep analysis of uncertain findings
- feat: executor reviewers (Sonnet/Haiku) with confidence scoring
- feat: confidence gate with configurable thresholds (fast/balanced/conservative modes)
- feat: auto-escalation for security and architecture patterns
- docs: new `phase-advisor.md` reference documentation
- docs: update `code-reviewer` agent with confidence scoring instructions
- cost savings: 35-80% vs standard 3×Opus review

## [1.8.1] — 2026-04-07

### devflow-engine resilience improvements

- feat: retry with exponential backoff (1s/2s, max 3 attempts) for transient API errors (rate_limit_exceeded, server_error, overloaded_error)
- feat: budgetExceeded signal in SubprocessResult — reviewer returns cost/tokens without throwing
- feat: stderr captured in error messages for easier subprocess debugging
- feat: warnIfLargeDiff — logs warnings when diff exceeds 300 files, 10k lines, or 50MB raw
- fix: maxBuffer increased 100MB → 250MB to handle monorepo PRs
- fix: preserve cost/tokens in reviewer error paths (no-output, schema-fail)
- test: 11 new tests for subprocess retry, budgetExceeded, and stderr capture

## [1.8.0] — 2026-04-06

### Skill namespace prefix (df-) + hooks cleanup

- fix: update internal skill cross-references to use df- prefix
- refactor: rename all skills with df- namespace prefix
- chore: ignore .omc directory

## [1.7.6] — 2026-04-06

### Update agent skill references

- fix: update skill references in agents to use df- prefix

## [1.7.5] — 2026-04-06

### Namespace all skills with df- prefix

- refactor: rename all skills with df- prefix for consistent namespace

## [1.7.4] — 2026-04-06

### Rename setup to devflow-setup

- refactor: rename setup skill to devflow-setup — avoids name collision with other plugins

## [1.7.3] — 2026-04-06

### Hook cleanup and skill rename

- docs: update README and CLAUDE.md for v1.7.2
- fix: move evidence requirement from SubagentStop gate to SubagentStart context
- refactor: rename debug skill to debug-parallel — avoids name collision with oh-my-claudecode:debug
- perf: remove UserPromptSubmit skill-routing hook (conflicts with OMC skill-injector)
- perf: remove non-essential hooks to reduce hook density
- fix: remove extra blank line in CHANGELOG.md (MD012)

## [1.7.2] — 2026-04-04

### Release 1.7.2

## [1.7.1] — 2026-04-04

### docs: update version badge to v1.7.0, fix skill count to 29, add hooks field limitation note

- docs: update version badge to v1.7.0, fix skill count to 29, add hooks field limitation note

## [1.7.0] — 2026-04-03

### Token optimization: field filtering, PR diff filters, metrics tracking

- fix: resolve QA issues - fenced code language, heading format, broken link
- feat(skills): add token metrics display to /metrics and /dashboard
- feat: add --exclude parameter to review skill and auto-filter
- feat(agents): add jira presets to debug and pr-review bootstrap
- feat(agents): pass --preset=build to jira fetch in build-bootstrap
- feat(skills): add field presets to jira-integration
- docs: add injection points mechanism documentation
- feat(devflow-engine): add metrics.ts with token tracking schema v1.1
- docs: add token optimization implementation plan
- docs: revise token optimization spec after expert review
- docs: add token optimization design spec

## [1.6.5] — 2026-04-03

### Skill quality improvements: comprehensive audit, token optimization, CLAUDE.md updates

- fix: remove extra blank line in hard-rules.md
- fix: resolve QA issues - markdownlint, test-patterns-workspace removal
- fix(skills): comprehensive skill quality improvements
- feat(skills): add test-patterns skill
- fix: suppress SC2016 false positive in detect-project.sh

## [1.6.4] — 2026-03-31

### fix(detect-project): read base_branch from hard-rules.md before falling back to git default

- Previously hardcoded `base_branch="main"` which ignored project-specific base branches like `develop`
- Now reads from `.claude/skills/review-rules/hard-rules.md` if present
- Falls back to `git symbolic-ref refs/remotes/origin/HEAD`, then `"main"` as last resort

## [1.6.3] — 2026-03-31

### docs: update version badge to v1.6.3

- docs: update version badge to v1.6.3
- ci: opt into Node.js 24 for GitHub Actions to suppress deprecation warnings
- fix(ci): restructure SC2015 pattern instead of disabling
- fix(ci): resolve shellcheck SC2317, markdownlint MD032/MD022, and branded type errors
- fix(hooks): skill-routing reads .prompt field and includes hookEventName

## [1.6.2] — 2026-03-31

### fix(changelog): add blank line between v1.6.1 and v1.6.0 entries

- fix(changelog): add blank line between v1.6.1 and v1.6.0 entries
- fix(hooks): remove cat/find/head/tail from safe-command-approver to prevent conflict with bash-blockers

## [1.6.1] — 2026-03-31

### docs: update version badge and tree refs to v1.6.1

- docs: update version badge and tree refs to v1.6.1
- fix(devflow-engine): add missing fields to mockReport in smoke tests
- docs: update README, CLAUDE.md, CONTRIBUTING.md for v1.6.0

## [1.6.0] — 2026-03-31

### Cross-session memory, new skills, expanded test coverage, CI, and engine v0.2.0

- feat(agents): add cross-session memory to 9 agents
- feat(output-styles): add English variants of output styles
- feat(scripts): distribute pre-commit hook via `scripts/git-hooks/`
- fix(hooks): warn when `hard-rules.md` exceeds 60-line injection limit
- feat(hooks): enable stop-failure logging by default with rotation
- feat(hooks): add Edit/Write failure diagnostic hints
- feat(scripts): add legacy anvil→devflow data migration
- feat(dashboard): add metrics dashboard skill and script
- feat(build): add post-ship health check warning
- test(hooks): add Tier 1, 2 & 3 bats tests (86 total, was 27)
- test(engine): add config, diff-reader, finding schema tests (178 total, was 116)
- ci: add GitHub Actions QA and engine test workflows
- feat(qa): add gate 13 for doc consistency validation
- feat(skills): add `/generate-tests` and `/refactor` skills
- feat(skills,agents): add `/audit`, `/generate-docs`, and `security-reviewer` agent
- feat(freeze): real enforcement via temp file hook
- feat(engine): v0.2.0 — add audit and test-gen modules
- fix(docs): correct CLAUDE.md doc inconsistencies

## [1.5.0] — 2026-03-30

### New specialist agents + review modes

- feat: add `silent-failure-hunter` agent — zero-tolerance silent failure detection (CRITICAL/HIGH/MEDIUM)
- feat: add `type-design-analyzer` agent — TypeScript type design quality (4 dimensions, 1-10 scale)
- feat: add `--quick`, `--full`, `--focused [area]` modes to `/review` skill
- feat: add path-scoped `.claude/rules/` files for agents/, hooks/, skills/, devflow-sdk/
- fix: update hooks.json SubagentStop/SubagentStart matchers for new specialist agents

## [1.4.0] — 2026-03-30

### Enable auto-triggering for all skills

- fix: resolve QA failures before v1.4.0 release
- docs: update CONTRIBUTING.md to current state
- docs: update README badges and fix stale anvil reference
- refactor: remove disable-model-invocation from all skills
- docs: update README and CLAUDE.md to current state (v1.3.2)

## [1.3.2] — 2026-03-30

### Token optimization — reduce per-build cost by 30-35%

- test: update skill_routing bats — bug keyword no longer emits hint (debug auto-invocable)
- fix: add blank line before v1.3.0 heading in CHANGELOG
- perf: reduce token consumption by ~30-35% per build cycle (#3)

## [1.3.1] — 2026-03-29

### token optimization & maintainability

- refactor: token optimization + maintainability improvements
- fix: update .markdownlint-cli2.jsonc to ignore devflow-sdk/node_modules
- fix: manual corrections after devflow rename (.gitignore, .markdownlintignore)
- refactor: rename anvil to devflow across all content
- refactor: rename anvil files and directories to devflow
- fix(agents): resolve 8 post-audit issues — 2 critical MCP bugs + model + descriptions + color
- fix(anvil-sdk): quality improvements across review, investigate, plan, output (#2)
- refactor(skills): compress debug + respond SKILL.md via references/ extraction
- fix(skills): critical + warning fixes from deep verify
- fix(skills): spec violations, weak skill upgrades, quality gaps
- fix(agents): add 'You are [role]...' persona opening to all 20 agents missing it
- fix(agents): resolve 2 critical + 8 warning issues from deep verification
- fix(agents): rename '## Output' to '## Output Format' in commit-finalizer
- feat(agents): spec compliance, safety guardrails, and intelligence improvements

## [1.3.0] — 2026-03-29

### feat(sdk): two-phase triage, per-phase cost visibility, reviewer calibration

- **feat(sdk/orchestrator):** classify PR complexity — trivial (<50 lines, ≤1 domain) runs 1 reviewer instead of 3; markdown output shows ⚡ trivial note with 1/1 consensus explanation
- **feat(sdk/types):** `ReviewReport.complexity` field (`trivial|standard|complex`) — consumers can detect single-reviewer runs
- **feat(sdk/output):** per-phase cost breakdown — `Reviewers: $X | Falsification: $X | Total: $X | Tokens: N`
- **feat(sdk/cli):** falsification cost/tokens now included in `ReviewReport.cost.total_usd`; `cost.falsification_usd` tracks phase separately
- **feat(sdk/cli):** reviewer calibration — per-role stats (submitted/sustained/rejected/downgraded) appended to `~/.claude/anvil-reviewer-calibration.jsonl` after each falsification run
- **feat(metrics-analyst):** Step 6 reads calibration file and reports per-reviewer accuracy/rejection rates with ⚠️/✅ signals — runs after every build session and standalone `/metrics`
- **test(sdk):** 51 unit tests across consolidator, triage, domain-mapper, output — vitest added as devDependency

## [1.2.0] — 2026-03-29

### fix(sdk): add 'max' effort level — opus model, 30 turns, $0.60/reviewer budget

- fix(sdk): add 'max' effort level — opus model, 30 turns, $0.60/reviewer budget
- feat(safeguards): evidence-scored rule promotion pipeline
- fix(intelligence): close 4 intelligence gaps

## [1.1.0] — 2026-03-29

### fix(qa): exclude node_modules from markdownlint + fix shellcheck SC2038 + broken links

- fix(qa): exclude node_modules from markdownlint + fix shellcheck SC2038 + broken links
- fix(hooks): fix SubagentStop/Start matchers + paths/effort/security improvements
- feat(agents,skills): add effort + background fields per official docs
- fix: use short model aliases for auto-update on new versions
- fix: forward --model to claude -p subprocess + pin haiku versioned ID
- perf: deep prompt engineering pass — examples, schema precision, ordering
- improve(prompts): add few-shot examples, fix bugs, standardize formatting
- feat(agents): research summarizer + Phase 6 parallel falsification + debug bootstrap fix
- refactor(agents): structured JSON output + conditional lens activation + artifact re-injection
- fix(sdk): set maxBuffer on execSync to prevent crash on large PR diffs
- refactor(sdk): simplify + fix reuse/quality/efficiency issues
- fix(sdk): capture real cost/tokens from claude -p JSON output
- refactor(sdk): dead config cleanup, effort presets, structural fixes (E+G)
- refactor(sdk): migrate all agents to claude -p subprocess, remove SDK dependencies
- docs(sdk): prompt E-H — dead config, agent loop, structural fixes, remaining migrations
- refactor(sdk): extract findingKey helper, centralize MODEL_ID, fuse consolidator passes
- feat(sdk): fix-intent-verify subcommand + falsifier prompt caching
- refactor(sdk): extract ModelName, derive Severity/VerdictType from Zod schemas

## [1.0.0] — 2026-03-28

### feat!: rename plugin dev-loop → anvil, drop dlc- prefix

BREAKING CHANGE: Plugin renamed from `dev-loop` to `anvil`. All `dlc-*` skill names
dropped in favour of unprefixed names under the `anvil` namespace.

- Plugin name: `dev-loop` → `anvil` (`/anvil:build`, `/anvil:review`, etc.)
- Skills renamed: `dlc-build` → `build`, `dlc-review` → `review`, `dlc-respond` → `respond`,
  `dlc-debug` → `debug`, `dlc-metrics` → `metrics`, `dlc-onboard` → `onboard`, `dlc-status` → `status`
- Bootstrap agents renamed: `dlc-*-bootstrap` → `anvil-*-bootstrap`
- Artifact paths: `.claude/dlc-build/` → `.claude/anvil-build/`, `dlc-metrics.jsonl` → `anvil-metrics.jsonl`
- Env vars: `DEV_LOOP_ARTIFACT_TTL_DAYS` → `ANVIL_ARTIFACT_TTL_DAYS` (backward-compat fallback retained),
  `DEV_LOOP_USAGE_LOG` → `ANVIL_USAGE_LOG` (backward-compat fallback retained)
- Data path: `~/.claude/plugins/data/dev-loop-dev-loop/` → `~/.claude/plugins/data/anvil-anvil/`

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
