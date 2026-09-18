# Cartographer — file uploads (drag-and-drop PDFs → Supabase Storage) + noetic-org SSO

**Status:** Draft v1
**Date:** 2026-09-18
**Repos touched:** `cartographer` (auth plumbing, `/files` route, upload endpoints, first real Supabase wiring), `substation` (one migration — `cartographer_files` table + `cartographer-files` bucket)
**Repos NOT touched:** `cityhall` (pattern source only), `bureau`, `conductor`/`conductor2`, `dsd`, `navalbase`
**Prod:** Supabase project **Noetic App** (`mgxqsrjutswbciyrltwd`) · app at `https://cartographer-ruddy.vercel.app`

> Groundwork for a later workflow that extracts and visualizes geometry out of uploaded plats and surveys. This spec covers **getting the bytes in and listing them** — nothing reads the PDFs yet. Explicitly an MVP: shortcuts are taken and named as such in §9.

---

## 1. Problem

Cartographer today renders **hardcoded** SRID:0 shapes. `src/lib/shape-sets.ts` is a literal array of two polygons, and the Playground builds shapes from hand-typed JSON and metes-and-bounds courses. There is no way to get a real document into the app.

The next step toward `VISION.md`'s stated payoff — "go from surveyed **metes and bounds** … and turn them into shapes" — needs source documents in a place a workflow can reach: a recorded plat or boundary survey PDF, stored durably, addressable by a stable key, with a row describing it. The sibling winston spec `workspaces/diligence/sir-geometry/ingesting-supporting-docs-3089/SPEC.md` already proved the extraction methodology by hand on one plat (render at 300 DPI → read corner coordinate boxes with vision → reconstruct rings → validate → transform → upload to `geo`). What it never had was an app-side intake. This is that intake.

### 1.1 Verified current state (cartographer @ `9a13e79`)

