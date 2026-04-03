# Token Optimization for Devflow

**Date:** 2026-04-03
**Status:** Revised (post-review)
**Author:** Claude (via brainstorming session)

## Executive Summary

Reduce token usage in devflow skills by 15-40% through targeted optimizations: field filtering for bootstrap agents, token metrics tracking, and PR diff filters. The token budget watchdog is deferred to Phase 4 pending metrics validation.

## Problem Statement

Devflow skills consume significant tokens through:
1. **Full MCP responses** — Jira/Confluence APIs return full issue/page content
2. **Unfiltered PR diffs** — Large PRs include lockfiles, generated files, vendored code
3. **No token visibility** — No tracking of per-skill/phase token costs
4. **No budget enforcement** — Expensive operations run without cost awareness

## Solution Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     devflow skills                          │
│  (build, review, debug, respond, merge-pr, etc.)           │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  Bootstrap    │ │ Token Metrics │ │ PR Diff       │
│  Agents       │ │ Tracking      │ │ Filters       │
│  (--fields)   │ │ (TypeScript)  │ │ (--exclude)   │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│              devflow-metrics.jsonl                          │
│  { "schema_version": "1.1", "tokens": { "input", "output" } }│
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Bootstrap Agents (Field Filtering)

**Verdict:** ✅ APPROVED (MCP field filtering verified)

**What:** Add `--fields` parameter to `jira-integration` skill for filtered MCP calls.

**Why:** MCP calls return full issue content (3-8K tokens typical). Field filtering reduces to essential fields only (1-2K tokens).

**Verification:** `jira_get_issue` supports `fields` parameter per atlassian-pm plugin documentation.

**Implementation:**

```markdown
// skills/jira-integration/SKILL.md (enhancement)
// Add field presets:

// Presets (recommended):
//   --preset=review    → fields=key,status,assignee,summary,description
//   --preset=build     → fields=key,summary,customfield_10015,subtasks
//   --preset=debug     → fields=key,summary,priority,issuelinks

// Custom fields:
//   --fields=key,status,summary

// Fallback:
//   If preset misses required data, agent can request additional fields
```

**Token Savings:** 2,000-6,000 per skill invocation (30-50% reduction)

**Files Changed:**
- `skills/jira-integration/SKILL.md` — Add preset detection logic
- `agents/devflow-build-bootstrap.md` — Pass `--preset=build`
- `agents/devflow-debug-bootstrap.md` — Pass `--preset=debug`
- `agents/pr-review-bootstrap.md` — Pass `--preset=review`

---

### 2. Token Metrics Tracking

**Verdict:** ✏️ REVISE (create metrics.ts, remove speculative fields)

**What:** Create `devflow-engine/src/metrics.ts` with token tracking fields.

**Why:** No visibility into per-skill/phase token costs. Foundation for future optimization.

**Implementation:**

```typescript
// devflow-engine/src/metrics.ts (NEW FILE)
// Schema v1.1 for devflow-metrics.jsonl

interface MetricsEntry {
  schema_version: "1.1";
  timestamp: string;
  skill: string;
  phase: string;
  mode: string;
  tokens: {
    input: number;      // From Claude Code API (if available)
    output: number;     // From Claude Code API (if available)
    cumulative_session: number;  // Running total
  };
}

// Note: estimated_mcp removed — Claude Code API doesn't expose MCP overhead
```

**Schema Versioning:**
- `schema_version: "1.1"` — New field for token tracking
- Backward compatible — old entries without `tokens` field remain readable
- metrics-analyst agent handles missing fields gracefully

**Files Changed:**
- `devflow-engine/src/metrics.ts` — NEW FILE, create from scratch
- `skills/metrics/SKILL.md` — Display token metrics
- `skills/dashboard/SKILL.md` — Show token summary

**Token Overhead:** Minimal (50-100 tokens per append)

---

### 3. PR Diff Filters

