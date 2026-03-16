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
- [ ] DX Analyst completed with findings table (Full mode only)
- [ ] `investigation.md` written with merged findings and Fix Plan
- [ ] Investigator + DX Analyst shut down

If Investigator cannot identify root cause → escalate to user. Do NOT proceed to Fix.

### Fix → Phase 2.5 (or Ship if no review)

- [ ] All Fix Plan items verified by Lead's verification loop (not Fixer's self-report)
- [ ] Bug fix committed with regression test
- [ ] DX improvements committed (Critical: all, Warning: as appropriate)
- [ ] **Final Lead verification:**
  1. Run validate command fresh and read actual output
  2. `git diff --stat HEAD~N` — confirm scope matches Fix Plan (N = number of commits)
  3. `git log --oneline -10` — confirm commit-per-task convention followed
  4. No uncommitted changes: `git status` shows clean working tree
- [ ] Fixer shut down

### Phase 2.5 → Ship (conditional — skip if no `--review` flag and severity is not P0)

- [ ] Fix Reviewer completed with findings table
- [ ] If Critical findings: user decides to fix or proceed
- [ ] Fix Reviewer shut down

### Ship → Done

- [ ] Debug Summary presented with commit table
- [ ] User selects: create PR / commit to branch / keep for review
- [ ] Team cleaned up (all teammates shut down)
- [ ] Artifacts optionally archived or deleted

## Escalation Protocol

When fix fails 3+ times:

1. Present all fix attempts with what went wrong
2. Identify pattern: same area failing? coupling issue? architectural problem?
3. Offer options:
   - "Continue manually (lead takes over fixing)"
   - "Rethink approach (re-investigate with new hypothesis)"
   - "Ship partial fix (user accepts remaining issues)"
   - "Abort (discard changes)"
