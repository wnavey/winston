# Lamar + Collier v5 Game Day — Submission Versioning Walkthrough + CRC Run Plan

**Status:** Draft v1
**Date:** 2026-07-09 (game day: 2026-07-10)
**Repos touched:** none — this is an operational plan (winston only)
**Repos referenced:** `cityhall`, `substation`, `bureau`, `conductor`

## Problem

Tomorrow (2026-07-10) the city emails us the full document package for **submission version 5** of the Lamar + Collier project (`project 23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, "1700 S. Lamar Blvd."). We need to:

1. **Create site plan v5** — click "Create v5" in the UI, upload the new plan set + documents, and let processing complete. This spec doubles as a re-familiarization walkthrough: every step, the code that executes, and the DB rows inserted/modified.
2. **Fire the CRC run** for v5 against the v4 MCR, using generation-6 CRC guides, on Sonnet 4.6, `runs: 5`.

Nothing gets fired until Will gives the explicit go on the exact payload (standing rule).

## Verified current state (prod, checked 2026-07-09)

Supabase project `mgxqsrjutswbciyrltwd` ("Noetic App"):

- `project` row `23301a8a-…` = "Lamar + Collier", `site_address` "1700 S. Lamar Blvd."
- One `submission` `cf1201c2-2e8b-4034-9a5e-a70b6317e39a` ("Site Plan"), versions 1–4. **v4 = `6b9b85ed-e992-4906-a222-b24ee836910c`**, `status = 'draft'`, created 2026-05-11.
- v4 assets: **1** `submission_plan_set` row → `plan_set_version e9111f12-a156-4ed1-9446-8770de2407b4` (`plan_set 908ffab5-…`, `processed`, 57 `sheet_version` rows); **14** `submission_document` rows (all junction-carried-forward from v1–v3 — no document was re-uploaded for v4).
- v4 `reviews`: full department review (2026-05-12, `review_type='review'`, `status='completed'`, `is_current=true`) + 6 CRC runs + 6 CC runs. The lock banner ("locked because a review has been run") comes from the `review_type='review'` rows.
- CRC guides gen 6 exists in the `crc-guides` bucket at `23301a8a-…/cf1201c2-…/4/6/` — 24 `crc-*.md` guides (uppercase dept codes this gen) + manifests + figures. **Path is keyed by U0 version NUMBER (4) and generation (6), not by submission_version UUID** — creating v5 does not disturb it.
- Most recent CRC `workflow_runs` row (today, `4ffca72b-…`, completed) used exactly the input shape we're basing tomorrow's payload on.
- All 57 v4 sheets are `block_numbering_scheme = 'short-id-ordered'` after the 2026-07-09 regen (`substation/scripts/regen-reading-guides-v4.ts`).

---

# Part 1 — Site plan versioning: architecture walkthrough

## Big picture

```
┌─────────────────────────  PHASE A: Create v5 (one click)  ─────────────────────────┐
│                                                                                     │
│  cityhall submission page ──POST──▶ cityhall create-version ──▶ substation          │
│  "Create v5" button                 +server.ts (proxy)          POST /projects/:pid │
│                                                                 /submissions/:sid   │
│                                                                 /versions           │
│                                                                     │               │
│    1. heal v4 status: draft → review_complete (requires a          │               │
│       completed, current, review_type='review' review — ✓ exists)  │               │
│    2. INSERT submission_version (v5, status='draft')               │               │
│    3. copy junction rows → v5 points at v4's SAME                  │               │
│       plan_set_version + 14 document_versions (nothing re-created) │               │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────  PHASE B: Upload new assets (per file)  ─────────────────────────┐
│                                                                                     │
│  PLAN SET  → Plan Set page (/project/:pid/plan-set) drag-drop "replace" zone        │
│              → storage upload → POST /plan-sets/:planSetId/replace                  │
│              → unlink inherited v4 junction, INSERT new plan_set_version            │
│                (same plan_set row!), INSERT junction, send `process-file`           │
│                                                                                     │
│  DOCUMENTS → submission page dropzone: prepare-upload (signed URLs + upload_token)  │
│              → browser PUT to storage → commit-upload (classify, INSERT             │
│                document + document_version + junction, send `process-file`)         │
│                                                                                     │
│  ⚠ Do NOT drop the plan set PDF on the submission-page dropzone (see Gotcha G1)     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────  PHASE C: Inngest processing (automatic, ~minutes)  ─────────────────┐
│                                                                                     │
│  `process-file` (plan set) — Vercel Sandbox:                                        │
│    optimize → rasterize JPEGs → split per-page PDFs → upload sheets to storage      │
│    → similarity-match v5 pages vs v4 sheets → sheet manifest:                       │
│        unchanged → copy v4 summary/reading_guide/content_blocks, processed          │
│        modified/added → sheet_version 'pending' + child event per sheet             │
│    → `process-file/sheet` × N (parallel): summary/title block → change comparison   │
│        vs prior sheet → block discovery (short_id by reading order) → reading       │
│        guide (short-id-ordered) → embeddings                                        │
│    → title block extract + project facts refresh → plan_set_version 'processed'     │
│      + change_summary ("57 sheets: 5 added, 49 modified, …")                        │
│                                                                                     │
│  `process-file` (each document): optimize → rasterize → LLM inventory → processed   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Phase A: "Create v5" click — exact trace

1. **UI** — `cityhall/src/routes/(app)/project/[projectId]/submission/[submissionId]/+page.svelte`. Lock banner + button at lines 539–577; `nextVersionNumber = activeVersion.version_number + 1` (line 35); click handler `createNextVersion()` (lines 128–146) POSTs to the cityhall route below, then `invalidateAll()`.
   - Lock condition (`+page.ts:296–299`): `locked = status !== 'draft' || hasCompletedReviews`, where `hasCompletedReviews` queries `reviews` for `submission_version_id = v4, is_current = true, review_type = 'review'` (`+page.ts:155–161`). v4 is locked via the second clause (status is still `draft`).
2. **Cityhall proxy** — `create-version/+server.ts:5–15`: auth check, then `substationPost('/projects/{pid}/submissions/{sid}/versions')`.
3. **Substation** — `substation/src/routes/submissions.ts:148–261`:
   - Verifies project access, submission↔project chain; loads versions descending; `latest` = v4.
   - **Status healing (lines 183–208)**: v4 is `draft`, so it counts `reviews` with `is_current=true, review_type='review', status='completed'`. Verified in prod: the 2026-05-12 department reviews satisfy this. It then **UPDATEs v4 → `status='review_complete'`** and proceeds. (If that count had been 0, it would throw "Current version is already a draft" — not our case.)
   - **INSERT `submission_version`** (lines 210–225): `{submission_id: cf1201c2-…, version_number: 5, status: 'draft', label: null}`. This new row's `id` is **the v5 UUID we need for the CRC payload**.
   - **Carry-forward junctions** (lines 227–255): copies v4's `submission_plan_set` row (1) and `submission_document` rows (14) to point at v5. **No new `plan_set_version`, `document_version`, `sheet`, or `sheet_version` rows** — v5 shares v4's assets until we upload replacements.
   - Returns 201 with the new version.

**DB delta from the click:**

| Table | Op | Rows | Notes |
|---|---|---|---|
| `submission_version` | UPDATE | 1 | v4: `draft` → `review_complete` (healing) |
| `submission_version` | INSERT | 1 | v5, `status='draft'` — **capture this id** |
| `submission_plan_set` | INSERT | 1 | v5 → v4's `plan_set_version e9111f12` |
| `submission_document` | INSERT | 14 | v5 → existing `document_version`s |

## Phase B: uploading the new assets

### Plan set (the 57-sheet PDF) — use the Plan Set page replace flow

UI: `/project/23301a8a-…/plan-set` — drag the new PDF anywhere on the page (drop zone appears when the submission is unlocked; `+page.svelte:106–168`). The client uploads to `submission-data` at `{projectId}/plan-sets/{planSetId}/pending/{ts}/{name}`, then POSTs `/project/{pid}/plan-set/replace` (`replace/+server.ts`), which proxies to substation **`POST /projects/:pid/plan-sets/:planSetId/replace`** (`substation/src/routes/plan-sets.ts:104–228`):

- Resolves the active draft version (must be v5 and `draft`, else 409 `submission_locked`).
- **Unlinks** the inherited junction to v4's `plan_set_version` (`plan-sets.ts:183–190`; since v4 owns it, it's unlinked, not deleted).
- INSERTs a new `plan_set_version` under the **same `plan_set` (908ffab5-…)** with `processing_state='pending'`, `submission_version_id = v5`; INSERTs the junction; sends Inngest **`process-file`** with `classificationHint: 'plan_set'`.

