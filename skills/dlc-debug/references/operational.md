# Operational Reference

## Graceful Degradation

| Level | Available tools | Behavior |
| --- | --- | --- |
| **Agent Teams** | TeamCreate, SendMessage | Full workflow — teammates communicate |
| **Subagent** | Task (Agent tool) | Same phases, teammates as subagents (no messaging). Investigator + DX Analyst as parallel subagents. Fixer as sequential subagent. |
| **Solo** | None (lead only) | Lead executes all phases sequentially. Investigation = systematic-debugging methodology inline. DX = checklist from `dx-checklist.md`. Fix = lead implements directly. |

Detect at Prerequisite Check and inform user of mode.

## Context Compression Recovery

If session compacts mid-workflow, re-read in order:

1. `debug-context.md` — bug, severity, mode, project, Hard Rules, **Progress section** (current phase)
2. `investigation.md` — root cause + DX findings + fix plan (if exists)
3. Resume from the first unchecked phase in `debug-context.md` Progress section

## Success Criteria

- [ ] Prerequisite check completed (Agent Teams / subagent / solo detected)
- [ ] Project detected and conventions loaded
- [ ] Investigator completed with root cause evidence (file:line) + top-3 hypothesis ranking
- [ ] DX Analyst completed with findings table (Full mode only)
- [ ] investigation.md written with merged findings and fix plan
- [ ] Bug fix committed with regression test (each item verified by Lead's loop)
- [ ] DX improvements committed (Critical: all, Warning: as appropriate)
- [ ] Final validate command passes (Lead-verified, not Fixer self-report)
- [ ] Fix Reviewer completed (if `--review` or P0)
- [ ] Summary presented to user with completion options
- [ ] Team cleaned up (all teammates shut down)
