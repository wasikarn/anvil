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
- `tryCatch()` from `App/Helpers/TryCatch` for controller-level external calls → 🟡
- `DatabaseErrorUtil.isDuplicateKeyError(error)` for detecting duplicate key errors → 🟡
- `SafeDispatch` for BullMQ job dispatch — not raw `Bull.add` → 🟡
- Existing `ArrayHelper`, `StringHelper`, `DateTimeFrame`, `DateTimeParsing` used where applicable → 🟡

## Performance

| # | Aspect |
| --- | -------- |
| 3 | **N+1 Prevention** |

### #3 N+1 Prevention

- No query inside loop (N queries for N records) → 🔴
- `.preload('relation')` used for eager loading related models → 🔴
- `.whereHas()` or subquery used — never `.innerJoin()` → 🔴
- Independent async calls use `Promise.all([...])` not sequential `await` → 🟡

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
