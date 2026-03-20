---
name: dlc-build
description: "Primary development workflow — use /dlc-build for any coding task: new features, bug fixes, refactors, schema changes, CI failures, production hotfixes, or implementing Jira tickets. Runs Research → Plan → Implement → Review → Ship with iterative fix-review loop and Agent Teams. Pass a Jira key (BEP-XXXX) to auto-extract acceptance criteria into plan tasks. Modes: --quick skips research for small fixes; --hotfix for urgent production incidents (branches from main, creates backport PR to develop). Review scales by diff size. Triggers on: implement this feature, write the code for, fix this bug, create a new endpoint, scaffold this module, add tests for, TDD, CI is failing. When in doubt which dev workflow to use, start here."
argument-hint: "[task-description-or-jira-key] [--quick?] [--full?] [--hotfix?]"
compatibility: "Requires gh CLI, git, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (degrades gracefully without)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git *), Bash(gh *)
---

# Team Dev Loop — Full Development Workflow

Invoke as `/dlc-build [task-description-or-jira-key] [--quick?] [--full?] [--hotfix?]`

**Task:** $ARGUMENTS | **Today:** !`date +%Y-%m-%d`
**Git branch:** !`git branch --show-current`
**Recent commits:** !`git log --oneline -5 2>/dev/null || true`
**Project:** !`bash "${CLAUDE_SKILL_DIR}/../../scripts/detect-project.sh" 2>/dev/null || true`
**Artifacts dir:** !`bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" dlc-build "$0" 2>/dev/null || echo ""`

**Args:** `$0`=task description or Jira key (required) · `$1`=`--quick` · `$1`=`--full` · `$1`=`--hotfix`

Read CLAUDE.md first — auto-loaded, contains project patterns and conventions.

---

## Phase Flow

Phase 0→1→2→ [3: Implement ↔ 4: Review ↔ 5: Assess loop (max 3)] →6: Ship

| Iter | Implement | Reviewers | Debate |
| --- | --- | --- | --- |
| 1 | Full plan | 3 | Full (2 rounds max, early-exit at 90% consensus) |
| 2 | Fix findings | 2 | Focused (1 round) |
| 3 | Remaining fixes | 1 | None (spot-check only) |

---

## Reference Loading (on demand only)

| File / Agent | Load when |
| --- | --- |
| [references/phase-0-triage.md](references/phase-0-triage.md) | Entering Phase 0 |
| [references/phase-1-research.md](references/phase-1-research.md) | Entering Phase 1 (Full mode) |
| [references/phase-2-plan.md](references/phase-2-plan.md) | Entering Phase 2 |
| [references/phase-3-implement.md](references/phase-3-implement.md) | Entering Phase 3 |
| [references/phase-4-review.md](references/phase-4-review.md) | Entering Phase 4 |
| [references/phase-5-assess.md](references/phase-5-assess.md) | Entering Phase 5 |
| [references/phase-6-ship.md](references/phase-6-ship.md) | Entering Phase 6 |
| [references/workflow-modes.md](references/workflow-modes.md) | Phase 0 — mode classification |
| [references/modes/feature.md](references/modes/feature.md) · [references/modes/quick.md](references/modes/quick.md) · [references/modes/hotfix.md](references/modes/hotfix.md) | Phase 0 Step 2.5 — load the file matching the confirmed mode |
| [references/operational.md](references/operational.md) | Phase 0 (degradation) + Phase 3 end (Verification Gate) + on crash |
| [references/phase-gates.md](references/phase-gates.md) | At each phase transition |
| [references/explorer-prompts.md](references/explorer-prompts.md) | Entering Phase 1 |
| [references/worker-prompts.md](references/worker-prompts.md) | Entering Phase 3 iter 1 |
| [references/fixer-prompts.md](references/fixer-prompts.md) | Entering Phase 3 iter 2+ |
| [references/reviewer-prompts.md](references/reviewer-prompts.md) | Entering Phase 4 |
| [references/reviewer-shared-rules.md](references/reviewer-shared-rules.md) | Phase 4 — shared reviewer rules/output format (referenced by reviewer templates) |
| [references/review-lenses/frontend.md](references/review-lenses/frontend.md) · [security.md](references/review-lenses/security.md) · [database.md](references/review-lenses/database.md) · [performance.md](references/review-lenses/performance.md) · [typescript.md](references/review-lenses/typescript.md) | Phase 4 — domain lenses injected per diff content (see Lens Selection in reviewer-prompts.md) |
| `review-consolidator` agent | Phase 4 iter 1 (3 reviewers) — consolidate findings |
| [../../references/review-conventions.md](../../references/review-conventions.md) | Entering Phase 4 |
| [../../references/review-output-format.md](../../references/review-output-format.md) | Entering Phase 4 |
| [../../references/debate-protocol.md](../../references/debate-protocol.md) | Phase 4 iter 1 debate only (fallback in phase-4-review.md) |
| [../../references/jira-integration.md](../../references/jira-integration.md) | Jira key in `$ARGUMENTS` |
| [references/pr-template.md](references/pr-template.md) | Entering Phase 6 |

## Fallback Behavior

**Jira unreachable:** If Jira fetch fails — proceed with task description as acceptance criteria. Note `[Jira: UNAVAILABLE]` in dev-loop-context.md.

**Mode confirmation timeout:** If user doesn't respond to mode selection within 1 message → default to Full mode and proceed. Note the auto-selection in the triage output.

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
- **Artifacts path** — `{artifacts_dir}` from header (path from `scripts/artifact-dir.sh dlc-build`); plan file → `~/.claude/plans/`

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
| Assess → Escalate (STOP) | Iteration 3, still Critical — present 4 options |
| Ship → Done | User selects completion option |

Full gate details: [references/phase-gates.md](references/phase-gates.md)
