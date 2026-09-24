# Cloud Publish: Substation publishes a runbook's approved deliverable

**Status:** Draft v3
**Date:** 2026-09-24
**Repos touched:** `substation` (two run-bearer routes with a per-runbook publisher registry; one migration: `runbook_publishes` + `publish_preprocessing_run` + `publish_sir`), `bureau` (`preprocessing-v4/scripts/publish_step.py` and `sir/bin/publish.ts` choose a lane; the local lane calls the same functions; `runbooks/lib/app_client.py` gains the publish client)
**Repos NOT touched:** `conductor2`, `cityhall`, `claude-plugins` (`upload-sir` is the interactive, service-role local publisher and keeps working as is; see Deferred)

> **Revision note (v3, audit fold-in, 2026-09-24).** Five fixes from the audit of v2, plus two smaller corrections. No change to the two-route + registry shape.
> - **D9 had a write race.** Two runs iterating one SIR both staged into `sir/<sirId>/v<n+1>/` with the same file names; the one that lost `version_conflict` had already overwritten the winner's bytes, and D4's size check can't see it. **SIR paths now carry the runbook run id** (`sir/<sirId>/v<n>/<runbook_run_id>/<name>`), the same move PPv4 already makes. cityhall reads `sir_artifact.storage_path` from the row (`sir-chat.ts:206`, the project SIR page, `download-all`), so the path shape is free.
> - **D6 contradicted D4/D9 on retries.** The partial index excluded `failed`, so a retry after a failed commit minted a new SIR uuid and a new prefix, and the "orphans bounded to one set per run" claim was false. **Now one row per run, full stop**: `failed` keeps the reservation, prepare on a `failed` row reuses it and re-resolves only the version. Acceptance gains a forced commit failure.
> - **Q1 is the load-bearing unknown and Q2 is answered: no.** Substation has `pg` as a dependency but only its integration tests open a connection; no route holds `DATABASE_URL`. So the 24 MB RPC must be **measured before the migration is written** (deploy order step 0), because the fallback reshapes both lanes (D8 makes the local lane call the same function).
> - **D11 is withdrawn for v1.** A single archive of an 8.5 GB mirror of PDFs and images barely compresses, Supabase caps a standard upload at 5 GB, a resumable (TUS) upload authenticates with a JWT the run token doesn't have on this bucket, and the sandbox would need disk for the run dir twice over. Nothing reads the mirror. The cloud lane ships no `full-run-output/`; Q7 becomes whether anyone wants it back. Q11 is decided: standard uploads only, with a 228 MB PUT in acceptance.
> - **A bad plan had no way out.** The console's "By id" fields are raw UUID text, and a wrong id, a project outside its org, or a `version_conflict` surfaced only at commit, inside `4.1-upload`, after the gate row was `applied`. **Q6 is decided the strict way for cloud** (the SIR lands in `runbook_runs.project_id`), prepare validates what's left of the plan, and a refusal **re-asks instead of failing the run** (new D12).
> - **Q5 confirmed** (`register.ts:86` hardcodes `preprocessing_version: 3`); D8's merge of `register.ts` into the function caller removes the hardcode, the badge check remains.
> - **Named the ongoing cost of D7**: substation already owns these tables' migrations, but every artifact-shape change in bureau now needs a substation migration *first*. The function checks `p_artifact->>'schema_version'` and RAISEs on one it doesn't know.

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
  3. asks it to **validate the plan's references** (D5 step 4) and then **resolve the target**: reserve ids and compute each file's storage path;
  4. stores the plan in a `runbook_publishes` row (D6, `status='prepared'`);
  5. returns `{ publish_id, uploads: [{ name, storage_path, upload_url }] }`.
