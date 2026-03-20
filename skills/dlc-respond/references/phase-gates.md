# Phase Gates

Every phase transition has explicit gate conditions. No phase proceeds until its gate is met.

## Gate Table

| From → To | Gate condition | Who decides |
| --- | --- | --- |
| Prerequisite → Triage | Mode detected (Agent Teams / subagent / solo) | Lead (automated) |
| Triage → Fix | All threads fetched + classified + `respond-context.md` written | User |
| Fix → Reply | All Critical+Important fixed + validate passes (Lead-verified) | Lead (automated) |
| Reply → Re-request | All threads replied on GitHub | Lead (automated) |
| Re-request → Done | Review re-requested from reviewer(s) | Lead (automated) |

## Gate Details

### Prerequisite → Triage

- [ ] Agent Teams / subagent / solo mode detected and logged
- [ ] Project detected via `detect-project.sh`
- [ ] Jira key scanned from `$1` (if present, Jira context fetched)

### Triage → Fix

- [ ] All open inline review threads fetched (`gh api`)
- [ ] All review-level CHANGES_REQUESTED comments fetched (`gh pr view`)
- [ ] Threads classified by severity (Critical / Important / Suggestion)
- [ ] Dismissed patterns checked (`{review_memory_dir}/review-dismissed.md`)
- [ ] Triage table presented then AskUserQuestion — question: "Triage complete. Proceed or override severity first?",
  header: "Triage", options: [{ label: "Looks good, proceed", description: "Start fixing in severity order" },
  { label: "Override severity / skip some", description: "Edit triage before fixing — lead adjusts then re-confirms" }]
- [ ] `respond-context.md` written at project root

### Fix → Reply

- [ ] All Critical threads resolved (fixed or escalated — never silently skipped)
- [ ] All Important threads resolved (fixed or user-accepted skip)
- [ ] Each fix committed with `fix(scope): address review — {description}` message
- [ ] Validate command passes — **Lead runs independently**, not Fixer self-report
- [ ] `git diff --stat` confirms scope matches thread scope (no unrequested changes)
- [ ] No fix introduced a new Critical issue
- [ ] Lead verified commit sha per thread: `git log --oneline -10` confirms sha in planned reply matches the commit for that thread's fix

### Reply → Re-request

- [ ] Reply posted for every thread:
  - Fixed → `แก้ไขแล้วครับ — {commit_sha_short}: {description}`
  - Declined → `ขอบคุณสำหรับ suggestion ครับ — ไม่ได้แก้เพราะ [เลือก {approach} เพราะ {tradeoff}] — ถ้าแก้ตาม suggestion อาจ [consequence] — ถ้า concern ยังอยู่ รบกวน clarify เพิ่มเติมได้ครับ`
  - Informational → `รับทราบครับ — {acknowledgment}`
- [ ] Summary review comment posted (`gh pr review --comment`) includes request for reviewer to resolve fixed conversation threads
- [ ] `respond-context.md` progress section updated

### Re-request → Done

- [ ] Review re-requested from all original CHANGES_REQUESTED reviewers
- [ ] Final summary presented to user
- [ ] Team cleaned up (all Fixer teammates shut down)

## Escalation Protocol

When a thread fix fails 3 times:

1. Present all 3 fix attempts with exact error/failure from each
2. Identify pattern: same error type? same file area? same constraint?
3. Call AskUserQuestion — question: "Thread fix failed 3 times. How to proceed?",
   header: "Escalation", options: [{ label: "Take over manually", description: "Lead fixes this thread directly" },
   { label: "Decline with explanation", description: "Reply to reviewer explaining why this won't be fixed" },
   { label: "Need guidance", description: "Pause — lead reviews what was tried and advises" }]
4. Never silently skip — record the decision in `respond-context.md`
