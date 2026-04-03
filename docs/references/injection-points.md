# Named Injection Points

Injection points allow skills to execute custom logic at specific phases without modifying core skill flow.

## Mechanism

Skills call injection point handlers at phase boundaries:

```text
before_bootstrap → bootstrap → after_bootstrap →
before_plan → plan → after_plan →
before_review → review → after_review →
```

## When to Use

Use injection points when:

- You need to run logic at a specific phase boundary
- The logic is optional or configurable
- You want to allow skills to be extended without modification

Use inline logic instead when:

- The logic is always required
- The logic is simple and doesn't justify a separate handler
- You're implementing core skill behavior

## Implementation

### Skill-level Injection

Define injection points in SKILL.md:

**Example:**

```markdown
## Injection Points

### after_bootstrap

Called after context gathering completes.

Purpose: Check token budget, warn if approaching threshold.

Implementation: If token budget exceeded, output warning with suggestions.

### before_review

Called before spawning review agents.

Purpose: Estimate token cost, suggest optimizations if high.

Implementation: If estimated cost > 50k tokens, suggest --quick mode.
```

### Agent-level Injection

Spawn agents at injection points:

**Example:**

```markdown
**Phase 2.5: Token Budget Check**

If --budget-watchdog flag is set:
1. Spawn token-watchdog agent with cumulative_session from devflow-metrics.jsonl
2. Agent reads metrics, compares to threshold
3. If exceeded, agent outputs warning with suggestions
4. Skill continues (never blocks)
```

## Error Handling

Injection handlers should:

- Never throw uncaught exceptions
- Output warnings, not errors
- Allow skill to continue if handler fails
- Log failure details for debugging

Example graceful degradation:

```markdown
**Injection:** If token-watchdog fails to spawn, log warning and continue.
The skill must not block on injection handler failure.
```

## Current Injection Points

| Point | When | Purpose | Used By |
|-------|------|---------|---------|
| `after_bootstrap` | After context gathered | Token budget check | (Phase 4) token-watchdog |
| `before_review` | Before spawning reviewers | Cost estimation | (Phase 4) token-watchdog |
| `after_plan` | After plan written | Plan complexity check | (Phase 4) token-watchdog |

Note: All injection points are currently reserved for Phase 4 (Token Budget Watchdog). No skills implement injection points yet.

## Adding New Injection Points

1. Define the point name and when it fires
2. Document in this file (add to Current Injection Points table)
3. Add call site in skill phase file (e.g., `skills/build/SKILL.md`)
4. Create handler (agent spawn or inline logic)
5. Document error handling behavior
