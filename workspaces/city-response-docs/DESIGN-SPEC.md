# City Response Documents

**Status:** Draft v1
**Date:** 2026-09-03
**Repos touched:** `substation` (migration: new `document.city_response_type` column + `'city_response'` kind convention, RLS unchanged; new commit endpoint), `cityhall` (submission-page footer button + City Response section; document-page simplified viewer branch)
**Repos NOT touched (MVP):** `conductor`, `bureau`, `claude-plugins` (the `generate-crc-guides` skill rewire is a documented fast-follow, not part of this PR)

## Problem

Today, after a civil engineering firm submits a site plan to the City of Austin, the city sends back response documents — a **Master Comment Report (MCR)** and, per department, **redline PDFs**. These are the inputs the Comment Resolution Check (CRC) workflow is built around: `generate-crc-guides` turns an MCR into per-department checklist guides, and `generate-crc-guides-from-redlines` does the same from a redline PDF.

But there is **no place in the Noetic app to store the city's response to a submission**. The city-response PDFs live only on operators' laptops. Consequences:

- `generate-crc-guides` takes the MCR as a **local file path** hand-fed by the operator (`claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/pipeline.md:132` copies `{user-supplied-path}` into the generation dir). There is no DB/storage source of truth for the MCR.
- There is no UI to view what the city sent back against a given submission.
- Nothing associates a city response with the specific **city submission** it answers, even though the data model already tracks city submissions: `submission_version.city_submission_number` (nullable INT; `submitted → 1`, next city submission → 2, …), added in `substation/supabase/migrations/20260720203333_jurisdiction_slug_and_city_submission_number.sql`.

This spec adds the ability to **attach, view, and (for CRC) fetch** city response files against any submission version that has been submitted to the city.

### Verified facts this design rests on

Grounded in the current schema and app code (read 2026-09-03):

- **`document`** (`substation/supabase/migrations/00000000000000_baseline.sql:584`): `id`, `project_id` (NOT NULL FK → `project`, `ON DELETE CASCADE`), `name` (NOT NULL), `label` (nullable), `kind` (TEXT NOT NULL — **no enum**; today only `'document'` and `'binary'`), `created_at`, `updated_at`. **There is no `type` column.** The discriminator is `kind`.
- **`document_version`** (`baseline.sql:605`, extended by later migrations): NOT NULL FKs to `document_id` and `submission_version_id` (`ON DELETE CASCADE` on both). `storage_path` (NOT NULL), `file_name` (NOT NULL), `mime_type`, `file_size`, `content_sha256`, `processing_state`, etc. Unique `(document_id, submission_version_id)`. **This is the only place a `document` links to its bytes and to a submission version** — `document` itself has neither a storage pointer nor a `submission_version_id`.
- **`document_section`** (`baseline.sql:630`) and **`document_section_attachment`** (`20260529120000_document_section_attachment.sql`): genuinely optional children. Sections are only created by the LLM inventory step and are skipped entirely when `preProcessingV2=true` (`substation/src/inngest/functions/process-file/document.logic.ts`). Nothing breaks if a `document_version` has zero sections.
- **`submission_document`** (junction: `submission_version_id`, `document_version_id`): this is what makes a document appear in the plan-set page's "documents" list. Documents that are NOT inserted here stay out of that list.
- **`submission_version`** (`baseline.sql:664`): `version_number` (NOT NULL, 1-based per submission), `city_submission_number` (nullable INT), `status`, `submitted_at`. Unique `(submission_id, city_submission_number) WHERE city_submission_number IS NOT NULL`.
- **Document creation today** (`substation/src/routes/submissions.ts:1370`): the upload-commit path inserts `document` → `document_version` → `submission_document` junction, then fires the Inngest `process-file` event (rasterize/optimize/inventory/sections). We deliberately bypass all of this.
- **Submission page** (`cityhall/src/routes/(app)/project/[projectId]/submission/[submissionId]/+page.svelte`): the `[submissionId]` route param is the **`submission.id`**, not a version id (`+page.ts:74`). The page resolves an **active version** from `?v=`/`?svn=` (or defaults to the latest non-archived version — `+page.ts:82`). Sticky footer at `+page.svelte:1110-1118` currently has a single "Add files" button. Plan Set section renders from `data.planSets` at `+page.svelte:775`.
- **Document page** (`cityhall/src/routes/(app)/project/[projectId]/document/[documentId]/+page.svelte`): loads `document` + `document_version` + embedded `document_section` (`+page.ts:15-29`), renders sections/version-selector/PPv2 badge/reprocess. Only existing `kind` branch is `kind === 'binary'` for a failed-state icon (`+page.svelte:289`). Adding a `kind === 'city_response'` branch fits the existing pattern.
- **CRC fetch pattern** (`bureau/workflows/comment-resolution-check/scripts/fetch-crc-guides.ts`): CRC already talks to Supabase directly with a service-role client and lists storage prefixes (`supabase.storage.from(bucket).list(prefix)`). A city-response fetch mirrors this — no new API surface needed.
- **Storage** (`baseline.sql:2108`): the `submission-data` bucket is private, project-scoped by RLS on the first path segment (`storage.foldername(name)[1] = projectId`), and already allows `application/pdf`, `image/*`, `application/zip`, `application/octet-stream`.

