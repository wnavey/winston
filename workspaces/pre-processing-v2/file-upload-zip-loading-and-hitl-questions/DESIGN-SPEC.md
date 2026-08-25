# File-Upload Jobs — Streamed Loading UX + HITL "Version / Replace / Separate / Discard" Questions

**Status:** Draft v3 — folds the 2026-08-25 audit (attach-on-resolve for documents, flavor-routed detection, single-decision argmax, plan-set-lineage resolved, stale citation fixed)
**Date:** 2026-08-25
**Repos touched:** `substation` (new `file_upload_job` + `file_upload_decision` tables; write job/decision rows through the upload → classify → process → zip-fan-out pipeline; a **flavor-routed** similarity step — text-layer Jaccard for text-native documents, the reused `sharp` `computeSheetSimilarity`/`matchSheets` comparator for plan sheets and scanned/image-only PDFs; a decision-resolve endpoint), `cityhall` (subscribe to jobs/decisions over Supabase Realtime; render a per-job/zip-tree loading surface + per-file banner + submission-level "needs input" aggregate; render decisions via a `question_type → component` registry)
**Repos NOT touched:** `conductor` (not on the upload/triage path), `bureau`, `radar`, `navalbase`
**Parent:** `../DESIGN-SPEC.md` (Pre-Processing v2)
**Supersedes / absorbs:** `../new-features/clarifying-questions/DESIGN-SPEC.md` — that spec's async **Context 2** (`preprocessing_question` table + Inngest `waitForEvent`) is generalized here into the durable `file_upload_job` / `file_upload_decision` model. Its `kind` enum becomes `question_type`. Its safe-default/timeout principle is **overridden** (D18: no timeouts). See [§10](#10-relationship-to-the-clarifying-questions-spec).

> **Revision note (v3 — folds the 2026-08-25 audit).**
> - **Documents are now held off-slot ("attach-only-on-resolve," D15).** The incoming document's `submission_document` junction row is **not inserted** until detection clears (no candidate) or the decision resolves. This makes documents symmetric with plan sets (both held off-slot) and **structurally prevents a live duplicate from ever appearing** — the earlier "undo-and-reattach" created the duplicate first. No schema change: it defers one existing INSERT out of `commit-upload` to the end of the detection step.
> - **Detection is flavor-routed (D24), not visual-for-everything.** Greyscale raster is the right signal for plan *sheets* but weak for text-dense forms (shared letterhead → false positives; redlines → false negatives). So: **text-native documents → text-layer extraction + Jaccard**; **plan sheets + scanned/image-only PDFs → the reused `sharp` visual comparator**. A cheap text-density check routes each file. When both signals are cheaply available (a text-native doc already has persisted page rasters), the non-primary signal is a **tiebreaker/booster on the same single decision**, never a second question. **Validate thresholds against ~10 real resubmittal pairs before building Phase B.**
> - **One decision per uploaded file (D25 — argmax).** Score the incoming file against *every* eligible live file in the submission version, across question types. Zero above threshold → no question. ≥1 above threshold → exactly **one** `file_upload_decision`, targeting the **single highest-scoring** candidate. No barrage of "is this A? …is this Z?" prompts.
> - **`Q-planset-lineage` resolved (small change, known precedent).** The plan-set sheet-diff (`fetchPriorVersion`) fires iff a prior `plan_set_version` shares the same `plan_set_id`. The `POST /plan-sets/:id/replace` route (`plan-sets.ts:222-238`) already inserts a new `plan_set_version` under an **existing** `plan_set_id`; the resolver reuses that shape. Not a rework.
> - **Stale citation fixed.** `replaceExistingPlanSet` / `src/lib/plan-set-collision.ts` **do not exist** in either repo (grep, 2026-08-25). The real collision/lineage precedent is the `/replace` route. The "plan sets already converge to one" framing (§Problem) is flagged for re-verification — both fresh-upload paths mint a *fresh* `plan_set`, so generic-dropzone uploads do **not** auto-converge; convergence happens only via explicit `/replace`.

