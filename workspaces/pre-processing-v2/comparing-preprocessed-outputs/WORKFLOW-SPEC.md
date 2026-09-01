# Comparing Preprocessed Outputs Across Two Projects (v1 vs v2)

**Status:** Draft v1
**Date:** 2026-09-01
**Kind:** Workflow / methodology spec (evaluation harness, not a code change)
**Repos touched:** `bureau` (consumes `pipelines/review/1.1-download-plans/download_plans.py` + `runbooks/preprocessing/RUNBOOK.md`; the comparison harness itself is a standalone Claude Code Workflow script), `inspector-general` (report is published here)
**Repos NOT touched:** `cityhall`, `conductor`, `surveyor`, `dsd` — no schema or product-code changes; this is a read-only evaluation over already-staged artifacts.

## Purpose

Give us an effective, robust, repeatable way to compare the **preprocessing outputs** of the
same physical site-plan submission processed two different ways — the **v1 ("old") pipeline**
and the **v2 preprocessing runbook** (`bureau/runbooks/preprocessing/RUNBOOK.md`) — so we can
score the v2 runbook's **semantic accuracy** and **transcription accuracy** against v1 and
decide whether v2 is a fair (or better) replacement.

The comparison is done by fanning out many agents (one per supplementary doc, one per sheet or
small sheet-batch), each of which reads the corresponding artifacts from **both** outputs,
scores their similarity, and — when they diverge starkly — goes back to the underlying
`plan_set` / source document to determine which side is correct. The deliverable is a
multi-tab **Inspector General** report.

## The two subjects

| | Project A — v1 "old" (source of truth) | Project B — v2 "new" (runbook) |
|---|---|---|
| Project name | Lamar + Collier / 1700 S Lamar | Wills Pre-Processing V2 Test Project |
| Project ID | `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` | `ed9e7ec4-bdb4-4dcc-85fa-bb06ab70eaa9` |
| Submission version | number **4** | number **4** (`0d7f0a56-5b25-4e38-aef9-c08ef2ef7b99`) |
| Preprocessing | v1 upload-time pipeline | v2 runbook (`runbooks/preprocessing/RUNBOOK.md`) |
| Staged output (after review-new 1.2) | `~/noetic/working/review-new/1700-s-lamar-v4/1.2-stage-submission` | `~/noetic/working/review-new/wills-preproc-v2-0d7f0a56/1.2-stage-submission` |

Project B is intended to be a **mirror of Project A up to submission version 4** — identical
source PDFs, same 57 plan sheets and 14 supplementary documents — differing **only** in how
preprocessing was run. Project A is the **ground-truth reference**: when raw files are consulted
to break a tie, Project A's copies are authoritative.

> Safety (from the runbook): Project A (`23301a8a…`) holds the ground-truth Lamar reviews and is
> **read-only**. This comparison never writes to either project's DB rows — it reads staged
> artifacts on disk and publishes a report to inspector-general only.

## Prerequisites

This workflow assumes all three of the following are true before it starts:

1. **v1 preprocessing is complete on Lamar + Collier submission v4** (`23301a8a…`). *(True today.)*
2. **v2 preprocessing is complete AND published on the Wills Pre-Processing V2 Test Project
   submission v4** (`ed9e7ec4…`) — i.e. the runbook ran to the end of Phase 1, assembled and
   normalized `artifact.json`, and the operator ran `register.ts` + `publish.ts` so every sheet
   and document carries a `preprocessing_run_id`. A *complete* v2 run means the staged download
   in prereq 3 carries the full reading layer (per-sheet reading guides + content-block
   transcriptions), symmetric with v1.
3. **`review-new` steps 1.1 and 1.2 have been run locally for BOTH projects**, so each project's
   preprocessed artifacts are materialized on disk under `.../1.2-stage-submission/`. These are
   produced by `~/noetic/bureau/pipelines/review/1.1-download-plans/download_plans.py`, which
   fetches whatever the preprocessing pipeline published to the DB / Storage for that submission
   version.

> ⚠️ **Preflight guard — verify prereq 2 is actually met.** The `download_plans.py` health
> machinery (`_health.json`) reports `sheet_transcriptions: "ok"` / `reading_protocol: "ok"` by
> **counting artifacts, not inspecting their content** — a `guide.md` that exists but holds only
> a title header still counts as "ok". A v2 run that was interrupted before publish (no
> `artifact.json`, empty `hitl/`) therefore stages a set of near-empty per-sheet files that the
> health checks call healthy. **Before fanning out, run the completeness check below.** If it
> fails, STOP and finish/publish the v2 run first — a comparison against an unpublished v2 run
> measures nothing.

## Staged-output layout (both projects, identical shape)