Keeping the same `plan_set` row is what makes v4↔v5 sheet lineage and the diff view work.

### Documents — submission page dropzone

Standard three-step upload from the submission page (`+page.svelte:261–317`):

1. `prepare-upload` (`substation submissions.ts:495–551`) — one `upload_token` row per file (`storage_path = {projectId}/uploads/{uploadId}/{filename}`, expires in 1 h), returns signed PUT URLs.
2. Browser PUTs bytes to the `submission-data` bucket.
3. `commit-upload` (`submissions.ts:554–700`) — atomically consumes tokens, downloads + classifies each file (`plan_set` / `document` / `zip` / `binary`), then per document: INSERT `document` + `document_version` (`processing_state='pending'`) + `submission_document` junction, and sends `process-file`.

**There is no document "replace" flow.** Uploading a document always creates a new `document` row; the carried-forward v4 junction rows stay. The only `submission_document` delete path is scoped to *failed* document versions (`submissions.ts:375–450`). See Q1.

## Phase C: processing pipeline (automatic)

`process-file` for the plan set (`substation/src/inngest/functions/process-file/plan-set.ts:24–316`), in a Vercel Sandbox:

1. Mark `plan_set_version` `processing='processing'` → download → optimize (non-fatal) → rasterize JPEGs → split per-page PDFs → upload all to `projects/{pid}/plan-sets/{psId}/v{N}/sheets/{n}.{pdf,jpg}`.
2. **Sheet matching vs v4** (`match-sheets.ts:22–114`): similarity score adjusted by position distance (−0.02/step); greedy match ≥ 0.5. `raw == 1.0` → `unchanged`; `0.5 ≤ raw < 1.0` → `modified`; unmatched → `added`.
3. **Sheet manifest** (`plan-set.logic.ts:100–264`):
   - `unchanged`: new `sheet_version` created already-`processed`, **copying v4's `summary`, `reading_guide`, `title_block`, and `content_block` rows** (incl. `short_id`s), with `previous_sheet_version_id` → v4's sheet_version.
   - `modified` / `added`: `sheet_version` created `pending` with lineage FK; `added` also INSERTs a new `sheet` row.
