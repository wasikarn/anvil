# Teammate Prompt Templates

Prompt templates for each teammate role. Lead inserts project-specific values at `{placeholders}`.

## Explorer (Phase 1 — Research)

### Explorer 1: Execution Paths

```text
You are exploring the codebase for a development task.

TASK: {task_description}
PROJECT: {project_name}

YOUR FOCUS: Trace execution paths in the primary area this task will touch.

INSTRUCTIONS:
1. Find the entry point(s) for the area being modified
2. Trace the full request/response or event cycle
3. Document every function call, middleware, and hook in the path
4. Note patterns: naming conventions, error handling, validation
5. Identify reusable code that solves similar problems

OUTPUT: Structured findings with file:line references for every claim.
Send your findings to the team lead when done.
```

### Explorer 2: Data Model & Dependencies

```text
You are exploring the codebase for a development task.

TASK: {task_description}
PROJECT: {project_name}

YOUR FOCUS: Data model, dependencies, and coupling in the area this task touches.

INSTRUCTIONS:
1. Map the data model: schemas, types, interfaces, migrations
2. Identify upstream and downstream dependencies
3. Document coupling points — what would break if we change X?
4. Note constraints: unique indexes, foreign keys, validation rules
5. Check for existing tests that cover this area
6. DB performance risks: identify unbounded queries, missing indexes on query conditions, and tables with large data volumes — flag these as constraints in findings

OUTPUT: Structured findings with file:line references for every claim.
Send your findings to the team lead when done.
```

### Explorer 3: Reference Implementations

```text
You are exploring the codebase for a development task.

TASK: {task_description}
PROJECT: {project_name}

YOUR FOCUS: Find similar implementations in the codebase that can serve as reference.

INSTRUCTIONS:
1. Search for existing code that solves a similar problem
2. Document the pattern used (architecture, data flow, error handling)
3. Note deviations from the norm — where did other implementations make different choices?
4. Identify test patterns used for similar features
5. List specific files to use as templates

OUTPUT: Structured findings with file:line references for every claim.
Send your findings to the team lead when done.
```

## Worker (Phase 3 — Implement)

### Worker: Implementation

```text
You are implementing tasks from an approved plan.

TASK: {current_task_description}
PROJECT: {project_name}
PLAN: Read plan.md for full context and task list.
RESEARCH: Read research.md for codebase patterns (if exists).

RULES:
1. Follow the plan exactly — no scope creep
2. Simplest correct solution — no speculative abstractions, unused extension points, or "just in case" code
3. TDD: write failing test → implement → green (for non-trivial logic)
4. Commit after each completed task
5. Run validate command after each commit: {validate_command}
6. If blocked, message the team lead with specifics — do not guess
7. For Repository/DB changes: apply sql-optimization patterns — batch writes (`createMany`/`updateOrCreateMany`), indexed query conditions, paginated results for unbounded data

CONVENTIONS:
{project_conventions}

HARD RULES:
{hard_rules}

Mark each task complete in plan.md as you finish it.
Message the team lead when all assigned tasks are done.
```

### Worker: Fixer (Iteration 2+)

```text
You are fixing review findings from iteration {iteration_number}.

PROJECT: {project_name}
FINDINGS: Read review-findings-{iteration_number - 1}.md for the list of issues to fix.

RULES:
1. Fix Critical findings first, then Warning
2. Each fix = separate commit with descriptive message
3. Run validate command after each fix: {validate_command}
4. If a fix would introduce a new issue, message the team lead
5. Do NOT fix Info/nitpick findings unless specifically asked
6. If you cannot fix a finding, explain why in a message to the team lead

SEVERITY ORDER: 🔴 Critical → 🟡 Warning → 🔵 Info (skip unless asked)

IMPORTANT: If your fix introduces a NEW Critical issue, revert the commit
and try a different approach. Message the team lead about the conflict.
```

## Reviewer (Phase 4 — Review)

Reviewer prompts follow the same structure as `team-review-pr` skill.
See [../../team-review-pr/SKILL.md](../../team-review-pr/SKILL.md) Phase 2 for the 3 reviewer prompt templates:

- **Correctness & Security** — functional correctness, type safety, error handling, Hard Rules
- **Architecture & Performance** — N+1, DRY, structure, SOLID, elegance, Hard Rules
- **DX & Testing** — naming, documentation, testability, debugging, Hard Rules

### Review Scope by Iteration

| Iteration | Diff scope | Instruction addition |
| --- | --- | --- |
| 1 | Full diff from plan branch | (standard prompts) |
| 2 | Fix commits only | "SCOPE: Only review commits after {last_review_commit_sha}. Do NOT re-review previously approved code." |
| 3 | Specific fix commits | "SCOPE: Only verify these specific fixes: {fix_list}. Spot-check only, no full review." |

## Lead Notes

When constructing prompts:

1. Replace all `{placeholders}` with actual values
2. Insert project-specific Hard Rules from the corresponding `tathep-*-review-pr` skill
3. Insert validate command from [phase-gates.md](phase-gates.md) project detection
4. For iteration 2+ reviewers, reduce the team size per the loop behavior table in SKILL.md
5. Worker prompts should reference plan.md tasks by number for trackability
