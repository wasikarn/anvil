#!/usr/bin/env bash
# detect-project.sh — Detect project from git remote and output config JSON.
# Usage: bash detect-project.sh [project-root]
# Output: {"project":"...","repo":"...","validate":"...","base_branch":"...","branch":"...","hints":"..."}
# If validate is empty for unknown projects, the caller should ask the user for a validate command.
#
# Compatible with bash 3.x (macOS default).

set -euo pipefail

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT" 2>/dev/null || true

# Get current branch
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

# Get remote URL and extract repo slug
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
REPO_SLUG=$(echo "$REMOTE_URL" | sed 's/.*[:/]\([^/]*\/[^.]*\).*/\1/' 2>/dev/null || echo "")

PROJECT="unknown"
REPO=""
VALIDATE=""
BASE_BRANCH=""
HINTS=""

# Detect base branch from hard-rules.md if present
if [ -z "$BASE_BRANCH" ]; then
  HARD_RULES=".claude/skills/review-rules/hard-rules.md"
  if [ -f "$HARD_RULES" ]; then
    BASE_BRANCH=$(grep -oE '\| Base branch \| `[^`]+`' "$HARD_RULES" 2>/dev/null | grep -oE '`[^`]+`' | tr -d '`' | head -1)
  fi
fi

# Fall back to git remote default branch, then "main"
if [ -z "$BASE_BRANCH" ]; then
  BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
fi
if [ -z "$BASE_BRANCH" ]; then
  BASE_BRANCH="main"
fi

# Auto-detection for all projects
if [ -z "$VALIDATE" ]; then
  # Try package.json scripts
  if [ -f "package.json" ]; then
    # Scan package.json once, check extracted names in-memory (avoids 5 separate forks)
    SCRIPTS=$(grep -oE '"(validate:all|validate|typecheck|ts-check|type-check|test)"' package.json 2>/dev/null | tr -d '"' | sort -u)
    if echo "$SCRIPTS" | grep -qx 'validate:all'; then
      VALIDATE="npm run validate:all"
    elif echo "$SCRIPTS" | grep -qx 'validate'; then
      VALIDATE="npm run validate"
    elif echo "$SCRIPTS" | grep -qE '^(typecheck|ts-check|type-check)$' && echo "$SCRIPTS" | grep -qx 'test'; then
      VALIDATE="npm run typecheck && npm test"
    elif echo "$SCRIPTS" | grep -qx 'test'; then
      VALIDATE="npm test"
    fi
    # Detect package manager (bun preferred if bun.lockb exists)
    if [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
      VALIDATE="${VALIDATE/npm/bun}"
    fi
  # Try pyproject.toml (Python/uv)
  elif [ -f "pyproject.toml" ]; then
    if grep -q '\[tool.pytest\|pytest' pyproject.toml 2>/dev/null; then
      VALIDATE="uv run pytest"
    else
      VALIDATE="uv run python -m py_compile *.py"
    fi
  # Try Makefile
  elif [ -f "Makefile" ]; then
    if grep -q '^test:' Makefile 2>/dev/null; then
      VALIDATE="make test"
    elif grep -q '^validate:' Makefile 2>/dev/null; then
      VALIDATE="make validate"
    fi
  fi
  # Use repo slug as project name if available
  if [ -n "$REPO_SLUG" ]; then
    PROJECT=$(basename "$REPO_SLUG")
    REPO="$REPO_SLUG"
  fi
fi

# Build JSON manually (no jq dependency)
echo "{\"project\":\"${PROJECT}\",\"repo\":\"${REPO}\",\"validate\":\"${VALIDATE}\",\"base_branch\":\"${BASE_BRANCH}\",\"branch\":\"${BRANCH}\",\"hints\":\"${HINTS}\"}"
