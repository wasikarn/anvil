---
name: dlc-build
description: "Full development loop with Agent Teams — Research → Plan → Implement → Review → Ship with iterative fix-review loop. Pass a Jira key (BEP-XXXX) to auto-extract AC into plan tasks. Use when: building features, refactoring code, implementing tickets, or any multi-step development task. Use --hotfix for urgent production fixes that branch from main and auto-create backport PR. Triggers: dev loop, build feature, implement ticket, hotfix, /dlc-build."
argument-hint: "[task-description-or-jira-key] [--quick?] [--full?] [--hotfix?]"
compatibility: "Requires gh CLI, git, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (degrades gracefully without)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git *), Bash(gh *)
---

# Team Dev Loop — Full Development Workflow

Invoke as `/dlc-build [task-description-or-jira-key] [--quick?] [--full?] [--hotfix?]`

## References

| File |
| --- |
| [phase-gates.md](references/phase-gates.md) |
| [teammate-prompts.md](references/teammate-prompts.md) |
| [workflow-modes.md](references/workflow-modes.md) |
| [../../references/review-conventions.md](../../references/review-conventions.md) |
| [../../references/review-output-format.md](../../references/review-output-format.md) |
| [../dlc-review/references/debate-protocol.md](../dlc-review/references/debate-protocol.md) |
| [jira-integration.md](../../references/jira-integration.md) — Jira detection, MCP fetch, AC extraction (loaded when Jira key detected) |
| [references/operational.md](references/operational.md) — Graceful Degradation, Context Compression Recovery, Success Criteria |

---

**Task:** $ARGUMENTS | **Today:** !`date +%Y-%m-%d`
**Git branch:** !`git branch --show-current`
**Recent commits:** !`git log --oneline -5 2>/dev/null`
**Project:** !`bash "${CLAUDE_SKILL_DIR}/../../scripts/detect-project.sh" 2>/dev/null`

**Args:** `$0`=task description or Jira key (required) · `$1`=`--quick` (skip research) · `$1`=`--full` (force research) · `$1`=`--hotfix` (urgent production fix)

Read CLAUDE.md first — auto-loaded, contains project patterns and conventions.

---

## Prerequisite Check

Before anything, verify agent teams are available:

```text
If TeamCreate tool is not available → check graceful degradation:
- If Task (subagent) tool is available → "Agent Teams not enabled. Running in subagent mode (no debate, no messaging)."
- If neither → "Running in solo mode. All phases executed by lead sequentially."
```

---

## Phase 0: Triage (Lead Only)

### Step 1: Detect Project

Use the `Project` JSON from the header (output of `detect-project.sh`). It contains: `project`, `repo`, `validate`, `base_branch`, `branch`.

Check for project-specific Hard Rules at `{project_root}/.claude/skills/review-rules/hard-rules.md`:

```text
.claude/skills/review-rules/hard-rules.md exists?
├→ Yes: load it + note checklist.md and examples.md paths
└→ No:  use Generic Hard Rules (as defined in dlc-review Phase 1)
```

### Step 1.5: Pending PRs Check

```bash
gh pr list --author @me --state open --json number,title,headRefName,createdAt \
  --jq '.[] | "#\(.number) \(.headRefName) — \(.title)"'
```

If open PRs exist from current user:

```text
Open PRs found:
  #1941 feature/BEP-3407 — feat: billboard visibility override
  #1938 fix/BEP-3210 — fix: coupon double-decrement

Continue with new task, or switch to one of these?
```

- User picks existing PR → stop, suggest `/dlc-respond {pr}` or `/dlc-review {pr} Author` instead
- User confirms new task → proceed (note: stale PRs may need cleanup later)
- No open PRs → proceed silently

### Step 2: Classify Mode

Per [workflow-modes.md](references/workflow-modes.md):

- `--hotfix` flag → **Hotfix mode** (skip Phase 1, branch from `main`, PR to `main` + backport)
- `--quick` flag or simple bug fix → **Quick mode** (skip Phase 1)
- Multi-file feature, architectural change → **Full mode**
- Ambiguous → ask user

