# Populate MCR Page Numbers (source-map parent bboxes) — Design Spec

> **Status:** Draft, 2026-07-01. Feature spec for closing a gap surfaced during the Lamar + Collier Gen 6 rerun.
> Extends the parent [`generate-crc-guides` DESIGN-SPEC](../DESIGN-SPEC.md) — specifically Phase 10 (source-map emit).
> **All questions in this draft are OPEN.** The author invited the spec to ship with unresolved decisions surfaced inline so downstream reviewers can weigh in without a second round of clarifying questions.

---

## 1. Overview

**Purpose.** Populate `source-map.json`'s `parent_comments[].bbox` field with — at minimum — a page anchor derived from the parent's `source_page`, so the cityhall CRC UI can scroll to the correct MCR page when a reviewer clicks a checklist row. Optionally extend to real pdfplumber-derived rectangles and per-item source-span bboxes.

**Why it matters.** The cityhall CRC UI reads `source-map.json` to render provenance alongside each atomic finding. Today MCR-sourced parents ship with `bbox: []`, giving the UI nothing to hang a "show me this comment" affordance on. The redlines sibling skill has always populated `bbox` (via navalbase passthrough), so redlines rows look richer than MCR rows in the same UI. This feature closes that parity gap.

**Where the gap showed up.** Both Gen 5 and Gen 6 of the Lamar + Collier CRC set shipped empty (Gen 6) or all-zero-coord (Gen 5) parent bboxes. Gen 5's page anchor with zero coords was better than nothing but still not what the Phase 10.2 contract in [`generate-crc-guides/pipeline.md`](../../../claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/pipeline.md) calls for — the existing spec text describes a real pdfplumber walk but no implementation has honored it.

**Scope of this spec.** Phase 10 (source-map emit) of the `generate-crc-guides` skill. No changes to the redlines sibling — it already emits bboxes via navalbase. No changes to phases 1–9.

---

## 2. Ambition levels — three viable versions

The right level depends on how the cityhall UI actually consumes `parent_comments[].bbox` today. That's OPEN QUESTION #A. Regardless, this spec documents all three so the implementation can start narrow and grow.

### 2.1 Level A — Page anchor only (minimum viable)

**Behavior.** For every MCR-sourced parent, emit exactly one bbox entry with the page number populated from `raw-comments.json[raw_id].source_page`, and coords zeroed:

```jsonc
"bbox": [{ "page": 12, "x0": 0, "y0": 0, "x1": 0, "y1": 0, "coord_space": "pdf_topleft" }]
```

`extraction.method` becomes `"page_anchor_only"`. The port applied to Lamar + Collier Gen 6 already implements this shape.

**Cost.** Trivial. Deterministic pass over `raw-comments.json` + `items.json`. No new tool dependencies. Runs in <1s across a 200-parent MCR.

**Limitations.** UI can scroll to the right page but cannot draw a highlight rectangle. Reviewer still has to visually scan the page to find the comment.

### 2.2 Level B — Real pdfplumber rectangles

**Behavior.** For every MCR parent, open `mcr.pdf` with `pdfplumber`, locate the `source_page`, then walk `page.extract_words()` to anchor on the comment header (`{dept_prefix} {comment_number}:` or `{dept_prefix} {comment_number} –`). Walk forward from the header until the next comment header or end-of-page. Emit a bbox tight around the found word rects.

```jsonc
"bbox": [{ "page": 12, "x0": 54.2, "y0": 231.6, "x1": 560.8, "y1": 342.9, "coord_space": "pdf_topleft" }]
```

`extraction.method` becomes `"pdfplumber_walk"`. On header-anchor miss, fall back to Level A (page anchor only) with `extraction.method: "page_anchor_only"`.

**Cost.** ~1–3s per 100 parents (pdfplumber is fast on already-parsed PDFs). New Python dep — `pdfplumber` — added to Phase 0 preflight.

**Multi-page handling.** OPEN QUESTION #B — for a parent that visibly wraps across two pages, do we emit two bbox entries (one per page) or just the starting page? Draft position: **starting page only**, matching Gen 5 behavior. Multi-page bbox arrays are structurally supported by the schema but no consumer relies on them today.

### 2.3 Level C — Rectangles + parent crop images

**Behavior.** Level B, plus render a crop PNG of each parent's rect at 150 DPI and store it at `figures/{parent_id}/parent.png`. Populate `parent_comments[].crop_image` (currently `[]` for MCR parents) with the relative path.

```jsonc
"crop_image": ["figures/TPW-3/parent.png"]
```

This mirrors the redlines skill's `crop_image` shape and lets the cityhall UI show a visual snippet even without loading the full MCR PDF.

**Cost.** ~200 additional `pdftoppm` + `magick -crop` invocations per run. Adds ~30s and ~5–15 MB of PNGs to the generation directory. Phase 13 upload cost proportional.

---

## 3. Recommendation

Ship Level A on the first PR and reserve Level B/C for a follow-up when the cityhall UI actually renders rectangles. Rationale:

- Level A closes 90% of the UI utility for 5% of the effort.
- Level B has real dependency cost (`pdfplumber`) and its output goes unused until the UI ships a rectangle-highlight feature.
- Level C is nice-to-have but the MCR PDF itself is already uploaded to the bucket — the UI can crop client-side if it wants.

**OPEN QUESTION #C** — reviewer should confirm before implementation starts.

---

## 4. Implementation sketch (Level A)

### 4.1 Where it runs

**Draft position:** inside `Phase 10.2 — Parent comment verbatim + bbox` as a first-class step, replacing the current placeholder that leaves bbox empty. No new phase number needed.

**OPEN QUESTION #D** — should this instead live as a separate `Phase 10.1.5` so the anchor pass is independently logged and verifiable via `phase-10.json` counters? Argues for: cleaner metrics, easier to disable. Argues against: over-fragmentation of an already-cheap phase.

### 4.2 Algorithm

```python
raw_by_id = {c['raw_id']: c for c in raw_comments}
for parent in source_map['parent_comments']:
    if parent['source_type'] != 'mcr_text':
        continue                                          # redlines already have real bboxes
    rc = raw_by_id.get(parent['id'])
    if not rc or 'source_page' not in rc:
        parent['bbox'] = []
        parent['extraction']['method'] = 'failed_bbox'
        continue
    parent['bbox'] = [{
        'page': rc['source_page'],
        'x0': 0, 'y0': 0, 'x1': 0, 'y1': 0,
        'coord_space': 'pdf_topleft',
    }]
    parent['extraction']['method'] = 'page_anchor_only'
```

**Failure mode.** If `raw_id` doesn't resolve (e.g. HITL-flipped items whose source_page might be absent, or items normalized post-Phase-1), fall back to `bbox: []` + `extraction.method: 'failed_bbox'`. Log the miss in `phase-10.json.warnings`.

**OPEN QUESTION #E** — should the fallback path ever be tolerated silently? Draft position: soft warning only. Every kept parent should have a `source_page` — a missing anchor is almost certainly a bug in Phase 1 rather than a legitimate case.

### 4.3 Item-level source-span bboxes

`items[].source_span.bbox` is empty for every MCR item today. Two options:

- **A:** Leave items untouched. Only parents get page anchors. UI reads `parent_comment_id` and pulls the page from the parent.
- **B:** Mirror the parent's page anchor into every child item's `source_span.bbox`. Redundant on the wire but simpler UI code (no join by parent_comment_id).

**OPEN QUESTION #F** — pick one. Draft position: **A**, since char_offset_in_parent already lets the UI compute per-item highlight regions client-side once it has parent geometry.

### 4.4 extraction.method vocabulary

Adds `"page_anchor_only"` to the closed set of methods in `source-map.schema.json`. Current values (informal):

- `deterministic` — Phase 10.2 verbatim + bbox both resolved
- `deterministic_substring` — Phase 10.3 exact char-offset match
- `fuzzy_sentence` — Phase 10.4 sentence-level fuzzy fallback
- `vision_recovery` — Phase 10.5 crop-and-ask fallback
- `failed` / `failed_bbox` — nothing worked
- `navalbase_passthrough` — redlines skill (out of scope for this feature)

**OPEN QUESTION #G** — should we tighten the schema to enforce this enum? Currently the field is `type: string` and any value passes validation.

### 4.5 Phase 10 counters

Add to `phase-10.json.outputs.counts`:

```jsonc
{
  "parent_bbox_anchor_success": <int>,
  "parent_bbox_anchor_failure": <int>,
  "parent_bbox_page_only": <int>,          // Level A count
  "parent_bbox_full_rect": <int>           // Level B count (0 in Level A shipment)
}
```

