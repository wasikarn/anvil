---
name: dlc-debug
description: "Agent Teams debugging with parallel DX analysis — Investigator traces root cause while DX Analyst audits observability, error handling, and test coverage. Pass a Jira key (BEP-XXXX) to enrich bug context from ticket details. Use when: debugging complex bugs, production incidents, or when you want to harden the affected area. Triggers: debug, team debug, investigate bug, /dlc-debug."
argument-hint: "[bug-description-or-jira-key] [--quick?] [--review?]"
compatibility: "Requires gh CLI, git, and CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (degrades gracefully without)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git *), Bash(gh *)
---

# Team Debug — Systematic Debugging with DX

Invoke as `/dlc-debug [bug-description-or-jira-key] [--quick?]`

## References

| File |
| --- |
| [teammate-prompts.md](references/teammate-prompts.md) |
| [dx-checklist.md](references/dx-checklist.md) |
| [phase-gates.md](references/phase-gates.md) |
| [../../references/review-conventions.md](../../references/review-conventions.md) |
| [jira-integration.md](../../references/jira-integration.md) — Jira detection, MCP fetch, bug enrichment (loaded when Jira key detected) |
| [references/operational.md](references/operational.md) — Graceful Degradation, Context Compression Recovery, Success Criteria |

---

**Bug:** $ARGUMENTS | **Today:** !`date +%Y-%m-%d`
**Git branch:** !`git branch --show-current`
**Recent commits:** !`git log --oneline -5 2>/dev/null`
**Project:** !`bash "${CLAUDE_SKILL_DIR}/../../scripts/detect-project.sh" 2>/dev/null`

**Args:** `$0`=bug description (required) · `$1`=`--quick` (optional, skip DX Analyst) · `$2`=`--review` (optional, add Fix Reviewer after Fixer)
**Modes:** Full = Investigator + DX Analyst + Fixer · Quick = Investigator + Fixer (DX checklist only)
**Review:** `--review` flag or P0 severity → Fix Reviewer runs after Fixer (scoped to fix commits only)

Read CLAUDE.md first — auto-loaded, contains project patterns and conventions.

---

## Prerequisite Check

Before anything, verify agent teams are available:

```text
If TeamCreate tool is not available → check graceful degradation:
- If Task (subagent) tool is available → "Agent Teams not enabled. Running in subagent mode (no messaging)."
- If neither → "Running in solo mode. All phases executed by lead sequentially."
```

---

## Phase 0: Triage (Lead Only)

### Step 1: Detect Project

Use the `Project` JSON from the header (output of `detect-project.sh`). It contains: `project`, `repo`, `validate`, `base_branch`, `branch`.

Check for project-specific Hard Rules at `{project_root}/.claude/skills/review-rules/hard-rules.md`. If it exists, load it.

### Step 1.5: Jira Context (skip if no Jira)

Scan `$ARGUMENTS` for Jira key (`BEP-\d+`). If found, follow [jira-integration.md](../../references/jira-integration.md) §dlc-debug:

1. Fetch ticket — enrich bug description with ticket details
2. Check linked issues — related bugs may share root cause
3. Use ticket priority to inform severity classification (Step 2)
4. Add Jira context to `debug-context.md` (Step 4) and Investigator prompt (Phase 1)

If no Jira key — skip to Step 2.

### Step 2: Classify Severity

| Severity | Criteria | Effect |
| --- | --- | --- |
| **P0 — Outage** | Production down, data loss | Full mode forced, skip mode confirmation only (fix plan approval still required) |
| **P1 — Critical** | Major feature broken, workaround exists | Full mode default |
| **P2 — Minor** | Edge case, cosmetic, non-blocking | Quick mode default |

**P0 gate clarification:** Only the mode confirmation gate is skipped (auto-Full). All other gates remain.

### Step 3: Classify Mode

- `--quick` flag or P2 severity → **Quick mode** (skip DX Analyst)
- P0/P1, multi-file, cross-cutting → **Full mode**
- Ambiguous → ask user

### Step 4: Create Context Artifact

Write `debug-context.md` at **target project root**:

```markdown
# Debug Context

Bug: {description}
Severity: {P0/P1/P2}
Mode: {Full/Quick}
Project: {project_name}
Validate: {validate_command}
Started: {date}
Branch: {branch_name}

## Reproduction Steps
{from user description}

## Hard Rules
{project_hard_rules}

## Progress
- [ ] Phase 0: Triage
- [ ] Phase 1: Investigation
- [ ] Phase 2: Fix + Harden
- [ ] Phase 3: Ship
```

Lead updates the progress checkboxes at the start of each phase.

**GATE:** User confirms mode → proceed. (P0: auto-proceed with Full mode.)

---

## Phase 1: Investigate + DX Audit

### Step 1: Create Team

Create team `debug-{branch}` with 1-2 teammates using prompts from [teammate-prompts.md](references/teammate-prompts.md):

- **Full mode:** Investigator + DX Analyst (parallel)
- **Quick mode:** Investigator only

### Step 2: Wait for Teammates

```markdown
### Phase 1: Investigation

| Teammate | Status | Key finding |
| --- | --- | --- |
| Investigator | ... | ... |
| DX Analyst | ... | ... |
```

**CHECKPOINT** — all teammates must complete before proceeding.

### Step 3: Convergence

