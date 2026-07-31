# SIR Viewing — dashboard SIR widget + file detail view (cityhall)

**Status:** Draft v2
**Date:** 2026-07-31
**Type:** Implementable spec. This is the **read/view companion** to the publish-side spec `../sir-product-uploading/DESIGN-SPEC.md` (winston#203) — #203 writes `site_intelligence_report` + `sir_artifact` rows and uploads bytes to the private `sir-artifacts` bucket; this spec surfaces them in the app. It is the near-term, document-grade slice of the north-star `../sir-product-experience/DESIGN-SPEC.md` (winston#192) **Surface B1 "Document-grade delivery"** (§8, P1) — narrowed to: *promote the project dashboard to core, and show a SIR-artifact widget + per-file detail view that opens files in a new tab.* It deliberately does **not** build the web report viewer, report chat, findings layer, or map viewer (those are later #192 surfaces — see §11 non-goals).
**Repos touched:** `cityhall` (dashboard flag-gating change; new SIR dashboard widget; new SIR detail route; signed-URL wiring). `substation` (ONE additive RLS migration — a `storage.objects` SELECT policy for the `sir-artifacts` bucket; see §7/§9). The migration is *specified here, applied separately* (operator-gated), matching #203's migration-first pattern.
**Repos NOT touched:** `conductor`, `bureau`, `quarry`, `navalbase`, `radar`, `field-agent`, `claude-plugins`, `surveyor`.

> **One-line goal:** Entering a project shows the project dashboard (no longer flag-gated). The `feasibility-intake` flag drops down to gate only the feasibility-research widget *within* the dashboard. A new **SIR widget** appears whenever a `site_intelligence_report` exists for the project, showing its title + description; clicking through opens a detail view with **one card per `sir_artifact` file**, and clicking a card opens that private file in a new browser tab via a signed URL.

> **Revision note (Draft v2, 2026-07-31 — folds in the Round-1 adversarial audit, verdict "implementable, risk LOW"; audit confirmed zero non-established UI patterns).** Every audit concern is now resolved *decisively in-spec* rather than parked as an open question:
> - **C1 (widget DOM):** committed. The widget is **always a list-of-entries card** (one `<a>` row per `site_intelligence_report`); the 1-SIR case is the single-row degenerate form. Exact markup for both cases is written out in §5. The v1 phrase "the whole card is a link" is corrected.
> - **C2 (grid placement):** committed. The SIR widget renders as a **full-width block above the two-track grid, outside the grid entirely** — so the live `grid-cols-1 {feasibilityIntakeEnabled ? 'md:grid-cols-2' : ''}` conditional is **untouched** and no third-card column math exists in any of the four (flag × SIR) states. §5.
> - **C3 (load location):** committed to `+layout.ts`. The detail `+page.ts` now reads its SIR from `await parent()` instead of re-querying — the reuse benefit is real, not illusory. §6.
> - **C4 (project-membership guard):** resolved structurally — because the parent list is `.eq('project_id', projectId)`, a `sirs.find(id === sirId)` miss → `error(404)` *is* the cross-project guard; no separate check needed. §6/§8.
> - **C5 (card-shell cite):** corrected — the widget header mirrors the **site-plan review** card (`flex items-center gap-2 mb-4`, no button), which is exact; the feasibility card differs only because it carries a "New" button (`justify-between`). §5.
> - Former open questions Q2/Q5/Q6/Q7/Q8 are now **decided** (D3/D5/D6/D8/D9) and removed from §13; only genuinely product-level questions remain (Q1, Q3, Q4).

---

## 1. Problem

Two problems, one refactor.

**(a) The project dashboard is gated behind a flag it has outgrown.** Today, entering a project either shows a dashboard **or** redirects straight into the first submission, decided by the `feasibility-intake` flag:

- `cityhall/src/routes/(app)/project/[projectId]/+page.ts:4-30` — flag ON → render the dashboard; flag OFF → `redirect(302, .../submission/{firstSubmission.id})` (legacy behavior: jump into the first submission, which for a site-plan project is the site-plan review view).
- The same flag *also* gates the feasibility-research card inside the dashboard: `+page.svelte:129` (`{#if data.feasibilityIntakeEnabled}`), and the `beginFeasibility` form action: `+page.server.ts:34` (`if (!(await feasibilityIntakeEnabled())) error(403, ...)`).

So one flag currently means two things: "does the dashboard exist at all" **and** "is the feasibility widget on it." We want the dashboard to be **core** (always shown), with the flag governing only the feasibility widget.

**(b) SIRs exist in the database but are invisible in the app.** The publish side (winston#203) writes real data: `site_intelligence_report` + `sir_artifact` rows and files in the private `sir-artifacts` bucket. Verified against prod `mgxqsrjutswbciyrltwd` this session there is already **1 published SIR** (a Louisville car-wash SIR, `73329e87-…`, `current_version=0`, 10 artifacts: report pdf+docx and 8 supporting-document PDFs). But `site_intelligence_report`/`sir_artifact` appear in cityhall **only in generated types** (`src/lib/types/database.ts:2213-2314`) — no route, component, or query reads them. There is no way to see a delivered SIR in the app. This spec is the read path.

> **Naming caution (do not conflate).** cityhall already has an unrelated "SIR" — the surveyor-produced **Property Data / Site Facts** page (`project/[projectId]/data/`, backed by the `project_facts` table, served via `data/sir-pdf/+server.ts` → substation `/api/projects/:projectId/sir/pdf`, CSS classes `sir-*`). **That is not this.** This spec is exclusively about the diligence `site_intelligence_report` / `sir_artifact` tables and the `sir-artifacts` bucket. The new route (§6) is deliberately namespaced to avoid collision with the existing `data/sir-pdf` endpoint.

---

## 2. Verified current state (prod `mgxqsrjutswbciyrltwd` + cityhall @ `main`, 2026-07-31)

### 2.1 Data model — the real schema (bind the UI to this, verbatim)

`public.site_intelligence_report`:

| column | type | null | default | notes |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `project_id` | uuid | NO | — | **FK → `project(id)`** — the project↔SIR link |
| `title` | text | YES | — | **shown on the widget** |
| `description` | text | YES | — | **shown on the widget** |
| `address` | text | YES | — | |
| `latitude` | double precision | YES | — | |
| `longitude` | double precision | YES | — | |
| `parcel_ids` | text[] | YES | — | |
| `current_version` | integer | NO | `0` | **the live version the UI shows (§8)** |
| `created_by` | uuid | YES | — | FK → `auth.users(id)` |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

`public.sir_artifact`:

| column | type | null | default | notes |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `site_intelligence_report_id` | uuid | NO | — | **FK → `site_intelligence_report(id)` ON DELETE CASCADE** |
| `version` | integer | NO | — | which SIR version this file belongs to |
| `versioning_label` | text | YES | — | 1–2-sentence change note on v≥1 (#203 §7) |
| `kind` | text | NO | — | **CHECK ∈ {`report`,`research_appendix`,`supporting_document`}** |
| `format` | text | NO | — | free-text after #203 §9 (`pdf`,`docx`, else ext) |
| `storage_bucket` | text | NO | `'sir-artifacts'` | |
| `storage_path` | text | NO | — | **the object key to sign (§7)** |
| `file_name` | text | YES | — | original basename — **card label** |
| `mime_type` | text | YES | — | drives new-tab render vs download (§7) |
| `byte_size` | bigint | YES | — | card metadata |
| `created_at` / `updated_at` | timestamptz | NO | `now()` | |

- **Uniqueness:** `UNIQUE (site_intelligence_report_id, version, kind, format, file_name)`.
- **Versions live on the artifact row** (`version`), gated by the parent's `current_version`. Re-publish (#203 §7) inserts a new artifact set at `version = current_version+1` and advances `current_version`; **prior versions' rows stay in the table**. → the UI must filter by version (§8), or it will show every version's files at once.
- **"N SIRs per project" is allowed** (#203 D14) — the FK is many-SIR-to-one-project. The widget must handle a project with >1 `site_intelligence_report` row (§8, Q2).

**Real data shape** (the one live SIR, `73329e87-…`, all `version=0`, `versioning_label=null`):

| kind | format | file_name | mime_type | bytes |
|---|---|---|---|---|
| report | docx | louisville-ky-carwash-site-intelligence-report.docx | …wordprocessingml.document | 7.8 MB |
| report | pdf | louisville-ky-carwash-site-intelligence-report.pdf | application/pdf | 13.3 MB |
| supporting_document | pdf | ccr-reciprocal-easements-2024163213.pdf | application/pdf | 1.8 MB |
| supporting_document | pdf | deed-2024065448.pdf | application/pdf | 138 KB |
| … | pdf | (6 more supporting PDFs: deeds, plat, easements, stormwater agmt) | application/pdf | — |

Storage path convention (from #203 §6, confirmed on the live rows): `sir/<site_intelligence_report_id>/v<version>/<file_name>` in bucket `sir-artifacts` — e.g. `sir/73329e87-…/v0/louisville-ky-carwash-site-intelligence-report.pdf`.

### 2.2 RLS (already correct on the tables; a gap in storage — §2.3)

From `pg_policies` this session:

- `site_intelligence_report` — SELECT to `authenticated` gated by **`user_can_see_project(project_id, auth.uid())`**. (INSERT/UPDATE gated by `get_user_project_access_level ∈ {write,admin}`; DELETE by `= admin`.)
- `sir_artifact` — SELECT to `authenticated` gated by `EXISTS(… site_intelligence_report sir WHERE sir.id = sir_artifact.site_intelligence_report_id AND user_can_see_project(sir.project_id, auth.uid()))`.
- `user_can_see_project` short-circuits `true` for `is_noetic_admin(auth.uid())` (per #203 §2 / substation `rls_helpers.sql`). → **every Noetic admin sees every SIR; a client sees only SIRs on projects they have `project_access` to.** This is exactly the entitlement model the north-star (#192 §5) calls for. **No table-RLS change is needed.**

### 2.3 The storage gap — there is NO `storage.objects` policy for `sir-artifacts`

The `sir-artifacts` bucket is **private** (`storage.buckets.public = false`, verified). Signing a private-bucket object with the **user's** Supabase client (`locals.supabase`) requires a matching `storage.objects` **SELECT** RLS policy — that is how the existing document viewer works against `submission-data` (policy `submission-data: select with read access`, keyed on `is_noetic_admin` OR `project_access`).

**There is no such policy for `sir-artifacts`.** The full `storage.objects` policy list this session covers `submission-data`, `workflow-runs`, `inspector-general`, `research-data`, `crc-guides`, `site-plan-documents` — **`sir-artifacts` is absent.** → a user-client `createSignedUrl('sir-artifacts', …)` will be **denied** today. This is the load-bearing decision in §7/§9: add the policy (recommended) or serve via a service-role proxy.

### 2.4 cityhall stack, routing, and the dashboard as built

- **Stack:** SvelteKit 2 / Svelte 5 runes, TypeScript, UnoCSS (`i-mingcute:*` icons), Vercel adapter, bun. Flags via `@flags-sdk/vercel` + `flags/sveltekit`.
- **Routing:** file-based under the `(app)` group. Project entry = `src/routes/(app)/project/[projectId]/` with `+layout.ts` (loads `project` + `submission`+`submission_version` + intake-conversation map, `+layout.ts:118-124,186-201`), `+page.ts` (the flag branch, §1a), `+page.server.ts` (flag fetch + form actions), `+page.svelte` (the dashboard).
- **Dashboard composition** (`+page.svelte`): `<Constrained page>` + `<PageHeading>`, then a responsive grid: `class="grid grid-cols-1 {data.feasibilityIntakeEnabled ? 'md:grid-cols-2' : ''} gap-4 items-start"` (`+page.svelte:120`). Two inline "track" cards, each a `<div class="border border-gray-200 rounded-xl p-5">` with a header row `<div class="flex items-center gap-2 mb-4">` + `i-mingcute:*` icon + label:
  1. **Feasibility research** (`:129-206`), gated `{#if data.feasibilityIntakeEnabled}` — this is the widget the flag will now exclusively gate.
  2. **Site plan review** (`:209-295`), always shown.
- **Flag definitions** live in `src/lib/flags.ts` via a `defineFlag()` helper (`:82-98`); `feasibility-intake` is `feasibilityIntakeEnabled` (`:136-144`, `defaultValue: true`). Reading a flag = `await feasibilityIntakeEnabled()`.

### 2.5 The two established private-file-serving patterns

- **Pattern A — sign in a `load`, hand URL to an `<a target="_blank">`.** `document/[documentId]/+page.ts:62-72`: `locals.supabase.storage.from(SUBMISSION_BUCKET).createSignedUrl(path, 3600)` → `{ data: { signedUrl } }` → rendered as a link. This is the cleanest "open a private file in a new tab" reference. (Also `plan-set/+page.ts:132-170` batch `createSignedUrls`.) Force-download variant appends a `download` query param (`DiligenceRunStatus.svelte:13-17`).
- **Pattern B — a `+server.ts` GET endpoint that streams/redirects.** `review/[reviewId]/source-pdf/+server.ts` and `data/sir-pdf/+server.ts`: auth-check `locals.user`, `getAccessToken(locals)`, fetch **substation**, then either stream bytes (`Content-Type`/`Content-Disposition: inline`) or re-throw substation's `302` to a signed URL. Pattern B currently always proxies **substation**, because those files live in substation-owned buckets. SIR files are in `sir-artifacts` and are directly reachable from cityhall's Supabase client — so Pattern A is the natural fit **iff** the §2.3 storage policy exists.

---

## 3. Desired behavior (current → desired)

| Aspect | Today | Desired |
|---|---|---|
| Entering a project | Flag ON → dashboard; flag OFF → 302 into first submission | **Always → dashboard** (dashboard is core) |
| `feasibility-intake` flag semantics | Gates *whole dashboard* **and** feasibility widget **and** `beginFeasibility` action | Gates **only** the feasibility-research widget + `beginFeasibility` action |
| SIR visibility | None (tables unread by UI) | **SIR widget** on the dashboard when a `site_intelligence_report` exists |
| Seeing SIR files | None | **SIR detail view**: one card per `sir_artifact`; click → file opens in a new tab |

---

## 4. Flag-semantics refactor (the core change)

**Three edits, all in the project route:**

1. **`+page.ts` — drop the flag branch; always render the dashboard.** Remove the `redirect(302, …/submission/…)` path. The `load` becomes: always return the dashboard data (`{ ...data, submissionSwitcher: undefined }`). The dashboard already renders correctly for a project that has only site-plan submissions (the "Site plan review" track is unconditional, `+page.svelte:209`), so no user loses access to site-plan review — they just land on the dashboard first. **(Decision D1; the "should the legacy redirect survive for pure site-plan projects?" nuance is Q3.)**
2. **`+page.svelte` — keep `{#if data.feasibilityIntakeEnabled}` on the feasibility card only** (`:129`). Unchanged — this is now the *sole* meaning of the flag on the dashboard.
3. **`+page.server.ts` — unchanged.** It still `await feasibilityIntakeEnabled()` (the widget needs it) and still guards `beginFeasibility` with the 403 (`:34`). The flag stays defined in `flags.ts` verbatim; only its *scope of effect* narrows. Update its `description` string (`flags.ts:136-144`) to reflect "gates the feasibility widget within the dashboard" rather than "the project page redirects into the first submission."

No flag rename (keeps targeting rules + history intact). No new flag.

---

## 5. The SIR dashboard widget

**Placement (D8 — committed).** The SIR widget is **its own full-width card, rendered above the two-track grid** (between `<PageHeading>` and the `<div class="grid …">` at `+page.svelte:120`), **outside the grid**. Consequences:

- The live grid conditional `grid-cols-1 {data.feasibilityIntakeEnabled ? 'md:grid-cols-2' : ''}` (`+page.svelte:120-124`) is **not touched** — there is no third grid child, so the column math is identical in all four states (feasibility on/off × SIR present/absent). This sidesteps the audit's C2: with feasibility OFF the grid stays `grid-cols-1`, and the SIR card, living above the grid, is full-width regardless.
- The SIR is the headline deliverable; surfacing it above the two *process* tracks (feasibility research / site-plan review) reads correctly.

**Card shell (C5 — exact).** Mirror the **site-plan review** card, whose header has no button: outer `<div class="border border-gray-200 rounded-xl p-5 mb-4">` (add `mb-4` for spacing above the grid), header `<div class="flex items-center gap-2 mb-4">` + an `i-mingcute:file-search-line text-lg text-purple-700` icon + `<span class="text-[15px] font-medium text-gray-900">Site Intelligence Report</span>`. (The *feasibility* card header is `flex items-center justify-between mb-4` because it wraps a right-aligned "New" button — not our case, so we mirror the site-plan header, `+page.svelte:210`.)

**Visibility.** Rendered **only when ≥1 `site_intelligence_report` row exists** for `projectId` (`{#if data.sirs?.length}`). Zero SIRs → widget entirely absent (no empty placeholder) — matching how the feasibility widget simply isn't there when disabled. (Edge cases §8.)

**Structure (D8 — committed): always a list-of-entries card, one `<a>` row per SIR.** N-SIRs-per-project is allowed (§2.1, #203 D14), so the widget is uniformly a list; the common 1-SIR case is just a single-row list (there is no separate "single whole-card link" variant — this corrects the v1 "the whole card is a link" phrasing the audit flagged in C1). Each row is a link card in the exact idiom of the site-plan "hero" link (`+page.svelte:220-238`). `title` falls back to the project name when null; `description` (nullable) renders as a clamped subtitle, omitted when null:

```svelte
{#if data.sirs?.length}
  <div class="border border-gray-200 rounded-xl p-5 mb-4">
    <div class="flex items-center gap-2 mb-4">
      <span class="i-mingcute:file-search-line text-lg text-purple-700"></span>
      <span class="text-[15px] font-medium text-gray-900">Site Intelligence Report</span>
    </div>
    <div class="flex flex-col gap-2">
      {#each data.sirs as sir}
        <a
          href="/project/{project.id}/sir/{sir.id}"
          class="block border border-gray-200 rounded-lg px-3.5 py-3
            hover:bg-gray-50 transition-colors group"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-900">{sir.title ?? project.name}</span>
            <span class="i-mingcute:right-line text-base text-gray-400
              group-hover:text-gray-600 transition-colors"></span>
          </div>
          {#if sir.description}
            <div class="text-xs text-gray-400 mt-0.5 line-clamp-2">{sir.description}</div>
          {/if}
        </a>
      {/each}
    </div>
  </div>
{/if}
```

- **1-SIR case:** the `{#each}` yields one row — reads as a single titled/described entry with a chevron.
- **N-SIR case:** one row per `site_intelligence_report`, most-recent first (ordered in the load below), each linking to its own `sir/[sirId]` detail.

**Data load (D3 — committed to `+layout.ts`).** Add the SIR query to `project/[projectId]/+layout.ts`, alongside the existing `submission` query, so **both** the widget (`+page.svelte`) and the detail route (§6, via `await parent()`) consume one list — no duplicate query. Include `project_id` (needed for §6's structural guard) and `current_version`:

```ts
// user client; RLS restricts to visible projects automatically (§2.2)
const { data: sirs } = await supabase
  .from('site_intelligence_report')
  .select('id, project_id, title, description, address, current_version, created_at')
  .eq('project_id', projectId)
  .order('created_at', { ascending: false });
// expose `sirs` (default []) from the layout load's return
```

No artifact query is needed for the widget itself (title/description only); artifacts load in the detail route (§6).

---

## 6. The SIR detail view

**Route (new):** `src/routes/(app)/project/[projectId]/sir/[sirId]/+page.svelte` (+ `+page.ts` load). Namespaced under `sir/[sirId]` to avoid the existing `data/sir-pdf` endpoint and to support N SIRs per project. The widget links here with the chosen SIR's `id`.

**Load (`+page.ts`) — D9 committed: read the SIR from `await parent()`, don't re-query.** The parent `+layout.ts` (§5) already loaded `sirs` filtered to this project. The detail load pulls `supabase` + `sirs` from `await parent()`, finds the row by `params.sirId`, and 404s on a miss. **This miss-→404 *is* the cross-project-membership guard the audit asked for (C4):** because `sirs` is `.eq('project_id', projectId)`, a SIR belonging to a different project is simply not in the list, so `/project/A/sir/<B-sir>` yields `undefined` → `error(404)`. No separate `sir.project_id === params.projectId` check is needed (and no second SIR-row query is issued — resolving C3). Only the artifacts are fetched here:

```ts
import { error } from '@sveltejs/kit';

export const load = async ({ params, parent }) => {
  const { supabase, sirs } = await parent();            // sirs already scoped to this project (§5)
  const sir = sirs.find((s) => s.id === params.sirId);
  if (!sir) error(404, 'Site Intelligence Report not found'); // ← also the cross-project guard (C4)

  const { data: artifacts } = await supabase
    .from('sir_artifact')
    .select('id, kind, format, file_name, mime_type, byte_size, storage_path, version')
    .eq('site_intelligence_report_id', sir.id)
    .eq('version', sir.current_version)                 // §8 version handling — current version only
    .order('kind').order('file_name');

  // Pattern A — requires the §7/§9 storage policy. 1 h TTL (D2).
  const signed = await Promise.all((artifacts ?? []).map((a) =>
    supabase.storage.from('sir-artifacts').createSignedUrl(a.storage_path, 3600)
      .then((r) => ({ ...a, signedUrl: r.data?.signedUrl ?? null }))));

  return { sir, artifacts: signed };
};
```

(`supabase` is already surfaced through `await parent()` in this codebase — the same way `document/[documentId]/+page.ts` obtains its client. If the layout does not currently return `supabase`, the one-line addition is to include it in the layout load's return, which several existing routes already rely on.)

**Render (`+page.svelte`):** SIR title/description/address header, then **one card per artifact row**. Recommended grouping (not required): a "Report" section (the `report`-kind rows: pdf + docx) and a "Supporting documents" section (`supporting_document` rows) — grouping by `kind` is cosmetic; the atom is still one card per `sir_artifact`. Each card shows `file_name`, a `format`/`kind` badge, and `byte_size` (human-readable), and is an anchor:

```svelte
<a href={artifact.signedUrl} target="_blank" rel="noopener noreferrer">…card…</a>
```

Clicking opens the file in a new tab. This mirrors `DiligenceRunStatus.svelte:197-240` ("View" = `href={artifact.signed_url} target="_blank"`), the app's existing artifact-list idiom.

---

## 7. Private-file serving — the card-click → new-tab mechanism

**Decision D2 (recommended): Pattern A + a new `sir-artifacts` storage RLS policy.** Mint the signed URL in the detail `+page.ts` load with the user's client (`supabase.storage.from('sir-artifacts').createSignedUrl(path, 3600)`), exactly like `document/[documentId]/+page.ts:62-72`. This keeps cityhall frontend-only (no service-role key in the app), reuses the document-viewer idiom verbatim, and matches #203 §6 ("reads are server-minted signed URLs"). **It requires the §9 migration** (the §2.3 gap) — without it, signing is RLS-denied.

- **New tab vs download (committed).** Each artifact card is a single `<a target="_blank">` on the signed URL. PDFs (`application/pdf`) render inline in the new tab; the report **`.docx`** (and any non-inline mime) downloads on click — browsers can't render docx inline, and a signed URL to the object naturally serves it as a download. This is the intended behavior, not a gap: the report `.pdf` is the primary in-tab read, the `.docx` is a convenience download. **No separate per-card "Download" button in MVP** (the click already does the right thing for each type). A `download`-param variant (`DiligenceRunStatus.svelte:13-17`) can be added later if a "force download the PDF too" affordance is ever wanted — not in scope here.
- **TTL (committed):** 3600 s (1 h), matching the document viewer (`document/[documentId]/+page.ts`). URLs are minted per page load, so a 1 h lifetime is ample; the 72 h diligence-artifact TTL is unnecessary here.

**Alternative D2-alt (not recommended for MVP): Pattern B service-role proxy.** A `sir/[sirId]/artifact/[artifactId]/+server.ts` GET that auth-checks `locals.user`, verifies `user_can_see_project` (or reads the `sir_artifact` row under RLS), then signs with a **service-role** client and 302s (or streams) the object. Avoids the storage-policy migration but introduces a service-role storage path into cityhall (today cityhall proxies substation for such files rather than holding service-role storage access). Reserve as fallback if adding the storage policy is undesirable.

---

## 8. Edge cases & version handling

- **Project with no SIR** → widget hidden entirely (§5). No empty state on the dashboard.
- **SIR with zero artifacts** (partial publish window — #203 writes the SIR row, then artifact rows, then bytes) → widget still shows (title/description exist); detail view shows an **empty state** ("No files published yet"), never an error. Do not fall back to a different version's files.
- **Multiple versions within one SIR** → the detail view shows **`version = current_version` only** (D3). Older versions' rows persist in `sir_artifact` but are hidden in MVP; a `versioning_label`-labeled version switcher is future product scope (**Q4**). If `current_version` has zero rows but an older version has files, show the current-version empty state (don't silently serve stale files).
- **Multiple `site_intelligence_report` rows per project** (allowed, #203 D14) → the widget renders **one row per SIR**, most-recent first by `created_at` (the load's `.order`), each linking to its own `sir/[sirId]` detail (D8, §5). The 1-SIR common case is a single-row list. The detail route keys on `[sirId]`, so N SIRs are supported natively.
- **RLS / permissions** → table SELECT is already gated by `user_can_see_project` (§2.2); the load queries silently return nothing for a project the user can't see (they'd never reach the route anyway — the parent layout gates project access). Noetic admins see all SIRs; clients see only their project's. **Cross-project URL tampering** (`/project/A/sir/<B-sir>`) is blocked structurally: the detail load reads from the parent's project-scoped `sirs` list, so a foreign SIR is absent → `error(404)` (§6, D9). The **only** new grant required is the storage SELECT policy (§9).
- **Deleted SIR** (`ON DELETE CASCADE` drops its artifacts) → not in the parent `sirs` list → detail `.find` returns `undefined` → `error(404)`; the widget stops listing it on next load.
- **Null `title`/`description`** → fall back per §5; never render "null".

---

## 9. Schema change — `storage.objects` SELECT policy for `sir-artifacts`

Additive, safe (grants read only), and the enabler for Pattern A (§7). Lands as its own **`substation` migration PR** and **must be applied to prod before the SIR detail view can sign files.** Specified here; applied separately (operator-gated; no firing from this session) — same discipline as #203 §9.

Recommended policy (ties visibility to a real artifact row, mirroring the `sir_artifact` table policy and the precedent `research-data` storage policy that joins through a table):

```sql
-- substation/supabase/migrations/<timestamp>_sir_artifacts_storage_read.sql
create policy "sir-artifacts: select for accessible projects"
on storage.objects for select to authenticated
using (
  bucket_id = 'sir-artifacts'
  and exists (
    select 1
    from public.sir_artifact a
    join public.site_intelligence_report sir
      on sir.id = a.site_intelligence_report_id
    where a.storage_path = storage.objects.name
      and public.user_can_see_project(sir.project_id, auth.uid())
  )
);
```

- Uses the **same** `user_can_see_project` authorization boundary as the table RLS, so storage visibility and row visibility can never diverge (an admin sees all; a client sees only their project's files).
- A path-segment variant (`(storage.foldername(name))[2]::uuid = sir.id`, exploiting the `sir/<sir_id>/v<n>/<file>` layout) is cheaper but couples to the path convention; the `storage_path = name` join is exact and convention-independent. Recommend the join form.
- Read-only; no write/delete storage policy for authenticated users (publishing is service-role, #203 §2/D4). **Deploy order:** migration first, then the cityhall PR.

---

## 10. Implementation surface (cityhall)

| Change | File | Nature |
|---|---|---|
| Always render dashboard (drop redirect) | `src/routes/(app)/project/[projectId]/+page.ts:4-30` | remove flag branch (D1) |
| Flag now gates only feasibility widget | `src/routes/(app)/project/[projectId]/+page.svelte:129` | unchanged (already scoped) |
| Flag description reword | `src/lib/flags.ts:136-144` | copy edit |
| Load SIR list (shared by widget + detail) | `src/routes/(app)/project/[projectId]/+layout.ts` | new query; return `sirs` (+ ensure `supabase` is returned) (§5, D3) |
| SIR widget card | `+page.svelte` — full-width block **above** the grid at `:120`; **grid untouched** | new inline markup (§5, D8) |
| SIR detail route | `src/routes/(app)/project/[projectId]/sir/[sirId]/{+page.ts,+page.svelte}` | new route; `+page.ts` reads SIR via `await parent()` (§6, D9) |
| (D2) signed-URL wiring | detail `+page.ts` | reuse `document/[documentId]/+page.ts:62-72` (1 h TTL) |
| Storage RLS policy | `substation` migration (§9) | separate PR, applied first |

No new npm deps, **no change to the dashboard grid class** (D8). Reuses: the site-plan card shell + hero-link idiom, `Constrained`/`PageHeading`, the `createSignedUrl` load idiom, and the `DiligenceRunStatus` artifact-link idiom (mirrored, not imported — its prop shape is `signed_url`/`file_size`, not ours).

---

## 11. Non-goals (explicitly deferred)

- **No UI creation of SIRs.** SIRs are produced only by the back-end publish path (`upload-sir` / `publish.ts`, winston#203). This UI is **view-only**.
- **No editing** of `site_intelligence_report` or `sir_artifact` (no rename/description edit/reorder/delete from the UI). RLS does grant write/delete to project admins, but this spec wires none of it.
- **No web report viewer** (rendering `pages.tsx`/HTML inline as an infinite-scroll page — #192 Surface B1/§8, Q5). MVP opens the report **PDF** in a new tab; the rich in-app render is a later spec.
- **No report chat, findings normalization, staff-review threads, internal observability, or map viewer** (#192 Surfaces B2/C/D/E — separate child specs).
- **No version switcher / version history UI** (deferred, Q4) — current version only.
- **No changes to the surveyor "Site Facts" SIR** (`data/` page, `project_facts`, `data/sir-pdf`) — different concept (§1).

---

## 12. Decisions

- **D1 — Dashboard is core.** `+page.ts` always renders the dashboard; the `feasibility-intake`-gated 302-into-submission redirect is removed. Site-plan review is unaffected (its track is unconditional).
- **D2 — File serving = Pattern A (user-client signed URL in `load`) + new `sir-artifacts` storage RLS policy (§9).** Keeps cityhall frontend-only, reuses the document-viewer idiom, matches #203 §6. 1 h TTL. Each card is a single `<a target="_blank">`: PDFs render in-tab, docx downloads on click; no separate download button. Service-role proxy is the documented fallback (D2-alt).
- **D3 — Detail view shows `version = current_version` artifacts only** (load location = `+layout.ts`; §5/§6). Older versions hidden in MVP.
- **D4 — Flag not renamed; only its scope narrows** to the feasibility widget + `beginFeasibility` action. No new flag.
- **D5 — SIR widget hidden when no SIR row exists;** zero-artifact SIR shows an empty state in detail, never an error.
- **D6 — New route namespaced `sir/[sirId]`** (not under `data/`), keyed per SIR to support N SIRs/project.
- **D7 — §9 storage migration specified here, applied separately (operator-gated), substation-first; then the cityhall PR.**
- **D8 — Widget = a full-width list-of-entries card above the two-track grid, outside the grid.** One `<a>` row per `site_intelligence_report` (1-SIR = single-row list). The live `grid-cols-1 {feasibilityIntakeEnabled ? 'md:grid-cols-2' : ''}` conditional is left untouched (no third-card column math). Exact markup in §5. *(Resolves audit C1, C2, C5.)*
- **D9 — Detail `+page.ts` reads its SIR from `await parent()` (the `+layout.ts` `sirs` list), not a re-query.** The `sirs.find(id === sirId)` miss → `error(404)` doubles as the cross-project-membership guard (the list is project-scoped). *(Resolves audit C3, C4.)*

---

## 13. Open questions (for Will)

Only genuinely **product-level** questions remain; every implementation-blocking ambiguity from Draft v1 is now decided in §5/§6/§12 (see the Revision note). The three below change *product behavior or a prod migration*, not just code shape.

- **Q1 — Confirm the file-serving approach (a prod-migration + security decision).** Committed to **Pattern A + a new `sir-artifacts` `storage.objects` SELECT policy** (D2/§9): smallest cityhall footprint, no service-role key in the app, reuses `document/[documentId]` verbatim — at the cost of one additive substation RLS migration to prod. The alternative (D2-alt) is a service-role proxy endpoint with no migration. Flag if you'd rather not add the storage policy; otherwise D2 stands.
- **Q3 — Confirm the dashboard-always UX change.** The task mandates promoting the dashboard to core (D1), which means users of **pure site-plan-review projects** (no feasibility/SIR) now land on the dashboard instead of being taken straight into the site-plan submission — one extra click into review. Recommended (and committed as D1) for consistency; the only reason to revisit is if that extra hop bothers heavy site-plan reviewers, in which case we could keep the legacy redirect *only* for projects with exactly one site-plan submission and no feasibility/SIR.
- **Q4 — Version history: is current-version-only acceptable for MVP?** Committed to showing `current_version` artifacts only (D3); a `versioning_label`-labeled version switcher is deferred. Today all live data is v0, so this is invisible now — but it becomes user-visible the first time a SIR is re-published (#203 §7). Confirm the switcher can wait for a later spec.
