# Design: devflow-engine + TypeScript Migration

**Date:** 2026-03-30
**Status:** Approved (post multi-agent review)
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

## 3. Shared Types: `src/types.ts`

All cross-module types live here. No module defines its own copy.

```typescript
// Branded primitives — use factory functions below, never cast directly
type Score = number & { readonly _brand: 'Score' }
type FilePath = string & { readonly _brand: 'FilePath' }
type Bonus = number & { readonly _brand: 'Bonus' }  // signed, range −10 to +10

// Factory functions — the ONLY legal way to create branded values
function toScore(n: number): Score {
  if (n < 0 || n > 100) throw new RangeError(`Score out of range: ${n}`)
  return n as Score
}
function toFilePath(s: string): FilePath {
  if (!s.trim()) throw new Error('Empty file path')
  return s as FilePath
}
function toBonus(n: number): Bonus {
  return Math.max(-10, Math.min(10, Math.round(n))) as Bonus
}

// Core domain types
type ReviewMode = 'micro' | 'quick' | 'full'
type LensCount = 'full' | 'reduced' | 'skip'   // <30 files | 30–50 | >50
type TeammateRole = 'correctness' | 'architecture' | 'dx'
type Lens =
  | 'security' | 'performance' | 'frontend' | 'database'
  | 'typescript' | 'error-handling' | 'api-design' | 'observability'

// Specialist triggers — discriminated on type, priority separated
type SpecialistType =
  | 'test-quality-reviewer'
  | 'api-contract-auditor'
  | 'migration-reviewer'
  | 'silent-failure-hunter'
  | 'type-design-analyzer'
type SpecialistPriority = 1 | 2 | 3 | 4 | 5
type SpecialistTrigger = {
  readonly type: SpecialistType
  readonly priority: SpecialistPriority
}

// PR signals — input to risk scorer and mode resolver
type PRSignals = {
  readonly loc: number
  readonly changedFiles: readonly FilePath[]
  readonly hasJiraKey: boolean
  readonly dismissedPatterns: readonly string[]
}
```

---

## 4. New TypeScript Modules

All modules live in `devflow-engine/src/`. All import from `types.ts`. No `any` types.

### 4.1 `src/risk-scorer.ts`

**Purpose:** Composite 0–100 risk score from PR signals.

#### Internal types (local to this module)

```typescript
type ScoreBreakdown = {
  readonly loc: Score
  readonly fileType: Score
  readonly semantic: Score
  readonly contextBonus: Bonus      // branded Bonus, not plain number
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
| `loc` | 0–40 | `Math.min(40, (loc / 400) * 40)` — linear, capped; result floored to integer before branding |
| `fileType` | 0–35 | `auth/` or `migrations/` = 35 · CI/CD `*.yml` in `.github/` = 25 · controllers/routes/public API handlers = 15 · test files = 5 · default = 0 — highest match per file, not additive across files |
| `semantic` | 0–30 | Regex scan: secret patterns (`password`, `token`, `secret`, `api_key`) = 30 · SQL (`CREATE TABLE`, `ALTER TABLE`) = 20 · auth tokens (`jwt`, `bearer`) = 15 · default = 0 — **highest match only, not additive** |
| `contextBonus` | −10 to +10 | Jira key = +10 · dismissed pattern match = −10 per match, **floor −10 total** |
| `total` | 0–100 | `Math.min(100, loc + fileType + semantic + contextBonus)` — explicit ceiling |

#### Mode thresholds

```typescript
function scoreToMode(score: Score): ReviewMode {
  if (score >= 55) return 'full'
  if (score >= 30) return 'quick'
  return 'micro'
}
```

Thresholds use `>=` with integer scores. All sub-scores must be floored before summation to prevent float boundary bugs (e.g., `39.9 + 30 + 10 = 79.9` routing as `full` when `floor` would give `79`).

#### CLI output type (JSON boundary — unbranded)

```typescript
// Serialized output — no branded types at JSON boundaries
type ScoreOutput = {
  score: number
  mode: ReviewMode
  reasons: string[]
  breakdown: { loc: number; fileType: number; semantic: number; contextBonus: number }
}
```

---

### 4.2 `src/mode-resolver.ts`

**Purpose:** Single entry point for all flag + signal → full review decision. Skills call `resolve`, not `score`.

#### Types

```typescript
type CLIFlags = {
  readonly micro: boolean
  readonly quick: boolean
  readonly full: boolean
  readonly focused: string | null   // null = not set; explicit absence at CLI boundary
}

