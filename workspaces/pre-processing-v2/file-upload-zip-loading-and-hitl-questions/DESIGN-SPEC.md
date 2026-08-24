# File-Upload Jobs — Streamed Loading UX + HITL "Version / Replace / Separate / Discard" Questions

**Status:** Draft v2 — grilled (folds this session's Q1–Q23, P1–P6, C1–C3)
**Date:** 2026-08-24
**Repos touched:** `substation` (new `file_upload_job` + `file_upload_decision` tables; write job/decision rows through the upload → classify → process → zip-fan-out pipeline; a `sharp`-based similarity-detection step reusing `computeSheetSimilarity`/`matchSheets`; a decision-resolve endpoint), `cityhall` (subscribe to jobs/decisions over Supabase Realtime; render a per-job/zip-tree loading surface + per-file banner + submission-level "needs input" aggregate; render decisions via a `question_type → component` registry)
**Repos NOT touched:** `conductor` (not on the upload/triage path), `bureau`, `radar`, `navalbase`
**Parent:** `../DESIGN-SPEC.md` (Pre-Processing v2)
**Supersedes / absorbs:** `../new-features/clarifying-questions/DESIGN-SPEC.md` — that spec's async **Context 2** (`preprocessing_question` table + Inngest `waitForEvent`) is generalized here into the durable `file_upload_job` / `file_upload_decision` model. Its `kind` enum becomes `question_type`. Its safe-default/timeout principle is **overridden** (D18: no timeouts). See [§10](#10-relationship-to-the-clarifying-questions-spec).

> **Revision note (v2 — folds the 2026-08-24 grilling).**
> - **Detection swapped from vision → reused `sharp` perceptual comparison** (`computeSheetSimilarity` + `matchSheets`, `similarity.ts`/`match-sheets.ts`). Documents already persist per-page JPEGs (`document.ts:80-99`), so the plan-set diff machinery reuses directly — deterministic, free, no LLM. (D8–D13.)
> - **`content_hash` dropped entirely** (Q22): the perceptual score already returns ≈1.0 for byte-identical content, so a hash column adds compute for a case the raster compare subsumes.
> - **Byte-% upload bar dropped** (Q23): the job row's "Uploading…" state is enough; no `XMLHttpRequest` swap.
> - **Plan sets are now first-class detection targets** (P1–P6, reverses v1's "documents-only"). The real accident is *cross-type*: a plan set that lands as a separate **document** via the strict `>11″` classification gate (`classify.ts:21`) or a lost zip winner-election. So v1 includes a **doc→plan-set** promotion path.
> - **No decision timeouts** (D18): a decision persists until answered; the UI makes it clearly unanswered. File stays usable meanwhile.
> - **Candidate-set rule pinned** ([§6](#6-change-2--similarity-detection--the-hitl-decision)): compare only against the target submission version's *current live* document set (carry-forward already "promotes" it), minus self and same-zip-batch siblings, same rasterizable type.
> - **Two decision surfaces** (D19/C2): a per-file banner + a submission-level aggregate.

> **Why this exists.** Two problems observed on a single real upload (below) share one missing primitive — a **first-class, streamable record of "a file is being ingested"**:
> 1. **Minutes of apparent nothing** while a large file uploads and triages, because no status row exists until deep in the pipeline.
> 2. **Silent duplication** — an uploaded file that is really a new version of an existing file is registered as a brand-new, unrelated document (or a plan set that lands as a separate document), with no chance for the user to say "this is v2 of that."
>
> This spec introduces a `file_upload_job` entity (streamed via Supabase Realtime) as the spine for the loading UX, and a `file_upload_decision` entity as a typed, human-in-the-loop question surface — the first question types being "this file looks like an existing one: **version it / replace it / keep separate / discard**" and "this document is really a new version of your **plan set** — promote it?"

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
- Detect when an incoming file closely resembles an existing file — including a **document that is really a new version of the plan set** — and ask the user, per file, to **version / replace / separate / discard / promote** it, before it silently duplicates.
- Make the scaffolding reusable beyond site plans (`upload_type`) and beyond submissions (nullable `submission_version_id`).

**Non-goals (v1)**
- Perfecting the similarity threshold tuning (v1 reuses the plan-set `sharp` comparator; the score cutoffs are expected to iterate — see [§6](#6-change-2--similarity-detection--the-hitl-decision) and Q-detection).
- The **reverse** cross-type case (an incoming *plan set* matching an existing *document*) — rare; deferred (Q-crosstype-reverse). v1 does doc→doc, planset→planset, and doc→planset.
- Replacing the mechanical `processing_state` on `document_version`/`plan_set_version` — the job is a **user-facing rollup**; fine-grained per-entity state stays where it is.
- Resumable/chunked uploads (tus/multipart) for very large files — noted as a future robustness track, not built here (Q9).
- A stuck-processing watchdog (D7): a job can sit in `processing`/`awaiting_decision` indefinitely; a human noticing "this is taking forever" is good enough for v1.
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
| `question_type` | text | UI renders a component per type. Three shapes in v1 (below). |
| `payload` | jsonb | the filled-in dynamic values the component needs (below) |
| `status` | text | `pending \| answered \| dismissed` |
| `answer` | jsonb NULL | `{ choice: 'version' \| 'replace' \| 'separate' \| 'discard' \| 'promote', … }` |
| `created_at` | timestamptz | |
| `answered_at` | timestamptz NULL | |
| `answered_by` | uuid NULL | user who answered (RLS-scoped) |

**Three `question_type`s in v1** (D3/P3 — the option sets differ because plan sets are single-slot):

| `question_type` | Fires when | Options |
|---|---|---|
| `doc_version_or_separate` | an incoming **document** resembles an existing **document** on the version | `version`, `replace`, `separate`, `discard` |
| `plan_set_version_or_discard` | an incoming **plan set** arrives and one already exists | `version`, `replace`, `discard` (no "separate" — one plan set per version) |
| `doc_is_plan_set_version` | an incoming **document** resembles the existing **plan set's sheets** (the misclassification fix) | `promote` (→ plan-set version), `separate` (keep as document), `discard` |

Example `payload` for `doc_version_or_separate` (score from the reused `sharp` comparator):

```jsonc
{
  "incoming":  { "job_id": "…", "file_name": "1700 South Lamar - Formal Site Plan Application_.pdf" },
  "candidate": { "document_id": "1a6a8129-…", "file_name": "Site Plan Application — Formal Submittal",
                 "reason": "mean matched-page similarity 0.91 over 3 pages", "similarity": 0.91 }
}
```

**Race-safety:** `POST …/answer` updates the decision `… WHERE status = 'pending'`; a second concurrent tab loses the update and gets a 409 — mirrors the `upload_token` claim pattern (`submissions.ts:634-650`).

**`question_type` registry.** A closed set; each type has (a) a substation-side detector/creator, (b) a cityhall Svelte component keyed by `question_type`, and (c) a resolver mapping `answer.choice` → an operation. This mirrors cityhall's existing Rich Card Message registry (`src/lib/rcm/components.ts`) — proven "render by type" precedent. Adding an ambiguity later = a new `question_type`, not new transport.

---

## 5. Change 1 — streamed loading UX

The job row is the spine; Supabase Realtime is the delivery. Three windows, three treatments:

| Silent window today | Fix | Cost |
|---|---|---|
| **#1 Browser→storage PUT** (minutes) | Job row created at prepare-upload shows **"Uploading…"** immediately. A true byte-% is **out of scope** (D23) — it would need an `XMLHttpRequest` swap since `fetch` can't report upload progress, and the job row's state is deemed enough. | job row: low |
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

### Detection: reuse the plan-set `sharp` comparator (D8–D13)

**No vision, no LLM, no new comparator.** The plan-set versioning path already does perceptual image comparison: `computeSheetSimilarity` (`src/inngest/lib/sandbox/similarity.ts`) runs `sharp` in the sandbox — resize→256×170 greyscale, then `max(normalized-cross-correlation, content-pixel-match-rate)` → a 0–1 score; `matchSheets` (`match-sheets.ts`) does deterministic position-penalized pairing (`MIN_MATCH_SIMILARITY=0.5`, `1.0`=identical). **Documents already persist per-page JPEGs** to storage (`document.ts:80-99`, under `${basePath}/pages/1.jpg…`, even under pre-processing-v2), so the same comparator works on documents with zero new machinery.

**Mechanics (D8–D13):**
- **Runs inside `processDocument`** (D9), right after pages are rasterized/uploaded while the sandbox is alive — the only place the images are cheaply co-located.
- **First N pages, N = min(3, pageCount)**; per candidate, aggregate to a **doc-level score = mean similarity of matched pages** (D11).
- **Threshold ~0.7 to *propose*** the decision (tunable; higher than the sheet-level 0.5); no auto-apply (D12). Similarity ≈1.0 reads as "looks identical" in the prompt copy — which is why **no separate `content_hash` is needed** (D22).
- **No candidate cap** (each compare is ms); `log()` the candidate count (D13).

### Candidate set (the pinned rule — resolved via carry-forward research)

Carry-forward already "promotes" every live file onto the latest submission version (`submissions.ts:235-263` copies the prior version's current `submission_document` rows verbatim), and `/replace` collapses a versioned document's junction to the new version (`documents.ts:127-193`). So the **live set of a submission version is well-defined and one-row-per-document**, and you only ever compare against the *target* version — never all history.

```
candidates(incoming doc X on svn S) =
  submission_document(S) → document_version → document
  EXCLUDE:  X's own document
            documents produced by a same-zip-batch sibling
              (file_upload_job.parent_job_id == X.job.parent_job_id,
               joined via file_upload_job.produced_document_id)
  FILTER:   processing_state = 'completed'    (rasters exist; junction is inserted at 'pending')
            mime = application/pdf OR image/*  (exclude binary / drainage-model / zip)
```

Two consequences: the **same-zip-batch exclusion is only expressible because we're adding `file_upload_job.parent_job_id` + `produced_document_id`** (there's no batch key in the DB today) — this is why the job records its produced entity. And a **serially-uploaded** earlier file is *not* a sibling (different/no `parent_job_id`), so it stays a candidate — giving the "compare serial D→E but not zip-mates D↔E" behavior for free. Page rasters are enumerated by listing `${basePath}/pages/` (no persisted page count); `basePath = document_version.storage_path` minus filename.

### Plan sets are in scope, and the real accident is *cross-type* (P1–P6)

The sanctioned plan-set paths always collapse to one (`replaceExistingPlanSet`), so a literal "second plan set" is hard to produce. The real failure is a plan set that **lands as a separate document**: classification gates on page-1 short side **strictly `>11″`** (`classify.ts:21`, `PLAN_SET_THRESHOLD_PTS=792`), so a set with a letter/legal cover page classifies as `document`; likewise a lost zip winner-election (`zip.ts:33`). The old plan set survives; the new one becomes a doc. So v1 adds three detection triggers:

1. **`plan_set_version_or_discard` (P1, P6):** a correctly-classified plan-set upload arrives via the **generic dropzone** and one already exists → **stop the silent auto-replace and ask instead.** (The explicit "Replace plan set" button stays a direct action — no prompt; first-ever plan set with none present, no prompt.) Detection is trivial (existence), with the sheet-similarity score only *phrasing* the prompt.
2. **`doc_is_plan_set_version` (P4 — the misclassification fix):** an incoming **document** whose first-N pages strongly match the **existing plan set's sheets** → offer to **promote** it to a plan-set version. Technically trivial: doc page JPEGs vs plan-set sheet thumbnails are both rasters, so the *same* `computeSheetSimilarity` crosses the type boundary.
3. **`doc_version_or_separate`:** the document↔document case above.

**Hold-pending asymmetry (P2 — important).** Documents *append*, so an incoming document is **already attached** as a net-new `document`; its resolver "undoes-and-reattaches" (D15). Plan sets are **single-slot**, so an incoming plan set is **held off-slot** — parked at a `pending/…` key (the "Replace plan set" flow already does this), `replaceExistingPlanSet` + promotion to the canonical `planSetSourceKey` **deferred until the user answers**. The existing plan set stays live; the job's `produced_plan_set_id` stays null until resolved. (Research confirmed the single-occupancy constraint is only on the canonical *source key*, and the `submission_plan_set` junction already permits a transient second link — so this needs no schema change.)

### The decision → outcome mapping (resolver — undo-and-reattach)

Detection runs *after* the incoming file is already a row, so every non-`separate` choice **reconciles an already-created (or held) entity** (D15). `POST /file-upload-decisions/:id/answer { choice }`:

| `choice` | Operation | Job terminal status |
|---|---|---|
| `version` | delete the incoming net-new `document`; insert a new `document_version` under the candidate's `document_id` (reuse `/documents/:id/replace`, `documents.ts:68-218`), **prior version soft-retired** (kept in history, not current — D17) | `done` |
| `replace` | same as `version` but the prior version is superseded/soft-retired as the non-current head | `superseded` |
| `separate` | keep the incoming file as-is (today's default; net-new doc, or — for a held plan set — this option is absent) | `done` |
| `discard` | **hard delete** the incoming file's `document`/`document_version` (or held plan-set bytes) + storage object | `discarded` |
| `promote` (doc→plan-set) | delete the incoming net-new `document`; route its bytes through the plan-set versioning path (the "version it" plan-set flow) | `superseded` |

`version` vs `replace` differ only in prior-version retention (both write under the candidate's `document_id`); only `discard` hard-deletes (D17). **"Version it" for a plan set reuses the Replace-Plan-Set versioning path** (the `computeSheetSimilarity`/`matchSheets` sheet-diff) — with a live-bearing caveat: that sheet-diff only fires when the new `plan_set_version` chains into the **existing `plan_set` lineage**, but the current upload paths mint a *fresh* `plan_set` each time (Q-planset-lineage).

### Where it attaches

- **Detection + decision creation:** inside `processDocument` (doc rasters fresh in sandbox) for the document/cross-type cases; at `handlePlanSetUpload` (hold + ask) for the plan-set case. Writes the `file_upload_decision`, flips the job to `awaiting_decision`.
- **Resolution:** a new substation resolve endpoint + a thin cityhall proxy; `version`/`replace`/`promote` reuse the existing document/plan-set `/replace` machinery; `separate` finalizes; `discard` deletes.
- **Surfacing (D19/D20/C2):** **non-blocking** — a per-file banner on the file's card *and* a submission-level "N files need your input" aggregate on the submission page; clicking opens the `question_type` component in a `Lightbox`. **No timeout** (D18): the decision persists until answered; the file is fully usable meanwhile.

---

## 7. Where the job row is written (pipeline seams)

| Stage | File:line (today) | Job write |
|---|---|---|
| prepare-upload | `submissions.ts:520-577` | create `file_upload_job` (`awaiting_upload`) alongside the `upload_token`; return `job_id`(s) |
| commit-upload | `submissions.ts:580-751`; `classifyFile` `classify.ts:11-29` at `:681` | `uploaded → classifying`; set `classification` |
| process-file dispatch | `handlePlanSetUpload:804`, `handleZipUpload:876`, `handleDocumentUpload:932` | `→ processing`; **plan-set case: hold off-slot + ask instead of auto-replacing when a plan set already exists** (P1) |
| zip triage | `zip.ts` `processZip:42-287` | parent `→ triaging → extracting` |
| zip child register | `registerAsDocument:366`, `registerWinnerAsPlanSet:296`, `registerDrainageModel:436` | create child job (`parent_job_id` = zip), link `produced_*` |
| per-entity done | `document.logic.ts`, `plan-set.ts` state writes | mirror `processing_state` → job `processing → done/failed` |
| similarity detect | **inside `processDocument`** (pages fresh in sandbox) — `computeSheetSimilarity` vs candidate docs **and** the existing plan-set sheets | create `file_upload_decision`; job `→ awaiting_decision` |
| resolve | **new endpoint** | apply outcome; job `→ done/superseded/discarded` |

Precedents to model on: `replaceExistingPlanSet` (auto-decide collision) and the feasibility-intake **`pendingBatchId`** loop (`cityhall` intake `+page.server.ts:261-302`, `+page.svelte:445-482`) — the proven "backend writes a row → Realtime nudge → UI acts, deduped" pattern this decision surface reuses.

---

## 8. Decisions (locked this session — numbered)

**Scope & model**
- **D1 — Two phases/PRs:** A = loading spine, B = HITL. A is independently shippable; B depends on A.
- **D2 — `upload_type` is a plain `TEXT` column** (value `'site_plan'` for now), not a DB enum — extensible later.
- **D3 — Every upload gets a job**, not just zips (single direct files too) — so loading + dedupe/replace/future questions all have a home.
- **D4 — Binary + drainage-model files get job rows too** (terminal jobs); the zip tree is complete.
- **D-batch — Job granularity = one per file.** Zip = one job; each child = its own job with `parent_job_id`. N dropped files = N top-level jobs. No explicit batch entity.
- **D-tables — Two tables** (`file_upload_job` + `file_upload_decision`), not JSONB-on-job — audit trail, addressable/race-safe resolution, 1:N questions per job.
- **D-reuse — `upload_type` + nullable `submission_version_id`** so the scaffolding generalizes beyond site plans / submissions.
- **D-registry — `question_type` drives a UI component registry** (mirrors `rcm/components.ts`); new ambiguities are new types on shared transport.
- **D-spine — The durable job+decision model is the backbone** (over the clarifying-questions sync-409 MVP).

**Lifecycle**
- **D5 — Zip parent → `done` at end of extract;** "still processing" is derived from the child tree, and each child is individually visible as its own file being processed.
- **D6 — Job status is a 1:1 mirror** of its one produced entity's `processing_state`.
- **D7 — No stuck-processing watchdog in v1** (inherit today's `onFailure`); a human noticing "this is taking forever" is good enough.

**Detection (sharp reuse)**
- **D8 — Reuse `computeSheetSimilarity` + `matchSheets`** (deterministic `sharp`, no vision).
- **D9 — Detection runs inside `processDocument`** (pages fresh in sandbox), per document child.
- **D11 — First N pages, N = min(3, pageCount); doc score = mean of matched-page similarity.**
- **D12 — Propose at ~0.7** (tunable); no auto-apply.
- **D13 — No candidate cap; `log()` the count.**
- **D22 — Drop `content_hash`** — the perceptual score already ≈1.0 for identical content.

**Resolver**
- **D15 — Undo-and-reattach:** detection runs after the incoming file is already a row (doc) or held (plan set), so version/replace/promote/discard reconcile it.
- **D16 — "Version it" reuses `/documents/:id/replace`** under the candidate's `document_id`, attaching to the current svn (inherited-vs-owned handling).
- **D17 — `replace` = soft-retire prior version** (kept in history, not current); only `discard` hard-deletes.

**Plan sets (P1–P6)**
- **D-P1 — Generic-dropzone plan-set upload with an existing plan set → hold + ask**, not silent auto-replace. (Explicit "Replace plan set" button + first-ever plan set stay direct.)
- **D-P2 — Hold the incoming plan set off-slot** (`pending/…` key), unattached; promote only on version/replace, delete on discard. (Doc-vs-planset asymmetry — docs are already attached.)
- **D-P3 — Three `question_type`s** (`doc_version_or_separate`, `plan_set_version_or_discard`, `doc_is_plan_set_version`); plan-set option set has no "separate."
- **D-P4 — Cross-type doc→plan-set detection is in v1** (the misclassification-as-document fix); the reverse (plan-set matching a document) is deferred.
- **D-P6 — Always ask when a prior plan set exists;** the similarity score only phrases the prompt.

**Interaction / infra**
- **D18 — No decision timeouts.** A decision persists until answered; the UI makes it clearly unanswered. Never auto-defaults (overrides the clarifying-questions safe-default rule).
- **D19 — File is fully usable while `awaiting_decision`** (it's already processed).
- **D20 — Non-blocking surfacing:** a per-file banner + a submission-level "N files need input" aggregate; `Lightbox` on click. (C2)
- **D21 — Deploy substation first** (tables + publication + writes), cityhall reads after; **no backfill** — cityhall renders cards with or without an owning job (legacy data).
- **D23 — No byte-% upload bar** (drop the `XMLHttpRequest` swap); the job-row "Uploading…" state suffices.

---

## 9. Scope boundaries & suggested phasing

- **Phase A — Loading spine (Change 1).** `file_upload_job` table + Realtime publication; write it through prepare→commit→process→zip-fan-out; cityhall subscribes and renders the job/zip tree. No decisions yet. Independently shippable; immediately kills windows #2–#3 and shows "Uploading…" for #1.
- **Phase B — HITL decisions (Change 2), incl. plan sets.** `file_upload_decision` table; the `sharp`-reuse detection step (doc↔doc + doc→plan-set); the plan-set hold-and-ask path; the resolve endpoint + outcome mapping; cityhall `question_type` components + per-file banner + submission-level aggregate. Depends on A. Could sub-split doc-only then plan-set if needed.
- **Out (v1):** similarity-threshold perfection; the reverse cross-type (plan-set→document); resumable/chunked uploads (Q9); a stuck-processing watchdog (D7); byte-% upload bar (D23); `content_hash` (D22); replacing per-entity `processing_state`; conductor/review changes.

---

## 10. Relationship to the clarifying-questions spec

`../new-features/clarifying-questions/DESIGN-SPEC.md` framed the same HITL need as two contexts: a **sync 409** at `commit-upload` (its MVP) and an **async `preprocessing_question` + `waitForEvent`** path. This spec **adopts the async/durable path as the single backbone** and generalizes it:

- `preprocessing_question` → **`file_upload_decision`** (typed, race-safe, auditable).
- `kind` → **`question_type`**; its example kinds (`plan_set_conflict`, `zip_winner`, `classification_boundary`) become future `question_type`s on the same transport. Note its `plan_set_conflict` is effectively realized here as `plan_set_version_or_discard` (D-P1).
- Its **safe-default + timeout** principle is **overridden** — D18 chooses no timeouts (a decision persists until answered; the file is usable meanwhile).
- The sync-409 approach is **not** used (detection is post-processing and zip children are async). **Q-merge: formally fold clarifying-questions into this spec, or keep it as the record for any future sync-409 cases?**

---

## 11. Open questions / TODOs

**Resolved this session** (kept for the audit trail): byte-% bar → out (D23); exact-dup `content_hash` → dropped (D22); decision timeout → none (D18); blocking-UX → non-blocking banner + aggregate (D20); plan-set inclusion → in, cross-type (D-P1–D-P6); detector → sharp reuse (D8).

**Still open:**
- **Q-detection — Similarity threshold tuning.** The `sharp` comparator is fixed, but the doc-level propose threshold (~0.7), the "looks identical" cutoff (~0.98 for messaging), N (first pages), and the cross-type doc→plan-set cutoff all need calibration against real resubmittals. **Least-settled area.**
- **Q-planset-lineage — "Version it" for a plan set must chain into the existing `plan_set` lineage.** The sheet-diff (`fetchPriorVersion`) only fires when the new `plan_set_version` shares a `plan_set_id` with a prior submission-version's plan set, but both current upload paths mint a *fresh* `plan_set` each time. The resolver must reuse/chain the lineage or the v1→v2 diff won't engage. Confirm against cityhall's plan-set loader before building.
- **Q-crosstype-reverse — Reverse cross-type deferred.** An incoming *plan set* that matches an existing *document*. Rare; not in v1.
- **Q-RLS — RLS on both tables** — project-member read; who may answer (any project member with write? role-gated?).
- **Q-migration — No backfill.** Historical `document_version`/`plan_set_version` rows have no owning job. Confirm cityhall renders cards with or without a job (D21).
- **Q-heldplanset-score — Scoring a held plan set.** To phrase the `plan_set_version_or_discard` prompt with a similarity %, the incoming plan set's first-N sheets must be rasterized (off-slot, not promoted) to compare against the existing plan set. Confirm the rasterize-without-promote step.
- **Q-idempotency — Inngest replay.** Job/decision writes from inside `process-file` steps must be replay-safe (the zip fan-out already returns child events rather than sending inside a step, `zip.ts:181-191`) — mirror that discipline for job-row writes.
- **Q9 — Resumable uploads.** Large-file robustness (tus/signed multipart) — named, not built.
- **Q-merge — Fold in the clarifying-questions spec** or keep it as the record for future sync-409 cases (see §10).

---

## Appendix — verified references

- **Prod trace:** app project `mgxqsrjutswbciyrltwd`; submission `1eb513c1-…`, v2 `submission_version` `90aa50f0-…`; zip at `…/uploads/e34602ed-…/TestProjFromLamarCollier-v2-files.zip` (`129,225,659` B); plan-set child `PLAN_SET__1700 S Lamar Plan Set.pdf` (`124,211,871` B), `plan_set_version` `218c8596-…`, `…/plan-set/v2/source.pdf`; new plan_set `437b621e-…` (v1's was `3560309c-…`).
- **substation:** `src/inngest/functions/process-file/main.ts` (switch `:113`); `src/lib/classify.ts:11-29` (`PLAN_SET_THRESHOLD_PTS=792`, strict `>11″` at `:21`); `src/inngest/functions/process-file/zip.ts` (`processZip:42-287`, `electPlanSetWinnerIndex:33`, `registerAsDocument:366-426`, `registerWinnerAsPlanSet:296-359`); `src/routes/submissions.ts` (prepare `520-577`, commit `580-751`, `handlePlanSetUpload:804-874`, carry-forward `POST /versions` `235-263`, `handleDocumentUpload:932-998`); `src/routes/documents.ts:68-218` (`/replace`, junction re-point `127-193`); `src/routes/plan-sets.ts:107` (plan-set `/replace`); `src/lib/plan-set-collision.ts:28-78`; `src/lib/storage-keys.ts` (`planSetSourceKey`); **detection reuse:** `src/inngest/lib/sandbox/similarity.ts:8` (`computeSheetSimilarity`), `src/inngest/functions/process-file/match-sheets.ts` (`matchSheets`, `MIN_MATCH_SIMILARITY=0.5`), `src/inngest/functions/process-file/document.ts:80-99` (per-page JPEG persistence), `plan-set.ts:177-214` (existing sheet-diff); realtime publication `supabase/migrations/20260427230000_add_realtime_tables.sql`; `upload_token` `supabase/migrations/20260426181238_upload_token.sql`. **No content-hash column on any pipeline table; no Inngest `publish()`; one-plan-set invariant is convention-only (no DB constraint).**
- **cityhall:** upload PUT `src/routes/(app)/project/[projectId]/submission/[submissionId]/+page.svelte:329-342` + `src/lib/intake/upload.ts:62-66`; upload state enum `+page.svelte:246-253`; Realtime `+page.svelte:436-481`, `src/lib/realtime.svelte.ts`; feasibility-intake pending-action loop `…/intake/[conversationId]/+page.server.ts:261-302` + `+page.svelte:445-482`; `Lightbox` `src/lib/ui/elements/Lightbox.svelte`; RCM registry `src/lib/rcm/components.ts`; upload proxies `…/prepare-upload/+server.ts`, `…/commit-upload/+server.ts`.
