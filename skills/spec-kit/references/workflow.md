# SDD Workflow: File Format Specifications

## spec.md Format (output of /speckit.specify)

```markdown
# Spec: <Feature Name>

## Overview
[What this feature does and why it matters — no tech stack]

## User Stories

### User Story 1: <Story Title> [P1|P2|P3]

**As a** [role], **I want** [goal], **so that** [benefit]

#### Acceptance Scenarios

**Scenario 1: <name>**

- Given: [precondition]
- When: [action]
- Then: [expected outcome]

## Functional Requirements

- FR-001: [requirement]
- FR-002: [requirement]

## Success Criteria

- SC-001: [measurable criterion]
- SC-002: [measurable criterion]

## Out of Scope

- [explicitly excluded items]

## Clarifications

[Filled in by /speckit.clarify — max 5 questions per session, one at a time]
```

**Priority levels:** P1 = MVP/must-have, P2 = important, P3 = nice-to-have

Note: Stories use ordinal headings ("User Story 1", "User Story 2") in spec.md. Tasks reference them as `[US1]`, `[US2]` tags.

---

## plan.md Format (output of /speckit.plan)

```markdown
# Implementation Plan: <Feature Name>

## Tech Context
- Language/Runtime: [e.g., Node.js 20, Python 3.11]
- Framework: [e.g., Next.js 14, FastAPI]
- Database/Storage: [e.g., PostgreSQL, SQLite, S3]
- Testing: [e.g., Jest, pytest]
- Platform: [e.g., Docker, Vercel, bare metal]
- Performance goals: [e.g., <200ms p99 latency]
- Constraints: [e.g., no new dependencies, must work offline]

## Constitution Check
[Verify plan aligns with .specify/memory/constitution.md]

## Project Structure
[Directory tree of new/modified files]

## Complexity Notes
[Anything non-obvious: tricky integrations, edge cases, performance risks]
```

Associated files generated alongside `plan.md`:

- **research.md** — tech stack evaluation, library choices, tradeoffs
- **data-model.md** — entity/relationship definitions, schemas
- **quickstart.md** — key validation scenarios for manual testing
- **contracts/** — API specs (api-spec.json), protocol specs, interface definitions

---

## tasks.md Format (output of /speckit.tasks)

```markdown
# Tasks: <Feature Name>

## Phase 1: Setup
- [ ] T001 Install dependencies
- [ ] T002 Configure environment

## Phase 2: Foundational
- [ ] T010 [US1] Set up database schema
- [ ] T011 [P] [US1] Create base model classes

---
**CHECKPOINT**: Verify foundational layer before continuing

## Phase 3: User Story 1 (P1/MVP)
- [ ] T020 [US1] Implement core feature logic
- [ ] T021 [P] [US1] Write unit tests for core logic  ← [P] = parallel-safe
- [ ] T022 [US1] Add API endpoint at src/api/users.py

---
**CHECKPOINT**: Manual test against quickstart.md scenarios

## Phase 4: User Story 2
...

## Phase N: Polish
- [ ] T090 [P] Add error handling and logging
- [ ] T091 [P] Documentation

## Dependency Graph
T020 depends on: T010
T022 depends on: T020
...
```

**Task ID format:** `T001` (no hyphen — sequential numbers)
**Parallel marker:** `[P]` means task touches independent files/modules — safe to run concurrently
**Story ref:** `[US1]`, `[US2]` links task back to a user story in spec.md
**File path:** include file path in task description (e.g. `at src/models/user.py`)
**Completion marker:** `[X]` replaces `[ ]` when `/speckit.implement` finishes a task

---

## constitution.md Format (output of /speckit.constitution)

```markdown
# Project Constitution

## Code Quality Principles
- [e.g., All functions must have tests]
- [e.g., No magic numbers — use named constants]

## Testing Standards
- [e.g., Minimum 80% coverage for business logic]
- [e.g., Integration tests required for all API endpoints]

## User Experience Consistency
- [e.g., All error messages must suggest a corrective action]
- [e.g., Loading states required for async operations >200ms]

## Architectural Decisions
- [e.g., No ORM — use raw SQL with parameterized queries]
- [e.g., Event-driven communication between services]
```

The constitution is referenced by every subsequent command as a compliance gate.

---

## Workflow Decision Guide

**When to run `/speckit.clarify`** (formerly `/quizme`):

- Spec has vague acceptance criteria ("user can manage photos" is vague)
- Multiple interpretations are possible
- Integration points are undefined
- Skip only if the spec is already very precise

**When to run `/speckit.analyze`:**

- After `/speckit.tasks`, before `/speckit.implement`
- When plan and spec were written at different times
- When tasks reference artifacts not in contracts/

**When to run `/speckit.checklist`:**

- Feature has complex business logic with many edge cases
- Regulatory or compliance requirements exist
- Multiple stakeholders with different definitions of "done"

**When to use `--ai-skills` flag:**

- First time setting up spec-kit on a machine
- Want the /speckit.* commands available as Claude Code skills (not just slash commands)
