# Phase Gates

Every phase transition has explicit gate conditions. No phase proceeds until its gate is met.

## Gate Table

| From → To | Gate condition | Who decides |
| --- | --- | --- |
| Triage → Research | Requirements clear, mode confirmed | User |
| Research → Plan | research.md complete with file:line evidence | Lead |
| Plan → Implement (iter 1) | the plan approved by user (annotation cycle done) | User |
| Implement → Review | All tasks done + validate passes | Lead (automated) |
| Review → Assess | Findings consolidated with consensus | Lead |
| Assess → Implement (loop) | Critical found, iteration < 3 | Lead (automated) |
| Assess → Ship (exit loop) | Zero Critical (+ zero Warning or user accepts) | Lead + User |
| Assess → STOP (escalate) | Iteration 3, still Critical | Lead (escalates to user) |
| Ship → Done | User selects completion option | User |

## Gate Details

### Triage → Research (or Plan in Quick mode)

- [ ] Project detected and conventions loaded
- [ ] Workflow mode confirmed (Full/Quick)
- [ ] Agent Teams availability checked
- [ ] User acknowledges mode selection

### Research → Plan

- [ ] `research.md` written with structured findings
- [ ] Every section cites file:line references
- [ ] Open questions listed and resolved (or escalated to user)
- [ ] At least 2 explorer teammates completed their assignments

### Plan → Implement

- [ ] Plan written and saved (`~/.claude/plans/`)
- [ ] Tasks tagged `[P]` (parallel) or `[S]` (sequential)
- [ ] User completed at least 1 annotation cycle
- [ ] User explicitly approves plan

### Implement → Review

- [ ] All tasks in the plan marked complete
- [ ] Project validate command passes (e.g. `npm run validate:all`) (fallback if validate field empty: `npx tsc --noEmit && npx eslint . --ext .ts,.tsx`)
- [ ] Each task has at least 1 commit
- [ ] No uncommitted changes in working tree
- [ ] All workers shut down (TeamDelete executed or confirmed idle) — reviewers must not spawn while workers are alive (verify: TeamDelete called or git log shows commit count matches task count)
- [ ] **Iteration 2+ only:** Regression check passed — `git diff dlc-checkpoint-iter-{N-1}..HEAD` shows no unintended file modifications outside of finding fixes (see Regression Gate in operational.md)

Lead verifies with: `git diff {base_branch}...HEAD --stat` (scope) + `git log --oneline {base_branch}..HEAD` (commit-per-task). See Verification Gate in operational.md.

### Review → Assess

- [ ] All reviewers completed independent review
- [ ] Debate rounds completed (iteration 1: full, iteration 2+: focused/none)
- [ ] Findings consolidated with consensus indicators
- [ ] `review-findings-N.md` written

### Assess → Loop Decision

Decision tree:

```text
Critical count == 0?
├→ Yes: Warning count == 0?
│   ├→ Yes: EXIT LOOP → Ship
│   └→ No: Call AskUserQuestion — question: "Warnings found. Fix before shipping?",
│       header: "Warnings", options: [{ label: "Fix warnings", description: "Loop — iteration++" },
│       { label: "Ship anyway", description: "Exit loop and proceed to Ship" }]
│       ├→ Fix warnings: LOOP (iteration++)
│       └→ Ship anyway: EXIT LOOP → Ship
└→ No: iteration < 3?
    ├→ Yes: LOOP (iteration++)
    └→ No: STOP — escalate to user
```

### Stall Detection

Run after loop decision:

```text
If iteration ≥ 2 AND Critical count(iter N) ≥ Critical count(iter N-1):
→ Flag: "No improvement in Critical count between iterations. Likely cause: fixer not reading findings, or architectural issue requiring redesign."
→ Call AskUserQuestion — question: "No improvement in Critical count between iterations. How to proceed?",
  header: "Stall detected", options: [{ label: "Continue loop", description: "Force another fix iteration" },
  { label: "Switch to diagnosis mode", description: "Run /dlc-debug to investigate root cause" },
  { label: "Rethink approach", description: "Return to Phase 2 with findings as input" }]
```

### Ship → Done

- [ ] Summary presented with iteration count
- [ ] User selects via AskUserQuestion — question: "Implementation complete. What next?", header: "Ship",
  options: [{ label: "Create PR", description: "Auto-generate PR from plan + review summary" },
             { label: "Merge directly", description: "Merge to base branch now" },
             { label: "Keep branch", description: "Leave branch as-is for later review" },
             { label: "Restart loop", description: "Run another fix iteration" }]
- [ ] If PR: description auto-generated from the plan + review summary
- [ ] Team cleaned up (all teammates shut down)

## Escalation Protocol

When iteration 3 still has Critical findings:

1. Present all 3 iterations' findings side-by-side
2. Identify root pattern: same file/area failing repeatedly?
3. Call AskUserQuestion — question: "Iteration 3 still has Critical findings. How to proceed?",
   header: "Escalation", options: [{ label: "Continue manually", description: "Lead takes over fixing directly" },
   { label: "Rethink approach", description: "Return to Phase 2 with findings as input" },
   { label: "Ship with known issues", description: "User accepts risk of shipping Critical findings" },
   { label: "Abort", description: "Discard branch entirely" }]
