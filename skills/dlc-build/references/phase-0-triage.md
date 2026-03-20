# Phase 0: Triage (Lead Only)

```text
Phase 0 Flow:
Step 0: Resume check ──→ existing context? ──→ Yes: ask to resume / No: proceed
    ↓
Step 1: Parallel triage (all concurrent)
  1a: Detect project + domain lenses
  1b: Check pending PRs
  1c: Fetch Jira context (if Jira key)
    ↓
Step 2: Classify mode (decision tree → Full/Quick/Hotfix)
GATE: User confirms mode ──────────────────────────────────────────┐
    ↓                                                              │
Step 2.5: Load Mode File                                            │
    ↓                                                              │
Step 3: Create dev-loop-context.md artifact                        │
    ↓                                                              │
Step 4: Initialize progress tracker ←─────────────────────────────┘
```

## Step 0: Resume Check

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
│   │       2. Plan file: read plan_file: from YAML; fallback to ~/.claude/plans/ most recently modified .md
│   │       3. {artifacts_dir}/review-findings-*.md (if exists)
│   └→ Start fresh: Overwrite context file with new task.
└→ No: Proceed with triage normally.
```

## Step 1: Parallel Triage

Run steps 1a, 1b, 1c concurrently — all are read-only and independent:

**1a — Detect Project:** Use the `Project` JSON from the header (output of `detect-project.sh`). It contains: `project`, `repo`, `validate`, `base_branch`, `branch`.

After detecting the project, also **detect domain lenses** from the task description and file extensions: if task mentions auth/API/security → load [review-lenses/security.md](review-lenses/security.md); SQL/DB/migration → [review-lenses/database.md](review-lenses/database.md); React/Next.js/frontend → [review-lenses/frontend.md](review-lenses/frontend.md); performance/bundle/query → [review-lenses/performance.md](review-lenses/performance.md); TypeScript types → [review-lenses/typescript.md](review-lenses/typescript.md). Multiple lenses can stack. Inject into `{domain_lenses}` placeholder in reviewer prompts at Phase 4.

- If `validate` is empty → add to confirmation prompt: "No validate command detected. What should I run to verify? (e.g. `npm test`)"
- Check for project-specific Hard Rules at `{project_root}/.claude/skills/review-rules/hard-rules.md`:
  - Exists → load it + note checklist.md and examples.md paths
  - Not exists → use Generic Hard Rules (as defined in dlc-review Phase 1)

**1b — Pending PRs Check:**

```bash
gh pr list --author @me --state open --json number,title,headRefName,createdAt \
  --jq '.[] | "#\(.number) \(.headRefName) — \(.title)"'
```

- If Jira key in `$ARGUMENTS` (e.g. `BEP-1234`) → check if any open PR branch contains that key
  - Match found: Call AskUserQuestion — question: "PR #1941 already targets BEP-1234. Switch to that PR?",
    header: "Existing PR", options: [{ label: "Switch to PR #1941", description: "Use /dlc-respond or /dlc-review instead" },
    { label: "Continue new task", description: "Proceed with triage normally" }]
    → Switch: stop. → Continue: proceed.
- No match / no Jira key: list open PRs briefly, ask if user wants to switch to one
- No open PRs → proceed silently

**1c — Jira Context** (skip if no Jira key in `$ARGUMENTS`):

Follow [../../references/jira-integration.md](../../references/jira-integration.md) §dlc-build:

1. Fetch ticket → extract AC and subtasks
2. AC items become plan task constraints (Phase 2)
3. Jira context staged for `dev-loop-context.md` (Step 3)

**1d — Duplicate Detection** (skip if no Jira key; run in parallel with 1a–1c):

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

## Step 2: Classify Mode

Per [workflow-modes.md](workflow-modes.md) — use the Mode Decision Tree:

- `--hotfix` flag → **Hotfix mode** (skip Phase 1, branch from `main`, PR to `main` + backport)
- `--quick` flag or simple bug fix → **Quick mode** (skip Phase 1)
- Multi-file feature, architectural change → **Full mode**
- Ambiguous → ask user

**GATE:** Call AskUserQuestion to confirm mode:

- question: "Confirm mode{validate_suffix}?" (append " — and validate command?" if validate is empty)
- header: "Mode"
- options: [{ label: "Full", description: "Multi-file feature or architectural change" },
             { label: "Quick", description: "Bug fix or small refactor" },
             { label: "Hotfix", description: "Urgent production fix (branch from main)" }]
  (pre-select the classified mode as first option)

If validate is empty, follow up with a second AskUserQuestion or free-text prompt for the validate command.
→ proceed.

## Step 2.5: Load Mode File

After mode is confirmed, load the corresponding mode file:

- Full → [references/modes/feature.md](modes/feature.md)
- Quick → [references/modes/quick.md](modes/quick.md)
- Hotfix → [references/modes/hotfix.md](modes/hotfix.md)

The mode file contains branch strategy and mode-specific phase pre-steps. Read it in full before proceeding. Branch setup is defined inside the mode file — `workflow-modes.md §Branch Setup` no longer exists.

## Step 3: Create Context Artifact

Write `{artifacts_dir}/dev-loop-context.md` with YAML frontmatter + Markdown body:

```yaml
---
task: "{task_description}"
mode: full|quick|hotfix
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

Markdown body below frontmatter: Hard Rules summary, Jira context (AC items). Update `phase:` field at every gate transition. **Lead is sole writer of this file** — update `tasks_completed:` when workers send completion messages (prevents YAML race from parallel workers). Update `plan_file:` with the plan path immediately after Phase 2 EnterPlanMode returns the plan file path.

## Step 4: Initialize Progress Tracker

Post a checkbox list in conversation: Phase 0 (done), Phase 1 (Full only), Phase 2, Loop iterations 1-3 with nested Phase 3/4/5, Phase 6. Update checkboxes as each phase completes.
