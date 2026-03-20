# dlc-debug skill

Systematic debugging with Agent Teams: parallel Investigator + DX Analyst, then Fixer.
Combines systematic-debugging methodology with DX analysis to fix bugs and harden the affected area.

## How It Differs from Other Skills

| Aspect | dlc-review | dlc-build | dlc-debug |
| --- | --- | --- | --- |
| Scope | PR review + debate | Full dev loop | Debug + DX harden |
| Execution | 3 teammates (debate) | Dynamic roster per phase | Investigator + DX Analyst + Fixer |
| Review | Adversarial debate | Embedded (reuses dlc-review) | N/A (no review phase) |
| Loop | None | Implement-Review (max 3 iter) | Fix-only (max 3 attempts) |
| Artifacts | Findings in output | research.md, plan.md, review-findings-N.md | debug-context.md, investigation.md |

## Docs Index

| Reference | When to use |
| --- | --- |
| `references/teammate-prompts.md` | Modifying Investigator, DX Analyst, or Fixer prompts |
| `references/dx-checklist.md` | Modifying DX audit categories, severity criteria, or Quick mode checklist |
| `references/phase-gates.md` | Modifying gate conditions or escalation protocol |
| `../../references/review-conventions.md` | Shared review conventions (if adding review phase later) |
| `references/operational.md` | Graceful Degradation, Context Compression Recovery, Success Criteria |

## Skill Architecture

- `SKILL.md` — lead orchestration playbook; phases, team creation, fix flow
- `references/teammate-prompts.md` — prompt templates for Investigator, DX Analyst, Fixer (Full + Quick)
- `references/dx-checklist.md` — DX audit categories with severity criteria
- `references/phase-gates.md` — gate conditions for every phase transition
- Project-specific Hard Rules loaded from `{project_root}/.claude/skills/review-rules/hard-rules.md` if present

## Validate After Changes

```bash
# Lint all markdown in this skill
npx markdownlint-cli2 "skills/dlc-debug/**/*.md"

# Verify skill symlink exists
ls -la ~/.claude/skills/dlc-debug

# Test invocation (requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1):
# /dlc-debug "NullPointerException in UserService.findById"
# /dlc-debug "API returns 500 on empty payload" --quick
```

## Gotchas

- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — degrades gracefully to subagent or solo mode
- Agent Teams have no session resumption — if lead crashes, `debug-context.md` + `investigation.md` enable manual recovery
- Investigator and DX Analyst are never alive simultaneously with Fixer — Phase 1 teammates shut down before Phase 2
- Max 2 teammates concurrent (Investigator + DX Analyst), then 1 (Fixer)
- DX scope = affected area only — not codebase-wide improvements
- 3 fix attempts max — beyond that is an architectural problem, escalate to user
- Artifacts written to `{artifacts_dir}` (path from `scripts/artifact-dir.sh dlc-debug`): `debug-context.md`, `investigation.md`
- Team cleanup must be done by lead in Phase 3 — teammates don't self-terminate
- One team per session — cannot run multiple dlc-debug in parallel
- Quick mode still has DX awareness via condensed checklist — not zero DX
