# SIR Chat on the Shareable (Logged-Out) Link

**Status:** Draft v1
**Date:** 2026-08-10
**Repos touched:** `cityhall` (new token-gated chat route, share-page panel + loader gate, `SirChatPanel` prop refactor, admin toggle control + mutation, `lookupShareLink` extended), `substation` (one additive migration: `sir_share_link.chat_enabled`)
**Repos NOT touched:** `bureau`, `conductor`, `surveyor`, `dsd`/RDS, `navalbase`

> **Sibling specs.** This extends two shipped features:
> - `workspaces/diligence/sir-chat/DESIGN-SPEC.md` (winston#215/#216) — the logged-in SIR chat. **This spec deliberately reverses that spec's D1**, which scoped chat to logged-in project members and explicitly excluded the public `share/sir/[token]` route.
> - `workspaces/diligence/sir-shareable-report/DESIGN-SPEC.md` (winston#212) — the no-login "obscurity URL" share route. This spec adds a chat surface to that route, reusing its token-validation model verbatim.

---

## Problem

The logged-in SIR page ships an ask-questions AI chat (sir-chat spec, live). The **shareable no-login SIR link** — `cityhall/src/routes/share/sir/[token]/+page.svelte`, the URL an enterprise customer opens without an account — renders the same report but offers no way to interrogate it. A customer reading a 140-page diligence deliverable over an obscurity URL gets the static report and nothing else.

The logged-in chat can't simply be exposed on the share route because the two surfaces use **different auth primitives for the same data**:

- **Logged-in chat** (`cityhall/src/routes/api/chat/sir/+server.ts:45-48`) hard-requires `locals.user?.id` (401 otherwise), then gates reads through the RLS-bound user client (`getSirChatState`, `sir-chat.ts:50`) and persists conversations/messages keyed on `user_id`.
- **Share route** (`cityhall/src/routes/share/sir/[token]/+page.server.ts`) has **no user and no RLS** — the share token is the sole credential. `lookupShareLink(token)` (`cityhall/src/lib/server/sir-share.ts:42`) re-validates expiry/supersede/revoke on every request and returns the `sirId`; everything then runs through `supabaseAdmin` (service-role). The artifact-download proxy (`share/sir/[token]/artifact/[artifactId]/+server.ts`) is the canonical pattern: re-validate token → prove the artifact belongs to this token's SIR + current version → mint a short-TTL signed URL.

So enabling logged-out chat is mostly **swapping the auth primitive**: everywhere the logged-in path uses "user client + `user_id`," the share variant uses "`lookupShareLink(token)` + service-role + `sirId` from the token." The streaming loop, `<sirContent>` injection, 1h prompt cache, and system prompt are reusable verbatim.

### Verified facts grounding this spec

- **The text source already exists for every current SIR.** `report_extracted_text`/`md` artifacts were backfilled 2026-08-10 for all 5 published SIRs on their `current_version` (Noetic App project `mgxqsrjutswbciyrltwd`). Publish-time extraction in `upload-sir`'s `publish.ts` emits it for every future SIR, so the share chat's text source is covered without new pipeline work.
- **The system prompt is reusable as-is.** `cityhall/src/lib/prompts/sir-system.ts` (`SIR_SYSTEM_PROMPT`) is tool-less, generic ("A user is reading a finished Site Intelligence Report…"), and contains nothing logged-in-specific. Reuse verbatim.
- **The chat UI is already a factored component.** `cityhall/src/lib/ui/sir/SirChatPanel.svelte` takes `sirId` / `conversationId` / `initialMessages` props but **hardcodes** `api: '/api/chat/sir'` and the header shape (`SirChatPanel.svelte:46-48`). It uses `DefaultChatTransport` from `ai`. The logged-in page renders it as a top-level sibling gated on `data.chatAvailable && data.sirChat` (`sir/[sirId]/+page.svelte:397`).
- **The share page is a clean insertion point.** `share/sir/[token]/+page.svelte` renders `SirReportView` when `!data.expired` (line 64); `prerender = false` and `Cache-Control: no-store` are already set (loader lines 12, 20). A chat panel drops in as a sibling with no report-layout change.
- **The share loader already reads artifacts + signs storage via service-role.** It selects `sir_artifact` rows for `current_version` and signs the report PDF with `supabaseAdmin` (loader lines 38-59) — no storage RLS policy is involved. The `<sirContent>` download follows the identical path.
- **The DB-canonical vs FE-sent history switch already exists.** The logged-in route builds model history from `chat_message` but falls back to the FE-sent `useChat` array when the entry-persist fails (`api/chat/sir/+server.ts:140-143`). The stateless share variant is exactly that fallback path, made the only path.
- **`sir_share_link` has no chat column today** (verified table-wide, project `mgxqsrjutswbciyrltwd`): `id, site_intelligence_report_id, token, created_by, created_at, expires_at, superseded_at, revoked_at, access_count, last_accessed_at`. The per-link toggle needs one additive column.
- **Share links are minted/revoked/superseded behind an `is_noetic_admin` gate** in the logged-in SIR page's admin share-controls block (sir-shareable-report spec §, mutations server-enforced). The chat toggle joins that same block and gate.

---

## Solution overview

A stateless, tool-less AI chat on the public share page. No message is ever stored. Auth is the share token; the model answers from the injected report text; per-link `chat_enabled` (default on) gates the surface.

```
Share page load (share/sir/[token]/+page.server.ts)
  └─ lookupShareLink(token)            [expired → expired view; missing → 404]
     ├─ chat_enabled on the link? ─────┐
     └─ report_extracted_text present  ├─→ chatAvailable boolean → panel enabled/hidden
        for current_version?  ─────────┘

User asks a question → POST /share/sir/[token]/chat   (token in path; body = FE messages)
  ├─ lookupShareLink(token)  RE-VALIDATE fresh (404 on dead/unknown)  — never trust prior load
  ├─ (service-role) load SIR + report_extracted_text for current_version
  │     └─ chat_enabled=false OR no text → 409 (backstop; loader already gated)
  ├─ history cap check → 400 if posted history exceeds the bound
  ├─ (service-role) download report_extracted_text md from sir-artifacts
  ├─ build wire:
  │     system:    SIR_SYSTEM_PROMPT                          [cached]
  │     user:      <sirContent>{md}</sirContent>              [cache breakpoint, 1h TTL]
  │     …FE-sent turns (client-seeded greeting + Q&A)…
  │     (dropTrailingAssistantMessages guard)
  ├─ streamText(anthropic/claude-sonnet-5, no tools) → stream to UI
  └─ NO persistence, NO onFinish DB writes.  Server-logs one line (token + sirId).

Clear chat → client-only: reset the messages array + re-seed greeting. No server call.

Admin toggle (logged-in SIR page, is_noetic_admin) → live PATCH chat_enabled on the link.
```

### Why stateless is the whole simplification

The logged-in persistence layer (`conversations` + `chat_message`) is keyed on `user_id`; an anonymous visitor has none. Rather than invent an anon-identity scheme (cookies, per-link threads, retention/GDPR questions), the share chat stores **nothing**. History rides in the request as the FE-sent `useChat` array — the exact degraded-fallback path the logged-in route already runs (`api/chat/sir/+server.ts:140`). The greeting is seeded client-side as message 0 (reusing `buildSirGreeting`, `sir-chat.ts:90`) instead of a stored assistant row. This means: no schema for conversations, no `getOrCreateActiveSirConversation`, no reset endpoint, no `onFinish` writes.

Accepted consequence: the transcript does not survive a reload. For an ephemeral share link that is acceptable (arguably desirable). Reload re-seeds the greeting and starts fresh.

---

## Decisions (numbered to the grill log)

**Routing & auth**
- **D1 (Q1):** New route `POST /share/sir/[token]/chat` — token in the path, sibling to the existing `share/sir/[token]/artifact/[artifactId]` proxy. Not a variant of `/api/chat/sir`.
- **D2 (Q2):** Re-validate the token via `lookupShareLink` on **every** POST (expiry/supersede/revoke) — never trust a prior page load. Mirrors the artifact proxy.
- **D3 (Q3):** **No server reset endpoint.** "Clear chat" is client-only (reset the messages array + re-seed greeting).
- **D8 (Q8):** All reads — SIR row, `report_extracted_text` lookup, and the `<sirContent>` storage download — go through `supabaseAdmin` (service-role), gated solely by a valid token. No RLS, no `sir-artifacts` storage policy needed (same as the loader signing the report PDF today).
- **D9 (Q9):** Chat reads `report_extracted_text` for the SIR's **`current_version`** — the version the loader and artifact proxy already pin to.
- **D10 (Q10):** **Fail closed.** No `report_extracted_text` for `current_version` → `chatAvailable=false` in the loader (panel hidden); the POST route 409s as a backstop.

**Stateless model**
- **D4 (Q4):** Model history = the FE-sent `useChat` array. **Zero DB writes** — no `conversations`/`chat_message` rows are created or read.
- **D5 (Q5):** The opening greeting is seeded **client-side** as message 0, reusing `buildSirGreeting(sir)` (parameterized with the SIR title/address the loader already returns). Not persisted. Included in the FE-sent history so the model gets a coherent opening turn (consistent with logged-in).
- **D6 (Q6):** A generous **per-request history cap** guards the one cheap abuse (a malicious client posting a giant history to run up a single huge bill). Bound: reject if the posted conversational history exceeds **40 messages OR ~50,000 characters** (excluding the server-injected `<sirContent>` block). Invisible to any real user.
- **D20 (Q20):** On exceeding the D6 cap → **HTTP 400 with a clear message**. No silent truncation (which would make the model answer against a clipped history).
- **D7 (Q7):** **No rate limiting and no per-token message cap in v1.** Accepted cost/abuse risk: links are unguessable 256-bit tokens with a 30-day TTL, shared only to trusted enterprise customers, and revocable. Revoke is the safety net. Deliberate friction trade-off.

**Per-link toggle**
- **D11 (Q11):** Add `chat_enabled boolean NOT NULL DEFAULT true` to `sir_share_link` (additive substation migration). Existing links auto-enable via the default the moment it lands.
- **D12 (Q12):** Ship the toggle UI in v1 (not deferred).
- **D17 (Q17):** The toggle is **live-editable** on an existing link — a small server mutation (PATCH/RPC) flips `chat_enabled` without re-minting. Turning chat off must not cost the customer the URL. (Implementation-permitting; if a blocker surfaces, fall back to mint-time-only and note it.)
- **D18 (Q18):** The control lives in the existing admin share-controls block on the logged-in SIR page, behind the same **`is_noetic_admin`** gate as mint/revoke/supersede — enforced server-side, not just UI-hidden.
- **D19 (Q19):** One boolean, checked by default. Label: "Enable AI chat on this shared link." No separate "chat-only link" concept.

**UI & reuse**
- **D13 (Q13):** **Parameterize the single `SirChatPanel.svelte`** — accept the endpoint + a header-builder (and a `showReset`/`persistent` flag + optional `conversationId`) as props — and render the same component on both routes. No fork.
- **D14 (Q14):** Render `SirChatPanel` as a top-level sibling of `SirReportView` on the share page, only when **`!data.expired && data.chatAvailable`**. Mirrors the logged-in docking; report layout untouched.
- **D15 (Q15):** Reuse verbatim: `SIR_SYSTEM_PROMPT`, `SIR_CHAT_MODEL` (`anthropic/claude-sonnet-5`), the 1h Anthropic cache breakpoint on `<sirContent>` (`providerOptions.anthropic.cacheControl { type:'ephemeral', ttl:'1h' }`), `dropTrailingAssistantMessages`, `toUIMessageStreamResponse`, `maxDuration: 300`.

**Observability, scope, sequencing**
- **D21 (Q21):** One structured **server log per chat POST** (token + sirId + finish reason + cache read/write tokens). No new counter column in v1 — enough to grep/alert on a leaked-link abuse, which is the stated safety net. A `chat_message_count` column can follow if wanted in the UI.
- **D16 (scope-out):** Out of scope for v1 — persistence/transcripts, tools, vision/images, rate limiting, any per-user identity, and chat on the **expired** share view.
- **D22 (Q22):** Deploy order: **substation migration first** (`chat_enabled` default true → existing links auto-enable) → then cityhall (chat route + share-page panel + toggle UI + mutation).

---

## Schema change (substation migration)

One additive column, zero alterations to existing rows:

```sql
ALTER TABLE sir_share_link
  ADD COLUMN chat_enabled boolean NOT NULL DEFAULT true;
```

That's the entire DB surface. Every existing link becomes chat-enabled on migration (D11/D22). No index needed — `chat_enabled` is only ever read on a single-row `lookupShareLink` fetch already keyed by `token`.

`lookupShareLink` (`cityhall/src/lib/server/sir-share.ts:43`) currently selects `site_intelligence_report_id, expires_at, superseded_at, revoked_at`. Add `chat_enabled` to that select and thread it through the `ShareLookup` return type so both the loader (gate) and the POST route (backstop) see it.

The live-edit mutation (D17) sets `chat_enabled` on `sir_share_link` for the current (non-superseded, non-revoked) link of a SIR, behind the `is_noetic_admin` gate. Confirm at implementation whether the existing share-control mutations are RPCs or direct service-role writes and match that pattern.

---

## The chat route (`cityhall/src/routes/share/sir/[token]/chat/+server.ts`)

Mirror `api/chat/sir/+server.ts` with the auth primitive swapped and all persistence removed:

1. `lookupShareLink(params.token)` → `missing`/`expired`/`revoked`/`superseded` all → **404** (obscurity: never confirm a near-miss token; expiry on a *chat* POST is a dead link, not a friendly surface). `ok` → `sirId` (+ `chat_enabled`).
2. If `chat_enabled === false` → **403** (or 404 for obscurity — pick at implementation; lean 404 to match the route's obscurity posture).
3. Service-role load SIR (`current_version`, `title`, `address`) + `report_extracted_text` path for that version. Missing text → **409** (D10 backstop).
4. Parse + validate the FE body (reuse the logged-in route's `BodySchema`/`UIMessageSchema`). Apply the D6 cap → **400** on exceed.
5. Service-role download the extracted text (`fetchReportExtractedText` variant that takes the admin client). Empty → **409**.
6. Build `[injected <sirContent> user turn, ...convertToModelMessages(feMessages)]`, run `dropTrailingAssistantMessages`, `streamText` with `SIR_SYSTEM_PROMPT` + `SIR_CHAT_MODEL`, no `onFinish` DB writes — just the D21 log in `onFinish`.
7. `toUIMessageStreamResponse({ onError })` (reuse the logged-in error-forwarding shape). Set `Cache-Control: no-store`.

`fetchReportExtractedText` and the SIR/text lookup currently take the RLS user client; factor a service-role-parameterized variant (or a token-scoped `getSharedSirChatState(token)` helper) so the two routes share one implementation.

---

## `SirChatPanel` refactor (D13)

Add props so the one component serves both routes:

| Prop | Logged-in | Shared |
|---|---|---|
| `endpoint` | `/api/chat/sir` | `/share/sir/${token}/chat` |
| `headers` | `{ 'x-sir-id', 'x-conversation-id' }` | `{}` (token is in the path; sirId derived server-side from the token) |
| `initialMessages` | from DB | `[client-seeded greeting]` |
| `showReset` | true (server reset) | true (client-only clear) |
| `persistent` | true | false |

The `DefaultChatTransport` `api` + `headers` become prop-driven. `conversationId` becomes optional (absent in shared mode). Everything else — streaming, error box, composer — is unchanged.

---

## Rollout & sequencing (D22)

1. **substation** — migration adding `sir_share_link.chat_enabled DEFAULT true`. Ships first; existing links become chat-enabled immediately.
2. **cityhall** — in one PR: the token-gated chat route, the `lookupShareLink` select extension + `ShareLookup` type, the share-page loader gate (`chatAvailable`) + panel render, the `SirChatPanel` prop refactor (both call sites updated), and the admin toggle control + live-edit mutation.

Because the loader gates on both `chat_enabled` and text-artifact presence, the cityhall side is safe to ship even before any link is toggled — every current link already has the text artifact and defaults to `chat_enabled=true`, so chat lights up on deploy.

---

## Open questions

- **Q-A:** D2 vs D17 interaction — when an admin flips `chat_enabled` off on a link that a customer currently has open, the next POST 404/403s mid-session (the panel errors). Acceptable, or should the loader-gate state also be surfaced via a lightweight poll so the panel disables gracefully? *Lean: acceptable for v1 — the error box already renders forwarded messages; a graceful-disable poll is polish.*
- **Q-B:** Route response for `chat_enabled=false` — 403 (honest) vs 404 (obscurity-consistent with the rest of the share route). *Lean: 404.*
- **Q-C:** D6 cap exact bound (40 msgs / 50K chars) — is that the right ceiling for a long legit diligence Q&A session? A 140-page report invites deep back-and-forth. *Lean: 50K chars of *history* (not counting `<sirContent>`) is ~12K tokens of conversation, comfortably generous; revisit if a real session hits it.*
- **Q-D:** Should the D21 server log go anywhere structured (a counter, BetterStack field) for proactive abuse alerting, or is a grep-able log line enough for v1? *Lean: log line only; add a counter if abuse is ever observed.*