type ModeResolution = {
  readonly mode: ReviewMode
  readonly source: 'explicit-flag' | 'risk-score'
  readonly specialistTriggers: readonly SpecialistTrigger[]
  readonly lensCount: LensCount
  readonly score: number                  // included for logging/debugging
  readonly reasons: readonly string[]
}
```

#### Resolution logic (precedence order)

1. `--focused [area]` → `focused` mode, single specialist, skip main reviewers
2. `--micro` flag → `micro` (overrides risk score)
3. `--quick` flag → `quick` (overrides risk score)
4. `--full` flag → `full` (overrides risk score)
5. Conflicting flags (`--micro` + `--full` simultaneously) → `full` wins (most conservative)
6. No explicit flag → risk score from `risk-scorer.ts` (TypeScript import, not subprocess)

Specialist triggers: P1–P3 evaluate in order, first match wins. P4–P5 evaluate independently. All matching triggers included in output array.

Lens count: derived from `changedFiles.length` per `lens-assigner.ts`.

#### CLI subcommand

`devflow-engine resolve --pr <n> [--dismissed <path>] [--micro] [--quick] [--full] [--focused <area>] --output json`

Output: `ModeResolution` serialized (unbranded). This is the **primary subcommand for skill integration**.

---

### 4.3 `src/lens-assigner.ts`

**Purpose:** Deterministic lens injection table. Standalone — no dependencies on other new modules.

#### Types

```typescript
type LensAssignment = {
  readonly teammate: TeammateRole
  readonly lenses: readonly Lens[]
}

type LensAssignmentResult =
  | { readonly kind: 'full'; readonly assignments: readonly LensAssignment[] }
  | { readonly kind: 'reduced'; readonly assignments: readonly LensAssignment[] }  // max 1 lens per teammate
  | { readonly kind: 'skipped'; readonly reason: string }

// Exhaustive guard — catches unhandled kind additions at compile time
function assertNever(x: never): never { throw new Error(`Unhandled kind: ${String(x)}`) }
```

#### Assignment table

```
fileCount=0 → 'skipped': "No changed files"
<30 files   → 'full':    correctness=[security,error-handling], architecture=[performance,database], dx=[typescript,observability]
30–50 files → 'reduced': correctness=[security], architecture=[performance], dx=[frontend if applicable else typescript]
>50 files   → 'skipped': "Large diff ({n} files) — lenses skipped, Hard Rules only"
```

---

## 5. Test Requirements

Each module requires a `.test.ts` file. All tests are behavior-based (test public outputs, not internals). No mocking of TypeScript-only logic.

### `risk-scorer.test.ts`

| Case | Expected |
| --- | --- |
| `loc=0` | `locScore=0` |
| `loc=399` | `locScore=39` (floored) |
| `loc=400` | `locScore=40` (cap exact) |
| `loc=401` | `locScore=40` (cap holds) |
| `loc=1600` | `locScore=40` (large LOC still capped) |
| auth file only | `fileType=35` |
| auth + test file in same PR | `fileType=35` (highest wins, not sum) |
| no matching file | `fileType=0` |
| secrets pattern in diff | `semantic=30` |
| SQL + secrets in same diff | `semantic=30` (highest wins) |
| no semantic match | `semantic=0` |
| Jira key present | `contextBonus=+10` |
| 1 dismissed match | `contextBonus=−10` |
| 2 dismissed matches | `contextBonus=−10` (floor holds, not −20) |
| Jira + dismissed | `contextBonus=0` (+10 − 10) |
| `score=29` | `mode='micro'` |
| `score=30` | `mode='quick'` |
| `score=54` | `mode='quick'` |
| `score=55` | `mode='full'` |
| max signals (auth + secrets + Jira + 600 LOC) | `total ≤ 100` (ceiling holds) |
| float intermediate (loc=399) | threshold comparison uses integer total |

### `mode-resolver.test.ts`

| Case | Expected |
| --- | --- |
| `--micro` flag | `mode='micro'`, `source='explicit-flag'` |
| `--quick` flag | `mode='quick'`, `source='explicit-flag'` |
| `--full` flag | `mode='full'`, `source='explicit-flag'` |
| `--micro` + `--full` simultaneously | `mode='full'` (conservative wins) |
| `--micro` flag with high-risk signals (score ≥ 55) | `mode='micro'` (explicit flag overrides score) |
| no flags, low signals (score < 30) | `mode='micro'`, `source='risk-score'` |
| no flags, medium signals (score 30–54) | `mode='quick'`, `source='risk-score'` |
| test file changed → P1 match | `specialistTriggers=[test-quality-reviewer]` |
| controller + test file changed → P1+P2 eligible | `specialistTriggers=[test-quality-reviewer]` (P1 wins, P2 skipped) |
| try/catch in diff → P4 match | P4 included independently |
| `--focused errors` | `mode='focused'`, only `silent-failure-hunter` triggered |

### `lens-assigner.test.ts`

| Case | Expected |
| --- | --- |
| `fileCount=0` | `kind='skipped'`, reason includes "No changed files" |
| `fileCount=29` | `kind='full'` |
| `fileCount=30` | `kind='reduced'` |
| `fileCount=50` | `kind='reduced'` |
| `fileCount=51` | `kind='skipped'` |
| `reduced` result | each teammate has exactly 1 lens |
| `skipped` result | `reason` includes file count |

**Property-based test (fast-check):**
- Monotonicity: for inputs A strictly dominating B on all signals → `score(A) >= score(B)`
- LOC cap invariant: `∀ loc >= 400: locScore === 40`

---

## 6. Skill Integration

### Primary integration point

Skills call `resolve`, not `score`. The `resolve` subcommand returns the full decision including mode, specialist triggers, and lens count — no prose logic needed in the skill.

```bash
ENGINE_DIR="${CLAUDE_SKILL_DIR}/../../devflow-engine"

