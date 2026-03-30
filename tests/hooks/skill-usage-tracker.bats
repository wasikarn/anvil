#!/usr/bin/env bats
# Tests for hooks/skill-usage-tracker.sh

load setup

@test "logs skill invocation to usage file" {
  USAGE_LOG=$(mktemp)
  run bash -c "
    DEVFLOW_USAGE_LOG=$USAGE_LOG \
    bash '$HOOKS_DIR/skill-usage-tracker.sh' <<< '{\"tool_name\":\"Skill\",\"tool_input\":{\"skill\":\"build\"}}'
  "
  [ "$status" -eq 0 ]
  grep -q "build" "$USAGE_LOG"
  rm -f "$USAGE_LOG"
}

@test "non-Skill tool: exits 0 with no log write" {
  USAGE_LOG=$(mktemp)
  run bash -c "
    DEVFLOW_USAGE_LOG=$USAGE_LOG \
    bash '$HOOKS_DIR/skill-usage-tracker.sh' <<< '{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"ls\"}}'
  "
  [ "$status" -eq 0 ]
  [ ! -s "$USAGE_LOG" ]
  rm -f "$USAGE_LOG"
}

@test "appends multiple entries without overwriting" {
  USAGE_LOG=$(mktemp)
  for skill in build review merge-pr; do
    bash -c "
      DEVFLOW_USAGE_LOG=$USAGE_LOG \
      bash '$HOOKS_DIR/skill-usage-tracker.sh' <<< \
        '{\"tool_name\":\"Skill\",\"tool_input\":{\"skill\":\"$skill\"}}'"
  done
  [ "$(wc -l < "$USAGE_LOG")" -eq 3 ]
  rm -f "$USAGE_LOG"
}
