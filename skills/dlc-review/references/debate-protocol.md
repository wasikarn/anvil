# Debate Protocol

Rules for the adversarial debate phase in dlc-review. Teammates challenge each other's findings to reduce false positives and produce higher-confidence results.

## Debate Structure

### Pre-Debate Triage (Lead)

Before broadcasting findings to teammates, the lead classifies all findings:

| Category | Criteria | Action |
| --- | --- | --- |
| **Auto-pass** | Hard Rule + confidence ≥ 90 | Skip debate — include in output directly |
| **Auto-drop** | Info + confidence < 80 | Skip debate — drop silently |
| **Must-debate** | Critical, or confidence < 90, or any Warning | Enter round-robin |

Only must-debate findings are sent to teammates. This reduces debate cost 30-50% with <2% accuracy loss (S2-MAD).

### Round-Robin Assignment

After all teammates complete independent review (Phase 2), the lead creates debate tasks:

| Reviewer | Reviews findings from |
| --- | --- |
| Correctness & Security | Architecture & Performance |
| Architecture & Performance | DX & Testing |
| DX & Testing | Correctness & Security |

**Critical finding exception (Round 1):** Any teammate may challenge any Critical finding,
regardless of the rotation above. The fixed rotation applies to Warning and Info findings only.
Rationale: a security Critical reviewed only by the DX teammate creates a domain-mismatch risk —
the wrong reviewer may lack context to mount a meaningful challenge.

Each reviewer examines the other's findings and responds with one of:

- **Agree** — "+1, confirmed. [optional: additional evidence]"
- **Challenge** — "False positive because [evidence]. The code at `file:line` shows [reason]."
- **Escalate** — "This is actually more severe than reported because [evidence]."

### Round Limits

- **Max 2 rounds** of debate. Lead enforces.
- Round 1: full review of all findings from assigned teammate.
- Round 2 (if needed): targeted — only unresolved disagreements from Round 1.
- If still unresolved after Round 2 → lead decides based on evidence.

### Response Requirements

Every challenge MUST include:

1. **Evidence** — file:line reference to actual code
2. **Reasoning** — why the finding is wrong or why severity should change
3. **Verdict** — "drop", "keep", or "change severity to X"

Challenges without evidence are ignored.

## Consensus Rules

| Outcome | Action |
| --- | --- |
| 3/3 agree | Keep finding at reported severity |
| 2/3 agree, 1 challenges | Keep finding; note the challenge in debate summary |
| 1/3 raised, 2 challenge | Drop finding |
| Split (no majority) | Lead decides — reads code, picks based on evidence quality. Use template below. |

## Lead Decision Template

When the lead decides a disputed finding (after Round 2 or split consensus), use this format in the Debate Summary table's Outcome column:

```text
Lead decided [keep|drop|change severity to X]:
Evidence: [file:line] — [code snippet or pattern description]
Reasoning: [why this evidence is more convincing than the opposing argument]
```

Example:

```text
Lead decided keep (Critical):
Evidence: src/auth.ts:42 — `jwt.verify()` without error handling
Reasoning: Correctness's challenge ("covered by middleware") is unverifiable — middleware at line 10 only runs on `/api/*` routes, this handler is under `/internal/*`
```

## Hard Rule Exception

Hard Rule violations (defined in project-specific SKILL.md) **cannot be dropped** via debate. They can only be:

- **Confirmed** (agree)
- **Reclassified** (if the pattern doesn't actually match the Hard Rule definition)

A teammate challenging a Hard Rule finding must prove the code does NOT match the pattern — e.g., "this `as any` is inside a type guard, not a bare cast."

## Debate Summary Output

After convergence, the lead outputs:

```markdown
### Phase 3: Debate Summary

| # | Finding | Raised By | Challenged By | Outcome |
| --- | --- | --- | --- | --- |
| 1 | `as any` at `foo.ts:42` | Correctness | — | Consensus (3/3) |
| 2 | Missing null check `bar.ts:88` | Correctness | Architecture ("guarded by caller at line 45") | Dropped |
| 3 | N+1 in loop `baz.ts:15` | Architecture | — | Consensus (3/3) |
| 4 | No unit test for edge case | DX | Correctness ("covered by e2e at test/foo.spec.ts:22") | Lead decided: keep as nitpick |
```

## New Finding Escalation

If a teammate discovers a genuinely new issue while reviewing another's findings, it may escalate — but with a strict gate:

1. Mark the finding `[NEW]` with full evidence (file:line, code quote, severity, fix)
2. Do NOT enter the round-robin — send directly to lead
3. Lead applies confidence filter (≥ 80), then routes through `falsification-agent` inline
   (pass the single [NEW] finding as a one-row table). Apply the SUSTAINED/DOWNGRADED/REJECTED
   verdict before adding to Phase 4 consolidation. Rejected [NEW] findings are dropped silently.
4. Max **2 new findings per teammate per debate** — prevents scope explosion

This captures cross-domain issues (e.g., Architecture reviewer notices a correctness bug while reviewing DX findings) that would otherwise be lost.

## Anti-Patterns

- **Rubber-stamping** — agreeing with everything without reading code. Each agreement should reference specific code if the finding is non-trivial.
- **Scope creep** — raising many new findings during debate. Use the New Finding Escalation gate (max 2 per teammate) for genuinely new issues.
- **Authority fallback** — "I'm the security reviewer so I'm right." Evidence wins, not role.
- **Infinite debate** — max 2 rounds. After that, lead decides. No exceptions.
