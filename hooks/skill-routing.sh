#!/usr/bin/env bash
# skill-routing.sh — UserPromptSubmit hook
# Detects workflow keywords, injects structured skill hints.
# Priority: fix-bug > finish-feature > review-pr > start-feature
# NOTE: no set -euo pipefail — hook must exit 0 on all failures (matching qmd-pre-search.sh pattern)

export LANG=en_US.UTF-8

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // empty' 2>/dev/null) || exit 0
[ -z "$PROMPT" ] && exit 0

# Lowercase once for case-insensitive matching (Thai chars unaffected)
PROMPT_LOWER="${PROMPT,,}"

emit_hint() {
  jq -n --arg ctx "$1" '{"hookSpecificOutput": {"additionalContext": $ctx}}'
  exit 0
}

# --- fix-bug (priority 1) ---
if [[ $PROMPT_LOWER =~ bug|broken|failing|error|crash|test\ fail ]] \
   || [[ $PROMPT =~ พัง|ไม่ทำงาน|แก้\ bug ]]; then
  emit_hint "[skill-hint:fix-bug]
Sequence: systematic-debugging → TDD → verification-before-completion
Skip systematic-debugging: root cause already stated explicitly (not a guess)
Alt (complex): dlc-debug — parallel root cause + DX analysis"
fi

# --- finish-feature (priority 2) ---
if [[ $PROMPT_LOWER =~ ready\ to\ merge|feature\ complete|ready\ for\ pr|ready\ for\ review ]] \
   || [[ $PROMPT =~ พร้อม\ merge|พร้อม\ PR|ทำเสร็จแล้ว\ พร้อม ]]; then
  emit_hint "[skill-hint:finish-feature]
Sequence: verification-before-completion → requesting-code-review → finishing-a-development-branch
Skip verification: tests already passing / already verified"
fi

# --- review-pr (priority 3) ---
if [[ $PROMPT_LOWER =~ review\ pr|review\ pull\ request|review\ code ]] \
   || [[ $PROMPT =~ ดู\ PR ]]; then
  emit_hint "[skill-hint:review-pr]
Run IN PARALLEL (all independent):
  code quality    → dlc-review             (this plugin)
  error handling  → silent-failure-hunter  (pr-review-toolkit plugin)
  test coverage   → pr-test-analyzer       (pr-review-toolkit plugin)
  type design     → type-design-analyzer   (pr-review-toolkit plugin, only if new types added)
  polish          → code-simplifier        (pr-review-toolkit plugin, run last)
Adversarial option: dlc-review (adversarial debate, 3 reviewers)"
fi

# --- start-feature (priority 4) ---
# 'build' and 'create' require feature/component modifier to reduce false positives
if [[ $PROMPT_LOWER =~ implement|add\ feature|build.*(feature|service|component|api)|create.*(feature|service|component|page) ]] \
   || [[ $PROMPT =~ สร้าง|เพิ่ม\ feature|ทำ\ feature|อยากทำ ]]; then
  if [[ $PROMPT_LOWER =~ unfamiliar|research ]] \
     || [[ $PROMPT =~ ไม่คุ้น|ศึกษา|ไม่รู้ ]]; then
    emit_hint "[skill-hint:start-feature]
Alt (unfamiliar/complex): dlc-build → writing-plans → using-git-worktrees → TDD"
  elif [[ $PROMPT_LOWER =~ team|parallel ]] \
       || [[ $PROMPT =~ ช่วยกัน ]]; then
    emit_hint "[skill-hint:start-feature]
Alt (team): dlc-build — full development loop with agent teams"
  else
    emit_hint "[skill-hint:start-feature]
Sequence: brainstorming → writing-plans → using-git-worktrees → TDD
Skip brainstorming: full design already described this session
Skip worktree:     user says hotfix / small fix / one-liner
Alt (unfamiliar):  dlc-build → writing-plans → using-git-worktrees → TDD
Alt (team):        dlc-build"
  fi
fi

exit 0
