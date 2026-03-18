---
name: dlc-respond
description: "Respond to PR review comments — reads all open GitHub review threads, fixes each issue, commits, replies to threads, and re-requests review. Use when: you received PR review feedback and need to address reviewer comments. Triggers: respond to review, fix review comments, resolve review threads, address PR feedback, reply to reviewer, /dlc-respond."
argument-hint: "[pr-number] [jira-key?]"
compatibility: "Requires gh CLI, git, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (degrades gracefully without)"
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git *), Bash(gh *)
---

# dlc-respond — Address PR Review Comments

Invoke as `/dlc-respond [pr-number] [jira-key?]`

---

**PR:** #$0 | **Today:** !`date +%Y-%m-%d`
**Git branch:** !`git branch --show-current`
**Project:** !`bash "${CLAUDE_SKILL_DIR}/../../scripts/detect-project.sh" 2>/dev/null`
**Open threads:** !`gh pr view $0 --json reviews,comments --jq '[.reviews[] | select(.state == "CHANGES_REQUESTED")] | length' 2>/dev/null`
**PR diff stat:** !`rtk gh pr diff $0 --stat 2>/dev/null`

**Args:** `$0`=PR# (required) · `$1`=Jira key (optional, for AC context)

Read CLAUDE.md first — auto-loaded, contains project patterns and conventions.

## References

| File | Load when |
| --- | --- |
| [references/teammate-prompts.md](references/teammate-prompts.md) | Phase 1: creating Fixer teammates |
| [references/phase-gates.md](references/phase-gates.md) | Any gate transition |
| [references/operational.md](references/operational.md) | Mode detection, compression recovery, success criteria |
| [../../references/review-conventions.md](../../references/review-conventions.md) | Phase 2: reply format and comment labels |
| [../../references/jira-integration.md](../../references/jira-integration.md) | Phase 0 Step 0.5: when Jira key detected in `$1` |

---

## Prerequisite Check

Detect mode per [references/operational.md](references/operational.md) Graceful Degradation table. Inform user.

---

## Phase 0: Triage (Lead Only)

### Step 1: Detect Project

Use the `Project` JSON from the header. Load project-specific Hard Rules from `{project_root}/.claude/skills/review-rules/hard-rules.md` if present.

### Step 0.5: Jira Context (if `$1` present)

If `$1` matches `BEP-\d+`, follow `## dlc-respond` section in [../../references/jira-integration.md](../../references/jira-integration.md) to fetch AC and enrich thread prioritization.

### Step 2: Fetch All Open Threads

Fetch all threads — see [references/operational.md](references/operational.md#phase-0-thread-fetch-commands) for gh API commands. Fetch both: inline review comments (by line) and review-level comments (CHANGES_REQUESTED + COMMENTED).

### Step 2.5: Check Dismissed Patterns

Load `{project_root}/.claude/review-dismissed.md` if present. Threads matching dismissed patterns → note as "Previously dismissed" in triage table (still include — reviewer may have re-raised with new evidence).

### Step 3: Classify Threads

Build triage table:

```markdown
## Thread Triage

| # | File | Line | Reviewer | Severity | Issue Summary | Status | AC |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | src/foo.ts | 42 | reviewer | 🔴 Critical | ... | Open | AC1 |
| 2 | src/bar.ts | 15 | reviewer | 🟡 Important | ... | Open | — |
```

`AC` column: populated only when `$1` Jira key provided — `AC1`, `AC2`, etc. for threads relating to an AC item; `—` for unrelated threads.

**Severity inference:**

- 🔴 Critical: Hard Rule violation, security issue, data loss risk, incorrect business logic, missing AC implementation
- 🟡 Important: Code quality, maintainability, incomplete fix, AC-related suggestion
- 🔵 Suggestion: Style, naming, optional improvement

**Conventional Comments decoration overrides** (scan thread body first):

- `(non-blocking)` in thread body → override to 🔵 Suggestion regardless of content
- `(blocking)` in thread body → override to 🔴 Critical regardless of content
- No decoration → use severity inference above

### Step 4: Write `respond-context.md`

Write to `{project_root}/respond-context.md` — thread triage table, project info, validate command, Jira context if fetched. Required for context compression recovery.

**GATE:** Call AskUserQuestion (see [references/phase-gates.md](references/phase-gates.md) Triage → Fix gate) → proceed.

---

## Phase 1: Fix Threads

Fix in severity order: 🔴 Critical → 🟡 Important → 🔵 Suggestion (only if user requested).

**Bootstrap (Lead — before spawning Fixers):**

1. Read all affected files (files listed in triage table)
2. Run `git log --oneline -5 -- {affected_files}` for recent change context
3. Include pre-gathered content as shared context in each Fixer prompt — avoids redundant per-Fixer reads

**Agent Teams mode:** Create 1 Fixer per non-overlapping file group using prompts from [references/teammate-prompts.md](references/teammate-prompts.md).
**Solo/subagent mode:** Lead fixes sequentially using the same Fixer rules.

**Lead verification gate (before Phase 2):**

- Run validate independently: `{validate_command}`
- Check `git diff --stat` — scope must match thread scope only
- If validate fails or scope crept → revert and re-fix before proceeding

**GATE:** All Critical+Important fixed + Lead-verified validate passes. (See [references/phase-gates.md](references/phase-gates.md) Fix → Reply gate.)

---

## Phase 2: Reply to Threads

Post a reply for each thread. Comment labels per [../../references/review-conventions.md](../../references/review-conventions.md).

```bash
gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/replies \
  -f body="{reply_body}"
```

**Before posting replies:** Lead verifies `rtk git log --oneline -10` — confirm that the sha in each planned reply matches the commit whose message references that thread. Mismatched sha → fix the reply before posting.

Reply format and PR summary template: [references/operational.md](references/operational.md#phase-2-reply-formats).

After all thread replies, post summary:

```bash
gh pr review {pr} --comment --body "{summary}"
```

Update `respond-context.md` progress section after each thread reply.

**GATE:** All threads replied. (See [references/phase-gates.md](references/phase-gates.md) Reply → Re-request gate.)

---

## Phase 3: Re-request Review (Lead Only)

```bash
gh pr edit {pr} --add-reviewer {original_reviewer_login}
```

### Final Summary

```markdown
## Respond Review Complete

**PR:** #{pr}
**Threads addressed:** {total}
**Commits made:** {count}
**Validate:** ✅ passes
**Re-review requested:** {reviewer_login}
```

See [references/operational.md](references/operational.md) for Success Criteria checklist and team cleanup steps.

---

## Constraints

- **Fix scope = thread scope only** — why: scope creep makes re-review harder and risks introducing new issues unrelated to the review
- **Validate BEFORE commit** — why: reverting uncommitted changes is cheaper than reverting commits; catches regressions before they enter history
- **Never silently skip a Critical thread** — why: skipped Criticals become production incidents; if unfixable, the decision must be explicit and documented
- **Max 3 fix attempts per thread** — why: beyond 3 attempts = architectural mismatch, not a surface fix; further attempts waste tokens without progress
- **One commit per thread group** — why: enables clean revert of one fix without affecting others
- **READ the code before fixing** — do not guess at the reviewer's intent
