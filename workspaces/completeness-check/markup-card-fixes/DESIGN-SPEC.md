# CC markup card fixes — evidence and markers only, no pipeline verdicts

**Status:** Draft v1 (agreed with Will in-session, 2026-10-12; mostly a record of the decisions, implementation follows immediately)
**Date:** 2026-10-12
**Repos touched:** `bureau` (`runbooks/completeness-check/scripts/cc.py` rewrites plan-set document citations; `runbooks/completeness-check/scripts/annotate/lib.ts` narrows the non-PDF verdict), `cityhall` (the CC issue card and the sheets-screen issue list: no verdicts, citation labels as captions, rows for cited blocks no marker touches)
**Repos NOT touched:** `conductor2`, `substation`, `inspector-general`, `cityhall-new`, the legacy scripts under `bureau/workflows/completeness-check/scripts/` (the runbook port keeps them unchanged, runbook-v2-port D3)

## Problem

Will reviewed the first Opus 5.5 runbook CC review of WhiteWater Express Car Wash (project `7a697ef1-733f-4d3b-87e6-9cce995d8f1e`, submission version 1 `6688de93-71ba-4827-8092-8ec61d92c8b1`), run `whitewater-cc-v1-opus55` (runbook run `e2e0cb2d-752c-4723-8e57-1429fac24f46`, bureau `4da3206bb`), published as draft review **`31fb1daa-d6d1-4df6-921e-879ccfa3df62`** (84 pass / 37 fail / 3 warn / 68 n/a, 169 markers). Two comments read as broken:

- **Comment 168** (`cc-3:CC-3-19`, Compatibility notes). Under the cited application (`6aa8b1a8`) a second "Document" card shows "No sheet image", is not clickable, and reads: *"The citation establishes that the project declares itself subject to compatibility standards; the application page holds nothing wrong or blank for this finding, and the missing lighting note is an absence with no slot in this document."*
- **Comment 191** (`cc-6:CMP-02`, building elevations). A "Document" card for *"Primary site plan sheet index – no building elevations sheet"* has no thumbnail, and a second card says *"This document is not a PDF, so it was not swept: there is no page to mark."* The Sheet 12 row is captioned with the annotator's reason (*"No building elevations exist anywhere in the submission… Absence with no slot on the page."*), not the reviewer's citation (*"Site Plan – building label only (27.0-ft height)"*).

Verified causes (bureau `fe7de8220e`, cityhall `524b736`, the run dir above):

1. **The reviewer cited the plan set as a document.** In comment 191 run-1 and comment 33 (`cc-1:CC-1-41`) runs 1–3, an `evidenceLocations` entry carries the plan set's id `6ce598b8-16ec-4d90-892e-12ff5e1e118c` with no `sheetNumber` and no `blockNumber`. `build-review-comments.ts:380-385` files any location without a sheet number under `documentReferences`. The plan set is staged as sheets, not as a supplementary document, so neither cityhall's document lookup nor the annotator can resolve it. These are the only two in the review.
2. **The merge writes a false verdict for an unresolvable document.** `annotate/lib.ts:235` marks a document target `visual: staged.documents.has(id)`; `loadStaged` (`:141-172`) only puts staged PDF documents in that map. Every other id, including the plan set, takes the D16 non-PDF branch (`:542-546`, `:593-596`) and gets `nothing-to-mark` with `REASONS.notVisual` (`:379`). The comment-markings spec's D16 meant real non-PDF files (a drainage model, a spreadsheet). For an id the run never staged, both the status ("we looked, nothing there") and the reason ("not a PDF") are false, and no tool-bug line is written.
3. **The card shows the annotator's verdicts as evidence.** Every swept target must end with a disposition (`annotated` / `nothing-to-mark` / `not-found` / `not-swept`, comment-markings D23, enforced by the worker contract and the merge's coverage check). That is correct bookkeeping. cityhall renders it:
   - `marker-sequence.ts` `captionOf` → `markupCaption` (`:103-133`) captions a whole-sheet marker (a cited sheet with no drawn marker) with the disposition reason, replacing the citation label. The same function captions the sheets screen's issue list (`sheet-issues.ts:89`).
   - `issue-panel.tsx` `CitedDocuments` (`:283-337`) renders `documentMarkupRows` (`marker-sequence.ts:155-182`) under each cited document: drawn page markers **and** a row per non-marked disposition, pictured with nothing when the disposition has no page (`:325`), so it falls through to "No sheet image" (`marker-thumbnail.tsx:187`).
