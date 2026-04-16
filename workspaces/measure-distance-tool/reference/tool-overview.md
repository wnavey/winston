# Measure-Distance Tool — High-Level Overview

A "start here" walkthrough of what the `measure-distance` tool actually does,
phase by phase. Each phase is an independent seam where bugs can hide — which
is exactly why the `test-script` replay framework
([`replay/README.md`](./replay/README.md)) is valuable: every stage gets
exercised, and call-dir artifacts let you inspect state between seams.

For a deeper dive (file paths, schemas, implementation notes), see
[`measure-distance-tool-architecture-overview.md`](./measure-distance-tool-architecture-overview.md).

## The seven phases

```
1. Agent → MCP tool → CLI args           ← upstream of test-script; fixture captures verbatim
2. Download PDF + JPEG from Supabase     ← first real I/O; gatekeeper
3. In parallel:
   a. Find largest drawing-block bbox    ← Supabase metadata query
   b. Find legend blocks                 ← Supabase metadata query
4. Option A: Python vector-match         ← always fails today (stub)
5. Crop JPEG to drawing bbox             ← no-op if bbox is null
6. Option B: Gemini vision call          ← the expensive step; gets cropped image + legend text
7. Python compute-distance               ← scale parsing, bbox projection, distance calc, debug.png
```

## Phase details

### 1. Tool inputs (upstream)

The agent emits a `run_measure_distance` MCP tool call with:
`projectId`, `documentId`, `sheetNum`, `objectA`, `objectB`, `scaleInchesPerFoot`.

The conductor script-tool wrapper renders these into `--key=value` CLI flags
and invokes `measure-distance.ts`. For replay work, this phase is upstream of
the `test-script` workflow — the fixture JSON captures the exact inputs the
agent sent.

**Common bugs at this seam:**

- Agent emits numeric fields as numbers against a string schema (rejected at MCP
  validation). Mitigated by the widened `z.union([string, number, boolean])`
  on the script-tool args record.
- Agent emits a human-readable scale label (e.g., `"1 inch = 20 feet"`) instead
  of a decimal ratio (`"0.05"`). Gets past MCP but blows up later at Python
  argparse (`type=float`).
