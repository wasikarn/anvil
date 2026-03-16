# dlc-build skill

Full development loop with Agent Teams: Research → Plan → Implement → Review → Ship.
Uses dynamic team roster (explorers, workers, reviewers) with iterative implement-review loop.

## How It Differs from Other DLC Skills

| Aspect | dlc-review | dlc-build | dlc-debug |
| --- | --- | --- | --- |
| Scope | PR review + debate | Full dev loop | Debug + DX harden |
| Execution | 3 teammates (debate) | Dynamic roster per phase | Investigator + DX Analyst + Fixer |
| Review | Adversarial debate | Embedded (reuses dlc-review pattern) | N/A (no review phase) |
| Loop | None | Implement-Review (max 3 iter) | Fix-only (max 3 attempts) |
| Artifacts | Findings in output | research.md, plan.md, review-findings-N.md | debug-context.md, investigation.md |

## Docs Index

| Reference | When to use |
| --- | --- |
| `references/phase-gates.md` | Modifying gate conditions or escalation protocol |
| `references/teammate-prompts.md` | Modifying explorer, worker, reviewer, or fixer prompts |
| `references/workflow-modes.md` | Modifying Full/Quick/Hotfix classification criteria |
| `../../references/review-conventions.md` | Shared review conventions (labels, dedup, strengths) |
| `references/operational.md` | Graceful Degradation, Context Compression Recovery, Success Criteria |
| `../../references/review-output-format.md` | Review output format template |
| `../dlc-review/references/debate-protocol.md` | Adversarial debate rules |

## Skill Architecture

- `SKILL.md` — lead orchestration playbook; phases, team creation, loop flow
- `references/phase-gates.md` — gate conditions for every phase transition
- `references/teammate-prompts.md` — self-contained prompt templates for all teammate roles
- `references/workflow-modes.md` — Full/Quick/Hotfix classification criteria
- Reuses `dlc-review` pattern for Phase 4 (review + debate)
- Project-specific Hard Rules loaded from `.claude/skills/review-rules/hard-rules.md` in the target project

## Validate After Changes

```bash
# Lint all markdown in this skill
npx markdownlint-cli2 "skills/dlc-build/**/*.md"

# Verify skill symlink exists
ls -la ~/.claude/skills/dlc-build

# Test invocation (requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1):
# /dlc-build "Add health check endpoint" --full
# /dlc-build "Fix null check in UserService" --quick
# /dlc-build "BEP-1234 production crash" --hotfix
```

## Gotchas

- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — degrades gracefully to subagent or solo mode
- Agent Teams have no session resumption — if lead crashes, artifacts on disk enable manual recovery
- Workers and reviewers are never alive simultaneously — workers during Phase 3, reviewers during Phase 4
- Review scope narrows each iteration: 3 reviewers → 2 → 1, full debate → focused → spot-check
- Hard Rules cannot be dropped via debate — only reclassified with evidence
- Max 3 loop iterations enforced — prevents runaway token usage
- Artifacts written to **target project root** (not this skills repo): `dev-loop-context.md`, `research.md`, `plan.md`, `review-findings-*.md`
- Team cleanup must be done by lead in Phase 6 — teammates don't self-terminate
- One team per session — cannot run multiple dlc-build in parallel
