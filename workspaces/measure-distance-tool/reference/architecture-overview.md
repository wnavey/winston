# Measure-Distance Tool — Architecture Overview

Detailed technical reference for the measure-distance tool implementation.
For a high-level walkthrough, see [`tool-overview.md`](./tool-overview.md).

---

## Source files

| File | Location | Role |
|---|---|---|
| `measure-distance.ts` | `bureau/jurisdictions/austin/workflows/review/scripts/` | TS orchestrator: arg parsing, Supabase queries, Gemini calls, per-pair loop, artifact persistence |
| `measure-distance-impl.py` | Same directory | Python: coordinate mapping (Gemini 0-1000 → PDF points → feet), debug image rendering |
| `script.ts` | `conductor/src/tools/` | MCP tool wrapper: typed schema with per-field descriptions, arg validation, subprocess invocation |
| `experiment.yaml` | `bureau/.../review/experiments/measure-distance/` | Experiment overlay: overrides review-runs step with MD tool + prompt |
| `review.md` | Same directory | Experiment prompt: instructions for when/how to use the tool |

## How the tool is wired in

The tool is **not** in the main review workflow. It's only available via the
experiment overlay:

```
--experiment=measure-distance
```

This loads `experiment.yaml` which overrides the `review-runs` step:
- **Tools:** `[vision, script:measure-distance]` (adds the MD tool)
- **Prompt:** `review.md` (includes "Using the Measure-Distance Tool" section)

Without the flag, agents have no access to the tool and no prompt about it.

## MCP tool schema

