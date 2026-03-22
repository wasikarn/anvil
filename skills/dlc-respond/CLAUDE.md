# dlc-respond skill

Address PR review comments: fetch threads → fix code → reply on GitHub → re-request review.

## How It Differs from Other DLC Skills

| Aspect | dlc-review | dlc-build | dlc-debug | dlc-respond |
| --- | --- | --- | --- | --- |
| Scope | PR review + debate | Full dev loop | Debug + DX harden | PR comment response |
| Execution | 3 reviewers (debate) | Dynamic roster per phase | Investigator + DX Analyst + Fixer | 1 Fixer per file group |
| Review | Adversarial debate | Embedded (reuses dlc-review) | N/A | N/A (reviewer already reviewed) |
| Loop | None | Implement-Review (max 3 iter) | Fix-only (max 3 attempts) | Fix-only (max 3 per thread) |
| Artifacts | Findings in output | research.md, plan.md, review-findings-N.md | debug-context.md, investigation.md | respond-context.md |

## Docs Index

| Reference | When to use |
| --- | --- |
| `references/teammate-prompts.md` | Modifying Fixer prompt or thread grouping strategy |
| `references/phase-gates.md` | Modifying gate conditions or escalation protocol |
| `references/operational.md` | Graceful Degradation, Context Compression Recovery, Success Criteria |
| `../../references/review-conventions.md` | Shared comment labels and reply format conventions |
| `../../references/jira-integration.md` | Jira detection, AC-based thread prioritization |

## Skill Architecture

- `SKILL.md` — lead orchestration playbook; phases, team creation, fix flow
- `references/teammate-prompts.md` — Fixer prompt template with battle-tested rules
- `references/phase-gates.md` — explicit gate conditions for every phase transition
- `references/operational.md` — graceful degradation levels, compression recovery, success criteria
- Project-specific Hard Rules loaded from `{project_root}/.claude/skills/review-rules/hard-rules.md` if present
- Dismissed patterns loaded (read-only) from `{review_memory_dir}/review-dismissed.md` if present

## Validate After Changes

```bash
# Lint all markdown in this skill
npx markdownlint-cli2 "skills/dlc-respond/**/*.md"

# Verify skill symlink exists
ls -la ~/.claude/skills/dlc-respond

# Test invocation (requires a real PR with open review threads):
# /dlc-respond 42
# /dlc-respond 42 ABC-1234
```

## Gotchas

- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` for parallel Fixers — degrades gracefully to subagent or solo mode
- `review-dismissed.md` is **read-only** here — `dlc-review` and `dlc-build` write it, `dlc-respond` only reads it
- `respond-context.md` is written to `{artifacts_dir}/respond-context.md` (centralized, not the project repo) — clean up after done
- Fixer teammates must validate BEFORE committing — not after (validated BEFORE vs AFTER matters for revert cost)
- Max 3 fix attempts per thread — beyond 3 = architectural mismatch, escalate to user
- Thread grouping: same file → 1 Fixer (never parallel writes to same file)
- Team cleanup must be done by lead — teammates don't self-terminate
- One team per session — cannot run multiple dlc-respond in parallel
- Jira context is never blocking — if fetch fails, proceed without it
