# Phase 7: Assess (Lead Only)

Read ONLY `{artifacts_dir}/review-findings-{N}.md` (the consolidated file) — do not re-read raw reviewer outputs. Raw findings are available on-demand if a specific finding needs deeper investigation.

Count Critical/Warning/Info from the `## Summary` header. If Jira: verify each AC has implementation + test (unverified AC = Critical).

## Iteration Count (Shared)

There is ONE shared `iteration_count` in `dev-loop-context.md` (max 3). All loop types increment the same counter:

| Event | Increments iteration_count? |
| ------- | :---------------------------: |
| Phase 5 ANY FAIL → Phase 4 targeted re-entry | Yes |
| Phase 6 Stage 1 FAIL → Phase 4 | Yes |
| Phase 6 Critical finding → Phase 4 | Yes |

Lead increments `iteration_count` BEFORE returning to Phase 4.
If `iteration_count` reaches 3: present options to user instead of looping automatically.

Apply decision tree from [phase-gates.md](phase-gates.md) §Assess→Loop Decision.

Update progress tracker checkboxes (iteration N: Implement tasks, Review Critical/Warning, Assess outcome).

When dropping a finding (false positive, accepted risk), append it to the `## Dismissed` section in `review-findings-{N}.md` using the table format — prevents re-raising in subsequent iterations.

**Cross-session persistence:** Additionally, append the dismissed finding to the centralized dlc-review dismissed log — path: `bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" dlc-review` → `review-dismissed.md` (create if absent). Use this canonical format shared with dlc-review:

| Date | Finding | File:Line | Reason | Source | Workflow |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | {brief description} | {file}:{line} | {reason} | Lead | dlc-build |

FIFO cap: 50 entries total — if file exceeds 50 rows (excluding header), remove the oldest entry before appending. Duplicate entries (same File:Line) do not need to be deduplicated on write; readers treat same File:Line as the same finding.

**GATE:** Loop decision made → update `Phase: assess` (or `Phase: ship` if exiting) in dev-loop-context.md → proceed accordingly.

## Step 1: Simplification Pass (Ship path only)

Per [workflow-modes.md](workflow-modes.md): Micro=Skip, Quick=Optional, Full=Default when Critical=0.

**Trigger:** Only when decision tree selects "proceed to Ship" (zero Critical findings, i.e. score <7).
Skip in Hotfix mode. Skip for iterations 2–3 (simplified in iter 1 if chosen).

**Micro:** Skip always.

**Quick:** User must explicitly request.

Call AskUserQuestion:

- header: "Optional: Simplification Pass"
- question: "Zero critical findings — code is shippable. Run a simplification pass before shipping to improve clarity and maintainability?"
- options: [
    { label: "Run simplification", description: "Spawn code-simplifier on changed files — clarity improvements only, no behavior changes" },
    { label: "Ship as-is", description: "Skip — proceed to Phase 8 directly" }
  ]

**If "Run simplification":**

1. Note changed file list: `git diff {base_branch}...HEAD --name-only` (read `base_branch` from `dev-loop-context.md`)
2. Spawn `code-simplifier` agent with task text: `"Simplify changed files: <space-separated file list>"` — the agent treats the task text as its `$ARGUMENTS` and uses it instead of its fallback git diff scope
3. Wait for agent completion
4. Run validate command from `dev-loop-context.md` → `validate:` field — confirm no regressions introduced. If `validate:` is empty, use fallback: `npx tsc --noEmit && npx eslint . --ext .ts,.tsx`
5. If validate passes → proceed to Phase 8
6. If validate fails → revert simplifier changes (`git checkout HEAD -- <changed-files>`), note in context, proceed to Phase 8 with original code

**If "Ship as-is":** Proceed to Phase 8 directly.
