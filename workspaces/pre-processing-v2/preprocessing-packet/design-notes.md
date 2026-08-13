# Design notes — hole-poking, adjustments, and recommendations

From the 2026-08-13 planning session. These are reasoned recommendations, not mandates —
Jason ratified the *shape* (see README) and left implementation to Will. But each note below
is grounded in the code recon (see the two exploration files) and several encode traps that
have already bitten prior work.

## 1. Why the plan is sound (the evidence alignment)

Three findings from recon make the move near-inevitable rather than speculative:

1. **The review runbook already distrusts the transcriptions.** Its shared conventions state
   the vector PDF is the authority and "a negative reached only by searching text is not a
   negative." The 08-12 Austin (1700 S. Lamar) review effectively operated without the
   transcription layer. The Gemini upload-time transcription currently pays full cost to
   produce content the review side has already demoted.
2. **The SIR reader triad maps one-to-one onto the recorded failure modes.** Two independent
   readers (literal draftsman / meaning) that never see each other, a shared section skeleton,
   a reconciler whose rule is "every disagreement is a data gap, never pick a winner," and a
   mandatory per-reader coverage confession. Independent contexts kill confabulation
   convergence (failure mode 6); coverage confessions kill silent-missing-sheet (mode 3,
   sheet-04); disagreement-as-gap kills silent substitution (modes 1, 9). Zoom is already
   modeled as a costed disposition (`needs-higher-dpi-read`) the orchestrator approves — which
   is exactly Jason's "explore for a legend when stuck, but not on the golden path."
3. **Publishing to the same DB fields is the right simplification.** Four separate workspace
   builders read `sheet_version`/`content_block` (memory:
   `reference_sheet_version_has_four_workspace_builders`); keeping the shape identical means
   none change and the UI doesn't change. Precedent exists for runbook output publishing to
   prod via a deterministic service-role script (the dual-view publisher, bureau #1006/#1007,
   shipped 2026-08-13).

## 2. The strip list is 11 AI calls, not 3

See `exploration-upload-pipeline.md` §3 for file:line detail. All are Gemini via Vercel AI
Gateway except where noted:

