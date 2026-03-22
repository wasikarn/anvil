#!/usr/bin/env bash
# Shared test helpers — sourced via bats load() or @test setup().

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOKS_DIR="$REPO_ROOT/hooks"
export HOOKS_DIR
LIB_DIR="$HOOKS_DIR/lib"
export LIB_DIR

# mock_input — set $INPUT to a JSON string (simulates Claude hook stdin).
mock_input() { INPUT="$1"; export INPUT; }
