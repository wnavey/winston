# Addendum to the preprocessing packet — defect classes observed 2026-08-14

For Will, from the Austin 1700 S. Lamar full re-review (57-sheet set, run overnight
08-13 → 08-14). This is an addendum to the implementation packet you already have. It
prescribes nothing — it names four defect classes we observed in the current staged
transcriptions, with verified examples, so whatever you build can be tested against them.
Every example below was verified against the vector PDFs at 300–2000 dpi during the run.

## Class 1 — Transcription that normalizes instead of transcribing

The transcriber "helpfully" regularizes the document. This is worse than a misread: a
misread degrades a finding, normalization destroys it, because the defect we were
supposed to flag no longer exists in our copy.

Observed instances:
- The cover sheet letters `PRINCIPIAL STREET` (applicant's typo). Transcribed as
  `PRINCIPAL STREET`. The typo finding is unfindable from our text.
- Sheet 45 prints a list with TWO items numbered 12 (and two word-for-word duplicate
  notes). Transcribed as a clean 1–21 renumbering. The duplicate-numbering finding is
  destroyed.
- Sheet 03, general note 23: the sheet reads "NO STRUCTURE SHALL BE OCCUPIED UNTIL THE
  WATER QUALITY CONTROL AND DETENTION FACILITY HAVE BEEN CONSTRUCTED…". Transcribed
  without the leading "NO" (and renumbered by two, as note 21) — a clean inversion of
  the note's meaning.
- Sheet 07 carries two DIFFERENT case-number placeholder patterns in adjacent tables
  (`SP-26-XXXXC` and `SP-2026-XXXXC` — itself an applicant-facing inconsistency). One
  transcription completed the pattern to `SP-2026-0000C`, a string on no sheet. It
  "fails silently in the direction of looking correct": a sweep for `XXXX` placeholders
  passes right over it. It propagated into two downstream comments before a worker
  refused it.
- Sheet 27 renders both lines of a callout as `533.36` where the sheet reads `533.36`
  and `553.36` — silently harmonizing a real 20-ft contradiction on the drawing, which
  is a genuine defect the review exists to find.

## Class 2 — Values that exist only as drawn linework (no text layer)

Not OCR error: these strings are in no extracted text at all, so a text-only reader
concludes the filing omits them — the opposite of the truth. This is also what makes
Class 1 damage undetectable: there is no text layer to cross-check against.

Observed instances:
- All right-of-way widths on sheets 08/09/18 (`±70.29'`, `±68.08'`, `±89.92'`,
  `±87.47'`, `COLLIER ST (70' R.O.W.)`) are outlined vector text. A set-wide text search
  concludes the filing states no right-of-way width anywhere.
- Sheet 47's entire landscape-calculations table is outlined vector; a set-wide search
  for "mitigation" hits only sheet 46.
- Sheet 03's plat pages are ~300-ppi raster strips carrying 89 words total in the text
  layer; the plat's 28 general notes — including the only parkland notes in the whole
  set — are reachable only by rendering at ~500 dpi and rotating 90°.
- Sheets 06/07 carry their most load-bearing tables (LUE tracking, fixture schedules,
  hydrant flow test, fire flow map) as embedded raster images inside the vector PDF;
  `pdftotext -layout` returns the surrounding sheet text and nothing from the tables.

A related trap: uniform column drift. Sheet 30's detention table transcribed 10 cf low
across the entire Cumulative Volume column from one elevation down — internally
self-consistent after the shift, so no row count, sum, or arithmetic lint can see it.

## Class 3 — Valid content silently missing from the reading layer

Content exists on disk but the documented reading order never reaches it, or it is
absent with no record of the drop.

Observed instances:
- Sheet 06: the block manifest declares blocks 1–21 valid, the boilerplate filter
  records only 8 and 16 dropped — yet the assembled reading file contains no block 7
  (Standard Construction Notes 1–23) and no block 14 (fire/domestic/irrigation demand
  table). Both exist as standalone files; nothing points a reader at them. A reader
  concludes the Austin Water notes sheet has no construction notes.
- The filter dropped sheet 06 block 16 — the UCM Waiver Summary table, whose BLANKNESS
  is itself a finding — under the reason "sheet numbering", apparently chosen from words
  inside the table rather than what the table is.
- Sheet 55's assembled text is missing the survey-control block: the NAVD88 datum
  statement and both benchmarks — the only vertical datum statement in the 57 sheets.
- Sheets 44 and 57 have no assembled text file at all; sheet 04 also has none (that one
  is genuinely blank — a submittal fact — and the missing transcription is exactly why
  nobody noticed).
- Sheets 08/56 and 09 hold two transcriptions of the SAME 66-row tree list that disagree
  on nineteen rows (including a status flip). The true divergence is zero — same block —
  so a reader diffing them reports nineteen fabricated inconsistencies. One copy also
  drops a row entirely (65 of 66).

## Class 4 — Cross-sheet semantics the staging doesn't carry

- The same hatch pattern means `PROPOSED MEDIUM DUTY CONCRETE` in sheet 13's legend and
  `PAVEMENT RESTORATION` in sheet 09's. It is used on sheets 13, 17, 18, 19 and legended
  on only one of them. An agent reading one sheet alone gets false positives in both
  directions on any placement rule.
- Every single-sheet PDF in the set carries the same `Title` metadata (sheet 37 reports
  sheet 36's title), so anything keying on PDF metadata mis-identifies every sheet.
- The drainage report's appendices B and C are full-size reproductions of plan sheets
  23/24 with the SAME title blocks but DIFFERENT values than the sheets of those
  numbers — and nothing in the staging says so.

## One meta-observation

All four classes share a property worth designing against, stated once and left with
you: the staged text reads clean and is wrong, so downstream structural checks (counts,
schema, sums) pass while the content is corrupted. During the run, every one of these
was caught only by an agent re-rendering the sheet image and refusing to trust the text.

Evidence for every instance above: `working/review/austin-1700-s-lamar-r2/tool-bugs.md`
(per-line references in `active/2026-08-review-writing-quality/notes/r2-defect-inventory.md`,
entries 1, 37, 39, 40, 41).
