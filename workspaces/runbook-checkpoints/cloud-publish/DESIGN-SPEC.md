# Cloud Publish: Substation publishes a runbook's approved deliverable

**Status:** Draft v2
**Date:** 2026-09-24
**Repos touched:** `substation` (two run-bearer routes with a per-runbook publisher registry; one migration: `runbook_publishes` + `publish_preprocessing_run` + `publish_sir`), `bureau` (`preprocessing-v4/scripts/publish_step.py` and `sir/bin/publish.ts` choose a lane; the local lane calls the same functions; `runbooks/lib/app_client.py` gains the publish client)
**Repos NOT touched:** `conductor2`, `cityhall`, `claude-plugins` (`upload-sir` is the interactive, service-role local publisher and keeps working as is; see Deferred)

> **Revision note (v2).** Widens the spec from preprocessing-v4 to **also cover the SIR runbook's `4.1-upload`**, as a requirement.
> - **Same two routes, not one per runbook.** The routes become runbook-generic and dispatch to a **publisher registry** (D3). The parts that are identical across runbooks are the security-relevant ones: bearer auth, reading the approval from Substation's own gate row, signed-URL staging, idempotency, the checkpoint note. Only the database write differs, and that's what a publisher supplies. §"New endpoint or wider scope?" gives the reasoning.
> - **v1's D2 `publish-upload` + D3 `publish` become `publish/prepare` + `publish/commit`** (D2, D4). SIR's storage paths contain a SIR id that doesn't exist until the database write, and it ships up to 155 files. So the upload step has to take a *list* of files and reserve ids *before* the bytes move.
> - **v1's D6 registry column becomes a `runbook_publishes` table** (D6). One idempotency record per run for every runbook, instead of a column on each runbook's own registry.
> - **New for SIR:** D5 authorizes from the gate row's structured decision, not the sandbox (SIR's publish plan can *create an organization and a project*). D9 `publish_sir`. D10 parcel geo + project outline stay best-effort, after the commit. D11 the full-run-output mirror in the cloud (1.8 GB median, 8.5 GB max) is **one archive**, not 16,000 signed URLs.
> - PPv4 behavior (v1 D1, D5, D7, D8) is unchanged apart from the route names. Q1–Q5 kept; Q6–Q10 new.

## Problem

### preprocessing-v4 (found on cloud run `7025a6b3`, 2026-09-24)

A cloud run of preprocessing-v4 can't publish. Run `7025a6b3-ace3-4a3a-b9af-b7e5e16a78d5` (Valley View Townhomes, submission `8fea702d…` v3) got through every reading step, and its `3.3-hitl` was answered `approved` by a signed-in user (`runbook_hitl_questions`: `status=applied`, `decision.status=approved`, `decided_by_user_id` set). It then failed at `4.1-publish`:

```
error: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (service-role, RLS-bypass).
      at getSupabase (preprocessing-v4/scripts/lib/supabase.ts:21:15)
      at register.ts:36:12
embedded 526 blocks (1536-dim) -> …/4.1-publish/scratch/artifact.json
```

1. **The publish scripts only work with the service-role key** (`lib/supabase.ts:16-29`).
2. **The sandbox never gets a service-role key, by design.** `substation/src/lib/runbook/env.ts:121` `isForbiddenRunbookEnvVar` refuses every `*SERVICE_ROLE*` variable because the sandbox outlives the run (`runbooks/lib/submission_db.py:78-86`).
3. **The run token can't write what publishing writes** (prod, 2026-09-24):

   | Table | publish does | `workflow_run` has |
   |---|---|---|
   | `site_plan_preprocessing_run` | INSERT, UPDATE status | nothing |
   | `sheet_version` / `sheet` | UPDATE | SELECT only |
   | `content_block` / `document_section` | DELETE then INSERT | SELECT only |
   | `document`, `document_version`, `plan_set_version` | UPDATE | write already granted |

4. **Publishing isn't atomic.** `publish.ts` makes ~5 PostgREST calls per sheet in sequence. Its own comment (`publish.ts:58-63`) names this as PPv2 **D47**'s pre-production hardening item. `register.ts` runs as a separate process first, so a crash between the two leaves an orphaned `inactive` registry row.
5. **The artifact doesn't fit in a Vercel request body.** Registered artifacts are **19.9–24.0 MB** (largest: `47b82394…`, 755 blocks), almost all embeddings. `substation/src/lib/gate-files.ts` already records the Vercel body cap.