### Step 2.5: Jira Context (skip if no Jira)

Scan `$ARGUMENTS` for Jira key (`BEP-\d+`). If found, follow [jira-integration.md](../../references/jira-integration.md) §dlc-build:

1. Fetch ticket → extract AC and subtasks
2. AC items become plan task constraints (Phase 2)
3. Add Jira context to `dev-loop-context.md` (Step 3)

If no Jira key → skip to Step 3.

### Step 2.7: Branch Setup

Check `branch` from the Project JSON against `base_branch`:

```text
--hotfix mode?
├→ Switch to main first: git checkout main && git pull
├→ Jira key found? → create: hotfix/BEP-XXX-{slug}
└→ No Jira key?   → create: hotfix/{slug}

Already on a feature/fix/hotfix branch (not base)?
└→ Proceed as-is — assume intentional

On base branch (main/develop)?
├→ Jira key found (Step 2.5)?
│   ├→ Full mode  → create: feature/BEP-XXX-{slug}
│   └→ Quick mode → create: fix/BEP-XXX-{slug}
└→ No Jira key?
    └→ Ask user: "Branch name? (e.g. feature/short-description)"
```

**Slug rules:** lowercase, hyphens only, max 40 chars, derived from task description (strip articles, keep nouns/verbs).

Run: `git checkout -b {branch_name}`

**GATE (Hotfix):** On `hotfix/*` branch branched from `main` → proceed.
**GATE (Normal):** Branch is a non-base branch → proceed.

### Step 3: Create Context Artifact

Write `dev-loop-context.md` at project root:

```markdown
# Dev Loop Context

Task: {task_description}
Mode: {Full|Quick|Hotfix}
Project: {project_name}
Validate: {validate_command}
Started: {date}
Branch: {branch_name}

## Hard Rules
{project_hard_rules}

## Jira Ticket (if provided)
{jira_context_or_empty}
```

### Step 4: Initialize Progress Tracker

```markdown
## Dev Loop: {TASK_NAME}
Mode: {mode} | Project: {project} | Started: {date}

- [x] Phase 0: Triage — {mode} mode, {project} detected
- [ ] Phase 1: Research [Full only — skip for Quick/Hotfix]
- [ ] Phase 2: Plan
- [ ] Loop iteration 1/3
  - [ ] Phase 3: Implement
  - [ ] Phase 4: Review
  - [ ] Phase 5: Assess
- [ ] Phase 6: Ship
```

**GATE:** User confirms mode → proceed.

---

## Phase 1: Research (Full Mode Only)

Skip this phase entirely in Quick mode → go to Phase 2.

### Step 1: Create Explorer Team

Create team `dev-loop-{branch}` with 2-3 explorer teammates using prompts from [teammate-prompts.md](references/teammate-prompts.md):

- **Explorer 1:** Execution paths + patterns in primary area
- **Explorer 2:** Data model + dependencies + coupling
- **Explorer 3:** Reference implementations (spawn only if task area has similar existing features)

### Step 2: Wait for Explorers

All explorers must complete before proceeding. Track:

```markdown
### Phase 1: Research

| Explorer | Status | Files examined |
| --- | --- | --- |
| Execution Paths | ... | ... |
| Data Model | ... | ... |
| References | ... | ... |
```

### Step 3: Merge Findings

Lead merges all explorer findings into `research.md` at project root. Structure: trace execution paths, map data flow, document conventions, identify reusable code, note constraints. Every section must cite file:line references.

**GATE:** `research.md` complete with file:line evidence → proceed.

---

## Phase 2: Plan (Lead Only)

**All modes:** Call `EnterPlanMode` — Claude switches to Opus, plan file created automatically at `~/.claude/plans/{random}.md`.

Source material:

- Full mode: `research.md` findings
- Quick mode: task description + CLAUDE.md conventions
- Hotfix mode: broken code path only — minimal scope

### Plan Structure

