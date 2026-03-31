#!/usr/bin/env bash
# skill-routing.sh — UserPromptSubmit hook
# Detects workflow keywords, injects structured skill hints.
# Ranked-hint model: collects ALL matching hints, emits once at end (multi-intent support).
# NOTE: no set -euo pipefail — hook must exit 0 on all failures
# Any error in skill routing must silently pass through so Claude always receives
# the prompt. Failure here means no skill hints — a recoverable UX issue, not fatal.

export LANG=en_US.UTF-8

# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
require_jq

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null) || exit 0
[ -z "$PROMPT" ] && exit 0

# Lowercase once for case-insensitive matching (Thai chars unaffected)
# bash 4+ builtin (macOS ships bash 3.2; homebrew bash is 5+)
if (( BASH_VERSINFO[0] >= 4 )); then
  PROMPT_LOWER="${PROMPT,,}"
else
  PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
fi

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
RE_FINISH_EN='ready to merge|feature complete|ready for pr|ready for review|i.m done|ship it|push to pr|done.*push|เสร็จแล้ว'
RE_REVIEW_EN='review pr|review pull request|review code|review this'
RE_CHANGED='what.*changed|since.*deploy|release note|what.*this release|diff.*main|changelog'
RE_FEATURE_EN='implement|add feature'
RE_FEATURE_BUILD='build.*(feature|service|component|api)'
RE_FEATURE_CREATE='create.*(feature|service|component|page)'
RE_JIRA_KEY='[A-Z]+-[0-9]+'
RE_JIRA_INTENT='implement|fix|build|look at|what is|status of|สร้าง|แก้'
RE_JIRA_CREATE='create story|write ticket|create ticket|write story|jira ticket|สร้าง ticket|สร้าง story|เขียน ticket'

# --- finish-feature (priority 1) ---
if [[ $PROMPT_LOWER =~ $RE_FINISH_EN ]] \
   || [[ $PROMPT =~ พร้อม|ส่ง\ PR|ทำเสร็จ ]]; then
  add_hint "[skill-hint:finish-feature] /build done? → verification-before-completion → requesting-code-review → finishing-a-development-branch"
fi

# --- review-pr (priority 2) ---
if [[ $PROMPT_LOWER =~ $RE_REVIEW_EN ]] \
   || [[ $PROMPT =~ ดู\ PR|ดู\ code|ตรวจ\ code|ตรวจ\ PR ]]; then
  add_hint "[skill-hint:review-pr] /review — adversarial 3-reviewer debate (or run in parallel: review + pr-review-toolkit plugins)"
fi

# --- what-changed / release-notes ---
if [[ $PROMPT_LOWER =~ $RE_CHANGED ]]; then
  add_hint "[skill-hint:what-changed] git log origin/main..HEAD --oneline; git diff --stat; gh pr list --merged; /metrics for trends"
fi

# --- jira-key (atlassian-pm hint) ---
if [[ $PROMPT =~ $RE_JIRA_KEY ]]; then
  JIRA_KEY="${BASH_REMATCH[0]}"
  if [[ $PROMPT_LOWER =~ $RE_JIRA_INTENT ]]; then
    add_hint "[skill-hint:jira-workflow] Detected ${JIRA_KEY} — use /build ${JIRA_KEY} to implement with AC auto-extracted"
  fi
fi

if [[ $PROMPT_LOWER =~ $RE_JIRA_CREATE ]]; then
  add_hint "[skill-hint:jira-story-creation] story-writer agent (atlassian-pm plugin) — or describe requirements and use /build"
fi

# --- start-feature (priority 3) ---
# 'build' and 'create' require feature/component modifier to reduce false positives
if [[ $PROMPT_LOWER =~ $RE_FEATURE_EN ]] \
   || [[ $PROMPT_LOWER =~ $RE_FEATURE_BUILD ]] \
   || [[ $PROMPT_LOWER =~ $RE_FEATURE_CREATE ]] \
   || [[ $PROMPT =~ สร้าง|เพิ่ม\ feature|ทำ\ feature|อยากทำ ]]; then
  add_hint "[skill-hint:start-feature] brainstorm→plan→worktree→TDD; /build for full loop; skip brainstorm if design clear"
fi

# --- emit all accumulated hints (empty = no match = no output) ---
if [ -n "$HINTS" ]; then
  jq -n --arg ctx "$HINTS" '{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": $ctx}}'
fi

exit 0
