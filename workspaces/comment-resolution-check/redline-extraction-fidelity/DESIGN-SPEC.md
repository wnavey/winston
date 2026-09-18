# Redline Extraction Vision Fidelity — closing the navalbase step-3 resolution gap

**Status:** Draft v1
**Date:** 2026-09-18
**Repos touched:** `navalbase` (step-3 render/crop/downscale — the root fix), `claude-plugins` (`navalbase-refine-step-3-output` crop de-anchoring; `generate-crc-guides-from-redlines` size-vs-add-number guard), `bureau` (`process-city-response-docs` runbook — surface low-confidence redline rows at the readout), `inspector-general` (post-hoc lint for the conflation failure mode)
**Repos NOT touched:** `substation`, `cityhall`, `conductor`, `dsd`

> Companion to [`../generate-crc-guides-from-redlines/DESIGN-SPEC.md`](../generate-crc-guides-from-redlines/DESIGN-SPEC.md) (the skill that emits the guide) and [`../../city-response-docs/preprocessing/DESIGN-SPEC.md`](../../city-response-docs/preprocessing/DESIGN-SPEC.md) (the `process-city-response-docs` runbook that now drives the whole chain headlessly). This spec fixes the **extraction fidelity** the whole chain inherits from navalbase step-3. It does not change the guide format or the runbook orchestration.

---

## Problem

The `process-city-response-docs` runbook turns a City of Austin **redline PDF** into the `crc-aw-redlines.md` CRC guide through a fixed chain (`bureau/runbooks/process-city-response-docs/prompts/redlines-worker.md:11-38`):

```
download → navalbase step-3-analyze-pdfs → navalbase-refine-step-3-output → generate-crc-guides-from-redlines
```

(No `layer-2-enrich` in v1 of the runbook — `redlines-worker.md:29`.)

A department-by-department audit of Lamar + Collier v4 (published IG report `2026-09-09-crc-runbook-vs-skill-audit`; V2 = the runbook run on the PPv2 test project gen 1, V1 = the incumbent skill run on the real project gen 6, from **byte-identical** source PDFs) found the runbook's redline guide is actually **broader in coverage** than V1 (extracted 11/11 distinct redlines — catching two V1 missed and avoiding a duplicate V1 emitted) but carries **two hard factual errors**, both on the dense p9 demolition sheet:

- Meter **#63255523** — the reviewer's red margin note is a **size correction, 6″→2″** (number unchanged). The guide instead says *"label the existing 2″ water meter … with its meter number 63255523"* — i.e. "add the missing number."
- Meter **#63205449** — reviewer note is a **6″→1″ size correction**. Guide again says *"add the meter number."*

Both were adjudicated `v1_correct` at high confidence against the verbatim redline. The tell is in the extraction: V2's `source-map` transcription for these two is threadbare — *"Existing water meter near the western matchline"* / *"Existing water meter south of Collier Street"* — the **meter symbol location, with the red margin correction note missing entirely.** V2 got the third meter (#63325038) right, because that callout genuinely read `#UNK` and *did* need a number added; the skill then over-generalized "add the number" onto the two that only needed a size fix.

### Root cause: the transcription pass reads a downscaled whole page

The chain has three vision passes; only the **first** produces the transcription and the bounding box every later pass depends on, and it is the one that runs at the lowest effective resolution.

| Pass | Crops? | Re-verifies text? | Effective resolution the model sees |
|---|---|---|---|
| **step-3** (Gemini via `radar`) — produces text + bbox | **No** | is the transcription | whole page, **downscaled to 1568 px long edge** |
| **refine** (`navalbase-refine-step-3-output`, Opus 4.7) | **Yes** — 600-DPI per-comment crops | **Yes** — this is the correction stage | crops are sharp, but **cut around step-3's bbox** |
| **crc-guides caption** (Phase 3, Opus 4.7) | Yes — 600-DPI crop | **No** — takes upstream text at face value | same bbox |

Verified in code:

- Live config sends **whole page, no crop**: `navalbase/pipeline-config.yaml:48` `enable_cropping_for_detailed_analysis: false`; the vision branch at `pipeline.py:629-644` therefore re-renders the full page at `detailed_no_crop_dpi: 300` (`pipeline-config.yaml:49`) with `cropped=None`.
- That full page is then **downscaled to 1568 px** before the model sees it: `radar.py:228` `prepare_jpeg_bytes(full_page_image, 1568, skip_downscale=skip_downscale)`; `image_utils.py:17-23` LANCZOS-resizes the long edge to `max_dimension` and saves JPEG quality 85.
- **Latent config bug:** `pipeline.py:375` computes `skip_downscale = downscale_for_gemini is False and detailed_provider == "gemini"`. The live provider is `radar` (`pipeline-config.yaml:41`), so `skip_downscale` is **always `False`** on the radar path — the `downscale_for_gemini: false` flag (`pipeline-config.yaml:50`), which reads like it disables downscaling, has **no effect** unless the provider is literally `gemini`. The 1568-px downscale happens regardless.
- On a 30″×42″ sheet, 1568 px on the long edge is **≈37–44 DPI effective.** A handwritten `6″→2″` margin note is a few pixels tall. Gemini's `transcribed_text`, `full_comment_inference`, **and its predicted `bounding_box`** (`parsing.py:21-32`, a 0–1000 `box_2d`) are all produced from that image.

