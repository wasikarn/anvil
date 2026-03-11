---
name: tathep-admin-review-pr
description: "PR review skill for tathep-admin (Next.js 14 Pages Router + Tailwind + Headless UI + Vitest). Dispatches 7 parallel specialized agents, verifies Jira AC, then fixes issues (Author) or submits inline comments (Reviewer). Triggers: review PR, check PR, code review, /tathep-admin-review-pr."
argument-hint: "[pr-number] [jira-key?] [Author|Reviewer]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(gh *), Bash(git *)
compatibility: "Requires gh CLI and git. Run from within the tathep-admin repo."
---

# PR Review — tathep-admin

Invoke as `/tathep-admin-review-pr [pr-number] [jira-key?] [Author|Reviewer]`

## References

| File |
| --- |
| [checklist.md](references/checklist.md) |
| [examples.md](references/examples.md) |
| [review-output-format.md](../../references/review-output-format.md) |
| [review-conventions.md](../../references/review-conventions.md) |

---

**PR:** #$0 | **Jira:** $1 | **Mode:** $2 (default: Author)
**Today:** !`date +%Y-%m-%d`
**Diff stat:** !`git diff develop...HEAD --stat 2>/dev/null | tail -10`
**PR title:** !`gh pr view $0 --json title,body,labels,author --jq '{title,body,labels: [.labels[].name],author: .author.login}' 2>/dev/null`
**PR comments:** !`gh pr view $0 --comments --json comments --jq '[.comments[] | {author: .author.login, body: .body[:200]}]' 2>/dev/null`
**Changed files:** !`gh pr diff $0 --name-only 2>/dev/null`

**Args:** `$0`=PR# (required) · `$1`=Jira key or Author/Reviewer · `$2`=Author/Reviewer
**Modes:** Author = fix code · Reviewer = comment only (in Thai)
**Role:** Tech Lead — improve code health via architecture, mentoring, team standards. Not a linter. Explain *why*, cite patterns, respect valid approaches.

Read CLAUDE.md first — auto-loaded, contains full project patterns and conventions.
For 12-point checklist details → [references/checklist.md](references/checklist.md)
**Output format:** Follow [review-output-format.md](../../references/review-output-format.md) exactly — output each phase section as it completes for real-time streaming.

---

## Phase 0: PR Scope Assessment 🟢 AUTO

Parse `Diff stat` from header. Classify per [review-conventions.md](../../references/review-conventions.md) size thresholds.
If 🔴 Massive: warn, limit review to Hard Rules + AC only.

---

## Phase 1: Ticket Understanding 🟢 AUTO

If `$1` matches Jira key format (BEP-XXXX) →

- Fetch via MCP `jira_get_issue`: description, AC, subtasks, parent
- Summarize: **Problem** · **Value** · **Scope**
- Show **AC Checklist** (each AC as checkbox)

If no Jira → skip to Phase 3.

---

## Phase 2: AC Verification 🟡 REVIEW (only if Jira)

Map each AC to file(s) in `git diff develop...HEAD`:

- Code not found → 🔴 `[#1 Critical] AC not implemented`
- Code incomplete → 🔴 `[#1 Critical] AC partially implemented`
- No test → 🔴 `[#11 Critical] Missing test for AC`

---

## Phase 3: 12-Point Review 🟢 AUTO

**Scope:** `git diff develop...HEAD` — changed files only.

## Hard Rules — Include in Every Agent Prompt

Flag unconditionally — no confidence filter, always report:

- `as any` / `as unknown as T` → 🔴 (destroys type safety — runtime errors slip past the compiler)
- `result.data` accessed without checking `result.isOk` first → 🔴 (crashes on error responses — always guard the success path)
- hardcoded route strings (`/manage/...`, `/ad/...`) → 🔴 (use `ROUTE_PATHS` — breaks silently on route rename, no type checking)
- hardcoded Thai status text → 🔴 (use `*_STATUS_TEXT` constants — duplicated strings diverge over time and miss future i18n)
- empty `catch {}` / swallowed errors → 🔴 (silent failures hide production bugs — errors vanish with no trace)
- nesting > 1 level → 🔴 (use guard clauses, extract function, or lookup table — deep nesting buries the happy path)
- `import { useQuery } from '@tanstack/react-query'` → 🔴 (must be `'react-query'` v3 — tanstack v5 API is incompatible with this codebase)
- query/fetch inside loop → 🔴 (N+1 — exponential network load; batch or preload instead)
- `console.log` in non-test code → 🟡 (leaks debug output to production; use structured logger)

