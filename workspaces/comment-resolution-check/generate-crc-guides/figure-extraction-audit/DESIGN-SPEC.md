# Figure Extraction Audit — generate-crc-guides gen 6 (Lamar + Collier v4) + Robustness Redesign

**Status:** Draft v1.1
**Date:** 2026-07-10

> **Revision note (v1.1):** During the surgical-repair drafting that followed this audit, the `pdfimages` census surfaced a figure the audit's own vision sweep had missed: MCR page 33 carries **three** embedded figures, not two. The small "COURTYARD — SEE LANDSCAPE PLANS FOR DETAILS." callout screenshot is SP48's rightful figure (its comment is exactly about the missing courtyard landscape plan). Corrections: ground truth is **22** figures on kept parents (not 21); gen 6 recall is 10/22 (~45%); the SP48/SP47 entry in the finding table is not merely a misattribution — SP47's figure was filed under SP48 *and* SP48's own figure was missed. This strengthens the case for P1: the deterministic census out-recalled even the audit's dedicated multi-agent vision sweep.
**Repos touched:** `claude-plugins` (generate-crc-guides skill: `references/figure-extraction.md`, `prompts/detect-and-bound-figures.md`, `scripts/verify-phase.py`, `pipeline.md`)
**Repos NOT touched:** `conductor`, `bureau`, `cityhall`, `substation`
**Audited artifact:** `comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/cf1201c2-2e8b-4034-9a5e-a70b6317e39a/4/6/` (generation 6, MCR sha256 `aae036fc…`, 51 pages, 226 parsed comments, 196 kept parents)

## Problem

