#!/usr/bin/env bash
# skill-usage-tracker.sh — PreToolUse hook
# Logs Skill tool invocations to a TSV file for usage analytics.
# Output: DEV_LOOP_USAGE_LOG (default: ${CLAUDE_PLUGIN_DATA}/skill-usage.tsv)
#         CLAUDE_PLUGIN_DATA is set by the Claude Code plugin runtime — survives upgrades.
#         Falls back to ~/.claude/dev-loop/skill-usage.tsv if not set (dev mode / symlinks).
# Format: ISO8601_TIMESTAMP<TAB>SKILL_NAME
# NOTE: no set -euo pipefail — hook must exit 0 on all failures
# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
require_jq

INPUT=$(cat)
IFS=$'\t' read -r TOOL_NAME SKILL_NAME < <(jq_fields '.tool_name' '.tool_input.skill')

# Only track Skill tool invocations
[ "$TOOL_NAME" = "Skill" ] || exit 0
[ -n "$SKILL_NAME" ] || exit 0

# CLAUDE_PLUGIN_DATA: stable per-plugin folder set by Claude Code plugin runtime.
# Falls back to ~/.claude/dev-loop for local dev (symlinked, not installed).
DATA_DIR="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/dev-loop}"
mkdir -p "$DATA_DIR"
LOG="${DEV_LOOP_USAGE_LOG:-$DATA_DIR/skill-usage.tsv}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

printf '%s\t%s\n' "$TIMESTAMP" "$SKILL_NAME" >> "$LOG"
exit 0
