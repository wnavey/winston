# Measure-Distance Tool — Architecture Overview

Source files:
- `bureau/jurisdictions/austin/workflows/review-4.3/scripts/measure-distance.ts` — TS orchestrator
- `bureau/jurisdictions/austin/workflows/review-4.3/scripts/measure-distance-impl.py` — Python computation module
- Registered as an MCP tool by `conductor/src/tools/script.ts` (`createScriptTool`) and exposed to the review agent as `run_measure_distance`.
- Wired into `review-4.3/workflow.yaml` on the `review-runs` step (`tools: [vision, script:measure-distance]`) with usage instructions in `review-4.3/prompts/review.md`.

---

## High-Level Summary

One invocation of `run_measure_distance` executes the following pipeline:

1. **Parse args** — `projectId` (inferred from workspace if omitted), `documentId`, `sheetNum`, `objectA`, `objectB`, `scaleInchesPerFoot`, `outputPath`.
2. **Resolve assets** — chain Supabase lookups (`plan_set` → `plan_set_version` → `plan_set_version_sheet` → `sheet_version`) to find the PDF and JPEG storage paths; download both from the `submission-data` bucket (fallback: legacy `site-plan-documents` bucket).
3. **Collect context** — query `content_block` for (a) the largest `drawing` block on this sheet (used as a crop + coordinate frame), and (b) legend/symbol blocks across *all* sheets in the plan set (provides symbology hints to the vision model).
4. **Option A — vector matching** (Python, PyMuPDF). Extract vector paths from the PDF within the drawing bbox, cluster by proximity. Currently stubbed: returns `None` with reason "pattern matching not yet implemented (v1 — experimental)". Placeholder for future symbol recognition.
5. **Option B — Gemini Vision** (TS). Crop the JPEG to the drawing bbox, send it with a structured prompt to `google/gemini-3.1-pro-preview` via Vercel AI Gateway. Model returns `bbox`, `nearestPoint`, and `confidence` for each object in normalized `0–1000` coords.
6. **Vector refinement** (Python). Using Gemini's bboxes as search regions, re-extract PDF paths inside each region. If ≥3 paths exist in both regions, compute the nearest path-point pair and **replace** Gemini's `nearestPoint` with those exact PDF coordinates. This promotes a "vision" measurement to "vector-refined".
7. **Distance math** (Python). Euclidean distance between the two points in PDF units → divide by 72 to get paper inches → multiply by `scaleInchesPerFoot` to get real-world feet.
8. **Confidence tag** — `high` if vector-refined or pure-vector, `medium` if a legend was available, `low` otherwise. `unable` if neither option could localize.
9. **Debug image** — 150 DPI rasterization of the PDF page with blue/red dots on points A/B, a green connecting line, and a distance label overlay. Written to `output/measure-distance/sheet-<N>-measurement.png`.
10. **Persist** — write the result JSON to `outputPath`, write `measure-distance-log.json` sidecar with all structured events, print result to stdout for the agent to read.

---

## Architecture Diagram

