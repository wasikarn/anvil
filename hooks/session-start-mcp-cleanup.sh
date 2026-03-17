#!/usr/bin/env bash
# Kill MCP processes older than 10 minutes (orphans from force-closed sessions)
# Runs at SessionStart so new session's MCPs haven't started yet — safe for multi-session

MCP_PATTERNS=(
    "dbhub"
    "figma-developer-mcp"
    "mcp-server-sequential-thinking"
    "mcp-atlassian"
    "jira-cache-server/server.py"
    "playwright-mcp"
    "mcp-server.cjs"
)

for pattern in "${MCP_PATTERNS[@]}"; do
    while IFS= read -r pid; do
        # macOS ps uses etime= (e.g. "01:23:45" or "1-02:03:04"), convert to seconds via Python
        age=$(python3 -c "
import subprocess, sys
t = subprocess.check_output(['ps', '-p', '$pid', '-o', 'etime='], text=True).strip()
if not t: sys.exit(1)
parts = t.replace('-', ':').split(':')
m = [1, 60, 3600, 86400]
print(sum(int(p) * m[i] for i, p in enumerate(reversed(parts))))
" 2>/dev/null)
        if [ -n "$age" ] && [ "$age" -gt 600 ]; then
            kill "$pid" 2>/dev/null || true
        fi
    done < <(pgrep -f "$pattern" 2>/dev/null)
done