1. Problem statement
2. Approach with rationale
3. File-by-file changes
4. Trade-offs
5. Simplicity check — is this the simplest approach? Flag speculative features or abstractions not required by the task. "Can a junior understand this in 5 minutes?" test.
6. Test strategy
7. Task list — tag each task `[P]` (parallelizable) or `[S]` (sequential)
8. Task granularity — each task must specify: exact file(s) to modify, what to change (specific — not "update the logic"), expected behavior after change, how to verify (test to run or output to check). Each task must be completable in one worker turn — if not, split further.

Present plan to user — iterate via annotations until approved. Call `ExitPlanMode` after user approves.

**GATE:** User approves plan → proceed to Implement-Review Loop.

---

## Implement-Review Loop (Max 3 Iterations)

Core loop: Implement → Review → Assess → (loop or exit).
Review scope narrows each iteration. See [phase-gates.md](references/phase-gates.md) for gate details.

| Iter | Implement scope | Review scope | Reviewers | Debate |
| --- | --- | --- | --- | --- |
| 1 | Full plan tasks | Full diff | 3 | Full (2 rounds max) |
| 2 | Fix findings only | Fix commits only | 2 | Focused (1 round) |
| 3 | Remaining fixes | Specific lines | 1 | None (spot-check) |

---

### Phase 3: Implement

#### Iteration 1: Full Implementation

Create 1-2 worker teammates using prompts from [teammate-prompts.md](references/teammate-prompts.md):

- `[S]` tasks: 1 worker, sequential
- `[P]` tasks: 2 workers with non-overlapping file assignments

**Controller provides full task text** to each worker — copy the relevant task descriptions from the plan into the worker creation prompt. Workers should NOT need to read the plan themselves for their assigned tasks.

Workers follow TDD: failing test → implement → green → commit.
Lead validates each commit against plan.

**Checkpoint Recovery:** if worker completes task X but validate fails:

1. `git stash` (or revert the commit)
2. Analyze exact error output — send the literal error text to worker
3. Worker fixes based on actual error (not guessing)
4. If 2 attempts fail → lead intervenes with narrower scope

#### Iteration 2+: Fix Findings

Create 1 fixer teammate with the fixer prompt from [teammate-prompts.md](references/teammate-prompts.md).
Fixer receives ONLY unresolved findings from `review-findings-{N-1}.md`.
Fix order: Critical → Warning. Each fix = separate commit.

**If a fix introduces a NEW Critical:** fixer reverts the commit and messages lead.
Lead decides: try different approach or escalate.

**3-Fix Rule:** if fixer fails the same finding 3 times → lead stops the loop and presents options:

1. Switch to diagnosis mode — analyze root cause before fixing
2. Revert to last clean checkpoint — try a different approach
3. Accept with known issue — document and ship

**GATE:** All tasks done + validate command passes → proceed to Review.

### Verification Gate (before proceeding to Phase 4)

Lead MUST independently verify — never trust worker reports:

