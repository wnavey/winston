# Measure-Distance Tool — High-Level Overview

A "start here" walkthrough of what the `measure-distance` tool actually does,
phase by phase. Updated to reflect the current implementation including the
two-call Gemini pipeline (Phase A), legend symbol images (Phase B), and
objectPairs batching.

Each phase is an independent seam where bugs can hide — the `test-script`
replay framework and the debug viewer let you inspect artifacts at every seam.

For deeper implementation detail (file paths, Supabase schemas), see
[`architecture-overview.md`](./architecture-overview.md).

---

## Pipeline overview

```
 SHARED SETUP (once per tool invocation):
  1. Agent → MCP tool → CLI args
  2. Download PDF + JPEG from Supabase
  3. Find drawing-block bbox (Supabase content_block query)
  4. Find legend context:
     a. Text legend (keyword search across all sheets)
     b. Legend symbol images (vector search → crop at 300 DPI)  ← Phase B
  5. Crop JPEG to drawing bbox at 120 DPI

 PER-PAIR LOOP (one iteration per objectPairs entry):
  6. CALL 1 — Coarse localization (120 DPI drawing crop + legend images)
  7. Compute refined crop region (union of coarse bboxes + padding)
  8. Render refined crop from PDF at 300 DPI                    ← Phase A
  9. CALL 2 — Refined localization (300 DPI crop + legend images)
  10. Python compute-distance (nearestPoints → feet)
```

---

## Phase details

### 1. Tool inputs (upstream)

The review agent emits a `run_measure_distance` MCP tool call with:
- `documentId`, `sheetNum` — which sheet to measure on
- `objectA`, `objectB` — natural-language descriptions of the two features
- `scaleInchesPerFoot` — decimal ratio (e.g., `0.05` for 1"=20')
- `objectPairs` — optional array of `{objectA, objectB}` for batch measurement
- `reasoning` — why the agent is measuring (for attribution)
- `applicable_checklist_items` — which deficiency IDs motivated the call

The conductor script-tool wrapper renders these into CLI flags and invokes
`measure-distance.ts`. The `projectId` is inferred from the workspace.

**objectPairs batching:** The agent can submit multiple measurement pairs in
a single tool call. The tool downloads assets once and runs the Gemini
pipeline once per pair, creating per-pair call-dirs (`-p0`, `-p1`, `-p2`).

### 2. Asset download from Supabase

Downloads the sheet PDF and pre-rendered JPEG (120 DPI) from Supabase
storage. Chains lookups: `plan_set` → `plan_set_version` →
`sheet_version` → storage paths. Falls back to legacy bucket paths.

Both files are cached in `<callDir>/tmp/` and reused across all pairs.

### 3. Find drawing-block bbox

Queries `content_block` for the largest `category='drawing'` block on the
sheet. Returns a normalized `{x0, y0, x1, y1}` bbox (0-1 range) used to crop
the JPEG in phase 5.

If no drawing block exists for this sheet, returns null → no crop, full page
sent to Gemini. Valley View Townhomes sheets 21 and 31 both have real drawing
blocks returning crops like `{0.03, 0.03, 0.91, 0.96}` (sheet 21) and
`{0.26, 0.35, 0.91, 0.95}` (sheet 31).

### 4. Find legend context

Two parallel lookups:

**(a) Text legend** — keyword search across ALL sheets in the plan set for
blocks whose description contains "legend" / "symbol" / "abbreviat" / etc.
Concatenates matching content (~15 KB typical). Used as text context in the
Gemini prompt when legend images aren't available.

**(b) Legend symbol images (Phase B)** — for each unique object description
across all pairs:
1. Generate an embedding via OpenAI `text-embedding-3-small`
2. Call `search_content_blocks_hybrid` RPC (vector + keyword search)
3. Post-filter to legend/symbol/diagram categories, take top-1 match
4. Fetch the matched block's `bounding_box` from `content_block`
5. Download the source sheet's PDF and crop the block region at 300 DPI
6. Encode as base64 for the Gemini call

Produces 0-2 legend images (one per unique matched block, deduplicated).

**Fallback:** If embeddings don't exist for the project (common — requires
a separate backfill step), or OPENAI_API_KEY is not set, or no blocks match,
the legend images are empty and the text dump is used instead.

