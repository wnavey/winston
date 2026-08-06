# SIR Chat — Ask-Questions AI Chat on the Site Intelligence Report Page

**Status:** Draft v2
**Date:** 2026-08-06 (v2: 2026-08-06)
**Repos touched:** `cityhall` (chat route, reset route, SIR-page UI + loader gate, shared availability helper, inline system prompt), `substation` (one additive migration: `conversations` columns + CHECK + index; **and** the one-off DOCX→text backfill script)
**Repos NOT touched:** `navalbase` (v2: no longer touched — backfill moved to substation), `bureau` (SIR pipeline unchanged for MVP — no text artifact emitted at publish time yet), `conductor`, `surveyor`, `dsd`/RDS

> **Revision note (v2, 2026-08-06)** — folds in an audit pass. Material changes:
> - **Extraction source swapped: PDF→PyMuPDF ⟶ DOCX→`mammoth.extractRawText`** (revises D8/D9/D10, Q-C). The SIR body is authored as `pages.tsx` (RDS component tree) and the ~100-page appendix is already clean markdown (`research-appendix.md`) — but neither is in storage for existing SIRs; only the `report` PDF and DOCX are `sir_artifact`s. The DOCX is a structured document (headings/tables/reading order intact), renders from the same `pages.tsx` (so it contains body + appendix, matching D8's scope), and beats PyMuPDF-on-a-Chromium-PDF for a table-heavy diligence doc at lower effort. `mammoth` is already a substation dependency (`^1.12.0`, used in `feasibility-intake-extraction/extract-text.ts`).
> - **Backfill moves navalbase (Python) → substation (TypeScript)** (revises D10). Reuses the existing mammoth code path and co-locates with the migration. **navalbase drops out of repos-touched.**
> - **`pages.tsx`-serialize + `research-appendix.md` concat** is recorded as the highest-fidelity source, but is now explicitly tied to the **future vision-on-figures phase** (not a near-term markdown-at-publish fast-follow) — it's the only source where per-figure vision + inline captions are clean. See Scope boundaries.
> - **DB-canonical model history** (reverses D26; supersedes the v1 D25 "FE-sent history" shape). Mirror intake exactly: persist user msg at POST entry, rebuild history from `chat_message` ordered by `created_at`, prepend the non-persisted `<sirContent>` turn, keep the `dropTrailingAssistantMessages` guard. This preserves the "persisted transcript == what the model saw" equivalence and means the D2 future-tools path needs no rewrite. FE-sent `useChat` history becomes display-only + a persist-failure fallback.
> - **Conversation is now version-keyed** (revises D14/D15/D17/D18, Q28). Adds nullable `conversations.sir_version int`, set to `current_version` at creation; active-conversation lookup keys on `(user_id, site_intelligence_report_id, sir_version = current_version, type='sir')`. A republish starts a fresh thread against the new version instead of replaying an old thread against newer injected text. Aligns with the already-per-version text artifact.
> - **1h prompt cache TTL** (revises D32/D34). **Cache spike PASSED** against the live Vercel AI Gateway: `providerOptions.anthropic.cacheControl` with `ttl:'1h'` is forwarded (landed in `ephemeral_1h_input_tokens`, not downgraded to 5m) and usage is reported back (`cache_read_input_tokens` on the 2nd turn). 1h cache **write ≈ 2× base** (not 1.25× — that's the 5-min tier); reads stay ≈ 0.1×. For a slow-read diligence session the 1h window keeps the whole session cached, which is the point.
> - **Model id corrected** (Q-B): intake uses **`anthropic/claude-sonnet-5`** (`+server.ts:604`), not `anthropic/claude-sonnet-4-6`.

---

## Problem

The Site Intelligence Report (SIR) full page — `cityhall/src/routes/(app)/project/[projectId]/sir/[sirId]/+page.svelte` — renders a finished diligence deliverable but offers no way to *interrogate* it. A user reading a 27-page report with a 100+-page research appendix cannot ask "how did you determine the top risk?" or "what's the zoning pathway again?" without scrolling and re-reading.

We already ship an AI chat for **diligence intake** (`cityhall/src/routes/api/chat/intake/+server.ts`) — an AI-SDK `streamText` loop with an inline system prompt, DB-canonical message history, and a per-turn injected live-state block (`buildCurrentIntakeStateSuffix`, `+server.ts:574`). This spec reuses that *chat loop shape* for the SIR page while deliberately dropping all of intake's heavy machinery (tools, tiers, RCM cards, file-upload/extraction fan-out to substation).

### Verified facts grounding this spec

- **The SIR page route exists** at `cityhall/src/routes/(app)/project/[projectId]/sir/[sirId]/+page.svelte` (+ `+page.server.ts`). A separate public `share/sir/[token]` route exists (winston#212) — explicitly **out of scope** here (Q1).
- **The SIR data model has no chat scaffolding.** This was a deliberate decision (`workspaces/diligence/sir-product-experience/data-model.md`, D10): the SIR path dropped `conversations`/`chat_message`/`document_section` reuse. So a chat needs a home.
- **`conversations`** (Noetic App, project `mgxqsrjutswbciyrltwd`) is already `project_id`-scoped (NOT NULL) with a `type` discriminator (NOT NULL), `user_id` (nullable), `title`, `created_at`, `updated_at`, `deleted_at`. **No `site_intelligence_report_id` FK today.**
- **`chat_message`** carries: `conversation_id`, `user_id`, `role`, `content`, `tool_calls`, `usage`, `model`, `created_at`, `rcm_payload`, `visible_to_user`, `intake_resolution_key`, `trigger_batch_id`. The intake-specific columns are all nullable — they simply go unused for SIR chat.
- **`site_intelligence_report`**: `id`, `project_id` (NOT NULL), `title`, `description`, `address`, `lat`/`lon`, `parcel_ids[]`, `current_version` (int, NOT NULL), `created_by`, timestamps.
- **`sir_artifact`**: `site_intelligence_report_id`, `version` (int), `versioning_label`, `kind`, `format`, `storage_bucket`, `storage_path`, `file_name`, `mime_type`, `byte_size`, timestamps. **Today `kind='report'` exists only as `format='pdf'` and `format='docx'` — there is NO text/markdown representation of the report anywhere in the table** (verified table-wide: `report` = pdf/docx only; the only `md` rows are `kind='supporting_document'`). 5 SIRs are published (small n — early stage).
- **The SIR is rendered `pages.tsx → dsd renderer → PDF and DOCX`** (`bureau/pipelines/sir/5.3-render-pdf`, `5.5-render-docx`). No text/markdown artifact is uploaded to storage, but two facts matter for extraction (v2): (a) the compose step (`5.1-compose`) emits `pages.tsx` (the RDS component tree — the body text lives in `MarkdownBody`/`SnapshotTable`/`ConstraintMatrix`/`Callout` props) **plus `research-appendix.md`, which is already clean markdown** (~250 KB = the full appendix); (b) the `report` DOCX renders from that same `pages.tsx` and therefore contains body + appendix combined. **The 5.1 intermediates are NOT stored as `sir_artifact`s** — only the `report` PDF and DOCX are — so a backfill over existing SIRs can only read what's in storage (⇒ DOCX, v2 D9).
- **Real content size** (measured on shipped deliverables): the combined SIR + in-document Research Appendix report is ~140 pages at the fat end but only **~55K words ≈ ~70–75K tokens of text**. Comfortably within Sonnet's context window with room for a long conversation. **Context window is not the constraint; the absence of a text source and per-turn cost are.**

---

## Solution overview

A minimal, tool-less AI chat docked on the SIR page. The server injects the full extracted report text as a cached static prefix; the user asks questions; the model answers from that text.

```
SIR page load (cityhall +page.server.ts)
  └─ getSirChatState(sirId, user):
       ├─ canAccess?  (reuse SIR view auth)
       └─ report_extracted_text artifact present for current_version?
     → chatAvailable boolean → page renders chat panel enabled OR disabled

User sends a question → POST /api/chat/sir  (x-sir-id, x-conversation-id)
  ├─ getSirChatState() re-check (fail closed on no-access / no-text)
  ├─ persist THIS user message at POST entry (anchors created_at ordering)
  ├─ fetch report_extracted_text md from storage (current_version)
  ├─ rebuild history from chat_message (ordered by created_at) — DB-canonical
  ├─ build wire:
  │     system:    <inline SIR system prompt>            [cached]
  │     user:      <sirContent>{extracted md}</sirContent> [cache breakpoint, 1h TTL, NOT persisted]
  │     assistant: <seeded greeting>            ┐
  │     …persisted Q&A turns…                   ├─ all from DB history
  │     user:      <this question>              ┘
  │     (dropTrailingAssistantMessages guard before the model call)
  ├─ streamText(anthropic/claude-sonnet-5, no tools) → stream to UI
  └─ onFinish: persist assistant msg (+ usage/model), bump conversations.updated_at

Reset button → POST /api/chat/sir/reset → insert fresh conversation + greeting

Offline (substation, one-off TS script): for each existing SIR version,
  download report DOCX → mammoth.extractRawText → write report_extracted_text md
  → upload to sir-artifacts bucket + insert sir_artifact row
```

### The `<sirContent>` injection model (mirrors intake's live-state block)

The extracted text is **injected server-side on every request** as the **first `user` message** and is **never persisted** as a `chat_message`. Only the real conversational turns (user questions, assistant answers, seeded greeting) are stored. This is the exact pattern intake already uses for its non-persisted `<current-intake-state>` snapshot — the SIR text is our analog.

Placement rationale: Anthropic requires the first message to be role `user`; putting `<sirContent>` there (not in the system prompt) leaves room for a leading assistant greeting and gives a clean cache prefix.

**v2 — history is DB-canonical (mirrors intake, reverses v1's FE-sent shape).** The conversational turns sent to the model are rebuilt server-side from `chat_message` (ordered by `created_at`), NOT taken from the client's `useChat` array. The server persists the incoming user message at POST entry, reads the full thread from the DB, prepends the non-persisted `<sirContent>` turn, and runs intake's `dropTrailingAssistantMessages` guard before the model call. This keeps the invariant **"the persisted transcript is exactly what the model saw"** and means the D2 future-tools path (which introduces invisible tool-result rows) needs no rewrite — it's the migration intake already made (`+server.ts:457`). The FE-sent history is display-only, used for model context **only** as the degraded fallback when the entry-persist fails (intake's exact behavior). See D25a/D26.

---

## Decisions (numbered to the grill log)

Scope:
- **D1 (Q1):** MVP is logged-in project members only. Chat does **not** appear on the public `share/sir/[token]` route.
- **D2 (Q2):** **No tools** in v1 — pure Q&A over dumped text. But structure the route so tools can be added later (assume future tools; don't hard-code a tool-less shape that fights extension).
- **D3 (Q3):** Chat is scoped to a single SIR (the one on the page).
- **D4 (Q4):** Images are stripped for v1. Vision-describe-images-then-inject-text is explicitly deferred to a later phase.

Text artifact (the `<sirContent>` source):
- **D5 (Q5):** Chat reads a stored **text artifact**, never the PDF at request time. If it doesn't exist → chat visibly disabled (fail closed, Q11).
- **D6 (Q6):** The extracted text is a **new `sir_artifact` row** (versioned like every other artifact), not a column on `site_intelligence_report` or a new table.
- **D7 (Q7):** `kind = 'report_extracted_text'`, `format = 'md'`, sibling to the `kind='report'` PDF, in the `sir-artifacts` bucket.
- **D8 (Q8):** Dump scope = the combined SIR + Research Appendix (what the `report` PDF/DOCX contains). **No** SIR-body-only split. The `report` DOCX renders from the same `pages.tsx` that embeds `research-appendix.md`, so DOCX text == PDF content == this combined scope.
- **D9 (Q9) — v2 REVISED:** Extraction tool = **`mammoth.extractRawText` on the `report` DOCX** (`format='docx'`), not PyMuPDF on the PDF. Rationale: the DOCX is a structured document (headings/tables/reading order preserved), which beats Chromium-PDF glyph extraction for a table-dense diligence doc; `mammoth` is already a substation dependency (`^1.12.0`, `feasibility-intake-extraction/extract-text.ts`); and the DOCX is the highest-fidelity source that actually exists **in storage** for the already-published SIRs (the `pages.tsx`/`research-appendix.md` intermediates are not uploaded). Output = the markdown/plaintext mammoth returns, stored as the `report_extracted_text` artifact.
- **D10 (Q10) — v2 REVISED:** For MVP, extraction is a **manual backfill script over existing SIRs, written in TypeScript and living in substation** (was: navalbase/Python). It reuses the existing mammoth code path and sits next to the migration. Wiring extraction into the publish pipeline (bureau) remains a fast-follow, not MVP.
- **D11 (Q11 / Q40 / Q48):** No text artifact for `current_version` → chat disabled for that SIR. Empty/near-empty mammoth output (e.g. an unreadable DOCX) → don't write the artifact (same as "no artifact"). Each SIR **version** needs its own `report_extracted_text`; republishing without one disables chat on the new version until re-run.

Data model / persistence:
- **D12 (Q12):** **Reuse** `conversations` + `chat_message` (not new tables). Intake-specific `chat_message` columns stay null.
- **D13 (Q13):** Add `conversations.type = 'sir'`.
- **D14 (Q14) — v2 EXTENDED:** Add nullable `conversations.site_intelligence_report_id` FK (null for intake, set for SIR). `project_id` populated from the SIR's project. **Also add nullable `conversations.sir_version int`**, set at conversation creation to the SIR's `current_version` — so a thread records the version it was born against.
- **D15 (Q15 / Q45) — v2 EXTENDED:** CHECK constraint: `type = 'sir' ⇒ site_intelligence_report_id IS NOT NULL AND sir_version IS NOT NULL` (and `type = 'intake' ⇒ site_intelligence_report_id IS NULL AND sir_version IS NULL`).
- **D16 (Q25):** SIR chat is **per-user** — `conversations.user_id` = the user who started the thread. Each project member gets their own thread on the same SIR.
- **D17 (Q26 / Q41 / Q28) — v2 REVISED (now version-keyed):** **"Active conversation" = most-recently-`updated_at`** conversation for `(user_id, site_intelligence_report_id, sir_version = <SIR.current_version>, type='sir')`. Keying on `sir_version` (v2) means a republish → **no match for the new version → lazy-create a fresh thread** against it, rather than replaying an old-version thread against the newer injected `<sirContent>` (which would answer a v2 doc over a v1 conversation). Old-version threads are retained as history. Still **no `deleted_at`, no `is_active` flag, no pointer table** — reset inserts a new row for the current version → newest → active. This aligns 1:1 with the already-per-version text artifact (D6/D11): `conversation.sir_version ↔ sir_artifact.version ↔ current_version` move together. Also retires the v1 deferred "stale-version notification" (Q28) as a correctness concern — it becomes optional UX polish. **Supersedes the earlier unique-index idea (Q27, dropped).**
- **D18 (Q27 / Q41) — v2 EXTENDED:** **Drop** any uniqueness enforcement. Keep a plain non-unique index on `(site_intelligence_report_id, user_id, sir_version) WHERE type='sir'` for lookup speed. Accept benign first-load races (two tabs → two conversations; "take latest" self-heals).
- **D19 (Q29):** The leading greeting is a **stored** assistant `chat_message`, seeded at conversation creation (survives reload, gives the model a coherent opening turn).
- **D20 (Q42):** Conversation creation is **lazy in the page loader** — created (+ greeting seeded) on first SIR-page load if none exists for `(user, SIR)`, else load the latest.
- **D21 (Q43):** Reset is a **dedicated endpoint** (`POST /api/chat/sir/reset`, `x-sir-id`) that inserts a fresh conversation + greeting and returns its id; FE swaps to it.
- **D22 (Q44):** Bump `conversations.updated_at` on every turn (in `onFinish`) — recency is load-bearing for "which conversation is active" (D17).

API / request flow:
- **D23 (Q18 / Q35):** New endpoint `POST /api/chat/sir` in **cityhall** (separate from intake, not a shared/parametrized handler). Migration lives in **substation** (where intake migrations live).
- **D24 (Q19):** Request identifies target via headers `x-conversation-id` + `x-sir-id` (mirrors intake's header style). Server validates SIR access before responding.
- **D25 (Q20 / Q20-cont):** `<sirContent>` is injected server-side each request as the first `user` message and is **NOT** persisted (no placeholder row either). The **server** fetches the text from storage; the **client never sends or sees** the ~75K-token dump. Only visible Q&A turns + greeting are stored.
- **D25a (v2 NEW):** The POST route reads the extracted-text file from storage with the **user-scoped `locals.supabase` client** (RLS-bound), not the service-role client — so a no-access read is RLS-denied structurally, not solely by the `getSirChatState` check. Requires the §9 `sir-artifacts` storage policy to cover the `report_extracted_text` `.md` path (it's bucket/path-scoped, so a sibling `.md` at the report's path is already covered — confirm at implementation, same class as the existing "policy must be live in prod" caveat in `sir/[sirId]/+page.ts`).
- **D26 (Q21) — v2 REVERSED (now DB-canonical, mirrors intake):** Model history sent to the LLM is **rebuilt server-side from `chat_message`** (ordered by `created_at`), with the server prepending the non-persisted `<sirContent>` turn — NOT the FE-sent `useChat` array (v1). Persist the incoming user message at POST entry (D27), then read the thread back so the model input == the persisted transcript. Run intake's `dropTrailingAssistantMessages` guard before the model call (cheap insurance; MVP has no out-of-band assistant rows but tools/D2 will). FE-sent history is display-only + the persist-failure fallback. Reasoning: preserves "persisted == what the model saw," and avoids the forced rewrite the moment D2 tools introduce invisible rows — the exact migration intake already made (`+server.ts:457`).
- **D27 (Q33):** Persist user message at POST entry, assistant message in `onFinish` (mirrors intake ordering). Populate the existing `usage` + `model` columns for telemetry.
- **D28 (Q32):** Response streams token-by-token (`toUIMessageStreamResponse`).
- **D29 (Q46):** Build a shared server-side helper `getSirChatState(sirId, user) → { canAccess, textArtifactPresent }`, called by the loader (UI gate) **and** the POST/reset routes (fail closed — never trust the client). **No** standalone HTTP status endpoint for MVP (defer until a no-reload consumer appears).
- **D30 (Q34):** The loader calls `getSirChatState` and passes a `chatAvailable` boolean to the page — no separate existence-check endpoint round-trip.

Model / prompt / cost:
- **D31 (Q23) — v2 model id corrected:** Default model = **Sonnet** via the gateway, using the string intake actually references: **`anthropic/claude-sonnet-5`** (`+server.ts:604`) — *not* `anthropic/claude-sonnet-4-6` (v1 typo). Flag-gated like intake so it can be dialed. Rationale: Haiku is fine for intake's tiny context but likely too shallow for nuanced Q&A over a ~75K-token diligence doc; caching controls the cost.
- **D32 (Q22 / Q47) — v2 REVISED (1h TTL; spike-verified):** **Anthropic prompt caching on the `<sirContent>` block from day one, at 1h TTL.** Cache the static prefix (system + `<sirContent>`); the growing conversation tail is not cached in MVP (small, cheap at full price). **Verified by a live cache spike against the Vercel AI Gateway** (2026-08-06): passing `providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } }` on the `<sirContent>` part is forwarded end-to-end — the first turn wrote `ephemeral_1h_input_tokens` (the 1h beta was NOT downgraded to 5m), and the second turn returned `cache_read_input_tokens` for the full block with `cache_creation_input_tokens: 0`. Usage is surfaced both normalized (`usage.cacheWriteTokens` / `cacheReadTokens`) and raw (`providerMetadata.anthropic.usage`). **⇒ D32 stays "gateway `cacheControl` string" — no direct `@ai-sdk/anthropic` provider instance needed.** Cost model (Q38): 1h cache **write ≈ 2× base** input price (one-time), cache **read ≈ 0.1×** thereafter, **1h sliding TTL**. The 1h window (vs. 5-min) is deliberate: a 140-page diligence report is read slowly, with multi-minute gaps between questions, so a 5-min TTL would re-charge the write on most turns; 1h keeps the whole reading session cached. Add a log assertion that `cacheReadTokens > 0` after the first turn so a future gateway regression that silently drops caching is caught.
- **D33 (Q37):** Server fetches the extracted-text file from storage on **every** request (it's small, ~100–300 KB) — no app/edge caching. The Anthropic prompt cache, not our storage read, is where the real cost lives.
- **D34 (Q38) — v2 REVISED:** **Use the extended 1h cache TTL for MVP** (reverses v1's "5-min only, defer 1h"). Justified by the slow-read usage pattern (D32) and confirmed available through the gateway by the spike. It's a one-field change (`ttl: '1h'`), not new machinery.
- **D35 (Q39):** System prompt authored **inline in the cityhall route** (like intake), not sourced from a Bureau file, for MVP.

Access / auth:
- **D36 (Q24 / Q31):** Access check = "if you can view the SIR, you can chat" — reuse existing SIR view authorization, no new permission concept. Enforced in the loader **and** re-checked in the POST/reset routes.

UI:
- **D37 (Q50):** FE surface = a docked panel/drawer on the existing `/project/{id}/sir/{sirId}` page (not a new route). UI is iterable later.

Sequencing:
- **D38 (Q49):** Deploy/enable order: **(1)** substation migration → **(2)** cityhall route + UI (ships *disabled* everywhere, since no text artifacts exist yet — gating on artifact presence makes this safe) → **(3)** run the substation DOCX→mammoth backfill (v2) to light up existing SIRs.

---

## Schema change (substation migration)

One additive migration, zero alterations to existing rows:

```sql
-- 1. New FK column (nullable — intake conversations leave it null)
ALTER TABLE conversations
  ADD COLUMN site_intelligence_report_id uuid
    REFERENCES site_intelligence_report(id) ON DELETE CASCADE;

-- 1b. (v2) Version the conversation was started against — set to the SIR's
--     current_version at creation. Nullable (intake leaves it null).
ALTER TABLE conversations
  ADD COLUMN sir_version int;

-- 2. Integrity: type='sir' requires BOTH the FK and the version; type='intake'
--    forbids both. (Written to tolerate any other/future types unconstrained.)
ALTER TABLE conversations
  ADD CONSTRAINT conversations_sir_fk_matches_type CHECK (
    (type =  'sir'    AND site_intelligence_report_id IS NOT NULL
                      AND sir_version IS NOT NULL)                 OR
    (type =  'intake' AND site_intelligence_report_id IS NULL
                      AND sir_version IS NULL)                     OR
    (type NOT IN ('sir','intake'))
  );

-- 3. Lookup index for "active conversation" resolution (non-unique — D18),
--    now keyed on version so a republish resolves to a fresh thread (v2 D17).
CREATE INDEX conversations_sir_user_version_idx
  ON conversations (site_intelligence_report_id, user_id, sir_version)
  WHERE type = 'sir';
```

Confirm too that `chat_message.conversation_id` carries `ON DELETE CASCADE` so the SIR-FK cascade (a deleted SIR → deleted conversations) doesn't orphan messages.

`type` is an existing free-text/`text` column (not a PG enum) per the schema readout, so `'sir'` needs no enum migration. **Confirm during implementation** that `conversations.type` is not backed by a CHECK/enum that would reject `'sir'`; if it is, extend it in the same migration.

`report_extracted_text` requires **no schema change** — `sir_artifact.kind`/`format` are `text` columns.

---

## The backfill script (substation, TypeScript — v2)

A one-off command (TypeScript in substation, out of the request path — reuses the existing `mammoth` dependency and sits next to the migration):

1. Query `sir_artifact` for `kind='report', format='docx'` rows lacking a sibling `kind='report_extracted_text'` at the same `(site_intelligence_report_id, version)`.
2. Download each report DOCX from the `sir-artifacts` bucket (service-role client — this is an offline job).
3. `mammoth.extractRawText({ buffer })` → text string (same call as `feasibility-intake-extraction/extract-text.ts`).
4. If empty/near-empty → skip (D11, fail closed — do not write).
5. Upload the md to `sir-artifacts` (parallel path/version to the report) and insert a `sir_artifact` row (`kind='report_extracted_text'`, `format='md'`, `version` = the report's version, `versioning_label` copied).
6. Idempotent: re-running skips versions that already have the text artifact.

**Fallback:** if a published SIR has a `report` PDF but no DOCX for a given version, that version can't be backfilled via mammoth — log and skip (chat stays disabled for it, per D11). All currently-published SIRs render both PDF and DOCX, so this is an edge case; if it recurs, the publish-time path (below) supersedes the need.

Images are intentionally discarded for MVP (D4) — `mammoth.extractRawText` drops them. The future vision-on-figures phase does not extend this script; it moves the source to `pages.tsx` (see Scope boundaries), which is the only source with discrete figure files + captions.

---

## Scope boundaries (deliberately deferred)

- **Public/share-link chat** (D1) — anonymous-route auth is a separate effort.
- **Tools / retrieval / bureau search** (D2) — v1 is pure dumped-text Q&A; route is built to accept tools later.
- **Image understanding** (D4) — vision-describe-figures → inject text, later phase. **This phase is what earns the `pages.tsx` serializer** (below): figures are discrete PNGs (`5.1-compose/figures/*.png`) referenced by RDS `FigureWithNotesPage`/`FigureGridPage` with captions/notes as props, so vision can run per-figure with the caption as grounding context and inject the description inline at the right position — clean only from the component tree, not from a rendered PDF/DOCX where images are baked into pages.
- **`pages.tsx`-serialize source swap (publish-time)** — the highest-fidelity source is a component-aware serialization of `pages.tsx` (body) concatenated with `research-appendix.md` (already clean markdown), emitted at compose/render time in bureau and uploaded as the `report_extracted_text` artifact. Deferred and **bundled with the image-understanding phase** (they share the same tree walk). Until then, DOCX→mammoth (D9) is the source for both backfill and — when wired — publish time. Note DOCX→mammoth at publish time is itself a valid fast-follow that needs no serializer; the serializer is only required once figures/vision are in scope.
- **Wiring extraction into the publish pipeline** — fast-follow after MVP backfill; initially just runs the same DOCX→mammoth step at publish (bureau or substation), no serializer needed.
- **Stale-version notification** (Q28) — a nice-to-have system message telling a user their open thread predates a newly published version. **v2 downgrades this from a correctness fix to optional UX**: D17's version-keyed lookup already prevents cross-version replay by starting a fresh thread. Deferred.
- **Multi-conversation-per-SIR UI** — the data model already supports it (D17); only the loader + a thread-list UI are needed later, no migration.
- **Rolling cache breakpoints on long histories** and **per-user rate limiting** — cost-tuning knobs for later. (The 1h prompt cache itself is now IN scope — D32/D34, v2.)

---

## Open questions

- **Q-A:** Does `conversations.type` have a backing CHECK/enum that would reject `'sir'`? (Resolve at implementation — see Schema section. If yes, extend it in the same migration.)
- **Q-B — RESOLVED (v2):** Gateway model id = **`anthropic/claude-sonnet-5`** — verified in intake (`+server.ts:604`). The v1 spec's `anthropic/claude-sonnet-4-6` was a typo. Flag config should reference the same string.
- **Q-C — v2 note:** Storage-path convention for `report_extracted_text` — mirror the **DOCX's** path with a `.md` extension (v2 source is the DOCX, not the PDF), or a dedicated subpath. Cosmetic; pick for consistency with `upload-sir`. Whatever path is chosen must fall under the existing `sir-artifacts` storage RLS policy so D25a's user-client read succeeds.
- **Q-D:** Should the seeded greeting text be a constant, or lightly parameterized with the SIR title/address? (MVP: a constant is fine.)

---

## How to audit this spec

Verify against:
- **Codebase:** intake chat loop (`cityhall/src/routes/api/chat/intake/+server.ts` — `streamText` at `:607`, DB-canonical history rebuild at `:457`, persist-at-entry at `:308`, `dropTrailingAssistantMessages` guard at `:493`, model string at `:604`); the SIR page route + loader (`.../sir/[sirId]/+page.server.ts` + `+page.ts` — the auth model is RLS via the project-scoped `sirs` list, `.find` miss = 404 = membership guard); `mammoth.extractRawText` usage in `substation/.../feasibility-intake-extraction/extract-text.ts`; that no SIR chat route/tables exist today.
- **DB (Noetic App `mgxqsrjutswbciyrltwd`):** `conversations`/`chat_message`/`sir_artifact`/`site_intelligence_report` columns as cited; that `kind='report'` has both `pdf` and `docx` formats (v2 extracts from `docx`); the 5 published SIRs.
- **Facts:** the ~70–75K-token measured content size; that `bureau/pipelines/sir` renders `pages.tsx → PDF and DOCX` and that `5.1-compose` emits `pages.tsx` + a clean `research-appendix.md`, neither uploaded as an artifact.
- **v2 cache spike:** reproducible via a ~50K-token cached block through the gateway (`providerOptions.anthropic.cacheControl = { type:'ephemeral', ttl:'1h' }`) — call 1 shows `cache_creation.ephemeral_1h_input_tokens > 0`, call 2 shows `cache_read_input_tokens` for the full block.
- **Decisions most worth challenging (v2):** D9 (DOCX→mammoth fidelity — spot-check extracted text on a real ConstraintMatrix/appendix page before committing), D17 (version-keyed active-conversation), D26 (DB-canonical history — now aligned with intake), D31/D32 (Sonnet + 1h cache cost/quality), D25a (user-client storage read + RLS coverage of the `.md` path).
