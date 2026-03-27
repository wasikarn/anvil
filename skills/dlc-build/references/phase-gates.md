# Phase Gates

Every phase transition has explicit gate conditions. No phase proceeds until its gate is met.

## Gate Table

| From → To | Gate condition | Who decides |
| --- | --- | --- |
| Triage → Research | Requirements clear, mode confirmed, blast-radius scored | User |
| Triage → Plan | Micro mode: skip research | Lead (auto) |
| Research → Plan | research.md complete + validator PASS + GO/NO-GO (Full) | User (Full) / Lead (Quick) |
| Plan → Implement | Plan written to artifacts_dir + must_haves.truths defined + challenger addressed (Full) | User (Full) / Lead auto (Micro/Quick) |
| Implement → Verify | All tasks done + validate passes + workers shut down | Lead (automated) |
| Verify → Review | All must_haves.truths PASS + all key_links present | Lead (automated) |
| Verify → Implement (loop) | ANY truth FAIL (Quick/Full, iteration_count < 3) | Lead (targeted re-entry) |
| Verify → Phase 3 (redesign) | STILL FAILING + user picks redesign + redesign_count < 1 | User |
| Review → Assess | Findings consolidated + Stage 1 PASS | Lead |
| Review → Implement (Stage 1 FAIL) | Stage 1 FAIL (test file missing or spec non-compliance) | Lead (automated) |
| Assess → Implement (loop) | Critical found, iteration_count < 3 | Lead (automated) |
| Assess → Ship (exit loop) | Zero Critical (+ zero Warning or user accepts) | Lead + User |
| Assess → STOP (escalate) | iteration_count = 3, still Critical | Lead (escalates to user) |
| Ship → Done | User selects completion option | User |

---

## Gate Details

### Phase 1 (Triage) → Phase 2 (Research) or Phase 3 (Plan for Micro)

- [ ] Project detected and conventions loaded
- [ ] Blast-radius scored (5 factors, 0–5)
- [ ] Workflow mode confirmed (Micro/Quick/Full/Hotfix)
- [ ] Agent Teams availability checked
- [ ] User acknowledges mode selection
- **Micro:** Skip directly to Plan (no research)

### Phase 2 (Research) → Phase 3 (Plan)

- [ ] `research.md` written with structured findings
- [ ] Every section cites file:line references
- [ ] research-validator agent returned PASS
- **Quick (Lite):** no GO/NO-GO verdict required — lead proceeds automatically
- **Full (Deep):** GO/NO-GO verdict READY (or user explicitly accepts NEEDS WORK / NOT READY)
- [ ] Any `[NEEDS CLARIFICATION]` tokens in research.md presented to user if verdict is READY

### Phase 3 (Plan) → Phase 4 (Implement)

- [ ] Plan written to `{artifacts_dir}/{date}-{task-slug}/plan.md`
- [ ] `must_haves.truths` block present (Micro:1, Quick:2–3, Full:3–5)
- [ ] `key_links` section present
- [ ] Tasks tagged `[P]` (parallel) or `[S]` (sequential) with TDD ordering
- [ ] plan-challenger addressed (Full mode only — findings reviewed and accepted/rejected by lead)
- **Full:** User explicitly approves plan (Readiness Verdict = READY or user overrides)
- **Micro/Quick:** Lead proceeds automatically — no user gate required

### Phase 4 (Implement) → Phase 5 (Verify)

- [ ] All assigned tasks in `worker_completion` status DONE (not PARTIAL or BLOCKED)
- [ ] Project validate command passes
- [ ] Each task has at least 1 commit
- [ ] No uncommitted changes in working tree
- [ ] All workers shut down (TeamDelete executed or confirmed idle)
- [ ] **Iteration 2+ only:** Regression check passed — `git diff dlc-checkpoint-iter-{N-1}..HEAD` shows no unintended modifications outside finding fixes

Lead verifies: `git diff {base_branch}...HEAD --stat` (scope) + `git log --oneline {base_branch}..HEAD` (commit-per-task).