The generate-crc-guides skill crops figures out of the MCR PDF and embeds them in the per-department crc-guide files, because MCR screenshots carry evidence the CRC verification agent needs at runtime (e.g. `crc-DE-2.md` item DE-30's storm-drain profile screenshot). Across generations 1–6 of the Lamar + Collier v4 MCR, the extracted figure set has been **wildly inconsistent** — no two generations agree on which comments have figures:

| Parent | gen 1 | gen 2 | gen 3 | gen 4 | gen 5 | gen 6 | Ground truth |
|---|---|---|---|---|---|---|---|
| TPW 9 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | has figure (p4) |
| TPW 10 | ✓ | ✓ | — | — | — (as TPW-11) | — | has figure (p5) |
| TPW 12 | ✓ | ✓ | — | ✓ | ✓ | ✓ | has figure (p6) |
| TPW 15 | ✓ | ✓ | ✓ | ✓ | ✓ | partial (1 of 3) | 3 figures (p7, p8, p9-top) |
| TPW 16 | ✓ | ✓ | — | ✓ | ✓ | ✓ +1 wrong | has figure (p9) |
| TPW 17 | ✓ | ✓ | ✓ | ✓ | ✓ | — (attached to TPW-18) | has figure (p10) |
| DE 4 | ✓ | ✓ | — | — | — | — | has figure (p12) |
| DE 6 | — | — | — | — | — | — | has figure (p13) — missed by ALL gens |
| DE 22 | ✓ | ✓ | — | — | ✓ | ✓ | has figure (p15) |
| DE 23 | — | — | — | — | ✓ | — | has figure (p15) |
| IW 1 | ✓ | ✓ (as `IW`) | — | — | ✓ | ✓ | has figure (p22) |
| PR5 | ✓ | — | ✓ | ✓ | ✓ | — | has figure (p24) |
| SP2 | — | — | — | — | — | ✓ | has figure (p25) |
| SP31 | ✓ | — | — | — | ✓ | — | has figure (p30) |
| SP47 | ✓ | — | ✓ | ✓ | — | — (attached to SP48) | has figure (p33-top) |
| SP50 | ✓ | — | — | ✓ | — | ✓ | has figure (p33) |
| SP51 | ✓ | — | — | — | — | — | has figure (p34) |

(Slug drift is also visible above: `IW` vs `IW-1`, `SP48` vs `SP-48`, `SP2` vs `SP-2` across gens.)

Phase 6's own execution log for gen 6 reports full compliance — `pages_rasterized: 46, pages_vision_detected: 46, vision_detect_calls_dispatched: 46` — and the verify gate passed. The pipeline can satisfy every existing invariant while silently losing half the figures. That is the core defect this spec addresses.

## Audit methodology

Ground truth was established independently of the pipeline: six parallel vision agents each read a disjoint range of the 51 rasterized page PNGs (`scratch/pages/page-NN.png`, 150 DPI, the same rasters gen 6 used) and enumerated every embedded graphic with its owning comment, using the full comment→page map from `raw-comments.json`. Ambiguous attributions (TPW 17 vs 18, TPW 10 vs 11, SP47 vs 48) were adjudicated against comment body text (e.g. TPW 17: *"adheres to the standard detail (shown below)"*). The three suspected misattributions in gen 6 were then confirmed by visually inspecting gen 6's actual crop PNGs.

The ground-truth pass was then cross-validated with a deterministic census: `pdfimages -list mcr.pdf` enumerates **26 embedded raster image objects** (excluding soft masks). Minus the page-1 header logo, every one of the 23 comment figures found by the vision sweep (21 on kept parents + DE 7 + SP39 on dropped parents) corresponds to discrete raster objects in the census, on the expected pages. **No figure in this MCR is vector-drawn; they are all pasted raster images.** This fact drives the redesign in Part 2.

## Part 1 — Findings: what gen 6 got wrong

**Ground truth: 21 figure instances on kept parents. Gen 6 correctly attached 10. Recall ≈ 48%.** 8 figures were missed outright; 3 were extracted but attached to the wrong comment (which is arguably worse than a miss — the CRC agent gets confidently wrong visual evidence).

### 1.1 Checklist items missing their figure

| # | Parent | MCR page | Figure (ground truth) | Gen 6 outcome | Affected checklist items | Guide file |
|---|---|---|---|---|---|---|
| 1 | TPW 10 | 5 | COA standard detail SD 440-2 "Bike Ramps / Shared-Use Path Transitions" (full-page continuation; header on p4). Comment: *"Use one of the standards from SD 440-2…"* | Missed — page 5 reported 0 figures | TPW-10.1, TPW-10.2, TPW-10.3 | `crc-TPW-1.md` |
| 2 | TPW 15 | 8 | Standard detail "Shared-Use Path Behind Bus Landing Area" (entire page is TPW 15 overflow; two raster objects) | Missed — **page 8 was never rasterized** (excluded from `pages-to-rasterize.json`) | TPW-15.3 (bus-stop SUP detail is the item's subject), TPW-15.2 | `crc-TPW-2.md` |
| 3 | TPW 15 | 9 (top) | S. Lamar corridor-improvements plan strip (anchored by p8's trailing note *"…per corridor improvements plans:"*) | Misattributed → emitted as `figures/TPW-16/1.png` | TPW-15.2, TPW-15.3 missing it; TPW-16 polluted with an irrelevant figure | `crc-TPW-2.md` |
| 4 | TPW 17 | 10 | TCM Fig. 9-12 "Right-In / Right-Out Islands at Driveways" (continuation; header on p9; comment says *"standard detail (shown below)"* and cites Fig. 9-12) | Misattributed → emitted as `figures/TPW-18/1.png` | TPW-17.2, TPW-17.3 (both cite TCM 9.3.4.2.H + Fig. 9-12) missing it; TPW-18 shows a figure its comment never referenced | `crc-TPW-2.md` |
| 5 | DE 4 | 12 | Screenshot of the Appendix Q-2 impervious-cover table from sheet 12, "95" value highlighted | Missed — page 12 reported 0 figures | DE-4 | `crc-DE-1.md` |
| 6 | DE 6 | 13 | Screenshot of the "Analysis Point Comparison" table (2/10/25/100-yr pre/post flows) with highlights (continuation; header on p12) | Missed — never caught by any generation | DE-6 | `crc-DE-1.md` |
| 7 | DE 23 | 15 | Wide screenshot of congested SD-04/SD-05 storm layout (2nd figure on the page; DE 22's was caught) | Missed | DE-23 | `crc-DE-2.md` |
| 8 | PR5 | 24 | Screen capture of ~0.52-ac parkland area along Collier St (continuation; header on p23; comment says *"Please refer to the screen capture below"*) | Missed — page 24 reported 0 figures | PR-5 | `crc-PR.md` |
| 9 | SP31 | 30 | Subchapter E "Figure 34: Examples of fully shielded light fixtures" strip (continuation; header on p29) | Missed | SP-31.2 (the item literally requires Figure 34 to be reproduced on the plan), SP-31.1 | `crc-SP-2.md` |
| 10 | SP47 | 33 (top) | Site-plan screenshot, red circle around unidentified feature "5001" (continuation; header on p32; comment says *"identify the features shown below"*) | Misattributed → emitted as `figures/SP48/1.png` | SP-47 missing it; SP-48 shows the wrong figure | `crc-SP-3.md` |
| 10b | SP48 | 33 | Small screenshot of the "COURTYARD — SEE LANDSCAPE PLANS FOR DETAILS." callout on the Site Plan Sheet (v1.1 addition — found by the `pdfimages` census; missed by both gen 6 and this audit's vision sweep) | Missed (SP47's figure occupied its slot) | SP-48 | `crc-SP-3.md` |
| 11 | SP51 | 34 | Screenshot of the Sheet-16 parking table with red oval around the placeholder case number (continuation; header on p33) | Missed — page 34 reported 0 figures | SP-51 | `crc-SP-3.md` |

Correctly extracted and attributed: TPW 9, TPW 12, TPW 15 (1 of 3), TPW 16 (`2.png`), DE 22, DE 30, DE 31, IW 1, SP2, SP50.

Legitimate absences (not defects): DE 7's figure (p13) — parent dropped at Phase 4 as severity `note`; SP39's plat screenshot (p31) — parent dropped as not-plan-verifiable. Per the pipeline contract, figures on dropped parents are not promoted.

Secondary quality finding: gen 6's `SP50/1.png` crop is poorly bounded — its own Phase-6 description admits it *"primarily captures the MCR comment header rather than a complete plan detail."* Bbox-percentage cropping from a vision estimate is inherently lossy (see RC-crop below).

Housekeeping finding: gen 6's promoted `figures/` dir also contains ten stale `AW-RL-*` dirs dated Jun 26 — output of the sibling `generate-crc-guides-from-redlines` skill sharing the same generation dir. Not a Phase-6 defect, but it muddies provenance when auditing figure output.

### 1.2 Root causes

Every failure traces to one of six causes, five of them design-level (not model-quality-level):

**RC1 — Continuation figures are structurally unattributable (9 of 11 failures).** The detect prompt (`prompts/detect-and-bound-figures.md`) is dispatched once per page and receives only *the comments parsed from that page*. A figure whose comment header is on the previous page has no valid candidate in-context. The prompt then makes it worse explicitly: *"Figure on a different page than its comment. This shouldn't happen in well-formed MCRs; if it does, skip the figure on this page and let the parent's page resolve it"* — but the parent's page call can't resolve it, because that call only sees the parent's page image. This MCR has **nine** continuation figures (TPW 10, TPW 15 ×2, TPW 17, DE 6, PR5, SP31, SP47, SP51) — continuation is the norm in MCRs, not a malformation. The instruction guarantees these are either dropped or (see RC3) misattributed.

**RC2 — Page selection by `source_page` skips pure-overflow pages.** `figure-extraction.md` §1: *"Render every page that hosts at least one kept comment (use `source_page` from raw-comments.json)."* Page 8 hosts no comment header — it is entirely TPW 15 figure overflow — so it was never rasterized, never vision-checked, and its two standard-detail images were unrecoverable. The verify gate (`scripts/verify-phase.py` `rules_phase_6`, line ~427) computes `kept_pages` the same way, so the gate is blind to the same omission by construction.

**RC3 — Detection and association are conflated in one pass, and the model force-associates.** When a continuation figure sits above the first header on a page (TPW 17's detail above the "TPW 18" header on p10; SP47's screenshot above the "SP48" header on p33; TPW 15's strip above "TPW 16" on p9), the only candidate the prompt offers is the wrong one — and in all three cases the model attached the figure to it rather than omitting. Topical plausibility makes this insidious: TPW 18 is also about right-in/right-out, so the misattached Fig. 9-12 survives every smell test downstream.

**RC4 — The "tables are not figures" rule kills pasted screenshots of tables.** The prompt excludes *"Tables of numbers (these are data, not visual reference material)."* DE 4, DE 6, and SP51's figures are all raster screenshots **of** tables clipped from the plan set / drainage report, with reviewer highlight markup — exactly the site-specific evidence class CRC needs. Model reads "table" → excludes. This also explains why DE 6 has been missed by all six generations.

**RC5 — The verify gate has no recall invariant.** `rules_phase_6` checks page-coverage counts and that described figures have PNGs on disk. A page reporting zero figures always passes; `figures_emitted` is summed but compared to nothing. Phase 12's cross-gen sanity diff does not diff figure sets, so gen 6 shipping 12 figure-parents where gen 5 shipped 12 *different* ones raised nothing.

**RC6 — Single-context orchestration degrades attention over 46 sequential vision reads.** Phase 6 runs as ~46 native `Read` calls inside the one orchestrator session. Detection quality degrades non-deterministically with context pressure (DE 23: second figure on a page where the first was found; DE 4: sole figure on a sparse page). It also produces slug drift across runs (`SP48` vs `SP-48`, `IW` vs `IW-1`) and post-hoc execution logs (gen 6's `phase-6.json` has identical `started_at`/`ended_at`).

**RC-crop (secondary) — Percent-bbox cropping is lossy even on successes.** The vision-estimated `bbox_pct` → imagemagick crop path produced the degraded SP50 crop and marginal crops elsewhere. Every figure in this MCR exists as a full-resolution embedded raster object; cropping a 150-DPI re-rasterization of it is strictly worse than extracting the original.

## Part 2 — Proposal: census-first figure extraction

The operator's instinct (rasterize per sheet → cheap vision first pass → smarter reasoning model to crop and attach) is directionally right that detection and association must be **separate passes with different context needs**. But the audit shows the first pass shouldn't be a vision model at all — it should be deterministic. The current pipeline already *is* "rasterize + vision detect per page"; its brittleness comes from probabilistic detection with no ground-truth check, not from insufficient model quality. A vision first pass would still be probabilistic. `pdfimages`/PyMuPDF is exact.

### P1 — Deterministic figure census (replaces vision *detection*)

Enumerate embedded raster XObjects directly from the PDF:

- `pdfimages -list` (already a Phase-0 dependency family) gives page + dimensions + DPI per object; PyMuPDF `page.get_image_rects()` additionally gives the exact placement rectangle on the page.
- Extract each object at **native resolution** (`pdfimages -png` / PyMuPDF), replacing the rasterize→bbox-estimate→imagemagick-crop chain entirely. Kills RC-crop; crops become pixel-perfect by construction.
- Filter obvious non-figures deterministically: objects smaller than a size floor, and objects whose digest repeats across ≥N pages (header logos). Everything surviving is a **census entry that must be dispositioned** (attributed to a parent, or waived with a logged reason).

Validation on this MCR: the census yields 26 objects; minus the page-1 logo, the remaining 25 cover **all 23** ground-truth figures (two figures are split across two objects each — adjacent objects on the same page attributed to the same parent merge or ship as `1.png`/`2.png`, which the schema already supports). Zero false negatives. Every one of gen 6's 11 failures would have been surfaced.

### P2 — Association as a dedicated reasoning pass with cross-page context

One LLM call per census entry (parallelizable, fresh context each — fixes RC6), with inputs:

- the extracted figure image;
- the text layout of the **hosting page and the preceding page** (from `pdftotext -layout`, already produced in Phase 1), with comment headers marked;
- the full ordered comment list for the enclosing department section (id, page, body) — not just the hosting page's comments (fixes RC1/RC3);
- the placement rect (so "sits above the first header on this page" is computable, not guessed).

Prompt rules replacing the current association section: MCR convention is *figure follows its comment*; a figure above the first header on a page belongs to the last comment opened before it in reading order (i.e., the previous page's trailing comment); explicit textual anchors ("see below", "shown below", "screen capture below", "Figure N") override adjacency; a pasted screenshot of a table **is** a figure (fixes RC4 — the "tables are not figures" carve-out applies only to native-text tables, which can't appear in a raster census anyway); output must be either an attribution or an explicit `waived` verdict with reason — "unattributable" is a HITL item, never a silent drop.

### P3 — Reconciliation gate (fixes RC5)

`rules_phase_6` gains hard invariants:

- `attributed + waived == census_count` — any undispositioned census object fails the phase.
- Every attribution's parent must be a kept comment or explicitly flagged as attached-to-dropped (existing non-promotion behavior then applies).
- Phase 12 cross-gen diff extends to figure sets: for each parent, compare has-figure against the two prior generations; a parent that lost a figure across generations degrades the run with a named warning.
- Execution log must carry real per-call timing (fixes the fabricated-log smell in RC6).

### P4 — Vision page-sweep demoted to fallback

Keep a vision pass only for what a census can't see: vector-drawn figures (none in this MCR, but possible in other jurisdictions' reports) and belt-and-suspenders on pages the census marks image-free. Run it on **page-pair windows** (page N + N+1 rendered together) so continuations are visible even in fallback mode, and drop the `source_page` filter in favor of "every page of the PDF" — 51 pages at 150 DPI is cheap, and Phase 6's cost policy already says no narrowing. This also removes the RC2 blind spot for the fallback path.

### P5 — Describe/classify pass unchanged

`prompts/describe-figure.md` stays as-is, now fed native-resolution images (the current descriptions repeatedly note "illegible at this resolution" — native extraction largely fixes that too, e.g. TPW-16's station callouts).

### P6 — Slug normalization

One deterministic function `raw_id → slug` (uppercase, single hyphen between prefix and number: `SP 48`/`SP48` → `SP-48`) applied at Phase 2 and used everywhere downstream. Removes cross-gen dir-name drift and makes figure-set diffing (P3) reliable.

### What this deliberately does not do

- No change to figure *semantics* (still parent-scoped, inherited by all atomic sub-items — per `figure-extraction.md` §Inheritance).
- No de-duplication/hashing beyond the logo-repeat filter; same iteration-1 simplification stands.
- No backfill of gens 1–5; they are analysis history, not consumed artifacts.

## Open questions

- **Q1** — Is the census a hard gate or advisory in v1? Recommendation: hard (`attributed + waived == census_count`), since the entire failure class is silent loss; the waive path is the escape valve.
- **Q2** — Should gen 6 be repaired in place (re-run Phase 6 under the new design, re-emit guides + re-upload) or superseded by a gen 7? Gen 7 is cleaner provenance-wise given the AW-RL contamination in gen 6's `figures/`; but the CRC game-day (winston#160) may want the fix on the existing generation path. Recommendation: gen 7.
- **Q3** — Fallback vision sweep (P4): every run, or only when the census finds < K figures / the jurisdiction is new? Cost policy says every run; the sweep is ~50 native reads.
- **Q4** — PyMuPDF becomes a skill dependency (for placement rects + native extraction). Acceptable as a Phase-0 preflight check alongside `pdftotext`/`pdftoppm`/`convert`? (`pdfimages -list` alone lacks placement rects.)
- **Q5** — Should the association pass also *re-verify* the three currently-shipped misattributions pattern (i.e., run association adversarially: "does this figure's content match this comment's text?") as a second vote, or is single-pass association with the P3 gate sufficient for v1?
- **Q6** — DE 7 was dropped as severity `note` although its figure documents a drainage-analysis discrepancy the reviewer flagged ("location of Analysis Point 2 does not match the actual point of discharge"). Out of scope for figure extraction, but flagging: Phase 4 severity classification may be over-dropping; worth a separate look.

## Audit provenance

- Gen-6 artifacts inspected: `scratch/figures-index.json`, `scratch/pages-to-rasterize.json`, `scratch/phase-execution-logs/phase-6.json`, `scratch/raw-comments.json`, `source-map.json`, `manifest.json`, `ignored-comments.md`, promoted `figures/**`, and all `crc-*.md` guides.
- Skill files inspected: `claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/{SKILL.md, references/figure-extraction.md, prompts/detect-and-bound-figures.md, scripts/verify-phase.py}`.
- Ground truth: 6-agent independent vision sweep over all 51 page rasters + `pdfimages -list` census cross-validation + body-text adjudication of ambiguous attributions + visual confirmation of gen 6's misattributed crops.
