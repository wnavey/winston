#!/usr/bin/env bash
# Launch the viewer. Serves measure-distance-tool/ as the web root so
# the HTML can reach both viewer/manifest.json and runs/test-script-2026-04-15/...
#
# Usage:
#   ./serve.sh          # serves on http://localhost:8401
#   ./serve.sh 9001     # custom port
#
# Ctrl-C to stop.

set -euo pipefail
PORT="${1:-8401}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$HERE/.." && pwd)"

# Regenerate the manifest first so new runs are picked up.
python3 "$HERE/build-manifest.py"

URL="http://localhost:${PORT}/viewer/"
echo ""
echo "serving from: $WORKSPACE_ROOT"
echo "open:         $URL"
echo ""

# Open in the default browser (macOS); skip silently elsewhere.
if command -v open >/dev/null 2>&1; then
  ( sleep 0.5; open "$URL" ) &
fi

cd "$WORKSPACE_ROOT"
exec python3 -m http.server "$PORT"