Lead shuts down all Phase 1 teammates.

**DX Signal Quality Check (Full mode only):** Before merging, check DX findings:

- If all findings are Info-severity → skip DX section in Fix Plan (no actionable improvements)
- If (Critical + Warning) / Total < 50% → note "low DX signal" to user before proceeding

Then merge findings into `investigation.md` at **target project root**:

```markdown
# Investigation Report

## Root Cause
{Investigator findings — hypothesis, evidence, file:line}

## DX Findings
| # | Sev | Category | File | Line | Issue | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Critical | Silent failure | ... | ... | ... | ... |

## Fix Plan
1. [Bug] Fix root cause: {description}
2. [Test] Add regression test: {description}
3. [DX] {each DX improvement as separate item}
```

**GATE:** Root cause identified with file:line evidence **and confidence >= Medium** → proceed. If confidence is Low or root cause not found → escalate to user (present alternative hypotheses; do not proceed to Phase 2).

---

## Phase 2: Fix + Harden

Create Fixer in same team using prompts from [teammate-prompts.md](references/teammate-prompts.md):

- **Full mode:** Full Mode Fixer prompt (references investigation.md)
- **Quick mode:** Quick Mode Fixer prompt (includes condensed DX checklist from [dx-checklist.md](references/dx-checklist.md))

Fixer executes Fix Plan from `investigation.md`.

Commit strategy:

```text
commit 1: fix(area): fix root cause — {description}
commit 2: test(area): add regression test for {bug}
commit 3: dx(area): improve error message in {file}
commit 4: dx(area): add logging at {decision point}
commit 5: dx(area): add validation for {edge case}
```

### Verification Loop

After **each Fix Plan item** committed by Fixer, Lead independently verifies before Fixer continues:

```text
1. Run validate command and read actual output (do not trust Fixer's "tests pass" claim)
2. If validate FAILS:
   a. Send exact error output to Fixer: "Validate failed with: {error_text} — retry"
   b. Fixer retries (attempt counter increments)
   c. If 3 retries on same item → escalate (see below)
3. If validate PASSES: confirm to Fixer and continue to next Fix Plan item
```

**If fix fails 3 times on the same item:**

1. Present all attempts + error patterns to user
2. **Check alternative hypothesis first** — if `investigation.md` has an alternative hypothesis, offer: "Try alternative hypothesis: {hypothesis} before full re-investigation"
3. If alternative also fails or none exists → offer 4 escalation options (see phase-gates.md)

After all Fix Plan items done, Lead shuts down Fixer.

**Final Lead Verification (do not rely on Fixer's claims):**

1. Run validate command fresh and read actual output
2. `git diff --stat HEAD~N` — confirm scope matches Fix Plan (N = number of fix commits)
3. `git log --oneline -10` — confirm one commit per Fix Plan item
4. `git status` — confirm clean working tree

**GATE:** All Fix Plan items done + Final Lead verification passes → proceed.

### Phase 2.5: Fix Review (conditional)

Run Fix Review if: `--review` flag was passed **or** severity is P0.

Create Fix Reviewer in same team using prompts from [teammate-prompts.md](references/teammate-prompts.md).
Provide: fix commit hashes (from `git log --oneline -N`), root cause summary from `investigation.md`.

After Fix Reviewer completes, Lead shuts down Fix Reviewer.

**If Fix Reviewer finds Critical issues** → Lead presents findings to user and asks whether to fix before shipping or proceed.
**If Fix Reviewer finds only Warnings/Info** → include in Debug Summary; proceed to Phase 3.

---

## Phase 3: Verify & Ship (Lead Only)

### Step 1: Present Summary

```markdown
## Debug Summary

**Bug:** {description}
**Root Cause:** {one-line}
**Fix:** {commit refs}
**DX Improvements:** {count} items (Critical: X, Warning: Y)

### Commits
| # | Type | Description |
| --- | --- | --- |
| 1 | fix | ... |
| 2 | test | ... |
| 3 | dx | ... |

### Completion Options
1. Create PR
2. Commit to current branch
3. Keep for manual review
```

### Step 2: Cleanup

1. Shut down all remaining teammates
2. Clean up the team
3. Optionally archive `debug-context.md` + `investigation.md`

---

## Constraints

- **Max 2 teammates concurrent** — Investigator + DX Analyst in Phase 1 · Fixer alone in Phase 2 · Fix Reviewer alone in Phase 2.5
- **No debate phase** — debugging needs speed, not consensus
- **Investigator is READ-ONLY** — no file modifications during Phase 1
- **DX Analyst is READ-ONLY** — no file modifications during Phase 1
- **Fixer follows Fix Plan** — no scope creep beyond investigation findings. Fix with the simplest correct approach; do not introduce abstractions or refactors not in the Fix Plan
- **DX scope = affected area only** — not codebase-wide improvements
- **3 fix attempts max** — beyond that is an architectural problem, escalate to user
- **Hard Rules from project detection** — loaded dynamically, cannot be skipped
- **Artifacts at target project root** — `debug-context.md`, `investigation.md` (not this skills repo)
- **Team name convention** — `debug-{branch}` (e.g., `debug-fix/null-check`)

---

## Operational Reference

See [references/operational.md](references/operational.md) for Graceful Degradation levels, Context Compression Recovery steps, and Success Criteria checklist.
