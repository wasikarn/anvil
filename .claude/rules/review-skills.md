---
paths:
  - "skills/*-review-pr/**"
---

# PR Review Skills

All five `*-review-pr` skills share the same structure:

- **Args:** `[pr-number] [jira-key?] [Author|Reviewer]`
- **Scope:** `git diff develop...HEAD`
- **Phase 1-2:** Jira ticket fetch + AC verification (skipped if no Jira key)
- **Phase 3:** 7 agents dispatched in foreground parallel (READ-ONLY checkpoint before fixes)
- **Phase 4:** Author mode = fix code + `validate`; Reviewer mode = submit GitHub review in Thai
- **Agents used:** `pr-review-toolkit:{code-reviewer,comment-analyzer,pr-test-analyzer,silent-failure-hunter,type-design-analyzer,code-simplifier}` + `feature-dev:code-reviewer`
- **Reviewer language:** Thai mixed with English technical terms (casual Slack/PR tone)
- **GitHub repos:** `100-Stars-Co/bd-eye-platform-api` (api), `100-Stars-Co/bluedragon-eye-website` (web), `100-Stars-Co/bluedragon-eye-admin` (admin), `100-Stars-Co/tathep-ai-agent-python` (agent), `100-Stars-Co/tathep-video-processing` (video)

## Validate Commands

- api: `npm run validate:all`
- web: `npm run ts-check && npm run lint:fix && npm test`
- admin: `npm run ts-check && npm run lint@fix && npm run test` (`lint@fix` uses `@`, not `:`)
- agent: `uv run black --check . && uv run mypy .`
- video: `bun run check && bun run test`
