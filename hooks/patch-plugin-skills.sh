#!/usr/bin/env bash
# Re-patches plugin cache files after plugin updates.
# Adds `disable-model-invocation: true` to side-effect skills
# that should never auto-trigger, and compresses verbose skills
# to reduce token load.
#
# Usage: ~/.claude/hooks/patch-plugin-skills.sh
# Run after: plugin install/update, or on session start

set -euo pipefail

CACHE_DIR="$HOME/.claude/plugins/cache/claude-plugins-official"
PATCHED=0
SKIPPED=0

patch_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return
  fi
  if grep -q 'disable-model-invocation: true' "$file" 2>/dev/null; then
    SKIPPED=$((SKIPPED + 1))
    return
  fi
  # Insert disable-model-invocation: true before the closing ---
  # Find the line number of the closing --- (second occurrence)
  local close_line
  close_line=$(awk '/^---$/{n++; if(n==2){print NR; exit}}' "$file")
  if [[ -z "$close_line" ]]; then
    echo "WARN: no closing --- found in $file" >&2
    return
  fi
  sed -i '' "${close_line}i\\
disable-model-invocation: true
" "$file"
  PATCHED=$((PATCHED + 1))
  echo "PATCHED: $file"
}

compress_using_superpowers() {
  local file="$1"
  [[ -f "$file" ]] || return
  # Skip if already compressed (no graphviz diagram present)
  grep -q 'digraph skill_flow' "$file" 2>/dev/null || { SKIPPED=$((SKIPPED + 1)); return; }
  python3 - "$file" << 'PYEOF'
import sys, re

path = sys.argv[1]
content = open(path).read()

# Replace graphviz diagram with numbered list
content = re.sub(
    r'```dot\ndigraph skill_flow \{.*?\n```',
    '1. User message received → check: might any skill apply?\n'
    '2. If yes (even 1%) → invoke Skill tool; if definitely not → respond\n'
    '3. After skill loads → announce "Using [skill] to [purpose]"\n'
    '4. If skill has checklist → create TodoWrite todo per item\n'
    '5. Follow skill exactly → respond',
    content, flags=re.DOTALL
)

# Replace 12-row Red Flags table with bullet list
table_pattern = r'These thoughts mean STOP—you\'re rationalizing:\n\n\| Thought.*?\n(?:\|.*?\n)+'
replacement = (
    "These thoughts mean STOP—you're rationalizing. Check for skills first regardless of:\n\n"
    "- \"Just a simple question / quick thing / one-liner\" — questions are tasks\n"
    "- \"Need context first / let me explore\" — skills tell you HOW to gather context\n"
    "- \"Doesn't need a formal skill / is overkill\" — if a skill exists, use it\n"
    "- \"I remember this skill\" — skills evolve, always invoke fresh\n"
    "- \"This doesn't count as a task\" — any action = task, check first\n"
)
content = re.sub(table_pattern, replacement, content, flags=re.DOTALL)

open(path, 'w').write(content)
print(f"COMPRESSED: {path}")
PYEOF
  PATCHED=$((PATCHED + 1))
}

# Find all cache versions for each plugin
for ver_dir in "$CACHE_DIR"/commit-commands/*/; do
  [[ -d "$ver_dir" ]] || continue
  patch_file "$ver_dir/commands/commit.md"
  patch_file "$ver_dir/commands/commit-push-pr.md"
  patch_file "$ver_dir/commands/clean_gone.md"
done

for ver_dir in "$CACHE_DIR"/ralph-loop/*/; do
  [[ -d "$ver_dir" ]] || continue
  patch_file "$ver_dir/commands/ralph-loop.md"
  patch_file "$ver_dir/commands/cancel-ralph.md"
  patch_file "$ver_dir/commands/help.md"
done

for ver_dir in "$CACHE_DIR"/superpowers/*/; do
  [[ -d "$ver_dir" ]] || continue
  compress_using_superpowers "$ver_dir/skills/using-superpowers/SKILL.md"
done

echo "Done: $PATCHED patched, $SKIPPED already patched"
