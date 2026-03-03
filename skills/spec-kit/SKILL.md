---
name: spec-kit
description: "Spec-Driven Development (SDD) workflow using spec-kit (github/spec-kit). Use when starting a new SDD project with `specify init`, writing or refining feature specs, navigating the 6-step workflow (/speckit.constitution → /speckit.specify → /speckit.clarify → /speckit.plan → /speckit.tasks → /speckit.implement), choosing the right slash command for the current phase, understanding what artifacts each step produces, or troubleshooting the `specify` CLI. Triggers on: start a spec, write a spec, spec-driven, speckit, specify init, /speckit.*, SDD workflow, create a spec for, plan with spec-kit."
---

# spec-kit: Spec-Driven Development

SDD inverts the coding workflow: specifications are the primary artifact; code is their generated output. Never skip to `/speckit.plan` or `/speckit.implement` without completing earlier steps.

## Quick Reference: 6-Step Workflow

| Step | Command | Output | Key Rule |
|------|---------|--------|----------|
| 1 | `/speckit.constitution` | `.specify/memory/constitution.md` | Do once; cover code quality, testing, UX, performance + decision governance |
| 2 | `/speckit.specify <what>` | `spec.md` + `checklists/requirements.md` + git branch | WHAT/WHY only, no tech; be explicit about flows and out-of-scope |
| 3 | `/speckit.clarify` | Updates `spec.md` Clarifications | Structured first → free-form after; validate Review & Acceptance Checklist; explicitly skip for spikes |
| 4 | `/speckit.plan <tech stack>` | `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` | NOW specify tech |
| 4.5 | *(plan validation)* | *(refined plan files)* | Audit for missing sequences + over-engineering; research rapidly-changing tech with parallel tasks |
| 5 | `/speckit.tasks` | `tasks.md` | Requires `plan.md` to exist |
| 6 | `/speckit.implement` | Marked `[X]` tasks, working code | Pauses on incomplete checklists; local CLI tools must be installed |

**Optional quality gates** (run between steps 5 and 6):

- `/speckit.analyze` — read-only cross-artifact consistency check (CRITICAL/HIGH/MEDIUM/LOW, max 50 findings)
- `/speckit.checklist` — requirement quality checklists ("unit tests for English" — validates spec clarity, not system behavior)
- `/speckit.taskstoissues` — convert tasks to GitHub issues

## Project Bootstrap

```bash
# New project
specify init my-project --ai claude

# In current directory (for existing repos)
specify init . --ai claude
specify init --here --ai claude --ai-skills   # also install as agent skills

# Check environment
specify check
specify version
```

See [references/cli.md](references/cli.md) for full CLI reference including `specify extension` commands.

## Directory Layout (after init + full workflow)

```text
.specify/
  memory/constitution.md
  scripts/           # Helper scripts (check-prerequisites.sh, create-new-feature.sh, etc.)
  specs/001-feature-name/
    spec.md          # Step 2
    plan.md          # Step 4
    research.md      # Step 4
    data-model.md    # Step 4
    quickstart.md    # Step 4
    tasks.md         # Step 5
    contracts/       # Step 4 (api-spec.json, etc.)
    checklists/      # Step 2: requirements.md · Step 5b: domain files (/speckit.checklist, optional)
  templates/
    spec-template.md
    plan-template.md
    tasks-template.md
    CLAUDE-template.md
CLAUDE.md            # Agent instructions (varies by --ai flag)
```

## Common Mistakes to Avoid

