-- Repair supabase_migrations.schema_migrations on project Noetic App (mgxqsrjutswbciyrltwd).
-- Records two migrations applied via the web SQL editor without history rows:
--   - 20260529140000 intake_conversations_project_visible
--   - 20260529180000 diligence_runs
--
-- Bookkeeping only: writes to the history table, runs no schema DDL.
-- Idempotent (ON CONFLICT DO NOTHING), wrapped in a single transaction.
-- Supersedes the prior single-migration repair (wnavey/winston#86).

BEGIN;

-- 20260529140000 ------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260529140000', 'intake_conversations_project_visible', ARRAY[
$mig$
-- Make feasibility *intake* conversations visible/usable by ANY project member,
-- not just the user who created them.
--
-- Background: an intake (feasibility research) conversation is a project-level
-- artifact — every collaborator with project access should be able to open the
-- chat, read its history, and continue it. But the original conversation
-- policies (20260512000000_chat_consolidation.sql) gate every row on
-- `user_id = auth.uid()`. That is correct for personal chats (e.g. ask_noetic),
-- but wrong for intake: a teammate viewing a project created by someone else
-- couldn't see the intake conversation at all. The project dashboard pairs each
-- feasibility submission to its intake conversation to build the "Resume chat"
-- link; with the conversation hidden by RLS the pairing came up empty and the
-- link fell back to the bare submission page.
--
-- Fix: for `type = 'intake'` rows, drop the per-user ownership requirement and
-- rely solely on project access (user_can_see_project for reads,
-- user_has_project_access(..., 'write') for writes). All other conversation
-- types keep their owner-only semantics unchanged.
--
-- These four policies are recreated verbatim from the chat_consolidation
-- migration with a single added `type = 'intake' OR ...` escape on the
-- ownership clause.

-- conversations: SELECT --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view conversations for accessible projects"
  ON conversations;
CREATE POLICY "Users can view conversations for accessible projects"
  ON conversations FOR SELECT TO authenticated
  USING (
    user_can_see_project(project_id, auth.uid())
    AND (type = 'intake' OR user_id IS NULL OR user_id = auth.uid())
  );

-- conversations: UPDATE --------------------------------------------------------
DROP POLICY IF EXISTS "Users with write access can update their conversations"
  ON conversations;
CREATE POLICY "Users with write access can update their conversations"
  ON conversations FOR UPDATE TO authenticated
  USING (
    user_has_project_access(project_id, auth.uid(), 'write')
    AND (type = 'intake' OR user_id IS NULL OR user_id = auth.uid())
  );

-- chat_message: SELECT ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can view messages for accessible conversations"
  ON chat_message;
CREATE POLICY "Users can view messages for accessible conversations"
  ON chat_message FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_message.conversation_id
      AND user_can_see_project(c.project_id, auth.uid())
      AND (c.type = 'intake' OR c.user_id IS NULL OR c.user_id = auth.uid())
    )
  );

-- chat_message: INSERT ---------------------------------------------------------
DROP POLICY IF EXISTS "Users with write access can insert messages"
  ON chat_message;
CREATE POLICY "Users with write access can insert messages"
  ON chat_message FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_message.conversation_id
      AND user_has_project_access(c.project_id, auth.uid(), 'write')
      AND (c.type = 'intake' OR c.user_id IS NULL OR c.user_id = auth.uid())
    )
  );
$mig$
])
ON CONFLICT (version) DO NOTHING;

-- 20260529180000 ------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260529180000', 'diligence_runs', ARRAY[
$mig$
-- Diligence Runs: long-running site intelligence report generation
--
-- A diligence run is triggered from a feasibility-intake conversation and runs
-- the noetic-tools:diligence-report skill on a property under consideration for
-- development. Each run produces a Site Intelligence Report PDF and a Research
-- Appendix PDF, tracked as rows in diligence_artifacts.
--
-- Compute runs in field-agent (a standalone Inngest Connect worker; see
-- github.com/noetic-inc/field-agent). field-agent updates status and inserts
-- artifact rows as work progresses.
--
-- Status lifecycle: queued → running → completed | failed | cancelled
--   - queued:     row inserted by Substation's /diligence/trigger; event fired
--   - running:    field-agent picked up the event and started work
--   - completed:  artifacts uploaded; signed URLs available via diligence_artifacts
--   - failed:     error column populated; completed_at set
--   - cancelled:  deliberate user/operator action

-- Main table -----------------------------------------------------------------

