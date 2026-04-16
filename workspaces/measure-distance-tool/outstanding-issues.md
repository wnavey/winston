# Outstanding Issues — measure-distance tool

Tracked issues and improvements identified during the A/B experiment work.
Ordered roughly by impact, not effort.

---

## Image quality & cropping

### 1. Cropping to the drawing block (high impact)

Currently the tool sends the **entire sheet page** to Gemini as one JPEG. Site plan sheets are typically 24"×36" with a drawing area surrounded by title blocks, revision tables, and borders — Gemini has to locate features on a cluttered image where the actual drawing occupies maybe 60% of the pixel area.

**What should happen:** Crop to the largest `drawing`-category content block before sending to Gemini. The bounding box already exists in the DB (`content_block.bounding_box` where `category = 'drawing'`) — the code queries it (`findDrawingBlockBbox()`) but it returns **null** for the Valley View Townhomes sheets because no blocks are categorized as `drawing` in the DB for sheets 21 and 31. When the bbox is null, no cropping happens.

**Sub-issues:**
- Why are these sheets missing drawing-category blocks? Is it a pre-processing gap, or are the blocks categorized differently?
- If a sheet has multiple drawing blocks (e.g., plan view + detail insets), the tool currently picks the largest. It may need to pick the right one based on the objects being measured. This could be an agentic reasoning step or a second Gemini call ("which drawing area contains these objects?").
- Effective DPI: a full-sheet JPEG at 120 DPI contains ~2000×3000 pixels. Cropping to a drawing area that's 60% of the sheet gives ~1200×1800 pixels for the actual content — still reasonable for Gemini, but features like transformer pads are only a few pixels wide. Higher DPI for the crop region would help localization precision.

### 2. Legend identification and quality (medium impact)

The tool searches all sheets for legend/symbol blocks (`findLegendContext()`) and passes legend text to Gemini as symbol context. Current issues:

- **Empty legend for most test cases** — Valley View sheets 21 and 31 returned `legendSource: "none"`, so Gemini had zero symbol context for identifying features like transformer pads, OHE lines, or tree symbols.
- **Color information lost** — JPEG compression and 120-DPI rendering may lose the color distinctions that legends rely on (e.g., blue for water, red for electric, green for landscape).
- **Material pattern symbols** — engineering drawings use hatching patterns (concrete cross-hatch, gravel dots, etc.) that legends define. These are hard to describe in text and hard for Gemini to match without the actual legend image alongside the drawing.
- **Legend should be sent as an image too** — currently it's text-only. Sending the legend block as a second image alongside the cropped drawing would let Gemini visually match symbols.

---

## Agent behavior

### 3. Agent under-uses the tool (high impact, prompt fix in flight)

Only 3 of 52 distance-measurable checklist items received a successful measurement in the experiment (5.8% coverage). The agent defaults to "not-verifiable" when plans lack dimensioned clearances, instead of using the tool to measure.

**Status:** Prompt fix landed in bureau#225 — adds explicit "measure before marking not-verifiable" instruction + systematic coverage guidance. Not yet tested in a full experiment run.

### 4. Agent passes wrong scale values (high impact, prompt fix in flight)

