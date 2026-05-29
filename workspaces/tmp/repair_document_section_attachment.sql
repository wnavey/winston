-- Repair supabase_migrations.schema_migrations on project Noetic App (mgxqsrjutswbciyrltwd).
-- Records the document_section_attachment migration (20260529120000) which was
-- applied via the web SQL editor without a history row.
--
-- Bookkeeping only: writes to the history table, runs no schema DDL.
-- Idempotent (ON CONFLICT DO NOTHING), wrapped in a single transaction.

BEGIN;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260529120000', 'document_section_attachment', ARRAY[
$mig$
-- Phase 1 of the Tier 2 attachment-slots feature
-- (cityhall/docs/feasibility-intake-tier2-attachments.md).
--
-- Adds the edge from a document_section (a right-panel row on the
-- feasibility_intake document) to a document_version (an uploaded
-- intake_attachment file). Tier 2 sections (Concept Site Plan Doc + Other
-- docs) become attachment-typed: their captured-ness is "does the section
-- have ≥1 attached document_version?" rather than "does its content body
-- have text?".
--
-- The junction is generic — the schema doesn't know about tier semantics.
-- Cardinality (Concept = 1 file max, Other docs = N) is enforced at the
-- application layer (cityhall updateIntakeNotes tool + the direct-edit form
-- action). The schema only enforces "same (section, dv) pair can't be
-- inserted twice" via the composite PK.
--
-- ON DELETE CASCADE on both sides:
--   - deleting a document_section removes its attachment links;
--   - deleting a document_version (e.g., admin cleanup) removes the link.
--     The underlying storage bytes are managed by the document_version
--     lifecycle, not here.

-- ============================================================
-- 1. document_section_attachment junction
-- ============================================================

CREATE TABLE public.document_section_attachment (
  document_section_id UUID NOT NULL REFERENCES public.document_section(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES public.document_version(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_section_id, document_version_id)
);

CREATE INDEX idx_document_section_attachment_section
  ON public.document_section_attachment(document_section_id);
CREATE INDEX idx_document_section_attachment_document_version
  ON public.document_section_attachment(document_version_id);

COMMENT ON TABLE public.document_section_attachment IS
  'Junction: file attachments pinned to a document_section. Backs the Tier 2
   attachment slots (Concept Site Plan Doc, Other docs) on the feasibility
   intake right panel. Application enforces per-tier cardinality.';

-- ============================================================
-- 2. RLS
-- ============================================================
--
-- Reads inherit from the chain document_section → document_version →
-- submission_document → submission_version → submission → project, gated
-- by user_can_see_project. Writes are service-role only — document_section
-- itself has no user INSERT/UPDATE policy (cityhall writes via the admin
-- client through the updateIntakeNotes tool and direct-edit form actions),
-- so this junction matches that pattern: no INSERT/UPDATE policies for
-- authenticated.

ALTER TABLE public.document_section_attachment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments for accessible sections"
  ON public.document_section_attachment FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.document_section ds
      JOIN public.document_version dv ON dv.id = ds.document_version_id
      JOIN public.submission_document sd ON sd.document_version_id = dv.id
      JOIN public.submission_version sv ON sv.id = sd.submission_version_id
      JOIN public.submission s ON s.id = sv.submission_id
      WHERE ds.id = document_section_attachment.document_section_id
        AND user_can_see_project(s.project_id, auth.uid())
    )
  );

GRANT ALL ON TABLE public.document_section_attachment
  TO anon, authenticated, service_role;

-- ============================================================
-- 3. Realtime publication
-- ============================================================
--
-- Cityhall's right panel subscribes to attachment changes so chips appear
-- and disappear live as the agent pins via updateIntakeNotes or the user
-- triggers the direct-edit detach form action. Mirrors the document_section
-- realtime pattern (20260519180000_realtime_document_section.sql).

ALTER PUBLICATION supabase_realtime ADD TABLE public.document_section_attachment;
$mig$
])
ON CONFLICT (version) DO NOTHING;

COMMIT;
