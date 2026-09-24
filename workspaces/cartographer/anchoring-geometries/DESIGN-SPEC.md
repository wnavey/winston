# Cartographer — anchoring extracted geometries to the county parcel

**Status:** Draft v1
**Date:** 2026-09-24
**Repos touched:** `surveyor` (read and report each layer's native spatial reference; per-county registry), `bureau` (`site-research` resolve-site records `native_sr`; `arcgis_query.py`; new `anchor-geometry` runbook), `substation` (`sir_add_parcel_geo` fills `geom_local`; `cartographer_files` gets a link to where the document came from; new `cartographer_anchors` table; RPC that writes anchored geometries into `geo`), `cartographer` (`src/lib/geometry/anchor.ts` solvers; extraction records basis-of-bearings, units and scale factor)
**Repos NOT touched:** `cityhall` (the map already draws `geo.geom_wgs84`; a viewer for anchored geometries comes later, §8), `conductor2`, `claude-plugins`
**Prod:** Supabase **Noetic App** (`mgxqsrjutswbciyrltwd`)
**Predecessors:** [`../geometry-extraction/DESIGN-SPEC.md`](../geometry-extraction/DESIGN-SPEC.md) (winston#266, which deferred anchoring as "D3"), [`../geometry-placement/DESIGN-SPEC.md`](../geometry-placement/DESIGN-SPEC.md) (winston#270: frames, translation only, "SRID/WGS84 stays deferred"), [`../geometry-extraction/evidence/DESIGN-SPEC.md`](../geometry-extraction/evidence/DESIGN-SPEC.md) (winston#274)
**Siblings:** [`../../diligence/sir-geometry/geom-local/GEOM_LOCAL_ITERATION_SPEC.md`](../../diligence/sir-geometry/geom-local/GEOM_LOCAL_ITERATION_SPEC.md) (**§3.2 reverses its §2 conclusion**), [`../../diligence/sir-geometry/ingesting-supporting-docs-3089/SPEC.md`](../../diligence/sir-geometry/ingesting-supporting-docs-3089/SPEC.md) (prior art: building a plat from its printed State Plane coordinates, done by hand)
**Research:** IG report `2026-09-23-sir-geometry-source-survey` (inspector-general catalog)
**Source of truth for anchoring and `srid_local`.** This spec supersedes or amends the following; each now carries a dated pointer here:
- geometry-extraction §7 "Anchoring (D3)" and "Coordinate-table primary reconstruction": no longer deferred.
- evidence §9 "Anchoring … still deferred": no longer deferred.
- geometry-placement §5 "Real-world anchoring": now designed here; placement stays translation-only.
- geom-local §2's conclusion: reversed. Its D5 (county rows WGS84 only) is amended by D4 here. Its §5 on-demand comparison moves into the `anchor-geometry` runbook.
- ingesting-supporting-docs-3089: becomes the `fromPrintedCoordinates` solver and the ground-truth fixture.
- MVP-EXPERIMENT: pointer only.

> **In one paragraph.** Cartographer turns metes-and-bounds descriptions into
> exact shapes with no position on the ground: SRID:0, feet, with the point of
> beginning (POB) at (0,0). The SIR pipeline fetches the county's parcel polygon,
> which is on the map (WGS84) but only as precise as the county's tax-map drawing.
> This spec joins the two. Each Cartographer **frame** (a group of figures already
> placed relative to each other) gets **one 2D similarity transform** (rotation,
> translation and scale, with scale usually fixed at 1) into the county's
> **native State Plane coordinate system**. The transform comes from printed
> coordinates when the plat has them (rare), from point or line ties when the
> description names corners, and otherwise from **fitting the figure to the county
> parcel ring** (the common case). Scripts do all the math. An agent only says
> which figure matches which parcel, corner or line, and checks an overlay image.
> An operator accepts or rejects each transform. Accepted transforms produce
> sibling rows in `geo`, with `geom_local` in State Plane and `geom_wgs84` for the
> map. For this to work, the county layer's **native spatial reference, which
> every pipeline currently discards**, must be captured when the parcel is looked
> up.

---

## 1. Problem

### 1.1 Two pipelines, two frames, no link (verified 2026-09-24)

| | SIR parcel ring | Cartographer geometry |
|---|---|---|
| Produced by | `bureau/runbooks/site-research/steps/1-resolve-site/prompt.md` (called from SIR step 1.2) | `bureau/runbooks/extract-geometry-v2` (shells out to `cartographer/runbooks/extract-geometry/scripts/*`) |
| Source | county parcel or appraisal ArcGIS layer (surveyor tool, or `site-research/bin/arcgis_query.py`) | a recorded plat, easement or deed PDF |
| Frame | **WGS84**: every query sends `outSR=4326` (`arcgis_query.py:110`; prompt line 36 says "FeatureCollection, WGS84") | **SRID:0**, feet, +x east and +y north by the plat's own bearings, each ring starts at its POB at (0,0) (`cartographer/src/lib/geometry/traverse.ts:42`, `types.ts:4-7`) |
| Precision | position roughly right; shape is tax-map linework (Bexar's tool says so itself: "Geometry is BCAD/county tax-map linework, not a survey") | shape is survey-exact (closure ≤ 0.01 ft is recorded as `closed`); **position unknown** |
| Lands in | `public.geo` through RPC `sir_add_parcel_geo` (`substation/supabase/functions/geo_helpers.sql:71`, `st_setsrid(st_geomfromgeojson(…),4326)` at :106, `method='county_api'`), called from `bureau/runbooks/sir/bin/publish.ts:811` in step 4.1-upload | `public.cartographer_geometries` (`polygon` jsonb, **not** PostGIS; `frame_key`, `offset_x/y`, `placement_method`) through cartographer `publish.ts` |
| Linked to | `geo.sir_id` → `site_intelligence_report` | `cartographer_files.id` **only**, a manual upload with no link to a project, SIR or `sir_artifact` |

Prod counts (2026-09-24): `geo` has **29 rows across 18 SIRs** (24 SIRs total). **21** are `kind='parcel', method='county_api'` with `geom_local IS NULL`. Only the 8 older hand-built rows (KY 3089, TX 2278) have a local geometry, and only **2 rows** record `properties.native_sr`. `cartographer_files` has **1** row (the car-wash plat 2024178771) with **8** `cartographer_geometries`, all in `frame-1`.

The two sides meet nowhere. That's by design so far: anchoring is deferred in geometry-extraction §7 ("Anchoring (D3). SRID:0 only … the bridge to the `geo` table, later") and in geometry-placement ("SRID/WGS84 stays deferred", placement is translation only).

### 1.2 What real documents give us to anchor with

The 2026-09-23 survey (every supporting document of the 10 newest SIRs: 645 `sir_artifact` rows, 445 unique files, about 6,800 pages, read by vision or text) found **315 unique geometries**. Shares below are of all 315 geometries:
- **Metes and bounds 42%**; dimensioned plat or survey drawing 38%; lot/block reference 24%; Texas abstract/survey reference 19%.
- **State Plane coordinate *values*: 3 geometries (about 1%), none with a stated zone and datum.** Only **one** is a boundary: a bare corner pair on a Conroe tract.
- **25 geometries (8%) name a State Plane grid as their basis of bearings** without giving any coordinates (TX Central NAD83, FL East NAD83(2011), FL West).
- **51% of geometries are closed shapes with no position.** That's exactly what extraction produces, and it's the pool this spec anchors.
- Ties from the POB, among those 160 shapes (rough regex buckets): platted lot or tract corner 26, PLSS section corner 16, road right-of-way or intersection 13, TxDOT or agency monument 5, iron rod or pipe only 40, unclear 60.

**Consequence:** anchoring by joining to State Plane coordinates is the best method but covers under 1% of documents. The workhorse has to be **fitting to the county parcel ring**, which almost every SIR already has. Printed coordinates and corner ties are upgrades that tighten the fit where they exist.

### 1.3 The county layer's native spatial reference is fetched nowhere and discarded

- **surveyor** (main `674ef84`): the parcel tools the SIR uses request WGS84 and report nothing about the layer's own coordinate system. Examples: `src/sources/coa-gis/parcel-lookup.ts:61`, `brevard-county-gis/parcel.ts:50`, `bexar-parcel-gis/tools.ts:64` (whose output field is literally `geometry_wgs84`). A rough sweep of about 327 modules with parcel logic found about 267 that only ever request 4326. 82 declare `GisClientConfig.spatialReference` (`src/lib/gis-client.ts:34`), but **66 of those declare 4326**, so the config value isn't reliably "native" either.
- The 4326 habit is **deliberate for *queries*.** `gis-client.ts:606-649` (`BUFFER_OUT_SR`) records that foot-based output systems make hosted ArcGIS distance buffers 3.28× too large. That's a reason to query in 4326. It isn't a reason to throw away the layer's system.
- **The information costs one metadata request.** Live `?f=json` checks on 2026-09-24:

  | Layer | `wkid` | `latestWkid` (EPSG) |
  |---|---|---|
  | Austin `Shared/AppraisalDistricts/MapServer/0` (TCAD parcels) | 102739 | **2277** NAD83 / Texas Central (ftUS) |
  | Bexar `Parcels/MapServer/0` | 102740 | **2278** NAD83 / Texas South Central (ftUS) |
  | BCAD `PAMapSearch/MapServer/6` | 102740 | **2278** |

  surveyor's layer-identity guard (`src/lib/gis-layer-identity.ts`) **already fetches** each service's `?f=json` once per process, and that response carries the service's spatial reference.
- `spatial_ref_sys` in prod already has 2277, 2278, 2236, 2881, 3089, 6578 and the older ESRI codes (102739, 102740, 102100), so `ST_Transform` works now.

### 1.4 Prior art that constrains this design

- **geom-local §2 (2026-08-12)** showed that choosing a State Plane zone *from a point location* is ambiguous: area-of-use boxes overlap (a Katy point matches TX Central and South Central; a Louisville point matches Indiana East), and some places have two legitimate systems (KY North vs KY Single Zone). It concluded "for the county path there is no non-arbitrary `srid_local`" and made `geom_local` optional. That was true of the inputs available then. **§3.2 supplies a non-arbitrary answer: the system the county's own parcel layer is stored in.**
- The **3089 spec** built the car-wash plat (Jefferson County KY, instrument 2024178771) from its printed State Plane monuments, **by hand** (`geo` rows with `method='traverse'` and `'estimated'`, `srid_local=3089`). The same plat is Cartographer's only file today, and its placement already uses printed northing/easting differences (`placement_method='coordinates'`). **It is our ground truth** (§3.8).

---

## 2. Goals and non-goals

**Goals**
1. Every SIR parcel ring records the county layer's native spatial reference, and gets a `geom_local` in it when that system is a projected State Plane (or other projected) system.
2. A Cartographer file can be traced to the SIR document or documents it came from.
3. A manual, repeatable **`anchor-geometry` runbook** produces, for each frame, a reviewed similarity transform into State Plane, with its method, residuals and an honest **accuracy class**.
4. Accepted anchors produce **sibling `geo` rows** (easements, lots, right-of-way) in the same table the SIR map already reads.

**Non-goals (deferred, §8)**
- Automatic anchoring inside the SIR run; batch triage across SIRs; a map viewer for anchored geometries.
- True curves. Extraction stores chords (`isChord`, `has_approximated_curves`), and anchoring accepts that for v1.
- Elevation, 3D, or geoid work. This is a 2D planar transform.
- State Plane 2022 (NATRF2022). The design keeps an EPSG code per anchor so a later datum migration is a re-transform, not a redesign.

---

## 3. Design

### 3.1 Vocabulary

- **Frame:** geometry-placement's connected group of figures, positioned relative to each other by translation. A figure's local position is `polygon + (offset_x, offset_y)`, in feet, with +y pointing to the plat's own north.
- **Anchor:** one transform per frame, mapping frame-local feet `(x, y)` into State Plane `(E, N)` with `E,N = s·R(θ)·(x,y)·k_units + (tE, tN)`. Here `θ` rotates the plat's basis of bearings onto grid north, `s` is scale (default 1; set to the stated combined factor when the plat converts surface to grid distances), and `k_units` converts feet to the target system's units.
- **Target system:** the EPSG code the anchor is solved in. By default it's the subject parcel's native `latestWkid` (§3.2, Q5).
- **Accuracy class:** `survey` (solved from printed coordinates), `tied` (solved from two or more corner or line ties to located features), `gis_fit` (fitted to county linework, as good as the county's drawing), `approximate` (sketch-level). The class describes where the *position* came from. The *shape* is always survey-exact.

### 3.2 Piece A: capture the native spatial reference when the parcel is looked up

**D1. The county's parcel layer declares the zone; we record it, we don't choose it.** This reverses geom-local §2 for the county path. `srid_local` for a county parcel is the EPSG code the county's parcel layer is stored in, whenever that is a projected system. It isn't a convention and it isn't a location lookup.

**D2. One generic function plus a registry, not per-county code.** A layer's coordinate system is a property of the layer, not of any query, so no per-county logic is needed:
- `surveyor/src/lib/layer-spatial-reference.ts`: `getLayerSpatialReference(layerUrl) → { wkid, latestWkid, wkt?, fetched_at, source: 'layer'|'service' }`, memoized, reusing the service listing the layer-identity guard already fetches.
- A generic `resolve_native_sr(jurisdiction | county_fips)` tool that looks up the county's parcel layer in a **per-county registry** (parcel layer URL, recorded `native_sr`, `checked_at`), reads the live value, and says whether they agree.
- **Prospector records a registry entry** when it builds a county's parcel tool. That's a data entry, not new code. The daily canary re-reads the value and flags drift, as it already does for layer identity.
- Parcel tools on the SIR path add `native_sr` and `source_layer` to their output, starting with the counties SIRs actually hit (Q7).

**D3. Fallback chain** when the registry and the live layer give no usable projected code:
1. Registry value.
2. Live layer metadata.
3. A **curated county → State Plane table** (county FIPS → EPSG, units, `basis: 'ngs_zone'|'observed_layer'`). It is built per county from NGS SPCS83 zone definitions, **not** by point-in-box lookup, which is what geom-local §2 showed to be ambiguous. Where a state has more than one legitimate system (KY Single Zone vs North/South), the table records what the county's layer was observed using, if known.
4. Otherwise leave `geom_local` NULL and flag it.

Web Mercator (3857/102100), geographic (4326) and custom-WKT layers skip to step 3.

**D4. Wiring into the SIR:**
- resolve-site requires `properties.native_sr` and `properties.source_layer` on every feature in `parcel-rings.geojson`, whether it came from a surveyor tool or from `arcgis_query.py`. `arcgis_query.py` gets the same one-request lookup. The prompt change is one sentence at line 36.
- `sir_add_parcel_geo` gains: if `native_sr.latestWkid` (else `wkid`) is projected and present in `spatial_ref_sys`, set `geom_local = ST_Transform(geom_wgs84, that code)` and `srid_local` to match. Otherwise NULL, as today. `geom_wgs84` stays authoritative for `county_api` rows, consistent with geom-local.
- Note that the RPC is insert-once on `(sir_id, kind, label)` and **returns the existing id without updating** (`geo_helpers.sql:71-116`). Existing rows need a one-off backfill (Q11).
- **Q6:** also fetch the *subject* ring in its native system (an unbuffered query with no `outSR`), so the fit target is exactly what the county digitized, with no round trip through WGS84 and no datum ambiguity (NAD83 ≈ WGS84 to about 1 m).

### 3.3 Piece B: link Cartographer files to where they came from

**D5.**
- `cartographer_files` gains `content_sha256`, `source_sir_artifact_id` (nullable) and `project_id` (nullable).
- An importer, `import-sir-artifact <sir_artifact_id>`, copies the object from `sir-artifacts` into `cartographer-files`, **deduplicating by content hash**. The survey found the three Conroe SIRs published an identical 100-file set, so one document can serve several SIRs.
- The anchor run takes a `sir_id` as its target (§3.6), so `geo` rows stay per SIR, as the table's FK requires. Q2.

### 3.4 Piece C: extraction records what anchoring needs

**D6.** Add these to the extraction artifact and to published evidence, all as verbatim text plus parsed fields, with nulls allowed:
- `basis_of_bearings` (verbatim; parsed `{kind: grid|record_plat|row_map|magnetic|assumed, zone?, datum?}`)
- `distance_units` (ft, ftUS, varas, m)
- `grid_or_surface` and `combined_scale_factor`
- `pob.description` (already in `artifact.json`, not published)
- every transcribed `coordinateBoxes` value at non-POB corners (possible control points; today only the POB's northing/easting are published)

Why:
- A grid basis means **θ should be about 0**, which is a free cross-check on any fit.
- Varas and other units must be converted before any fit. Today every distance is treated as feet (`types.ts`).

This touches extract-geometry-v2 (just merged, still under active work). Coordinate with that workstream (§7).

### 3.5 Piece D: anchoring math (`cartographer/src/lib/geometry/anchor.ts`)

These are pure functions next to `placement.ts`, imported by runbook scripts. As in geometry-extraction D6, there's no second copy. Agents never produce coordinates (extract-geometry AGENTS.md rule 1).

**D7. Three solvers, tried in order of trust:**
1. **`fromPrintedCoordinates`:** at least 2 figure vertices with printed N/E and a stated or inferred zone. Least-squares similarity fit. Class `survey`.
2. **`fromTies`:** correspondences between figure vertices or edges and located features, e.g. "POB = NE corner of Lot 11" ↔ a parcel vertex, or "along the north line of Lot 7" ↔ a parcel edge. Two points fix the transform. One point is enough if θ is known from a grid basis (D6). Class `tied`.
3. **`fitToRing`** (the default): fit the frame's figure or figures to the target county ring or rings.
   - (a) candidate rotations from matching edge bearings and lengths;
   - (b) initial translation from aligning centroids;
   - (c) refine (θ, tE, tN) by minimizing symmetric boundary distance (sampled boundary-to-boundary nearest distances), which tolerates county rings with extra or missing vertices;
   - (d) scale **fixed**, with a free-scale solve reported only as a diagnostic.

   Class `gis_fit`.

**D8. Every solve reports the same metrics:** IoU, Hausdorff and mean boundary distance (ft), rotation θ (and its gap from 0 when the basis is grid), area ratio, residual per control point or edge, and **ambiguity**: how close the second-best solution scored. Rectangles and symmetric lots have 90° and 180° look-alikes, and a tie breaks the tie.

**D9. The anchor applies to the whole frame.** A lot and its easements that placement put in the same frame share one transform, so an easement inherits its lot's anchor. A figure placement left `unplaced` is its own frame and needs its own correspondence. With none, it's reported `unanchorable`, never guessed.

### 3.6 Piece E: the `anchor-geometry` runbook (bureau, conductor2, launched manually)

**D10.** A **separate runbook** from extract-geometry-v2 (Q3). It needs a SIR target, it re-runs whenever parcel data or extraction changes, and v2 is under active work. Inputs: `{file: cartographer_files.id, sir_id, run_slug?}`. It shells out to cartographer scripts, as v2 does.

| Step | Runner | Output |
|---|---|---|
| 1.1 inputs / 1.2 fetch | script | the file's published geometries + evidence + frame offsets; the SIR's `geo` parcel rows (`geom_local` in native State Plane, or transformed through the D3 fallback); adjoining rings re-queried from the county when needed; `target_srid` |
| 2.1 correspond | **agent** (judgment) | `correspondences.json`: figure ↔ parcel (`same_as`, `within`, `union_of`), vertex/edge ↔ parcel vertex/edge, printed coordinates ↔ vertex. It reads labels ("LOT 7"), POB descriptions, legal descriptions and parcel properties. **Only indices and ids, never numbers.** |
| 3.1 solve | script | `anchors.json`: one transform per frame, with solver, class and D8 metrics |
| 3.2 render | script | overlay PNG per frame: county rings (all nearby), anchored figures, POB markers, over an aerial where available |
| 3.3 check | **agent** (vision) | `check.md`: does the easement sit where the sketch says; is the lot in the right place and the right way round; flags |
| 4.1 hitl | none | operator accepts, rejects, or sends it back to 2.1 with a note, per frame |
| 5.1 publish | script | `cartographer_anchors` rows + materialized `geo` rows (§3.7) |

**D11. A proposed auto-accept threshold, applied only in the readout.** For example: IoU ≥ 0.9, mean boundary distance ≤ 5 ft, ambiguity margin clear, and θ ≈ 0 when the basis is grid. v1 always stops at the HITL step (Q8).

### 3.7 Piece F: storage

**D12. The transform is the record; `geo` rows are produced from it.** New table `cartographer_anchors`:

```
id uuid pk, file_id → cartographer_files, run_slug text, frame_key text,
sir_id → site_intelligence_report, target_geo_ids uuid[],   -- the parcel rows fitted/tied to
target_srid int, method text check (printed_coordinates|ties|ring_fit|manual),
accuracy_class text check (survey|tied|gis_fit|approximate),
params jsonb  {theta_rad, scale, t_e, t_n, k_units},
metrics jsonb {iou, hausdorff_ft, mean_dist_ft, theta_vs_grid_deg, area_ratio, ambiguity, residuals[]},
evidence jsonb (correspondences + overlay path), status text check (proposed|accepted|rejected|stale),
anchor_run_slug text, decided_by uuid, created_at
```

Keyed on `(file_id, run_slug, frame_key)` with **no FK to geometry ids**, because Cartographer's publish deletes and re-inserts all of a file's geometries. An anchor whose `run_slug` ≠ the file's `metadata.lastGeometryRun` is **stale** by definition.

**D13. Producing `geo` rows.** A new RPC, `sir_put_anchored_geo(anchor_id)`, replaces all `geo` rows for that anchor. It does not follow `sir_add_parcel_geo`'s insert-once behavior. Each row gets:
- `kind` = the Cartographer kind (easement, lot, right_of_way, …) and `label` = the figure label.
- `method='anchored'`.
- `geom_local` = the transformed polygon in `target_srid`, **authoritative**. This is the traverse direction from geom-local §1.
- `geom_wgs84 = ST_Transform(geom_local, 4326)`.
- `closure_error` and `stated_area` from the geometry.
- `properties {anchor_id, cartographer_geometry_label, frame_key, run_slug, file_id, accuracy_class, method}`.

The SIR map shows these with no cityhall change. Distinguishing them by accuracy class is later UI work.

**D14. Staleness never deletes anything.** Re-extracting a file marks its anchors `stale` and leaves their `geo` rows in place with `properties.stale=true`, until an anchor run on the new `run_slug` replaces them.

### 3.8 Accuracy and how we measure it

A `gis_fit` anchor combines a survey-exact shape with a position that's only as good as the county's drawing, which is commonly off by several feet or more. That hasn't been measured here. We'll measure it instead of assuming:
- **Car-wash plat 2024178771:** solve it with `fromPrintedCoordinates` (truth, KY 3089), then pretend no coordinates exist and run `fitToRing` against the Jefferson County parcel ring. The gap between the two, per vertex, is our first real `gis_fit` error number.
- **Palm Bay Lot 7** (ALTA survey with a FL East NAD83(2011) grid basis): `fitToRing` should give θ ≈ 0. A large rotation means a bad fit or a bad ring.
- **One Conroe tract** (TxDOT right-of-way-map basis): no grid basis, so θ is a real unknown. This tests the ambiguity metric.

---

## 4. Phases

| Phase | Scope | Exit test |
|---|---|---|
| **P0a Native SR** (surveyor, bureau, substation) | D1–D4: helper + registry + tool; the SIR-path parcel tools and `arcgis_query.py` emit `native_sr`; resolve-site requires it; `sir_add_parcel_geo` fills `geom_local`; curated fallback table for the states we've seen (TX, FL, ND, KY); one-off backfill of the 21 existing rows | A new SIR's parcel rows have `srid_local` = the county layer's `latestWkid`; the Austin, Bexar and Travis cases come out 2277/2278 |
| **P0b Linking** (substation, cartographer) | D5: columns + hash-deduplicating importer | One SIR supporting document imported; importing it from a second SIR reuses the same file |
| **P0c Extraction metadata** (cartographer) | D6 | Car-wash re-extraction publishes its basis of bearings and its printed coordinates at non-POB corners |
| **P1 Math** (cartographer) | D7–D9 + tests | Synthetic round trips recover θ/t/s; the car-wash `survey` vs `gis_fit` gap is measured and written into this spec as v2 |
| **P2 Runbook + storage** (bureau, substation) | D10–D14 | Car-wash (KY), Palm Bay Lot 7 + its plat easements (FL), one Conroe tract (TX) anchored, operator-accepted, and drawn on the SIR map |
| **P3 Scale** (later) | Triage using the spike's classifier; automatic import; an optional SIR step; a MapLibre/cityhall view with accuracy styling | Anchored easements appear in a SIR without anyone launching them |

P0a, P0b and P0c are independent and can run in parallel. P1 needs only P0c's fixtures. P2 needs all of them.

---

## 5. Open questions

- **Q1. Where do anchored results live?** Proposed: `cartographer_anchors` holds the transform and `geo` holds the output rows (D12/D13). The alternative is PostGIS columns on `cartographer_geometries`, which keeps things in one place but leaves the SIR map reading two tables.
- **Q2. Link granularity:** `sir_artifact`, `project`, or content hash? Proposed: content hash for identity, `source_sir_artifact_id` as provenance, `sir_id` given at anchor time (D5).
- **Q3. Separate `anchor-geometry` runbook, or a stage 8 of extract-geometry-v2?** Proposed: separate (D10).
- **Q4. Does a `gis_fit` anchor count as "anchored"?** Proposed: yes, always carrying `accuracy_class`, and any consumer that draws or measures must show it.
- **Q5. Target system:** the subject parcel layer's native `latestWkid` (proposed), the zone the plat states (which may be a different datum realization, e.g. NAD83(2011) vs NAD83(1986)), or one canonical EPSG per county from the D3 table? When the plat and the county disagree, the anchor records both, and `geom_local` uses the target.
- **Q6. Fetch the subject ring in its native system** (one extra unbuffered query) instead of transforming the WGS84 copy? Proposed: yes (D4).
- **Q7. Where does the per-county registry live, and who fills it?** Options: surveyor jurisdiction data (next to the modules prospector already writes) or a substation table. Proposed: surveyor, with prospector adding an entry whenever it builds a parcel tool, and the canary checking drift.
- **Q8. Replats and multi-parcel mismatches** (the plat lot ≠ today's county parcel). Should the correspond agent be allowed `union_of`/`within` claims, and should a low IoU auto-reject, or always go to the operator? Proposed: always the operator in v1.
- **Q9. Curves as chords:** acceptable for v1 fits? Proposed: yes; `has_approximated_curves` caps the class at `gis_fit` and lowers the auto-accept threshold.
- **Q10. `geo.kind` vocabulary for anchored rows:** reuse Cartographer's `kind`, or namespace it (e.g. `anchored_easement`) so today's consumers that filter on `kind='parcel'` never pick them up by mistake?
- **Q11. Backfilling existing `county_api` rows:** a one-off script that re-reads `native_sr` from each row's `source_layer` (most rows don't have one) or re-resolves by county? `sir_add_parcel_geo` never updates rows.

## 6. Decisions index

D1 the county layer declares the zone (reverses geom-local §2 for the county path) · D2 generic function + registry, prospector fills entries · D3 fallback chain with a curated county table, no point-in-box · D4 resolve-site/RPC wiring · D5 content-hash linking · D6 extraction records basis/units/scale/control points · D7 three solvers · D8 shared metrics incl. ambiguity · D9 one anchor per frame · D10 separate manual runbook · D11 auto-accept suggestion only · D12 anchors table, no geometry FK · D13 `geo` rows produced as `method='anchored'` · D14 staleness never deletes.

## 7. Coordination and risks

- **extract-geometry-v2 is under active work** (a conductor2 port by another session, 2026-09-23). P0c changes what extraction writes. Land it through that workstream, not around it.
- **Publish deletes geometry ids** (cartographer `publish.ts`). D12/D14 exist so anchors survive re-extraction as `stale` instead of vanishing through cascades.
- **A bad county ring gives a confidently wrong anchor.** Mitigations: always show neighbouring rings in the overlay, check θ against a grid basis, the ambiguity metric, and v1 always going to the operator.
- **Datum realizations** (NAD83 vs NAD83(2011) vs WGS84) differ by about 1–2 m. They're invisible at `gis_fit` accuracy but matter for `survey`. Record them on the anchor; don't silently mix them.
- **Side note:** in prod, `SELECT * FROM geometry_columns` errors (`invalid input syntax for type integer: "srid_local"`), because PostGIS parses `geo_srid_local_matches` as a typmod hint. It's harmless to our code, but a GIS client that lists layers will fail. Worth a follow-up in substation.

## 8. Out of scope (and why)

Automatic anchoring inside the SIR run (P3, after accuracy is measured) · batch triage over all SIRs (P3; the spike's classifier is the starting point) · true arcs (extraction doesn't model radius or delta yet) · a cityhall viewer with accuracy styling (P3) · NATRF2022/SPCS2022 (EPSG per anchor makes it a re-transform later) · PLSS and monument lookups as tie sources (the `fromTies` solver accepts any located point; *finding* section corners or TxDOT monuments is a later data-source project).

## Appendix A: evidence pointers

- bureau main `d153049f1d`: `runbooks/sir/bin/publish.ts` (resolveParcelRings :749, writeParcelGeo :761, RPC call :811, plan flag :1341), `runbooks/site-research/bin/arcgis_query.py:110`, `runbooks/site-research/steps/1-resolve-site/prompt.md:26,36`.
- substation main `316ecae`: `supabase/functions/geo_helpers.sql:57,71,106`; migrations `20260807130000_geo_parcels.sql`, `20260812000000_geo_optional_local.sql`, `20260918000000_cartographer_files.sql`, `20260918170000_cartographer_geometries.sql`, `20260921000000_cartographer_geometries_placement.sql`, `20260923120000_cartographer_geometry_evidence.sql`, `20260923130000_project_site_outline.sql`.
- cartographer main `58ac25e`: `src/lib/geometry/traverse.ts:42`, `types.ts:4-7`, `placement.ts`, `runbooks/extract-geometry/scripts/publish.ts`.
- surveyor main `674ef84`: `src/lib/gis-client.ts:34,606-649`, `src/lib/gis-layer-identity.ts`, the parcel tools cited in §1.3.
- claude-plugins: `parcel-geo-location-resolution` was deleted in `9ea95ae` (#226, 2026-09-01); its logic now lives in `site-research` resolve-site + `bin/`. There's a stale mention at `plugins/noetic-tools/skills/upload-sir/SKILL.md:77`.
- Survey data: IG `2026-09-23-sir-geometry-source-survey` (`data.json` has every geometry with its source `sir_artifact` ids).
