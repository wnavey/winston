# `transcribe-mcr-text` — Design Spec

> **Status:** Draft, 2026-06-25. Cross-cutting feature spec spanning
> [`generate-crc-guides`](../generate-crc-guides/DESIGN-SPEC.md),
> [`generate-crc-guides-from-redlines`](../generate-crc-guides-from-redlines/DESIGN-SPEC.md),
> Substation, and [`cityhall-ui`](../cityhall-ui/DESIGN-SPEC.md). Adds a
> per-checklist provenance artifact (the **source-map**) so the cityhall CRC
> UI can show, for each atomic checklist item, the exact source-comment text
> it was derived from — and, in a follow-up phase, a cropped image with the
> sub-span highlighted.

---

## 1. Overview

**Purpose.** Today the U0 MCR Resolution tab in cityhall surfaces atomic
checklist items with a `Parent: SP33`-style breadcrumb (cityhall-ui Q9), but
the applicant has to flip to their MCR PDF to read the actual comment text
the agent was evaluating against. That round-trip is friction during triage
and weakens applicant trust in agent verdicts. This feature attaches the
verbatim source comment (and, for atomic items more granular than their
parent, the exact sub-span) to each checklist row, with a path to a
cropped-image / PDF-highlight follow-up.

**The artifact.** A single `source-map.json` per generation, written by both
generate skills, uploaded to the same `crc-guides` Supabase bucket prefix
that already houses the guides, and read by a new Substation endpoint that
the cityhall UI calls.

**Position in the CRC pipeline.**
```
generate-crc-guides{,-from-redlines} skill          Conductor workflow      cityhall UI               Substation
[ Claude Code, HITL ]                          →    [ unchanged ]       →   [ adds inline source ]    [ adds /api/crc/source-map ]
MCR / redline PDF → crc-*.md + source-map.json      crc-*.md + plans →      DB rows + source-map →     reads bucket, returns JSON
                  + (optional) crops                review rows             source text per row
```

**Mental model.** Source-map is **immutable per generation** — once a
generation is written, the JSON is content-stable forever. The lookup chain
is: `reviewId → reviews.metadata.crcGuides.{bucket, prefix} →
{bucket}/{prefix}source-map.json → item by checklist_id`. No new DB schema.

**Out of scope for this iteration:**

