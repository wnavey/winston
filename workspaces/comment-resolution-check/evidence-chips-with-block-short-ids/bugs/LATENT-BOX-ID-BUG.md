# Latent box↔text mispairing in `content_block` (wrong evidence-chip highlights)

> **Status:** Diagnosed 2026-07-09. Root cause in substation's block
> extraction; fix not yet implemented. Discovered via CRC run
> `47eca23e-a010-4f87-ac3b-1cf6f4c481ae` (Lamar + Collier v4), finding
> AW-RL-1. Filed alongside [`../DEV-PLAN.md`](../DEV-PLAN.md) because the
> symptom presents as an evidence-chip bug — it isn't one.

---

## Summary

On some sheets, `content_block` rows have their `description`/`content`
paired with the **wrong** `bounding_box`. The bboxes themselves are
accurate and the `short_id`s are correctly derived from them; the *text*
riding on each row belongs to a different block. Every spatial consumer
renders the corruption faithfully: the CRC evidence-chip modal highlights
the wrong region, the sheet page's `?block=` deep-link highlights the
wrong region, and the sheet page's block sidebar shows the wrong
transcription when you click a block.

The evidence-chip pipeline (agent citation → §3.4 gate → persistence →
modal short_id lookup) worked end-to-end exactly as designed. The agent's
citation was textually correct. This is upstream data corruption in
substation's `process-file` sheet pipeline: two independent LLM calls
(bbox discovery, batch transcription) are zipped together **by array
index** with nothing enforcing that the second call returned its array in
the first call's order.

## Symptom (as observed)

CRC run `47eca23e` on Lamar + Collier (project `23301a8a`, submission
version `6b9b85ed`, plan set `908ffab5`), finding **AW-RL-1** ("potable
meter info absent"), persisted `blockNumber: 9` on sheet 6. Chip click
opens the modal with highlight + zoom — but the highlight lands on the
**METER NOTICE NOTES** block, not the **POTABLE METER(S)** table the
finding is about. On the sheet page, the potable table highlights under
`?block=10`, the notes block under `?block=9`.

First guess was an off-by-one in the chip pipeline or a hallucinated
integer. Neither survives contact with the data.

## Evidence chain

All against sheet_version `fa11d91d-23d7-4d35-a65e-7cf6598938bc`
(sheet 6 of plan_set_version `e9111f12`, the v4 submission, processed
2026-05-11, `block_numbering_scheme = 'short-id-ordered'`).

1. **The persisted citation is not a hallucination.** 3 of 5 CRC voters
   (runs 1, 4, 5) independently cited Block 9, each describing the
   potable meter table's content (first row filled: 4" compound,
   600 MAX GPM, 30 service units; second row blank). Independent
   convergence on the same number with matching content rules out a
   one-off.

2. **The cited row's text IS the potable table.** DB row `short_id = 9`:
   description *"Details for potable meter(s) including address, source
   and use, meter type, size, max GPM, and service units…"*. This is what
   blocks.md labeled "Block 9", so the agent's citation is internally
   correct.

3. **But that row's bbox frames a different block.** Rendering the stored
   bboxes onto the sheet 6 JPEG (5400×3600 thumbnail from storage):
   - `short_id 9` bbox `{x:.453, y:.261, w:.106, h:.195}` exactly frames
     **METER NOTICE NOTES** (the numbered 1–4 instructions block).
   - `short_id 10` bbox `{x:.568, y:.262, w:.150, h:.275}` (described as
     "reclaimed meter(s)") exactly frames **POTABLE METER(S)**.
   The boxes are crisp, exact frames of *other* blocks — mispairing, not
   sloppy vision.

4. **`category` sides with the bbox; `description` doesn't.** Row 9 is
   category `notes` (the notes block at its bbox) with a form-table
   description; row 10 is `form` likewise. Category and bbox come from
   the same extraction step; description/content come from a different
   one. This is the fingerprint of the root cause.

5. **The prior sheet_version is coherent.** v3's sheet 6
   (`df3e6356-d05b-41d1-a0a6-cb543ff0078f`, 19 blocks) pairs the same
   bboxes with the right text (its row at `{.453,.262}` is correctly
   "notes providing instructions for completing meter information"; its
   potable row is at `{.568,.26}`). So the corruption entered during the
   v4 re-extraction, and it's nondeterministic per processing run.

6. **Scope on this sheet:** ~half of the 21 v4 rows are provably
   mispaired by cross-referencing v3's coherent pairs — e.g. row 14
   (desc: demand data table) sits on the standard-construction-notes
   bbox; row 7 (desc: construction notes) sits on the infrastructure
   table; row 17 (desc: building water meter sizes) sits on reclaimed
   meters; row 2 (desc: meter notice notes) sits on the UCM waiver
   summary table.

## Root cause

`substation/src/inngest/functions/process-file/sheet.ts` step
`sheet-blocks`:

