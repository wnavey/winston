# Jurisdiction Resolution Correction + City Submission Labeling

**Status:** Draft v1
**Date:** 2026-07-20
**Repos touched (Path A):** `substation` (DB migration: `project.jurisdiction_slug`, `submission_version.city_submission_number` + indexes; generated types), `cityhall` (label adapter + derivation util, submission-version display, generated types)
**Repos touched (Path B, fast-follow):** `substation` (new `jurisdictions` table, migrate `project`/`reviews` off `organizations`-as-jurisdiction), `conductor` (`review-saver.ts` jurisdiction resolution), `cityhall` (jurisdiction reads)
**Repos NOT touched:** `bureau` (runtime slug contract unchanged), `dsd/library` (GTM `jurisdictions` table stays independent), `quarry`, `navalbase`, `radar`

---

## Problem

Two entangled problems, discovered while designing a way to mark which `submission_version` rows were actually submitted to the city (e.g. Austin's `U0`, `U1`, …).

### P1 — A project has no derivable jurisdiction until a review runs

There is **no jurisdiction column on `project`** (`substation/supabase/migrations/00000000000000_baseline.sql:379-403`). The only place a project's jurisdiction is recorded is on the `reviews` table via `jurisdiction_organization_id` (a NOT NULL FK to `organizations`, `baseline.sql:739-762`). cityhall's projects list derives the displayed "City of Austin" / "City of Cedar Park" by joining the **current review** to `organizations.name` (`cityhall/src/routes/(app)/+layout.server.ts:27-36`, built into a `jurisdictionByProject` map at `:104-110`).

Consequence: a freshly created project — or one that has never had a formal review — has no jurisdiction at all. Jurisdiction is knowable at project creation (from the site address), so recording it only as a side effect of running a review is backwards.

### P2 — "Jurisdiction" is modeled three disconnected ways

| # | Representation | Location | Purpose | Key |
|---|---|---|---|---|
| **1** | Bureau slug `'austin'` | `bureau/jurisdictions/<slug>/` (58 dirs) + `bureau_nodes.jurisdiction` / `bureau_documents.jurisdiction` `TEXT DEFAULT 'austin'` (`baseline.sql:1113-1125`, `:1182-1194`) | **Runtime regulatory content** — the review agent reads guides/guidance/codes from this dir | bare string slug |
| **2** | `organizations` row | app Supabase, via `reviews.jurisdiction_organization_id` | **Display + a FK to hang a review on** | `slug` (unique index `baseline.sql:340`); **no** type/`is_jurisdiction` column |
| **3** | `jurisdictions` table | **Library** Supabase project `jkbuvkwnrrvunqgrkeol` (`dsd/library/tooling/migrations/001_jurisdictions.sql`) | **GTM / expansion research** — population, permits-per-capita, code platform; linked to Census GEOIDs (`metro_ahjs.jurisdiction_id`); also training (`historic_comments`) | `(name, state)` unique |

These three namespaces never reconcile:

- **Runtime truth is the bare slug.** The review workflow takes `jurisdiction` as a required input (`bureau/workflows/review/workflow.yaml:24-27`), defaulting to `'austin'` in Substation (`substation/src/inngest/functions/workflow-run.ts:50-60`) and conductor (`conductor/src/index.ts:333-335`). It is used only to select the `bureau/jurisdictions/{{ input.jurisdiction }}/…` directory (`workflow.yaml:147-150`). Neither UUID is consulted at runtime.
- **The org row is derived, not authoritative.** `conductor/src/shared/review-saver.ts:338-354` takes the runtime slug and does `organizations WHERE slug = <slug>` at **save** time, storing the resulting UUID on the review (`:510-530`). cityhall reads it back purely for display.
- **The Library table is a different concern.** Austin there is `a4d41482-a44a-489e-937e-145bfd2a0a84`; that UUID is **never referenced** by the product. It tracks ~50 expansion candidates, most of which we do not operate in.

**Modeling smell (why jurisdiction-as-organization is wrong):**

1. **No discriminator.** Jurisdictions and customer orgs share one table, distinguished only by slug convention. You cannot cleanly enumerate jurisdictions or enforce integrity.
2. **Inverted dependency.** The real key is the Bureau slug; the org row is a downstream display shim. Modeling the authority as a derived FK is backwards.
3. **Directly causes P1.**
4. **Already fragile.** Local seed slug is `city-of-austin` (`substation/supabase/seed.sql`) but the runtime lookup queries `slug = 'austin'`. They line up only by convention — a latent mismatch (see Q3).

### P3 — No way to mark a version as submitted to the city, with jurisdiction-specific labels

Not every `submission_version` is submitted to the city — they are the civil firm's drafts/iterations. Austin labels the first city submission `U0`, the second `U1`, etc.; other jurisdictions differ (e.g. `Rev A`, `Rev B`). `submission_version` today has `version_number`, `label` (free-text draft note, already rendered as `Site Plan v3 — {label}` at `cityhall/src/routes/(app)/project/[projectId]/+layout.ts:71`), `status`, `submitted_at` (`baseline.sql:662-677`). There is no field for the city-submission designation, and no place to display it.

### Worked example (real data — Lamar + Collier)

- Project `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, `site_plan` submission `cf1201c2-2e8b-4034-9a5e-a70b6317e39a`, **4** `submission_version` rows.
- A `review_type=crc` review `ed5e7ba9-ba03-4000-abb4-1021ebec0631` has `jurisdiction_organization_id = 4d99ef5b-bf5c-4ead-a8ac-8e3557a880d3`.
- Target labeling: version #4 → `U0`; versions #5, #6 are drafts toward `U1`; version #7 → `U1`. We must show #5 and #6 as **"U1 (draft)"** without introducing a third number (they already have `version_number` v5/v6).

---

## Decisions

- **D1 — Canonical jurisdiction identifier = the Bureau slug** (`'austin'`, `'cedar-park'`, …). It is already the de-facto runtime key and has 58 real entries. Everything new keys on it.
- **D2 — Path A ships the feature without the big refactor.** Add project-level jurisdiction as a plain `project.jurisdiction_slug TEXT` (no new table yet), the `city_submission_number` column, and a display-layer label adapter + derivation. Do **not** touch `review-saver.ts` or the reviews write path.
- **D3 — Path B (fast-follow) does the proper fix**: a new **app-side** `jurisdictions` table keyed on the canonical slug; `project.jurisdiction_slug` becomes an FK; `reviews` migrates off `organizations`-as-jurisdiction. Specced here as direction, not implementation-ready.
- **D4 — Store only the fact, derive the presentation.** `city_submission_number` is stored **only** on versions actually submitted to the city (NULL elsewhere). Draft cycle labels ("U1 (draft)") are **derived at read time**, never stored.
- **D5 — Canonical submission number is a 1-based ordinal.** `1` = first city submission. The per-jurisdiction adapter owns the base-offset and prefix (Austin: `n → "U" + (n-1)`, so `1 → "U0"`). The DB never encodes Austin's 0-indexing quirk.
- **D6 — Writes are manual DB edits for now** (both `jurisdiction_slug` and `city_submission_number`). No UI write path in this spec.
- **D7 — Reuse of the Library `jurisdictions` table is rejected** (see Path B §Rejected alternative).

---

## Path A — implementation-ready

### A1 — Project-level jurisdiction

```sql
ALTER TABLE public.project
  ADD COLUMN jurisdiction_slug TEXT;   -- canonical Bureau slug, e.g. 'austin'
```

- Nullable for now (existing rows have none). Not yet an FK (the table it would reference arrives in Path B).
- **Backfill:** for projects with a current review, set `jurisdiction_slug` from that review's `organizations.slug` (the value `review-saver` already resolved). Projects without a review (P1's motivating case) stay NULL until set manually (D6). Note the projects list shows both Austin *and* Cedar Park, so backfill is **not** a blanket `'austin'` (see Q1).
- cityhall's projects-list jurisdiction display (`+layout.server.ts:27-36`) is unchanged in Path A — it keeps deriving from the current review. Path B switches it to read `project.jurisdiction_slug`.

### A2 — `submission_version.city_submission_number`

```sql
ALTER TABLE public.submission_version
  ADD COLUMN city_submission_number INTEGER;   -- NULL = not submitted to the city

-- one "1st submission" per submission (fat-finger guard for manual writes)
CREATE UNIQUE INDEX submission_version_city_submission_number_key
  ON public.submission_version (submission_id, city_submission_number)
  WHERE city_submission_number IS NOT NULL;

-- fast previous/next city-submission lookup (partial → only real submissions)
CREATE INDEX submission_version_city_submitted_idx
  ON public.submission_version (submission_id, version_number)
  WHERE city_submission_number IS NOT NULL;
```

- The existing `label` column is **untouched** (it remains the firm's free-text draft note).
- NULL — not `-1` — is "not submitted." Presence of the value is the flag; no separate boolean.

Standalone "previous city submission" query (cityhall does not need it — see A5):

```sql
SELECT * FROM submission_version
WHERE submission_id = :sid AND version_number < :n
  AND city_submission_number IS NOT NULL
ORDER BY version_number DESC LIMIT 1;   -- backward range scan on the partial index
```

### A3 — Jurisdiction label adapter

One-directional (`int → label`), keyed on the canonical slug. Lives in cityhall (`src/lib/jurisdiction.ts` alongside the existing `jurisdictionLabel()`).

```ts
// canonical city_submission_number is 1-based; adapter owns base-offset + prefix
type LabelScheme = (n: number) => string;

const SCHEMES: Record<string, LabelScheme> = {
  austin: (n) => `U${n - 1}`,                       // 1 -> "U0", 2 -> "U1"
  // example of a non-numeric scheme (not live):
  // 'some-city': (n) => `Rev ${String.fromCharCode(64 + n)}`,  // 1 -> "Rev A"
};

export function citySubmissionLabel(
  slug: string | null | undefined,
  n: number,
): string | null {
  const scheme = slug ? SCHEMES[slug] : undefined;
  return scheme ? scheme(n) : null;   // null => caller falls back to plain "Submitted"/"Draft"
}
```

### A4 — Draft-cycle derivation (read time, integer-only)

Given a submission's versions sorted by `version_number`, and the project's `jurisdiction_slug`, compute each version's display label. Three rules:

1. **Stamped** → its own label: `citySubmissionLabel(slug, v.city_submission_number)`.
2. **Un-stamped, something stamped after it** → that next cycle, as a draft. (Retroactive: once v7 is `U1`, v5/v6 read "U1 (draft)".)
3. **Un-stamped, nothing stamped after it** → the in-flight cycle = `(max stamped number before it, or 0) + 1`, as a draft. (v5 after v4=`U0`: `1 + 1 = 2` → adapter → "U1 (draft)" — **immediately, without waiting for v7**.)

If the adapter returns null (no jurisdiction resolved, or a slug with no scheme), fall back to plain `"Draft"` / `"Submitted"` rather than erroring.

```ts
// versions: sorted ascending by version_number; slug: project.jurisdiction_slug
function deriveLabels(versions: VersionRow[], slug: string | null) {
  return versions.map((v, i) => {
    if (v.city_submission_number != null)
      return citySubmissionLabel(slug, v.city_submission_number) ?? 'Submitted';

    const nextStamped = versions.slice(i + 1).find((w) => w.city_submission_number != null);
    const maxBefore = Math.max(
      0,
      ...versions.slice(0, i).map((w) => w.city_submission_number ?? 0),
    );
    const cycle = nextStamped?.city_submission_number ?? maxBefore + 1;
    const label = citySubmissionLabel(slug, cycle);
    return label ? `${label} (draft)` : 'Draft';
  });
}
```

Because the number is derived purely from integers, there is **no string parsing** — the `U0 → U1` increment happens as `n + 1` at the ordinal level and the adapter formats once at the end.

### A5 — cityhall display

- Extend the submission-version fetch to include the new column: `submission_version(id, version_number, label, status, submitted_at, city_submission_number)` (`cityhall/src/routes/(app)/project/[projectId]/+layout.ts:105-111`; local `VersionRow` interface `:14-20`).
- cityhall already fetches **all** versions for a submission in one shot and sorts them (`extractVersions` `:29-34`), so derivation is an **O(n) in-memory pass** (A4) — no extra query, no round-trip.
- Render a badge in the two places versions are shown: the project dashboard list (`project/[projectId]/+page.svelte:258-262`) and the switcher label (`+layout.ts:71`). Reuse the existing inline badge pattern (`px-1.5 py-0.5 rounded text-[10px] font-medium`) in a distinct color (e.g. indigo) so a city marker (`U0`) reads differently from a status chip.
- Regenerate generated types — **two copies**: `substation/src/types/database.types.ts` and `cityhall/src/lib/types/database.ts:2363-2400`. Add `city_submission_number` / `jurisdiction_slug` to the relevant Zod schemas in `substation/src/schemas/`.

### A6 — Pre-build task

Confirm the actual jurisdiction org slugs in prod and that they equal the canonical Bureau slugs (Q3). Local seed uses `city-of-austin` while runtime resolves `austin`; the Lamar + Collier CRC review saved successfully, implying prod uses `austin`. Verify before relying on the slug as the canonical key.

---

## Path B — direction / fast-follow (not implementation-ready)

Fix the root cause from P2/D3. Ships as its own spec + PRs because it touches the reviews write path.

### B1 — App-side `jurisdictions` table

New table in the **app (substation)** Supabase, keyed on the canonical slug, seeded from the 58 Bureau dirs:

```sql
CREATE TABLE public.jurisdictions (
  slug          TEXT PRIMARY KEY,          -- canonical, == bureau/jurisdictions/<slug>
  display_name  TEXT NOT NULL,             -- "City of Austin"
  state         TEXT,
  -- Path-B-future: submission_label_scheme drives A3's adapter data-side
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `project.jurisdiction_slug` becomes `REFERENCES public.jurisdictions(slug)` (real referential integrity — the thing Path A defers).
- `reviews.jurisdiction_organization_id` → migrate to `reviews.jurisdiction_slug` (or inherit from `project`). `review-saver.ts:338-354` stops doing the `organizations`-by-slug lookup; it writes/reads the canonical slug directly.
- cityhall jurisdiction reads switch from `organizations.name` joins to `jurisdictions.display_name`.
- `organizations` stops doubling as the jurisdiction registry.

### B2 — Data-driven label scheme (future)

Move A3's adapter registry from code to a `jurisdictions.submission_label_scheme` column, so onboarding a new city's labeling convention is data, not a code change.

### Rejected alternative — reuse the Library `jurisdictions` table (D7)

Considered and rejected for reasons that are structural, not stylistic:

1. **Cross-project FK is impossible.** The Library table is in a *separate* Supabase project (`jkbuvkwnrrvunqgrkeol`). Postgres FKs cannot cross project boundaries, so `project.jurisdiction → jurisdictions.id` could never be a real FK — only a soft app-level check, i.e. the same fragility we are removing. **Decisive.**
2. **Different concern / lifecycle / owner.** Library is GTM research ("maintained by the Cartographer agent"), ~50 expansion candidates keyed `(name, state)`, most not operated in. Coupling it to the review path puts research churn in the blast radius of production review integrity.
3. **Reuse doesn't even save the mapping.** Library has no slug column and its rows aren't guaranteed 1:1 with the 58 Bureau dirs, so a reconciliation layer is still required — coupling cost without the DRY payoff.
4. **Hot-path coupling.** A core product read would depend on a second Supabase project at request time (second failure domain, cross-project service-role creds, RLS spanning projects).

**Resolution:** one source of truth *per concern*. The app owns its operational `jurisdictions` table (slug-keyed, agrees with Bureau by construction); the Library table stays the GTM registry. If the two ever need joining, add the canonical slug as a thin **bridge column** on the Library table — deliberate, non-load-bearing, never a cross-project FK.

---

## Scope boundaries

- **Deferred to Path B:** app `jurisdictions` table, FK integrity for `project.jurisdiction_slug`, migrating `reviews`/`review-saver.ts` off `organizations`-as-jurisdiction, switching cityhall jurisdiction display to the new table, data-driven label schemes.
- **Not in scope at all:** any change to Bureau's runtime slug contract; any change to the Library `jurisdictions` table or `dsd/library`; a UI write path for setting jurisdiction or city-submission number (manual DB edits per D6); reconciling the Library UUID namespace with the app.

---

## Open questions

- **Q1** — Backfill policy for `project.jurisdiction_slug`: derive from the current review's org slug where a review exists, leave NULL otherwise. Confirm there is no project that should be Cedar Park but would be mislabeled. Should projects with **no** review be backfilled at all, or left NULL until manually set?
- **Q2** — Does `city_submission_number` belong on `submission_version`, or should the whole U0/U1 sequence be scoped to the `submission` (the single `site_plan` submission)? Spec assumes per-`submission_version` with the sequence implicitly owned by its parent submission; the partial unique index is on `(submission_id, city_submission_number)`.
- **Q3** — Confirm prod jurisdiction org slugs equal the canonical Bureau slugs (`austin`, not `city-of-austin`). Local seed diverges (`seed.sql`). This is the A6 pre-build task and gates using the slug as the canonical key.
- **Q4** — Adapter home: code registry in `cityhall/src/lib/jurisdiction.ts` (Path A) vs. the `submission_label_scheme` column (Path B/B2). Confirm Path A ships the code registry and B2 migrates it.
- **Q5** — Should Path A's `jurisdiction_slug` be added to `submission` as well, or is `project`-level sufficient? (A project is one address → one jurisdiction; spec assumes project-level.)
- **Q6** — Is there any real case for a single `submission_version` carrying city labels for **two** jurisdictions at once? If yes, the single-column model breaks and pushes toward a join table. Spec assumes no.