**Verdict:** ✅ APPROVED (native `gh pr diff --exclude` verified)

**What:** Add `--exclude` flag to review skill for file filtering.

**Why:** Large PRs include lockfiles, generated files, vendored code that consume tokens without review value.

**Implementation:**

```bash
# Add --exclude to review skill (native gh support)
gh pr diff "$PR_NUM" --exclude 'package-lock.json' --exclude 'yarn.lock'

# Threshold-based auto-filter
if [[ $(git diff --numstat | wc -l) -gt 100 ]]; then
  EXCLUDE="--exclude 'package-lock.json' --exclude '*.min.js' --exclude 'yarn.lock'"
fi
```

**Note:** Native `gh pr diff` supports `--exclude` but not `--files`. Use `--exclude` for filtering.

**Token Savings:** 10,000-30,000 for large PRs (40-60% reduction)

**Files Changed:**
- `skills/review/SKILL.md` — Add `--exclude` parameter
- `agents/pr-review-bootstrap.md` — Auto-filter logic

---

### 4. Token Budget Watchdog

**Verdict:** ❌ DEFERRED to Phase 4 (negative ROI for typical sessions)

**What:** Single agent monitors token budget and warns when approaching threshold.

**Why Deferred:**
- Watchdog costs 800-1,500 tokens per check
- Negative ROI for sessions under 50K tokens
- No baseline data to validate threshold assumptions
- Must prove ROI through metrics collection first

**Conditional Implementation (Phase 4 only if metrics validate):**

```markdown
# agents/token-watchdog.md
name: token-watchdog
description: Monitor session token budget and warn when approaching threshold.
model: haiku
invocation: Opt-in via --budget-watchdog flag (default: off)

## Behavior
1. Read cumulative tokens from devflow-metrics.jsonl
2. Compare against threshold (default: 50k tokens)
3. If approaching threshold:
   - Output warning with suggestions
   - Recommend alternatives (compact mode, reduced scope)
4. Never block — warn only

## Threshold
- Default: 50,000 tokens per session
- Configurable via --budget-threshold flag
- Only spawns if --budget-watchdog flag is set
```

---

### 5. Compact Scripts

**Verdict:** ❌ REMOVED (superseded by field filtering)

**Reason:** Functionality covered by Bootstrap Agents `--fields` parameter.

---

## Architecture Decisions

### Decision 1: TypeScript Only

**Decision:** All new code uses TypeScript (devflow-engine) or Bash (scripts).

**Rationale:**
- Single language stack reduces complexity
- Shares existing tooling (bun test, TypeScript, linting)
- No new CI/CD pipeline changes

---

### Decision 2: Named Injection Points

**Decision:** Use named injection points instead of numbered phases.

**Rationale:**
- `after_bootstrap` is clearer than "Phase 0.5"
- No renumbering of existing phases
- Easier to add new injection points

**Mechanism:** Skill calls at phase boundaries (not background agents).

```
before_bootstrap → bootstrap → after_bootstrap →
before_plan → plan → after_plan →
before_review → review → after_review →
```

---

### Decision 3: Session-Level Budget

**Decision:** Budget applies per-session, not per-skill.

**Rationale:**
- Avoids coordination overhead between skills
- Cumulative tracking is simpler
- Matches user mental model

---

### Decision 4: Warning-Only Budget Enforcement

**Decision:** Token Budget Watchdog warns but never blocks.

**Rationale:**
- Blocking requires complex fallback logic
- Warning preserves user agency
- User can decide to proceed or optimize

---

## Implementation Phases

### Phase 0 (NEW — Verification)

| Task | Purpose | Prerequisites |
|------|---------|---------------|
| Create `devflow-engine/src/metrics.ts` | Foundation for all tracking | None |
| Define JSONL schema v1.1 | Include `schema_version`, `tokens.input`, `tokens.output` | metrics.ts created |
| Collect 10 baseline sessions | Measure actual token costs per skill/phase | metrics.ts operational |
| Document injection point mechanism | Choose: skill call at phase boundaries | Design review |

