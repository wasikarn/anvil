# dlc-review skill

Experimental Agent Teams-based PR review with adversarial debate.
Uses 3 reviewer teammates that challenge each other's findings instead of 7 parallel subagents.

## How It Differs from Other Skills

| Aspect | dlc-review | dlc-build | dlc-debug |
| --- | --- | --- | --- |
| Scope | PR review + debate | Full dev loop | Debug + DX harden |
| Execution | 3 teammates (debate) | Dynamic roster per phase | Investigator + DX Analyst + Fixer |
| False positives | Adversarial debate | Embedded (reuses dlc-review) | N/A (no review phase) |
| Project scope | Auto-detects project | Auto-detects project | Auto-detects project |
| Feature status | Experimental | Experimental | Experimental |

## Docs Index

| Reference | When to use |
| --- | --- |
| `references/debate-protocol.md` | Modifying debate rules, round structure, or consensus criteria |
| `../../references/review-conventions.md` | Shared review conventions (labels, dedup, strengths) |
| `../../references/review-output-format.md` | Output format template |
| `references/operational.md` | Graceful Degradation, Context Compression Recovery, Success Criteria |

## Skill Architecture

- `SKILL.md` — lead orchestration playbook; phases, team creation, debate flow
- `references/debate-protocol.md` — debate rules, round-robin assignment, consensus criteria
- Reuses shared `references/review-conventions.md` and `references/review-output-format.md`
- Project-specific Hard Rules loaded from `{project_root}/.claude/skills/review-rules/hard-rules.md` if present

## Validate After Changes

```bash
# Lint all markdown in this skill
npx markdownlint-cli2 "skills/dlc-review/**/*.md"

# Verify skill symlink exists
ls -la ~/.claude/skills/dlc-review

# Test invocation (requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1):
# /dlc-review <pr-number> [Author|Reviewer]
```

## Gotchas

- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — degrades gracefully to subagent or solo mode
- Agent teams have no session resumption for in-process teammates — recommend tmux mode
- Teammates are READ-ONLY during review and debate — code changes only in action phase
- Hard Rules cannot be dropped via debate — only reclassified with evidence
- Max 2 debate rounds enforced by lead — prevents runaway token usage
- Team cleanup must be done by lead, not teammates
- One team per session — cannot run multiple dlc-review in parallel
- Phase 0.05 bootstrap uses `pr-review-bootstrap` agent (Haiku) — if unavailable, teammates gather context themselves
- Pre-Debate Triage skips debate for Auto-pass (Hard Rule + conf ≥90) and Auto-drop (Info + conf <80) findings
- Dismissed findings persist at `{project_root}/.claude/review-dismissed.md` — cap 50 entries FIFO
