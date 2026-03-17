#!/usr/bin/env python3
"""Behavior-based eval runner for dlc-build skill.

Tests actual phase behavior (Phase 0 triage, Phase 4 review scaling, etc.)
rather than trigger detection. Injects relevant skill content into prompts
and grades outputs with an LLM judge.

Usage:
    python run_behavior_evals.py [--cases GLOB] [--verbose] [--model MODEL]

Examples:
    python run_behavior_evals.py                          # run all cases
    python run_behavior_evals.py --cases "phase0-*"      # only Phase 0 cases
    python run_behavior_evals.py --cases "phase4-*" -v   # Phase 4, verbose
"""

import argparse
import fnmatch
import json
import sys
import time
from pathlib import Path

import anthropic

# ─── Paths ────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).parent.parent.parent  # dotclaude/
SKILL_REFS = REPO_ROOT / "skills" / "dlc-build" / "references"
CASES_DIR = Path(__file__).parent / "cases"
RESULTS_DIR = Path(__file__).parent / "results"

# ─── Skill content loader ──────────────────────────────────────────────────────

def load_ref(filename: str) -> str:
    path = SKILL_REFS / filename
    if not path.exists():
        raise FileNotFoundError(f"Reference file not found: {path}")
    return path.read_text()


PHASE0_CONTEXT = None
PHASE4_CONTEXT = None


def get_phase0_context() -> str:
    global PHASE0_CONTEXT
    if PHASE0_CONTEXT is None:
        PHASE0_CONTEXT = (
            "# Phase 0 Triage Specification\n\n"
            + load_ref("phase-0-triage.md")
            + "\n\n---\n\n# Workflow Modes Specification\n\n"
            + load_ref("workflow-modes.md")
        )
    return PHASE0_CONTEXT


def get_phase4_context() -> str:
    global PHASE4_CONTEXT
    if PHASE4_CONTEXT is None:
        PHASE4_CONTEXT = (
            "# Review Scale Specification (from workflow-modes.md)\n\n"
            + load_ref("workflow-modes.md")
        )
    return PHASE4_CONTEXT


# ─── Prompt builders ──────────────────────────────────────────────────────────

PHASE0_EVAL_TEMPLATE = """\
You are executing the dlc-build skill as the Lead agent. \
Below is the Phase 0 triage specification:

{skill_context}

---

Process this user request through Phase 0 triage. Be explicit but concise:

USER REQUEST: {query}

Your response MUST include ALL of the following sections:

## 1. Mode Classification
Walk the decision tree step by step. State the final mode as one of: FULL / QUICK / HOTFIX.

## 2. Branch Setup
State: base branch (main or develop), branch prefix (feature/ fix/ hotfix/), \
and the full branch name you would create.

## 3. dev-loop-context.md YAML
Show the complete YAML frontmatter:
```yaml
---
task: "..."
mode: full|quick|hotfix
phase: triage
iteration: 0
branch: "..."
project: "..."
validate: "..."
started: "2026-03-17"
jira: "..."
plan_file: ""
tasks_completed: []
---
```

## 4. Jira Handling
State whether you will fetch a Jira ticket and why.

## 5. Phase 1 (Research)
State whether Phase 1 will run or be skipped, and why.

## 6. PR Target and Post-merge Steps
State which branch the PR targets. For hotfix mode, state what mandatory steps \
happen after merge (e.g., backport to develop).
"""

PHASE4_EVAL_TEMPLATE = """\
You are the Lead agent in the dlc-build skill. \
Below is the review scaling specification:

{skill_context}

---

USER REQUEST: {query}

Configure Phase 4 review. Your response MUST include ALL of these sections:

## 1. Reviewer Count
State exactly how many reviewers (0, 1, 2, or 3) will be spawned.

## 2. Reviewer Roles
List which roles are included and which are excluded (Correctness, Architecture, DX).

## 3. Debate Rounds
State exactly how many debate rounds (0, 1, or 2).

## 4. Reasoning
Cite the exact diff size threshold from the spec that applies.
"""

