# Upload-time document preprocessing pipeline — current-state inventory

Point-in-time code recon, 2026-08-13. File:line references were verified on that date;
re-verify anything load-bearing before building on it.

## 0. One-paragraph shape

Browser (cityhall) → `prepare-upload` (signed PUT) → PUT to Supabase Storage → `commit-upload`
(substation Hono API: byte-sniff classify + DB rows) → `inngest.send({name:'process-file'})` →
Inngest function `process-file` boots **one Vercel Sandbox per top-level file** (Ghostscript /
Poppler / bsdtar / sharp snapshot) → branches on classification (plan_set / document / zip /
binary). Mechanical work (optimize, rasterize, split, extract, similarity, overlay) happens
*inside* the sandbox; **every AI call happens in the substation Node/Inngest process**, not in
the sandbox, via AI SDK model strings routed through Vercel AI Gateway. Sheet-level AI work is
fanned out as a child Inngest function `process-file/sheet` (one invocation per sheet, sharing
the parent's sandbox).

---

## 1. Where the code lives & how it's triggered

### Entry points (UI → API)
| Item | Path |
|---|---|
| Drag-drop handler + 3-step upload | `cityhall/src/routes/(app)/project/[projectId]/submission/[submissionId]/+page.svelte:254-345` (`handleFiles`), page-level drag at `:353-368`, `ondrop` wired `:471-474` |
| Proxy: prepare | `cityhall/.../submission/[submissionId]/prepare-upload/+server.ts` |
| Proxy: commit | `cityhall/.../submission/[submissionId]/commit-upload/+server.ts` |
| Dead legacy endpoint | `cityhall/.../submission/[submissionId]/upload/+server.ts` (throws 410) |
| Intake-chat variant (skips this pipeline) | `cityhall/src/lib/intake/upload.ts:40-104` — passes `document_kind:'intake_attachment'` which sets `skipProcessing` |
| Manual re-kick of pending/failed | `cityhall/.../submission/[submissionId]/process/+server.ts` → substation `POST .../plan-sets/:id/process` and `.../documents/:id/process` |
| Sheet reprocess | `cityhall/.../plan-set/sheet/[sheetNum]/reprocess/+server.ts` — **stubbed, throws 501** |

### Substation API
- `substation/src/routes/submissions.ts:495-549` — `prepare-upload`: creates `upload_token`
  row, filename sanitization (`:517-520`), storage path `{projectId}/uploads/{uploadId}/{safeName}`,
  1-hour signed PUT.
- `substation/src/routes/submissions.ts:555-690` — `commit-upload`: token claim (TOCTOU-safe,
  `:606-621`), downloads bytes and calls `classifyFile` (`:643-657`), dispatches to one of
  three handlers.
- `substation/src/lib/classify.ts:11-29` — **deterministic, non-AI classification**: ZIP magic
  `PK`, `%PDF` magic + first-page min-dimension > 792 pt ⇒ `plan_set`, else `document`;
  non-PDF/zip ⇒ `binary`.
- Handlers + Inngest dispatch: `handlePlanSetUpload` `submissions.ts:752-802`,
  `handleZipUpload` `:804-857`, `handleDocumentUpload` `:859-921`.
- Re-process endpoints: `substation/src/routes/plan-sets.ts:266-312`,
  `substation/src/routes/documents.ts:220+`.

### Inngest event names & function registry
- `substation/src/inngest/functions/index.ts:17-89` — event type map. Relevant:
  **`process-file`**, **`process-file/sheet`**, `process-drainage-model`, `workflow/run`,
  `webhook/conductor.complete`, `feasibility_intake/*`.
- Client: `substation/src/inngest/client.ts` (`id: 'Substation'`).
- Orchestrator: `substation/src/inngest/functions/process-file/main.ts` — `id:'process-file'`,
  `timeouts.finish:'60m'`, `onFailure` at `:47-77`.
- Child: `substation/src/inngest/functions/process-file/sheet.ts:29-51` —
  `id:'process-file/sheet'`, `timeouts.finish:'15m'`, own `onFailure`.

### Sandbox launch
- `substation/src/inngest/lib/sandbox/processing.ts:12-36` — `createProcessingSandbox()`:
  `Sandbox.create({source:{type:'snapshot',snapshotId: PROCESSING_SNAPSHOT_ID},
  resources:{vcpus:4}, timeout: 60m, persistent:false})`. Returns `sandbox.name`.
- `substation/src/inngest/lib/sandbox/get.ts:20-22` — re-attach with `resume:false`.
- Snapshot build: `substation/scripts/create-processing-snapshot.ts` — `apt install
  ghostscript poppler-utils bsdtar` (`:29-33`); npm-installs `ai@^6`, `@ai-sdk/gateway`,
  `zod`, `sharp` into `/vercel/sandbox/workspace/scripts` (`:52-77`). **Only `sharp` is
  actually used in-sandbox today** (similarity + overlay scripts); `ai`/`zod` are vestigial
  there.
- Sandbox lifecycle: created once per top-level file in `main.ts:87`, reused for zip children
  via `data.sandboxId`, stopped in `finally` only if top-level (`main.ts:174-178`).

---

## 2. Mechanical (non-AI) steps

All in `substation/src/inngest/lib/sandbox/processing.ts` unless noted.

| Step | Function | Line | Tool / detail |
|---|---|---|---|
| Download from Storage → sandbox | `downloadToSandbox` | `:54-71` | Supabase `submission-data` bucket → `sandbox.writeFiles` |
| PDF optimize | `optimizePdf` | `:122-146` | Ghostscript `pdfwrite`; args in `processing-args.ts:1-16` (300 dpi color/gray, 600 mono, JPEGQ 95) |
| Rasterize (also the **page-count source of truth**) | `rasterizePdf` | `:276-311` | Poppler `pdftoppm -r 150 -jpeg quality=90`; renames `page-01.jpg` → `1.jpg` (`:299-308`) |
| Split into per-sheet PDFs | `splitPdf` | `:148-189` | Ghostscript `-dFirstPage/-dLastPage` per page (`processing-args.ts:18-25`), then **pdf-lib rotation fix** to strip stale `/Rotate` (`:177-185`) |
| Page-count derivation | `splitPdf` | `:160-165` | Counts the `.jpg` files rasterize produced; **throws if rasterize didn't run first** |
| Upload artifacts back | `uploadFromSandbox` | `:73-88` | `upsert:true` into `submission-data` |
| Directory listing | `listSandboxFiles` | `:90-99` | `ls -1` + suffix filter |
| Change overlay (v2+) | `generateChangeOverlay` | `:196-274` | `pdftoppm` old sheet at 150 dpi, then an **inline `sharp` script written into the sandbox** producing red=added / blue=removed / faded=unchanged JPEG at 2400×1600 |
| Sheet-to-sheet visual similarity (v2+) | `sandbox/similarity.ts:8-93` | | inline `sharp` script; 256×170 greyscale; `max(normalized cross-correlation, content-pixel match rate)`; **skips silently if the old thumbnail is absent** (`:25-26`), and **drops the pair with no error if the node script exits non-zero** (`:83`) |
| Sheet matching (pure) | `process-file/match-sheets.ts` | | consumes similarity rows → added/modified/unchanged |
| Zip listing | `process-file/zip.ts:35-48` | | **`bsdtar -tf`** deliberately, not `unzip` (streaming SharePoint/OneDrive zips have no readable central directory); sizes deliberately not requested |
| Zip extract | `zip.ts:92-103` | | `bsdtar -xf --no-same-owner` |
| Zip path-traversal guard | `zip.ts:276-282` | | `safeSandboxPath` |
| Zip child registration + storage upload | `zip.ts:165-274` (PDFs), `:284-375` (drainage models) | | re-runs `classifyFile` on extracted bytes; bytes can **promote** an LLM-labelled `document` to `plan_set` (`:182-183`) |

Storage layout written: `{projectId}/plan-sets/{id}/v1/source.pdf`, `.../optimized.pdf`,
`.../sheets/{n}.pdf`, `.../sheets/{n}.jpg`; documents: `.../documents/{id}/v1/{name}`,
`.../pages/{n}.jpg`.

### Plan-set flow order (`plan-set.ts:24-316`)
1 set `processing` → 2 download → 3 optimize (best-effort) → 4 rasterize → 5 split →
6 upload optimized + all `n.pdf`/`n.jpg` → 7 fetch prior version → 8a v1 manifest **or**
8b download prior thumbs, per-sheet similarity, match, v2 manifest → 9 `step.invoke`
`process-file/sheet` per sheet needing processing (parallel) → 10 plan-set title block LLM →
11 project-facts refresh (v2+ only) → 12 mark processed + `change_summary`.

### Document flow (`document.ts:16-139`)
set processing → download → optimize → rasterize to `pages/` → upload optimized + page JPEGs →
LLM inventory → save sections → mark processed.

---

## 3. Every AI call in the pipeline

Model constants: `substation/src/inngest/lib/models.ts` — `GEMINI_MODEL =
'google/gemini-3.1-pro-preview'`, `HAIKU_MODEL = 'anthropic/claude-haiku-4.5'`. Bare provider
strings ⇒ Vercel AI Gateway. All prompts live in
`substation/src/inngest/lib/prompts/processing.ts` (392 lines).

| # | What it does | Function / file | Call | Model | Prompt | Writes |
|---|---|---|---|---|---|---|
| 1 | **Sheet naming + page summary** (`{summary, sheetLabel}`) from the single-page PDF | `extractPageSummary` — `sheet.llm.ts:70-94`; invoked `sheet.ts:97-133` | `generateObject` | Gemini, `mediaResolution: HIGH`, `thinkingLevel:'low'` | `pageSummaryPrompt:1` | `sheet_version.summary`, `sheet_version.label`, **and** `sheet.label` (deliberately both, `sheet.ts:102-123`) |
| 2 | **Block discovery / bounding boxes** — categories + `[ymin,xmin,ymax,xmax]` normalized 0-1000, from the **thumbnail JPEG** | `discoverContentBlocks` — `sheet.llm.ts:96-117`; invoked `sheet.ts:214` | `generateObject` | Gemini, HIGH | `blockDiscoveryPrompt:14` | (feeds #3) |
| 3 | **Block transcription** (batched, one call for all blocks) from the **PDF** | `extractBlockDetails` — `sheet.llm.ts:119-139`; invoked `sheet.ts:223` | `generateObject` | Gemini, HIGH | `buildBatchBlockPrompt` (`sheet.logic.ts:130-148`) + `blockDetailsBasePrompt:112` | `content_block` rows (see §4) |
| 4 | **Reading guide** — narrative "how to read this sheet", grounded on the block list | `generateReadingGuide` — `sheet.llm.ts:199-218`; invoked `sheet.ts:260` | `generateText` | Gemini, HIGH | `readingGuidePrompt:143` + `buildBlocksContext` | `sheet_version.reading_guide`, `sheet_version.block_numbering_scheme` |
| 5 | **Sheet comparison** (v2+ only) — change narrative, or the literal string `UNRELATED` to break a version chain | `extractSheetComparison` — `sheet.llm.ts:141-197`; invoked `sheet.ts:173-178` | `generateText` (two variants) | Gemini, HIGH | `sheetComparisonOverlayPrompt:207` when the overlay JPEG exists, else `sheetComparisonPrompt:180`; prior summary appended | `sheet_version.change_description`, or nulls `previous_sheet_version_id` + sets `change_type='added'` |
| 6 | **Plan-set title block** — project/firm/case/PE-seal metadata, from sheet 1's PDF | `extractPlanSetTitleBlock` — `plan-set.llm.ts:30-54`; invoked `plan-set.ts:234` | `generateObject` | Gemini, HIGH, `thinkingLevel:'low'` | `titleBlockPlanSetPrompt:231` | `plan_set_version.title_block_meta` |
| 7 | **Document classification / inventory** — `{title, summary, sections[]}` | `extractDocumentInventory` — `document.llm.ts:24-41`; invoked `document.ts:108` | `generateObject` | Gemini (**no `providerOptions` — default media resolution**) | `docInventoryPrompt:266` | `document.name`, `document.label`, `document_version.summary`, `document_section` rows |
| 8 | **Zip content triage** — groups the `bsdtar -tf` listing into `plan_set` / `document` / `drainage-model` / `skip` | `triageZipContents` — `zip.llm.ts:29-49`; invoked `zip.ts:70` | `generateObject` | Gemini, text-only | `zipTriagePrompt:295` | no DB write; drives registration |
| 9 | **Project-facts refresh** (v2+ plan sets only, cover sheet) — rewrites `facts.md` from `change_description` + cover blocks | `refreshProjectFacts` — `facts-refresh.ts:57+`; invoked `plan-set.ts:281` | `generateObject` | **Haiku 4.5** (the only non-Gemini generative call) | inline `systemPrompt` `facts-refresh.ts:22-53` | `project_facts` + audit via `writeFactsRefreshAudit`; has a deterministic guard that restores `(CONFIRMED)` blocks the model altered (`:77-82`) |
| 10 | **Block embeddings** | `generateBlockEmbeddings` — `lib/embeddings.ts:18-68`; invoked `sheet.ts:315` | `embedMany` | **`openai/text-embedding-3-small`**, batches of 50, text truncated to 30 k chars | — | `content_block.embedding` (vector 1536), `content_block.embedding_text` |
| 11 | Drainage-model analysis (only for zip-registered models) | `process-drainage-model/main.ts:185-215` | `generateObject` | Gemini (local const at `:12`) | `drainageModelAnalysisPrompt:347` | `document.name/label`, `document_version.summary`, `document_section` rows |

**Retired-by-design** (worth knowing for a re-architecture): per-sheet title-block extraction
was deliberately removed — rationale in `sheet.llm.ts:13-23`; `sheet_version.title_block`
still exists but is never written and never carried forward (`plan-set.logic.ts:151-153`).
`totalSheets` was removed from the plan-set title block schema after 50,949-digit runaway
generations (`plan-set.llm.ts:17-22`).

Join-integrity note: transcriptions are joined to bounding boxes **by echoed `blockId`, never
positionally** — `mergeBlockDetails` (`sheet.logic.ts:62-101`) drops entries with
missing/invalid/unknown/**duplicate** ids (duplicates drop *all* claimants).

---

## 4. DB schema written by preprocessing

No Drizzle — plain Supabase SQL migrations at `substation/supabase/migrations/`. Base DDL:
`00000000000000_baseline.sql`. Generated types: `substation/src/types/database.types.ts`,
mirrored in `cityhall/src/lib/types/database.ts`.

| Table | Columns written by preprocessing | Writer |
|---|---|---|
| `upload_token` (`baseline`) | id, submission_version_id, project_id, file_name, file_size, storage_path, expires_at, consumed_at | `submissions.ts:512-527`, `:608` |
| `plan_set` (`baseline:452`) | project_id, name | `submissions.ts:759`, `zip.ts:193` |
| `plan_set_version` (`baseline:473`) | processing_state, source_storage_path, **title_block_meta** (jsonb), **change_summary**, started_at, finished_at, applied_at | `plan-set.ts:42-50`, `:235-238`, `:301-312` |
| `sheet` (`baseline:495`) | plan_set_id, **label** (overwritten every run) | `plan-set.logic.ts:68`, `sheet.ts:123` |
| `sheet_version` (`baseline:512`) | sheet_id, version_number, plan_set_version_id, **storage_path** (per-sheet PDF), **thumbnail_storage_path** (JPEG), **summary**, **reading_guide**, **label** (added `20260803150000`), **change_description**, **change_type**, **similarity_score**, **previous_sheet_version_id**, **block_numbering_scheme** (added `20260708120000`; `'legacy-category-order'` \| `'short-id-ordered'`), processing_state, sheet_number, started_at, finished_at | `plan-set.logic.ts:73-267`, `sheet.ts:119-336` |
| | *never written:* `title_block` (retired), `width_pts`, `height_pts` (columns exist, populated by nothing in this pipeline) | |
| `content_block` (`baseline:558`) | sheet_version_id, **category**, **description**, **content**, **bounding_box** (jsonb `{x,y,width,height}` normalized 0-1), **short_id** (added `20260701140000`), **embedding** vector(1536), **embedding_text** | `sheet.logic.ts:150-169` (delete-then-insert, **one INSERT per block, serial**), `embeddings.ts:48-54` |
| `document` (`baseline:584`) | project_id, name, label, kind (`document`\|`binary`\|`drainage-model`\|`intake_attachment`) | `submissions.ts:875`, `document.logic.ts:17-19`, `zip.ts:235/329` |
| `document_version` (`baseline:605`) | document_id, submission_version_id, storage_path, file_name, file_size, mime_type, **summary**, processing_state, **error_message** (added `20260629230000`), started_at, finished_at | `document.ts:32-137`, `document.logic.ts:21-23`, `main.ts:66-76`, `zip.ts:392-402` |
| `document_section` (`baseline:630`) | document_version_id, title, description, content, page_range, sort_order | `document.logic.ts:25-36` |
| `submission_plan_set` (`baseline:683`), `submission_document` (`baseline:697`) | junctions | `submissions.ts:810/831`, `zip.ts:211/255/351` |
| `processing_event` (`20260427024854_processing_event.sql`) | submission_version_id, plan_set_version_id, document_version_id, sheet_version_id, severity (info/warning/error), step, message, detail | `process-file/log-event.ts:12-34` |
| `project_facts` | content (via `writeFactsRefreshAudit`) | `facts-refresh.ts` |

`bounding_box` normalization (Gemini `[ymin,xmin,ymax,xmax]`/1000 → `{x,y,width,height}` 0-1)
is at `sheet.logic.ts:4-20`. `short_id` = reading-order ordinal (y ASC, x ASC), stamped
**before** transcription so prompt labels, echoed `blockId`, and persisted `short_id` are the
same number (`sheet.logic.ts:22-33`).

---

## 5. Consumers of those fields

### 5a. cityhall UI
| Surface | File | Fields read |
|---|---|---|
| Submission page (status cards, progress, realtime) | `cityhall/.../submission/[submissionId]/+page.ts:143-154`, `:268-370`; `+page.svelte:389`, `:746` | `plan_set_version.processing_state/change_summary`, `document_version.processing_state/error_message` |
| Plan-set index (thumbnail grid + version bar) | `.../plan-set/+page.ts:54`, `:96-104`; `+page.svelte:60,296,348,417` | `sheet_version.thumbnail_storage_path/change_type/similarity_score`, `sheet.label`, `plan_set_version.change_summary/processing_state/title_block_meta` |
| **Sheet detail page — the main blocks/summary renderer** | `.../plan-set/sheet/[sheetNum]/+page.ts:154-164` (select incl. `content_block(...)`), `:174-193` (sort **by category**, parse bbox), `:198-208` (`?block=` short_id deep-link, only honoured when `?sv=` pinned) | `summary`, `reading_guide`, `content_block.{category,description,content,bounding_box,short_id}` |
| Sheet detail rendering | `.../sheet/[sheetNum]/+page.svelte:229-230` (summary), `:357-375` (bbox overlay rectangles), `:437-460` + `:558` (block list + content), `:576-584` (mobile) | |
| Version comparison | `cityhall/src/lib/plan-set/load-comparison.ts:17-23` | `change_description`, prior `thumbnail_storage_path` |
| Sheet history | `cityhall/src/lib/plan-set/load-sheet-history.ts:57-64` | `change_type`, `change_description`, `thumbnail_storage_path` |
| Review evidence chips → lightbox highlight | `.../review/SheetLightbox.svelte:26-42`, `:93-112`, `:285-292` | `content_block.short_id` + `bounding_box`, resolved against pinned `submission_version_id` |
| Chat/agent tools | `src/lib/tools/project/get-doc-details.ts:47-110`, `semantic-search.ts:128-141` (RPCs `search_content_blocks_hybrid` / `_keyword`), `vision.ts:39-59`, `embeddings/content-blocks.ts:48` | `sheet_version.summary`, `content_block.*`, embeddings |

**`processing_event` is never rendered in cityhall.** Warnings and errors written by the
pipeline are invisible to the user; the only user-visible failure surface is
`document_version.error_message` and `processing_state='failed'`.

### 5b. Review pipeline — reads the same DB fields, does **not** re-transcribe
Both workspace builders read `sheet_version.{summary,reading_guide,label,change_description,
change_type,similarity_score,block_numbering_scheme}` and `content_block.{category,
description,content,bounding_box,short_id}` straight out of Postgres, and render them to
markdown. Neither runs a vision/transcription pass of its own.

- **Incumbent (conductor, runs in the review sandbox):** `conductor/src/shared/project-downloader.ts`
  — sheet select `:316-324`, blocks select `:372-374` with scheme-dependent ordering
  `:363-378`, `writeSheet` → `guide.md` / `blocks.md` / `block-<n>.md` (`:441-455`,
  `:917-969`), `block-manifest.json` written at `:456-462` with `validBlockNumbers` from
  `short_id`. Called from `conductor/src/orchestrator/resource-manager.ts:425` / `:453`.
  Note `:369-378`: it deliberately **omits** `storage_path`/`thumbnail_storage_path` because
  the old `vision(documentId, sheetNumber)` tool fetched binaries live.
- **Rebuild (bureau review pipeline step 1.1):** `bureau/pipelines/review/lib/submission_db.py`
  — `plan_set_versions:175-196`, `sheet_versions:198-214` (**adds** `storage_path`,
  `thumbnail_storage_path` so binaries are staged on disk for native Opus vision),
  `sheet_labels:216-233`, `content_blocks:236-252`, `document_versions:254-285`,
  `document_sections:287+`. Renderers: `bureau/pipelines/review/lib/workspace.py` — layout
  docstring `:1-27`, `number_blocks:193`, `split_blocks:213` (≥1500 chars ⇒ own file,
  `LARGE_BLOCK_CHAR_THRESHOLD:35`), `render_blocks_md:236`, `render_guide_md:359`,
  `block-manifest.json` `:765`. Driver: `bureau/pipelines/review/1.1-download-plans/download_plans.py`.
  Its own docstring `:11-41` states it is a deliberate *port of conductor's contract*, field
  for field, not a re-derivation.
- Review launch: `substation/src/inngest/functions/workflow-run.ts` (`workflow/run` event →
  sandbox → clone bureau → start conductor → wait for `webhook/conductor.complete`).
- Downstream block-number validation (no Supabase access, reads `block-manifest.json`):
  `bureau/workflows/completeness-check/scripts/block-number-gate.ts`,
  `bureau/workflows/comment-resolution-check/scripts/block-number-gate.ts`,
  `.../enrichment-lint.ts`.
- **Separate, apparently unwired legacy path:** `bureau/workflows/process-zip/` (agentic
  Claude-Sonnet zip triage with its own `register-plan-set.ts` / `register-document.ts` /
  `extract-zip.ts` tools). The live upload zip path is substation's `zip.ts`; the only
  substation reference to `process-zip` is a comment in `src/inngest/lib/run-token.ts:68`.

---

## 6. Error handling today — the silent-failure map

### Hard-failure paths (row marked `failed`)
- `main.ts:47-77` `onFailure`: flips `plan_set_version` + its `sheet_version`s to `failed`,
  and `document_version` to `failed` with the generic user message *"We couldn't process this
  file. Please try uploading it again."* — note it only updates rows still in
  `pending`/`processing`.
- `sheet.ts:34-50` `onFailure`: sheet marked `failed` + an `error` `processing_event`.
- `zip.ts:384-411` `markZipFailed`: keeps the row + file, sets a specific user-facing
  `error_message`. Two triggers: unreadable archive (`:53-65`, with the SharePoint/OneDrive
  explanation) and "no actionable groups" (`:74-88`).
- `plan-sets.ts:305-307`: if the `inngest.send` throws, `processing_state` is rolled back to
  `pending`.

### Silent / swallowed paths (the interesting list)
| Where | Line | Behaviour |
|---|---|---|
| `inngest.send` failure at commit time | `submissions.ts:799-801`, `:853-855`, `:917-919` | `console.error` only. Row stays `pending` **forever**; no user signal, no retry. The only recovery is the manual `/process` endpoint. |
| PDF optimize failure | `plan-set.ts:67-76`, `document.ts:62-71` | warning event, falls back to `source.pdf` — reasonable, but invisible in UI |
| Page summary failure | `sheet.ts:124-132` | `error` `processing_event`, **step returns normally**; sheet ends `processed` with NULL `summary`/`label`. A garbled PDF yields an unnamed sheet that looks complete. |
| Block discovery / transcription failure | `sheet.ts:237-245` | warning event; sheet ends `processed` with **zero** `content_block` rows — downstream `blocks.md` is empty and indistinguishable from a genuinely blank sheet |
| Zero normalized blocks | `sheet.ts:216` | bare `return` — no event logged at all |
| Partial transcription join | `sheet.ts:225-235` | warning event listing dropped/unmatched ids; blocks are still saved with `description:''`, `content:''` (`sheet.logic.ts:95-96`) |
| Reading-guide failure | `sheet.ts:297-305` | warning; `reading_guide` NULL, `block_numbering_scheme` stays at the `'legacy-category-order'` default even though blocks have `short_id`s ⇒ downstream builders order by category and deep-links break |
| Block-fetch error inside reading-guide step | `sheet.ts:269-284` | fails **safe** to legacy scheme and logs — this one is a deliberately good path |
| Embedding failure | `sheet.ts:317-324` | warning; blocks unsearchable. Per-block update errors inside `embeddings.ts:56-62` are `console.error` + `continue` |
| Title-block failure | `plan-set.ts:239-247` | warning; `title_block_meta` NULL |
| Facts-refresh failure | `plan-set.ts:288-296` | warning |
| Overlay generation failure | `sheet.ts:162-170` | warning; comparison silently downgrades to PDF-only |
| Similarity: missing old thumbnail | `similarity.ts:25-26` | `continue`, **no log** |
| Similarity: script non-zero exit | `similarity.ts:83` | pair omitted from the result array, **no log** — sheet matching then sees an incomplete similarity matrix and can mislabel `modified` as `added` |
| Zip binary-file read failure | `zip.ts:322-324` | bare `catch {}` with only a comment |
| `logProcessingEvent` itself failing | `log-event.ts:32-34` | `console.error` — the error log can silently lose errors |
| `stopSandbox` | `processing.ts:49-51` | bare `catch {}` |
| Signed-URL failures in cityhall sheet page | `.../sheet/[sheetNum]/+page.ts:216-217` | `imageUrl`/`pdfUrl` become `null`; page renders without the drawing |

### Corrupt-PDF reality (already measured downstream, not fixed upstream)
`bureau/pipelines/review/1.1-download-plans/download_plans.py` exists partly to *assert* two
classes of upstream preprocessing corruption that the pipeline above produces silently, and
its own docstring routes them upstream (`:51-57`, `:92-96`):
- **Guard A `text_layer_fidelity`** (`:205-249`, `:489-590`): sheets whose embedded font CMap
  maps live glyphs to `U+0000`, so PDF text extraction *silently deletes characters* and every
  transcription on that sheet is uncitable. Verdicts `unreliable`/`unchecked` ⇒ `degraded`.
- **Guard B `transcription_repetition`** (`:590-692`): staged markdown carrying an extraction
  **runaway** — thresholds `RUNAWAY_NUMERIC_RUN = 40` digits (`:612`) and
  `RUNAWAY_LINE_CHARS = 5000` (`:629`). The canonical case is `sheet-02/guide.md` at 37,644
  chars on one line, from the retired per-sheet title-block extraction. Verdict `runaway` ⇒
  `degraded`, explicitly labelled *"An upstream [defect]"*.
- Related structural guard: `disambiguate_slugs` (`workspace.py:45-...`) fixes conductor's
  silent overwrite when a submission carries several documents with identical labels (1700 S.
  Lamar v4 has three "Owner's Authorization Letter" docs) — a preprocessing-naming problem
  surfacing as data loss in the workspace.
- Conductor's own drop-on-ambiguity: `project-downloader.ts:392-412` discards blocks with NULL
  `short_id` on a short-id-ordered sheet (logged as a warn) to avoid aliasing a real `short_id`.

### Structural risks worth flagging for the re-architecture
- **One sandbox per top-level file**, 4 vCPU, 60 min cap; `process-file/sheet` children share
  the parent sandbox but have their own 15 min cap — a sheet child that outlives the parent's
  `stopSandbox` falls back to `getFile` from Storage (`sheet.ts:66-69`), and the overlay path
  then silently degrades.
- `splitPdf` derives page count from rasterize output, so **any `pdftoppm` partial success
  silently truncates the sheet set** — no cross-check against the PDF's declared page count.
- `saveBlockDiscoveryResults` (`sheet.logic.ts:155-169`) does a `DELETE` then N serial
  single-row `INSERT`s with no transaction: a mid-loop crash leaves a partially-populated
  sheet that reads as complete.
- Idempotency on re-run is handled by "existing rows win" branches (`plan-set.logic.ts:48-62`,
  `:108-122`), which means a reprocess after a partial failure **reuses the broken manifest**.
