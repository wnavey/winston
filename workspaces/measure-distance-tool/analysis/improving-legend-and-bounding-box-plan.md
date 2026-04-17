# Improving Legend and Bounding Box Accuracy

Two related problems limit measurement accuracy today. This plan proposes a
solution approach and evaluates trade-offs.

## Problem 1: Irrelevant legend context

**Current state:** Every Gemini call includes ~15 KB of cross-sheet legend
text — every legend/symbol/abbreviation block from ALL sheets in the plan
set, concatenated. Most of this is irrelevant to the specific pair of objects
being measured.

**Why it matters:** Irrelevant context competes for the model's attention.
When measuring tree-to-OHE distance, the Gemini prompt includes legend entries
for drainage symbols, fire hydrant types, road markings, etc. The model has
to filter signal from noise. Additionally, text descriptions of symbols lose
critical information — a "tree symbol" described in text is less useful than
showing the model what the actual tree symbol looks like on this drawing.

**Opportunity:** Send **visual legend context** (cropped images of the
relevant symbols from the legend block) rather than the full text dump. A
small image of "this is the tree symbol" is worth more than a paragraph
describing it.

## Problem 2: Suboptimal effective DPI

**Current state:** We render the full sheet at 120 DPI and crop to the
drawing-block region. For Valley View Townhomes:

| Sheet | Full JPEG | Cropped JPEG | Physical size | Effective DPI |
|-------|-----------|-------------|--------------|--------------|
| 31 (landscape) | 4320 × 2880 | 2804 × 1720 | ~36" × 24" | ~120 |
| 21 (electrical) | 4320 × 2880 | 3811 × 2705 | ~36" × 24" | ~120 |

Gemini's maximum effective resolution is approximately 300 DPI. We're
sending images at 120 DPI — **less than half** the model's resolution
ceiling. For small features like tree symbols (~0.1" on paper = 12 pixels
at 120 DPI), the model is working with very few pixels to distinguish one
symbol from another.

**Why it matters:** When two objects are close together (the typical case
for clearance violations), the pixel distance between their nearestPoints
at 120 DPI may be only 5–15 pixels. A ±2 pixel localization error at this
resolution translates to ±0.8 feet at 1"=20' scale — enough to be the
difference between "compliant" and "violation." At 300 DPI, the same error
is ±0.3 feet.

**Opportunity:** Re-render the region of interest from the PDF at higher
DPI. The PDF is a vector source — we can render any subregion at any DPI
without quality loss.

## Proposed solution: two-call Gemini approach

Split the current single Gemini call into two calls with different purposes.

### Call 1 — Coarse localization (WHERE are the objects?)

**Input:**
- Drawing-block crop at 120 DPI (same as today)
- Minimal legend context (text only, or omit entirely)
- Standard prompt: "Find objectA and objectB, return bounding boxes"

**Output:**
- Rough bounding boxes for both objects (in 0–1000 normalized coords)
- Confidence scores

**Purpose:** Identify approximately where on the sheet the two objects are.
Precision requirements are low — we just need to know which region to zoom
into. This call is essentially the same as what we do today.

### Between calls — crop refinement + legend extraction

Using the coarse bboxes from call 1:

1. **Compute the region of interest:** Union bbox of objectA + objectB,
   expanded by a padding factor (e.g., 30% on each side, clamped to
   drawing bounds). This captures both objects plus enough surrounding
   context for the model to identify them.

   For the tree-to-OHE example: the tree is a small bbox near the bottom
   of the sheet; the OHE line stretches across the full width. The union
   bbox captures the portion of the OHE line closest to the tree, plus the
   tree itself — not the entire line.

2. **Re-render from PDF at high DPI:** Use PyMuPDF to render just the
   region of interest at 300 DPI (vs 120 DPI for the full sheet). If the
   region is 25% of the sheet area, the output image is ~3000 × 2000 px
   at 300 DPI — well within Gemini's processing limits but with 2.5× the
   detail.

   | Scenario | Render area | DPI | Pixels | Effective detail |
   |----------|------------|-----|--------|-----------------|
   | Today (full sheet) | 100% | 120 | 4320 × 2880 | 1× (baseline) |
   | Refined (25% crop) | 25% | 300 | ~3000 × 2000 | **2.5×** |
   | Refined (10% crop) | 10% | 300 | ~2000 × 1500 | **6×** |

