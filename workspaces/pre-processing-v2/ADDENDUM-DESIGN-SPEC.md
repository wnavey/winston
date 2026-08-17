# Pre-Processing v2 — Addendum Design Spec: designing the reader against the four defect classes

**Status:** Draft v1
**Date:** 2026-08-17
**Repos touched:** none (design-only). Amends the Phase 2+ reader-runbook design in `DESIGN-SPEC.md`; changes no Phase 1 code.
**Parent:** `DESIGN-SPEC.md` (Pre-Processing v2). **Source:** `preprocessing-packet-addendum/ADDENDUM-2026-08-14-defect-classes.md` (four defect classes verified against the 1700 S. Lamar 57-sheet re-review, 08-13→08-14). **Predecessor evidence:** `preprocessing-packet/preprocessing-transcription-handoff.md` (nine failure modes) and `preprocessing-packet/design-notes.md` (reader-triad reasoning).

> **What this document is.** The addendum "prescribes nothing" — it names four defect classes with verified examples "so whatever you build can be tested against them." This spec does exactly that: it folds the four classes into the Pre-Processing v2 design as (a) the **acceptance test set** the Phase 2 spike scores against, (b) explicit **design requirements** on the reader runbook and publisher, and (c) two genuine **design deltas** the current `DESIGN-SPEC.md` / `design-notes.md` do not yet resolve. It is design-only: no Phase 1 code moves, no schema changes beyond what the parent already spec'd.

---

## Why an addendum is warranted (the one-paragraph answer)

The nine failure modes in the original handoff already justified the demote-and-rebuild decision, and `design-notes.md` §1 argues the SIR reader triad "maps one-to-one" onto them. The 08-14 addendum is not a restatement — it re-taxonomizes the failures into four **mechanism** classes and, in doing so, surfaces two things the current design does **not** cleanly handle: (1) **normalization convergence** — two independent readers can make the *same* "helpful" correction, so "every disagreement is a data gap" catches nothing when both readers agree on a wrong normalization; and (2) **cross-sheet semantics** (legends, symbol tables, PDF-metadata identity, document provenance) that the "cover-sheet-only, cross-sheet-off-the-golden-path" design deliberately does not carry. Both are real, both are cheap to design against now, and both belong in the spike's scoring rubric before the big build. That is the warrant.

---

## The meta-principle (design against this first)

> All four classes share a property: **the staged text reads clean and is wrong, so downstream structural checks (counts, schema, sums) pass while the content is corrupted. Every one was caught only by an agent re-rendering the sheet image and refusing to trust the text.**

Three consequences that constrain the whole Phase 2 design:

1. **The rendered image is the only ground truth.** Text extraction (`pdftotext`) is not a source of truth and, worse, is not even a reliable *cross-check* — on outlined-vector civil sheets there is no text layer to check against (Class 2). The reader's authority is the pixels, always. This is already the review-side contract ("a negative reached only by searching text is not a negative") — the addendum says make it the *reader's* contract too.
2. **Structural lints are not fidelity gates.** Row counts, column sums, schema conformance, and reader-vs-reader diffs all pass on corrupted content (normalization, uniform column drift). A fidelity gate built on structure is theater. The gate must be **image-anchored spot verification**, not structural agreement.
3. **Agreement is not confidence.** The triad's premise — independent contexts kill confabulation *convergence* — holds for random confabulation but **fails for systematic normalization**, because "regularize the document" is a shared LLM prior, not an independent guess. See Delta A.

---

## Class-by-class: what the current design handles, what it misses, the response

### Class 1 — Transcription that normalizes instead of transcribing
*Examples: `PRINCIPIAL`→`PRINCIPAL`; two items numbered 12 renumbered clean 1–21; general note "NO STRUCTURE SHALL BE OCCUPIED…" transcribed without the leading "NO" (meaning inverted); `SP-26-XXXXC`/`SP-2026-XXXXC` completed to `SP-2026-0000C` (a string on no sheet); `533.36`/`553.36` harmonized to one value, erasing a 20-ft contradiction.*