4. **Per-sheet child events** `process-file/sheet` (parallel; `sheet.ts:28–307`): page summary + title block (LLM) → change comparison vs prior sheet with red/blue overlay (LLM; stores `change_description`, may flip `change_type`) → **block discovery + details, sorted by bbox reading order (y, then x), `short_id = index + 1`** (`sheet.logic.ts:76–100`) → **reading guide generated from blocks ordered by `short_id`** and stamped `block_numbering_scheme = 'short-id-ordered'` (`sheet.ts:216–263`) → block embeddings.
5. Title-block extraction from sheet 1; project facts refresh (v2+; may write `project_facts`, `research_session`); finally `plan_set_version` → `processed`, `finished_at`, `applied_at`, `change_summary` (this is the "5 new, 49 modified" badge, tallied by `cityhall/src/lib/plan-set/stats.ts:11–29`).

**Short-id ordering: no regen needed for v5.** The mainline pipeline natively assigns `short_id` at block discovery and orders the reading guide by it — the 2026-07-09 `regen-reading-guides-v4.ts` pass was a backfill for v4 only. Modified/added v5 sheets get short-id-ordered guides fresh; unchanged sheets copy v4's (already short-id-ordered post-regen). Both paths are clean.

Documents each get their own `process-file` run (optimize → rasterize → LLM inventory → `processed`).

