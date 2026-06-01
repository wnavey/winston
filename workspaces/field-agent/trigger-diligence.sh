#!/usr/bin/env bash
#
# trigger-diligence.sh — kick off a Phase 1 diligence run via prod substation.
#
# Fill in the CONFIG block below, save, run. The script POSTs to substation,
# pretty-prints the response, and (if PROD_CITYHALL_URL is set) tells you the
# cityhall URL to open and watch the status flip live.
#
# ⚠️  DO NOT COMMIT THIS FILE WITH REAL VALUES FILLED IN.
#     API_KEY authorizes the diligence trigger and read endpoints. Treat it
#     like any other secret. Edit locally, run, then `git restore` or
#     `git stash` before pushing — never `git add` your filled-in version.
#
# See workspaces/field-agent/testing-kickoff.md for how to obtain each value.
#

set -euo pipefail

# ─── CONFIG ──────────────────────────────────────────────────────────────────
# Fill these in. See testing-kickoff.md for where to find each one.

PROD_SUBSTATION_URL="REPLACE_ME"   # e.g. https://substation-noetic.vercel.app
PROD_CITYHALL_URL="REPLACE_ME"     # e.g. https://app.noetic.inc — for the watch URL
API_KEY="REPLACE_ME"               # value of SUBSTATION_SERVICE_API_KEY (set in
                                   # substation's Vercel env). Auth route-restricted
                                   # to POST/GET on diligence endpoints — see
                                   # substation/src/middleware/auth.ts.
PROJECT_ID="REPLACE_ME"            # prod project UUID
DV_ID="REPLACE_ME"                 # feasibility_intake document_version UUID
CONVERSATION_ID=""                 # optional — leave empty string to skip

# ─── END CONFIG ──────────────────────────────────────────────────────────────

# Refuse to run with placeholder values for the required fields.
for var in PROD_SUBSTATION_URL API_KEY PROJECT_ID DV_ID; do
  if [ "${!var}" = "REPLACE_ME" ] || [ -z "${!var}" ]; then
    echo "ERROR: $var is unset or still set to 'REPLACE_ME'." >&2
    echo "       Edit the CONFIG block at the top of $0 and try again." >&2
    exit 1
  fi
done

URL="${PROD_SUBSTATION_URL%/}/api/projects/${PROJECT_ID}/diligence"

if [ -n "$CONVERSATION_ID" ]; then
  BODY=$(printf '{"document_version_id":"%s","conversation_id":"%s"}' "$DV_ID" "$CONVERSATION_ID")
else
  BODY=$(printf '{"document_version_id":"%s"}' "$DV_ID")
fi

echo "POST $URL"
echo "Body: $BODY"
echo

RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$RESPONSE_FILE"' EXIT

HTTP_STATUS=$(curl -s -o "$RESPONSE_FILE" -w "%{http_code}" \
  -X POST "$URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY")

echo "HTTP $HTTP_STATUS"

if command -v jq >/dev/null 2>&1; then
  jq . < "$RESPONSE_FILE"
else
  cat "$RESPONSE_FILE"
  echo
fi

if [ "$HTTP_STATUS" -ne 201 ]; then
  echo "ERROR: expected 201 Created, got $HTTP_STATUS" >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  DLR_ID=$(jq -r '.id' < "$RESPONSE_FILE")
  echo
  echo "Run id:    $DLR_ID"
  if [ "$PROD_CITYHALL_URL" != "REPLACE_ME" ] && [ -n "$PROD_CITYHALL_URL" ]; then
    echo "Watch it:  ${PROD_CITYHALL_URL%/}/project/${PROJECT_ID}/diligence-runs/${DLR_ID}"
  fi
fi
