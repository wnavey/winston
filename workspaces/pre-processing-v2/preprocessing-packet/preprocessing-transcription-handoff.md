# Preprocessing / transcription fidelity — handoff (Mayor, 2026-08-12)

**Mission: make the staged plan-set transcription layer trustworthy, or formally demote it —
propose the disposition with evidence before building anything.** Jason's framing: work smarter,
not encode every edge case; any fix must NET-SIMPLIFY (see `feedback_simplicity_over_accreting_rules`
and `feedback_spike_before_scraper_fix` in memory). This is analysis-then-proposal first; a fix PR
second, only once the disposition is agreed.

## What the layer is

When a review run is staged, preprocessing downloads every plan sheet and produces per-sheet text
transcriptions (`plan-set/primary-site-plan/sheet-NN/blocks.md`, `block-<n>.md`, plus a `guide.md`
navigation file and a `block-manifest.json`). Review agents read these as a cheap alternative to
opening the drawing image. The layer exists to save vision cost.

## The problem, now confirmed on BOTH Austin runs (and seen in FTL)

The transcriptions are wrong at a rate that makes them unusable as the source of any number, name,
or symbol — and the defects are invisible to every existing check because row counts, headers, and
structure survive intact while cell contents rot.

Nine recorded failure modes (all from `work/lamar-rerun/tool-bugs.md` Class 1 — read it in full):
1. Single-digit/character substitutions inside intact tables (FL 502.57 vs printed 528.57).
2. Whole rows dropped (sheet 03: 25 plat notes transcribed vs 28 printed; notes 27–28 gone —
   note 27 is the only parkland-credit claim in the filing).
3. Whole blocks missing while `block-manifest.json` declares them valid (sheet 01's 52-row sheet
   index; sheet 06's UCM waiver summary). `sheet-04` has NO transcription at all — every "search
   all sheets" text sweep silently covered 56 of 57.
4. Spanning table headers collapsed into a data column (every row shifts one cell).
5. Semantic mis-assignment (stall length filed as width; floor elevations mixed into building dims).
6. **Confabulation** — invented recorded-instrument numbers that resolve to REAL documents on
   unrelated properties; invented utility crossings not on the drawing.
7. Silent correction of the drawing's own errors (a legend transposition "fixed" invisibly —
   hiding a real filing defect).
8. Non-text meaning lost (checkbox fill, X-outs through voided details, watermark identity,
   prime vs double-prime).
9. Two transcriptions of the SAME printed block disagreeing with each other AND the page on
   disjoint rows (sheets 08/09/56 tree table, 19–20 cells differ) — defeats reconciliation checks.

Scale: ~40 of 57 sheets on the 08-12 run carry at least one recorded defect. The 08-04 run logged
the same class on sheets 3, 5, 7, 10, 19, 20, 27, 30, 45, 51, 56 (its `OPERATOR-NOTES.md`). FTL's
Take 5 logged transcriptions INVENTING content (11 instances on one sheet). This is not new and
nothing changed in preprocessing — it was always like this; the 08-12 run quantified it.

Consequence downstream: **any absence claim ("the set doesn't show X") resting on a text sweep is
unsafe**, and several near-false-comments traced to transcription artifacts (a parenthesized value
that is actually a pill box; an industrial-waste note that exists but wasn't transcribed).

## The adjacent-but-distinct problem: text extraction is near-null on civil sheets

Most civil sheets in this package are OUTLINED VECTOR (no embedded text layer): `pdftotext` gets
1,831 chars from sheet 05 vs 31,410 via OCR; a package-wide text search for "watershed" returned
zero hits including the sheet stating it in full. The 7 architectural sheets DO carry a live text
layer. Separately, one embedded font dropped every digit `8` from extraction on a sheet that
renders fine (the #883 font-coverage guard came from this). Any fix to transcription generation
must account for: extraction is not a ground-truth source either — the rendered image is.
The 08-12 run's workaround: two-offset 400-dpi tile grid + tesseract `--psm 11` (~60 s/sheet,
~57 min/package), used as a LOCATOR with positive controls, never as an authority.

## Where the code lives / prior art

- Preprocessing/staging is in **bureau** (the plan-set workspace builder; the run-facing download
  step is pure script and free to re-run — v4 Lamar: 57 sheets / 14 docs, 95 s, zero tokens).
  ⚠️ `sheet_version` has FOUR workspace builders (memory `reference_sheet_version_has_four_workspace_builders`)
  — a fix to one misses the others; find all consumers before changing output shape.
- Prior handoff: `work/preprocessing-defects-handoff.md` (08-03) — the earlier, smaller defect
  list; fold it in, don't duplicate.
- Memory: `project_preprocessing_defects` ("sheet labels VERSIONED; fidelity OPEN").
- Ground truth for validation: the defective sheets themselves —
  `work/lamar-rerun/plan-set/` stayed on powerstation
  (`powerstation@100.125.252.25:/home/powerstation/noetic/working/review/austin-1700-s-lamar/plan-set/`);
  known-bad examples: sheet 03 (plat notes, lot table halved, fabricated doc numbers), sheets
  19/20 (13 tabulated callout defects), sheets 08/09/56 (tree table triple-transcribed,
  divergent), sheet 04 (no transcription), sheet 17 (silently-corrected legend transposition).

## Decision the session must drive to (with evidence, then Jason ratifies)

A. **Fix fidelity** — better transcription (e.g. vision-based against the rendered image, or
   OCR-anchored), with a per-sheet fidelity gate that catches the nine modes above; or
B. **Demote the layer** — transcriptions become navigation aids only; the pipeline rule "the
   vector PDF is the drawing; re-read the image before any value or absence claim" becomes the
   contract and the transcription cost shrinks accordingly; or
C. Hybrid (fix tables/indexes which are high-value, demote free text).

Evaluate cost each way (vision tokens per package vs defect cost downstream). The 08-12 run's
review effectively already operated under B by necessity. Whatever is proposed: validate against
the known-bad sheets above as the test set, and count a check's worth by the defects it CATCHES
on them, not by passing structure.

## Rails

- Worktree protocol for any bureau change (`dsd worktree bureau <branch>`); PR merges on
  agentic-reviewer approval. Subscription only; metered spend needs Jason.
- Spike before big fixes; smarter checks over enumerated edge cases; net-simplify.
- Don't touch the live run trees; powerstation plan-set is read-only ground truth.
