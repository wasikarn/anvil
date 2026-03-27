# Phase 2: Research

Mode behavior per [workflow-modes.md](workflow-modes.md):

| Mode | Research |
| ------ | ---------- |
| Micro | **Skip** — proceed directly to Phase 3 |
| Quick | **Lite** — WHAT/WHY only, ~250 lines, 1 explorer |
| Full | **Deep** — delta markers + [NEEDS CLARIFICATION] + GO/NO-GO verdict, 1–2 explorers |

---

## Step 1: Bootstrap (concurrent with explorers)

Dispatch `dev-loop-bootstrap` agent (Haiku) with the task description. **Do not wait** — proceed immediately to Step 2 while bootstrap runs.

When bootstrap completes: read `{artifacts_dir}/bootstrap-context.md` and send its contents to each explorer via `SendMessage`:

```text
BOOTSTRAP CONTEXT: {contents of bootstrap-context.md}
```

**Bootstrap fallback:** If bootstrap errors or produces no output within 60s: log "bootstrap timed out" in `dev-loop-context.md` and skip. Explorers continue with `BOOTSTRAP CONTEXT: (not available)`.

---

## Step 2: Spawn Explorers

Load [explorer-prompts.md](explorer-prompts.md). Spawn explorers based on mode:

**Quick (Lite):** 1 explorer — execution paths + data model combined scope.

**Full (Deep):** 1 explorer by default:

- **Explorer 1:** Execution paths + patterns in primary area, data model + dependencies

Spawn a second explorer **only if** research-validator flags the file list as insufficient (fewer than 3 files for a non-trivial task):

- **Explorer 2:** Gap area only (focused prompt)

Never more than 2 explorers. The lead reads files directly and does not benefit from parallel explorers.

Explorers return a **structured file list** (not file contents):

```markdown
## Key Files for This Task
- src/auth/middleware.ts — handles JWT validation (relevant: auth risk factor)
- src/users/UserService.ts — contains findById (will be modified)
- tests/auth/middleware.test.ts — existing test patterns to follow
[5–10 files max]
```

---

## Step 3: Wait for Explorers

Track status in conversation (pending/done/crashed) for each explorer. Wait until all complete.

---

## Step 4: Write research.md

Lead reads the files listed by explorers, then writes `{artifacts_dir}/research.md`.

**Quick mode (Lite) structure:**

```markdown
## Context
[2–3 sentences: what exists, what the task changes]

## WHAT
[What must be true after this task — behaviors only, no tech stack]

## WHY
[Why this change is needed]

## Token Count: ~XXX
```

**Full mode (Deep) structure:**

```markdown
## Context
[Existing architecture patterns relevant to this task]

## ADDED
[New files / patterns / dependencies this task introduces]

## MODIFIED
[Existing files / patterns that will change]
(Previously: X → will become: Y)

## REMOVED
[Anything being deprecated or deleted]

## [NEEDS CLARIFICATION: <specific question>] [file:line evidence]
[Max 3 — each must cite file:line. No hypothetical questions.]
<!-- Format: ## [NEEDS CLARIFICATION: <question>] [file:line]
     e.g. ## [NEEDS CLARIFICATION: Is adding the null guard in scope?] [src/services/user.ts:89]
     Only for gaps where the answer materially changes the design. -->

## Token Count: ~XXX tokens
[<900: research may be incomplete | 900–1600: ✅ | >1600: context rot risk]

**Token enforcement:**
- `<900`: research-validator flags thin/missing sections. Lead decides: expand or accept as-is.
- `900–1600`: proceed automatically.
- `>1600`: trim verbose context explanations to reach 900–1600 range. Do not add content.

## Risks Found
<!-- REQUIRED: list ALL concerns before verdict, even minor ones.
     Format: - [concern] (file:line evidence)
     If no concerns: "None identified — [brief reason why]" -->
- [concern 1] (evidence)

## GO/NO-GO Verdict
READY / NEEDS WORK / NOT READY
Reason: [based on Risks Found above — not independent opinion]
```

Every section must cite file:line references. Update `phase: research` in dev-loop-context.md.

---

## Step 5: Research Validator Gate

Run `research-validator` agent with path `{artifacts_dir}/research.md`. If result is FAIL → re-dispatch the relevant explorer with a targeted prompt before proceeding. If PASS → proceed.

---

## Step 6: GO/NO-GO (Full mode only — PhaseVerdict)

Full mode only. Quick and Micro proceed to Phase 3 automatically.

See PhaseVerdict schema in [workflow-modes.md](workflow-modes.md). Behavior:

```text
READY      → proceed to Phase 3 automatically

NEEDS WORK → present issues found
             "Research found X concerns before implementation:
              [list with file:line evidence]
             Proceed anyway or address first?"
             → wait for explicit user decision

NOT READY  → present blocking issues
             "Research found blocking issues:
              [list with file:line evidence]
             (a) Address these issues first
             (b) Proceed with known risks
             (c) Abort"
             → REQUIRE explicit choice — never auto-advance
```

If `[NEEDS CLARIFICATION]` tokens exist in research.md and the verdict is READY, present them as part of the READY output:
"Research is complete. Before Phase 3, {N} clarifying question(s) were flagged: [list]. Proceed or answer first?"

---

## Phase 2 Output

When Phase 2 completes, output this summary — not prose:

```markdown
### Phase 2 Complete
| Explorer | Files read | Key findings |
|---|---|---|
| Explorer 1 | N files | {top finding — one line} |
→ research.md written ({mode}: {Lite|Deep}) · Proceeding to Phase 3
```
