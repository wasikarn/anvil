#!/usr/bin/env bats
# Tests for bash-failure-hint.sh hint selection logic.

HOOK="$BATS_TEST_DIRNAME/../../hooks/bash-failure-hint.sh"

run_hook() {
  echo "$1" | bash "$HOOK"
}

@test "npm error triggers package manager hint" {
  run run_hook '{"error":"npm ERR! missing script","tool_input":{"command":"npm run build"},"is_interrupt":false}'
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Package manager" ]]
}

@test "command not found triggers install hint" {
  run run_hook '{"error":"bats: command not found","tool_input":{"command":"bats test.sh"},"is_interrupt":false}'
  [ "$status" -eq 0 ]
  [[ "$output" =~ "not found" ]]
}

@test "permission denied triggers chmod hint" {
  run run_hook '{"error":"Permission denied","tool_input":{"command":"./script.sh"},"is_interrupt":false}'
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Permission denied" ]]
}

@test "is_interrupt true: hook exits 0 silently" {
  run run_hook '{"error":"something","tool_input":{"command":"ls"},"is_interrupt":true}'
  [ "$status" -eq 0 ]
  [ "$output" = "" ]
}

@test "empty error field: hook exits 0 without crashing" {
  run run_hook '{"error":"","tool_input":{"command":"ls"},"is_interrupt":false}'
  [ "$status" -eq 0 ]
}
