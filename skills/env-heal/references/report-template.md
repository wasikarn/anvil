# Env Healing Report Template

Output this report in Phase 7. Replace placeholders with actual data. Omit any section that has zero items (skip "Stale" if nothing is stale, skip "Test Results" rows 2-3 if only 1 run needed).

```markdown
## Env Healing Report

**Mode:** Full / Quick | **Scanned vars:** N | **Gaps found:** N | **Fixed:** N

### Added to env.ts

| Variable | Type | Required/Optional | Reasoning |
|----------|------|-------------------|-----------|
| `VAR_NAME` | string | optional | Used in `app/Config/x.ts` with fallback |

### Added to .env.example

| Variable | Default | Source file |
|----------|---------|-------------|
| `VAR_NAME` | (empty) | `app/Services/y.ts` |

### Stale (flagged for review)

| Variable | Found in | Missing from | Action |
|----------|----------|--------------|--------|
| `OLD_VAR` | env.ts schema | codebase | Remove from schema or confirm usage |
| `LEGACY_VAR` | .env.example | codebase | Remove from example or confirm usage |

### Test Results

| Run | Result | Notes |
|-----|--------|-------|
| 1   | PASS/FAIL | (error summary if failed) |
| 2   | PASS/FAIL | (only if run 1 failed) |
| 3   | PASS/FAIL | (only if run 2 failed) |

**Final status:** All tests pass / Tests still failing — changes reverted

### Files Modified

- `env.ts` — added N variables
- `.env.example` — added N variables
```
