# Fixer Prompt Templates

Prompt templates for fixer teammates (iteration 2+). Lead inserts project-specific values at `{placeholders}`.

## Fixer: Fix Findings (Iteration 2+)

```text
HARD RULES:
{hard_rules}

You are fixing review findings from iteration {iteration_number}.

PROJECT: {project_name}
FINDINGS: Read `{artifacts_dir}/review-findings-{N-1}.md` for the list of issues to fix.
PLAN CONTEXT: Read `{artifacts_dir}/dev-loop-context.md` for task description and design rationale — fixes must align with original intent.

WORKER CONTEXT:
{worker_context}
(Summary of what workers implemented: task descriptions, key decisions, commit messages, and rationale from `git log --oneline {base_branch}..HEAD`. Use this to understand intent before fixing.)

CONVENTIONS:
{project_conventions}

RULES:
1. Fix Critical findings first, then Warning
2. Each fix = separate commit with message: `fix({scope}): {description}` — e.g. `fix(auth): remove raw SQL concatenation`
3. Run `{validate_command}` BEFORE committing — not after
4. If validate fails: stash, analyze the exact error text, fix based on actual error (not guessing)
5. If a fix would introduce a new issue, message the team lead
6. Do NOT fix Info/nitpick findings unless specifically asked
7. If you cannot fix a finding, explain why in a message to the team lead

SEVERITY ORDER: 🔴 Critical → 🟡 Warning → 🔵 Info (skip unless asked)

IMPORTANT: If your fix introduces a NEW Critical issue, revert the commit
and try a different approach. Message the team lead about the conflict.

3-FIX ESCALATION: If the same finding fails to fix after 3 attempts, STOP immediately.
Do NOT keep trying variations of the same approach.
Message the team lead: "Finding #{N} resists fix after 3 attempts. Likely architectural issue — need guidance."

TOKEN BUDGET:
- After reading 8+ files in this phase (count only files you read directly — not shared context injected by Lead): switch to header + structure overview only for files >300 lines
- Do not re-read files that Lead already sent as shared context in this prompt
- If you cannot complete your task within this budget, list unread files and explain what's missing

OBSERVATION MASKING:
After reading a file and extracting findings:
- Retain: file path, line refs, finding text, reasoning chain
- Discard: full file content from working memory
- Do not re-read a file you have already processed unless Lead explicitly requests it
```

## Lead Notes

When constructing fixer prompts:

1. Replace all `{placeholders}` with actual values
2. Insert project-specific Hard Rules from `.claude/skills/review-rules/hard-rules.md` (if exists) or use Generic Hard Rules
3. Fixer receives ONLY unresolved findings from the previous review iteration
4. **`{worker_context}`**: populate with `git log --oneline {base_branch}..HEAD` + brief task descriptions from the plan. This gives the fixer intent context to avoid over-engineering fixes.
5. **`{validate_command}`**: same command as used by workers — from `dev-loop-context.md` `validate:` field.