```
                        AGENT (review-runs step)
                               │
                               │ tool call: run_measure_distance(
                               │   documentId, sheetNum, objectA,
                               │   objectB, scaleInchesPerFoot)
                               ▼
                  ┌────────────────────────────┐
                  │ createScriptTool (MCP wrap)│  conductor/src/tools/script.ts
                  │ — turns args into          │    timeout: 120s
                  │   --key="value" CLI flags  │    captures stdout + output file
                  │ — auto-generates outputPath│
                  └──────────────┬─────────────┘
                                 │  execSync(`npx tsx measure-distance.ts --…`)
                                 ▼
        ┌────────────────────────────────────────────────────────┐
        │        measure-distance.ts  (TS orchestrator)          │
        │                                                        │
        │  ┌─ Step 1: Resolve assets ──────────────────────────┐ │
        │  │   Supabase:                                       │ │
        │  │     plan_set ─▶ plan_set_version (latest)         │ │
        │  │              ─▶ plan_set_version_sheet            │ │
        │  │              ─▶ sheet_version                     │ │
        │  │     → file_path (PDF), thumbnail_path (JPEG)      │ │
        │  │   storage.download() from `submission-data`       │ │
        │  │   (fallback bucket: `site-plan-documents`)        │ │
        │  └───────────────────────────────────────────────────┘ │
        │                                                        │
        │  ┌─ Step 2: Gather context (parallel) ───────────────┐ │
        │  │   findDrawingBlockBbox():                         │ │
        │  │     content_block WHERE category='drawing'        │ │
        │  │     → pick largest by area → normalized bbox      │ │
        │  │   findLegendContext():                            │ │
        │  │     content_block across ALL sheets               │ │
        │  │     WHERE description ~ 'legend|symbol|abbreviat' │ │
        │  │     → concatenated legend text (cross-sheet)      │ │
        │  │     → else built-in dict (transformer, CRZ, FH…)  │ │
        │  └───────────────────────────────────────────────────┘ │
        │                                                        │
        │  ┌─ Step 3: Option A (vector matching) ──────────────┐ │
        │  │   execFileSync(python3, impl.py --mode=option-a)  │ │
        │  │   ───────────────────▶    (see Python box below)  │ │
        │  │   ◀─── { success: false }  (v1: always stubbed)   │ │
        │  └───────────────────────────────────────────────────┘ │
        │                                                        │
        │  ┌─ Step 4: Option B (Gemini Vision) ────────────────┐ │
        │  │   cropJpeg(drawingBbox)  ─┐                       │ │
        │  │     writes temp PIL script, invokes python3       │ │
        │  │   localizeWithGemini():   ├─▶  Vercel AI Gateway  │ │
        │  │     @ai-sdk/gateway +      │    model:            │ │
        │  │     generateText({…})      │    google/           │ │
        │  │     prompt includes        │      gemini-3.1-     │ │
        │  │       legend context +     │      pro-preview     │ │
        │  │       base64 cropped JPEG  │                      │ │
        │  │   ◀── JSON: {bbox, nearestPoint, confidence}×2    │ │
        │  └───────────────────────────────────────────────────┘ │
        │                                                        │
        │  ┌─ Step 5: Compute + debug image ───────────────────┐ │
        │  │   execFileSync(python3, impl.py                   │ │
        │  │       --mode=compute-distance …)                  │ │
        │  │   ───────────────────▶   (see Python box below)   │ │
        │  │   ◀─── full result JSON + debug PNG on disk       │ │
        │  └───────────────────────────────────────────────────┘ │
        │                                                        │
        │  logEvent() → measure-distance-log.json (sidecar)      │
        │  stdout → agent reads result                           │
        └────────────────────────────────────────────────────────┘
                                 │
                                 │ subprocess: python3 impl.py
                                 ▼
        ┌────────────────────────────────────────────────────────┐
        │    measure-distance-impl.py  (pure computation)        │
        │                                                        │
        │  mode=option-a:                                        │
        │    fitz.open(pdf) → page.get_drawings()                │
        │    filter to drawing bbox (+5% padding)                │
        │    cluster_paths() by spatial proximity                │
        │    if len(paths) < 5 → "rasterized PDF"                │
        │    TODO: pattern match symbol signatures               │
        │    (currently returns { success: false })              │
        │                                                        │
        │  mode=compute-distance:                                │
        │    gemini_to_pdf_points(nearestPoint, drawingBbox)     │
        │       normalized 0-1000  → crop-relative               │
        │       → page-relative    → PDF points                  │
        │                                                        │
        │    VECTOR REFINEMENT (if method == "vision"):          │
        │      re-extract paths inside each Gemini bbox          │
        │      if paths_a ≥ 3 AND paths_b ≥ 3:                   │
        │        min-distance path-point pair → new (pt_a, pt_b) │
        │        → refined = True                                │
        │                                                        │
        │    distance_pdf  = hypot(dx, dy)                       │
        │    paper_inches  = distance_pdf / 72                   │
        │    real_feet     = paper_inches × scaleInchesPerFoot   │
        │    real_inches   = real_feet × 12                      │
        │                                                        │
        │    confidence =                                        │
        │      high   if method=="vector" or refined             │
        │      medium if legendSource in (cross-sheet,same-sheet)│
        │      low    otherwise                                  │
        │                                                        │
        │    generate_debug_image():                             │
        │      page.get_pixmap(dpi=150) → PIL                    │
        │      draw line + dots + distance label                 │
        │      save to output/measure-distance/sheet-N-*.png     │
        │                                                        │
        │    write result JSON to outputPath                     │
        │    print result JSON to stdout                         │
        └────────────────────────────────────────────────────────┘
```

---

## Deep Dive

### 1. How the agent invokes the tool

