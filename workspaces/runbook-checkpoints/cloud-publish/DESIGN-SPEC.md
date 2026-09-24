# Cloud Publish: Substation publishes a preprocessing run in one transaction

**Status:** Draft v1
**Date:** 2026-09-24
**Repos touched:** `substation` (two run-bearer routes, one migration: the publish function + a registry column), `bureau` (`preprocessing-v4/scripts/publish_step.py` picks a lane; `publish.ts` / `register.ts` become thin callers of the same function)
**Repos NOT touched:** `conductor2`, `cityhall`, `claude-plugins`

## Problem

A cloud run of preprocessing-v4 cannot publish. Cloud run `7025a6b3-ace3-4a3a-b9af-b7e5e16a78d5` (Valley View Townhomes, submission `8fea702d…` v3, 2026-09-24) got through every reading step. Its `3.3-hitl` gate was answered `approved` by a signed-in user (`runbook_hitl_questions`: `status=applied`, `decision.status=approved`, `decided_by_user_id` set, decided 16:44:47Z). It then failed at `4.1-publish`:

```
error: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (service-role, RLS-bypass).
      at getSupabase (preprocessing-v4/scripts/lib/supabase.ts:21:15)
      at register.ts:36:12
embedded 526 blocks (1536-dim) -> …/4.1-publish/scratch/artifact.json
register.ts exited 1
```

This was a designed-in block, not a crash:

1. **The publish scripts are service-role only.** `lib/supabase.ts:16-29` builds a service-role client and nothing else. Its header says the publisher "runs locally in the operator's session with the service-role key". The runbook README says the same.
2. **The sandbox never gets a service-role key, by design.** `substation/src/lib/runbook/env.ts:121` `isForbiddenRunbookEnvVar` refuses every `*SERVICE_ROLE*` variable because "the sandbox outlives the run" (`runbooks/lib/submission_db.py:78-86`).
3. **The run token can't write what publish writes.** Prod grants and policies for role `workflow_run`, checked 2026-09-24:

   | Table | publish does | `workflow_run` has |
   |---|---|---|
   | `site_plan_preprocessing_run` | INSERT (register), UPDATE status (flip) | **nothing**: no grant, no policy |
   | `sheet_version` | UPDATE summary/label/reading_guide/…/`preprocessing_run_id` | SELECT only |
   | `sheet` | UPDATE label | SELECT only |
   | `content_block` | DELETE then INSERT per sheet | SELECT only |
   | `document_section` | DELETE then INSERT per document | SELECT only |
   | `document`, `document_version`, `plan_set_version` | UPDATE | write already granted |

4. **Publish is not atomic today.** `publish.ts` makes ~5 PostgREST calls per sheet, plus documents and the status flip, in sequence. Its own comment (`publish.ts:58-63`) marks this as the named pre-production hardening item from PPv2 **D47** ("the per-entity transaction (a Postgres RPC) and whole-swap atomicity … required before … it runs on real projects"). `register.ts` is a separate process before it, so a crash between the two leaves an orphaned `inactive` registry row.
5. **The artifact is too big to pass through a Vercel function.** Registered artifacts in prod run **19.9–24.0 MB** (largest: run `47b82394…`, 755 blocks, 24,037,889 bytes). Almost all of it is the 1536-dim embeddings. `substation/src/lib/gate-files.ts` already records the constraint: "A Vercel function body is capped well below the 10 MB an attachment may be … so a route that accepted the file itself could not carry the files it exists for."

The database is untouched by `7025a6b3`: `register.ts` died before its first write. The run's artifact exists only in the Vercel sandbox.

## Decision summary

**Option 2b**: the sandbox never writes the published tables. It uploads its artifact through a signed URL that Substation issues. It then asks Substation to publish, and Substation checks the approval itself and runs register + publish as **one Postgres function in one transaction**. The run token's grants do not change.

Considered and rejected, **option 2a**: give `workflow_run` write/delete on the five tables above (project-scoped RLS) and point `lib/supabase.ts` at the run token. It's less code, but a long-lived, snapshotted sandbox would then hold a 25 h token that can delete and rewrite a project's published content blocks. That's the posture `env.ts:121` and substation#267 (control-plane writes service-role-only, reached via `/gates`) exist to avoid. The run-bearer allowlist (`src/middleware/run-bearer.ts:27-45`) is already how Substation lets a sandbox do things its token may not: `/gates`, `/gate-files`. Publish joins that list.

## Design

### D1: The run token's grants do not change

No new `workflow_run` grant or policy on any table in §Problem.3. The sandbox's only new abilities are two run-bearer routes, each scoped to its own run by `HMAC(:runId)`.