- **Supabase has never actually been connected.** `src/lib/server/supabase-admin.ts` exists — a lazy service-role client, explicitly modeled on cityhall's — but there is no `.env.local` in the working tree, and `src/lib/types/database.ts` is a placeholder whose `Database` type has `Tables: Record<string, never>`. Every byte the app renders today is local.
- **No auth of any kind.** No `hooks.server.ts`, no `+layout.server.ts`, no `app.d.ts` `Locals`. The Vercel deployment is world-readable.
- **`@supabase/ssr` ^0.12.0 and `@supabase/supabase-js` ^2.103.0 are already dependencies** (`package.json`) — the SSR auth pattern needs no new packages.
- `.env.example` declares only `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The SSR client needs `PUBLIC_SUPABASE_ANON_KEY` too.
- Left nav is a two-group literal in `src/lib/ui/SideNav.svelte:8` — `Shape Sets` and `Playground` (`:10`).
- `uno.config.ts` has `presetWind4` + typography + web fonts, and **no `presetIcons`** — cityhall's `i-mingcute-*` classes will not resolve if a component is ported verbatim.
- **Build is green**: `bun run build` succeeds in 1.59s on this machine. PR #12's "pre-existing rolldown dev/build breakage" note is stale; it does not block this work.

### 1.2 Verified current state (prod `mgxqsrjutswbciyrltwd`)

- `public.is_noetic_admin(uid)` is a `SECURITY DEFINER` function defined at `substation/supabase/migrations/00000000000000_baseline.sql:118`. It returns true when the user is in the org with `slug = 'noetic'` **and** `om.role IN ('owner','admin')`.
- Membership of the noetic org, queried this session:

  | role | members |
  |---|---|
  | admin | 4 |
  | owner | 2 |

  **Every noetic-org member is already `owner` or `admin`.** So today `is_noetic_admin` and "is a member of the noetic org" are the same set — which is why §2 reuses it rather than adding a function (see Q1).
- Storage buckets on this project are created **in migrations**, via `INSERT INTO storage.buckets (id, name, public, allowed_mime_types) … ON CONFLICT (id) DO NOTHING` (e.g. `20260508120000_research_persistence.sql:149`, baseline `:2096`).
- Latest migration in the substation repo is `20260916000000_runbook_run_events.sql`.

---

## 2. Auth — SSO gated to the noetic org

Mirror cityhall's Supabase SSR auth, minus everything cartographer does not need (no masquerade, no `project_access`, no org switching, no email/password, no magic link).

**D1 — Provider: Google SSO only.** cityhall offers Google and Azure (`cityhall/src/routes/auth/+page.svelte:50-51`); cartographer ships the Google button alone. Both providers are already configured on the Noetic App project, so no provider setup is needed — only a redirect-URL allowlist entry (§6).

**D2 — Three server hooks, in sequence**, in a new `cartographer/src/hooks.server.ts` modeled on `cityhall/src/hooks.server.ts`:

1. `supabase` — builds `event.locals.supabase` with `createServerClient` bound to request cookies, and `event.locals.safeGetSession()` which calls `getSession()` **then** `getUser()` so the JWT is actually validated (a bare `getSession()` trusts an unverified cookie).
2. `authGuard` — if there is no session and the path is not under `/auth`, `redirect(303, '/auth')`. Directly parallels `cityhall/src/hooks.server.ts:98-114`, with a much smaller exempt list: cartographer has no `/share`, `/terms`, `/privacy`, or `/mocks`.
3. `orgGuard` — **new, and the part cityhall has no equivalent of.** With a session in hand, call `supabase.rpc('is_noetic_admin', { uid: user.id })`. On `false`, sign the user out and redirect to `/auth?error=not_authorized`. On RPC error, fail **closed** (redirect), not open — cityhall's masquerade handler fails open on a transient RPC error, but that is a privilege *escalation* check where the safe default is "stay yourself"; here it is the *entry* check, where the safe default is "stay out".

**D3 — The gate is enforced server-side on every request, not in a layout load.** A `+layout.server.ts` guard is bypassable by any endpoint that doesn't inherit it. The hook covers `/api/files/*` (§4) for free, which is the surface that actually writes to prod storage.

**D4 — No `organization_members` row for cartographer.** Access is derived from the existing noetic-org membership. There is no per-user or per-project ACL in cartographer; every noetic member sees every file. Appropriate for an internal tool; called out because it means uploads are effectively shared state (Q3).

**D5 — Vercel deployment protection stays off.** The app-level gate is the boundary. Standard Protection would also gate the `/auth/callback` round-trip and is redundant once D2 lands.

**Routes added:** `/auth` (the sign-in page — logo, one Google button, error display), `/auth/callback` (exchanges `?code` for a session, mirroring `cityhall/src/lib/auth/handleOAuthCallback.ts`), `/auth/signout` (POST, `supabase.auth.signOut()`).

---

## 3. Data model

One table and one bucket, both in a single substation migration `20260918000000_cartographer_files.sql`.

```sql
create table public.cartographer_files (
  id             uuid primary key default gen_random_uuid(),
  file_name      text not null,
  storage_path   text not null,
  thumbnail_path text,
  content_type   text,
  byte_size      bigint,
  page_count     int,
  status         text not null default 'ready',
  metadata       jsonb not null default '{}'::jsonb,
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

alter table public.cartographer_files enable row level security;
-- No policies: every read and write goes through cartographer's server-side
-- service-role client, which bypasses RLS. RLS-on-with-no-policies means a
-- leaked anon key grants nothing.

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('cartographer-files', 'cartographer-files', false, array['application/pdf', 'image/png'])
on conflict (id) do nothing;
```

**D6 — Storage key layout:** `{file_id}/source.pdf` and `{file_id}/thumb.png`. The row UUID is minted by the server at prepare time (§4), so both keys are known before any bytes move. `image/png` is in the MIME allowlist for the thumbnail, not for user uploads.

**D7 — Private bucket, no storage policies.** Reads are served as short-lived signed URLs generated server-side. This matches `site-plan-documents`, which baseline.sql:2105 annotates as "accessed only via service role".

**D8 — `status` + `metadata` exist for the workflow that doesn't exist yet.** `status` starts at `'ready'`; a later extraction step can move it through its own values. `metadata` is where extracted geometry (or a pointer to `geo` rows) lands. Both are cheap now and save a migration later. Nothing in this spec writes anything but the defaults.

**D9 — The migration lives in the substation repo**, not cartographer's, even though substation's code never touches this table. Reason: substation's `supabase/migrations` was reconciled 1:1 against prod's migration ledger on 2026-07-16 (47 versions, backfill PR substation#157), and a migration applied to this project from any other repo puts a remote version in the ledger with no local file — reintroducing exactly that drift. Cartographer gets no `supabase/` directory.

**D10 — Types are hand-written.** `bun run db:types` points at `supabase gen types --local` and there is no local stack; the `cartographer_files` entry goes into `src/lib/types/database.ts` by hand, replacing the `Record<string, never>` placeholder.

---

## 4. Upload flow

Three server calls and two direct-to-storage PUTs, per file:

```
browser                          cartographer server                supabase storage
   │                                     │                                  │
   ├── POST /api/files/prepare ─────────▶│ mint uuid, createSignedUploadUrl │
   │◀── {id, uploadUrl, thumbUploadUrl} ─┤   × 2 (source + thumb)           │
   │                                                                        │
   ├── PUT  uploadUrl  (the PDF bytes) ────────────────────────────────────▶│
   │                                                                        │
   ├── render page 1 → canvas → PNG blob  (PDF.js, in the browser)          │
   ├── PUT  thumbUploadUrl  (the PNG) ─────────────────────────────────────▶│
   │                                     │                                  │
   ├── POST /api/files/commit ──────────▶│ insert cartographer_files row     │
   │◀── {id}  ───────────────────────────┤                                  │
```

**D11 — Bytes never pass through the server.** This is the one piece of cityhall's shape that is load-bearing rather than incidental: Vercel caps a serverless request body at **4.5 MB**, and plan sets run 20–100 MB. cityhall solves it with prepare → signed PUT → commit (`cityhall/src/lib/intake/upload.ts:48-88`); cartographer keeps that shape and drops the substation round-trip, calling `supabaseAdmin.storage.from('cartographer-files').createSignedUploadUrl(key)` directly.

**D12 — Plain `fetch` PUTs, not `uploadToSignedUrl`.** A signed upload URL carries its own token, so the browser needs no Supabase client and no anon key for the upload itself. Same as cityhall.

**D13 — The row is inserted at commit, after the bytes land.** There is no `uploads` staging table (cityhall has one in substation; it exists for classification and multi-file submissions, neither of which applies). A failed or abandoned commit leaves an orphaned object with no row — accepted, and listed in §9.

**D14 — `uploaded_by` comes from `locals.user.id` server-side**, never from the request body.

**Endpoints** (all under the §2 hooks, so all noetic-gated):

| Route | Body | Does |
|---|---|---|
| `POST /api/files/prepare` | `{name, size, contentType}` | Validates PDF + size ceiling, mints the uuid, returns two signed upload URLs |
| `POST /api/files/commit` | `{id, name, size, contentType, pageCount}` | Inserts the row |
| `DELETE /api/files/[id]` | — | Removes both objects, then the row |

**D15 — A size ceiling is enforced at prepare.** 200 MB. Prevents a mis-drop from parking gigabytes in prod storage.

---

## 5. Thumbnails

**D16 — Rendered client-side, at upload time, with PDF.js from cdnjs.** There is no server-side rasterizer available: `pdf-lib` (cityhall's dependency) manipulates PDFs but cannot render them, and `pdfjs-dist` server-side needs a `canvas` polyfill that is not worth it here. The browser already holds the file bytes, so page 1 renders to a `<canvas>` at ~400px wide and `toBlob()` gives the PNG.

cityhall loads PDF.js the same way — `import(/* @vite-ignore */ \`${PDFJS_CDN}/pdf.min.mjs\`)` pinned to **4.9.155** (`cityhall/src/lib/ui/pdf/PdfPageViewer.svelte:26-27,108`). Cartographer has no CSP (no `hooks.server.ts` today, and §2's adds no CSP header), so the CDN import needs no allowlist entry.

**D17 — `page_count` is captured from the same PDF.js handle**, free alongside the thumbnail, and sent to commit.

**D18 — A thumbnail failure is non-fatal.** If PDF.js throws (encrypted PDF, corrupt file), skip the thumb PUT, commit with `thumbnail_path = null`, and render a generic placeholder in the list. The PDF itself is already safely stored by that point.

---

## 6. UI

**Nav:** a third group in `src/lib/ui/SideNav.svelte:8`, after `Playground`, titled **Files** → `/files`. No change to the existing group rendering.

**`/files/+page.server.ts`** — lists `cartographer_files` newest-first and calls `createSignedUrl(thumbnail_path, 3600)` per row.

**`/files/+page.svelte`** — a drop zone above a file list. Each row: thumbnail (or placeholder), file name, page count, size, upload date, delete button.

**D19 — `FileUploadZone.svelte` is ported from cityhall, not imported.** The source is `cityhall/src/lib/ui/upload/FileUploadZone.svelte` — drag/dragover/dragleave handlers plus a hidden `<input type="file">` and click-to-pick. Two changes on the way over: `accept` narrows from cityhall's `.pdf,.zip,.dwg,.xlsx,.docx,.jpg,.png` (`:14`) to `.pdf` only, and the `i-mingcute-*` icon classes become inline SVG, since cartographer's `uno.config.ts` has no `presetIcons` (§1.1).

**D20 — Per-file upload state is tracked in the page.** Each dropped file shows queued → uploading → thumbnailing → done/failed, with the error message inline on the failing file. Multi-file drops upload sequentially (simpler; volumes here are single-digit).

---

## 7. Manual steps (not codeable)

1. **Supabase Auth redirect allowlist** — add `https://cartographer-ruddy.vercel.app/auth/callback` (and `http://localhost:5173/auth/callback` for dev) to the Noetic App project's auth URL configuration. Dashboard-only; the OAuth round-trip fails without it.
2. **Vercel env vars** on the cartographer project: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. **Apply the migration** to prod after the substation PR merges.

---

## 8. PR sequence

| # | Repo | Contents | Depends on |
|---|---|---|---|
| 1 | `substation` | `20260918000000_cartographer_files.sql` — table + bucket | — |
| 2 | `cartographer` | Auth: hooks, `/auth`, `/auth/callback`, `/auth/signout`, `app.d.ts`, `+layout.server.ts`/`+layout.ts`, `.env.example` | — (parallel with 1) |
| 3 | `cartographer` | `database.ts` types, `/api/files/*` endpoints, `src/lib/files/upload.ts` | 1, 2 |
| 4 | `cartographer` | `FileUploadZone.svelte`, `/files` route, nav entry, thumbnail rendering | 3 |

PRs 1 and 2 are independent and can land in either order. Nothing is user-visible until 4.

---

## 9. Deliberately deferred

- **Reading the PDFs.** No extraction, no geometry, no vision. That is the next spec.
- **Orphan reaping** (D13). A storage object whose commit never fired is invisible to the app and stays until someone sweeps.
- **Versioning / replace.** Re-dropping the same file makes a second row. No dedupe, no sha256 pre-check (contrast the `file_upload_jobs` spec, winston#240).
- **Non-PDF uploads.** Images of plats are a plausible near-term want; the schema accommodates them, the MIME allowlist and `accept` do not.
- **ZIPs**, multi-file archives, and any classification.
- **Pagination.** The list loads every row.
- **Progress bars.** A `fetch` PUT gives no progress events without switching to `XMLHttpRequest`; files show a spinner.

---

## 10. Open questions

- **Q1 — Gate on `is_noetic_admin`, or add `is_noetic_member`?** Today they select the same 6 people (§1.2), so reusing the existing RPC costs nothing and adds no SQL. It silently diverges the day someone is added to the noetic org with a non-admin role — they would be locked out of cartographer with a confusing error. Ship the reuse, or add the broader function now?
- **Q2 — Does `authGuard` need a health/ping exemption?** Nothing external calls cartographer today, so no. Worth confirming nothing (uptime check, Vercel probe) expects a 200 on `/`.
- **Q3 — Shared file list, or per-uploader?** D4 makes every file visible to every noetic member. That is almost certainly right for an internal tool, but `uploaded_by` is recorded so it could be filtered later.
- **Q4 — Is 200 MB (D15) the right ceiling?** Largest real plan set seen in the pipeline would calibrate this; 200 MB is a guess with headroom.
- **Q5 — Should `/files` be the app's landing route** once it has real content, displacing the hardcoded shape set at `/`?
- **Q6 — Does the extraction workflow read from this table, or from a job table that references it?** D8 assumes the former (status + metadata on the row). If extraction becomes multi-run or multi-attempt, a `cartographer_extraction_run` table is the better shape — decidable later, no schema commitment here.
