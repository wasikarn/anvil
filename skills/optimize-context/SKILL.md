---
name: optimize-context
description: |
  Audit, score, and optimize CLAUDE.md files for maximum agent effectiveness. Combines quality assessment with codebase-aligned compression. Use when: (1) CLAUDE.md feels outdated or stale, (2) project codebase has changed significantly, (3) CLAUDE.md is too large or verbose (>15KB), (4) agent keeps making mistakes that better context would prevent, (5) new project needs initial CLAUDE.md setup, (6) checking quality of existing CLAUDE.md files, (7) user asks to "optimize context", "improve claude.md", "audit context", "check CLAUDE.md quality", "setup context", "init claude.md", or "bootstrap claude.md"
---

# /optimize-context

Audit, score, and optimize CLAUDE.md files for maximum agent effectiveness.

**Why passive context wins** ([Vercel research](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)):

> Vercel uses `AGENTS.md`; Claude Code uses `CLAUDE.md` — same concept, same results.

| Configuration | Pass Rate |
| --- | --- |
| Baseline (no docs) | 53% |
| Skills (default) | 53% — agents ignored skills 56% of the time |
| Skills (with explicit instructions) | 79% |
| **AGENTS.md docs index** | **100%** |

Detailed breakdown — skills can **degrade** performance (noise effect):

| Config | Build | Lint | Test |
| --- | --- | --- | --- |
| Baseline | 84% | 95% | 63% |
| Skills (default) | 84% | 89% ↓ | 58% ↓ |
| Skills (instructed) | 95% | 100% | 84% |
| **AGENTS.md** | **100%** | **100%** | **100%** |

Even with explicit instructions achieving 95%+ skill invocation rate, pass rate peaked at 79%.
Compressed context (8KB) performs identically to verbose (40KB).
Passive context wins because: (1) no decision point about when to retrieve, (2) consistent availability every turn, (3) no sequencing issues.

**Target expectations:**

| Vercel's 100% pass rate | Skill's quality score |
| --- | --- |
| Agent completes tasks (build/lint/test) successfully | CLAUDE.md quality measured against 8-criterion rubric |
| Achieved by having good passive context | Scores depend on project type and complexity |

- **Grade B (70+) + no critical criterion below 10** = good baseline
- **Grade A (90+)** = ideal for framework-heavy or complex projects
- 100/100 is not always possible (e.g. no framework → retrieval readiness scores lower by design)
- Not fully autonomous — workflow has 2 user-confirmation gates (phases 3 and 4)

Critical minimum thresholds (score below these → must fix before passing):

| Criterion | Min | Why |
| --- | --- | --- |
| Commands | 10/15 | Agent must know how to build/test |
| Architecture | 10/15 | Agent must understand project structure |
| Retrieval readiness | 10/15 | Key Vercel finding (framework projects only) |
| Conciseness | 10/15 | Noise actively hurts agent performance |

## Workflow

1. **Discovery** — Find all CLAUDE.md files, identify types
2. **Quality Assessment** — Score each file against rubric
3. **Audit** — Check alignment with actual codebase
4. **Generate Update** — Plan changes with size impact
5. **Apply & Verify** — Edit, verify structure, spot-check

> `--dry-run` → run phases 1-3 only, output report, skip phases 4-5.

### 1. Discovery & Classification

Find all CLAUDE.md files in the project:

```bash
find . -name "CLAUDE.md" -o -name ".claude.local.md" -o -name ".claude.md" 2>/dev/null | head -50
```

Identify each file's type:

| Type | Location | Purpose |
| --- | --- | --- |
| Project root | `./CLAUDE.md` | Primary context (shared via git) |
| Local overrides | `./.claude.local.md` | Personal settings (gitignored) |
| Global defaults | `~/.claude/CLAUDE.md` | User-wide defaults |
| Package-specific | `./packages/*/CLAUDE.md` | Module-level in monorepos |

Also list `agent_docs/` and `.claude/rules/` (if any) for deduplication checks.

**Classify context type:**

| Type | Signal | Strategy |
| --- | --- | --- |
| Horizontal | Uses major framework (Next.js, NestJS, etc.) | Prioritize retrieval index + docs pointer |
| Vertical | Custom/internal project | Prioritize workflow docs + architecture |
| Hybrid | Framework + complex domain logic | Both: retrieval index + project-specific workflows |

Detect framework: check `package.json`, `requirements.txt`, `go.mod`, etc. If official docs index tool exists (e.g. `npx @next/codemod@canary agents-md`), recommend it.

**Novel content detection:**

1. Identify framework + version from lockfiles/configs
2. Compare against model training cutoff (Claude: May 2025)
3. List APIs/features that are post-cutoff → these need detailed documentation
4. List well-known patterns within training data → candidates for compression/removal

Example post-cutoff APIs (Next.js 16): `connection()`, `'use cache'`, `cacheLife()`, `cacheTag()`, `forbidden()`, `unauthorized()`, `proxy.ts`, async `cookies()`/`headers()`, `after()`, `updateTag()`, `refresh()`