### D2: `POST /api/runs/:runId/publish-upload` issues a signed upload URL for the artifact

Modelled directly on `/gate-files` (`src/lib/gate-files.ts`, `runs.ts:853` `createSignedUploadUrl`):

- Body: `{ sha256: <64 hex>, bytes: <int> }`. No path, no name.
- Substation builds the path itself: `<project_id>/preprocessing-runs/<submission_version_id>/<runbook_run_id>/artifact.json`, using the run row's own `project_id` and `submission_version_id`. That's the same prefix `register.ts:50` uses today, with the runbook run id in place of the slug, so one run has one artifact path and a retry overwrites instead of forking.
- Returns `{ upload_url, storage_path }`. The bytes go straight from the sandbox to Storage and never cross Substation.
- Refuses unless the D4 authorization already holds. Uploading 24 MB for a run that can't publish is wasted work.

### D3: `POST /api/runs/:runId/publish` registers and publishes in one call

- Body: `{ sha256, run_slug }`. `run_slug` is display metadata only.
- Substation:
  1. Re-checks the D4 authorization.
  2. Downloads the artifact from the D2 path (service role), checks the sha256, and validates its shape. The validation is a zod port of `lib/artifact.ts` `validateArtifact(…, { requireEmbeddings: true })`; see Q3.
  3. Calls `publish_preprocessing_run(...)` (D5) once.
  4. Writes a `note` checkpoint (`published run <id>: N sheets, M blocks, K documents`) to the run's stream.
  5. Returns `{ site_plan_preprocessing_run_id, counts }`.
- **Idempotent on the runbook run:** a second call for a run already published returns the existing registry row and changes nothing (D6).
- Long-running: set `maxDuration` for this route. The 24 MB download plus one large transaction won't fit the default (Q1).

### D4: Substation checks the approval itself; it doesn't trust the sandbox

The sandbox saying "approved" isn't enough; publishing is the one step that writes customer-visible data. Both routes require all of these, from Substation's own tables:

- `runbook_runs.runbook = 'preprocessing-v4'`. An allowlist, extended when another runbook needs this.
- `runbook_runs.request->'publish'->>'allowed' = 'true'`. Same rule as `3.3-hitl`'s contract and `publish_step.py`.
- The latest `runbook_hitl_questions` row for `step = '3.3-hitl'` on this run has `decision->>'status' = 'approved'`, `status` in (`decided`, `applied`), and a non-null `decided_by_user_id`.

A refusal is a 403 with a named reason (`publish_not_allowed`, `not_approved`, `runbook_not_publishable`), which the captain surfaces instead of retrying.

### D5: One Postgres function does register + publish, all-or-nothing

`public.publish_preprocessing_run(p_runbook_run_id uuid, p_submission_version_id uuid, p_storage_path text, p_run_ref text, p_execution_metadata jsonb, p_artifact jsonb) returns uuid`

- `SECURITY INVOKER`, `EXECUTE` granted to `service_role` only, revoked from `public`/`anon`/`authenticated`/`workflow_run`. Same posture as `runbook_hitl_ask` (#267).
- One transaction, in `publish.ts`'s order, so its semantics carry over unchanged. `publish(A) → publish(B) → publish(A)` still restores A exactly:
  1. INSERT the `site_plan_preprocessing_run` row (`status='inactive'`, `preprocessing_version` from the artifact; see Q5), or return the existing one for this `p_runbook_run_id` (D6).
  2. Per sheet: DELETE `content_block` for the sheet_version, INSERT the artifact's blocks, UPDATE `sheet_version` (…, `preprocessing_run_id`), UPDATE `sheet.label`.
  3. UPDATE `plan_set_version.title_block_meta` when present.
  4. Per document: UPDATE `document` name/label, UPDATE `document_version` summary + `preprocessing_run_id`, DELETE then INSERT `document_section`.
  5. Deactivate siblings, then activate this run and set `published_at`. That order keeps `idx_site_plan_preprocessing_run_one_active` happy mid-transaction, exactly as `publish.ts:179-197` does now.
- **Scope guard inside the function, not just in Substation:** RAISE if any `sheet_version_id` / `document_version_id` / `plan_set_version_id` in the artifact isn't under `p_submission_version_id`. The artifact was written in an untrusted sandbox; this is what stops a bad or hostile artifact from rewriting another project's rows through a service-role call.
- Any failure rolls the whole thing back: no half-cleared sheets, no orphaned registry row. That discharges PPv2 D47's hardening item.
- **Storage is not in the transaction.** The artifact upload (D2) happens first. If the function fails, what's left is an orphaned `artifact.json` under the run's own prefix and no database change; a retry overwrites it.

### D6: The registry remembers which runbook run produced it

New nullable column `site_plan_preprocessing_run.runbook_run_id uuid references runbook_runs(id)`, with a unique partial index `where runbook_run_id is not null`. That's what makes D3 idempotent: a captain retry, or a duplicated POST after a timeout, finds the row and returns it. Local-lane runs registered by a person (no `runbook_runs` row, or `conductor init`'s row) fill it when they have one.

