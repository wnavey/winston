# Pre-Processing v2 — Phase 2: The Reading Runbook + Deterministic Publisher

**Status:** Draft v2
**Date:** 2026-08-18
**Repos touched:** `bureau` (new `runbooks/preprocessing/` tree — the operator-run reading runbook + a deterministic publisher script), `substation` (one migration: new `site_plan_preprocessing_run` table + `preprocessing_run_id` FK columns), `inspector-general` (two new eval suites: a deterministic run-validation suite + a ground-truth reading-fidelity eval suite).
**Repos NOT touched:** `cityhall` (reads the same DB rows the sandbox writes today — identical shape, no change), `conductor` (review pipeline reads the same rows — no change), `surveyor` (sole owner of `project_facts`; preprocessing v2 no longer writes it). The Phase-3 review-gate wiring that *consumes* `preprocessing_run_id` is a separate, later spec.
**Parent:** `DESIGN-SPEC.md` (Pre-Processing v2 — Phase 1 shipped). **Amended by:** `ADDENDUM-DESIGN-SPEC.md` (four defect classes → acceptance test set + Deltas A/B). **Design source:** `preprocessing-packet/design-notes.md` §§6–9 + `preprocessing-packet/exploration-runbook-patterns.md` + `preprocessing-packet/exploration-upload-pipeline.md` (code recon, file:line verified 2026-08-13). **v1** folded in the 2026-08-18 grilling session (decisions D1–D43, open questions OQ1–OQ6). **v2** folds in the 2026-08-18 audit session (decisions D44–D47; revises D31–D33, D37, D42; OQ4 reframed).

