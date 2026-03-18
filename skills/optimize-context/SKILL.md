---
name: optimize-context
description: "Invoke for any request touching a CLAUDE.md or 'context file' — the instructions file that shapes Claude's behavior in a project. Trigger when: the user wants to score or grade their CLAUDE.md quality, clean up a bloated or oversized file, fix a CLAUDE.md that's causing Claude to misbehave or do things wrong, improve messy or ineffective instructions, preview changes without editing (dry-run), create a CLAUDE.md from scratch, or explicitly run /optimize-context. The core signal: something about how Claude is being instructed needs a checkup or fix. Do NOT invoke for AGENTS.md edits, code review, dependency updates, or documentation unrelated to CLAUDE.md."
argument-hint: "[--dry-run?] [--coverage?]"
compatibility: "Requires markdownlint-cli2 (npx). Uses standard Unix tools (wc, stat)."
---

# /optimize-context

Audit, score, and optimize CLAUDE.md files for maximum agent effectiveness. Invoke as `/optimize-context [--dry-run]` — add `--dry-run` to run phases 1-3 only (report without edits).

## References

| File | Content |
| --- | --- |
| [quality-criteria.md](references/quality-criteria.md) | CLAUDE.md Quality rubric (8 criteria, 100 pts) + Project Coverage rubric (12 categories) — load in Phase 2 |
| [compression-guide.md](references/compression-guide.md) | Compression techniques: tables, one-liners, pointer-to-docs patterns — load in Phase 4 |
| [audit-antipatterns.md](references/audit-antipatterns.md) | CLAUDE.md anti-patterns catalog: noise, stale, redundant, missing retrieval — load in Phase 3 |
| [templates.md](references/templates.md) | CLAUDE.md templates by project type (horizontal/vertical/hybrid) — load in Phase 4 when creating from scratch |
| `scripts/pre-scan.sh` | Detects framework, npm scripts, dir structure in ~30ms — run first in Phase 1 |
| [key-rules.md](references/key-rules.md) | 12 operational rules — read before making changes in Phase 4 |

