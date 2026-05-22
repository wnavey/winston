# Feasibility Intake Chat — File Upload + Extraction

Workspace tracking the file-upload + background-extraction feature on the
feasibility-intake chat surface. Users drop PDFs into the intake composer; an
Inngest function reads them with Gemini and populates the right-panel
Tier 1/2/3 sections automatically.

Shipped end-to-end across `cityhall` (SvelteKit) and `substation`
(Hono+Inngest). This doc is a cold-pickup map and a list of known follow-ups.

## Goal

> "User just uploads docs and says 'get all the info from these PDFs'."

User journey:

1. User opens the intake chat for a feasibility submission.
2. They drag/drop a PDF (concept plan, OM, title commitment, ESA) onto the
   composer or pick it via the `+` menu.
3. Pre-send: chip with spinner while bytes go to Supabase Storage.
4. User types whatever else (or nothing) and hits Send.
5. The chat shows their bubble with a file chip + an `extracting_file` RCM
   card with a spinner.
6. In the background, the extractor reads the PDF with Gemini 3.1 Pro,
   upserts Tier 1/2/3 sections into `document_section`, and flips the
   `extracting_file` RCM to a green check.
7. If extraction completes Tier 1 from the document alone, the
   `tier_1_info_complete` milestone RCM fires (with a "Start research" CTA).

## Architecture

### Repos involved

- **`cityhall`** — SvelteKit UI + chat API. Composer, RCM rendering,
  chat-message persistence, source attribution on chat-typed sections.
- **`substation`** — Hono REST + Inngest. Upload pipeline endpoints, the
  Gemini extraction Inngest function, source attribution on PDF-extracted
  sections.

### Key files

| Repo | Path | Role |
|---|---|---|
| cityhall | `src/routes/(app)/project/[projectId]/submission/[submissionId]/intake/[conversationId]/+page.svelte` | Composer + drag-drop + chip rendering + source pill in right panel |
| cityhall | `src/routes/(app)/.../intake/[conversationId]/+page.server.ts` | Loads messages with attachments + sections with source |
| cityhall | `src/routes/api/chat/intake/+server.ts` | Chat POST: persist user msg + attachments + extracting_file RCM, dispatch event, stream agent reply, fire tier_1 RCM in onFinish |
| cityhall | `src/lib/intake/upload.ts` | Browser-side upload helper (`prepare-upload` → signed PUT → `commit-upload`) |
| cityhall | `src/lib/intake/tiers.ts` | Canonical Tier 1/2/3 titles, tier-completion matcher |
| cityhall | `src/lib/rcm/schemas.ts` | Zod payloads for `tier_1_info_complete` + `extracting_file` |
| cityhall | `src/lib/rcm/ExtractingFile.svelte` | Per-file extraction card (spinner / check / error) |
| cityhall | `src/lib/rcm/Tier1InfoComplete.svelte` | Tier 1 milestone card with "Start research" CTA |
| substation | `src/routes/feasibility-intake.ts` | `/feasibility-intake/extract` REST endpoint — cityhall calls; dispatches one Inngest event per attachment |
| substation | `src/inngest/functions/feasibility-intake-extraction/main.ts` | Extract Inngest function: load doc → download → Gemini → upsert → flip RCMs |
| substation | `src/inngest/functions/feasibility-intake-extraction/extract.llm.ts` | Gemini call + Zod-validated extraction schema + prompt |
| substation | `src/routes/submissions.ts` | `prepare-upload` + `commit-upload` (with `document_kind` param) |

### Database surface

Migrations (all in `substation/supabase/migrations/`):

| Migration | Adds |
|---|---|
| `20260520180000_chat_message_rcm_payload.sql` | `chat_message.rcm_payload` JSONB + realtime |
| `20260520200000_chat_message_rcm_unique_per_conv.sql` | Initial RCM uniqueness index (superseded) |
| `20260521120000_intake_attachments_and_rcm_uniqueness.sql` | `chat_message_attachment` junction + per-kind RCM uniqueness (tier_1_info_complete unique per conv; extracting_file unique per (conv, document_version_id)) |
| `20260521210000_document_section_source.sql` | `document_section.source` JSONB column |

### Event + data flow

