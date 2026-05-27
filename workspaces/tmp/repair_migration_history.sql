-- Repair supabase_migrations.schema_migrations on project Noetic App (mgxqsrjutswbciyrltwd)
-- Marks already-applied intake-chat migrations as recorded. Runs NO DDL against your schema.
-- Generated 2026-05-27 from substation/supabase/migrations. Safe to run inside one transaction.

BEGIN;

-- 20260519180000_realtime_document_section.sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260519180000', 'realtime_document_section', ARRAY[
$mig$
-- Add document_section to the supabase_realtime publication so City Hall can
-- subscribe to per-section changes (insert/update/delete) filtered by
-- document_version_id. Used by the feasibility intake chat to live-update
-- the right panel as the agent's updateIntakeNotes tool adds or updates
-- sections.

ALTER PUBLICATION supabase_realtime ADD TABLE document_section;
$mig$
])
ON CONFLICT (version) DO NOTHING;

-- 20260519200000_document_section_title_unique.sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260519200000', 'document_section_title_unique', ARRAY[
$mig$
-- Add a UNIQUE constraint on (document_version_id, title) to document_section.
--
-- Required by cityhall's feasibility-intake chat: the right-panel agent tool
-- updateIntakeNotes upserts sections by title within a document_version. The
-- prior application-level SELECT-then-INSERT-or-UPDATE pattern had a TOCTOU
-- window where concurrent requests could both insert the same title and
-- produce duplicate rows. With this constraint in place, a concurrent INSERT
-- collision raises 23505 and the caller falls through to UPDATE — making the
-- upsert atomic at the database layer.
--
-- The constraint applies to ALL document_section consumers (not just intake),
-- but verified against production data at migration time: zero existing rows
-- violate (document_version_id, title) uniqueness, so this is a non-breaking
-- change. Other consumers (PDF section ingestion, etc.) already produce
-- distinct titles within a document_version in practice.

ALTER TABLE public.document_section
  ADD CONSTRAINT document_section_document_version_title_unique
  UNIQUE (document_version_id, title);
$mig$
])
ON CONFLICT (version) DO NOTHING;

-- 20260520180000_chat_message_rcm_payload.sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260520180000', 'chat_message_rcm_payload', ARRAY[
$mig$
-- Rich Card Messages (RCM) support on chat_message.
--
-- Two changes:
--   1. New rcm_payload JSONB column. NULL for plain-text messages (the
--      existing default and behavior). Non-NULL marks the row as a
--      Rich Card Message; the FE selects a Svelte component using
--      rcm_payload->>'rcm_type' and renders it with the rest of the
--      payload data.
--   2. Add chat_message to supabase_realtime publication so cityhall can
--      push-subscribe to new rows. Same pattern as conversations and
--      document_section (added previously). Required for RCMs to appear
--      mid-conversation without a full page reload — the agent's text
--      reply streams in via AI SDK, but the RCM is persisted server-side
--      in onFinish and needs realtime to reach the client.
--
-- chat_message.content stays NOT NULL. For RCM rows, content holds a
-- plain-text fallback rendering (used for accessibility, search, and any
-- text-only context the model receives when reconstructing chat history
-- as model messages on subsequent turns).

ALTER TABLE public.chat_message
  ADD COLUMN rcm_payload JSONB;

COMMENT ON COLUMN public.chat_message.rcm_payload IS
'Rich Card Message payload. NULL = plain text (use chat_message.content). '
'Non-NULL = RCM; FE selects component by rcm_payload->>''rcm_type'' and '
'renders with payload data. The plain-text fallback in chat_message.content '
'is what the model sees when chat history is rebuilt on subsequent turns.';

ALTER PUBLICATION supabase_realtime ADD TABLE chat_message;
$mig$
])
ON CONFLICT (version) DO NOTHING;