- Triggering a regeneration to fix a stale source-map.
- Backfill of source-maps for prior generations (decided: Q19 — none).
- In-browser PDF.js viewer with autoscroll + bbox overlay
  ([§9.3](#93-phase-3--pdfjs-viewer-with-autoscroll--bbox-overlay) — design
  sketch only, no implementation).
- Source-text capture for hand-edited guides — degrade to "source unknown"
  per [§8.2](#82-hand-edited-guides).
- Cross-MCR / cross-submission consolidation (one source-map per
  generation; per cityhall Q11 the applicant works one review at a time).
- Surfacing source-map data anywhere other than the U0 MCR Resolution tab
  (e.g. CRC PDF report, BLUE response capture).

---

## 2. Decisions captured (from the 2026-06-25 session)

Twenty design questions were resolved in the spec-shaping session. Compact
ledger:

| #   | Decision |
|-----|----------|
| Q1  | Per-item entry carries **both** the full parent-comment text and the sub-span the item came from. Phase-2 crops are at parent-comment granularity, with sub-span coords stored separately so the UI can overlay a highlight on the parent crop. |
| Q2  | One checklist item → one source span (1:1, may be N:1 to parents). Generation-time post-check flags `source_count > 1` as an emit-time error in `bureau_lookup_failures`-style log; never reaches the JSON. |
| Q3  | Capture **both** the (often-equal) checklist ID and the raw MCR comment ID. They diverge when atomization splits a comment (e.g. `SP-33.1`, `SP-33.2` → parent `SP33`). |
| Q4  | Redline path produces source-map rows too. Bring image crops forward into MVP for the redline path (navalbase already has bboxes and crops). For the text side, use navalbase's `referenced_element` as the verbatim. |
| Q5  | Unified schema, with `source_type: 'mcr_text' \| 'pdf_redlines'` discriminator. The UI branches on this for conditional behavior (e.g. "Source: redline page X" vs "Source: MCR comment SP33"). |
| Q6  | Extraction is a **loop**: (a) LLM-emit verbatim during initial checklist generation, (b) deterministic substring match in `pdftotext` output, (c) on miss, agentic vision-recovery pass with a cropped-page image, (d) re-validate deterministically, (e) commit with a confidence label. Cap 2 vision retries per item. |
| Q7  | No per-item confidence/quality score exposed in MVP — internal label only, used to gate "source unknown" UI fallback. |
| Q8  | Hand-edited guides → "source unknown" badge in the UI. No editor tooling to reconcile. |
| Q9  | Review → generation linkage is **already there**: `reviews.metadata.crcGuides.{bucket, prefix, projectId, submissionId, u0VersionNumber, crcGenerationNumber}`. No new DB plumbing. |
| Q10 | "Generation number" is a 0-based integer already stamped into `manifest.json` and the metadata blob. Stable, monotonic. |
| Q11 | Checklist IDs are **not** stable across regenerations. Therefore the lookup must pin to the exact generation the review consumed — the review row already does this via `crcGuideGenerationNumber`. |
| Q12 | **One** `source-map.json` per generation root, covering all departments. Department is a per-item field. ~217 items × ~600 B = ~130 KB; trivial. |
| Q13 | Local + bucket path: `{root}/{projectUuid}/{submissionUuid}/{u0VersionNumber}/{crcGenerationNumber}/source-map.json`. Crops in a `source-text-crops/` sibling dir. |
| Q14 | Substation API returns the **entire** source-map for a review in one batch call. Items are ~217 max; per-row fetch would be N+1. |
| Q15 | New endpoint owned by **Substation** (has Supabase storage + workflow-run DB access already). Cityhall is a thin consumer. |
| Q16 | MVP UI is inline collapsible **under each row** (option a from the Q-list). Sidebar pattern (option c) is the v2 target — noted in §9.2. |
| Q17 | Bboxes are mandatory **from day one** (every emitted row), even though the UI doesn't render them until phase 2. Cheaper to capture once than to backfill. Source MCR PDF is uploaded to the same bucket prefix to support the phase-3 PDF.js viewer. |
| Q18 | Source-map unavailable / missing item → degrade silently, "source unknown" badge. **Never** hard-error. Supplementary feature. |
| Q19 | No backfills. New runs only. In-flight reviews against older generations continue to work (their UI just shows "source unknown" for every row, which is the existing behavior anyway). |
| Q20 | Spec scope = MVP (phases 1–2) **plus** design sketches for phase 3 (PDF.js viewer) and beyond. Phases 1–2 are buildable from this doc; phase 3 needs a follow-up DESIGN-SPEC. |

---

## 3. Glossary

- **Parent comment.** The raw MCR comment as it appears in the MCR PDF
  (e.g. `SP33`, prefixed by department code) or the raw navalbase redline
  comment (e.g. `AW-RL-3`). One per source-PDF box / numbered comment.
- **Atomic checklist item / item.** A row in the generated `crc-{dept}.md`
  table — the unit of agent evaluation. May equal its parent (1:1) or be
  one of N siblings under a parent (`SP-33.1` / `SP-33.2` both under
  `SP33`). Identified by `checklist_id`.
- **Source span.** The substring of the parent comment text that this
  specific atomic item is in reference to. For a 1:1 atomic item, the span
  equals the parent. For an atomized split, the span is strictly narrower.
- **Generation.** One run of `generate-crc-guides` or
  `generate-crc-guides-from-redlines` against a `(project, submission, U0
  version)`. Identified by `(projectUuid, submissionUuid, u0VersionNumber,
  crcGenerationNumber)`. Immutable once written.
- **`source-map.json`.** The new per-generation artifact this spec defines.
- **`source-text-crops/`.** New per-generation directory holding PNG crops
  of each parent comment region in its source PDF. Phase 2 deliverable;
  not present in phase-1 outputs.

---

## 4. Data model — `source-map.json`

### 4.1 Top-level shape

```jsonc
{
  "schema_version": "1.0",
  "generated_at": "2026-06-25T18:32:00Z",
  "generation": {
    "project_id": "23301a8a-4cdb-4751-ac0c-93b97f0f5c12",
    "submission_id": "cf1201c2-2e8b-4034-9a5e-a70b6317e39a",
    "submission_version_id": "6b9b85ed-e992-4906-a222-b24ee836910c",
    "submission_version_number": 4,
    "crc_generation_number": 2
  },
  "source_pdfs": {
    "mcr.pdf": {
      "sha256": "aae036fc...",
      "original_filename": "1700 S Lamar - U0 MCR.PDF",
      "uploaded_to_bucket": true
    },
    "source-pdfs/1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf": {
      "sha256": "b32b945c...",
      "original_filename": "1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf",
      "uploaded_to_bucket": true
    }
  },
  "parent_comments": [ /* §4.2 */ ],
  "items": [ /* §4.3 */ ],
  "stats": {
    "total_items": 217,
    "items_with_exact_match": 198,
    "items_with_vision_recovery": 15,
    "items_with_source_unknown": 4
  }
}
```

`schema_version` exists so the Substation endpoint can refuse to serve a
future-version file it can't safely render fields out of. Bump major on any
breaking field change; bump minor on additive changes.

`generation` is a redundant copy of `reviews.metadata.crcGuides.*` for
defense-in-depth — if a source-map were ever fetched standalone (out-of-band
debugging, support ticket), the file self-describes its provenance.

### 4.2 `parent_comments[]`

One entry per source comment. Atomized children reference its `id`.

```jsonc
{
  "id": "SP33",                       // matches the existing markdown "Parent Comment" column
  "department_code": "SP",
  "source_type": "mcr_text",          // 'mcr_text' | 'pdf_redlines'
  "source_pdf": "mcr.pdf",            // path relative to generation root
  "verbatim_text": "SP33 - Current Status: Pending\nU0: Coordinate the Site Data Table and Landscape Plan to show a consistent amount of open space to meet Subchapter E Requirements. Show the type of open space proposed and provide dimensions and amenities required for that open space type. (Example: A landscape area other than one required by Subchapter C, Article 9 (Landscaping), provided such landscaped area has a minimum depth and width of 20 feet and a minimum total area of 650 square feet. The area shall include pedestrian amenities.)",
  "bbox": [                           // list to allow multi-page comments
    { "page": 12, "x0": 72.0, "y0": 480.5, "x1": 540.0, "y1": 612.3, "coord_space": "pdf_user" }
  ],
  "crop_image": "source-text-crops/SP33.png",  // optional in phase 1; written in phase 2
  "extraction": {
    "method": "deterministic",        // 'deterministic' | 'vision_recovery' | 'navalbase_passthrough' | 'failed'
    "verbatim_match": "exact",        // 'exact' | 'fuzzy' | 'vision' | 'failed'
    "validation_passes": 1,
    "confidence": "high"              // 'high' | 'medium' | 'low'
  }
}
```

**Field notes:**

- `bbox.coord_space` is **always** `pdf_user` — origin bottom-left, PDF
  user-space units (1/72 inch). This is the convention pdfplumber and
  pymupdf use natively. When crops or the phase-3 PDF.js viewer translate
  to image-pixel coords (origin top-left), the math is `y_image = page_h -
  y_pdf` and the rect height needs flipping. Implementation hazard worth
  testing once and locking down (see §8.4).
- `bbox` is an **array** even when there's only one rect, so a comment that
  wraps across columns or pages can be represented without a schema change
  later.
- `crop_image` is the **parent crop** path (relative to generation root).
  When present, the UI may render it with a sub-span highlight overlay
  computed from the atomic item's bbox (§5.3, phase 2).
- `source_type: 'pdf_redlines'` entries reuse the navalbase-cropped image
  if available (the redline path already produces `figures/AW-RL-N/…`); see
  §6.2 for path conventions.

### 4.3 `items[]`

One entry per atomic checklist item, keyed by `checklist_id` (matches the
ID column in `crc-{dept}.md`).

```jsonc
{
  "checklist_id": "SP-33.1",
  "department_code": "SP",
  "parent_comment_id": "SP33",
  "source_span": {
    "verbatim_text": "Coordinate the Site Data Table and Landscape Plan to show a consistent amount of open space to meet Subchapter E Requirements.",
    "char_offset_in_parent": [25, 158],   // [start, end_exclusive] in parent_comment.verbatim_text
    "bbox": [
      { "page": 12, "x0": 96.0, "y0": 552.0, "x1": 540.0, "y1": 580.0, "coord_space": "pdf_user" }
    ]
  },
  "extraction": {
    "method": "deterministic_substring",  // 'deterministic_substring' | 'vision_recovery' | 'failed'
    "verbatim_match": "exact",
    "confidence": "high"
  }
}
```

**Field notes:**

- For 1:1 cases (most redlines, plenty of MCR comments), `source_span` is
  effectively a copy of the parent's `verbatim_text` and a bbox identical
  to the parent's first rect. We still emit it explicitly — the UI doesn't
  need to special-case 1:1 vs N:1.
- `char_offset_in_parent` lets the UI render the parent text with the span
  highlighted (`<mark>` substring), independent of bbox/image work. This is
  the **MVP-text-only-UI primary affordance**.
- `bbox` is optional in `source_span`. If sub-span bbox extraction fails
  (e.g. fuzzy match found the substring in `verbatim_text` but bbox
  resolution couldn't map characters back to PDF rects), still emit the
  item with `bbox: []` and `confidence: "medium"`. The UI just doesn't draw
  the highlight overlay; the text-highlight still works.
- `extraction.confidence: "low"` items are emitted with
  `source_span.verbatim_text: null` and `extraction.method: "failed"`.
  Surfaces as "source unknown" in the UI.

### 4.4 Invariants enforced at emit time

The generate skills MUST validate before writing the file:

1. Every `items[i].parent_comment_id` resolves to a row in
   `parent_comments[]`. No orphans.
2. Every `parent_comments[i].id` is unique within the file.
3. Every `items[i].checklist_id` is unique within the file.
4. `items[i].source_span.char_offset_in_parent[0] < ...[1] <=
   len(parent.verbatim_text)`. Off-by-one bugs caught at emit time.
5. `source_span.verbatim_text` (when non-null) equals
   `parent.verbatim_text[start:end]` exactly. (This is the contract that
   makes char-offsets meaningful.)
6. The Q2 invariant: a single `checklist_id` cannot have ≥2 source spans.
   The schema does not even allow it.

A violation halts emit and is logged in `manifest.json` under
`source_map_emit_errors`. The guides still write; the source-map does not.
The UI then degrades gracefully (every row shows "source unknown").

---

## 5. Generation-side pipeline changes

### 5.1 Where this hooks in

**`generate-crc-guides` (MCR path):** new **Phase 7.5** between the existing
checklist-generation phase (Phase 7) and the file-write phase (Phase 8). At
Phase 7.5 entry, the skill already has:

- The raw MCR text dump (`scratch/mcr.txt` from `pdftotext -layout`).
- The parsed raw comments (`{raw_id, dept_prefix, comment_number, status,
  body, code_reference, source_page}` array — DESIGN-SPEC §3.1).
- The atomized checklist rows that will be written to `crc-{dept}.md`,
  each tagged with its `parent_comment_id` (the existing "Parent Comment"
  column).

**`generate-crc-guides-from-redlines` (redline path):** new **Phase 5.5**
between the existing checklist-emit phase and file-write. At entry the
skill already has the navalbase `detailed-analysis-results.json` open with
per-comment `bounding_box`, `transcribed_text`, and `referenced_element`
fields available.

### 5.2 The extraction loop (MCR path)

For each parent comment that produced ≥1 atomic checklist item:

**Step 1 — Parent verbatim text + bbox (deterministic first).**

The raw comment is already extracted from `pdftotext` output during Phase
1. Reuse that string as `parent_comments[i].verbatim_text` directly — no
LLM in this step. For bbox: run `pdfplumber` to locate the exact rect of
the parent's text on its `source_page`, by anchoring to the comment header
(e.g. `"SP33 - Current Status:"`) and walking forward until the next
comment header or end-of-page.

If pdfplumber can't anchor (e.g. scanned MCR with no text layer, see §8.1),
fall through to step 3 (vision recovery) for the parent crop. The verbatim
text is still good — it comes from the pdftotext layer which works even on
some scans via OCR.

**Step 2 — Atomic sub-span (deterministic substring match).**

For each atomic item under this parent: the existing Phase-7 LLM emit
includes a new required field, `source_span_verbatim`, in its structured
output. Substring-match that against `parent.verbatim_text`. On hit:

- Record `char_offset_in_parent`.
- Map those character offsets back to PDF rects via pdfplumber's
  `extract_text(...)` + `rect` cross-reference. Multi-line spans produce
  multi-rect bbox arrays.
- `extraction.method = "deterministic_substring"`, `verbatim_match =
  "exact"`, `confidence = "high"`.

**Step 3 — Fuzzy match fallback.**

On exact-substring miss: try `rapidfuzz.process.extractOne` against
all-sentence-tokenized parent text, threshold 90. On hit:

- Use the matched substring as the span verbatim (overwriting what the LLM
  produced — the parent text is ground truth).
- `extraction.method = "deterministic_substring"`, `verbatim_match =
  "fuzzy"`, `confidence = "medium"`.

**Step 4 — Vision recovery (last resort).**

On fuzzy miss too: crop the parent's page using the parent's known bbox,
send to Opus 4.7 vision with the prompt *"This is the source MCR comment.
The agent extracted the following atomic checklist item: <item title +
description>. Quote the exact substring of the source comment that this
item is in reference to. Return verbatim — no paraphrase. If no such
substring exists, return null."*

- On a returned substring: re-run step 2 deterministic match against the
  *vision-returned* string. If it now matches: `extraction.method =
  "vision_recovery"`, `verbatim_match = "vision"`, `confidence =
  "medium"`.
- On null or another miss: retry once with a tighter, page-zoomed-in crop.
- Hard cap: 2 vision attempts per item.
- Final failure: `verbatim_match = "failed"`, `confidence = "low"`,
  `source_span.verbatim_text = null`. Item still emits.

**Step 5 — Final deterministic re-validation.**

Before writing the file, walk every item and re-check invariant §4.4.5
(`source_span.verbatim_text == parent.verbatim_text[start:end]`). Any
violation flips the item to `verbatim_match = "failed"` and logs a
`source_map_emit_warning`. The loop only commits a write when invariants
pass — partial failures are acceptable (mark item failed) but inconsistent
state is not.

**Concurrency:** Step 1 is sequential per parent (small). Steps 2–4 fan
out per atomic item — the existing skill already runs in parallel agents
per department, so this work piggybacks on that fan-out. Vision calls cap
parallelism to whatever the conductor enforces.

### 5.3 The extraction loop (redline path)

Simpler. navalbase already did the hard work:

```
detailed-analysis-results.json per-comment row:
{
  comment_id: "AW-RL-3",
  bounding_box: { x0, y0, x1, y1, page },
  referenced_element: "<verbatim text the redline was pointing at>",
  transcribed_text: "<verbatim text of the redline annotation itself>",
  ...
}
```

For each emitted redline row:

- `parent_comments[i].verbatim_text` = navalbase `referenced_element`
  (which is the underlying MCR-like text the redline references). If
  `referenced_element` is empty, fall back to `transcribed_text` (the
  redline annotation text itself).
- `parent_comments[i].bbox` = navalbase `bounding_box` directly.
- `parent_comments[i].crop_image` = the existing
  `figures/{comment_id}/…png` path written by the existing skill (Phase 5
  of the redlines DESIGN-SPEC). **Phase 1 of this spec is allowed to
  populate this for redlines but not for MCR** — see Q4.
- `extraction.method = "navalbase_passthrough"`, `verbatim_match =
  "exact"`, `confidence = "high"`.

Since redline checklist IDs are 1:1 with parent comment IDs today
(`AW-RL-3` = parent `AW-RL-3`), the `items[i].source_span` is just a
copy of the parent's verbatim and bbox. If a future iteration atomizes
redlines further, the same step-2/3/4 ladder applies.

### 5.4 Parent crops (phase 2 — MCR path)

Once the MCR-side bboxes are stable in phase 1, phase 2 adds a small
post-emit step:

```python
import pymupdf
for parent in parent_comments:
    if parent.source_type != "mcr_text": continue
    if not parent.bbox: continue
    page = doc[parent.bbox[0]["page"] - 1]
    rect = pdf_user_to_pixmap_rect(parent.bbox, page.rect.height)
    pix = page.get_pixmap(clip=rect, dpi=180)
    pix.save(f"{gen_dir}/source-text-crops/{parent.id}.png")
```

180 DPI keeps the file size in low-double-digit KB per crop and stays
legible on a retina display. Multi-rect bboxes (multi-page comments) emit
multiple PNGs, named `{parent_id}--{rect_index}.png` — the source-map
field becomes an array in that case.

This step is cheap once bboxes are correct. The hazard is purely the
coord-frame translation (§8.4).

---

## 6. Storage & file layout

### 6.1 Local generation root (unchanged, plus two new artifacts)

```
{NOETIC_WORKING_DIR}/comment-resolution-check/
  {projectUuid}/
    {submissionUuid}/
      {u0VersionNumber}/
        {crcGenerationNumber}/
          crc-aw.md
          crc-sp-1.md
          crc-sp-2.md
          ...
          mcr.pdf
          manifest.json
          manifest-redlines.json
          figures/                       # existing: figures referenced inside MCR comments
          source-pdfs/                   # existing: redline PDFs
          scratch/
          decisions.md
          ignored-comments.md
          source-map.json                # NEW (phase 1)
          source-text-crops/             # NEW (phase 2, mcr_text + redlines)
            SP33.png
            SP36.png
            AW-RL-3.png
            ...
```

### 6.2 Crop path convention

- **MCR-sourced parent comments:** `source-text-crops/{parent_id}.png`
  (e.g. `SP33.png`). Multi-rect spans: `{parent_id}--{rect_index}.png`.
- **Redline-sourced parent comments:** reuse existing navalbase crops at
  `figures/{parent_id}/…png` rather than re-cropping. The
  `parent_comments[i].crop_image` field points there directly. Phase 2 of
  this spec **does not** introduce a new redline crop.

### 6.3 Supabase bucket layout

Existing `crc-guides` bucket, same prefix as the local layout. The
existing `manifest.json` already captures `supabase_upload.bucket` and
`supabase_upload.relative_path`, so adding two artifacts to the upload
manifest is a one-line change in both generate skills:

```
crc-guides/
  {projectUuid}/{submissionUuid}/{u0VersionNumber}/{crcGenerationNumber}/
    crc-*.md                          (existing)
    mcr.pdf                           (existing)
    figures/...                       (existing)
    source-pdfs/...                   (existing)
    manifest.json                     (existing — updated to list new artifacts)
    source-map.json                   (NEW phase 1)
    source-text-crops/*.png           (NEW phase 2)
```

Versioning is implicit: each `(projectUuid, submissionUuid,
u0VersionNumber, crcGenerationNumber)` tuple writes to its own prefix and
is never overwritten. The cityhall lookup chain pins to the exact tuple
via `reviews.metadata.crcGuides`.

### 6.4 What gets re-uploaded on a regeneration

A new `crcGenerationNumber` (e.g. `3` after `2`) writes to a **new prefix**
and pulls a new review row when the workflow runs. The old prefix —
including the old `source-map.json` — stays put forever. In-flight reviews
referencing generation `2` keep working; the cityhall UI never sees
generation `3`'s source-map for a generation-2 review.

---

## 7. Substation API

One new endpoint:

### 7.1 `GET /api/crc/source-map?reviewId={uuid}`

**Auth:** existing cityhall→Substation auth path (no change).

**Resolution:**

1. `SELECT metadata FROM reviews WHERE id = $reviewId AND review_type = 'crc'`.
2. Extract `metadata.crcGuides.bucket` and `metadata.crcGuides.prefix`. If
   either is missing → 200 with empty body (`{ items: [], parent_comments:
   [], stats: { available: false } }`). This is the "old review predates
   this feature" case and the UI must degrade gracefully (§8.2).
3. Fetch `{bucket}/{prefix}source-map.json` from Supabase storage. On 404 →
   same empty-body response. On any other storage error → 502.
4. Parse JSON. On schema-version mismatch beyond what this Substation
   build understands → 200 empty-body (forward-compat: a future-version
   client will eventually serve it).
5. Return the parsed JSON verbatim.

**Caching:**

- Substation in-memory LRU keyed by `(bucket, prefix)`, TTL 1 hour, max
  256 entries. Source-maps are immutable per prefix, so TTL is purely a
  memory bound.
- Browser-side: cityhall already manages a per-review SWR cache; treat
  source-map fetches the same way (keyed by `reviewId`).
- HTTP cache headers: `Cache-Control: private, max-age=3600,
  stale-while-revalidate=86400`.

**Response shape:** the file contents from §4, plus an envelope:

```jsonc
{
  "available": true,        // false → empty placeholder, UI shows "source unknown" for all rows
  "data": { /* §4 JSON */ }
}
```

### 7.2 `GET /api/crc/source-map/crop?reviewId={uuid}&parentCommentId={id}` (phase 2)

Returns a 302 redirect to a 15-minute signed Supabase URL for
`{prefix}source-text-crops/{parentCommentId}.png`. Reasons for a redirect
(not a proxy):

- Signed URL fetch is direct browser→Supabase; Substation doesn't proxy
  image bytes.
- Browser caches the redirect target naturally.

On missing file → 404. The UI treats 404 as "no crop available" and falls
back to the text-only affordance.

Multi-rect parents (rare): `?rectIndex=N` selects which crop. Default 0.

### 7.3 Why not embed signed URLs in §7.1?

Considered. Two reasons we don't:

- Signed-URL TTLs (15 min) would force the cityhall client to re-fetch
  source-map.json on every navigation, defeating the immutable-cache
  optimization.
- Phase-1 UI doesn't render images. Adding signed URLs in phase 1 is dead
  weight. Phase 2 adds the dedicated crop endpoint instead.

---

## 8. Edge cases & failure modes

### 8.1 Scanned MCR PDFs (no text layer)

If `pdftotext -layout mcr.pdf` returns empty / garbled output, the existing
generate-crc-guides skill already fails earlier (the entire comment-parse
phase depends on the text layer). Out of scope for this spec — if the
parent skill ran to completion, the text layer is good enough to anchor.
Worst case: parent verbatim text is OCR'd noise; deterministic substring
match for atomic spans will fall straight through to vision recovery. That
loop tolerates it; the resulting source-map items just trend toward
`confidence: "medium"`.

### 8.2 Hand-edited guides

A user can hand-edit `crc-sp-3.md` after the skill writes it — to fix a
miscategorized item, add a missing one, etc. The `source-map.json` becomes
stale: an added item has no entry, an edited item's `verbatim_text` no
longer matches the file invariant.

Two policy bits:

- The Substation API does not validate consistency between
  `source-map.json` and the markdown guide. If a checklist item shows up in
  the workflow output (via the workflow consuming the edited markdown) but
  has no source-map row, the cityhall UI renders "source unknown" for that
  row. No error, no warning.
- We do **not** ship editor tooling to keep source-map in sync. Per Q8,
  hand editing is rare enough not to justify it.

### 8.3 Old reviews without source-maps

Any review whose generation pre-dates this feature has no
`source-map.json` at its prefix. The Substation API returns `available:
false`. The UI degrades silently — same as the inline-source toggle just
not appearing.

### 8.4 PDF coordinate space (implementation hazard)

PDF user-space puts origin at bottom-left, Y increasing up. PIL / pymupdf
pixmap output puts origin at top-left, Y increasing down. Every cropping
pipeline gets this wrong once. The schema commits to `coord_space:
"pdf_user"` everywhere. Converters live in one helper:

```python
def pdf_user_to_pixmap_rect(bbox, page_height_pt):
    return pymupdf.Rect(
        bbox["x0"],
        page_height_pt - bbox["y1"],
        bbox["x1"],
        page_height_pt - bbox["y0"],
    )
```

Unit-test this with one known parent crop visually verified by a human
before committing the crop-generation code. The phase-3 PDF.js viewer
needs the inverse for highlight overlays.

### 8.5 Multi-page parent comments

A parent comment that wraps across two MCR pages produces two bbox rects,
each with its own `page`. Crop generation writes two PNGs. The text
highlight (`char_offset_in_parent`) still works — it's character-based, not
page-based. The phase-2 UI either stitches the two crops vertically or
shows them as a pair.

### 8.6 Source-map write race vs upload race

Both generate skills follow a fixed sequence:

1. Write all `crc-{dept}.md` files locally.
2. Write `source-map.json` locally (after invariant validation).
3. Upload everything to Supabase storage in one batch.
4. Update `manifest.json` with the upload manifest.

If step 2 fails (invariant violation), `source-map.json` is NOT written;
step 3 uploads guides without source-map; the API returns `available:
false` for any review against that generation. This is the same as 8.3
and degrades silently.

### 8.7 Generation-time atomization regressions (Q2 guard)

A future prompt change could break the "atomic items ≤ parents" rule and
produce a checklist item that legitimately maps to ≥2 parent comments. The
invariant §4.4.5 rejects this at emit time. The skill writes a warning to
`manifest.json` under `source_map_emit_warnings: [{checklist_id, reason}]`,
omits the violating row from `items[]`, and continues. The UI shows
"source unknown" for that row, which is the desired conservative fallback.

---

## 9. Cityhall UI — phased

### 9.1 Phase 1 — inline collapsible "Source MCR text" (MVP)

Where: the existing CRC review page (`+page.svelte` per cityhall-ui spec
§5), inside the flat-list item row pattern (cityhall-ui clarification C1).

Affordance per row:

- A new "Source" chevron / disclosure triangle next to the existing
  `Parent: SP33` label.
- Click expands an inline panel showing:
  - The full parent comment text (`parent_comments[i].verbatim_text`),
    rendered with the source span wrapped in `<mark>` using
    `source_span.char_offset_in_parent`.
  - A subtle byline: `Source: MCR comment SP33` (or `redline AW-RL-3 ·
    page 5` for redline source type).
- Click again collapses.

For items with `confidence: "low"` or
`source_span.verbatim_text === null`: render disabled disclosure with a
"Source unknown" label and a tooltip explaining (e.g. "Could not locate
this item's source comment in the MCR PDF").

For `available: false` reviews (old generations): no disclosure at all —
the row looks exactly like it does today.

Fetch wiring:

- `+page.ts` parallel-fetches `/api/crc/source-map?reviewId=…` alongside
  the existing review + comments fetches.
- `available === false` → store `null` and skip rendering the disclosure.
- `available === true` → index by `checklist_id` into a map and pass to
  the row renderer.

Smoke test:

- Open the Lamar + Collier U0 MCR Resolution tab.
- Expand `SP-33.1`: should show the SP33 comment with "Coordinate the Site
  Data Table…" highlighted.
- Expand `SP-33.2`: same parent text, "Show the type of open space…"
  highlighted.
- Expand `SP-36.1` through `SP-36.4`: all four show the SP36 parent text
  with different sub-spans highlighted.

### 9.2 Phase 2 — sidebar with crop image + highlight overlay

When the source-text-crops are available, swap the inline panel for a
right-rail sidebar that updates as you select rows:

```
┌──────────────────────────────┬───────────────────────────┐
│ row list (existing)          │ ┌─ Source ──────────────┐ │
│   SP-33.1  [resolved] ●      │ │ [crop image of SP33] │ │
│   SP-33.2  [failed]   ●      │ │ with yellow rect      │ │
│   SP-36.1  [failed]   ●      │ │ overlay on the span   │ │
│   ...                        │ │                       │ │
│                              │ │ Coordinate the Site...│ │
│                              │ │ <mark>highlighted</mark>│ │
│                              │ │                       │ │
│                              │ │ Source: MCR SP33      │ │
│                              │ │ [Open in MCR ↗]       │ │
│                              │ └───────────────────────┘ │
└──────────────────────────────┴───────────────────────────┘
```

Image rendering:

- `<img src="/api/crc/source-map/crop?reviewId=…&parentCommentId=SP33">`
  loads the parent crop (302 redirect to signed URL, cached by the
  browser).
- A `<canvas>` overlay or absolutely-positioned `<div>` draws the
  highlight rect, computed by:
  1. Take `source_span.bbox[0]` (pdf_user coords).
  2. Subtract the parent's bbox origin → relative coords inside the
     parent's bbox.
  3. Multiply by `crop_image_px_width / parent_bbox_width_pt` to get
     pixel coords inside the crop image.
  4. Draw a yellow translucent rect (`rgba(255, 215, 0, 0.35)`).

Multi-rect spans draw multiple highlight rects.

This phase requires phase 1's source-map fetch to already be wired up.

### 9.3 Phase 3 — PDF.js viewer with autoscroll + bbox overlay

Sketch only (no implementation in this spec):

- A new "View in MCR" affordance that opens a modal or new route hosting
  PDF.js (loaded from CDN or vendored) with the source PDF URL set to a
  signed URL for `{prefix}mcr.pdf` (or the redline PDF for redline source
  types).
- Initial state: page `parent.bbox[0].page`, scrolled so the bbox rect is
  centered. Two overlays drawn:
  - Parent bbox in a light outline.
  - Sub-span bbox in a strong yellow fill.
- Pan/zoom freely from there. The viewer is a generic provenance tool —
  same machinery would later serve diligence-report citations, training
  guide research, etc.

Open design questions deferred to a follow-up spec:

- Hosting PDF.js: client-side bundle vs. iframe vs. dedicated route.
- Performance: large MCR PDFs are ~3.5 MB (Lamar + Collier U0 is exactly
  this size). Lazy-load on first "View in MCR" click.
- Text-layer alignment: if PDF.js's own text layer disagrees with the
  bboxes we captured at generation time (font substitutions, etc.), the
  highlight may visually drift. Acceptance threshold TBD.
- Mobile / narrow viewport behavior.

---

## 10. Telemetry & quality monitoring

Aggregate per-generation stats are emitted in `source-map.json` itself
(§4.1, `stats`) and mirrored into `manifest.json` for the existing CRC
stats pipeline. Worth tracking after rollout:

- `items_with_source_unknown / total_items` per generation. Sustained
  values >5% indicate an extraction-loop regression.
- `items_with_vision_recovery / total_items`. Expected baseline ~5–10%;
  spikes suggest the LLM is paraphrasing more.
- p50/p95 step-4 vision-recovery wall-clock time. Budget hazard if it
  grows. Capped at 2 attempts × N items = bounded but not free.

These are emitted but not yet visualized — a future inspector-general
panel could surface them across generations.

---

## 11. Rollout plan

### Phase 1 — text-only MVP (this spec, ~2 weeks of work end-to-end)

1. **Generate skills** — Both `generate-crc-guides` and
   `generate-crc-guides-from-redlines` learn to emit `source-map.json`,
   with the extraction loop and invariants.
2. **Upload** — Both skills add `source-map.json` to their Supabase
   upload manifest.
3. **Substation** — `/api/crc/source-map?reviewId=…` endpoint, with
   in-memory cache.
4. **Cityhall** — Inline disclosure under each atomic row, text-only with
   `<mark>` highlight.
5. **Smoke test** — Regenerate Lamar + Collier U0 CRC, verify §9.1 smoke
   checklist.

Gate to phase 2: phase-1 is in production for ≥2 weeks with no source-map
regressions, `items_with_source_unknown / total` < 5% across the smoke
fleet.

### Phase 2 — parent crops + sidebar UI

6. **Generate skills** — Phase 5.4 crop-generation step. PDF coord-frame
   helper, unit-tested.
7. **Substation** — `/api/crc/source-map/crop` endpoint with signed-URL
   redirect.
8. **Cityhall** — Right-rail sidebar replacing the inline panel. Image
   load + canvas highlight overlay.
9. **Smoke test** — Sidebar shows crop with highlight for the same
   Lamar + Collier U0 cases.

### Phase 3 — PDF.js viewer (separate DESIGN-SPEC required)

10. Spec the viewer surface (modal vs. route, hosting strategy,
    text-layer reconciliation policy).
11. Build.

---

## 12. Open questions / risks

### 12.1 Sub-span bbox precision on multi-line spans

When a sub-span wraps across 3+ lines, the per-line rects emitted by
`pdfplumber.extract_words()` are exact for the line content but the
*first* and *last* line rects don't necessarily start/end at the span
boundaries (mid-line splits). Acceptance: rect bounds clip to the line
extent, the text-highlight (`char_offset_in_parent`) remains the source of
truth, and the bbox overlay is "close enough". If users report drift in
phase 2 the helper grows a mid-line-cut refinement.

### 12.2 LLM paraphrasing despite the instruction

The Phase-7 (existing) LLM is asked to emit `source_span_verbatim` as a
strict substring. It will sometimes paraphrase anyway — that's why the
fuzzy-match fallback and vision-recovery exist. The risk: if paraphrasing
gets bad enough that fuzzy match thresholds need to relax, span boundaries
become unreliable. Mitigation: monitor `items_with_vision_recovery /
total` per §10; if it climbs above ~15%, revisit the Phase-7 prompt rather
than tuning fuzzy thresholds.

### 12.3 Re-running the workflow against the same generation

The CRC Conductor workflow's review row points at a specific generation.
If the same review is re-run (without bumping `crcGenerationNumber`), the
source-map is already there and stable — no regeneration. If the user
forces a regenerate by re-running `generate-crc-guides`, that's a new
generation number, new prefix, new review row — handled by the standard
lookup chain.

### 12.4 Concurrency at generation time

The MCR-path skill already parallelizes per-department checklist
generation. Adding the extraction loop inside that fan-out is the natural
place. Vision-recovery is rate-limited by whatever conductor enforces;
worst case the loop bottlenecks on a few items but doesn't stall the
whole skill.

### 12.5 Bucket-prefix immutability assumption

The Substation cache (§7.1) assumes `{bucket}/{prefix}source-map.json` is
content-stable once written. If we ever introduce in-place edits to the
source-map (e.g. a HITL "edit verbatim text" tool), the cache turns into
a correctness bug. Resolution path if that day comes: switch to an
ETag-based or content-hash-based cache key. Not in MVP.

### 12.6 Sub-span vs whole-paragraph atomization

A handful of MCR comments use bulleted sub-lists where the atomic items
correspond 1:1 to bullets. The substring-match step handles this
naturally — bullets are character substrings of the parent. No special
handling needed unless a future grouping crosses bullet boundaries (e.g.
"all bullets where xyz") — at which point invariant §4.4.5 trips and the
item degrades to source-unknown. Acceptable.

---

## 13. Appendix — fully worked example (SP33)

The SP33 MCR comment in the Lamar + Collier U0 MCR PDF reads exactly:

> SP33 - Current Status: Pending
> U0: Coordinate the Site Data Table and Landscape Plan to show a
> consistent amount of open space to meet Subchapter E Requirements. Show
> the type of open space proposed and provide dimensions and amenities
> required for that open space type. (Example: A landscape area other
> than one required by Subchapter C, Article 9 (Landscaping), provided
> such landscaped area has a minimum depth and width of 20 feet and a
> minimum total area of 650 square feet. The area shall include
> pedestrian amenities.)

It produced two atomic checklist items, `SP-33.1` and `SP-33.2`. The
resulting `source-map.json` rows:

```jsonc
{
  "parent_comments": [
    {
      "id": "SP33",
      "department_code": "SP",
      "source_type": "mcr_text",
      "source_pdf": "mcr.pdf",
      "verbatim_text": "SP33 - Current Status: Pending\nU0: Coordinate the Site Data Table and Landscape Plan to show a consistent amount of open space to meet Subchapter E Requirements. Show the type of open space proposed and provide dimensions and amenities required for that open space type. (Example: A landscape area other than one required by Subchapter C, Article 9 (Landscaping), provided such landscaped area has a minimum depth and width of 20 feet and a minimum total area of 650 square feet. The area shall include pedestrian amenities.)",
      "bbox": [
        { "page": 12, "x0": 72.0, "y0": 480.5, "x1": 540.0, "y1": 612.3, "coord_space": "pdf_user" }
      ],
      "crop_image": "source-text-crops/SP33.png",
      "extraction": {
        "method": "deterministic",
        "verbatim_match": "exact",
        "validation_passes": 1,
        "confidence": "high"
      }
    }
  ],
  "items": [
    {
      "checklist_id": "SP-33.1",
      "department_code": "SP",
      "parent_comment_id": "SP33",
      "source_span": {
        "verbatim_text": "Coordinate the Site Data Table and Landscape Plan to show a consistent amount of open space to meet Subchapter E Requirements.",
        "char_offset_in_parent": [40, 173],
        "bbox": [
          { "page": 12, "x0": 96.0, "y0": 552.0, "x1": 540.0, "y1": 580.0, "coord_space": "pdf_user" }
        ]
      },
      "extraction": {
        "method": "deterministic_substring",
        "verbatim_match": "exact",
        "confidence": "high"
      }
    },
    {
      "checklist_id": "SP-33.2",
      "department_code": "SP",
      "parent_comment_id": "SP33",
      "source_span": {
        "verbatim_text": "Show the type of open space proposed and provide dimensions and amenities required for that open space type. (Example: A landscape area other than one required by Subchapter C, Article 9 (Landscaping), provided such landscaped area has a minimum depth and width of 20 feet and a minimum total area of 650 square feet. The area shall include pedestrian amenities.)",
        "char_offset_in_parent": [174, 533],
        "bbox": [
          { "page": 12, "x0": 96.0, "y0": 492.0, "x1": 540.0, "y1": 551.0, "coord_space": "pdf_user" }
        ]
      },
      "extraction": {
        "method": "deterministic_substring",
        "verbatim_match": "exact",
        "confidence": "high"
      }
    }
  ]
}
```

`char_offset_in_parent` ranges are illustrative; actual values are
computed by substring search at emit time and validated by invariant
§4.4.5.
