-- Wipe every trace of the feasibility-intake feature from one project.
--
-- Targets all three top-level entities that the intake flow creates per
-- project. Cascade rules in the schema take care of the rest:
--
--   conversations            → chat_message              (CASCADE)
--                            → chat_message_attachment   (CASCADE)
--   submission (feasibility) → submission_version        (CASCADE)
--                            → submission_document       (CASCADE)
--   document (feasibility_intake | intake_attachment)
--                            → document_version          (CASCADE)
--                            → document_section          (CASCADE)
--                            → document_section_attachment (CASCADE)
--
-- Storage bytes (intake_attachment files in the submission-data bucket)
-- are NOT deleted by these statements — capture storage_paths via the
-- audit query below and remove via the storage API if you care about the
-- orphan files. For dev cleanup of one project that is typically overkill.
--
-- Project: d7134fce-e568-4c44-aa2f-7402eec46abc ("Will's Fajitas").
-- Hardcoded — if you want to target a different project, update every
-- occurrence below (or restore the `\set project_id` pattern from git
-- history).

-- ---------------------------------------------------------------------------
-- 1. Preview — counts what's about to be deleted.
--    Run this on its own first; only commit the transaction below if the
--    numbers match what you expect for this project.
-- ---------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM conversations
     WHERE project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
       AND type = 'intake')                                            AS intake_conversations,
  (SELECT count(*) FROM chat_message m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
       AND c.type = 'intake')                                          AS chat_messages,
  (SELECT count(*) FROM submission
     WHERE project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
       AND submission_type = 'feasibility')                            AS feasibility_submissions,
  (SELECT count(*) FROM document
     WHERE project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
       AND kind IN ('feasibility_intake', 'intake_attachment'))        AS intake_documents,
  (SELECT count(*) FROM document_version dv
     JOIN document d ON d.id = dv.document_id
     WHERE d.project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
       AND d.kind = 'intake_attachment')                               AS attachment_versions;

-- Optional: capture storage_paths so you can sweep the bucket separately.
SELECT dv.storage_path
FROM document_version dv
JOIN document d ON d.id = dv.document_id
WHERE d.project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
  AND d.kind = 'intake_attachment';

-- ---------------------------------------------------------------------------
-- 2. Deletion — one transaction so a mid-failure can't leave a half-deleted
--    intake state behind.
-- ---------------------------------------------------------------------------

BEGIN;

-- 2a. Feasibility submissions. Cascades to submission_version and to the
--     submission_document junction rows.
DELETE FROM submission
WHERE project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
  AND submission_type = 'feasibility';

-- 2b. Intake conversations. Cascades to chat_message (which cascades to
--     chat_message_attachment). Removes all visible messages, every
--     invisible <parsed-file-data> / <intake-attach> / <intake-edit> /
--     <confirmed|discarded-intake-data> / <extraction-batch-ready>
--     envelope, every RCM (extracting_file, clarifying_question,
--     tier_1_info_complete), and the chat-message → file junction rows.
DELETE FROM conversations
WHERE project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
  AND type = 'intake';

-- 2c. Intake documents — both the per-conversation `feasibility_intake`
--     corpus and every `intake_attachment` upload. Cascades to
--     document_version, document_section, and document_section_attachment.
--     Stray chat_message_attachment rows referencing these versions also
--     cascade away here (FK is ON DELETE CASCADE on both sides).
DELETE FROM document
WHERE project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
  AND kind IN ('feasibility_intake', 'intake_attachment');

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Post-deletion sanity check — every count should be 0.
-- ---------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM conversations
     WHERE project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
       AND type = 'intake')                                            AS intake_conversations,
  (SELECT count(*) FROM submission
     WHERE project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
       AND submission_type = 'feasibility')                            AS feasibility_submissions,
  (SELECT count(*) FROM document
     WHERE project_id = 'd7134fce-e568-4c44-aa2f-7402eec46abc'
       AND kind IN ('feasibility_intake', 'intake_attachment'))        AS intake_documents;
