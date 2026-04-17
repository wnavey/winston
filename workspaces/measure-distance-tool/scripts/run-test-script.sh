#!/usr/bin/env bash
# Run the test-script workflow against a measure-distance fixture.
#
# Usage:
#   ./run-test-script.sh                                           # defaults to run2 fixture
#   ./run-test-script.sh path/to/fixture.json                      # custom fixture
#   ./run-test-script.sh path/to/fixture.json --maxParallel=5      # extra conductor flags
#
# Requires: conductor and winston repos as siblings under the same parent dir.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$HERE/.." && pwd)"                     # measure-distance-tool/
WINSTON_ROOT="$(cd "$WORKSPACE_ROOT/../.." && pwd)"          # winston/
SIBLING_ROOT="$(cd "$WINSTON_ROOT/.." && pwd)"               # parent of winston/ and conductor/
CONDUCTOR_DIR="$SIBLING_ROOT/conductor"

# ── Load env ──
# Parse KEY=VALUE lines from ~/.env, skipping comments (# and ;) and blanks.
# Can't just `source` because the file may contain INI-style ; comments that
# bash treats as command separators.
ENV_FILE="$HOME/.env"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip blanks, # comments, ; comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*[#\;] ]] && continue
    # Only export lines that look like KEY=VALUE
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < "$ENV_FILE"
else
  echo "warning: $ENV_FILE not found — conductor may be missing credentials" >&2
fi

# ── Resolve fixture ──
DEFAULT_FIXTURE="$WORKSPACE_ROOT/replay/fixtures/experiment-run2-all-calls.json"
FIXTURE="${1:-$DEFAULT_FIXTURE}"
if [[ "$FIXTURE" != /* ]]; then
  FIXTURE="$(cd "$(dirname "$FIXTURE")" && pwd)/$(basename "$FIXTURE")"
fi
shift 2>/dev/null || true  # consume the fixture arg; remaining args pass through

if [ ! -f "$FIXTURE" ]; then
  echo "error: fixture not found: $FIXTURE" >&2
  exit 1
fi

if [ ! -d "$CONDUCTOR_DIR" ]; then
  echo "error: conductor repo not found at $CONDUCTOR_DIR" >&2
  echo "  expected: winston and conductor as siblings under $REPO_ROOT" >&2
  exit 1
fi

echo "fixture:   $FIXTURE"
echo "conductor: $CONDUCTOR_DIR"
echo ""

cd "$CONDUCTOR_DIR"
exec npm run conduct -- \
  --workflow=test-script \
  --jurisdiction=austin \
  --testCasesPath="$FIXTURE" \
  --maxParallel=3 \
  --clean \
  --skip-upload \
  "$@"
