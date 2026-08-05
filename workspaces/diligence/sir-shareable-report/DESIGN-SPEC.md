# Shareable Site Intelligence Reports — time-bound, no-login public view (cityhall + substation)

**Status:** Draft v1
**Date:** 2026-08-05
**Type:** Implementable spec. This is the **anonymous-delivery** slice of the north-star `../sir-product-experience/DESIGN-SPEC.md` (winston#192) **Surface B1 — "Secure delivery: time-limited obscurity URL (default, no login)"** (§8/§3.2, and the "Delivery" domain object at §5:163). It builds directly on the already-shipped read path `../sir-product-viewing/DESIGN-SPEC.md` — that spec put the logged-in SIR detail view at `project/[projectId]/sir/[sirId]`; **this spec makes that same view reachable without an account** via a random, expiring URL that a Noetic admin generates and copies.
**Repos touched:** `cityhall` (new public share route outside `(app)`; one `authGuard` allowlist edit; extract the SIR render into a shared component; new `+page.server.ts` on the logged-in SIR route for the generate/regenerate action + admin button). `substation` (ONE additive migration — a `sir_share_link` table, RLS-locked to service-role; **no** anon policy, **no** storage policy). The migration is *specified here, applied separately* (operator-gated), matching #203/#viewing discipline.
**Repos NOT touched:** `conductor`, `bureau`, `quarry`, `navalbase`, `radar`, `field-agent`, `claude-plugins`, `surveyor`.

> **One-line goal:** A Noetic admin viewing a delivered SIR sees a **"Generate / Regenerate shareable URL"** button (Noetic-org only) that mints a random, time-bound URL and copies it to the clipboard. Pasting that URL into any browser — no login, no account — resolves to the **exact same SIR report view** the admin sees, until the link expires.

> **Revision note (2026-08-05, same PR):** Added **§8.1 Token-scoped API surface** — how any client-initiated call from the no-login page (future AI chat, lazy loads, signed-URL refresh) authenticates via the share token as a bearer credential against distinct, minimal, token-gated endpoints that share core data logic with the session endpoints but never reuse their session auth (**D9 new**). Added **`Referrer-Policy: no-referrer`** hardening to §6. Both surfaced by review of how the public page talks to the backend.

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
| An active link exists | UI shows **"Shareable link active · expires \<date>"** with two actions: **Copy** (re-copies the existing URL) and **Regenerate** (supersedes the old token, mints a new one, copies it). |
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
  +page.svelte  {#if data.isNoeticAdmin}           │
  [ Generate / Regenerate ] ──POST action──┐       │  (outside (app);
                                           │       │   /share allowlisted
  +page.server.ts (action)                 │       │   in authGuard)
   1. is_noetic_admin RPC gate ◀───────────┘       ▼
   2. supabaseAdmin: supersede old row,    +page.server.ts  (SERVER-ONLY, service role)
      insert sir_share_link { token,        1. supabaseAdmin.from('sir_share_link')
        sir_id, expires_at }                    .eq('token', params.token)  ── validate:
   3. return absolute URL                        exists? not superseded/revoked? not expired?
        │                                    2. supabaseAdmin.from('site_intelligence_report')
        ▼                                        .eq('id', row.site_intelligence_report_id)
   navigator.clipboard.writeText(url)        3. supabaseAdmin.from('sir_artifact')
                                                 .eq('version', sir.current_version)
                                             4. supabaseAdmin.storage.from('sir-artifacts')
   ┌───────────────────────────────────┐        .createSignedUrl(path, 3600)  ← bypasses
   │  <SirReportView {sir} {artifacts}/>│  ◀──    storage RLS (service role); NO storage policy
   │  shared component (§9)             │        5. return { sir, artifacts }
   └───────────────────────────────────┘              │
        ▲                                              ▼
   logged-in wrapper                          public wrapper (standalone shell,
   ((app) chrome + admin button)               noindex, "expired" branch)
                                                       │
                                              <SirReportView {sir} {artifacts}/>  ← SAME UI
```

**Load-bearing choice: service-role server route, not anon RLS** (§2.5). The token is validated in `+page.server.ts` code holding the service-role key; data + signed URLs are read service-role. This matches `download_tokens`/`upload_token`, keeps RLS closed (no first-ever anon policy), and needs no `sir-artifacts` storage policy. The alternative — opening `site_intelligence_report`, `sir_artifact`, **and** a new `sir-artifacts` `storage.objects` policy to `anon`, gated on a token RLS can't actually see in the URL — is both more surface and unprecedented; rejected (D2, Q2).

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
  revoked_at                  timestamptz,             -- set by an explicit Revoke (Q4)
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
- **At-rest form (D3, recommended: store the token verbatim).** Store the token as-is (as `download_tokens` does), keyed by unique index. This enables **Copy-without-regenerate** (§3.1) and matches house style. *Hardening alternative (Q3):* store only `sha256(token)` and reconstruct the URL solely at mint time — defends against a DB/log leak, at the cost of the "Copy existing" affordance (every share becomes a regenerate). Given the link is already low-assurance and short-lived, verbatim storage is the recommended default; the hash option is offered for Will.
- **Expiry (enforced server-side, every load).** Default lifetime **`SIR_SHARE_TTL_DAYS = 30`** (within Jason's "~1–2 months", on the safer end — Q1 to confirm 30 vs 60). `expires_at = now() + interval`. The public load rejects `expires_at <= now()` regardless of what the generator wrote — no client-trusted expiry.
- **Rotation / revocation.** Regenerate supersedes the prior token immediately (old URL → "expired" page). A `revoked_at` column + explicit **Revoke** action kills a link without minting a replacement (Q4 — column shipped now, button optional in MVP). One live link per SIR (partial unique index, §5).
- **Scope minimization.** A token grants read of **exactly one SIR's current-version artifacts + its public metadata** (title, description, address, coordinates, parcel ids) — nothing else. No project, no sibling SIRs, no submissions, no other versions. The public load never queries by `project_id`; it pivots strictly `token → site_intelligence_report_id`.
- **No internal-data leak.** `sir_artifact` holds only client-facing kinds (§2.4); internal manifests/telemetry are not in that table, so "share the whole current version" cannot expose them. The shared render component (§9) shows only what `{ sir, artifacts }` carries.
- **Signed-URL TTL is independent and short.** Storage URLs are minted **per page load** at **3600s** (app convention). They outlive a page view but not the share link, and are re-minted on refresh — so link expiry, not the signed URL, is the real boundary.
- **Crawler hygiene.** The public route emits `<meta name="robots" content="noindex,nofollow">` and an `X-Robots-Tag: noindex` header. The URL is unguessable regardless, but this prevents accidental indexing if a recipient's tooling leaks the URL into a crawlable surface.
- **Referrer suppression.** The public route sets `Referrer-Policy: no-referrer` so the token-bearing URL is never leaked in the `Referer` header when the browser fetches artifact bytes from Supabase Storage (or any off-origin resource). Combined with carrying the token in a header/body rather than a query string on any future POST (§8.1), this keeps the token out of third-party and proxy logs.
- **Non-confirmation on failure.** Malformed/unknown token → **404** (never "wrong token"); expired/superseded/revoked → a friendly **"expired"** page (reveals only that a link once existed — acceptable, D5). Neither path discloses the SIR's existence to a random guesser.
- **Observability.** Each successful resolve bumps `access_count` + `last_accessed_at` (service-role update) — cheap abuse/interest signal, and the hook for a future "who's viewed this" admin readout. No PII on the recipient is collected in MVP.

---

## 7. Admin experience — generate/regenerate + clipboard (cityhall)

**New `sir/[sirId]/+page.server.ts`** (the route currently has only the universal `+page.ts`; adding a server load + actions is additive):

- **`load`** (service-role, but only surfaces data to Noetic admins): if `locals` resolves a Noetic admin (reuse the `is_noetic_admin` RPC gate), `supabaseAdmin.from('sir_share_link').select('token, expires_at, created_at').eq('site_intelligence_report_id', sirId).is('superseded_at', null).is('revoked_at', null).gt('expires_at', 'now()')` → return `shareLink` (the live one, or null). Non-admins get `shareLink: undefined`. This feeds the button's state (§3.1).
- **`actions.generateShare`** — (1) gate with the `is_noetic_admin` RPC (precedent `masquerade/+page.server.ts:22-24`), `error(403)` otherwise; (2) `supabaseAdmin` supersede any live row for this SIR, insert a new row `{ token: randomToken(), site_intelligence_report_id, created_by: user.id, expires_at: now()+TTL }`; (3) return `{ url: `${origin}/share/sir/${token}`, expiresAt }`. Handles both first-generate and regenerate (they're the same mint; the label differs client-side on whether a live link already existed).

**`sir/[sirId]/+page.svelte`** — add, inside `{#if data.isNoeticAdmin}`, a small control block:
- No live link → **"Generate shareable URL"** button.
- Live link → **"Shareable link active · expires \<date>"** + **Copy** (re-copies `data.shareLink` URL) + **Regenerate** buttons.
- On a successful `generateShare` (via `use:enhance`), `await navigator.clipboard.writeText(result.url)` (idiom from `StandardNoteDiff.svelte:49`) and flash "Copied!". The button block sits above the shared `<SirReportView>` (§9); the report body itself is unchanged.

---

## 8. Recipient experience — the public route (cityhall)

**New route outside `(app)`:** `cityhall/src/routes/share/sir/[token]/{+page.server.ts,+page.svelte}`. `+page.server.ts` (server-only ⇒ the service-role key never reaches the client):

```ts
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';

export const load = async ({ params, setHeaders }) => {
  setHeaders({ 'X-Robots-Tag': 'noindex, nofollow' });

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

  const { data: artifacts } = await supabaseAdmin
    .from('sir_artifact')
    .select('id, kind, format, file_name, mime_type, byte_size, storage_path, version')
    .eq('site_intelligence_report_id', sir.id)
    .eq('version', sir.current_version)
    .order('kind').order('file_name');

  const signed = await Promise.all((artifacts ?? []).map((a) =>          // service role ⇒ bypasses storage RLS
    supabaseAdmin.storage.from('sir-artifacts').createSignedUrl(a.storage_path, 3600)
      .then((r) => ({ ...a, signedUrl: r.data?.signedUrl ?? null }))));

  await supabaseAdmin.from('sir_share_link')                             // observability (§6), non-blocking
    .update({ access_count: link.access_count + 1, last_accessed_at: new Date().toISOString() })
    .eq('token', params.token);

  return { expired: false, sir, artifacts: signed };
};
```

**`+page.svelte`** — a **standalone shell** (a slim Noetic-branded header, no `(app)` nav/sidebar, no admin button): if `data.expired` render the "This link has expired — contact Noetic" panel; else render `<SirReportView sir={data.sir} artifacts={data.artifacts} />` (§9). Because this route is outside `(app)` and reads only from `+page.server.ts`, it inherits none of the logged-in chrome.

**`authGuard` edit** (`hooks.server.ts:101-108`): add `!event.url.pathname.startsWith('/share')` to the anonymous allowlist alongside `/auth`, `/terms`, `/privacy`, `/mocks`. That single line is the whole "let anonymous users reach it" change.

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

---

## 9. Shared render component — `SirReportView.svelte`

To guarantee the recipient sees the **exact** logged-in UI (and to avoid two drifting copies), extract the report body of `sir/[sirId]/+page.svelte` into `cityhall/src/lib/.../SirReportView.svelte` taking props `{ sir, artifacts }`. It owns the header, the report/appendix/supporting-document cards, the `PdfPageViewer` inline preview, `downloadHref()`, and the null-URL fallback — i.e. everything that today reads only `data.sir`/`data.artifacts` (§2.1), which is all of it. Then:
- **Logged-in route** (`sir/[sirId]/+page.svelte`): `(app)` chrome + `{#if data.isNoeticAdmin}` share button + `<SirReportView {sir} {artifacts} />`.
- **Public route** (`share/sir/[token]/+page.svelte`): standalone shell + `<SirReportView {sir} {artifacts} />`.

One component ⇒ pixel-parity by construction; future report-view changes land in both places automatically.

---

## 10. Implementation surface

**cityhall**
| Change | File | Nature |
|---|---|---|
| Allowlist `/share` for anonymous | `src/hooks.server.ts:101-108` | one `startsWith` clause |
| Extract shared report view | `src/lib/.../SirReportView.svelte` (new) ← move body out of `sir/[sirId]/+page.svelte` | refactor, no behavior change |
| Public share route | `src/routes/share/sir/[token]/{+page.server.ts,+page.svelte}` (new) | service-role load + standalone shell (§8) |
| Admin generate/regenerate | `src/routes/(app)/project/[projectId]/sir/[sirId]/+page.server.ts` (new) | server load (`shareLink` state) + `generateShare` action, `is_noetic_admin`-gated (§7) |
| Admin button + clipboard | `sir/[sirId]/+page.svelte` | `{#if data.isNoeticAdmin}` block; `navigator.clipboard.writeText` |
| Regenerated DB types | `src/lib/types/database.ts` | add `sir_share_link` (post-migration) |

**substation**
| Change | File | Nature |
|---|---|---|
| `sir_share_link` table (RLS-locked, service-role only) | `supabase/migrations/<ts>_sir_share_link.sql` (new) | additive; **applied separately, substation-first** (§5) |

No new npm deps. Reuses: `supabaseAdmin` (`review/[reviewId]` precedent), the `is_noetic_admin` RPC gate (`masquerade`), `data.isNoeticAdmin` conditional render (`data/+page.svelte`), the `createSignedUrl` idiom, `navigator.clipboard.writeText` (`StandardNoteDiff`), and the whole `sir/[sirId]` render (moved, not rewritten).

---

## 11. Edge cases
- **SIR re-published between mint and view** (`current_version` advances, #203 §7) → the public load reads `sir.current_version` live, so the recipient always sees the **current** version. (Freezing a share to the version it was minted at is Q5.)
- **SIR deleted after minting** (`ON DELETE CASCADE` drops artifacts **and** the share-link row) → token no longer resolves → 404. No dangling links.
- **Zero-artifact current version** (partial publish window) → the public page renders the header with an empty artifact list / "No files published yet", never an error (mirrors the logged-in empty state).
- **Multiple mint clicks / races** → the partial unique index (`one live per SIR`) + supersede-then-insert keeps exactly one live link; a lost race supersedes and re-inserts idempotently.
- **Clock skew on expiry** → expiry is evaluated in Postgres (`now()`) on read, single source of truth.
- **`latitude`/`longitude`/`parcel_ids` null** → header omits them (they're already nullable in the logged-in view).
- **Signed URL expires while the tab is open** → same behavior as the logged-in view today (refresh re-mints); unchanged.

## 12. Non-goals (explicitly deferred)
- **No client accounts / "log in to see history"** (#192 §5's "then require an account for history") — that's the authenticated-delivery half; this spec is the no-login half only.
- **No report chat, findings layer, staff-review threads, internal-evidence toggle, map viewer** (#192 Surfaces B2/C/D/E).
- **No report web *rendering* changes** — we share the existing `sir/[sirId]` view as-is (inline PDF + cards). The rich `pages.tsx`→HTML infinite-scroll viewer (#192 B1/Q5) is a separate spec; if/when it lands, the shared component (§9) carries it into the share route for free.
- **No per-recipient links / analytics dashboard** — one live link per SIR, a single `access_count`. Per-recipient tokens are a future extension the table shape allows.
- **No anon RLS / no `sir-artifacts` storage policy** — deliberately avoided (§4, D2).
- **No version-freezing of a share** (Q5) — MVP always shows current version.
- **No email delivery of the link** — the admin copies + sends it themselves (the "your report is ready" email is #192 B1, separate).

## 13. Decisions
- **D1 — Public route is a cityhall SvelteKit route outside `(app)`, allowlisted in `authGuard`.** Precedent: `/terms`, `/privacy`. URL shape `/share/sir/<token>` (namespaced for future `/share/<type>/<token>`).
- **D2 — Anonymous access is served by a service-role server route, not anon RLS.** Validate token+expiry in `+page.server.ts` (service-role key), read data + sign URLs service-role. Matches `download_tokens`/`upload_token`; keeps RLS closed; **no `sir-artifacts` storage policy needed** (service-role signing bypasses storage RLS). The anon-RLS alternative (first-ever anon policy + anon storage policy) is rejected.
- **D3 — Store the token verbatim** (as `download_tokens` does) to enable Copy-without-regenerate; hashing at rest is the offered hardening (Q3).
- **D4 — 256-bit CSPRNG token, base64url.** Expiry enforced server-side on every load; default `SIR_SHARE_TTL_DAYS = 30`.
- **D5 — Failure disclosure:** unknown/malformed token → 404; expired/superseded/revoked → friendly "expired" page. One live link per SIR (partial unique index); Regenerate supersedes.
- **D6 — Exact-UI parity via a shared `SirReportView` component** consumed by both the logged-in and public routes.
- **D7 — The `sir_share_link` migration is specified here, applied separately (operator-gated), substation-first**, then the cityhall PR.
- **D8 — Recipient always sees `current_version`** (live read), not a frozen snapshot (revisit Q5).
- **D9 — Client-initiated public calls use the share token as a bearer credential against distinct, minimal, token-gated endpoints that *share core data logic* with the session endpoints but never reuse their session auth** (§8.1). Authenticate/authorize **at the edge**, per mode (session→RLS vs token→service-role scoped to one SIR); **compute in a shared internal function.** The browser never calls substation directly — cityhall validates the token and calls downstream with its own service credentials. MVP needs no such endpoint; the pattern is fixed now for future interactivity (chat, lazy loads, signed-URL refresh). *Rule of thumb:* a single endpoint with a two-mode auth guard is tolerable only for a trivial, read-only endpoint whose authorization reduces to the identical single-SIR scope check with no field-visibility, abuse-surface, or side-effect differences; the moment any of those diverge (writes, LLM cost, stripped fields, RLS-vs-service-role enforcement split), split into distinct edges over a shared core.

## 14. Open questions (for Will)
- **Q1 — Link lifetime.** Default committed at **30 days** (D4). Jason floated "~1–2 months." Confirm 30, or prefer 60? (Trivially a constant.)
- **Q2 — Confirm service-role route over anon RLS** (D2). Recommended and lower-risk; flag only if you'd rather open anon RLS + an anon `sir-artifacts` storage policy (more surface, first-ever anon policy in the schema).
- **Q3 — Token at rest: verbatim (D3, recommended) vs `sha256` hash.** Hashing defends a DB/log leak but removes "Copy the existing link" (every share becomes a regenerate). Given the link is already low-assurance + short-lived, verbatim is the default — OK?
- **Q4 — Explicit Revoke UI in MVP?** The `revoked_at` column ships now; the question is whether the admin needs a "Revoke (kill without replacing)" button in v1, or whether Regenerate-only suffices.
- **Q5 — Version-freeze a share?** MVP shows current version (D8); if a link is shared and then the SIR is re-published, the recipient sees the new version. Acceptable, or should a share pin the version it was minted against?
- **Q6 — Landing/branding of the public page.** Minimal Noetic-branded header only, or a fuller "shared with you by Noetic" framing (logo, one-line context, contact CTA)? Affects the standalone shell (§8) copy only, not the mechanism.
