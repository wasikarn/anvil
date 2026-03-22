#!/usr/bin/env bash
# skill-routing.sh — UserPromptSubmit hook
# Detects workflow keywords, injects structured skill hints.
# Ranked-hint model: collects ALL matching hints, emits once at end (multi-intent support).
# NOTE: no set -euo pipefail — hook must exit 0 on all failures

export LANG=en_US.UTF-8

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // empty' 2>/dev/null) || exit 0
[ -z "$PROMPT" ] && exit 0

# Lowercase once for case-insensitive matching (Thai chars unaffected)
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Ranked-hint accumulator — collects all matching hints, emits once at end
# Supports multi-intent prompts ("I finished this feature and there's a weird bug")
HINTS=""
add_hint() {
  if [ -z "$HINTS" ]; then
    HINTS="$1"
  else
    HINTS="${HINTS}

---

$1"
  fi
}

# Regex patterns stored in variables — required for [[ =~ ]] multi-line patterns
# shellcheck disable=SC2034
RE_BUG='bug|broken|failing|error|crash|test fail'
RE_FINISH_EN='ready to merge|feature complete|ready for pr|ready for review|i.m done|ship it|push to pr|done.*push|เสร็จแล้ว'
RE_REVIEW_EN='review pr|review pull request|review code|review this'
RE_TESTS_EN='write test|add test|missing test|test coverage|need.*test'
RE_PR_STATUS='what pr|pr status|open pr|review queue|my pr|pr.*waiting|waiting.*review'
RE_SPRINT='sprint status|what.*work on|daily plan|my tasks|triage.*jira|what.*today|session start'
RE_CHANGED='what.*changed|since.*deploy|release note|what.*this release|diff.*main|changelog'
RE_DEPS='update.*dep|upgrade.*package|update.*package|bump.*version|update.*library'
RE_DOCS='document this|add comments|add docs|write docs|explain this code'
RE_REFACTOR='refactor'
RE_NO_FEATURE='feature|service|component|api|page'
RE_FEATURE_EN='implement|add feature'
RE_FEATURE_BUILD='build.*(feature|service|component|api)'
RE_FEATURE_CREATE='create.*(feature|service|component|page)'
RE_JIRA_KEY='[A-Z]+-[0-9]+'
RE_JIRA_INTENT='implement|fix|build|look at|what is|status of|สร้าง|แก้'
RE_JIRA_CREATE='create story|write ticket|create ticket|write story|jira ticket|สร้าง ticket|สร้าง story|เขียน ticket'

# --- fix-bug (priority 1) ---
if [[ $PROMPT_LOWER =~ $RE_BUG ]] \
   || [[ $PROMPT =~ พัง|ไม่ทำงาน ]]; then
  add_hint "[skill-hint:fix-bug]
Sequence: systematic-debugging → TDD → verification-before-completion
Skip systematic-debugging: root cause already stated explicitly (not a guess)
Alt (complex): dlc-debug — parallel root cause + DX analysis"
fi

# --- finish-feature (priority 2) ---
# Covers natural completions: "I'm done", "ship it", "push to PR", "done, push"
if [[ $PROMPT_LOWER =~ $RE_FINISH_EN ]] \
   || [[ $PROMPT =~ พร้อม|ส่ง\ PR|ทำเสร็จ ]]; then
  add_hint "[skill-hint:finish-feature]
Sequence: verification-before-completion → requesting-code-review → finishing-a-development-branch
Skip verification: tests already passing / already verified"
fi

# --- review-pr (priority 3) ---
# Covers: "review PR", "review code", Thai "ดู PR", "ดู code ให้", "ตรวจ code"
if [[ $PROMPT_LOWER =~ $RE_REVIEW_EN ]] \
   || [[ $PROMPT =~ ดู\ PR|ดู\ code|ตรวจ\ code|ตรวจ\ PR ]]; then
  add_hint "[skill-hint:review-pr]
Run IN PARALLEL (all independent):
  code quality    → dlc-review             (this plugin)
  error handling  → silent-failure-hunter  (pr-review-toolkit plugin)
  test coverage   → pr-test-analyzer       (pr-review-toolkit plugin)
  type design     → type-design-analyzer   (pr-review-toolkit plugin, only if new types added)
  polish          → code-simplifier        (pr-review-toolkit plugin, run last)
Adversarial option: dlc-review (adversarial debate, 3 reviewers)"
fi

# --- write-tests ---
if [[ $PROMPT_LOWER =~ $RE_TESTS_EN ]] \
   || [[ $PROMPT =~ เขียน\ test|เพิ่ม\ test|ขาด\ test ]]; then
  add_hint "[skill-hint:write-tests]
Options:
  Find gaps:  test-quality-reviewer agent — identifies missing tests in current diff
  Full TDD:   dlc-build --quick with test-only scope — spec then implement"
fi

# --- pr-triage / work-context ---
if [[ $PROMPT_LOWER =~ $RE_PR_STATUS ]]; then
  add_hint "[skill-hint:work-context]