`createScriptTool` (conductor/src/tools/script.ts) wraps every `script:<name>` declared in a workflow step into an MCP tool named `run_<name_with_underscores>` — so `script:measure-distance` becomes `run_measure_distance`. The tool accepts one argument shape: a `Record<string, string>` of `args` plus an optional `outputPath`. Each arg becomes a `--key="value"` CLI flag when the script is executed. An `outputPath` is auto-generated (into `workspace/output/<scriptName>.json`) if the agent omits it.

Two details worth noting:

- **Timeout**: 120 seconds per call, wall-clock. This is the cap the experiment plan flags — 13 of 19 invocations in the 2026-04-15 run hit it.
- **Agent-visible output**: stdout plus the contents of the output file are concatenated and returned as `{ content: [{ type: 'text', text }] }`. On failure, the subprocess error message is returned as a text block with `isError: true` so the agent can see and reason about failures rather than have them silently retried.

### 2. TS/Python split — who owns what

| Concern | Owner | Why |
|---|---|---|
| CLI arg parsing, workspace inference | TS | `process.env.WORKSPACE_PATH` is set by conductor |
| Supabase queries (all of them) | TS | `@supabase/supabase-js` already in conductor deps |
| Image download from Supabase Storage | TS | Same |
| Gemini Vision call | TS | Uses `@ai-sdk/gateway` + `generateText` |
| JPEG cropping | TS → invokes python | PIL is the simplest tool; TS writes a tiny script file to avoid shell-quoting a Python `-c` literal |
| PDF vector extraction (PyMuPDF) | Python | No good JS equivalent |
| Distance math | Python | Same process as vector extraction |
| Debug image rendering | Python | Same (PIL already loaded) |
| Logging sidecar | Both | TS aggregates; Python writes events to stderr that TS does not currently re-ingest |

Python is invoked two ways: once for `--mode=option-a` (attempts vector matching) and once for `--mode=compute-distance` (after a localization exists, from either A or B).

### 3. Asset resolution

`getSheetStoragePaths(planSetId, sheetNumber)` walks the DB like this:

```
plan_set.id (= documentId)
  └─▶ plan_set_version (order by version_number DESC, limit 1)
        └─▶ plan_set_version_sheet (filter by sheet_number)
              └─▶ sheet_version
                    ├─ file_path        → PDF
                    └─ thumbnail_path   → JPEG
```

`documentId` is intentionally the `plan_set.id` UUID — backfilled to match the legacy `site_plan_documents.id` so older calls still resolve. If the chain returns nothing, the tool falls back to the legacy path convention `<projectId>/<documentId>/<N>.pdf` (and `dpi120-p<N>.jpg`) in the `site-plan-documents` bucket.

Both files are downloaded in parallel via `Promise.all` into `tmp/` under the output directory.

### 4. Context gathering — drawing block and legend

Two parallel Supabase queries that provide spatial and symbolic context for the vision call.

**`findDrawingBlockBbox`** — finds the largest `content_block` with `category='drawing'` on this specific sheet. Content blocks are the pre-extracted structural regions of the sheet (drawings, tables, notes, title blocks). Taking the biggest `drawing` block usually yields the site plan's main area — the part worth cropping into before asking Gemini to find objects. Returns normalized 0–1 coords.

**`findLegendContext`** — searches *across all sheets of the plan set* for blocks whose description matches `legend | symbol | abbreviat | line type | key notes` (or whose content starts with `legend`). This is the cross-sheet legend fallback: the legend is usually on the cover sheet, not on the sheet being measured. The matched text is concatenated as `[Legend from sheet N]\n<content>` and injected into the Gemini prompt under a "## Symbol Reference" section.

**Built-in fallback**: if no legend blocks are found, a small hardcoded dict is consulted for common symbols (`transformer` → "Rectangle or square with 'T' or 'XFMR' label inside", `crz`/`critical root zone`, `fire hydrant`, `water meter`) and any matching entries are injected. `legendSource` is tagged as one of `cross-sheet | builtin | none` and later influences the confidence tier.

### 5. Option A — vector matching (stubbed)

Python opens the PDF with PyMuPDF, calls `page.get_drawings()`, and filters to paths whose points lie within the drawing bbox (with 5% padding). Paths are then clustered by spatial proximity (seed each cluster with one path, expand by intersection with a 5pt-padded bounding rect until no more join).