1. **RUN:** execute `{validate_command}` fresh
2. **READ:** read the actual terminal output (not the worker's claim)
3. **DIFF:** `git diff {base_branch}...HEAD --stat` — scope matches plan tasks
4. **LOG:** `git log --oneline {base_branch}..HEAD` — confirm commit-per-task, no missing tasks

If worker claims "done" but verify fails → send back with the specific failing evidence.

---

### Phase 4: Review

#### Iteration 1: Full Review + Debate

Reuse dlc-review pattern (see [teammate-prompts.md](references/teammate-prompts.md) for reviewer prompts):

1. Create 3 reviewer teammates (Correctness, Architecture, DX)
2. Independent review of full diff
3. Adversarial debate per [debate-protocol.md](../dlc-review/references/debate-protocol.md)
4. Consolidate findings per [review-conventions.md](../../references/review-conventions.md)

**Confidence filter:** Drop any finding with confidence < 80 before consolidation (Hard Rule violations bypass this filter — always report).

#### Iteration 2: Focused Review

- 2 reviewers (Correctness + Architecture)
- Review ONLY commits after last review point
- 1 debate round max
- No DX review (scope too narrow)

#### Iteration 3: Spot-Check

- 1 reviewer (Correctness)
- Verify specific fixes only — no full review
- No debate
- Binary output: pass or fail with specific issues

### Review Output

Write findings to `review-findings-{iteration}.md`:

```markdown
# Review Findings — Iteration {N}

## Summary
Critical: X | Warning: Y | Info: Z

## Findings
| # | Sev | File | Line | Consensus | Issue | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Critical | ... | ... | ... | ... | ... |
```

**GATE:** Findings consolidated → proceed to Assess.

---

### Phase 5: Assess (Lead Only)

Count findings from `review-findings-{N}.md`. If Jira ticket was provided, also verify AC coverage — each AC must have corresponding implementation + test. Unverified AC = Critical finding.

### Independent VCS Verification

Before counting findings, lead verifies via VCS:

1. `git diff {base_branch}...HEAD --stat` — confirm scope matches plan
2. `git log --oneline {base_branch}..HEAD` — confirm commit-per-task
3. If Jira: each AC has both implementation AND test in the diff

```text
Critical == 0 AND Warning == 0?
├→ Yes: EXIT LOOP → Phase 6: Ship
│
Critical == 0 AND Warning > 0?
├→ Ask user: "Fix warnings? (Y/N)"
│   ├→ Yes: LOOP (iteration++)
│   └→ No: EXIT LOOP → Phase 6: Ship
│
Critical > 0 AND iteration < 3?
├→ LOOP (iteration++)
│
Critical > 0 AND iteration == 3?
└→ STOP — escalate to user per phase-gates.md escalation protocol
```

Update progress tracker with iteration results:

```markdown
- [x] Loop iteration {N}/3
  - [x] Phase 3: Implement — {task_count} tasks
  - [x] Phase 4: Review — Critical: {X}, Warning: {Y}
  - [x] Phase 5: Assess — {LOOP|EXIT|STOP}
```

**GATE:** Loop decision made → proceed accordingly.

---

## Phase 6: Ship (Lead Only)

### Step 1: Present Summary

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

### Step 2: Completion Options

Present options to user:

1. **Create PR** — generate PR using template below, push branch, open with `gh pr create`
2. **Merge to base** — squash merge current branch into `{base_branch}` from Project JSON
3. **Keep branch** — leave as-is for manual review
4. **Restart loop** — return to Phase 3 with additional changes

#### PR Template (option 1)

**Title:** English, under 70 chars, start with verb — derived from the plan problem statement.

**Description (Thai):**

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
{แสดงก็ต่อเมื่อมี Jira key — ดึงจาก dev-loop-context.md}
- [x] {AC1 description}
- [x] {AC2 description}
```

Run: `gh pr create --title "{title}" --body "{description}" --base {base_branch}`

#### Hotfix Backport (--hotfix mode only)

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

### Step 3: Cleanup

1. Shut down all remaining teammates
2. Clean up the team
3. Optionally archive artifacts (`dev-loop-context.md`, plan file, `research.md`, `review-findings-*.md`)

---

## Constraints

- **Max 3 teammates concurrent** — more adds coordination overhead without proportional value
- **Max 3 loop iterations** — beyond 3 = architectural problem, not fixable by iteration
- **Max 2 debate rounds** per [debate-protocol.md](../dlc-review/references/debate-protocol.md)
- **Workers are READ-ONLY during review** — no workers alive during Phase 4
- **Reviewers are READ-ONLY always** — no file modifications during review
- **Hard Rules cannot be dropped** — only reclassified with evidence
- **Commit per task** — enables clean revert if fix introduces regressions
- **Artifacts persist on disk** — `dev-loop-context.md`, plan file (`~/.claude/plans/`), `research.md`, `review-findings-*.md` survive context compression
- **YAGNI** — implement only what the task requires; speculative abstractions and "just in case" code are review findings
- **Hotfix scope** — `--hotfix` touches only the broken code path; no refactoring, no unrelated improvements
- **Hotfix backport** — every hotfix to `main` MUST have a backport PR to `develop`; skip only if `develop` already has the fix

---

## Operational Reference

See [references/operational.md](references/operational.md) for Graceful Degradation levels, Context Compression Recovery steps, and Success Criteria checklist.
