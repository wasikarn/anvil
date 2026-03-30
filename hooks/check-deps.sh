#!/usr/bin/env bash
# check-deps.sh — SessionStart hook (startup)
# Checks required tools for devflow plugin.
# Outputs a warning to Claude's context if any are missing.
# Silent if all tools are present.

MISSING=""

check() {
  local tool="$1" install="$2" note="$3"
  if ! command -v "$tool" > /dev/null 2>&1; then
    MISSING="${MISSING}\n- \`${tool}\` — ${note}\n  Install: ${install}"
  fi
}

check "jq"  "brew install jq"                          "required by workflow hooks"
check "git" "pre-installed on most systems"            "required by all Devflow skills"
check "gh"  "brew install gh && gh auth login"         "required by build, review, respond, debug, merge-pr"
check "rtk" "brew install rtk  (https://rtk-ai.app/)" "recommended — token-optimized git/gh output in Devflow skills"

if [ -n "$MISSING" ]; then
  printf "## ⚠️  devflow: Missing Dependencies\n\nThe following tools are not installed. Some skills and hooks will not work correctly:\n%b\n\nInstall missing tools and restart Claude Code to dismiss this warning.\n" "$MISSING"
fi

# Optional: atlassian-pm plugin
# Detection: check settings files for "atlassian-pm" key (stored without @scope suffix)
# or fall back to plugin cache directory presence.
SETTINGS_FILES="$HOME/.claude/settings.json $HOME/.claude/settings.local.json"
ATLASSIAN_PM_FOUND=0
for f in $SETTINGS_FILES; do
  if [ -f "$f" ] && grep -q '"atlassian-pm"' "$f" 2>/dev/null; then
    ATLASSIAN_PM_FOUND=1
    break
  fi
done
# Fallback: plugin cache directory (created on install regardless of settings format)
if [ "$ATLASSIAN_PM_FOUND" -eq 0 ] && [ -d "$HOME/.claude/plugins/cache/atlassian-pm" ]; then
  ATLASSIAN_PM_FOUND=1
fi

if [ "$ATLASSIAN_PM_FOUND" -eq 0 ]; then
  printf "\n## 💡 devflow: Optional Enhancement\n\n- \`atlassian-pm\` (not installed)\n  Install: \`claude plugin marketplace add wasikarn/atlassian-pm && claude plugin install atlassian-pm\`\n  Unlocks: Jira context in all Devflow skills, ADF comment formatting, sprint digest in work-context.\n"
fi

# Optional: devflow-engine dependencies
ENGINE_DIR="$(cd "$(dirname "$0")/.." && pwd)/devflow-engine"
if [ -d "$ENGINE_DIR" ] && [ ! -d "$ENGINE_DIR/node_modules" ]; then
  if ! command -v bun > /dev/null 2>&1; then
    printf "\n## 💡 devflow-engine: Setup Required\n\n- \`bun\` not installed (required for devflow-engine)\n  Install: \`curl -fsSL https://bun.sh/install | bash\`\n- Then run: \`cd %s && bun install\`\n  Unlocks: SDK-accelerated review mode (resolve, falsify, plan-challenge)\n" "$ENGINE_DIR"
  else
    printf "\n## 💡 devflow-engine: Setup Required\n\n- \`devflow-engine\` dependencies not installed\n  Run: \`cd %s && bun install\`\n  Unlocks: SDK-accelerated review mode (resolve, falsify, plan-challenge)\n" "$ENGINE_DIR"
  fi
fi