**No CLAUDE.md found?** → Create one using the appropriate template from [references/templates.md](references/templates.md), then continue to phase 2.

### 2. Quality Assessment

Score each file using the 100-point rubric. See [references/quality-criteria.md](references/quality-criteria.md) for detailed scoring.

Quick checklist:

| Criterion | Weight | Check |
| --- | --- | --- |
| Commands/workflows | 15 | Build/test/deploy present and copy-paste ready? |
| Architecture clarity | 15 | Can Claude understand codebase structure? |
| Retrieval readiness | 15 | Has retrieval directive, docs index, explore-first wording? |
| Conciseness | 15 | No verbose explanations, no noise, no obvious info? |
| Non-obvious patterns | 10 | Gotchas and quirks documented? |
| Novel content coverage | 10 | Post-cutoff APIs detailed, known patterns removed? |
| Currency | 10 | Reflects current codebase state? |
| Actionability | 10 | Instructions executable, not vague? |

Grades: A (90-100), B (70-89), C (50-69), D (30-49), F (0-29).

**Critical threshold check:** If any criterion from the minimum thresholds table scores below its minimum, mark it `⚠️ CRITICAL` in the report. These must be addressed in phase 4 before the file can pass.

Output per file: `./CLAUDE.md — Score: XX/100 (Grade X) | Size: XX KB | Issues: [list]`

### 3. Audit

Check CLAUDE.md against codebase reality:

| Check | What to look for |
| --- | --- |
| Stale | References to files/patterns that no longer exist |
| Gaps | Codebase conventions not documented |
| Redundant | Duplicated with agent_docs or .claude/rules |
| Outdated | Code examples not matching current codebase |
| Oversized | Verbose sections compressible via tables/one-liners |
| Noise | Content that doesn't aid agent decision-making and may distract (generic advice, obvious patterns, well-known framework defaults) |
| Missing retrieval | Framework project lacks retrieval directive or docs index |

Categorize as `Stale (must fix)`, `Gaps (must add)`, `Redundant (can reduce)`, `Noise (should remove)`, `OK`.

**Gate:** User confirms report before proceeding.

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

Show each change with reason and size impact before applying.

**Gate:** User reviews preview before applying.

### 5. Apply & Verify

1. Edit CLAUDE.md files using Edit tool
2. **Completeness check:** Verify all proposed changes from phase 4 were applied — list each change with ✅/❌ status
3. Verify size: `wc -c` each file
4. Verify all sections still intact
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
8. **Re-score with per-criterion breakdown** — show before/after for each criterion, confirm all critical thresholds now pass

Report: `Score: XX → XX | Fixed N stale | Added N gaps | Removed N redundant | Size: XX KB → XX KB`

**Example output (phases 2-3):**

```markdown
## Audit Report

### ./CLAUDE.md — Score: 50/100 (Grade C) | Size: 18.2 KB

| Criterion | Score | Issue |
| --- | --- | --- |
| Commands | 12/15 | Missing deploy command |
| Architecture | 8/15 | No module relationships |
| Retrieval readiness | 0/15 | No retrieval directive or docs index |
| Conciseness | 5/15 | 3 verbose sections + noise |
| Non-obvious | 8/10 | — |
| Novel content | 3/10 | Post-cutoff APIs not identified |
| Currency | 7/10 | `src/legacy/` no longer exists |
| Actionability | 7/10 | Vague "see docs" references |

### Findings

| # | Type | Detail |
| --- | --- | --- |
| 1 | Stale (must fix) | `src/legacy/` removed in v3 |
| 2 | Gaps (must add) | No env setup instructions |
| 3 | Redundant (can reduce) | API docs duplicated in agent_docs/ |
| 4 | Oversized | Architecture section 4KB → compressible to 0.8KB |
```

## Key Rules

- **Evidence-based** — Every change must trace to actual codebase (no guessing)
- **Preserve intent** — Never remove sections user intentionally added
- **Compress, don't delete** — verbose → concise tables, not removal
- **Index over embed** — Point to agent_docs for deep reference, keep CLAUDE.md as quick-ref index
- **Project-specific only** — No generic advice, no obvious info, no standard framework behavior
- **Idempotent** — Running repeatedly must not create duplicates
- **Retrieval over pre-training** — Ensure CLAUDE.md includes retrieval directive for framework projects
- **Explore-first wording** — Use "Prefer X" / "Check project first" over "You MUST" directives
- **Prioritize novel content** — APIs/patterns outside training data get more space than well-known ones
- **Noise reduction** — Remove content that doesn't aid decision-making; unused/irrelevant context may distract the agent (Vercel: skills ignored 56% of the time when not relevant)
- **Passive over active** — For general framework knowledge, embed in CLAUDE.md (passive) rather than relying on skills (active retrieval). Skills are best for action-specific workflows users explicitly trigger
- **Self-invocation** — Recommend adding staleness reminder in CLAUDE.md (e.g. "Run `/optimize-context` when CLAUDE.md feels outdated")