### Completion signals (gate before firing CRC)

- UI: plan set card shows change badges; documents show processed.
- SQL:
  ```sql
  -- plan set done?
  select processing_state, change_summary, finished_at from plan_set_version
   where submission_version_id = '<V5_ID>';
  -- all sheets done?
  select processing_state, count(*) from sheet_version sv
   join plan_set_version psv on psv.id = sv.plan_set_version_id
   where psv.submission_version_id = '<V5_ID>' group by 1;
  -- all sheets short-id-ordered?
  select block_numbering_scheme, count(*) from sheet_version sv
   join plan_set_version psv on psv.id = sv.plan_set_version_id
   where psv.submission_version_id = '<V5_ID>' group by 1;
  -- errors?
  select severity, step, message from processing_event
   where submission_version_id = '<V5_ID>' and severity in ('warning','error')
   order by created_at desc limit 30;
  ```

## Gotchas / risks

- **G1 — Don't drop the plan set PDF on the submission-page dropzone.** `commit-upload`'s plan_set branch (`submissions.ts:742–793`, `handlePlanSetUpload`) creates a **brand-new `plan_set` row** and adds a junction **without unlinking the inherited one** — v5 would then have two `submission_plan_set` rows, breaking `.maybeSingle()` readers (e.g. `plan-sets.ts:155–160`, the submission page loader) and severing v4↔v5 sheet lineage/diff. The Plan Set page replace flow is the only correct path.
- **G2 — v4 status flip is expected.** Creating v5 heals v4 `draft` → `review_complete`. Fine, but note it changes what v4's page shows.
- **G3 — Upload tokens expire in 1 h**; commit after uploads promptly.
- **G4 — Sheet-matching quality gates the CRC.** `unchanged` misclassification would copy stale v4 blocks; spot-check a few known-changed sheets' `change_type` and reading guides before firing.
- **G5 — Known theoretical desc↔bbox mispairing** in `mergeBlockDetails` (`sheet.logic.ts:22–31`, index-zips two LLM calls) still exists but is mitigated by the post-merge bbox re-sort before `short_id` assignment; no change since `876d954` (2026-07-08).
- **G6 — Guides are insulated from v5 creation.** `crc-guides/{projectId}/{submissionId}/{u0VersionNumber=4}/{generation=6}/` — keyed by version *number* of the U0 baseline, not any UUID.

---

# Part 2 — CRC run payload (draft — DO NOT FIRE until explicit go)

Modeled on today's successful run (`workflow_runs 4ffca72b-…`), with two changes: `model` → Sonnet 4.6, `submissionVersionId` → the new v5 UUID.

```json
[
  {
    "name": "workflow/run",
    "data": {
      "inputs": {
        "crcGenerationNumber": 6,
        "crcGuidesSubmissionVersionId": "6b9b85ed-e992-4906-a222-b24ee836910c",
        "jurisdiction": "austin",
        "maxWorkers": 35,
        "model": "claude-sonnet-4-6",
        "projectId": "23301a8a-4cdb-4751-ac0c-93b97f0f5c12",
        "runLabel": "2026-07-10-lamar-collier-v5-crc-run-1",
        "runs": 5,
        "submissionVersionId": "<V5_SUBMISSION_VERSION_ID>"
      },
      "workflowName": "comment-resolution-check"
    }
  }
]
```

### Input-by-input rationale (schema: `bureau/workflows/comment-resolution-check/workflow.yaml:30–127`)

