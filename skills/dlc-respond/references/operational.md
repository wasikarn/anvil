# Operational Reference

## Graceful Degradation

| Level | Available tools | Behavior |
| --- | --- | --- |
| **Agent Teams** | TeamCreate, SendMessage | Full workflow — Fixer teammates per file group, communicate via messages |
| **Subagent** | Task (Agent tool) | Same phases, Fixers as sequential subagents. No inter-teammate messaging. |
| **Solo** | None (lead only) | Lead fixes all threads sequentially. No parallelization. |

Detect at Prerequisite Check and inform user of mode.

## Bootstrap

Before spawning Fixers (Phase 1), Lead pre-gathers shared context:

1. Read all affected files (files listed in triage table)
2. `git log --oneline -5 -- {affected_files}` — recent change context per file
3. Attach pre-gathered content to each Fixer prompt under "Shared File Context" heading

This prevents each Fixer from redundantly reading the same files and reduces total token spend, especially in Agent Teams mode with 2–3 parallel Fixers.

## De-escalation Protocol

When a reviewer responds negatively to a decline or the exchange becomes heated:

1. **Do not reply immediately** — read the reviewer's message again objectively before responding
2. **Check for missed context** — did the reviewer provide new information that changes the tradeoff? If yes, reconsider the decline
3. **Partial acknowledgment** — if reviewer's concern has merit even partially, implement the partial fix and update the decline reply
4. **Escalate to human** — if consensus is impossible after two exchange rounds, stop replying and surface to user: "Thread #{N} — reviewer and I disagree on [X]. Here are both positions. How would you like to proceed?"
5. **Never reply defensively** — courtesy is non-negotiable; if the next reply would be defensive, escalate to human instead

## Context Compression Recovery

If session compacts mid-workflow, re-read in order:

1. `respond-context.md` — thread triage table, project, validate command, Jira context, **Progress section** (which threads done)
2. `git log --oneline -10` — see which threads already have fix commits
3. Re-fetch open GitHub threads — compare with triage table to find unresolved threads
4. Resume from first unresolved thread in the triage table

### Progress Section Template

`respond-context.md` must include a Progress section with this structure:

```markdown
## Progress

| Thread # | Status | Commit |
| --- | --- | --- |
| 1 | ✅ Fixed | abc1234 |
| 2 | 🔄 In progress | — |
| 3 | ⏳ Pending | — |
| 4 | ❌ Declined | — |
```

Update this table after each thread fix and after each reply post. Used by crash recovery to find first unresolved thread without re-reading the full triage table.

## Success Criteria

- [ ] Prerequisite check completed (Agent Teams / subagent / solo detected)
- [ ] Project detected and conventions loaded
- [ ] All open review threads fetched (inline + review-level)
- [ ] Threads classified by severity — triage table confirmed by user
- [ ] `respond-context.md` written at project root
- [ ] All Critical + Important threads fixed (or escalated to user)
- [ ] Validate command passes — verified by Lead independently
- [ ] All threads replied on GitHub with commit references
- [ ] Summary review comment posted
- [ ] Re-review requested from original reviewer(s)
- [ ] Team cleaned up (all teammates shut down)

## Phase 0: Thread Fetch Commands

Inline review comments:

```bash
gh api repos/{owner}/{repo}/pulls/{pr}/comments \
  --jq '[.[] | {id, path, line, body, user: .user.login, html_url}]'
```

Review-level comments (CHANGES_REQUESTED + COMMENTED):

```bash
gh pr view {pr} --json reviews \
  --jq '.reviews[] | select(.state == "CHANGES_REQUESTED" or .state == "COMMENTED") | {id, author: .author.login, body, state}'
```

## Phase 2: Reply Formats

**Fixed:** `แก้ไขแล้วครับ — {commit_sha_short}: {description}`

**Declined:** `ขอบคุณสำหรับ suggestion ครับ — ไม่ได้แก้เพราะ [เลือก {current_approach} เพราะ {tradeoff}] — ถ้าแก้ตาม suggestion อาจ [specific_consequence] — ถ้า concern ยังอยู่ รบกวน clarify เพิ่มเติมได้ครับ`

**Informational:** `รับทราบครับ — {acknowledgment}`

**PR Summary (post after all thread replies):**

```markdown
## ตอบ Review Comments ครับ

แก้ไขแล้ว {N} threads:
- 🔴 {count} Critical issues fixed
- 🟡 {count} Important issues fixed
- 🔵 {count} Suggestions acknowledged

Commits: {list of fix commit shas}

**Validate:** {validate_command} ✅

ขอความกรุณา resolve conversation threads ที่ fixed แล้วได้เลยครับ (GitHub ไม่อนุญาตให้ author resolve threads ของ reviewer ผ่าน API)
```