```
Composer (chip spinner)
   → prepare-upload (cityhall proxy) → signed Storage PUT
   → commit-upload (with document_kind: 'intake_attachment')
       creates document (kind=intake_attachment) + document_version
       SKIPS the standard process-file Inngest (engineering-drawing pipeline)
   ↓
   chip = ready, has document_version_id
   ↓
User hits Send → chat.sendMessage(text, { headers: x-attachment-document-version-ids })
   ↓
POST /api/chat/intake (cityhall)
   1. Parse attachment IDs, lookup document_versions for filenames + ownership
   2. Synthesize text if empty + attachments → "(uploaded site-plan.pdf)"
   3. Persist user chat_message (content + created_at = requestStartedAt)
   4. Insert chat_message_attachment links
   5. Insert extracting_file RCM rows (one per file, state='processing')
   6. POST substation /feasibility-intake/extract with the (rcm_id, doc_version,
      intake_doc_version, conv_id) tuples
   7. streamText (Haiku 4.5) — system prompt + turn-specific upload-turn suffix
      if attachments present (suspends Tier 1 nudge for this turn)
   ↓
substation /feasibility-intake/extract
   - Validates ownership on BOTH source PDF AND intake doc_version (both must be
     in this project)
   - Fans out N inngest events (one per file)
   ↓
extract-feasibility-intake Inngest function (one run per file)
   1. Load source document_version → storage_path + file_name
   2. Mark document_version processing_state='processing'
   3. Download PDF from Storage → base64
   4. Gemini 3.1 Pro generateObject against tiered Zod schema (whole PDF, one call)
   5. Upsert document_section rows (SKIP-on-conflict by title, case-insensitive;
      writes source = { kind: 'pdf_extract', document_version_id, file_name })
   6. Mark document_version processing_state='processed'
   7. UPDATE extracting_file RCM rcm_payload to state='done' (with JSONB
      state-guard against terminal states)
   8. If Tier 1 now newly complete, insert tier_1_info_complete RCM (with
      one-shot partial unique index as the race guard)
   ↓
Realtime → cityhall invalidateAll() → right panel + chat updates in place
```

### Design decisions (load-bearing)

- **Trigger at chat-send, not at upload-finish.** User may remove a chip before
  sending; only commit work for what they actually committed to. RCM insert and
  event dispatch are paired in the same handler.
- **Whole PDF, single Gemini call.** Intake docs are typically small (OMs,
  title commitments, ESAs) and cross-page synthesis matters (address on page 1,
  unit count on page 12). Per-page rasterization would lose that. Hit Gemini's
  ~50MB inline limit → revisit page-chunking.
- **Skip-on-conflict for PDF extraction.** Chat-agent updateIntakeNotes
  overwrites by title (user wins). PDF extraction is opposite: existing
  user-typed sections preserved; only new titles inserted. Conflict-resolution
  UX is a separate phase (Item 3 below).
- **`document_section.source` JSONB.** `{ kind: 'chat' | 'pdf_extract', ... }`.
  Tracks per-row provenance. Renders as a small "from X.pdf" pill on the
  right panel for PDF-derived sections; chat-typed sections render no pill
  (default expectation).
- **Tier-string contract restated inline in substation.** `TIER_1_CANONICAL_TITLES`
  + tier names are duplicated between cityhall (`src/lib/intake/tiers.ts`) and
  substation (extraction prompt + tier-1-completion check in `main.ts`). Small
  string contract; cross-repo import would be heavier than the duplication risk.
  **If you change canonical Tier 1 titles, update BOTH repos.**

## What we shipped — by PR

### Phase 1 — Schema + persistence groundwork
- `cityhall#426` — Persist user message at POST entry (so mid-stream RCMs sort after); add `extracting_file` payload schema; loosen RCM_COMPONENTS to Partial.
- `substation#75` — `chat_message_attachment` junction + per-kind RCM partial unique indexes.

### Phase 2 — Upload UI
- `substation#76` — `commit-upload` accepts optional `document_kind` param. When set, skips magic-byte autoclassification AND the engineering-drawing `process-file` Inngest. Default behavior unchanged.
- `cityhall#427` — Paperclip composer (later replaced with `+` menu in #432), drag-drop, file chips pre-send, junction wiring, chip rendering on user bubbles, server-side ownership check before junction insert.

### Phase 3 — extracting_file RCM card
- `cityhall#428` — Compact card with spinner/check/error states. One row per attachment inserted at POST entry. Phase 4 owns the state transitions via UPDATE in place.

### Phase 4 — Extraction
- `substation#77` — `extract-feasibility-intake` Inngest function (Gemini 3.1 Pro, whole-PDF, skip-on-conflict upsert) + `/feasibility-intake/extract` REST endpoint with both-side ownership validation + Idempotency-Key + `document_version.processing_state` tracking + sanitized user-facing error messages + JSONB state guard on the RCM update. Includes the `document_section.source` migration.
- `cityhall#429` — Emit one Inngest event per attachment via the new substation endpoint. Captures inserted RCM ids via `.select('id')`. Updated system prompt.
- `cityhall#430` + `substation#78` — Type regen + drop the `as never` workarounds after the source migration applied to remote.

### Polish
- `cityhall#431` — Render "from X.pdf" source pill in the right panel for PDF-derived sections.
- `cityhall#432` — Replaced paperclip with `+` button + dropdown menu ("Add files"). Click-outside + Escape close.

### Smoke-test fallout (all merged)
- `cityhall#433` — Fix race: attachment IDs were lost between `chat.sendMessage` and the sync chip clear. Switched to per-call header capture.
- `cityhall#434` — Allow file-only sends (no typed text required). Synthesize `(uploaded files)` placeholder for the user bubble + agent context.
- `substation#79` — Fire `tier_1_info_complete` RCM after extraction if Tier 1 newly complete (cityhall onFinish only fires it on chat turns; a PDF-only completion would otherwise stay dormant). Plus a follow-up commit addressing review blockers (throw on non-23505 errors, add `conversationId` to NonRetriableError guard).
- `cityhall#435` — Filename-aware placeholder (`(uploaded site-plan.pdf)` instead of generic `(uploaded files)`) + turn-specific system suffix that suspends the Tier 1 nudge rule on upload turns + base-prompt section that anticipates upload signals BEFORE the file is attached + dropped "in parallel" architecture language.

### Op-side lesson
- Inngest doesn't auto-sync new functions on every deploy. After adding
  `extract-feasibility-intake` in `substation#77`, the function was live in
  Vercel but Inngest's registry didn't know about it; first event silently
  dropped. **Manual resync in the Inngest dashboard's Apps view** registered
  it. Required once per new function; not needed for redeploys that don't
  add new triggers.

## Open follow-ups

Listed in roughly descending value. None of these block the current feature
working; they're sharpening opportunities surfaced during build and smoke-test.

### A. Retry button on failed `extracting_file` RCM — small, real

The card has a `failed` state, but it's a dead end. Gemini calls fail
occasionally (transient API, timeout, corrupt PDF). User's only recourse
today is re-upload, which means orphaning the old `document_version`.

**Shape:** Add a "Retry" button to `ExtractingFile.svelte` when `state === 'failed'`. On click → POST a small endpoint that dispatches another `feasibility_intake/file.uploaded` event for the same `(document_version_id, intake_document_version_id, conversation_id, extracting_file_rcm_chat_message_id)`. Substation's onFailure already handles re-running cleanly.

**Cost:** ~1 day across both repos.

### B. AI SDK file parts on the chat agent — medium, demo-worthy

Today the chat model is blind to the attached PDF — it only sees the
*extracted sections* on subsequent turns. Adding file parts to the message
stream would let the user ask things like "what's the cap rate they're
projecting in this OM?" mid-turn. Complementary to extraction (which
remains canonical persistent state).

