# Phase 2: Plan (Lead Only)

**All modes:** Call `EnterPlanMode` — Claude switches to Opus, plan file created automatically at `~/.claude/plans/{random}.md`.

Source material:

- Full mode: `research.md` findings
- Quick mode: task description + CLAUDE.md conventions
- Hotfix mode: broken code path only — minimal scope

## Plan Structure

1. Problem statement
2. Approach with rationale
3. File-by-file changes
4. Trade-offs
5. Simplicity check — is this the simplest approach? Flag speculative features or abstractions not required by the task. "Can a junior understand this in 5 minutes?" test.
6. Test strategy
7. Task list — tag each task `[P]` (parallelizable) or `[S]` (sequential)
8. Task granularity — each task must specify: exact file(s) to modify, what to change (specific — not "update the logic"), expected behavior after change, how to verify (test to run or output to check). Each task must be completable in one worker turn — if not, split further.

Present plan to user — iterate via annotations until approved. Call `ExitPlanMode` after user approves. **Immediately update `plan_file:` in `{artifacts_dir}/dev-loop-context.md`** with the path returned by the plan system.

**Adversarial Gate:** Run `plan-challenger` agent with the plan file path and `research.md` path. Review its challenge table — address CHALLENGED items before proceeding:

- Remove YAGNI/scope-creep tasks from the plan
- Add any missing tasks flagged by the challenger
- Correct any task ordering issues

If all items are SUSTAINED or the user overrides a CHALLENGED item with explicit justification → proceed.

**GATE:** plan-challenger review addressed + user approves → proceed to Implement-Review Loop.
