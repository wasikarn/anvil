---
name: freeze
description: "Lock edits to a specific directory or file for this session — blocks Edit and Write tools on matching paths."
argument-hint: "[directory-path]"
hooks:
  PreToolUse:
    - matcher: Edit|Write
      hooks:
        - type: command
          command: |
            FREEZE_PATH=$(cat "${TMPDIR:-/tmp}/.devflow-freeze-path" 2>/dev/null || echo "")
            if [ -z "$FREEZE_PATH" ]; then exit 0; fi
            INPUT=$(cat)
            FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null || echo "")
            if [ -z "$FILE" ]; then exit 0; fi
            case "$FILE" in
              "$FREEZE_PATH"*) echo "Blocked: '$FILE' is inside frozen path '$FREEZE_PATH'. Unfreeze first." >&2; exit 2 ;;
              *) exit 0 ;;
            esac
---

# /freeze — Directory Lock

If `$ARGUMENTS` is empty, ask the user which directory to lock using the AskUserQuestion tool.

Write the frozen path to `${TMPDIR:-/tmp}/.devflow-freeze-path`:

```bash
echo "$ARGUMENTS" > "${TMPDIR:-/tmp}/.devflow-freeze-path"
```

Then announce: "Frozen: edits to `$ARGUMENTS` are now blocked for this session."

## Gotchas

- **Argument required** — `/freeze` with no path is ambiguous. Always ask via AskUserQuestion
  if `$ARGUMENTS` is empty.
- **Subdirectory paths** — use absolute or repo-relative paths: `/freeze src/auth` not
  `freeze auth`.
- **Implementation note** — uses temp file + inline hook for real enforcement. Upgrade to
  native hook path injection when Claude Code supports it.