**Why refine — the stage built to fix exactly this — doesn't recover it.** Refine *does* re-verify and correct text (its op set is `modify/merge/split/add/remove`, and its marquee pattern is *box-around-plan-text + leader + margin-text-box → `merge` into one comment whose text is the margin note*). But its only high-resolution image is a 600-DPI crop **cut around step-3's bbox with 15 % padding** (`pipeline-config.yaml:47`). When step-3 puts the box on the meter *symbol*, the leader-connected margin note sits outside the padded crop; refine's fallback (a 300-DPI overview + a "600-DPI full page") is itself resized by the vision API on ingestion, so the note isn't legible there either — and the skill explicitly forbids adding marks *"you can only see at 300 DPI but not 600 DPI"* (`per-page-refinement.md:185`). Garbage box in → refine can't see what it's meant to correct. The caption pass (`generate-crc-guides-from-redlines`) then trusts the upstream text by design (`caption-enrich-classify.md:149`) and ships it — even though its own Example 1 is a `6″→2″` case (`caption-enrich-classify.md:84-102`), it can't apply the pattern to a note that isn't in the crop.

### Why this matters — the larger goal

The redline chain is the automated replacement for **bespoke, hand-curated Claude Code processing**. The V1 redline guide we're implicitly benchmarking against was a hand-run navalbase extraction in a `…/lamar-collier/` folder (2026-06-23), ported verbatim gen 2→6 and never re-run — i.e. a human dodged this failure by curating. The whole point of `process-city-response-docs` (and the broader Pre-Processing v2 push) is to make automated city-response processing trustworthy enough to **publish without a human in the loop.** Coverage is already there; the remaining gap is transcription *fidelity* on dense large-format sheets — precisely the redlines that carry the highest-value, most-specific corrections (meter sizes, dimension callouts, detail swaps). A CRC that tells the applicant to "add a meter number" that is already on the plan erodes trust in exactly the way a hand review never would. This spec closes that gap at its source so the automated runbook can stand on its own.

---

## Decisions

Everything downstream of step-3 is **anchored to step-3's bounding box**. So the fixes are ordered root-cause-first: fix the resolution and localization at step-3 (D1–D2), then make refine able to recover when step-3 is still wrong (D3–D4), then add a targeted guard + safety net for the specific conflation (D5–D6), then a HITL surface (D7).

### D1 — Stop force-downscaling the step-3 image on the radar path *(navalbase; highest leverage, smallest change)*

Fix `pipeline.py:375` so `skip_downscale` is honored for the **active provider**, not just `gemini` — e.g. `skip_downscale = image_cfg.get("downscale_for_gemini", True) is False` (drop the `and provider == "gemini"`), or rename the flag to a provider-neutral `send_full_resolution` and gate the `radar.py:221/228` `max_dimension` on it. Radar/Gemini 3.x accepts large images; a 300-DPI page at full resolution gives the transcription pass real pixels on margin notes. This one change improves both the text and the bbox that everything else inherits.

**Guardrail:** full-res 300-DPI renders of a 42″ sheet are large. Cap by megapixel, not by hard 1568 — pick a `max_dimension` that keeps a 6-pt annotation ≥ ~20 px tall (empirically ≥ ~4000 px long edge on ARCH-E), and keep JPEG quality ≥ 90 for thin red strokes (`image_utils.py:23` is currently 85).

### D2 — Transcribe from per-red-region tiles, not one whole page *(navalbase; the durable fix)*

Even at full resolution, one image of a 42″ sheet asks the model to read the whole thing at once. `red_pixel_detector.py` already localizes red-ink clusters. Add a step-3 mode that **crops one tile per red cluster (generous margin, follow leaders) and runs the detailed vision call per tile**, then unions the results with tile-relative→page-relative bbox remap. This makes the bbox **detector-derived** (not a low-res Gemini guess), which is what unblocks refine's crops downstream. Re-enabling `enable_cropping_for_detailed_analysis` is the seed of this, but note the current crop path crops around a **single page-wide** red bbox (min/max over all red pixels, `red_pixel_detector.py:40-46`) — that is not per-region and must be changed to per-cluster tiling to help.

### D3 — De-anchor refine's crop from step-3's bbox *(claude-plugins: `navalbase-refine-step-3-output`)*

Refine should not be trapped by a bad upstream box. Two changes to the crop step (`references/vision-multipass.md`): (a) widen the crop to the **red-pixel envelope of the whole annotation cluster** (trace the leader) rather than a 15 %-padded box on step-3's region; (b) additionally attach a **detector-derived crop** from the numpy red bbox so refine can re-localize when Gemini's `box_2d` is off. A leader-connected margin note must land inside at least one 600-DPI crop.

### D4 — Give refine a genuinely high-res full-page view *(claude-plugins: `navalbase-refine-step-3-output`)*