> **Revision note (v2 — folds the 2026-08-24 grilling).**
> - **Detection swapped from vision → reused `sharp` perceptual comparison** (`computeSheetSimilarity` + `matchSheets`, `similarity.ts`/`match-sheets.ts`). Documents already persist per-page JPEGs (`document.ts:80-99`), so the plan-set diff machinery reuses directly — deterministic, free, no LLM. (D8–D13.) *(v3: retained for the visual route — plan sheets & scanned docs — but text-native documents now route to text-layer Jaccard; see D24.)*
> - **`content_hash` dropped entirely** (Q22): the perceptual score already returns ≈1.0 for byte-identical content, so a hash column adds compute for a case the raster compare subsumes. *(v3: the text route likewise scores 1.0 for identical text; still no hash column.)*
> - **Byte-% upload bar dropped** (Q23): the job row's "Uploading…" state is enough; no `XMLHttpRequest` swap.
> - **Plan sets are now first-class detection targets** (P1–P6, reverses v1's "documents-only"). The real accident is *cross-type*: a plan set that lands as a separate **document** via the strict `>11″` classification gate (`classify.ts:21`) or a lost zip winner-election. So v1 includes a **doc→plan-set** promotion path.
> - **No decision timeouts** (D18): a decision persists until answered; the UI makes it clearly unanswered.
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

   The user had no opportunity to say "the new Formal Site Plan Application is a revision of the old one." Note the observable signal in this trace was near-identical **file names** on **content-revised** documents — which is exactly why v3 routes text-native documents to **text** comparison, not greyscale raster (see [§6](#6-change-2--similarity-detection--the-hitl-decision)).

   **⚠ Re-verify (2026-08-25):** the earlier draft asserted "the plan set, by contrast, auto-replaced to one" and that "plan sets already converge to one via `replaceExistingPlanSet`." That symbol/file does not exist (see below), and both current upload paths mint a *fresh* `plan_set`. Confirm from the trace what actually happened to the plan set before building P1 on the premise of a silent auto-replace.

### Why the code can't do better today (grounded in `substation` / `cityhall`)

- **No upload-progress is observable server-side, and the client can't report it either.** Both upload paths use `fetch(url, { method:'PUT', body: file })` — cityhall submission page `+page.svelte:329-342` and intake `src/lib/intake/upload.ts:62-66`. `fetch` emits **no upload-progress events**; only `XMLHttpRequest.upload.onprogress` does. The UI models upload as a coarse enum (`UploadStatus = 'preparing'|'uploading'|'committing'|'done'|'error'`, `+page.svelte:246-253`) rendered as a single indeterminate spinner (`682-721`).
- **Status is DB-state + Supabase Realtime, not a stream.** `document_version` / `plan_set_version` carry `processing_state` (`pending → processing → processed | failed | cancelled`, no CHECK constraint — "application enforces"). substation writes those rows; the realtime publication `supabase/migrations/20260427230000_add_realtime_tables.sql` publishes `document_version`, `plan_set_version`, `sheet_version`, `project_facts`; cityhall subscribes (submission `+page.svelte:436-481`) and just calls `invalidateAll()`. **There is no Inngest `publish()`/`@inngest/realtime` anywhere in substation** — any "pause and ask" must be modeled as **DB row state**, not a socket.
- **Documents always append; there is zero version/dup detection.** Every ingest path mints a fresh `document` + v1 `document_version` and inserts a `submission_document` junction row: direct `handleDocumentUpload` (`submissions.ts`) and zip child `registerAsDocument` (`zip.ts`). **No content hash exists on any pipeline table** (`document`, `document_version`, `plan_set`, `plan_set_version`, `upload_token` — confirmed by schema grep; the only `content_hash` columns are on unrelated Bureau tables). Identity is only `document_id` / `plan_set_id`. Membership in a submission version is defined **purely** by a `submission_document` junction row (`baseline.sql:697-701`, PK `(submission_version_id, document_version_id)`, no status column) — this junction is the seam v3's off-slot hold defers.
- **The only "new version under an existing entity" logic is explicit and caller-driven** — `POST /documents/:documentId/replace` (`documents.ts:68-218`; inserts a new `document_version` under the same `document_id`, then re-points the junction). The client already names the `document_id`; nothing detects the match.
- **Plan sets converge only via the explicit `/replace` route — not on a plain upload.** The **stale** references to `replaceExistingPlanSet` / `src/lib/plan-set-collision.ts` do not resolve to any symbol/file (grep across `substation` + `cityhall`, 2026-08-25). What *does* exist: `POST /plan-sets/:id/replace` (`plan-sets.ts:222-238`) inserts a new `plan_set_version` under the **existing** `plan_set_id` and links the junction. But both fresh-upload paths (`handlePlanSetUpload`; zip winner `zip.ts:185-214`) mint a **new** `plan_set` via `crypto.randomUUID()`. So a plain generic-dropzone plan-set upload does *not* auto-collapse to one — that's the precedent for a "decide what to do about a colliding upload" step, but it is opt-in (the `/replace` button), not automatic.

### The unifying insight

Both changes need the same thing: **a durable, streamable, per-file ingest record** that (a) exists from the moment an upload starts, (b) carries a status the UI can watch, (c) can hold a typed question that pauses that file's finalization, and (d) ties a zip to its extracted children. That record is `file_upload_job`; the question is `file_upload_decision`.

---

## Goals & non-goals

**Goals**
- Kill the "minutes of nothing" by giving every upload a first-class, Realtime-streamed job row from the start, with a zip → children tree.
- Detect when an incoming file closely resembles an existing file — including a **document that is really a new version of the plan set** — and ask the user, per file, to **version / replace / separate / discard / promote** it, **before it silently duplicates** (v3: enforced by the off-slot hold — the incoming file is never attached to the live set until the decision resolves).
- Make the scaffolding reusable beyond site plans (`upload_type`) and beyond submissions (nullable `submission_version_id`).

**Non-goals (v1)**
- Perfecting the similarity threshold tuning (the score cutoffs — both the text-Jaccard and the visual thresholds — are expected to iterate; see [§6](#6-change-2--similarity-detection--the-hitl-decision) and Q-detection).
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
                            → awaiting_decision        (an open file_upload_decision exists — file HELD off-slot)
                            → done | failed | discarded | superseded
```

- `awaiting_decision` ⇔ the job has an open (`pending`) `file_upload_decision`. **While `awaiting_decision`, the incoming file is held off-slot — its `submission_document` junction row is not inserted, so it is not in the live submission set** (D15). It surfaces only as a pending job.
- `done` = finalized (attached as separate, or a version/promote applied). `discarded` = user chose discard (hard delete). `superseded` = user chose replace/promote (this file replaced/absorbed an existing one).
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

**One decision per uploaded file (D25 — argmax).** A file gets **at most one** open decision, targeting the single best-matching candidate across all comparison types (see [§6](#6-change-2--similarity-detection--the-hitl-decision)). `payload.candidate` therefore names exactly one target, not a list.

**Three `question_type`s in v1** (D3/P3 — the option sets differ because plan sets are single-slot):

| `question_type` | Fires when | Options |
|---|---|---|
| `doc_version_or_separate` | an incoming **document** resembles an existing **document** on the version | `version`, `replace`, `separate`, `discard` |
| `plan_set_version_or_discard` | an incoming **plan set** arrives and one already exists | `version`, `replace`, `discard` (no "separate" — one plan set per version) |
| `doc_is_plan_set_version` | an incoming **document** resembles the existing **plan set's sheets** (the misclassification fix) | `promote` (→ plan-set version), `separate` (keep as document), `discard` |

Example `payload` for `doc_version_or_separate` (score from the text-Jaccard route for a text-native document):

```jsonc
{
  "incoming":  { "job_id": "…", "file_name": "1700 South Lamar - Formal Site Plan Application_.pdf" },
  "candidate": { "document_id": "1a6a8129-…", "file_name": "Site Plan Application — Formal Submittal",
                 "reason": "text-layer Jaccard 0.88 over first 3 pages", "score": 0.88, "method": "text" }
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

**Note on live-list timing (v3 consequence of the off-slot hold).** Because a document's `submission_document` junction is now inserted only after detection clears (or on resolve), a document appears in the *live document list* only once processing + detection complete — not immediately at commit. The job-row loading surface covers that in-flight window (the file is visibly a job the whole time), so the live list simply never shows a half-processed or duplicate document.

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

### Detection: flavor-routed — text for documents, visual for sheets (D24)

**No LLM by default.** The deciding factor is whether the incoming PDF has a usable text layer, which also happens to be exactly where each comparator is strong:

- **Plan sheets** (the classify gate's `plan_set` — large-format line drawings) → **visual**: the existing `computeSheetSimilarity` (`src/inngest/lib/sandbox/similarity.ts`, `sharp` resize→256×170 greyscale, `max(NCC, content-pixel-match-rate)` → 0–1) + `matchSheets` (`match-sheets.ts`, `MIN_MATCH_SIMILARITY=0.5`). Unchanged; this is its home turf.
- **Text-native documents** (digitally-generated forms/applications — the common case in the trace) → **text**: extract the PDF text layer for the first N pages, normalize (lowercase, collapse whitespace, strip punctuation), and compute **token/shingle Jaccard**. This directly answers "is this a revised version of that document" — revisions share most text; unrelated forms don't, regardless of shared letterhead. Deterministic, cheap, no LLM.
- **Scanned / image-only documents** (no usable text layer) → **visual** fallback (the same `sharp` comparator on the persisted page JPEGs).

**The router** is a cheap text-density check on the incoming file inside the sandbox (chars/page extracted over the first N pages, above a threshold → text-native → text route; below → visual route; plan sheets always visual).

**Both signals as a booster, never a second question.** A text-native document already has persisted page rasters (`document.ts:80-99`), so the visual score is cheaply available too. Where both exist, use the non-primary signal only as a **tiebreaker / confidence booster on the same single decision** (e.g. `max(text, visual)` or a small weighted combine) — it must never spawn a second, independent question. Start with pure per-flavor routing; add the booster only if validation shows false negatives.

**Mechanics:**
- **Runs inside `processDocument`** (D9), right after pages are rasterized/uploaded while the sandbox is alive — the only place the images (and the downloaded PDF, for text extraction) are cheaply co-located.
- **First N pages, N = min(3, pageCount)**; aggregate to a **doc-level score** per candidate (mean of matched-page similarity for the visual route; whole-document Jaccard for the text route) (D11).
- **Propose above threshold** (tunable — the text-Jaccard cutoff and the visual ~0.7 cutoff are independent and both need calibration); no auto-apply (D12).
- **No candidate cap** (each compare is cheap); `log()` the candidate count (D13).
- **⚠ Validate thresholds against ~10 real resubmittal doc-pairs before building Phase B** (Q-detection). The 0.7 visual number was never validated and greyscale raster is the weakest signal for text forms — the pre-build spike on real pairs is the single highest-leverage de-risk.

### Candidate set + single-decision selection (D25)

Carry-forward already "promotes" every live file onto the latest submission version (`submissions.ts:227-246` re-points the `submission_document` / `submission_plan_set` junctions at the prior version's rows verbatim), and `/replace` collapses a versioned document's junction to the new version (`documents.ts:127-193`). So the **live set of a submission version is well-defined and one-row-per-document**, and you only ever compare against the *target* version — never all history.

```
candidates(incoming file X on svn S) =
  submission_document(S) → document_version → document      (for doc↔doc)
  + the submission's current-live plan set                  (for doc→plan-set, see below)
  EXCLUDE:  X's own document
            entities produced by a same-zip-batch sibling
              (file_upload_job.parent_job_id == X.job.parent_job_id,
               joined via file_upload_job.produced_document_id / produced_plan_set_id)
  FILTER:   processing_state = 'completed'    (rasters/text exist)
            rasterizable/text-bearing type    (application/pdf OR image/*; exclude binary / drainage-model / zip)

SELECT ONE (D25):
  score X against every candidate (routed by flavor);
  drop all below threshold;
  if none remain → NO decision (file auto-attaches as separate);
  if ≥1 remain   → create exactly ONE decision against argmax(score)
                   (argmax spans question types — the best doc↔doc match and the
                    doc→plan-set match compete; the single global winner is asked).
```

Two consequences: the **same-zip-batch exclusion is only expressible because we're adding `file_upload_job.parent_job_id` + `produced_*`** (there's no batch key in the DB today) — this is why the job records its produced entity. And a **serially-uploaded** earlier file is *not* a sibling (different/no `parent_job_id`), so it stays a candidate — giving the "compare serial D→E but not zip-mates D↔E" behavior for free.

**Wrong-top-1 is accepted.** If the true match is 2nd place and the user answers `separate` on the argmax candidate, the real match is missed. This is rare (similarity ordering makes the real match almost always the top score) and far better UX than a multi-candidate prompt; the `separate` option cleanly covers "no, these are different." v1 does not build multi-candidate prompts.

### Plan sets are in scope, and the real accident is *cross-type* (P1–P6)

A literal "second plan set" is hard to produce on the sanctioned paths; the real failure is a plan set that **lands as a separate document**: classification gates on page-1 short side **strictly `>11″`** (`classify.ts:21`, `PLAN_SET_THRESHOLD_PTS=792`), so a set with a letter/legal cover page classifies as `document`; likewise a lost zip winner-election (`zip.ts:33`). The old plan set survives; the new one becomes a doc. So v1 adds three detection triggers:

1. **`plan_set_version_or_discard` (P1, P6):** a correctly-classified plan-set upload arrives via the **generic dropzone** and one already exists → **ask instead of any silent handling.** (The explicit "Replace plan set" button stays a direct action — no prompt; first-ever plan set with none present, no prompt.) Detection is trivial (existence), with the sheet-similarity score only *phrasing* the prompt.
2. **`doc_is_plan_set_version` (P4 — the misclassification fix):** an incoming **document** whose first-N pages strongly match the **submission's current-live plan set's sheets** → offer to **promote** it to a plan-set version. Both are rasters, so the *visual* `computeSheetSimilarity` crosses the type boundary. **Clarification (Q3, v3):** this compares against the **current-live (carried-forward) plan set**, which is already fully processed — and it **excludes same-zip plan-set siblings** (consistent with the doc↔doc rule). So there is **no ordering race** with an in-flight sibling plan set. Accepted gap: an *intra-zip* misclassification (a good plan set plus a second plan-set-as-document in the *same* zip) won't cross-match — rare, fine for v1.
3. **`doc_version_or_separate`:** the document↔document case above (text route for text-native docs).

**Hold-pending symmetry (P2, revised v3).** With the off-slot hold (D15), **both documents and plan sets are held off-slot** while `awaiting_decision`:
- An incoming **plan set** is parked at a `pending/…` key, unattached; the existing plan set stays live; `produced_plan_set_id` stays null until resolved. (Research confirmed the single-occupancy constraint is only on the canonical *source key*; the `submission_plan_set` junction already permits a transient second link — no schema change. Verify the exact `storage-keys.ts` helper name at build time; see the citation caveat in the Appendix.)
- An incoming **document** likewise has its `submission_document` junction **deferred** — it is not in the live set until the decision resolves. The only remaining doc/plan-set difference is single-slot semantics (a plan set has no `separate` option).

### The decision → outcome mapping (resolver — attach-only-on-resolve, D15)

Detection runs while the incoming file is **held** (document: junction deferred; plan set: parked off-slot), so every choice **commits or discards a held entity** — no live duplicate ever existed. `POST /file-upload-decisions/:id/answer { choice }`:

| `choice` | Operation | Job terminal status |
|---|---|---|
| `version` | insert a new `document_version` under the candidate's `document_id` (reuse `/documents/:id/replace`, `documents.ts:68-218`) and **point the junction at it**; delete the held incoming net-new `document`; **prior version soft-retired** (kept in history, not current — D17) | `done` |
| `replace` | same as `version` but the prior version is superseded/soft-retired as the non-current head | `superseded` |
| `separate` | **attach the held incoming file** — insert its `submission_document` junction row (today's default, now deferred to this point). For a held plan set this option is absent. | `done` |
| `discard` | **hard delete** the held incoming `document`/`document_version` (or held plan-set bytes) + storage object — nothing was ever attached (D17) | `discarded` |
| `promote` (doc→plan-set) | delete the held incoming net-new `document`; route its bytes through the plan-set versioning path under the **existing `plan_set_id`** (see Q-planset-lineage resolution below) | `superseded` |

`version` vs `replace` differ only in prior-version retention (both write under the candidate's `document_id`); only `discard` hard-deletes (D17). **Files with no candidate above threshold skip the decision entirely and auto-attach** (junction inserted at the end of detection) — the common, no-collision path.

**"Version it" / "promote" for a plan set chains lineage via the existing `/replace` shape (Q-planset-lineage, RESOLVED).** The sheet-diff `fetchPriorVersion` (`plan-set.logic.ts:24-39`) fires **iff** a prior `plan_set_version` shares the same `plan_set_id` (and a different `submission_version_id`). The `POST /plan-sets/:id/replace` route (`plan-sets.ts:222-238`) already inserts a new `plan_set_version` under an **existing** `plan_set_id`, links the junction, and dispatches `process-file` — exactly the shape the resolver needs. So the resolver routes to that existing-`plan_set_id` insert instead of the fresh-mint path (`handlePlanSetUpload` / `zip.ts:185-214` stay as-is for genuinely new sets). Two caveats, both already solved in `/replace`: (a) *which prior wins* — `/replace` unlinks the in-draft owned psv so `fetchPriorVersion` finds the carried-forward v1 as the comparison base; (b) *same-draft double-upload* — replicate that unlink so a second version compares against v1, not the just-replaced upload.

### Where it attaches

- **Detection + decision creation:** inside `processDocument` (doc rasters/text fresh in sandbox) for the document/cross-type cases; at `handlePlanSetUpload` (hold off-slot + ask) for the plan-set case. Writes the `file_upload_decision`, flips the job to `awaiting_decision`.
- **Resolution:** a new substation resolve endpoint + a thin cityhall proxy; `version`/`replace`/`promote` reuse the existing document/plan-set `/replace` machinery; `separate` attaches (junction insert); `discard` deletes.
- **Surfacing (D19/D20/C2):** **non-blocking to siblings and the rest of the page** — a per-file banner on the file's (held) job card *and* a submission-level "N files need your input" aggregate on the submission page; clicking opens the `question_type` component in a `Lightbox`. **No timeout** (D18): the decision persists until answered; the held file simply stays a pending job (off-slot) until then.

---

## 7. Where the job row is written (pipeline seams)

| Stage | File:line (today) | Job write |
|---|---|---|
| prepare-upload | `submissions.ts:520-577` | create `file_upload_job` (`awaiting_upload`) alongside the `upload_token`; return `job_id`(s) |
| commit-upload | `submissions.ts:580-751`; `classifyFile` `classify.ts:11-29` | `uploaded → classifying`; set `classification`. **v3: do NOT insert the `submission_document` junction here** — defer it (off-slot hold) |
| process-file dispatch | `handlePlanSetUpload`, `handleZipUpload`, `handleDocumentUpload` | `→ processing`; **plan-set case: hold off-slot + ask when a plan set already exists** (P1) |
| zip triage | `zip.ts` `processZip:42-287` | parent `→ triaging → extracting` |
| zip child register | `registerAsDocument:366`, `registerWinnerAsPlanSet`, `registerDrainageModel` | create child job (`parent_job_id` = zip), link `produced_*`; **defer the child's junction insert** (off-slot hold) |
| similarity detect | **inside `processDocument`** (pages/text fresh in sandbox) — flavor-routed compare vs candidate docs **and** the current-live plan-set sheets; argmax single-decision | none above threshold → **attach** (insert junction), job `→ done`; else create `file_upload_decision`, job `→ awaiting_decision` |
| per-entity done | `document.logic.ts`, `plan-set.ts` state writes | mirror `processing_state` → job `processing → done/failed` |
| resolve | **new endpoint** | apply outcome; on `separate` insert junction; on `version`/`replace`/`promote` reuse `/replace` machinery; on `discard` delete; job `→ done/superseded/discarded` |

Precedents to model on: the `/plan-sets/:id/replace` route (existing-`plan_set_id` insert + junction link) and the feasibility-intake **`pendingBatchId`** loop (`cityhall` intake `+page.server.ts:261-302`, `+page.svelte:445-482`) — the proven "backend writes a row → Realtime nudge → UI acts, deduped" pattern this decision surface reuses.

---

## 8. Decisions (locked — numbered)

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
- **D6 — Job status is a 1:1 mirror** of its one produced entity's `processing_state` (until a decision holds it).
- **D7 — No stuck-processing watchdog in v1** (inherit today's `onFailure`); a human noticing "this is taking forever" is good enough.

**Detection**
- **D8 — Reuse `computeSheetSimilarity` + `matchSheets`** (deterministic `sharp`, no vision) for the **visual route** — plan sheets and scanned/image-only PDFs.
- **D24 — Detection is flavor-routed.** Text-native documents → text-layer extraction + token/shingle Jaccard; plan sheets & scanned docs → the visual comparator. A cheap text-density check routes each file. When both signals are cheaply available, the non-primary is a tiebreaker/booster on the same single decision, never a second question.
- **D9 — Detection runs inside `processDocument`** (pages + downloaded PDF fresh in sandbox), per document child.
- **D11 — First N pages, N = min(3, pageCount);** doc score = mean matched-page similarity (visual) or whole-doc Jaccard (text).
- **D12 — Propose above threshold** (text-Jaccard and visual ~0.7 are independent, both tunable); no auto-apply. **Validate against real resubmittal pairs before Phase B.**
- **D13 — No candidate cap; `log()` the count.**
- **D25 — One decision per uploaded file (argmax).** Score against every eligible candidate across question types; none above threshold → no question (auto-attach); ≥1 → exactly one decision against the single highest score. Wrong-top-1 is accepted; no multi-candidate prompts.
- **D22 — Drop `content_hash`** — both the visual score and the text Jaccard already ≈1.0 for identical content.

**Resolver**
- **D15 — Attach-only-on-resolve (off-slot hold).** The incoming file's `submission_document` junction is not inserted until detection clears (no candidate → auto-attach) or the decision resolves. Documents are held off-slot exactly like plan sets — **no live duplicate ever appears**. `version`/`replace`/`promote`/`separate`/`discard` all commit or discard a *held* entity.
- **D16 — "Version it" reuses `/documents/:id/replace`** under the candidate's `document_id`, attaching to the current svn (inherited-vs-owned handling).
- **D17 — `replace` = soft-retire prior version** (kept in history, not current); only `discard` hard-deletes.
- **D26 — Plan-set "version/promote" reuses the `/plan-sets/:id/replace` shape** (existing `plan_set_id` insert) so the v1→v2 sheet-diff engages (Q-planset-lineage resolved).

**Plan sets (P1–P6)**
- **D-P1 — Generic-dropzone plan-set upload with an existing plan set → hold + ask.** (Explicit "Replace plan set" button + first-ever plan set stay direct.)
- **D-P2 — Both documents and plan sets hold off-slot while awaiting a decision** (v3: symmetric with D15). The plan set is parked at a `pending/…` key; the document has its junction deferred. Only remaining difference: plan sets are single-slot (no `separate`).
- **D-P3 — Three `question_type`s** (`doc_version_or_separate`, `plan_set_version_or_discard`, `doc_is_plan_set_version`); plan-set option set has no "separate."
- **D-P4 — Cross-type doc→plan-set detection is in v1** (misclassification-as-document fix); compares against the current-live plan set, excludes same-zip siblings (no race). The reverse (plan-set matching a document) is deferred.
- **D-P6 — Always ask when a prior plan set exists;** the similarity score only phrases the prompt.

**Interaction / infra**
- **D18 — No decision timeouts.** A decision persists until answered; the UI makes it clearly unanswered. Never auto-defaults (overrides the clarifying-questions safe-default rule).
- **D19 — A held file is fully processed but off-slot** (not in the live set) while `awaiting_decision`; it surfaces as a pending job needing input. (v3: revised from "fully usable" — the whole point of the off-slot hold is that the held file is *not* live until resolved.)
- **D20 — Non-blocking surfacing:** a per-file banner + a submission-level "N files need input" aggregate; `Lightbox` on click. Non-blocking to siblings and the rest of the page (the held file itself waits off-slot). (C2)
- **D21 — Deploy substation first** (tables + publication + writes), cityhall reads after; **no backfill** — cityhall renders cards with or without an owning job (legacy data).
- **D23 — No byte-% upload bar** (drop the `XMLHttpRequest` swap); the job-row "Uploading…" state suffices.

---

## 9. Scope boundaries & suggested phasing

- **Phase A — Loading spine (Change 1).** `file_upload_job` table + Realtime publication; write it through prepare→commit→process→zip-fan-out; cityhall subscribes and renders the job/zip tree. No decisions yet (junction still inserted as today). Independently shippable; immediately kills windows #2–#3 and shows "Uploading…" for #1.
- **Phase B — HITL decisions (Change 2), incl. plan sets.** `file_upload_decision` table; the flavor-routed detection step (text Jaccard for docs, visual for sheets, doc→plan-set cross-type); the off-slot hold (defer the junction insert); the resolve endpoint + outcome mapping; cityhall `question_type` components + per-file banner + submission-level aggregate. Depends on A. **Pre-build spike: validate detection thresholds on ~10 real resubmittal pairs.** Could sub-split doc-only then plan-set if needed.
- **Out (v1):** similarity-threshold perfection; the reverse cross-type (plan-set→document); resumable/chunked uploads (Q9); a stuck-processing watchdog (D7); byte-% upload bar (D23); `content_hash` (D22); replacing per-entity `processing_state`; conductor/review changes.

---

## 10. Relationship to the clarifying-questions spec

`../new-features/clarifying-questions/DESIGN-SPEC.md` framed the same HITL need as two contexts: a **sync 409** at `commit-upload` (its MVP) and an **async `preprocessing_question` + `waitForEvent`** path. This spec **adopts the async/durable path as the single backbone** and generalizes it:

- `preprocessing_question` → **`file_upload_decision`** (typed, race-safe, auditable).
- `kind` → **`question_type`**; its example kinds (`plan_set_conflict`, `zip_winner`, `classification_boundary`) become future `question_type`s on the same transport. Note its `plan_set_conflict` is effectively realized here as `plan_set_version_or_discard` (D-P1).
- Its **safe-default + timeout** principle is **overridden** — D18 chooses no timeouts (a decision persists until answered; the held file waits off-slot meanwhile).
- The sync-409 approach is **not** used (detection is post-processing and zip children are async). **Q-merge: formally fold clarifying-questions into this spec, or keep it as the record for any future sync-409 cases?**

---

## 11. Open questions / TODOs

**Resolved** (kept for the audit trail): byte-% bar → out (D23); exact-dup `content_hash` → dropped (D22); decision timeout → none (D18); blocking-UX → non-blocking banner + aggregate (D20); plan-set inclusion → in, cross-type (D-P1–D-P6); detector → flavor-routed (D24, text+visual); goal-vs-mechanism (live duplicate) → off-slot hold / attach-on-resolve (D15); ordering race → none, compares against current-live plan set excluding same-zip siblings (D-P4); **Q-planset-lineage → resolved, reuse `/replace` existing-`plan_set_id` shape (D26)**; one-decision-per-file → argmax (D25); stale `replaceExistingPlanSet` citation → fixed (Appendix).

**Still open:**
- **Q-detection — Threshold tuning (least-settled).** The text-Jaccard propose cutoff, the visual ~0.7 cutoff, the "looks identical" messaging cutoff (~0.98), N (first pages), the text-density router threshold, and the cross-type doc→plan-set cutoff all need calibration against real resubmittals. **Do the ~10-pair spike before building Phase B detection.**
- **Q-textextract — Text-layer extraction dependency.** substation's existing `dv-inventory` is LLM-based; a non-LLM text extractor for the Jaccard route is likely net-new (trivial). Confirm the lib and how it behaves on image-only PDFs (→ routes to visual fallback).
- **Q-crosstype-reverse — Reverse cross-type deferred.** An incoming *plan set* that matches an existing *document*. Rare; not in v1.
- **Q-RLS — RLS on both tables** — project-member read; who may answer (any project member with write? role-gated?).
- **Q-migration — No backfill.** Historical `document_version`/`plan_set_version` rows have no owning job. Confirm cityhall renders cards with or without a job (D21).
- **Q-heldplanset-score — Scoring a held plan set.** To phrase the `plan_set_version_or_discard` prompt with a similarity %, the incoming plan set's first-N sheets must be rasterized (off-slot, not promoted) to compare against the existing plan set. Confirm the rasterize-without-promote step.
- **Q-idempotency — Inngest replay.** Job/decision writes (and the deferred junction insert) from inside `process-file` steps must be replay-safe (the zip fan-out already returns child events rather than sending inside a step, `zip.ts:181-191`) — mirror that discipline.
- **Q9 — Resumable uploads.** Large-file robustness (tus/signed multipart) — named, not built.
- **Q-merge — Fold in the clarifying-questions spec** or keep it as the record for future sync-409 cases (see §10).

---

## Appendix — verified references

**⚠ Citation caveat (re-verified 2026-08-25).** `replaceExistingPlanSet` and `src/lib/plan-set-collision.ts` **do not exist** in `substation` or `cityhall` (grep, zero hits). Prior drafts cited them as the plan-set collision precedent; the real precedent is the `POST /plan-sets/:id/replace` route. Line numbers elsewhere in this spec drifted since v1 — treat them as anchors to re-confirm, not gospel. `storage-keys.ts` `planSetSourceKey` was **not** re-verified in this pass; confirm the exact helper before relying on the `pending/…` off-slot key.

- **Prod trace:** app project `mgxqsrjutswbciyrltwd`; submission `1eb513c1-…`, v2 `submission_version` `90aa50f0-…`; zip at `…/uploads/e34602ed-…/TestProjFromLamarCollier-v2-files.zip` (`129,225,659` B); plan-set child `PLAN_SET__1700 S Lamar Plan Set.pdf` (`124,211,871` B), `plan_set_version` `218c8596-…`, `…/plan-set/v2/source.pdf`; new plan_set `437b621e-…` (v1's was `3560309c-…`).
- **substation:** `src/inngest/functions/process-file/main.ts` (switch); `src/lib/classify.ts:11-29` (`PLAN_SET_THRESHOLD_PTS=792`, strict `>11″` at `:21`); `src/inngest/functions/process-file/zip.ts` (`processZip:42-287`, `registerFile:185-214` mints fresh `plan_set` via `crypto.randomUUID()`); `src/routes/submissions.ts` (prepare `520-577`, commit `580-751`, `handlePlanSetUpload`, carry-forward `POST /versions` `227-246`, `handleDocumentUpload` — junction insert at `submission_document`); `src/routes/documents.ts:68-218` (`/replace`, junction re-point `127-193`); **plan-set lineage:** `src/routes/plan-sets.ts:222-238` (`/replace` inserts `plan_set_version` under existing `plan_set_id` + junction link + `process-file` dispatch), `src/inngest/functions/process-file/plan-set.logic.ts:24-39` (`fetchPriorVersion` keys on shared `plan_set_id`, different `submission_version_id`), `src/inngest/functions/process-file/plan-set.ts:117-192` (v1-vs-v2 branch); **detection reuse:** `src/inngest/lib/sandbox/similarity.ts` (`computeSheetSimilarity`), `src/inngest/functions/process-file/match-sheets.ts` (`matchSheets`, `MIN_MATCH_SIMILARITY=0.5`), `src/inngest/functions/process-file/document.ts:80-99` (per-page JPEG persistence); **schema:** `supabase/migrations/00000000000000_baseline.sql` — `submission_document:697-701` (junction, PK, no status col), `plan_set:452-459`, `plan_set_version:473-489` (`plan_set_id` FK, `idx_plan_set_version_plan_set_id:487`), `submission_plan_set:683-687`; realtime publication `supabase/migrations/20260427230000_add_realtime_tables.sql`; `upload_token` `supabase/migrations/20260426181238_upload_token.sql`. **No content-hash column on any pipeline table; no Inngest `publish()`; one-plan-set invariant is convention-only (no DB constraint); `replaceExistingPlanSet` does not exist.**
- **cityhall:** upload PUT `src/routes/(app)/project/[projectId]/submission/[submissionId]/+page.svelte:329-342` + `src/lib/intake/upload.ts:62-66`; upload state enum `+page.svelte:246-253`; Realtime `+page.svelte:436-481`, `src/lib/realtime.svelte.ts`; feasibility-intake pending-action loop `…/intake/[conversationId]/+page.server.ts:261-302` + `+page.svelte:445-482`; `Lightbox` `src/lib/ui/elements/Lightbox.svelte`; RCM registry `src/lib/rcm/components.ts`; upload proxies `…/prepare-upload/+server.ts`, `…/commit-upload/+server.ts`.
