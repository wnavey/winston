# generate-crc-guides Phase 6 v2 — Census-First Figure Extraction (Implementation Spec)

**Status:** Draft v2
**Date:** 2026-07-13 (v1: 2026-07-11)

> **Revision note (Draft v2, 2026-07-13).** An audit session verified v1 directly against the live Lamar+Collier MCR (`pdfimages -list` + PyMuPDF placement rects) and found four defects, two of which made the acceptance test unsatisfiable as written. All four are folded in below:
> 1. **New 6a waive rule `header-banner`.** The page-1 header logo appears exactly once in the PDF (page 1 only, verified), so `repeated-logo` (≥ 3 pages) can never waive it and acceptance criterion 1 could not pass. Criterion 1 updated to name the new rule.
> 2. **`pdfimages -list` cross-check now filters `type == image`.** The golden doc emits 34 rows (26 image + 8 smask); the unfiltered count guaranteed a false `completed_degraded` on the acceptance run.
> 3. **6c candidate list gains the open comment at the top of the window.** Comments *starting* on the hosting/preceding page can miss the true parent when a figure run spans ≥ 3 pages — TPW-15 (header p7, fourth figure p9) is the in-spec counterexample.
> 4. **6b gains clip detection + explicit smask compositing.** The p7 TPW-15 placement clips its embedded image (native aspect 0.589 vs placed 0.642), so raw extraction would show content not visible in the document; and `fitz.Pixmap(doc, xref)` does not composite smasks automatically (8 of 26 golden objects carry one).
**Repos touched:** `claude-plugins` (skill `plugins/noetic-tools/skills/generate-crc-guides/` — references, prompts, scripts, schemas, pipeline.md, SKILL.md/working-dir.md)
**Repos NOT touched:** `conductor`, `bureau`, `cityhall`, `substation` (CRC workflow consumes the same guide format; only guide *production* changes)
**Prior art:** Audit spec **winston#162** (`../figure-extraction-audit/DESIGN-SPEC.md`) established the failure modes and the census-first direction. This spec operationalizes it into file-level changes. The gen-6 surgical repair (applied + uploaded 2026-07-10, see gen 6 `decisions.md` §Post-generation figure repair) serves as the golden reference output.

## Problem (one paragraph)

Phase 6 finds figures by rasterizing kept-comment pages and asking a vision model, per page, to detect and attribute figures given only that page's comments. On Lamar+Collier v4 gen 6 this achieved ~45% recall (10 of 22 kept-parent figures correctly attached, 3 misattributed) while passing every phase gate, because (a) continuation figures — the norm in MCRs, 9 of 12 failures — are structurally unattributable and the prompt explicitly says to skip them, (b) pasted screenshots *of tables* are excluded by the "tables are not figures" rule, (c) detection has no ground-truth invariant so silent loss is undetectable, and (d) the verify gate counts pages, not figures. Full root-cause analysis: winston#162 §1.2 (RC1–RC6).

## The load-bearing fact

**Every figure in an MCR is a pasted raster image, and the PDF knows exactly where they all are.** Validated on the Lamar+Collier v4 MCR:

```
$ pdfimages -list mcr.pdf        # poppler — same package as pdftotext/pdftoppm, already Phase-0 deps
page   num  type   width height ... x-ppi
   4     1 image     673  1143  ...  220     ← TPW 9
   5     2 image     619   822  ...   96     ← TPW 10   (gen 6 missed)
   ...
  33    30 image     339   285  ...  147     ← SP47     (gen 6 misfiled as SP48)
  33    31 image     235   156  ...  157     ← SP48     (missed by gen 6 AND the audit's 6-agent vision sweep)
  34    33 image     354   377  ...  194     ← SP51     (gen 6 missed)
```

