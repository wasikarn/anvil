#!/usr/bin/env bash
# Generic TaskCompleted gate — blocks tasks without file:line evidence.
# Config via env vars (set in settings.json command):
#   GATE_PATTERN  grep -qi pattern to match task names (e.g. "review|debate|finding")
#   GATE_MSG      feedback message sent back to teammate
# Exit 2 = block completion with feedback; exit 0 = allow.

set -euo pipefail

command -v jq > /dev/null 2>&1 || exit 0

INPUT=$(cat)

TASK_NAME=$(echo "$INPUT" | jq -r '.task_name // empty')
TOOL_OUTPUT=$(echo "$INPUT" | jq -r '.tool_output // empty')

# Skip tasks that don't match this gate's pattern
if ! echo "$TASK_NAME" | grep -qiE "$GATE_PATTERN"; then
  exit 0
fi

# Require at least one file:line reference in the output
if ! echo "$TOOL_OUTPUT" | grep -qE '[a-zA-Z0-9_/.-]+\.[a-zA-Z]+:[0-9]+'; then
  echo "$GATE_MSG" >&2
  exit 2
fi

exit 0