- The bytes go from the sandbox straight to Storage and never pass through Substation. Every URL is a **standard** signed upload (`createSignedUploadUrl`, `upsert: true`, as `gate-files` does at `runs.ts:853`). Supabase caps a standard upload at 5 GB per object; the largest deliverable ever shipped is 228 MB (Q11). A resumable upload is not an option here: TUS authenticates with a JWT, and the run token has no policy on these buckets (D1), which is the point.
- Calling prepare again on a run with a `prepared` **or `failed`** row returns the same reserved ids (re-resolving only what can go stale, D6) with fresh URLs, so a retried upload overwrites instead of forking. On a `committed` row it returns the committed result.

### D3: The publisher registry

`substation/src/lib/publish/registry.ts` maps a `runbook_runs.runbook` name to a publisher:

```ts
interface Publisher {
  gateSteps: string[]                               // ['3.3-hitl'] | ['3.10-deliver', '4.1-upload'] (D12)
  authorize(run, gate): Refusal | null              // D5, runbook-specific half
  validatePlan(run, gate, sb): Promise<Refusal | null> // D5 step 4: cheap SELECTs, before any id is reserved
  resolveTarget(run, gate, files, prior?): Target   // ids + storage paths (D2); `prior` = a failed row's reservation (D6)
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
- A failed commit marks the row `failed` with the error and the refusal reason when there is one. The reservation stays on the row (D6): a later prepare reuses the same ids and paths, re-resolving only the version for `iterate`, so the retry overwrites its own staged objects.
- A commit refused for a **plan** reason (`publish_plan_invalid`, `version_conflict`, `project_mismatch`) is the D12 case: the caller re-asks, it doesn't retry.
- Long-running: give this route a `maxDuration` (Q1).

### D5: Authorization comes from Substation's own tables, never the sandbox

Both routes require, in this order:

1. The run's publisher exists (D3).
2. The **latest** `runbook_hitl_questions` row across `publisher.gateSteps` on this run (D12: a `4.1-upload` re-ask supersedes the `3.10-deliver` answer) has `status` in (`decided`, `applied`), a non-null **`decided_by_user_id`**, and `decision->>'status' = 'approved'`. A chat-channel answer with no user (every SIR answer so far) does **not** authorize a cloud publish. The cloud lane's gate is answered in the console.
3. The publisher's own check:
   - **preprocessing-v4:** `runbook_runs.request->'publish'->>'allowed' = 'true'`.
   - **sir:** `decision.publish` is present and valid against the gate row's stored `schema` (the same one the decide controller's ajv check ran against). **The publish plan (organization, project, versioning, label) is read from the gate row's `decision`, never from the request body.** The sandbox can't choose which org or project a SIR lands in. Only the signed-in human who answered the gate can.
4. The publisher's **plan validation** (`validatePlan`), run at prepare *before* anything is reserved, so a wrong plan is refused while it's still cheap to re-ask:
   - **sir, cloud lane (Q6, decided strict):** `project.id` must equal `runbook_runs.project_id`; `project.create_name` is refused; `organization` must be the id, or match the slug, of that project's org. The project exists by construction (the run was launched against it), so the only reference left to check is `versioning: iterate` → the project must already have a `site_intelligence_report`, and `new` must not be used when one exists unless the plan says so (that's what the two values mean).
   - **preprocessing-v4:** nothing beyond step 3; the artifact's scope is checked by the function (D7).

A refusal is a 403 with a named reason (`runbook_not_publishable`, `not_approved`, `publish_not_allowed`, `publish_plan_invalid`, `project_mismatch`, `version_conflict`) and a one-line `detail`, which the captain surfaces (and, for the plan reasons, re-asks with; D12) instead of retrying.

### D6: `runbook_publishes`: one idempotency record per run

New table (substation migration), service-role only (RLS on, no policies, like the control-plane tables in #267):

`id uuid pk · run_id uuid references runbook_runs · runbook text · status text ('prepared' | 'committed' | 'failed') · target jsonb (reserved ids, per-file paths/bytes/sha) · result jsonb · error text · attempts int · created_at · updated_at`

With a **unique index on `run_id`**: exactly one publish record per run, whatever its status. The row is the reservation, and it outlives a failed commit:

- `prepared` → `committed` on success; `prepared` → `failed` on a failed or refused commit; `failed` → `prepared` on the next prepare (`attempts + 1`, the previous `error` kept in `result.history`).
- Prepare on a `failed` row hands `target` back to `resolveTarget` as `prior`. The publisher keeps every reserved id (the SIR uuid, the artifact path root) and re-resolves only what can have gone stale: for `iterate`, the version (another publish may have taken `n+1`; the old objects under the stale prefix are the one bounded orphan set, Deferred).
- A `committed` row is terminal for the cloud lane. Publishing the same run twice is a local, service-role act (D8), not a route.

(v2's partial index dropped `failed` rows from the constraint, which let a retry mint a fresh SIR uuid and a fresh prefix per attempt; that's what the audit caught.) This replaces v1 D6's `site_plan_preprocessing_run.runbook_run_id` column. The registry rows still record the runbook run, via `execution_metadata.runbook_run_id` (PPv4) and the `sir_artifact` / `site_intelligence_report` rows the result names (SIR), but the idempotency lives here.

### D7: PPv4 publisher: `publish_preprocessing_run` (v1 D5, unchanged)

- `resolveTarget`: one file, `artifact.json`, at `<project_id>/preprocessing-runs/<submission_version_id>/<runbook_run_id>/artifact.json` in `submission-data`. Same prefix as `register.ts:50`, with the run id in place of the slug.
- `commit`: download and sha-check the artifact, validate it (Q3), then call `public.publish_preprocessing_run(p_submission_version_id, p_storage_path, p_run_ref, p_execution_metadata, p_artifact jsonb) returns uuid`:
  - `SECURITY INVOKER`, `EXECUTE` to `service_role` only.
  - One transaction, in `publish.ts`'s order: insert the registry row (`inactive`, `preprocessing_version` from the artifact, Q5) → per sheet DELETE/INSERT `content_block`, UPDATE `sheet_version` + `sheet.label` → `plan_set_version.title_block_meta` → per document UPDATE `document`/`document_version`, DELETE/INSERT `document_section` → deactivate siblings, activate this run.
  - `publish(A)→publish(B)→publish(A)` still restores A.
  - **Scope guard:** RAISE if any sheet_version / document_version / plan_set_version id isn't under `p_submission_version_id`.
  - **Shape guard:** the function reads `p_artifact->>'schema_version'` and RAISEs `artifact_schema_unknown` on a value it wasn't written for. Substation already owns these tables' migrations (`00000000000000_baseline.sql`, `20260731000000_site_intelligence_report_and_sir_artifact.sql`), so the function lives beside them. The cost this adds, and it's ongoing: **an artifact-shape change in bureau now ships a substation migration first**, on both lanes, where today `publish.ts` and `lib/artifact.ts` move together in one repo. The version check turns a silent mis-publish into a named refusal.
  - Discharges PPv2 D47.

### D8: The bureau side picks its lane by credential; the local lane calls the same functions

Following `runbooks/lib/app_client.py`'s existing order (bearer first; `run_bearer` at `:205`, ordering at `:356`):

- **Cloud** (`CONDUCTOR_CALLBACK_TOKEN` + `SUBSTATION_URL`): build the file list → `prepare` → PUT each file to its URL → `commit`. The client lives in `app_client.py` next to the existing `/gates` calls.
  - **PPv4** `publish_step.py`: `embed.ts` first (unchanged; the sandbox holds `AI_GATEWAY_API_KEY`).
  - **SIR** `publish.ts sir-run`: build the artifact list with `sirNewArtifacts` and generate the `report_extracted_text` `.md` from the DOCX **in the sandbox** as a normal file (`mammoth` needs the bytes, which are already there), then call the client. `publish.ts` gets a `--lane cloud` path that shells to the Python client, or calls the routes itself with `fetch`; see Q10.
- **Local** (`SUPABASE_SERVICE_ROLE_KEY`): the same database functions via `sb.rpc(...)`, so both lanes share one implementation and local publishes become all-or-nothing too. PPv4's `register.ts` and `publish.ts` merge into one caller, which also retires `register.ts:86`'s hardcoded `preprocessing_version: 3` (Q5): the function takes it from the artifact. SIR's `publishPlan` keeps its uploads, but calls `publish_sir` for the rows instead of its ensure*/upsert loop, and **uploads bytes before rows** as the cloud lane does.
- Neither credential set: fail, naming both.
- Both runbooks' records (`publish-record.json`, `sir-publishing-record.json`) gain `lane: "cloud" | "local"`. The `4.1-upload` contract's `PublishingRecord` is unchanged otherwise; the cloud lane writes the record from `commit`'s response.

### D9: SIR publisher: `publish_sir`

- `resolveTarget`:
  - reads the plan from the gate row (D5);
  - for `versioning: new`, **generates the new SIR's uuid** and uses version 1;
  - for `iterate`, looks up the project's latest SIR and uses `current_version + 1`, exactly as `sirNewRun` does at `:1306-1320`;
  - computes each file's path **`sir/<sirId>/v<version>/<runbook_run_id>/<name>`**, including the collision renaming (`publishPlan` `:907-933`) and carry-forward rows (the local `publish` command's D2 pointers, which the cloud lane doesn't use; Q9). The run id segment is what PPv4's path already has (D7), and it's load-bearing: without it two runs iterating one SIR both stage into `v<n+1>/` under the same file names, and the one that loses the `version_conflict` below has *already overwritten the winner's objects*. D4's size check can't tell, since both wrote a `report.pdf`. cityhall never builds this path; it reads `sir_artifact.storage_path` off the row (`src/lib/server/sir-chat.ts:206`, the project SIR page, `download-all`), so the extra segment costs nothing. `sir-run` on the local lane uses the same shape (local runs have a `runbook_runs` row too); the interactive `upload-sir` keeps its old shape (Deferred);
  - resolves nothing about the org or project yet. Their creation happens inside the transaction (on the cloud lane there is nothing to create, D5 step 4; the branches stay for the local lane).
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

### D11: The cloud lane ships no full-run-output mirror (v2's archive is withdrawn)

The mirror is 1.8 GB and ~thousands of files at the median, up to 8.5 GB and 16,402 files. No app code reads `full-run-output/` (only `upload-sir`'s own script writes it), and the local mirror is already best-effort.

v2 proposed one `run.tar.zst` per publish. The audit killed it on four counts, any one of which is enough:

1. A run dir is mostly PDFs and page images, which don't compress; the archive stays within a small factor of 8.5 GB.
2. Supabase caps a **standard** upload at 5 GB per object. The resumable (TUS) path that goes higher authenticates with a JWT, and the run token deliberately has no policy on `sir-artifacts` (D1). A signed upload URL is a standard upload.
3. The sandbox has to hold the run dir and the archive at once, and tar 16k files inside a step's clock.
4. Q11 asked whether a 228 MB file needs care, then D11 proposed a file 10–40× that size without connecting the two.

So: **the cloud lane writes nothing under `full-run-output/`**. The local lane keeps its per-file mirror unchanged. If anyone wants a cloud mirror later (Q7), it comes back as its own best-effort step with a per-file prepare in pages and a hard ceiling, not as part of publish.

### D12: A refused plan re-asks; it doesn't fail the run

The plan is a human's console answer, typed into text fields ("By id" is a raw uuid). When it's wrong, the run must be able to ask again. Without this, the gate row is already `applied`, D5 reads the latest row, and the only way out is a fresh run.

- `4.1-upload` calls prepare **first**, before it builds the file list or extracts any text, so a plan refusal costs seconds.
- On `publish_plan_invalid`, `project_mismatch` or `version_conflict`, the step asks a new question **on its own step id `4.1-upload`**, with the same decision schema as `3.10-deliver` and the refusal's `detail` in the prompt, and exits 75. Same mechanism every gate uses today (`app_client.py` `ask`); nothing new in the control plane.
- The SIR publisher's `gateSteps` is `['3.10-deliver', '4.1-upload']`, and D5 step 2 takes the **latest** decided row across them. A re-ask therefore supersedes the original answer, and a `revise` on the re-ask ends the run the same way it would at `3.10-deliver`.
- `not_approved`, `publish_not_allowed` and `runbook_not_publishable` don't re-ask; they're not plan problems.
- Follow-up in bureau, not this spec: give the `3.10-deliver` schema a **"this run's project"** branch so the cloud lane's answer needs no uuid at all. Until then the console answer is `project: {id: <runbook_runs.project_id>}`, and the console page can show that id beside the card.

## Deploy order

0. **Measure Q1 before writing the migration.** Call a throwaway `service_role`-only function with `47b82394…`'s 24 MB artifact as a `jsonb` argument through `supabase.rpc()` from a Vercel function: record wall time, memory, and whether PostgREST or the gateway rejects the body. If it fails, D7 changes to the staged-blocks fallback (Q1) **on both lanes**, and that's a v4 of this spec, not a footnote.
1. **substation migration**: `runbook_publishes`, `publish_preprocessing_run`, `publish_sir`. Additive; nothing calls them yet.
2. **substation routes**: `publish/prepare` + `publish/commit`, the registry with both publishers, added to `RUN_BEARER_ROUTES`.
3. **bureau PPv4**: D8 for `publish_step.py`, both lanes.
4. **bureau SIR**: D8 for `publish.ts sir-run`, both lanes. The local rows-after-bytes change ships here.
5. **Acceptance, PPv4:** a fresh cloud run on Valley View Townhomes v3 (the `7025a6b3` request), approved in the console, publishes. Check: one `active` registry row; `preprocessing_run_id` on all 39 sheet_versions; block count equals the artifact's; a `committed` `runbook_publishes` row. Then a local re-publish of an older run flips back, which proves swap semantics through the function.
6. **Acceptance, SIR:** the first cloud SIR run, launched against a **test project**. The gate is answered **in the console** with `versioning: new` and that project's id, then a second run with `iterate`. Check: rows and bytes agree (every `sir_artifact.storage_path` exists at its `byte_size`, under a `<runbook_run_id>/` segment); the version bumps once; nothing is written under `full-run-output/`; geo and outline warnings are in the note. Then three failure drills:
   - kill the sandbox between prepare and commit, resume, and confirm the same SIR id, the same paths, no duplicate rows (the `prepared` retry);
   - make commit **fail** (point the test at a `publish_sir` that RAISEs once), retry, and confirm the row went `failed` → `prepared` → `committed` with `attempts = 2` and the same SIR id (the `failed` retry, the case v2 got wrong);
   - answer the gate with another project's id and confirm `4.1-upload` re-asks on its own step with `project_mismatch` in the prompt, then answer correctly and confirm it publishes (D12).
7. **Acceptance, size:** one deliverable of at least 228 MB (the largest ever shipped) PUT from the sandbox to its signed URL, and its `byte_size` checked at commit (Q11).

## Deliberately deferred

- **`review`, `process-city-response-docs`, other publishers.** They join by adding a registry entry and a function. Not in this spec.
- **`upload-sir`'s interactive flow** (`claude-plugins`, `bun publish.ts publish <plan.json>` with carry-forward rows). It stays service-role and local. It can adopt `publish_sir` later; D9 keeps carry-forward rows representable.
- **Moving `embed.ts` or the DOCX→md extraction out of the sandbox.** Both work there.
- **Garbage-collecting orphaned staged objects** from failed publishes. Bounded by D6 to the run's own reserved prefix, plus at most one stale-version prefix per `iterate` retry that lost a `version_conflict`.
- **A cloud full-run-output mirror** (D11, withdrawn). Comes back only on demand, as its own step.
- **A "this run's project" branch in the `3.10-deliver` schema** (D12), so the cloud answer needs no uuid. Bureau change, small.

## Open questions

- **Q1: Can a 24 MB `jsonb` argument go through `supabase.rpc()`** within PostgREST, `service_role` `statement_timeout`, and Vercel `maxDuration`/memory (PPv4 only; SIR's function arguments are small)? **This is the spec's load-bearing unknown, and it's now deploy-order step 0**: measure with `47b82394…` before the migration exists. Fallback: staging table `preprocessing_run_staged_block` filled in chunks through a third route, and the function swaps from it. The fallback reaches the local lane too (D8), which is why it's measured first.
- **Q2: Does Substation have a direct pooled Postgres connection?** **Answered: no.** `pg` is in `package.json`, but only the integration tests (`src/test/setup.ts`, `*.integration.test.ts`) open one; no route reads `DATABASE_URL`. Adding a pooled connection to a Vercel function is its own decision (pooler, connection limits, a second credential in the function env) and isn't assumed here. If Q1 fails, weigh it against the staging table.
- **Q3: Where does PPv4 artifact validation live?** A zod port duplicates `lib/artifact.ts` (135 lines). **Leaning:** the function enforces scope and required fields; zod is a fast-fail convenience.
- **Q4: Should `approved_unpublished` (PPv4) also go through Substation** to note "nothing written"? Probably no.
- **Q5: `register.ts:86` stamps `preprocessing_version: 3` on v4 runs.** **Confirmed** (the line is a literal `3` under a comment saying v3 stamps 3). D8's merged caller retires it; the function takes the value from the artifact. Still open: confirm the app's PPv2/PPv3 badge renders 4.
- **Q6: May a cloud SIR create or target an org or project other than the run's own `runbook_runs.project_id`?** **Decided: no, for the cloud lane** (D5 step 4, D12). The launch already requires the project, the sandbox and the run token's storage policy are scoped to it, and a runbook gate is the wrong place to grow a new capability (create an org from a text field, with no undo) for the first cloud SIR. The local lane keeps `sirNewRun`'s full plan. v2's leaning (allow, warn on mismatch) is recorded as the alternative if a real cloud case needs it.
- **Q7: Does anyone want a cloud `full-run-output/` mirror at all?** v2 assumed yes and proposed one archive; v3 ships none (D11). If audits or IG need it, it returns as a separate best-effort step: per-file prepare in pages of ~500 URLs, a size ceiling, and the PUT count accepted.
- **Q8: Port `project_outline.py` to TS in Substation, or expose it as a database function** (`set_project_outline(project_id, geojson[])`) that both lanes call? The function would end the Python/TS duplicate; the port is less work.
- **Q9: Should the cloud SIR lane ever carry forward** unchanged prior-version files as row-only pointers (the local `publish` command's D2)? `sir-run` never does today. **Leaning:** no. Every cloud version uploads its full set.
- **Q10: SIR's cloud client: `fetch` inside `publish.ts`, or shell to the Python `app_client.py`?** One client (Python) means one bearer implementation; `fetch` keeps `sir-run` a single process. **Leaning:** Python client, invoked like `project_outline.py` is today.
- **Q11: Large single files.** SIR has shipped a 228 MB file. Neither bucket sets `file_size_limit`, so the project-wide limit applies (at least 228 MB, given that file exists). **Decided: standard signed uploads only, no TUS.** TUS needs a JWT on the bucket, which is exactly the grant D1 refuses; a standard upload goes to 5 GB, 20× the largest deliverable. The client retries a failed PUT (same URL family, `upsert: true`) instead of resuming it. Deploy-order step 7 proves a 228 MB PUT from the sandbox. The archive that would have needed TUS is gone (D11).
