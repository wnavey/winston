# Shareable Site Intelligence Reports — time-bound, no-login public view (cityhall + substation)

**Status:** Draft v2
**Date:** 2026-08-05
**Type:** Implementable spec. This is the **anonymous-delivery** slice of the north-star `../sir-product-experience/DESIGN-SPEC.md` (winston#192) **Surface B1 — "Secure delivery: time-limited obscurity URL (default, no login)"** (§8/§3.2, and the "Delivery" domain object at §5:163). It builds directly on the already-shipped read path `../sir-product-viewing/DESIGN-SPEC.md` — that spec put the logged-in SIR detail view at `project/[projectId]/sir/[sirId]`; **this spec makes that same view reachable without an account** via a random, expiring URL that a Noetic admin generates and copies.
**Repos touched:** `cityhall` (new public share route outside `(app)`; one `authGuard` allowlist edit; extract the SIR render into a shared component; new `+page.server.ts` on the logged-in SIR route for the generate/regenerate action + admin button). `substation` (ONE additive migration — a `sir_share_link` table, RLS-locked to service-role; **no** anon policy, **no** storage policy). The migration is *specified here, applied separately* (operator-gated), matching #203/#viewing discipline.
**Repos NOT touched:** `conductor`, `bureau`, `quarry`, `navalbase`, `radar`, `field-agent`, `claude-plugins`, `surveyor`.

> **One-line goal:** A Noetic admin viewing a delivered SIR sees a **"Generate / Regenerate shareable URL"** button (Noetic-org only) that mints a random, time-bound URL and copies it to the clipboard. Pasting that URL into any browser — no login, no account — resolves to the **exact same SIR report view** the admin sees, until the link expires.

> **Revision note (Draft v2, 2026-08-05 — folds in the auth-architecture review + a 10-question grill; same PR #212).**
> - **§8.1 Token-scoped API surface (new, D9).** How any client-initiated call from the no-login page authenticates via the share token as a bearer credential against distinct, minimal, token-gated endpoints that share core data logic with the session endpoints but never reuse their session auth. Rule of thumb for one-endpoint-two-modes vs. split.
> - **§8.2 Artifact re-mint proxy endpoint (new, D10 — grill Q7).** Artifact links point at a token-gated cityhall GET that re-validates the token and mints a **short-TTL** signed URL **per click**, instead of embedding a 1 h signed URL in the page at load. Fixes the "click a stale link 2 h later → raw Supabase error" UX and keeps **Revoke** meaningful for the file bytes (enforced on every click). This is the first *shipping* §8.1 endpoint.
> - **Versioning is internal-only (D11 — grill Q8).** The public/shared view surfaces **no** `version` / `versioning_label` and no version switcher; version is an admin-only concept in the logged-in view (intent). Reverses v1's framing of D8/Q5.
> - **Feature flag + global kill-switch (D12 — grill Q9).** A Vercel flag gates the admin button **and** the public route load; flag-off instantly stops *all* links resolving. Per-link **Revoke** (D13) is the surgical control.
> - **Grill resolutions:** Q1 build = spec-on-shelf (another session builds); TTL = **30 days**; token stored **verbatim**; **pure no-login** (no lead-capture gate); **one live link per SIR**; **ship Revoke** in MVP; anon payload (title/description/address/coords/parcel + current-version artifacts) confirmed acceptable. Former open questions Q1/Q3/Q4/Q5 are now decided; only Q6 (public-page branding) remains.
> - Added **`Referrer-Policy: no-referrer`** (§6) and a **`/share/*` anonymous-by-construction** security guardrail (§8). Clarified §9 (MVP shares the **render** component only).

---

## 1. Problem

We deliver Site Intelligence Reports to prospective clients who **do not have accounts** (and, per the north-star, may never — "default is no-login, link good for ~1–2 months, then require an account for history", #192 §5:163). Today the only way to see a delivered SIR in the app is the logged-in detail view at `project/[projectId]/sir/[sirId]` (built per `../sir-product-viewing/`), which sits behind two hard auth gates and reads all of its data through the logged-in user's RLS client. There is **no way to hand a report to someone outside Noetic** short of downloading the PDF and emailing it — which loses the in-app viewer (inline PDF, artifact list, supporting documents) that is the product.

We want to mirror that logged-in view exactly, and expose it through a **"security through obscurity"** URL: an unguessable random token that grants read-only access to one SIR until it expires. This requires (a) a token+expiry record and a way to mint/rotate it, (b) a public route that renders the SIR without a session, and (c) unwinding every login dependency the current view has.

**Two design problems, verified below:**
- **(a) The logged-in view is triple-gated on auth.** The `(app)` group redirects anonymous users to `/auth` (in *two* places), and every byte of SIR data — the SIR row, the artifact rows, and the storage signed URLs — is read through the user-scoped RLS client. None of that works for an anonymous visitor.
- **(b) There is no share/token/expiry primitive in the product yet.** Tokened access exists elsewhere (upload tokens, marketing download tokens) but always as a **service-role-validated server route**, never as anon-facing RLS. We follow that house style.

---

## 2. Verified current state (cityhall @ `main`, substation @ `main`, prod `mgxqsrjutswbciyrltwd`, 2026-08-05)

### 2.1 The logged-in SIR view is fully built and cleanly renders `{ sir, artifacts }`

- **Route:** `cityhall/src/routes/(app)/project/[projectId]/sir/[sirId]/{+page.ts,+page.svelte}` (built). `+page.ts` reads `{ supabase, sirs } = await parent()`, `.find`s the SIR by `params.sirId` (404 on miss), then queries `sir_artifact` (current version only) and signs each `storage_path` with `supabase.storage.from('sir-artifacts').createSignedUrl(path, 3600)`. Returns `{ sir, artifacts }` where each artifact carries `signedUrl`.
- **Render (`+page.svelte`):** pure presentation — a title/description/address header, a combined **report** card (PDF+DOCX), then **research_appendix** / **supporting_document** cards, an **inline PDF viewer** (`$lib/ui/pdf/PdfPageViewer.svelte` fed `reportPdf.signedUrl`), a `downloadHref()` helper that appends Supabase's `&download=` param, and a "Link unavailable" fallback when `signedUrl` is null. **Nothing in the render reads `locals.user`, the session, or the `(app)` layout data** — it consumes only `data.sir` + `data.artifacts`. → cleanly extractable into a shared component (§9).
- The SIR row itself is loaded once in `project/[projectId]/+layout.ts` (`site_intelligence_report` filtered `.eq('project_id', …)`, under the RLS user client) and handed down as `sirs`.

### 2.2 The auth boundary — two gates, one allowlist

1. **Global hook** `cityhall/src/hooks.server.ts:96-111` (`authGuard`): any request with no session whose pathname does **not** `startsWith` one of `/auth`, `/terms`, `/privacy`, `/mocks` is `redirect(303, '/auth')`. This single `startsWith` allowlist is the load-bearing gate; `/terms` and `/privacy` are the precedent for an anonymous route.
2. **Layout redirect** `cityhall/src/routes/(app)/+layout.server.ts:10-18`: a redundant `if (!locals.user) redirect(303, '/auth')`, plus it loads org/project data under RLS.
   → A public route must (a) live **outside `(app)`** (escape gate 2) and (b) have its URL prefix added to the `authGuard` allowlist (escape gate 1).
- **Request-scoped clients** are set in `hooks.server.ts`: `event.locals.supabase` = user-scoped **RLS** client (anon key + user cookies); `event.locals.safeGetSession` validates the JWT. The client-side `data.supabase` (root `+layout.ts`) is the same RLS client. **Neither can read another org's SIR or sign a private-bucket object anonymously.**

### 2.3 cityhall already has a service-role client — the right tool here

`cityhall/src/lib/server/supabase-admin.ts` exports `supabaseAdmin` — `createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken:false, persistSession:false }})`, **bypasses RLS**, server-only. Best precedent: `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.server.ts:17,25,33` uses `supabaseAdmin` to read a review + its version and to **sign report PDFs from storage** — exactly the shape our public load needs. A **service-role `createSignedUrl` bypasses `storage.objects` RLS**, so the anonymous file-serving path needs no new storage policy (contrast the *logged-in* path in `../sir-product-viewing/` §9, which needs one because it signs with the user client).

### 2.4 SIR data model + RLS (substation)

- `substation/supabase/migrations/20260731000000_site_intelligence_report_and_sir_artifact.sql` (+ `20260731120000_relax_…`) create `site_intelligence_report` (PK `id`, FK `project_id`, `title`, `description`, `address`, `latitude`, `longitude`, `parcel_ids`, `current_version int default 0`, timestamps) and `sir_artifact` (FK `site_intelligence_report_id` ON DELETE CASCADE, `version`, `versioning_label`, `kind ∈ {report,research_appendix,supporting_document}`, `format`, `storage_bucket default 'sir-artifacts'`, `storage_path`, `file_name`, `mime_type`, `byte_size`).
- **RLS:** `site_intelligence_report` SELECT `TO authenticated USING (user_can_see_project(project_id, auth.uid()))`; `sir_artifact` SELECT joins through the parent SIR to `user_can_see_project`. Writes are service-role at publish. **No anon policy on either table** — an anonymous JWT gets zero rows.
- **`sir_artifact.kind` is entirely client-facing** (`report`/`research_appendix`/`supporting_document`). Internal-only artifacts (run manifests, telemetry, HITL ledgers — #192 §5:160) are **not** in `sir_artifact` at all. → sharing every row of a SIR's current version leaks nothing internal (§6, §11).
- **`sir-artifacts` bucket is private** (`public=false`) with **no `storage.objects` policy** — irrelevant to us because we sign service-role (§2.3).

### 2.5 Token/share/expiry precedent — service-role, never anon RLS

- **No RLS policy anywhere grants to the `anon` role** (grep confirmed). The many `GRANT … TO anon` lines are inert table privileges under RLS-enabled tables with only `authenticated`/`service_role`/`workflow_run` policies. Unauthenticated read via RLS would be **the first in the schema** and is explicitly *not* what we do.
- **Two token tables exist, both RLS-locked to service-role and validated in app code:**
  - `substation/supabase/migrations/20260426181238_upload_token.sql` — `id uuid PK`, `expires_at timestamptz NOT NULL`, `consumed_at`, RLS enabled with **zero policies** (service-role only).
  - `substation/supabase/migrations/20260521011821_marketing_leads.sql` → **`download_tokens`**: **`token text PRIMARY KEY`** (opaque random), `expires_at timestamptz NOT NULL`, `download_count int`, `superseded_at`, `created_at`; RLS enabled, **zero policies**, with the explicit comment *"No policies = no access for anon/authenticated roles. Only service_role can read/write."* A companion `security definer` RPC `increment_download_count(text)` mutates by token.
  → **`download_tokens` is the template for this feature**, down to `superseded_at` (= "regenerate invalidates the old link") and the access counter. House style: *opaque random token + `expires_at` (+ `superseded_at`/`revoked_at`) in an RLS-locked table, validated in a service-role server route.*

### 2.6 Reusable UI idioms

- **Admin-only render:** `data.isNoeticAdmin` is computed in `(app)/+layout.server.ts:62-64` and inherited by every `(app)` page — so `sir/[sirId]/+page.svelte` already has it. Gate the button with `{#if data.isNoeticAdmin}` (exact precedent: `project/[projectId]/data/+page.svelte:151`). Gate the **server action** with the `is_noetic_admin` RPC (precedent: `masquerade/+page.server.ts:22-24`) — never trust the client boolean for the mutation.
- **Clipboard:** one raw call exists — `navigator.clipboard.writeText(...)` at `review/StandardNoteDiff.svelte:49`. No shared `<CopyButton>` component; we replicate the one-liner with a "Copied!" affordance.
- **Signed-URL TTL:** the app-wide convention is **3600s (1h)**, including the built SIR route.

---

## 3. Desired behavior

### 3.1 Admin experience (Noetic org only)
| Step | Behavior |
|---|---|
| Viewing a delivered SIR at `project/[projectId]/sir/[sirId]` | A **"Generate shareable URL"** button appears **only** for Noetic admins (`{#if data.isNoeticAdmin}`). |
| No active link exists | Button reads **"Generate shareable URL."** Click → mints a token, forms the full URL, **copies it to the clipboard**, shows "Copied — expires \<date>". |
| An active link exists | UI shows **"Shareable link active · expires \<date>"** with three actions: **Copy** (re-copies the existing URL), **Regenerate** (supersedes the old token, mints a new one, copies it), and **Revoke** (kills the link without replacing it — D13). |
| Recipient opens the URL | Resolves to the report view (§3.2). |

### 3.2 Recipient experience (no account)
| Step | Behavior |
|---|---|
| Paste the URL into a new/incognito window | Loads with **no login prompt** — the route is outside `(app)` and allowlisted. |
| Valid, unexpired token | Renders the **exact same SIR report view** the admin sees (§9 shared component): header, inline report PDF, artifact cards, supporting documents — minus the app nav chrome and the admin button. |
| Expired / superseded / revoked token | A friendly **"This link has expired"** page (not a raw 404), inviting them to contact Noetic. (§6 — this reveals only that a link *once* existed, acceptable for an already-secret, already-time-bound link.) |
| Malformed / never-existed token | Plain **404** (obscurity: never confirm a guessed token was "close"). |

---

## 4. Architecture

```
ADMIN (logged in, Noetic org)                    RECIPIENT (no account)
─────────────────────────────                    ──────────────────────
project/[projectId]/sir/[sirId]                  GET /share/sir/<token>
  +page.svelte {#if isNoeticAdmin && flag}         │
  [ Generate / Regenerate / Revoke ]──action─┐     │  (outside (app);
                                             │     │   /share allowlisted
  +page.server.ts (action)                   │     │   in authGuard;
   1. is_noetic_admin RPC gate ◀─────────────┘     │   flag gates the LOAD)
   2. supabaseAdmin: supersede/insert/revoke       ▼
      sir_share_link { token, sir_id,     +page.server.ts  (SERVER-ONLY, service role)
        expires_at }                       1. flag on? (D12 kill-switch) else 404
   3. return absolute URL                  2. from('sir_share_link').eq('token',…) ── validate:
        │                                     exists? not superseded/revoked? not expired?
        ▼                                  3. read SIR + artifact METADATA (no signed URLs,
   navigator.clipboard.writeText(url)         no version surfaced — D11)
                                           4. return { sir, artifacts }  ── metadata only
   ┌───────────────────────────────────┐        │
   │  <SirReportView sir artifacts     │  ◀──────┘  public wrapper (standalone shell,
   │     artifactHref/>  (§9)          │            noindex, no-referrer, "expired" branch)
   └───────────────────────────────────┘        │
        ▲                                        ▼   per artifact click:
   logged-in wrapper                        GET /share/sir/<token>/artifact/<id>  (§8.2 proxy)
   ((app) chrome + admin button)              → re-validate token, prove artifact∈SIR@current,
   artifactHref = signedUrl                   → createSignedUrl(path, 120s) → 302 redirect
                                                       │
                                              <SirReportView …/>  ← SAME UI, bytes via proxy
```

**Load-bearing choice: service-role server route, not anon RLS** (§2.5). The token is validated in `+page.server.ts` code holding the service-role key; metadata is read service-role, and file bytes are signed service-role **per click** in the §8.2 proxy. This matches `download_tokens`/`upload_token`, keeps RLS closed (no first-ever anon policy), and needs no `sir-artifacts` storage policy. The alternative — opening `site_intelligence_report`, `sir_artifact`, **and** a new `sir-artifacts` `storage.objects` policy to `anon`, gated on a token RLS can't actually see in the URL — is both more surface and unprecedented; rejected (D2).

---

## 5. Schema change — `sir_share_link` table (substation, additive)

One additive migration, RLS-locked to service-role (zero policies), modeled on `download_tokens` (§2.5). Specified here; **applied separately (operator-gated), substation-first**, then the cityhall PR — matching #203/#viewing discipline. No firing from the spec session.

```sql
-- substation/supabase/migrations/<timestamp>_sir_share_link.sql
create table public.sir_share_link (
  id                          uuid primary key default gen_random_uuid(),
  site_intelligence_report_id uuid not null
    references public.site_intelligence_report(id) on delete cascade,
  token                       text not null,           -- opaque random secret (§6); see D3 re: at-rest form
  created_by                  uuid references auth.users(id),
  created_at                  timestamptz not null default now(),
  expires_at                  timestamptz not null,    -- enforced on EVERY load (§6)
  superseded_at               timestamptz,             -- set when Regenerate mints a replacement
  revoked_at                  timestamptz,             -- set by an explicit Revoke (D13, shipped in MVP)
  access_count                integer not null default 0,
  last_accessed_at            timestamptz
);

-- token lookups must be fast and the token unique among *live* links
create unique index sir_share_link_token_key on public.sir_share_link (token);
create index sir_share_link_sir_id_idx on public.sir_share_link (site_intelligence_report_id);
-- at most one live (un-superseded, un-revoked) link per SIR:
create unique index sir_share_link_one_live_idx
  on public.sir_share_link (site_intelligence_report_id)
  where superseded_at is null and revoked_at is null;

alter table public.sir_share_link enable row level security;
-- No policies. Service role only (bypasses RLS). anon/authenticated get nothing.
comment on table public.sir_share_link is
  'Time-bound obscurity share links for SIRs. RLS-locked to service_role; the token in the URL is the sole secret. Validated in cityhall''s service-role share route, never via anon RLS.';
```

- **"A link resolves"** ⇔ `token = $1 AND superseded_at IS NULL AND revoked_at IS NULL AND expires_at > now()`. Expiry is checked **at read time on every load**, not merely trusted from generation.
- **Regenerate** = `update sir_share_link set superseded_at = now() where site_intelligence_report_id = $sir and superseded_at is null and revoked_at is null`, then `insert` a fresh row. The partial unique index guarantees a single live link per SIR.
- **cityhall generated types** (`src/lib/types/database.ts`) must be regenerated after the migration so `supabaseAdmin.from('sir_share_link')` is typed.

---

## 6. Token generation & security — the dedicated design

The URL token is the **only** credential ("security through obscurity"), so its generation, storage, exposure, and expiry get first-class treatment.

- **Entropy & format.** Token = **256 bits** from a CSPRNG, base64url-encoded (`crypto.getRandomValues(new Uint8Array(32))` → url-safe string, ~43 chars). This is far beyond guessable/enumerable; brute force over 2²⁵⁶ is infeasible and the table is not anon-listable. (`crypto.randomUUID()`'s 122 bits would also do, but 256-bit random is unambiguous and not a UUID that might be mistaken for an id.)
- **At-rest form (D3, recommended: store the token verbatim).** Store the token as-is (as `download_tokens` does), keyed by unique index. This enables **Copy-without-regenerate** (§3.1) and matches house style. *Hardening alternative (considered, declined — grill Q4):* store only `sha256(token)` and reconstruct the URL solely at mint time — defends against a DB/log leak, at the cost of the "Copy existing" affordance (every share becomes a regenerate). Given the link is already low-assurance and short-lived, verbatim storage is the decision; the hash option remains a documented future hardening if the threat model changes.
- **Expiry (enforced server-side, every load + every §8.2 click).** Default lifetime **`SIR_SHARE_TTL_DAYS = 30`** (within Jason's "~1–2 months", on the safer end — decided at 30, grill Q6). `expires_at = now() + interval`. Both the page load and the artifact proxy reject `expires_at <= now()` regardless of what the generator wrote — no client-trusted expiry.
- **Rotation / revocation.** Regenerate supersedes the prior token immediately (old URL → "expired" page). A `revoked_at` column + explicit **Revoke** action kills a link without minting a replacement (D13 — shipped in MVP). Beyond per-link Revoke, the D12 feature flag is a global kill-switch (all links at once). One live link per SIR (partial unique index, §5).
- **Scope minimization.** A token grants read of **exactly one SIR's current-version artifacts + its public metadata** (title, description, address, coordinates, parcel ids) — nothing else. No project, no sibling SIRs, no submissions, no other versions. The public load never queries by `project_id`; it pivots strictly `token → site_intelligence_report_id`.
- **No internal-data leak.** `sir_artifact` holds only client-facing kinds (§2.4); internal manifests/telemetry are not in that table, so "share the whole current version" cannot expose them. The shared render component (§9) shows only what `{ sir, artifacts }` carries.
- **Signed URLs are minted per click, short-TTL, never embedded at load (D10, §8.2).** Artifact links point at a token-gated cityhall proxy (`/share/sir/<token>/artifact/<artifactId>`) that re-validates the token and mints a fresh **short-TTL** signed URL on each click, then 302-redirects. So a signed URL is never left sitting in the page for an hour, revoke/expiry is enforced **on every click** (a leaked signed URL is dead in seconds, and revoking the link kills file access immediately — not up to an hour later), and there is no "stale link → raw Supabase error" failure. Link expiry, checked live at each click, is the real and only boundary.
- **Crawler hygiene.** The public route emits `<meta name="robots" content="noindex,nofollow">` and an `X-Robots-Tag: noindex` header. The URL is unguessable regardless, but this prevents accidental indexing if a recipient's tooling leaks the URL into a crawlable surface.
- **Referrer suppression.** The public route sets `Referrer-Policy: no-referrer` so the token-bearing URL is never leaked in the `Referer` header when the browser fetches artifact bytes from Supabase Storage (or any off-origin resource). Combined with carrying the token in a header/body rather than a query string on any future POST (§8.1), this keeps the token out of third-party and proxy logs.
- **Non-confirmation on failure.** Malformed/unknown token → **404** (never "wrong token"); expired/superseded/revoked → a friendly **"expired"** page (reveals only that a link once existed — acceptable, D5). Neither path discloses the SIR's existence to a random guesser.
- **Observability.** Each successful resolve bumps `access_count` + `last_accessed_at` (service-role update) — cheap abuse/interest signal, and the hook for a future "who's viewed this" admin readout. No PII on the recipient is collected in MVP.

---

## 7. Admin experience — generate/regenerate + clipboard (cityhall)

**New `sir/[sirId]/+page.server.ts`** (the route currently has only the universal `+page.ts`; adding a server load + actions is additive):

- **`load`** (service-role, but only surfaces data to Noetic admins): if `locals` resolves a Noetic admin (reuse the `is_noetic_admin` RPC gate), `supabaseAdmin.from('sir_share_link').select('token, expires_at, created_at').eq('site_intelligence_report_id', sirId).is('superseded_at', null).is('revoked_at', null).gt('expires_at', 'now()')` → return `shareLink` (the live one, or null). Non-admins get `shareLink: undefined`. This feeds the button's state (§3.1).
- **`actions.generateShare`** — (1) gate with the `is_noetic_admin` RPC (precedent `masquerade/+page.server.ts:22-24`), `error(403)` otherwise; (2) `supabaseAdmin` supersede any live row for this SIR, insert a new row `{ token: randomToken(), site_intelligence_report_id, created_by: user.id, expires_at: now()+TTL }`; (3) return `{ url: `${origin}/share/sir/${token}`, expiresAt }`. Handles both first-generate and regenerate (they're the same mint; the label differs client-side on whether a live link already existed).
- **`actions.revokeShare` (D13)** — same `is_noetic_admin` gate; `supabaseAdmin` sets `revoked_at = now()` on the live row for this SIR (no replacement). The link stops resolving immediately (§8 load + §8.2 proxy both check `revoked_at`).
- Both actions no-op safely if the D12 flag is off (the button isn't shown, and the server actions are gated regardless).

**`sir/[sirId]/+page.svelte`** — add, inside `{#if data.isNoeticAdmin}` *and* when `sirSharingEnabled` (D12), a small control block:
- No live link → **"Generate shareable URL"** button.
- Live link → **"Shareable link active · expires \<date>"** + **Copy** (re-copies `data.shareLink` URL) + **Regenerate** + **Revoke** buttons.
- On a successful `generateShare` (via `use:enhance`), `await navigator.clipboard.writeText(result.url)` (idiom from `StandardNoteDiff.svelte:49`) and flash "Copied!". The button block sits above the shared `<SirReportView>` (§9); the report body itself is unchanged.

---

## 8. Recipient experience — the public route (cityhall)

**New route outside `(app)`:** `cityhall/src/routes/share/sir/[token]/{+page.server.ts,+page.svelte}`. `+page.server.ts` (server-only ⇒ the service-role key never reaches the client):

```ts
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';

export const load = async ({ params, setHeaders }) => {
  setHeaders({ 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });

  if (!(await sirSharingEnabled())) error(404, 'Not found');            // D12 kill-switch: flag gates the LOAD

  const { data: link } = await supabaseAdmin
    .from('sir_share_link')
    .select('site_intelligence_report_id, expires_at, superseded_at, revoked_at, access_count')
    .eq('token', params.token)          // unique index
    .maybeSingle();

  if (!link) error(404, 'Not found');                                   // unknown/malformed → 404
  const dead = link.superseded_at || link.revoked_at || new Date(link.expires_at) <= new Date();
  if (dead) return { expired: true };                                    // friendly expired page (D5)

  const { data: sir } = await supabaseAdmin
    .from('site_intelligence_report')
    .select('id, title, description, address, latitude, longitude, parcel_ids, current_version')
    .eq('id', link.site_intelligence_report_id)
    .single();
  if (!sir) error(404, 'Not found');

  // Metadata only — NO signed URLs embedded here. Bytes are fetched per-click via the §8.2 proxy.
  // `version`/`versioning_label` are deliberately NOT selected: versioning is internal-only (D11).
  const { data: artifacts } = await supabaseAdmin
    .from('sir_artifact')
    .select('id, kind, format, file_name, mime_type, byte_size')       // note: no storage_path to the client, no version
    .eq('site_intelligence_report_id', sir.id)
    .eq('version', sir.current_version)                                 // filter server-side; value never leaves the server
    .order('kind').order('file_name');

  // observability (§6) — fire-and-forget; a slow/failed counter write must never block the render
  void supabaseAdmin.from('sir_share_link')
    .update({ access_count: link.access_count + 1, last_accessed_at: new Date().toISOString() })
    .eq('token', params.token);

  // artifacts carry `id` only for the byte fetch; the client builds hrefs → /share/sir/<token>/artifact/<id> (§8.2)
  return { expired: false, sir, artifacts };
};
```

**`+page.svelte`** — a **standalone shell** (a slim Noetic-branded header, no `(app)` nav/sidebar, no admin button): if `data.expired` render the "This link has expired — contact Noetic" panel; else render `<SirReportView sir={data.sir} artifacts={data.artifacts} />` (§9). Because this route is outside `(app)` and reads only from `+page.server.ts`, it inherits none of the logged-in chrome.

**`authGuard` edit** (`hooks.server.ts:101-108`): add `!event.url.pathname.startsWith('/share')` to the anonymous allowlist alongside `/auth`, `/terms`, `/privacy`, `/mocks`. That single line is the whole "let anonymous users reach it" change.

> **Security guardrail — `/share/*` is anonymous by construction.** Because the allowlist matches on the `/share` **prefix**, *every* route ever created under `/share/*` is reachable with no session. That is exactly what the token routes need, but it means any future route added under `/share/` silently ships as an unauthenticated endpoint. **Rule: nothing goes under `/share/*` without validating the share token server-side (§8.1).** Anything that should require a login must live *outside* `/share`. Treat a new `/share/*` route the way you'd treat a new public endpoint — token validation is mandatory, not optional.

### Unwinding the login dependencies (the audit ask, itemized)
| Login dependency of the logged-in view | How the public path unwinds it |
|---|---|
| `authGuard` 303→`/auth` for no session (`hooks.server.ts:108`) | Add `/share` to the `startsWith` allowlist (§8). |
| `(app)/+layout.server.ts:17` `!locals.user` redirect | Route lives **outside `(app)`** — never hits this layout. |
| SIR row via `parent().sirs` (RLS user client, project-scoped) | Service-role fetch by `id` from the token row — no project scoping, no session. |
| `sir_artifact` SELECT under RLS | Service-role read (bypasses RLS). |
| `createSignedUrl` gated by `sir-artifacts` storage RLS | Service-role signing **bypasses** storage RLS ⇒ **no storage policy needed** (§2.3). |
| `data.isNoeticAdmin` + `(app)` chrome/nav | Standalone shell; the admin button lives only in the logged-in wrapper, not in the shared component. |

### 8.1 Token-scoped API surface — client-side & future interactive calls (e.g. AI chat)

The MVP page is effectively static: the SIR data is fetched server-side and **serialized into the HTML on first paint** (the §8 load), so rendering needs **zero** client→backend data calls, and the only browser→Supabase traffic is fetching artifact bytes over signed URLs. (Even SvelteKit's own `__data.json` refetch on client-side re-entry re-hits *this same route*, whose path still carries the token, so it re-validates for free.)

But this is a live web app, and future interactivity — AI chat, lazy "load more documents", refreshing an expired signed URL — will make **client-initiated** calls that need a credential. The visitor has no session, so **the share token is the bearer credential for the public surface.** We fix the pattern now, even though MVP needs no custom client call, so it isn't invented ad hoc later.

**Every backend endpoint the public page calls MUST:**
1. **Receive the token** — from the route path, or a header/body for POSTs (prefer header/body over query string so it stays out of access logs).
2. **Re-validate it server-side** (exists / not expired / not superseded / not revoked) via the service-role client — the *same* check the page load runs. Never trust that the page already validated.
3. **Derive the target SIR from the token, never from client input.** The browser cannot name a project or SIR; cityhall resolves `token → site_intelligence_report_id` and scopes the whole operation to it. This blocks a token-holder from pivoting to any other SIR/project (confused-deputy).
4. **Stay minimal and single-SIR:** read-oriented, only client-facing fields, no cross-SIR/cross-project reach, no account-state mutation.

**Distinct edges, shared core; cityhall is the gateway.** These are **separate, opt-in, token-gated endpoints** — we never route a token-holder into the existing session-authenticated API (the shared-vs-distinct reasoning is D9). The browser **never calls substation directly**: it calls a cityhall token endpoint, cityhall validates the token, then cityhall calls substation/Supabase with *its own* service credentials. The token stops at cityhall's server and is exchanged there for a privileged downstream call.

**Worked example — future AI chat:**
```
POST /share/sir/<token>/chat   { message }
  → cityhall server: re-validate <token>; derive SIR from it (not from the body)
  → load that SIR's content as context; call the model with cityhall's service creds
  → stream reply, scoped to that one SIR
```
Distinct from today's logged-in `/api/chat` (which authenticates on `locals.user`). Because anyone with the link can drive model spend, **this endpoint is where the public limits live** — per-token rate limiting and a per-token cost ceiling. (Chat itself is deferred, §12; only the auth pattern is reserved here.)

The **artifact re-mint proxy (§8.2) is the first *shipping* instance of this pattern** — MVP builds it; chat is the future one.

### 8.2 Artifact re-mint proxy endpoint (D10) — the click → bytes path

**Why not embed signed URLs at load?** A signed URL minted in the page `load` is a self-contained bearer capability to the file bytes for its whole TTL. Embed it at 1 h and a recipient who clicks 2 h later gets a raw Supabase "expired" error and must somehow know to refresh; embed it long-lived and revoking the share link no longer stops file access (the pre-minted URL keeps working). Both are wrong. Instead the artifact card links point at a **token-gated cityhall endpoint**, so the href in the DOM never goes stale and every click is a fresh authorization.

**New route:** `cityhall/src/routes/share/sir/[token]/artifact/[artifactId]/+server.ts` — a `GET` that:

```ts
export const GET = async ({ params }) => {
  if (!(await sirSharingEnabled())) error(404);                        // D12 kill-switch
  // 1. Re-validate the token FRESH (exists / not superseded / not revoked / not expired) — §8.1 step 2
  const { data: link } = await supabaseAdmin.from('sir_share_link')
    .select('site_intelligence_report_id, superseded_at, revoked_at, expires_at')
    .eq('token', params.token).maybeSingle();
  if (!link || link.superseded_at || link.revoked_at || new Date(link.expires_at) <= new Date()) error(404);
  // 2. Resolve the artifact and CHECK IT BELONGS TO THIS TOKEN'S SIR + current version (§8.1 steps 3–4)
  const { data: a } = await supabaseAdmin.from('sir_artifact')
    .select('storage_path, site_intelligence_report_id, version')
    .eq('id', params.artifactId).maybeSingle();
  const { data: sir } = await supabaseAdmin.from('site_intelligence_report')
    .select('current_version').eq('id', link.site_intelligence_report_id).single();
  if (!a || a.site_intelligence_report_id !== link.site_intelligence_report_id || a.version !== sir.current_version)
    error(404);                                                        // blocks cross-SIR / stale-version artifact ids
  // 3. Mint a SHORT-TTL signed URL and redirect; the URL is consumed immediately
  const { data: signed } = await supabaseAdmin.storage.from('sir-artifacts').createSignedUrl(a.storage_path, 120);
  if (!signed?.signedUrl) error(404);
  redirect(302, signed.signedUrl);
};
```

- **Authorization is re-derived from the token every click** — the browser passes only `token` + `artifactId`, and the endpoint proves the artifact belongs to *that token's* SIR and current version before signing. A guessed/foreign `artifactId` → 404 (confused-deputy blocked).
- **Short TTL (≈120 s)** — the signed URL exists only long enough for the redirect to be followed, so nothing durable leaks.
- **The download-vs-inline behavior** (PDF inline, docx download) still comes from the object's mime type on the redirect target; `PdfPageViewer` (§9) points its `src` at this same proxy URL.
- This is exactly the "refreshing an expired signed URL" case §8.1 anticipated, now made concrete and mandatory for MVP.

---

## 9. Shared render component — `SirReportView.svelte`

To guarantee the recipient sees the **exact** logged-in UI (and to avoid two drifting copies), extract the report body of `sir/[sirId]/+page.svelte` into `cityhall/src/lib/.../SirReportView.svelte`. It owns the header, the report/appendix/supporting-document cards, the `PdfPageViewer` inline preview, `downloadHref()`, and the null-URL fallback.

**Props: `{ sir, artifacts, artifactHref }`.** The one thing that legitimately differs between the two routes is *how an artifact turns into a byte URL*, so the component takes that as a callback rather than assuming embedded signed URLs:
- **Logged-in route** (`sir/[sirId]/+page.svelte`): `(app)` chrome + `{#if data.isNoeticAdmin}` share button + `<SirReportView {sir} {artifacts} artifactHref={(a) => a.signedUrl} />` — **unchanged** from the shipped behavior (it still signs at load).
- **Public route** (`share/sir/[token]/+page.svelte`): standalone shell + `<SirReportView {sir} {artifacts} artifactHref={(a) => `/share/sir/${token}/artifact/${a.id}`} />` — hrefs point at the §8.2 proxy; nothing is signed at load.

**No version UI (D11 — grill Q8).** The component renders **no** `version` badge, `versioning_label`, or version switcher — versioning is an **internal-only** concept the customer must not see. (In the logged-in view, any version affordance is admin-only and lives in that route's wrapper, *not* in this shared component. Making the logged-in version display admin-gated is stated intent, tracked outside this spec.)

One component ⇒ pixel-parity by construction; future report-view changes land in both places automatically.

**Scope of sharing in MVP (reconciling with D9).** MVP shares the **render layer** — this one `SirReportView` component — across the logged-in and public routes; that is the whole "exact-same-UI" guarantee. It does **not** yet extract a shared *data-load* helper: the two loads (`sir/[sirId]/+page.ts` user-RLS vs `share/sir/[token]/+page.server.ts` service-role) differ only by which client they use and are ~10 lines each, so duplicating them is cheaper than abstracting. D9's "compute in a shared core" rule is about the **API layer** and bites when the first interactive/token endpoint lands (e.g. chat) — at that point a shared `loadSirBundle(client, sirId)` (or SIR-content service) is warranted so the session and token edges can't drift. For MVP, shared render + two thin loads is the correct amount of sharing; no data-layer refactor is required now.

---

## 10. Implementation surface

**cityhall**
| Change | File | Nature |
|---|---|---|
| Allowlist `/share` for anonymous | `src/hooks.server.ts:101-108` | one `startsWith` clause |
| Extract shared report view | `src/lib/.../SirReportView.svelte` (new) ← move body out of `sir/[sirId]/+page.svelte` | refactor, no behavior change |
| Public share route | `src/routes/share/sir/[token]/{+page.server.ts,+page.svelte}` (new) | service-role load (metadata only, flag-gated) + standalone shell (§8) |
| Artifact re-mint proxy | `src/routes/share/sir/[token]/artifact/[artifactId]/+server.ts` (new) | token-gated GET → short-TTL signed URL → 302 (§8.2, D10) |
| Shared render component | `src/lib/.../SirReportView.svelte` — props `{ sir, artifacts, artifactHref }`, no version UI | refactor (§9, D11) |
| Admin generate/regenerate/**revoke** | `src/routes/(app)/project/[projectId]/sir/[sirId]/+page.server.ts` (new) | server load (`shareLink` state) + `generateShare` **+ `revokeShare`** actions, `is_noetic_admin`-gated (§7, D13) |
| Admin button + clipboard + revoke | `sir/[sirId]/+page.svelte` | `{#if data.isNoeticAdmin}` block; `navigator.clipboard.writeText`; Revoke button |
| Feature flag (button + public load) | `src/lib/flags.ts` — new `sirSharingEnabled` (`defineFlag`, Vercel) | D12 kill-switch; gates the public route **load**, not just the button |
| Regenerated DB types | `src/lib/types/database.ts` | add `sir_share_link` (post-migration) |

**substation**
| Change | File | Nature |
|---|---|---|
| `sir_share_link` table (RLS-locked, service-role only) | `supabase/migrations/<ts>_sir_share_link.sql` (new) | additive; **applied separately, substation-first** (§5) |

No new npm deps. Reuses: `supabaseAdmin` (`review/[reviewId]` precedent), the `is_noetic_admin` RPC gate (`masquerade`), `data.isNoeticAdmin` conditional render (`data/+page.svelte`), the `createSignedUrl` idiom, `navigator.clipboard.writeText` (`StandardNoteDiff`), and the whole `sir/[sirId]` render (moved, not rewritten).

---

## 11. Edge cases
- **SIR re-published between mint and view** (`current_version` advances, #203 §7) → both the page load and the §8.2 proxy read `current_version` live, so the recipient always sees the current version — and, because versioning is hidden from them (D11), the swap is transparent, not a surprising visible change. A stale `artifactId` pointing at an old version 404s at the proxy (§8.2).
- **Link left open, artifact clicked hours later** (grill Q7) → the artifact href points at the §8.2 proxy, not a pre-signed URL, so the click always re-validates the token and mints a fresh short-TTL signed URL. No stale-URL error; if the link expired/was revoked in the meantime, the click 404s (and a page refresh shows the friendly "expired" panel).
- **SIR deleted after minting** (`ON DELETE CASCADE` drops artifacts **and** the share-link row) → token no longer resolves → 404. No dangling links.
- **Zero-artifact current version** (partial publish window) → the public page renders the header with an empty artifact list / "No files published yet", never an error (mirrors the logged-in empty state).
- **Multiple mint clicks / races** → the partial unique index (`one live per SIR`) + supersede-then-insert keeps exactly one live link; a lost race supersedes and re-inserts idempotently.
- **Clock skew on expiry** → expiry is evaluated in Postgres (`now()`) on read, single source of truth.
- **`latitude`/`longitude`/`parcel_ids` null** → header omits them (they're already nullable in the logged-in view).
- **Sharing globally disabled mid-flight (flag off, D12)** → the public route load and the §8.2 proxy both 404; existing links stop resolving immediately. Per-link Revoke (D13) is the surgical equivalent for a single link.

## 12. Non-goals (explicitly deferred)
- **No client accounts / "log in to see history"** (#192 §5's "then require an account for history") — that's the authenticated-delivery half; this spec is the no-login half only.
- **No report chat, findings layer, staff-review threads, internal-evidence toggle, map viewer** (#192 Surfaces B2/C/D/E).
- **No report web *rendering* changes** — we share the existing `sir/[sirId]` view as-is (inline PDF + cards). The rich `pages.tsx`→HTML infinite-scroll viewer (#192 B1/Q5) is a separate spec; if/when it lands, the shared component (§9) carries it into the share route for free.
- **No per-recipient links / analytics dashboard** — one live link per SIR (grill Q3), a single `access_count`. Per-recipient tokens are a future extension the table shape allows.
- **No lead-capture gate** (grill Q5) — pure no-login per Jason's default; a soft "enter your email to view" gate is a separate, additive product decision.
- **No anon RLS / no `sir-artifacts` storage policy** — deliberately avoided (§4, D2).
- **No customer-visible versioning** (D11, grill Q8) — the shared/public view shows no version or `versioning_label`; version is internal-only. MVP always serves current version; no version switcher or version-freeze.
- **No email delivery of the link** — the admin copies + sends it themselves (the "your report is ready" email is #192 B1, separate).

## 13. Decisions
- **D1 — Public route is a cityhall SvelteKit route outside `(app)`, allowlisted in `authGuard`.** Precedent: `/terms`, `/privacy`. URL shape `/share/sir/<token>` (namespaced for future `/share/<type>/<token>`).
- **D2 — Anonymous access is served by a service-role server route, not anon RLS.** Validate token+expiry in `+page.server.ts` (service-role key), read metadata service-role, sign file bytes service-role per click (§8.2). Matches `download_tokens`/`upload_token`; keeps RLS closed; **no `sir-artifacts` storage policy needed** (service-role signing bypasses storage RLS). The anon-RLS alternative (first-ever anon policy + anon storage policy) is rejected.
- **D3 — Store the token verbatim** (as `download_tokens` does) to enable Copy-without-regenerate (grill Q4 = verbatim). Hashing at rest was considered and declined for the low-assurance/short-lived link.
- **D4 — 256-bit CSPRNG token, base64url.** Expiry enforced server-side on every load *and* every §8.2 proxy click; default `SIR_SHARE_TTL_DAYS = 30` (grill Q6 = 30 days).
- **D5 — Failure disclosure:** unknown/malformed token → 404; expired/superseded/revoked → friendly "expired" page. One live link per SIR (partial unique index, grill Q3); Regenerate supersedes.
- **D6 — Exact-UI parity via a shared `SirReportView` component** consumed by both the logged-in and public routes.
- **D7 — The `sir_share_link` migration is specified here, applied separately (operator-gated), substation-first**, then the cityhall PR.
- **D8 — Recipient always sees `current_version`** (live read at load and at each §8.2 proxy click), not a frozen snapshot. With versioning hidden (D11) the swap is transparent to the customer.
- **D9 — Client-initiated public calls use the share token as a bearer credential against distinct, minimal, token-gated endpoints that *share core data logic* with the session endpoints but never reuse their session auth** (§8.1). Authenticate/authorize **at the edge**, per mode (session→RLS vs token→service-role scoped to one SIR); **compute in a shared internal function.** The browser never calls substation directly — cityhall validates the token and calls downstream with its own service credentials. MVP needs no such endpoint; the pattern is fixed now for future interactivity (chat, lazy loads, signed-URL refresh). *Rule of thumb:* a single endpoint with a two-mode auth guard is tolerable only for a trivial, read-only endpoint whose authorization reduces to the identical single-SIR scope check with no field-visibility, abuse-surface, or side-effect differences; the moment any of those diverge (writes, LLM cost, stripped fields, RLS-vs-service-role enforcement split), split into distinct edges over a shared core.
- **D10 — Artifact bytes served via a token-gated re-mint proxy** (`share/sir/[token]/artifact/[artifactId]/+server.ts`, §8.2), not signed URLs embedded at load. Each click re-validates the token, proves the artifact belongs to that token's SIR + current version, mints a ~120 s signed URL, and 302-redirects. Fixes stale-link UX and keeps Revoke effective for file bytes. *(grill Q7.)*
- **D11 — Versioning is internal-only.** The shared/public view surfaces no `version`/`versioning_label` and no switcher; the customer never sees version. Logged-in version display is admin-only intent (tracked outside this spec). *(grill Q8.)*
- **D12 — Vercel feature flag `sirSharingEnabled` gates the admin button AND the public route load + §8.2 proxy.** Flag-off is a global kill-switch (all links stop resolving instantly); it must gate the load, not merely hide the button. *(grill Q9.)*
- **D13 — Ship Revoke in MVP** (`revoked_at` + a `revokeShare` action + Revoke button) for surgical single-link unshare, alongside Regenerate (supersede) and the D12 global flag. *(grill Q10.)*

## 14. Open questions (for Will)
- **Q6 — Landing/branding of the public page.** Minimal Noetic-branded header only, or a fuller "shared with you by Noetic" framing (logo, one-line context, contact CTA)? Affects the standalone shell (§8) copy only, not the mechanism. *(Only remaining open question; Q1/Q2/Q3/Q4/Q5 from Draft v1 are resolved — see the Revision note and D3/D4/D5/D10/D11/D13.)*
