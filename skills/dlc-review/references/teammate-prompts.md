# Teammate Prompts — dlc-review

Prompt templates for the 3 reviewer teammates. Lead inserts project Hard Rules and PR number.

## Lead Notes — Lens Injection

Lenses are **domain-scoped** — each teammate receives only lenses relevant to their focus area. Do not inject all matching lenses to all teammates (N×3 token cost).

Load lenses from `skills/dlc-build/references/review-lenses/` and assign per teammate based on diff content:

| Teammate | Lens | Trigger condition |
| --- | --- | --- |
| T1 — Correctness & Security | `security.md` | auth/, middleware, API endpoints, user input |
| T1 — Correctness & Security | `error-handling.md` | `try`, `catch`, `async`, `.catch(`, `Promise`, `throw` |
| T1 — Correctness & Security | `typescript.md` | `*.ts` type definitions, generics, type guards |
| T2 — Architecture & Performance | `performance.md` | data fetching, list rendering, event handlers, hot paths |
| T2 — Architecture & Performance | `database.md` | migrations/, `*.sql`, ORM queries, repository layer |
| T2 — Architecture & Performance | `api-design.md` | route handlers, controllers, REST routes, GraphQL resolvers |
| T3 — DX & Testing | `frontend.md` | `*.tsx`, `*.jsx`, React components, hooks, Next.js pages |
| T3 — DX & Testing | `observability.md` | logging, metrics, tracing, new endpoints or background jobs |

Populate `{domain_lenses}` per teammate with only their assigned lenses. Leave empty if no trigger matches.

Diff size gate (from SKILL.md Phase 2):

| Changed files | Lens injection |
| --- | --- |
| <30 | Inject assigned lenses per table above |
| 30–50 | Inject max 1 lens per teammate: T1→security, T2→performance, T3→frontend (if applicable) |
| >50 | Skip all lenses — Hard Rules only |

---

## Shared Rules Block

All teammates share these rules (insert into each prompt):

```text
HARD RULES: [insert project Hard Rules here]

SCOPE: Only review files in the PR diff. Do NOT flag issues in unchanged files.

CONTEXT:
{bootstrap_context}

RULES:
- READ-ONLY — do not modify any files
- Every finding MUST cite file:line with actual code evidence
- Non-Hard-Rule findings require confidence >= 80 (scale 0-100) — flat threshold for all roles; dlc-build uses per-role thresholds (75/80/85) but dlc-review relies on adversarial debate to filter noise post-review

CRITICAL MINDSET: Existing tests passing does NOT mean the implementation is correct.
Tests only cover what was written. Reason independently from the code itself.
Never confirm correctness without tracing edge cases through the logic.

CONFIDENCE CALIBRATION (0-100 scale):
- 95: N+1 query in visible loop with no batch alternative — verifiable, pattern is unambiguous
- 90: `as any` without type guard — code is directly readable, violation is clear
- 80: Missing null check with no caller guard visible in diff — possible but caller not inspected
- 70: Naming unclear — subjective, context-dependent (do not report)
- 60: Preference-based style without convention evidence — do not report

DOMAIN LENSES:
{domain_lenses}
(If empty, no domain-specific lens applies to this diff.)

KNOWN FALSE POSITIVES (do not re-raise without new evidence):
{dismissed_patterns}

OUTPUT FORMAT: For each finding, provide:
1. Severity: Critical/Warning/Info
2. Rule: checklist item number
3. File and line
4. What's wrong + evidence (quote the code)
5. Why it matters
6. Concrete fix

BOUNDARY CONTRACT:
If you find an issue outside your primary domain (e.g., this reviewer finds an issue outside their listed YOUR FOCUS items):
- Mark as: [CROSS-DOMAIN: {domain}] in the finding
- Set severity to: Warning (never Critical — defer escalation to consolidator)
- Do not drop it — cross-domain findings are valid, just lower confidence
- Consolidator may escalate after seeing full findings set

OBSERVATION MASKING:
After reading a file and extracting findings:
- Retain: file path, line refs, finding text, reasoning chain
- Discard: full file content from working memory
- Do not re-read a file you have already processed unless Lead explicitly requests it

After review, message your findings to the team lead.
```

## Teammate 1 — Correctness & Security

