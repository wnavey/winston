#!/usr/bin/env bash
#
# trigger-diligence.sh — kick off a Phase 1 diligence run via prod substation.
#
# This is the curl block from the TL;DR section of testing-kickoff.md,
# wrapped with input validation, pretty-printing, and a one-liner that
# surfaces the resulting cityhall URL.
#
# REQUIRED env vars:
#   PROD_SUBSTATION_URL   e.g. https://substation-noetic.vercel.app
#   TOKEN                 Supabase JWT from a signed-in prod cityhall session
#                         (DevTools → Application → Cookies → sb-<ref>-auth-token
#                          → copy the access_token JSON field)
#   PROJECT_ID            prod project UUID (from Step 1 of testing-kickoff.md)
#   DV_ID                 feasibility_intake document_version UUID (also Step 1)
#
# OPTIONAL env vars:
#   CONVERSATION_ID       stamps the diligence_runs row with the chat thread FK,
#                         so the run is traceable back to the conversation later
#   PROD_CITYHALL_URL     e.g. https://app.noetic.inc — when set, the script
#                         prints the watch URL for the run after triggering
#
# USAGE (one-shot, vars on the same line):
#   PROD_SUBSTATION_URL=https://... TOKEN=eyJ... \
#   PROJECT_ID=... DV_ID=... \
#   ./trigger-diligence.sh
#
# USAGE (preferred — keep your vars in a gitignored file and source it):
#   source ~/.config/field-agent-diligence.env  # not checked in anywhere
#   ./trigger-diligence.sh
#
# DEPENDENCIES: bash, curl. jq is optional but recommended for nicer output.
#

set -euo pipefail

require() {
  local var="$1"
  if [ -z "${!var:-}" ]; then
    echo "ERROR: missing required env var: $var" >&2
    return 1
  fi
}

require PROD_SUBSTATION_URL
require TOKEN
require PROJECT_ID
require DV_ID

URL="${PROD_SUBSTATION_URL%/}/api/projects/${PROJECT_ID}/diligence"

if [ -n "${CONVERSATION_ID:-}" ]; then
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
  -H "Authorization: Bearer $TOKEN" \
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
  if [ -n "${PROD_CITYHALL_URL:-}" ]; then
    echo "Watch it:  ${PROD_CITYHALL_URL%/}/project/${PROJECT_ID}/diligence-runs/${DLR_ID}"
  else
    echo "(set PROD_CITYHALL_URL to also print the watch URL)"
  fi
fi
