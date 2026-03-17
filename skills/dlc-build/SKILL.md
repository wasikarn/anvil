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

**Always loaded:**

| File | Purpose |
| --- | --- |
| [phase-gates.md](references/phase-gates.md) | Gate conditions for every phase transition |
| [workflow-modes.md](references/workflow-modes.md) | Full/Quick/Hotfix classification criteria |
| [operational.md](references/operational.md) | Graceful Degradation, Crash Recovery, Solo Checklist, Success Criteria |

**Load on demand (note when to load each):**

| File | Load when |
| --- | --- |
| [teammate-prompts.md](references/teammate-prompts.md) | Entering Phase 1, 3, or 4 — contains all prompt templates |
| [../../references/review-conventions.md](../../references/review-conventions.md) | Entering Phase 4 — dedup, signal check, strengths |
| [../../references/review-output-format.md](../../references/review-output-format.md) | Entering Phase 4 — findings table format |
| [../dlc-review/references/debate-protocol.md](../dlc-review/references/debate-protocol.md) | Entering Phase 4 iteration 1 debate only |
| [../../references/jira-integration.md](../../references/jira-integration.md) | Jira key detected in `$ARGUMENTS` |
| [references/pr-template.md](references/pr-template.md) | Entering Phase 6 option 1 (Create PR) |

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

### Step 0: Resume Check

Check if `.claude/dlc-build/dev-loop-context.md` exists in the current project:

```text
.claude/dlc-build/dev-loop-context.md exists AND Phase != "complete"?
├→ Yes: Show context summary and ask:
│   "Resume from Phase {N} — {task_description}? (Y/N)"
│   ├→ Yes: Skip to the recorded phase. Re-read artifacts in order:
│   │       1. .claude/dlc-build/dev-loop-context.md
│   │       2. ~/.claude/plans/ — most recently modified .md
│   │       3. .claude/dlc-build/review-findings-*.md (if exists)
│   └→ No: Overwrite context file with new task.
└→ No: Proceed with triage normally.
```

### Step 1: Parallel Triage

Run steps 1a, 1b, 1c concurrently — all are read-only and independent:

**1a — Detect Project:** Use the `Project` JSON from the header (output of `detect-project.sh`). It contains: `project`, `repo`, `validate`, `base_branch`, `branch`.

- If `validate` is empty → add to confirmation prompt: "No validate command detected. What should I run to verify? (e.g. `npm test`)"
- Check for project-specific Hard Rules at `{project_root}/.claude/skills/review-rules/hard-rules.md`:
  - Exists → load it + note checklist.md and examples.md paths
  - Not exists → use Generic Hard Rules (as defined in dlc-review Phase 1)

**1b — Pending PRs Check:**

```bash
gh pr list --author @me --state open --json number,title,headRefName,createdAt \
  --jq '.[] | "#\(.number) \(.headRefName) — \(.title)"'
```

- If Jira key in `$ARGUMENTS` (e.g. `BEP-1234`) → check if any open PR branch contains that key
  - Match found: "PR #1941 already targets BEP-1234. Use `/dlc-respond 1941` or `/dlc-review 1941 Author` instead?"
  - User confirms → stop. User declines → proceed.
- No match / no Jira key: list open PRs briefly, ask if user wants to switch to one
- No open PRs → proceed silently

**1c — Jira Context** (skip if no Jira key in `$ARGUMENTS`):

Follow [../../references/jira-integration.md](../../references/jira-integration.md) §dlc-build:

1. Fetch ticket → extract AC and subtasks
2. AC items become plan task constraints (Phase 2)
3. Jira context staged for `dev-loop-context.md` (Step 3)

### Step 2: Classify Mode

Per [workflow-modes.md](references/workflow-modes.md):

- `--hotfix` flag → **Hotfix mode** (skip Phase 1, branch from `main`, PR to `main` + backport)
- `--quick` flag or simple bug fix → **Quick mode** (skip Phase 1)
- Multi-file feature, architectural change → **Full mode**
- Ambiguous → ask user

**GATE:** User confirms mode (and validate command if empty) → proceed.

### Step 2.5: Branch Setup

Follow [workflow-modes.md](references/workflow-modes.md) §Branch Setup — creates feature/fix/hotfix branch based on mode and Jira key.

### Step 3: Create Context Artifact

`mkdir -p .claude/dlc-build` and write `.claude/dlc-build/dev-loop-context.md` with fields: Task, Mode, Project, Validate, Started, Branch, `Phase: triage`, Hard Rules, Jira context. Update `Phase:` at every gate transition — enables session resume (Step 0).

### Step 4: Initialize Progress Tracker

Post a checkbox list in conversation: Phase 0 (done), Phase 1 (Full only), Phase 2, Loop iterations 1-3 with nested Phase 3/4/5, Phase 6. Update checkboxes as each phase completes.

**GATE:** User confirms mode → proceed.

---

## Phase 1: Research (Full Mode Only)

Skip this phase entirely in Quick mode → go to Phase 2.

### Step 1: Create Explorer Team

Load [teammate-prompts.md](references/teammate-prompts.md) now. Create team `dev-loop-{branch}` with 2-3 explorer teammates:

- **Explorer 1:** Execution paths + patterns in primary area
- **Explorer 2:** Data model + dependencies + coupling
- **Explorer 3:** Reference implementations (spawn only if similar existing features exist)

### Step 2: Wait for Explorers

