# freeze skill

Locks edits to a specific directory for the current session via temp file + inline PreToolUse hook.

## Skill Architecture

- `SKILL.md` only — minimal, no `references/` directory
- Enforcement is real: inline `hooks` frontmatter registers a PreToolUse `Edit|Write` hook that reads `${TMPDIR:-/tmp}/.devflow-freeze-path` and blocks matching paths with `exit 2`
- Skill body writes the frozen path to the state file; session-end-cleanup.sh removes it on SessionEnd
- Uses `$ARGUMENTS` for the target directory path; falls back to `AskUserQuestion` if empty
- Like `/careful`, uses inline hooks frontmatter — enforcement is hook-based, not model-compliance only

## Validate After Changes

```bash
npx markdownlint-cli2 "skills/freeze/SKILL.md"
```

## Gotchas

- **Implementation note:** uses temp file + inline hook for real enforcement. Upgrade to native hook path injection when Claude Code supports it.
- The inline hook reads `${TMPDIR:-/tmp}/.devflow-freeze-path` — if the file is missing or empty, the hook exits 0 (no freeze active). This is intentional: no state file = no freeze.
- `argument-hint: "[directory-path]"` drives the CLI prompt; if the argument format changes in the skill runtime, update this field.
- Absolute or repo-relative paths work; bare directory names without path context (e.g., `freeze auth`) may be ambiguous — the SKILL.md guidance tells users to use `src/auth` not just `auth`.
- The hook uses `case "$FILE" in "$FREEZE_PATH"*)` for prefix matching — this means `/freeze src` will also block `src-other/`. Use specific paths like `src/auth` when precision matters.
