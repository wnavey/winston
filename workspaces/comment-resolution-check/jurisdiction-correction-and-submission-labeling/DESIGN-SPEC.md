# Jurisdiction Resolution Correction + City Submission Labeling

**Status:** Draft v2
**Date:** 2026-07-20
**Repos touched (Path A):**
- `substation` — DB migration (`project.jurisdiction_slug`, `submission_version.city_submission_number` + CHECK + indexes), validated backfill + U0 auto-stamp, generated types + Zod, **CRC Comment-Response-Review PDF title rewrite** (`src/pdf/comment-response-review.tsx`, `src/pdf/crv-report-data.ts`)
- `cityhall` — submission-label adapter + two derivations, submission-switcher dropdown alias, site-plan-page header alias, **left-nav "U0 MCR resolution" dynamic label** (kills a dead field), generated types
**Repos touched (Path B, fast-follow):** `substation` (new `jurisdictions` table, migrate `project`/`reviews` off `organizations`-as-jurisdiction, data-driven label scheme, wire the resolved-MCR-cycle param through the CRC workflow), `conductor` (`review-saver.ts` jurisdiction resolution), `cityhall` (jurisdiction reads)
**Repos NOT touched:** `bureau` (runtime slug contract unchanged; the CRC script already writes `crcGuides.u0VersionNumber`), `dsd/library` (GTM `jurisdictions` table stays independent), `quarry`, `navalbase`, `radar`

---

> **Revision note (v1 → v2)** — folds in a grilling pass + fresh codebase/prod verification. Material changes:
> - **New P4** — the CRC PDF title `"… — Update U{version_number}"` is `version_number` with a "U" glued on (`comment-response-review.tsx:545,551`); "Update U5" ≠ Austin submission U5. This collision is a motivating defect, not just cosmetics. *(Q24)*
> - **Worked example corrected** — prod Lamar + Collier has **v1–v5** (not v1–v7); all `label`s NULL, v5 is `draft`. The v1-v7 example was fictional. New fixture: **v4 = U0 (`city_submission_number = 1`), v5 = "U1 (draft)"**. *(Q23, Q32)*
> - **`mcrCycleLabel` is dead** — cityhall reads `reviews.metadata.mcrCycleLabel` (`+layout.ts:290-296`) but **nothing writes it**; it always defaults to `'U0'`. Killed, not populated. The real, populated pointer is `reviews.metadata.crcGuides.u0VersionNumber`. *(Q33, Q39, D12)*
> - **Scheme is a named token** (`"U_ZERO_BASED"`) with logic in code, not a `{prefix,offset}` blob. *(Q29, D8)*
> - **Label trigger = `city_submission_number IS NOT NULL`, never version status.** *(Q30, D9)*
> - **Two distinct derivations** — per-version label vs. resolving-cycle label; the latter keys on `crcGuides.u0VersionNumber`, superseding v1's "previous stamped version" SQL query (now an in-memory pass, and only for the per-version half). *(Q37, D11)*
> - **U0 auto-stamp** from `crcGuides.u0VersionNumber` in the backfill, so the feature lights up on existing CRC'd projects. *(Q42, D14)*
> - **Backfill guard** — a non-jurisdiction org (`pape-dawson`, a civil firm) is used as a `jurisdiction_organization_id` in prod; backfill must allowlist real Bureau slugs. *(Q22, D15)*
> - **Prod slug confirmed** `austin` (Q3 satisfied; `city-of-austin` is local-seed-only).
> - Per-surface display policy, `CHECK (>= 1)`, adapter-duplication, and 2-PR bundling all pinned as decisions. *(Q31, Q5, Q25, Q34, D10/D16/D17/D18)*

---

## Problem

