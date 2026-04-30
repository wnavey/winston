#!/usr/bin/env bash
# Launch the inspect-drawing debug viewer. Serves the workspace as the web
# root so the HTML can reach both viewer/manifest.json and runs/.../**/*.{jpg,txt,json}.
#
# Usage:
#   ./serve.sh          # serves on http://localhost:8402
#   ./serve.sh 9002     # custom port
#
# Ctrl-C to stop.

set -euo pipefail
PORT="${1:-8402}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$HERE/.." && pwd)"

# Regenerate the manifest first so new runs are picked up.
python3 "$HERE/build-manifest.py"

URL="http://localhost:${PORT}/viewer/"
echo ""
echo "serving from: $WORKSPACE_ROOT"
echo "open:         $URL"
echo ""

if command -v open >/dev/null 2>&1; then
  ( sleep 0.5; open "$URL" ) &
fi

cd "$WORKSPACE_ROOT"
exec python3 -m http.server "$PORT"
