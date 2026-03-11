# 12-Point Review Checklist — tathep-admin

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
- `result.isOk` checked before accessing `result.data` → 🔴
- Null/undefined handled before use → 🔴
- Edge cases: empty array, expired state, missing optional fields → 🔴
- Error paths show user-facing feedback (toast, alert) — not silent → 🔴

### #2 App Helpers & Util Functions

- `QUERY_KEYS` constant used — no inline query key strings → 🔴
- `ROUTE_PATHS` used — no hardcoded `/manage/...` or `/ad/...` strings → 🔴
- `ObjectUtil.mapKeysToCamelCase/SnakeCase` used — no manual key mapping → 🟡
- `appConfig.*` used — not `process.env.*` directly → 🟡
- Existing service singletons used (`adServiceV2`, `adService`) — not `new AdService()` → 🔴
- Existing shared hooks used (`usePersistFilters`, `useQueryState`) where applicable → 🟡
- `*_STATUS_TEXT` / `*_STATUS_OPTIONS` constants used — no hardcoded Thai status strings → 🔴

## Performance

| # | Aspect |
| --- | -------- |
| 3 | **N+1 Prevention** |

### #3 N+1 Prevention

- Independent fetches use `Promise.all([...])` — no sequential `await` → 🔴
- `includes=` param used for server-side eager loading of relations → 🟡
- No query/fetch inside loop → 🔴
- `getServerSideProps`/`getStaticProps` fetches all needed data in one pass → 🟡

## Maintainability

| # | Aspect |
| --- | -------- |
| 4 | **DRY & Simplicity** |
| 5 | **Flatten Structure** |
| 6 | **Small Function & SOLID** |
| 7 | **Elegance** |

### #4 DRY & Simplicity

- 3+ identical JSX blocks or logic → extract to component/hook/constant → 🟡
- No redundant conditions (`if (x === true)` → `if (x)`) → 🟡
- Derive state — no `useEffect` just to sync computed values → 🟡
- No premature abstraction for single-use logic → 🟡

### #5 Flatten Structure

- Max 1 nesting level — use early returns for all guard clauses → 🔴
- No nested ternaries (`a ? b ? c : d : e`) → 🔴
- No callback hell → use async/await → 🔴
- Use `continue` for loop filtering instead of nested `if` → 🟡
- Replace 4+ branch `if-else` chains with lookup object/map → 🟡
- Extract complex conditional blocks into named functions → 🟡

### #6 Small Function & SOLID

- Functions/components < 20 lines (ideally) → 🟡
- SRP: one function does one thing — no "and" in function names → 🟡
- **Page** (`*.page.tsx`): thin wrapper only — defines `getLayout`, renders PageContent → 🔴
- **PageContent**: data fetching + orchestration, no raw service calls in page files → 🔴
- **Component**: presentation only — receives props, no business logic → 🟡
- Parameters ≤ 3 (use props object if more) → 🟡
- No boolean prop proliferation (`isEditing`, `isModal`, `isCompact`) — use explicit variant components instead → 🟡

### #7 Elegance

- Code reads like prose — clear data flow → 🟡
- Explicit > implicit (no clever tricks) → 🟡
- Consistent style throughout PR → 🟡
- No dead code (unreachable branches, unused variables) → 🟡
- Derive state with `useMemo` — no `useEffect` + `setState` for computed values → 🟡

## Developer Experience

| # | Aspect |
| --- | -------- |
| 8 | **Clear Naming** |
| 9 | **Documentation** |
| 10 | **Type Safety** |
| 11 | **Testability** |
| 12 | **Debugging Friendly** |

### #8 Clear Naming

- Booleans: `is/has/can/should` prefix (`isLoading`, `hasError`) → 🟡
- Event handlers: `handle` prefix (`handleSubmit`, `handleDelete`) → 🟡
- Query hooks: `$` prefix (`$ads`, `$billboards`) → 🟡
- Arrays: plural (`ads`, not `adList`) → 🟡
- No abbreviations (`btn`, `cfg`, `mgr`) → 🟡

### #9 Documentation

- Comments explain WHY, not WHAT → 🔵
- Non-obvious behavior documented (e.g., why `keepPreviousData: false` on filter change) → 🔵
- No obvious comments → 🔵
- TODO linked to Jira ticket (`// TODO BEP-XXXX: ...`) → 🔵