> **Revision note (v2 — 2026-08-18 audit).** Five load-bearing corrections from an audit session (each verified against code, file:line below):
> - **D44 — `project_facts` removed entirely.** v1's JSON artifact + publisher wrote `project_facts` (the old in-sandbox "call #9" facts-refresh). Audit found `project_facts` is a **per-project** row (`UNIQUE(project_id)`, `baseline.sql:430-440`) whose **primary owner is surveyor** (`surveyor/src/upload.ts:21-65`); the per-submission-version, clear-then-apply publisher would clobber it. Call #9 is *already gated off* under the v2 flag (`plan-set.ts:312`, `priorVersion && !preProcessingV2`), so **not porting it is zero regression.** The new production review path (`bureau/runbooks/review/`) reads a *fresh surveyor* `facts.md`, not the DB row, so nothing that matters depends on preprocessing refreshing it. Preprocessing v2 is **not** a `project_facts` writer; refresh-on-resubmit is surveyor's concern, out of scope. `title_block_meta` (call #6, plan-set-scoped, single-writer) **is kept.**
> - **D45 — processed-ness flag is now a run-id FK, at `sheet_version` grain.** Reverses v1 D32/D33. `ai_processed_at TIMESTAMPTZ` on `plan_set_version`/`document_version` → **`preprocessing_run_id uuid references site_plan_preprocessing_run(id)`** on **`sheet_version`** + **`document_version`**. Fixes the subset-run lie (a 15-of-57 run must not mark the whole plan set processed) *and* records which run wrote each row — one nullable column, `IS NOT NULL` = processed. No per-sheet flag exists today (verified: only mechanical `processing_state`), so this is additive.
> - **D46 — embedding contract pinned.** v1 said "1536 floats, computed in the runbook" without provenance. Pinned to the sandbox's exact contract: **OpenAI `text-embedding-3-small`, 1536-dim, via Vercel AI Gateway, batched 50, input truncated at 30 000 chars** (`substation/src/inngest/lib/embeddings.ts:4-52`), computed by a `scripts/` helper — never model-emitted.
> - **D47 — validation moves to Inspector General as two suites; publish atomicity rule stated.** v1's validation was only the reading scorecard and implied rotting bureau `.test.ts` scripts (bureau has no test runner). Replaced by two IG suites (deterministic run-validation + ground-truth reading-fidelity), with the deterministic `short_id`/bbox check as an **independent re-derivation** (the parity oracle). OQ4 reframed: the eval isn't a greenfield harness — it's IG's first **ground-truth-recall** module (IG scores intrinsic quality today, not recall vs. an answer key). Publish atomicity: **per-entity transaction only when clearing existing analysis**; whole-swap atomicity deferred as a named pre-production hardening item.

> **What this is.** Phase 1 shipped a flag-gated *mechanical strip* (substation #206/#207/#208): when `pre-processing-v2` is on, the upload sandbox does only mechanical work (optimize → rasterize → split → similarity/overlay) and skips every reading/transcription AI call, leaving `sheet_version.summary`/`reading_guide` NULL, zero `content_block` rows, and `processing_state='processed'`. Phase 2 builds the thing that fills those rows back in: an **operator-run Claude Code reading runbook** (the SIR reader-A/reader-B/reconcile triad, ported) that reads the plan set + documents + drainage model, writes a single standalone JSON artifact, and a **dumb deterministic publisher** that upserts that artifact into the *same* DB rows the sandbox used to write. Nothing downstream changes shape.

---

## Problem

The Phase-1 strip is live but half a system: uploads now produce mechanically-processed plan sets with **no readable content** — NULL summaries, zero content blocks, no reading guides, no title-block metadata, no document inventories, no drainage-model analysis. That was deliberate (the old in-sandbox Gemini transcriptions were wrong at a rate — ~40 of 57 sheets on the 1700 S. Lamar benchmark — that made them untrustworthy as the source of any number, name, or symbol; full evidence in `preprocessing-packet/preprocessing-transcription-handoff.md`). But review needs that content, and today a flagged plan set hands review a bare workspace.

Phase 2 rebuilds the reading layer as **judgment work done in an agentic session, not a metered upload-time call.** The agreed shape (ratified by Jason; `DESIGN-SPEC.md`): mechanical work stays in the sandbox; all reading/summarizing/transcription moves to an operator-run runbook that publishes to the *same* DB fields, so the four `sheet_version` workspace builders, all of cityhall, and the review pipeline are untouched.

Two things the naive "port the SIR triad" design does **not** handle, verified against the Lamar 57-sheet re-review (`ADDENDUM-DESIGN-SPEC.md`), and which this spec designs against:

- **Delta A — normalization convergence.** Two independent "helpful" readers share the LLM prior *regularize the document*, so both silently fix `PRINCIPIAL`→`PRINCIPAL`, both drop a leading "NO", both dedupe a double-numbered list — and **agree**. The reconciler's "every disagreement is a data gap" rule catches nothing when both readers agree on the same wrong normalization. This is the single most important gap.
- **Delta B — cross-sheet semantics.** A hatch legended on sheet 13 governs fills used on 17/18/19; every single-sheet PDF carries the wrong `Title` metadata (sheet 37 reports sheet 36's title). A single-sheet reader gets false positives both directions and mis-identifies every sheet if it trusts PDF metadata.

---

## Architecture at a glance

```
  operator ──(projectId)──▶  RUNBOOK.md  (interactive Claude Code session, opus)
                                  │  infers submission version, plan-set version,
                                  │  unprocessed entities; downloads sandbox output
                                  ▼
                       reading tracks (one runbook, three tracks)
                        ├─ plan-set sheets  → reader-A / reader-B / reconcile triad
                        │                     (tiered) + Delta-A/B overlays
                        ├─ documents        → semantic type-dispatch → generic reader
                        └─ drainage model   → single non-vision LLM over parser output
                                  │
                                  ▼  one HITL stop (readout → operator "publish")
                       standalone JSON artifact  ──▶  Supabase Storage
                                  │                    (immutable, per-run)
                                  ▼
                    INSERT site_plan_preprocessing_run row
                    (submission_version_id, storage path, status='active')
                                  │
                                  ▼
       publish(site_plan_preprocessing_run.id)   ← dumb deterministic script, bureau
         download JSON → clear-then-apply upserts → stamp preprocessing_run_id
         → flip this run 'active', siblings 'inactive'
                                  │
                                  ▼
         SAME rows the sandbox wrote today: sheet_version.{summary,reading_guide,
         label,change_*,block_numbering_scheme}, content_block.*, document_*,
         plan_set_version.title_block_meta, content_block.embedding
         (NOT project_facts — surveyor-owned, per-project; D44)
                                  │
                                  ▼   (unchanged consumers)
              4 workspace builders · cityhall (~8 surfaces) · review pipeline
```

The load-bearing invariant: **the publisher writes the exact same row shape the sandbox wrote before Phase 1** (same `short_id` reading-order, same `bounding_box` normalization, same `block_numbering_scheme`, same `title_block_meta` JSON). That is what keeps every consumer unchanged (`design-notes.md` §1.3, §11).

---

## The clean seam: runbook owns everything, publisher is a dumb data-mover

The single most important boundary in this design (grilling D24–D30):

- **The runbook owns ALL logic** — every AI call, *and* every deterministic computation. That includes `short_id` reading-order assignment (y-ASC, x-ASC), `bounding_box` normalization (Gemini `[ymin,xmin,ymax,xmax]`/1000 → `{x,y,width,height}` 0-1), `block_numbering_scheme` stamping, the `UNRELATED` chain-break decision, and the block embeddings. These deterministic parity semantics port from substation into the runbook's `scripts/` — same discipline as `bureau/pipelines/review/lib/submission_db.py`, which is a field-for-field port of conductor's contract. **Port surface (v2 correction — it is scattered, not one file):** `bounding_box` + `short_id` live in `sheet.logic.ts:4-33`; **but** `block_numbering_scheme` is set at `sheet.ts:260` and the `UNRELATED` chain-break (`previous_sheet_version_id=null, change_type='added'`) at `sheet.ts:173-178`. All three modules must be ported, not just `sheet.logic.ts`.
- **Embeddings are a pinned, script-computed call (D46).** `content_block.embedding` = **OpenAI `text-embedding-3-small`, 1536-dim, routed through the Vercel AI Gateway, batched 50 blocks/call, input truncated at 30 000 chars** — the sandbox's exact contract (`substation/src/inngest/lib/embeddings.ts:4-52`). A `scripts/` helper computes and appends the vectors to the artifact; the model **never** hand-emits floats into the JSON. Any drift in model/dimension/truncation lands the vectors in a different vector space and silently degrades hybrid/semantic search in review — so this is a hard parity requirement, checked by the IG validation suite (§ Validation).
- **The runbook emits one standalone JSON artifact** carrying the *final DB intent* — values already normalized, `short_id`s already assigned, embeddings already computed, chain-break verdicts already expressed as concrete field values (`previous_sheet_version_id: null, change_type: 'added'`).
- **The publisher does zero interpretation.** `publish(runId)` = download the artifact → upsert it verbatim → stamp `preprocessing_run_id` → flip run status. No AI, no math, no ordering, no business rules. Trivially auditable.

Consequence: the parity-drift risk (bureau and substation share no code) is concentrated in *one* place — the runbook's deterministic scripts — and is covered by the eval (§ Validation). The publisher cannot drift because it computes nothing.

---

## Scope — three reading tracks in one runbook

One runbook, three tracks (D4). The operator triggers it once per submission version; it processes the plan set, its documents, and any drainage model.

### Track 1 — Plan-set sheets (the triad; where the fidelity stakes live)

Port the SIR reader triad verbatim as the starting point (`bureau/runbooks/sir/prompts/phase-1/readers/`), then add the Delta overlays. The triad (recon in `exploration-runbook-patterns.md` §§2–4):

- **Reader A — literal draftsman:** transcription/measurement only, never interprets. *"Quote, never paraphrase; say where every value came from; absent is an answer; illegible is an answer; transcribe both when a sheet contradicts itself."*
- **Reader B — meaning:** classifies, every classification cites its evidence; does not adjudicate compliance.
- **Reconciler:** sees only the two readings + renders; marks every disagreement a **data gap**, never picks a winner. Emits a gap ledger with dispositions (`disclose` / `needs-higher-dpi-read` / `needs-operator` / …).
- Readers never see each other; both write the same section skeleton; cover sheet read first and handed to every worker as shared context. Coverage confession is mandatory.

**Tiering (D17, D18, D19 — a *validated* optimization, not a hard commitment).** Two Opus reads + reconcile across 57–100 sheets is real subscription drain, so reading effort is tiered: value-bearing sheets get the full triad; pure-drawing sheets get a single literal read + coverage confession. **But we do not commit up-front to skipping the second read** — run-1 reads everything with the full triad, and we *measure* whether the drawing-only path loses any defect before trusting it at scale. A cheap first-pass classifier tags each sheet; the operator can override at the HITL stop; **ties break UP** (unsure → value-bearing, because a wasted triad costs tokens but a mis-tiered value sheet loses content). First-cut value-bearing taxonomy: cover, general notes, any table (detention/drainage/tree/landscape/utility/demand), sheet index, legends, site-plan & dimensional-control sheets, survey-control/datum block. Start simple; iterate in-run.

**Delta A overlay (A4).** Add a **verbatim / anti-normalization reader brief** — fidelity means *preserving* typos, duplicate numbering, contradictions, negations (`NO`/`NOT`/`SHALL NOT`), and placeholder patterns (`XXXX` must survive as `XXXX`) *exactly*; a "cleaned-up" value is a defect. Plus an **image-anchored spot check on a sample of *agreed* cells**, precisely because agreement is where normalization hides — structural agreement is not confidence.

**Delta B overlay (A8, D21).** **Forbid the reader from resolving a hatch to a meaning** — record the raw symbol ("hatch pattern H, unlegended on this sheet") and defer meaning to the review stage (the simpler, net-simplifying disposition; revisit only if a run shows review can't recover the symbol — OQ). And derive sheet identity from the **rendered title block, never PDF `Title` metadata** (metadata is poison — every single-sheet PDF carries the wrong title).

**Zoom mechanics.** Higher-DPI render/crop is a **costed disposition** the orchestrator approves, not a golden-path default. Port the concrete recipes (300/600-DPI `pdftoppm`, quadrant crops, `pdftoppm -x -y -W -H` fallback, stub-binary detection) from the plugin skill into the worker briefs (`exploration-runbook-patterns.md` §3).

### Track 2 — Documents (semantic type-dispatch, D5–D9)

The document track is a **dispatcher**, not a single reader:

```
for each document:
  1. identify semantic type   (trust the zip-triage tag if present; classify loose/untyped docs fresh)
  2. route to the right reader
  3. produce inventory (name/label, summary, sections) into the JSON
```

This spec implements **two** routes (D6): `generic` (read the page rasters → title/summary/sections, mirroring today's single Gemini inventory call #7) and `drainage-model` (Track 3). Semantic type reuses the existing `document.kind` enum (`document | binary | drainage-model | intake_attachment`) — **no new enum values** this spec (D9). **`comment-response` is a documented future route, not built** (D6/OQ6): it already has a working skill (`parse-crc-comment-response-pdf`) writing to its own `crc-comment-responses` bucket for a CRC-specific consumer, so it's cleanly separable. The dispatch shape is what makes it slot in later.

### Track 3 — Drainage model (single non-vision LLM, D7)

A drainage model is **not a PDF you read** — it's a bundle of engineering model files (HEC-HMS `.hms`/`.basin`, HEC-RAS `.prj`, SWMM `.inp`). Its mechanical **deterministic parser** (`parseHecHms`/`parseHecRas`/`parseSwmm`) already runs and is v2-safe today; only the LLM *analysis* (call #11) was stripped. So the runbook's drainage track is a **single non-vision LLM call** that organizes the existing parser-output text into `document_section` rows + name + summary. No triad, no rendering. Reuse the existing pattern.

### Out of scope / deferred

- **Zip triage** stays entirely in the sandbox, untouched (D11) — it's the one AI call Phase 1 kept; the runbook consumes its registered rows and never re-triages.
- **Loose (non-zip) drainage models** — today only zip triage mints a `drainage-model`; a loose `.hms` classifies as `binary`. Flagged as a known gap, deferred (D10/OQ5).
- **Phase-3 review-gate wiring** — a separate later spec (D2).
- **In-DB analysis versioning ("Version B")** — see § Swap; deferred to its own spec (D35/OQ3).
- **`project_facts` / facts-refresh (old call #9)** — **not written by preprocessing v2 at all (D44).** `project_facts` is a per-project row (`UNIQUE(project_id)`) whose primary owner is **surveyor**; the new production review path (`bureau/runbooks/review/`) reads a *fresh surveyor* `facts.md`, not this DB row (`bureau/pipelines/review/lib/submission_db.py:296` even hard-refuses it). Call #9 is already gated off under the v2 flag (`plan-set.ts:312`), so declining to port it is zero regression. **Refresh-on-resubmit is surveyor's concern** — if `facts.md` should update when a cover sheet changes, that belongs in a surveyor-triggered flow, not this runbook. (The legacy `conductor/workflows/review` path still renders `project_facts.content` → `facts.md`, but that path is being superseded by the runbook and is not a reason for preprocessing to touch the row.)

---

## Trigger & discovery (D12–D16)

- **New runbook tree:** `bureau/runbooks/preprocessing/`, mirroring `sir/` and `review/` anatomy exactly (RUNBOOK.md runner that never does phase work inline; `prompts/shared-conventions.md`; phase orchestrator prompts; worker briefs; `scripts/` for deterministic helpers; folder contract as the API). Started by pointing an interactive Claude Code session at `RUNBOOK.md` — no slash command (D12).
- **Input is just a `projectId`** (D13). The runbook infers/computes everything else: the latest submission version, its plan-set version, the unprocessed entity set, and all storage keys.
- **Discovery** of what needs processing = query `sheet_version WHERE preprocessing_run_id IS NULL` (and the `document_version` equivalent), surfaced as a kickoff step in RUNBOOK.md — no new UI (D14, grain updated per D45). Sheet grain matters: a plan set is "fully processed" iff *all* its sheets carry a `preprocessing_run_id`, so subset runs leave the still-bare sheets discoverable rather than hiding behind a plan-set-level flag.
- **Runbook consumes the existing sandbox output** already in Storage/DB (optimized.pdf, per-sheet `{n}.pdf`/`{n}.jpg`, the seeded `sheet_version` rows) — it does **not** re-render from scratch; higher-DPI crops only as a costed disposition (D15).
- **Run output** lives at `~/noetic/working/preprocessing/<jurisdiction>-<project-slug>/`, outside the repo (D16).
- **Models (D23):** Opus for readers/reconciler/orchestrator ("reading a drawing is judgment work"); Sonnet for render/crop mechanics. **Avoid Haiku (quality) and Fable (token cost).** Every spawn specifies its model explicitly — an unspecified spawn inherits Fable.
- **HITL (D22):** one operator stop, mirroring SIR's HITL1 — a per-run readout (sheet inventory one-row-per-page, declared-vs-staged page count, per-block coverage confession, gap ledger grouped by disposition), presented in chat, adversarially reviewed before it's written; **publish only on explicit operator "go".**

---

## Data model (D31–D34)

Two schema changes, both in a single substation migration (D34 — schema is substation's domain; migration ships independently of the runbook and is inert until the publisher runs, D42).

### New table — `site_plan_preprocessing_run`

A lightweight **execution registry**. It does **not** re-home analysis data — that still lives in the same `sheet_version` / `content_block` / `document_*` rows. This table tracks *which run produced the currently-live data, from what runbook, and where the source artifact lives*, so runs are swappable/restorable (§ Swap).

```sql
create table site_plan_preprocessing_run (
  id                          uuid primary key default gen_random_uuid(),
  submission_version_id       uuid not null references submission_version(id),  -- the grain (D8a)
  runbook_output_storage_path text not null,   -- the standalone JSON artifact in Storage
  runbook_ref                 text,            -- git sha / label of the runbook+prompts used
  status                      text not null default 'inactive'
                                check (status in ('active','inactive')),        -- (D8b)
  execution_metadata          jsonb,           -- flexible: processed entity ids, counts,
                                               -- tier decisions, timings, gap-ledger summary
  created_at                  timestamptz not null default now(),
  published_at                timestamptz
);
```

- **Grain = `submission_version`** (D8a): one run covers the whole "site plan" collection — plan set + documents + drainage — in one artifact. (Named `site_plan_preprocessing_run` deliberately: `plan_set` is the one large PDF; "site plan" is the collection.)
- `execution_metadata` (jsonb) carries the processed-entity detail (`plan_set_version_id`, `document_version_ids[]`, `drainage_model_version_ids[]`), counts, per-sheet tier config, timings, and a gap-ledger summary — flexible, no schema churn to add a field.
- `status` has exactly two values, `active | inactive` (D8b): the `active` run for a submission version is what's currently published into the rows.

### New columns — `preprocessing_run_id` FK (D45, revises v1 D32/D33)

`preprocessing_run_id uuid NULL references site_plan_preprocessing_run(id)` on **`sheet_version`** and **`document_version`**. Stamped by the publisher on every row it covers. This one nullable column does three jobs a bare `ai_processed_at TIMESTAMPTZ` could not:

- **Processed-ness flag** — `preprocessing_run_id IS NOT NULL` is the cheap single-field read the future Phase-3 review gate wants (not an existence-join). Same cost as a timestamp.
- **Correct grain for subset runs** — it lives at **`sheet_version`**, not `plan_set_version`. A run that processes 15 of 57 sheets stamps only those 15; the other 42 stay `NULL` and remain discoverable. A `plan_set_version`-grain flag would have *lied* — claiming the whole set processed while 42 sheets are bare — and Phase-3 would greenlight review over a mostly-empty plan set. This was the decisive reason to reverse v1.
- **Which-run provenance, kept in sync with the data** — the FK records *which* run actually wrote each row. Because the publisher is clear-then-apply, the pointer always matches whose analysis is physically in the row. The registry's `status='active'` answers "which run is live for this submission version"; the per-row FK answers the finer "which run wrote *this* sheet" — the two genuinely differ for partial/subset runs, and the per-row FK is the accurate one. ("When" is not lost: `site_plan_preprocessing_run.published_at` carries it.)

No per-sheet processed flag exists today — only mechanical `sheet_version.processing_state`/`finished_at` (verified, `baseline.sql`) — so this is purely additive. Existing consumers don't `SELECT` the new column, so the "identical row shape" invariant holds for readers; this is a deliberate, justified reversal of v1 D33's "no pointer on versioned entities."

### What is NOT added (D33, narrowed)

No contested-value schema, no gap-ledger table. Publish only **reconciled** content; the gap ledger stays a working-dir run artifact (and a summary in `execution_metadata`). *(v1 D33 also forbade any run pointer on the versioned entities; v2 D45 supersedes that — the `preprocessing_run_id` FK above is the pointer, added deliberately for subset-run correctness. The registry `status` flag remains the "which run is live for the submission version" mechanism; the FK is the finer per-row provenance.)*

---

## The runbook JSON artifact (the seam, D27)

The runbook writes one standalone JSON per run to the working dir, then uploads it to Storage; the registry row's `runbook_output_storage_path` points at it. It is the **only** thing the publisher reads (plus the binaries already in Storage). It carries *final DB intent* — everything already computed:

```jsonc
{
  "submission_version_id": "…",
  "plan_set_version_id": "…",
  "runbook_ref": "bureau@<sha>",
  "sheets": [
    {
      "sheet_version_id": "…",
      "summary": "…", "label": "…", "reading_guide": "…",
      "block_numbering_scheme": "short-id-ordered",
      "change_type": "added|modified|unchanged",
      "change_description": "…",
      "previous_sheet_version_id": null,          // UNRELATED chain-break expressed as final values (D26/P2)
      "content_blocks": [
        {
          "short_id": 3,                          // reading-order ordinal, assigned in the runbook (P1)
          "category": "…", "description": "…", "content": "…",
          "bounding_box": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.05 },  // final 0-1 shape (P6)
          "embedding": [/* 1536 floats — OpenAI text-embedding-3-small, script-computed (D46/P4) */],
          "embedding_text": "…"
        }
      ]
    }
  ],
  "plan_set_title_block_meta": { /* … */ },        // call #6, produced by the runbook (P7)
  // NOTE: no `project_facts` — call #9 retired, not ported (D44); surveyor owns that per-project row.
  "documents": [ { "document_version_id": "…", "kind": "document|drainage-model",
                   "name": "…", "summary": "…", "sections": [ /* … */ ] } ],
  "gap_ledger": [ /* run artifact; summarized into execution_metadata, NOT published to DB */ ]
}
```

---

## The publisher (D24–D30)

`bureau/runbooks/preprocessing/scripts/publish.ts` — a deterministic service-role script, mirroring the dual-view publisher pattern (bureau #1006/#1007). It lives in bureau, co-located with the runbook (D16/D24); the only substation dependency is the migration.

**Contract:** `publish(site_plan_preprocessing_run_id)` →
1. Read the run row; download its JSON artifact from `runbook_output_storage_path`.
2. **Clear-then-apply, scoped to the run's declared entity set** (D29/P9): for each entity the artifact declares, clear its existing analysis, then write exactly what the artifact carries.
   - `content_block`: **delete-then-insert per sheet, inside a transaction** (D30/P5) — same semantics as today's `saveBlockDiscoveryResults`, but adding the transaction the current non-transactional path lacks (its mid-loop-crash partial-write bug is confirmed at `substation/.../sheet.logic.ts:150-170` — a DELETE followed by a serial single-row INSERT loop with no wrapper; documented in `exploration-upload-pipeline.md` §6).
   - `sheet_version`: update `summary`, `label`, `reading_guide`, `block_numbering_scheme`, `change_type`, `change_description`, `previous_sheet_version_id` (executing the chain-break the runbook decided).
   - `plan_set_version.title_block_meta`, `content_block.embedding`/`embedding_text` — written verbatim from the artifact. **(No `project_facts` — D44.)**
   - documents/drainage: `document.name/label`, `document_version.summary`, `document_section` rows.
3. Stamp `preprocessing_run_id = <this run>` on every covered `sheet_version` + `document_version` (D45).
4. Flip this run `status='active'` and all sibling runs for the same `submission_version_id` to `inactive`.

**Transaction atomicity (D47/Q5).** The boundary scales with what's at stake:
- **Fresh publish (no prior analysis in the covered rows):** nothing to tear; iterative writes are fine, no wrapping transaction required.
- **Re-publish / swap over existing analysis:** each entity's clear-then-apply runs in a **per-entity transaction** (the per-sheet `content_block` delete-then-insert above is the load-bearing case), so a mid-publish crash can't leave a torn row that reads as complete.
- **Whole-run / whole-swap atomicity** (all-or-nothing across every entity, invisible to live `cityhall`/review readers mid-swap) is **deferred as a named pre-production hardening item** — required before Phase 3 makes review depend on this output and before it runs on non-sandbox projects. Acceptable to skip now: initial testing is against the sandbox test project, where a torn/failed publish is recoverable by re-publishing.

**Idempotent & swappable (D28/P5/P8):** publishing is a pure function of the artifact, so `publish(A)` → `publish(B)` → `publish(A)` acts as swaps with no re-run of the runbook. Because it's clear-then-apply, re-publishing A restores A's exact state. (Caveat: swap fidelity assumes runs of comparable scope — publishing a 15-sheet subset run after a 57-sheet run leaves the 42 non-covered sheets bare, which is correct: that run genuinely didn't process them, and their `preprocessing_run_id` correctly reverts to `NULL`.)

**Zero interpretation:** the publisher computes nothing — no ordering, no normalization, no AI. All of that is in the artifact.

---

## Swap, rollback & eval (D35–D37)

- **Swap (Version A, D35):** the registry + immutable per-run artifacts + the idempotent publisher give run-to-run swapping and A/B prompt comparison *without* moving analysis data out of its current rows. This is the near-term need for iterating on runbook prompts. The heavier **Version B** (in-DB analysis versioning behind a pointer, re-homing `content_block`/`sheet_version` analysis fields into per-execution rows) breaks the identical-shape invariant and touches ~15 consumers — deferred to its own spec (OQ3).
- **Rollback (D36):** there is no separate rollback machinery — **the registry is the undo stack.** A bad run is undone by `publish(previous_good_run_id)`. (Rolling back to fully-bare/no-analysis isn't a normal op; a trivial `unpublish` could be added later if ever needed — out of scope.)
- **Eval (D37):** no formal one-time "acceptance gate" (that's Will's judgment call). Day one, capture a **thin markdown eval artifact** in the runbook — the named defect-class probe sheets with their known-correct verbatim values (from the r2 defect inventory), scorable by hand or a cheap scoring agent. This is the natural partner to the swap registry: A/B two runbooks, score each. The fast-follow is **not a greenfield harness** — it's landing this scorecard as Inspector General's first ground-truth-recall eval (§ Validation, D47/OQ4).

---

## Validation & Test Suite (D38, D47)

**Where the tests live (D47).** *Not* as `.test.ts` scripts co-located in `bureau` — bureau has no test runner (only standalone, self-executed scripts that would rot). Both suites live in **Inspector General**, which is already ~80% of a general eval harness (pluggable evaluator modules, Supabase + local ingest, CLI, results tables, dashboard, Inngest hooks) and is where they'll actually be executed as part of the run/eval workflow. Two distinct suites:

**Suite 1 — Deterministic run-validation (no ground truth).** Point it at a completed preprocessing run's artifact + published rows; it asserts structural + parity correctness that has a single right answer:
- **`short_id` / bbox parity as an *independent re-derivation* (the parity oracle).** IG re-computes the expected reading order from each block's geometry (`short_id` = rank by `y ASC, then x ASC`) and the expected `bounding_box` normalization, and asserts the run's values match. Crucially IG uses its **own** clean reimplementation of the formula — *not* an import of the runbook's `scripts/` — because an independent oracle is what makes the check valid; importing the code under test would hide a bug in it. This is the guard that replaces the (rotting) bureau unit test and covers the scattered-port-surface drift risk (three modules: `sheet.logic.ts:4-33`, `sheet.ts:260`, `sheet.ts:173-178`).
- **Coverage & shape:** every declared sheet/block present; `short_id`s contiguous `1..N` per sheet; bboxes within 0-1; `block_numbering_scheme` stamped; no orphan blocks; `embedding` present and **1536-dim** (the D46 embedding-contract guard); artifact validates against a JSON schema.
- **Publisher contract:** idempotency (`publish(A)` twice = no-op), swap (`A→B→A` restores A), scoped-clear (a subset run leaves siblings bare and their `preprocessing_run_id` `NULL`). These need a test DB — IG has Supabase access, so they run here too.

**Suite 2 — Ground-truth reading-fidelity eval (the defect scorecard).** The four-defect-class scorecard below, scored by **defects caught** on plan sets where we have the r2 inventory. This is what drives runbook prompt/step iteration and A/B comparison across `site_plan_preprocessing_run` rows.

> **New IG capability (OQ4).** Suite 2 needs a primitive IG does not have yet: **recall scoring against a ground-truth answer key.** IG today scores *intrinsic* quality (is a citation real, is a finding atomic, is a verdict justified) — not "did the run reproduce this known-correct value." Building that recall-scorer inside IG (rather than a new repo) makes preprocessing v2 its **first customer** and yields the reusable ground-truth-eval primitive reviews / CC / SIR have long wanted. Prior art to borrow: `atomic-mcr`'s deterministic fence/validation scripts.

- **Acceptance scoring (D38):** the four-defect-class scorecard from `ADDENDUM-DESIGN-SPEC.md` (Suite 2 above), run against 1700 S. Lamar's named probe sheets, scored by **defects caught**, not structure passed:

  | Class | Probe sheets | Pass = |
  |---|---|---|
  | 1 — normalization | cover (`PRINCIPIAL`), 03 (note-21 "NO" inversion), 07 (`XXXX`→`0000`), 30 (uniform 10cf drift), 45 (double-12), 27 (`533.36`/`553.36`) | value preserved verbatim; contradiction/duplicate/negation survives |
  | 2 — linework-only | 08/09/18 (R.O.W. widths), 47 (landscape calcs), 03 (rotated plat notes), 06/07 (raster tables) | value present at all (text-only reader scores 0) |
  | 3 — silently missing | 06 (blocks 7/14/16), 55 (datum/benchmarks), 04/44/57 (no assembled text) | per-block coverage confessed; blank-as-finding ledgered |
  | 4 — cross-sheet | 13/09/17/18/19 (hatch), all sheets (PDF `Title`), drainage appx B/C vs sheets 23/24 | no false positive either direction; identity from title block; appendix tagged |

- **Safety — project IDs (D39):** experiment **only** on "Will's Pre-Processing V2 Test Project" — `ed9e7ec4-bdb4-4dcc-85fa-bb06ab70eaa9`. **NEVER touch** `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` (holds the ground-truth Lamar reviews; read-only). Ground truth: the r2 defect inventory (`working/review/austin-1700-s-lamar-r2/`, entries 1/37/39/40/41) + the read-only powerstation plan-set.
- **run-1 scope (D40):** subset-vs-full-set is a **runtime knob**, not a spec constraint. Recommended: run-1 over the ~15 named defect-class probe sheets first (a fast cost/latency datapoint under the full triad) before committing the full 57.

---

## Failure & rollback (D41–D42)

- A failed or low-quality run is simply **not published** (or is published then swapped back via the registry). Nothing auto-depends on runbook output yet — the Phase-3 review gate is deferred — so a bad run has no blast radius beyond the test project.
- **No cross-repo deploy ordering** beyond "the substation migration must land before the first publish." The migration is inert (adds an unused table + nullable columns) until the publisher runs. Runbook and publisher (both bureau) ship independently.

---

## Decision log

**Strategy & scope.** **D1** Build the full runbook (no throwaway spike); run-1 against Lamar is the validation. **D2** Spec covers runbook + publisher + schema, not the Phase-3 review gate. **D3** Manual/operator trigger only. **D4** One runbook, three tracks (sheets/docs/drainage). **D5** Document track = semantic type-dispatch. **D6** Implement `generic` + `drainage-model` readers only; comment-response = documented future route. **D7** Drainage reader = single non-vision LLM over the existing deterministic parser output. **D8** Type signal: trust the zip-triage tag when present, classify loose/untyped docs fresh. **D9** Reuse `document.kind`; no new enum values. **D10** Loose (non-zip) drainage models = known gap, deferred. **D11** Zip triage untouched, stays in sandbox.

**Runbook mechanics.** **D12** New `bureau/runbooks/preprocessing/` tree; no slash command. **D13** Input = just a `projectId`; runbook infers the rest. **D14** Discover work via `sheet_version.preprocessing_run_id IS NULL` (D45 grain). **D15** Consume sandbox output; no re-render (crops = costed disposition). **D16** Output in `~/noetic/working/preprocessing/…`.

**Reading engine.** **D17** Tiered reading, but NOT hard-committed against dual-read — run-1 reads everything with the triad; tiering is a validated optimization. **D18** Cheap first-pass classifier + operator override + ties-break-up. **D19** First-cut value-bearing taxonomy; iterate. **D20** Port SIR triad + Delta-A verbatim/anti-normalization brief + spot-check-on-agreed-cells; exact prompts iterate in-run. **D21** Delta-B: forbid hatch→meaning resolution (record raw symbol, defer to review); sheet identity from rendered title block, never PDF metadata. **D22** One HITL stop (SIR HITL1-style readout); publish on explicit go. **D23** Opus + Sonnet only (avoid Haiku/Fable); explicit model on every spawn.

**Publisher & data model.** **D24** Publisher = dumb deterministic data-mover in bureau. **D25** Contract = `publish(runId)` → download JSON → upsert verbatim → stamp `preprocessing_run_id` (D45) → flip status. **D26** ALL logic/AI/deterministic-compute in the runbook; parity semantics port into runbook `scripts/` from a *scattered* substation surface (bbox+short_id `sheet.logic.ts:4-33`, scheme `sheet.ts:260`, chain-break `sheet.ts:173-178`). **D27** Runbook writes one standalone JSON; publisher reads only that + Storage binaries. **D28** Publish is idempotent + swappable (A→B→A). **D29** Clear-then-apply, scoped to the run's declared entity set. **D30** `content_block` delete-then-insert per sheet, in a transaction (fixes today's non-transactional partial-write bug).

**Schema.** **D31** New `site_plan_preprocessing_run` table (grain = submission_version, status `active|inactive`, `execution_metadata` jsonb). **D32** ~~Keep `ai_processed_at` on `plan_set_version` + `document_version`~~ **— superseded by D45.** **D33** No contested-value schema, no gap-ledger table ~~, no pointer on versioned entities~~ **(the no-pointer clause is superseded by D45).** **D34** Migration in substation; publisher script in bureau.

**Swap / rollback / eval.** **D35** Version-A swap (registry + artifacts + idempotent publish); Version B (in-DB analysis versioning) = own future spec. **D36** Rollback = re-publish a prior run (registry is the undo stack). **D37** No formal acceptance gate; thin markdown eval artifact (probe sheets + expected values); automated eval = IG Suite 2 fast-follow (D47).

**Validation / safety / sequencing.** **D38** Four-defect-class scorecard on Lamar probe sheets, scored by defects caught (IG Suite 2). **D39** Experiment on `ed9e7ec4-…` only; never touch `23301a8a-…`. **D40** run-1 subset-vs-full = runtime knob (recommend subset first). **D41** Failed run simply not published; no blast radius (Phase 3 deferred). **D42** No deploy ordering beyond migration-before-first-publish. **D43** Spec = concrete contracts (table, JSON, publisher, folder) + direction-flagged reader internals (port SIR briefs, iterate prompts in-run).

**v2 audit decisions (D44–D47).** **D44** Preprocessing v2 **never writes `project_facts`** — call #9 retired, not ported; it's a per-project (`UNIQUE(project_id)`) surveyor-owned row; the new production runbook review reads fresh surveyor `facts.md` not the DB row; call #9 already gated off under the v2 flag, so zero regression; refresh-on-resubmit is surveyor's concern (out of scope). Keep `title_block_meta` (call #6). **D45** Processed-ness flag = **`preprocessing_run_id uuid references site_plan_preprocessing_run(id)` on `sheet_version` + `document_version`** (replaces the D32 `ai_processed_at` timestamp; reverses the D33 no-pointer clause). Sheet grain fixes the subset-run lie; the FK also records which run wrote each row and stays in sync with clear-then-apply; `IS NOT NULL` = processed; additive (no existing consumer selects it). **D46** Embedding contract **pinned**: OpenAI `text-embedding-3-small`, 1536-dim, Vercel AI Gateway, batch 50, 30 000-char truncation (`embeddings.ts:4-52`); `scripts/`-computed, never model-emitted. **D47** Validation = **two Inspector General suites** — (1) deterministic run-validation with `short_id`/bbox parity as an *independent re-derivation* (the oracle that replaces rotting bureau unit tests) + coverage/shape/embedding-dim/publisher-contract checks; (2) ground-truth reading-fidelity scorecard, which needs a new IG **recall-vs-answer-key** primitive (IG scores intrinsic quality today) — preprocessing is its first customer, not a greenfield repo. Publish atomicity: per-entity transaction only when clearing existing analysis; whole-swap atomicity deferred as pre-production hardening.

## Open questions

- **OQ1 (Delta A):** verbatim brief on *one* reader or *both*? Recommend both readers verbatim + a separate meaning/narrative pass that never overwrites literal cells. Run-1 decides.
- **OQ2 (tiering):** exact value-bearing classifier + thresholds — iterate in-run; run-1 (full triad) tells us whether the drawing-only single-read path is safe.
- **OQ3 (Version B):** in-DB analysis versioning behind a pointer — revisit only if artifact-level swap proves insufficient.
- **OQ4 (eval, reframed v2):** land the markdown scorecard as **Inspector General's first ground-truth-recall eval** (Suite 2), not a greenfield harness. Open sub-question: exact shape of the new IG recall-vs-answer-key primitive and how much of `atomic-mcr`'s fence/validation pattern it reuses — fast-follow after prompts iterate.
- **OQ5 (loose drainage models):** recognize a drainage model uploaded loose (not in a zip) — deferred.
- **OQ6 (comment-response route):** wire the `parse-crc-comment-response-pdf` logic in as a dispatch route — future, coupled to the CRC workflow.

---

## Scope boundaries

Phase 2 is **three repos**: a new `bureau/runbooks/preprocessing/` tree (runbook + publisher script), **one substation migration** (the registry table + `preprocessing_run_id` FK columns), and **two Inspector General eval suites** (deterministic run-validation + ground-truth reading-fidelity). It does not touch cityhall or conductor (both read the same DB rows, unchanged), does not write `project_facts` (surveyor-owned, D44), does not wire the review gate (Phase 3), does not delete the old in-sandbox AI code (Phase 4 cutover), and does not build in-DB analysis versioning (Version B), a comment-response route, or loose-drainage-model recognition — all explicitly deferred. Whole-swap publish atomicity is deferred to pre-production hardening. Merging is Will's call.
