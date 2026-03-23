# DX Checklist

DX audit categories for the DX Analyst teammate. Also provides condensed Quick mode checklist for the Fixer.

## Full Audit Categories

### 1. Error Handling

| # | Sev | Pattern | What to look for |
| --- | --- | --- | --- |
| E1 | Critical | Silent failure | Empty `catch {}`, swallowed errors, `catch (e) { return null }` without comment |
| E2 | Critical | Unhelpful error message | Generic "something went wrong", no entity ID/operation context for debugging |
| E3 | Warning | Missing error context | No stack trace logged, no input data in error, no request/correlation ID |
| E4 | Warning | Inconsistent error handling | Some paths throw, others return null, no pattern |
| E5 | Warning | Untyped error surface | Plain `new Error('msg')` where domain error class exists; `throw 'string'` — uncatchable by `instanceof Error` |
| E6 | Warning | Log-without-rethrow at boundary | External call fails, error logged, function returns normally — upstream cannot distinguish success from failure |
| E7 | Warning | No retry on transient failures | Network call or DB query in distributed context with no retry wrapper — single transient error surfaces to user |
| E8 | Warning | Unbounded retry | Retry loop without max attempt count, or retrying on non-retryable errors (400/404) |

### 2. Observability

| # | Sev | Pattern | What to look for |
| --- | --- | --- | --- |
| O1 | Warning | Missing logging | No log at key decision points (auth check, data mutation, external call, business event) |
| O2 | Warning | Unstructured logging | `console.log`/`console.error` instead of project's structured logger |
| O3 | Warning | Missing log context fields | `logger.error(e.message)` — no structured fields; should be `logger.error({ err: e, userId, operation }, 'msg')` |
| O4 | Warning | Sensitive data in logs | Password, token, full request body, PII (email, phone, national ID) in log fields |
| O5 | Warning | Missing correlation ID | New async entry point (HTTP handler, queue consumer, cron job) doesn't set requestId/correlationId on logger context |
| O6 | Info | Missing trace propagation | Outbound HTTP call doesn't forward `X-Request-Id` / `traceparent` — trace breaks at service boundary |

### 3. Prevention

| # | Sev | Pattern | What to look for |
| --- | --- | --- | --- |
| P1 | Critical | Type safety hole | `as any`, `as unknown as T`, unvalidated external input cast with `as T` |
| P2 | Warning | Missing boundary validation | No schema validation at API/service entry (controller → service with no parse/guard) |
| P3 | Warning | Test coverage gap | Affected code path has no test or only happy-path test |
| P4 | Info | Missing edge case test | No test for null, empty, concurrent, boundary values, or malformed input |
| P5 | Warning | Non-injectable dependency | `new ConcreteService()` inside constructor body — cannot mock in tests, creates hidden coupling |

## Remediation Quick-Reference

Use these patterns when writing the Recommendation column for Critical/Warning findings:

| Code | Concrete Remediation |
| --- | --- |
| E1 | Re-throw with context: `logger.error({ err, input }, 'ctx'); throw err` or `throw new AppError('msg', { cause: err })` |
| E2 | Replace generic message with context: `\`Failed to ${operation} ${entity.id}: ${err.message}\`` — include entity ID, operation, input shape |
| E5 | Create domain error class: `class NotFoundError extends Error { constructor(resource: string, id: unknown) { super(\`${resource} not found: ${id}\`) } }` |
| E7 | Wrap in retry helper with exponential backoff + max attempts; skip on 4xx errors (client errors are not retryable) |
| O3 | Switch to structured fields: `logger.error({ err: e, userId, operation: 'findById' }, 'user lookup failed')` |
| O5 | Set correlationId at entry point via AsyncLocalStorage or logger child: `logger.child({ requestId: req.id })` |
| P1 | Replace `as T` cast with: schema parse (`z.parse(data)`), type guard (`if (!isUser(data)) throw ...`), or branded type |
| P2 | Add boundary validation: `const dto = CreateUserSchema.parse(body)` in controller before passing to service |

## Quick Mode Condensed Checklist

When DX Analyst is skipped (`--quick` mode), append these checks to the Fixer prompt:

```text
DX QUICK CHECK — while fixing, also look for these in the affected area:
1. Silent failures: empty catch blocks or swallowed errors near the bug (→ E1 Critical)
2. Unhelpful errors: generic messages that would make this bug harder to find next time (→ E2 Critical)
3. Missing log context: log call without structured fields (userId, operation, err object) (→ O3 Warning)
4. Type safety: `as any` or unvalidated external input near the bug (→ P1 Critical)
5. Missing test: no existing test covers the code path that broke (→ P3 Warning)
If you find any Critical items (1, 2, 4), fix them as separate commits. Warning items optional in Quick mode.
```

## Severity Definitions

| Severity | Meaning | Action |
| --- | --- | --- |
| Critical | Actively hides bugs or causes silent data corruption | Must fix |
| Warning | Makes debugging harder or allows bugs to slip through | Fix if scope reasonable |
| Info | Nice to have, improves DX but not urgent | Skip unless user requests |
