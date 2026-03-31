#!/usr/bin/env bash
# qa-check.sh — Full QA check for the devflow plugin.
#
# Usage:
#   ./scripts/qa-check.sh               # check repo working copy
#   ./scripts/qa-check.sh <plugin-dir>  # check installed plugin at path
#
# Exit code 0 = all checks passed. Exit code 1 = one or more failures.
# Degrades gracefully: shellcheck and markdownlint-cli2 are skipped if not installed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── target directory ──────────────────────────────────────────────────────────

if [ $# -ge 1 ]; then
  PLUGIN_DIR="$(cd "$1" && pwd)"
else
  PLUGIN_DIR="$REPO_ROOT"
fi

# ── color helpers ─────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

# Parallel-safe output helpers.
# When run in a subshell, OUTFILE and RESULTFILE are set per-check.
# Fallback to /dev/stdout (direct output) and /dev/null (discard count) when unset.
# SC2317/SC2329: functions are invoked indirectly via "check_${N}" subshells and restored below.
# shellcheck disable=SC2317,SC2329
pass()    { echo -e "  ${GREEN}✓${NC} $*" >> "${OUTFILE:-/dev/stdout}"; echo "PASS" >> "${RESULTFILE:-/dev/null}"; }
# shellcheck disable=SC2317,SC2329
fail()    { echo -e "  ${RED}✗${NC} $*"   >> "${OUTFILE:-/dev/stdout}"; echo "FAIL" >> "${RESULTFILE:-/dev/null}"; }
# shellcheck disable=SC2317,SC2329
skip()    { echo -e "  ${YELLOW}–${NC} $*" >> "${OUTFILE:-/dev/stdout}"; echo "SKIP" >> "${RESULTFILE:-/dev/null}"; }
# shellcheck disable=SC2317,SC2329
section() { echo ""                         >> "${OUTFILE:-/dev/stdout}"; echo -e "${CYAN}$*${NC}" >> "${OUTFILE:-/dev/stdout}"; }

# Temp dir for parallel check output isolation
QA_TMPDIR=$(mktemp -d)
trap 'rm -rf "$QA_TMPDIR"' EXIT

# ── check functions ────────────────────────────────────────────────────────────

check_1() {
  section "1. shellcheck"

  if ! command -v shellcheck > /dev/null 2>&1; then
    skip "shellcheck not installed — skipping"
  else
    HOOKS_DIR="$PLUGIN_DIR/hooks"
    SCRIPTS_DIR="$PLUGIN_DIR/scripts"

    SH_FILES=()
    while IFS= read -r -d '' f; do SH_FILES+=("$f"); done \
      < <(find "$HOOKS_DIR" "$SCRIPTS_DIR" -name "*.sh" -print0 2>/dev/null | sort -z)

    if [ ${#SH_FILES[@]} -eq 0 ]; then
      skip "No .sh files found"
    elif shellcheck "${SH_FILES[@]}" >> "${OUTFILE:-/dev/stdout}" 2>&1; then
      pass "shellcheck — ${#SH_FILES[@]} scripts OK"
    else
      fail "shellcheck — errors found in one or more scripts"
    fi
  fi
}

check_2() {
  section "2. markdownlint"

  if ! command -v markdownlint-cli2 > /dev/null 2>&1; then
    skip "markdownlint-cli2 not installed — skipping"
  else
    MD_OUTPUT=$(
      cd "$PLUGIN_DIR" || exit 0
      markdownlint-cli2 "**/*.md" 2>&1 || true
    )
    MD_ERRORS=$(echo "$MD_OUTPUT" | grep "^Summary:" | grep -oE '[0-9]+' | head -1 || true)
    MD_FILES=$(echo "$MD_OUTPUT" | grep "^Linting:" | grep -oE '[0-9]+' | head -1 || true)
    if [ "${MD_ERRORS:-0}" -eq 0 ]; then
      pass "markdownlint — ${MD_FILES:-?} files, 0 errors"
    else
      fail "markdownlint — $MD_ERRORS error(s) across $MD_FILES file(s)"
      echo "$MD_OUTPUT" | grep -v "^Finding:\|^Linting:\|^Summary:\|markdownlint-cli2" | head -20 >> "${OUTFILE:-/dev/stdout}" || true
    fi
  fi
}

check_3() {
  section "3. plugin validate"

  if ! command -v claude > /dev/null 2>&1; then
    skip "claude CLI not found — skipping"
  else
    VALIDATE_OUT=$(claude plugin validate "$PLUGIN_DIR" 2>&1)
    if echo "$VALIDATE_OUT" | grep -q "Validation passed"; then
      pass "claude plugin validate"
    else
      fail "claude plugin validate — see output:"
      echo "$VALIDATE_OUT" >> "${OUTFILE:-/dev/stdout}"
    fi
  fi
}

check_4() {
  section "4. relative links"

  BROKEN_LINKS=$(python3 - "$PLUGIN_DIR" <<'PY'
import os, re, subprocess, sys

root = sys.argv[1]
broken = []

# Use git ls-files when inside a git repo — respects .gitignore automatically.
# Fall back to os.walk when checking an installed plugin path (not a git repo).
try:
    result = subprocess.run(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '*.md'],
        cwd=root, capture_output=True, text=True, check=True
    )
    md_files = [os.path.join(root, p) for p in result.stdout.splitlines()]
except Exception:
    md_files = []
    for dirpath, _, files in os.walk(root):
        for fname in files:
            if fname.endswith('.md'):
                md_files.append(os.path.join(dirpath, fname))

for filepath in md_files:
    if not os.path.isfile(filepath):
        continue
    dirpath = os.path.dirname(filepath)
    with open(filepath, 'r', errors='replace') as f:
        lines = f.readlines()
    for i, line in enumerate(lines, 1):
        for m in re.finditer(r'\[([^\]]*)\]\(([^)#\s]+)', line):
            link = m.group(2)
            if link.startswith('http') or link.startswith('mailto'):
                continue
            target = os.path.normpath(os.path.join(dirpath, link))
            if not os.path.exists(target):
                rel_file = os.path.relpath(filepath, root)
                broken.append(f"    {rel_file}:{i} -> {link}")

for b in broken:
    print(b)
PY
  )

  if [ -z "$BROKEN_LINKS" ]; then
    pass "relative links — 0 broken"
  else
    LINK_COUNT=$(echo "$BROKEN_LINKS" | wc -l | tr -d ' ')
    fail "relative links — $LINK_COUNT broken link(s):"
    echo "$BROKEN_LINKS" >> "${OUTFILE:-/dev/stdout}"
  fi
}

check_5() {
  section "5. hooks.json script references"

  HOOKS_JSON="$PLUGIN_DIR/hooks/hooks.json"
  if [ ! -f "$HOOKS_JSON" ]; then
    fail "hooks/hooks.json not found"
  else
    MISSING_HOOKS=$(python3 - "$HOOKS_JSON" "$PLUGIN_DIR" <<'PY'
import json, os, sys, re

hooks_json, plugin_dir = sys.argv[1], sys.argv[2]
with open(hooks_json) as f:
    data = json.load(f)

missing = []

def check_entries(entries):
    for entry in entries:
        for cmd in entry.get('hooks', []):
            command = cmd.get('command', '')
            for part in re.findall(r'\$\{?CLAUDE_PLUGIN_ROOT\}?/hooks/(\S+\.sh)', command):
                script = os.path.join(plugin_dir, 'hooks', part)
                if not os.path.exists(script):
                    missing.append(f"    {part}")

for event, entries in data.get('hooks', {}).items():
    check_entries(entries)

for m in missing:
    print(m)
PY
    )

    if [ -z "$MISSING_HOOKS" ]; then
      pass "hooks.json — all script references found"
    else
      COUNT=$(echo "$MISSING_HOOKS" | wc -l | tr -d ' ')
      fail "hooks.json — $COUNT missing script(s):"
      echo "$MISSING_HOOKS" >> "${OUTFILE:-/dev/stdout}"
    fi
  fi
}

check_6() {
  section "6. SKILL.md frontmatter"

  SKILLS_DIR="$PLUGIN_DIR/skills"
  FM_ISSUES=""
  if [ -d "$SKILLS_DIR" ]; then
    for skill_dir in "$SKILLS_DIR"/*/; do
      skill_name=$(basename "$skill_dir")
      skill_file="$skill_dir/SKILL.md"
      if [ ! -f "$skill_file" ]; then
        FM_ISSUES="${FM_ISSUES}    MISSING SKILL.md: $skill_name\n"
        continue
      fi
      for field in name description; do
        grep -q "^$field:" "$skill_file" || FM_ISSUES="${FM_ISSUES}    MISSING $field: $skill_name/SKILL.md\n"
      done
    done
  fi

  if [ -z "$FM_ISSUES" ]; then
    SKILL_COUNT=$(find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    pass "SKILL.md frontmatter — $SKILL_COUNT skills OK"
  else
    fail "SKILL.md frontmatter issues:"
    printf "%b" "$FM_ISSUES" >> "${OUTFILE:-/dev/stdout}"
  fi
}

check_7() {
  section "7. agent frontmatter + models"

  AGENTS_DIR="$PLUGIN_DIR/agents"
  AGENT_ISSUES=$(python3 - "$AGENTS_DIR" <<'PY'
import os, sys, re

agents_dir = sys.argv[1]
if not os.path.isdir(agents_dir):
    sys.exit(0)

valid_models = {
    'haiku', 'sonnet', 'opus',
    'claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6',
}
issues = []

for fname in sorted(os.listdir(agents_dir)):
    if not fname.endswith('.md'):
        continue
    with open(os.path.join(agents_dir, fname)) as f:
        content = f.read()
    for field in ('name', 'description'):
        if not re.search(rf'^{field}:', content, re.MULTILINE):
            issues.append(f"    MISSING {field}: {fname}")
    m = re.search(r'^model:\s*(.+)$', content, re.MULTILINE)
    if m and m.group(1).strip() not in valid_models:
        issues.append(f"    UNKNOWN model '{m.group(1).strip()}': {fname}")

for i in issues:
    print(i)
PY
  )

  if [ -z "$AGENT_ISSUES" ]; then
    AGENT_COUNT=$(find "$AGENTS_DIR" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    pass "agent frontmatter — $AGENT_COUNT agents OK"
  else
    COUNT=$(echo "$AGENT_ISSUES" | wc -l | tr -d ' ')
    fail "agent issues ($COUNT):"
    echo "$AGENT_ISSUES" >> "${OUTFILE:-/dev/stdout}"
  fi
}

check_8() {
  section "8. plugin.json"

  PLUGIN_JSON="$PLUGIN_DIR/.claude-plugin/plugin.json"
  if [ ! -f "$PLUGIN_JSON" ]; then
    fail "plugin.json not found"
  else
    PLUGIN_ISSUES=$(python3 - "$PLUGIN_JSON" <<'PY'
import json, sys
required = ['name', 'version', 'description', 'author', 'license']
with open(sys.argv[1]) as f:
    d = json.load(f)
missing = [k for k in required if k not in d]
for m in missing:
    print(f"    MISSING field: {m}")
PY
    )

    if [ -z "$PLUGIN_ISSUES" ]; then
      VERSION=$(python3 -c "import json; print(json.load(open('$PLUGIN_JSON'))['version'])")
      pass "plugin.json — version $VERSION, all required fields present"
    else
      fail "plugin.json:"
      echo "$PLUGIN_ISSUES" >> "${OUTFILE:-/dev/stdout}"
    fi
  fi
}

check_9() {
  PLUGIN_JSON="$PLUGIN_DIR/.claude-plugin/plugin.json"

  section "9. CHANGELOG"

  CHANGELOG="$PLUGIN_DIR/CHANGELOG.md"
  if [ ! -f "$CHANGELOG" ]; then
    fail "CHANGELOG.md not found"
  else
    VERSION=$(python3 -c "import json; print(json.load(open('$PLUGIN_JSON'))['version'])" 2>/dev/null || echo "?")
    if grep -q "\[$VERSION\]" "$CHANGELOG"; then
      pass "CHANGELOG.md — v$VERSION entry found"
    else
      fail "CHANGELOG.md — missing entry for v$VERSION"
    fi
  fi
}

check_10() {
  section "10. required files"

  for required_file in LICENSE README.md; do
    if [ -f "$PLUGIN_DIR/$required_file" ]; then
      pass "$required_file found"
    else
      fail "$required_file missing"
    fi
  done
}

check_11() {
  section "11. CLAUDE.md size (< 200 lines)"

  SIZE_ISSUES=""
  while IFS= read -r -d '' f; do
    lines=$(wc -l < "$f")
    rel=$(python3 -c "import os; print(os.path.relpath('$f', '$PLUGIN_DIR'))")
    if [ "$lines" -gt 200 ]; then
      SIZE_ISSUES="${SIZE_ISSUES}    LARGE ($lines lines): $rel\n"
    fi
  done < <(find "$PLUGIN_DIR" -name "CLAUDE.md" -print0 2>/dev/null)

  if [ -z "$SIZE_ISSUES" ]; then
    pass "all CLAUDE.md files within 200-line budget"
  else
    fail "CLAUDE.md size issues:"
    printf "%b" "$SIZE_ISSUES" >> "${OUTFILE:-/dev/stdout}"
  fi
}

check_13() {
  section "13. CLAUDE.md doc consistency"

  ROOT_CLAUDE="$PLUGIN_DIR/CLAUDE.md"
  if [ ! -f "$ROOT_CLAUDE" ]; then
    skip "CLAUDE.md not found — skipping"
    return
  fi

  # ── 13a. agent count ───────────────────────────────────────────────────────
  ACTUAL_AGENTS=$(grep -l "^name:" "$PLUGIN_DIR/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
  CLAIMED_AGENTS=$(grep -oE 'Current agents \([0-9]+\)' "$ROOT_CLAUDE" | grep -oE '[0-9]+' | head -1)
  if [ -z "$CLAIMED_AGENTS" ]; then
    skip "agent count — 'Current agents (N):' not found in CLAUDE.md"
  elif [ "$ACTUAL_AGENTS" -eq "$CLAIMED_AGENTS" ]; then
    pass "agent count — $ACTUAL_AGENTS agents match CLAUDE.md claim"
  else
    fail "agent count — CLAUDE.md says $CLAIMED_AGENTS but found $ACTUAL_AGENTS agents with name: frontmatter"
  fi

  # ── 13b. hook registration count ──────────────────────────────────────────
  HOOKS_JSON="$PLUGIN_DIR/hooks/hooks.json"
  if ! command -v jq > /dev/null 2>&1; then
    skip "hook count — jq not installed"
  elif [ ! -f "$HOOKS_JSON" ]; then
    skip "hook count — hooks/hooks.json not found"
  else
    ACTUAL_HOOKS=$(jq '[.hooks | to_entries[].value[].hooks | length] | add // 0' "$HOOKS_JSON")
    CLAIMED_HOOKS=$(grep -oE '[0-9]+ hooks total' "$ROOT_CLAUDE" | grep -oE '^[0-9]+' | head -1)
    if [ -z "$CLAIMED_HOOKS" ]; then
      skip "hook count — 'N hooks total' not found in CLAUDE.md"
    elif [ "$ACTUAL_HOOKS" -eq "$CLAIMED_HOOKS" ]; then
      pass "hook count — $ACTUAL_HOOKS hooks match CLAUDE.md claim"
    else
      fail "hook count — CLAUDE.md says $CLAIMED_HOOKS but hooks.json has $ACTUAL_HOOKS hook entries"
    fi
  fi

  # ── 13c. QA gate count ────────────────────────────────────────────────────
  QA_SCRIPT="$PLUGIN_DIR/scripts/qa-check.sh"
  ACTUAL_GATES=$(grep -cE 'section "[0-9]+\.' "$QA_SCRIPT" 2>/dev/null || echo 0)
  CLAIMED_GATES=$(grep -oE '[0-9]+ gates' "$ROOT_CLAUDE" | grep -oE '^[0-9]+' | head -1)
  if [ -z "$CLAIMED_GATES" ]; then
    skip "gate count — 'N gates' not found in CLAUDE.md"
  elif [ "$ACTUAL_GATES" -eq "$CLAIMED_GATES" ]; then
    pass "gate count — $ACTUAL_GATES gates match CLAUDE.md claim"
  else
    fail "gate count — CLAUDE.md says $CLAIMED_GATES but qa-check.sh has $ACTUAL_GATES check functions"
  fi
}

# ── parallel execution (checks 1–11, 13) ─────────────────────────────────────

for N in 1 2 3 4 5 6 7 8 9 10 11 13; do
  OUTFILE="$QA_TMPDIR/check-${N}.out"
  RESULTFILE="$QA_TMPDIR/check-${N}.result"
  (
    export OUTFILE RESULTFILE
    "check_${N}"
  ) &
done

# Wait for all parallel checks to complete
set +e
wait
set -e

# Print results in order
for N in 1 2 3 4 5 6 7 8 9 10 11 13; do
  cat "$QA_TMPDIR/check-${N}.out" 2>/dev/null || true
done

# Sum counters from result files
for N in 1 2 3 4 5 6 7 8 9 10 11 13; do
  RESULTFILE="$QA_TMPDIR/check-${N}.result"
  if [ -f "$RESULTFILE" ]; then
    while IFS= read -r verdict; do
      case "$verdict" in
        PASS) PASS=$((PASS + 1)) ;;
        FAIL) FAIL=$((FAIL + 1)) ;;
        SKIP) SKIP=$((SKIP + 1)) ;;
      esac
    done < "$RESULTFILE"
  fi
done

# ── restore direct-output helpers for sequential check 12 ─────────────────────
pass()    { echo -e "  ${GREEN}✓${NC} $*"; PASS=$((PASS + 1)); }
fail()    { echo -e "  ${RED}✗${NC} $*";   FAIL=$((FAIL + 1)); }
skip()    { echo -e "  ${YELLOW}–${NC} $*"; SKIP=$((SKIP + 1)); }
section() { echo ""; echo -e "${CYAN}$*${NC}"; }

# ── 12. bats hook tests ───────────────────────────────────────────────────────

section "12. bats hook tests"

TESTS_DIR="$REPO_ROOT/tests/hooks"
if ! command -v bats > /dev/null 2>&1; then
  skip "bats not installed — skipping (brew install bats-core)"
elif [ ! -d "$TESTS_DIR" ]; then
  skip "tests/hooks/ not found — skipping"
else
  # Capture output once to avoid double-execution on flaky tests
  BATS_OUT=$(bats --tap "$TESTS_DIR" 2>&1)
  BATS_STATUS=$?
  if [ "$BATS_STATUS" -eq 0 ]; then
    TEST_COUNT=$(echo "$BATS_OUT" | grep -c "^ok " || true)
    pass "bats — $TEST_COUNT tests passed"
  else
    fail "bats — one or more tests failed:"
    echo "$BATS_OUT" | tail -20
  fi
fi

# ── summary ───────────────────────────────────────────────────────────────────

TOTAL=$((PASS + FAIL + SKIP))
echo ""
echo "────────────────────────────────────────────"
echo -e "  Checked : $TOTAL"
echo -e "  ${GREEN}Passed${NC}  : $PASS"
[ "$SKIP" -gt 0 ] && echo -e "  ${YELLOW}Skipped${NC} : $SKIP"
[ "$FAIL" -gt 0 ] && echo -e "  ${RED}Failed${NC}  : $FAIL"
echo "────────────────────────────────────────────"

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}✗ QA FAILED${NC} — $FAIL check(s) need attention"
  exit 1
else
  echo -e "${GREEN}✓ QA PASSED${NC}"
fi
