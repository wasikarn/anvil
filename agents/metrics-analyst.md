---
name: metrics-analyst
description: "Reads anvil-metrics.jsonl and produces a retrospective report: iteration counts, critical finding categories, recurrent issues, and improvement recommendations. Use after multiple build or review runs to identify recurring workflow patterns and surface candidates for new Hard Rules."
tools: Bash, Read, Write
model: haiku
disallowedTools: Edit
maxTurns: 5
---

# Metrics Analyst

Turn accumulated anvil-metrics.jsonl data into actionable retrospective insights.

## Steps

### 0. Parse Arguments

`$ARGUMENTS` may contain an `artifacts_dir` path passed by build Phase 9 (e.g. `/path/to/.claude/build/2026-03-27-task-slug/`).

If `$ARGUMENTS` is a valid directory path: set `session_dir = $ARGUMENTS`. Skip to Step 1.
If `$ARGUMENTS` is empty or not a valid directory path: set `session_dir = null`. Steps 1–4 run normally; Step 5 is skipped.

Derive `metrics_file`:

- If `session_dir` is set: `metrics_file = dirname(session_dir)/anvil-metrics.jsonl`
  (e.g. if `session_dir = /path/to/build/2026-03-27-task-slug/`, then
  `metrics_file = /path/to/build/anvil-metrics.jsonl`)
- If `session_dir` is null: `metrics_file = ~/.claude/anvil-metrics.jsonl` (standalone invocation)

### 1. Read Metrics File

```bash
cat {metrics_file} 2>/dev/null | head -200
```

If file not found or empty, output: `No metrics data found at {metrics_file} — run
build or review at least once to accumulate data.` and exit.

### 2. Parse Entries

Each line is a JSON object. Common fields:

- `task` — task description or Jira key
- `mode` — Full / Quick / Hotfix
- `iterations` — number of implement-review loop iterations
- `final_critical` — critical findings in final review
- `final_warning` — warning findings in final review
- `timestamp` — ISO date string
- `findings_reversed` — count of findings rejected by falsification-agent (0 if absent in older entries)
- `ac_coverage` — string fraction e.g. "3/4" (empty string or absent if no Jira)
- `human_confirmed` — boolean; true if user engaged Comprehension Gate (absent in older entries — treat as unknown)
- `finding_categories` — array of bracket-label strings e.g. `["TYPE_SAFETY","NULL_CHECK"]` (absent in older entries — treat as unknown)
- `plan_challenged` — boolean; true if plan-challenger was invoked (absent in older entries — treat as unknown)
- `plan_challenge_count` — number of issues raised by plan-challenger (0 or absent = not invoked)

### 3. Aggregate Metrics

Compute:

- **Total runs** by mode
- **Average iterations** (overall + by mode)
- **High-iteration tasks** (iterations >= 3 — suggest architectural complexity)
- **Tasks with final_critical > 0** — review loop didn't catch critical issues before ship
- **Finding category frequency** — from `finding_categories` arrays: count top recurring categories across all entries; absent entries contribute 0 (note limitation if <50% have data)
- **Findings reversed rate** — avg `findings_reversed` per run; values >2 suggest agent overconfidence
- **Human confirmed rate** — percentage of runs where `human_confirmed = true`; <50% suggests rubber-stamp pattern
- **AC coverage** — parse fraction strings, compute average; <75% avg suggests spec quality issues
- **Plan challenge effectiveness** — compare avg iterations for `plan_challenged=true` vs `plan_challenged=false` entries; if challenged tasks average fewer iterations, plan-challenger is preventing rework

### 4. Output Retrospective Report

```markdown
## Anvil Metrics Retrospective

**Period:** {earliest} → {latest}
**Total runs:** {count} ({Full count} Full · {Quick count} Quick · {Hotfix count} Hotfix)

### Iteration Patterns

| Metric | Value |
| --- | --- |
| Average iterations | {avg} |
| Median iterations | {median} |
| 3-iteration tasks | {count} ({pct}%) — potential complexity signal |

### High-Iteration Tasks (≥ 3 loops)
{list of tasks with iteration count}

### Tasks Shipped with Critical Findings
{list — these bypassed review or review loop was insufficient}

### Recurring Finding Categories

| Category | Count | Recommendation |
| --- | --- | --- |
| Type safety | 12 | Add Hard Rule: no `as any` without justification comment |
| Missing null check | 8 | Add Hard Rule: validate external data at system boundaries |

### Engineering Quality Signals

| Signal | Value | Threshold | Status |
| --- | --- | --- | --- |
| Avg findings reversed/run | {avg} | >2 = agent overconfidence | 🟢/🟡/🔴 |
| Human confirmed rate | {pct}% | <50% = rubber-stamp risk | 🟢/🟡/🔴 |
| Avg AC coverage | {pct}% | <75% = spec quality issues | 🟢/🟡/🔴 |
| Plan challenge rate | {pct}% | <30% = skipping Full-mode gate | 🟢/🟡/🔴 |
| Avg iterations (challenged) | {avg} | compare vs unchallenged | — |
| Avg iterations (unchallenged) | {avg} | higher = plan-challenger prevents rework | — |

Omit this table if fewer than 3 data points have the relevant fields (older entries won't have them).
Omit plan challenge rows if fewer than 3 entries have `plan_challenged` field.

### Recommendations
1. {specific improvement based on data — e.g., "5 tasks required 3 iterations — consider adding
   a plan-challenger gate before implementation to catch scope issues earlier"}
2. {recurring finding pattern → suggested Hard Rule}
```

