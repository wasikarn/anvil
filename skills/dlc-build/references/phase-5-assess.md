# Phase 5: Assess (Lead Only)

Read ONLY `{artifacts_dir}/review-findings-{N}.md` (the consolidated file) — do not re-read raw reviewer outputs. Raw findings are available on-demand if a specific finding needs deeper investigation.

Count Critical/Warning/Info from the `## Summary` header. If Jira: verify each AC has implementation + test (unverified AC = Critical).

Apply decision tree from [phase-gates.md](phase-gates.md) §Assess→Loop Decision.

Update progress tracker checkboxes (iteration N: Implement tasks, Review Critical/Warning, Assess outcome).

When dropping a finding (false positive, accepted risk), append it to the `## Dismissed` section in `review-findings-{N}.md` using the table format — prevents re-raising in subsequent iterations.

**Cross-session persistence:** Additionally, append the dismissed finding to the centralized dlc-review dismissed log — path: `bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" dlc-review` → `review-dismissed.md` (create if absent). Use this canonical format shared with dlc-review:

| Date | Finding | File:Line | Reason | Source | Workflow |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | {brief description} | {file}:{line} | {reason} | Lead | dlc-build |

FIFO cap: 50 entries total — if file exceeds 50 rows (excluding header), remove the oldest entry before appending. Duplicate entries (same File:Line) do not need to be deduplicated on write; readers treat same File:Line as the same finding.

**GATE:** Loop decision made → update `Phase: assess` (or `Phase: ship` if exiting) in dev-loop-context.md → proceed accordingly.

## Step 5.5: Optional Simplification Pass (Ship path only)

**Trigger:** Only when the decision tree selects "proceed to Ship" (zero Critical findings). Skip entirely in Hotfix mode (code freeze priorities apply) and for iterations 2–3 (already simplified in iter 1 if chosen).

Call AskUserQuestion:

- header: "Optional: Simplification Pass"
- question: "Zero critical findings — code is shippable. Run a simplification pass before shipping to improve clarity and maintainability?"
- options: [
    { label: "Run simplification", description: "Spawn code-simplifier on changed files — clarity improvements only, no behavior changes" },
    { label: "Ship as-is", description: "Skip — proceed to Phase 6 directly" }
  ]

**If "Run simplification":**

1. Note changed file list: `git diff {base_branch}...HEAD --name-only` (read `base_branch` from `dev-loop-context.md`)
2. Spawn `code-simplifier` agent — pass the file list as `$ARGUMENTS` (agent uses these instead of its fallback `git diff HEAD`)
3. Wait for agent completion
4. Run validate command from `dev-loop-context.md` → `validate_command:` field — confirm no regressions introduced
5. If validate passes → proceed to Phase 6
6. If validate fails → revert simplifier changes (`git checkout HEAD -- <changed-files>`), note in context, proceed to Phase 6 with original code

**If "Ship as-is":** Proceed to Phase 6 directly.
