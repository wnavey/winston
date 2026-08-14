# Pre-Processing v2 — Flag-Gated Mechanical Strip (Phase 1) + Full Plan

**Status:** Draft v1
**Date:** 2026-08-14
**Repos touched (Phase 1):** `substation` (read a flag, stamp it into the `process-file` event, branch the function to skip the AI calls)
**Repos verified, not changed (Phase 1):** `cityhall` (confirm bare-thumbnail rendering degrades gracefully)
**Repos touched (Phase 2+, deferred):** `substation` (publisher script + schema), `bureau` (reading runbook + review-gate prompt), `cityhall` (UI affordance for "not yet read")
**Companion:** `current-architecture-diagram.html` (this workspace) — the visual arch reference. Intent + evidence: `preprocessing-packet/`.

---

## Problem

Upload-time pre-processing has the Vercel Sandbox split the plan-set PDF, then has **Gemini read every sheet** — naming it, summarizing it, discovering content-block bounding boxes, and transcribing tables/notes into Postgres. Those transcriptions are wrong at a rate that makes them unusable as the source of any number, name, or symbol: **~40 of 57 sheets** on the 1700 S. Lamar benchmark carry a recorded defect (invented recorded-instrument numbers, dropped table rows, one sheet — 04 — with no transcription at all), and every defect is invisible to existing checks because structure survives while cell contents rot. The review side has already, in practice, **demoted the layer** — its conventions hold the vector PDF as authority and state "a negative reached only by searching text is not a negative." So today we pay full metered Gemini cost to produce content our own reviewers don't trust. Full evidence: `preprocessing-packet/preprocessing-transcription-handoff.md`.

**The agreed shape** (ratified by Jason; full write-up in the HTML companion, Tab 03): split pre-processing along the **mechanical / judgment** line. The sandbox keeps only mechanical work; all reading/summarizing/transcription moves to an **operator-run Claude Code runbook** that publishes to the *same* DB fields. This spec makes that split **land in two phases**, with a hard, testable, reversible first phase.

---

## Phased delivery

| Phase | What | Where | Status |
|---|---|---|---|
| **1** | **Flag-gated mechanical strip** — a `pre-processing-v2` boolean gates the `process-file` function down a mechanical-only path (no AI reading). | `substation` | **This spec — buildable now** |
| **2** | The reading runbook (two-pass reader triad) + a deterministic publisher that writes the same rows + `ai_processed_at`. | `bureau` + `substation` | Planned, deferred |
| **3** | Review-runbook **prerequisite gate** (checks `ai_processed_at`; runs the reading runbook first if missing). | `bureau` | Planned, deferred |
| **4** | **Cutover** — remove the flag, delete the old AI path and its silent-failure branches. | `substation` | Planned, deferred |

The point of Phase 1: **make the mechanical half independently shippable and testable behind a flag, and iterate on it before any skill/runbook work begins.** Nothing in Phase 1 depends on Phase 2 existing.

---

## Phase 1 — the testable slice

### 1.1 The flag

- A **Vercel boolean flag `pre-processing-v2`, default `false`.**
- **Evaluated in `substation` at event-send time**, then **stamped into the `process-file` event payload** as `preProcessingV2: boolean`. The Inngest function reads `event.data.preProcessingV2` — it does **not** re-evaluate the flag itself.
- **Why stamp it into the event, not read it inside the function:** Inngest steps are durable and retried; a run must behave identically across retries/replays. Capturing the flag once at enqueue time makes each run deterministic — flipping the flag mid-run can't produce a half-v1/half-v2 plan set. **(Decision D1.)**
- `substation` has **no existing feature-flag mechanism** (greenfield — grep for `edge-config`/`@vercel/flags` in `src` returns nothing). Recommended primitive: **Vercel Edge Config** boolean, read via a small shared helper `isPreProcessingV2Enabled()`, so it's togglable in the dashboard with no redeploy. **(Open Q1.)**

**Send sites that must stamp the flag** (all call `inngest.send({ name: 'process-file', … })`):
- `substation/src/routes/submissions.ts:787` (plan_set), `:841` (zip), `:906` (document)
- `substation/src/routes/plan-sets.ts:242` (replace), `:292` (reprocess)
- `substation/src/routes/documents.ts:197`, `:245` (reprocess)

Event type gains one field: `substation/src/inngest/functions/index.ts:18` (`process-file.data`) → add `preProcessingV2?: boolean`.

### 1.2 What the flag changes inside `process-file`

`preProcessingV2 === false` → **byte-for-byte current behavior** (the safety property — the existing golden sandbox test must still pass unchanged).

`preProcessingV2 === true` → **mechanical-only.** Keep everything mechanical; skip every reading/transcription AI call.