**Shape:** FE composer keeps the file blob alongside the document_version_id.
Transport sends file parts in addition to the existing extraction dispatch.
Server-side, only inject file parts into modelMessages — extraction continues
out-of-band as today.

**Cost:** Medium. Open question: which messages get the file parts attached?
Only the upload turn? All future turns once attached? Conversation-scoped?

### C. Conflict-resolution RCM — wait until it bites

Today PDF extraction skip-on-conflict means a user who typed "14 units" and
later uploads a doc that says "16 units" gets their 14 preserved silently.
The truth from the doc is buried.

**Shape:** When extraction finds a value that conflicts with an existing
section's content (definition of "conflicts" TBD — heuristics or LLM judgment),
emit a `tier_field_conflict` RCM that shows both values with a "merge / replace
/ keep mine" choice. Record the user's choice back into `document_section`.

**Cost:** Medium-large. Needs new RCM type + schema + Svelte card +
extraction-time conflict detection (LLM diff or rule-based) + a way to record
the choice. Defer until we see conflicts actually happening in practice — if
they're rare, this is over-engineering.

### D. Orphan-sweep — background tech debt

Two sources of orphans:
1. User uploads a file, then removes the chip before sending. The
   `document_version` row + Storage blob persist.
2. User uploads a file, sends, but the chat_message_attachment insert fails
   (today this is soft-fail). The link is missing but the doc remains.

**Shape:** Periodic Inngest cron job, or on-conversation-end. Find
`document_version` rows of `kind='intake_attachment'` that have no
`chat_message_attachment` link AND were created >24h ago; delete Storage
blob + DB row.

**Cost:** Small. Wait until row count or storage cost actually matters.

### E. Cancel an in-flight upload — niche

Removing a chip while it's still in `uploading` state yanks it from the
composer but the underlying `commit-upload` still completes server-side,
creating an orphan. Currently degenerates into Item D.

**Shape:** Track the in-flight fetch's AbortController on the chip;
cancel on remove. Doesn't help if `commit-upload` has already started
(no idempotent cancel path on the server side today).

**Cost:** Small. Compounds with Item D.

## Tracing / debug guide

When something seems off, walk this path:

1. **Inngest dashboard** → Apps → substation → Functions →
   `extract-feasibility-intake` → Runs filtered to recent. Look for failures
   or missing runs.
2. If no runs at all for a recent upload, check that the event was even
   dispatched: dashboard → Events → filter `feasibility_intake/file.uploaded`.
3. **`document_version.processing_state`** on the source PDF's row:
   - `pending` — event never reached the Inngest function (most likely:
     dispatch failed OR Inngest sync lag after a new function deployed)
   - `processing` — function started but didn't finish (look at run details)
   - `processed` — happy path
   - `failed` — `onFailure` handler ran; the `extracting_file` RCM should
     have a red error message
4. **Vercel function logs** for `/api/chat/intake` — server `console.error`
   from soft-fail paths surfaces things like "dropped N attachment id(s) the
   caller cannot read" (ownership check filtered them) or
   "failed to insert chat_message_attachment".
5. **Supabase SQL** — for a given conversation_id, join through
   `chat_message`, `chat_message_attachment`, `document_version`,
   `document_section` to see the full state.