## Goals / Non-goals

**Goals (MVP, this PR):**
1. Attach one-or-more city response files to a **city-submitted** submission version (gated on `city_submission_number IS NOT NULL`).
2. Store them as `document` rows (`kind='city_response'`) with a sub-type (`mcr|redlines|misc`) chosen at upload.
3. View them in a new "City Response" section above Plan Set, and on a simplified per-document page.
4. Make them **fetchable** from the DB/storage by CRC, with a pinned query + path contract.

**Non-goals (deferred):**
- **ZIP upload + auto-type detection** → **Phase 2** (§7). MVP is single files with a manual sub-type picker.
- **Rewiring `generate-crc-guides` / `generate-crc-guides-from-redlines`** to pull from the DB → fast-follow in `claude-plugins` (§6). This PR ships the contract; the skill adopts it independently.
- **Any Inngest processing** (rasterize, optimize, LLM inventory, sections, PPv2, classification) → not in MVP; a clean event seam is left for Phase 2.
- **Version history** for a city-response doc — a response to U0 and a response to U1 are **separate `document` objects**, each with exactly one `document_version`.

## Data model

### Decision: reuse `document` + exactly one `document_version` (D23, Option A)

A city-response file is stored as:

```
document (kind='city_response', city_response_type='mcr'|'redlines'|'misc')
  └─ document_version   (exactly ONE, ever — the file-carrier row)
        · storage_path, file_name, mime_type, file_size
        · submission_version_id  → the city-submitted version being responded to
        · NO document_section, NO document_section_attachment
        · NOT inserted into submission_document
```

The single `document_version` row is a **file carrier, not a version**. We never create a second one for the same `document`. "No versioning" (your Q2/Q5 intent) is satisfied: a response to U0 and a response to U1 are two distinct `document` objects. This is exactly the "use `document_version` only for the linkage" option floated in grilling (Q4), and it is preferred over adding storage columns to `document` (Option B) because it reuses the existing document-page loader and CRC's `document_version` fetch patterns unchanged.

`document.project_id`, `document_version.storage_path`, `document_version.file_name`, and `document_version.submission_version_id` are all NOT NULL and all naturally populated. `document.label` (nullable) is the human-editable display name (rename). `document_version.processing_state` is left `NULL` (or set to a sentinel `'stored'` — see Q-A).

### Schema change: `document.city_response_type`

One new nullable column on `document`:

```sql
ALTER TABLE public.document
  ADD COLUMN city_response_type TEXT
  CHECK (city_response_type IN ('mcr','redlines','misc'));
```

- **Nullable, and NULL for every non-city-response document** (D25). It is a sub-discriminator only meaningful when `kind='city_response'`.
- Optionally enforce coherence with a CHECK: `(kind = 'city_response') = (city_response_type IS NOT NULL)` — see Q-C.
- `kind` stays the single UI gate (`kind === 'city_response'`); the sub-type drives CRC routing and future auto-classification, not UI branching (D25).

**No enum type** — `kind` remains free TEXT (consistent with the existing table); `city_response_type` uses a CHECK constraint rather than a Postgres enum, to stay migration-light and match the table's existing convention.

### Integrity (D24)

`document_version.submission_version_id` is `ON DELETE CASCADE`. A city-submitted `submission_version` is **not deletable** under existing RLS (delete is restricted to draft v2+ — `baseline.sql:1646`), so the cascade cannot orphan a `document`. We add no extra integrity machinery. (If a future change ever makes city-submitted versions deletable, the orphaned-`document` risk must be revisited — noted as Q-D.)

### RLS (D12)

**Unchanged.** Reuse the existing `document` / `document_version` policies (project-access read; write-access insert; admin delete — `baseline.sql:1567-1595`). City-response docs are ordinary `document` rows from RLS's perspective. No new policies.

## Storage