-- 20260520200000_chat_message_rcm_unique_per_conv.sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260520200000', 'chat_message_rcm_unique_per_conv', ARRAY[
$mig$
-- Enforce one row per (conversation, rcm_type) for Rich Card Messages.
--
-- Background: some RCM kinds are meant to fire exactly once per conversation
-- (tier_1_info_complete is the first of this shape — a milestone card shown
-- when the user first completes Tier 1). The cityhall onFinish guard does a
-- SELECT-then-INSERT dup check, but that's racy: two concurrent requests
-- (rapid double-submit, mid-stream retry) can both pass the empty read
-- before either INSERT lands and both succeed, inserting duplicate RCM
-- rows that render as two cards side-by-side.
--
-- Partial unique index — applies only to RCM rows (rcm_payload IS NOT NULL).
-- Plain-text messages have rcm_payload IS NULL and are unaffected; multiple
-- text messages per conversation continue to work.
--
-- Behavior on conflict: cityhall's RCM-write path already swallows insert
-- errors (logs and proceeds), so a 23505 unique_violation surfaces as a
-- benign log entry — exactly the right behavior for the "lost the race,
-- the other request won" case.
--
-- Companion to 20260520180000_chat_message_rcm_payload.sql (which adds the
-- column). Separate migration because that one was already merged before
-- this followup was authored.

CREATE UNIQUE INDEX chat_message_rcm_type_once_per_conv
  ON public.chat_message (conversation_id, (rcm_payload->>'rcm_type'))
  WHERE rcm_payload IS NOT NULL;
$mig$
])
ON CONFLICT (version) DO NOTHING;

-- 20260521120000_intake_attachments_and_rcm_uniqueness.sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260521120000', 'intake_attachments_and_rcm_uniqueness', ARRAY[
$mig$
-- Phase 1 of the intake-chat file-upload feature.
--
-- Two changes, bundled because the new RCM uniqueness rule (extracting_file
-- scoped per attached document_version) is only meaningful once attachments
-- exist as first-class entities.

-- ============================================================
-- 1. chat_message_attachment junction
-- ============================================================
--
-- One user chat_message can carry N file attachments. Each attachment is a
-- pointer to an already-uploaded document_version (kind = 'intake_attachment'
-- in the cityhall write path, but the kind isn't enforced here — junction
-- stays generic so other chat surfaces can reuse it later).
--
-- ON DELETE CASCADE on both sides: deleting a chat_message removes its
-- attachment links; deleting a document_version (e.g., user removes a file
-- before send) removes the link too. The underlying file in Supabase
-- Storage is cleaned up by the document_version lifecycle, not here.

CREATE TABLE public.chat_message_attachment (
  chat_message_id UUID NOT NULL REFERENCES public.chat_message(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES public.document_version(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_message_id, document_version_id)
);

CREATE INDEX idx_chat_message_attachment_chat_message_id
  ON public.chat_message_attachment(chat_message_id);
CREATE INDEX idx_chat_message_attachment_document_version_id
  ON public.chat_message_attachment(document_version_id);

COMMENT ON TABLE public.chat_message_attachment IS
  'Junction: file attachments on a chat message. document_version is the
   already-uploaded artifact; the message references it by id.';

-- RLS: visibility inherits from chat_message (which inherits from
-- conversation → project access). Writes piggy-back on the same write
-- predicate as chat_message.

ALTER TABLE public.chat_message_attachment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments for accessible messages"
  ON public.chat_message_attachment FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_message m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = chat_message_attachment.chat_message_id
        AND user_can_see_project(c.project_id, auth.uid())
        AND (c.user_id IS NULL OR c.user_id = auth.uid())
    )
  );

CREATE POLICY "Users with write access can insert attachments"
  ON public.chat_message_attachment FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_message m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = chat_message_attachment.chat_message_id
        AND user_has_project_access(c.project_id, auth.uid(), 'write')
        AND (c.user_id IS NULL OR c.user_id = auth.uid())
    )
  );

GRANT ALL ON TABLE public.chat_message_attachment
  TO anon, authenticated, service_role;

-- ============================================================
-- 2. Per-kind RCM uniqueness (replaces blanket rcm_type index)
-- ============================================================
--
-- The previous index (chat_message_rcm_type_once_per_conv) treated every
-- RCM type as "one per conversation". That fits tier_1_info_complete
-- (milestone, exactly once) but breaks extracting_file (one per attached
-- file; a single conversation may have many).
--
-- Replace with a partial unique index per RCM type. Each card kind defines
-- its own uniqueness scope. Future card kinds with their own rules add a
-- new partial index here; no global behavior change.

DROP INDEX IF EXISTS public.chat_message_rcm_type_once_per_conv;

-- tier_1_info_complete: one per conversation (milestone card).
CREATE UNIQUE INDEX chat_message_rcm_tier_1_info_complete_once_per_conv
  ON public.chat_message (conversation_id)
  WHERE rcm_payload IS NOT NULL
    AND rcm_payload->>'rcm_type' = 'tier_1_info_complete';

