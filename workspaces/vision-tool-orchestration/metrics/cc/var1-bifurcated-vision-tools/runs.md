# source — `var1-bifurcated-vision-tools` (cc)

`per-item-run.tsv` is built from a single source run living in a
sibling workspace (`inspect-drawing-tool/`, not
`vision-tool-orchestration/`). Re-build by running
`scripts/build.py`, then `scripts/aggregate.py`.

## Source run

| Field | Value |
|---|---|
| `runLabel` | `VISION_EXP_INSPECT_DRAWING_RUN_1` |
| `workflow_runs.id` | `386b040b-3f75-47ab-af5c-26e8f6b74e9b` |
| Review ID | `51586bce-e7d8-4fce-834d-4437abe0df1a` |
| Workflow | completeness-check, `experiment=inspect-drawing` overlay |
| Submission | 1700 S. Lamar v2 |
| `projectId` | `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` |
| `submissionVersionId` | `eb67ee21-76b1-4065-b20d-c32f674add12` |
| `checklistVersion` | `v2.5-trimmed` |
| `runs` | 3 |
| Model | `claude-sonnet-4-5-20250929` |

Tools available to the agent: generic `vision` AND direct
`inspect-drawing` script-tool (no `vision_check`). This is the **var1**
variant by definition — bifurcated tool list, agent picks.

Source artifacts:
[`../../../../inspect-drawing-tool/experiments/run1/output/`](../../../../inspect-drawing-tool/experiments/run1/output/).
Original analysis:
[`../../../../inspect-drawing-tool/experiments/run1/analytics/analysis.md`](../../../../inspect-drawing-tool/experiments/run1/analytics/analysis.md).

## Schema

Same shape as `ctrl-baseline-vision-invocation/per-item-run.tsv`. The
`tool_called` enum for var1 cc takes one of:

- `none` — no vision-related call attributed to this item in this run
- `generic-vision` — only the generic `vision` tool was called
- `inspect-drawing` — the direct `inspect-drawing` script-tool was
  called for this item-run (regardless of whether `vision` was also
  called); specialist takes precedence

## Two attribution paths (a known data quirk)

A `tools_used`-tracking bug in this run makes single-source attribution
impossible. The build script combines two sources:

1. **vision** — attributed via per-finding `tools_used` (same as
   ctrl-baseline). Works correctly: 186 `'vision'` occurrences in
   tools_used across 555 findings.
2. **inspect-drawing** — `tools_used` does NOT track inspect-drawing in
   this run, even when calls happened. Open
   "tools_used tracking bug" TODO in project memory. We attribute
   inspect-drawing via the per-call metadata at
   `output/inspect-drawing-calls/<callId>/metadata.json` instead. The
   callId encodes `run-N-cc-NN` (giving us run_index + grouping), and
   `inputs.applicableChecklistItems[].checklist_id` gives us the
   item id. 3 metadata files = 3 inspect-drawing calls.

The two sources are merged at the (item × run) level: a row gets
`tool_called=inspect-drawing` if any inspect-drawing call attributed to
it; otherwise `generic-vision` if `tools_used` contained vision;
otherwise `none`.

## Counts (run1 raw, post-build)

- 555 rows = 185 items × 3 runs.
- `tool_called=none`: 369
- `tool_called=generic-vision`: 184
- `tool_called=inspect-drawing`: 2 (both in run-1; AW-21 once,
  AW-23 once via call attribution; AW-23 had a second call too but the
  attribution maps to one (item × run) cell)
- The 3 raw inspect-drawing calls (vs 2 (item × run) cells) reflect
  AW-23 receiving 2 calls in the same run (sheets 18 and 19).

## Known caveats

- **Sparse specialist usage.** 2 (item × run) cells with inspect-drawing
  out of 162 inspect-drawing-eligible cells (54 items × 3 runs) is
  ~1.2% raw cell hit rate. Under majority vote (≥2/3 runs), zero items
  hit. Goal B = 0/8 required.
- **Agent ignored the specialist's answer once.** Per the run1
  analysis, on AW-23/run-1 the agent called inspect-drawing (got
  `classification=yes`, flow arrows present) and then contradicted it
  using vision instead. Doesn't affect invocation hit rate but is a
  data point for "did the bifurcated path actually work even when
  invoked".
