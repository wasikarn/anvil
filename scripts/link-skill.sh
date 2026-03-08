#!/usr/bin/env bash
# link-skill.sh — Create ~/.claude/ symlinks for all assets in this repo.
# Usage:
#   bash scripts/link-skill.sh            # link everything (skills, agents, hooks, output-styles, commands)
#   bash scripts/link-skill.sh spec-kit   # link one skill by name
#   bash scripts/link-skill.sh --list     # show current link status

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Asset types: repo_subdir:claude_target
ASSET_TYPES="skills:$HOME/.claude/skills agents:$HOME/.claude/agents output-styles:$HOME/.claude/output-styles hooks:$HOME/.claude/hooks commands:$HOME/.claude/commands"

# ── Helpers ───────────────────────────────────────────────────────────────────
link_item() {
  local src="$1"
  local dst="$2"
  local name
  name=$(basename "$src")

  if [ -L "$dst" ]; then
    local existing
    existing=$(readlink "$dst")
    if [ "$existing" = "$src" ]; then
      echo "  ✓ $name — already linked"
      return 0
    fi
    echo "  ~ $name — relinking ($existing → $src)"
    ln -sf "$src" "$dst"
  elif [ -e "$dst" ]; then
    echo "  ✗ $name — $dst exists and is not a symlink, skipping" >&2
    return 1
  else
    ln -s "$src" "$dst"
    echo "  + $name — linked"
  fi
}

link_asset_type() {
  local type="$1"
  local dst_dir="$2"
  local src_dir="$REPO_ROOT/$type"

  [ -d "$src_dir" ] || return 0
  mkdir -p "$dst_dir"

  local found=0
  for item in "$src_dir"/*; do
    [ -e "$item" ] || continue
    found=1
    link_item "$item" "$dst_dir/$(basename "$item")"
  done

  if [ $found -eq 0 ]; then
    echo "  (no items in $type/)"
  fi
}

list_status() {
  for entry in $ASSET_TYPES; do
    local type="${entry%%:*}"
    local dst_dir="${entry#*:}"
    local src_dir="$REPO_ROOT/$type"

    [ -d "$src_dir" ] || continue

    echo ""
    echo "$type:"
    for item in "$src_dir"/*; do
      [ -e "$item" ] || continue
      local name
      name=$(basename "$item")
      local dst="$dst_dir/$name"
      local target
      target=$(readlink "$dst" 2>/dev/null) \
        && echo "  ✓ $name → $target" \
        || echo "  ✗ $name (not linked)"
    done
  done
}

link_one_skill() {
  local name="$1"
  local src="$REPO_ROOT/skills/$name"
  local dst="$HOME/.claude/skills/$name"

  if [ ! -d "$src" ]; then
    echo "  ✗ $name — not found in skills/" >&2
    return 1
  fi

  mkdir -p "$HOME/.claude/skills"
  link_item "$src" "$dst"
}

# ── Main ──────────────────────────────────────────────────────────────────────
case "${1:-}" in
  --list)
    list_status
    ;;
  "")
    echo "Linking all assets → ~/.claude/"
    for entry in $ASSET_TYPES; do
      type="${entry%%:*}"
      dst_dir="${entry#*:}"
      echo ""
      echo "[$type]"
      link_asset_type "$type" "$dst_dir"
    done
    ;;
  *)
    link_one_skill "$1"
    ;;
esac
