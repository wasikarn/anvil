# Phase 1: Triage (Lead Only)

```text
Phase 1 Flow:
Step 1: Resume check ──→ existing context? ──→ Yes: ask to resume / No: proceed
    ↓
Step 2: Parallel triage (all concurrent)
  2a: Detect project + domain lenses
  2b: Check pending PRs
  2c: Fetch Jira context (if Jira key)
  2d: Duplicate detection
  2e: AC quality check
    ↓
Step 3: Classify mode (decision tree → Full/Quick/Hotfix)
GATE: User confirms mode ──────────────────────────────────────────┐
    ↓                                                              │
Step 4: Auto-Transition to In Progress (atlassian-pm, if avail.)   │
    ↓                                                              │
Step 5: Load Mode File                                             │
    ↓                                                              │
Step 6: Create dev-loop-context.md artifact                        │
    ↓                                                              │
Step 7: Initialize progress tracker ←─────────────────────────────┘
```

## Step 1: Resume Check

Check if `{artifacts_dir}/dev-loop-context.md` exists:

```text
{artifacts_dir}/dev-loop-context.md exists AND Phase != "complete"?
├→ Yes: Show context summary then call AskUserQuestion:
│   question: "Resume from Phase {N} — {task_description}?"
│   header: "Resume"
│   options: [{ label: "Resume", description: "Continue from Phase N" },
│              { label: "Start fresh", description: "Overwrite context file with new task" }]
│   ├→ Resume: Skip to the recorded phase. Re-read artifacts in order:
│   │       1. {artifacts_dir}/dev-loop-context.md
│   │       2. Plan file: read plan_file: from YAML; fallback to {artifacts_dir}/{date}-{task-slug}/plan.md if it exists
│   │       3. {artifacts_dir}/review-findings-*.md (if exists)
│   └→ Start fresh: Overwrite context file with new task.
└→ No: Proceed with triage normally.
```

## Step 2: Parallel Triage

Run steps 2a, 2b, 2c concurrently — all are read-only and independent:

**2a — Detect Project:** Use the `Project` JSON from the header (output of `detect-project.sh`). It contains: `project`, `repo`, `validate`, `base_branch`, `branch`.

After detecting the project, also **detect domain lenses** from the task description and file extensions: if task mentions auth/API/security → load [review-lenses/security.md](review-lenses/security.md); SQL/DB/migration → [review-lenses/database.md](review-lenses/database.md); React/Next.js/frontend → [review-lenses/frontend.md](review-lenses/frontend.md); performance/bundle/query → [review-lenses/performance.md](review-lenses/performance.md); TypeScript types → [review-lenses/typescript.md](review-lenses/typescript.md). Multiple lenses can stack. Inject into `{domain_lenses}` placeholder in reviewer prompts at Phase 6.

- If `validate` is empty → add to confirmation prompt: "No validate command detected. What should I run to verify? (e.g. `npm test`)"
- Check for project-specific Hard Rules at `{project_root}/.claude/skills/review-rules/hard-rules.md`:
  - Exists → load it + note checklist.md and examples.md paths
  - Not exists → use Generic Hard Rules (as defined in dlc-review Phase 2)

**2b — Pending PRs Check:**

```bash
gh pr list --author @me --state open --json number,title,headRefName,createdAt \
  --jq '.[] | "#\(.number) \(.headRefName) — \(.title)"'
```

- If Jira key in `$ARGUMENTS` (e.g. `ABC-1234`) → check if any open PR branch contains that key
  - Match found: Call AskUserQuestion — question: "PR #1941 already targets ABC-1234. Switch to that PR?",
    header: "Existing PR", options: [{ label: "Switch to PR #1941", description: "Use /dlc-respond or /dlc-review instead" },
    { label: "Continue new task", description: "Proceed with triage normally" }]
    → Switch: stop. → Continue: proceed.
- No match / no Jira key: list open PRs briefly, ask if user wants to switch to one
- No open PRs → proceed silently

**2c — Jira Context** (skip if no Jira key in `$ARGUMENTS`):

Follow [../../../references/jira-integration.md](../../../references/jira-integration.md) §dlc-build:

1. Fetch ticket → extract AC and subtasks
2. AC items become plan task constraints (Phase 3)
3. Jira context staged for `dev-loop-context.md` (Step 6)

**2d — Duplicate Detection** (skip if no Jira key; run in parallel with 2a–2c):

If `jira-search` agent (atlassian-pm plugin) is available, search for similar in-progress work:

```text
jira-search: "status = 'In Progress' AND summary ~ '{task keywords}' AND key != '{JIRA-KEY}'"
```

- Match found → Call AskUserQuestion:
  question: "{MATCH-KEY} ({assignee}) is already working on a similar task: '{match summary}'. Continue anyway?"
  header: "Possible Duplicate"
  options: [{ label: "Continue", description: "Proceed with new task" },
             { label: "Switch to existing", description: "Use /dlc-respond or /dlc-review on that ticket" }]
- No match or jira-search not available → proceed silently

**2e — AC Quality Check** (skip if no Jira key or Jira unavailable):

For each AC item fetched in Step 2c, flag if:

- ❌ **No measurable outcome** — vague improvement without a testable condition
  (e.g. "ระบบต้องเร็วขึ้น" with no threshold, "improve error handling" with no criterion)
- ❌ **Unbounded scope** — no explicit boundary on what is NOT included
  (e.g. "handle all edge cases" — edge cases of what, exactly?)
- ❌ **Contradicts another AC** — mutually exclusive conditions in same ticket

Output an AC quality table before proceeding to Step 3:

| AC | Status | Issue |
| --- | --- | --- |
| AC1 | ✅ Testable | — |
| AC2 | ⚠️ Ambiguous | No success threshold defined |

If **2 or more ACs are flagged**: Call AskUserQuestion before proceeding:

- question: "{N} ACs have quality issues (see table above). Proceed with ambiguous ACs or clarify first?"
- header: "AC Quality Warning"
- options: [
    { label: "Proceed as-is", description: "Use ACs as written — I'll handle ambiguity in plan" },
    { label: "Clarify now", description: "Tell me what each flagged AC means" }
  ]
- If "Clarify now" → capture user's clarification, update AC items in-memory, then proceed.
- If 0-1 ACs flagged → proceed silently (minor ambiguity, not worth a round-trip).

## Step 3: Classify Mode

Per [workflow-modes.md](workflow-modes.md) — blast-radius auto-scoring:

**`--hotfix` flag** → Hotfix mode immediately. Skip scoring. Skip to Step 4.

**All other tasks:** Score 5 blast-radius factors (score 1 = yes, 0 = no):

| Factor | Score 1 if… |
| -------- | ------------- |
| **Scope** | Task touches >1 module or service boundary |
| **Risk** | Task involves auth / payment / DB migration / public API |
| **Novelty** | Pattern doesn't exist in codebase (new abstraction, new dependency) |
| **Dependencies** | Code being changed has known downstream consumers |
| **Ambiguity** | Task description is underspecified or has unclear AC. Tie-break: uncertain → score 1. |

**Score → suggested mode:**

| Score | Suggested mode |
| ------- | --------------- |
| 0–2 | Micro |
| 3 | Quick |
| 4–5 | Full |

If a mode flag (`--micro`/`--quick`/`--full`) was passed **and is lower than the score** → **downgrade protection** (see workflow-modes.md §Flag vs. Score Precedence). Lead lists scoring factors and requires "yes" before proceeding with lower mode.

**GATE:** Call AskUserQuestion to confirm mode:

- question: "Task scored {X}/5 → suggesting {mode}{validate_suffix}. Confirm or override?"
  (append " — and validate command?" if validate is empty)
- header: "Mode"
- options: [{ label: "Micro", description: "Isolated, minimal blast radius" },
             { label: "Quick", description: "Bug fix or small refactor" },
             { label: "Full", description: "Multi-file feature or architectural change" },
             { label: "Hotfix", description: "Urgent production fix (branch from main)" }]
  (pre-select the scored mode as first option)

Set `mode_source`:

- `auto` if user confirms the scored suggestion
- `flag` if user passed an explicit mode flag
- `override` if user selects a different mode than scored

If validate is empty, follow up with a second AskUserQuestion or free-text prompt.
→ proceed.

## Step 4: Auto-Transition to In Progress

