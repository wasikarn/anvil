---
name: dlc-review
description: "Use this skill whenever someone wants a pull request reviewed — whether they're asking for a quick standards check before merging, an architecture review, a second opinion on changes, or a thorough multi-perspective analysis. Trigger on any query containing a PR number with review intent, or the /dlc-review command. Three agents independently examine the PR then debate their findings to reduce false positives. Supports optional Jira ticket (BEP-XXXX) for acceptance criteria verification. Works in Author mode (applies fixes directly) or Reviewer mode (submits GitHub comments). Do not use for reviewing uncommitted code or branches without a PR number, writing tests, fixing bugs, or responding to existing reviewer comments."
argument-hint: "[pr-number] [jira-key?] [Author|Reviewer?]"
compatibility: "Requires gh CLI, git, and CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 enabled in settings"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(gh *), Bash(git *)
---

# Team PR Review — Adversarial Debate

Invoke as `/dlc-review [pr-number] [jira-key?] [Author|Reviewer]`

## References

| File |
| --- |
| [debate-protocol.md](references/debate-protocol.md) |
| [teammate-prompts.md](references/teammate-prompts.md) |
| [review-output-format.md](../../references/review-output-format.md) |
| [review-conventions.md](../../references/review-conventions.md) |
| [jira-integration.md](../../references/jira-integration.md) — Jira detection, MCP fetch, AC verification (loaded when Jira key detected) |
| [references/operational.md](references/operational.md) — Graceful Degradation, Context Compression Recovery, Success Criteria |

**PR:** #$0 | **Mode:** $1 (default: Author)
**Today:** !`date +%Y-%m-%d`
**Git branch:** !`git branch --show-current`
**Project:** !`bash "${CLAUDE_SKILL_DIR}/../../scripts/detect-project.sh" 2>/dev/null`
**Diff stat:** !`rtk git diff HEAD~1...HEAD --stat 2>/dev/null || rtk git diff main...HEAD --stat 2>/dev/null`
**PR title:** !`gh pr view $0 --json title,body,labels,author --jq '{title,body,labels: [.labels[].name],author: .author.login}' 2>/dev/null`
**Changed files:** !`gh pr diff $0 --name-only 2>/dev/null`

**Args:** `$0`=PR# (required) · `$1`=Jira key or Author/Reviewer · `$2`=Author/Reviewer
**Modes:** Author = fix code · Reviewer = comment only (in Thai)
**Role:** Tech Lead — improve code health via architecture, mentoring, team standards.

Read CLAUDE.md first — auto-loaded, contains project patterns and conventions.
**Output format:** Follow [review-output-format.md](../../references/review-output-format.md) for base format, with debate additions described below.

## Prerequisite Check

Before anything, verify agent teams are available:

```text
If TeamCreate tool is not available → check graceful degradation:
- If Task (subagent) tool is available → "Agent Teams not enabled. Running in subagent mode (no debate, parallel subagent review)."
- If neither → "Running in solo mode. Lead performs sequential checklist-based review per review-conventions.md."
```

## Phase 0: Worktree Setup (Reviewer mode only)

In **Reviewer mode**: `gh pr checkout $0 --worktree /tmp/review-pr-$0`. Skip if already on PR branch or if worktree exists. Skip entirely in Author mode. Clean up after Phase 6: `git worktree remove /tmp/review-pr-$0`.

## Phase 0.05: Context Bootstrap

Run `pr-review-bootstrap` agent (Haiku) with PR #$0 and Jira key if present. Capture `{bootstrap_context}` (diff summary, file groupings, AC checklist) — inject into all 3 Phase 2 teammate prompts. If bootstrap fails: Teammate 1 fetches full diff and posts lightweight summary; teammates 2+3 use that instead.

## Phase 0.1: PR Scope Assessment

Parse `Diff stat` from header. Classify per [review-conventions.md](../../references/review-conventions.md) size thresholds:

| Size | Lines | Behavior |
| --- | --- | --- |
| Normal | <=400 | Full review with debate |
| Large | 401-1000 | Full review + suggest split |
| Massive | >1000 | Hard Rules only, skip debate, warn prominently |

## Phase 0.6: Ticket Understanding (skip if no Jira)

Scan `$ARGUMENTS` for Jira key (`BEP-\d+`). If found, follow [jira-integration.md](../../references/jira-integration.md) §dlc-review:

1. Fetch ticket → summarize Problem / Value / Scope
2. Parse AC → numbered checklist
3. Map each AC to PR diff files — flag missing implementation or tests as Critical
4. Pass AC summary to Phase 2 teammate prompts
5. Include AC verification table in Phase 4 output

If no Jira key → skip to Phase 1.

## Phase 1: Project Detection

Use the `Project` JSON from the header (output of `detect-project.sh`). It contains: `project`, `repo`, `validate`, `base_branch`, `branch`.

Check for project-specific rules at `{project_root}/.claude/skills/review-rules/`:

```text
.claude/skills/review-rules/hard-rules.md exists?
├→ Yes: load it as project Hard Rules + note checklist.md and examples.md paths:
│       {project_root}/.claude/skills/review-rules/checklist.md
│       {project_root}/.claude/skills/review-rules/examples.md
└→ No:  use generic rules below
```

Pass checklist.md and examples.md paths to Phase 2 teammates so they can reference project-specific patterns.

If no review-rules found, use generic rules:

**Generic Hard Rules** (flag unconditionally):

- `as any` / `as unknown as T` → Critical (destroys type safety)
- empty `catch {}` / swallowed errors → Critical (silent failures)
- nesting > 1 level → Critical (use guard clauses, extract function, or lookup table)
- query inside loop → Critical (N+1)
- `console.log` in production code → Critical (use structured logger)

## Phase 2: Create Team and Independent Review

### Step 1: Create the team

Create an agent team named `review-pr-$0` with 3 reviewer teammates using prompts from [teammate-prompts.md](references/teammate-prompts.md):

- **Teammate 1 — Correctness & Security:** Focus on correctness (#1, #2), type safety (#10), error handling (#12)
- **Teammate 2 — Architecture & Performance:** Focus on N+1 (#3), DRY (#4), flatten (#5), SOLID (#6), elegance (#7)
- **Teammate 3 — DX & Testing:** Focus on naming (#8), docs (#9), testability (#11), debugging (#12)

Insert into each teammate prompt:

- Project Hard Rules (from Phase 1)
- PR number
- `{bootstrap_context}` from Phase 0.05 (if available)
- AC summary if Jira AC was parsed (Phase 0.6)
- Known dismissed patterns: if `{project_root}/.claude/review-dismissed.md` exists, include last 10 entries as `{dismissed_patterns}` — teammates skip re-raising these patterns without new evidence

All teammates are READ-ONLY.

### Step 2: Wait for all reviews

Wait for all 3 teammates to complete. Track progress: show each teammate's status and key finding. **CHECKPOINT** — all 3 reviews must complete before proceeding to debate.

## Phase 3: Adversarial Debate

Follow [debate-protocol.md](references/debate-protocol.md) exactly:

1. **Pre-Debate Triage:** Auto-pass (Hard Rule + conf ≥90), auto-drop (Info + conf <80), must-debate (all others). Only must-debate findings enter round-robin.
2. **Broadcast** must-debate findings to all teammates.
3. **Round-robin:** Correctness reviews Architecture's findings · Architecture reviews DX's · DX reviews Correctness's.
4. **Consensus check:** Proceed if consensus, else Round 2 on unresolved only. After Round 2, lead decides on evidence quality. Max 2 rounds.
5. **Output:** Debate summary table — Finding / Raised By / Challenged By / Outcome. Show: Consensus (N/3), Dropped (reason), Lead decided (rationale).

## Phase 4: Convergence

Dispatch `review-consolidator` agent with the surviving debate findings passed inline in
the prompt. Capture the agent's output as the consolidated findings table.

If agent errors → perform dedup, pattern-cap, sort, and signal-check inline per
[review-conventions.md](../../references/review-conventions.md).

Output the consolidated findings table per [review-output-format.md](../../references/review-output-format.md).

**Dismissed Findings Log:** After consolidation, append dropped findings to `{project_root}/.claude/review-dismissed.md` (format: date | pattern | file | reason | PR — cap 50 FIFO).

Replace the "Agents" column with "Consensus":

```markdown
**Summary: Critical X / Warning Y / Info Z** (after debate)

#### Findings

| # | Sev | Rule | File | Line | Consensus | Issue |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Critical | #2 | `src/foo.tsx` | 42 | 3/3 | Uses `as any` — should use type guard |
```

## Phase 5: Action

### Author Mode

1. Fix AC-related Critical findings first (if Jira), then other Critical, Warning, Info
2. Run project validate command (detected in Phase 1)
3. Output fixes table per [review-output-format.md](../../references/review-output-format.md)
4. If Jira: show AC checklist with pass/fail status

### Reviewer Mode

As **Tech Lead**: focus on architecture, patterns, team standards, and mentoring.

1. Collect surviving findings: file path + line number + comment body
2. Add strengths (1-3, with evidence)
3. Submit to GitHub in ONE `gh api` call
4. Comment language: Thai mixed with English technical terms

**Comment labels:** Per [review-conventions.md](../../references/review-conventions.md) — prefix every comment with `issue:`/`suggestion:`/`nitpick:`/`praise:`.

## Phase 6: Cleanup

After action phase completes:

1. Shut down all teammates
2. Clean up the team

Output final verdict per [review-output-format.md](../../references/review-output-format.md).

## Constraints

- Investigate: read files before making claims — no speculation without evidence
- Every recommendation must be feasible within the project's patterns
- Teammates are READ-ONLY during Phase 2-3 — code changes only in Phase 5
- Max 3 teammates — more adds cost without proportional value
- Max 2 debate rounds — prevents infinite discussion
- Hard Rules cannot be dropped via debate (only reclassified with evidence)

## Operational Reference

See [references/operational.md](references/operational.md) for Graceful Degradation levels, Context Compression Recovery steps, and Success Criteria checklist.