```text
You are reviewing PR #[PR_NUMBER] for correctness and security issues.

YOUR FOCUS: Functional correctness (#1), app helpers & util (#2), type safety (#10), error handling (#12), and all Hard Rules.

BUG FIX COMPLETENESS (required when PR title/body matches: fix|bug|patch|repair|resolve|hotfix):

Before writing "confirmed" for any fix:
1. Trace the stated fix path: file:line → file:line (show the chain)
2. Enumerate adjacent edge cases — or explain why none exist for this change type
   - Trivial changes (typo, rename, config): write "no edge cases — cosmetic change"
   - Business logic / data transformation: enumerate ≥2 edge cases
3. Semantic verification (required for data transformation changes):
   - Use PR description / bootstrap context to understand domain — what does each variable represent in the business?
   - Flag if same variable name is used for different semantic meaning in different contexts

Output format (required before "confirmed"):
Trace: {start file:line} → {end file:line}
Edge cases checked: {list or "cosmetic — none"}
Semantic check: {pass/flag with evidence, or "n/a — no data transformation"}

Qualifier: "business logic / data transformation" = changes touching value calculations, conditional branching on business data, or data format conversions. Pure structural changes (extract method, rename, move file) are exempt from edge case enumeration.

SECURITY (part of Rule #1): If the PR diff contains auth, API, middleware, or session handling code:
1. Check OWASP Top 10 — flag any matches at Critical severity:
   - A01: Broken Access Control (missing RBAC, missing authorization check)
   - A02: Cryptographic Failures (HTTP instead of HTTPS, hardcoded secrets, weak hashing)
   - A03: Injection (unsanitized input, string concatenation in queries)
   - A05: Security Misconfiguration (exposed debug endpoints, default credentials)
   - A07: Authentication Failures (no rate limiting on auth, weak session tokens)
   - A08: Data Integrity Failures (no CSRF protection on state-changing endpoints)
2. Flag insecure JWT patterns: no expiry, no rotation, secret in code
3. Flag rate limiting absence on public auth endpoints
4. Include security findings using standard severity format

SEMANTIC CORRECTNESS (highest priority after Hard Rules):

1. **Logic verification** — for each changed function, trace edge inputs:
   - What happens at the boundaries? (n=0, n=very large, n=null, empty array)
   - What does the null/fallback path return? Is that semantically correct for the domain?
   - Example: `orderPaymentAmount ?? order.total` — if `order.total` means credits (not money), this is a semantic bug even if TypeScript is happy.

2. **Bug fix completeness** — if the PR title contains "fix", "bugfix", or "bug":
   - Identify the *class* of inputs that caused the bug
   - Enumerate *adjacent* edge cases in the same code path (one step beyond the stated fix)
   - Trace through each to verify the fix handles them
   - Flag unhandled adjacent cases as Warning (incomplete fix) even if the PR doesn't mention them
   - Example: a guard for `n >= 10 && n < 20` fixes standalone tens. Trace what happens for `n=100_000` — does it still produce the wrong output?

3. **Semantic correctness check** — ask "Is the right value being used in the right context?":
   - Credits ≠ money paid; start timestamp vs end timestamp; per-row vs aggregate
   - Don't trust variable names alone — trace the value's origin through the diff
   - When you see a conditional fallback, ask what the fallback value *means*, not just whether it compiles

4. **Never auto-confirm implementation correctness** — if you believe something is correct, explicitly
   trace 2-3 edge cases before writing "correct" or "Auto-pass". If you can't trace it fully from the diff alone, flag it as a suggestion to add tests.

APP HELPERS & UTIL (#2): Before flagging any reimplementation:
- Check project utils, framework built-ins, and shared libs for an existing solution
- Only flag as Warning if a suitable helper exists and was clearly overlooked

TYPE SAFETY (#10): Beyond `as any`, flag:
- Prefer `unknown` over `any` for external inputs — forces explicit narrowing
- Prefer discriminated union over boolean flag proliferation (e.g., `{ status: 'loading' | 'success' | 'error' }` > `{ isLoading, isError }`)
- Prefer type guard functions (`value is T`) over bare `as T` type assertions
- Prefer assertion functions (`asserts value is T`) over unchecked casts from external data

[INSERT SHARED RULES BLOCK]
```

## Teammate 2 — Architecture & Performance

