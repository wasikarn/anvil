# Agent Hook Pattern

This document explains how hooks interact with agents in devflow, and the key distinction
between hooks in skills vs. agents.

---

## Plugin Limitation: Agent Frontmatter Hooks Are Silently Ignored

When agents are distributed via a Claude Code plugin, the following frontmatter fields are
**silently ignored**:

- `hooks:`
- `mcpServers:`
- `permissionMode:`

This means you cannot add a `hooks:` block to an agent in `agents/<name>.md` and expect it
to fire when that agent runs via the plugin. The plugin loader skips these fields entirely —
no warning, no error.

**Workaround:** If an agent needs hooks, copy it to `.claude/agents/` instead of relying on
plugin distribution. Fields like `hooks:`, `mcpServers:`, and `permissionMode:` work when
the agent is loaded from the local `.claude/agents/` directory.

---

## Solution: Use the Central hooks.json for Agent-Specific Behavior

For hooks that need to fire when a specific agent starts or stops, register them in
`hooks/hooks.json` using the `SubagentStart` / `SubagentStop` events with a matcher pattern
that matches the agent name.

These hooks are distributed via the plugin and fire based on the agent's `name` field in
its frontmatter.

---

## Pattern: Adding a New Agent to SubagentStart/SubagentStop

### Current SubagentStart matcher (hooks.json)

```json
{
  "matcher": "code-reviewer|test-quality-reviewer|migration-reviewer|api-contract-auditor|falsification-agent|plan-challenger|comment-analyzer|code-simplifier|silent-failure-hunter|type-design-analyzer",
  "hooks": [
    {
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/hooks/subagent-start-context.sh",
      "timeout": 10
    }
  ]
}
```

### To add a new agent

1. Add the agent's `name` to the `matcher` string using `|` alternation:

   ```text
   "matcher": "code-reviewer|...|your-new-agent"
   ```

2. If the agent needs different hook behavior (not just the shared start-context), add a
   **new matcher block** in `hooks.json` rather than modifying the shared one:

   ```json
   {
     "matcher": "your-new-agent",
     "hooks": [
       {
         "type": "command",
         "command": "${CLAUDE_PLUGIN_ROOT}/hooks/your-agent-specific-hook.sh",
         "timeout": 10
       }
     ]
   }
   ```

3. Add a corresponding test in `tests/hooks/` and run `bash scripts/qa-check.sh`.

---

## Example: SubagentStop Gate for Review Agents

The `SubagentStop` event fires when a subagent finishes. devflow uses this to enforce that
reviewer agents cite file:line evidence before completing:

```json
"SubagentStop": [
  {
    "matcher": "code-reviewer|test-quality-reviewer|...",
    "hooks": [
      {
        "type": "command",
        "command": "GATE_PATTERN='...' GATE_MSG='...' ${CLAUDE_PLUGIN_ROOT}/hooks/subagent-stop-gate.sh",
        "timeout": 10
      }
    ]
  }
]
```

To add `your-new-agent` to this gate, append `|your-new-agent` to the `matcher` string and
add the agent name to `GATE_PATTERN` as well.

---

## When Inline Hooks DO Work: Skills (Not Agents)

Inline `hooks:` frontmatter **works correctly** in skill files (`skills/<name>/SKILL.md`).
When a skill is invoked, its inline hooks are registered for the current session.

Two examples in devflow:

- **`/careful`** (`skills/careful/SKILL.md`) — registers a `PreToolUse Bash` hook that
  blocks destructive commands (`rm -rf`, `DROP TABLE`, etc.) for the session.
- **`/freeze`** (`skills/freeze/SKILL.md`) — registers a `PreToolUse Edit|Write` hook that
  reads `${TMPDIR:-/tmp}/.devflow-freeze-path` and blocks edits to the frozen path.

The pattern for session-scoped enforcement via skills:

1. Skill frontmatter declares the inline hook (fires immediately on invocation).
2. Skill body writes state to a temp file if dynamic values are needed (e.g., the frozen path).
3. The hook reads the temp file to get the session-specific value.
4. `session-end-cleanup.sh` removes the temp file on `SessionEnd`.

This pattern lets skills enforce hard blocks without needing `$ARGUMENTS` substitution in
hook matchers (which the skill runtime does not support for hooks).

---

## Summary

| Location | `hooks:` field | Works via plugin? |
| --- | --- | --- |
| `agents/<name>.md` | Declared | No — silently ignored |
| `skills/<name>/SKILL.md` | Declared | Yes — fires on invocation |
| `hooks/hooks.json` | N/A (central registry) | Yes — always fires |

For agent-specific hook behavior, use `hooks/hooks.json` with `SubagentStart`/`SubagentStop`
matchers. For session-scoped skill enforcement, use inline hooks + a temp state file.
