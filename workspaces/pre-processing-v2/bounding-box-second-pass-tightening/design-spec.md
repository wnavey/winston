# Bounding-Box Second-Pass Tightening

**Status:** Draft v1
**Date:** 2026-08-19
**Repos touched:** `bureau` (new post-reconcile step in `runbooks/preprocessing/` — one prompt + one deterministic crop/remap script + wiring in the phase-1 orchestrator)
**Repos NOT touched:** `substation`, `cityhall`, `conductor`, `inspector-general` (the raw-box change is upstream of `normalize.ts`, so the persisted row shape and IG's parity oracle are unaffected)

## Problem

In the preprocessing runbook, every content block's bounding box is a single by-eye estimate produced by Reader A on the **full-sheet 0–1000 frame**, and nothing ever revisits it.

Verified facts (this codebase, 2026-08-19):

- **The box is eyeballed on the whole sheet.** `bureau/runbooks/preprocessing/prompts/phase-1/readers/reader-a-literal.md:27` — *"`bounding_box` — `[ymin, xmin, ymax, xmax]` on a 0–1000 top-left-origin scale over the sheet image … Estimate the tightest box that contains the block."* Reader A is the **only** agent that authors geometry.
- **Reader B does not record boxes.** `reader-b-meaning.md:27` — *"You do not need the bounding box (Reader A records geometry)."* So there is no second independent geometry read to reconcile against.
- **The reconciler carries A's box through verbatim.** `reconcile.md:20` — *"carry the verbatim `content` and `bounding_box` from A"*; the output schema comment at `reconcile.md:45` reaffirms *"raw 0–1000; the normalizer assigns short_id."* The reconciler settles *content* disagreements, not geometry.
- **Cropping today targets content fidelity, not box precision.** `prompts/zoom-recipes.md` gives hi-res renders and quadrant crops, framed as *"raising precision on every measurement."* There is **no** mechanism to read a tight box in crop-space and map it back to sheet-space, and **no** pass that tightens a box after the first read.
- **The only deterministic box math is the final rescale.** `scripts/lib/parity.ts:54` (`normalizeBoundingBox`) maps `[ymin,xmin,ymax,xmax]/1000` → `{x,y,width,height}` 0–1; `normalizeAndOrderBlocks` then sorts (y ASC, x ASC) and assigns `short_id`. All of this runs *last*, in `scripts/normalize.ts`, over whatever raw boxes the artifact carries.

Result: boxes are approximate by construction. This has been observed as a real problem (confirmed by the operator), and box precision gates future features that depend on reliable per-block regions.

## What consumes the box (and why precision matters)

`content_block.bounding_box` (jsonb `{x,y,width,height}` 0–1) is read downstream for on-sheet region highlighting/overlays and is the natural anchor for crop-by-region evidence gathering. A sloppy box means a highlight that misses the region it names and a crop that clips or over-includes. Confirming the exact downstream consumers and their tolerance is **Q5** — but the operator has already verified the sloppiness is a real, visible problem, so this spec proceeds.

## Design

Add **one new step to phase 1, after the reconciler and before raw-artifact assembly**: `box-refine`. It corrects the coordinates of every reconciled block by zooming in, and does the coordinate arithmetic in a script — never in the agent's head (`shared-conventions.md §17`: *"Deterministic values come from `scripts/`, never from your head."*).

### Per-block loop

For each content block on a sheet, iterate up to **N passes** (start N = 3):

1. **Script — padded crop.** Render a crop of the sheet around the block's current raw box, with padding, at a readable DPI. The script **records the crop's origin and scale** (where the window sits on the full sheet, and the px↔0–1000 conversion for this crop). This is the load-bearing fact the remap depends on. Mechanics reuse `zoom-recipes.md` (`pdftoppm`/`magick`; the `pdftoppm -x -y -W -H` fallback when ImageMagick is absent).
2. **Script — overlay crop.** Produce a *second* image: the same crop with the block's **current box drawn as a translucent blue-shaded rectangle** (light fill, thin edge, so the overlay does not hide the lines it bounds). Drawn from the same recorded crop origin/scale, so what the agent sees is provably the current box.
3. **Agent — correct the box.** The agent (vision) sees both images — the clean crop and the overlay crop — and returns a corrected **tight box in crop coordinates**. It is framed as *"here is the current box in blue; return the corrected tight box,"* not *"move the overlay."* It also returns a done/not-done signal (the box is already tight → stop early).
4. **Script — remap.** Convert the crop-space box back to full-sheet 0–1000 using the recorded crop origin + scale (deterministic affine transform), and write the corrected raw box back into `reconciled.json`.
5. **Loop or stop.** Stop when the agent signals the box is tight, when the pass-to-pass change falls below a threshold (convergence), or when the cap N is hit — whichever comes first. Each subsequent pass re-crops around the *newly corrected* box, so the window tightens and the effective DPI on the block rises each iteration.

### Two images, always

The clean crop and the blue-overlay crop are both passed on every pass. The overlay reframes the task from "find the box" (hard, from a blank crop) to "correct this box" (easy, with a reference), and makes gross errors — a table with its bottom row clipped, a box bleeding into a neighboring note — obvious at a glance. Standard visual-grounding trick; the win is reliability, not just precision.

## Scope boundaries

- **Coordinates only.** The refiner **modifies box coordinates**. It does **not** remove or merge blocks. Block decomposition (dedupe, single-reader keeps, merges) stays with the reconciler, which has the whole-sheet view; a per-block zoom is a *worse* vantage for those calls. (Earlier brainstorm floated remove/merge; deliberately deferred — see Q6.)
- **One crop per block.** No "group nearby boxes into a shared crop" bin-packing in v1. That is a pure token optimization; deferred to v2 (Q7).
- **`title_block` is untouched** — it is excluded from content blocks by `normalizeAndOrderBlocks` (`parity.ts:75`) and captured at plan-set grain, so there is nothing to refine.

## Why this fits the existing architecture with zero downstream change

- The refiner rewrites **raw** boxes *before* `raw-artifact.json` is assembled. `short_id`, box normalization, and `block_numbering_scheme` are all computed *last* by `scripts/normalize.ts` (`phase-1.md:34-40`). So corrected boxes flow through the existing pipeline untouched — the persisted `{x,y,width,height}` shape is identical.
- **IG parity is not threatened.** Inspector General's run-validation oracle independently re-derives `short_id`/bbox from the *normalize formula* (`scripts/README.md:29-40`), not from the raw values. Changing raw boxes upstream does not touch that formula.
- The reconciler's contract is unchanged: it still carries A's box verbatim. The refinement is a *new stage that reads reconciled output*, not a change to the triad.

## Wiring

- New prompt: `bureau/runbooks/preprocessing/prompts/phase-1/box-refine.md` (the refiner brief — two-image input, corrected-box + done-signal output, crop-coordinate contract).
- New script(s): `bureau/runbooks/preprocessing/scripts/` — padded-crop + blue-overlay render, and the crop→sheet-0–1000 remap. Unit-tested like `parity.ts` (round-trip: known crop origin/scale + crop box → expected sheet box).
- Orchestrator wiring: `phase-1.md` Track 1 gains a step between "reconciled.json written" and "collect into raw-artifact.json" — run `box-refine` over each sheet's reconciled blocks. Model/effort: **opus, medium** to match the triad's reading tier (candidate for downgrade to sonnet pending the cost/quality measurement — Q8).

## Validation (measure-first)

Consistent with run-1's "read everything and measure whether the cheap path loses anything" discipline:

- Define an acceptance metric (candidate: IoU of refined box vs. a hand-drawn ground-truth box) and measure refined-vs-eyeballed on a sample before trusting it at scale.
- This is a natural fit for IG's **ground-truth reading-fidelity** suite (the recall-vs-answer-key eval named in the Phase 2 runbook spec) — box IoU becomes a new fidelity dimension there. Not built in this spec; flagged as the measurement home (Q9).

## Open questions

- **Q1 — Loop termination.** Agent done-signal alone, or also a convergence threshold (pass-to-pass box delta < ε)? What is ε, and is N = 3 the right cap? Does a block that never converges get flagged in the gap ledger?
- **Q2 — Padding amount.** How much padding around the current box (fixed fraction of box size? min absolute margin?) so a box that is currently *too small* can still grow to capture the true region?
- **Q3 — Crop DPI.** Fixed DPI, or scale DPI to block size so tiny blocks get more pixels? Interaction with the per-pass re-crop (does DPI rise each pass)?
- **Q4 — Which blocks.** Refine *all* blocks, or only those above/below a size threshold (large blocks may already be fine; tiny blocks benefit most)? Does the refiner run on single-read (pure-drawing) sheets, or only on full-triad sheets?
- **Q5 — Downstream consumers + tolerance.** Exactly what reads `content_block.bounding_box`, and how tight does it need to be? Governs the acceptance metric threshold.
- **Q6 — Remove/merge.** Confirm these stay with the reconciler and are out of scope here. If decomposition errors are common, is a separate follow-up spec warranted?
- **Q7 — Crop grouping.** Defer the group-boxes-into-shared-crop optimization to v2 — confirm.
- **Q8 — Model/effort + cost.** Opus vs. sonnet for the refiner; token budget for N passes × B blocks × S sheets. Is per-block-per-pass vision affordable at plan-set scale, or does that force the grouping optimization sooner?
- **Q9 — Measurement home.** Confirm IG ground-truth fidelity suite (box IoU) is where refinement quality is measured, and that it does not block shipping the step.
