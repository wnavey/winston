# SIR Geometry — MVP Experiment

**Status:** Shipped (experimental) — record of what was built, not a forward design spec
**Date:** 2026-08-07
**Repos touched:** `substation` (PostGIS `geo` table + `sir_parcels` RPC), `cityhall` (feature-flagged parcel map on the SIR page)
**Repos NOT touched:** `bureau` (the SIR/diligence pipeline is unchanged — geometry is uploaded out-of-band), `conductor`
**PRs:** substation#202 (merged), cityhall#624 (merged), cityhall#625 (open — map controls + geo-type tabs)
**Prod:** Supabase project **Noetic App** (`mgxqsrjutswbciyrltwd`)

> This is an intentionally small, throwaway-friendly experiment to answer one question: *can we store real parcel geometry in the DB and render it interactively on the SIR page?* Yes. It is behind a Vercel flag (`sir-enable-map-view`, default off in prod) and is not wired into the bureau pipeline. "Perfection is the enemy of progress" was the explicit operating principle — several correct-but-larger designs were deliberately deferred (see §7).

---

## 1. Problem / goal

The SIR page (`/project/[projectId]/sir/[sirId]`) had no spatial view of the subject property. We had county parcel rings on disk from a diligence run (`working/sir/hutton/car-wash-louisville-ky/2026-08-01-083311/output/1.2-site-jurisdiction/location-resolution/parcel-rings.geojson`) but nowhere to put them and no way to see them.

Success criteria (all met):
1. A Supabase table for parcel/easement geometry.
2. The Louisville KY parcels uploaded to it in both a local projected CRS and WGS84.
3. Behind a flag, a "view parcel map" section on the SIR page that renders the geometry with an open-source map library.

---

## 2. Data model — the `geo` table

Migration: `substation/supabase/migrations/20260807130000_geo_parcels.sql`. PostGIS is enabled into the `extensions` schema (Supabase convention); all geometry references are schema-qualified to avoid `search_path` surprises at apply time.

```sql
create table public.geo (
  id            uuid primary key default gen_random_uuid(),
  sir_id        uuid not null references public.site_intelligence_report(id) on delete cascade,
  kind          text not null,                      -- 'parcel' | 'easement' | ...
  label         text,
  geom_local    extensions.geometry not null,       -- authoritative; projection varies by jurisdiction
  srid_local    integer not null,                   -- EPSG code of geom_local (e.g. 3089 = KY Single Zone, ftUS)
  geom_wgs84    extensions.geometry(Geometry, 4326),-- derived, for web maps; never hand-edit
  stated_area   double precision,                   -- sq ft, from the source document
  computed_area double precision
                generated always as (extensions.st_area(geom_local)) stored,
  closure_error double precision,                   -- feet; null if not traversed
  source_doc    text,
  method        text,                               -- 'county_api' | 'traverse'
  properties    jsonb,                              -- passthrough of source-feature props
  created_at    timestamptz not null default now(),
  constraint geo_srid_local_matches check (extensions.st_srid(geom_local) = srid_local)
);
-- gist indexes on both geometry columns; btree on sir_id.
-- RLS enabled, NO policies -> service_role-only (mirrors sir_share_link).
```

### Key decisions

- **D1 — Dual SRID, `geom_local` authoritative.** Each geometry is stored twice: an authoritative planar copy (`geom_local`) for area/measurement and a WGS84 copy (`geom_wgs84`, EPSG:4326) for web maps. `computed_area` is a generated `ST_Area(geom_local)`.
- **D2 — `geom_local` is SRID-flexible (revised mid-experiment).** The first cut hard-coded `geometry(Geometry, 3089)` (Kentucky Single Zone, US survey feet). That is immediately limiting — the correct local projected CRS varies by jurisdiction. So the column type was relaxed to an unconstrained `extensions.geometry`, and the EPSG code moved into `srid_local integer not null`, guarded by a check constraint `ST_SRID(geom_local) = srid_local` so the stored code can't drift from the geometry. This was applied to prod as an `ALTER` after the table already existed (see §6).
  - **Consequence:** `computed_area`'s *units* now follow `srid_local`'s projection — square feet for 3089 (ftUS), square meters for a metric zone. Accepted for the experiment; flagged for future normalization (Q1).
- **D3 — Keyed by `sir_id`, `on delete cascade`.** Geometry belongs to a Site Intelligence Report. (Chosen over `project_id` — geometry rides with the report.)
- **D4 — RLS-locked to `service_role`, no policies** (mirrors `sir_share_link`). cityhall reads it through the service role after an app-level access check (see §4).