| # | Call | Disposition |
|---|---|---|
| 1 | Sheet naming + page summary | → runbook |
| 2 | Block discovery / bounding boxes | → runbook |
| 3 | Block transcription (batched) | → runbook |
| 4 | Reading guide per sheet | → runbook |
| 5 | Sheet-version change narrative (v2+), incl. the `UNRELATED` chain-break decision | → runbook (see §3) |
| 6 | Plan-set title block metadata | → runbook |
| 7 | Document inventory (name/summary/sections) | → runbook |
| 8 | Zip content triage (text-only, cheap, synchronous) | **stays in sandbox** (Jason's call) |
| 9 | Project-facts refresh (Haiku) | → runbook |
| 10 | Block embeddings (OpenAI text-embedding-3-small) | → moves with transcription (see §4) |
| 11 | Drainage-model analysis (zip-registered models) | → runbook |

## 3. Non-obvious coupling: the change narrative makes a *structural* decision

Call #5 doesn't just write prose — it can declare a sheet pair `UNRELATED`, which nulls
`previous_sheet_version_id` and flips `change_type` to `added`, i.e. it edits the version
chain. Moving it to the runbook is correct (the runbook has whole-submission context and the
prior version), but the publisher must own these DB semantics deliberately, not incidentally.

Related: the **mechanical** similarity scoring and sheet matching (sharp scripts, no AI) stay
at upload, so added/modified/unchanged classification and comparison thumbnails still work on
day one. Only the narrative + chain-break judgment defers.

Jason's "new version is missing sheets — intentional or mistake?" scenario is a natural
reconciler escalation in the runbook: compare the staged inventory against the prior version's
and put the question to the operator.

## 4. Embeddings move with transcription — say the consequence out loud

Embeddings are computed over `content_block` content, which won't exist until the runbook
runs. In-app semantic search over sheet content is therefore **empty between upload and the
runbook run**. Accepted. The publisher script should compute embeddings as part of publishing
(same model, trivial cost) so search lights up the moment the runbook publishes.

## 5. One thing to ADD to the mechanical sandbox: a loud page-count check

Today the sheet count is derived from however many raster images `pdftoppm` produced —
a partial rasterization **silently truncates the sheet set** (no cross-check against the
PDF's declared page count). That is exactly the garbled-PDF class Jason wants a human to see.
One cheap assertion (declared page count via `pdfinfo` vs. rendered count; fail loudly)
belongs in the mechanical pipeline, not the runbook.

More broadly, the strip is the moment to delete the swallow paths — see
`exploration-upload-pipeline.md` §6 for the full inventory (failed summary → sheet reads as
`processed` with NULL fields; zero blocks → bare return with no event; similarity script
failure → pair silently dropped; `inngest.send` failure → row `pending` forever). In the new
world the mechanical pipeline either succeeds crisply or fails visibly; all content judgment
lives in the runbook.

## 6. Cost is the real design constraint — the tiering question (Will's call)

Two Opus reads + a reconcile per sheet, with zoom crops, across a 57–100 sheet civil set is a
very different bill from today's ~95-second zero-token script — and it's subscription drain,
so a big package eats session capacity. Recommendation: do **not** commit up front to
dual-reading every sheet. The defensible shape is tiered:

- Cover sheet + value-bearing content (tables, indexes, general notes, legends, schedules):
  full two-pass + reconcile.
- Pure-drawing sheets: single read with the mandatory coverage confession.

Let the **spike decide**: run the drafted runbook against the benchmark package and score by
defects caught. Ground truth: the Lamar plan-set on powerstation (read-only,
`powerstation@100.125.252.25:/home/powerstation/noetic/working/review/austin-1700-s-lamar/plan-set/`);
known-bad sheets: 03 (plat notes dropped, fabricated instrument numbers), 19/20 (13 tabulated
callout defects), 08/09/56 (same tree table transcribed three ways, divergent), 04 (no
transcription at all), 17 (silently-corrected legend transposition). The handoff's rule:
count a check's worth by the defects it CATCHES on these sheets, not by passing structure.

## 7. Don't build a home for data gaps in the database

The reconciler produces a ledger of contested values. Recommendation: publish only
**reconciled** content to the DB; the gap ledger stays a run artifact in the working folder;
the review-side contract ("re-read the PDF before any deciding value") stays in force.
Fidelity goes way up, but we don't pretend it's perfect and we don't grow a contested-value
schema. Ruthless simplicity.

The **only** schema addition recommended: a single nullable "analysis published at" timestamp
on `plan_set_version` (and `document_version`), stamped by the publisher. That gives the
review runbook's prerequisite check one unambiguous field instead of inferring from whether
summaries happen to be NULL (fragile — a genuinely blank sheet is indistinguishable from an
unprocessed one).

## 8. The review-runbook gate should be dumb

No orchestration machinery. The review runbook's kickoff checks the stamp; if missing, the
same operator session runs the preprocessing runbook to completion first (it has its own HITL
stop), then proceeds with review. A prompt-level prerequisite, not a system.

## 9. Runbook design pointers (steal, don't invent)

- **Engine:** the reader-A/reader-B/reconcile triad from `bureau/runbooks/sir/prompts/phase-1/readers/`
  (see `exploration-runbook-patterns.md` §§1–4 for the full anatomy). Cover sheet first, its
  extraction handed to every sheet worker as shared context — that delivers Jason's
  "compare against the cover sheet" cheaply without making cross-sheet exploration golden-path.
- **Zoom/crop mechanics:** the bureau runbooks state policy but hold no commands; the concrete
  recipes (300/600 DPI renders, quadrant crops, `pdftoppm -x -y -W -H` fallback, stub-binary
  detection) live in the older plugin skill — port them into the new runbook's worker briefs
  (`exploration-runbook-patterns.md` §3).
- **Structure:** mirror the sir/review runbook anatomy — RUNBOOK.md runner that never does
  phase work inline, shared-conventions.md, phase orchestrator prompts, folder contract as
  the API, one HITL readout stop (per-package: sheet inventory with one row per page,
  declared-vs-staged count, per-sheet fidelity verdict, gap ledger grouped by disposition).
- **Models:** Opus for readers/reconciler/orchestrator ("reading a drawing is judgment work —
  when in doubt, opus"), sonnet for render/crop mechanics, explicit model on every spawn
  (memory: `feedback_spawn_model_explicit` — unspecified spawns inherit Fable).
- **Publisher:** a deterministic script (not agent freehand) that takes the runbook's output
  JSON and writes the same rows the sandbox writes today — same `short_id` reading-order
  semantics, same `block_numbering_scheme` stamping, same bounding-box normalization —
  plus embeddings and the new timestamp. Mirror the dual-view publisher pattern.

## 10. Operational consequence, stated as a decision

Preprocessing stops being upload-triggered and becomes operator-triggered. At current volume
that's fine — review is the forcing function — but a customer who uploads and browses before
any review is scheduled sees thumbnails and file names only. Jason has accepted this
explicitly.

## 11. Governance rails

- **Worktree protocol** for substation/bureau/cityhall changes (`dsd worktree <repo> <branch>`);
  PRs merge on agentic-reviewer approval. ONE STEP PER PR.
- **Two review trees in bureau:** `runbooks/review/` is production; `pipelines/review/` is
  legacy. The prerequisite gate goes in the former.
- **Four `sheet_version` workspace builders** — keeping the DB shape identical is what makes
  them a non-issue; any deviation from the current shape requires finding all four first.
- Substation schema changes follow its existing SQL-migration pattern (no ad-hoc pushes).
- Spike before the big build; subscription tokens only; metered spend needs Jason.
- Don't touch live run trees; the powerstation plan-set is read-only ground truth.