```
1.2-stage-submission/
  _health.json                 # staging health (see preflight caveat above)
  _boilerplate-filter.json
  block-manifest.json          # per-sheet: documentId, sheetNumber, sheetVersionId, blockNumberingScheme
  download-manifest.json       # every staged file with kind, sha256, bytes, storage_path
  outputs.json
  README.md
  primary-site-plan/
    sheet-01 … sheet-57/        # 57 sheets
      sheet-NN.jpg             # rasterized drawing  (GROUND TRUTH for sheets)
      sheet-NN.pdf             # vector sheet
      guide.md                 # reading guide + summary + block index
      blocks.md                # per-block transcriptions
      block-<k>.md             # overflow single-block transcriptions
  supplementary-docs/
    <doc-slug>/                # 14 docs — SLUGS DIFFER BETWEEN PROJECTS (see crosswalk)
      source.pdf               # the source document (GROUND TRUTH for docs)
      overview.md
      NN-<section>.md          # section-by-section transcription
```

`download-manifest.json[].kind` enumerates the artifact classes and carries a `sha256` per file,
which the alignment pre-pass uses to prove two files are byte-identical:
`sheet-raster`, `sheet-pdf`, `sheet-guide`, `sheet-transcription`, `document-pdf`, `doc-overview`,
`doc-section`, `index`, `workspace-readme`.

## What "same" means (scoring philosophy)

- **Syntactic differences are fine.** Section splitting, block ordering/numbering scheme
  (`short-id-ordered` vs `legacy-category-order`), wording of a summary — none of these are
  errors on their own.
- **Sheet/section summaries are expected to differ** in phrasing. Score them on whether they
  convey the **same facts**, not on wording.
- **Literal sheet and block transcriptions diverging IS worth investigating.** When the two
  outputs disagree on a transcribed value, a table cell, a note, or omit real content, that is a
  material finding — open the drawing/PDF and rule which side is right.
- Three scored dimensions, 0–100, per artifact:
  - **Transcription fidelity** — literal text/table accuracy vs the source.
  - **Semantic accuracy** — do the summary / reading-guide convey correct facts.
  - **Coverage** — fraction of real value-bearing content actually captured.
- **Do not score layout/geometry.** Bounding-box precision is a separate concern (see the
  `bounding-box-second-pass-tightening` spec); if a run skipped box-refine, its looser boxes are
  not a transcription defect and must not be penalized here.

## Ground-truth rule

When two outputs disagree, the agent **opens the underlying source and reads it** to pick a
winner — it does not trust either transcription. Ground truth is:

- **Sheets:** the `sheet-NN.jpg` raster. These are byte-identical across the two projects
  (verified: 57/57 identical sha256), so there is a single shared visual ground truth.
- **Docs:** the `source.pdf`. Most are byte-identical across projects (verified: 9/14 identical
  sha256); where they differ, **Project A's `source.pdf` is authoritative** per the ground-truth
  rule, and the agent additionally notes whether Project B appears to have transcribed a
  genuinely different/newer document.

## Alignment pre-pass (deterministic, no LLM)

Runs before any agent and produces the Tab 1 inventory + the crosswalks the agents consume.

1. **Artifact parity.** Diff the two `download-manifest.json` files by `kind`: are all the same
   artifacts present on both sides? Counts of sheets (57), docs (14), transcription files,
   sections, guides. Surface any missing/extra artifact.
2. **Sheet alignment (by number).** Sheet *N* ↔ sheet *N*. Confirm the pairing by comparing
   `sheet-NN.jpg` sha256 (expected identical) — this proves the two sides describe the same
   physical drawing.
3. **Document alignment (by content, because slugs differ).** The 14 doc folder slugs are named
   differently between the two projects (e.g. `consolidated-site-plan-application` vs
   `cc-consolidated-site-plan-application-1700-south-lamar`), and the three owner-authorization
   letters carry different hash suffixes. Build the 14↔14 crosswalk by:
   - matching `source.pdf` sha256 first (byte-identical docs map unambiguously), then
   - matching the remainder by logical name / content for the docs whose PDFs were re-split or
     re-encoded (different bytes).

   The crosswalk for this submission (Project A slug → Project B slug):

   | Project A (v1) | Project B (v2) | source.pdf identical |
   |---|---|---|
   | consolidated-site-plan-application | cc-consolidated-site-plan-application-1700-south-lamar | no |
   | drainage-model-1700-sola-hec-hms | drainage-model-hec-hms | yes |
   | engineer-s-summary-letter | engineer-s-summary-letter-pape-dawson | no |
   | engineering-and-drainage-report | drainage-report | no |
   | environmental-resource-inventory | environmental-resource-inventory-eri | yes |
   | location-map | location-map | yes |
   | owner-s-authorization-letter-82da33b3 | owner-s-authorization-letter-f1b7be78 | yes |
   | owner-s-authorization-letter-9add261d | owner-s-authorization-letter-5be0a96c | yes |
   | owner-s-authorization-letter-de07da34 | owner-s-authorization-letter-3aa210af | yes |
   | parkland-early-determination-letter | apr-parkland-dedication-early-determination-letter-ped-2178 | yes |
   | project-review-form | project-review-form-prf | no |
   | site-plan-application | city-of-austin-site-plan-application-formal | no |
   | traffic-impact-analysis-determination | tia-determination-worksheet | yes |
   | travis-county-tax-certificate | tax-certificate | yes |
