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
| Q2  | One checklist item → one source span (1:1, may be N:1 to parents). Decomposition (`generate-crc-guides` Phase 6) is the upstream constraint; the source-map schema enforces 1:1 by construction (`items[i].source_span` is a single object, not an array) and so does not need a runtime guard. |
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
| Q13 | Local + bucket path: `{root}/{projectUuid}/{submissionUuid}/{submission_version.version_number}/{crcGenerationNumber}/source-map.json`. Crops in a `source-text-crops/` sibling dir. |
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
    { "page": 12, "x0": 72.0, "y0": 132.7, "x1": 540.0, "y1": 264.5, "coord_space": "pdf_topleft" }
  ],
  "crop_image": ["source-text-crops/SP33.png"],  // always an array; optional in phase 1, written in phase 2 for MCR-sourced parents
  "extraction": {
    "method": "deterministic",        // 'deterministic' | 'vision_recovery' | 'navalbase_passthrough' | 'failed'
    "verbatim_match": "exact",        // 'exact' | 'fuzzy' | 'vision' | 'failed'
    "validation_passes": 1,
    "confidence": "high"              // 'high' | 'medium' | 'low'
  }
}
```

**Field notes:**

- `bbox.coord_space` is **always** `pdf_topleft` — origin top-left, Y
  increasing downward, units in PDF points (1/72 inch). This matches the
  convention `pdfplumber` and `PyMuPDF` use natively in their Python APIs
  (pdfplumber's `extract_words()` returns `top`/`bottom`; PyMuPDF's
  `page.rect` and `Rect` are top-left). PDF's underlying user space is
  bottom-left, but neither library exposes that to callers — and the
  pixmap output of `page.get_pixmap()` is top-left as well. Storing in
  the library-native frame means crop generation and (eventually) the
  phase-3 PDF.js viewer don't need a y-flip. See §8.4 for the helper +
  unit test recipe.
- `bbox` is an **array** even when there's only one rect, so a comment that
  wraps across columns or pages can be represented without a schema change
  later.
- `crop_image` is **always an array of strings** (relative paths to the
  parent crop PNGs from the generation root), even when there's only a
  single crop. Single-rect parents emit a 1-element array. Multi-rect /
  multi-page parents emit one entry per rect, ordered to match `bbox[]`.
  Phase-1 writes for `source_type: 'mcr_text'` may emit an **empty array**
  (the crop-generation step at §5.4 has not run yet); phase-2 writes
  always populate it. For `source_type: 'pdf_redlines'`, the field is
  **required and non-empty from phase 1** — the upstream redline skill
  already crops every emitted row (null-bbox rows are filtered upstream,
  per `generate-crc-guides-from-redlines` DESIGN-SPEC §1 out-of-scope),
  so the source-map points directly at the existing
  `figures/{row_id}/1.png` rather than re-cropping into
  `source-text-crops/`. See §6.2 for path conventions.

  When present (and regardless of source type), the UI may render the
  crop with a sub-span highlight overlay computed from the atomic item's
  bbox (§5.3, phase 2 for MCR; phase 1 for redlines).

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
    "char_offset_in_parent": [25, 158],   // [start, end_exclusive] in parent_comment.verbatim_text; null when verbatim_text is null
    "bbox": [
      { "page": 12, "x0": 96.0, "y0": 212.0, "x1": 540.0, "y1": 240.0, "coord_space": "pdf_topleft" }
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
  `source_span.verbatim_text: null`, `source_span.char_offset_in_parent:
  null`, `source_span.bbox: []`, and `extraction.method: "failed"`. The
  `verbatim_text` and `char_offset_in_parent` fields are **co-null**: if
  either is null, both must be null. Surfaces as "source unknown" in the
  UI.

### 4.4 Invariants enforced at emit time

The generate skills MUST validate before writing the file:

1. Every `items[i].parent_comment_id` resolves to a row in
   `parent_comments[]`. No orphans.
2. Every `parent_comments[i].id` is unique within the file.
3. Every `items[i].checklist_id` is unique within the file.
4. When `source_span.verbatim_text` is non-null,
   `items[i].source_span.char_offset_in_parent[0] < ...[1] <=
   len(parent.verbatim_text)`. Off-by-one bugs caught at emit time. When
   `verbatim_text` is null, `char_offset_in_parent` MUST also be null
   (the co-null rule from §4.3).
5. `source_span.verbatim_text` (when non-null) equals
   `parent.verbatim_text[start:end]` exactly. (This is the contract that
   makes char-offsets meaningful.)
6. When `parent_comments[i].crop_image` is non-empty, its length matches
   `parent_comments[i].bbox` length — one crop per rect, same order.

A violation halts emit and is logged in `manifest.json` under
`source_map_emit_errors`. The guides still write; the source-map does not.
The UI then degrades gracefully (every row shows "source unknown").

---

## 5. Generation-side pipeline changes

### 5.1 Where this hooks in

**`generate-crc-guides` (MCR path):** this feature lands in **two** places
in the existing skill:

- **Phase 6 (Decomposition) — augmented.** The existing
  `decompose-comment.md` and `decompose-code-section.md` LLM prompts each
  gain a new required structured-output field, `source_span_verbatim`
  (the exact substring of the parent comment that the emitted atomic
  item is in reference to). See §11 for the coordinated-rollout
  implications — this is a breaking change to the Phase-6 structured
  output and prior-generation regenerations will fail until both prompts
  and the source-map extraction loop ship together.
- **New Phase 7.5 (Source-map emit) — between HITL (Phase 7) and the
  file-write phase (Phase 8).** At Phase 7.5 entry the skill already has:
  - The raw MCR text dump (`scratch/mcr.txt` from `pdftotext -layout`).
  - The parsed raw comments (`{raw_id, dept_prefix, comment_number,
    status, body, code_reference, source_page}` array — `generate-crc-guides`
    DESIGN-SPEC §3.1).
  - The post-HITL atomized checklist rows that will be written to
    `crc-{dept}.md`, each tagged with its `parent_comment_id` (the
    existing "Parent Comment" column) and the Phase-6-emitted
    `source_span_verbatim` for that item.

  Phase 7.5 runs the extraction loop (§5.2), validates invariants
  (§4.4), and writes `source-map.json`. Phase 8 then writes the
  per-dept guide files.

**`generate-crc-guides-from-redlines` (redline path):** new **Phase 6.5**
between the existing HITL-batch phase (Phase 6) and the guide-emit phase
(Phase 7). At Phase 6.5 entry the skill already has:

- The navalbase `detailed-analysis-results.json` parsed, with each
  surviving candidate carrying `bounding_box`, `transcribed_text`,
  `referenced_element`, and `full_comment_inference`.
- The per-item Phase-3 vision output (caption, refined `requirement`,
  `figure_type`).
- Matched Phase-4 layer-2 enrichment (when `enriched-analysis-results.json`
  was present).
- The Phase-5 sheet-class label and Phase-5b margin-regex citations.
- Per-item crop already rendered to `<gen-dir>/figures/{row_id}/1.png`
  (Phase 2 of the redlines spec) — the source-map's `crop_image` points
  at this existing file rather than re-cropping.

Phase 6.5 then either **creates** `source-map.json` (if the MCR-path
skill did not run for this generation) or **merges into** the existing
file (the common case — see §6.4 for the merge protocol).

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

For each atomic item under this parent: the augmented Phase-6 decomposition
LLM emit (see §5.1) includes a new required field, `source_span_verbatim`,
in its structured output. Substring-match that against
`parent.verbatim_text`. On hit:

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
- `parent_comments[i].bbox` = navalbase `bounding_box` directly. (The
  `coord_space` is `pdf_topleft` to match the §4.2 convention — verify
  once against a known crop that navalbase's bbox frame agrees; it does
  in practice because navalbase uses PyMuPDF under the hood.)
- `parent_comments[i].crop_image` = `["figures/{row_id}/1.png"]` — the
  existing per-item crop already rendered by the redlines skill's
  Phase 2. **Required and non-empty from phase 1 for redline rows** —
  the crop is a free passthrough, not new work this spec introduces
  (cf. Q4 and §4.2). MCR-sourced rows get their crops in phase 2 only
  (§5.4).
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
    crop_paths = []
    for i, rect_spec in enumerate(parent.bbox):
        page = doc[rect_spec["page"] - 1]
        # bbox is already in pdf_topleft — pymupdf's native frame — so
        # no y-flip is needed. See §8.4.
        rect = pymupdf.Rect(rect_spec["x0"], rect_spec["y0"],
                            rect_spec["x1"], rect_spec["y1"])
        pix = page.get_pixmap(clip=rect, dpi=600)
        suffix = "" if len(parent.bbox) == 1 else f"--{i}"
        out_path = f"source-text-crops/{parent.id}{suffix}.png"
        pix.save(f"{gen_dir}/{out_path}")
        crop_paths.append(out_path)
    parent.crop_image = crop_paths
```

