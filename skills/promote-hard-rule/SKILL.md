---
name: promote-hard-rule
description: "Review auto-detected Hard Rule candidates from metrics-analyst and approve, reject, or defer each one. Use /promote-hard-rule when metrics-analyst reports new rule candidates in candidate-rules.md, or when you want to review accumulated pattern suggestions before a sprint. Never auto-applies rules — every promotion requires explicit user approval."
user-invocable: true
disable-model-invocation: true
effort: low
allowed-tools: Read, Edit, Write, AskUserQuestion
---

# promote-hard-rule — Hard Rule Candidate Review

Reads auto-detected rule candidates, shows evidence, and applies only what you approve.

**Candidate file:** `.claude/skills/review-rules/candidate-rules.md` in the current project.

---

## Step 1: Locate Candidate File

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CANDIDATE_FILE="$PROJECT_ROOT/.claude/skills/review-rules/candidate-rules.md"
HARD_RULES_FILE="$PROJECT_ROOT/.claude/skills/review-rules/hard-rules.md"
```

Read `$CANDIDATE_FILE`. If the file does not exist or contains no `[PENDING]` entries:

```text
No rule candidates found in {CANDIDATE_FILE}.
Run a /build session in Full mode — metrics-analyst will surface candidates
when a finding category appears in ≥3 of 5 recent sessions with score ≥70.
```

Stop here.

---

## Step 2: Parse Pending Candidates

Extract all entries with `**Status:** PENDING`. For each, collect:

- `title` — the `## [PENDING] {category}: {description}` line
- `evidence` — sessions count, distinct tasks, score
- `sample_finding` — the quoted finding with file:line
- `suggested_rule_text` — the drafted rule

Count: `{N} pending candidate(s) found.`

---

## Step 3: Review Each Candidate

For each PENDING candidate (in order), show the evidence card:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Candidate {i}/{total}: {category}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Evidence:   {count}/5 sessions · {N} distinct tasks · score {N}/100
Detected:   {date}

Sample finding:
  "{sample_finding}"

Suggested rule:
  "{suggested_rule_text}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Use `AskUserQuestion`:

- question: "What do you want to do with this candidate?"
- options:
  - `{ label: "Approve — add to hard-rules.md as-is", description: "Rule text will be added exactly as suggested" }`
  - `{ label: "Approve with edit — I'll provide the final rule text", description: "You write the rule, it gets added" }`
  - `{ label: "Reject — this is not a real pattern", description: "Candidate marked REJECTED (kept for audit trail)" }`
  - `{ label: "Defer — revisit later", description: "Stays PENDING, surfaces again next run" }`
  - `{ label: "Skip remaining candidates", description: "Stop reviewing, keep all remaining as PENDING" }`

---

## Step 4: Apply Decisions

### APPROVE (as-is)

Append to `$HARD_RULES_FILE` (create if absent):

```markdown
## [{CATEGORY}] {title}
<!-- promoted: {ISO date} | evidence: {count}/5 sessions, {N} tasks | score: {N}/100 -->
{suggested_rule_text}
```

Then update the candidate entry: change `**Status:** PENDING` to `**Status:** APPROVED — {ISO date}`

### APPROVE with edit

Ask: "Enter the final rule text:" (free-form input via AskUserQuestion)

Use the provided text instead of `suggested_rule_text`. Otherwise same as APPROVE.

### REJECT

Update the candidate entry:

```markdown
**Status:** REJECTED — {ISO date}
**Reason:** {user's reason if provided, else "Rejected by user"}
```

Do NOT add to hard-rules.md. Entry remains in candidate-rules.md as audit trail.

### DEFER

No change. Candidate remains `**Status:** PENDING`.
Output: `Deferred — will re-surface next time /promote-hard-rule runs.`

### SKIP REMAINING

Stop processing. Output summary of decisions made so far.

---

## Step 5: Summary

After all candidates processed (or skipped):

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
promote-hard-rule complete

  Approved:  {N}  → added to hard-rules.md
  Rejected:  {N}  → marked in candidate-rules.md
  Deferred:  {N}  → still PENDING
  Skipped:   {N}  → untouched
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If any were approved, remind: `Hard rules take effect immediately — next review session will enforce them.`

---

## Safeguard Notes

- **Never auto-applies** — every rule requires explicit APPROVE decision
- **Audit trail preserved** — REJECTED entries stay in candidate-rules.md (never deleted)
- **Evidence comment** — every promoted rule carries its source evidence in an HTML comment
- **Reversible** — to remove a promoted rule, delete its block from hard-rules.md; the evidence comment helps identify auto-promoted rules vs manually written ones
- **candidate-rules.md is project-local** — lives in `.claude/skills/review-rules/`, not committed unless you choose to (`git add`)

## Gotchas

- If `hard-rules.md` does not exist yet, this skill creates it with a standard header before appending
- Candidates accumulate across sessions — run `/promote-hard-rule` regularly to avoid backlog
- A DEFERRED candidate will re-surface every time metrics-analyst runs a lens update check — if you never want it promoted, REJECT it
- Score ≥70 threshold means roughly: pattern appeared 4+ times in different tasks with no falsifier noise — low false-positive rate but not zero; always read the sample finding before approving