Current v1 behavior: the tool **always returns `{ success: false }`** with one of:
- `"Too few paths (<5) — likely rasterized PDF"` — when there are fewer than 5 paths inside the drawing bbox
- `"Pattern matching not yet implemented (v1 — experimental)"` — otherwise

Everything after clustering is a `TODO`. The scaffolding (path filtering, clustering, logging) is real; the symbol recognition that would match clusters to known object signatures is not yet written. Option A's measured "failures" are informative — the rotation/path-count logs establish whether a given sheet is *even a candidate* for future vector matching (i.e. vector PDF vs. rasterized scan).

A note on PDF rotation: both `page.rect` and `get_drawings()` operate in display space (post-rotation), so bboxes in visual/display coordinates can be multiplied directly by `page.rect.{width,height}` without rotation-aware logic. The rotation value is logged if non-zero for future debugging.

### 6. Option B — Gemini Vision

When Option A fails (which is always, in v1), the TS orchestrator:

1. **Crops the JPEG** to the drawing bbox. Implemented by writing a temp `_crop.py` next to the output and invoking it with `execFileSync(python3, …)`. The script reads the bbox as JSON, opens the JPEG with PIL, crops, and writes back to a new path. Using `execFileSync` with an args array (instead of `-c "<code>"`) avoids all shell-quoting bugs — hence the `fix/measure-distance-shell-quoting` branch in git history.
2. **Reads the cropped JPEG**, base64-encodes it.
3. **Calls `generateText({ model: gateway('google/gemini-3.1-pro-preview'), messages: [{ role: 'user', content: [text, image] }] })`** via the Vercel AI Gateway. The prompt:
   - Opens with "You are analyzing an engineering site plan drawing. Locate these two objects on the image and return their positions."
   - Injects the "## Symbol Reference" section if a legend was found.
   - Names the two objects literally from the agent's inputs.
   - Instructs Gemini to return, per object: `found` (bool), `bbox` in `[y0, x0, y1, x1]` normalized 0–1000, `nearestPoint` (the point on the object's boundary nearest to the *other* object), `confidence` 0.0–1.0, and `description`.
   - Asks for strict JSON.
4. **Parses the response**. Markdown code fences are stripped if present (`json.parse` can't handle them but Gemini sometimes wraps responses in them). If either object has `found: false`, the whole localization is discarded and the result is reported as `confidence: unable`.

The Vercel AI Gateway uses `VERCEL_AI_GATEWAY_SECRET` (or equivalent) from conductor's `.env` — one of the experiment-plan blockers is confirming this is wired up.

### 7. Vector refinement — the quiet accuracy boost

After Option B succeeds with bbox-level localization, Python re-extracts PDF paths *inside each Gemini bbox*. If both regions contain ≥3 paths, it does a brute-force nearest-point search between every vertex in region A and every vertex in region B. The closest pair replaces Gemini's approximate `nearestPoint` with exact PDF vertex coordinates.

This is where the tool converts a fuzzy visual estimate into a geometrically precise measurement. When it kicks in, the result is tagged `vectorRefined: true` and promoted from `low`/`medium` to `high` confidence. When it doesn't (fewer than 3 paths in either region — e.g. rasterized sheet, or Gemini's bbox missed the symbol), the raw Gemini `nearestPoint` is used as-is.

### 8. Coordinate transformations

Gemini returns `nearestPoint` as `[x, y]` in 0–1000 normalized coordinates *of the cropped JPEG*. To use it for distance math, it needs to travel back to full-page PDF units:

```
(nx, ny) = (x / 1000, y / 1000)                    # crop-relative 0–1
x_pdf = (drawingBbox.x0 + nx * drawingBbox.width) * page.rect.width
y_pdf = (drawingBbox.y0 + ny * drawingBbox.height) * page.rect.height
```

If `drawingBbox` is absent (no crop applied), the middle step collapses to direct normalization against `page.rect`.

Same conversion runs for the bboxes when preparing vector-refinement search regions (returning a normalized 0–1 dict rather than PDF points).

### 9. Distance math

```
dist_pdf_points = hypot(pt_a.x - pt_b.x, pt_a.y - pt_b.y)
paper_inches    = dist_pdf_points / 72          # PDF uses 72 points/inch
real_feet       = paper_inches × scaleInchesPerFoot
real_inches     = real_feet × 12
```

`scaleInchesPerFoot` is the `1"=<N>'` scale from the sheet — e.g. a `1" = 20'` sheet is passed as `20`. The agent is instructed in the review prompt to read the sheet's `guide.md` and pass the scale literally.

The one anomaly I see in the live output (`output/measure-distance.json`) is `"scaleUsed": "1\" = 0.05'"` — that's the agent having passed `0.05` as `scaleInchesPerFoot`, i.e. it got the relationship inverted (a `1"=20'` scale was passed as `1/20 = 0.05`). The tool has no scale sanity-check; this manifests as a 0.1 ft answer when the real distance was likely ~40 ft. Worth flagging as a robustness gap.

### 10. Confidence tiers

| Tier | Trigger |
|---|---|
| `high` | Pure vector match (Option A) **or** Option B succeeded and vector refinement fired |
| `medium` | Option B succeeded, no vector refinement, but legend context was available (`cross-sheet` or `same-sheet`) |
| `low` | Option B succeeded, no vector refinement, no legend context |
| `unable` | Neither option produced a localization; `distanceFeet` is `null` |

The review prompt tells the agent: `high` → make pass/fail calls; `medium` → record but mark approximate; `low`/`unable` → fall back to "cannot be verified from available evidence".

### 11. Debug image

Python rasterizes the PDF at 150 DPI via `page.get_pixmap`, loads into PIL, and draws:
- Green line between the two measured points
- Blue filled circle (r=8) on point A, red circle on point B
- Distance label `"<N> ft (vector-refined | vision-estimate)"` at the line midpoint
- Top-left overlay: `"Scale: 1" = <N>'"` and `"Method: vision | vector | …"`

Saved to `<outputDir>/measure-distance/sheet-<N>-measurement.png`. The path is returned in the result JSON as `debugImagePath` so the agent can cite or attach it.

### 12. Output schema

```json
{
  "distanceFeet": 0.1,
  "distanceInches": 0.7,
  "confidence": "low",
  "localization": {
    "method": "vision",
    "fallbackUsed": true,
    "legendSource": "none"
  },
  "scaleUsed": "1\" = 0.05'",
  "objectA": {
    "description": "...",
    "found": true,
    "bbox": [864, 705, 943, 816],
    "nearestPoint": [746, 928],
    "confidence": 0.9
  },
  "objectB": { ... },
  "debugImagePath": "/.../sheet-31-measurement.png",
  "warnings": []
}
```

When localization fails entirely:
```json
{
  "distanceFeet": null,
  "distanceInches": null,
  "confidence": "unable",
  "localization": { "method": "none", "fallbackUsed": true, "legendSource": "..." },
  "objectA": { "description": "...", "found": false },
  "objectB": { "description": "...", "found": false },
  "warnings": ["Could not locate one or both objects on the sheet"]
}
```

### 13. Logging and observability

Two log channels:

- **Inline stderr** — every `logEvent()` call on both sides writes a JSON line to stderr. Conductor captures stderr at the script-tool level (currently piped but not aggregated into the final result text).
- **Sidecar file** — `measure-distance-log.json` is written next to `outputPath` at the end of every run (success, failure, or crash — the top-level `.catch` always calls `writeSidecarLog`). Contains the full sequence of structured events: `start`, `assets`, `option-a`, `option-a-result`, `option-b`, `option-b-result`, `result`, and `compute-error` if applicable.

### 14. Known limitations / rough edges

1. **Option A is a stub.** Every call falls through to Option B. Tool name is technically "two-tier" but Tier 1 is not yet implemented.
2. **120s timeout** kills ~68% of calls in the 2026-04-15 baseline run. Gemini latency + PDF parsing + Python subprocess spawn eats most of it.
3. **No scale sanity-check.** If the agent inverts the scale (passes `0.05` instead of `20`), the tool happily returns a nonsense measurement.
4. **Vector refinement is opportunistic.** Requires ≥3 paths in each Gemini bbox. Rasterized sheets skip it silently.
5. **Legend search is description-based, not embedding-based.** Misses legends whose `description` field doesn't contain the keyword list.
6. **No crop region returned.** Agent can't see how the sheet was cropped — only the debug image reveals it.
7. **stderr from Python subprocesses is inherited, not captured.** Option A's path/rotation logs end up in conductor's stderr stream but not in the sidecar log.
8. **Lives in `review-4.3/scripts/` only.** The in-progress experiment plan copies these files into `review/scripts/` so they can be used by the current production review workflow.