The first two are already documented in [`phase-contracts.md`](../../../claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/references/phase-contracts.md#phase-10--source-map-emit) but no verification currently reads them.

---

## 5. Phase 12 validation gate

### 5.1 Hard floor

Add to the Option-C cross-gen sanity diff in [`pipeline.md` §Phase 12](../../../claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/pipeline.md):

> Hard floor: `current.parent_bbox_anchor_success == 0` while `baseline.parent_bbox_anchor_success > 0` → fail with `VALIDATION-FAILED.md`.

This prevents silent regressions once the feature ships. Level A commits every kept parent to having a page anchor, so a zero-count in a future run is almost certainly a bug.

**OPEN QUESTION #H** — reviewer confirm this floor is desirable. Argues for: catches regressions loudly. Argues against: rejects legitimate runs where a new parser bug drops `source_page` for a subset (which we'd prefer to see as `completed_degraded`).

### 5.2 Soft floor

Draft position: **≤5% anchor miss rate** for `completed`, **≤20%** for `completed_degraded`, **>20%** fails.

Rationale: `source_page` is stamped by Phase 1 for every parsed comment. A miss rate above 5% almost certainly indicates a Phase 1 parser regression, not a data issue.

**OPEN QUESTION #I** — thresholds. Numbers above are guesses; tune to whatever floor the cityhall UI's rendering degrades noticeably at.

---

## 6. Backfill / migration

Two options:

- **A. Forward-only.** New gens get bboxes; existing bucket contents stand as-is. Prior gens can be rerun manually if page anchors are needed.
- **B. One-off backfill script.** Ship a `scripts/backfill-mcr-page-anchors.py` that walks every `crc-guides/*/*/*/*/source-map.json` in the bucket, patches in page anchors from the paired `mcr.pdf` (via `pdftotext` + regex ID→page mapping), and re-uploads.

Backfill is attractive for Gen 5 / Gen 6 Lamar + Collier where we already know the data — but the Gen 6 port has already been applied manually, so the backfill's real audience is any other project that shipped a gen before this feature landed.

**OPEN QUESTION #J** — which option, or both (ship forward-only in this PR, follow up with backfill script).

---

## 7. Testing plan

### 7.1 Unit-ish

New fixture under `tests/fixtures/populate-mcr-page-numbers/`:

- `raw-comments.json` with 5 parents on pages 2, 12, 47, 49 (edge cases: first page after cover, mid-doc, last page).
- Baseline `source-map.json` with `bbox: []` for all parents.
- Expected output `source-map.json` with page anchors populated.

Assert: for each parent, `bbox[0].page == raw_comments[parent.id].source_page`.

### 7.2 Integration

Re-run the Lamar + Collier Gen 6 pipeline end-to-end with the new phase; assert `manifest.json.phase_logs_summary["phase-10"].counts.parent_bbox_anchor_success == 186`.

### 7.3 Regression

Run the existing `smoke-test` workflow after the change. Expect no behavioral change to phases 0–9 or 11–13. Only Phase 10 counters + `source-map.json` content should differ.

**OPEN QUESTION #K** — is there an existing golden-fixture set for `generate-crc-guides` that this feature should extend?

---

## 8. Cityhall UI dependency

The UI change to consume `parent_comments[].bbox.page` is out of scope for this spec, but the sequencing matters:

- **If the UI already scrolls-to-page** on any non-empty bbox array, Level A ships value on day 1.
- **If the UI needs a non-zero rectangle** to render anything, Level A is invisible until either (a) the UI adds a page-only affordance or (b) we ship Level B.

**OPEN QUESTION #L** — the cityhall UI author should confirm which side of that fence the current renderer sits on. This is the single highest-leverage question in the spec — it pins the ambition level.

---

## 9. Rollout

1. Land this PR with Level A only (or Level B if #L answers "needs non-zero rect").
2. Cityhall UI PR consumes `bbox[0].page` — separate repo, separate PR.
3. Backfill script — follow-up PR if #J = "both".
4. Level B / C as optional follow-ups if the UI benefits.

---

## Open questions summary

Consolidated for a reviewer skim:

| # | Question | Draft position |
|---|---|---|
| A | What does cityhall UI expect? | Answer pins ambition |
| B | Multi-page bbox arrays? | Start page only |
| C | Ship Level A, B, or C first? | Level A |
| D | New phase number or inside 10.2? | Inside 10.2 |
| E | Tolerate silent anchor miss? | Log warning, soft-degrade |
| F | Populate item-level bboxes too? | No (parent only) |
| G | Enforce extraction.method enum? | Yes, tighten schema |
| H | Add hard floor in Phase 12? | Yes |
| I | Soft-floor threshold? | ≤5% / ≤20% |
| J | Backfill script? | Forward-only in this PR, backfill as follow-up |
| K | Golden-fixture reuse? | Reviewer input needed |
| L | Cityhall UI renderer contract? | **Highest leverage — pins #A/#C** |

---

## Appendix A — What Gen 5 shipped

Reference for what "page anchor only" looked like in a real-world run:

```jsonc
// gen 5 source-map.json parent
{
  "id": "TPW1",
  "department_code": "TPW",
  "source_type": "mcr_text",
  "source_pdf": "mcr.pdf",
  "verbatim_text": "Please add the following note to the coversheet: ...",
  "bbox": [
    { "page": 5, "x0": 0, "y0": 0, "x1": 0, "y1": 0, "coord_space": "pdf_topleft" }
  ],
  "crop_image": [],
  "extraction": {
    "method": "failed_bbox",
    "verbatim_match": "exact",
    "validation_passes": 1,
    "confidence": "medium",
    "note": "Parent verbatim_text from raw-comments.json; pdfplumber bbox anchoring skipped to keep run focused — Phase 10 contract allows empty bbox with method='failed_bbox'."
  }
}
```

Note that Gen 5 labeled the method as `failed_bbox` despite carrying a real page anchor. This spec proposes replacing that with the more accurate `page_anchor_only`.

## Appendix B — Gen 6 port state

The Gen 6 rerun applied the Level A shape manually as a one-off port from Gen 5. 186 MCR parents received `bbox: [{page: N, x0:0, y0:0, x1:0, y1:0}]` and `extraction.method = "page_anchor_only"`. That artifact is the reference implementation for Level A; the implementation PR should extract that logic into the skill's Phase 10.2 step.
