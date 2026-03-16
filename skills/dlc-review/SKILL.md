---
name: dlc-review
description: "Agent Teams PR review with adversarial debate — 3 reviewer teammates review independently then challenge each other's findings to reduce false positives. Supports optional Jira ticket (BEP-XXXX) for AC verification. Use when: reviewing complex PRs, high-stakes changes, or multi-perspective review. Triggers: team review, debate review, /dlc-review."
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

---

**PR:** #$0 | **Mode:** $1 (default: Author)
**Today:** !`date +%Y-%m-%d`
**Git branch:** !`git branch --show-current`
**Project:** !`bash "${CLAUDE_SKILL_DIR}/../../scripts/detect-project.sh" 2>/dev/null`
**Diff stat:** !`git diff HEAD~1...HEAD --stat 2>/dev/null || git diff main...HEAD --stat 2>/dev/null | tail -10`
**PR title:** !`gh pr view $0 --json title,body,labels,author --jq '{title,body,labels: [.labels[].name],author: .author.login}' 2>/dev/null`
**Changed files:** !`gh pr diff $0 --name-only 2>/dev/null`

**Args:** `$0`=PR# (required) · `$1`=Jira key or Author/Reviewer · `$2`=Author/Reviewer
**Modes:** Author = fix code · Reviewer = comment only (in Thai)
**Role:** Tech Lead — improve code health via architecture, mentoring, team standards.

Read CLAUDE.md first — auto-loaded, contains project patterns and conventions.
**Output format:** Follow [review-output-format.md](../../references/review-output-format.md) for base format, with debate additions described below.

---

## Prerequisite Check

Before anything, verify agent teams are available:

```text
If TeamCreate tool is not available → check graceful degradation:
- If Task (subagent) tool is available → "Agent Teams not enabled. Running in subagent mode (no debate, parallel subagent review)."
- If neither → "Running in solo mode. Lead performs sequential checklist-based review per review-conventions.md."
```

---

## Phase 0: Worktree Setup (Reviewer mode only)

In **Reviewer mode**, check out the PR in an isolated worktree to avoid disrupting the current working tree:

```bash
# Check if PR branch already checked out somewhere
git worktree list

# If not, create worktree
gh pr checkout $0 --worktree /tmp/review-pr-$0
cd /tmp/review-pr-$0
```

```text
Worktree already exists for this PR? → use it, skip creation
On the PR branch already? → skip (no worktree needed)
Author mode? → skip entirely (fixes happen in-place on current branch)
```

Clean up after Phase 6:

```bash
git worktree remove /tmp/review-pr-$0
```

---

## Phase 0.05: Context Bootstrap

Run the `pr-review-bootstrap` agent before creating reviewer teammates — it uses Haiku (cheap) to gather shared context once, preventing 3x redundant fetches:

```text
Task pr-review-bootstrap agent with:
  - PR number: $0
  - Jira key: (if present in $ARGUMENTS)

Capture output: {bootstrap_context} — includes diff summary, file groupings, AC checklist
```

Inject `{bootstrap_context}` into all 3 teammate prompts in Phase 2.

If bootstrap fails → fallback: each teammate gathers its own context (current behavior). Do not block on this.

---

## Phase 0.1: PR Scope Assessment

Parse `Diff stat` from header. Classify per [review-conventions.md](../../references/review-conventions.md) size thresholds:

| Size | Lines | Behavior |
| --- | --- | --- |
| Normal | <=400 | Full review with debate |
| Large | 401-1000 | Full review + suggest split |
| Massive | >1000 | Hard Rules only, skip debate, warn prominently |

If Massive: skip to simplified single-session review (debate overhead not worth it for scope-limited review).

---

## Phase 0.6: Ticket Understanding (skip if no Jira)

Scan `$ARGUMENTS` for Jira key (`BEP-\d+`). If found, follow [jira-integration.md](../../references/jira-integration.md) §dlc-review:

1. Fetch ticket → summarize Problem / Value / Scope
2. Parse AC → numbered checklist
3. Map each AC to PR diff files — flag missing implementation or tests as Critical
4. Pass AC summary to Phase 2 teammate prompts
5. Include AC verification table in Phase 4 output