4. **Completeness check (preflight guard).** For each project, assert per-sheet
   `guide.md` is non-trivial (well above a bare-header byte floor) and that content-block
   transcriptions exist for the value-bearing sheets. If Project B's sheets are near-empty while
   `_health.json` says "ok", the v2 run was not published — **stop and report**, do not compare.

## The fan-out (agents)

Run as a single background Claude Code **Workflow** (deterministic fan-out, structured output,
resumable, keeps per-agent output out of the orchestrator context). Model discipline: **Opus**
for every comparison/adjudication agent (this is judgment work — reading a drawing to break a
tie); reasoning effort medium–high.

- **Sheet agents — one per sheet (or one per ~5 sheets).** Each agent, for its sheet(s):
  1. reads Project A's `guide.md` + `blocks.md` + `block-*.md`,
  2. reads Project B's `guide.md` + `blocks.md` + `block-*.md`,
  3. matches blocks across the two (by spatial position + content, since numbering schemes
     differ), counting matched / A-only / B-only,
  4. for every material transcription or coverage discrepancy, **opens `sheet-NN.jpg`**, quotes
     what the drawing actually says, and rules a winner,
  5. compares the two summaries/reading-guides for semantic accuracy,
  6. emits a structured per-sheet verdict.
- **Document agents — one per supplementary doc (14).** Each agent, for its mapped doc pair:
  1. reads Project A's `overview.md` + all `NN-*.md`,
  2. reads Project B's `overview.md` + all `NN-*.md` (v2 typically splits into more, finer
     sections — expected, not an error),
  3. reads `source.pdf` to adjudicate,
  4. maps the two decompositions topically, scores transcription/coverage/value discrepancies
     against the PDF, rules a winner on each material one,
  5. judges whether the finer decomposition preserved/improved fidelity or introduced
     drift/omission/hallucination,
  6. emits a structured per-doc verdict.
- **Optional verify stage.** Any finding a compare agent marks `semantic_drift` /
  `value_mismatch` / `*_wrong` with a claimed winner can be re-checked by a second, independent
  Opus agent against the same source before it is locked into the report — adversarial
  confirmation for the stark calls.

### Structured verdict schema (per artifact)

```
{
  sheet_number | doc_label,
  block_coverage | section_coverage: { A_count, B_count, matched, A_only, B_only, notes },
  findings: [ {
    block | topic,
    A_excerpt, B_excerpt,
    discrepancy_type: transcription_error | missing_content | extra_content
                      | semantic_drift | value_mismatch | formatting_only,
    ground_truth_says,
    winner: A(old) | B(new) | tie | both_wrong | na,
    severity: critical | major | minor | trivial,
    evidence
  } ],
  scores: { transcription_fidelity, semantic_accuracy, coverage },   // 0–100
  overall_verdict: equivalent | minor_syntactic | new_better | old_better | divergent,
  headline
}
```

## The deliverable: Inspector General report

A single self-contained `index.html`, multi-tab, published to inspector-general and viewable at
`https://inspector-general-gamma.vercel.app/reports/view/<slug>/`.

- **Tab 1 — Overall comparison.** Do we have all the same artifacts between the two projects?
  Artifact-parity matrix, coverage deltas (sheets/blocks/docs/sections), rollup scores, and the
  headline findings. This tab also surfaces run-health facts (e.g. any staging false-greens).
- **Tab 2 — Plan sets.** The 57-sheet comparison: a status/verdict grid across all sheets, with
  per-sheet drill-down of guide + block-transcription differences and the adjudicated winners.
- **Tabs 3–16 — one per supplementary doc.** Section-level old-vs-new comparison for each of the
  14 documents, with the doc-level verdict.

### Publishing

```bash
python3 /Users/winston/.claude/skills/audit-preprocessing-v2-run/scripts/publish.py index.html \
  --title "Preprocessing v1 vs v2 — 1700 S Lamar submission v4" \
  --summary "…" --slug 2026-09-01-preproc-v1-vs-v2-lamar-v4 \
  --tags preprocessing,comparison,v1-vs-v2,bureau \
  --env ~/noetic/conductor/.env
```