### SIR (`4.1-upload`, never yet run in the cloud)

`runbook_runs` holds five SIR runs, all `host=powerstation`. No SIR has been published from the cloud. When one is, `4.1-upload` fails the same way: `bun $RUNBOOK/bin/publish.ts sir-run $RUN $RUN/3.10-deliver/decision.json` (`sir/steps/4.1-upload/step.yaml`) builds its client from `SUPABASE_SERVICE_ROLE_KEY` (`sir/bin/publish.ts:12`, `client()` at `:147`).

What `sir-run` does (`sirNewRun` `publish.ts:1252`, then `publishPlan` `:863`):

1. Reads `3.10-deliver/decision.json` (the schema is `sir/steps/3.10-deliver/decision.schema.json`). An approved decision carries a **publish plan**: `organization` as `{id}` or `{name}` (**match-or-create**), `project` as `{id}` or `{create_name}` (**create**), `versioning` `new | iterate`, and `label`. It also reads site facts from `1.2-site-research/output/resolve-site/{location,jurisdiction}.json`.
2. `ensureOrg` (`:351`) inserts into `organizations` when needed. `ensureProject` (`:434`) inserts into `project`, or backfills a null `jurisdiction_slug` after checking it against `jurisdictions`. `ensureSir` (`:473`) inserts into `site_intelligence_report`, or bumps `current_version` for `iterate`. The next version comes from the database (`:1306-1320`).
3. Upserts one `sir_artifact` row per file, keyed on `(sir, version, kind, format, file_name)`, at `sir/<sirId>/v<version>/<file>` in bucket `sir-artifacts`. It then uploads the bytes. **Rows are written before bytes** (`:958` then `:982`), so a failure in between leaves rows pointing at missing objects. The files are `3.9-final/build/` (report PDF, DOCX, HTML), `supporting-documents/**`, `exhibits/*` (`bin/artifacts.ts`), and a `report_extracted_text` `.md` the script extracts from the DOCX with `mammoth` (`:509`).
4. Best-effort, warn-only: mirrors the whole run dir to `full-run-output/<sirId>/v<version>/` (`:596`); writes parcel rings to `geo` via the `sir_add_parcel_geo` RPC (`:761`); writes `project.site_outline` by running `runbooks/lib/project_outline.py` (`:844`), which is itself a service-role PATCH.
5. Writes `sir-publishing-record.json` at the run root; `4.1-upload`'s contract reads it there.

**The run token has no access to any of this** (prod, 2026-09-24): `organizations`, `site_intelligence_report`, `sir_artifact` and `geo` have no `workflow_run` grant; `project` is SELECT only; `sir_add_parcel_geo` isn't executable; there's no `workflow_run` storage policy on `sir-artifacts`.

**Sizes** (prod, 41 SIR versions over 24 SIRs):

| | median | max |
|---|---|---|
| deliverable files per version | 31 | 155 (152 supporting documents) |
| deliverable bytes per version | 76.6 MB | 732 MB (largest single file 228 MB) |
| full-run-output mirror per version | 1.8 GB | 8.5 GB, 16,402 files |

**Every SIR gate answer so far came through chat, not the console.** `3.10-deliver` rows are `channel=session`, have no `decided_by_user_id`, and use the retired `choice` vocabulary. The structured publish plan existed only in the run dir's `decision.json`, or as free text in `notes` (run `5ba85168`: "organization = new org HR Green … project = new 'Chick-fil-A Williston Square #06279'"). A cloud gate answered in the console carries the schema-validated plan in `runbook_hitl_questions.decision`. That's the copy Substation can trust (D5).

## New endpoint or wider scope?

**Widen the existing two routes, and add a publisher per runbook.** Don't add routes per runbook.

Split publishing into what's the same for every runbook and what isn't:

| Same for PPv4 and SIR, and security-relevant | Differs per runbook |
|---|---|
| run-bearer auth, `HMAC(:runId)` | which gate step approves (`3.3-hitl` vs `3.10-deliver`) |
| approval read from Substation's own gate row | the approval predicate (PPv4 also needs `request.publish.allowed`) |
| a signed upload URL per file, at a path Substation picks | bucket and path template (`submission-data/<project>/preprocessing-runs/…` vs `sir-artifacts/sir/<sirId>/v<n>/…`) |
| check that every staged object exists at its declared size | what, if anything, Substation reads back (PPv4: the artifact; SIR: nothing) |
| idempotency per runbook run; the checkpoint note; the 403 vocabulary | the database function, and any best-effort after-steps |

Separate routes would copy the left column once per runbook, and that's where a copy that drifts becomes a security bug. A publisher registry keeps the left column in one place and makes the right column a small, typed object. The next runbook (`review`, `process-city-response-docs`) adds a publisher, not routes.

What **does** change is the shape of the upload call. v1's single-file `publish-upload` can't serve SIR, for two reasons: its paths contain a SIR id that doesn't exist yet, and it ships up to 155 files. So the upload becomes **prepare** (reserve the ids, return one signed URL per file) and **commit** (check, then write).

## Design

### D1: The run token's grants don't change

No new `workflow_run` grant, policy or storage policy on any table or bucket named above. The sandbox's only new abilities are the two routes in D2 and D4, each scoped to its own run.

### D2: `POST /api/runs/:runId/publish/prepare`

- Body: `{ files: [{ name, sha256, bytes, kind?, format?, mime_type? }] }`. Names are names, never paths, and are checked against `gate-files.ts`'s `FILE_NAME_PATTERN` rule; SIR keeps its `supporting-documents/a/b.pdf → a__b.pdf` flattening from `artifacts.ts`.
- Substation:
  1. checks the D5 authorization;
  2. looks up the run's publisher;
  3. asks it to **resolve the target**: reserve ids and compute each file's storage path;
  4. stores the plan in a `runbook_publishes` row (D6, `status='prepared'`);
  5. returns `{ publish_id, uploads: [{ name, storage_path, upload_url }] }`.
- The bytes go from the sandbox straight to Storage and never pass through Substation.
- Calling prepare again on a run with a `prepared` row returns the same ids and paths with fresh URLs, so a retried upload overwrites instead of forking. On a `committed` row it returns the committed result (D6).

### D3: The publisher registry

`substation/src/lib/publish/registry.ts` maps a `runbook_runs.runbook` name to a publisher:

```ts
interface Publisher {
  gateStep: string                                  // '3.3-hitl' | '3.10-deliver'
  authorize(run, gate): Refusal | null              // D5, runbook-specific half
  resolveTarget(run, gate, files): Target           // ids + storage paths (D2)
  commit(run, gate, target, sb): Promise<Result>    // one DB function call (D7 / D9)
  after?(run, target, result, sb): Promise<Warning[]> // best-effort, post-commit (D10)
}
```

Two publishers ship: `preprocessing-v4` and `sir`. A runbook not in the registry gets `403 runbook_not_publishable`.

### D4: `POST /api/runs/:runId/publish/commit`

- Body: `{ publish_id }`. Everything else comes from the `runbook_publishes` row.
- Substation:
  1. re-checks D5;
  2. **checks every staged object exists at its declared `bytes`** (Storage `list` on each prefix; for PPv4 it also downloads the one artifact and checks its sha256, D7);
  3. calls `publisher.commit` (one database function, one transaction);
  4. marks the row `committed` with the result;
  5. runs `publisher.after` (best-effort);
  6. writes a `note` checkpoint (`published <runbook> …: counts, warnings`);
  7. returns `{ result, warnings }`.
- A failed commit marks the row `failed` with the error. A later prepare/commit on the same run starts from the same reserved ids.
- Long-running: give this route a `maxDuration` (Q1).

### D5: Authorization comes from Substation's own tables, never the sandbox

Both routes require, in this order:

1. The run's publisher exists (D3).
2. The **latest** `runbook_hitl_questions` row for `publisher.gateStep` on this run has `status` in (`decided`, `applied`), a non-null **`decided_by_user_id`**, and `decision->>'status' = 'approved'`. A chat-channel answer with no user (every SIR answer so far) does **not** authorize a cloud publish. The cloud lane's gate is answered in the console.
3. The publisher's own check:
   - **preprocessing-v4:** `runbook_runs.request->'publish'->>'allowed' = 'true'`.
   - **sir:** `decision.publish` is present and valid against `3.10-deliver`'s schema. **The publish plan (organization, project, versioning, label) is read from the gate row's `decision`, never from the request body.** The sandbox can't choose which org or project a SIR lands in. Only the signed-in human who answered the gate can. Rules for `project` / `organization` that differ from the run's own `project_id` are in Q6.

A refusal is a 403 with a named reason (`runbook_not_publishable`, `not_approved`, `publish_not_allowed`, `publish_plan_invalid`), which the captain surfaces instead of retrying.

### D6: `runbook_publishes`: one idempotency record per run

New table (substation migration), service-role only (RLS on, no policies, like the control-plane tables in #267):

`id uuid pk · run_id uuid references runbook_runs · runbook text · status text ('prepared' | 'committed' | 'failed') · target jsonb (reserved ids, per-file paths/bytes/sha) · result jsonb · error text · created_at · updated_at`

With a unique partial index on `run_id` `where status in ('prepared','committed')`: at most one live publish per run. This replaces v1 D6's `site_plan_preprocessing_run.runbook_run_id` column. The registry rows still record the runbook run, via `execution_metadata.runbook_run_id` (PPv4) and the `sir_artifact` / `site_intelligence_report` rows the result names (SIR), but the idempotency lives here.

### D7: PPv4 publisher: `publish_preprocessing_run` (v1 D5, unchanged)

- `resolveTarget`: one file, `artifact.json`, at `<project_id>/preprocessing-runs/<submission_version_id>/<runbook_run_id>/artifact.json` in `submission-data`. Same prefix as `register.ts:50`, with the run id in place of the slug.
- `commit`: download and sha-check the artifact, validate it (Q3), then call `public.publish_preprocessing_run(p_submission_version_id, p_storage_path, p_run_ref, p_execution_metadata, p_artifact jsonb) returns uuid`:
  - `SECURITY INVOKER`, `EXECUTE` to `service_role` only.
  - One transaction, in `publish.ts`'s order: insert the registry row (`inactive`, `preprocessing_version` from the artifact, Q5) → per sheet DELETE/INSERT `content_block`, UPDATE `sheet_version` + `sheet.label` → `plan_set_version.title_block_meta` → per document UPDATE `document`/`document_version`, DELETE/INSERT `document_section` → deactivate siblings, activate this run.
  - `publish(A)→publish(B)→publish(A)` still restores A.
  - **Scope guard:** RAISE if any sheet_version / document_version / plan_set_version id isn't under `p_submission_version_id`.
  - Discharges PPv2 D47.

### D8: The bureau side picks its lane by credential; the local lane calls the same functions

Following `runbooks/lib/app_client.py`'s existing order (bearer first; `run_bearer` at `:205`, ordering at `:356`):

- **Cloud** (`CONDUCTOR_CALLBACK_TOKEN` + `SUBSTATION_URL`): build the file list → `prepare` → PUT each file to its URL → `commit`. The client lives in `app_client.py` next to the existing `/gates` calls.
  - **PPv4** `publish_step.py`: `embed.ts` first (unchanged; the sandbox holds `AI_GATEWAY_API_KEY`).
  - **SIR** `publish.ts sir-run`: build the artifact list with `sirNewArtifacts` and generate the `report_extracted_text` `.md` from the DOCX **in the sandbox** as a normal file (`mammoth` needs the bytes, which are already there), then call the client. `publish.ts` gets a `--lane cloud` path that shells to the Python client, or calls the routes itself with `fetch`; see Q10.
- **Local** (`SUPABASE_SERVICE_ROLE_KEY`): the same database functions via `sb.rpc(...)`, so both lanes share one implementation and local publishes become all-or-nothing too. PPv4's `register.ts` and `publish.ts` merge into one caller. SIR's `publishPlan` keeps its uploads, but calls `publish_sir` for the rows instead of its ensure*/upsert loop, and **uploads bytes before rows** as the cloud lane does.
- Neither credential set: fail, naming both.
- Both runbooks' records (`publish-record.json`, `sir-publishing-record.json`) gain `lane: "cloud" | "local"`. The `4.1-upload` contract's `PublishingRecord` is unchanged otherwise; the cloud lane writes the record from `commit`'s response.

### D9: SIR publisher: `publish_sir`

- `resolveTarget`:
  - reads the plan from the gate row (D5);
  - for `versioning: new`, **generates the new SIR's uuid** and uses version 1;
  - for `iterate`, looks up the project's latest SIR and uses `current_version + 1`, exactly as `sirNewRun` does at `:1306-1320`;
  - computes each file's path `sir/<sirId>/v<version>/<name>`, including the collision renaming (`publishPlan` `:907-933`) and carry-forward rows (the local `publish` command's D2 pointers, which the cloud lane doesn't use; Q9);
  - resolves nothing about the org or project yet. Their creation happens inside the transaction.
- `commit` calls `public.publish_sir(p_plan jsonb, p_sir_id uuid, p_version int, p_expected_prior_version int, p_site jsonb, p_artifacts jsonb) returns jsonb`. `SECURITY INVOKER`, `service_role` only. It runs in one transaction:
  1. **org**: by id (must exist), or match-or-create by slug (`ensureOrg`);
  2. **project**: by id (must exist, and must belong to the org when the org was given by id), or create under the org with `jurisdiction_slug` only if it's in `jurisdictions`. On an existing project, backfill a null slug and never overwrite (`ensureProject` + `stampJurisdiction`);
  3. **SIR**: insert with the reserved `p_sir_id`, or for `iterate` bump `current_version` **only if it still equals `p_expected_prior_version`**, otherwise RAISE `version_conflict` (two runs iterating one SIR at once);
  4. upsert one `sir_artifact` row per file, on the existing `(site_intelligence_report_id, version, kind, format, file_name)` key;
  5. return `{ organization_id, project_id, site_intelligence_report_id, version, artifacts }`.
- The bytes are already in Storage (D4 step 2), so **rows never point at missing objects**. That fixes `publishPlan`'s rows-then-bytes order on both lanes.
- If the transaction fails, nothing is created. Uploaded objects sit under a `sir/<reserved-id>/` prefix that no row names, and a retry reuses the same reserved id (D6), so they're overwritten, not duplicated.

### D10: SIR best-effort after-steps run in Substation, after the commit

Today these warn and never fail a publish (`publishPlan` `:1030-1044`), and that stays true:

- **Parcel geo:** the sandbox uploads `parcel-rings.geojson` (every file `resolveParcelRings` finds) as extra prepared files. `after` calls `sir_add_parcel_geo` per feature, as `writeParcelGeo` does. It's idempotent on `(sir, kind, label)`.
- **Project outline:** `after` writes `project.site_outline` and nulls `thumbnail_rendered_at`, porting `project_outline.py`'s collect-don't-union rule (a straight TS port of `collect_outline`, ~40 lines; Q8).

These are outside the transaction, because a geometry problem must not un-publish a report. Their warnings go in `commit`'s response and the checkpoint note.

### D11: SIR full-run-output in the cloud is one archive

The mirror is 1.8 GB and ~thousands of files at the median, up to 8.5 GB and 16,402 files. One signed URL per file means a 16k-entry prepare response and 16k PUTs from the sandbox. No app code reads `full-run-output/` (only `upload-sir`'s own script writes it), and the local mirror is already best-effort.

In the cloud, the sandbox tars and compresses the run dir, excluding the same `FULL_RUN_OUTPUT_IGNORE` names, into **one** `run.tar.zst` plus a `_manifest.json` (rel path, bytes, sha256 per file, same fields as today's). It stages both through prepare as two more files at `full-run-output/<sirId>/v<version>/`. It's best-effort: a failed archive upload is a warning, never a failed publish. The local lane keeps the per-file mirror (Q7).

## Deploy order

1. **substation migration**: `runbook_publishes`, `publish_preprocessing_run`, `publish_sir`. Additive; nothing calls them yet.
2. **substation routes**: `publish/prepare` + `publish/commit`, the registry with both publishers, added to `RUN_BEARER_ROUTES`.
3. **bureau PPv4**: D8 for `publish_step.py`, both lanes.
4. **bureau SIR**: D8 for `publish.ts sir-run`, both lanes. The local rows-after-bytes change ships here.
5. **Acceptance, PPv4:** a fresh cloud run on Valley View Townhomes v3 (the `7025a6b3` request), approved in the console, publishes. Check: one `active` registry row; `preprocessing_run_id` on all 39 sheet_versions; block count equals the artifact's; a `committed` `runbook_publishes` row. Then a local re-publish of an older run flips back, which proves swap semantics through the function.
6. **Acceptance, SIR:** the first cloud SIR run. The gate is answered **in the console** with `versioning: new` into an **existing test project**, then a second run with `iterate`. Check: rows and bytes agree (every `sir_artifact.storage_path` exists at its `byte_size`); the version bumps once; the mirror archive and manifest exist; geo and outline warnings are in the note. Then force a failure between prepare and commit (kill the sandbox after uploads), retry, and confirm the same SIR id and no duplicate rows.

## Deliberately deferred

- **`review`, `process-city-response-docs`, other publishers.** They join by adding a registry entry and a function. Not in this spec.
- **`upload-sir`'s interactive flow** (`claude-plugins`, `bun publish.ts publish <plan.json>` with carry-forward rows). It stays service-role and local. It can adopt `publish_sir` later; D9 keeps carry-forward rows representable.
- **Moving `embed.ts` or the DOCX→md extraction out of the sandbox.** Both work there.
- **Garbage-collecting orphaned staged objects** from failed publishes. Bounded to one set per run (D6) under the run's own reserved prefix.

## Open questions

- **Q1: Can a 24 MB `jsonb` argument go through `supabase.rpc()`** within PostgREST, `service_role` `statement_timeout`, and Vercel `maxDuration`/memory (PPv4 only; SIR's function arguments are small)? Measure with `47b82394…`. Fallback: staging table `preprocessing_run_staged_block` filled in chunks, and the function swaps from it.
- **Q2: Does Substation have a direct pooled Postgres connection** it could use instead of PostgREST for the PPv4 call? That would make Q1 moot.
- **Q3: Where does PPv4 artifact validation live?** A zod port duplicates `lib/artifact.ts` (135 lines). **Leaning:** the function enforces scope and required fields; zod is a fast-fail convenience.
- **Q4: Should `approved_unpublished` (PPv4) also go through Substation** to note "nothing written"? Probably no.
- **Q5: `register.ts:86` stamps `preprocessing_version: 3` on v4 runs.** The function takes it from the artifact; confirm the app's PPv2/PPv3 badge handles 4.
- **Q6: May a cloud SIR create or target an org or project other than the run's own `runbook_runs.project_id`?** The launch requires a project (the sandbox is named after it), yet the `3.10-deliver` schema allows `{create_name}` and any `{id}`. **Leaning:** allow it, since the plan comes from a signed-in Noetic member's console answer (the console is org-gated, `isNoetic`). Record `runbook_runs.project_id` vs the published `project_id` in `runbook_publishes.result`, and warn in the note when they differ. The stricter alternative is to require `project.id = runbook_runs.project_id` for cloud runs.
- **Q7: Is one archive (D11) acceptable to whoever reads `full-run-output/`** (audits, IG), or does the cloud lane need the per-file layout? If the latter: batch prepare in pages of ~500 URLs, and accept the PUT count.
- **Q8: Port `project_outline.py` to TS in Substation, or expose it as a database function** (`set_project_outline(project_id, geojson[])`) that both lanes call? The function would end the Python/TS duplicate; the port is less work.
- **Q9: Should the cloud SIR lane ever carry forward** unchanged prior-version files as row-only pointers (the local `publish` command's D2)? `sir-run` never does today. **Leaning:** no. Every cloud version uploads its full set.
- **Q10: SIR's cloud client: `fetch` inside `publish.ts`, or shell to the Python `app_client.py`?** One client (Python) means one bearer implementation; `fetch` keeps `sir-run` a single process. **Leaning:** Python client, invoked like `project_outline.py` is today.
- **Q11: Large single files.** SIR has shipped a 228 MB file. Neither bucket sets `file_size_limit`, so the project-wide limit applies (at least 228 MB, given that file exists). Do signed upload URLs (a standard, non-resumable upload) handle that reliably from the sandbox, or does the client need TUS resumable upload for files over some threshold?