3. **Extract legend symbol images:** From the content_block metadata,
   identify which legend blocks contain symbols relevant to the objects.
   Crop those blocks from the sheet at high DPI and prepare as reference
   images.

   Example: if objectA is "mitigation tree marked M," find the legend
   block that defines the "M" tree symbol and crop a small image of just
   that entry.

### Call 2 — Refined localization (PRECISELY where?)

**Input:**
- High-DPI crop of the region of interest (300 DPI)
- Legend symbol images as separate reference images (if available)
- Refined prompt: "In this zoomed-in view, locate objectA and objectB
  precisely. Here is what the tree symbol looks like [image]. Here is
  what the OHE line symbol looks like [image]. Return bounding boxes
  and nearestPoint coordinates."

**Output:**
- Precise bounding boxes within the cropped region
- High-confidence nearestPoints with more pixels to work with

**Purpose:** Maximum precision for the measurement that matters. The model
sees 2–6× more pixels per inch of drawing, and has visual confirmation of
what the symbols look like.

## Pipeline flow (updated 7-phase model)

```
1.  Agent → MCP tool → CLI args
2.  Download PDF + JPEG from Supabase
3.  In parallel:
    a. Find largest drawing-block bbox
    b. Find legend blocks (text + image regions)
4.  Option A: Python vector-match (stub)
5.  Crop JPEG to drawing bbox (same as today)
6a. CALL 1 — Coarse localization on cropped JPEG
6b. Compute refined crop region (union of coarse bboxes + padding)
    + Re-render from PDF at 300 DPI
    + Extract legend symbol images
6c. CALL 2 — Refined localization on high-DPI crop + legend images
7.  Python compute-distance on refined nearestPoints
```

## Legend symbol extraction — detail

### Data already available

The `content_block` table already stores:
- Block category (drawing, legend, notes, etc.)
- Block bounding box (normalized coordinates)
- Block description and content text

We already query this for `legendSource` context. The extension is to also
crop the legend block's bounding box region from the sheet JPEG/PDF at high
DPI, producing a small reference image.

### What to send

For call 2, include 1–2 legend reference images alongside the main crop:

```
[Image 1: High-DPI crop of region of interest]
[Image 2: Legend entry for objectA's symbol type — optional]
[Image 3: Legend entry for objectB's symbol type — optional]

Prompt: "In this zoomed-in view of the engineering drawing, locate:
- Object A: [description]. [If Image 2 present: See the legend image
  for what this symbol looks like.]
- Object B: [description]. [If Image 3 present: See the legend image
  for what this symbol looks like.]
Return bounding boxes and nearestPoint coordinates."
```

### Matching symbols to legend entries

This is the hard part. Options (in order of increasing sophistication):

1. **Keyword matching:** objectA description mentions "tree" → find legend
   blocks with "tree" in their content. Simple, works for common cases.

2. **Agent-provided hint:** The review agent already knows what it's looking
   for. Add an optional `symbolHint` field to the tool input (e.g.,
   `symbolHint: "mitigation tree, marked M on landscape plan"`). Use this
   to search legend content.

3. **Send the full legend image:** Don't try to match — just send the entire
   legend block as one reference image. Let Gemini figure out which entry
   is relevant. This is simple and avoids false-negative matching.

**Recommendation:** Start with option 3 (full legend image). If the legend
block is large or multi-page, fall back to option 1 (keyword crop).

## Expected improvements

### Accuracy

| Factor | Before | After | Improvement |
|--------|--------|-------|------------|
| Effective DPI | 120 | 300 | 2.5× pixel density |
| Localization error (estimated) | ±2 px → ±0.8 ft | ±2 px → ±0.3 ft | 2.5× more precise |
| Legend context | 15 KB text (all sheets) | Targeted symbol images | Less noise, visual confirmation |
| Small-feature identification | ~12 px for 0.1" symbol | ~30 px | Better distinguish individual symbols |

### Near-zero measurement resolution

At 120 DPI / 1"=20' scale, 1 foot of real distance = 0.6 pixels. The model
can't distinguish 0 from 5 feet. At 300 DPI, 1 foot = 1.5 pixels — still
tight, but measurably better. For the 3 cases in run3 that returned 0 ft
despite being near-but-not-zero clearances, 2.5× DPI may tip the balance.

## Trade-offs

### Cost

