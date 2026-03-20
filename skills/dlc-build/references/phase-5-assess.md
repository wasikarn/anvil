# Phase 5: Assess (Lead Only)

Read ONLY `{artifacts_dir}/review-findings-{N}.md` (the consolidated file) — do not re-read raw reviewer outputs. Raw findings are available on-demand if a specific finding needs deeper investigation.

Count Critical/Warning/Info from the `## Summary` header. If Jira: verify each AC has implementation + test (unverified AC = Critical).

Apply decision tree from [phase-gates.md](phase-gates.md) §Assess→Loop Decision.

Update progress tracker checkboxes (iteration N: Implement tasks, Review Critical/Warning, Assess outcome).

When dropping a finding (false positive, accepted risk), append it to the `## Dismissed` section in `review-findings-{N}.md` using the table format — prevents re-raising in subsequent iterations.

**Cross-session persistence:** Additionally, append the dismissed finding to `.claude/review-dismissed.md` at project root (create if absent). Use this canonical format shared with dlc-review:

| Date | Finding | File:Line | Reason | Source | Workflow |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | {brief description} | {file}:{line} | {reason} | Lead | dlc-build |

FIFO cap: 50 entries total — if file exceeds 50 rows (excluding header), remove the oldest entry before appending. Duplicate entries (same File:Line) do not need to be deduplicated on write; readers treat same File:Line as the same finding.

**GATE:** Loop decision made → update `Phase: assess` (or `Phase: ship` if exiting) in dev-loop-context.md → proceed accordingly.