Dispatch 7 agents in **foreground parallel** (all READ-ONLY). Pass each agent: Hard Rules above (verbatim) + AC context from Phase 2 + criteria from [references/checklist.md](references/checklist.md) + project-specific examples from [references/examples.md](references/examples.md).

| Agent |
| ------- |
| `pr-review-toolkit:code-reviewer` |
| `pr-review-toolkit:comment-analyzer` |
| `pr-review-toolkit:pr-test-analyzer` |
| `pr-review-toolkit:silent-failure-hunter` |
| `pr-review-toolkit:type-design-analyzer` |
| `pr-review-toolkit:code-simplifier` |
| `feature-dev:code-reviewer` |

`feature-dev:code-reviewer` applies TypeScript advanced type principles (generics, branded types, discriminated unions, type guards — NO `as any`) and Clean Code principles (SRP, early returns, naming intent, function size). Confidence scoring maps: 90–100 → 🔴, 80–89 → 🟡.

**⛔ CHECKPOINT** — collect ALL 7 results before proceeding. Do NOT fix until all complete.

### Phase 3.5: Consolidation

Per [review-conventions.md](../../references/review-conventions.md): dedup by file:line → verify severity → remove false positives → sort 🔴→🟡→🔵

---

## Phase 4: By Mode

### Author Mode

1. Fix AC issues first (🔴 not implemented / partial)
2. Fix: 🔴 → 🟡 → 🔵
3. `npm run ts-check && npm run lint@fix && npm run test` — if fails → fix and re-validate

### Reviewer Mode

As **Tech Lead**: focus on architecture, patterns, team standards, and mentoring — not syntax nitpicks.
For each issue, explain *why* it matters, not just *what* to change.

1. Show **AC Checklist** (✅/🔴) first (if Jira)
2. Collect all findings: file path + line number + comment body
3. Submit to GitHub (see below)
4. Show: AC Checklist · Strengths · all findings

**Comment language:** Thai mixed with English technical terms — as natural as possible, like a Thai dev writing to teammates on Slack/PR. Short, direct, no stiff formal phrases.
Examples: "ใช้ ROUTE_PATHS ด้วยนะ ไม่งั้น hardcode", "logic ซ้ำกัน extract เป็น util ไว้เลยดีกว่าครับ", "ตรงนี้ N+1 อยู่ ลอง preload ดูครับ"

**Comment labels:** Per [review-conventions.md](../../references/review-conventions.md) — prefix every comment with `issue:`/`suggestion:`/`nitpick:`/`praise:`.

**Strengths (1-3):** Genuinely good practices only. Evidence required (file:line).
Examples: "ใช้ STATUS_TEXT constants ไม่ hardcode Thai", "Headless UI pattern ถูกต้อง", "test coverage ครบ"

#### Submit to GitHub

**Step 1 — get line numbers from diff:**

```bash
gh pr diff $0 --repo 100-Stars-Co/bluedragon-eye-admin
```

Use the diff output to map each finding to the correct `path` and `line` (right-side line number in the file).

**Step 2 — submit all comments + decision in ONE call:**

If 🔴 exists → Request Changes:

```bash
gh api repos/100-Stars-Co/bluedragon-eye-admin/pulls/$0/reviews \
  --method POST --input - <<'JSON'
{
  "body": "<overall summary in Thai>",
  "event": "REQUEST_CHANGES",
  "comments": [
    {"path": "src/modules/foo/foo.service.ts", "line": 42, "side": "RIGHT", "body": "..."},
    {"path": "src/pages/bar.page.tsx", "line": 15, "side": "RIGHT", "body": "..."}
  ]
}
JSON
```

If no 🔴 → Approve:

```bash
gh pr review $0 --repo 100-Stars-Co/bluedragon-eye-admin \
  --approve --body "<summary in Thai>"
```

---

## Constraints

- Investigate: read files before making claims. Never speculate about code you haven't opened — speculation without evidence becomes false positives that erode review credibility.
- Flag changed files <80% coverage (🔴 Critical)
- #13 React/Next.js performance rules are embedded in checklist — see `references/checklist.md` #13 section
- Pages Router project — App Router patterns (RSC, Server Components, `React.cache()`) do NOT apply
- Reviewer comment style: see "Comment language" in Reviewer Mode above
- **NOTE:** `lint@fix` uses `@` not `:` — `npm run lint@fix` (NOT `lint:fix`)

## Success Criteria

- [ ] CHECKPOINT: all 7 agent results collected
- [ ] Phase 1-2 complete (if Jira provided)
- [ ] 🔴 issues: zero (Author) or documented (Reviewer)
- [ ] Author: `npm run ts-check && npm run lint@fix && npm run test` pass
- [ ] Reviewer: review submitted
- [ ] AC Checklist shown in output (if Jira)