-- extracting_file: one per (conversation, attached document_version).
-- Multiple files in the same conversation get multiple cards; retries on
-- the same file collapse onto the same row via this index (the cityhall
-- write path will UPDATE state in place rather than INSERT a new row, but
-- this guards the case where two concurrent triggers race).
CREATE UNIQUE INDEX chat_message_rcm_extracting_file_once_per_doc
  ON public.chat_message (
    conversation_id,
    ((rcm_payload->'data'->>'document_version_id'))
  )
  WHERE rcm_payload IS NOT NULL
    AND rcm_payload->>'rcm_type' = 'extracting_file';
$mig$
])
ON CONFLICT (version) DO NOTHING;

-- 20260521210000_document_section_source.sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260521210000', 'document_section_source', ARRAY[
$mig$
-- Add a nullable JSONB column on document_section to track where the row
-- came from. Two writers today:
--
--   chat-typed sections (cityhall updateIntakeNotes tool)
--     → { "kind": "chat" }
--
--   PDF-extracted sections (substation extract-feasibility-intake function)
--     → { "kind": "pdf_extract",
--         "document_version_id": "<uuid of source PDF document_version>",
--         "file_name": "<original upload filename>" }
--
-- Nullable on purpose: pre-existing rows (chat sections that landed before
-- source tracking was wired up) stay NULL — readers should treat NULL as
-- "unknown source" rather than implying anything about origin.
--
-- Free-form JSONB rather than a structured table because (a) the shape is
-- small and self-describing, (b) the kinds enumerate slowly and adding a
-- new kind (e.g., 'imported_from_research') shouldn't need a migration,
-- (c) no aggregation queries today need cross-row indexing on these fields.
-- If that changes, a GIN index on (source->>'kind') is a follow-up.

ALTER TABLE public.document_section
  ADD COLUMN source JSONB;

COMMENT ON COLUMN public.document_section.source IS
  'Where this section came from. { kind: ''chat'' | ''pdf_extract'', ... }.
   See substation 20260521210000 migration for the shape contract.';
$mig$
])
ON CONFLICT (version) DO NOTHING;

-- 20260522180000_chat_message_visible_to_user.sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260522180000', 'chat_message_visible_to_user', ARRAY[
$mig$
-- Add a visibility flag on chat_message so we can persist system-generated
-- context bundles (PDF extraction results, etc.) into the conversation
-- history WITHOUT rendering them in the chat UI.
--
-- Motivation: the LLM benefits from knowing what an out-of-band processor
-- (extract-feasibility-intake) wrote to document_section after the user
-- uploaded a PDF, but the user already sees that information in the
-- right panel and the per-file extracting_file RCM — so re-stating it in
-- a visible chat message is noise. visible_to_user=false rows are sent
-- to the model on the next user turn (cityhall's chat API now queries
-- chat_message directly as the canonical history source), but the FE
-- render loop filters them out.
--
-- Default true preserves all existing rows + future plain-text inserts.
-- The first opt-out path is substation's extract-feasibility-intake
-- writing an XML-wrapped <parsed-files>…<file>…</file>…</parsed-files>
-- message at extraction completion.
--
-- Deployment coordination: cityhall has a separate companion PR that
-- (a) adds the render-side filter so visible_to_user=false rows don't
-- appear in the chat UI, and (b) switches the chat API's model-history
-- source to a canonical DB query so the invisible rows make it into
-- the LLM context. Between this migration applying and the cityhall PR
-- deploying, the only writer of visible_to_user=false rows is the
-- extract-feasibility-intake function — so if a user happens to upload
-- a PDF in that window, the raw <parsed-files> XML block would render
-- as a visible chat message in their UI. Land the cityhall PR
-- immediately after applying this migration to keep the window tight.

ALTER TABLE public.chat_message
  ADD COLUMN visible_to_user BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.chat_message.visible_to_user IS
  'FE render filter: rows with visible_to_user=false are sent to the
   LLM as part of conversation history but never rendered in the chat
   UI. Used for system-generated context messages (e.g. PDF extraction
   summaries wrapped in <parsed-content> XML).';
$mig$
])
ON CONFLICT (version) DO NOTHING;