`publish.py` uploads the bare-`text/html` `index.html` to the `inspector-general` Storage bucket
and upserts an `ig_reports` row keyed on `slug` (idempotent; re-publish to the same slug to
update). If the Noetic MCP `reports_publish` tool is available in-session, that is an acceptable
alternative.

## Scope boundaries

- **Read-only.** No DB writes to either project. No re-running of preprocessing from this
  workflow.
- **Not a bounding-box/geometry evaluation.** Layout precision is out of scope (owned by the
  box-refine spec). This scores content: transcription, semantics, coverage.
- **Assumes a complete, published v2 run.** If v2 is incomplete, see the fallback appendix; the
  main flow deliberately does not attempt to compare against a half-finished run beyond flagging
  it.

## Open questions

- **Q1 — Sheet fan-out granularity.** One agent per sheet (max fidelity, ~57 agents) vs one per
  ~5 sheets (cheaper, ~12 agents). Default: one per sheet for value-bearing sheets, batch
  pure-drawing sheets. Revisit against cost once we have a full-run baseline.
- **Q2 — Verify stage default on/off.** Should the adversarial second-agent confirmation run
  always, or only for `critical`/`major` stark findings? Default: only for stark findings.
- **Q3 — Cross-run score normalization.** How to roll 57 sheet scores + 14 doc scores into a
  single "is v2 a fair replacement?" verdict — simple mean, coverage-weighted, or gated
  (any `critical` transcription regression fails the run)? Leaning gated + coverage-weighted.
- **Q4 — Doc provenance.** When Project B's docs were processed by a *different* run than its
  sheets (e.g. docs already carried a `preprocessing_run_id` and a sheets-only v2 run skipped
  them), the report should label which run produced each side so the doc comparison isn't read as
  testing the same v2 run as the sheets.

## Appendix — fallback when v2 is NOT complete (observed 2026-09-01)

The first attempt at this comparison ran against a v2 run that was **interrupted mid-Phase-1 and
never published**. Symptoms and the adaptation, recorded so the guard above has teeth:

- The v2 staged sheets were near-empty (median `guide.md` ~141 bytes; content-block
  transcriptions present for only 3 of 57 sheets) even though `_health.json` reported
  `sheet_transcriptions: "ok"` and `reading_protocol: "ok"`.
- The v2 run's real per-sheet output lived in the runbook working dir, not the staged download:
  `~/noetic/working/preprocessing/<run>/phase-1-reading/sheets/<n>/reconciled.json`
  (`{ summary, label, reading_guide, content_blocks:[{category,description,content,bounding_box}] }`).
  Only 28 of 57 sheets were fully reconciled; 9 had raw reader passes only; 20 were stubs. There
  was no `raw-artifact.json` / `artifact.json` and `hitl/` was empty (never published).
- The v2 run processed **zero** documents that pass (`document_version … preprocessing_run_id IS
  NULL` returned 0 rows), so the staged docs came from a separate earlier run — a provenance
  caveat for the doc tabs.

**Adaptation if you must compare an incomplete v2 run anyway:** source v2 sheets from
`phase-1-reading/sheets/<n>/reconciled.json` instead of the staged `guide.md`/`blocks.md`, limit
the sheet comparison to the fully-reconciled subset, and clearly label the not-reached sheets as
a completeness gap rather than a quality result. This is a degraded mode; the correct fix is to
finish and publish the v2 run so prereq 2 holds.

## Appendix — original operator instructions (verbatim intent)

> Compare the bureau review-new staged submission data between two projects' submission version
> number 4s. The second project should in theory be a mirror of the first, up to submission
> version 4; the difference is the second was preprocessed with
> `bureau/runbooks/preprocessing/RUNBOOK.md`, the first the "old" way. The preprocessing outputs
> live under `working/review-new/<project>/1.2-stage-submission`, produced by
> `bureau/pipelines/review/1.1-download-plans/download_plans.py`.
>
> There may be syntactic differences, but we're scoring **semantic accuracy** and
> **transcription accuracy**. Sheet summaries are expected to be slightly different, which is
> fine — but things like literal sheet and block transcriptions differing is worth investigating.
> Spin up multiple agents: one agent per supplementary doc, and one agent per sheet (or per ~5
> sheets). Each agent looks at the artifacts from the first output and the second and compares
> them for similarity; if there is a stark difference, the agent validates what the actual
> `plan_set` or source supplementary document says to determine the winner. Use the documents
> from the first review as the source of truth when looking at raw files.
>
> The review output ends up as an Inspector General report
> (`https://inspector-general-gamma.vercel.app/reports`) with multiple tabs: first an overall
> comparison (do we have all the same artifacts between the two projects?), then a tab comparing
> the plan sets across the two projects, then one tab per supplementary doc.