Two Gemini calls per measurement instead of one. At ~$0.01–0.03 per call,
this doubles the Gemini cost to ~$0.02–0.06 per measurement. Negligible
relative to the Claude agent cost (~$0.50–2.00 per review).

### Latency

Two sequential Gemini calls: ~90s + ~60s (call 2 on a smaller image should
be faster) = ~150s total, vs ~90s today. A 67% increase per measurement.
However, objectPairs batching means this latency is amortized across multiple
pairs per tool call.

### Complexity

The TS orchestrator (`measure-distance.ts`) adds:
- A second Gemini call path
- PDF subregion re-rendering (PyMuPDF, already available)
- Legend image extraction and attachment
- Coordinate mapping between full-page, drawing-crop, and refined-crop
  reference frames

Estimated: ~150–200 additional lines in measure-distance.ts.

### When NOT to use call 2

If the coarse bboxes from call 1 already have high confidence AND the
objects are large/well-separated (e.g., building footprint vs property
line), the second call adds latency for little benefit. Consider a
heuristic: skip call 2 if:
- Both bboxes span >10% of the image (objects are large)
- Confidence is ≥0.95 on both
- Distance between bbox centers is >200 units (well-separated)

This keeps the fast path for easy cases and reserves the two-call
approach for the hard ones.

## Implementation path

### Phase A — High-DPI re-render (DPI fix only, no legend images)

1. After call 1, compute the union bbox of the two coarse localizations
2. Expand by 30% padding on each side, clamp to drawing bounds
3. Use PyMuPDF to render the subregion at 300 DPI
4. Run call 2 with the same prompt structure, just a better image
5. Coordinate mapping: call 2's 0–1000 coords are relative to the
   refined crop; map back to full-page before compute-distance

**Estimated effort:** 1–2 days. Mostly TS orchestrator changes +
Python coordinate mapping.

**Validation:** Re-run the test-script fixture. Compare distance values
and debug.png precision against the single-call baseline. The viewer
can show side-by-side crops.

### Phase B — Legend symbol images

1. During step 3b (legend context collection), also crop the legend
   block regions from the sheet as images
2. In call 2, attach 1–2 legend images alongside the refined crop
3. Update the prompt to reference the legend images

**Estimated effort:** 1 day on top of Phase A.

**Validation:** Visual inspection via the viewer. Check if the
legend image matches the target objects. Compare Gemini confidence
between with-legend and without-legend variants.

### Phase C — Skip heuristic

1. Add the size/confidence/distance heuristic
2. Log whether call 2 was skipped or invoked
3. Track latency delta between skipped and non-skipped

**Estimated effort:** 0.5 day. Mostly conditional logic + logging.

## How to validate

The test-script fixture replay framework is already set up. To A/B this:

1. Run the fixture with the current single-call approach (baseline exists: `run2-test-fixture-1`)
2. Implement Phase A
3. Run the same fixture with the two-call approach
4. Compare:
   - Do distance values change? By how much?
   - Do the 3 zero-distance cases in run3 become non-zero?
   - Does the debug.png show dots at more precise locations?
   - What's the latency delta?

For ground truth validation (Phase 2 of the science plan): the two-call
approach should bring measurements closer to human-verified distances.
If 120 DPI measurements average ±2 ft error and 300 DPI measurements
average ±0.8 ft error, that's a clear quantitative improvement.

## Open questions

1. **Gemini multi-image support:** Can we send multiple images in a single
   Gemini Vision call? (Main crop + legend images.) If not, the legend
   images would need to be composited into the main image or sent as a
   separate call.

2. **Legend block granularity:** Some sheets have one big legend with 30+
   entries. Do we send the whole thing, or try to crop just the relevant
   entries? Sending the whole legend block at 300 DPI may be large.

3. **Scale bar in the refined crop:** If we crop tightly, we may lose the
   scale bar. The model doesn't use the scale bar (we pass the numeric
   scale), but losing visual context about relative sizes might affect
   localization quality. Consider always including the scale bar region
   in the refined crop.

4. **Non-rectangular features:** The OHE line is a thin horizontal line
   spanning the sheet. The union bbox of "tree (small) + OHE line (wide)"
   may still be a very wide crop with relatively low height — not
   dramatically smaller than the original. Need to handle this gracefully,
   possibly by padding vertically to maintain aspect ratio.
