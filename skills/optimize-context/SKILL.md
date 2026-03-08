---
name: optimize-context
description: "Audit, score, and optimize CLAUDE.md files. Use when CLAUDE.md is outdated, too large (>15KB), or needs initial setup. Triggers: 'optimize context', 'audit context', 'improve CLAUDE.md', 'init claude.md', 'bootstrap claude.md', 'setup context'."
argument-hint: "[--dry-run?]"
---

# /optimize-context

Audit, score, and optimize CLAUDE.md files for maximum agent effectiveness. Invoke as `/optimize-context [--dry-run]` — add `--dry-run` to run phases 1-3 only (report without edits).

## References

| File |
| --- |
| [quality-criteria.md](references/quality-criteria.md) |
| [compression-guide.md](references/compression-guide.md) |
| [templates.md](references/templates.md) |
| `scripts/pre-scan.sh` |

**Why passive context wins** ([Vercel research](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)):

> Vercel uses `AGENTS.md`; Claude Code uses `CLAUDE.md` — same concept, same results.

| Config | Overall | Build | Lint | Test |
| --- | --- | --- | --- | --- |
| Baseline (no docs) | 53% | 84% | 95% | 63% |
| Skills (default) | 53% | 84% | 89% ↓ | 58% ↓ |
| Skills (instructed) | 79% | 95% | 100% | 84% |
| **AGENTS.md** | **100%** | **100%** | **100%** | **100%** |

Compressed context (8KB) performs identically to verbose (40KB). Passive wins: no decision point about when to retrieve, consistent every turn, no sequencing issues.

**Target expectations:**

| Vercel's 100% pass rate |
| ---------------------------------------------------- |
| Agent completes tasks (build/lint/test) successfully |
| Achieved by having good passive context |

- **Grade B (70+) + no critical criterion below 10** = good baseline
- **Grade A (90+)** = ideal for framework-heavy or complex projects
- 100/100 is not always possible (e.g. no framework → retrieval readiness scores lower by design)
- Fully autonomous — all 5 phases run without user-confirmation gates

Critical minimum thresholds (score below these → must fix before passing):

| Criterion | Min |
| ------------------- | ----- |
| Commands | 10/15 |
| Architecture | 10/15 |
| Retrieval readiness | 10/15 |
| Conciseness | 10/15 |

## Workflow

Copy this checklist and check off items as you complete each phase:

```text
Progress:
- [ ] Phase 1: Discovery & Classification
- [ ] Phase 2: Quality Assessment
- [ ] Phase 3: Audit
- [ ] Phase 4: Generate Update
- [ ] Phase 5: Apply & Verify
```

> `--dry-run` → run phases 1-3 only, output report, skip phases 4-5.

### 1. Discovery & Classification

**Run pre-scan first** (saves ~2-4k tokens vs reading files individually):

```bash
bash skills/optimize-context/scripts/pre-scan.sh [project-root]
```

Output is compact JSON: `claude_files` (path + bytes), `framework` (name + version), `npm_scripts`, `dir_structure`, `has_agent_docs`, `has_claude_rules`. Use this to skip manual framework detection and file discovery. If script unavailable, use Glob patterns `**/CLAUDE.md`, `**/.claude.local.md`, `**/.claude.md`.

Identify each file's type:

| Type | Location |
| ---------------- | ------------------------ |
| Project root | `./CLAUDE.md` |
| Local overrides | `./.claude.local.md` |
| Global defaults | `~/.claude/CLAUDE.md` |
| Package-specific | `./packages/*/CLAUDE.md` |

Also list `agent_docs/` and `.claude/rules/` (if any) for deduplication checks.

**Classify context type:**

| Type | Signal |
| ---------- | -------------------------------------------- |
| Horizontal | Uses major framework (Next.js, NestJS, etc.) |
| Vertical | Custom/internal project |
| Hybrid | Framework + complex domain logic |

Detect framework: check `package.json`, `requirements.txt`, `go.mod`, etc. If official docs index tool exists (e.g. `npx @next/codemod@canary agents-md`), recommend it.

**Novel content detection:**

1. Identify framework + version from lockfiles/configs
2. Compare against model training cutoff (Claude: August 2025)
3. List APIs/features that are post-cutoff → these need detailed documentation
4. List well-known patterns within training data → candidates for compression/removal

