---
name: dlc-build
description: "Full development loop with Agent Teams — Research → Plan → Implement → Review → Ship with iterative fix-review loop. Pass a Jira key (BEP-XXXX) to auto-extract AC into plan tasks. Use when: building features, refactoring code, implementing tickets, or any multi-step development task. Use --hotfix for urgent production fixes that branch from main and auto-create backport PR. Triggers: dev loop, build feature, implement ticket, hotfix, /dlc-build."
argument-hint: "[task-description-or-jira-key] [--quick?] [--full?] [--hotfix?]"
compatibility: "Requires gh CLI, git, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (degrades gracefully without)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git *), Bash(gh *)
---

# Team Dev Loop — Full Development Workflow

Invoke as `/dlc-build [task-description-or-jira-key] [--quick?] [--full?] [--hotfix?]`

**Task:** $ARGUMENTS | **Today:** !`date +%Y-%m-%d`
**Git branch:** !`git branch --show-current`
**Recent commits:** !`git log --oneline -5 2>/dev/null`
**Project:** !`bash "${CLAUDE_SKILL_DIR}/../../scripts/detect-project.sh" 2>/dev/null`

**Args:** `$0`=task description or Jira key (required) · `$1`=`--quick` · `$1`=`--full` · `$1`=`--hotfix`

Read CLAUDE.md first — auto-loaded, contains project patterns and conventions.

---

## Phase Flow

```text
Phase 0: Triage ──→ Phase 1: Research (Full) ──→ Phase 2: Plan
                                                      ↓
                          ┌────────────────────────────────────────────────┐
                          │  Phase 3: Implement → Phase 4: Review          │
                          │             ↓                                  │
                          │  Phase 5: Assess ──→ EXIT → Phase 6: Ship      │
                          │             └──→ LOOP (max 3 iterations)       │
                          └────────────────────────────────────────────────┘
```

| Iter | Implement | Reviewers | Debate |
| --- | --- | --- | --- |
| 1 | Full plan | 3 | Full (2 rounds max, early-exit at 90% consensus) |
| 2 | Fix findings | 2 | Focused (1 round) |
| 3 | Remaining fixes | 1 | None (spot-check only) |

---

## Reference Loading (on demand only)

| File | Load when |
| --- | --- |
| [references/phase-0-triage.md](references/phase-0-triage.md) | Entering Phase 0 |
| [references/phase-1-research.md](references/phase-1-research.md) | Entering Phase 1 (Full mode) |
| [references/phase-2-plan.md](references/phase-2-plan.md) | Entering Phase 2 |
| [references/phase-3-implement.md](references/phase-3-implement.md) | Entering Phase 3 |
| [references/phase-4-review.md](references/phase-4-review.md) | Entering Phase 4 |
| [references/phase-5-assess.md](references/phase-5-assess.md) | Entering Phase 5 |
| [references/phase-6-ship.md](references/phase-6-ship.md) | Entering Phase 6 |
| [references/workflow-modes.md](references/workflow-modes.md) | Phase 0 — mode classification |
| [references/operational.md](references/operational.md) | Phase 0 (degradation) + Phase 3 end (Verification Gate) + on crash |
| [references/phase-gates.md](references/phase-gates.md) | At each phase transition |
| [references/explorer-prompts.md](references/explorer-prompts.md) | Entering Phase 1 |
| [references/worker-prompts.md](references/worker-prompts.md) | Entering Phase 3 iter 1 |
| [references/fixer-prompts.md](references/fixer-prompts.md) | Entering Phase 3 iter 2+ |
| [references/reviewer-prompts.md](references/reviewer-prompts.md) | Entering Phase 4 |
| [references/consolidation-prompt.md](references/consolidation-prompt.md) | Phase 4 iter 1 with 3 reviewers |
| [../../references/review-conventions.md](../../references/review-conventions.md) | Entering Phase 4 |
| [../../references/review-output-format.md](../../references/review-output-format.md) | Entering Phase 4 |
| [../dlc-review/references/debate-protocol.md](../dlc-review/references/debate-protocol.md) | Phase 4 iter 1 debate only (check existence first — fallback in phase-4-review.md) |
| [../../references/jira-integration.md](../../references/jira-integration.md) | Jira key in `$ARGUMENTS` |
| [references/pr-template.md](references/pr-template.md) | Entering Phase 6 |

---

## Prerequisite Check

Before anything, verify agent teams are available:

```text
If TeamCreate tool is not available → check graceful degradation:
- If Task (subagent) tool is available → "Agent Teams not enabled. Running in subagent mode."
- If neither → "Running in solo mode. All phases executed by lead sequentially."
```

See [references/operational.md](references/operational.md) for degradation behavior details.

---

## Constraints

- **Max 3 teammates concurrent** — more adds coordination overhead without proportional value
- **Workers READ-ONLY during review** — no workers alive during Phase 4; reviewers never modify files
- **Lead is sole writer of dev-loop-context.md** — workers SendMessage; lead updates the file
- **Artifacts persist on disk** — `dev-loop-context.md`, plan file, `research.md`, `review-findings-*.md` survive context compression
- **YAGNI** — implement only what the task requires; speculative abstractions are review findings

---

## Gate Summary

| Transition | Key condition |
| --- | --- |
| Triage → Research/Plan | Mode confirmed by user |
| Research → Plan | research.md complete with file:line evidence |
| Plan → Implement | Plan approved by user |
| Implement → Review | All tasks + validate + workers shut down |
| Review → Assess | Findings consolidated |
| Assess → Loop | Critical found, iteration < 3 |
| Assess → Ship | Zero Critical (or user accepts) |

Full gate details: [references/phase-gates.md](references/phase-gates.md)
