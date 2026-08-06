# SIR Chat — Ask-Questions AI Chat on the Site Intelligence Report Page

**Status:** Draft v1
**Date:** 2026-08-06
**Repos touched:** `cityhall` (chat route, reset route, SIR-page UI + loader gate, shared availability helper, inline system prompt), `substation` (one additive migration: `conversations` columns + CHECK + index), `navalbase` (one-off PyMuPDF backfill script)
**Repos NOT touched:** `bureau` (SIR pipeline unchanged for MVP — no markdown intermediate added yet), `conductor`, `surveyor`, `dsd`/RDS

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
- **The SIR is rendered `pages.tsx → dsd Chromium renderer → PDF`** (`bureau/pipelines/sir/5.3-render-pdf/render_pdf.py`). There is **no markdown intermediate** produced by the current pipeline.
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
  ├─ fetch report_extracted_text md from storage (current_version)
  ├─ build wire:
  │     system:    <inline SIR system prompt>            [cached]
  │     user:      <sirContent>{extracted md}</sirContent> [cache breakpoint]
  │     assistant: <seeded greeting>
  │     …persisted Q&A turns…
  │     user:      <this question>
  ├─ streamText(sonnet-4.6, no tools) → stream to UI
  └─ onFinish: persist assistant msg (+ usage/model), bump conversations.updated_at

Reset button → POST /api/chat/sir/reset → insert fresh conversation + greeting

Offline (navalbase, one-off): for each existing SIR version,
  download report PDF → pymupdf4llm → write report_extracted_text md
  → upload to sir-artifacts bucket + insert sir_artifact row
