#!/usr/bin/env bash
# artifact-dir.sh — Return (and create) the artifact directory for a given skill.
# Usage: artifact-dir.sh <skill-name> [context-suffix]
# Output: absolute path (stdout)
# Side effect: mkdir -p on the output path
#
# Path convention: $HOME/.claude/plugins/data/dev-loop-dev-loop/<encoded-path>/<skill>[/<suffix>]
# Encoding: absolute project root path with / replaced by -
# Stored under ~/.claude/plugins/data/dev-loop-dev-loop/ (NOT ~/.claude/projects/) to avoid colliding with
# Claude Code's session JSONL storage which owns ~/.claude/projects/ exclusively.
# The leading - in the encoded path (e.g., -Users-alice-...) is intentional — not a bug.
#
# Compatible with bash 3.x (macOS default).
# Note: must be invoked from within the target project directory (or any subdirectory)
#       so that git rev-parse --show-toplevel resolves the correct project root.

set -euo pipefail

SKILL_NAME="${1:?artifact-dir.sh: skill name required}"
CONTEXT_SUFFIX="${2:-}"

# Guard against path traversal in inputs
case "$SKILL_NAME" in
  */*|*..*)
    echo "artifact-dir.sh: invalid skill name: $SKILL_NAME" >&2
    exit 1
    ;;
esac
if [ -n "$CONTEXT_SUFFIX" ]; then
  case "$CONTEXT_SUFFIX" in
    */*|*..*)
      echo "artifact-dir.sh: invalid context suffix: $CONTEXT_SUFFIX" >&2
      exit 1
      ;;
  esac
  # Treat suffixes ending with "-" as empty (e.g., "pr-" when PR number argument is empty)
  case "$CONTEXT_SUFFIX" in
    *-) CONTEXT_SUFFIX="" ;;
  esac
fi

# Derive project root
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Encode: replace every / with -
# Result has a leading - because the absolute path starts with /
ENCODED=$(echo "$PROJECT_ROOT" | tr '/' '-')

# Compose path
if [ -n "$CONTEXT_SUFFIX" ]; then
  ARTIFACT_DIR="$HOME/.claude/plugins/data/dev-loop-dev-loop/${ENCODED}/${SKILL_NAME}/${CONTEXT_SUFFIX}"
else
  ARTIFACT_DIR="$HOME/.claude/plugins/data/dev-loop-dev-loop/${ENCODED}/${SKILL_NAME}"
fi

mkdir -p "$ARTIFACT_DIR"
echo "$ARTIFACT_DIR"