**Run only if:** `$ARGUMENTS` contains a Jira key AND at least one Jira integration is reachable (detected in Step 2c).
**Skip silently** if no Jira key or Jira is unreachable — this step never blocks the workflow.

**Detect which path to use** (in priority order):

| Path | Condition | Extra behavior |
| ------ | ----------- | ---------------- |
| **atlassian-pm** | `issue-bootstrap` was used successfully in Step 2c | WIP gate hook fires automatically; call `cache_invalidate` after transition (HR6) |
| **mcp-atlassian** | `mcp__mcp-atlassian__jira_transition_issue` available (Step 2c used direct API) | No WIP hook, no cache; transition only |
| **Skip** | Neither available | Proceed silently without transitioning |

Use the ticket status already fetched in Step 2c (no re-fetch needed).

| Current Status | Action |
| ---------------- | -------- |
| To Do / Backlog / Open | Transition to In Progress (proceed below) |
| In Progress / Reopened | Skip — note: `{JIRA-KEY} already In Progress — skipping` |
| Done / Closed / Cancelled | Ask user (see below) |

**If transition needed:**

1. Call `jira_get_transitions(issue_key)` → find transition whose name contains "In Progress" (case-insensitive)
2. Call `jira_transition_issue(issue_key, transition_name)`
   - **atlassian-pm path only:** `pre_wip_limit_check` hook fires automatically
     - If WIP blocked AND count ≥ wip_max → **STOP**: "WIP limit reached for In Progress ({count}/{wip_max}). Finish an existing item first."
3. **atlassian-pm path only:** Call `cache_invalidate(issue_key)` (HR6)
4. Output: `{JIRA-KEY} → In Progress [OK]`

**If Done / Closed / Cancelled:** Call AskUserQuestion:

```text
question: "Ticket {JIRA-KEY} is already {status}. Proceed anyway?"
header: "Ticket Status Warning"
options:
  - { label: "Proceed", description: "Continue with dlc-build regardless of ticket status" }
  - { label: "Stop",    description: "Exit — pick a different ticket" }
```

→ Stop: exit skill. → Proceed: continue without transitioning.

---

## Step 5: Load Mode File

After mode is confirmed, load the corresponding mode file:

- Micro → [references/modes/micro.md](modes/micro.md)
- Full → [references/modes/feature.md](modes/feature.md)
- Quick → [references/modes/quick.md](modes/quick.md)
- Hotfix → [references/modes/hotfix.md](modes/hotfix.md)

The mode file contains branch strategy and mode-specific phase pre-steps. Read it in full before proceeding. Branch setup is defined inside the mode file — `workflow-modes.md §Branch Setup` no longer exists.

## Step 6: Create Context Artifact

Write `{artifacts_dir}/dev-loop-context.md` with YAML frontmatter + Markdown body:

```yaml
---
task: "{task_description}"
mode: micro|quick|full|hotfix
blast_radius_score: 0-5
mode_source: auto|flag|override
phase: triage
iteration: 0
branch: "{branch_name}"
project: "{project_name}"
validate: "{validate_command}"
started: "{YYYY-MM-DD}"
jira: "{JIRA-KEY-or-empty}"
plan_file: ""
tasks_completed: []
---
```

Markdown body below frontmatter: Hard Rules summary, Jira context (AC items). Update `phase:` field at every gate transition. **Lead is sole writer of this file** — update `tasks_completed:` when workers send completion messages (prevents YAML race from parallel workers). Update `plan_file:` with the plan path immediately after Phase 3 creates the plan file.

## Step 7: Initialize Progress Tracker

Post a checkbox list in conversation: Phase 1 (done), Phase 2 (Full/Quick only), Phase 3, Loop iterations 1-3 with nested Phase 4/5/6/7/8, Phase 9. Update checkboxes as each phase completes.

Write dlc-metrics entry to `{artifacts_dir}/dlc-metrics.jsonl` (append, create if missing):

```json
{"ts":"<ISO8601>","phase":"triage","mode":"<mode>","mode_source":"<auto|flag|override>","blast_radius":N,"task_slug":"<slug>"}
```

Lead writes this directly — not via hook (metrics data not available at hook time).