The `scaleInchesPerFoot` parameter was passed as:
- `"1"` (wrong ratio — means 1:1 life-sized scale, producing 0.0 ft distances)
- `"1 inch = 20 feet"` (descriptive string — Python argparse rejects it)
- `"0.05"` (correct for 1"=20' scale — only some calls got this right)

**Status:** Prompt fix in bureau#225 adds explicit numeric examples (`0.05` for 1"=20') and a "DO NOT pass strings" warning. Could also add TS-side validation to reject or auto-convert common bad formats.

### 5. Agent should pass checklist context to the tool (medium impact)

The tool currently doesn't know which checklist item(s) motivated the call. The agent picks objectA/objectB based on its reasoning, but doesn't tell the tool "I'm checking EL-13.1 (5ft from buildings)." If the tool knew the threshold, it could:
- Return a pass/fail verdict directly ("4.7 ft < 5 ft threshold → fail")
- Prioritize precision at the threshold boundary
- Log the checklist context for attribution without post-hoc guessing

This could be an optional `--checklistContext` parameter the prompt instructs the agent to provide.

### 6. How pre-processed blocks drive agent tool usage (research question)

From the run-1/13.md trace: the agent read `blocks.md` for sheet 21 and discovered transformer pad descriptions in the transcribed content. It then used the vision tool to visually confirm locations, and only then called measure-distance.

**Open questions:**
- Does the quality/specificity of blocks.md content determine whether the agent even knows there are features to measure?
- Would richer block transcriptions (e.g., "transformer pad, approximately 4 ft from building 1 facade") prompt more tool usage?
- Could we add a "distance-relevant features" annotation to blocks.md during pre-processing to prime the agent?

---

## Tool reliability & performance

### 7. Python compute-distance timeout (medium impact)

`callPython()` in `measure-distance.ts` has a hardcoded 90-second timeout. In the test-script replay, 1 of 12 real attempts hit this ceiling exactly (8% timeout rate). The timeout is consumed by:
- **Option A** (v1 stub): spends 60-80s extracting and clustering 64k vector paths from unfiltered sheets before inevitably failing. Short-circuiting Option A when `drawingBbox` is null would save ~1 minute per call.
- **Compute-distance**: usually 2-30s, but one call reached 90s.

**Fix:** (a) Short-circuit Option A when drawingBbox is null. (b) Bump timeout to 180s as a safety net. (c) Investigate what makes compute-distance occasionally slow.

### 8. Option A vector matching is a v1 stub (low urgency, high eventual value)

The Python `attempt_vector_matching()` function extracts vector paths via PyMuPDF, clusters them, then returns `success: false` with reason "Pattern matching not yet implemented." Every call falls through to Option B (Gemini Vision).

**When this matters:** Option A would be faster (no LLM call), deterministic, and more precise for features that have clean vector representations in the PDF (transformer pads are rectangles, utility lines are polylines). But implementing real pattern matching against the variety of CAD export styles is a substantial R&D project.

**For now:** Option A should at least short-circuit instantly when it can't help (no drawing bbox, rasterized PDF) rather than spending 60s on futile path extraction.

### 9. Gemini response time variability (medium impact)

Option B (Gemini 3.1 Pro via Vercel AI Gateway) response times ranged from 5s to **201s** in the test-script replay. The 201s outlier is likely a cold start or rate-limit backoff.

**No timeout currently exists** on the Gemini call — it runs inside the TS process (not a subprocess), so neither the 90s Python timeout nor conductor's 120s script-tool timeout applies.

**Fix:** Wrap `generateText()` in an `AbortController` with a 90s cap. A 3+ minute Gemini call is almost certainly wasted.

---

## Vertical distances & redlines

### 10. Vertical distance measurement (hard problem, high value)

23 of 101 checklist items (23%) require **vertical** clearance verification (e.g., "16-foot vertical clearance for driveways under OHE", "35-foot vertical clearance in niches"). The tool currently only measures horizontal/lateral distances in plan view.

**What's needed:**
- Profile/section sheets show vertical relationships, but they're drawn differently from plan views — they have elevation axes, ground lines, and vertical dimension lines.
- The tool would need to identify profile sheets, locate the relevant cross-section, and read the vertical dimension.
- **Redlines** (hand-drawn or digital annotations showing measured clearances on profile views) are the standard workflow for this. Integrating redline generation or reading would unlock the vertical items.

This is a separate tool or a major extension — not a quick fix.

---

## Infrastructure & analysis

### 11. Compare-findings analysis script (pending)

Step 8 in the experiment plan — `compare-findings.ts` that diffs baseline vs experiment findings. Not yet built. Should be built against real data once we have a successful experiment run with the prompt improvements.

### 12. Conductor shell-quoting fix needs merge (blocking replays)

noetic-inc/conductor#121 fixes two bugs in the script-step executor:
- Shell metacharacters in arg values (parentheses in objectA/objectB text) break `/bin/sh` parsing
- Missing `NODE_PATH` prevents scripts from importing conductor's dependencies

**Status:** PR open, not yet merged. Blocks all `test-script` workflow replay runs.

### 13. experiment-plan.md references stale paths (minor)

The fixture replay section in `experiment-plan.md` references `/Users/winston/workspace/winston/...` which is a different machine's path. Should be corrected to the actual path or made relative.
