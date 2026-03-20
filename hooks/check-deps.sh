#!/usr/bin/env bash
# check-deps.sh — SessionStart hook (startup)
# Checks required tools for dev-loop plugin.
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
check "git" "pre-installed on most systems"            "required by all DLC skills"
check "gh"  "brew install gh && gh auth login"         "required by dlc-build, dlc-review, dlc-respond, dlc-debug, merge-pr"
check "rtk" "brew install rtk  (https://rtk-ai.app/)" "recommended — token-optimized git/gh output in DLC skills"

if [ -n "$MISSING" ]; then
  printf "## ⚠️  dev-loop: Missing Dependencies\n\nThe following tools are not installed. Some skills and hooks will not work correctly:\n%b\n\nInstall missing tools and restart Claude Code to dismiss this warning.\n" "$MISSING"
fi

# Optional: atlassian-pm plugin
# Detection: check enabledPlugins in settings files for atlassian-pm@atlassian-pm.
SETTINGS_FILES="$HOME/.claude/settings.json $HOME/.claude/settings.local.json"
ATLASSIAN_PM_FOUND=0
for f in $SETTINGS_FILES; do
  if [ -f "$f" ] && grep -q "atlassian-pm@atlassian-pm" "$f" 2>/dev/null; then
    ATLASSIAN_PM_FOUND=1
    break
  fi
done

if [ "$ATLASSIAN_PM_FOUND" -eq 0 ]; then
  printf "\n## 💡 dev-loop: Optional Enhancement\n\n- \`atlassian-pm\` (not installed)\n  Install: \`claude plugin marketplace add wasikarn/atlassian-pm && claude plugin install atlassian-pm\`\n  Unlocks: Jira context in all DLC skills, ADF comment formatting, sprint digest in work-context.\n"
fi