Refine's "look for marks step-3 missed / verify no missing correction" step is defeated because its "600-DPI full page" is downscaled on ingestion. Replace the single full-page image with a **grid of 600-DPI tiles** (or the D2 per-cluster tiles) so the "no missing marks" check has real pixels. This is what lets refine legitimately `add` a correction step-3 dropped (relaxing the `per-page-refinement.md:185` constraint once the tiles exist).

### D5 — Size-vs-value guard in the caption/requirement step *(claude-plugins: `generate-crc-guides-from-redlines`)*

For callout corrections (meters, pipes, dimensions), the requirement sentence must distinguish **"add a missing value"** from **"correct an existing value."** The rule: if the flagged plan callout already contains a value of the same kind that the margin note supplies (a number where the note gives a number; a size where the note gives a size), it is a *correction*, not an *addition*. The caption skill already has the pattern (Example 1 is `6″→2″`); this makes it a checked rule rather than a lucky match — and it only fires correctly once D1–D4 put the margin note in the crop.

### D6 — Inspector General lint for the conflation *(inspector-general; cheap safety net)*

Add a post-hoc check over emitted redline guides: flag any row whose requirement says *"add the … number/size"* when its own figure crop or `transcribed_text` already shows a value of that kind. This catches the exact failure this audit surfaced, before publish, independent of whether D1–D5 fully land. Runs in the existing IG redline/CRC surface.

### D7 — Surface low-confidence redline rows at the runbook readout *(bureau: `process-city-response-docs`)*

Redlines are low-volume, high-stakes (11 rows here). Refine already emits per-op `confidence`. The runbook's end-readout gate should list redline rows carrying `low`/`medium`-confidence refine ops (and any D6 lint hits) for a 30-second operator eyeball before the publish decision — without re-introducing per-doc HITL.

---

## Scope boundaries

- **Guide format unchanged.** No change to `crc-*-redlines.md` structure, row IDs, or the CRC workflow contract.
- **Runbook orchestration unchanged** beyond the D7 readout addition — the chain and its headless-worker model stay as specified in the `process-city-response-docs` runbook spec.
- **`layer-2-enrich` stays out** (still deferred per the runbook v1 decision); this spec is about transcription fidelity, not regulatory citation.
- **MCR-text extraction out of scope** — this is the redline (vision) path only. The MCR-side atomization/consolidation findings from the same audit are tracked separately.
- **Not a navalbase rewrite.** D1 is a one-line gate fix + a cap; D2/D3/D4 are additive tiling/crop changes behind the existing step-3/refine interfaces — no change to the `detailed-analysis-results.json` contract that the guide skill consumes.

## Sequencing

D1 (config/gate fix) ships first and standalone — it is the highest-leverage, lowest-risk change and is independently measurable. D2 → D3/D4 follow as the durable localization fix. D5–D7 are guards that can land in parallel and provide value even before D2–D4 are complete.

## Validation — how we'll know it worked

1. **Re-run the redline chain** on the Lamar + Collier AWPE redline PDF (`sha256 b32b945c…`) after D1, then after D2–D4, and diff the emitted `crc-aw-redlines.md` against the audited baseline. Acceptance: meters #63255523 and #63205449 read as **size corrections (6″→2″, 6″→1″)**, and the third meter still reads as an add-number.
2. **Transcription-fidelity spot metric**: for each emitted row, does `transcribed_text` contain the margin note's operative token (the size/number)? Target: the two failing rows recover; no regression on the 9 that were already correct.
3. **D6 lint = 0 hits** on the corrected run.
4. Fold the result into the published IG audit report (`2026-09-09-crc-runbook-vs-skill-audit`) as a follow-up section.

## Open questions

- **Q1 — Downscale cap (D1).** What `max_dimension`/megapixel cap balances legibility against radar/Gemini request-size and latency on ARCH-E sheets? Needs an empirical sweep (render a p9 crop at 1568 / 3000 / 4000 / full and measure whether the model reads the size token).
- **Q2 — Tiling granularity (D2).** One tile per red cluster, or fixed grid, or cluster-with-leader-bbox? Clusters connected by long leaders (callout ↔ far margin note) must stay in one tile — argues for leader-aware clustering over naive connected-components.
- **Q3 — Cost (D2/D4).** Per-cluster tiling multiplies vision calls per page. Acceptable for redlines (low doc volume), but quantify the added calls/tokens per redline PDF and confirm it stays within the runbook's redline-worker budget.
- **Q4 — Contract stability.** Do D2's tile-remapped bboxes and D3's widened crops stay within the existing `detailed-analysis-results.json` bbox contract (0–1 normalized page coords) so the guide skill and step-4 UI need no change? (Believed yes — remap to page coords before emit.)
- **Q5 — Does D1 alone close it?** If full-resolution whole-page transcription already recovers the two meters, D2–D4 become fidelity insurance rather than a hard requirement. Q5 is answered by Validation step 1's first checkpoint and should gate how much of D2–D4 we build now vs. defer.
- **Q6 — Generality.** navalbase step-3 red-ink vision is used beyond CRC redlines. Should D1/D2 be the default for all step-3 runs, or a redline/large-format-gated mode? (Leaning default — low-res whole-page transcription is strictly worse everywhere.)