Use: work-context agent — daily digest of PRs awaiting action + active sprint tickets + unmerged branches"
fi

# --- sprint / daily context ---
if [[ $PROMPT_LOWER =~ $RE_SPRINT ]] \
   || [[ $PROMPT =~ ทำอะไรต่อ|งานวันนี้|งาน\ วันนี้ ]]; then
  add_hint "[skill-hint:work-context]
Use: work-context agent — active sprint tickets + open PRs + unmerged branches"
fi

# --- what-changed / release-notes ---
if [[ $PROMPT_LOWER =~ $RE_CHANGED ]]; then
  add_hint "[skill-hint:what-changed]
Commands:
  git log origin/main..HEAD --oneline    — commits since main
  git diff origin/main...HEAD --stat     — files changed
  gh pr list --state merged --limit 10   — recent merged PRs
Use metrics-analyst agent for longer-term trend analysis"
fi

# --- update-deps ---
if [[ $PROMPT_LOWER =~ $RE_DEPS ]]; then
  add_hint "[skill-hint:update-deps]
Sequence: check changelog for breaking changes → update → run full tests → check peer deps
Risk: semver major bumps — verify compatibility before committing"
fi

# --- document / explain ---
if [[ $PROMPT_LOWER =~ $RE_DOCS ]] \
   || [[ $PROMPT =~ เขียน\ doc|อธิบาย\ code|เพิ่ม\ comment ]]; then
  add_hint "[skill-hint:document]
Options:
  Code comments:   add JSDoc / inline comments for complex logic only
  Module docs:     README.md in the module directory
  API docs:        update OpenAPI spec if endpoint changed"
fi

# --- refactor (without feature/component modifier — avoids start-feature collision) ---
if [[ $PROMPT_LOWER =~ $RE_REFACTOR ]] \
   && ! [[ $PROMPT_LOWER =~ $RE_NO_FEATURE ]]; then
  add_hint "[skill-hint:refactor]
Sequence: read existing code → understand constraints → minimal targeted change
Guard: run full tests before + after — refactor must not change behavior
Skip brainstorming: if scope is already clear from description"
fi

# --- jira-key (atlassian-pm hint) ---
# Detects Jira key in prompt with implementation/review intent → suggest /dlc-build ABC-XXX
# Detects story creation intent → suggest story-writer agent (atlassian-pm)
if [[ $PROMPT =~ $RE_JIRA_KEY ]]; then
  JIRA_KEY="${BASH_REMATCH[0]}"
  if [[ $PROMPT_LOWER =~ $RE_JIRA_INTENT ]]; then
    add_hint "[skill-hint:jira-workflow]
Detected Jira key: ${JIRA_KEY}
Suggested: /dlc-build ${JIRA_KEY}  — reads AC from Jira, builds plan, implements, ships
Enhanced if atlassian-pm plugin installed: issue-bootstrap agent provides parent epic + linked issues automatically"
  fi
fi

if [[ $PROMPT_LOWER =~ $RE_JIRA_CREATE ]]; then
  add_hint "[skill-hint:jira-story-creation]
Use: story-writer agent (atlassian-pm plugin) — generates ADF-formatted Jira stories/subtasks
If atlassian-pm not installed: describe requirements as a checklist and use /dlc-build to implement"
fi

# --- start-feature (priority 4) ---
# 'build' and 'create' require feature/component modifier to reduce false positives
if [[ $PROMPT_LOWER =~ $RE_FEATURE_EN ]] \
   || [[ $PROMPT_LOWER =~ $RE_FEATURE_BUILD ]] \
   || [[ $PROMPT_LOWER =~ $RE_FEATURE_CREATE ]] \
   || [[ $PROMPT =~ สร้าง|เพิ่ม\ feature|ทำ\ feature|อยากทำ ]]; then
  if [[ $PROMPT_LOWER =~ unfamiliar|research ]] \
     || [[ $PROMPT =~ ไม่คุ้น|ศึกษา|ไม่รู้ ]]; then
    add_hint "[skill-hint:start-feature]
Alt (unfamiliar/complex): dlc-build → writing-plans → using-git-worktrees → TDD"
  elif [[ $PROMPT_LOWER =~ team|parallel ]] \
       || [[ $PROMPT =~ ช่วยกัน ]]; then
    add_hint "[skill-hint:start-feature]
Alt (team): dlc-build — full development loop with agent teams"
  else
    add_hint "[skill-hint:start-feature]
Sequence: brainstorming → writing-plans → using-git-worktrees → TDD
Skip brainstorming: full design already described this session
Skip worktree:     user says hotfix / small fix / one-liner
Alt (unfamiliar):  dlc-build → writing-plans → using-git-worktrees → TDD
Alt (team):        dlc-build"
  fi
fi

# --- emit all accumulated hints (empty = no match = no output) ---
if [ -n "$HINTS" ]; then
  jq -n --arg ctx "$HINTS" '{"hookSpecificOutput": {"additionalContext": $ctx}}'
fi

exit 0