The tool is registered as `run_measure_distance` via `createScriptTool`.
The schema (conductor#122) defines typed fields:

```
documentId:                 string (required)
sheetNum:                   string (required)
objectA:                    string (required)
objectB:                    string (required)
scaleInchesPerFoot:         string (required) — decimal ratio, e.g., "0.05"
objectPairs:                array of {objectA, objectB} (optional) — batch mode
reasoning:                  string (optional) — agent's rationale
applicable_checklist_items: array (optional) — deficiency IDs motivating the call
```

---

## TS orchestrator flow (`measure-distance.ts`)

### Shared setup (once per invocation)

```
1. Parse CLI args + generate session callId
2. Download PDF + JPEG from Supabase storage
   └─ chain: plan_set → plan_set_version → sheet_version → storage paths
3. Find drawing-block bbox (content_block query, category='drawing', largest by area)
4. Find legend context:
   a. Text: keyword search for legend/symbol blocks across all sheets → ~15 KB
   b. Images (Phase B): embedding search → top-1 per object → crop at 300 DPI
5. Crop JPEG to drawing bbox at 120 DPI (PIL via inline Python)
6. Copy shared assets (legend.txt, sheet.jpg, sheet.pdf) to session dir
```

### Per-pair loop

For each `{objectA, objectB}` pair (1 pair if no `objectPairs`, N if batched):

```
1. Create per-pair callDir (-p0, -p1, ... or session dir if single pair)
2. Copy shared assets into pair dir (cropped.jpg, legend.txt, tmp/sheet.*)

── Two-call Gemini pipeline ──
3. CALL 1 (coarse): localizeWithGemini(120 DPI crop, legend images, drawingBbox)
   → call1-prompt.txt, call1-response.txt, call1-localization.json, call1-cropped.jpg
4. Compute refined crop: union of call1 bboxes + 30% padding + quadrant floor
5. Render refined region from PDF at 300 DPI (PyMuPDF)
   → call2-cropped.jpg
6. CALL 2 (refined): localizeWithGemini(300 DPI crop, legend images, refinedBbox)
   → call2-prompt.txt, call2-response.txt, call2-localization.json
7. If call 2 fails → fall back to call 1 localization

── Distance computation ──
8. callPython(mode='compute-distance', localization, scale, ...)
   → measure-distance.json, debug.png
9. Write metadata.json (inputs, assets, call1, optionB, result, timing)
10. Write events.jsonl sidecar log
```

### Gemini call details (`localizeWithGemini`)

Multi-image content array via Vercel AI SDK:
```ts
content: [
  { type: 'text', text: prompt },
  { type: 'image', image: mainCropBase64 },   // the drawing crop
  { type: 'image', image: legendImage1 },      // legend for objectA (if found)
  { type: 'image', image: legendImage2 },      // legend for objectB (if found)
]
```

Model: `google/gemini-3.1-pro-preview` via Vercel AI Gateway.

Response: JSON with `objectA` and `objectB`, each containing:
- `found: boolean`
- `bbox: [y0, x0, y1, x1]` — Gemini 0-1000 normalized, [y,x] order
- `nearestPoint: [y, x]` — closest point to the other object
- `confidence: 0.0-1.0`
- `description: string` — what Gemini identified

### Legend image search (`findLegendBlockImages`)

```
For each unique object description:
  1. generateQueryEmbedding(text) → OpenAI text-embedding-3-small
  2. supabase.rpc('search_content_blocks_hybrid', { query, embedding })
  3. Post-filter: category ∈ {legend, symbol, diagram, key, abbreviations}
  4. Take top-1 by combined_rank
  5. Deduplicate across objects (same block → 1 image)
  6. Fetch bounding_box from content_block table
  7. Download source sheet PDF, crop block region at 300 DPI
  8. Return base64 + metadata
```

**Prerequisite:** Content blocks must have embeddings computed. Run:
```bash
npx tsx scripts/backfill-content-block-embeddings.ts <projectId>
```

---

## Python implementation (`measure-distance-impl.py`)

### Coordinate mapping (`compute_distance`)

```python
def gemini_to_pdf_points(normalized_yx, bbox):
    # Gemini returns [y, x] — swap to get (nx, ny)
    ny, nx = normalized_yx[0] / 1000, normalized_yx[1] / 1000
    # Map through the drawingBbox (which region of the page are we in?)
    x = (bbox.x0 + nx * (bbox.x1 - bbox.x0)) * page_rect.width
    y = (bbox.y0 + ny * (bbox.y1 - bbox.y0)) * page_rect.height
    return (x, y)
```

For call 2, the `drawingBbox` is the refined crop region (not the original
drawing bbox), so the 0-1000 coords map correctly to the tighter area.

### Distance computation

```
pixel_distance = euclidean(pointA, pointB)   # in PDF points
paper_inches = pixel_distance / 72
real_feet = paper_inches / scaleInchesPerFoot  # e.g., ÷ 0.05 = × 20
```

### Debug image

150 DPI rasterization of the PDF page with:
- Blue dot on pointA, red dot on pointB
- Green connecting line
- Distance label overlay

---

## Call-dir artifact structure

```
<callId>/
├── metadata.json              # full record: inputs, assets, call1, optionB, result, timing
├── events.jsonl               # per-event sidecar log with timestamps
├── legend.txt                 # text legend context (shared)
├── call1-prompt.txt           # Gemini prompt for coarse call
├── call1-response.txt         # raw Gemini response
├── call1-localization.json    # parsed bboxes + nearestPoints
├── call1-cropped.jpg          # 120 DPI drawing crop
├── call1-legend-0.jpg         # legend image for objectA (if found)
├── call1-legend-1.jpg         # legend image for objectB (if found)
├── call2-prompt.txt           # Gemini prompt for refined call
├── call2-response.txt         # raw Gemini response
├── call2-localization.json    # precise bboxes + nearestPoints
├── call2-cropped.jpg          # 300 DPI refined crop
├── call2-legend-0.jpg         # same legend images (copied)
├── call2-legend-1.jpg
├── debug.png                  # annotated measurement image
└── tmp/
    ├── sheet.pdf              # downloaded sheet PDF
    ├── sheet.jpg              # downloaded sheet JPEG (120 DPI)
    └── refined-crop-pN.jpg    # intermediate high-DPI render
```

---

## Timing (metadata.json `timing` block)

```json
{
  "timing": {
    "downloadMs": 1200,
    "contextMs": 450,
    "pythonMs": 3100,
    "totalMs": 95000
  }
}
```

Per-Gemini-call latency is on the `option-b-result` events in `events.jsonl`
as `geminiMs`.
