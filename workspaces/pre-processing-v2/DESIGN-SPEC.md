# Pre-Processing v2 — Flag-Gated Mechanical Strip (Phase 1) + Full Plan

**Status:** Draft v2
**Date:** 2026-08-17
**Repos touched (Phase 1):** `substation` (read a flag, stamp it into the `process-file` event, branch the function to skip the AI calls; add failure logging to BetterStack)
**Repos verified (Phase 1):** `cityhall` — bare-thumbnail rendering already degrades gracefully; **no change required** (confirmed below)
**Repos touched (Phase 2+, deferred):** `substation` (publisher script + schema), `bureau` (reading runbook + review-gate prompt), `cityhall` ("not yet AI-processed" affordance, keyed on the new timestamp)
**Companion:** `current-architecture-diagram.html` (this workspace). Intent + evidence: `preprocessing-packet/`.

> **Revision note (v2 — folds in the 2026-08-17 grilling, Q1–Q22 + O1).**
> - **Flag (Q1, Q3, Q5):** a **single global boolean** `pre-processing-v2` via **Vercel Edge Config**, evaluated **once per request** in substation. Simplicity over targeting — low traffic; prod exposure is controlled by testing against a **separated test project** (Q2), not by scoping the flag.
> - **Scope (Q7, Q9):** the flag strips **all** reading AI — plan-set sheets, title-block, facts, document inventory, **and the separate `process-drainage-model` function** — keeping only zip triage.
> - **Zip children (Q6):** the flag **must propagate** into the `process-file`/`process-drainage-model` events that `zip.ts` fires for extracted items (`zip.ts:136/217/261/366`), or zip-borne plan sets escape the strip.
> - **Structural branch (Q10, Q14):** when flagged, **don't invoke `process-file/sheet` at all**; the parent marks the seeded `sheet_version` rows `processed`.
> - **Reprocess (Q12):** content-preservation on reprocess is **safe by construction** — the only content-mutating code is the skipped child fn — so **no guard is built**.
> - **NEW — Observability (O1):** the `process-file` pipeline is today **blind to failures in BetterStack** (30-day evidence below). Phase 1 adds structured failure logging so it's queryable. Companion PR.
> - **cityhall (Q18, Q20):** verified it tolerates NULL summary / zero blocks and empty search — **no Phase-1 change**. The "not yet AI-processed" banner is **deferred to Phase 2** (needs `ai_processed_at`).
> - Interim `processing_state` reuses `'processed'` (Q13); page-count check is a **fast-follow** (Q3/Q15); flip-off mid-flight lets in-flight runs finish (Q17); deploy order unconstrained (Q22).

---

## Problem

Upload-time pre-processing has the Vercel Sandbox split the plan-set PDF, then has **Gemini read every sheet** — naming it, summarizing it, discovering content-block bounding boxes, and transcribing tables/notes into Postgres. Those transcriptions are wrong at a rate that makes them unusable as the source of any number, name, or symbol: **~40 of 57 sheets** on the 1700 S. Lamar benchmark carry a recorded defect (invented recorded-instrument numbers, dropped table rows, one sheet — 04 — with no transcription at all), and every defect is invisible to existing checks because structure survives while cell contents rot. The review side has already, in practice, **demoted the layer**. So today we pay full metered Gemini cost to produce content our own reviewers don't trust. Full evidence: `preprocessing-packet/preprocessing-transcription-handoff.md`.

**The agreed shape** (ratified by Jason; full write-up in the HTML companion, Tab 03): split pre-processing along the **mechanical / judgment** line. The sandbox keeps only mechanical work; all reading/summarizing/transcription moves to an **operator-run Claude Code runbook** that publishes to the *same* DB fields. This spec lands that split in **phases**, with a hard, testable, reversible first phase.

---

## Phased delivery

| Phase | What | Where | Status |
|---|---|---|---|
| **1** | **Flag-gated mechanical strip** + **failure observability (O1)** — a `pre-processing-v2` boolean gates `process-file` down a mechanical-only path; failures become queryable in BetterStack. | `substation` | **This spec — buildable now** |
| **2** | Reading runbook (two-pass reader triad) + deterministic publisher writing the same rows + `ai_processed_at`. cityhall "not yet AI-processed" affordance. | `bureau` + `substation` + `cityhall` | Planned, deferred |
| **3** | Review-runbook **prerequisite gate** (checks `ai_processed_at`; runs the reading runbook first if missing). | `bureau` | Planned, deferred |
| **4** | **Cutover** — remove the flag, delete the old AI path + its silent-failure branches. | `substation` | Planned, deferred |

