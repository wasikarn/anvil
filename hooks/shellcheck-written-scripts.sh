#!/usr/bin/env bash
# shellcheck-written-scripts.sh — PostToolUse(Write) hook
# Runs shellcheck on .sh files that Claude creates/writes.
# Returns additionalContext so Claude sees warnings immediately.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check shell scripts
case "$FILE_PATH" in
  *.sh|*.bash) ;;
  *) exit 0 ;;
esac

# Skip if file doesn't exist (shouldn't happen in PostToolUse, but safety)
[ -f "$FILE_PATH" ] || exit 0

# Run shellcheck via RTK — compressed output, no manual truncation needed
SC_OUTPUT=$(rtk shellcheck "$FILE_PATH" 2>&1) || true

if [ -z "$SC_OUTPUT" ]; then
  exit 0
fi

jq -nc --arg ctx "shellcheck: ${FILE_PATH}
${SC_OUTPUT}" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