Example post-cutoff APIs (Next.js 16, released late 2025): sync access to `cookies()`/`headers()`/`draftMode()`/`params`/`searchParams` **fully removed** (all must be awaited), `id` in image/sitemap generators now `Promise<string>`; within-cutoff Next.js 15 APIs (`connection()`, `'use cache'`, `cacheLife()`, `cacheTag()`, `forbidden()`, `unauthorized()`, `after()`) the model likely knows

**Output:** State classification explicitly — e.g. "Classification: Hybrid (Next.js 14 + custom domain). Next.js 14 within training cutoff — no post-cutoff docs needed."

**No CLAUDE.md found?** → Create one using the appropriate template from [references/templates.md](references/templates.md), then continue to phase 2.

### 2. Quality Assessment

Score each file using the 100-point rubric. See [references/quality-criteria.md](references/quality-criteria.md) for detailed scoring.

Quick checklist:

| Criterion | Weight |
| ---------------------- | ------ |
| Commands/workflows | 15 |
| Architecture clarity | 15 |
| Retrieval readiness | 15 |
| Conciseness | 15 |
| Non-obvious patterns | 10 |
| Novel content coverage | 10 |
| Currency | 10 |
| Actionability | 10 |

Grades: A (90-100), B (70-89), C (50-69), D (30-49), F (0-29).

**Output format per file** (must follow exactly):

```markdown
./CLAUDE.md — Score: XX/100 (Grade X) | Size: XX KB

| Criterion | Score | Status | Notes |
| --- | --- | --- | --- |
| Commands | XX/15 | ✅ or ⚠️ CRITICAL (if <10) | ... |
| Architecture | XX/15 | ✅ or ⚠️ CRITICAL (if <10) | ... |
| Retrieval readiness | XX/15 | ✅ or ⚠️ CRITICAL (if <10, framework only) | ... |
| Conciseness | XX/15 | ✅ or ⚠️ CRITICAL (if <10) | ... |
| Non-obvious | XX/10 | ✅ | ... |
| Novel content | XX/10 | ✅ | ... |
| Currency | XX/10 | ✅ | ... |
| Actionability | XX/10 | ✅ | ... |

Critical check: PASS ✅ — all criteria above minimums
— or —
Critical check: FAIL ⚠️ — [Criterion] at X/15 (min 10), [Criterion] at X/15 (min 10)
```

The Status column is **mandatory** — compare each score against the minimum thresholds table and mark `⚠️ CRITICAL` if below. Any `FAIL` criteria must be addressed in phase 4 before the file can pass.

### 3. Audit

Audit each section deeply — trace references to actual codebase files, verify commands by running them, cross-reference architecture claims against real directory structure. Surface-level checks are insufficient.

| Check |
| ----------------- |
| Stale |
| Gaps |
| Redundant |
| Outdated |
| Oversized |
| Noise |
| Missing retrieval |

Categorize as `Stale (must fix)`, `Gaps (must add)`, `Redundant (can reduce)`, `Noise (should remove)`, `OK`.

Proceed directly to phase 4 after outputting the report.

### 4. Generate Update

Apply changes following these priorities:

1. **Fix stale** → update to match actual codebase
2. **Fill gaps** → add missing patterns (compressed format)
3. **Deduplicate** → replace with pointers to agent_docs/rules
4. **Compress** → tables + one-liners over prose

For compression techniques: [references/compression-guide.md](references/compression-guide.md).
For templates by project type: [references/templates.md](references/templates.md).

**Size targets:** <8KB optimal, 8-15KB acceptable, >15KB needs compression.
**Size measurement:** Exclude auto-generated sections (`<claude-mem-context>`, plugin-injected blocks) from byte count — score only human-authored content.

**Output format** (must show before editing):

```markdown
### Proposed Changes

| # | Finding | Action | Size Impact |
| --- | --- | --- | --- |
| 1 | Finding #1: <summary> | <what will change> | +/- XX bytes |
| 2 | Finding #2: <summary> | <what will change> | +/- XX bytes |
| 3 | Finding #5: OK | No action needed | — |

Projected: Score XX → XX | Size: XX KB → XX KB
```

Every finding from phase 3 must appear in this table — if no action needed, state why.

