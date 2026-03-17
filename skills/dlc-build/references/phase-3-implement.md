# Phase 3: Implement

Before starting each iteration: `git tag dlc-checkpoint-iter-{N}` — enables instant rollback via `git checkout dlc-checkpoint-iter-{N}`.

## Iteration 1: Full Implementation

Load [worker-prompts.md](worker-prompts.md) now. Create 1-2 worker teammates:

- `[S]` tasks: 1 worker, sequential
- `[P]` tasks: 2 workers with non-overlapping file assignments

**Lead provides full task text** — copy task descriptions into the worker creation prompt. Workers follow TDD: failing test → implement → green → commit. After each commit, worker sends completion message to lead (structured OUTPUT FORMAT from worker-prompts.md); lead updates `tasks_completed:` in dev-loop-context.md.

Per-commit spot-check (async): worker continues to next task immediately after sending the completion message — do NOT wait for lead acknowledgement. Lead processes spot-checks asynchronously: run `git show {commit_hash} --stat` to verify file scope matches task. If unintended files found: SendMessage to worker to revert and re-implement scoped to assigned files. If worker already moved to next task, lead reverts via `git revert {hash}` and re-queues the task.

On validate failure: see Checkpoint Recovery in [operational.md](operational.md).

## Iteration 2+: Fix Findings

Load [fixer-prompts.md](fixer-prompts.md) now. Create 1 fixer. Fixer receives ONLY unresolved findings from `.claude/dlc-build/review-findings-{N-1}.md`. Fix order: Critical → Warning. Each fix = separate commit.

If fixer introduces a NEW Critical: revert + message lead.
If same finding fails 3× → see 3-Fix Rule in [operational.md](operational.md).

## Worker Shutdown (before Phase 4)

Verify all workers have sent final completion messages. Then shut down the worker team (TeamDelete or confirm idle). Workers and reviewers must never be alive simultaneously.

**GATE:** All tasks done + validate passes + all workers shut down → run Verification Gate (see operational.md) → update `Phase: implement` → proceed to Review.
