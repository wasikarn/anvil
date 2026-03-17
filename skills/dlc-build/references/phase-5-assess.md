# Phase 5: Assess (Lead Only)

Read ONLY `.claude/dlc-build/review-findings-{N}.md` (the consolidated file) — do not re-read raw reviewer outputs. Raw findings are available on-demand if a specific finding needs deeper investigation.

Count Critical/Warning/Info from the `## Summary` header. If Jira: verify each AC has implementation + test (unverified AC = Critical).

Apply decision tree from [phase-gates.md](phase-gates.md) §Assess→Loop Decision.

Update progress tracker checkboxes (iteration N: Implement tasks, Review Critical/Warning, Assess outcome).

When dropping a finding (false positive, accepted risk), append it to the `## Dismissed` section in `review-findings-{N}.md` using the table format — prevents re-raising in subsequent iterations.

**GATE:** Loop decision made → update `Phase: assess` (or `Phase: ship` if exiting) in dev-loop-context.md → proceed accordingly.