```
discoverContentBlocks(imgBase64)        // vision on thumbnail → bbox + category per block
  → normalizeDiscoveredBlocks(raw)      // keeps discovery order
  → buildBatchBlockPrompt(normalized)   // lists the bboxes, one line per block
  → extractBlockDetails(pdfBase64, …)   // SECOND Gemini call → { blocks: [{description, content, …}] }
  → mergeBlockDetails(normalized, details.blocks)   // ← THE BUG
  → saveBlockDiscoveryResults(...)      // sorts by (y, x), assigns short_id = i + 1
```

`mergeBlockDetails` (`sheet.logic.ts:22-31`) zips the two arrays **by
index**:

```typescript
return discoveredBlocks.map((block, i) => ({
  ...block,
  description: i < details.length ? details[i].description : '',
  content: i < details.length ? details[i].content : '',
}));
```

The only thing binding the transcription order to the bbox order is a
sentence in `buildBatchBlockPrompt` (`sheet.logic.ts:60-74`): *"Return an
array of N block details in the same order."* The bbox list is in
discovery order (whatever the discovery model emitted — not reading
order). When the transcription model instead walks the page in its own
reading order — the natural failure mode for a vision model handed a
full-page PDF — every description lands on the wrong block. Nothing
validates the result: no key, no order check, not even a count mismatch
guard beyond padding with empty strings.

Irony: the response schema (`sheet.llm.ts:61-70`,
`batchBlockDetailsSchema`) already has an optional
`updatedBounds: [4 numbers]` per block that could anchor a positional
join. `mergeBlockDetails` ignores it.

Because `saveBlockDiscoveryResults` sorts by `(y, x)` *after* the merge,
`short_id` ↔ `bounding_box` pairing is always correct (deterministic
reading order, as designed) — the text is already mispaired by the time
numbering happens. Determinism in the numbering can't repair a corrupted
text↔bbox join that precedes it.

## Impact

- **Wrong-region highlights** in the CRC evidence-chip modal and the
  sheet page's `?block=` deep-link — an authoritative-looking highlight
  on the wrong block, the precise failure the DEV-PLAN's
  `validBlockNumbers` gate was designed to prevent for *hallucinated*
  integers. This variant sails through the gate because the cited
  number is real and textually correct.
- **Sheet page block sidebar** shows the wrong transcription on click for
  affected sheets — this predates and is broader than the evidence-chip
  feature.
- **Agent-side review quality is mostly unaffected**: blocks.md pairs
  short_id + description + content together (no bboxes), and that triple
  is internally consistent. Citations, reading guides, and semantic
  search read coherent text. The corruption only surfaces where a bbox
  is drawn or a crop is taken from it (e.g. any future vision-tool
  targeting by block bbox would read the wrong region).
- **Nondeterministic and silent.** A sheet is either fine or scrambled
  depending on one LLM response's ordering; nothing logs or fails. Spot
  checks of other chips in the same run looked "loosely correct" —
  consistent with per-sheet lottery, not a systematic shift.

## Fix directions (not yet implemented)

1. **Key the join, don't trust the order.** Require the transcription
   model to echo an identifier per item — the block index from the
   prompt's list (`blockIndex: N`) and/or the bbox (`updatedBounds` is
   already in the schema) — and join on it. Items echoing an unknown or
   duplicate key → drop that block's text (empty description beats wrong
   description) and log loudly.
2. **Validate cheaply even without a key change:** category/description
   coherence check, or count + IoU of `updatedBounds` vs the listed bbox
   when present. Mismatch → retry once, then fail the step visibly
   instead of persisting garbage.
3. **Detection/repair pass for existing data.** The fingerprint from
   evidence item 4 is cheap to scan at scale: category (discovery-side)
   vs description semantics (transcription-side) disagreement flags
   candidate sheets without any vision calls; confirmation is one
   crop-and-compare vision call per flagged sheet (IG's
   vision-classifier pattern fits). Affected sheet_versions need block
   re-extraction (or at least text re-pairing); note `short_id`s can
   shift if block count changes on re-extraction, which re-points any
   already-persisted `blockNumber` citations against that sheet_version
   — a repair should re-run extraction on the same sheet_version only if
   block geometry is unchanged, else treat downstream citations as stale.

## Reproduction / verification recipe

1. Pull the sheet's rows:
   `SELECT short_id, category, left(description, 90), bounding_box FROM content_block WHERE sheet_version_id = 'fa11d91d-23d7-4d35-a65e-7cf6598938bc' ORDER BY short_id;`
2. Download the sheet JPEG from the `submission-data` bucket
   (`…/plan-sets/908ffab5…/pending/1778540484468/sheets/6.jpg`).
3. Draw any row's bbox on the image and compare against its description.
   Rows 2, 7, 9, 10, 14, 17 are unambiguous mismatches.