| # | Call (from the strip list) | Site | v2 |
|---|---|---|---|
| 1 | Sheet naming + page summary | `sheet.ts` (child fn) | **omit** |
| 2 | Block discovery / bounding boxes | `sheet.ts` | **omit** |
| 3 | Block transcription (batched) | `sheet.ts` | **omit** |
| 4 | Reading guide | `sheet.ts` | **omit** |
| 5 | Sheet-comparison change narrative (incl. `UNRELATED`) | `sheet.ts` | **omit** (mechanical similarity/matching stays) |
| 6 | Plan-set title-block metadata | `plan-set.ts:234` | **omit** |
| 7 | Document inventory | `document.ts:108` | **omit** |
| 8 | **Zip content triage** (text-only) | `zip.ts:70` | **KEEP** — Jason's call; the one retained AI call |
| 9 | Project-facts refresh (Haiku) | `plan-set.ts:281` | **omit** |
| 10 | Block embeddings (OpenAI) | `sheet.ts:315` | **omit** (moves with transcription) |
| 11 | Drainage-model analysis | `process-drainage-model` | **omit** |

**What stays mechanical (unchanged) when v2:** optimize (Ghostscript) → rasterize (Poppler, 150 dpi — the page-count source) → split per-sheet PDFs → upload `optimized.pdf` + `sheets/{n}.pdf`·`.jpg` → prior-version download + per-sheet **similarity/matching/overlay** (v2+) → sheet manifest (`createSheetManifestV1`/`V2`, incl. carry-forward). So `change_type`/`similarity_score`/thumbnails/comparison images still populate — only the AI *narrative* defers.

**Recommended structural branch (Decision D2):** when `preProcessingV2`, **do not invoke the `process-file/sheet` child function at all** — the fan-out at `plan-set.ts:195-215` is skipped. The child does nothing mechanical the manifest step hasn't already done (its steps are set-processing → fetch → summary/comparison/blocks/reading-guide/embed → complete; all but set/fetch/complete are AI). Instead the **parent marks the seeded `sheet_version` rows `processing_state = 'processed'`** after the manifest step, and completes the `plan_set_version` as today. This cleanly maps to "step 14 (the AI fan-out) is removed."

**Decision D3 — scope of the strip:** the same flag gates the document and drainage-model AI too (calls 7, 11), not just plan-set sheets — leaving supplementary docs on Gemini while plan sets are stripped would be incoherent, and the Phase 2 runbook is meant to read both. **Zip triage (8) stays.** Validation still focuses on plan_set (below).

### 1.3 Interim state semantics (no schema change in Phase 1)

- **No migration in Phase 1.** A v2 run leaves `sheet_version.summary`/`reading_guide` NULL, **zero `content_block` rows**, `title_block_meta` NULL — and sets `processing_state = 'processed'`.
- That means `processing_state = 'processed'` now means *mechanically* done for v2 rows, which is **ambiguous** vs. a fully-AI'd v1 row. **Accepted for Phase 1** — during flag testing you know which is which by environment/flag, and no gate consumes it yet. The disambiguator (`ai_processed_at`) and the review gate arrive in **Phase 2**. **(Decision D4; revisit under Open Q4.)**

### 1.4 Recommended mechanical hardening (separable, Open Q3)

The strip is the natural moment to add a **loud page-count check** — assert the PDF's declared page count (`pdfinfo`) equals the rendered `.jpg` count; **fail visibly** instead of silently truncating the sheet set (today the count is *derived* from however many images `pdftoppm` produced). Recommended in Phase 1 but **separable** — it should not block the core flag test.

### 1.5 What Phase 1 deliberately does NOT do

- **No deletion of the old AI code or its silent-failure branches.** They stay live behind `flag=false`. Deleting them (and removing the flag) is **Phase 4 / cutover**. This keeps Phase 1 purely additive and instantly reversible (flip the flag off).
- No schema change, no runbook, no publisher, no review-gate change.

### 1.6 Acceptance / how we iterate on it

Flip `pre-processing-v2` on in a preview/staging environment and upload the benchmark plan set. Assert:

1. All sheets split; `sheets/{n}.pdf` + `.jpg` thumbnails present; page count matches the PDF.
2. **Zero `content_block` rows;** `summary`/`reading_guide`/`title_block_meta` NULL; `plan_set_version` reaches `processed`.
3. Runs in the mechanical-only ballpark (~95 s, **zero AI tokens** on the plan-set path; only zip triage may call the model, and only for zips).
4. **cityhall renders the bare thumbnails without errors** — sheet grid, sheet detail, submission status all tolerate NULL summary / empty blocks. (This is the one cross-repo thing to verify; likely no code change, but confirm.)
5. **Flag off → behavior is byte-for-byte unchanged** (golden sandbox test green).
6. Capture the **cost + latency delta** vs. the current path — this is the number that ratifies the strip and feeds the Phase-2 spike budget.

### 1.7 Code touch points (Phase 1, `substation`)

- `src/routes/submissions.ts`, `plan-sets.ts`, `documents.ts` — evaluate the flag (shared helper) and add `preProcessingV2` to each `process-file` send.
- `src/inngest/functions/index.ts` — add `preProcessingV2?: boolean` to the `process-file` event type.
- `src/inngest/functions/process-file/plan-set.ts` — skip the child fan-out (`:195-215`), the title-block call (`:234`), the facts refresh (`:281`); mark seeded `sheet_version`s processed.
- `src/inngest/functions/process-file/document.ts` — skip inventory (`:108`); `process-drainage-model` — skip analysis.
- `src/inngest/functions/process-file/zip.ts` — **unchanged** (triage stays).
- (Recommended) the page-count assertion in the sandbox rasterize/split path.

