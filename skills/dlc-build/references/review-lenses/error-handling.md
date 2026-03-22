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

WARNING (confidence ≥ 75):
- Silent fallback: catch returns default value (`return []`, `return null`) without
  comment explaining why swallowing is safe — misleads callers into thinking
  operation succeeded
- Catch-all without discrimination: `catch (e: unknown)` in critical path with no
  `instanceof` check — catches programmer errors alongside runtime errors
- Log-without-rethrow at library/service boundary: external call fails, error is
  logged, function returns normally — upstream has no way to know the call failed
- `finally` block that discards exception: `finally { return value; }` swallows
  any error thrown from the try/catch block

THRESHOLD: HARD RULE items → always. All others: conf ≥ 75.
```
