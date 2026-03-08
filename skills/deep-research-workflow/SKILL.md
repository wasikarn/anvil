---
name: deep-research-workflow
description: "Research → Plan → Implement workflow for complex features. Use when user says 'research first', 'plan before coding', 'understand the codebase', or starts a multi-file feature without a clear path. Produces research.md and plan.md before any code."
argument-hint: "[feature-description]"
context: fork
agent: general-purpose
---

# /deep-research-workflow

Structured 3-phase workflow: Research → Plan → Implement. All creative decisions happen before implementation begins.

**Why:** Jumping to code causes wrong caching assumptions, missed ORM conventions, duplicated logic, and broken surrounding systems. Written artifacts anchor decisions through context compression.

**Key principle:** Implementation should be mechanical, not creative. All creative decisions happen during research and planning.

## Quick Reference

| Phase | Artifact |
| ------- | --------- |
| 1. Research | `research.md` |
| 2. Plan | `plan.md` |
| 3. Implement | Working code |

## On Invocation

1. **Check for existing artifacts** — if `research.md` or `plan.md` exist at the project root, this is a resume. Read them and identify the last incomplete phase.
2. **If starting fresh** — ask: "What feature are we building? Describe it in 1–2 sentences."
3. Begin at Phase 1 unless the user directs otherwise. If the user wants to skip research, briefly note the risk — skipping Phase 1 means assumptions go unverified until Phase 3 surfaces contradictions that require reverting — then proceed as directed and document skipped phases in plan.md.

Copy this checklist and check off items as you complete each phase:

```text
Progress:
- [ ] Phase 1: Research
- [ ] Phase 2: Plan (annotation cycles: 0)
- [ ] Phase 3: Implement
```

## Phase 1: Research

Create `research.md` at the **project root** using [references/research-template.md](references/research-template.md).

**Deep-read directives** — for each area relevant to the feature:

1. **Trace execution paths** — follow the full request/response cycle, not just the entry point
2. **Map data flow** — how data moves between layers, what transforms happen
3. **Document conventions** — naming, error handling, validation patterns, test structure
4. **Identify reusable code** — existing functions, utilities, abstractions that solve similar problems
5. **Note constraints** — what could break, non-obvious coupling, performance-sensitive paths

Read deeply. Trace the full path from entry to exit. If a function calls 3 other functions, read all 3. Document intricacies, not surface patterns.

**Tools:** Glob, Grep, Read extensively. For indexed projects, use `qmd search`/`vector_search` before file reads. Use `Task(subagent_type="Explore")` for broad codebase exploration.

**Output:** Write structured findings to `research.md`. Every section must cite specific files and line numbers.

**Phase gate:** Research is complete when:

- All areas the feature touches are covered
- Open questions are listed in `research.md` and either resolved or explicitly surfaced to the user
- Existing patterns and conventions are documented with concrete file references

Do NOT proceed to Phase 2 until the gate conditions are met. If open questions remain, surface them to the user before continuing.

## Phase 2: Plan

Create `plan.md` at the **project root** from research findings using [references/plan-template.md](references/plan-template.md). Use a custom markdown file — not Claude Code's built-in plan mode — for full editor control, inline annotation capability, and persistence as a project artifact.

**Plan structure:**

1. **Problem statement** — what exactly are we solving, and why now
2. **Approach** — high-level strategy with rationale
3. **File-by-file changes** — what changes in each file and why; include code snippets where helpful
4. **Trade-offs** — what we chose, what we rejected, and why
5. **Test strategy** — how to verify correctness
6. **Task list** — granular, ordered, checkable items

**Reference existing code as specification** — when the codebase already has similar patterns (e.g. another API endpoint, another component), reference that code explicitly as the model to follow. Do not design from scratch when a working example exists.

### Annotation Cycle

Present the plan for user review. The user may:

- Correct assumptions ("use drizzle:generate, not raw SQL")
- Reject sections ("remove this entirely")
- Add constraints ("retry logic is redundant here because...")
- Redirect architecture ("restructure the schema like this instead")

Revise `plan.md` based on feedback. **Write all user corrections into `plan.md`'s `## Annotations` section** so they persist through context compression. Repeat until the user approves. Track cycle count in the progress checklist.

**Do not implement during this phase.** If the user says "don't implement yet" — continue refining the plan.

## Phase 3: Implement

Execute the approved plan mechanically. Follow the task list in order. Do not stop until all tasks are completed.

**During implementation:**

- Mark tasks complete in `plan.md` as each is done
- Run type checks / linting continuously — do not accumulate errors
- No unnecessary comments, jsdocs, or type annotations beyond what the plan specifies
- No feature creep — if you notice something outside the plan, note it in `plan.md` under a `## Future` section, don't implement it
- Protect existing interfaces — do not change function signatures unless the plan explicitly calls for it; callers adapt, not the interface

**Feedback during implementation** — terse. Planning = paragraphs, implementation = single sentences. For visual issues, prefer screenshots over verbal descriptions.

**Scope discipline:**

- Cherry-pick proposals item-by-item — do not batch large changes
- If implementation reveals the plan was wrong → **stop, revert, and re-scope** (return to Phase 2)
- Do NOT incrementally patch a wrong direction — revert cleanly and re-plan

**When done:** Verify against the test strategy in the plan. Run tests, type checks, and any other validation the plan specifies. Mark Phase 3 complete in the progress checklist.

## Anti-patterns

- Jumping from prompt to code without written plan → missing conventions cause wrong assumptions that compound silently
- Chat-based steering instead of document-based annotation → chat messages get context-compressed; only `plan.md` Annotations survive long sessions
- Patching a bad approach incrementally instead of reverting → each patch adds complexity on top of a wrong foundation; technical debt compounds
- Using loose/any types to make things compile quickly → defers type errors to runtime; harder to trace and fix later
- Adding unnecessary comments or jsdocs to generated code → noise that clutters the codebase; well-named code is self-documenting
- Allowing scope creep during implementation phase → plan becomes inaccurate; hard to verify completion or revert cleanly
- Splitting research, planning, and implementation across separate sessions — single long sessions preserve context better
- Skipping open questions — unresolved ambiguities compound into plan errors

## Key Rules

- **Persistent artifacts** — `research.md` and `plan.md` anchor context through compression; if context is compacted, re-read both files before continuing
- **Plan before code** — all creative decisions happen in research/planning; implementation is execution only
- **Revert over patch** — if going wrong, revert and re-scope; incremental patches compound mistakes
- **Scope trimming** — actively cut scope; a smaller correct feature beats a larger broken one
- **Reference existing patterns** — use codebase code as specification, not abstract design
- **Emphatic depth** — surface-level research causes surface-level bugs; read deeply, trace fully
- **Annotation cycles are valuable** — 1–6 rounds of plan review catches more issues than rushing to code
