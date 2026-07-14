# 1700 S Lamar — Game Day inputs (v5 CRC)

**Status:** Draft v2
**Date:** 2026-07-14
**Repos touched:** none — operational inputs (winston only)
**Repos referenced:** `conductor`, `bureau`, `substation`

> **Revision note (v2, 2026-07-14):** v1 of this file erroneously contained
> **completeness-check-anchored** inputs for a v2→v3 run. Replaced entirely with the
> **comment-resolution-check** inputs for the v5 game day. Canonical background:
> `../comment-resolution-check/lamar-collier-v5-game-day/DESIGN-SPEC.md` (winston#160).

## Purpose

Fire the cloud **comment-resolution-check** (CRC) run for Lamar + Collier **submission v5**
(created 2026-07-14) against the v4 MCR, using generation-6 CRC guides on Sonnet 4.6.

Nothing is fired automatically. Will gives the explicit go on the exact payload below
(standing rule).

## Inputs

| Input | Value | Notes |
|---|---|---|
| `workflow` | `comment-resolution-check` | — |
| `jurisdiction` | `austin` | — |
| `projectId` | `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` | Lamar + Collier |
| `submissionVersionId` | `4cfe4c36-c14e-4f5f-8b71-27c6fe3ed677` | **v5** (U1 target), created 2026-07-14 15:52 UTC |
| `crcGuidesSubmissionVersionId` | `6b9b85ed-e992-4906-a222-b24ee836910c` | **v4** (U0 baseline the guides were built from) |
| `crcGenerationNumber` | `6` | 24 guides verified in `crc-guides` bucket at `…/4/6/` |
| `model` | `claude-sonnet-4-6` | Exact string verified against the completed 2026-06-30 prod CRC run |
| `runs` | `5` | Majority-vote consolidation |
| `maxWorkers` | `35` | Matches prior successful runs=5 runs |
| `enrichComments` | `false` | Enrichment pass disabled |
| `runLabel` | `2026-07-14-v5-crc-game-day-run-1` | `{yyyy-MM-dd}-v5-crc-game-day-run-{n}`; date = execution date, n increments per attempt |

## Inngest event payload (cloud run)

Update the date in `runLabel` if firing on a different day.

```json
[
  {
    "name": "workflow/run",
    "data": {
      "workflowName": "comment-resolution-check",
      "inputs": {
        "jurisdiction": "austin",
        "projectId": "23301a8a-4cdb-4751-ac0c-93b97f0f5c12",
        "submissionVersionId": "4cfe4c36-c14e-4f5f-8b71-27c6fe3ed677",
        "crcGuidesSubmissionVersionId": "6b9b85ed-e992-4906-a222-b24ee836910c",
        "crcGenerationNumber": 6,
        "model": "claude-sonnet-4-6",
        "runs": 5,
        "maxWorkers": 35,
        "enrichComments": false,
        "runLabel": "2026-07-14-v5-crc-game-day-run-1"
      }
    }
  }
]
```

## Prerequisites (verified 2026-07-14)

- v5 exists (`4cfe4c36-…`, `status='draft'`); v4 healed to `review_complete`.
- v5 plan set uploaded via the Plan Set page **replace** flow (correct path — same
  `plan_set 908ffab5-…` as v4, lineage preserved); `plan_set_version 0ed28405-…`
  `processed` at 16:16 UTC — 66 sheets (50 modified / 16 added), all `short-id-ordered`,
  all reading guides present.
- Known processing warts (assessed 2026-07-14, pre-fire):
  - **Sheet 1 (cover) has 0 content blocks** — block discovery failed; reprocess
    recommended before firing.
  - 25/66 sheets fell back to PDF-only change comparison (overlay generation failed) —
    acceptable.
  - 1 block without transcription, 1 block embedding failed — noise.
  - `refresh-facts` failed; `project_facts` still dated 2026-05-12 (v4 era).

## Notes

- Outputs land in `workflow_runs`, storage
  `workflow-runs/comment-resolution-check/23301a8a-…/{datetime}/`, and a new
  `reviews` row (`review_type='crc'`, becomes `is_current`).
- Monitor via the `workflow_runs` row status and the Inngest dashboard.
