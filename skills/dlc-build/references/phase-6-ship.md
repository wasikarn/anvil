# Phase 6: Ship (Lead Only)

## Step 1: Present Summary

Load [pr-template.md](pr-template.md) now. Present the Phase 6 Summary (task, mode, iterations, final status, iteration history table).

## Step 2: Completion Options

Present options to user:

1. **Create PR** — generate PR using template, push branch, open with `gh pr create`
2. **Merge to base** — squash merge current branch into `{base_branch}` from Project JSON
3. **Keep branch** — leave as-is for manual review
4. **Restart loop** — return to Phase 3 with additional changes

Load [pr-template.md](pr-template.md) for PR title format, description template (Thai), `gh pr create` command, and Hotfix Backport steps.

### Step 2.5: PR Description Draft (if user chose "Create PR")

If `pr-description-writer` agent (atlassian-pm plugin) is available AND a Jira key is present in
`dev-loop-context.md`:

1. Spawn `pr-description-writer` — pass `<branch-name> <jira-key>` as arguments
2. Capture the output: description draft + any scope drift findings
3. **If scope drift detected** → surface findings to user before creating PR; let them acknowledge
   or return to Phase 3 via "Restart loop" option. A PR with known scope drift should not be silently opened.
4. Pass the description as `--body` argument to `gh pr create`

If `pr-description-writer` is not available, fall back to `pr-template.md` manual template (current behavior).

## Step 3: Cleanup

1. Shut down all remaining teammates and clean up the team
2. Update `Phase: complete` in `{artifacts_dir}/dev-loop-context.md`
3. Delete checkpoint tags: `git tag -d $(git tag -l 'dlc-checkpoint-iter-*')`
4. Clean up artifacts (choose one):
   - **Auto-cleanup:** `rm -f "{artifacts_dir}/dev-loop-context.md" "{artifacts_dir}/research.md" {artifacts_dir}/review-findings-*.md`
   - **Archive:** leave in `{artifacts_dir}` for reference

## Step 3.5: Jira Sync (optional)

If a Jira key is present in `dev-loop-context.md`:

1. Run `jira-sync` agent — pass `{artifacts_dir}/dev-loop-context.md` as `$ARGUMENTS`. The agent reads the context artifact and posts implementation summary comment (what was built, files changed, AC deviations) automatically.
2. **After the PR is merged** (by CI or manually) — if `pr-review-jira-sync` agent (atlassian-pm plugin)
   is available, run it with the Jira key to: transition the subtask to Done, post the PR link, and
   check whether all sibling subtasks are complete (signal for parent story closure).

Note: `jira-sync` runs now (post-create). `pr-review-jira-sync` runs post-merge — remind user or add
to their post-merge checklist if atlassian-pm is installed.

## Step 4: Metrics (optional)

Append one JSON line to `~/.claude/dlc-metrics.jsonl` for future analysis:

```json
{"skill":"dlc-build","date":"{YYYY-MM-DD}","mode":"{mode}","iterations":{N},"task":"{task_short}","final_critical":0,"final_warning":{W}}
```
