# PR Review Output Format

Shared output format for all `*-review-pr` skills. Each phase outputs its section as it completes — streaming progress to the user.

Output language: Thai mixed with English technical terms. Templates below use English for readability; actual output must be in Thai.

---

## Header

Always output first, before any phase work:

```markdown
---

## 📋 PR #<number> — <jira-key> | <Author|Reviewer> Mode | <🟢/🟡/🔴>

**PR:** <title>
**Author:** <author> | **Files changed:** <count> | **Lines changed:** <count> | **Today:** <date>

---
```

If no Jira key: omit `— <jira-key>`.

## Phase 1: Ticket Understanding

Output after fetching Jira ticket. Skip entirely if no Jira key provided.

```markdown
### Phase 1: Ticket Understanding

**Problem:** <problem summary>
**Value:** <why it matters>
**Scope:** <scope>

**AC Checklist:**
- [ ] AC1: <description>
- [ ] AC2: <description>
```

## Phase 2: AC Verification

Output after mapping ACs to code. Skip if no Jira key.

```markdown
### Phase 2: AC Verification

| AC  | Status             | File          | Note                |
| --- | ------------------ | ------------- | ------------------- |
| AC1 | ✅ Implemented      | `src/foo.tsx` | Complete per spec          |
| AC2 | 🔴 Not implemented  | —             | No implementation found |
```

Status values: `✅ Implemented`, `🔴 Not implemented`, `🔴 Partial`.

## Phase 3: 12-Point Review

Output in two parts: agent progress table (update as each agent completes), then findings table (after all 7 agents done).

### Part 1: Agent Progress

```markdown
### Phase 3: 12-Point Review

#### Agent Progress

| Agent                     | Status  | 🔴  | 🟡  | 🔵  |
| ------------------------- | ------- | --- | --- | --- |
| code-reviewer             | ✅ Done | 1   | 2   | 0   |
| comment-analyzer          | ✅ Done | 0   | 0   | 1   |
| pr-test-analyzer          | ✅ Done | 0   | 1   | 0   |
| silent-failure-hunter     | ✅ Done | 0   | 1   | 0   |
| type-design-analyzer      | ✅ Done | 0   | 0   | 1   |
| code-simplifier           | ✅ Done | 0   | 1   | 0   |
| feature-dev:code-reviewer | ✅ Done | 1   | 0   | 1   |
```

### Part 2: Findings (after dedup)

```markdown
**Summary: 🔴 X · 🟡 Y · 🔵 Z** (after dedup)

#### Findings

| #  | Sev | Rule | File          | Line | Agents | Issue                             |
| -- | --- | ---- | ------------- | ---- | ------ | --------------------------------- |
| 1  | 🔴  | #2   | `src/foo.tsx` | 42   | 3/7    | Uses `as any` — should use type guard |
| 2  | 🟡  | #9   | `src/bar.tsx` | 88   | 1/7    | Leftover console.log                  |
```

- **Sev:** 🔴 Critical, 🟡 Warning, 🔵 Info
- **Rule:** reference to checklist rule number (#1-#13)
- Sort: 🔴 first, then 🟡, then 🔵
- If zero findings: `**Summary: ✅ No issues found**`

## Phase 4: Action

### Author Mode

```markdown
### Phase 4: Fixes Applied

| #  | Fix                                | File             |
| -- | ---------------------------------- | ---------------- |
| 1  | Remove `as any`, add type guard    | `src/foo.tsx:42` |
| 2  | Remove console.log                 | `src/bar.tsx:88` |

✅ **Validate:** `<validate-command>` — PASS
```

If validate fails: `❌ **Validate:** <command> — FAIL` then fix and re-validate.

### Reviewer Mode

```markdown
### Phase 4: Review Submitted

**Strengths:**
- praise: (ดี) <specific good practice> `<file:line>`
- praise: (ดี) <specific good practice> `<file:line>`

Submitted **<REQUEST_CHANGES|APPROVE>** with <N> inline comments to GitHub.
```

No fix table — findings are submitted as GitHub inline comments instead.

## Final Verdict

Always output last:

```markdown
---

### Final Verdict

✅ **APPROVE** — Fixed 🔴 X, 🟡 Y issues | AC: N/N ✅ | Validate: PASS | Signal: X%
```

Or:

```markdown
---

### Final Verdict

❌ **REQUEST CHANGES** — Found 🔴 X issues to fix | AC: N/N ❌ | Signal: X%
```

Verdict rules:

- **Author:** ✅ if all 🔴 fixed + validate passes. ❌ if any 🔴 remains or validate fails.
- **Reviewer:** ✅ APPROVE if no 🔴. ❌ REQUEST CHANGES if any 🔴 exists.
- AC counts only shown if Jira key was provided.
- Signal = (🔴+🟡) / Total findings as percentage.
