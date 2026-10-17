-- Repair supabase_migrations.schema_migrations on project Noetic App (mgxqsrjutswbciyrltwd).
-- Records the intake_conversations_project_visible migration (20260529140000),
-- which was applied via the web SQL editor without a history row.
--
-- Bookkeeping only: writes to the history table, runs no schema DDL.
-- Idempotent (ON CONFLICT DO NOTHING), wrapped in a single transaction.

BEGIN;

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

COMMIT;
