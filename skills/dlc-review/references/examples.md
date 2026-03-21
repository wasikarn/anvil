# dlc-review — Output Quality Examples

Examples of what high-quality vs low-quality **review output** looks like.
For code pattern examples (what each rule flags), see [`../../../references/review-examples.md`](../../../references/review-examples.md).

---

## Finding Quality

A good finding has: file:line, what's wrong (with quoted code), why it matters, and a concrete fix.

### ✅ Good finding — all fields, actionable fix

```markdown
| 1 | 🔴 | #12 | `src/payments/payment.service.ts` | 78 | 3/3 |
`catch (e) {}` at line 78 swallows Stripe errors silently —
failed charges appear as successes to callers at `orders.service.ts:45`.
**Fix:** `logger.error('Stripe charge failed', { error: e }); throw e;`
```

```markdown
| 2 | 🟡 | #3 | `src/orders/orders.service.ts` | 102 | 2/3 |
`User.find(order.userId)` called inside `for (const order of orders)` loop —
up to 500 queries for a full orders list.
**Fix:** Add `.preload('user')` to the query above the loop.
```

```markdown
| 3 | 🔵 | #8 | `src/utils/date.ts` | 12 | 3/3 |
`d` is ambiguous — not clear from surrounding context whether it is
a date object or a count of days.
**Fix:** Rename to `daysUntilExpiry` to match the surrounding comment.
```

### ❌ Bad finding — vague, no location, no fix

```markdown
| 1 | 🔴 | Bad error handling |
| 2 | 🟡 | Performance issue in orders |
| 3 | 🔵 | Variable name is unclear |
```

---

## Debate Quality

### ✅ Good challenge — evidence-backed, cites file:line

```markdown
**Teammate 2 challenges Teammate 1's finding #4 (🔴 — missing null check on user.profile):**

"Inspected `app/models/user.ts:34` — `profile` relation is declared as
`@hasOne(() => Profile)` with no `nullable()` option, meaning TypeScript treats
it as non-optional. No nullable assignment found via grep. The crash may only
occur for pre-migration users (pre-2024) — but that is a data migration gap,
not a code bug. Recommend DOWNGRADE to 🟡 Warning with a note to check migration coverage."

Teammate 1 accepts. Finding downgraded to Warning.
```

### ❌ Bad challenge — opinion without evidence

```markdown
**Teammate 2: "I don't think finding #4 is that important, it probably won't happen."**
**Teammate 1: "OK I'll drop it."**
```

---

## Debate Summary Table

### ✅ Good — clear outcome with reasoning per finding

```markdown
## Debate Summary

(3 findings rejected by Falsification Pass)

| Finding | Raised By | Challenged By | Outcome |
| --- | --- | --- | --- |
| Empty catch in payment.service.ts:78 | T1 | — | Consensus 3/3 — Critical sustained |
| N+1 in orders.service.ts:102 | T2 | T3 | T3 agreed after reading loop. Warning sustained |
| user.profile nullable crash | T1 | T2 | DOWNGRADED to Warning — pre-migration data gap, not code bug |
| `d` ambiguous naming in date.ts:12 | T3 | T1 | T1: "context makes it clear enough" — T3 maintained. Sustained as Suggestion |
| Missing index on `orders.user_id` | T2 | T1+T3 | DROPPED — index exists at migration 20240115, T2 missed it |
```

### ❌ Bad — no per-finding reasoning, outcomes unexplained

```markdown
## Debate

Teammates reviewed and discussed.
Some findings were dropped.
Final: 2 Critical, 1 Warning.
```

---

## Output Format — Final Verdict

### ✅ Good — all fields populated, signal ratio shown

```markdown
---

### Final Verdict

✅ **APPROVE** — Fixed 🔴 2, 🟡 1 issues | AC: 3/3 ✅ | Validate: PASS | Signal: 75%

**Strengths:**
- praise: (ดี) Type guards used throughout `src/auth/` — no `as any` in 8 changed files `src/auth/token.service.ts:1-120`
- praise: (ดี) Error handling in `payment.service.ts` structured with context fields — easy to correlate in logs
```

### ❌ Bad — placeholder not filled, no signal, strengths missing

```markdown
### Final Verdict

✅ APPROVE
```

---

## Signal Ratio — When to Flag Noise

Signal = (🔴 + 🟡) / Total findings. Below 60% → findings table is too noisy.

### ✅ Good signal ratio

```markdown
**Summary: 🔴 1 · 🟡 2 · 🔵 1** (after dedup)
Signal: 75% — 3 actionable out of 4 total
```

### ❌ Low signal — mostly Suggestions, few real issues

```markdown
**Summary: 🔴 0 · 🟡 1 · 🔵 8** (after dedup)
Signal: 11% — re-review findings before publishing
```

When signal < 60%: consolidator must re-examine — likely teammates flagged style preferences
as Info findings without sufficient evidence for Warning.

---

## Cross-Domain Findings

When a reviewer finds something outside their primary domain, label it `[CROSS-DOMAIN]`
and set to Warning (never Critical). Consolidator may escalate.

### ✅ Good — labeled correctly, not dropped

```markdown
| 4 | 🟡 | #1 [CROSS-DOMAIN: Security] | `src/api/users.controller.ts` | 34 | 1/3 |
User ID from query param used directly in SQL without parameterization — possible injection.
(Filed by DX reviewer — Correctness reviewer should confirm before escalating to Critical.)
```

### ❌ Bad — cross-domain finding silently dropped

```markdown
(DX reviewer sees SQL injection but doesn't report it because "that's not my area")
```