### Phase 5 (Verify) → Phase 6 (Review)

- [ ] All must_haves.truths: ✅ PASS (test meaningfulness check passed)
- [ ] All key_links: verified in actual code with file:line
- [ ] `verify-results.md` written to `{artifacts_dir}/{date}-{task-slug}/`

### Phase 5 (Verify) → Phase 4 (Implement) loop — targeted re-entry

- [ ] ANY truth FAIL or SHALLOW
- [ ] iteration_count < 3
- [ ] This is the first Phase 5 loop (max 1 Phase 5-triggered re-entry)
- Lead increments `iteration_count` before re-entering Phase 4
- Workers spawned for ONLY the tasks covering failed truths

### Phase 5 (Verify) → Phase 3 (redesign path)

- [ ] STILL FAILING after 1 Phase 5 loop
- [ ] User explicitly picks option (b) redesign
- [ ] redesign_count < 1 (only 1 redesign allowed)
- Prior artifacts archived with `-attempt-1` suffix
- `redesign_count` incremented in dev-loop-context.md

### Phase 6 (Review) → Phase 7 (Falsification)

- [ ] Stage 1 compliance check PASSED
- [ ] All Stage 2 reviewers completed (per mode scale)
- [ ] Debate rounds completed (Full iter 1: full, iter 2+: focused/none)
- [ ] Raw findings table ready for falsification pass

### Phase 7 (Falsification) → Phase 8 (Assess)

- [ ] `falsification-agent` completed (Full mode iter 1 only)
- [ ] Verdicts applied (SUSTAINED/DOWNGRADED/REJECTED)
- [ ] Post-verdict findings table ready for consolidation
- [ ] `review-consolidator` dispatched with final findings

### Phase 6 (Review) → Phase 4 (Implement) — Stage 1 FAIL

- [ ] Stage 1 FAIL detected (test file missing, spec non-compliance, or hard-rule violation)
- Lead increments `iteration_count` before returning to Phase 4
- Mandatory path: Phase 4 → Phase 5 → Phase 6 Stage 1 (Phase 5 cannot be skipped)

### Phase 8 (Assess) → Loop Decision

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
└→ No: iteration_count < 3?
    ├→ Yes: LOOP (iteration_count++)
    └→ No: STOP — escalate to user
```

### Stall Detection

Run after loop decision:

```text
If iteration_count ≥ 2 AND Critical count(iter N) ≥ Critical count(iter N-1):
→ Flag: "No improvement in Critical count between iterations."
→ Call AskUserQuestion — question: "No improvement in Critical count. How to proceed?",
  header: "Stall detected", options: [
    { label: "Continue loop", description: "Force another fix iteration" },
    { label: "Switch to diagnosis mode", description: "Run /dlc-debug to investigate root cause" },
    { label: "Rethink approach", description: "Return to Phase 3 with findings as input" }
  ]
```

### Phase 9 (Ship) → Done

- [ ] Summary presented with iteration count and TDD violations (if any)
- [ ] User selects via AskUserQuestion — question: "Implementation complete. What next?", header: "Ship",
  options: [{ label: "Create PR", description: "Auto-generate PR from plan + review summary" },
             { label: "Merge directly", description: "Merge to base branch now" },
             { label: "Keep branch", description: "Leave branch as-is for later review" },
             { label: "Restart loop", description: "Run another fix iteration" }]
- [ ] Team cleaned up (all teammates shut down)

---

## Escalation Protocol

When iteration_count = 3 and still Critical findings:

1. Present all 3 iterations' findings side-by-side
2. Identify root pattern: same file/area failing repeatedly?
3. Call AskUserQuestion — question: "Iteration 3 still has Critical findings. How to proceed?",
   header: "Escalation", options: [
     { label: "Continue manually", description: "Lead takes over fixing directly" },
     { label: "Rethink approach", description: "Return to Phase 3 with findings as input" },
     { label: "Ship with known issues", description: "User accepts risk of shipping Critical findings" },
     { label: "Abort", description: "Discard branch entirely" }
   ]