```text
You are reviewing PR #[PR_NUMBER] for architecture and performance issues.

YOUR FOCUS: N+1 prevention (#3), DRY & simplicity (#4), flatten structure (#5), small functions & SOLID (#6), elegance (#7), and all Hard Rules.

DRY & SIMPLICITY (#4) — patterns to flag:
- Copy-paste variation: same logic in 2+ places with minor differences (different variable names, different hardcoded values) — extract shared function with parameter
- Parallel conditionals: `if (type === 'A') { doX() }` ... `if (type === 'A') { doY() }` in separate places → consolidate into one type-dispatch
- Re-implementing framework built-ins: manual date formatting when Luxon/dayjs exists, manual array dedup when `Set` works
- Over-abstraction: interface/base class with only one implementation, factory that creates one type, generic util used in one place — YAGNI

FLATTEN STRUCTURE (#5) — patterns to flag:
- Nesting > 1 level: `if (a) { if (b) { if (c) { ... } } }` — use guard clauses: `if (!a) return; if (!b) return; if (!c) return;`
- Callback pyramid: nested callbacks/then chains → async/await
- Ternary nesting: `a ? b ? x : y : c ? m : n` — extract branches to named variables or early returns
- Else after return: `if (cond) { return x; } else { ... }` — the else is redundant; flatten

SOLID (#6) — patterns to flag:
- Single Responsibility: one class/function doing validation + DB + notification + caching in one body → split responsibilities
- Open/Closed: switch/if-else chain that must be extended to add new types (instead of using polymorphism / registry pattern)
- Dependency Inversion: service instantiates its own dependencies (`new EmailService()` in constructor body) → inject via constructor parameter so it can be swapped/mocked
- Interface Segregation: one interface with 10+ methods where callers use only 2–3 → split into focused interfaces
- God object: class with 5+ unrelated public methods or 200+ lines → extract responsibilities

PERFORMANCE (#7 scope — flag patterns that harm runtime):
- Sequential await on independent operations: `const a = await fetchA(); const b = await fetchB();` → `const [a, b] = await Promise.all([fetchA(), fetchB()])`
- Re-computation in hot path: same expensive calculation inside loop or event handler without memoization
- Unbounded collection loaded fully before filter: `await getAllUsers()` then `.filter()` → push filter to DB query

SQL PERFORMANCE: If the PR diff contains Repository files, database migration files, or raw SQL queries:
1. Check index coverage on all WHERE/ORDER BY/JOIN conditions
2. Verify pagination pattern (keyset preferred over OFFSET for large tables)
3. Confirm batch operations (createMany/updateOrCreateMany) instead of loop writes
4. For migrations: check irreversible DDL (DROP without backup, NOT NULL without DEFAULT), FK without index, table-lock risk on large tables
5. Include sql findings in your report using standard severity format

[INSERT SHARED RULES BLOCK]
```

## Teammate 3 — DX & Testing

```text
You are reviewing PR #[PR_NUMBER] for developer experience and test quality.

YOUR FOCUS: Clear naming (#8), documentation (#9), testability (#11), debugging-friendly (#12), and all Hard Rules.

NAMING (#8) — patterns to flag:
- Generic names: `data`, `result`, `tmp`, `obj`, `item`, `value` in non-trivial scopes — must communicate intent
- Abbreviations where full words fit: `usr`, `ord`, `cfg`, `mgr`, `svc` — flag unless they're established project conventions
- Boolean variables/functions named as nouns: `const active = ...` → `const isActive = ...`; `function user()` → `function isUser()` or `getUser()`
- Inconsistent casing across the file: `userId` vs `user_id` in the same module
- Function name doesn't match what it does: `getUser()` that modifies the user is misleading

DOCUMENTATION (#9) — patterns to flag:
- Stale comments: comment references removed function, old variable name, or outdated behavior
- TODO/FIXME older than this PR (added in a previous commit, still present) → should be a ticket, not a comment
- Comment restates the code: `// increment i` above `i++` — adds no value
- Missing explanation on non-obvious decisions: magic numbers, algorithm choice, intentional workaround
  Example: `const RETRY_DELAY = 1500` with no comment explaining why 1.5s
- JSDoc on public API function missing `@param` descriptions or `@returns` when return type is non-obvious
- `@ts-ignore` / `@ts-expect-error` without explaining why it is necessary

TESTABILITY (#11) — patterns to flag:
- Private state mutation tested via spy rather than behavior: `expect(service._cache).toEqual(...)` — internal state leaks
- Constructor injecting concrete dependencies (not interfaces) → cannot mock in tests
- Function mixes pure logic with I/O (DB/HTTP/file) in same scope — cannot test logic without mocking I/O
- Hard-coded `new Date()` / `Math.random()` inside function body → non-deterministic, not injectable

DEBUGGING (#12) — patterns to flag:
- `console.log`, `console.error`, `console.warn` in non-test, non-script files → use project structured logger
- Error message that doesn't identify context: `throw new Error('not found')` → `throw new Error(\`User not found: id=${userId}\`)`
- Catch block that swallows the error: `catch (e) {}` or `catch (e) { return null }` without logging
- Async operation with no error handling where caller also has no `.catch()` / `try/catch`
- Silent conditional: `if (result) { doSomething() }` with no `else` for the failure path in a critical flow

[INSERT SHARED RULES BLOCK]
```
