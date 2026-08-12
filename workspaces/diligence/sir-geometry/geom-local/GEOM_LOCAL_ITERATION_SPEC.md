# `geo` table iteration — `geom_local` becomes optional; WGS84 is the datum

**Status:** Draft v1
**Date:** 2026-08-12
**Repos touched:** `substation` (one `geo`-table migration — nullable local geometry, geodesic `computed_area`), `claude-plugins` (the `upload-sir` skill gains a parcel-geo write step)
**Repos NOT touched:** `cityhall` (the `sir_parcels` RPC + map read `geom_wgs84` only — unaffected), `bureau`, `conductor`
**Prod:** Supabase project **Noetic App** (`mgxqsrjutswbciyrltwd`)
**Siblings:** [`../MVP-EXPERIMENT.md`](../MVP-EXPERIMENT.md) (the `geo` table + map as-built), [`../ingesting-supporting-docs-3089/SPEC.md`](../ingesting-supporting-docs-3089/SPEC.md) (the plat → `geo` reconstruction skill this must stay compatible with)

> This is an iteration spec, not a greenfield design. It records findings from a live session (uploading the Katy, TX VA parcel to `geo`) and turns them into a small, safe schema change plus one skill wiring. The thesis: **for county-sourced parcels, WGS84 is the authoritative datum and any local projection is derivable — so we should stop forcing a `geom_local` (and the arbitrary SRID choice behind it) at write time.**

---

## 1. Problem

The `geo` table (MVP-EXPERIMENT §2) stores every geometry twice and makes the **local projected copy authoritative and mandatory**:

```sql
-- substation/supabase/migrations/20260807130000_geo_parcels.sql
geom_local    extensions.geometry not null,     -- authoritative; projection varies by jurisdiction
srid_local    integer not null,                 -- EPSG code of geom_local
geom_wgs84    extensions.geometry(Geometry, 4326),  -- derived, for web maps; nullable
computed_area double precision
              generated always as (extensions.st_area(geom_local)) stored,
constraint geo_srid_local_matches check (extensions.st_srid(geom_local) = srid_local)
```

That `not null` on `geom_local` + `srid_local` forces every writer to **pick a local projected CRS**. For the two data sources we actually have, that requirement is either wrong or unnecessary:

- **County-API parcel rings** (`method='county_api'`, `source_doc='parcel-rings.geojson'`) arrive from the county as **WGS84 lon/lat**. There is no "local geometry" in the source — `geom_local` is a *derived* `ST_Transform`, and the SRID is a **convention we have to invent**. Picking it is genuinely ambiguous (see §2). WGS84 is the source of truth here.
- **Recorded-plat reconstructions** (`method='traverse'`, the `supporting_doc_*` kind from the sibling SPEC) genuinely *are* authored in a specific State Plane zone — the plat prints the zone and the ftUS coordinates. There `geom_local` is authoritative and the SRID is a **fact read off the sheet**, not a convention.

So the authority direction differs by source, but the schema hard-codes one direction (local authoritative, mandatory) for both. The county path pays an invented-convention tax it shouldn't.

### 1.1 Verified current state (prod `mgxqsrjutswbciyrltwd`)

- **PostGIS 3.3.7 / PROJ 9.4.0** installed in the `extensions` schema.
- Table has **8 rows across 2 SIRs**:
  - SIR `caac753c-128b-4311-8d10-2480be0268eb` (Louisville car-wash): 2× `parcel` (`county_api`, 3089), 2× `easement_sanitary_drainage` (`estimated`, 3089), 3× `supporting_doc_2024178771` (`traverse`, 3089) — all `srid_local = 3089` (KY Single Zone, ftUS).
  - SIR `cceb8962-9851-4e08-9e69-0e022f043a0a` (Katy VA): 1× `parcel` (`county_api`, 2278), row `bbbba332-1868-4dba-9e27-3aaee0d2c4cf`, uploaded **this session** — see §6.
- **All 8 rows currently have both `geom_local` and `geom_wgs84` populated** (relevant to migration safety, §4).
- The `sir_parcels(uuid)` RPC (`substation/supabase/functions/geo_helpers.sql`) reads **`geom_wgs84` only** (`ST_AsGeoJSON(geom_wgs84)`); MVP-EXPERIMENT §3 confirms "it reads `geom_wgs84` only, so the `geom_local` SRID refactor never touched it."

---

## 2. Why "pick the local SRID" is the wrong problem (evidence)

For a US parcel, `srid_local` would be a NAD83 State Plane zone's EPSG code. State Plane zones are legally defined **per county**, so this looked like a `county-FIPS → EPSG` lookup. But a live pyproj probe (pyproj 3.6.1 / PROJ 9.3.0) shows point-based selection is **ambiguous**, and even a curated table can't reproduce our own existing rows:

| Point | Deterministic UTM (`query_utm_crs_info`) | State Plane NAD83 ftUS candidates whose area-of-use contains the point (`query_crs_info`, `contains=True`) |
|---|---|---|
| Katy, TX (29.7805, −95.8060) | **EPSG:26915** (single, clean) | 2277 Texas **Central**, **2278 Texas South Central** ✓, 32165 BLM 15N |
| Louisville, KY (38.187, −85.637) | **EPSG:26916** (single, clean) | 2246 KY North, **2965 Indiana East** (wrong *state*), **3089 KY Single Zone** ✓, 32166 BLM 16N |

Two independent problems:

1. **Area-of-use boxes overlap.** They're rectangles; zones are irregular. So a Houston point "contains-matches" Texas *Central* and a Louisville point matches *Indiana* East. The query cannot pick.
2. **Multiple zones legitimately cover the same point.** Both KY North (2246) and KY Single Zone (3089) are valid for Louisville. The existing rows use **3089 — not from any lookup, but because the recorded plat cited "KY State Plane Single Zone,"** and that propagated to the county rows too. **A plat-less, automated path cannot rederive that choice from geometry.** It is a convention, not a coordinate fact.

**Conclusion:** for the county path there is no non-arbitrary `srid_local`. Rather than encode a convention, drop the requirement — store WGS84, derive a local only when something authoritative demands a specific zone.

### 2.1 We don't even need a projection to get area

`computed_area` was the main consumer of `geom_local`. PostGIS `geography` computes geodesic area on the WGS84 ellipsoid with **no SRID choice**. Measured on the live Katy row:

| Method | Area |
|---|---|
| `ST_Area(geom_wgs84::geography)` (geodesic) | **16.138 ac** |
| `ST_Area(geom_local)` in EPSG:2278 (planar ftUS) | **16.135 ac** |
| HCAD stated | 16.0633 ac |

Geodesic and State-Plane-planar agree to 3 decimals. So area needs no local CRS at all — which is exactly MVP-EXPERIMENT **Q1** ("compute area from a fixed equal-area projection or `geom_wgs84::geography` instead. Deferred."). This spec un-defers it.

---

## 3. Design

Invert the authority model: **`geom_wgs84` is the one required geometry** (the render source for every kind, and the authoritative datum for county-sourced rows). `geom_local` + `srid_local` become **optional**, populated only when a local projection is authoritative (plat rows) or cached (future, §5).

### 3.1 Schema — after

```sql
geom_wgs84    extensions.geometry(Geometry, 4326) not null,   -- D1: now required; render source + county datum
geom_local    extensions.geometry,                            -- D2: now nullable; authoritative only for plat rows
srid_local    integer,                                        -- D2: now nullable
computed_area double precision
              generated always as (extensions.st_area(geom_wgs84::extensions.geography)) stored,  -- D3: geodesic, m²
-- D4: local geometry and its SRID must both be present or both absent
constraint geo_local_pairing check ((geom_local is null) = (srid_local is null)),
-- unchanged: when geom_local is present it must carry srid_local; NULL (both absent) passes
constraint geo_srid_local_matches check (extensions.st_srid(geom_local) = srid_local)
```

### 3.2 Decisions

- **D1 — `geom_wgs84 not null`; it is the authoritative datum for county data.** Every row renders from it (the RPC reads it), and for `county_api` rows the source *is* WGS84. Making it required matches reality and lets `geom_local` go optional.
- **D2 — `geom_local` + `srid_local` nullable.** County rows store WGS84 only, no SRID. Plat/`traverse` rows keep populating both (authoritative local from the plat's cited zone + derived WGS84). This is the whole change — it lets the table represent *both* authority directions instead of forcing one.
- **D3 — `computed_area` regenerated from `st_area(geom_wgs84::geography)` → canonical m² across all kinds.** Resolves MVP Q1. Units become square meters everywhere (previously ftUS or m² depending on `srid_local`), so any consumer converts once. `stated_area` still holds the source document's figure for cross-checks; `computed_area` is now a source-independent sanity number that exists for every row.
  - **Postgres note:** a generated column's expression cannot be `ALTER`ed in place — the migration must `DROP COLUMN computed_area` then re-add it. That recomputes it (geodesic) for all rows.
- **D4 — `geo_local_pairing` check: `(geom_local is null) = (srid_local is null)`.** Prevents a local geometry with no SRID, or an orphan SRID with no geometry. The existing `geo_srid_local_matches` check still holds: when both are NULL it evaluates to `st_srid(null)=null` → NULL → passes; when both present it enforces agreement.
- **D5 — County-API write path stores WGS84 only.** No `ST_Transform`, no `srid_local`, no convention. One `INSERT` per parcel feature: `geom_wgs84 = ST_SetSRID(ST_GeomFromGeoJSON(feature.geometry), 4326)`, `geom_local` / `srid_local` left NULL, `method='county_api'`, `source_doc='parcel-rings.geojson'`.
- **D6 — Plat / `supporting_doc` path is unchanged.** The sibling SPEC's §7 write path keeps building an authoritative `geom_local` via `ST_GeomFromText(<wkt>, <srid>)` (SRID = the plat's cited zone, a fact off the sheet) and `geom_wgs84 = ST_Transform(...)`. Nothing in this spec touches that path; the nullable columns simply stop *requiring* it of everyone else.

