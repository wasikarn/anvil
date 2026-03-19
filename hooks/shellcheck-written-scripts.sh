#!/usr/bin/env bash
# shellcheck-written-scripts.sh — PostToolUse(Write) hook
# Runs shellcheck on .sh files that Claude creates/writes.
# Returns additionalContext so Claude sees warnings immediately.

set -euo pipefail

command -v jq > /dev/null 2>&1 || exit 0
command -v shellcheck > /dev/null 2>&1 || exit 0

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check shell scripts
case "$FILE_PATH" in
  *.sh|*.bash) ;;
  *) exit 0 ;;
esac

# Skip if file doesn't exist (shouldn't happen in PostToolUse, but safety)
[ -f "$FILE_PATH" ] || exit 0

# Run shellcheck — -f gcc gives compact parseable output
SC_OUTPUT=$(shellcheck -f gcc "$FILE_PATH" 2>&1) || true

if [ -z "$SC_OUTPUT" ]; then
  exit 0
fi

ERRORS=$(echo "$SC_OUTPUT" | grep -c ':.*error:' || true)
WARNINGS=$(echo "$SC_OUTPUT" | grep -c ':.*warning:' || true)
SC_TRUNCATED=$(echo "$SC_OUTPUT" | head -30)

jq -nc --arg ctx "shellcheck found ${ERRORS} error(s), ${WARNINGS} warning(s) in ${FILE_PATH}:
${SC_TRUNCATED}" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