Phase 1 is independently shippable, testable, and reversible, and doesn't depend on Phase 2 existing.

---

## Phase 1 — the testable slice

### 1.1 The flag

- A **single global boolean `pre-processing-v2`, default `false`,** via **Vercel Edge Config** (runtime-togglable, no redeploy). No targeting/percentage — traffic is low and simplicity wins. **(D1)**
- **Evaluated in `substation`, once per request,** via a shared helper `isPreProcessingV2Enabled()`, then **stamped into the `process-file` event payload** as `preProcessingV2: boolean`. The Inngest function reads `event.data.preProcessingV2`; it never re-evaluates the flag. **(D2, D3)**
- **Why stamp it into the event:** Inngest steps are durable and retried; capturing the flag once at enqueue time makes each run deterministic across retries/replays and guarantees a zip + all its extracted children share one decision. A mid-run flip can't create a half-v1/half-v2 plan set. **(D2)**
- **Prod exposure is controlled by the *test target*, not the flag:** validation runs against a **fully separated test project**, so a global flag is safe to flip in prod without polluting real customer data. **(D4)**

**Send sites that must stamp the flag:**
- `submissions.ts:787` (plan_set), `:841` (zip), `:906` (document); `plan-sets.ts:242` (replace), `:292` (reprocess); `documents.ts:197`, `:245` (reprocess).
- **Zip-extracted children (D5):** `zip.ts:136` fires `childEvents` built at `:217`/`:261` (`process-file`) and `:366` (`process-drainage-model`). The flag **must be propagated** into every one — otherwise a plan set arriving *inside a zip* is still fully AI'd. Since `zip.ts` runs inside the parent `process-file`, it reads `event.data.preProcessingV2` and forwards it.

Event types gain one field each: `process-file` and `process-drainage-model` in `inngest/functions/index.ts` → add `preProcessingV2?: boolean`.

### 1.2 What the flag changes inside the functions

`preProcessingV2 === false` → **byte-for-byte current behavior** (the existing golden sandbox test must stay green).

`preProcessingV2 === true` → **mechanical-only.** Keep everything mechanical; skip every reading/transcription AI call.

| # | Call | Site | v2 |
|---|---|---|---|
| 1–4 | Sheet naming/summary, block discovery, transcription, reading guide | `sheet.ts` (child fn) | **omit** |
| 5 | Sheet-comparison change narrative (incl. `UNRELATED`) | `sheet.ts` | **omit** (mechanical similarity/matching stays) |
| 6 | Plan-set title-block metadata | `plan-set.ts:234` | **omit** |
| 7 | Document inventory | `document.ts:108` | **omit** |
| 8 | **Zip content triage** (text-only, file listing) | `zip.ts:70` | **KEEP** — the one retained AI call |
| 9 | Project-facts refresh (Haiku) | `plan-set.ts:281` | **omit** |
| 10 | Block embeddings (OpenAI) | `sheet.ts:315` | **omit** |
| 11 | Drainage-model analysis | `process-drainage-model` fn | **omit** (short-circuit the analysis step) **(D6)** |

**What stays mechanical, unchanged, when v2:** optimize → rasterize (150 dpi) → split → upload `optimized.pdf` + `sheets/{n}.pdf`·`.jpg` → prior-version download + similarity/matching/overlay → sheet manifest (V1/V2, incl. carry-forward). So `change_type`/`similarity_score`/thumbnails still populate — only the AI *narrative* defers.

**Structural branch (D7 — was D2 in v1):** when flagged, **do not invoke `process-file/sheet`** — skip the fan-out at `plan-set.ts:195-215`. The child does nothing mechanical the manifest hasn't already done. **The parent marks the seeded `sheet_version` rows `processing_state='processed'`** in the manifest-completion step (the child used to own that flip). **(D8)** Cleanly maps to "the AI fan-out step is removed."

**Scope (D9):** the same flag strips document + drainage AI (calls 7, 11), not just plan-set sheets — coherence, and the Phase-2 runbook reads both. **Zip triage (8) stays** and is the *only* AI that runs when flagged; everything it routes to is then stripped.

### 1.3 Observability (O1) — make failures queryable in BetterStack

