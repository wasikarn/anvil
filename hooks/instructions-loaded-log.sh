#!/usr/bin/env bash
# InstructionsLoaded hook — log CLAUDE.md file loads for audit.
# Only logs nested_traversal (cross-project context loads).
# Personal hook: not valuable for all plugin users.

command -v jq > /dev/null 2>&1 || exit 0

INPUT=$(cat)

REASON=$(echo "$INPUT" | jq -r '.load_reason // empty' 2>/dev/null || true)
FILE=$(echo "$INPUT" | jq -r '.file_path // empty' 2>/dev/null || true)
MEMORY_TYPE=$(echo "$INPUT" | jq -r '.memory_type // empty' 2>/dev/null || true)

# Only log nested traversals
if [ "$REASON" != "nested_traversal" ]; then
  exit 0
fi

LOG_DIR="$HOME/.claude/session-logs"
mkdir -p "$LOG_DIR" || exit 0
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"

{
  echo "---"
  echo "time: $(date '+%H:%M:%S')"
  echo "event: InstructionsLoaded"
  echo "reason: $REASON"
  echo "type: $MEMORY_TYPE"
  echo "file: $FILE"
} >> "$LOG_FILE"

exit 0
