# 12-Point Review Checklist — tathep-video-processing

For ✅/❌ code examples → [examples.md](examples.md)

**Severity:** 🔴 Critical (must fix) · 🟡 Important (should fix) · 🔵 Suggestion
**Format:** `[#N Aspect] file:line — issue → fix`

## Correctness & Safety

| # | Aspect |
| --- | -------- |
| 1 | **Functional Correctness** |
| 2 | **Error Handling & Patterns** |

### #1 Functional Correctness

- All AC requirements implemented — map each AC to specific code → 🔴
- Null/undefined handled before use (no TypeError path) → 🔴
- Edge cases: empty array, invalid video format, missing metadata, expired jobs → 🔴
- State transitions follow state machine (pending → processing → completed/failed) → 🔴
- Idempotency: inbox pattern checks prevent duplicate event processing → 🔴

### #2 Error Handling & Patterns

- `rethrowOrWrapError()` from `@/utils/error-handling` for Promise chains → 🔴
- `createErrorHandler()` for reusable error handlers → 🟡
- Domain exceptions: `VideoProcessingError.transient()` / `.permanent()` — not generic `Error()` → 🔴
- Rich errors: `ProcessingError.fromCode(ErrorCodes.XXX)` with metadata → 🟡
- Error categories correct: network (retryable), validation (not), processing (not), timeout (retryable) → 🟡
- `LoggerFactory.getLogger()` from `@/infrastructure/telemetry/LoggerFactory` — not `console.log` → 🔴

## Performance

| # | Aspect |
| --- | -------- |
| 3 | **N+1 Prevention** |

### #3 N+1 Prevention

- No query inside loop (N queries for N records) → 🔴
- Batch INSERT/UPDATE instead of loop → 🔴
- SQL aggregates (COUNT, SUM) instead of in-memory counting → 🟡
- Independent async operations use `Promise.all([...])` — not sequential `await` → 🟡
- Query count documented in JSDoc for complex operations → 🔵

## Maintainability

| # | Aspect |
| --- | -------- |
| 4 | **DRY & Simplicity** |
| 5 | **Flatten Structure** |
| 6 | **Small Function & SOLID** |
| 7 | **Elegance** |

### #4 DRY & Simplicity

- 3+ identical code blocks → extract to function/constant → 🟡
- No redundant conditions (`if (x === true)` → `if (x)`) → 🟡
- No premature abstraction for single-use logic → 🟡
- Simplest correct solution — no over-engineering → 🟡

### #5 Flatten Structure

- Max 1 nesting level — use early returns for all guard clauses → 🔴
- No nested ternaries (`a ? b ? c : d : e`) → 🔴
- No callback hell → use async/await → 🔴
- Use `continue` for filtering in loops → 🟡
- Replace 4+ branch `if-else` chains with lookup object/map → 🟡
- Extract complex conditional blocks into named functions → 🟡

### #6 Small Function & SOLID

- Functions < 20 lines (ideally) → 🟡
- SRP: one function does one thing → 🟡
- **Domain entity**: business rules + invariants only — no external deps → 🔴
- **Application handler**: orchestration + use case flow — delegates to domain/infra → 🔴
- **Infrastructure adapter**: external service integration only — no business logic → 🔴
- Strategy pattern for state handling → 🟡
- Parameters ≤ 3 (use interface/type if more) → 🟡

### #7 Elegance

- Code reads like prose — clear pipeline from input to output → 🟡
- Explicit > implicit (no clever tricks that obscure intent) → 🟡
- Consistent style throughout PR → 🟡
- No dead code (unreachable branches, unused variables, unused imports) → 🟡

## Developer Experience

| # | Aspect |
| --- | -------- |
| 8 | **Clear Naming** |
| 9 | **Documentation** |
| 10 | **Type Safety** |
| 11 | **Testability** |
| 12 | **Debugging Friendly** |

### #8 Clear Naming

- Booleans: `is/has/can/should` prefix (`isRetryable`, `hasCompleted`) → 🟡
- Functions: verb + noun (`processVideo`, `createJobOutput`) → 🟡
- Constants: UPPER_SNAKE (`MAX_RETRIES`, `RETRY_DELAYS`) → 🟡
- Enums: PascalCase (`VideoProcessingState`, `AspectRatio`, `ErrorType`) → 🟡
- Path aliases: `@/` for `src/`, `@tests/` for `tests/` → 🟡
- No abbreviations (`vid`, `proc`, `cfg`) → 🟡

### #9 Documentation