- **Bucket:** reuse `submission-data` (D14) — already private and project-scoped by RLS on the first path segment. No new bucket, no new policies.
- **Path convention (pinned, D34):**
  ```
  submission-data/{projectId}/city-response/{submissionVersionId}/{documentId}/{filename}
  ```
  Keyed by `documentId` so per-doc deletes and CRC listing are unambiguous and collision-free. The `city-response/` segment keeps these visually and operationally separate from plan-set/submission-doc paths, while the leading `{projectId}` keeps existing bucket RLS working with zero change.

## Upload flow (MVP: single files)

Reuse the existing signed-URL step; add a dedicated commit endpoint that skips classification + Inngest (D13, D31, D32).

1. **Prepare** — reuse the existing content-agnostic `prepare-upload` endpoint to mint a signed PUT URL.
2. **PUT** — client uploads bytes directly to the signed URL.
3. **Commit** — **new** `POST /project/[projectId]/submission/[submissionId]/commit-city-response`:
   - **Request body** carries `submission_version_id` **explicitly** (D31) — it is NOT derivable from the route's `[submissionId]` (that param is `submission.id`, and a submission has many versions; the page's active version is chosen by query param). Body shape:
     ```jsonc
     {
       "submission_version_id": "<uuid>",   // the active, city-submitted version
       "files": [
         { "storage_path": "...", "file_name": "MCR.pdf", "mime_type": "application/pdf",
           "file_size": 123456, "city_response_type": "mcr" }
       ]
     }
     ```
   - **Server actions per file:**
     1. Assert the target `submission_version` has `city_submission_number IS NOT NULL` (server-side gate — D9). Reject otherwise.
     2. Insert `document` (`project_id`, `name`=file_name, `kind='city_response'`, `city_response_type`).
     3. Insert exactly one `document_version` (`document_id`, `submission_version_id`, `storage_path`, `file_name`, `mime_type`, `file_size`; `processing_state` NULL/`'stored'`).
     4. **Do NOT** insert `submission_document`; **do NOT** fire Inngest.
   - **Allowed MIME/extensions (MVP):** PDF, DOCX, TXT (D15). Validate server-side.
   - **Future-Inngest seam (D13/D31):** the endpoint is the single place a `city-response.uploaded` event would later be emitted for auto-classification. MVP emits nothing.

Client wiring mirrors the existing 3-step flow already in `submission/+page.svelte`, but calls `commit-city-response` and passes the operator-selected `city_response_type` per file.

## UI

### Submission page (`.../submission/[submissionId]/+page.svelte`)

- **Footer button (D16):** add a second sticky-footer button **"+ Add City Response Files"** next to "Add files" (`+page.svelte:1110-1118`), **rendered only when the active version's `city_submission_number IS NOT NULL`**. Opens an upload modal with a per-file sub-type picker (MCR / Redlines / Other → `misc`, default `misc` — D26).
- **City Response section (D17):** a new section **above** the Plan Set section, listing city-response docs for the **active version** as clickable cards (name, sub-type badge, uploaded date). Delete affordance per card (D11).
- **Query for the section:** `document` where `project_id = :p AND kind='city_response'`, joined to its single `document_version` where `submission_version_id = :activeVersionId`. **Not** via `submission_document` (D5), so it never collides with the plan-set docs list.
- **Refresh (D22):** invalidate-on-upload only. **No Realtime subscription** — uploads complete synchronously (no async pipeline to stream).

### Document page (`.../document/[documentId]/+page.svelte`)

- **Branch on `kind === 'city_response'`** (D18) → a **simplified viewer**: name, sub-type badge, uploaded date, delete, and a raw-file view (no sections, no version selector, no PPv2 badge, no reprocess).
- **Per-type rendering (D30):**
  - **PDF** → inline embed via signed URL to the raw uploaded file (D7 — no derived `optimized.pdf`/`pages/*.jpg` exist for these).
  - **TXT** → inline `<pre>` render + Download.
  - **DOCX** → icon + filename + Download (no inline render; no conversion pipeline).
- **Loader note:** the existing loader builds preview/PDF URLs from `{basePath}/pages/1.jpg` and `{basePath}/optimized.pdf` (`document/+page.ts:51-78`). For `kind='city_response'` the loader must **skip** that derivation and sign the raw `storage_path` directly. Guard the derived-asset logic behind `kind !== 'city_response'`.

## CRC integration (contract only; skill rewire deferred)

This PR ships the **fetchable model + documented contract** (D19). The `generate-crc-guides` / `generate-crc-guides-from-redlines` skill changes are a separate `claude-plugins` fast-follow.

**Fetch contract (D20, D33)** — mirrors `fetch-crc-guides.ts` (direct Supabase + service-role, storage list/download):

