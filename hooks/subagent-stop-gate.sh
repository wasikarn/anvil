#!/usr/bin/env bash
# SubagentStop gate — blocks review agents that finish without file:line evidence.
# Config via env vars:
#   GATE_PATTERN  grep -qiE pattern to match agent_type (e.g. "code-reviewer|silent-failure")
#   GATE_MSG      feedback message sent back when blocking
# Output: JSON decision block (SubagentStop protocol)

set -euo pipefail

command -v jq > /dev/null 2>&1 || exit 0

INPUT=$(cat)

# Fail-safe: empty GATE_PATTERN means no filtering — pass through
[ -z "${GATE_PATTERN:-}" ] && exit 0

AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty' 2>/dev/null || true)
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty' 2>/dev/null || true)

# Skip agents that don't match this gate's pattern
if ! echo "$AGENT_TYPE" | grep -qiE "${GATE_PATTERN:-}"; then
  exit 0
fi

# Require at least one file:line reference
if ! echo "$LAST_MSG" | grep -qE '[a-zA-Z0-9_/.-]+\.[a-zA-Z]+:[0-9]+'; then
  jq -n --arg reason "${GATE_MSG:-Your output must include file:line evidence. Re-examine the code and cite specific locations.}" \
    '{"decision": "block", "reason": $reason}'
  exit 0
fi

exit 0