DIMENSION_TEMPLATES = {
    "phase0-mode-classification": PHASE0_EVAL_TEMPLATE,
    "phase0-hotfix-protocol": PHASE0_EVAL_TEMPLATE,
    "phase0-jira-handling": PHASE0_EVAL_TEMPLATE,
    "phase4-review-scaling": PHASE4_EVAL_TEMPLATE,
}

DIMENSION_CONTEXTS = {
    "phase0-mode-classification": get_phase0_context,
    "phase0-hotfix-protocol": get_phase0_context,
    "phase0-jira-handling": get_phase0_context,
    "phase4-review-scaling": get_phase4_context,
}


def build_prompt(case: dict) -> str:
    dimension = case["dimension"]
    template = DIMENSION_TEMPLATES[dimension]
    context_fn = DIMENSION_CONTEXTS[dimension]
    return template.format(
        skill_context=context_fn(),
        query=case["query"],
    )


# ─── Eval runner ──────────────────────────────────────────────────────────────

EVAL_SYSTEM_PROMPT = """\
You are the dlc-build skill Lead agent running in evaluation mode.
IMPORTANT: Do NOT execute any tools, bash commands, or API calls.
This is a planning exercise — produce complete written analysis only.
Show exactly what you would do and why, using the spec provided.
"""


def run_claude_sdk(prompt: str, client: anthropic.Anthropic, model: str) -> str:
    """Call Claude API directly (no tools). Returns text response."""
    for attempt in range(3):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=8000,
                system=EVAL_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(5 * (attempt + 1))


def grade_assertion(output: str, assertion: dict, client: anthropic.Anthropic, model: str) -> dict:
    """Use Claude as judge to grade a single assertion."""
    judge_prompt = f"""\
You are a strict grader for an AI skill evaluation.

ASSERTION: {assertion['text']}
CHECK CRITERIA: {assertion['check']}

OUTPUT TO EVALUATE:
---
{output[:8000]}
---

Does the output satisfy this assertion?

Rules:
- Answer PASS if the output clearly satisfies the check criteria
- Answer FAIL if it does not or if the evidence is ambiguous
- Respond in ONE line only: PASS or FAIL, then " — ", then evidence
- Do NOT write multi-line reasoning or reconsider after your verdict

Your answer (one line, PASS or FAIL first):"""

    for attempt in range(3):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=300,
                messages=[{"role": "user", "content": judge_prompt}],
            )
            break
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(5 * (attempt + 1))
    raw = response.content[0].text.strip()
    # Take the LAST verdict in case judge reconsidered mid-response (truncation guard)
    import re
    verdicts = re.findall(r'\b(PASS|FAIL)\b', raw.upper())
    passed = verdicts[-1] == "PASS" if verdicts else False
    evidence = raw.split("—", 1)[1].strip() if "—" in raw else raw[:200]
    return {"text": assertion["text"], "passed": passed, "evidence": evidence, "raw": raw}


def run_case(case: dict, client: anthropic.Anthropic, model: str, judge_model: str, verbose: bool) -> dict:
    """Run a single eval case: build prompt → call SDK → grade assertions."""
    start = time.time()

    prompt = build_prompt(case)

    if verbose:
        print(f"  Calling Claude API for case: {case['id']}...", flush=True)

    try:
        output = run_claude_sdk(prompt, client, model)
    except Exception as e:
        return {
            "id": case["id"],
            "dimension": case["dimension"],
            "description": case["description"],
            "error": str(e),
            "assertions": [],
            "passed": 0,
            "total": len(case["assertions"]),
            "elapsed": time.time() - start,
        }

    if verbose:
        print(f"  Grading {len(case['assertions'])} assertions...", flush=True)

    graded = []
    for assertion in case["assertions"]:
        result = grade_assertion(output, assertion, client, judge_model)
        graded.append(result)
        if verbose:
            status = "✓" if result["passed"] else "✗"
            print(f"    [{status}] {assertion['text']}", flush=True)
            if not result["passed"]:
                print(f"        Evidence: {result['evidence']}", flush=True)

    passed = sum(1 for r in graded if r["passed"])
    total = len(graded)

    return {
        "id": case["id"],
        "dimension": case["dimension"],
        "description": case["description"],
        "passed": passed,
        "total": total,
        "assertions": graded,
        "output_preview": output[:500],
        "elapsed": round(time.time() - start, 1),
    }