- Comments explain WHY, not WHAT (WHAT is readable from code) → 🔵
- No obvious comments → 🔵
- JSDoc for N+1-prone operations documenting query count → 🔵
- TODO linked to Jira ticket (`// TODO BEP-XXXX: ...`) → 🔵

### #10 Type Safety

- No `any` type → 🔴
- Branded types for domain IDs (`VideoId`, `JobId`) → 🟡
- Centralized types in `src/types/` → 🟡
- Zod schemas for runtime validation at boundaries → 🟡
- Discriminated unions for states (not boolean flags) → 🟡
- Type guards from `@/utils/type-guards` for narrowing → 🟡
- `satisfies` operator for type-checked constants → 🟡

### #11 Testability

- Changed files have test coverage (85% threshold) → 🔴
- AAA pattern (Arrange-Act-Assert) in all tests → 🟡
- Mock external dependencies — no real API/DB calls in unit tests → 🔴
- `vi.mock()` + `vi.fn()` + `vi.clearAllMocks()` pattern → 🔴
- SQLite in-memory for DB tests (auto-configured by test context) → 🟡
- Integration tests run sequentially (single worker) → 🟡
- Use `bun run test` — NEVER `bun test` → 🔴

### #12 Debugging Friendly

- Structured logging via `LoggerFactory.getLogger({ context: 'handler-name' })` → 🟡
- Correlation ID propagated through pipeline → 🟡
- No swallowed errors (all async errors handled) → 🔴
- Error includes context — what failed, what data, what error code → 🟡
- Error category correct (transient vs permanent) for retry decisions → 🟡

## DDD Architecture Checks (#13)

> Clean Architecture: Domain → Application → Infrastructure → Presentation

**Domain Layer (`src/domain/`):**

- Zero external dependencies (no imports from infrastructure, application, or node_modules except types) → 🔴
- Entities enforce business invariants → 🟡
- Value objects are immutable → 🟡
- Domain exceptions only (`VideoProcessingError`) → 🔴
- Interfaces (ports) defined in `src/domain/interfaces/` → 🟡

**Application Layer (`src/application/`):**

- Handlers orchestrate domain + infrastructure — no direct DB/HTTP calls → 🔴
- Commands/queries as typed objects → 🟡
- No domain logic in handlers (delegate to entities) → 🟡

**Infrastructure Layer (`src/infrastructure/`):**

- Adapters implement domain interfaces (ports) → 🔴
- Circuit breaker for external services (DB, Redis) → 🟡
- Connection pooling configured (5 min, 20 max) → 🟡

**Presentation Layer (`src/presentation/`):**

- HTTP routes, workers, consumers — thin wrappers only → 🟡
- Middleware handles cross-cutting concerns (auth, logging, correlation) → 🟡

## tathep-video-processing Specific Checks

Always verify:

- [ ] **Forbidden patterns absent**: `any` type, `.forEach()`, raw `try-catch`, generic `Error()`, `biome-ignore`, `console.log`, `--no-verify`
- [ ] **DDD boundaries**: domain has no external imports, infrastructure implements domain ports
- [ ] **Error handling**: `rethrowOrWrapError()` for Promise chains, domain exceptions for business errors
- [ ] **State machine**: job transitions follow valid paths (pending → processing → completed/failed/retrying)
- [ ] **Idempotency**: inbox pattern used for event deduplication
- [ ] **Effect-TS**: `Effect.gen` for complex async, `Layer` for DI, no raw Promise where Effect fits
- [ ] **Drizzle**: type-safe queries only — no raw SQL strings
- [ ] **Path aliases**: `@/` prefix for all `src/` imports, `@tests/` for test imports
- [ ] **Logging**: `LoggerFactory.getLogger()` with structured context and correlation ID
- [ ] **Testing**: 85% coverage, AAA pattern, `bun run test` (not `bun test`)
- [ ] **Security**: no secrets in code, no PII in logs, auth middleware on protected routes
- [ ] **Service scope**: changes clearly scoped to one of 3 services (server/consumer/worker)

## Jira Ticket → Layer Mapping

| Layer |
| ------- |
| Domain Entity |
| Domain Interface (Port) |
| Application Handler |
| Infrastructure Adapter |
| Presentation Route/Worker/Consumer |
| Test |

## Positive Signals

Look for these patterns when identifying Strengths:

- Domain layer has zero external dependencies (DDD boundary)
- Domain exceptions use `transient()` / `permanent()` classification
- `rethrowOrWrapError()` or `createErrorHandler()` for error handling
- Drizzle queries are type-safe with proper schema types
- `LoggerFactory.getLogger()` used for structured logging
- 85%+ test coverage maintained on changed files