---

## Phase 2+ — the plan for everything else (deferred; captured here so the whole shape is on record)

Full detail lives in the HTML companion **Tab 03** and `preprocessing-packet/design-notes.md`; summary:

- **The reading runbook** — an operator-run Claude Code session (like the review/SIR runbooks), Opus orchestrator. Reads the cover sheet first and hands it to every sheet worker as shared context. Each value-bearing sheet gets the **two-pass reader triad** stolen from the SIR runbook: **reader A (literal draftsman)** transcribes only, **reader B (meaning)** interprets only, they never share context, and a **reconciler** treats every disagreement as a data gap (never picks a winner) with a mandatory coverage confession. Zoom is a costed disposition; cross-sheet exploration is available when stuck, not on the golden path. Escalates to the operator on genuine anomalies (corrupt PDF, a resubmittal missing sheets the prior version had). **Tiering** (dual-read every sheet vs. two-pass only value-bearing sheets + single-read pure drawings) is **decided by a one-day spike** scored against the benchmark's known-bad sheets.
- **The publisher** — a **deterministic service-role script** (not agent freehand) that writes the *same rows the sandbox writes today* — same `short_id` reading order, `block_numbering_scheme`, bbox normalization — plus embeddings, and stamps the new timestamp. Mirrors the dual-view publisher pattern.
- **Schema (the only addition):** `ai_processed_at TIMESTAMPTZ` (nullable) on `plan_set_version` and `document_version`, stamped by the publisher. Gives the review gate one unambiguous field instead of inferring "processed?" from whether summaries happen to be NULL. Publish only **reconciled** content; the reconciler's gap ledger stays a run artifact — **no contested-value schema.**
- **The review gate (dumb, prompt-level):** review kickoff checks `ai_processed_at`; if missing, the same operator session runs the reading runbook to completion first, then proceeds. No orchestration machinery.
- **Cutover:** once the runbook is trusted, remove the flag, delete the old in-sandbox AI path and its swallow branches.

---

## State-tracking decision (from the 2026-08-14 design discussion)

The two-step split is tracked by **two orthogonal fields**, not one linear enum:

- `processing_state` — **mechanical** freshness (existing; set by the sandbox).
- `ai_processed_at` — **AI/reading** freshness (Phase 2; nullable timestamp, set by the publisher).

They're separate because the axes are genuinely orthogonal: the mechanical step can be re-run *after* reading is published (e.g. to fix a garbled PDF), making "mechanically re-done but not yet re-read" a real state a single ordered enum can't express without lying.

**A dedicated `doc_processed_state` satellite entity was considered and rejected for now:**
1. Referencing *either* `plan_set_version` *or* `document_version` is a **polymorphic FK** — no real referential integrity (a `(type,id)` pair) or two nullable FKs + a CHECK; the polymorphism is the cost.
2. It **breaks the proposal's core win** — `processing_state` is read *inline* on the version row by the four `sheet_version` workspace builders, the UI status cards, and the review gate; a satellite forces a join into every one of those.
3. Both things it would hold **already have homes** — current state belongs inline (matching existing `started_at`/`finished_at`/`applied_at`/`error_message`), and elaborate history/diagnostics already live in **`processing_event`** (already keyed with nullable FKs to `submission_version`/`plan_set_version`/`document_version`/`sheet_version`).

**Revisit after Phase 1** only if we decide we want a rich *live* reading lifecycle (per-sheet progress, resumable reads, structured failure states) that inline-state + `processing_event` can't serve. **(Decision D5 / Open Q5.)**

---

## Open questions

- **Q1 — flag mechanism.** Vercel Edge Config boolean (recommended: runtime-togglable, no redeploy) vs. Vercel Flags SDK (targeting, more ceremony) vs. plain env var (needs redeploy). Evaluated in substation via a shared helper.
- **Q2 — strip scope in Phase 1.** Gate documents + drainage under the same flag now (recommended, D3), or plan_set-only first to shrink blast radius?
- **Q3 — page-count check.** Land in Phase 1 as mechanical hardening, or as an immediate fast-follow?
- **Q4 — interim `processing_state`.** Is reusing `'processed'` for mechanical-only acceptable during flag testing (recommended), or add a distinct `mechanical` value now so the two phases are legible before Phase 2?
- **Q5 — richer state entity.** What Phase-1 finding (if any) would justify revisiting the satellite `doc_processed_state` table?

---

## Scope boundaries

Phase 1 is **`substation`-only** (plus a cityhall verification pass). No runbook, no publisher, no schema migration, no deletions, no cityhall code change expected. The flag defaults **off**, so merging Phase 1 is inert in production until someone flips it in a test environment. Merging is Will's call — this PR opens the spec; it does not build anything.
