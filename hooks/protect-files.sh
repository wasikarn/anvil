#!/usr/bin/env bash
# protect-files.sh — Block edits to sensitive config files
# Used as a PreToolUse hook for Edit|Write events

set -euo pipefail

command -v jq > /dev/null 2>&1 || exit 0

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED_PATTERNS=(".claude/settings.json" ".claude/settings.local.json")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'. Edit this file manually or ask the user first." >&2
    exit 2
  fi
done

exit 0