# ─── Report ───────────────────────────────────────────────────────────────────

def print_report(results: list[dict], elapsed_total: float):
    print("\n" + "=" * 60)
    print("BEHAVIOR EVAL RESULTS")
    print("=" * 60)

    by_dimension: dict[str, list] = {}
    for r in results:
        by_dimension.setdefault(r["dimension"], []).append(r)

    total_passed = 0
    total_assertions = 0

    for dim, cases in sorted(by_dimension.items()):
        dim_passed = sum(r["passed"] for r in cases)
        dim_total = sum(r["total"] for r in cases)
        dim_cases_passed = sum(1 for r in cases if r["passed"] == r["total"])
        pct = f"{dim_passed}/{dim_total}"
        print(f"\n{dim}")
        print(f"  Cases: {dim_cases_passed}/{len(cases)} perfect  |  Assertions: {pct}")
        for r in cases:
            if "error" in r:
                print(f"  ✗ {r['id']} — ERROR: {r['error']}")
            elif r["passed"] == r["total"]:
                print(f"  ✓ {r['id']}  ({r['passed']}/{r['total']})")
            else:
                print(f"  ✗ {r['id']}  ({r['passed']}/{r['total']})")
                for a in r["assertions"]:
                    if not a["passed"]:
                        print(f"      FAIL: {a['text']}")
                        print(f"            {a['evidence']}")
        total_passed += dim_passed
        total_assertions += dim_total

    overall_pct = f"{total_passed}/{total_assertions}"
    accuracy = total_passed / total_assertions * 100 if total_assertions else 0
    print("\n" + "=" * 60)
    print(f"OVERALL: {overall_pct} assertions passed  ({accuracy:.0f}%)")
    print(f"Elapsed: {elapsed_total:.0f}s")
    print("=" * 60)


# ─── Main ─────────────────────────────────────────────────────────────────────

def load_cases(pattern: str | None) -> list[dict]:
    cases = []
    for f in sorted(CASES_DIR.glob("*.json")):
        if pattern and not fnmatch.fnmatch(f.stem, pattern):
            continue
        cases.extend(json.loads(f.read_text()))
    return cases


def main():
    parser = argparse.ArgumentParser(description="Run dlc-build behavior evals")
    parser.add_argument("--cases", default=None, help="Glob pattern for case files (e.g. 'phase0-*')")
    parser.add_argument("--model", default=None, help="Claude model for eval (default: claude's default)")
    parser.add_argument("--judge-model", default="claude-sonnet-4-5", help="Claude model for grading")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print per-assertion results")
    parser.add_argument("--output", default=None, help="Save results JSON to this path")
    args = parser.parse_args()

    cases = load_cases(args.cases)
    if not cases:
        print("No eval cases found.", file=sys.stderr)
        sys.exit(1)

    print(f"Running {len(cases)} eval cases...")
    if args.cases:
        print(f"Filter: {args.cases}")

    client = anthropic.Anthropic()
    RESULTS_DIR.mkdir(exist_ok=True)

    eval_model = args.model or "claude-sonnet-4-5"
    results = []
    start_total = time.time()

    for i, case in enumerate(cases, 1):
        print(f"\n[{i}/{len(cases)}] {case['id']}", flush=True)
        result = run_case(case, client, eval_model, args.judge_model, args.verbose)
        results.append(result)
        status = f"{result['passed']}/{result['total']}" if "error" not in result else "ERROR"
        print(f"  → {status}  ({result.get('elapsed', 0):.1f}s)")

    elapsed_total = time.time() - start_total
    print_report(results, elapsed_total)

    # Save results
    timestamp = time.strftime("%Y-%m-%d_%H%M%S")
    output_path = Path(args.output) if args.output else RESULTS_DIR / f"{timestamp}.json"
    output_path.write_text(json.dumps({"results": results, "elapsed": round(elapsed_total, 1)}, indent=2))
    print(f"\nResults saved to: {output_path}")


if __name__ == "__main__":
    main()
