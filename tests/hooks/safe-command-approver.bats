#!/usr/bin/env bats

HOOK="$BATS_TEST_DIRNAME/../../hooks/safe-command-approver.sh"

run_hook() { echo "$1" | bash "$HOOK"; }

@test "read-only git command: approves immediately without Opus call" {
  run run_hook '{"tool_name":"Bash","tool_input":{"command":"git status"}}'
  [ "$status" -eq 0 ]
  [[ "$output" =~ "approve" ]]
}

@test "read-only gh command: approves immediately" {
  run run_hook '{"tool_name":"Bash","tool_input":{"command":"gh pr list"}}'
  [ "$status" -eq 0 ]
  [[ "$output" =~ "approve" ]]
}

@test "non-Bash tool: passes through with no decision" {
  run run_hook '{"tool_name":"Read","tool_input":{"file_path":"README.md"}}'
  [ "$status" -eq 0 ]
  [ "$output" = "" ]
}

@test "empty command: exits 0 without crashing" {
  run run_hook '{"tool_name":"Bash","tool_input":{"command":""}}'
  [ "$status" -eq 0 ]
}