- **Already handled:** the two-pass triad's independent contexts reduce *random* substitution; the reconciler's disagreement-as-gap rule surfaces cells where the two readers differ.
- **Missed:** normalization is *systematic*, not random. Two "helpful" readers can converge on the same wrong correction (both fix the typo, both drop the "NO," both dedupe the duplicate note). When they agree, the reconciler sees no disagreement and publishes the normalized — i.e. destroyed — value. **This is the single most important gap the addendum exposes.** → **Delta A.**
- **Response:** an explicit **verbatim/anti-normalization reader brief** (preserve typos, duplicate numbering, contradictions, negations, and placeholder patterns *exactly*; a "cleaned-up" value is a defect, not a courtesy) **plus** an image-anchored spot check on a sample of *agreed* cells (Delta A). Placeholder integrity (`XXXX` must survive as `XXXX`) and negation integrity ("NO"/"NOT"/"SHALL NOT") get named positive controls in the fidelity pass.

### Class 2 — Values that exist only as drawn linework (no text layer)
*Examples: all R.O.W. widths on sheets 08/09/18 are outlined vector; sheet 47's landscape-calcs table is outlined vector; sheet 03's plat notes reachable only by rendering ~500 dpi and rotating 90°; sheets 06/07 carry load-bearing tables as embedded raster inside a vector PDF. Related trap: sheet 30's detention table is 10 cf low across the whole Cumulative Volume column from one elevation down — internally self-consistent, invisible to any arithmetic lint.*

- **Already handled:** the design is vision-first by intent; zoom is a costed disposition (`needs-higher-dpi-read`); `design-notes.md` §9 ports the concrete 300/600-dpi render, quadrant-crop, and `pdftoppm -x -y -W -H` recipes into the worker briefs.
- **Missed (specifics to bake in):** (a) **rotated content** — the reader must attempt a 90° render when a page is a raster strip / plat; (b) **raster-in-vector** — a vector PDF is not a guarantee of a text layer; embedded-image tables need the same high-dpi read; (c) **uniform column drift** — a whole column shifted by a constant is self-consistent and only catchable by reading the column against the image, never by arithmetic. This is a second reason structural lints can't be the gate.
- **Response:** the value-bearing-sheet reader path **must** render-and-read (never text-extract-and-trust); rotation and raster-table detection are named dispositions; the fidelity pass on numeric columns re-reads *from the image*, not from a sum.

### Class 3 — Valid content silently missing from the reading layer
*Examples: sheet 06 assembled file drops blocks 7 (Standard Construction Notes) and 14 (demand table) though the manifest declares 1–21 valid; the boilerplate filter dropped sheet 06 block 16 — the UCM Waiver Summary, whose **blankness is itself a finding** — under reason "sheet numbering"; sheet 55 missing the survey-control block (NAVD88 datum + both benchmarks, the only vertical datum in 57 sheets); sheets 44/57 (and blank sheet 04) have no assembled text file at all; sheets 08/56 and 09 hold two transcriptions of the same 66-row tree list disagreeing on 19 rows, one dropping a row (65 of 66).*

