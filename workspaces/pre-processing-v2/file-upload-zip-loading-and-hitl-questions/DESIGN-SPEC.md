# File-Upload Jobs — Streamed Loading UX + HITL "Version / Replace / Separate / Discard" Questions

**Status:** Draft v1
**Date:** 2026-08-24
**Repos touched:** `substation` (new `file_upload_job` + `file_upload_decision` tables; write job/decision rows through the upload → classify → process → zip-fan-out pipeline; a similarity-detection step; a decision-resolve endpoint), `cityhall` (subscribe to jobs/decisions over Supabase Realtime; render a per-job/zip-tree loading surface; render decisions via a `question_type → component` registry; optional byte-% upload bar)
**Repos NOT touched:** `conductor` (not on the upload/triage path), `bureau`, `radar`, `navalbase`
**Parent:** `../DESIGN-SPEC.md` (Pre-Processing v2)
**Supersedes / absorbs:** `../new-features/clarifying-questions/DESIGN-SPEC.md` — that spec's async **Context 2** (`preprocessing_question` table + Inngest `waitForEvent`) is generalized here into the durable `file_upload_job` / `file_upload_decision` model. Its `kind` enum becomes `question_type`; its safe-default/timeout principle is retained. See [§10](#10-relationship-to-the-clarifying-questions-spec).

> **Why this exists.** Two problems observed on a single real upload (below) share one missing primitive — a **first-class, streamable record of "a file is being ingested"**:
> 1. **Minutes of apparent nothing** while a large file uploads and triages, because no status row exists until deep in the pipeline.
> 2. **Silent duplication** — an uploaded file that is really a new version of an existing file is registered as a brand-new, unrelated document, with no chance for the user to say "this is v2 of that."
>
> This spec introduces a `file_upload_job` entity (streamed via Supabase Realtime) as the spine for the loading UX, and a `file_upload_decision` entity as a typed, human-in-the-loop question surface — with the first question type being "this file looks like an existing one: **version it / replace it / keep separate / discard**."

---

## Problem

### The trace that motivated this (verified prod data, app project `mgxqsrjutswbciyrltwd`)

On **2026-08-24**, a 123 MB zip (`TestProjFromLamarCollier-v2-files.zip`, `129,225,659` bytes) was dropped on submission `1eb513c1-…` version **v2** (`submission_version` `90aa50f0-…`, status `draft`; v1 = `d1ddc5bd-…`, `review_complete`). Reconstructed from the `process-file` Inngest events and DB rows:

```
16:0x     user drops zip → browser PUT of 123 MB to storage      ← silent window #1 (minutes, no row)
16:05:07  commit-upload → process-file(zip) dispatched            ← first evidence anywhere
16:05→07  zip triage in Vercel Sandbox (download, LLM classify)   ← silent window #2 (~2 min)
16:07:05  fan-out: 5 document children + 1 plan_set child
16:07:06→ plan_set (118 MB) processing…                           ← silent window #3 (minutes)
16:08:19  all 5 documents processed
```

Two distinct failures of experience:

1. **Loading opacity.** Nothing server-side exists to observe until `commit-upload` runs (`submissions.ts` prepare-upload `520-577` creates only an `upload_token`; the first `document_version`/`plan_set_version` rows appear at `commit-upload` `580-751`). So the entire upload + triage stretch (windows #1–#2) is invisible, and even window #3 shows only an indeterminate spinner. The user reported "it processed for a second, then nothing" and assumed the upload failed.

2. **Silent net-new duplication.** The zip's 5 documents were registered as **brand-new `document` rows** (new `document_id`s, each at v1), *alongside* v1's 12 carried-forward documents — producing content duplicates on v2:

   | v1 carried-forward document | zip's net-new document |
   |---|---|
   | "Site Plan Application — Formal Submittal" | "Formal Site Plan Application" |
   | "Consolidated Site Plan Application — CC Submittal" | "CC Site Plan Application" |
   | "Project Review Form (PRF)" | "Project Review Form" |
   | "Engineer's Summary Letter" | "Engineer Summary Letter" |

   The user had no opportunity to say "the new Formal Site Plan Application is a revision of the old one." (The plan set, by contrast, auto-replaced to one — see below — so the two asset classes already behave inconsistently.)

### Why the code can't do better today (grounded in `substation` / `cityhall`)

- **No upload-progress is observable server-side, and the client can't report it either.** Both upload paths use `fetch(url, { method:'PUT', body: file })` — cityhall submission page `+page.svelte:329-342` and intake `src/lib/intake/upload.ts:62-66`. `fetch` emits **no upload-progress events**; only `XMLHttpRequest.upload.onprogress` does. The UI models upload as a coarse enum (`UploadStatus = 'preparing'|'uploading'|'committing'|'done'|'error'`, `+page.svelte:246-253`) rendered as a single indeterminate spinner (`682-721`).
- **Status is DB-state + Supabase Realtime, not a stream.** `document_version` / `plan_set_version` carry `processing_state` (`pending → processing → processed | failed | cancelled`, no CHECK constraint — "application enforces"). substation writes those rows; the realtime publication `supabase/migrations/20260427230000_add_realtime_tables.sql` publishes `document_version`, `plan_set_version`, `sheet_version`, `project_facts`; cityhall subscribes (submission `+page.svelte:436-481`) and just calls `invalidateAll()`. **There is no Inngest `publish()`/`@inngest/realtime` anywhere in substation** — any "pause and ask" must be modeled as **DB row state**, not a socket.
- **Documents always append; there is zero version/dup detection.** Every ingest path mints a fresh `document` + v1 `document_version`: direct `handleDocumentUpload` (`submissions.ts:932-998`) and zip child `registerAsDocument` (`zip.ts:366-426`). **No content hash exists on any pipeline table** (`document`, `document_version`, `plan_set`, `plan_set_version`, `upload_token` — confirmed by schema grep; the only `content_hash` columns are on unrelated Bureau tables). Identity is only `document_id` / `plan_set_id`.
- **The only "new version under an existing entity" logic is explicit and caller-driven** — `POST /documents/:documentId/replace` (`documents.ts:68-218`; inserts a new `document_version` under the same `document_id` at `174-186`). The client already names the `document_id`; nothing detects the match.
- **Plan sets already converge to one** via `replaceExistingPlanSet` (`src/lib/plan-set-collision.ts:28-78`) + a canonical single-slot key (`storage-keys.ts` `planSetSourceKey` `31-33`). This is the precedent for a "decide what to do about a colliding upload" step — documents just don't have one.

### The unifying insight

Both changes need the same thing: **a durable, streamable, per-file ingest record** that (a) exists from the moment an upload starts, (b) carries a status the UI can watch, (c) can hold a typed question that pauses that file's finalization, and (d) ties a zip to its extracted children. That record is `file_upload_job`; the question is `file_upload_decision`.

---

## Goals & non-goals

**Goals**
- Kill the "minutes of nothing" by giving every upload a first-class, Realtime-streamed job row from the start, with a zip → children tree.
- Detect when an incoming file closely resembles an existing file and ask the user, per file, to **version / replace / separate / discard** it — before it silently duplicates.
- Make the scaffolding reusable beyond site plans (`upload_type`) and beyond submissions (nullable `submission_version_id`).

**Non-goals (v1)**
- Perfecting similarity detection (v1 uses a deliberately simple heuristic; see [§6](#6-change-2--similarity-detection--the-hitl-decision) and Q-detection).
- Replacing the mechanical `processing_state` on `document_version`/`plan_set_version` — the job is a **user-facing rollup**; fine-grained per-entity state stays where it is.
- Resumable/chunked uploads (tus/multipart) for very large files — noted as a future robustness track, not built here (Q9).
- Any change to `conductor` / review workflows.

---

## The core model

Two new tables in `substation` (Supabase). Both added to the `supabase_realtime` publication so cityhall can subscribe.

### 3. `file_upload_job`

One row **per file being ingested**. A dropped zip is one job; each file extracted from it is its own job with `parent_job_id` set (the zip → children tree). A batch of N directly-dropped files is N top-level jobs (no separate "batch" entity — D-batch).

| column | type | notes |
|---|---|---|
| `id` | uuid pk | returned to the client at creation so it can subscribe immediately |
| `upload_type` | text | `'site_plan'` for now; extensible (`'diligence'`, `'intake'`, …). Drives which pipeline + semantics apply. |
| `project_id` | uuid fk `project` NOT NULL | RLS + UI scope |
| `submission_version_id` | uuid fk `submission_version` NULL | null for non-submission uploads |
| `parent_job_id` | uuid fk `file_upload_job` NULL | set on each zip child → its parent zip job |
| `source_file_name` | text | |
| `source_file_size` | bigint | |
| `storage_path` | text | staging (`…/uploads/{id}/…`) then final |
| `classification` | text NULL | `zip \| plan_set \| document \| drainage-model \| binary` — null until classified |
| `status` | text | lifecycle below |
| `produced_document_id` | uuid NULL | what this job created (one of these two, once known) |
| `produced_plan_set_id` | uuid NULL | |
| `error` | text NULL | on failure |
| `created_at` | timestamptz | at prepare-upload |
| `started_at` | timestamptz NULL | when processing begins — lets a page refresh infer elapsed time (`now − started_at` while non-terminal) |
| `finished_at` | timestamptz NULL | terminal transition |
| `updated_at` | timestamptz | |

**Status lifecycle**

```
awaiting_upload  → uploaded → classifying
                            → (zip only) triaging → extracting → [spawns child jobs]
                            → processing
                            → awaiting_decision        (an open file_upload_decision exists)
                            → done | failed | discarded | superseded
```

- `awaiting_decision` ⇔ the job has an open (`pending`) `file_upload_decision`.
- `discarded` = user chose discard (hard delete). `superseded` = user chose replace (this file replaced an existing one). `done` = finalized as-is (separate) or version applied.
- **A decision blocks only its own job's finalization** (D2), never the parent zip or sibling children — they proceed to `done` independently.

### 4. `file_upload_decision`

The typed HITL question. Separate table (not JSONB on the job) so the ask/answer pair is an addressable, auditable resource with race-safe resolution.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | resolve target: `POST /file-upload-decisions/:id/answer` |
| `job_id` | uuid fk `file_upload_job` NOT NULL | |
| `question_type` | text | UI renders a component per type. First: `replace_or_separate_or_discard`. |
| `payload` | jsonb | the filled-in dynamic values the component needs (below) |
| `status` | text | `pending \| answered \| dismissed` |
| `answer` | jsonb NULL | `{ choice: 'version' \| 'replace' \| 'separate' \| 'discard', … }` |
| `created_at` | timestamptz | |
| `answered_at` | timestamptz NULL | |
| `answered_by` | uuid NULL | user who answered (RLS-scoped) |

Example `payload` for `replace_or_separate_or_discard`:

```jsonc
{
  "incoming":  { "job_id": "…", "file_name": "1700 South Lamar - Formal Site Plan Application_.pdf" },
  "candidate": { "document_id": "1a6a8129-…", "file_name": "Site Plan Application — Formal Submittal",
                 "reason": "first-3-page vision match; size within 8%", "confidence": 0.91 }
}
```

**Race-safety:** `POST …/answer` updates the decision `… WHERE status = 'pending'`; a second concurrent tab loses the update and gets a 409 — mirrors the `upload_token` claim pattern (`submissions.ts:634-650`).

**`question_type` registry.** A closed set; each type has (a) a substation-side detector/creator, (b) a cityhall Svelte component keyed by `question_type`, and (c) a resolver mapping `answer.choice` → an operation. This mirrors cityhall's existing Rich Card Message registry (`src/lib/rcm/components.ts`) — proven "render by type" precedent. Adding an ambiguity later = a new `question_type`, not new transport.

---

## 5. Change 1 — streamed loading UX

The job row is the spine; Supabase Realtime is the delivery. Three windows, three treatments:

| Silent window today | Fix | Cost |
|---|---|---|
| **#1 Browser→storage PUT** (minutes) | Job row created at prepare-upload shows **"Uploading…"** immediately. *Optional* true byte-% requires swapping the two `fetch(PUT)` calls to `XMLHttpRequest` (`upload.onprogress`) and threading a numeric `progress` into the upload state — the **only** thing the DB row can't show, since the server can't see bytes mid-PUT. **Q1: byte-% in or out for v1.** | job row: low · byte-%: low, client-only |
| **#2 Zip triage** (~2 min) | Parent zip job = `triaging`/`extracting`; children revealed as they register. | reuse Realtime |
| **#3 Per-child processing** (minutes) | Each child job `processing → done`, mapped from the existing `processing_state`. | reuse Realtime |

**Delivery mechanism.** cityhall subscribes to `file_upload_job` (and `file_upload_decision`) `postgres_changes` for the submission (migrate the submission page's hand-rolled channels at `+page.svelte:436-481` to the debounced `subscribeToRows` helper in `src/lib/realtime.svelte.ts`). Realtime is a "something changed" nudge → `invalidateAll()` → server load re-reads jobs → UI re-renders. This is the same push model already in use; **no polling**.

**Zip fan-out is rendered as a tree** (`parent_job_id`):

```
📦 TestProj…v2-files.zip            extracting…                    ⏳
   ├─ 📐 Site Plan Set              processing (rasterizing)        ⏳
   ├─ 📄 Drainage Report            done                            ✅
   ├─ 📄 CC Site Plan Application   ⚠ needs your input              ●
   └─ 📄 Engineer Summary Letter    done                            ✅
```

---

## 6. Change 2 — similarity detection + the HITL decision

### Detection (v1: deliberately simple, expected to iterate — Q-detection)

The `replace_or_separate_or_discard` question is the **revision** case, which needs the incoming file's identity (title/kind, and ideally its rendered pages) — so detection runs **after** the child has been processed enough to compare, and creates a decision (job → `awaiting_decision`) rather than blocking extraction.

**v1 heuristic (agreed starting point, to be tuned):**
1. **Rough file-size band** — incoming vs. candidate `file_size` within a % threshold (e.g. ±X%).
2. **Vision comparison of the first 3 pages** — render page 1–3 of the incoming file and of each candidate, ask a vision model "same document, revised?" → confidence.

Candidates are the existing **documents on the same submission version** (the carried-forward set is the high-value target). Above a confidence threshold → raise the decision. This is explicitly a **v1 approximation**; see Q-detection for the open tuning knobs.

> **Not in v1 but adjacent:** exact byte-identical re-upload is cheaply detectable with a `content_hash` (sha256 computed at commit-upload, where bytes are already in hand for `classifyFile`, `submissions.ts:681`). That's a *different* signal (dedupe, pre-processing) and could be its own `question_type` or a silent auto-dedupe. **Q-exactdup: include in v1 or defer.**

### The decision → outcome mapping (resolver)

`POST /file-upload-decisions/:id/answer { choice }`:

| `choice` | Operation | Job terminal status |
|---|---|---|
| `version` | new `document_version` under the candidate's `document_id`, **candidate retained in version history** (documents already have a basic version-history UI) | `done` |
| `replace` | new `document_version` under the candidate's `document_id`, **candidate superseded** (reuses the `/documents/:id/replace` path, `documents.ts:68-218`) | `superseded` |
| `separate` | keep the incoming file as its own new `document` (today's default) | `done` |
| `discard` | **hard delete** the incoming file's `document` + `document_version` + storage object | `discarded` |

`version` and `replace` are **intentionally distinct** (per Will): both write a new version under the existing `document_id`, differing only in whether the prior version is retained in the lineage vs. superseded.

### Where it attaches

- **Detection + decision creation:** post-processing, after `registerAsDocument` (`zip.ts:366-426`) / `handleDocumentUpload` (`submissions.ts:932-998`) have produced the document and the pipeline has enough to compare. A new pipeline step writes the `file_upload_decision` and flips the job to `awaiting_decision`.
- **Resolution:** a new substation endpoint + a thin cityhall proxy; `version`/`replace` reuse the existing `/replace` machinery; `separate` is a no-op finalize; `discard` deletes.
- **Surfacing:** cityhall renders open decisions on the submission page (the job tree already lives there), each via its `question_type` component in a `Lightbox` (gate `onclose` so a required decision isn't trivially dismissed — but see D3/Q-timeout for the non-blocking escape).

---

## 7. Where the job row is written (pipeline seams)

| Stage | File:line (today) | Job write |
|---|---|---|
| prepare-upload | `submissions.ts:520-577` | create `file_upload_job` (`awaiting_upload`) alongside the `upload_token`; return `job_id`(s) |
| commit-upload | `submissions.ts:580-751`; `classifyFile` `classify.ts:11-29` at `:681` | `uploaded → classifying`; set `classification`; (optional) compute `content_hash` |
| process-file dispatch | `handlePlanSetUpload:804`, `handleZipUpload:876`, `handleDocumentUpload:932` | `→ processing` |
| zip triage | `zip.ts` `processZip:42-287` | parent `→ triaging → extracting` |
| zip child register | `registerAsDocument:366`, `registerWinnerAsPlanSet:296`, `registerDrainageModel:436` | create child job (`parent_job_id` = zip), link `produced_*` |
| per-entity done | `document.logic.ts`, `plan-set.ts` state writes | mirror `processing_state` → job `processing → done/failed` |
| similarity detect | **new step** (post-register) | create `file_upload_decision`; job `→ awaiting_decision` |
| resolve | **new endpoint** | apply outcome; job `→ done/superseded/discarded` |

Precedents to model on: `replaceExistingPlanSet` (auto-decide collision) and the feasibility-intake **`pendingBatchId`** loop (`cityhall` intake `+page.server.ts:261-302`, `+page.svelte:445-482`) — the proven "backend writes a row → Realtime nudge → UI acts, deduped" pattern this decision surface reuses.

---

## 8. Decisions (locked this session)

- **D-batch — Job granularity = one per file.** Zip = one job; each extracted child = its own job with `parent_job_id`. N dropped files = N top-level jobs. No explicit batch entity in v1.
- **D2 — A decision blocks only its own file's finalization**, not the parent zip or siblings.
- **D-tables — Two tables** (`file_upload_job` + `file_upload_decision`), not JSONB-on-job — for audit trail, addressable/race-safe resolution, and 1:N questions per job.
- **D-replace-vs-version — Keep `replace` and `version` as distinct outcomes** (differ on prior-version retention). Non-plan-set documents already have a basic version-history UI to build on.
- **D-discard — Discard is a hard delete** (document + version + storage object).
- **D-reuse — `upload_type` + nullable `submission_version_id`** so the scaffolding generalizes beyond site plans / submissions.
- **D-registry — `question_type` drives a UI component registry** (mirrors `rcm/components.ts`); new ambiguities are new types on shared transport.
- **D-spine — The durable job+decision model is the backbone for both changes** (chosen over the clarifying-questions spec's sync-409 MVP, because revision detection is inherently post-processing and zip children are async — see §10).

---

## 9. Scope boundaries & suggested phasing

- **Phase A — Loading spine (Change 1 core).** `file_upload_job` table + Realtime publication; write it through prepare→commit→process→zip-fan-out; cityhall subscribes and renders the job/zip tree. No decisions yet. Independently shippable and immediately kills windows #2–#3 and shows "Uploading…" for #1.
- **Phase B — HITL decisions (Change 2).** `file_upload_decision` table; the similarity-detection step; the resolve endpoint + outcome mapping; cityhall `question_type` component + `Lightbox` surface. Depends on A.
- **Phase C (optional polish).** Byte-% upload bar via `XMLHttpRequest` (Q1); exact-dup `content_hash` dedupe (Q-exactdup).
- **Out:** detection-model perfection; resumable/chunked uploads (Q9); replacing per-entity `processing_state`; conductor/review changes.

---

## 10. Relationship to the clarifying-questions spec

`../new-features/clarifying-questions/DESIGN-SPEC.md` framed the same HITL need as two contexts: a **sync 409** at `commit-upload` (its MVP) and an **async `preprocessing_question` + `waitForEvent`** path. This spec **adopts the async/durable path as the single backbone** and generalizes it:

- `preprocessing_question` → **`file_upload_decision`** (typed, race-safe, auditable).
- `kind` → **`question_type`**; its example kinds (`plan_set_conflict`, `zip_winner`, `classification_boundary`) become future `question_type`s on the same transport.
- Its **safe-default + timeout** principle is retained (Q-timeout).
- The sync-409 approach is **not** used for the revision question (that detection can't happen synchronously), though it may still be the right shape for a *pre-processing* plan-set-conflict prompt later. **Q-merge: formally fold clarifying-questions into this spec, or keep it as the record for the sync-409 cases?**

---

## 11. Open questions / TODOs

- **Q1 — Byte-% upload bar in v1?** Swap `fetch(PUT)` → `XMLHttpRequest` for a true progress bar (Phase C), or ship only the job-row "Uploading…" state first? (Rec: job-row first; byte-% fast-follow.)
- **Q-detection — Similarity heuristic tuning.** The v1 signal (first-3-page vision + file-size % band) needs: the size threshold %, the vision confidence cutoff, candidate scope (this submission version only, or project-wide?), page count if <3 pages, and cost/latency budget for the extra vision calls. Expected to iterate — **this is the least-settled area.**
- **Q-exactdup — Exact byte-dup (`content_hash`) in v1?** Add a sha256 column + a separate dedupe `question_type` (or silent auto-dedupe), or defer.
- **Q-timeout — Does an unanswered decision expire?** A job could sit in `awaiting_decision` forever. Define a default/timeout (e.g. after N days default to `separate`) and whether the file is usable meanwhile. (The clarifying-questions spec's D3 required a safe default for every question — carry that here.)
- **Q-blocking-UX — How "blocking" is the modal?** Non-dismissable `Lightbox`, or a dismissable "N files need your input" banner with the decision resolvable later? (Rec: banner + non-blocking, matching D2.)
- **Q-plan-set — Does the same version/replace/separate/discard question apply to plan sets?** Plan sets already auto-replace to one; do we ever want to ask instead of auto-replacing, or is the question document-only in v1? (Rec: document-only v1.)
- **Q-RLS — RLS on both tables** — project-member read; who may answer a decision (any project member? role-gated?).
- **Q-migration — Existing in-flight/old assets.** Jobs are net-new; no backfill for historical uploads. Confirm the UI degrades when a `document_version` has no owning job (older data).
- **Q9 — Resumable uploads.** Large-file robustness (tus/signed multipart) is a separate track; name it, don't build it.
- **Q-idempotency — Inngest replay.** Job/decision writes from inside `process-file` steps must be replay-safe (the zip fan-out already returns child events rather than sending inside a step, `zip.ts:181-191`, for exactly this reason) — mirror that discipline for job-row writes.

---

## Appendix — verified references

- **Prod trace:** app project `mgxqsrjutswbciyrltwd`; submission `1eb513c1-…`, v2 `submission_version` `90aa50f0-…`; zip at `…/uploads/e34602ed-…/TestProjFromLamarCollier-v2-files.zip` (`129,225,659` B); plan-set child `PLAN_SET__1700 S Lamar Plan Set.pdf` (`124,211,871` B), `plan_set_version` `218c8596-…`, `…/plan-set/v2/source.pdf`; new plan_set `437b621e-…` (v1's was `3560309c-…`).
- **substation:** `src/inngest/functions/process-file/main.ts` (switch `:113`); `src/lib/classify.ts:11-29`; `src/inngest/functions/process-file/zip.ts` (`processZip:42-287`, `registerAsDocument:366-426`, `registerWinnerAsPlanSet:296-359`); `src/routes/submissions.ts` (prepare `520-577`, commit `580-751`, `handleDocumentUpload:932-998`); `src/routes/documents.ts:68-218` (`/replace`); `src/lib/plan-set-collision.ts:28-78`; `src/lib/storage-keys.ts:31-33`; realtime publication `supabase/migrations/20260427230000_add_realtime_tables.sql`; `upload_token` `supabase/migrations/20260426181238_upload_token.sql`. **No content-hash column on any pipeline table; no Inngest `publish()`.**
- **cityhall:** upload PUT `src/routes/(app)/project/[projectId]/submission/[submissionId]/+page.svelte:329-342` + `src/lib/intake/upload.ts:62-66`; upload state enum `+page.svelte:246-253`; Realtime `+page.svelte:436-481`, `src/lib/realtime.svelte.ts`; feasibility-intake pending-action loop `…/intake/[conversationId]/+page.server.ts:261-302` + `+page.svelte:445-482`; `Lightbox` `src/lib/ui/elements/Lightbox.svelte`; RCM registry `src/lib/rcm/components.ts`; upload proxies `…/prepare-upload/+server.ts`, `…/commit-upload/+server.ts`.
