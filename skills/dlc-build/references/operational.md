# Operational Reference

## Graceful Degradation

| Level | Available tools | Behavior |
| --- | --- | --- |
| **Agent Teams** | TeamCreate, SendMessage | Full workflow as described |
| **Subagent** | Task (Agent tool) | Same phases, but: explorers/workers/reviewers as subagents. No debate (can't message). Review = 3 parallel subagent reviewers (Correctness, Architecture, DX). |
| **Solo** | None (lead only) | Lead executes all phases sequentially. Research = lead explores. Review = self-review with checklist below. Loop still applies. |

Detect at Phase 0 and inform user of mode.

### Solo Self-Review Checklist

Use when running in Solo mode (no Agent Teams or subagents available):

- [ ] Each changed file re-read in full — no skimming
- [ ] Hard Rules checked against diff — every rule, every file
- [ ] Type safety: no `as any`, no unsafe casts, proper null handling
- [ ] Error handling: no empty catch, no swallowed errors
- [ ] Tests cover happy path + main edge case
- [ ] No `console.log` / debug artifacts in production code
- [ ] Validate command passes

### Checkpoint Recovery (Phase 3)

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

### Verification Gate (before Phase 4)

Lead MUST independently verify — never trust worker reports:

1. **RUN:** execute `{validate_command}` fresh
2. **READ:** read the actual terminal output (not the worker's claim)
3. **DIFF:** `git diff {base_branch}...HEAD --stat` — scope matches plan tasks
4. **LOG:** `git log --oneline {base_branch}..HEAD` — confirm commit-per-task, no missing tasks

If worker claims "done" but verify fails → send back with the specific failing evidence.

### Regression Gate (iteration 2+, before Phase 4)

After fixer iteration, lead runs regression check before proceeding to review:

```bash
git diff dlc-checkpoint-iter-{N-1}..HEAD --stat
```

Verify: no files modified that were NOT part of the findings being fixed. If unintended changes found → revert and re-scope the fix. This prevents fixer from introducing regressions in previously-passing code.

### Solo Mode Self-Review Output

When running in Solo mode (no Agent Teams or subagents), lead performs self-review and MUST produce a `review-findings-{N}.md` file using this template so Phase 5 Assess works the same regardless of mode:

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
2. Plan file — read `plan_file:` from dev-loop-context.md YAML. If `plan_file:` is empty (pre-Phase 2 crash), fall back to `~/.claude/plans/` most recently modified `.md`.
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