- **Already handled (structurally eliminated):** Phase 1 removes in-sandbox block discovery/transcription entirely, so the current `block-manifest` + boilerplate-filter drop pathway **ceases to exist**. Phase 2's mandatory per-reader coverage confession + the HITL readout (declared-vs-staged page count, one row per page) is the design-notes answer to silent-missing-sheet (mode 3 / sheet 04). The Phase 1 page-count check catches raster truncation.
- **Missed (must be explicit in the runbook contract):** (a) **no content-dropping filter** — the old "boilerplate filter" is exactly the mechanism that dropped a finding-bearing blank table; the reader must **never** filter content it judges boilerplate, because *blankness is sometimes the finding*. If anything is set aside, it is **ledgered**, not dropped. (b) The **coverage confession must be per-block, not just per-sheet** — sheet 06 was *present* but two of its blocks were absent; a per-sheet "I read sheet 06" confession misses that. (c) The **survey-control / datum block** is named as a must-not-drop (single point of failure for the whole set's vertical datum).
- **Response:** runbook folder contract states **completeness is confessed at block granularity and every set-aside is ledgered**; the HITL readout lists per-sheet *and* per-block coverage; "boilerplate" is never a silent drop reason.

### Class 4 — Cross-sheet semantics the staging doesn't carry
*Examples: one hatch pattern means `PROPOSED MEDIUM DUTY CONCRETE` in sheet 13's legend and `PAVEMENT RESTORATION` in sheet 09's, used on 13/17/18/19 and legended on only one — a single-sheet reader gets false positives both directions; every single-sheet PDF carries the same `Title` metadata (sheet 37 reports sheet 36's title) so anything keying on PDF metadata mis-identifies every sheet; the drainage report's appendices B/C are full-size reproductions of plan sheets 23/24 with the same title blocks but different values.*

- **Already handled:** cover sheet is read first and handed to every worker as shared context — cheap "compare against the cover" without a golden-path cross-sheet crawl.
- **Missed:** the addendum's cross-sheet defects live on **non-cover** sheets. A legend on sheet 13 governs a hatch used on sheets 17/18/19; the cover doesn't carry it. This is the delta that pushes back on "cross-sheet exploration is off the golden path." → **Delta B.**
- **Response (Delta B):** name the specific cross-sheet artifacts that need a home and decide each — **(1) symbol/hatch legends:** collect legend blocks into a shared symbol table handed to workers alongside the cover, or leave symbol interpretation to the review stage and forbid the reader from *resolving* a hatch to a meaning at all (record "hatch pattern H, unlegended on this sheet"); **(2) PDF-metadata identity:** the reader/publisher must derive sheet identity from the **rendered title block**, never from PDF `Title` metadata (a Phase 1/publisher note — metadata is poison here); **(3) document provenance:** a page that looks like a plan sheet but lives inside the drainage report is a *document appendix*, not a plan sheet — relevant to zip triage (see bugfix touchpoint) and to any reader that would otherwise diff appendix values against the real sheet.

---

## The two genuine deltas (call these out to Will explicitly)

### Delta A — Normalization convergence defeats "disagreement is a gap"
The reconciler rule "every disagreement is a data gap, never pick a winner" is sound for divergent readings but **blind to agreement on a wrong normalization**. Two helpful LLM readers share the prior "regularize the document," so both silently fix `PRINCIPIAL`, both drop the leading "NO," both dedupe the double-12 list — and agree. The gap ledger stays empty; the finding is destroyed. Proposed resolution, cheapest first:
1. **Verbatim reader brief** — instruct at least one reader (ideally both) that fidelity means *preserving* typos, duplicates, contradictions, negations, and placeholders; a normalized value is an error. Name positive controls: `XXXX` placeholders, `NO/NOT/SHALL NOT` negations, duplicate numbering, adjacent-contradiction pairs (e.g. two elevations that differ).
2. **Image-anchored spot check on agreed cells** — the fidelity pass samples cells where the readers *agree* and re-verifies a subset against the image, precisely because agreement is where normalization hides. Structural agreement is not confidence (meta-principle 3).
3. **Score it in the spike** — the benchmark's Class-1 sheets (03 note-21 inversion, 07 placeholder completion, 45 double-12, cover `PRINCIPIAL`) are pass/fail probes; a design that only diffs the two readers will *fail* them, which is the point of testing before building.

### Delta B — Cross-sheet semantics need an explicit disposition
"Cross-sheet exploration off the golden path" is the right cost decision but leaves legends, symbol tables, and provenance homeless, and Class 4 defects live exactly there. This is not "make cross-sheet golden-path" — it is "**decide, per artifact, what the staging carries vs. what the reader is forbidden to resolve.**" Recommended split: carry a **legend/symbol table** (collected mechanically-cheaply from legend blocks, handed to workers like the cover) *or* forbid hatch→meaning resolution outright and record the raw symbol; **never** trust PDF metadata for identity; **tag document-appendix pages** so appendix-vs-sheet value divergence is expected, not a fabricated finding. Will picks the split; the spike measures whether the false-positive-both-directions hatch case (sheets 13/17/18/19) survives it.

---

## Touchpoints with the other in-flight specs

- **Phase 1 (`DESIGN-SPEC.md`):** the addendum *reinforces* two Phase 1 choices — the **page-count check** (§1.5) is the mechanical guard for the sheet-04 / 44 / 57 "no assembled text" class, and **removing block discovery** deletes the Class-3 boilerplate-filter drop pathway wholesale. One new Phase-1-adjacent note: **do not let the mechanical namer trust PDF `Title` metadata** (Class 4) — but Phase 1 strips naming to the runbook anyway, so this is really a publisher/runbook rule.
- **Storage-pathing bugfix (`bugs/plan-set-storage-pathing/BUGFIX-SPEC.md`):** Class 4's **drainage-report-appendix-that-looks-like-a-plan-sheet** intersects zip triage. The bugfix's two-pass elect-one-winner uses a `short-side > 11″` byte gate; a full-size appendix reproduction of sheet 23/24 *clears that gate* and could be mis-elected or mis-registered. Worth a line in that spec's Appendix A edge list — not a blocker (the drainage report arrives as its own document/model, not loose in the plan-set slot), but the "same title block, different values" provenance trap is real and the reader must not diff appendix pages against the sheets they duplicate.

---

## Acceptance test set (the addendum's real deliverable)

Score the Phase 2 spike (design-notes §6) by **defects caught on these named sheets**, not by passing structure. Ground truth: `working/review/austin-1700-s-lamar-r2/` (per-line refs in `active/2026-08-review-writing-quality/notes/r2-defect-inventory.md`, entries 1, 37, 39, 40, 41) and the read-only powerstation plan-set.

| Class | Probe sheets | Pass = catches |
|---|---|---|
| 1 — normalization | cover (`PRINCIPIAL`), 03 (note-21 "NO" inversion), 07 (`XXXX`→`0000` completion), 30 (uniform 10cf drift), 45 (double-12 renumber), 27 (`533.36`/`553.36` harmonized) | value preserved verbatim; contradiction/duplicate/negation survives |
| 2 — linework-only | 08/09/18 (R.O.W. widths), 47 (landscape calcs), 03 (rotated plat notes), 06/07 (raster tables) | value present in output at all (text-only reader scores 0) |
| 3 — silently missing | 06 (blocks 7/14/16), 55 (datum/benchmarks), 04/44/57 (no assembled text) | per-block coverage confessed; blank-as-finding ledgered, not dropped |
| 4 — cross-sheet | 13/09/17/18/19 (hatch), all sheets (PDF `Title`), drainage appx B/C vs sheets 23/24 | no false positive either direction; identity from title block; appendix tagged |

---

## Decision log

- **A1** Rendered image is the sole ground truth; text extraction is neither source nor reliable cross-check. **A2** Structural lints (counts/sums/schema/reader-diff) are not fidelity gates — image-anchored spot verification is. **A3** Reader agreement ≠ confidence (normalization convergence). **A4 (Delta A)** Add a verbatim/anti-normalization reader brief + image-anchored spot check on *agreed* cells + named positive controls (placeholders, negations, duplicates, adjacent contradictions). **A5** Value-bearing reader path must render-and-read; rotation + raster-in-vector are named dispositions; numeric columns re-read from image (uniform-drift). **A6** No content-dropping filter in the runbook; "boilerplate" is never a silent drop; blankness can be a finding; every set-aside is ledgered. **A7** Coverage confession at **block** granularity, not just per-sheet. **A8 (Delta B)** Cross-sheet semantics get an explicit per-artifact disposition: carry a legend/symbol table *or* forbid hatch→meaning resolution; never trust PDF metadata for identity; tag document-appendix pages. **A9** The four classes become the spike's scoring rubric; a design is worth its cost by defects *caught* on the named sheets. **A10** Design-only; no Phase 1 code or schema change; folds into the Phase 2 runbook + publisher briefs and the bugfix's edge list.

## Open questions

- **Q-A (Delta A):** verbatim brief on *one* reader (keep one "meaning" reader for readability) or *both*? Recommend both readers verbatim + a separate meaning/narrative pass that never overwrites literal cells. Spike decides.
- **Q-B (Delta B):** collect a shared legend/symbol table, or forbid hatch-resolution and defer all symbol meaning to the review stage? The latter is simpler and net-simplifying; recommend it unless the spike shows the review stage can't recover the symbol.
- **Q-C:** does the block-granularity coverage confession cost enough (token/latency) to want a cheaper mechanical block census first? Fold into the tiering spike.