### #10 Type Safety

- No `as any` / `as unknown as T` → 🔴
- No `!` non-null assertion without prior null check → 🔴
- `result.isOk` checked before accessing `result.data` → 🔴
- Discriminated unions for form/UI states (not boolean flags) → 🟡
- Type guards for external API responses before use → 🟡
- `satisfies` operator for type-checked constants — `const T = {...} satisfies Record<K, V>` over `as` → 🟡

### #11 Testability

- Mapper functions are pure — unit-testable with Vitest → 🔴
- Changed mapper/util files have corresponding `.test.ts` files → 🔴
- `vi.mock()` + `vi.fn()` + `vi.clearAllMocks()` pattern used → 🔴
- No side effects mixed into pure mapping/utility functions → 🟡

### #12 Debugging Friendly

- `result.isOk` always checked — no silent data access on failed response → 🔴
- Errors shown to user via toast/alert — not swallowed silently → 🔴
- `console.error('[ModuleName] message:', error)` for dev-time errors → 🟡
- No unreturned promises (unhandled rejections) → 🔴

## React/Next.js Performance (#13)

> Pages Router project — App Router patterns (RSC, `React.cache()`, Server Components) do NOT apply.

**[next-best-practices] Rendering & Data Fetching:**

- `getStaticProps` for data that doesn't change per-request · `getServerSideProps` only when truly dynamic
- No async waterfall — fetch in parallel: `Promise.all([fetchA(), fetchB()])`
- `next/image` for all `<img>` tags — required `width`/`height` or `fill` · allowed domains: `upslip.sgp1.digitaloceanspaces.com`, `ui-avatars.com`, `placehold.co`
- `next/link` for all internal navigation — no `<a href="...">` for client-side routes
- `next/dynamic` for heavy components (charts, editors, modals with heavy deps) with `{ ssr: false }` if needed

**[vercel-react-best-practices] React Performance:**

- No inline object/array in JSX: `<Comp style={{ color: 'red' }} />` → extract to constant or `useMemo`
- No inline function passed as prop to memoized children: `<Comp onClick={() => fn(id)} />` → `useCallback`
- `useMemo` only for expensive computations (not as default) · don't memoize primitives
- Stable list keys — never use array index for dynamic/reorderable lists
- Avoid unnecessary `useEffect` — derive state instead of syncing it
- Split contexts by update frequency: fast-changing values in separate context from slow ones
- `React.memo` for pure components that receive same props frequently
- `useRef` for values that should NOT trigger re-render (timers, DOM refs, prev values)
- Functional setState when update depends on prev: `setState(curr => [...curr, item])` not `setState([...items, item])` → 🟡
- Lazy initial state for expensive computations: `useState(() => computeHeavy())` not `useState(computeHeavy())` → 🟡

**Bundle Optimization:**

- No barrel imports that pull large unused modules
- Heavy third-party libs via `next/dynamic` — not top-level import
- No `console.log` in production code

## tathep-admin Specific Checks

Always verify:

- [ ] Mapper consumers consistent after type changes (`grep -r "mapFnName" src/`)
- [ ] `getLayout` pattern used for page layouts
- [ ] `ROUTE_PATHS` used — no hardcoded `/manage/...`
- [ ] No hardcoded Thai status text — use `*_STATUS_TEXT` or `REFERRAL_HISTORY_STATUS_TEXT` constants
- [ ] `*.page.tsx` naming for all page files
- [ ] OFetch used for HTTP (not Axios unless upload with progress)
- [ ] `keepPreviousData` disabled when filter params change
- [ ] `npm run lint@fix` (uses `@` not `:`) for linting
- [ ] v1/v2 modules: `ad` (v1) and `adV2` — do not mix
- [ ] Remote images only from: `upslip.sgp1.digitaloceanspaces.com`, `ui-avatars.com`, `placehold.co`

## Positive Signals

Look for these patterns when identifying Strengths:

- `*_STATUS_TEXT` constants used instead of hardcoded Thai text
- Headless UI components follow project patterns
- Vitest coverage meets threshold
- `ROUTE_PATHS` used for route strings
- Tailwind utility classes consistent with project conventions
- Mapper functions pure and testable
