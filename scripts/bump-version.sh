#!/usr/bin/env bash
# bump-version.sh — Bump plugin version across all files, tag, push, and create GitHub release.
#
# Usage:
#   ./scripts/bump-version.sh <version>   # explicit: 0.6.0
#   ./scripts/bump-version.sh patch       # auto-increment patch: 0.5.0 → 0.5.1
#   ./scripts/bump-version.sh minor       # auto-increment minor: 0.5.0 → 0.6.0
#   ./scripts/bump-version.sh major       # auto-increment major: 0.5.0 → 1.0.0
#
# Steps:
#   1. Validate version + working tree clean
#   2. Auto-generate CHANGELOG entry from git log + release title, confirm
#   3. Update plugin.json, marketplace.json, CHANGELOG.md
#   4. Commit, tag v<new>, push --tags
#   5. Create GitHub release with auto-generated notes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# ── color helpers ─────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}→${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

# ── helpers ───────────────────────────────────────────────────────────────────

current_version() {
  python3 -c "import json; print(json.load(open('.claude-plugin/plugin.json'))['version'])" \
    || die "Could not read version from .claude-plugin/plugin.json"
}

auto_bump() {
  local current="$1" bump_type="$2"
  python3 - "$current" "$bump_type" <<'PY'
import sys
parts = sys.argv[1].split('.')
major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
t = sys.argv[2]
if t == 'major':   print(f"{major+1}.0.0")
elif t == 'minor': print(f"{major}.{minor+1}.0")
elif t == 'patch': print(f"{major}.{minor}.{patch+1}")
PY
}

update_json_version() {
  local file="$1" version="$2"
  python3 - "$file" "$version" <<'PY'
import json, sys
path, version = sys.argv[1], sys.argv[2]
data = json.load(open(path))
# Handle both top-level and nested plugins[0] structures
if 'version' in data:
    data['version'] = version
if 'plugins' in data and data['plugins']:
    data['plugins'][0]['version'] = version
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
PY
}

# ── parse arg ─────────────────────────────────────────────────────────────────

ARG="${1:-}"
[[ -n "$ARG" ]] || die "Usage: $0 <version|patch|minor|major>"

CURRENT=$(current_version)

case "$ARG" in
  patch|minor|major)
    NEW_VERSION=$(auto_bump "$CURRENT" "$ARG")
    ;;
  [0-9]*)
    [[ "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
      || die "Invalid version '$ARG' — must be semver X.Y.Z"
    NEW_VERSION="$ARG"
    ;;
  *)
    die "Invalid argument '$ARG' — expected a version number or patch/minor/major"
    ;;
esac

[[ "$NEW_VERSION" != "$CURRENT" ]] || die "Already at version $CURRENT"

# ── working tree must be clean ────────────────────────────────────────────────

if ! git diff --quiet || ! git diff --cached --quiet; then
  die "Working tree has uncommitted changes — commit or stash first"
fi

# ── qa check ──────────────────────────────────────────────────────────────────

info "Running QA checks..."
if ! bash "$SCRIPT_DIR/qa-check.sh" 2>&1; then
  die "QA checks failed — fix issues before releasing"
fi

# ── preview ───────────────────────────────────────────────────────────────────

echo ""
echo -e "  ${CYAN}dev-loop${NC}  ${YELLOW}$CURRENT${NC} → ${GREEN}$NEW_VERSION${NC}"
echo ""
read -r -p "Release title (e.g. 'Centralized Artifact Paths'): " RELEASE_TITLE
[[ -n "$RELEASE_TITLE" ]] || die "Release title cannot be empty"
echo ""

# ── 1. auto-generate CHANGELOG entry ─────────────────────────────────────────

TODAY=$(date +%Y-%m-%d)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# Collect commits since last tag (skip chore: bump version commits)
if [ -n "$LAST_TAG" ]; then
  COMMITS=$(git log "${LAST_TAG}..HEAD" --oneline --no-merges \
    | grep -v "^[a-f0-9]* chore: bump version" \
    | sed 's/^[a-f0-9]* /- /' \
    || true)
else
  COMMITS=$(git log --oneline --no-merges | sed 's/^[a-f0-9]* /- /' || true)
fi

CHANGELOG_ENTRY="## [$NEW_VERSION] — $TODAY

### $RELEASE_TITLE
${COMMITS:+
$COMMITS}"

echo "  CHANGELOG entry preview:"
echo "────────────────────────────────────────────"
echo "$CHANGELOG_ENTRY"
echo "────────────────────────────────────────────"
echo ""

# ── 2. update JSON files ──────────────────────────────────────────────────────

info "Updating .claude-plugin/plugin.json..."
update_json_version ".claude-plugin/plugin.json" "$NEW_VERSION"
ok "plugin.json → $NEW_VERSION"

info "Updating .claude-plugin/marketplace.json..."
update_json_version ".claude-plugin/marketplace.json" "$NEW_VERSION"
ok "marketplace.json → $NEW_VERSION"

# ── 2. confirm ────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────────────────"
echo "  Files to commit:"
git diff --name-only | sed 's/^/    /'
echo "    CHANGELOG.md"
echo ""
echo -e "  Tag    : ${GREEN}v${NEW_VERSION}${NC}"
echo -e "  Title  : v${NEW_VERSION} — ${RELEASE_TITLE}"
echo "────────────────────────────────────────────"
echo ""
read -r -p "Commit, tag v$NEW_VERSION, push, and create GitHub release? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { warn "Aborted — changes left unstaged"; exit 0; }

# ── 3. update CHANGELOG.md ────────────────────────────────────────────────────

info "Updating CHANGELOG.md..."
# Prepend new entry after the first line (# Changelog header)
python3 - "$CHANGELOG_ENTRY" <<'PY'
import sys
entry = sys.argv[1]
with open("CHANGELOG.md", "r") as f:
    lines = f.readlines()
# Insert before the first ## [ version entry (after header + intro paragraph)
insert_at = len(lines)
for i, line in enumerate(lines):
    if line.startswith("## ["):
        insert_at = i
        break
lines.insert(insert_at, entry + "\n")
with open("CHANGELOG.md", "w") as f:
    f.writelines(lines)
PY
ok "CHANGELOG.md updated"

# ── 4. commit + tag + push ────────────────────────────────────────────────────

info "Committing..."
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md
git commit -m "chore: bump version to $NEW_VERSION"
ok "Committed"

info "Tagging v$NEW_VERSION..."
git tag "v$NEW_VERSION"
ok "Tagged"

info "Pushing..."
git push origin main --tags
ok "Pushed"

# ── 4. GitHub release ─────────────────────────────────────────────────────────

REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')

info "Creating GitHub release v$NEW_VERSION..."
RELEASE_URL=$(gh release create "v$NEW_VERSION" \
  --repo "$REPO" \
  --title "v$NEW_VERSION — $RELEASE_TITLE" \
  --generate-notes)
ok "Release: $RELEASE_URL"

# ── done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}✅ $CURRENT → v$NEW_VERSION complete${NC}"
echo ""
echo "  Next steps:"
echo ""
echo -e "  ${CYAN}Fresh install:${NC}"
echo "    claude plugin marketplace update dev-loop"
echo "    claude plugin install dev-loop@dev-loop"
echo ""
echo -e "  ${CYAN}Update existing:${NC}"
echo "    claude plugin marketplace update dev-loop"
echo "    claude plugin update dev-loop@dev-loop"
echo ""
echo "  Then restart Claude Code to load v$NEW_VERSION"