1. Resolve `project_id` + target `submission_version_id` (CRC already resolves `project → submission → submission_version`).
2. Query:
   ```
   document
     WHERE project_id = :projectId AND kind = 'city_response'
   JOIN document_version dv ON dv.document_id = document.id
     WHERE dv.submission_version_id = :submissionVersionId
   RETURN { document_id, city_response_type, storage_path, file_name }
   ```
3. **Route by sub-type (D27):** `mcr` → `generate-crc-guides`; `redlines` → `generate-crc-guides-from-redlines`; `misc` → stored + viewable but **not auto-consumed**.
4. Sign + download each `storage_path` from `submission-data`.

The skill would drop its "operator supplies a local MCR path" step in favor of this query. Because it reads Supabase directly today, no new API endpoint is required.

## Phase 2 (deferred — ZIP + auto-type detection, bundled)

Per D28/D29, ZIP and auto-classification ship **together**, so users never hand-classify a zip's contents:

- A dedicated lightweight Inngest function (e.g. `process-city-response-zip`) unzips → creates one `document` (+ one `document_version`) per extracted file.
- The same (or a sibling) function auto-detects each file's `city_response_type` (MCR vs redlines vs misc) — the classification the future-Inngest seam in the commit endpoint anticipates.
- This is the only part that requires async infra; keeping it out of MVP preserves the "no processing" property and a small first PR.

## Deploy order (D21)

1. **substation** first: migration (new `document.city_response_type` column + CHECK) **and** the `commit-city-response` endpoint.
2. **cityhall** second: footer button, City Response section, document-page viewer branch — depends on the endpoint + column existing.

No data backfill required (net-new capability).

## Decision log

Condensed from the grilling session; full rationale in the numbered answers.

- **D2/D3/D23** Reuse `document` + `kind='city_response'`; bytes+linkage live in exactly one `document_version` (Option A).
- **D4/D5** Bind via `document_version.submission_version_id`; do **not** use `submission_document`.
- **D6/D7/D8** No Inngest processing; raw-file viewer; one file → one `document` → one `document_version`, no version history.
- **D9** Gate the whole feature on active version's `city_submission_number IS NOT NULL`.
- **D10/D11** Multiple docs per version; delete + relabel (`document.label`), no reorder/versioning.
- **D12** Reuse existing `document` RLS unchanged.
- **D14/D34** Reuse `submission-data`; path `{projectId}/city-response/{submissionVersionId}/{documentId}/{filename}`.
- **D15** MVP file types: PDF/DOCX/TXT (single files); ZIP deferred.
- **D16/D17/D18/D30** Footer button (gated), section above Plan Set, `kind`-gated simplified viewer, per-type rendering.
- **D19/D20/D27/D33** CRC gets a documented direct-Supabase fetch contract, routes by sub-type; skill rewire deferred.
- **D21/D22** substation before cityhall; invalidate-on-upload, no Realtime.
- **D25/D26** `document.city_response_type` (`mcr|redlines|misc`), NULL for non-city-response; user-picked at upload, default `misc`.
- **D28/D29** ZIP + auto-type detection ship together as Phase 2.
- **D31/D32** Dedicated `commit-city-response` with explicit `submission_version_id`; reuse `prepare-upload` for the signed PUT; Inngest event seam left, unused in MVP.

## Open questions

- **Q-A** `document_version.processing_state` for city-response rows: leave `NULL`, or set a sentinel `'stored'` so it's distinguishable from genuinely-unprocessed submission docs? (Rec: `'stored'` for clarity.)
- **Q-B** Does any existing query assume `kind='city_response'` docs are absent (e.g. a project-wide `document` listing, sidebar "Documents", or a count) that would now surface city-response rows unexpectedly? Needs a grep sweep in cityhall before merge.
- **Q-C** Enforce `(kind = 'city_response') = (city_response_type IS NOT NULL)` as a table CHECK, or leave it application-enforced? (Rec: table CHECK — cheap invariant.)
- **Q-D** If city-submitted versions ever become deletable, the `document_version → submission_version` cascade orphans the `document`. Revisit then (currently impossible per RLS).
- **Q-E** DOCX/TXT to CRC: `generate-crc-guides` expects a PDF. When a `misc`/`mcr` doc is DOCX/TXT, does CRC need a conversion step, or is MCR-as-PDF a safe assumption? (Likely fine — MCRs are always PDFs — but flag for the skill fast-follow.)
- **Q-F** Should the "+ Add City Response Files" button also be reachable from the document/sidebar surfaces, or submission-page-only in MVP? (Rec: submission-page-only.)
