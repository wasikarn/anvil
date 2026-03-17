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

## Step 3: Cleanup

1. Shut down all remaining teammates and clean up the team
2. Update `Phase: complete` in `.claude/dlc-build/dev-loop-context.md`
3. Delete checkpoint tags: `git tag -d $(git tag -l 'dlc-checkpoint-iter-*')`
4. Clean up artifacts (choose one):
   - **Auto-cleanup:** `rm -f .claude/dlc-build/dev-loop-context.md .claude/dlc-build/research.md .claude/dlc-build/review-findings-*.md`
   - **Archive:** leave in `.claude/dlc-build/` for reference (add `.claude/dlc-build/` to `.gitignore` if not already)

## Step 4: Metrics (optional)

Append one JSON line to `~/.claude/dlc-metrics.jsonl` for future analysis:

```json
{"skill":"dlc-build","date":"{YYYY-MM-DD}","mode":"{mode}","iterations":{N},"task":"{task_short}","final_critical":0,"final_warning":{W}}
```