Track status in conversation (pending/done/crashed) for each explorer. Wait until all complete.

### Step 3: Merge Findings

Lead merges all explorer findings into `.claude/dlc-build/research.md`. Structure: trace execution paths, map data flow, document conventions, identify reusable code, note constraints. Every section must cite file:line references.

Update `Phase: research` in dev-loop-context.md.

**GATE:** `.claude/dlc-build/research.md` complete with file:line evidence → proceed.

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

Load [teammate-prompts.md](references/teammate-prompts.md) now. Create 1-2 worker teammates:

- `[S]` tasks: 1 worker, sequential
- `[P]` tasks: 2 workers with non-overlapping file assignments

**Controller provides full task text** — copy task descriptions into the worker creation prompt. Workers follow TDD: failing test → implement → green → commit.

On validate failure: see Checkpoint Recovery in [operational.md](references/operational.md).

#### Iteration 2+: Fix Findings

Create 1 fixer (prompt in teammate-prompts.md). Fixer receives ONLY unresolved findings from `.claude/dlc-build/review-findings-{N-1}.md`. Fix order: Critical → Warning. Each fix = separate commit.

If fixer introduces a NEW Critical: revert + message lead.
If same finding fails 3× → see 3-Fix Rule in [operational.md](references/operational.md).

**GATE:** All tasks done + validate passes → run Verification Gate (see operational.md) → update `Phase: implement` → proceed to Review.

---

### Phase 4: Review

Load [teammate-prompts.md](references/teammate-prompts.md), [review-conventions.md](../../references/review-conventions.md), [review-output-format.md](../../references/review-output-format.md) before starting.

#### Review Scale (Iteration 1)

Determine diff size first: `git diff {base_branch}...HEAD --stat | tail -1`

| Diff size | Reviewers | Debate | Notes |
| --- | --- | --- | --- |
| ≤50 lines | 1 (lead self-review) | None | Use Solo Self-Review Checklist from operational.md |
| 51–200 | 2 (Correctness + Architecture) | 1 round | Skip DX reviewer |
| 201–400 | 3 (full set) | Full (2 rounds max) | Standard review |
| 400+ | 3 (full set) | Full (2 rounds max) | Flag PR size to user |

Load [debate-protocol.md](../dlc-review/references/debate-protocol.md) only for 2-round debate cases.

#### Iteration 2: Focused Review

- 2 reviewers (Correctness + Architecture)
- Review ONLY commits after last review point
- 1 debate round max

#### Iteration 3: Spot-Check

- 1 reviewer (Correctness)
- Verify specific fixes only — no full review, no debate
- Binary output: pass or fail with specific issues

**Confidence filter (all iterations):** Drop any finding with confidence < 80 before consolidation. Hard Rule violations bypass this filter — always report.

### Review Output

Write findings to `.claude/dlc-build/review-findings-{iteration}.md` per [review-output-format.md](../../references/review-output-format.md).

**GATE:** Findings consolidated → update `Phase: review` in dev-loop-context.md → proceed to Assess.

---

### Phase 5: Assess (Lead Only)

Count findings from `.claude/dlc-build/review-findings-{N}.md`. If Jira: verify each AC has implementation + test (unverified AC = Critical). Apply decision tree from [phase-gates.md](references/phase-gates.md) §Assess→Loop Decision. Update progress tracker checkboxes (iteration N: Implement tasks, Review Critical/Warning, Assess outcome).

**GATE:** Loop decision made → update `Phase: assess` (or `Phase: ship` if exiting) in dev-loop-context.md → proceed accordingly.

---

## Phase 6: Ship (Lead Only)

### Step 1: Present Summary

Load [references/pr-template.md](references/pr-template.md) now. Present the Phase 6 Summary (task, mode, iterations, final status, iteration history table).

### Step 2: Completion Options

Present options to user:

1. **Create PR** — generate PR using template below, push branch, open with `gh pr create`
2. **Merge to base** — squash merge current branch into `{base_branch}` from Project JSON
3. **Keep branch** — leave as-is for manual review
4. **Restart loop** — return to Phase 3 with additional changes

Load [references/pr-template.md](references/pr-template.md) for PR title format, description template (Thai), `gh pr create` command, and Hotfix Backport steps.

### Step 3: Cleanup

1. Shut down all remaining teammates and clean up the team
2. Update `Phase: complete` in `.claude/dlc-build/dev-loop-context.md`
3. Clean up artifacts (choose one):
   - **Auto-cleanup:** `rm -f .claude/dlc-build/dev-loop-context.md .claude/dlc-build/research.md .claude/dlc-build/review-findings-*.md`
   - **Archive:** leave in `.claude/dlc-build/` for reference (add `.claude/dlc-build/` to `.gitignore` if not already)

---

## Constraints

- **Max 3 teammates concurrent** — more adds coordination overhead without proportional value
- **Workers READ-ONLY during review** — no workers alive during Phase 4; reviewers never modify files
- **Artifacts persist on disk** — `.claude/dlc-build/dev-loop-context.md`, plan file (`~/.claude/plans/`), `.claude/dlc-build/research.md`, `.claude/dlc-build/review-findings-*.md` survive context compression
- **YAGNI** — implement only what the task requires; speculative abstractions and "just in case" code are review findings

---

## Operational Reference

See [references/operational.md](references/operational.md) for Graceful Degradation levels, Context Compression Recovery steps, and Success Criteria checklist.