Proceed directly to phase 5 after outputting the proposed changes table.

### 5. Apply & Verify

1. Edit CLAUDE.md files using Edit tool
2. **Completeness check:** Verify all proposed changes from phase 4 were applied — list each change with ✅/❌ status
3. **Size verification:** Run `wc -c <file>` for each edited file — report actual byte count
4. **Section integrity:** Read the final file and confirm all original sections are present (list them)
5. **Command & path validation:**
   - Run 2-3 commands documented in CLAUDE.md → confirm they still work
   - Verify file paths referenced → `ls` each critical path
6. **Retrieval & wording validation:**
   - Check retrieval directive present (if project uses a framework)
   - Confirm wording uses explore-first framing (not absolute "MUST" directives)
   - Verify docs index points to files that exist and are retrievable
7. **Behavior-based eval** (for framework projects with post-cutoff APIs):
   - Pick 2-3 post-cutoff APIs documented in CLAUDE.md
   - Ask: "Can the agent find the right docs file for this API from the index?"
   - Verify the index entry leads to correct, readable documentation
   - If project has no post-cutoff APIs, verify novel project patterns are documented instead
8. **Re-score with per-criterion breakdown** — show before/after for each criterion, confirm all critical thresholds now pass. Scores in the re-score table must be **final** — no post-hoc adjustments outside the table. If a criterion improved, update its score in the table directly.

**Verification output format** (must show all steps — do NOT stop after step 4):

```markdown
### Verification Checklist

| Step | Check | Result |
| --- | --- | --- |
| 1 | Changes applied | ✅ N/N applied (list each) |
| 2 | Size (wc -c) | ✅ XX bytes (was XX bytes) |
| 3 | Sections intact | ✅ N sections preserved (list) |
| 4 | Commands work | ✅ Ran: `cmd1` ✅, `cmd2` ✅ |
| 5 | Paths verified | ✅ N/N paths exist |
| 6 | Wording check | ✅ No absolute "MUST" directives / retrieval directive present (if framework) |
| 7 | Behavior eval | ✅ Tested N post-cutoff APIs (or novel patterns): [result] / N/A (non-framework) |
| 8 | Re-score | ✅ XX → XX (Grade X → X) |
```

Every row must have an actual result — do NOT skip rows or mark as N/A without explanation.

**If verification fails** (commands broken, paths missing, score decreased):

1. Revert the edit (`git checkout` the file)
2. Return to Phase 4 — re-scope the changes that caused failure
3. Do NOT incrementally patch — revert and re-apply cleanly

Report: `Score: XX → XX | Fixed N stale | Added N gaps | Removed N redundant | Size: XX KB → XX KB`

**Example output (phases 2-3):**

```markdown
## Audit Report

### ./CLAUDE.md — Score: 50/100 (Grade C) | Size: 18.2 KB

| Criterion           | Score | Status      | Issue                                |
| ------------------- | ----- | ----------- | ------------------------------------ |
| Commands            | 12/15 | ✅          | Missing deploy command               |
| Architecture        | 8/15  | ⚠️ CRITICAL | No module relationships              |
| Retrieval readiness | 0/15  | ⚠️ CRITICAL | No retrieval directive or docs index |
| Conciseness         | 5/15  | ⚠️ CRITICAL | 3 verbose sections + noise           |
| Non-obvious         | 8/10  | ✅          | —                                    |
| Novel content       | 3/10  | ✅          | Post-cutoff APIs not identified      |
| Currency            | 7/10  | ✅          | `src/legacy/` no longer exists       |
| Actionability       | 7/10  | ✅          | Vague "see docs" references          |

Critical check: FAIL ⚠️ — Architecture at 8/15 (min 10), Retrieval readiness at 0/15 (min 10), Conciseness at 5/15 (min 10)

### Findings

| #   | Type                   | Detail                                           |
| --- | ---------------------- | ------------------------------------------------ |
| 1   | Stale (must fix)       | `src/legacy/` removed in v3                      |
| 2   | Gaps (must add)        | No env setup instructions                        |
| 3   | Redundant (can reduce) | API docs duplicated in agent_docs/               |
| 4   | Oversized              | Architecture section 4KB → compressible to 0.8KB |
```

## Key Rules

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
