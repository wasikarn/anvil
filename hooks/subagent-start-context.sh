#!/usr/bin/env bash
# SubagentStart hook — inject context into specific agent types at spawn.
# Output: JSON with additionalContext field.
# Personal hook: agent types and context are project-specific.

command -v jq > /dev/null 2>&1 || exit 0

INPUT=$(cat)

AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty' 2>/dev/null || true)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || true)

CONTEXT=""

case "$AGENT_TYPE" in
  pr-review-bootstrap)
    CONTEXT="Jira project keys in use: BEP (backend), TWS (website), TAD (admin). PR review language: Thai. Use mcp__mcp-atlassian__jira_get_issue to fetch AC before reviewing."
    ;;
  dev-loop-bootstrap)
    if echo "$CWD" | grep -q "tathep-platform-api"; then
      CONTEXT="Project: tathep-platform-api. Stack: AdonisJS 5.9 + Effect-TS + Japa tests. Run tests: node ace test. Clean Architecture: Domain → Application → Infrastructure."
    elif echo "$CWD" | grep -q "tathep-website"; then
      CONTEXT="Project: tathep-website. Stack: Next.js 14 Pages Router + Chakra UI + React Query v3. Run tests: bun run test."
    elif echo "$CWD" | grep -q "tathep-admin"; then
      CONTEXT="Project: tathep-admin. Stack: Next.js 14 Pages Router + Tailwind + Headless UI + Vitest. Run tests: bun run test."
    fi
    ;;
esac

if [ -n "$CONTEXT" ]; then
  jq -n --arg ctx "$CONTEXT" \
    '{"hookSpecificOutput": {"hookEventName": "SubagentStart", "additionalContext": $ctx}}'
fi

exit 0
