# Phase 2: Plan (Lead Only)

## Step 1: Architecture Options (Full mode only)

**Skip entirely in Quick and Hotfix mode** — proceed directly to Step 2.

Load [architect-prompts.md](architect-prompts.md) now.

### Step 1a: Spawn Architect Agents (parallel)

Create 2 architect agents in parallel using the Agent tool. Both receive identical context:

- Full content of `{artifacts_dir}/research.md`
- Task description and AC items
- CLAUDE.md key conventions (5–10 lines)

See [architect-prompts.md](architect-prompts.md) for complete prompt templates.

- **Architect A** — Minimal approach (maximize reuse, minimize new files)
- **Architect B** — Clean Architecture approach (best long-term maintainability)

### Step 1b: Wait for Both Architects

Wait for both agents to complete. If one crashes: retry once with the same prompt before
degrading to single-approach plan (note degradation in dev-loop-context.md).

### Step 1c: Lead Synthesizes → Recommendation

Read both proposals in full. Form a recommendation using these signals:

| Signal | What to check |
| --- | --- |
| **Existing patterns** | Does research.md show an established pattern that matches one approach? |
| **Task scope** | Is this a one-off feature, or will it be extended? |
| **AC coverage** | Which approach satisfies all ACs with less integration risk? |
| **File change count** | More files = more integration risk |

The recommendation **must** cite at least one `file:line` from `research.md`. It must be
task-specific — not generic best-practice advice. See architect-prompts.md § Forming the
Recommendation for rules and examples.

### Step 1d: AskUserQuestion — Architecture Decision

```text
question: "Based on research, I recommend [Minimal/Clean]: {one-sentence reason citing research.md file:line}. Which approach?"
header: "Architecture Decision"
options: [
  { label: "{Recommended approach} (Recommended ✓)",
    description: "{N existing modified + M new files} — {key trade-off in one phrase}" },
  { label: "{Other approach}",
    description: "{N existing modified + M new files} — {key trade-off in one phrase}" },
  { label: "Explain trade-offs in detail",
    description: "Walk through the comparison before deciding" }
]
```

**If "Explain trade-offs":** Present a side-by-side comparison table:

| Dimension | Minimal | Clean Architecture |
| --- | --- | --- |
| Existing files modified | N | M |
| New files created | N | M |
| Estimated tasks | ~N | ~M |
| Risk | Low/Med | Med/High |
| Key pro | {specific} | {specific} |
| Key con | {specific} | {specific} |

Then call `AskUserQuestion` again with only the two approach options (no "Explain" option).

**After user selects:** Note chosen approach in `dev-loop-context.md` under `architecture:`.
Proceed to Step 2 — write the plan implementing the chosen approach.

## Step 2: Write Plan

Call `EnterPlanMode` — Claude switches to Opus, plan file created automatically at `~/.claude/plans/{random}.md`.

Source material:

- Full mode: `research.md` findings + chosen architecture from Step 1
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

Enter plan mode. Draft and refine the plan. Call `ExitPlanMode` — plan file is created and path is returned. **Immediately update `plan_file:` in `{artifacts_dir}/dev-loop-context.md`** with the returned path.

**Speculative plan-challenger:** Immediately spawn `plan-challenger` (Task/Agent tool) with the plan file path and `{artifacts_dir}/research.md`. Do NOT wait for it. Present the plan summary to the user while plan-challenger runs in the background.

**After user responds:**

- **User approves unchanged:** Collect plan-challenger result (wait if still running). Address all CHALLENGED items: remove YAGNI/scope-creep tasks, add missing tasks, correct ordering.
- **User requests changes:** Discard the speculative result. Apply edits, call ExitPlanMode again to save the revised plan, then re-spawn plan-challenger against the revised plan file.

If all items are SUSTAINED or the user overrides with explicit justification → proceed.

**GATE:** plan-challenger addressed + user approves final plan → proceed to Implement-Review Loop.