Three entangled problems, discovered while designing a way to mark which `submission_version` rows were actually submitted to the city (e.g. Austin's `U0`, `U1`, …), plus a downstream display defect (P4).

### P1 — A project has no derivable jurisdiction until a review runs

There is **no jurisdiction column on `project`** (`substation/supabase/migrations/00000000000000_baseline.sql:379-403`; verified — columns are `id, name, site_address, site_plan_number, zoning, owner_organization_id, created_at, updated_at`). The only place a project's jurisdiction is recorded is on the `reviews` table via `jurisdiction_organization_id` (a `NOT NULL` FK to `organizations`, `baseline.sql:742-743`). cityhall's projects list derives the displayed "City of Austin" / "City of Cedar Park" by joining the **current review** to `organizations.name` (`cityhall/src/routes/(app)/+layout.server.ts:27-36`, built into a `jurisdictionByProject` map at `:104-110`).

Consequence: a freshly created project — or one that has never had a formal review — has no jurisdiction at all. Jurisdiction is knowable at project creation (from the site address), so recording it only as a side effect of running a review is backwards.

### P2 — "Jurisdiction" is modeled three disconnected ways

| # | Representation | Location | Purpose | Key |
|---|---|---|---|---|
| **1** | Bureau slug `'austin'` | `bureau/jurisdictions/<slug>/` (**58 dirs**, verified) + `bureau_nodes.jurisdiction` / `bureau_documents.jurisdiction` `TEXT DEFAULT 'austin'` | **Runtime regulatory content** — the review agent reads guides/codes from this dir | bare string slug |
| **2** | `organizations` row | app Supabase, via `reviews.jurisdiction_organization_id` | **Display + a FK to hang a review on** | `slug` (unique index `baseline.sql:340`); **no** type/`is_jurisdiction` column |
| **3** | `jurisdictions` table | **Library** Supabase project `jkbuvkwnrrvunqgrkeol` (`dsd/library/tooling/migrations/001_jurisdictions.sql`) | **GTM / expansion research** — population, permits-per-capita; linked to Census GEOIDs | `(name, state)` unique |

These three namespaces never reconcile:

- **Runtime truth is the bare slug.** The review workflow takes `jurisdiction` as a required input, defaulting to `'austin'`. Used only to select `bureau/jurisdictions/{{ input.jurisdiction }}/…`. Neither UUID is consulted at runtime.
- **The org row is derived, not authoritative.** `conductor/src/shared/review-saver.ts:341-345` takes the runtime slug and does `organizations WHERE slug = <slug>` at **save** time, storing the resulting UUID on the review (`:515`). cityhall reads it back purely for display.
- **The Library table is a different concern.** ~50 expansion candidates; never referenced by the product.

**Modeling smell (why jurisdiction-as-organization is wrong):**

1. **No discriminator.** Jurisdictions and customer orgs share one table, distinguished only by slug convention. **Live proof:** in prod, `reviews.jurisdiction_organization_id` references **`pape-dawson`** — a civil engineering *firm*, not a city (there is no `bureau/jurisdictions/pape-dawson`). You cannot cleanly enumerate jurisdictions or enforce integrity.
2. **Inverted dependency.** The real key is the Bureau slug; the org row is a downstream display shim. Modeling the authority as a derived FK is backwards.
3. **Directly causes P1.**
4. **Latent slug mismatch.** Local seed slug is `city-of-austin` (`substation/supabase/seed.sql:46`) but the runtime lookup queries `slug = 'austin'`. **Prod is `austin`** (verified — see Facts), so it works today by convention, not by contract.

### P3 — No way to mark a version as submitted to the city, with jurisdiction-specific labels

Not every `submission_version` is submitted to the city — they are the civil firm's drafts/iterations. Austin labels the first city submission `U0`, the second `U1`, etc.; other jurisdictions differ (e.g. `Rev A`). `submission_version` today has `version_number`, `label` (free-text draft note, rendered as `… v{n} — {label}` at `cityhall/.../[projectId]/+layout.ts:71-73`), `status`, `submitted_at` (`baseline.sql:667-670`). There is no field for the city-submission designation, and no place to display it.

Note: version **status** (`draft` / `review_complete`) is **orthogonal** to "was this a city submission." A version can be `review_complete` yet never submitted to the city. The city-submission flag must be its own fact. *(D9)*

### P4 — The CRC PDF title conflates version number with city-submission cycle

The Comment-Response-Review PDF builds its title as `` `${sitePlanName} — Update U${updateNumber}` `` at `substation/src/pdf/comment-response-review.tsx:545` (cover) and `:551` (contents), where `updateNumber` **is `submission_version.version_number`** (assembled in `src/pdf/crv-report-data.ts`). So "Lamar + Collier — Update **U5**" is literally *version 5 with a "U" prefix* — a coincidental collision that reads as an Austin city-submission label but is not one (v5 is the 5th draft version, not city submission U5). This is the concrete defect the PDF rewrite fixes.

Target title (jurisdiction-aware, cycle-aware):
> `{Project} — {current version's derived label} resolution of {resolved MCR cycle label} comments`
> e.g. **"Lamar + Collier — U1 Draft resolution of U0 comments"**

### Facts (verified 2026-07-20, prod app project `mgxqsrjutswbciyrltwd`, read-only)

- **Jurisdiction org slugs referenced by reviews:** `austin` (City of Austin, `4d99ef5b-…`), `cedar-park` (City of Cedar Park, `fd8d5183-…`), and **`pape-dawson`** (Pape-Dawson — a *firm*, `92eeba25-…`). Austin/Cedar-Park match Bureau dirs; `pape-dawson` does not. The `city-of-austin` seed slug is **local-only**.
- **Submissions:** `submission_type` ∈ {`feasibility` (77), `site_plan` (22)}. 14 projects have >1 submission (mostly accumulating feasibility submissions). The U0/U1 sequence concerns the `site_plan` submission only. *(Q9, Q28)*
- **Lamar + Collier** (`23301a8a-…`), `site_plan` submission `cf1201c2-…`: **5** versions v1–v5. All `label`s NULL; only v1 has non-null `submitted_at`; v5 is `draft` (id `4cfe4c36-…`), v4 is `review_complete` (id `6b9b85ed-…`). CRC review `ed5e7ba9-…` → jurisdiction org slug **`austin`**.
- **`crcGuides.u0VersionNumber`** is written into CRC review metadata by `bureau/workflows/comment-resolution-check/scripts/build-crc-review-comments.ts:488-522` (field at `:513`). It records the `version_number` of the submission whose MCR the CRC resolves. For Lamar + Collier that is **v4** (the U0 city submission).
- **`mcrCycleLabel`** is **read** by cityhall (`+layout.ts:290-296`, defaults `'U0'`) but **written nowhere** in the codebase.

### Worked example (real data — Lamar + Collier)

- Project `23301a8a-…`, `site_plan` submission `cf1201c2-…`, **4** completed versions + **1** draft (v1–v5).
- CRC review `ed5e7ba9-…` (`review_type=crc`, jurisdiction `austin`), `crcGuides.u0VersionNumber = 4`.
- **Target stamping:** v4 → `city_submission_number = 1` (Austin "U0"). v5 is the draft resubmission toward U1.
- **Target labels:**
  - Dropdown (stamped-only): "Site Plan v4 — **U0**"; v1–v3, v5 plain "Site Plan v{n}".
  - Site-plan page header (full derived): v4 → "**U0**"; v5 → "**U1 (draft)**".
  - CRC PDF: "Lamar + Collier — **U1 Draft** resolution of **U0** comments".
  - Left nav: "**U0** MCR resolution".
  (Running the CRC on v4 itself is "a little goofy" but self-consistent — resolving-cycle = max stamped ≤ v4 = U0.)

---

## Decisions

**Carried from v1:**

- **D1 — Canonical jurisdiction identifier = the Bureau slug** (`'austin'`, `'cedar-park'`, …). Already the de-facto runtime key with 58 real entries.
- **D2 — Path A ships the feature without the big refactor.** Project-level `project.jurisdiction_slug TEXT` (no new table yet), the `city_submission_number` column, and a display-layer adapter + derivations. Do **not** touch `review-saver.ts` or the reviews write path.
- **D3 — Path B (fast-follow) does the proper fix**: app-side `jurisdictions` table keyed on the slug; `project.jurisdiction_slug` becomes an FK; `reviews` migrates off `organizations`-as-jurisdiction. Direction only.
- **D4 — Store only the fact, derive the presentation.** `city_submission_number` is stored **only** on versions actually submitted to the city (NULL elsewhere). Draft-cycle labels ("U1 (draft)") are **derived at read time**, never stored.
- **D5 — Canonical submission number is a 1-based ordinal.** `1` = first city submission. The per-jurisdiction adapter owns base-offset + prefix (Austin: `n → "U" + (n-1)`, so `1 → "U0"`). The DB never encodes Austin's 0-indexing quirk.
- **D6 — Writes are manual DB edits for now**, except the U0 auto-stamp (D14). No general UI write path in this spec.
- **D7 — Reuse of the Library `jurisdictions` table is rejected** (see Path B §Rejected alternative).

**New in v2:**

- **D8 — Scheme = a named token; logic lives in code.** A jurisdiction's labeling convention is an enum token (Austin = `"U_ZERO_BASED"`; future `"REV_LETTER_BASED"` → "Rev A"). Code adaptors keyed on the token own all formatting. In Path A `slug → token` is a small code map; in Path B it moves to a `jurisdictions.submission_label_scheme` column that stores the token string. `token → adaptor` stays in code forever. *(Q29, Q13)*
- **D9 — The label trigger is `city_submission_number IS NOT NULL`, never version `status`.** "Non-draft" and "was a city submission" are orthogonal facts. *(Q30)*
- **D10 — Per-surface display policy:** submission-switcher dropdown = **stamped-alias only**; site-plan-page header = **full derived** (shows "U1 (draft)"); CRC PDF = **full derived**; project dashboard list = **out of scope**. *(Q31)*
- **D11 — Two distinct read-time derivations** (both pure in-memory passes over the submission's version list; no extra SQL):
  1. **Per-version label** — a version's own label, from its position + `city_submission_number`. Feeds the dropdown (stamped only), the page header (full derived), and the PDF's "current version" half.
  2. **Resolving-cycle label** — *which MCR cycle a CRC review resolves.* Keyed on `review.metadata.crcGuides.u0VersionNumber` → that version's `city_submission_number` → adapter. Feeds the nav "{X} MCR resolution" and the PDF's "resolution of {X} comments" clause. This **supersedes** v1's "previous stamped version" heuristic/SQL, which was an inference; the provenance pointer is authoritative. *(Q37, Q33)*
- **D12 — Kill `mcrCycleLabel`.** It is never populated (always defaults `'U0'` — a latent hardcode). Delete the dead cityhall read (`+layout.ts:290-296`) and replace with the D11.2 derivation. Do **not** build a writer for it. *(Q33, Q39, Q40)*
- **D13 — Graceful fallbacks; never invent a cycle.** If the adapter can't resolve (no jurisdiction, unknown scheme): a **stamped** version falls back to a generic 1-based ordinal `"Submission {n}"`; an unstamped version falls back to plain `"Draft"`. If the resolving-cycle can't resolve: nav shows plain `"MCR resolution"` and the PDF drops the "resolution of … comments" clause. *(Q3, Q41, Q21)*
- **D14 — U0 auto-stamp.** The backfill sets `city_submission_number = 1` on the version identified by `crcGuides.u0VersionNumber` for each existing CRC review, so the feature lights up on already-CRC'd projects without manual edits. U1+ stays manual (D6). Reliable because that field is the MCR provenance pointer. *(Q42)*
- **D15 — Backfill guard (allowlist).** `project.jurisdiction_slug` is backfilled from a review's org slug **only** when that slug is a real Bureau jurisdiction (validate against the 58 dirs / a small allowlist). This excludes `pape-dawson`; such projects stay NULL and are flagged. The `pape-dawson`-as-jurisdiction rows are a separate data-quality note, not fixed here. *(Q22, Q1)*
- **D16 — `CHECK (city_submission_number >= 1)`.** Monotonicity of `city_submission_number` vs `version_number` is documented as an invariant but **not enforced** (GIGO acceptable for low-volume manual writes; revisit with a UI in Path B). *(Q5, Q4, Q6)*
- **D17 — Adapter is duplicated now.** cityhall and substation are separate repos with no shared jurisdiction module (cityhall's `jurisdictionLabel` is a 13-line local at `src/lib/jurisdiction.ts`). The ~40-line adapter + derivations are copied into both, one marked the canonical source. Extraction to a shared `@noetic-inc/*` package + the data-driven scheme column are deferred to Path B. Justified because Austin is the only live scheme and the shared acceptance test (below) catches drift. *(Q25)*
- **D18 — Two PRs.** **(a) substation:** migration + validated backfill + U0 auto-stamp + Zod/types + CRC-PDF title rewrite. **(b) cityhall:** dropdown alias + site-plan-page alias + nav-label fix + types. Deploy order: **substation migration first**, regenerate both type copies, then cityhall. *(Q20, Q34, Q16)*

---

## Path A — implementation-ready

### A1 — Project-level jurisdiction

```sql
ALTER TABLE public.project
  ADD COLUMN jurisdiction_slug TEXT;   -- canonical Bureau slug, e.g. 'austin'
```

- Nullable for now (existing rows have none). Not yet an FK (the table it would reference arrives in Path B).
- **Backfill (D15):** for projects with a current review whose org slug is a **known Bureau jurisdiction**, set `jurisdiction_slug` to that slug. Skip/NULL when the org slug is not a Bureau jurisdiction (e.g. `pape-dawson`) or when there is no review; log the skips.
- cityhall's projects-list jurisdiction display (`+layout.server.ts:27-36`) is unchanged in Path A — it keeps deriving from the current review. Path B switches it to read `project.jurisdiction_slug`.

### A2 — `submission_version.city_submission_number`

```sql
ALTER TABLE public.submission_version
  ADD COLUMN city_submission_number INTEGER
    CHECK (city_submission_number IS NULL OR city_submission_number >= 1);   -- NULL = not submitted to the city (D16)

-- one "1st/2nd/… submission" per submission (fat-finger guard for manual writes)
CREATE UNIQUE INDEX submission_version_city_submission_number_key
  ON public.submission_version (submission_id, city_submission_number)
  WHERE city_submission_number IS NOT NULL;

-- fast city-submission scan (partial → only real submissions)
CREATE INDEX submission_version_city_submitted_idx
  ON public.submission_version (submission_id, version_number)
  WHERE city_submission_number IS NOT NULL;
```

- The existing `label` column is **untouched** (firm's free-text draft note).
- NULL — not `-1` — is "not submitted." Presence is the flag; no separate boolean. *(D4, D9)*
- Column lives on **all** `submission_version` rows structurally; only `site_plan`-submission versions are ever stamped. No `submission_type` restriction on the column. *(Q28)*
- No standalone "previous city submission" SQL query is needed — both derivations (A4) are in-memory passes over the already-fetched version list.

**U0 auto-stamp (D14)** — a backfill step, run once after the column exists:

```sql
-- For each CRC review, stamp the MCR-source version as city submission #1 (U0).
-- crcGuides.u0VersionNumber is the version_number the MCR was generated from.
UPDATE public.submission_version sv
SET city_submission_number = 1
FROM reviews r
JOIN submission s      ON s.project_id = r.project_id AND s.submission_type = 'site_plan'
WHERE r.review_type = 'crc'
  AND (r.metadata #>> '{crcGuides,u0VersionNumber}') IS NOT NULL
  AND sv.submission_id = s.id
  AND sv.version_number = (r.metadata #>> '{crcGuides,u0VersionNumber}')::int
  AND sv.city_submission_number IS NULL;   -- never override an existing stamp
```

*(Exact join to the CRC's target submission to be confirmed against the reviews schema during implementation; the invariant is "stamp the version whose `version_number == crcGuides.u0VersionNumber` on that project's site_plan submission." U1+ stays manual.)*

### A3 — Jurisdiction submission-label adapter (D8, D17)

Named-token model. Copied into both cityhall (`src/lib/jurisdiction.ts`, beside `jurisdictionLabel()`) and substation (canonical copy; keep in sync).

```ts
// The only jurisdiction-specific label logic. Keyed by scheme token, not slug.
type SchemeToken = 'U_ZERO_BASED'; // Path B adds: | 'REV_LETTER_BASED' | …

const TOKEN_ADAPTERS: Record<SchemeToken, (n: number) => string> = {
  U_ZERO_BASED: (n) => `U${n - 1}`,                       // 1 -> "U0", 2 -> "U1"
  // REV_LETTER_BASED: (n) => `Rev ${String.fromCharCode(64 + n)}`,  // 1 -> "Rev A"
};

// Path A: code map. Path B: moves to jurisdictions.submission_label_scheme (stores the token).
const SLUG_SCHEME: Record<string, SchemeToken> = {
  austin: 'U_ZERO_BASED',
};

// 1-based ordinal -> display label, or null if no scheme resolves.
export function citySubmissionLabel(slug: string | null | undefined, n: number): string | null {
  const token = slug ? SLUG_SCHEME[slug] : undefined;
  const adapter = token ? TOKEN_ADAPTERS[token] : undefined;
  return adapter ? adapter(n) : null;
}

// Stamped version: real label, else generic 1-based ordinal (D13). Never null.
export function stampedLabel(slug: string | null | undefined, n: number): string {
  return citySubmissionLabel(slug, n) ?? `Submission ${n}`;
}
```

### A4 — The two derivations (D11)

Both take the submission's versions sorted ascending by `version_number` and the project's `jurisdiction_slug`.

**(1) Per-version label** — for the dropdown (stamped only) and the page/PDF (full derived):

```ts
// versions: sorted asc by version_number; slug: project.jurisdiction_slug
function perVersionLabels(versions: VersionRow[], slug: string | null, mode: 'stampedOnly' | 'full') {
  return versions.map((v, i) => {
    if (v.city_submission_number != null) return stampedLabel(slug, v.city_submission_number); // e.g. "U0"
    if (mode === 'stampedOnly') return null;                                                   // dropdown: no alias

    // full-derived draft cycle (retroactive + immediate):
    const nextStamped = versions.slice(i + 1).find((w) => w.city_submission_number != null);
    const maxBefore   = Math.max(0, ...versions.slice(0, i).map((w) => w.city_submission_number ?? 0));
    const cycle       = nextStamped?.city_submission_number ?? maxBefore + 1;
    const label       = citySubmissionLabel(slug, cycle);
    return label ? `${label} (draft)` : 'Draft';                                               // e.g. "U1 (draft)"
  });
}
```

Draft rules (unchanged from v1, restated): a stamped version → its own label; an un-stamped version with something stamped after it → that next cycle as a draft (retroactive: once v7 = U1, v5/v6 read "U1 (draft)"); an un-stamped version with nothing stamped after → `(max stamped before, or 0) + 1` as a draft (immediate — v5 after v4 = U0 reads "U1 (draft)" without waiting for v7). No string parsing — the `U0 → U1` step is `n + 1` at the ordinal level, formatted once by the adapter.

**(2) Resolving-cycle label** — *which MCR cycle does a CRC review resolve* (nav + PDF clause):

```ts
// review.metadata.crcGuides.u0VersionNumber points at the MCR-source version.
function resolvingCycleLabel(review, versions: VersionRow[], slug: string | null): string | null {
  const ptr = review?.metadata?.crcGuides?.u0VersionNumber;                 // e.g. 4
  if (ptr == null) return null;                                             // → neutral fallback (D13)
  const src = versions.find((v) => v.version_number === ptr);
  if (src?.city_submission_number == null) return null;                     // unstamped → neutral fallback
  return stampedLabel(slug, src.city_submission_number);                    // e.g. "U0"
}
```

### A5 — cityhall display (D10, D12)

- **Data:** extend the submission-version fetch to include `city_submission_number` (`cityhall/.../[projectId]/+layout.ts:105-111`; `VersionRow` interface `:14-20`). cityhall already fetches **all** versions for a submission and sorts them (`extractVersions` `:29-34`), so both derivations are O(n) in-memory passes — no extra query.
- **Submission-switcher dropdown** (`+layout.ts` `buildSubmissionGroups` label builder `:71-73`; rendered via `ContextSwitcher` in `+layout.svelte:112-114`): append the stamped alias only. `"Site Plan v4"` → `"Site Plan v4 — U0"`; unstamped rows unchanged.
- **Site-plan-page header** (`.../submission/[submissionId]/+page.svelte:461-478`): `PageHeading` has no alias slot, so render the **full-derived** label as a small badge just under the project-name subtitle (`data.project.name`, `:464`). Reuse the inline badge pattern (`px-1.5 py-0.5 rounded text-[10px] font-medium`, cf. `+page.svelte:175`) in a distinct color (e.g. indigo) so a city marker reads differently from a status chip.
- **Left-nav "{X} MCR resolution"** (`+layout.ts:290-296`): replace the dead `metadata.mcrCycleLabel ?? 'U0'` read with `resolvingCycleLabel(...)`; fall back to plain `"MCR resolution"` when null (D13). The adjacent "Austin" nav item already uses `jurisdictionLabel()` (`:315,320`) — unchanged.
- **Types:** regenerate both generated copies (`substation/src/types/database.types.ts` and `cityhall/src/lib/types/database.ts`) and add `city_submission_number` / `jurisdiction_slug` to the relevant Zod schemas in `substation/src/schemas/`. Note the regen command in the PR (two hand-synced copies are a known drift footgun). *(Q17)*

### A6 — substation CRC-PDF title rewrite (P4, D10, D11)

- **Data (`src/pdf/crv-report-data.ts`, `fetchCrvReportData`):** it already queries Supabase directly and has `submission_id` in scope. Add: `project.jurisdiction_slug`, the CRC review's `metadata.crcGuides.u0VersionNumber`, and **all** `submission_version` rows for the `submission_id`. Anchor the "current version" on `reviews.submission_version_id` (the version the CRC ran against). *(Q26, Q27)*
- **Title (`src/pdf/comment-response-review.tsx:545,551`):** replace `` `${sitePlanName} — Update U${updateNumber}` `` with
  `{project} — {perVersion full-derived label of the anchor version} resolution of {resolvingCycleLabel} comments`.
  When `resolvingCycleLabel` is null → drop the "resolution of … comments" clause; when the current-version label is null → fall back to `{project} — {plain version}` (never the raw "Update U{version_number}"). *(D13, Q35)*

### A7 — Pre-build / acceptance

- **Pre-build (satisfied):** prod jurisdiction org slugs = `austin` / `cedar-park` (canonical). `city-of-austin` is local-seed-only. Migration ships as a **repo migration file** through the normal deploy path — never hand-applied via MCP/SQL editor. *(Q3/A-original, Q18)*
- **Acceptance test (both surfaces):** after migration + auto-stamp, **Lamar + Collier** renders — dropdown "Site Plan v4 — U0"; site-plan page v4 → "U0", v5 → "U1 (draft)"; nav "U0 MCR resolution"; CRC PDF "Lamar + Collier — U1 Draft resolution of U0 comments". *(Q15, Q23)*
- **Runbook:** ship a short SQL snippet in the PR for manually stamping U1+ versions (`UPDATE submission_version SET city_submission_number = <n> WHERE id = '<uuid>'`). *(Q14)*
- **Rollback:** drop the two nullable columns + two partial indexes; the backfill/auto-stamp are additive and re-derivable. Trivial. *(Q19)*

---

## Path B — direction / fast-follow (not implementation-ready)

Fix the root cause from P2/D3. Ships as its own spec + PRs because it touches the reviews write path.

### B1 — App-side `jurisdictions` table

```sql
CREATE TABLE public.jurisdictions (
  slug                     TEXT PRIMARY KEY,   -- canonical, == bureau/jurisdictions/<slug>
  display_name             TEXT NOT NULL,      -- "City of Austin"
  state                    TEXT,
  submission_label_scheme  TEXT,               -- D8 token, e.g. 'U_ZERO_BASED'
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `project.jurisdiction_slug` becomes `REFERENCES public.jurisdictions(slug)` (real referential integrity — the thing Path A defers).
- `reviews.jurisdiction_organization_id` → migrate to `reviews.jurisdiction_slug` (or inherit from `project`). `review-saver.ts:341-345` stops the `organizations`-by-slug lookup.
- cityhall jurisdiction reads switch from `organizations.name` joins to `jurisdictions.display_name`.
- `organizations` stops doubling as the jurisdiction registry; `pape-dawson`-as-jurisdiction rows get corrected.

### B2 — Data-driven scheme + extract the adapter

- Move A3's `SLUG_SCHEME` map to `jurisdictions.submission_label_scheme` (stores the D8 token). `token → adaptor` stays in code.
- Extract the duplicated adapter/derivations (D17) into a shared `@noetic-inc/*` package consumed by both cityhall and substation.

### B3 — Wire the resolved-MCR-cycle param through the CRC workflow

Today the resolved cycle is inferred from `crcGuides.u0VersionNumber` and the field name assumes a U0-origin MCR. When a **U1+ MCR** needs resolving, generalize: carry an explicit "resolved city submission number" through the CRC workflow → review metadata, and generalize the D14 auto-stamp beyond `= 1`.

### Rejected alternative — reuse the Library `jurisdictions` table (D7)

1. **Cross-project FK is impossible.** The Library table is in a *separate* Supabase project (`jkbuvkwnrrvunqgrkeol`); Postgres FKs can't cross project boundaries. **Decisive.**
2. **Different concern / lifecycle / owner.** Library is GTM research (~50 expansion candidates, keyed `(name, state)`, mostly not operated in). Coupling it to the review path puts research churn in the blast radius of production review integrity.
3. **Reuse doesn't even save the mapping.** No slug column, not 1:1 with the 58 Bureau dirs → a reconciliation layer is still required.
4. **Hot-path coupling.** A core product read would depend on a second Supabase project at request time.

**Resolution:** one source of truth *per concern*. The app owns its operational `jurisdictions` table (slug-keyed, agrees with Bureau by construction); the Library table stays the GTM registry. If they ever need joining, add the canonical slug as a thin non-load-bearing bridge column on the Library table — never a cross-project FK.

---

## Scope boundaries

- **Deferred to Path B:** app `jurisdictions` table, FK integrity for `project.jurisdiction_slug`, migrating `reviews`/`review-saver.ts` off `organizations`-as-jurisdiction, switching cityhall jurisdiction display to the new table, data-driven label schemes, extracting the shared adapter package, wiring an explicit resolved-cycle param through the CRC workflow, generalizing the auto-stamp past U0.
- **Not in scope at all:** any change to Bureau's runtime slug contract; any change to the Library `jurisdictions` table or `dsd/library`; a general UI write path for setting jurisdiction or city-submission number (manual DB edits per D6, except the U0 auto-stamp); reconciling the Library UUID namespace with the app; the project dashboard list badge (D10).

---

## Open questions (residual)

Most v1 questions are resolved (see Decisions + Revision note). Remaining:

- **QB1** — Path B: does `reviews` get its own `jurisdiction_slug`, or inherit from `project`? (A review's jurisdiction should equal its project's; a column avoids a join but can drift.)
- **QB2** — Path B: exact generalization of `crcGuides.u0VersionNumber` for U1+ MCRs (rename + carry an explicit resolved-cycle number), and how the auto-stamp learns the right number.
- **Q-impl** — Confirm the precise `reviews`↔`submission`/`submission_version` join used by the U0 auto-stamp UPDATE (A2) against the live reviews schema before running the backfill.