- **Specifying tech stack in step 2** — wait until `/speckit.plan` (step 4)
- **Expecting `/speckit.clarify` to ask unlimited questions** — it's capped at 5 questions per session
- **Skipping `/speckit.clarify` without saying so** — ambiguities compound into plan/task errors; if intentionally skipping for a spike/prototype, explicitly state it so the agent doesn't block
- **Using free-form clarification before `/speckit.clarify`** — run structured clarify first (sequential, coverage-based, answers recorded in Clarifications); free-form refinement is a follow-up, not a replacement
- **Skipping plan validation (step 4.5)** — generated plans often include sequences or components not explicitly requested; audit before generating tasks
- **Not checking for over-engineering in the plan** — Claude can add unrequested components; always ask for rationale when something wasn't in the spec
- **Running `/speckit.tasks` without `plan.md`** — it will fail; run `/speckit.plan` first
- **Ignoring `[P]` markers in tasks.md** — tasks marked `[P]` are safe to parallelize
- **Re-running `/speckit.constitution` carelessly** — it supports re-runs to update principles, but silently overwrites; export any content you want to keep before re-running
- **Missing local CLI tools for `/speckit.implement`** — the agent runs tool commands (npm, dotnet, etc.); have them installed and at the correct version before starting
- **Only checking CLI output after implement** — runtime errors (e.g., browser console errors) may not appear in the terminal; test the running app and paste any errors back to the agent

## Intelligence Features

### 1. Detect Current Workflow Phase

When the user asks "where am I?", "what's next?", or seems unsure of their step, run the phase detection script from the project root:

```bash
bash ~/.claude/skills/spec-kit/scripts/detect-phase.sh
# Or with explicit feature: bash ~/.claude/skills/spec-kit/scripts/detect-phase.sh 001-my-feature
```

Parse the JSON output: `current_step` tells you the phase, `next_action` is the recommended command, `missing_files` lists what's absent.

### 2. Spec Draft Assistant

When user says "help me write a spec", "create a spec for X", or "I want to build Y":

1. Do NOT immediately generate a spec
2. Check which of these are missing from their request: what it does, who uses it, why it matters, main flows, explicit out-of-scope
3. Ask only for what's missing (max 2-3 questions at a time)
4. Then draft the full `spec.md` using the format in [references/workflow.md](references/workflow.md)

See [references/spec-quality.md](references/spec-quality.md) for the draft process and anti-patterns.

### 3. Pre-Command Prerequisites

Before recommending any `/speckit.*` command, consult [references/prerequisites.md](references/prerequisites.md) and verify all conditions are met. If prerequisites are missing, explain what to do first.

### 4. Spec Quality Review

When user asks to "review my spec", "check the spec", or before recommending `/speckit.plan`:

Read `spec.md` and apply the quality criteria in [references/spec-quality.md](references/spec-quality.md). Report findings grouped by severity: CRITICAL → HIGH → MEDIUM → LOW.

### 5. Plan Validation (Step 4.5)

After `/speckit.plan` generates artifacts and before running `/speckit.tasks`, prompt the user to validate the plan. This is the official "Step 5" in the spec-kit workflow — audit the generated artifacts for gaps, over-engineering, and constitution alignment.

**Audit prompts to suggest:**

1. **Sequence audit** — "Read through the implementation plan and determine whether there is a sequence of tasks that are obvious from reading it. For each step in core implementation, reference where in the implementation detail files the information can be found."

2. **Over-engineering check** — "Cross-check the plan for components not in the spec. If over-engineered pieces exist, ask for rationale and resolve them. Ensure the plan follows the constitution."

3. **Rapidly-changing tech research** — When the tech stack includes fast-moving frameworks (e.g., Next.js App Router, .NET Aspire, new LLM SDKs): "Identify specific unknowns in the implementation plan that would benefit from research, then spawn parallel research tasks — one per targeted question, not general framework research."

4. **Constitution alignment check** — Re-read `.specify/memory/constitution.md` against the plan and flag any violations before tasks are generated.

**Optional before implement:** Create a PR from the feature branch to main with a detailed description. Useful for tracking progress and getting early feedback.

---

## File Format Reference

See [references/workflow.md](references/workflow.md) for complete format specs for `spec.md`, `tasks.md`, and `plan.md`.