26 raster objects; minus the page-1 header logo, they cover **all 23** ground-truth comment figures with zero false negatives — including one (SP48's courtyard callout) that a dedicated multi-agent vision sweep missed. The census is a complete recall oracle for this document class, and it's a one-liner. Vision should never again be responsible for *finding* figures — only for *attributing* and *describing* them.

A second, independent win: extracting the embedded object directly (`pdfimages -png` / PyMuPDF) yields the image at **native resolution** — strictly better than the current rasterize-at-150dpi → vision-bbox-estimate → imagemagick-crop chain, which produced the degraded SP50/TPW-12 crops and the "illegible at this resolution" hedges in half of gen 6's descriptions.

## New Phase 6 pipeline

```
6a  CENSUS      (script, deterministic)   pdf → figure-census.json: every raster object ≥ floor,
                                          with page, placement rect, native px, dpi, sha1 digest
6b  EXTRACT     (script, deterministic)   non-waived objects → scratch/figures/raw/p{page}-{n}.png
                                          at native resolution
6c  ASSOCIATE   (LLM, per figure, ∥)      figure PNG + cross-page text context → attributed(comment_id)
                                          | waived(reason) | uncertain(→ Phase 9 HITL)
6d  DESCRIBE    (LLM, per figure, ∥)      unchanged prompt, now fed native-res images
6e  SWEEP       (LLM, per page-pair, ∥)   fallback vision pass over ALL pages for vector-drawn
                                          figures the census can't see; census-matched pages confirm
```

Reconciliation invariant, enforced by the gate: **`attributed + waived + uncertain == census_count`**. Nothing drops silently.

### 6a — Census (answers "simple non-LLM tool?")

New `scripts/figure-census.py`, PyMuPDF (`fitz`):

```python
for page in doc:
    for xref, *_ in page.get_images(full=True):
        for rect in page.get_image_rects(xref):
            emit(page=page.number+1, xref=xref, rect=[rect.x0, rect.y0, rect.x1, rect.y1],
                 width_px=..., height_px=..., digest=sha1(image_bytes))
```

Deterministic waive rules applied in-script (recorded, never silently dropped):
- `repeated-logo`: same digest placed on ≥ 3 pages (catches per-page header seals/banners in other report generators).
- `header-banner`: object placed on **page 1** whose rect top edge sits in the top 15% of the page **and** whose rect width spans ≥ 50% of the page width. This is what actually catches the report-header logo: on the Lamar+Collier MCR it appears exactly once — page 1 only, 614×131 pt placed at the very top, spanning the full 612 pt page width (verified via pdfimages + PyMuPDF) — so `repeated-logo` alone never fires on it. The **page-1 restriction is load-bearing, not cosmetic**: wide top-of-page continuation figures exist (TPW-15's p9 strip is 618 pt / 101% page width at 6% down — it passes both geometric tests) and are protected only by the page scope. Do not generalize this rule beyond page 1.
- `below-size-floor`: rendered area < 0.5% of page area **and** < 120 px on both native axes (decorative rules, bullets). The SP48 courtyard callout is 235×156 — the floor must stay well below that; these thresholds give ~2× margin.

Cross-check: `pdfimages -list` row count **filtered to `type == image`** must equal the census count; `smask` and `stencil` rows are excluded. The filter is mandatory, not defensive: the Lamar+Collier MCR emits 34 rows (26 image + 8 smask), so an unfiltered count is guaranteed to mismatch on the golden document itself. Mismatch after filtering → `completed_degraded` warning (belt-and-suspenders against PyMuPDF/poppler disagreement).

Why PyMuPDF and not poppler alone: `pdfimages` gives page + dimensions but **not the placement rect**, and the rect is what lets the association prompt reason about "sits above the first comment header on the page." Poppler-only fallback (`pdfimages` + `pdftohtml -xml` for positions) is possible but two-tool and lossier; not worth it. (Q1 covers the dependency.)

### 6b — Extract

`fitz` `Pixmap(doc, xref)` (or `pdfimages -png -f p -l p`) → `scratch/figures/raw/p{page}-{n}.png`, native resolution. Two correctness rules the naive extraction misses:

- **Clip detection.** A placement can clip the embedded object (Word crops commonly survive PDF export as the full image plus a clip path), so raw extraction can include content that is *not visible in the document*. Per placement, compare the native pixel aspect (`width_px / height_px`) against the placement rect aspect; if they differ by more than 2%, render the placement rect from the page at 300 DPI instead of extracting the raw object, and record `clipped: true` on the census entry. The golden doc has exactly one such case — p7 (TPW-15), native aspect 0.589 vs placed 0.642 — and it is the "p7 crop equivalent" the acceptance test refers to.
- **Smask compositing is explicit, not free.** `fitz.Pixmap(doc, xref)` returns the base image *without* its soft mask. Composite via the smask xref (`fitz.Pixmap(base_pixmap, fitz.Pixmap(doc, smask_xref))`) and convert CMYK/indexed colorspaces to RGB before writing the PNG. 8 of the golden doc's 26 objects carry smasks, so this path executes on the acceptance run — skipping it ships blank or mis-toned PNGs, not a rare edge case.

**Deletes from the pipeline:** per-figure `pdftoppm` cropping, `bbox_pct` estimation, and the `imagemagick convert -crop` step (retire the `convert` Phase-0 dependency check once 6e is the only crop consumer — see Q5). Adjacent objects on the same page attributed to the same parent become sequential `N.png` under that parent (the TPW-15 p8 two-object standard detail is the precedent).

### 6c — Associate (answers "tweak the prompting for next-page figures")

New `prompts/associate-figure.md`, **replacing** `prompts/detect-and-bound-figures.md`. One call per census object, parallel. Inputs:

- The extracted figure PNG (native res).
- Page number + placement rect (so "above the first header" is stated, not guessed).
- `pdftotext -layout` text of the **hosting page and the preceding page**, with comment headers marked.
- The ordered list of candidate comments (id, full body, kept/dropped status): every comment whose body *starts* on either page, **plus the comment open at the top of the window** — the last comment whose header precedes the hosting page in reading order, regardless of page distance. The starts-on-either-page set alone is not sufficient: when a figure run spans three or more pages the parent's header falls outside the window (TPW-15's header is on p7 but its fourth figure lands on p9, so the p8+p9 window contains no *start* of the true parent — yet the acceptance test requires attributing it). With the open-comment addition, the true parent is always in-context. This is the fix for RC1.

Prompt rules (each one reverses a specific gen-6 failure):

1. **MCR layout convention: a figure follows its comment.** A figure above the first comment header on a page belongs to the last comment opened before it in reading order — i.e., the previous page's trailing comment. *(Reverses the "skip cross-page figures" rule — RC1; fixes TPW 10, TPW 17, PR5, SP31, SP47, SP51-class misses and the TPW-18/SP48-class misattributions.)*
2. **Textual anchors override adjacency**: "see below", "shown below", "screen capture below", "please use the … detail:", "include Figure N", trailing colons pointing into the figure. *(TPW 15's p9 strip is anchored by p8's trailing note, not by the TPW 16 header below it.)*
3. **A pasted screenshot of a table IS a figure.** The old "tables are not figures" carve-out applied to native-text tables — which cannot appear in a raster census at all, so the exclusion is deleted entirely. *(RC4; fixes DE 4, DE 6, SP51.)*
4. **Never force-associate.** Output is exactly one of `{"attributed": {"comment_id", "confidence", "rationale"}}` / `{"waived": {"reason"}}` (logo/banner that survived 6a rules, orphan decoration) / `{"uncertain": {"candidates": [...]}}`. `uncertain` routes to the Phase 9 HITL batch with the figure thumbnail and candidate list — a first-class verdict, not a drop. *(RC3.)*
5. Multi-figure parents: order by (page, rect.y0); contiguous same-page objects with no intervening text belong together.

### 6d — Describe

`prompts/describe-figure.md` unchanged. Native-res input eliminates the "illegible at this resolution" caveats that pervade gen-6 descriptions (compare gen 6's TPW-12 entry pre/post repair: zero legible dimensions → all three zone dimensions transcribed).

### 6e — Vector-figure sweep (fallback, demoted)

The census cannot see vector-drawn figures (none exist in the Lamar+Collier MCR; other jurisdictions/report generators may differ). Keep a vision pass with three changes from today's detect pass:

- Runs over **every page of the PDF**, not `source_page`-filtered pages. *(RC2: page 8 — pure figure overflow, no comment header — was never rasterized in gen 6.)* 51 pages at 150 DPI is trivially cheap and the skill's cost policy already forbids narrowing.
- Renders **page-pair windows** (page N stacked with N+1) so a figure straddling a boundary is visible in one call.
- Its job is narrowed to: confirm each census rect (sanity), and report any figure-like region with **no census object** → `vector-figure` candidates, which then go through 6c/6d with a `pdftoppm` crop (the only surviving use of the old crop path).

## File-level change list

| # | File | Change |
|---|---|---|
| 1 | `scripts/figure-census.py` | **New.** 6a+6b: census, waive rules, native extraction, `pdfimages -list` cross-check. Emits `scratch/figure-census.json`. |
| 2 | `prompts/associate-figure.md` | **New.** 6c prompt per rules above. |
| 3 | `prompts/detect-and-bound-figures.md` | **Deleted** (superseded). Its salvageable content (figure-type taxonomy, brief_label rules) moves to associate/describe prompts. |
| 4 | `prompts/sweep-vector-figures.md` | **New.** 6e prompt: page-pair PNG + census rects in → confirmations + vector-figure candidates out. |
| 5 | `references/figure-extraction.md` | **Rewritten** around 6a–6e. Inheritance section (figures are parent-scoped, sub-items inherit) survives unchanged. |
| 6 | `references/schemas/figure-census.schema.json` | **New.** Census entries: `{object_id, page, xref, rect, width_px, height_px, digest, clipped?, disposition: attributed\|waived\|uncertain, comment_id?, waive_reason?, crop_path?, described?, description?, type?, constraints?}`. |
| 7 | `references/schemas/figures-index.schema.json` | **Reshaped.** Becomes the 6e sweep record (per-page coverage + vector-figure candidates); census entries live in figure-census.json. `bbox_pct` survives only for vector figures. |
| 8 | `scripts/verify-phase.py` (`rules_phase_6`) | **Reconciliation gate** (hard fail): `attributed + waived + uncertain == census_count`; every `attributed` comment_id ∈ parsed comments; every attributed+described entry has its PNG on disk; every `uncertain` id appears in `hitl-prompts.json`; sweep coverage == total PDF pages (not kept pages). Degraded: pdfimages/PyMuPDF count mismatch. |
| 9 | `scripts/verify-phase.py` (`rules_phase_12`) + `references/phase-contracts.md` §12 + `manifest.schema.json` | Manifest gains `figures_by_parent: {slug: count}`. Cross-gen diff extends beyond today's "total figures == 0 while baseline > 0" to **per-parent**: any parent with a figure in ≥ 1 prior gen but none now → `completed_degraded` with the parent named. |
| 10 | `references/output-format.md` §Figures | **Sub-item ID header convention** (shipped in the gen-6 repair, now codified): entry headers name the checklist item(s) the figure evidences — `**SP-31.2**`, `**TPW-17.2 / TPW-17.3**` — not the bare parent. New Phase 11 sub-step: per figure, one small LLM call given the parent's atomic items → subset the figure evidences (default: all of them, when the figure is parent-generic). Figure *file paths* stay parent-keyed (`figures/{parent_slug}/N.png`). |
| 11 | Phase 2 + `references/phase-contracts.md` | **Slug normalization**: single documented rule `raw_id → slug` (uppercase, collapse whitespace to one hyphen: `"SP 48"`/`"SP48"` → `SP-48`), applied once at Phase 2 and used for figure dirs, guide references, manifest keys. Kills the `SP48`/`SP-48`/`IW`/`IW-1` cross-gen drift that makes per-parent diffing (#9) unreliable. Note: this changes bucket paths vs gens 1–6; the diff in #9 must compare on *normalized* slugs. |
| 12 | `working-dir.md` (Phase 0 preflight) | Add `python3 -c "import fitz"` (PyMuPDF) to the dependency checks alongside `pdftotext`/`pdftoppm`. See Q1. |
| 13 | `pipeline.md` §Phase 6 | Rewritten table row + execution-log counts v2: `census_objects, waived, attributed, uncertain, describe_calls_dispatched, sweep_pages, vector_figures_found`. Log entries must carry real per-step timestamps (gen 6's phase-6.json had `started_at == ended_at` — post-hoc fabrication; the census script writes its own timestamps, the orchestrator records call times). |
| 14 | `references/hitl-flow.md` | New prompt category `figure-attribution`: thumbnail path + candidate comment ids + rationale, batched with the rest of Phase 9. |
| 15 | `SKILL.md` | Pipeline-at-a-glance row for Phase 6; "Cost & Vision Policy" note that detection is now deterministic and vision spend concentrates in associate/describe/sweep. |

Untouched: Phases 1–5.5 and 7–10 logic, decomposition contract, enrichment prompts, figure inheritance semantics, upload mechanics (Phase 13 uploads whatever `figures/` contains).

## Acceptance test (golden run)

Phase 6 is file-anchored, so v2 can run standalone against gen 6's inputs without re-running the pipeline: point 6a–6e at gen 6's `mcr.pdf` + `scratch/raw-comments.json` + kept-set artifacts in a scratch gen dir.

Pass criteria (all against the repaired gen 6, which is ground truth):
1. Census = 26 objects; 1 waived (`header-banner`, the page-1 logo — it appears on page 1 only, so `repeated-logo` never fires on this document); 0 below-size-floor false-waives (SP48's 235×156 must survive); exactly 1 census entry marked `clipped` (p7, TPW-15).
2. Attribution exactly matches the repaired figure set: 23 figures → {TPW-9, TPW-10, TPW-12, TPW-15×4 (p7 via the 6b clip rule + p8×2 + p9), TPW-16, TPW-17, DE-4, DE-6, DE-7*, DE-22, DE-23, DE-30, DE-31, IW-1, PR-5, SP-2, SP-31, SP-39*, SP-47, SP-48, SP-50, SP-51} — *DE-7 and SP-39 attributed to dropped parents and therefore not promoted, per the existing contract.
3. Zero `uncertain` on this document (it has no genuinely ambiguous figures once cross-page context is provided) — if any appear, the associate prompt needs tightening before ship.
4. Reconciliation gate passes; per-parent Phase-12 diff vs (repaired) gen 6 shows no losses.
5. Sweep finds zero vector-figure candidates and confirms all census rects.

## Open questions

- **Q1 — PyMuPDF dependency.** PyMuPDF (AGPL) as a Phase-0 preflight-checked dependency of the skill (`pip install pymupdf`, import-check like the poppler binaries). It runs locally in the operator's session — not shipped/linked into product code — so AGPL is a non-issue in this context, but flagging for the record. Alternative: poppler-only (`pdfimages` + `pdftohtml -xml` for rects) — workable, uglier, no smask compositing. **Recommend PyMuPDF.**
- **Q2 — `uncertain` disposition.** Spec routes to Phase 9 HITL (consistent with "drop or HITL — never silently emit"). Alternative: attribute-to-nearest with a `low_confidence` flag. **Recommend HITL** — misattribution proved worse than a miss in gen 6.
- **Q3 — Sub-item mapping mechanics (#10).** One small LLM call per figure (given parent's atomic items) vs. doing it inside the describe call vs. rule-only (default all items). **Recommend the dedicated small call with default-all fallback** — it's ≤ 23 cheap calls per run and the SP-31.2/TPW-12 cases show real value.
- **Q4 — Sweep scope.** Every run over all pages (recommended; matches cost policy and closes RC2) vs. only pages where the census found nothing. **Recommend every run.**
- **Q5 — Retire `convert`/imagemagick from preflight?** Only 6e vector crops still use it. Keep for v2, revisit when a jurisdiction actually produces a vector figure. **Recommend keep.**
- **Q6 — Sibling skill.** `generate-crc-guides-from-redlines` has its own figure path (navalbase bbox-driven crops) and different failure modes; out of scope here, but the census cross-check (6a) would be a cheap sanity add there too. Flagged, not specced.
- **Q7 — Slug migration (#11).** Normalized slugs change figure dir names vs gens 1–6 (`SP48` → `SP-48`). Fine for new generations (each gen is a fresh bucket prefix); the only consumer of cross-gen continuity is the Phase-12 diff, which #9 makes slug-normalized. Confirm cityhall's CRC UI resolves figure paths from the guide markdown (relative refs) rather than hardcoding slugs — believed true since the UI renders the guides as-is.

## Relationship to winston#162

#162 §Part 2 proposed P1–P6 at design altitude; this spec is the implementation contract. Where they differ: this spec deletes the detect prompt outright rather than patching it (P5's prompt fixes become properties of the new associate prompt), and it adds the sub-item header convention and slug normalization, both of which emerged from the gen-6 surgical repair rather than the original audit.
