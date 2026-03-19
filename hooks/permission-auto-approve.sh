#!/usr/bin/env bash
# PermissionRequest hook — auto-approve known safe commands.
# Outputs JSON decision: allow for matched patterns.
# Personal hook: safe list is environment-specific.

command -v jq > /dev/null 2>&1 || exit 0

INPUT=$(cat)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

# Only handle Bash tool
if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

# Safe read-only and test patterns (anchored to start of command)
SAFE_PATTERNS=(
  "^git (status|log|diff|show|branch|remote|fetch)"
  "^(node ace test|bun run test|npx vitest|npm test)"
  "^(which|type|command -v)"
  "^(ls|pwd|echo|date|whoami)"
  "^jq "
  "^(curl|wget).*--dry-run"
)

for PATTERN in "${SAFE_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$PATTERN"; then
    jq -n '{"hookSpecificOutput": {"hookEventName": "PermissionRequest", "decision": {"behavior": "allow"}}}'
    exit 0
  fi
done

exit 0