---

## 3. The read path — `sir_parcels(uuid)` RPC

Function: `substation/supabase/functions/geo_helpers.sql` (house style — RPCs live in `functions/`, applied via `db:apply-functions`, not inline in the migration).

`sir_parcels(p_sir uuid) returns jsonb` — a GeoJSON **FeatureCollection** in WGS84 (`ST_AsGeoJSON(geom_wgs84)`), one Feature per row, `properties` merging the source passthrough with normalized fields (`id`, `kind`, `label`, `computed_area`, `stated_area`, …). It reads `geom_wgs84` only, so the `geom_local` SRID refactor (D2) never touched it.

- **D5 — `SECURITY DEFINER`, execute revoked from `PUBLIC`, granted only to `service_role`.** SECURITY DEFINER RPCs default to `PUBLIC` execute in Postgres, so the explicit `REVOKE … FROM public` is load-bearing.

---

## 4. The wire — how geometry reaches the browser

```
sir_parcels(sirId) RPC  ──▶  +page.server.ts loadMapView()  ──▶  +page.ts forwards
                        ──▶  +page.svelte data.parcels → filtered FeatureCollection
                        ──▶  <PropertyMap featureCollection=… />  ──▶  maplibre GeoJSON source + fill/line layers
```

`cityhall/src/routes/(app)/project/[projectId]/sir/[sirId]/+page.server.ts` → `loadMapView(sirId, locals)`:
1. **Flag gate first** — `if (!(await sirMapViewEnabled())) return { mapViewEnabled:false, parcels:null }`. Returns *before* any DB work.
2. **RLS-scoped visibility pre-check** — a `locals.supabase` (user client) select of the SIR row. If the user can't see the SIR under their own RLS, don't surface its geometry. This mirrors the `+page.ts` `sirs.find` membership guard and compensates for the table being service-role-only.
3. **Service-role read** — `supabaseAdmin.rpc('sir_parcels', { p_sir })`. (The RPC isn't in the generated DB types yet; cast locally rather than regenerating types for a flagged experiment — Q2.)

`+page.ts` forwards `{ mapViewEnabled, parcels }`; `+page.svelte` renders the flag-gated section.

- **D6 — Authenticated `(app)` route only.** The public `/share/sir/[token]` route was deliberately left out of scope.

---

## 5. The UI

Component: `cityhall/src/lib/ui/maps/PropertyMap.svelte` (pre-existing, extended). Library: **maplibre-gl v6** with the **OpenFreeMap** "liberty" basemap — both were already app dependencies and the tile host was already whitelisted in the CSP, so no new library and no CSP host additions were needed for the happy path.

- **D7 — Lazy + flag-gated end to end.** With the flag off: no `sir_parcels` RPC, no visibility query, no GeoJSON over the wire, and `PropertyMap` never mounts → `maplibre-gl` (hundreds of KB) is never dynamically imported and no tiles/glyphs/worker are fetched. The only residual cost is one cached flag evaluation + a few KB of component wrapper already shipped for the project Data tab.
- **D8 — `featureCollection` prop.** `PropertyMap` gained an optional `featureCollection` prop (multi-parcel) alongside the existing single-`parcelFeature` / marker paths; it fits the combined bounds of all features.
- **D9 — Scroll-zoom disabled, explicit controls** (cityhall#625). Wheel/trackpad-scroll over the map used to zoom it and hijack page scroll; now `scrollZoom.disable()` lets the page scroll. Overlay controls (top-right, mingcute icons): zoom out / **recenter** / zoom in. Recenter re-runs the initial `fitBounds`, restoring the original zoom and centering on the parcels. Click-drag to pan is unchanged. (This lives in the shared `PropertyMap`, so it also improves the project Data-tab map.)
- **D10 — Geo-type tabs** (cityhall#625). A tab bar above the map, one tab per geo `kind` present, defaulting to **Parcels** (`kind=parcel`); the overlay is filtered to the active tab's kind. Today that's a single Parcels tab holding all parcel-kind geos. Future kinds (e.g. "Recorded Encumbrances") drop into a `GEO_TABS` list and get a tab + kind-filtered overlay for free. The map is `{#key activeGeoKind}`-wrapped so a tab switch re-inits it with the filtered FeatureCollection.

---

## 6. Gotchas / lessons

- **G1 — maplibre v6 worker 404 in the production build (the big one).** maplibre v6 loads its web worker via `import.meta.url`; Vite + `adapter-vercel` don't emit that chunk at the referenced path, so `/_app/immutable/chunks/maplibre-gl-worker.mjs` **404s in the deployed build**. The worker parses *both* vector tiles and GeoJSON, so its failure renders a completely blank map (background color only) with a live map object — no console error, only Report-Only CSP noise. It works in `vite dev` (dev serves workers differently), so it only appears on a deployed build.
  - **Fix (cityhall#624):** import the worker as a Vite-bundled asset URL — `import url from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'` — and pin it via `maplibregl.setWorkerUrl(url)`, with `worker: { format: 'es' }` in `vite.config.ts` so it's a module worker matching maplibre's `new Worker(url, { type: 'module' })`. Verified the client build now emits `_app/immutable/workers/maplibre-gl-worker-<hash>.js` with its shared chunk inlined (nothing left to 404).
  - This also repaired the pre-existing project Data-tab map, which was silently hitting the same 404 in prod.
- **G2 — Diagnosing G1.** Ruled out in order: data path (the section rendered, so the RPC/wire worked); CSP (emitted **Report-Only** in `hooks.server.ts`, blocks nothing); Vercel Deployment Protection (root `/` returned cityhall's *own* login page, not a Vercel SSO wall). A direct fetch of the worker URL returned **HTTP 404** — the smoking gun.
- **G3 — CSP was misconfigured for maplibre v6 (fixed for the eventual enforce-flip).** The Report-Only CSP flagged the same-origin worker (`worker-src` lacked `'self'`) and 26 glyph fonts (`font-src` lacked `tiles.openfreemap.org`). Not the live blocker (Report-Only), but it would hard-break the map the moment CSP is enforced (the stated plan). Fixed: `worker-src 'self' blob: <cdnjs>`, `font-src 'self' data: <openfreemap>`.

---

## 7. Scope — deliberately deferred

- Not wired into the **bureau SIR/diligence pipeline** — geometry is uploaded by a one-off Claude Code session, not produced by a workflow step.
- The `sir_parcels` RPC returns **all kinds**; the `kind` filter is applied client-side. Fine at this scale; push into the RPC if the table grows or gains many kinds.
- The public **share route** is out of scope (D6).
- No editing UI, no write path from the app, no versioning of geometry.
- Only the **Parcels** tab exists; other geo kinds are future work (D10).

---

## 8. Open questions / follow-ups

- **Q1 — `computed_area` units.** They follow `srid_local`'s projection. If we want one canonical unit across jurisdictions, compute area from a fixed equal-area projection or `geom_wgs84::geography` instead. Deferred.
- **Q2 — Generated DB types.** `sir_parcels` is cast locally because it isn't in cityhall's generated `Database` types. Regenerate types when this graduates from experiment.
- **Q3 — Who populates `geo`?** Today: a manual session. If this graduates, a pipeline step (surveyor / parcel-resolution) should write `geo` rows as part of a run. See sibling workspace `parcel-resolution-audit`.
- **Q4 — Heading vs tabs.** The section is still titled "Parcel Map"; once non-parcel kinds land, a neutral title ("Site Map"/"Geometry") is more honest.

---

## 9. References

- **DB:** `substation/supabase/migrations/20260807130000_geo_parcels.sql`, `substation/supabase/functions/geo_helpers.sql`. Applied to prod `mgxqsrjutswbciyrltwd`.
- **UI:** `cityhall/src/lib/flags.ts` (`sirMapViewEnabled` / `sir-enable-map-view`), `.../sir/[sirId]/+page.server.ts` (`loadMapView`), `.../+page.ts`, `.../+page.svelte`, `cityhall/src/lib/ui/maps/PropertyMap.svelte`, `cityhall/vite.config.ts` (`worker.format`), `cityhall/src/hooks.server.ts` (CSP).
- **Seed data:** 2 parcels for SIR `caac753c-128b-4311-8d10-2480be0268eb` (project `02a3a7c7-a283-4605-becc-a125b8112127`), from `parcel-rings.geojson`. Source geojson is WGS84; `geom_local` is EPSG:3089 (KY Single Zone, ftUS) derived via `ST_Transform`, `srid_local = 3089`. `computed_area` = 1.023 / 2.608 ac, matching county-stated acreage.
- **PRs:** substation#202, cityhall#624, cityhall#625.