4. **A cited block no marker touches disappears from the card.** On a sheet with drawn markers, `plan-markup.tsx` shows one row per marker and adds a citation row only for a cited sheet *no marker reaches* (`unreached`). The citation's other blocks are visible only as blue outlines on the full sheet with "Highlight evidence" on. In this review 6 of ~37 cited blocks on marked sheets have no marker overlapping them; the clearest is **#140**: markers on the parking row labels (Sheet 12 block 4) while the reviewer's second piece of evidence, *"Sheet 12 Legend (no parking type entries)"* (block 5), never shows on the card. The others: #44 (Sheet 5 block 16), #75 (Sheet 7 blocks 4, 7), #81 (Sheet 9 block 13), #137 (Sheet 12 block 4).

## Decisions

The card shows two things: **evidence** (what the reviewer cited) and **annotations** (the markers). Verdicts stay in the data.

**D1 (bureau). A plan-set citation with no sheet becomes Sheet 1.** In `cc.py` `canonicalize`, which already normalizes every cell's `evidenceLocations` before 2.2's legacy consolidation, an entry whose `documentId` is a plan set and whose `sheetNumber` is absent becomes `sheetNumber: 1`, keeping the label, with no block number. The plan-set ids come from `1.4-resolve/plan-set-versions.json` (keys), which 2.2 already reads (step input), so no step.yaml change. If the same finding already cites Sheet 1, the entry is dropped instead of duplicated. Will: "just leave it as the whole doc, and not hardcode block 6" (Sheet 1's block 6 is the Sheet Index on this plan set, but whole-plan-set citations like #33 are not about the index).

**D2 (bureau). Only a real non-PDF document gets the non-PDF verdict.** `loadStaged` also records the ids staged with a non-PDF `mime_type`. A cited document id that is neither a staged PDF nor a staged non-PDF is unresolvable: it is reported like an unstaged sheet (a `tool-bugs.md` line from the merge) and recorded as `not-swept` with a reason saying the cited document is not in the staged submission. Real non-PDFs keep D16's `nothing-to-mark`, reason reworded to "not a PDF, so there is no page to mark". After D1, the plan set no longer reaches this path; D2 keeps the next unknown id honest.

**D3 (cityhall). No verdicts on the card.** `CitedDocuments` shows only drawn page markers under a document; non-marked disposition rows go. The sheets screen issue list follows D4.

**D4 (cityhall). A whole-sheet marker is captioned with the citation.** `captionOf` for a whole-sheet marker returns the comment's citation label(s) for that sheet (joined as `citedSheets` already does), not the disposition reason; `notFound` is false. Its thumbnail is unchanged: the cited blocks' crop outlined in blue, else the whole sheet. Whole-sheet markers stay stops in the marker sequence, so `?m=` links and "k of n" keep their meaning. A whole-sheet marker on a sheet the comment does not cite (a disposition only) falls back to "Sheet NN".

**D5 (cityhall). A document without markers shows page 1.** Already true for the document's own row (`rowFor(documentId)`); with D3 there is no page-less row left to render as "No sheet image".

**D6 (cityhall). A cited block no marker touches gets its own row.** On a sheet with drawn markers, each cited block (`citedBlocksOn`, which carries the block's box) that no drawn marker on that sheet overlaps (marker bounding box ∩ block box) gets a row after the sheet's marker rows: the block crop outlined in blue, captioned with the citation label, opening the sheet zoomed to it. Not a stop in the marker sequence (like today's `unreached` rows). A block containing the markers (a large drawing block, e.g. #192's "Car Wash Site Layout") is touched, so it gets no row. Computed at view time: the stored review needs no change, and every existing annotated review benefits on deploy.

## Rollout

1. bureau PR (D1 + D2, with `test_cc.py` and `annotate.test.ts` cases from #191 and #33).
2. cityhall PR (D3–D6, with unit tests on #140, #192, #75 shapes).
3. After the bureau PR merges: `conductor void 2.2-consolidate --fresh` on run `whitewater-cc-v1-opus55`, then amend review `31fb1daa` in place (review-amend spec), dry run first.

## Deliberately deferred

- **A staff view of verdicts.** `not-found` ("checked, not found") was the one red row; it leaves the card with the rest. The data keeps it. Q1 below.
- **Outlining the cited block on drawn-marker thumbnails.** Doesn't help the D6 cases (the untouched block is outside the marker's crop).
- **Prompt tightening in 2.1-review** so the reviewer never cites the plan set as a document. D1 handles it mechanically; a prompt change can follow if new shapes appear.

## Open questions

- **Q1.** Should staff see `not-found` / `not-swept` somewhere (a toggle, IG, the Inspect view)? Not blocking.
