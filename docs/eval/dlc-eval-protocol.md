# DLC Eval Suite Protocol

**Purpose:** Reproducible before/after measurement for DLC workflow quality improvements.
**Spec:** `docs/superpowers/specs/2026-03-19-dlc-workflow-quality-improvements-round2-design.md`

---

## PR Selection Criteria

When curating PRs for the eval suite, each PR must have:

- Known ground truth — at least one reviewer-confirmed issue that was fixed (not disputed)
- ≥1 Critical or High severity issue
- Coverage of ≥2 reviewer domains (e.g., correctness + performance)

**Minimum suite:** 3 bug-fix PRs + 2 feature PRs = 5 PRs total

---

## Ground Truth Format

For each PR in the suite, document expected findings using this template:

```markdown
## PR {number}: {title}

**Type:** bug-fix | feature
**Domains:** correctness | architecture | security | performance | DX

### Expected Critical Issues

- {issue description} at `{file}:{line}` — confirmed by {evidence}

### Expected Warning Issues

- {issue description} at `{file}:{line}`

### Known False Positives (should NOT appear in output)

- {pattern description} — reason: {why it is not a real issue}
```

---

## Scoring Formulas

**Recall** = Critical/High issues found ÷ Critical/High issues expected

**Precision** = True findings ÷ Total findings reported

(True finding = output finding that matches an expected Critical or Warning entry within ±5 lines of the specified file:line)

---

## Run Procedure

1. Check out the target PR branch: `gh pr checkout {pr_number}`
2. Run `/dlc-review {pr_number}` in the project directory
3. For each finding in the output, classify as:
   - **True positive** — matches an expected finding (file:line within ±5 lines)
   - **False positive** — not in expected findings list
   - **False negative** — expected finding not reported (used for Recall denominator)
4. Calculate Recall and Precision using formulas above
5. Record scores using the Behavioral Anchor Rubric below

---

## Behavioral Anchor Rubric

| Score | Recall | Precision |
| --- | --- | --- |
| 5 | ≥90% Critical/High caught | ≤20% false positive rate |
| 4 | 75–89% caught | 21–35% FP rate |
| 3 | 50–74% caught | 36–50% FP rate |
| 2 | 25–49% caught | 51–65% FP rate |
| 1 | <25% caught | >65% FP rate |

---

## Baseline Requirement

**Run this suite BEFORE implementing any improvement round and record scores here.**
Without a pre-implementation baseline, before/after comparisons are invalid.

| Date | Round | Recall Score | Precision Score | Token Eff Score | Notes |
| --- | --- | --- | --- | --- | --- |
| | Pre-R2 baseline | | | | |
| | Post-R2 | | | | |

---

## PR Suite

Add your project's PR entries below using the Ground Truth Format above.

<!-- Add PR entries here — minimum 5 (3 bug-fix + 2 feature) -->
