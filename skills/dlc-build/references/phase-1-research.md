# Phase 1: Research (Full Mode Only)

Skip this phase entirely in Quick mode → go to Phase 2.

## Step 0: Bootstrap (before explorers)

Dispatch `dev-loop-bootstrap` agent (Haiku) with the task description as argument. Wait for completion (timeout: 60s) — output written to `{artifacts_dir}/bootstrap-context.md`. Read that file and inject its contents into ALL explorer prompts as a `BOOTSTRAP CONTEXT:` section. This eliminates redundant project-structure reads across explorers.

**Bootstrap fallback:** If bootstrap doesn't complete within 60s or crashes: proceed without it. Set `BOOTSTRAP CONTEXT: (not available — explorers gather context independently)` in explorer prompts. Explorers are self-sufficient; bootstrap is an optimization, not a requirement.

## Step 1: Create Explorer Team

Load [explorer-prompts.md](explorer-prompts.md) now. Create team `dev-loop-{branch}` with 2-3 explorer teammates. Assign non-overlapping scopes to each:

- **Explorer 1:** Execution paths + patterns in primary area
- **Explorer 2:** Data model + dependencies + coupling
- **Explorer 3:** Reference implementations (spawn only if similar existing features exist)

## Step 2: Wait for Explorers

Track status in conversation (pending/done/crashed) for each explorer. Wait until all complete.

## Step 3: Merge Findings

Lead merges all explorer findings into `{artifacts_dir}/research.md`. Structure: trace execution paths, map data flow, document conventions, identify reusable code, note constraints. Every section must cite file:line references.

Update `Phase: research` in dev-loop-context.md.

**GATE:** Run `research-validator` agent with path `{artifacts_dir}/research.md`. If result is FAIL, re-dispatch the relevant explorer with a targeted prompt before proceeding. If result is PASS → proceed.

## Step 3.5: Clarifying Questions Gate

With `research.md` verified complete, scan it for unresolved questions across four categories:

| Category | Signal |
| --- | --- |
| **Scope boundary** | Unclear what is explicitly in or out of scope |
| **Integration contracts** | Interactions with downstream/upstream systems not fully specified |
| **Edge cases** | Error states, null inputs, concurrency behavior undefined |
| **Architectural alignment** | Task could follow pattern A (found in research) or diverge — choice has trade-offs |

**Rule — every question must cite evidence:** Each question must reference a specific `file:line` from `research.md` that reveals the gap. Never ask about hypothetical concerns.

✅ Right: "research.md shows `UserService.findById` has no null guard at `src/services/user.ts:89` — is adding the guard in scope, or is that a separate task?"

❌ Wrong: "Will this affect performance?" (no evidence from research)

**Decision logic:**

```text
0 questions → proceed to Phase 2 silently
1–4 questions → AskUserQuestion (all at once)
5+ questions → task scope is unclear → escalate
```

**For 1–4 questions**, call `AskUserQuestion`:

```text
question: "Before designing the architecture, research surfaced {N} open question(s). Answers will shape the plan."
[List each question with its research.md citation as sub-bullets in the question text]
header: "Clarifying Questions"
options: [
  { label: "Answer below", description: "Type answers for each question in your reply" },
  { label: "Proceed with current scope", description: "Skip — I'll handle ambiguity in the plan" }
]
```

- **If user answers:** capture answers, append to `research.md` as `## Clarifications` section, then proceed to Phase 2.
- **If user skips:** note unresolved questions in `dev-loop-context.md` under `open_questions:`, then proceed.

**For 5+ questions**, call `AskUserQuestion`:

```text
question: "Research found {N} open questions — task scope is unclear. Recommend clarifying requirements before implementation."
header: "Scope Too Ambiguous"
options: [
  { label: "Clarify requirements (recommended)", description: "Stop here — refine task description and re-invoke /dlc-build" },
  { label: "Proceed anyway", description: "Accept that ambiguity will be resolved during implementation" }
]
```

## Phase 1 Output Format

When Phase 1 completes (after writing research.md), output this summary table — do NOT write a prose paragraph:

```markdown
### Phase 1 Complete
| Explorer | Files read | Key findings |
|---|---|---|
| Explorer A | N files | {top finding — one line} |
| Explorer B | N files | {top finding — one line} |
→ research.md written · Proceeding to Phase 2
```
