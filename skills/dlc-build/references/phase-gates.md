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
- [ ] Project validate command passes (e.g. `npm run validate:all`)
- [ ] Each task has at least 1 commit
- [ ] No uncommitted changes in working tree

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
│   └→ No: Ask user "Fix warnings?"
│       ├→ Yes: LOOP (iteration++)
│       └→ No: EXIT LOOP → Ship
└→ No: iteration < 3?
    ├→ Yes: LOOP (iteration++)
    └→ No: STOP — escalate to user
```

### Ship → Done

- [ ] Summary presented with iteration count
- [ ] User selects: create PR / merge / keep branch / restart loop
- [ ] If PR: description auto-generated from the plan + review summary
- [ ] Team cleaned up (all teammates shut down)

## Escalation Protocol

When iteration 3 still has Critical findings:

1. Present all 3 iterations' findings side-by-side
2. Identify root pattern: same file/area failing repeatedly?
3. Offer options:
   - "Continue manually (lead takes over fixing)"
   - "Rethink approach (return to Phase 2 with findings as input)"
   - "Ship with known issues (user accepts risk)"
   - "Abort (discard branch)"