if [ -d "$ENGINE_DIR" ] && [ -d "$ENGINE_DIR/node_modules" ]; then
  # Build args — pass dismissed file if it exists
  RESOLVE_ARGS="--pr $0 --output json"
  DISMISSED_FILE="$(bash "${CLAUDE_SKILL_DIR}/../../scripts/artifact-dir.sh" review)/review-dismissed.md"
  if [ -f "$DISMISSED_FILE" ]; then
    RESOLVE_ARGS="$RESOLVE_ARGS --dismissed $DISMISSED_FILE"
  fi
  # Pass explicit mode flags from user args
  echo "$ARGUMENTS" | grep -q '\-\-micro' && RESOLVE_ARGS="$RESOLVE_ARGS --micro"
  echo "$ARGUMENTS" | grep -q '\-\-quick' && RESOLVE_ARGS="$RESOLVE_ARGS --quick"
  echo "$ARGUMENTS" | grep -q '\-\-full'  && RESOLVE_ARGS="$RESOLVE_ARGS --full"

  resolve_result=$(cd "$ENGINE_DIR" && node_modules/.bin/tsx src/cli.ts resolve $RESOLVE_ARGS 2>&1)
  resolve_exit=$?

  _extract_mode() {
    if command -v jq >/dev/null 2>&1; then
      echo "$1" | jq -r '.mode' 2>/dev/null
    else
      echo "$1" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).mode)" 2>/dev/null
    fi
  }

  if [ "$resolve_exit" -eq 0 ]; then
    resolved_mode=$(_extract_mode "$resolve_result")
  else
    echo "devflow-engine resolve failed (exit $resolve_exit) — falling back to rule-based escalation"
    resolve_exit=1
  fi
else
  echo "devflow-engine not available — falling back to rule-based escalation"
  resolve_exit=1
fi

# Fallback: rule-based prose escalation (existing phase-3.md logic)
if [ "$resolve_exit" -ne 0 ]; then
  resolved_mode=""  # skill lead applies prose auto-escalation as before
fi
```

### `score` subcommand

Kept for debugging and inspection only (`devflow-engine score --pr <n>`). Not called by skills.

---

## 7. Skill File Updates Required

| File | Change |
| --- | --- |
| `skills/review/references/phase-3.md` | Replace SDK bash block + prose auto-escalation with engine `resolve` call (see Section 6) |
| `skills/review/SKILL.md` | `SDK_DIR` → `ENGINE_DIR` |
| `skills/review/references/phase-5.md` | `SDK_DIR` → `ENGINE_DIR` in falsification bash block |
| `skills/debug/references/phase-2-investigate.md` | `SDK_DIR` → `ENGINE_DIR` |
| `skills/build/references/phase-*.md` | Any `devflow-sdk` references → `devflow-engine` |
| `CLAUDE.md` | Table + commands: `devflow-sdk/` → `devflow-engine/` |
| `.claude/rules/devflow-sdk-rules.md` | Path glob: `devflow-sdk/**` → `devflow-engine/**` |

---

## 8. Out of Scope

The following 17-candidate items are **deferred** (Medium confidence or Low value):

- Log file FIFO management → low LLM risk, low urgency
- Build loop decision tree → complex, limited ROI vs current prose
- Triage/verdict fallback gaps → Agent Teams path works; gaps are edge cases
- PR size thresholds in review-conventions → prose is clear enough

These can be revisited after the 4 priority modules are proven in production.

---

## 9. Implementation Order

1. Rename `devflow-sdk/` → `devflow-engine/` as single atomic commit — verify `tsx src/cli.ts review` still runs before next step
2. Add `src/types.ts` with all shared types + factory functions
3. `src/risk-scorer.ts` + `src/risk-scorer.test.ts`
4. Add `score` CLI subcommand
5. `src/mode-resolver.ts` + `src/mode-resolver.test.ts`
6. Add `resolve` CLI subcommand
7. `src/lens-assigner.ts` + `src/lens-assigner.test.ts`
8. Update all skill files per Section 7
9. Run full QA (`bash scripts/qa-check.sh`)
