-- Repair supabase_migrations.schema_migrations on project Noetic App (mgxqsrjutswbciyrltwd).
-- Records the diligence_artifacts_unique_kind migration (20260602120000),
-- which was applied via the web SQL editor without a history row.
--
-- Bookkeeping only: writes to the history table, runs no schema DDL.
-- Idempotent (ON CONFLICT DO NOTHING), wrapped in a single transaction.

BEGIN;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260602120000', 'diligence_artifacts_unique_kind', ARRAY[
$mig$
-- Unique (diligence_run_id, kind) on diligence_artifacts
--
-- field-agent uploads each deliverable to a deterministic storage path
-- (diligence/<run-id>/sir.pdf, .../appendix.pdf) and UPSERTs the artifact row
-- with ON CONFLICT (diligence_run_id, kind). That requires a unique constraint
-- matching those columns — without it the upsert fails with
-- "no unique or exclusion constraint matching the ON CONFLICT specification".
--
-- This makes a re-run (e.g. an Inngest retry) overwrite the existing row in
-- place rather than inserting a duplicate.
--
-- NOTE: this enforces ONE row per (run, kind). That's correct for the singleton
-- kinds (site_intelligence_report, research_appendix). When the
-- supporting_document_copy path lands — a run can have several supporting docs —
-- this constraint will need revisiting (likely switching the conflict target to
-- (diligence_run_id, storage_path), which is unique per file).

CREATE UNIQUE INDEX diligence_artifacts_run_kind_unique
  ON public.diligence_artifacts (diligence_run_id, kind);
$mig$
])
ON CONFLICT (version) DO NOTHING;

COMMIT;