If no Jira key → skip to Phase 1.

---

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

---

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

Wait for all 3 teammates to complete their independent review. Track progress:

```markdown
### Phase 2: Independent Review

| Teammate | Status | Findings |
| --- | --- | --- |
| Correctness & Security | ... | ... |
| Architecture & Performance | ... | ... |
| DX & Testing | ... | ... |
```

**CHECKPOINT** — all 3 reviews must complete before proceeding to debate.

---

## Phase 3: Adversarial Debate

Follow [debate-protocol.md](references/debate-protocol.md) exactly.

### Step 0: Pre-Debate Triage

Before broadcasting, classify all findings per [debate-protocol.md](references/debate-protocol.md) Pre-Debate Triage rules:

- **Auto-pass** (skip debate, include directly): Hard Rule + confidence ≥ 90
- **Auto-drop** (skip debate, drop): Info + confidence < 80
- **Must-debate** (all others): enter round-robin

Only must-debate findings are sent to teammates. This reduces debate token cost 30-50%.

### Step 1: Broadcast findings

Send each teammate the must-debate findings from all three reviews:

```text
All reviews are complete. Here are the findings from all teammates:

[Correctness findings]
[Architecture findings]
[DX findings]

Your task: Review the findings from the teammate assigned to you.
For each finding, respond with: Agree, Challenge (with evidence), or Escalate.
See debate-protocol.md for rules.
```

### Step 2: Round-robin debate

Create debate tasks per [debate-protocol.md](references/debate-protocol.md):

- Correctness reviews Architecture's findings
- Architecture reviews DX's findings
- DX reviews Correctness's findings

### Step 3: Check for consensus

After Round 1:

- If all findings have consensus (agree or clear majority) → proceed to Phase 4
- If unresolved disagreements exist → Round 2 (targeted debate on those findings only)
- After Round 2 → lead decides any remaining disputes based on evidence quality

### Step 4: Output debate summary

```markdown
### Phase 3: Debate Summary

| # | Finding | Raised By | Challenged By | Outcome |
| --- | --- | --- | --- | --- |
| 1 | ... | ... | ... | ... |
```

Show: Consensus (N/3), Dropped (with reason), or Lead decided (with rationale).

---

## Phase 4: Convergence

Consolidate surviving findings per [review-conventions.md](../../references/review-conventions.md):

1. **Dedup** by file:line — merge evidence from debate
2. **Pattern cap** — same violation in >3 files → consolidate + "and N more"
3. **Sort** — Critical → Warning → Info
4. **Signal check** — if (Critical+Warning)/Total < 60%, review for noise

Output the consolidated findings table per [review-output-format.md](../../references/review-output-format.md).

**Dismissed Findings Log:** After consolidation, if any findings were dropped via debate with clear reasoning, append to `{project_root}/.claude/review-dismissed.md`:

```markdown
| Date | Pattern | File | Reason dismissed | PR |
| --- | --- | --- | --- | --- |
| 2026-03-17 | missing null check | bar.ts:88 | guarded by caller at line 45 | #1234 |
```

Cap at 50 entries (remove oldest when over limit).

Replace the "Agents" column with "Consensus":

```markdown
**Summary: Critical X / Warning Y / Info Z** (after debate)

#### Findings

| # | Sev | Rule | File | Line | Consensus | Issue |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Critical | #2 | `src/foo.tsx` | 42 | 3/3 | Uses `as any` — should use type guard |
```

---

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

---

## Phase 6: Cleanup

After action phase completes:

1. Shut down all teammates
2. Clean up the team

Output final verdict per [review-output-format.md](../../references/review-output-format.md).

---

## Constraints

- Investigate: read files before making claims — no speculation without evidence
- Every recommendation must be feasible within the project's patterns
- Teammates are READ-ONLY during Phase 2-3 — code changes only in Phase 5
- Max 3 teammates — more adds cost without proportional value
- Max 2 debate rounds — prevents infinite discussion
- Hard Rules cannot be dropped via debate (only reclassified with evidence)

---

## Operational Reference

See [references/operational.md](references/operational.md) for Graceful Degradation levels, Context Compression Recovery steps, and Success Criteria checklist.
