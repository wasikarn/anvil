# PR Review Workflow

Shared orchestration for all `tathep-*-review-pr` skills. Each skill defines project-specific content (Hard Rules, Project Config, examples) in its SKILL.md — this file provides the phase workflow.

**Before starting:** Read the invoking skill's SKILL.md for Project Config, Hard Rules, and project-specific constraints. Use those values wherever this workflow references them.

---

## Phase 0: PR Scope Assessment

Parse `Diff stat` from the skill header. Classify per [review-conventions.md](review-conventions.md) size thresholds.
If Massive: warn, limit review to Hard Rules + AC only.

---

## Phase 1: Ticket Understanding (skip if no Jira)

If the Jira key argument matches format (BEP-XXXX):

- Fetch via MCP `jira_get_issue`: description, AC, subtasks, parent
- Summarize: **Problem** / **Value** / **Scope**
- Show **AC Checklist** (each AC as checkbox)

If no Jira key provided, skip to Phase 3.

---

## Phase 2: AC Verification (skip if no Jira)

Map each AC to file(s) in the PR diff:

- Code not found: `[#1 Critical] AC not implemented`
- Code incomplete: `[#1 Critical] AC partially implemented`
- No test: `[#11 Critical] Missing test for AC`

---

## Phase 3: 12-Point Review

**Scope:** PR diff — changed files only.

Dispatch 7 agents in **foreground parallel** (all READ-ONLY). Each agent prompt must include:

1. **Hard Rules** from the skill's SKILL.md (verbatim — always inline, ~10-15 lines)
2. **AC context** from Phase 2 (inline summary)
3. **Criteria path** — tell the agent to read the skill's `references/checklist.md` at its absolute path
4. **Examples path** — tell the agent to read the skill's `references/examples.md` at its absolute path

Do NOT inline checklist or examples content in the agent prompt. Let each agent read the files itself — this avoids 7× duplication of reference files in the lead's output context.

| Agent |
| --- |
| `pr-review-toolkit:code-reviewer` |
| `pr-review-toolkit:comment-analyzer` |
| `pr-review-toolkit:pr-test-analyzer` |
| `pr-review-toolkit:silent-failure-hunter` |
| `pr-review-toolkit:type-design-analyzer` |
| `pr-review-toolkit:code-simplifier` |
| `feature-dev:code-reviewer` |

`feature-dev:code-reviewer` applies the skill's stated type/architecture principles. All agents use confidence scoring: 90-100 = Critical, 80-89 = Warning. Hard Rules bypass confidence filter — always Critical.

### Dispatch Rules

- **Evidence Gate:** Every agent MUST read actual code at file:line before flagging. No finding without evidence.
- **Actionable Only:** Every finding must include: (1) what's wrong + evidence, (2) why it matters, (3) concrete fix or pattern. Vague advice is not acceptable.
- **Scope Guard:** Review ONLY files in the PR diff. Do not flag issues in unchanged files.
- **Confidence Floor:** Non-Hard-Rule findings require confidence >= 80. Hard Rules bypass this filter.

**CHECKPOINT** — collect ALL 7 results before proceeding. Do NOT fix until all complete.

### Phase 3.5: Consolidation

Per [review-conventions.md](review-conventions.md): dedup by file:line, verify severity, remove false positives, sort Critical > Warning > Info.

---

## Phase 4: By Mode

### Author Mode

1. Fix AC issues first (Critical: not implemented / partial)
2. Fix: Critical > Warning > Info
3. Run the project's validate command — if fails, fix and re-validate

### Reviewer Mode

As **Tech Lead**: focus on architecture, patterns, team standards, and mentoring — not syntax nitpicks.
For each issue, explain *why* it matters, not just *what* to change.

1. Collect all findings: file path + line number + comment body
2. **EXECUTE GitHub submission (mandatory — see below)**
3. Show: AC Checklist, Strengths, all findings, submission result

**Comment language:** Thai mixed with English technical terms — casual Slack/PR tone. Short, direct, no stiff formal phrases. Use the skill's comment examples as style reference.

**Comment labels:** Per [review-conventions.md](review-conventions.md) — prefix every comment with `issue:`/`suggestion:`/`nitpick:`/`praise:`.

**Strengths (1-3):** Genuinely good practices only. Evidence required (file:line). Use the skill's strengths examples as reference.

#### Submit to GitHub (MANDATORY — must execute, not describe)

**DO NOT** output Phase 4 section until after the `gh` command has been executed and returned a response. The submission is an action, not a template to fill in.

**Step 1 — get line numbers from diff:**

```bash
gh pr diff {pr_number} --repo {repo}
```

Use the diff output to map each finding to the correct `path` and `line` (right-side line number).

**Step 2 — submit all comments + decision in ONE call:**

If Critical exists — Request Changes:

```bash
gh api repos/{repo}/pulls/{pr_number}/reviews \
  --method POST --input - <<'JSON'
{
  "body": "<overall summary in Thai>",
  "event": "REQUEST_CHANGES",
  "comments": [
    {"path": "src/example.ts", "line": 42, "side": "RIGHT", "body": "..."}
  ]
}
JSON
```

If no Critical — Approve:

```bash
gh pr review {pr_number} --repo {repo} \
  --approve --body "<summary in Thai>"
```

Replace `{repo}` and `{pr_number}` with values from the skill's Project Config and invocation args.

**Step 3 — verify submission succeeded:** Check the `gh` command exit code and response. If it fails (e.g., line number out of diff range), fix the offending comment's line number and retry.

---

## Shared Constraints

- Investigate: read files before making claims — speculation without evidence becomes false positives that erode review credibility.
- Every recommendation must be feasible within the project's actual patterns and constraints.
- **Output format:** Follow [review-output-format.md](review-output-format.md) exactly — output each phase section as it completes for real-time streaming.

---

## Success Criteria

- [ ] CHECKPOINT: all 7 agent results collected
- [ ] Phase 1-2 complete (if Jira provided)
- [ ] Critical issues: zero (Author) or documented (Reviewer)
- [ ] Author: validate command passes
- [ ] Reviewer: review submitted to GitHub
- [ ] AC Checklist shown in output (if Jira)
