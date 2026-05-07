# source — `var2-vision-specialist-routing` (cc)

`per-item-run.tsv` is built from a single source run. Re-build by
running `scripts/build.py`, then `scripts/aggregate.py`.

## Source run

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_CC_RUN_4` |
| `workflow_runs.id` | `5d804242-861c-43ab-adfd-00e9af3757e2` |
| Started | 2026-05-07 09:24 UTC |
| Wall-clock | 56 min 8 sec |
| Workflow | completeness-check, `experiment=vision-check` overlay |
| Submission | 1700 S. Lamar v2 |
| `projectId` | `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` |
| `submissionVersionId` | `eb67ee21-76b1-4065-b20d-c32f674add12` |
| `checklistVersion` | `v2.5-trimmed` |
| `runs` | 1 |
| `setCurrent` | false |
| Bureau commit | post bureau#306 (prompt-trim merged 2026-05-07) |

Tools available to the agent: `vision_check` only (plus
`semantic-search-blocks`). No direct `vision`, no direct `inspect-drawing`,
no direct `measure-distance`. This is the **var2** variant by
definition.

Artifacts: [`../../../experiments/run4/cc/output/`](../../../experiments/run4/cc/output/).

## Schema

Same shape as `ctrl-baseline-vision-invocation/per-item-run.tsv`. The
`tool_called` enum for var2 takes one of:

- `none` — no `vision_check` calls attributed to this item in this run
- `vision-check-generic` — vision_check dispatched all of this item's calls to generic vision
- `vision-check-inspect-drawing` — at least one call routed to inspect-drawing
- `vision-check-measure-distance` — at least one call routed to measure-distance

The `vision-check-*` prefix marks that the call went through the router
(distinguishing it from var1's direct specialist invocation).

### Multi-call tie-break (within one item-run)

When an item-run had multiple `vision_check` calls — e.g. the agent
asked vision_check 3 times for the same item — the row's `tool_called`
reflects the **strongest specialist that was reached at least once**.
Specialist > generic; ties between specialists shouldn't occur in cc
(only inspect-drawing is wired). Rationale: goal B asks "did the agent
ever route to the right specialist for this item?" — once is enough.

If a row had a mix (e.g. 1 specialist call + 2 generic), the `notes`
column flags it (`mixed: ...`).

## Source-of-truth: vision-check-calls metadata

Each call writes `output/vision-check-calls/<callId>/metadata.json` with:

- `inputs.checklistItemId` (e.g. `cc-19:CC-19-22`) — exact attribution
- `classifier.output.problemType` — what the classifier picked
- `dispatch.specialistCalled` — what actually got called

We use this as the source rather than `tools_used` on findings, because
metadata.json carries the dispatch detail that `tools_used` doesn't.

## Counts (run4 raw)

- 115 total `vision_check` calls
- 63 unique items invoked vision_check
- 122 items with no vision_check call
- Dispatch breakdown: 69 generic, 46 inspect-drawing
- Classifier breakdown: 68 generic, 46 drawing_inspect, 1 measurement
  (the 1 measurement call fell through to generic via
  `measurement_arg_construction_not_implemented` — measurement
  dispatch isn't wired yet)

## Known caveats

- **`runs=1`.** Var2 cc currently has only one run. Majority vote is
  trivially satisfied (any invocation = invoked). We aspire to runs=3
  for variance, but the single-run data is what we have post-prompt-trim.
- **Measurement dispatch unwired.** All measurement-routed calls fall
  back to generic. Doesn't affect cc directly (no measurement items)
  but blocks meaningful var2 metrics on the el-md-exp side.