-- 20260526120000_chat_message_intake_resolution_and_trigger.sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260526120000', 'chat_message_intake_resolution_and_trigger', ARRAY[
$mig$
-- Phase 3 of the feasibility-intake clarifying-questions rework.
--
-- Adds two nullable columns on chat_message and their partial unique indexes,
-- both supporting cityhall's agent-driven processing of uploaded-file data.
-- See cityhall/docs/feasibility-intake-clarifying-questions.md.
--
-- Writers are all in cityhall (the chat agent's updateIntakeNotes tool and the
-- chat-send route). Substation does not write either column — it's a pure
-- extraction service as of Phase 2. The columns live on chat_message because
-- both are facts ABOUT specific chat_message rows (resolution markers and
-- trigger-turn assistant responses, respectively).

-- ============================================================
-- 1. intake_resolution_key — resolution-marker idempotency
-- ============================================================
--
-- When the agent resolves an extracted fact (writes it, or discards it), the
-- updateIntakeNotes tool inserts an invisible <confirmed-intake-data> /
-- <discarded-intake-data> chat_message. If the stream is interrupted mid-turn
-- and the model retries on the next send, the tool can fire again and insert a
-- duplicate marker — which would corrupt the model's resolution-tracking
-- (it counts these tags to decide what's still unresolved).
--
-- intake_resolution_key is a stable key per (marker kind, source file, section)
-- so a retry collides on this index and the second insert is a benign 23505
-- the write path swallows. Format (built cityhall-side):
--   confirmed:<source_dvid>:<section_title>
--   discarded:<source_dvid>:<section_title>
--   discarded_file:<source_dvid>
--
-- Populated only on resolution-marker rows; NULL on everything else.

ALTER TABLE public.chat_message
  ADD COLUMN intake_resolution_key TEXT;

COMMENT ON COLUMN public.chat_message.intake_resolution_key IS
  'Stable idempotency key for <confirmed-intake-data> / <discarded-intake-data>
   resolution-marker rows (format: <kind>:<source_dvid>[:<section_title>]).
   NULL on non-marker rows. Backs chat_message_intake_resolution_unique.';

CREATE UNIQUE INDEX chat_message_intake_resolution_unique
  ON public.chat_message (conversation_id, intake_resolution_key)
  WHERE intake_resolution_key IS NOT NULL;

-- ============================================================
-- 2. trigger_batch_id — follow-up-turn idempotency (two-tab race)
-- ============================================================
--
-- After substation drops an <extraction-batch-ready> signal, cityhall's intake
-- page realtime-fires a follow-up chat turn to process the batch. Two open tabs
-- both see the realtime event and both fire the turn. The assistant response to
-- a trigger turn is stamped with trigger_batch_id; the partial unique index
-- makes the second tab's assistant insert a benign 23505, so only one follow-up
-- response lands per batch.
--
-- Populated only on the assistant chat_message that responds to a trigger turn;
-- NULL on everything else.

ALTER TABLE public.chat_message
  ADD COLUMN trigger_batch_id UUID;

COMMENT ON COLUMN public.chat_message.trigger_batch_id IS
  'Set on the assistant chat_message that responds to an extraction-batch-ready
   trigger turn, equal to the batch_id being processed. NULL otherwise. Backs
   chat_message_trigger_batch_unique (one follow-up response per batch).';

CREATE UNIQUE INDEX chat_message_trigger_batch_unique
  ON public.chat_message (conversation_id, trigger_batch_id)
  WHERE trigger_batch_id IS NOT NULL;
$mig$
])
ON CONFLICT (version) DO NOTHING;

-- Fix corrupt history row (#9): backfill NULL name + statements
UPDATE supabase_migrations.schema_migrations
SET name = 'marketing_leads_source_meeting_request',
    statements = ARRAY[
$mig$
-- Allow 'meeting_request' as a marketing_leads.source value.
-- The /get/diligence-reports/* landing pages submit source='meeting_request'
-- but the original check constraint only permitted 'whitepaper' and 'contact',
-- so those rows were being silently dropped on insert (the webhook swallows
-- the error and returns 200 to Formspark, which is the canonical record).

alter table marketing_leads drop constraint marketing_leads_source_check;
alter table marketing_leads add constraint marketing_leads_source_check
  check (source in ('whitepaper', 'contact', 'meeting_request'));
$mig$
]
WHERE version = '20260526180000';

COMMIT;