CREATE TABLE public.diligence_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inngest_event_id TEXT UNIQUE NOT NULL,

  -- Anchor: the feasibility-intake document_version this run was triggered from.
  -- The kind='feasibility_intake' invariant is enforced by Substation's
  -- /diligence/trigger route (application layer), not by a DB trigger.
  document_version_id UUID NOT NULL REFERENCES public.document_version(id),
  conversation_id UUID REFERENCES public.conversations(id),
  project_id UUID NOT NULL REFERENCES public.project(id),
  triggered_by_user_id UUID REFERENCES auth.users(id),

  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','failed','cancelled')),
  error TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_diligence_runs_status            ON public.diligence_runs(status);
CREATE INDEX idx_diligence_runs_project           ON public.diligence_runs(project_id);
CREATE INDEX idx_diligence_runs_conversation      ON public.diligence_runs(conversation_id);
CREATE INDEX idx_diligence_runs_document_version  ON public.diligence_runs(document_version_id);

CREATE TRIGGER set_diligence_runs_updated_at
  BEFORE UPDATE ON public.diligence_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Artifacts table ------------------------------------------------------------

CREATE TABLE public.diligence_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diligence_run_id UUID NOT NULL
    REFERENCES public.diligence_runs(id) ON DELETE CASCADE,

  kind TEXT NOT NULL
    CHECK (kind IN ('site_intelligence_report','research_appendix','supporting_document_copy')),
  storage_path TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size    BIGINT,
  page_count   INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diligence_artifacts_run  ON public.diligence_artifacts(diligence_run_id);
CREATE INDEX idx_diligence_artifacts_kind ON public.diligence_artifacts(kind);

-- RLS ------------------------------------------------------------------------
-- field-agent writes via service-role and bypasses RLS. Policies here gate
-- reads/writes from authenticated clients (cityhall UI, Substation user routes).

ALTER TABLE public.diligence_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diligence_artifacts ENABLE ROW LEVEL SECURITY;

-- diligence_runs: project-access-based read; write/admin for mutations -------

CREATE POLICY "Users can view diligence runs for accessible projects"
  ON public.diligence_runs FOR SELECT TO authenticated
  USING (public.user_can_see_project(project_id, auth.uid()));

CREATE POLICY "Users with write access can insert diligence runs"
  ON public.diligence_runs FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_project_access_level(project_id, auth.uid()) IN ('write','admin')
  );

CREATE POLICY "Users with write access can update diligence runs"
  ON public.diligence_runs FOR UPDATE TO authenticated
  USING (
    public.get_user_project_access_level(project_id, auth.uid()) IN ('write','admin')
  )
  WITH CHECK (
    public.get_user_project_access_level(project_id, auth.uid()) IN ('write','admin')
  );

CREATE POLICY "Users with admin access can delete diligence runs"
  ON public.diligence_runs FOR DELETE TO authenticated
  USING (
    public.get_user_project_access_level(project_id, auth.uid()) = 'admin'
  );

-- diligence_artifacts: same pattern, gated via the parent run's project ------

CREATE POLICY "Users can view diligence artifacts for accessible projects"
  ON public.diligence_artifacts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.diligence_runs dr
     WHERE dr.id = diligence_artifacts.diligence_run_id
       AND public.user_can_see_project(dr.project_id, auth.uid())
  ));

CREATE POLICY "Users with write access can insert diligence artifacts"
  ON public.diligence_artifacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.diligence_runs dr
     WHERE dr.id = diligence_artifacts.diligence_run_id
       AND public.get_user_project_access_level(dr.project_id, auth.uid()) IN ('write','admin')
  ));

CREATE POLICY "Users with admin access can delete diligence artifacts"
  ON public.diligence_artifacts FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.diligence_runs dr
     WHERE dr.id = diligence_artifacts.diligence_run_id
       AND public.get_user_project_access_level(dr.project_id, auth.uid()) = 'admin'
  ));

-- Realtime -------------------------------------------------------------------
-- Status changes flow to the conversation UI in cityhall so users see the run
-- progress through queued → running → completed without polling.

ALTER PUBLICATION supabase_realtime ADD TABLE public.diligence_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.diligence_artifacts;
ALTER TABLE public.diligence_runs      REPLICA IDENTITY FULL;
ALTER TABLE public.diligence_artifacts REPLICA IDENTITY FULL;
$mig$
])
ON CONFLICT (version) DO NOTHING;

COMMIT;