**When legend images ARE found:** The 15 KB text dump is suppressed and
replaced with a short reference ("See the attached legend images for symbol
identification").

### 5. Crop JPEG to drawing bbox

Crops the downloaded JPEG to the drawing-block region using PIL (via inline
Python script). If drawing bbox is null, copies the full JPEG unchanged.

This produces the **120 DPI drawing crop** used by call 1.

### 6. CALL 1 — Coarse localization

Sends to Gemini `google/gemini-3.1-pro-preview` via Vercel AI Gateway:
- The 120 DPI drawing crop (image 1)
- Legend symbol images if available (images 2, 3)
- Prompt asking for `bbox` and `nearestPoint` in 0-1000 normalized coords

Returns coarse bounding boxes for both objects. Confidence typically 0.90-0.95.

Artifacts: `call1-prompt.txt`, `call1-response.txt`, `call1-localization.json`,
`call1-cropped.jpg`.

### 7. Compute refined crop region

Takes call 1's coarse bboxes and computes a tighter region for call 2:
1. Union of objectA + objectB bboxes (mapped from Gemini 0-1000 [y,x] to
   normalized 0-1 space)
2. Expand by 30% padding on each side
3. Apply **quadrant floor** — never smaller than 25% of the sheet area
4. Clamp to [0, 1]
5. Map through drawing bbox to full-page normalized coordinates

The quadrant floor ensures we don't lose too much context even when the
objects are close together. For a 36"×24" sheet, a quadrant is 18"×12" —
still enough context for Gemini to orient.

### 8. Render refined crop at 300 DPI (Phase A)

Uses PyMuPDF to render the refined crop region from the vector PDF at 300 DPI.
This is the key DPI improvement: the coarse crop (phase 5) was from a
pre-rendered 120 DPI JPEG; the refined crop is rendered fresh from the PDF
source at 2.5× the resolution.

| Scenario | DPI | Effective detail |
|----------|-----|-----------------|
| Full sheet JPEG | 120 | 1× (baseline) |
| Drawing-block crop | 120 | ~1× (same pixels, just fewer) |
| **Refined crop (quadrant)** | **300** | **2.5×** |
| Refined crop (tight) | 300 | up to 6× |

Artifact: `call2-cropped.jpg` (the high-DPI image).

### 9. CALL 2 — Refined localization

Same Gemini model and prompt structure as call 1, but with:
- The 300 DPI refined crop (much more detail in the measurement region)
- Same legend symbol images
- `drawingBbox` set to the refined crop's full-page coordinates (so the
  Python consumer maps 0-1000 coords through the correct region)

Returns precise nearestPoints with more pixels to work with.

Artifacts: `call2-prompt.txt`, `call2-response.txt`, `call2-localization.json`,
`call2-cropped.jpg`.

**Fallback:** If call 2 fails (timeout, Gemini error), falls back to call 1's
coarse localization. Logged as `call2-fallback` event.

### 10. Python compute-distance

Takes the winning localization (call 2, or call 1 if call 2 failed) and:

1. Maps nearestPoints from Gemini 0-1000 [y,x] space → PDF points, through
   the localization's `drawingBbox`
2. Computes Euclidean distance in PDF units → paper inches (÷72) → real-world
   feet (÷ scaleInchesPerFoot)
3. Tags confidence: `high` / `medium` / `low` / `unable`
4. Renders `debug.png` — annotated rasterization with the two points, a
   connecting line, and a distance label
5. Writes `measure-distance.json` with the result

**Coordinate note:** Gemini returns all coordinates in [y, x] order. The
Python consumer correctly handles this (bureau#229 axis fix). The
`drawingBbox` in the localization object tells Python which region of the
page the 0-1000 coords are relative to — for call 2, this is the refined
crop region, not the full drawing.

---

## Debugging by artifact

Each phase writes artifacts to the call-dir. Find the last good artifact
to localize where the pipeline went wrong.

| Phase | Artifact | What to check |
|---|---|---|
| 1 — inputs | `metadata.json` `inputs:` | Are objectA/B/scale correct? |
| 2 — download | `tmp/sheet.jpg`, `tmp/sheet.pdf` | Did the files download? |
| 3 — drawing bbox | `metadata.json` `assets.drawingBbox` | Null = no crop. Is the bbox reasonable? |
| 4a — text legend | `legend.txt` | Non-empty? Relevant content? |
| 4b — legend images | `call1-legend-0.jpg`, `call1-legend-1.jpg` | Present? Correct symbol? |
| 5 — drawing crop | `call1-cropped.jpg` | Is it cropped to the drawing (not full page)? |
| 6 — call 1 | `call1-localization.json` | Are bboxes on the right objects? |
| 7 — refined bbox | `events.jsonl` `refined-crop` event | Is the region reasonable? |
| 8 — refined render | `call2-cropped.jpg` | Higher res than call1? Correct region? |
| 9 — call 2 | `call2-localization.json` | More precise nearestPoints? |
| 10 — distance | `measure-distance.json`, `debug.png` | Plausible feet value? Dots on correct features? |

**Viewer:** The debug viewer (`viewer/serve.sh`) shows all artifacts with a
toggle between call 1 and call 2 views. Use it to visually compare coarse
vs refined localization.

---

## Key implementation files

| File | What it does |
|---|---|
| `bureau/.../review/scripts/measure-distance.ts` | TS orchestrator: args, Supabase, Gemini calls, per-pair loop |
| `bureau/.../review/scripts/measure-distance-impl.py` | Python: coordinate mapping, distance computation, debug image |
| `conductor/src/tools/script.ts` | MCP tool wrapper: schema, arg parsing, subprocess invocation |
| `bureau/.../review/experiments/measure-distance/experiment.yaml` | Experiment overlay: wires the tool + prompt into the review workflow |
| `bureau/.../review/experiments/measure-distance/review.md` | Experiment prompt: "Using the Measure-Distance Tool" instructions |

---

## What's NOT implemented yet

- **Option A (vector matching)** — disabled (bureau#236). Every call goes
  through Gemini. Future R&D to implement PDF vector path pattern matching.
- **Vertical distance** — the tool measures horizontal plan-view distances
  only. 10% of checklist items need vertical/3D clearance.
- **Agent tracing** — the review schema doesn't yet capture per-finding
  observation/reasoning/toolInvocations. Needed for Phase 3 attribution.
- **Legend images** — code deployed (Phase B) but ineffective on Valley View
  Townhomes due to missing content_block embeddings. Needs backfill per
  project.