### D7: Both lanes call the same function

The function replaces `publish.ts`'s body on the local lane too. There would be one implementation of publish semantics, and local publishes become transactional as well.

- `register.ts` keeps its Storage upload (service role, local), then calls `publish_preprocessing_run` via `sb.rpc(...)`. It merges with `publish.ts`: the two-process seam that could orphan a row goes away.
- The local lane still holds the service-role key; nothing changes about who may run it there.

### D8: `publish_step.py` picks the lane from its credentials

Following `runbooks/lib/app_client.py`'s existing order (bearer first; `run_bearer` at `:205`, ordering at `:356`):

- `CONDUCTOR_CALLBACK_TOKEN` + `SUBSTATION_URL` present (cloud): `embed.ts` (unchanged; the sandbox already holds `AI_GATEWAY_API_KEY`, and embedding worked on `7025a6b3`), then `POST publish-upload`, PUT the bytes to the signed URL, then `POST publish`.
- Otherwise `SUPABASE_SERVICE_ROLE_KEY` (local): embed, then register+publish as in D7.
- Neither: fail with a message naming both.
- `publish-record.json` gains `lane: "cloud" | "local"`. The `4.1-publish` contract accepts either.

The bearer client lives in `app_client.py` next to the existing `/gates` calls, not in `publish_step.py`.

## Deploy order

1. **substation migration**: D5 function + D6 column/index. Additive; nothing calls it yet.
2. **substation routes**: D2 + D3, added to `RUN_BEARER_ROUTES`. Additive.
3. **bureau**: D7 + D8. Local publishes switch to the function immediately; cloud runs start publishing.
4. **Acceptance**: a new cloud run of preprocessing-v4 on Valley View Townhomes v3 (the `7025a6b3` request, unchanged), approved at `3.3-hitl`, publishes. Then check: one `active` registry row carrying `runbook_run_id`; `preprocessing_run_id` stamped on all 39 sheet_versions; block count equals the artifact's. Then a local re-publish of an older run flips it back, which proves `publish(A)→publish(B)→publish(A)` through the function.

Run `7025a6b3` itself is not recovered. Its artifact lives only in the sandbox, and the point of the exercise is the flow.

## Deliberately deferred

- **Other runbooks' publishes** (`review`, `sir`, `process-city-response-docs`). Same shape and the same D4 allowlist, but each has its own tables. This spec does preprocessing-v4 only.
- **Moving `embed.ts` out of the sandbox.** It works there; moving it would put 24 MB of vectors on the Substation side for no gain.
- **Garbage-collecting orphaned artifacts** from failed publishes. They're bounded to one per runbook run (D2's path) and sit under the project's own prefix.

## Open questions

- **Q1: Can a 24 MB `jsonb` argument go through `supabase.rpc()` within Substation's limits?** That means PostgREST's request handling, `statement_timeout` for `service_role`, and the route's `maxDuration`/memory on Vercel. Measure with the largest prod artifact (`47b82394…`, 24.0 MB) before building D3. **Fallback if not:** Substation inserts blocks into a staging table (`preprocessing_run_staged_block`, keyed by `runbook_run_id`) in chunks, outside the transaction, and the function reads from staging. Only the swap then needs to be atomic, which is the part that matters.
- **Q2: Does Substation have a direct Postgres connection** (a pooled `DATABASE_URL`) it could use instead of PostgREST for the function call? That would make Q1 moot, and binary transfer of the embedding arrays possible.
- **Q3: Where does artifact validation live?** A zod port in Substation duplicates `lib/artifact.ts` (135 lines), which can drift. Doing it in the function means SQL-side checks of shape, not just scope. **Leaning:** the function enforces scope and required fields, and Substation's zod is a fast-fail convenience that the function doesn't depend on.
- **Q4: Should `approved_unpublished` also flow through Substation**, to record "nothing written" in the run stream? Today `publish_step.py` writes the record locally and that suffices; probably no.
- **Q5: `register.ts` stamps `preprocessing_version: 3` on every run**, including v4 ones (`register.ts:86`). That's a small existing bug in the registry the app's PPv2/PPv3 badge reads. The function should take the version from the artifact, and v4 should say 4. Confirm the badge handles 4.
