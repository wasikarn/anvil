# Phase 5: Convergence

## Falsification Pass (before consolidation)

**Spawn condition:**

- Normal/Large PRs → full falsification pass on all debate-surviving findings
- Massive PRs → lightweight falsification on Hard Rule findings only (no debate findings — pass only the single Correctness reviewer's Hard Rule violations inline)

Spawn `falsification-agent` (defined in `agents/falsification-agent.md`) with the surviving debate findings table inline. The agent challenges each finding on three grounds and returns SUSTAINED / DOWNGRADED / REJECTED verdicts.

Apply verdicts before dispatching `review-consolidator`:

- REJECTED → remove from table
- DOWNGRADED → update severity (e.g., Critical → Warning)
- SUSTAINED → pass through unchanged

Note rejected count in output summary: `(N findings rejected by Falsification Pass)`.

Dispatch `review-consolidator` agent with the surviving debate findings passed inline in
the prompt. Capture the agent's output as the consolidated findings table.

If agent errors → perform dedup, pattern-cap, sort, and signal-check inline per
[review-conventions.md](../../references/review-conventions.md).

Output the consolidated findings table per [review-output-format.md](../../references/review-output-format.md).

**Confirmed Findings Log:** After consolidation, append Critical and Warning findings that survived falsification to `{review_memory_dir}/review-confirmed.md` (cap 30 FIFO). Format:

| Date | Finding | File:Line | Severity | Source | Workflow |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | {brief} | {file}:{line} | Critical/Warning | PR #{number} | dlc-review |

These become positive severity anchors in future reviews (Step 1).

**Dismissed Findings Log:** After consolidation, append dropped findings to `{review_memory_dir}/review-dismissed.md` (cap 50 FIFO). Use this canonical format:

| Date | Finding | File:Line | Reason | Source | Workflow |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | {brief} | {file}:{line} | {reason} | PR #{number} | dlc-review |

Replace the "Agents" column with "Consensus":

✅ **Good** — specific file+line, actionable issue, consensus recorded:

```markdown
**Summary: Critical 1 / Warning 2 / Info 0** (after debate)

#### Findings

| # | Sev | Rule | File | Line | Consensus | Issue |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Critical | #2 | `src/auth/user.service.ts` | 42 | 3/3 | Uses `as any` to bypass user type — add `isUser()` type guard |
| 2 | Warning | #5 | `src/auth/user.service.ts` | 78 | 2/3 | Nested ternary (depth 3) — extract to `resolveUserStatus()` |
| 3 | Warning | #8 | `src/utils/format.ts` | 12 | 3/3 | `data` is ambiguous — rename to `userPayload` |
```

❌ **Bad** — no file path, no line number, vague issue, no consensus:

```markdown
#### Findings

| # | Sev | Issue |
| --- | --- | --- |
| 1 | Critical | Bad typing |
| 2 | Warning | Nested code |
```