```

### The `<sirContent>` injection model (mirrors intake's live-state block)

The extracted text is **injected server-side on every request** as the **first `user` message** and is **never persisted** as a `chat_message`. Only the real conversational turns (user questions, assistant answers, seeded greeting) are stored. This is the exact pattern intake already uses for its non-persisted `<current-intake-state>` snapshot — the SIR text is our analog.

Placement rationale: Anthropic requires the first message to be role `user`; putting `<sirContent>` there (not in the system prompt) leaves room for a leading assistant greeting and gives a clean cache prefix.

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
- **D8 (Q8):** Dump scope = whatever the `report` PDF contains (the combined SIR + Research Appendix). **No** SIR-body-only split.
- **D9 (Q9):** Extraction tool = **PyMuPDF** (`pymupdf4llm` → markdown, `write_images=False`), run as an offline/async Python job.
- **D10 (Q10):** For MVP, extraction is a **manual backfill script** over the existing SIRs; wiring it into the publish pipeline is a fast-follow, not MVP.
- **D11 (Q11 / Q40 / Q48):** No text artifact for `current_version` → chat disabled for that SIR. Empty/near-empty PyMuPDF output → don't write the artifact (same as "no artifact"). Each SIR **version** needs its own `report_extracted_text`; republishing without one disables chat on the new version until re-run.

Data model / persistence:
- **D12 (Q12):** **Reuse** `conversations` + `chat_message` (not new tables). Intake-specific `chat_message` columns stay null.
- **D13 (Q13):** Add `conversations.type = 'sir'`.
- **D14 (Q14):** Add nullable `conversations.site_intelligence_report_id` FK (null for intake, set for SIR). `project_id` populated from the SIR's project.
- **D15 (Q15 / Q45):** CHECK constraint: `type = 'sir' ⇒ site_intelligence_report_id IS NOT NULL` (and `type = 'intake' ⇒ site_intelligence_report_id IS NULL`).
- **D16 (Q25):** SIR chat is **per-user** — `conversations.user_id` = the user who started the thread. Each project member gets their own thread on the same SIR.
- **D17 (Q26 / Q41):** **"Active conversation" = most-recently-`updated_at`** conversation for `(user_id, site_intelligence_report_id, type='sir')`. **No `deleted_at`, no `is_active` flag, no pointer table.** Reset just inserts a new row (it becomes the newest → active); old threads are retained as history. The multi-conversation-per-SIR future needs **zero migration** — relax the loader from "take latest" to "list all, default to latest." **Supersedes the earlier unique-index idea (Q27, dropped).**
- **D18 (Q27 / Q41):** **Drop** any uniqueness enforcement. Keep a plain non-unique index on `(site_intelligence_report_id, user_id)` for lookup speed. Accept benign first-load races (two tabs → two conversations; "take latest" self-heals).
- **D19 (Q29):** The leading greeting is a **stored** assistant `chat_message`, seeded at conversation creation (survives reload, gives the model a coherent opening turn).
- **D20 (Q42):** Conversation creation is **lazy in the page loader** — created (+ greeting seeded) on first SIR-page load if none exists for `(user, SIR)`, else load the latest.
- **D21 (Q43):** Reset is a **dedicated endpoint** (`POST /api/chat/sir/reset`, `x-sir-id`) that inserts a fresh conversation + greeting and returns its id; FE swaps to it.
- **D22 (Q44):** Bump `conversations.updated_at` on every turn (in `onFinish`) — recency is load-bearing for "which conversation is active" (D17).

API / request flow:
- **D23 (Q18 / Q35):** New endpoint `POST /api/chat/sir` in **cityhall** (separate from intake, not a shared/parametrized handler). Migration lives in **substation** (where intake migrations live).
- **D24 (Q19):** Request identifies target via headers `x-conversation-id` + `x-sir-id` (mirrors intake's header style). Server validates SIR access before responding.
- **D25 (Q20 / Q20-cont):** `<sirContent>` is injected server-side each request as the first `user` message and is **NOT** persisted (no placeholder row either). The **server** fetches the text from storage; the **client never sends or sees** the ~75K-token dump. Only visible Q&A turns + greeting are stored.
- **D26 (Q21):** Model history sent to the LLM = the FE-sent `useChat` history, with the server prepending the non-persisted `<sirContent>` turn. No DB-canonical re-read is needed (no invisible/tool rows exist). We still **persist** user + assistant messages for reload.
- **D27 (Q33):** Persist user message at POST entry, assistant message in `onFinish` (mirrors intake ordering). Populate the existing `usage` + `model` columns for telemetry.
- **D28 (Q32):** Response streams token-by-token (`toUIMessageStreamResponse`).
- **D29 (Q46):** Build a shared server-side helper `getSirChatState(sirId, user) → { canAccess, textArtifactPresent }`, called by the loader (UI gate) **and** the POST/reset routes (fail closed — never trust the client). **No** standalone HTTP status endpoint for MVP (defer until a no-reload consumer appears).
- **D30 (Q34):** The loader calls `getSirChatState` and passes a `chatAvailable` boolean to the page — no separate existence-check endpoint round-trip.

Model / prompt / cost:
- **D31 (Q23):** Default model = **Sonnet 4.6** (`anthropic/claude-sonnet-4-6` via the gateway), flag-gated like intake so it can be dialed. Rationale: Haiku is fine for intake's tiny context but likely too shallow for nuanced Q&A over a ~75K-token diligence doc; caching controls the cost.
- **D32 (Q22 / Q47):** **Anthropic prompt caching on the `<sirContent>` block from day one.** Cache the static prefix (system + `<sirContent>`); the growing conversation tail is not cached in MVP (small, cheap at full price). Documented cost model (Q38): cache **write ≈ 1.25×** base input price (one-time per 5-min window), cache **read ≈ 0.1×** thereafter, **5-min sliding TTL**. Within the window, subsequent turns are *cheaper*, not more expensive. A >5-min idle gap re-charges the one-time write on the next turn — a periodic re-write penalty, not a permanent per-turn increase. Strictly cheaper than no-cache for any multi-turn conversation.
- **D33 (Q37):** Server fetches the extracted-text file from storage on **every** request (it's small, ~100–300 KB) — no app/edge caching. The Anthropic prompt cache, not our storage read, is where the real cost lives.
- **D34 (Q38):** Standard 5-min cache TTL — no extended/1h cache for MVP.
- **D35 (Q39):** System prompt authored **inline in the cityhall route** (like intake), not sourced from a Bureau file, for MVP.

Access / auth:
- **D36 (Q24 / Q31):** Access check = "if you can view the SIR, you can chat" — reuse existing SIR view authorization, no new permission concept. Enforced in the loader **and** re-checked in the POST/reset routes.

UI:
- **D37 (Q50):** FE surface = a docked panel/drawer on the existing `/project/{id}/sir/{sirId}` page (not a new route). UI is iterable later.

Sequencing:
- **D38 (Q49):** Deploy/enable order: **(1)** substation migration → **(2)** cityhall route + UI (ships *disabled* everywhere, since no text artifacts exist yet — gating on artifact presence makes this safe) → **(3)** run the navalbase backfill to light up existing SIRs.

---

## Schema change (substation migration)

One additive migration, zero alterations to existing rows:

```sql
-- 1. New FK column (nullable — intake conversations leave it null)
ALTER TABLE conversations
  ADD COLUMN site_intelligence_report_id uuid
    REFERENCES site_intelligence_report(id) ON DELETE CASCADE;

