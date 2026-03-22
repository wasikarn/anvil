#!/usr/bin/env bash
# Re-inject critical context after context compaction.
# Output goes to stdout → injected into Claude's context.
# Keeps only dynamic state — conventions live in CLAUDE.md (auto-loaded).

INPUT=$(cat)

# Show compact summary if available
COMPACT_SUMMARY=$(echo "$INPUT" | jq -r '.compact_summary // empty' 2>/dev/null)
if [ -n "$COMPACT_SUMMARY" ]; then
  echo "## Compaction Summary"
  echo "$COMPACT_SUMMARY"
  echo ""
fi

echo "## Post-Compaction Context"
echo "- Re-read CLAUDE.md for project conventions (auto-loaded)"
echo "- Check todo list for in-progress tasks"

# Dynamic: current git state
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -n "$BRANCH" ]; then
  echo ""
  echo "### Git State"
  echo "- Branch: \`$BRANCH\`"
  DIRTY=$(git status --porcelain 2>/dev/null | head -5)
  if [ -n "$DIRTY" ]; then
    echo "- Uncommitted changes:"
    while IFS= read -r line; do echo "  - $line"; done <<< "$DIRTY"
  fi
fi

# Re-inject project Hard Rules if present (may have been evicted by compaction)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$PROJECT_ROOT" ]; then
  HARD_RULES="$PROJECT_ROOT/.claude/skills/review-rules/hard-rules.md"
  if [ -f "$HARD_RULES" ]; then
    echo ""
    echo "### ⚠️ Hard Rules (re-injected after compaction)"
    cat "$HARD_RULES"
  fi
fi
