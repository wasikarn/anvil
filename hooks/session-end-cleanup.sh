#!/usr/bin/env bash
# session-end-cleanup.sh — SessionEnd hook (async)
# Cleans up temporary session files on session end.
# Preserves artifact .md files (they survive across sessions for recovery).
# Only removes .tmp and .lock files that may have been left behind.

# NOTE: no set -euo pipefail — hook must exit 0 on all failures
# shellcheck source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
PLUGIN_DATA_BASE="$(plugin_data_dir)"

[ -d "$PLUGIN_DATA_BASE" ] || exit 0

DELETED=0
while IFS= read -r -d '' file; do
  rm -f "$file"
  DELETED=$((DELETED + 1))
done < <(find "$PLUGIN_DATA_BASE" -type f \( -name "*.tmp" -o -name "*.lock" \) -print0 2>/dev/null)

if [ "$DELETED" -gt 0 ]; then
  echo "devflow: session-end cleaned up $DELETED temp file(s) from $PLUGIN_DATA_BASE/"
fi

# Clean up freeze state file
rm -f "${TMPDIR:-/tmp}/.devflow-freeze-path" 2>/dev/null || true

exit 0