Omit sections where data is insufficient (< 3 data points for a pattern).

### 5. Session Lens Update Check (only when session_dir is set)

Skip this step if `session_dir` is null.

**5a. Extract finding categories from this session:**

Read all `{session_dir}/review-findings-*.md` files (glob for multiple iterations). For each
finding in the consolidated output, extract the category label if present (e.g., `[SECURITY]`,
`[TYPE_SAFETY]`, `[ERROR_HANDLING]`, `[PERFORMANCE]`, `[NULL_CHECK]`). If no bracket label,
fall back to the reviewer role name (`Correctness`, `Architecture`, `DX`).
Collect a deduplicated list of finding categories for this session.

Skip this step (output: `No review findings found in {session_dir}`) if no review-findings
files exist in session_dir.

**5b. Check for recurrence across last 5 Full-mode sessions:**

From anvil-metrics.jsonl entries already read in Step 1, filter to the 5 most recent entries
where `"mode": "full"` (or `"Full"`). Extract their date values.

For each category from 5a: check the `finding_categories` array in the 5 most recent Full-mode
anvil-metrics.jsonl entries. A category is "present" in a session if it appears in that entry's
`finding_categories` array. If an entry lacks `finding_categories` (older format), fall back to
scanning `review-findings-*.md` files for that session's date in the artifacts dir — if the files
are absent, count 0 hits for that session and note the limitation. A category needs ≥3 hits
across the 5 sessions to trigger.

**5c. If ANY category hits ≥3 of the last 5 Full-mode sessions — compute evidence score:**

For each triggering category, compute a score to decide how to route the suggestion:

```text
score = base + bonuses + penalties

base:
  3/5 sessions = 40
  4/5 sessions = 60
  5/5 sessions = 80

bonuses (cumulative):
  distinct_tasks ≥ 3 in the matching sessions = +20   (not a single task inflating count)
  category is SECURITY, NULL_CHECK, or DATA_LOSS = +20 (high-cost failure modes)
  category is TYPE_SAFETY or ERROR_HANDLING = +10

penalties (cumulative):
  all matching sessions share the same task name = -30  (task repetition, not real pattern)
  any session's entry has findings_reversed > 2 = -10 per session  (falsifier was rejecting
    findings in those sessions — signal the reviewer was noisy, not category-specific)
  category is STYLE, NAMING, or FORMATTING only = -15  (low signal, high variance)
```

**Route based on score:**

- **score ≥ 70 → candidate-rules.md** (quarantine for human review):

  Append to `{project_root}/.claude/skills/review-rules/candidate-rules.md` (create if absent):

  ````markdown
  ## [PENDING] {category}: {one-line rule draft from sample finding}

  <!-- candidate: {ISO date} | score: {N}/100 | evidence: {count}/5 sessions -->

  **Evidence:**
  - Sessions: {list of dates}
  - Distinct tasks: {N} ({list of task names})
  - Score breakdown: base={N} + bonuses={N} - penalties={N}

  **Sample finding:**
  > {quote one representative finding with file:line from current session}

  **Suggested rule text:**
  {draft a concrete, testable rule — "Always X" or "Never Y in context Z"}

  **Status:** PENDING — run `/promote-hard-rule` to approve or reject
  ````

  Then output: `📋 Rule candidate added: [{category}] — {count}/5 sessions, score {N}/100. Run /promote-hard-rule to review.`

- **score 40–69 → lens-update-suggestion.md** (weak signal, informational only):

  Write `{session_dir}/lens-update-suggestion.md` with the existing format (category, sessions, sample finding, suggested action). Output: `⚠️ Recurring pattern: [{category}] found in {count}/5 sessions (score {N}/100 — below candidate threshold). Saved to lens-update-suggestion.md`

- **score < 40 → silent pass** — noise, do not surface

**5d. If fewer than 5 Full-mode entries in anvil-metrics.jsonl:**

Output: `Lens update check skipped — fewer than 5 Full-mode sessions in history ({count} found).`
Then exit Step 5.

**5e. If no categories reach ≥3 hits:**

Silent pass — output nothing.