600 DPI matches the redline path's crop resolution (per
`generate-crc-guides-from-redlines` DESIGN-SPEC §2 "Phase 2 — Render
per-item crops"), so MCR-sourced and redline-sourced crops display at
visually consistent fidelity side-by-side in the phase-2 sidebar UI. At
600 DPI a typical MCR comment crop runs ~100–300 KB; downscale crops
whose longest edge exceeds 4000 px to keep payloads bounded (same
recipe as the redlines skill).

Multi-rect bboxes (multi-page comments) emit multiple PNGs in
`crop_image[]`, ordered to match `bbox[]`. Single-rect parents emit a
1-element array (§4.2 field-notes contract).

This step is cheap once bboxes are correct. The hazard is purely the
coord-frame discipline (§8.4) — but because we store bboxes in
`pdf_topleft` (PyMuPDF's native frame), no flip is needed here.

---

## 6. Storage & file layout

### 6.1 Local generation root (unchanged, plus two new artifacts)

```
{NOETIC_WORKING_DIR}/comment-resolution-check/
  {projectUuid}/
    {submissionUuid}/
      {submission_version.version_number}/
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
          source-text-crops/             # NEW (phase 2 — mcr_text parents only)
            SP33.png
            SP36.png
            ...
          # redline parent crops are NOT re-cropped into source-text-crops/;
          # the source-map points at the existing figures/{parent_id}/…png
          # written by the redlines skill (available from phase 1).
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
  {projectUuid}/{submissionUuid}/{submission_version.version_number}/{crcGenerationNumber}/
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

### 6.4 Source-map merge protocol (MCR + redlines in one generation)

Both `generate-crc-guides` and `generate-crc-guides-from-redlines` write
into the same `{generation-number}/` directory. Per Q12, **exactly one
`source-map.json` exists per generation** — when both skills run, the
file holds the union of MCR-sourced and redline-sourced parent comments
and items.

**Run-order invariant.** `generate-crc-guides` (MCR path) **always runs
first**; `generate-crc-guides-from-redlines` is a downstream supplement.
The redlines skill never executes against an empty generation
directory — it depends on the MCR-path's `manifest.json` and crc-guides
to be in place per its own DESIGN-SPEC. The merge logic relies on this
ordering.

**Protocol:**

1. **MCR path emit (Phase 7.5).** Writes `source-map.json` from scratch.
   `parent_comments[]` holds only `source_type: 'mcr_text'` entries;
   `items[]` holds only MCR-sourced items. `source_pdfs` map contains
   the MCR PDF entry. `stats` totals reflect MCR items only. This file
   is uploaded by Phase 10 of the MCR skill alongside the rest of the
   gen directory.

2. **Redline path emit (Phase 6.5).** Before writing, the skill checks
   for an existing `source-map.json` in the same gen directory:

   - **Present (the common case).** Read, parse, and **append**:
     - For each redline candidate, push a new entry into
       `parent_comments[]` (`source_type: 'pdf_redlines'`) and a new
       entry into `items[]`. Row IDs (`AW-RL-N`) are unique against MCR
       checklist IDs by construction (different prefix conventions —
       MCR uses `{DEPT}-{commentNumber}[.{subIndex}]`, redlines use
       `{DEPT_CODE_UPPER}-RL-{N}`).
     - Add the redline source PDF to the `source_pdfs` map under its
       `source-pdfs/{filename}.pdf` key.
     - Recompute `stats` over the combined arrays.
     - Update `generated_at` to the redline-path run's timestamp.
     - Leave `schema_version` and `generation.*` unchanged (the
       generation tuple is invariant across the two skills running in
       the same gen).

   - **Absent.** Write the file from scratch with only redline content
     (the MCR skill hasn't been run for this gen yet — unusual but not
     erroneous; the merge protocol degrades to "create" cleanly).

3. **Invariants on merge.** All invariants from §4.4 must hold after the
   merge:
   - No `parent_comments[i].id` collisions between MCR and redline
     entries. (MCR IDs look like `SP33` / `TPW-12`; redline IDs look
     like `AW-RL-3` — disjoint by convention. If a future change
     introduces a collision, the merge fails loudly and writes a
     `source_map_emit_errors` entry to the redline skill's
     `manifest-redlines.json`.)
   - No `items[i].checklist_id` collisions for the same reason.
   - `parent_comments[i].parent_comment_id` references resolve within
     the merged file.

4. **Redline versioning interaction.** The redlines skill's `replace` /
   `bump version` / `merge` modes (per its DESIGN-SPEC §5) compose with
   this protocol as follows:
   - **`replace`** (overwrite a redline dept file in the current gen):
     remove the existing redline `parent_comments[]` and `items[]`
     entries for that dept from `source-map.json`, then append the
     fresh redline batch. The `source_pdfs` map entry for the prior
     source PDF stays put if any other dept still references it; else
     it's removed.
   - **`bump version`** (new gen dir): the new gen's
     `source-map.json` is **copied forward verbatim** from the prior
     gen's file alongside the MCR-sourced files the redline skill
     copies (per redlines DESIGN-SPEC §5.3). The redline-path Phase
     6.5 then runs against the copied file and appends the fresh
     redline batch.
   - **`merge`** (append rows to an existing redline dept file):
     append the new redline entries to `parent_comments[]` and
     `items[]` with row IDs continuing from the last used (e.g. `AW-RL-9`
     onward). Add the new source PDF to `source_pdfs` if not already
     present.

5. **Write atomicity.** The redline-path skill writes
   `source-map.json` via temp-file + rename so a partial merge cannot
   leave the file in an inconsistent state if the skill is killed
   mid-write.

This protocol is the redline skill's responsibility — `generate-crc-guides`
never reads a pre-existing `source-map.json` because it always runs
first by contract. If that contract is ever relaxed (e.g. MCR-path
re-runs into an existing gen), this section will need an MCR-side
counterpart with symmetric logic.

### 6.5 What gets re-uploaded on a regeneration

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

The underlying PDF user space puts origin at bottom-left, Y increasing
up. But every Python library we touch — `pdfplumber.extract_words()`,
`PyMuPDF`'s `page.rect` / `Rect` / `page.get_pixmap(clip=…)`, PIL's
image coords — uses **top-left origin with Y increasing down**. The
schema commits to `coord_space: "pdf_topleft"` everywhere precisely so
the in-memory frame matches the library-native frame and no y-flip is
needed at crop time:

```python
def bbox_to_pymupdf_rect(bbox):
    # bbox is already in pdf_topleft (PyMuPDF's native frame).
    # No page_height_pt needed; no y-flip needed.
    return pymupdf.Rect(bbox["x0"], bbox["y0"], bbox["x1"], bbox["y1"])
```

PDF.js, in phase 3, also exposes a top-left frame to JavaScript consumers
(via its viewport transforms), so highlight overlays drop in without a
flip there either. If a future consumer wants true PDF user-space
(bottom-left), the conversion is `y_pdf_user = page_height_pt -
y_pdf_topleft` and the rect height inverts — but no in-tree consumer
needs that today.

**Unit test** the helper against one known parent crop visually verified
by a human before the crop-generation code goes to production. The
single failure mode worth testing is a bbox whose `y0` ≠ `y1` on a
page whose CropBox origin is non-zero (rare in MCRs, but possible if a
PDF has been re-imposed) — confirm the resulting PNG actually centers
on the comment text.

### 8.5 Multi-page parent comments

A parent comment that wraps across two MCR pages produces two bbox rects,
each with its own `page`. Crop generation writes two PNGs. The text
highlight (`char_offset_in_parent`) still works — it's character-based, not
page-based. The phase-2 UI either stitches the two crops vertically or
shows them as a pair.

### 8.6 Source-map write race vs upload race

Both generate skills follow a fixed sequence:

1. Write all `crc-{dept}.md` files locally.
2. Write `source-map.json` locally (after invariant validation). The MCR
   skill writes from scratch; the redline skill merges into an existing
   file per §6.4 (or writes from scratch if absent).
3. Upload everything to Supabase storage in one batch.
4. Update the skill's manifest file (`manifest.json` for MCR,
   `manifest-redlines.json` for redlines) with the upload manifest.

If step 2 fails (invariant violation), `source-map.json` is NOT written
or overwritten; step 3 uploads guides without source-map (or with the
pre-existing file untouched, in the redline-merge case); the API
returns `available: false` for any review against that generation
(or `available: true` against the partial pre-existing file for
redline-merge failures). This is the same degradation as 8.3 — the UI
shows "source unknown" for unmapped items and never hard-errors.

Both skills write `source-map.json` via temp-file + rename to keep the
merge protocol atomic against mid-write kills.

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
  1. Take `source_span.bbox[0]` (pdf_topleft coords — Y already
     increases downward, matching image-pixel orientation).
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

1. **Generate skills (coordinated rollout — ship as one PR per skill).**
   - `generate-crc-guides`:
     - **Phase 6 prompt change (breaking).** Add `source_span_verbatim`
       as a required field on the structured output of `decompose-comment.md`
       and `decompose-code-section.md`. This is a breaking change to the
       Phase-6 structured-output contract: an unaugmented Phase-6 emit
       will be missing a now-required field; an augmented Phase-6 emit
       against an unupdated extraction loop has no consumer for the new
       field. The prompt change and the new Phase 7.5 extraction loop
       must ship in the same PR. Any in-flight regenerations against
       prior generations should complete or be cancelled before merging
       (a half-written generation directory whose `crc-{dept}.md`
       reflects the new prompts but whose `source-map.json` is missing
       would still be benign — the UI just shows "source unknown" — but
       internal consistency is easier to reason about if the cutover is
       clean).
     - New Phase 7.5 source-map emit (extraction loop + invariants).
   - `generate-crc-guides-from-redlines`:
     - New Phase 6.5 source-map emit, with the merge protocol from §6.4
       reading any existing `source-map.json` from the MCR-path run.
   - Both skills add `source-map.json` to their Supabase upload manifest.
2. **Substation** — `/api/crc/source-map?reviewId=…` endpoint, with
   in-memory cache.
3. **Cityhall** — Inline disclosure under each atomic row, text-only with
   `<mark>` highlight.
4. **Smoke test** — Regenerate Lamar + Collier U0 CRC, verify §9.1 smoke
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

The Phase-6 (decomposition) LLM is asked to emit `source_span_verbatim`
as a strict substring. It will sometimes paraphrase anyway — that's why
the fuzzy-match fallback and vision-recovery exist. The risk: if
paraphrasing gets bad enough that fuzzy match thresholds need to relax,
span boundaries become unreliable. Mitigation: monitor
`items_with_vision_recovery / total` per §10; if it climbs above ~15%,
revisit the Phase-6 decomposition prompts rather than tuning fuzzy
thresholds.

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
        { "page": 12, "x0": 72.0, "y0": 180.5, "x1": 540.0, "y1": 312.3, "coord_space": "pdf_topleft" }
      ],
      "crop_image": ["source-text-crops/SP33.png"],
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
          { "page": 12, "x0": 96.0, "y0": 212.0, "x1": 540.0, "y1": 240.0, "coord_space": "pdf_topleft" }
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
          { "page": 12, "x0": 96.0, "y0": 241.0, "x1": 540.0, "y1": 300.0, "coord_space": "pdf_topleft" }
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
