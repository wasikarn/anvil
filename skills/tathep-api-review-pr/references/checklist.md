# 12-Point Review Checklist — tathep-platform-api

For ✅/❌ code examples → [examples.md](examples.md)

**Severity:** 🔴 Critical (must fix) · 🟡 Important (should fix) · 🔵 Suggestion
**Format:** `[#N Aspect] file:line — issue → fix`

## Correctness & Safety

| # | Aspect |
| --- | -------- |
| 1 | **Functional Correctness** |
| 2 | **App Helpers & Util Functions** |

### #1 Functional Correctness

- All AC requirements implemented — map each AC to specific code → 🔴
- Null/undefined handled before use (no NPE path) → 🔴
- Edge cases: empty array, boundary values, expired/inactive states → 🔴
- Error paths return typed errors (`Result<T>` with `success: false`), not undefined behavior → 🔴
- UseCase returns `this.success()`/`this.error()` — never throws unhandled → 🔴

### #2 App Helpers & Util Functions

- `Logger` from `App/Helpers/Logger` used — not `console.log` → 🔴
- `tryCatch()` from `App/Helpers/TryCatch` for external/IO calls — see `.claude/rules/conditional-logic.md` §4 for full decision tree → 🟡
- `DatabaseErrorUtil.isDuplicateKeyError(error)` for detecting duplicate key errors → 🟡
- `SafeDispatch` for BullMQ job dispatch — not raw `Bull.add` → 🟡
- Existing `ArrayHelper`, `StringHelper`, `DateTimeFrame`, `DateTimeParsing` used where applicable → 🟡

## Performance

| # | Aspect |
| --- | -------- |
| 3 | **Query Performance** |

### #3 Query Performance

- No query inside loop (N queries for N records) → 🔴
- `.preload('relation')` used for eager loading related models → 🔴
- `.whereHas()` or subquery used — never `.innerJoin()` → 🔴
- Independent async calls use `Promise.all([...])` not sequential `await` → 🟡
- Batch writes: `createMany()`/`updateOrCreateMany()` — not loop insert/update → 🟡
- Pagination on large tables: `.paginate()` or keyset — not unbounded `.all()` → 🟡
- Aggregates on DB side: `countDistinct()`/`sum()` — not `.all().length` or JS-side aggregation → 🟡
- Column selection: `.select(['col1', 'col2'])` on wide models when full row not needed → 🔵
- Complex JOINs in migrations: EXPLAIN ANALYZE evidence in PR description → 🔵

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

- Max 2 nesting levels (try/catch = level 0) — see `.claude/rules/conditional-logic.md` §1-2 → 🔴
- No nested ternaries (`a ? b ? c : d : e`) → 🔴
- No callback hell → use async/await → 🔴
- Use `continue` for loop filtering instead of nested `if` → 🟡
- Replace 4+ branch `if-else` chains with lookup object/map (see rule §5) → 🟡
- Extract complex conditional blocks into named booleans/functions (see rule §3) → 🟡

### #6 Small Function & SOLID

- Functions < 20 lines (ideally) → 🟡
- SRP: one function does one thing — no "and" in function names → 🟡
- **Controller**: thin — validate → execute UseCase → transform → respond (no business logic) → 🔴
- **UseCase**: all business logic + try/catch → `this.success()`/`this.error()` → 🔴
- **Repository**: data access only — no business logic, no JOINs → 🔴
- DI: `@inject([InjectPaths.X])` — depend on interfaces not implementations → 🔴
- Parameters ≤ 3 (use InputDTO if more) → 🟡

### #7 Elegance

- Code reads like prose — clear pipeline from input to output → 🟡
- Explicit > implicit (no clever tricks that obscure intent) → 🟡
- Consistent style throughout PR (matches `Sms/` gold standard) → 🟡
- No dead code (unreachable branches, unused variables) → 🟡

## Developer Experience

| # | Aspect |
| --- | -------- |
| 8 | **Clear Naming** |
| 9 | **Documentation** |
| 10 | **Type Safety** |
| 11 | **Testability** |
| 12 | **Debugging Friendly** |

### #8 Clear Naming

