# Operational Reference

## Graceful Degradation

| Level | Available tools | Behavior |
| --- | --- | --- |
| **Agent Teams** | TeamCreate, SendMessage | Full workflow as described |
| **Subagent** | Task (Agent tool) | Same phases, but: explorers/workers/reviewers as subagents. No debate (can't message). Review = 3 parallel subagent reviewers (Correctness, Architecture, DX). |
| **Solo** | None (lead only) | Lead executes all phases sequentially. Research = lead explores. Review = self-review with checklist below. Loop still applies. |

Detect at Phase 1 and inform user of mode.

### Solo Self-Review Checklist

Use when running in Solo mode (no Agent Teams or subagents available):

- [ ] Each changed file re-read in full — no skimming
- [ ] Hard Rules checked against diff — every rule, every file
- [ ] Type safety: no `as any`, no unsafe casts, proper null handling
- [ ] Error handling: no empty catch, no swallowed errors
- [ ] Tests cover happy path + main edge case
- [ ] No `console.log` / debug artifacts in production code
- [ ] Validate command passes

### Checkpoint Recovery (Phase 4)

If worker completes a task but validate fails:

1. `git stash` (or revert the commit)
2. Analyze exact error output — send the literal error text to worker
3. Worker fixes based on actual error (not guessing)
4. If 2 attempts fail → lead intervenes with narrower scope

### 3-Fix Rule

If fixer fails the same finding 3 times → lead stops. Before escalating:

**Step 1: Check alternative hypothesis** — review the plan for alternative approaches to the same problem. If the plan has alternatives, try the next one before escalating.

**Step 2: If no alternatives remain, present options:**

1. Diagnosis mode — analyze root cause before attempting another fix
2. Revert to checkpoint — redesign the approach from scratch
3. Accept with known issue — document and ship

### Verification Gate (before Phase 6)

Lead MUST independently verify — never trust worker reports:

1. **RUN:** execute `{validate_command}` fresh
2. **READ:** read the actual terminal output (not the worker's claim)
3. **DIFF:** `git diff {base_branch}...HEAD --stat` — scope matches plan tasks
4. **LOG:** `git log --oneline {base_branch}..HEAD` — confirm commit-per-task, no missing tasks

If worker claims "done" but verify fails → send back with the specific failing evidence.

### Regression Gate (iteration 2+, before Phase 6)

After fixer iteration, lead runs regression check before proceeding to review:

```bash
git diff dlc-checkpoint-iter-{N-1}..HEAD --stat
```

Verify: no files modified that were NOT part of the findings being fixed. If unintended changes found → revert and re-scope the fix. This prevents fixer from introducing regressions in previously-passing code.

### Solo Mode Self-Review Output

When running in Solo mode (no Agent Teams or subagents), lead performs self-review and MUST produce a `review-findings-{N}.md` file using this template so Phase 7 Assess works the same regardless of mode:

```markdown
## Summary
- Total findings: {N} (Critical: {C}, Warning: {W}, Info: {I})
- Reviewer: Lead (Solo mode)
- Mode: Self-review

## Findings
| # | Sev | File | Line | Confidence | Reviewer | Issue | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Dismissed
```

Apply Solo Self-Review Checklist above when populating findings.

### Teammate Crash Recovery

If a teammate stops responding or crashes mid-phase:

| Teammate | Recovery action |
| --- | --- |
| **Explorer crash** | Proceed with remaining explorers — min 1 required. Note gap in `{artifacts_dir}/research.md`. |
| **Worker crash** | Run `git log --oneline {base_branch}..HEAD` to identify completed tasks. Re-spawn worker with remaining tasks only. |
| **Reviewer crash** | Re-spawn with identical prompt and same diff scope. Previous findings not affected. |
| **Fixer crash** | Check which findings were committed (git log). Re-spawn with only unresolved findings. |

If no response after ~3 minutes: kill teammate via TeamDelete, analyze state from git log + artifacts, re-spawn with narrowed scope.

## Context Compression Recovery

If session compacts mid-workflow, re-read in order:

1. `{artifacts_dir}/dev-loop-context.md` — read YAML frontmatter for phase/iteration/tasks_completed/plan_file, Markdown body for Hard Rules
2. Plan file — read `plan_file:` from dev-loop-context.md YAML. If `plan_file:` is empty (pre-Phase 3 crash), fall back to `{artifacts_dir}/{date}-{task-slug}/plan.md` if it exists.
3. Latest `{artifacts_dir}/review-findings-*.md` — current iteration findings (if in loop)
4. Progress tracker in conversation — iteration count and phase

## Success Criteria

- [ ] Prerequisite check completed (Agent Teams / subagent / solo detected)
- [ ] Project detected and conventions loaded
- [ ] Mode classified (Full/Quick) and confirmed by user
- [ ] Research completed with file:line evidence (Full mode only)
- [ ] Plan approved by user (annotation cycle done)
- [ ] All plan tasks implemented with commits
- [ ] Validate command passes after implementation
- [ ] Review completed with findings consolidated
- [ ] Critical findings resolved (zero remaining or user-accepted)
- [ ] Summary presented to user with completion options
- [ ] Team cleaned up (all teammates shut down)

## Fallback Behavior

**Jira unreachable:** If Jira fetch fails — proceed with task description as acceptance criteria. Note `[Jira: UNAVAILABLE]` in dev-loop-context.md.

**Mode confirmation timeout:** If user doesn't respond to mode selection within 1 message → default to Full mode and proceed. Note the auto-selection in the triage output.

## Prerequisite Check

Before anything, verify agent teams are available:

```text
If TeamCreate tool is not available → check graceful degradation:
- If Task (subagent) tool is available → "Agent Teams not enabled. Running in subagent mode."
- If neither → "Running in solo mode. All phases executed by lead sequentially."
```

See [references/operational.md](references/operational.md) for degradation behavior details.

## Constraints

- **Max 3 teammates concurrent** — more adds coordination overhead without proportional value
- **Workers READ-ONLY during review** — no workers alive during Phase 6; reviewers never modify files
- **Lead is sole writer of dev-loop-context.md** — workers SendMessage; lead updates the file
- **Artifacts persist on disk** — `dev-loop-context.md`, plan file, `research.md`, `review-findings-*.md` survive context compression
- **YAGNI** — implement only what the task requires; speculative abstractions are review findings
- **Artifacts path** — ALL artifacts live at `{artifacts_dir}/{date}-{task-slug}/` (from `scripts/artifact-dir.sh dlc-build`); includes plan.md, research.md, verify-results.md, review-findings-*.md, dev-loop-context.md. `~/.claude/plans/` is no longer used.

## Gate Summary

| Transition | Key condition | Who decides |
| --- | --- | --- |
| Triage → Research/Plan | Blast-radius scored, mode confirmed | User |
| Research → Plan | research.md complete + validator PASS (+ GO/NO-GO Full) | User (Full) / Lead (Quick) |
| Plan → Implement | Plan written to artifacts_dir + must_haves.truths + challenger (Full) | User (Full) / Lead auto (Micro/Quick) |
| Implement → Verify | All tasks done + validate + workers shut down | Lead |
| Verify → Review | All truths PASS + key_links verified | Lead |
| Verify → Implement | ANY truth FAIL (Quick/Full, iteration_count < 3) | Lead (targeted) |
| Review Stage 1 → Stage 2 | Spec compliance PASS | Lead |
| Review Stage 1 FAIL → Implement | Spec non-compliance — return to Phase 4 | Lead |
| Review → Assess | Findings consolidated | Lead |
| Assess → Loop | Critical found, iteration_count < 3 | Lead |
| Assess → Ship | Zero Critical (or user accepts) | User/Lead |
| Assess → Escalate (STOP) | iteration_count = 3, still Critical | Lead |
| Ship → Done | User selects completion option | User |

Full gate details: [references/phase-gates.md](references/phase-gates.md)

## Gotchas

- **Agent Teams required for parallel phases** — without `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, the skill degrades to subagent or solo mode; phases that rely on parallel workers run sequentially, increasing token cost and time.
- **Phase 1 AC validation skips silently if Jira key is invalid** — if the key doesn't exist or Jira is unreachable, the skill proceeds using the raw task description as AC. Verify the Jira key resolves before invoking to avoid a silent no-op on acceptance criteria.
- **Research phase can exceed context budget on large repos** — the Explorer spawns multiple subagents to read files; on repos with hundreds of relevant files this burns context fast. Use `--quick` for small tasks; save `--full` for cross-cutting changes.
- **All artifacts in one folder** — `dev-loop-context.md`, `research.md`, `plan.md`, `verify-results.md`, and `review-findings-*.md` all live at `{artifacts_dir}/{date}-{task-slug}/`. `~/.claude/plans/` is no longer used by dlc-build for new runs.
- **Max 3 iterations is shared** — Phase 5 loops, Stage 1 FAIL loops, and review loops all consume the same `iteration_count` counter (max 3). This prevents runaway costs from multiple loop types each believing they have their own budget.
- **Phase 5 is mandatory** — every Implement → Review transition must pass through Phase 5 Verify. Skipping it after a Stage 1 FAIL is not permitted.
- **[NEEDS CLARIFICATION] replaces ClarifyQ** — clarifying questions are embedded as tokens in research.md (max 3, each with file:line evidence). No separate ClarifyQ phase. Quick and Hotfix modes use Lite research with no clarification tokens.
- **plan-challenger is Full mode only** — Micro and Quick modes write plans directly without a challenge step. Running plan-challenger on Micro/Quick adds overhead that defeats their purpose.
- **Auto-transition requires a Jira key + at least one Jira integration** — Step 3a transitions the Jira card to In Progress automatically after mode is confirmed. Uses atlassian-pm path if `issue-bootstrap` was available in Step 2c; falls back to `mcp-atlassian` (`jira_transition_issue`) if atlassian-pm is not installed; skips silently if neither is reachable.
- **WIP limit enforcement only on the atlassian-pm path** — the `pre_wip_limit_check` hook fires only when atlassian-pm is installed. On the mcp-atlassian fallback path, there is no WIP gate — the transition proceeds unconditionally.
