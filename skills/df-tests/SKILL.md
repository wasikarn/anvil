---
name: df-tests
description: "Generate unit or integration tests for source files or recent changes. Detects test framework (vitest/jest/bun/japa) from package.json and follows existing test conventions. Use when writing new tests, increasing coverage, or after implementing a feature. Spawns test-quality-reviewer agent to self-check output."
argument-hint: "[file-paths | --changes]"
effort: high
allowed-tools: Read, Grep, Glob, Bash, Write, Agent
---

# Generate Tests

**Target:** $ARGUMENTS | **Branch:** !`git branch --show-current 2>/dev/null || echo "unknown"`

## Test Quality Rules

Generated tests follow the T1-T9 hard rules from `devflow:df-test-patterns`:

| Rule | Focus |
|------|-------|
| T1 | Behavior over implementation |
| T2 | Mock fidelity — match real types |
| T3 | Edge case coverage (empty, null, boundary) |
| T4 | No `not.toThrow()` without reason |
| T5 | Zero assertion check |
| T6 | Boundary operator coverage |
| T7 | Stale mock contracts |
| T8 | No external state in unit tests |
| T9 | Test isolation |

See `devflow:df-test-patterns` for detailed patterns and examples.

## Step 1 — Identify Target Files

If `--changes` is in `$ARGUMENTS` or no file paths are given:

```bash
git diff HEAD --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|py|go|rb)$'
```

Filter out test files (files matching `*.test.*`, `*.spec.*`, `__tests__`). These are the source files to test.

If specific file paths are given in `$ARGUMENTS`, use those directly.

## Step 2 — Detect Test Framework

Read `package.json` (or equivalent for non-JS projects):

- `vitest` in dependencies → use Vitest
- `jest` in dependencies → use Jest
- `bun` runtime with `bun:test` imports → use Bun test
- `@japa/runner` → use Japa

If ambiguous: check existing test files for import style to confirm.

## Step 3 — Learn Conventions from Adjacent Tests

For each source file, look for an existing test file in the same directory or a sibling `__tests__/` directory. Read 1–2 of them to extract:

- Import style (`import { describe, it } from 'vitest'` vs global `describe`/`it`)
- Test file naming pattern (`foo.test.ts`, `foo.spec.ts`, `FooTest.ts`)
- Assertion style (`expect(x).toBe(y)` vs `assert.equal(x, y)`)
- Mock setup patterns (vi.mock, jest.mock, spy patterns)
- Factory / fixture patterns for test data

If no existing tests found: use sensible defaults for the detected framework.

## Step 4 — Generate Test File(s)

For each source file:

1. Read the source file — understand exported functions, classes, and their contracts
2. Identify test cases: happy path, edge cases (null/empty/boundary), error paths
3. Write test file following the exact conventions from Step 3
4. Co-locate the test file next to the source (or in the project's standard location)

Coverage targets per function:

- Happy path (required)
- At least one edge case per non-trivial input (empty array, null, zero)
- Error/exception path if the function can throw

## Step 5 — Run Tests to Verify

Determine the test command from `package.json` scripts, then run:

```bash
# Run only the generated files (not the full suite)
npx vitest run <test-file>   # vitest
npx jest <test-file>         # jest
bun test <test-file>         # bun
```

If tests fail:

- Read the error output
- Fix the test (not the source) — the goal is matching existing behavior, not changing it
- Re-run. Repeat up to 3 times.
- If still failing after 3 attempts: report what failed and why; do not silently skip.

## Step 6 — Self-Check with test-quality-reviewer

After tests pass, spawn the `test-quality-reviewer` agent on the generated files:

```text
Agent: test-quality-reviewer
Task: Review the following generated test files for T1–T9 violations: <list of generated file paths>
```

## Step 7 — Fix T6 Violations (Zero-Assertion Tests)

T6 (zero-assertion tests) is a Hard Rule. If the reviewer flags any:

- Add a meaningful assertion to each flagged test
- Re-run the tests to confirm they still pass

Report all other findings from the reviewer (T1–T5, T7–T9) as warnings — fix Critical findings, note the rest.

## Output

Report:

- Files generated (paths)
- Test count per file
- Test run result (pass/fail)
- Reviewer findings summary (Critical / Warning count)
