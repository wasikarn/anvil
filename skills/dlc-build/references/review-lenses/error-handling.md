# Error Handling Review Lens

Inject into reviewer prompts when diff touches: `try`, `catch`, `async`, `.catch(`, `Promise`, `new Error`, `throw`.

```text
ERROR HANDLING LENS (active for this review):

HARD RULES (flag unconditionally — no confidence gate):
- Empty catch block: `catch (e) {}` or `catch { }` with no body
  Fix: log the error or re-throw; `catch (e) { logger.error(e); throw e; }`
- Swallowed Promise rejection: `.catch(() => {})` with empty callback
  Fix: `.catch((e) => logger.error('context', e))` minimum
- Unhandled async: `async` function with no try/catch where caller does not
  await with catch — silent rejection possible at runtime
- `finally` block containing `return` → discards any exception thrown in try/catch

WARNING (confidence ≥ 75):
- Silent fallback: catch returns default value (`return []`, `return null`) without
  comment explaining why swallowing is safe — misleads callers into thinking operation succeeded
- Catch-all without discrimination: `catch (e: unknown)` in critical path with no
  `instanceof` check — catches programmer errors alongside runtime errors
- Log-without-rethrow at service boundary: external call fails, error logged, function
  returns normally — upstream cannot distinguish success from failure
- Generic `new Error('something went wrong')` in service layer → not actionable for debugging;
  include context: `new Error(\`UserService.findById failed for id=${id}: ${e.message}\`)`

STRUCTURED ERROR TYPES (flag when service has no typed error hierarchy):
- Error thrown as plain string: `throw 'not found'` → uncatchable by `instanceof Error`
- No domain error classes for expected failures: 404/403/conflict should be typed, not string messages
  Pattern: `class NotFoundError extends Error { constructor(resource: string, id: unknown) { ... } }`
- Catch block re-throws raw `e` from external dep → leaks internal error details to caller;
  wrap: `throw new ServiceError('fetch failed', { cause: e })`

OBSERVABILITY INTEGRATION:
- Error caught and logged without structured context fields
  Weak: `logger.error(e.message)`
  Strong: `logger.error({ err: e, userId, operation: 'findById' }, 'user lookup failed')`
- Error swallowed in background job / queue consumer without dead-letter or alert
  Pattern: wrap entire job body in try/catch; on catch → log + increment error counter + optional DLQ push
- `console.error` in production code → replace with structured logger

RETRY & RESILIENCE (flag when calling external services or DB):
- Network call without any retry → single transient failure causes hard error to user
  Flag: external HTTP calls, DB queries in distributed systems without retry wrapper
- Retry without backoff: fixed-interval retry on rate-limit (429) or service unavailable (503)
  Fix: exponential backoff with jitter
- Unbounded retry loop: no maximum attempt count → infinite retry on permanent failure
  Fix: `for (let i = 0; i < MAX_RETRIES; i++) { ... }`
- Retry on non-retryable errors (400 Bad Request, 404 Not Found) → wastes time and quota

THRESHOLD: HARD RULE items → always. All others: conf ≥ 75.
```