---

## 4. Migration (safe on the live 8 rows)

All existing rows have both geometries populated (§1.1), so every step is either a loosening or a set-not-null over already-present data:

1. `alter table public.geo alter column geom_wgs84 set not null;` — safe (all 8 rows have it).
2. `alter table public.geo alter column geom_local drop not null;` — loosening.
3. `alter table public.geo alter column srid_local drop not null;` — loosening.
4. `alter table public.geo drop column computed_area;`
   `alter table public.geo add column computed_area double precision generated always as (extensions.st_area(geom_wgs84::extensions.geography)) stored;` — recomputes geodesic m² for all rows.
5. `alter table public.geo add constraint geo_local_pairing check ((geom_local is null) = (srid_local is null));` — existing rows have both present → passes.

No data backfill. The `geo_srid_local_matches` check is retained as-is. Follows the house style in the original migration (schema-qualified `extensions.*`, applied to prod).

### 4.1 Optional cleanup of the Katy row

Row `bbbba332-…` was uploaded this session the *old* way (WGS84 + a derived `geom_local` in 2278, `srid_local=2278`). It's valid under the new model but carries a derived local it doesn't need. Optional: `update ... set geom_local=null, srid_local=null` to make it a canonical WGS84-only `county_api` row. Harmless to leave as-is. Operator's call.

---

## 5. Follow-up: on-demand / cached `geom_local` for supporting-doc comparison

The original reason to store `geom_local` was to have a **reference object in the plat's local CRS** so a recorded plat's ftUS coordinates (e.g. `N:3955342.11 E:4953669`) could be reconstructed and compared against the county "source-of-truth" parcel. That comparison **does not require a pre-stored county `geom_local`**:

- The sibling SPEC §6 gate 3 (IoU + centroid vs. county parcels) uses `ST_Intersection` / `ST_Union` / `ST_Centroid` — all SRID-agnostic as long as both operands share a CRS.
- The plat's zone is known (printed on the sheet). So at comparison time, transform the county parcel's `geom_wgs84` into that zone on demand: `ST_Transform(geom_wgs84, <plat_srid>)`. That is the reference object, minted exactly when needed, in exactly the right zone — the **lazily-instantiated `geom_local`**.

**If persistence is ever wanted** (avoid recomputing, or expose in the app), add a child cache table rather than widening `geo`:

```sql
-- FUTURE, not in this iteration
create table public.geo_local_cache (
  geo_id     uuid not null references public.geo(id) on delete cascade,
  srid_local integer not null,
  geom_local extensions.geometry not null,
  computed_area double precision generated always as (extensions.st_area(geom_local)) stored,
  primary key (geo_id, srid_local),
  constraint geo_local_cache_srid_matches check (extensions.st_srid(geom_local) = srid_local)
);
```

