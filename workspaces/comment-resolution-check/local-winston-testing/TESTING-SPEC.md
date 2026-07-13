# Local Winston Testing — CRC Conductor Run

**Status:** Draft v1
**Date:** 2026-07-13
**Repos touched:** none — operational testing plan (winston only)
**Repos referenced:** `conductor`, `bureau`

## Purpose

Drive a **local** `comment-resolution-check` (CRC) run through the conductor CLI on this
machine, for fast/cheap iteration. Inputs are copied from the Lamar + Collier "game day"
plan (`../lamar-collier-v5-game-day/DESIGN-SPEC.md`) with four deliberate changes for local
testing:

1. **`submissionVersionId` = `crcGuidesSubmissionVersionId`** — we still have no v5, so this
   runs in **smoke-test mode**: U0 guides evaluated against the U0 (v4) plans. This mode is
   explicitly supported by the schema (`submissionVersionId` "May equal
   `crcGuidesSubmissionVersionId` (smoke-test mode)").
2. **`model` = `claude-haiku-4-5-20251001`** (haiku 4.5) — cheaper/faster than the game-day
   Sonnet for local iteration.
3. **`enrichComments` = `false`** — skip the enrichment pass to cut cost/time.
4. **`runLabel` = `{YYYY-MM-DD}-{runNumber}-local-winston-test`** — date is the execution
   date; `runNumber` increments per local run that day.

Nothing is fired automatically. Run the command below yourself when ready.

## Inputs

| Input | Value | Change vs game day |
|---|---|---|
| `workflow` | `comment-resolution-check` | — |
| `jurisdiction` | `austin` | — |
| `projectId` | `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` | — |
| `submissionVersionId` | `6b9b85ed-e992-4906-a222-b24ee836910c` | **changed** → equals guides id (smoke mode) |
| `crcGuidesSubmissionVersionId` | `6b9b85ed-e992-4906-a222-b24ee836910c` (v4) | — |
| `crcGenerationNumber` | `6` | — |
| `model` | `claude-haiku-4-5-20251001` | **changed** → haiku 4.5 |
| `runs` | `5` | — |
| `maxWorkers` | `35` | — |
| `enrichComments` | `false` | **changed** → disabled |
| `runLabel` | `2026-07-13-1-local-winston-test` | **changed** → local-test format |

## Copy-paste command (kicks off the local conductor run)

Paste this into a new terminal on this box. **Update the date and run number in
`--run-label` to the actual execution date + run number before firing.**

```bash
cd ~/noetic/conductor && npm run conduct -- \
  --workflow=comment-resolution-check \
  --jurisdiction=austin \
  --project-id=23301a8a-4cdb-4751-ac0c-93b97f0f5c12 \
  --submission-version-id=6b9b85ed-e992-4906-a222-b24ee836910c \
  --crc-guides-submission-version-id=6b9b85ed-e992-4906-a222-b24ee836910c \
  --crc-generation-number=6 \
  --model=claude-haiku-4-5-20251001 \
  --runs=5 \
  --max-workers=35 \
  --enrich-comments=false \
  --run-label=2026-07-13-1-local-winston-test
```

The conductor CLI parses `--workflow` as its own flag and collects every other
`--kebab-key=value` as a workflow input, camelCasing the key
(`--crc-guides-submission-version-id` → `crcGuidesSubmissionVersionId`) and coercing
`false` → boolean and integers automatically (`src/index.ts:78-105`).

## Prerequisites

- `~/noetic/conductor/.env` populated (`cp .env.example .env`) with the Supabase +
  Anthropic Gateway credentials a local run needs.
- `~/noetic/conductor/workspace/bureau` symlink → `~/noetic/bureau` (already set up locally).
  This is where conductor reads `workflows/comment-resolution-check/workflow.yaml`.
- Guides gen 6 present in the `crc-guides` bucket at
  `23301a8a-…/cf1201c2-…/4/6/` (verified in the game-day spec).

## Notes

- Add `--clean` to wipe the workspace before starting (skips the interactive prompt).
- `--resume` continues an interrupted run; `--resume --reset-failed` also re-queues failed items.
- Because this is smoke-test mode (U0 vs U0), the output is for pipeline/plumbing validation —
  not a meaningful resolution verdict on real resubmitted plans.
