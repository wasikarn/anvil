# Phase Gates

Every phase transition has explicit gate conditions. No phase proceeds until its gate is met.

## Gate Table

| From → To | Gate condition | Who decides |
| --- | --- | --- |
| Prerequisite → Triage | Agent Teams / subagent / solo detected | Lead (automated) |
| Triage → Investigate | Project detected, mode confirmed, debug-context.md written | User (P0: auto) |
| Investigate → Fix | Root cause identified with file:line evidence | Lead |
| Fix → Ship | All commits pass validate, investigation.md fix plan complete | Lead (automated) |
| Ship → Done | User selects completion option | User |

## Gate Details

### Prerequisite → Triage

- [ ] TeamCreate / Task / solo mode detected and announced
- [ ] User informed of execution mode

### Triage → Investigate (or Fix in Quick mode)

- [ ] Project detected and conventions loaded
- [ ] Severity classified (P0/P1/P2)
- [ ] Mode confirmed (Full/Quick)
- [ ] `debug-context.md` written at project root
- [ ] User acknowledges mode selection (P0: auto-Full, skip this gate)

### Investigate → Fix

- [ ] Investigator completed with root cause analysis
- [ ] Root cause cites file:line evidence with **confidence >= Medium (50%)**
  - **Low confidence** → escalate to user before proceeding; present alternative hypotheses and ask for guidance
  - High/Medium confidence → proceed automatically
- [ ] Primary hypothesis tested: at least one reproduction step confirmed — cite the command run and actual output observed
  - If bug cannot be reproduced → note "unreproducible" in investigation.md and ask user for clarification before proceeding
- [ ] DX Analyst completed with findings table (Full mode only)
- [ ] `investigation.md` written with merged findings and Fix Plan
- [ ] Investigator + DX Analyst shut down

If Investigator cannot identify root cause → escalate to user. Do NOT proceed to Fix.

### Fix → Phase 4 (or Ship if no review)

- [ ] All Fix Plan items verified by Lead's verification loop (not Fixer's self-report)
- [ ] Bug fix committed with regression test
- [ ] DX improvements committed (Critical: all, Warning: as appropriate)
- [ ] **Final Lead verification:**
  1. Run validate command fresh and read actual output
  2. `git diff --stat HEAD~N` — confirm scope matches Fix Plan (N = number of commits)
  3. `git log --oneline -10` — confirm commit-per-task convention followed
  4. No uncommitted changes: `git status` shows clean working tree
- [ ] Fixer shut down

### Phase 4 → Ship (conditional — skip if no `--review` flag and severity is not P0)

- [ ] Fix Reviewer completed with findings table
- [ ] If Critical findings: call AskUserQuestion — question: "Fix Reviewer found Critical issues. Fix before shipping?",
  header: "Critical found", options: [{ label: "Fix before shipping", description: "Address Critical findings now" },
  { label: "Proceed anyway", description: "Ship with known Critical issues (user accepts risk)" }]
- [ ] Fix Reviewer shut down

### Ship → Done

- [ ] Debug Summary presented with commit table
- [ ] User selects via AskUserQuestion — question: "Debug complete. What next?", header: "Ship",
  options: [{ label: "Create PR", description: "Open a pull request with the fix" },
             { label: "Commit to branch", description: "Leave commits on current branch" },
             { label: "Keep for review", description: "No further action — review later" }]
- [ ] Team cleaned up (all teammates shut down)
- [ ] Artifacts optionally archived or deleted

## Escalation Protocol

When fix fails 3+ times:

1. Present all fix attempts with what went wrong
2. Identify pattern: same area failing? coupling issue? architectural problem?
3. Call AskUserQuestion — question: "Fix failed 3 times. How to proceed?",
   header: "Escalation", options: [{ label: "Continue manually", description: "Lead takes over fixing directly" },
   { label: "Rethink approach", description: "Re-investigate with a new hypothesis" },
   { label: "Ship partial fix", description: "User accepts remaining issues" },
   { label: "Abort", description: "Discard all changes" }]