Populated **lazily, for the specific zones actually requested** (i.e. a plat's cited zone) — never by enumerating "all zones that cover the point," which §2 shows is dirty. This keeps `geo` clean (one authoritative WGS84 geometry) and treats projected copies as what they are: derived, cacheable materializations.

---

## 6. Reference: the Katy VA upload (this session)

Done by hand to validate the county-API path end to end.

- **Input:** `working/sir-runbooks/katy-va/v0/phase-1-frame/location-resolution/parcel-rings.geojson` — one WGS84 Feature, HCAD account `1199120070001`, "RES I-4B BLK 2", 16.0633 ac. (Location-resolution is folded into `seed-site-data.md` in this run's layout.)
- **SIR:** `cceb8962-9851-4e08-9e69-0e022f043a0a`.
- **Insert:** `geom_wgs84 = ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)`, `geom_local = ST_Transform(wgs, 2278)`, `srid_local = 2278` (Texas South Central ftUS), `method='county_api'`, `source_doc='parcel-rings.geojson'`. Row `bbbba332-1868-4dba-9e27-3aaee0d2c4cf`.
- **Validation:** `ST_IsValid` true; `computed_area` 702,838 sq ft = 16.135 ac (2278 planar) vs geodesic 16.138 ac vs HCAD 16.0633 — all within <0.5%.
- **Under this spec** the same upload would be `geom_wgs84`-only (no 2278, no transform) and `upload-sir` would emit it automatically at the end of the run (§7 / D5).

The whole "which SRID for Katy" investigation (Texas South Central 2278 vs the ambiguity in §2) is precisely the work this spec removes from the county path.

---

## 7. `upload-sir` wiring (the productization)

This is MVP-EXPERIMENT **Q3** ("Who populates `geo`? … a pipeline step should write `geo` rows as part of a run"). `upload-sir` already produces the `sir_id` (from the `site_intelligence_report` insert) and uploads all other artifacts. Add a final, best-effort step:

1. Locate the run's parcel rings (`parcel-rings.geojson`, at `location-resolution/` or folded into the Phase-1 seed depending on runbook layout).
2. For each Feature: `INSERT INTO public.geo (sir_id, kind, label, geom_wgs84, stated_area, method, source_doc, properties)` with `kind='parcel'`, `geom_wgs84 = ST_SetSRID(ST_GeomFromGeoJSON(feature.geometry), 4326)`, `label`/`properties`/`stated_area` from feature props, `method='county_api'`. **No `geom_local`, no `srid_local`, no SRID selection.**
3. Idempotency: skip if a `parcel`-kind row for this `sir_id` + `source_doc` already exists (a re-publish shouldn't duplicate).

No SRID logic, no lookup table, no new library — just PostGIS `ST_GeomFromGeoJSON`. This is the payoff of the schema change: the automated path has nothing to decide.

---

## 8. Scope — deliberately deferred

- **The `geo_local_cache` table (§5)** — not built now; on-demand `ST_Transform` covers the supporting-doc skill until persistence is proven necessary.
- **UTM as an alternative canonical local** — if a *stored* projected copy is ever wanted for county rows, UTM-from-point (`query_utm_crs_info`) is the deterministic library answer (§2). Not needed while area comes from `geography`.
- **`sir_parcels` RPC / cityhall map** — untouched (read `geom_wgs84` only). Any new consumer wanting a local projection calls `ST_Transform` itself.
- **Generated DB types / RPC in cityhall types** — still the MVP Q2 follow-up; out of scope.
- **Backfill / renaming existing `srid_local=3089` rows** — left as-is; the Louisville plat rows keep their authoritative 3089 local.

---

## 9. Open questions

- **Q1 — `computed_area` unit.** Canonical m² (D3) is source-independent and simplest. Do any current/near consumers expect ft²/acres such that we should expose a second generated column (`computed_area_sqft`) or convert in the RPC? (The RPC currently passes `computed_area` straight through.)
- **Q2 — Should plat rows *also* carry `geom_wgs84` as authoritative-enough for area?** Under D3, `computed_area` for a `traverse` row is geodesic off the *derived* WGS84, not planar off the authoritative `geom_local`. The two differ <0.5%. Acceptable, or should `computed_area` prefer `geom_local` when present (`coalesce`-style: `st_area(geom_local)` if non-null else geodesic)? That reintroduces mixed units — leaning "no, keep it uniformly geodesic," but flagging.
- **Q3 — Idempotency key for the `upload-sir` write.** `(sir_id, kind, source_doc)` vs `(sir_id, kind, label)` vs a stable feature hash. Rings can have multiple features (multi-parcel sites, cf. Louisville's 2 parcels) — the key must not collapse distinct parcels. Lean: `(sir_id, kind, label)` where `label` derives from a stable parcel id (HCAD account), falling back to a per-feature index.
- **Q4 — Do we null out the Katy row's derived local (§4.1)?** Cosmetic consistency vs. leave-it-be.

---

## 10. How to audit this spec

- **DB claims** (prod `mgxqsrjutswbciyrltwd`): the 8-row inventory (§1.1), the `sir_parcels` reads-`geom_wgs84`-only claim (`geo_helpers.sql`), the geodesic-vs-planar area agreement (§2.1), and that all rows have both geometries (migration safety, §4). All are single read-only `select`s.
- **Convention-ambiguity claims (§2):** reproduce with pyproj `query_utm_crs_info` / `query_crs_info` on the two points; confirm the overlapping-box and multi-zone results.
- **Migration safety (§4):** confirm each step is a loosening or a set-not-null over populated data; confirm the generated-column drop/re-add is the only way to change the expression in Postgres.
- **Compatibility (§3.2 D6, §5):** verify nothing here changes the sibling plat-reconstruction SPEC's write path, and that its §6 gate-3 comparison is SRID-agnostic given a shared CRS.
</content>
</invoke>
