# Key Rules

- **Evidence-based** — Every change must trace to actual codebase (no guessing)
- **Preserve intent** — Never remove sections user intentionally added — deliberate documentation encodes tribal knowledge the skill can't recover if deleted
- **Compress, don't delete** — verbose → concise tables, not removal
- **Index over embed** — Point to agent_docs for deep reference, keep CLAUDE.md as quick-ref index
- **Project-specific only** — No generic advice, no obvious info, no standard framework behavior
- **Idempotent** — Running repeatedly must not create duplicates — CLAUDE.md is loaded every session; duplicate content wastes context tokens on every future run
- **Retrieval over pre-training** — Ensure CLAUDE.md includes retrieval directive for framework projects
- **Explore-first wording** — Use "Prefer X" / "Check project first" over "You MUST" directives — absolute commands reduce the agent's ability to adapt; explore-first wording guides without over-constraining
- **Prioritize novel content** — APIs/patterns outside training data get more space than well-known ones
- **Noise reduction** — Remove content that doesn't aid decision-making; unused/irrelevant context may distract the agent (Vercel: skills ignored 56% of the time when not relevant)
- **Passive over active** — For general framework knowledge, embed in CLAUDE.md (passive) rather than relying on skills (active retrieval). Skills are best for action-specific workflows users explicitly trigger
- **Self-invocation** — Recommend adding staleness reminder in CLAUDE.md (e.g. "Run `/optimize-context` when CLAUDE.md feels outdated") — CLAUDE.md drifts as codebases evolve; a staleness trigger keeps context self-maintaining without requiring the user to remember

## Phase 4 Proposed Changes Format

Show before editing — every finding from phase 3 must appear, even if action is "No action needed":

```markdown
### Proposed Changes

| # | Finding | Action | Size Impact |
| --- | --- | --- | --- |
| 1 | Finding #1: <summary> | <what will change> | +/- XX bytes |
| 2 | Finding #2: <summary> | <what will change> | +/- XX bytes |
| 3 | Finding #5: OK | No action needed | — |

Projected: Score XX → XX | Size: XX KB → XX KB
```
