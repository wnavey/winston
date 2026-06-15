#!/usr/bin/env bash
# Local re-run of VISION_CHECK_REVIEW_EL_MD_EXP_RUN_5_BACKUP, bypassing
# Substation / Inngest / Vercel Sandbox so we can diagnose hangs that the
# production sandbox path is hitting.
#
# Same workflow inputs as the production RUN_5_BACKUP Inngest event:
#   - Valley View Townhomes v1
#   - el-md-exp guide, electrical department
#   - vision-check experiment overlay
#   - enabledVisionSpecialists: generic-vision,measure-distance
#   - runs=1 (single-run; majority vote trivially satisfied)
#   - logAllAgentTrace=true (every finding carries agentTrace.tools_used)
#
# The runLabel suffix is ..._BACKUP_LOCAL so it never collides with the
# production RUN_5_BACKUP if both write to workflow_runs.
#
# Pre-run setup:
#   1. cd into /Users/winston/noetic/conductor (this script must run from there).
#   2. Source your .env so PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#      AI_GATEWAY_API_KEY, ANTHROPIC_API_KEY, etc. are exported.
#   3. (Optional) Set WORKSPACE_PATH to an absolute path you can inspect,
#      e.g. /tmp/run5-backup-local. Otherwise conductor picks a default.
#   4. (Optional) Pass --bureau-path=/path/to/bureau if conductor can't
#      auto-resolve it (defaults to a sibling lookup chain).

set -euo pipefail

if [[ ! -f "src/index.ts" ]]; then
  echo "Error: run this script from the conductor repo root."
  echo "       cd /Users/winston/noetic/conductor && bash <path-to>/run-5-backup-local.sh"
  exit 1
fi

npx tsx src/index.ts \
  --workflow=review \
  --jurisdiction=austin \
  --submission-version-id=55fb6548-814f-4287-bc4a-6018b756d730 \
  --guide-code=el-md-exp \
  --runs=1 \
  --model=claude-haiku-4-5-20251001 \
  --eval=false \
  --structure-comments=true \
  --prior-review-id= \
  --log-all-agent-trace=true \
  --review-schema-name=reviewExtended \
  --review-prompt-name=review-extended \
  --enabled-vision-specialists=generic-vision,measure-distance \
  --set-current=false \
  --department-code=el \
  --experiment=vision-check \
  --run-label=VISION_CHECK_REVIEW_EL_MD_EXP_RUN_5_BACKUP_LOCAL \
  --guides-dir=jurisdictions/austin/review-guides/el-md-exp \
  --guide-label=el-md-exp
