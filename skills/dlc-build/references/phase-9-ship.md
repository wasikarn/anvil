# Phase 9: Ship (Lead Only)

## Step 1: Present Summary

Load [pr-template.md](pr-template.md) now. Present the Phase 9 Summary (task, mode, iterations, final status, iteration history table).

## Step 2: Comprehension Gate

Before presenting completion options, ask one question to confirm human engagement:

Call AskUserQuestion:

- question: "What was the most critical finding in this review, and do you understand the fix applied?"
- header: "Comprehension Check"
- options: [
    { label: "Yes — I understand all changes", description: "Proceed to ship" },
    { label: "Explain the critical finding", description: "Claude walks through the key finding and fix" },
    { label: "I reviewed the diff myself", description: "Proceed to ship" }
  ]

**If "Explain the critical finding":** Summarize the top Critical finding in plain terms — what the problem was, why it matters, and what the fix does. Then re-present the gate question.

**Log to metrics:** Set `human_confirmed = true` if user chose option 1 or 3. Set `human_confirmed = false` if user never responded (timeout/auto-proceed). This surfaces rubber-stamp patterns in `dlc-metrics`.

**Never block:** If user skips or dismisses, proceed silently. This is a signal, not a barrier.

## Step 3: Completion Options

Present options to user:

1. **Create PR** — generate PR using template, push branch, open with `gh pr create`
2. **Merge to base** — squash merge current branch into `{base_branch}` from Project JSON
3. **Keep branch** — leave as-is for manual review
4. **Restart loop** — return to Phase 4 with additional changes

Load [pr-template.md](pr-template.md) for PR title format, description template (Thai), `gh pr create` command, and Hotfix Backport steps.

## Step 4: PR Description Draft (if user chose "Create PR")

If `pr-description-writer` agent (atlassian-pm plugin) is available AND a Jira key is present in
`dev-loop-context.md`:

1. Spawn `pr-description-writer` — pass `<branch-name> <jira-key>` as arguments
2. Capture the output: description draft + any scope drift findings
3. **If scope drift detected** → surface findings to user before creating PR; let them acknowledge
   or return to Phase 4 via "Restart loop" option. A PR with known scope drift should not be silently opened.
4. Pass the description as `--body` argument to `gh pr create`

If `pr-description-writer` is not available, fall back to `pr-template.md` manual template (current behavior).

## Step 5: Cleanup

1. Shut down all remaining teammates and clean up the team
2. Update `Phase: complete` in `{artifacts_dir}/{date}-{task-slug}/dev-loop-context.md`
3. Delete checkpoint tags: `git tag -d $(git tag -l 'dlc-checkpoint-iter-*')`
4. Archive artifacts to final location:
   - All artifacts already live at `{artifacts_dir}/{date}-{task-slug}/` from Phase 1 (plan.md, research.md, verify-results.md, review-findings-*.md, dev-loop-context.md)
   - After ship: move the entire folder to `{artifacts_dir}/archive/{date}-{task-slug}/`

```bash
mv {artifacts_dir}/{date}-{task-slug}/ {artifacts_dir}/archive/{date}-{task-slug}/
```

## Step 6: Jira Sync (optional)

If a Jira key is present in `dev-loop-context.md`:

1. Run `jira-sync` agent — pass `{artifacts_dir}/dev-loop-context.md` as `$ARGUMENTS`. The agent reads the context artifact and posts implementation summary comment (what was built, files changed, AC deviations) automatically.
2. **After the PR is merged** (by CI or manually) — if `pr-review-jira-sync` agent (atlassian-pm plugin)
   is available, run it with the Jira key to: transition the subtask to Done, post the PR link, and
   check whether all sibling subtasks are complete (signal for parent story closure).

Note: `jira-sync` runs now (post-create). `pr-review-jira-sync` runs post-merge — remind user or add
to their post-merge checklist if atlassian-pm is installed.

## Step 7: Metrics

Append one JSON line to `{artifacts_dir}/dlc-metrics.jsonl` (create if absent) for future analysis.
Lead writes directly — not via hook (metrics data not available at hook time).

New fields:

- `findings_reversed` — count of findings rejected by falsification-agent (signals agent overconfidence)
- `ac_coverage` — AC items verified vs total (e.g. "3/4"); use "N/A" if no Jira
- `human_confirmed` — whether user engaged with Comprehension Gate (Step 2)

```json
{"skill":"dlc-build","date":"{YYYY-MM-DD}","mode":"{mode}","mode_source":"{auto|flag|override}","blast_radius":{N},"iterations":{N},"task":"{task_short}","final_critical":0,"final_warning":{W},"findings_reversed":{falsification_rejected_count},"ac_coverage":"{AC_passed}/{AC_total}","human_confirmed":{true|false}}
```
