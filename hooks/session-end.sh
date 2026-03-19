#!/usr/bin/env bash
# SessionEnd hook — log session end to session log.
# Personal hook: not distributed in hooks.json.

command -v jq > /dev/null 2>&1 || exit 0

INPUT=$(cat)

REASON=$(echo "$INPUT" | jq -r '.reason // "other"' 2>/dev/null || true)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || true)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || true)

LOG_DIR="$HOME/.claude/session-logs"
mkdir -p "$LOG_DIR" || exit 0
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"

REPO=$(basename "$CWD" 2>/dev/null || echo "unknown")

{
  echo "---"
  echo "time: $(date '+%H:%M:%S')"
  echo "event: SessionEnd"
  echo "reason: $REASON"
  echo "repo: $REPO"
  [ -n "$SESSION_ID" ] && echo "session_id: ${SESSION_ID:0:8}..."
} >> "$LOG_FILE"

exit 0