| Input | Value | Why |
|---|---|---|
| `submissionVersionId` | **v5 UUID (captured in Phase A)** | Drives `resources.submissionVersion` — stages the U1 (target) site-plan data the agent reads. |
| `crcGuidesSubmissionVersionId` | `6b9b85ed-…` (v4) | The U0 baseline. `fetch-crc-guides.ts:141–178` resolves it to `{projectId}/{submissionId}/4/…` in the `crc-guides` bucket. Unchanged. |
| `crcGenerationNumber` | `6` | Pins gen 6 explicitly (24 guides verified in the bucket). If omitted it auto-picks the highest, which is currently also 6 — pin it anyway. |
| `model` | `claude-sonnet-4-6` | **Confirmed string** — used by the 2026-06-30 CRC run on this project and other prod runs. No validation layer; a typo only fails at SDK call time, so copy exactly. |
| `runs` | `5` | Majority-vote consolidation in `cross-run-consolidate-crc` (workflow.yaml:175–182); `uncertainThreshold` default 0.35 applies at runs ≥ 3. |
| `maxWorkers` | `35` | Same as today's successful runs=5 haiku run. Workflow docs suggest scaling proportionally (runs=3 → 39 from base 13; runs=5 → ~65) — see Q2. |
| `runLabel` | `2026-07-10-lamar-collier-v5-crc-run-1` | Cost-attribution tag only (Gateway `label:` tag + `reviews.metadata.runLabel`) — does **not** affect storage paths. Charset `[a-zA-Z0-9_-]` enforced. |
| `jurisdiction` | `austin` | Default anyway. |
| (omitted) `effort` | — | Only applies to 4.6+ models; prior runs omitted it. See Q3. |
| (omitted) enrichment inputs | defaults | `enrichComments=true`, `enrichmentModel=claude-haiku-4-5-20251001`, `enrichmentMaxWorkers=50`. |

Outputs land in `workflow_runs` (status/inputs/outputs_path), storage `workflow-runs/comment-resolution-check/23301a8a-…/{datetime}/`, and `reviews` (`review_type='crc'`, new row becomes `is_current`).

---

# Game-day runbook (2026-07-10)

1. **Receive email** → download plan set PDF + documents locally.
2. **Create v5**: submission page → "Create v5". Verify + capture the v5 UUID:
   ```sql
   select id, version_number, status, created_at from submission_version
    where submission_id = 'cf1201c2-2e8b-4034-9a5e-a70b6317e39a'
    order by version_number desc limit 2;
   -- expect: v5 draft (capture id), v4 review_complete
   ```
3. **Upload plan set** via `/project/23301a8a-…/plan-set` drag-drop replace zone (NOT the submission dropzone — G1).
4. **Upload documents** via submission page dropzone (per Q1 decision).
5. **Wait for processing** — watch the UI badges / run the Phase C completion queries. Spot-check change_types and a couple of reading guides (G4).
6. **Fill `<V5_SUBMISSION_VERSION_ID>`** into the payload above; Will reviews the exact JSON.
7. **On explicit go**: fire the Inngest `workflow/run` event (handler: `substation/src/inngest/functions/workflow-run.ts` — spins a Vercel Sandbox, clones bureau, runs conductor detached, 3 h webhook timeout).
8. **Monitor**: `workflow_runs` row (status `in_progress` → `completed`), Inngest dashboard, then outputs at `workflow-runs/comment-resolution-check/23301a8a-…/{datetime}/`.

# Open questions

- **Q1 — Which documents do we upload?** There is no document-replace flow; every upload adds a new `document` row while v4's 14 junction-carried docs remain on v5, so re-uploading everything duplicates unchanged docs in the UI (and doubles document processing). Recommendation: upload only new/updated documents; the CRC agent works primarily off plan-set sheet data anyway. Alternative: upload all 14 for fidelity and accept the duplicate listings.
- **Q2 — `maxWorkers` 35 or higher for runs=5?** 35 matches today's successful run; the workflow's own guidance implies ~65 for runs=5 to hold wall-clock flat. Sonnet 4.6 is slower and pricier per call than haiku — 35 (recommended) trades some wall-clock for gentler concurrency; 65 if we want speed.
- **Q3 — Set `effort` for Sonnet 4.6?** Supported but never set on prior CRC runs. Recommendation: omit for comparability with the haiku baseline runs.
- **Q4 — Fire a `runs: 1` smoke CRC first?** A single-run smoke (~1/5 cost) would validate v5 data staging + guides resolution before the full 5-run. Recommendation: yes if timing allows; the payload is identical except `runs: 1` and a `-smoke` runLabel.
