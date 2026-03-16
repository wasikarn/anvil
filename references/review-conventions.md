# Review Conventions

Shared conventions for `dlc-*` review skills.

## Review Principles

- Improve overall code health, not demand perfection — approve once it clearly improves the codebase
- Explain *why* architecturally, not just *what* to change
- Mentor: show better patterns, cite reference modules as examples
- Respect author's approach when valid — don't impose preference
- Flag scope creep, suggest splitting large PRs
- Prefer simplest correct solution — flag over-engineering (unnecessary abstraction, speculative generality) and under-engineering (missing error handling, inadequate tests) equally
- YAGNI: code for the ticket, not hypothetical future requirements — flag "just in case" abstractions, extension points, and unused parameters as over-engineering

## PR Size

Parse `Diff stat` from header. Count total changed lines.

| Size | Lines | Behavior |
| --- | --- | --- |
| 🟢 Normal | <=400 | Full review |
| 🟡 Large | 401-1000 | Full review + suggest split in verdict |
| 🔴 Massive | >1000 | Hard Rules + AC only, skip 🔵, warn prominently |

🔴 Massive warning: `⚠️ PR มี <N> changed lines — focus เฉพาะ 🔴 Critical + AC ควร split PR ก่อน merge`

## Comment Labels

Prefix every inline comment with a label:

| Sev | Label | Thai | Use |
| --- | --- | --- | --- |
| 🔴 | `issue:` | (ต้องแก้) | Bugs, security, broken patterns — blocks merge |
| 🟡 | `suggestion:` | (แนะนำ) | Better approach exists — should fix |
| 🔵 | `nitpick:` | (เล็กน้อย) | Style, minor naming — non-blocking |
| ✅ | `praise:` | (ดี) | Good practice to reinforce |

Examples:

- `issue: (ต้องแก้) ตรงนี้ใช้ as any — runtime error slip past compiler ได้ ลอง type guard แทนนะครับ`
- `suggestion: (แนะนำ) logic ซ้ำ 3 ที่ extract เป็น util ดีกว่าครับ`
- `praise: (ดี) error handling ตรงนี้ structured ดีมาก มี context ครบ`

## Consolidation (Phase 3.5)

After CHECKPOINT (all reviewers collected):

1. **Dedup** by `file:line` — 2+ reviewers flag same spot → keep highest severity, merge evidence, record agreement count (e.g. "N/3")
2. **Pattern cap** — same rule violation repeated in >3 files → consolidate into 1 finding + "and N more locations". List max 3 representative file:line references.
3. **Verify** — re-read flagged code before confirming severity. Drop any finding where the code doesn't match the claim — if an agent didn't read the file or misread it, discard the finding entirely.
4. **Remove false positives** — documented patterns, project exceptions, intentional code
5. **Actionable check** — every remaining finding must have: evidence (file:line), rationale (why), and fix (how). Drop findings that only state the problem without a concrete solution.
6. **Sort** — 🔴 → 🟡 → 🔵
7. **Signal check** — if (🔴+🟡)/Total < 60%, likely too noisy — re-review findings

## Strengths

- 1-3 items only — genuinely notable, not a participation trophy
- Must cite evidence: file:line or specific pattern used
- Focus: correct project patterns, test coverage on complex logic, architecture boundaries, thoughtful error handling

## Reviewer Focus Areas

| Reviewer | Primary Rules | Focus |
| --- | --- | --- |
| Correctness & Security | #1, #2, #10, #12 | Functional correctness, security, type safety, error handling |
| Architecture & Performance | #3, #4, #5, #6, #7 | N+1, DRY, structure, SOLID, elegance, SQL performance |
| DX & Testing | #8, #9, #11, #12 | Naming, documentation, testability, debugging |

All reviewers receive Hard Rules verbatim. Primary = report with full detail + examples. Secondary = flag only if 90+ confidence.
