# Design: devflow-engine + TypeScript Migration

**Date:** 2026-03-30
**Status:** Approved
**Scope:** Rename devflow-sdk → devflow-engine · Risk Scorer · Mode Resolver · Lens Assigner

---

## 1. Motivation

Current auto-escalation logic lives entirely in prose (phase-3.md). This creates three problems:

1. **LLM hallucination risk** — the skill lead must parse and execute multi-condition routing in natural language; any misreading silently picks the wrong mode
2. **No feedback loop** — dismissed patterns in `review-dismissed.md` are injected as prose hints but never systematically lower the risk score
3. **Naming mismatch** — `devflow-sdk/` implies Anthropic Agent SDK, but the engine uses `claude -p` subprocess (`execFile`) with no API key dependency

**Principle (from SortBench/CodeRabbit research):** Pre-compute everything deterministic in TypeScript. LLM sees only judgment tasks.

---

## 2. Rename: devflow-sdk → devflow-engine

### What changes

| Asset | Before | After |
| --- | --- | --- |
| Directory | `devflow-sdk/` | `devflow-engine/` |
| CLI error prefixes | `[sdk-review]`, `[sdk-falsify]` etc. | `[engine-review]`, `[engine-falsify]` etc. |
| Skill bash variable | `SDK_DIR` | `ENGINE_DIR` |
| Skill prose | "SDK Review Engine" | "Review Engine" |
| CLAUDE.md references | `devflow-sdk/` | `devflow-engine/` |
| devflow-sdk-rules.md | `devflow-sdk/**` path glob | `devflow-engine/**` |

### What does NOT change

- Internal module structure (`src/review/`, `src/cli.ts`, etc.)
- `runClaudeSubprocess` pattern — correct as-is (uses `claude -p` subprocess)
- `package.json` name field stays `private: true`, not published

---

## 3. New TypeScript Modules

All modules live in `devflow-engine/src/`. All use strict TypeScript with advanced type patterns (no `any`, discriminated unions, branded types, exhaustive matching).

### 3.1 `src/risk-scorer.ts`

**Purpose:** Replace multi-condition prose routing with a composite 0–100 score.

#### Types

```typescript
type Score = number & { readonly _brand: 'Score' }        // branded — prevents raw number confusion
type FilePath = string & { readonly _brand: 'FilePath' }  // branded file path

type RiskSignals = {
  readonly loc: number
  readonly changedFiles: readonly FilePath[]
  readonly hasJiraKey: boolean
  readonly dismissedPatterns: readonly string[]
}

type ScoreBreakdown = {
  readonly loc: Score
  readonly fileType: Score
  readonly semantic: Score
  readonly contextBonus: number       // additive, can be negative
}

type RiskResult = {
  readonly total: Score
  readonly breakdown: ScoreBreakdown
  readonly mode: ReviewMode
  readonly reasons: readonly string[]
}
```

#### Scoring formula

| Component | Range | Logic |
| --- | --- | --- |
| `loc` | 0–40 | `Math.min(40, (loc / 400) * 40)` — linear, capped |
| `fileType` | 0–35 | `auth/` or `migrations/` = 35 · CI/CD `*.yml` in `.github/` = 25 · controllers/routes/public API handlers = 15 · test files = 5 · default = 0 |
| `semantic` | 0–30 | Regex scan: secret patterns (`password`, `token`, `secret`, `api_key`) = 30 · SQL (`CREATE TABLE`, `ALTER TABLE`) = 20 · auth tokens (`jwt`, `bearer`) = 15 · default = 0 — uses highest match, not additive |
| `contextBonus` | additive | Jira key present = +10 · each dismissed pattern match = −10 (floor: −10 total) |

#### Mode thresholds

```typescript
type ReviewMode = 'micro' | 'quick' | 'full'

function scoreToMode(score: Score): ReviewMode {
  if (score >= 55) return 'full'
  if (score >= 30) return 'quick'
  return 'micro'
}
```

#### CLI integration

New subcommand: `devflow-engine score --pr <n> [--dismissed <path>] --output json`

Output JSON schema:
```typescript
type ScoreOutput = {
  score: number
  mode: ReviewMode
  reasons: string[]
  breakdown: { loc: number; fileType: number; semantic: number; contextBonus: number }
}
```

#### Skill integration (phase-3.md)

Replace current if/else prose block with:
```bash
score_result=$(cd "$ENGINE_DIR" && node_modules/.bin/tsx src/cli.ts score --pr $0 --output json 2>&1)
score_exit=$?
# Parse mode from score_result.mode → use as escalation decision
```

---

### 3.2 `src/mode-resolver.ts`

**Purpose:** Consolidate all flag + signal → mode routing into one deterministic function. Currently scattered across phase-3.md prose.