**Finding (30-day BetterStack evidence, source `substation`):** the drain captures Inngest function invocations, but the pre-processing pipeline has logged **zero errors and zero warnings** — `process-file` and `process-file/sheet` emit info-level invocation lines only. By contrast `workflow-run` logged **144 errors** in the same window, because it emits structured error logs and pre-processing doesn't: `onFailure` (`main.ts:45-77`) updates DB state and returns *silently*, and every `logProcessingEvent(…, 'error'|'warning', …)` goes to the **`processing_event` Postgres table only** — never console, never drained, never alerted, never rendered in cityhall. So a failed pre-processing run is invisible where the team's alerting lives.

**Change:** in `onFailure` and at every `error`/`warning` `processing_event` emission, **also emit a single-line structured `console.error`/`console.warn`** — e.g. `{ evt:'preprocess', fn, step, severity, planSetVersionId, submissionVersionId, msg }`. The existing Vercel→BetterStack drain then picks it up automatically (proven by `workflow-run`). **Queryable is the bar — no alerts required (Will's call).**

**Scope:** independent of the flag and fixes the *current* pipeline too → its **own companion PR** in the Phase 1 workstream (alongside the page-count check), not bundled into the flag PR.

### 1.4 Interim state semantics (no schema change in Phase 1)

- **No migration in Phase 1.** A v2 run leaves `sheet_version.summary`/`reading_guide` NULL, **zero `content_block` rows**, `title_block_meta` NULL, and sets `processing_state='processed'`.
- `'processed'` now means *mechanically* done for v2 rows — ambiguous vs. a fully-AI'd v1 row, but **accepted** (test-project-only; nothing gates on it yet). The disambiguator `ai_processed_at` and the review gate arrive in **Phase 2**. **(D10; reuse `'processed'` — Q13.)**

### 1.5 Mechanical hardening — page-count check (fast-follow, D11)

Assert the PDF's declared page count (`pdfinfo`) equals the rendered `.jpg` count and **fail loudly** instead of silently truncating the sheet set. `plan_set_version` has **no `error_message` column**, so the failure sets `processing_state='failed'` + writes a `processing_event(error)` **and** (via O1) a structured stdout line — the reason is queryable in BetterStack even though it isn't surfaced in the UI. Ships as a **separate fast-follow PR**, not in the flag PR.

### 1.6 Edge cases & rollback

- **Reprocess (D12):** the `/process` endpoint (`plan-sets.ts:266`) reuses the **latest** `plan_set_version` (does **not** create a new version) to unstick stuck/failed rows. Reprocessing an already-populated plan set with the flag on is **safe by construction** — the only code that deletes/rewrites `content_block`s is `saveBlockDiscoveryResults`, which lives in the **skipped** child fn; the mechanical manifest re-run branch only reads existing rows. **No guard built.**
- **Carry-forward (D13):** on a *resubmittal* (v2+), unchanged sheets inherit prior AI content via the manifest (`plan-set.logic.ts:141-142/195`). **Kept** — long-term you want unchanged sheets to retain published content. Consequence: a flagged run is only *uniformly* bare on a **first upload**, so validate against v1 uploads.
- **Flip-off mid-flight (D14):** in-flight runs already carry `preProcessingV2=true` in their event and **finish bare**; re-run to get AI. Mid-flight flips are an edge case we don't respect.

### 1.7 Consumers verified (Q18, Q20 — no Phase-1 cityhall change)

- **Sheet detail page** guards rendering: `{#if data.sheetVersion.summary}` (`…/sheet/[sheetNum]/+page.svelte:229`) and `{#if sidebarMode==='blocks' && data.blocks.length > 0}` (`:357`). NULL summary / zero blocks render cleanly; the page already has a `processing`/`pending` state + Re-process button.
- **Semantic search** returns empty, not error: `semantic-search.ts:128-160` does `(data ?? [])` on zero rows.
- The **"not yet AI-processed" banner** is **deferred to Phase 2**, keyed on `ai_processed_at IS NULL` — a Phase-1 heuristic (`summary IS NULL`) is the fragile inference the column exists to replace.

### 1.8 Testing (D15) & sequencing (D16)

- **Flag-off:** existing golden sandbox test stays green (byte-for-byte).
- **Flag-on:** a new test asserting **no `generateObject`/`generateText` fires on the plan-set path** and **zero `content_block` rows** are written; sheets split + thumbnails present; version reaches `processed`.
- **End-to-end:** upload the benchmark to the separated test project with the flag on; confirm bare output, ~95 s / ~zero AI tokens on the plan-set path, cityhall renders bare thumbnails without error, and **capture the cost + latency delta** (feeds the Phase-2 spike budget).
- **Deploy order:** none. Substation-only, optional event field, no migration, flag default off → deploy anytime, inert until flipped.

### 1.9 What Phase 1 does NOT do

No deletion of the old AI code or its silent-failure branches (they stay live behind `flag=false`; removal is Phase 4). No schema change, no runbook, no publisher, no review-gate change.

---

## Phase 2+ — the plan for everything else (deferred)

Full detail: HTML companion **Tab 03** + `preprocessing-packet/design-notes.md`. Summary:

- **Reading runbook** — operator-run Claude Code session, Opus orchestrator. Cover sheet read first and handed to every sheet worker. Value-bearing sheets get the **two-pass reader triad** (literal-draftsman / meaning, never sharing context; a reconciler treats every disagreement as a data gap). Zoom is a costed disposition; cross-sheet exploration is off the golden path. Escalates to the operator on anomalies. **Tiering** (dual-read all vs. two-pass only value-bearing) decided by a **one-day spike** scored on the benchmark's known-bad sheets.
- **Publisher** — a **deterministic service-role script** writing the same rows the sandbox writes today (same `short_id`, `block_numbering_scheme`, bbox normalization) + embeddings, and stamping `ai_processed_at`.
- **Schema (the only addition):** `ai_processed_at TIMESTAMPTZ` (nullable) on `plan_set_version` + `document_version`. Publish only **reconciled** content; the gap ledger stays a run artifact — no contested-value schema.
- **Review gate (dumb, prompt-level):** review kickoff checks `ai_processed_at`; if missing, runs the reading runbook first.
- **cityhall:** the "not yet AI-processed" banner keyed on `ai_processed_at IS NULL`.
- **Cutover:** remove the flag, delete the old in-sandbox AI path + swallow branches.

---

## State-tracking decision (from the 2026-08-14 discussion)

Tracked by **two orthogonal fields**, not one linear enum: `processing_state` (mechanical freshness) + `ai_processed_at` (AI freshness). Separate because the mechanical step can be re-run *after* reading is published — "mechanically re-done but not yet re-read" is a real state a single ordered enum can't express.

A dedicated **`doc_processed_state` satellite entity was considered and rejected** for now: (1) referencing *either* `plan_set_version` *or* `document_version` is a **polymorphic FK** (no real referential integrity); (2) it **breaks the inline-read shape** the four workspace builders + UI + review gate rely on; (3) both things it would hold already have homes — current state inline (matching `started_at`/`finished_at`/`applied_at`/`error_message`), elaborate history in **`processing_event`** (already keyed with nullable FKs to all four entities). **Revisit after Phase 1** only if a rich *live* reading lifecycle is needed. **(D17)**

---

## Decision log

- **D1** Flag = single global boolean, default false. **D2** Evaluated in substation, stamped into the event (Inngest determinism). **D3** Vercel Edge Config. **D4** Prod exposure controlled by a separated test project. **D5** Flag propagates into zip-extracted child events. **D6** Also short-circuits `process-drainage-model`. **D7** Skip invoking `process-file/sheet` when flagged. **D8** Parent marks `sheet_version` processed. **D9** Strip scope = all reading AI (docs + drainage), keep zip triage. **D10** Reuse `'processed'` in Phase 1 (no migration). **D11** Page-count check = fast-follow PR. **D12** No reprocess guard (safe by construction). **D13** Keep carry-forward; test on v1 uploads. **D14** Mid-flight flip: in-flight runs finish bare. **D15** Add flag-on "no-AI-fired + zero-blocks" test; golden stays green. **D16** No deploy-order constraint. **D17** Two-field state model; satellite table rejected. **O1** Structured failure logging → BetterStack (queryable, no alerts).

## Open questions

*(Q1–Q5 from v1 are resolved above.)* None outstanding. Phase-2 spike will set tiering + per-package cost.

---

## Scope boundaries

Phase 1 is **`substation`-only** (flag branching + O1 failure logging), plus a **fast-follow** page-count PR — three small PRs, none touching cityhall, bureau, conductor, or the schema. The flag defaults **off**, so merging Phase 1 is inert in production until flipped against the test project. Merging is Will's call.
