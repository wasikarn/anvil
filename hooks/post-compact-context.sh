#!/usr/bin/env bash
# Re-inject critical context after context compaction.
# Output goes to stdout → injected into Claude's context.

cat << 'EOF'
## Post-Compaction Reminder

### Project Stack
- tathep-platform-api: AdonisJS 5.9 + Effect-TS + Clean Architecture + Japa tests
- tathep-website: Next.js 14 Pages Router + Chakra UI + React Query v3
- tathep-admin: Next.js 14 Pages Router + Tailwind + Headless UI + Vitest

### Key Conventions
- Use Bun, not npm
- Commit messages in English, PR reviews in Thai
- Always run tests before committing
- Use Effect-TS patterns in API layer (pipe, Effect.gen, Layer)
- Follow Clean Architecture boundaries: Domain → Application → Infrastructure

### Current Session
- Check CLAUDE.md for project-specific rules
- Check todo list for in-progress tasks
EOF