**Success Metric:** metrics.ts writes valid JSONL, backward compatible

---

### Phase 1 (Revised — Field Filtering)

| Task | Effort | Prerequisites |
|------|--------|---------------|
| Add `--fields` presets to jira-integration | M | Phase 0 complete |
| Update bootstrap agents with presets | L | Phase 0 complete |
| Add fallback for missing fields | M | — |

**Success Metric:** Track token savings in devflow-metrics.jsonl, 2-6K savings per Jira call

---

### Phase 2 (Revised — Diff Filters)

| Task | Effort | Prerequisites |
|------|--------|---------------|
| Add `--exclude` to review skill | M | Phase 0 complete |
| Add auto-filter for large PRs | M | Phase 0 complete |
| Update dashboard skill | L | — |

**Success Metric:** Measure diff filtering effectiveness on PRs >30 files

---

### Phase 3 (Revised — Metrics Rollout)

| Task | Effort | Prerequisites |
|------|--------|---------------|
| Enable token tracking by default | M | Phase 0 metrics.ts created |
| Add token summary to `/metrics` skill | L | Phase 0 complete |
| Validate savings claims | M | 10+ baseline sessions |

**Success Metric:** Token metrics visible in dashboard, baseline established

---

### Phase 4 (NEW — Watchdog, Conditional)

| Task | Condition |
|------|-----------|
| Create token-watchdog agent | Only if Phase 0-3 show ROI |
| Add injection points | Only if ROI validated |
| Enable opt-in by default | Only if ROI > 0 |

**Success Metric:** Watchdog cost < 20% of tokens saved per session

---

## Expected Impact

| Metric | Original Claim | Revised Estimate | Rationale |
|--------|----------------|-------------------|-----------|
| Jira fetch savings | 12K (80%) | 2-6K (30-50%) | Typical issues 3-8K; filtered 1-2K |
| Large PR diff savings | 40K (80%) | 10-30K (40-60%) | Varies by PR composition |
| Watchdog ROI | Assumed positive | NEGATIVE (<50K sessions) | Costs 800-1500 tokens per check |
| **Overall session savings** | 30-60% | **15-40%** | Conservative estimate after expert review |

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Field filtering misses needed data | Low | Medium | Fallback to request additional fields |
| Metrics file write failure | Low | Low | Append-only, defensive parsing |
| Watchdog false positives | Medium | Low | Warning-only, user decides |
| No baseline measurements | High | Medium | Phase 0 collects 10 baseline sessions |
| Breaking existing behavior | Low | High | Feature flags, gradual rollout |

---

## Critical Blockers Resolved

| Blocker | Status | Resolution |
|---------|--------|------------|
| MCP field filtering | ✅ VERIFIED | `jira_get_issue` supports `fields` parameter |
| metrics.ts doesn't exist | ✅ RESOLVED | CREATE new file, not modify |
| Token estimation speculative | ✅ RESOLVED | Remove `estimated_mcp` field |
| Injection points undefined | ✅ RESOLVED | Skill call at phase boundaries |
| No baseline measurements | ✅ RESOLVED | Add Phase 0 baseline collection |

---

## Future Considerations

1. **Context caching** — Share loaded references across skills (not in scope)
2. **SDK token tracking** — Track actual token counts from Claude Code API (requires API changes)
3. **MCP overhead tracking** — Track MCP call overhead (not trackable without API support)

---

## References

- [skills-best-practices.md](../../references/skills-best-practices.md) — Skill authoring guidelines
- [agent-hook-pattern.md](../../references/agent-hook-pattern.md) — Agent architecture
- [jira-integration/SKILL.md](../../../skills/jira-integration/SKILL.md) — Current Jira integration
- [atlassian-pm plugin docs](https://github.com/wasikarn/atlassian-pm) — MCP field filtering verification