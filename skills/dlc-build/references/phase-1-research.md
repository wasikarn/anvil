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
