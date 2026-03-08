#!/usr/bin/env bash
# Re-inject critical context after context compaction.
# Output goes to stdout → injected into Claude's context.
# Dynamic sections pull live state so context stays accurate.

cat << 'EOF'
## Post-Compaction Reminder

### Project Stack
- tathep-platform-api: AdonisJS 5.9 + Effect-TS + Clean Architecture + Japa tests
- tathep-website: Next.js 14 Pages Router + Chakra UI + React Query v3
- tathep-admin: Next.js 14 Pages Router + Tailwind + Headless UI + Vitest

### Key Conventions
EOF

# Dynamic: detect package manager from lock files
if [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then PKG_MGR="bun"
elif [ -f "pnpm-lock.yaml" ]; then PKG_MGR="pnpm"
elif [ -f "yarn.lock" ]; then PKG_MGR="yarn"
else PKG_MGR="npm"; fi
echo "- Package manager: \`$PKG_MGR\` (not others)"

cat << 'EOF'
- Commit messages in English, PR reviews in Thai
- Always run tests before committing
- Use Effect-TS patterns in API layer (pipe, Effect.gen, Layer)
- Follow Clean Architecture boundaries: Domain → Application → Infrastructure
EOF

# Dynamic: current git state
echo ""
echo "### Git State"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -n "$BRANCH" ]; then
  echo "- Branch: \`$BRANCH\`"
  echo "- Recent commits:"
  git log --oneline -5 2>/dev/null | sed 's/^/  - /'
  DIRTY=$(git status --porcelain 2>/dev/null | head -5)
  if [ -n "$DIRTY" ]; then
    echo "- Uncommitted changes:"
    echo "$DIRTY" | sed 's/^/  - /'
  fi
fi

# Dynamic: detect which project we're in
echo ""
echo "### Current Session"
echo "- Check CLAUDE.md for project-specific rules"
echo "- Check todo list for in-progress tasks"
if [ -f "package.json" ]; then
  PKG_NAME=$(cat package.json | grep -o '"name": *"[^"]*"' | head -1 | sed 's/"name": *"//;s/"//')
  if [ -n "$PKG_NAME" ]; then
    echo "- Working in project: \`$PKG_NAME\`"
  fi
fi