#### Types

```typescript
type CLIFlags = {
  readonly micro: boolean
  readonly quick: boolean
  readonly full: boolean
  readonly focused: string | null
}

type SpecialistTrigger =
  | { readonly type: 'test-quality-reviewer'; readonly priority: 1 }
  | { readonly type: 'api-contract-auditor'; readonly priority: 2 }
  | { readonly type: 'migration-reviewer'; readonly priority: 3 }
  | { readonly type: 'silent-failure-hunter'; readonly priority: 4 }
  | { readonly type: 'type-design-analyzer'; readonly priority: 5 }

type ModeResolution = {
  readonly mode: ReviewMode
  readonly source: 'explicit-flag' | 'risk-score' | 'default'
  readonly specialistTriggers: readonly SpecialistTrigger[]
  readonly lensCount: LensCount
  readonly reasons: readonly string[]
}

type LensCount = 'full' | 'reduced' | 'skip'  // <30 files | 30–50 | >50
```

#### Resolution logic (precedence order)

1. `--focused [area]` → `focused` mode, single specialist, skip main reviewers
2. `--micro` flag → `micro`
3. `--quick` flag → `quick`
4. `--full` flag → `full`
5. Risk score from `risk-scorer.ts` → `micro` | `quick` | `full`

Specialist triggers: evaluate P1–P3 (spawn first match only) + P4–P5 independently. Returns as discriminated union array — consumer knows exact type with no casting.

---

### 3.3 `src/lens-assigner.ts`

**Purpose:** Replace prose-based lens injection table with typed function.

#### Types

```typescript
type TeammateRole = 'correctness' | 'architecture' | 'dx'

type Lens =
  | 'security' | 'performance' | 'frontend' | 'database'
  | 'typescript' | 'error-handling' | 'api-design' | 'observability'

type LensAssignment = {
  readonly teammate: TeammateRole
  readonly lenses: readonly Lens[]
}

type LensAssignmentResult =
  | { readonly kind: 'full'; readonly assignments: readonly LensAssignment[] }
  | { readonly kind: 'reduced'; readonly assignments: readonly LensAssignment[] }  // max 1 per teammate
  | { readonly kind: 'skipped'; readonly reason: string }
```

#### Assignment table (mirrors current prose)

```
<30 files  → 'full':    correctness=[#1,#2,#10,#12], architecture=[#3,#4,#5,#6,#7], dx=[#8,#9,#11,#12]
30–50 files → 'reduced': correctness=[security], architecture=[performance], dx=[frontend if applicable]
>50 files  → 'skipped': "Large diff (N files) — lenses skipped, Hard Rules only"
```

---

## 4. Test Requirements

Each module requires a `.test.ts` file:

| Module | Key test cases |
| --- | --- |
| `risk-scorer.test.ts` | LOC boundary (399/400/401) · file-type patterns · semantic regex · dismissed pattern discount · mode thresholds (29/30/54/55) |
| `mode-resolver.test.ts` | Explicit flag precedence order · specialist P1 blocks P2+P3 · P4+P5 independent · focused mode bypasses main reviewers |
| `lens-assigner.test.ts` | File count boundaries (29/30/50/51) · reduced = max 1 per teammate · skip returns reason string |

All tests: behavior-based (test outputs, not internals). No mocking of TypeScript-only logic.

---

## 5. Skill File Updates Required

| File | Change |
| --- | --- |
| `skills/review/references/phase-3.md` | Replace SDK bash block with engine score call · replace prose auto-escalation with score-driven routing |
| `skills/review/SKILL.md` | `SDK_DIR` → `ENGINE_DIR` |
| `skills/build/references/phase-*.md` | Any `devflow-sdk` references → `devflow-engine` |
| `CLAUDE.md` | Table + commands: `devflow-sdk/` → `devflow-engine/` |
| `.claude/rules/devflow-sdk-rules.md` | Path glob update |

---

## 6. Out of Scope

The following 17-candidate items are **deferred** (Medium confidence or Low value):

- Log file FIFO management → low LLM risk, low urgency
- Build loop decision tree → complex, limited ROI vs current prose
- Triage/verdict fallback gaps → Agent Teams path works; gaps are edge cases
- PR size thresholds in review-conventions → prose is clear enough

These can be revisited after the 4 priority modules are proven in production.

---

## 7. Implementation Order

1. Rename `devflow-sdk/` → `devflow-engine/` (directory + all references)
2. `risk-scorer.ts` + `risk-scorer.test.ts` + CLI `score` subcommand
3. `mode-resolver.ts` + `mode-resolver.test.ts`
4. `lens-assigner.ts` + `lens-assigner.test.ts`
5. Update skill files to use engine score output
6. Run full QA (`bash scripts/qa-check.sh`)