-- 2. Integrity: type='sir' requires the FK; type='intake' forbids it.
--    (Written to tolerate any other/future types without constraining them.)
ALTER TABLE conversations
  ADD CONSTRAINT conversations_sir_fk_matches_type CHECK (
    (type =  'sir'    AND site_intelligence_report_id IS NOT NULL) OR
    (type =  'intake' AND site_intelligence_report_id IS NULL)     OR
    (type NOT IN ('sir','intake'))
  );

-- 3. Lookup index for "active conversation" resolution (non-unique — D18)
CREATE INDEX conversations_sir_user_idx
  ON conversations (site_intelligence_report_id, user_id)
  WHERE type = 'sir';
```

`type` is an existing free-text/`text` column (not a PG enum) per the schema readout, so `'sir'` needs no enum migration. **Confirm during implementation** that `conversations.type` is not backed by a CHECK/enum that would reject `'sir'`; if it is, extend it in the same migration.

`report_extracted_text` requires **no schema change** — `sir_artifact.kind`/`format` are `text` columns.

---

## The backfill script (navalbase)

A one-off command (Python, out of the request path):

1. Query `sir_artifact` for `kind='report', format='pdf'` rows lacking a sibling `kind='report_extracted_text'` at the same `(site_intelligence_report_id, version)`.
2. Download each report PDF from the `sir-artifacts` bucket.
3. `pymupdf4llm.to_markdown(doc, write_images=False)` → markdown string.
4. If empty/near-empty → skip (D11, fail closed — do not write).
5. Upload the md to `sir-artifacts` (parallel path/version to the PDF) and insert a `sir_artifact` row (`kind='report_extracted_text'`, `format='md'`, `version` = the PDF's version, `versioning_label` copied).
6. Idempotent: re-running skips versions that already have the text artifact.

Images are intentionally discarded for MVP (D4). A future phase keeps them (PyMuPDF supports it) and runs a vision model to produce per-figure text descriptions injected alongside `<sirContent>`.

---

## Scope boundaries (deliberately deferred)

- **Public/share-link chat** (D1) — anonymous-route auth is a separate effort.
- **Tools / retrieval / bureau search** (D2) — v1 is pure dumped-text Q&A; route is built to accept tools later.
- **Image understanding** (D4) — vision-describe-figures → inject text, later phase.
- **Markdown-at-publish-time** — revisiting the SIR pipeline to emit a clean markdown intermediate (higher fidelity than PDF extraction, and would retire the backfill for new SIRs) is deferred; PDF→text is the MVP source. Recorded as the preferred long-term source.
- **Wiring extraction into the publish pipeline** (D10) — fast-follow after MVP backfill.
- **Stale-version notification** (Q28) — publishing a new SIR version should drop a system message into open conversations flagging them as against a stale version. Deferred; needs the publish path wired in.
- **Multi-conversation-per-SIR UI** — the data model already supports it (D17); only the loader + a thread-list UI are needed later, no migration.
- **Extended (1h) prompt cache**, rolling cache breakpoints on long histories, and per-user rate limiting — cost-tuning knobs for later (D32/D34).

---

## Open questions

- **Q-A:** Does `conversations.type` have a backing CHECK/enum that would reject `'sir'`? (Resolve at implementation — see Schema section. If yes, extend it in the same migration.)
- **Q-B:** Exact gateway model id for Sonnet 4.6 in cityhall's flag config — confirm the string matches how intake references models (`anthropic/claude-sonnet-*`, `+server.ts:603`).
- **Q-C:** Storage-path convention for the `report_extracted_text` artifact — mirror the PDF's path with a `.md` extension, or a dedicated subpath? (Cosmetic; pick during implementation for consistency with `upload-sir`.)
- **Q-D:** Should the seeded greeting text be a constant, or lightly parameterized with the SIR title/address? (MVP: a constant is fine.)

---

## How to audit this spec

Verify against:
- **Codebase:** intake chat loop (`cityhall/src/routes/api/chat/intake/+server.ts` — `streamText` at `:607`, live-state injection at `:574`, model flag at `:603`); the SIR page route + loader (`.../sir/[sirId]/+page.server.ts`); that no SIR chat route/tables exist today.
- **DB (Noetic App `mgxqsrjutswbciyrltwd`):** `conversations`/`chat_message`/`sir_artifact`/`site_intelligence_report` columns as cited; that `kind='report'` has only `pdf`/`docx` formats; the 5 published SIRs.
- **Facts:** the ~70–75K-token measured content size; that `bureau/pipelines/sir` renders `pages.tsx → PDF` with no markdown intermediate.
- **Decisions most worth challenging:** D17 (recency-as-active vs. an explicit pointer), D26 (FE-sent history vs. DB-canonical), D31 (Sonnet default cost/quality), D25 (server-injected non-persisted `<sirContent>`).
