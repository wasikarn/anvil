---
name: agent-review-pr
description: "PR review skill for tathep-ai-agent-python (Python 3.12 + FastAPI + LangGraph + SQLAlchemy QB + mypy strict). Dispatches 7 parallel specialized agents, verifies Jira AC, then fixes issues (Author) or submits inline comments (Reviewer). Triggers: review PR, check PR, code review, /agent-review-pr."
argument-hint: "[pr-number] [jira-key?] [Author|Reviewer]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(gh *), Bash(git *)
compatibility: "Requires gh CLI and git. Run from within the tathep-ai-agent-python repo."
---

# PR Review — tathep-ai-agent-python

Invoke as `/agent-review-pr [pr-number] [jira-key?] [Author|Reviewer]`

## References

| File |
| --- |
| [checklist.md](references/checklist.md) |
| [examples.md](references/examples.md) |
| [review-output-format.md](../../references/review-output-format.md) |

---

**PR:** #$0 | **Jira:** $1 | **Mode:** $2 (default: Author)
**Today:** !`date +%Y-%m-%d`
**Diff stat:** !`git diff develop...HEAD --stat 2>/dev/null | tail -10`
**PR title:** !`gh pr view $0 --json title,body,labels,author --jq '{title,body,labels: [.labels[].name],author: .author.login}' 2>/dev/null`
**PR comments:** !`gh pr view $0 --comments --json comments --jq '[.comments[] | {author: .author.login, body: .body[:200]}]' 2>/dev/null`
**Changed files:** !`gh pr diff $0 --name-only 2>/dev/null`

**Args:** `$0`=PR# (required) · `$1`=Jira key or Author/Reviewer · `$2`=Author/Reviewer
**Modes:** Author = fix code · Reviewer = comment only (in Thai)
**Role:** Tech Lead — review from an architectural, mentoring, and team-standards perspective

Read CLAUDE.md first — auto-loaded, contains full project patterns and conventions.
For 12-point checklist details → [references/checklist.md](references/checklist.md)
**Output format:** Follow [review-output-format.md](../../references/review-output-format.md) exactly — output each phase section as it completes for real-time streaming.

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

- `Any` type annotation → 🔴 (destroys type safety — mypy strict mode forbids it; use specific types or generics)
- bare `except:` or `except Exception:` without re-raise → 🔴 (swallows all errors including KeyboardInterrupt — always specify exception type)
- `print()` statement → 🔴 (use `logger` from `shared.libs.logging.logger` — print output vanishes in production)
- missing type hints on function signature → 🔴 (mypy `disallow_untyped_defs=True` — will fail type check)
- `model.invoke()` without fallback in production agent → 🔴 (use `invoke_with_fallback()` — single model failure takes down the agent)
- hardcoded model name string outside `get_model()` → 🔴 (use `get_model("provider/model")` — centralizes model config)
- raw `try/except` in Effect-TS style code → 🔴 (use structured error handling patterns — breaks error channel)
- `import *` (wildcard import) → 🔴 (pollutes namespace — always import specific names)
- query inside loop (N+1) → 🔴 (batch or preload — exponential DB load)

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

`feature-dev:code-reviewer` applies Python type hint best practices (generics, Protocol, TypedDict, dataclasses — NO `Any`), Clean Code principles (SRP, early returns, naming intent, function size), and LangGraph patterns (StateGraph, Command/Send, structured output). Confidence scoring maps: 90–100 → 🔴, 80–89 → 🟡.

**⛔ CHECKPOINT** — collect ALL 7 results before proceeding. Do NOT fix until all complete.

Deduplicate → verify severity → remove false positives → proceed.

---

## Phase 4: By Mode

### Author Mode

1. Fix AC issues first (🔴 not implemented / partial)
2. Fix: 🔴 → 🟡 → 🔵
3. `uv run black --check . && uv run mypy .` — if fails → fix and re-validate

### Reviewer Mode

As **Tech Lead**: focus on architecture, patterns, team standards, and mentoring — not syntax nitpicks.
For each issue, explain *why* it matters, not just *what* to change.

1. Show **AC Checklist** (✅/🔴) first (if Jira)
2. Collect all findings: file path + line number + comment body
3. Submit to GitHub (see below)
4. Show: AC Checklist · Strengths · all findings

**Comment language:** Thai mixed with English technical terms — as natural as possible, like a Thai dev writing to teammates on Slack/PR. Short, direct, no stiff formal phrases.
Examples: "ใช้ `invoke_with_fallback()` แทน `model.invoke()` ตรงนี้ด้วยนะครับ", "ขาด type hint ตรงนี้ mypy จะ fail", "N+1 อยู่ ลอง batch query ดูครับ"

#### Submit to GitHub

**Step 1 — get line numbers from diff:**

```bash
gh pr diff $0 --repo 100-Stars-Co/tathep-ai-agent-python
```

Use the diff output to map each finding to the correct `path` and `line` (right-side line number in the file).

**Step 2 — submit all comments + decision in ONE call:**

If 🔴 exists → Request Changes:

```bash
gh api repos/100-Stars-Co/tathep-ai-agent-python/pulls/$0/reviews \
  --method POST --input - <<'JSON'
{
  "body": "<overall summary in Thai>",
  "event": "REQUEST_CHANGES",
  "comments": [
    {"path": "modules/assistant_agent/agents/foo.py", "line": 42, "side": "RIGHT", "body": "..."},
    {"path": "shared/libs/bar.py", "line": 15, "side": "RIGHT", "body": "..."}
  ]
}
JSON
```

If no 🔴 → Approve:

```bash
gh pr review $0 --repo 100-Stars-Co/tathep-ai-agent-python \
  --approve --body "<summary in Thai>"
```

---

## Constraints

- Investigate: read files before making claims. Never speculate about code you haven't opened — speculation without evidence becomes false positives that erode review credibility.
- Flag changed files with missing tests (🔴 Critical)
- Reviewer comment style: see "Comment language" in Reviewer Mode above
- Reference modules for patterns: `modules/conversation/` (CQRS + repository), `shared/libs/invoke_with_fallback.py` (LLM resilience)
- **Python project** — all code examples and patterns are Python, not TypeScript

## Success Criteria

- [ ] CHECKPOINT: all 7 agent results collected
- [ ] Phase 1-2 complete (if Jira provided)
- [ ] 🔴 issues: zero (Author) or documented (Reviewer)
- [ ] Author: `uv run black --check . && uv run mypy .` pass
- [ ] Reviewer: review submitted
- [ ] AC Checklist shown in output (if Jira)