- Booleans: `is/has/can/should` prefix (`isActive`, `hasPermission`) → 🟡
- Functions: verb + noun (`getUserById`, `createSmsTestPhone`) → 🟡
- DTOs: `{Op}{Resource}InputDTO` with `readonly` fields → 🟡
- Arrays: plural (`users`, not `userList`) → 🟡
- No abbreviations (`usr`, `btn`, `cfg`, `mgr`) → 🟡

### #9 Documentation

- Comments explain WHY, not WHAT (WHAT is readable from code) → 🔵
- No obvious comments (`// increment i`) → 🔵
- Complex regex/algorithms have explanatory comments → 🔵
- TODO linked to Jira ticket (`// TODO BEP-XXXX: ...`) → 🔵

### #10 Type Safety

- No `as any` / `as unknown as T` → 🔴
- No `!` non-null assertion without prior null check → 🔴
- Discriminated unions for states (not boolean flags) → 🟡
- Type guards for external API data → 🟡
- `satisfies` operator for type-checked constants — `const T = {...} satisfies Record<K, V>` over `as` → 🟡
- Tests: `createStubObj<IMyRepo>({ method: sinon.stub() })` — typed mocks, not `{} as any` → 🔴

### #11 Testability

- Changed files have test coverage → 🔴
- Dependencies injectable via constructor — not hardcoded `new Service()` → 🔴
- Pure functions preferred — no hidden side effects → 🟡
- `createStubObj<IInterface>()` + `fromPartial<T>()` pattern used → 🔴
- `Database.beginGlobalTransaction()` / `rollbackGlobalTransaction()` + `sinon.restore()` in tests → 🔴

### #12 Debugging Friendly

- Errors include context — what failed, what data → 🟡
- No swallowed errors (`catch {}` or `catch { /* ignored */ }`) → 🔴
- `Logger.error({ error, location: 'Class.method', ...context }, 'descriptive message')` → 🟡
- No silent failures (all promise rejections handled) → 🔴
- Custom exception types distinguish error categories → 🟡

## tathep-platform-api Specific Checks

Always verify:

- [ ] **Forbidden patterns absent**: `as any`, `as unknown as T`, `throw new Error`, `new MyService()`, string InjectPaths `'App/Services/X'`, `.innerJoin()`, empty `catch {}`
- [ ] **DI correct**: `@inject([InjectPaths.X])` · InjectPaths use `'IClassName'` format · import from `@adonisjs/fold`
- [ ] **Provider imports**: via `ModulePaths.ts` relative paths — not global `'App/...'` strings
- [ ] **Query style**: `subquery` or `whereHas` — never `JOIN`
- [ ] **SQL performance**: batch ops (`createMany`/`updateOrCreateMany`) · paginated results for unbounded datasets · indexed WHERE/ORDER BY columns
- [ ] **Error handling**: `XxxModuleException.staticMethod()` factory — not `throw new Error()`
- [ ] **Effect-TS**: `Option.fromNullable` for nullable; `Effect.pipe` for composition; `TryCatch` for external calls
- [ ] **Test isolation**: `Database.beginGlobalTransaction()` / `rollbackGlobalTransaction()` + `sinon.restore()`
- [ ] **Test type safety**: `createStubObj<IMyRepo>({ method: sinon.stub() })` — typed mocks
- [ ] **New Job files**: registered in `start/jobs.ts`
- [ ] **Security**: Input via Validator · no PII in logs · auth middleware correct
- [ ] **Reference module**: `Sms/` for gold standard patterns, `Questionnaire/` for simple module patterns

## Jira Ticket → Layer Mapping

| Layer |
| ------- |
| Route |
| Controller |
| UseCase |
| Repository |
| Validator |
| Test |

## Positive Signals

Look for these patterns when identifying Strengths:

- DI via `@inject([InjectPaths.X])` used correctly
- `XxxException.staticMethod()` factory for typed errors
- `createStubObj<IInterface>()` in tests — typed mocks
- Effect-TS `pipe` / `Effect.gen` composition clean and readable
- Code matches `Sms/` gold standard module patterns
- `Database.beginGlobalTransaction()` / `rollbackGlobalTransaction()` test isolation
