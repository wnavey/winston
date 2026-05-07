# source — `ctrl-baseline-vision-invocation` (cc)

`per-item-run.tsv` is built from a single source run. Re-build by
running `scripts/build.py`.

## Source run

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_CC_BASELINE` |
| Inngest event id | `01KQYYG6G4JHPRMGK0WK9CAWYZ` |
| `workflow_runs.id` | `1cea1a70-5860-4068-bd25-e67ce5529eee` |
| Started | 2026-05-06 15:29:23 UTC |
| Workflow | completeness-check (production prompt — no `experiment` overlay) |
| Submission | 1700 S. Lamar v2 |
| `projectId` | `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` |
| `submissionVersionId` | `eb67ee21-76b1-4065-b20d-c32f674add12` |
| `checklistVersion` | `v2.5-trimmed` |
| `runs` | 3 |
| `setCurrent` | false |

Tools available to the agent: generic `vision` only (no `inspect-drawing`,
no `vision_check`). This is the **ctrl-baseline** variant by definition.

Artifacts: [`../../../experiments/baseline/cc/output/`](../../../experiments/baseline/cc/output/).
Kickoff doc: [`../../../experiments/baseline/cc-kickoff.md`](../../../experiments/baseline/cc-kickoff.md).

## Schema

| Column | Type | Notes |
|---|---|---|
| `item_id` | string | `{grouping}:{item_id}`, joins to TSV 1's `item_id`. |
| `run_index` | int | 1-based. Source run had `runs=3`, so values are 1, 2, 3. |
| `run_label` | string | Source run's `runLabel`. |
| `tool_called` | none \| generic-vision | ctrl-baseline only exposes generic vision. Empty `tools_used` ⇒ `none`. Any tool name containing "vision" ⇒ `generic-vision`. |
| `call_count` | int | Count of vision-named tools in `tools_used` for this (item × run). |
| `notes` | string | Free-form. `no_finding` flag set if the run produced no finding for this item (didn't happen in this source run — all 185 items got 1 finding × 3 runs). |

## How tools_used → tool_called works

The baseline `vision` tool's own log (`output/vision-log.jsonl`) records
only `{event, documentId, sheetNum, success, timestamp}` — no item
attribution. We attribute calls to items via the agent's per-finding
`tools_used` field instead. A finding "called vision" iff any tool name
in its `tools_used` list contains the substring `"vision"` (catches
`vision`, `mcp__conductor_tools__vision`, etc.).

This attribution is exact, not heuristic — `tools_used` is the agent's
own per-finding record of which tools it invoked. It does *not* include
the prompt the agent sent to vision; per-call prompt traceability is a
separate (deferred) TODO.

## Counts

- 555 rows = 185 items × 3 runs.
- 196 (35.3%) item-runs where `tool_called=generic-vision`.
- 359 (64.7%) item-runs where `tool_called=none`.
- Per-run breakdown: run-1 = 71/185, run-2 = 56/185, run-3 = 69/185.

These match the existing `analyze-baseline.py` headline numbers.

## Known gaps (deferred)

- **Per-call prompt** — vision tool doesn't log the prompt the agent
  sent. Adding this requires a conductor patch (highest-priority TODO).
  Not blocking for hit-rate analysis — only needed if we want to
  diagnose *why* the agent skipped a specialist.
- **Multi-call detail** — when `call_count > 1`, we don't preserve
  per-call detail (different sheets, different prompts). Aggregated
  count is sufficient for goal A; per-call detail unblocks deeper
  failure-mode work.