- Agent picks unit values that are valid but wrong for the sheet (e.g.,
  `scaleInchesPerFoot=1` on a sheet that's actually `1"=20'`). Measurement
  completes but produces nonsense numbers.

### 2. Asset download from Supabase

First real I/O. The tool chains lookups (`plan_set` → `plan_set_version` →
`plan_set_version_sheet` → `sheet_version`) to resolve the PDF + JPEG storage
paths for `(documentId, sheetNum)`, then downloads both from the
`submission-data` bucket (with a legacy fallback).

Without this step, nothing downstream has pixels to work with. Supabase outage
or bad credentials = every case fails here with no call-dir created.

This is why `projectId` is required on every fixture case — without it,
storage paths can't be constructed.

### 3. In parallel: drawing-block bbox + legend context

Two independent Supabase `content_block` queries:

- **(a) Drawing-block bbox.** Filters to blocks with `category='drawing'`,
  picks the *largest* one by area. Used later to crop the JPEG so Gemini
  sees only the engineering drawing (not title blocks / notes / borders).
  **If upstream indexing didn't tag any `drawing`-category blocks for the
  sheet, returns `null` → no crop happens and the full JPEG goes to Gemini.**
  This was the state for all 8 captured calls in the 2026-04-15 run.
- **(b) Legend blocks.** Searches ALL sheets in the plan set for blocks whose
  description matches "legend" / "symbol" / "abbreviat" / "key notes" /
  "line type". The matching content is concatenated and later injected as
  text context in the Gemini prompt, to help the model interpret symbology
  like `-OHE-` = overhead electric line.

### 4. Option A — Python vector matching (stub)

Attempts to find both objects by clustering PyMuPDF vector paths within the
drawing bbox. **Currently a stub** that always returns `success=false` with
reason `"Pattern matching not yet implemented"`. Every measurement today
falls through to Option B.

Worth knowing this branch exists — every call-dir's `events.jsonl` shows
`option-a-result: success=false` before the Option B attempt. That's expected,
not a regression.

### 5. Crop JPEG to drawing bbox

If phase 3a returned a bbox, crop the full-sheet JPEG to just the drawing
region using PIL (via a tiny inline Python script shelled out from TS). If
bbox is `null`, `fs.copyFileSync` the full JPEG through unchanged.

The cropped JPEG is what Gemini actually sees, and is persisted as
`cropped.jpg` in the call-dir for debugging.

### 6. Option B — Gemini vision call

One call to `google/gemini-3.1-pro-preview` via Vercel AI Gateway, with:
- the cropped JPEG
- a structured prompt asking for `bbox`, `nearestPoint`, and `confidence`
  for both objectA and objectB
- the legend context from phase 3b injected as hints

Returns normalized (0–1000) bounding boxes and a `nearestPoint` for each
object. Writes `prompt.txt`, `response.txt`, and `localization.json` into the
call-dir.

This is the expensive step. One tool invocation = one Gemini call.

### 7. Python compute-distance

Takes Gemini's localization output and:

1. Parses `scaleInchesPerFoot` (argparse `type=float` — crashes here on bad
   input).
2. Projects Gemini's normalized coordinates back to pixel / PDF coordinates,
   scaled by the crop region if one was applied.
3. Computes Euclidean distance between the two `nearestPoint`s in PDF units →
   divides by 72 to get paper inches → multiplies by `scaleInchesPerFoot` to
   get real-world feet.
4. Optionally refines measurement by re-extracting PDF vector paths inside
   each bbox — promotes `"vision"` measurement to `"vector-refined"` when ≥3
   paths exist in both regions.
5. Tags confidence (`high` / `medium` / `low` / `unable`).
6. Renders `debug.png` — a 150-DPI rasterization of the sheet with the two
   points, a connecting line, and the distance label overlaid.
7. Writes the result JSON to `outputPath` (`measure-distance.json`).

## Debugging by artifact

Each phase writes something to the call-dir. If a run fails or produces
surprising output, you can localize the bug by asking "what's the *last*
artifact that looks right?"

| Phase | Artifact in call-dir |
|---|---|
| 1 — tool inputs | `metadata.json` `inputs:` field |
| 2 — asset download | `metadata.json` `assets.pdfStoragePath`/`jpegStoragePath` |
| 3a — drawing bbox | `metadata.json` `assets.drawingBbox` (often `null`) |
| 3b — legend context | `legend.txt` (`metadata.json` `assets.legendSource`) |
| 4 — Option A result | `events.jsonl` `option-a-result` event |
| 5 — crop | `cropped.jpg` |
| 6 — Gemini call | `prompt.txt`, `response.txt`, `localization.json` |
| 7 — compute-distance | `measure-distance.json` (at case-dir root), `debug.png` |

A missing artifact means the pipeline stopped before that phase. A present-but-wrong
artifact means that phase ran but emitted something suspicious — check the
phase's inputs against its outputs.

## Related documents

- [`replay/README.md`](./replay/README.md) — how to run the `test-script`
  workflow against a captured fixture.
- [`measure-distance-tool-architecture-overview.md`](./measure-distance-tool-architecture-overview.md)
  — deeper architectural detail: file paths, Supabase schemas, diagrams.
- [`checklist-item-gemini-call-mapping.md`](./checklist-item-gemini-call-mapping.md)
  — how to correlate Gemini calls back to specific agents / checklist items
  after a full experiment run.
- [`measure-distance-usage-nudging-analysis.md`](./measure-distance-usage-nudging-analysis.md)
  — prompt-level research track: nudging the agent to use the tool more
  effectively (orthogonal to tool-layer bugs).