**Why passive context wins:** Compressed 8KB context = 100% task success vs 53% baseline. AGENTS.md outperforms skills by 2×. Full data and grade thresholds: [references/quality-criteria.md](references/quality-criteria.md#vercel-research).

Critical minimum thresholds (score below these → must fix before passing):

| Criterion | Min |
| ------------------- | ----- |
| Commands | 10/15 |
| Architecture | 10/15 |
| Retrieval readiness | 10/15 (framework projects only) |
| Conciseness | 10/15 |
| Currency | 5/10 |

### Project Coverage (optional — `--coverage` flag)

When `$ARGUMENTS` includes `--coverage`: also assess how well the project adopts Claude Code features (12 categories, scored 0-3 per applicable category, normalized to 100). See [references/quality-criteria.md](references/quality-criteria.md) for the full rubric and relevance table. When args include "expect" + "score 100/100": list every gap and concrete steps to close each one.

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
bash ${CLAUDE_SKILL_DIR}/scripts/pre-scan.sh [project-root]
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
2. Check framework version against Claude's training data — if uncertain whether docs are within training cutoff, assume they are NOT and flag for documentation
3. List APIs/features likely post-cutoff → these need detailed documentation
4. List well-known, stable patterns → candidates for compression/removal

**Output:** State classification explicitly — e.g. "Classification: Hybrid (Next.js 14 + custom domain). Next.js 14 is well-established — no post-cutoff docs needed."

**No CLAUDE.md found?** → Create one using the appropriate template from [references/templates.md](references/templates.md), then continue to phase 2.

### 2. Quality Assessment

Score each file using the CLAUDE.md Quality rubric (100 points). See [references/quality-criteria.md](references/quality-criteria.md) for detailed scoring.

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

**Output format:** See [quality-criteria.md](references/quality-criteria.md#phase-2-output-format) — score table per criterion with Status column showing ✅ or ⚠️ CRITICAL against minimums.

If `--coverage` flag: also assess Project Coverage using the rubric in [references/quality-criteria.md](references/quality-criteria.md). Scan for `.claude/rules/`, `skills/`, `agents/`, `output-styles/`, `.claude/settings.json`, `.mcp.json`, `.claude-plugin/`. Score each applicable category 0-3, normalize to 100.

### 3. Audit

Audit each section deeply — trace references to actual codebase files, verify commands by running them, cross-reference architecture claims against real directory structure. Surface-level checks are insufficient.

Load [audit-antipatterns.md](references/audit-antipatterns.md) to systematically detect noise, stale content, redundancy, and missing retrieval patterns.

**Write findings to `.claude/optimize-context-report.md`** so they survive context compaction during long audits.

| Check | Detection heuristic |
| ----------------- | ------------------- |
| Stale | File path, command, or version reference that no longer matches codebase |
| Gaps | Framework/tool detected in pre-scan but no corresponding commands or architecture section |
| Redundant | Same content appears in CLAUDE.md and in `agent_docs/`, `.claude/rules/`, or another file |
| Outdated | Tech version or API referenced is superseded (check `package.json`, lockfiles) |
| Oversized | File exceeds 15 KB after excluding auto-generated sections |
| Noise | Sentence that doesn't change agent behavior — generic advice, obvious framework defaults, TODO never resolved |
| Missing retrieval | Framework project with no retrieval directive and no docs index |

Categorize as `Stale (must fix)`, `Gaps (must add)`, `Redundant (can reduce)`, `Noise (should remove)`, `OK`.

**Strengths (1-3):** Cite highest-scoring criteria with evidence. E.g., "Commands: 15/15 — all 8 scripts documented with context."

> **If `--dry-run`:** output report above and STOP — do not proceed to Phase 4.

Proceed directly to phase 4 after outputting the report.

### 4. Generate Update

Apply changes following these priorities:

1. **Fix stale** → update to match actual codebase
2. **Fill gaps** → add missing patterns (compressed format)
3. **Deduplicate** → replace with pointers to agent_docs/rules
4. **Compress** → tables + one-liners over prose

**Novel content rule:** If Phase 1 identified post-cutoff APIs or custom internal APIs:

- If `agent_docs/` exists with docs → add pipe-delimited index pointing to it
- If `agent_docs/` does NOT exist → document the API inline (key exports, breaking changes, usage patterns) — a docs pointer to a non-existent dir is worse than inline docs
- Also add the command to generate docs if an official tool exists (e.g. `npx @next/codemod@canary agents-md`)

**Command completeness:** Ensure every script in `package.json` / `Makefile` / `Taskfile` that an agent would need is in the Commands section. The pre-scan output contains `npm_scripts` — compare against what's already documented and add any missing commands.

For compression techniques: [references/compression-guide.md](references/compression-guide.md).
For templates by project type: [references/templates.md](references/templates.md).

**Size targets:** <8KB optimal, 8-15KB acceptable, >15KB needs compression.
**Size measurement:** Exclude auto-generated sections (`<claude-mem-context>`, plugin-injected blocks) from byte count — score only human-authored content.

**Output format:** See [key-rules.md](references/key-rules.md#phase-4-proposed-changes-format) — table of all findings with action and size impact, plus projected score/size.

Proceed directly to phase 5 after outputting the proposed changes table.

### 5. Apply & Verify

1. Edit CLAUDE.md files using Edit tool
2. **Verify completeness:** List each proposed change with ✅/❌ status. Run `wc -c` for size. Read final file to confirm all sections intact.
3. **Validate:** Run 2-3 commands from CLAUDE.md, verify referenced paths exist, check retrieval directive present (framework projects), confirm explore-first wording (no absolute "MUST" directives)
4. **Re-score:** Show before/after for each criterion, confirm critical thresholds pass. If `--coverage`: re-assess Project Coverage too.

**If verification fails:** revert (`git checkout`), return to Phase 4, re-apply cleanly.

Report: `CLAUDE.md Quality: XX → XX | Fixed N stale | Added N gaps | Removed N redundant | Size: XX KB → XX KB`

## Key Rules

See [references/key-rules.md](references/key-rules.md) for 12 operational rules (evidence-based, preserve intent, compress not delete, idempotent, passive over active, and more).
