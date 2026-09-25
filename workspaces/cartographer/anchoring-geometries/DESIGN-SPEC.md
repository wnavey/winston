# Cartographer — anchoring extracted geometries to the county parcel

**Status:** Draft v2 (implemented P0a–P2; awaiting merge and the P2 exit runs)
**Date:** 2026-09-25 (v1 2026-09-24)
**Repos touched:** `surveyor` (read and report each layer's native spatial reference; `native_sr` recorded in each module's `layer-identity.json`), `bureau` (`site-research` resolve-site records `native_sr`; `arcgis_query.py`; new `anchor-geometry` runbook), `substation` (`sir_add_parcel_geo` fills `geom_local`; `cartographer_files` gets a link to where the document came from; new `cartographer_anchors` table; RPC that writes anchored geometries into `geo`), `cartographer` (`src/lib/geometry/anchor.ts` solvers; extraction records basis-of-bearings, units and scale factor; **`VISION.md` updated to include anchoring**, §3.9)
**Repos NOT touched:** `cityhall` (the map already draws `geo.geom_wgs84`; a viewer for anchored geometries comes later, §8), `conductor2`, `claude-plugins`
**Prod:** Supabase **Noetic App** (`mgxqsrjutswbciyrltwd`)
**Predecessors:** [`../geometry-extraction/DESIGN-SPEC.md`](../geometry-extraction/DESIGN-SPEC.md) (winston#266, which deferred anchoring as "D3"), [`../geometry-placement/DESIGN-SPEC.md`](../geometry-placement/DESIGN-SPEC.md) (winston#270: frames, translation only, "SRID/WGS84 stays deferred"), [`../geometry-extraction/evidence/DESIGN-SPEC.md`](../geometry-extraction/evidence/DESIGN-SPEC.md) (winston#274)
**Siblings:** [`../../diligence/sir-geometry/geom-local/GEOM_LOCAL_ITERATION_SPEC.md`](../../diligence/sir-geometry/geom-local/GEOM_LOCAL_ITERATION_SPEC.md) (**§3.2 reverses its §2 conclusion**), [`../../diligence/sir-geometry/ingesting-supporting-docs-3089/SPEC.md`](../../diligence/sir-geometry/ingesting-supporting-docs-3089/SPEC.md) (prior art: building a plat from its printed State Plane coordinates, done by hand)
**Research (read this first for context):** Inspector General report **"SIR geometry source survey — how geometry is defined across the last 10 SIRs"**, <https://inspector-general-gamma.vercel.app/reports/view/2026-09-23-sir-geometry-source-survey/> (slug `2026-09-23-sir-geometry-source-survey`). §1.2's numbers come from it; §1.5 describes what it contains.
**Architecture diagrams:** [`architecture.html`](architecture.html) (spec-kit v5.1) — five tabs in reader order: **Overview** (Today/After system maps with the gap and the bridge, plus the phase DAG), **How it works** (the anchor-transform figure, the D7a eligibility ladder, what each solver needs and computes, fitToRing step by step, the D3 native-SR decision flow, the D12 anchor status lifecycle), **Who does what when** (the `anchor-geometry` runbook graph with the HITL loop, which step does which part of D7, the 4.1 gate outcomes, the call sequence), **What's stored** (ER diffs for `geo`, `cartographer_files`, evidence, `layer-identity.json`; the new `cartographer_anchors` table and the curated county table; what `sir_put_anchored_geo` writes), **Rollout** (phases, exit tests, decisions and open questions). [`DESIGN-SPEC.html`](DESIGN-SPEC.html) is this markdown rendered as a page for the diagrams to deep-link into. Open them in a browser; this markdown wins if they differ.
**Source of truth for anchoring and `srid_local`.** This spec supersedes or amends the following; each now carries a dated pointer here:
- geometry-extraction §7 "Anchoring (D3)" and "Coordinate-table primary reconstruction": no longer deferred.
- evidence §9 "Anchoring … still deferred": no longer deferred.
- geometry-placement §5 "Real-world anchoring": now designed here; placement stays translation-only.
- geom-local §2's conclusion: reversed. Its D5 (county rows WGS84 only) is amended by D4 here. Its §5 on-demand comparison moves into the `anchor-geometry` runbook.
- ingesting-supporting-docs-3089: becomes the `fromPrintedCoordinates` solver and the ground-truth fixture.
- MVP-EXPERIMENT: pointer only.

> **Revision note (v2, 2026-09-25, implementation).** P0a, P0b, P0c, P1 and P2 are implemented as twelve open PRs (§4 lists them). Three things changed while building. **(1) The first `gis_fit` error number exists (§3.8):** on the car-wash plat the county ring fit sits a uniform **2.9 ft** from where the printed monuments put the lot (mean 2.86, max 2.90 ft over 23 vertices), with IoU 0.997 against the county ring and ambiguity 0.005. **(2) Code drifts folded in.** surveyor's layer-identity memo kept only layer names, not `spatialReference` (D2 widens it); `layer-identity.json` is written by surveyor's own `scripts/verify-layer-identity.ts --record`, not by prospector (D2 corrected; the daily canary never checked layer identity and still does not); Brevard County's parcel layer is Web Mercator, so Palm Bay resolves through the D3 county table (FL East 2881); cartographer had no `control_point` evidence role and `coordinateBoxes` lived only in the raw transcription, so **P0c also needs a substation migration** (D6); extract-geometry-v2 landed as one finished PR on 2026-09-24, so §7's coordination risk has passed. **(3) Decisions taken at kickoff** (Will, 2026-09-25): all phases through P2 in scope, runs and prod applies are separate go's; the curated county table lives in bureau at `runbooks/site-research/data/spcs-by-county.json`; `native_sr` was backfilled into all 141 surveyor manifests, not only SIR-path modules; **Q6 yes** (`properties.native_geometry = {rings, wkid}`, the RPC prefers `ST_SetSRID` over `ST_Transform`); **Q10 reuse the Cartographer `kind` verbatim**, `method='anchored'` is the discriminator; **Q11 hand-curated backfill** keyed by `sir_id`, because `properties.source` is free text. D12 gains `anchor_run_slug` in its unique key; D13 gains two companion RPCs and `sir_geo_in_srid` (§3.7). The HTML reader was regenerated by hand from this markdown; `architecture.html` is unchanged and still describes v1.2.

> **Revision note (v1.2, 2026-09-25).** Answers **Q7** and simplifies D2/D3 accordingly. The "per-county registry" and the `resolve_native_sr(county_fips)` tool are gone. The record is a `native_sr` field on the parcel layer's entry in the module's existing `src/sources/<module>/layer-identity.json` (135 modules carry one today; prospector writes it when it builds a module; the layer-identity guard already fetches each service's `?f=json` once per process, which carries the spatial reference). One primary function remains, `getLayerSpatialReference(layerUrl)`, keyed by layer URL, because every caller on the SIR path already holds the layer. The only county-keyed lookup left is D3's curated fallback table. Storage tab: the registry ER box becomes the `layer-identity.json` entry diff.

> **Revision note (v1.1, 2026-09-25).** Clarification only; no decision is reversed. D7 is split into **D7a**, the eligibility ladder that picks the solver, and **D7b–D7d**, what each of the three solvers computes, step by step. Both run inside `3.1 solve`, a script, with no agent in the loop. §3.6 now says which runbook step does which part of D7, gives the `correspondences.json` shape that `2.1 correspond` must produce, and lists what `3.1 solve` does per frame. **Q12** (demote on a failed residual gate) and **Q13** (`tied` to county linework) are new. The D8/D12 metrics gain `demoted_from` and `tie_source`. Tolerances named here are proposals to be set by P1's tests. §2 gains a **Purpose** paragraph naming what the initiative is for: `geom_local` on every geometry so polygon-versus-polygon questions are PostGIS operations.

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

### 1.5 The research behind this spec (Inspector General report)

The scoping was done as an exploratory spike on 2026-09-23 and published as an IG report: <https://inspector-general-gamma.vercel.app/reports/view/2026-09-23-sir-geometry-source-survey/>. Future sessions should read it before changing this spec's direction. What it contains:
- **Scope.** The 10 most recently created SIRs, at their current version, all `supporting_document` artifacts: 645 `sir_artifact` rows, 445 unique files by name+size, about 6,800 pages. The three 2026-09-17 Conroe SIRs share one identical 100-file set.
- **Method.** A text layer + regex pre-screen, then 10 parallel agents that examined *every* document: text search on text-layer PDFs, and page-by-page vision on the 301 scanned files and 39 TIFFs, zooming into exhibits. A merge agent then deduplicated across split batches. Each geometry was classified with a multi-label taxonomy of 18 classes (metes and bounds, State Plane coordinates, lat/long, UTM, PLSS aliquot, lot/block, TX abstract/survey reference, strip along a line, station and offset, aerial overlay, GIS figure, …), plus a best **reconstructability** (anchored / closed shape with no position / by reference / approximate / none).
- **Summary page.** Total geometries (315 unique; 451 counted per SIR); what they define (easements 85, tracts 57, lots 31, …); the classification distribution; reconstructability; a classification × site heatmap.
- **Coordinate systems found.** A table of every zone, datum and frame seen (TX Central 4203 NAD83; FL East 0901 NAD83(2011); FL West 0902 NAD83(1990)/(2011)/pre-1983; an ND North that's likely but unstated; UTM 13N; lat/long NAD27/NAD83), and whether each is usable as an anchor.
- **Parser implications.** The metes-and-bounds edge cases seen in real documents: "beginning for reference" preambles, "less and except" subtraction, varas, spelled-out bearings, prose vs plat-label curves, river meanders, station equations, and OCR-garbled bearings.
- **Per-SIR detail.** For every SIR: project name, SIR id, every document id (`sir_artifact.id`) with its type and whether it defines geometry, and every geometry with its classifications, source document ids and pages, and coordinate system or basis of bearings.
- **Raw data.** `data.json` next to the report (inspector-general bucket, `reports/2026-09-23-sir-geometry-source-survey/data.json`) has every geometry and source in machine-readable form, keyed to `sir_artifact` ids. It's the natural seed for P3 triage and for choosing P2 pilot documents.
- **Side findings.** SIR `ffbcbcc9` has 32 `sir_artifact` rows whose storage objects are missing. The three Conroe SIRs are the same run published three times.

---

## 2. Goals and non-goals

**Purpose.** Populate `geo.geom_local` for every geometry we hold about a site (the county parcel, and the plats, lots, recorded easements and rights-of-way Cartographer extracts) in one projected system per SIR, so that questions about how those shapes relate can be answered as PostGIS operations on `geom_local`: what share of the parcel a recorded easement takes up (`ST_Area(ST_Intersection(...))`), the shortest distance from an easement to the parcel edge (`ST_Distance`), whether two easements overlap. Everything below serves that. Two consequences worth stating up front:
- **Shapes from the same frame answer exactly**, whatever the anchor's accuracy class: placement (winston#270) already fixes their relative position to the foot, and one anchor moves them together. A lot and its easements from one plat are the common case.
- **Shapes from different sources answer to the accuracy class** of the anchors between them. Easement versus county ring at `gis_fit` is as good as the county drawing; two independently anchored frames add their errors. Any consumer that reports a distance or a share must carry the class with it (Q4).

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

**D2. One function keyed by layer URL, and the record lives in `layer-identity.json`.** A layer's coordinate system is a property of the layer, not of any query or county, and every caller on the SIR path already holds the layer URL. So there is no county-keyed lookup and no new registry:
- **The record.** surveyor's `src/sources/<module>/layer-identity.json` already lists, per pinned layer, the service URL, layer id, the name it had when the module was built and `recorded_at` (135 modules have one; `src/lib/gis-layer-identity.ts`). The parcel layer's entry gains one field, `native_sr: {wkid, latestWkid, wkt?, recorded_at}`. That is the whole registry. Keyed by module and layer, not by county (Q7).
- **The function.** `surveyor/src/lib/layer-spatial-reference.ts`: `getLayerSpatialReference(layerUrl) → { wkid, latestWkid, wkt?, recorded?, drifted, fetched_at }`. It reads the service listing the layer-identity guard already memoizes (`…/MapServer?f=json`, one request per service per process, which carries `spatialReference`), and compares the live value to the module's recorded `native_sr`. `drifted` is true when they disagree. No extra request. *(v2: the memo kept only `id → name` before P0a; it now retains the service's `spatialReference`, with a memoized per-layer `?f=json` fallback when the service level lacks it. The function also returns `epsg` (= `latestWkid` else `wkid`) and `kind: projected | geographic | web_mercator | unknown`.)*
- **Who fills it.** *(v2 correction.)* `layer-identity.json` is written by surveyor's own `scripts/verify-layer-identity.ts --record` (prospector has no code path that writes it), so `--record` now writes `native_sr` from the live listing, and `checkLayerIdentity` reports a drifted `native_sr` the way it reports a renamed layer (warn, never throw: a re-projected layer still answers WGS84 queries, so drift is bookkeeping, not an outage). The daily canary replays golden values and does not check layer identity; it is unchanged. All 141 modules that carry a manifest were backfilled in P0a (1384 of 1392 records: 808 projected, 392 Web Mercator, 119 geographic, 65 WKT-only; 8 unreadable hosts left without the field).
- **Parcel tools on the SIR path** add `native_sr` (from `getLayerSpatialReference`) and `source_layer` to their output, starting with the counties SIRs actually hit.
- **`arcgis_query.py`** (bureau site-research, used where no surveyor module exists) also has the layer URL in hand. It does the same live `?f=json` read in Python, with no recorded value to compare against.

**D3. Fallback chain** when the layer gives no usable projected code:
1. The module's recorded `native_sr` in `layer-identity.json`, confirmed live (D2). For `arcgis_query.py`, the live value alone.
2. A **curated county → State Plane table** (county FIPS → EPSG, units, `basis: 'ngs_zone'|'observed_layer'`), the one county-keyed lookup in the design. It is built per county from NGS SPCS83 zone definitions, **not** by point-in-box lookup, which is what geom-local §2 showed to be ambiguous. Where a state has more than one legitimate system (KY Single Zone vs North/South), the table records what the county's layer was observed using, if known.
3. Otherwise leave `geom_local` NULL and flag it.

Web Mercator (3857/102100), geographic (4326) and custom-WKT layers skip to step 2 (Brevard County's parcel layer is Web Mercator, so Palm Bay takes this path to FL East 2881). The table lives in bureau at `runbooks/site-research/data/spcs-by-county.json` with `bin/spcs_lookup.py`, seeded with every county in prod's `geo` rows (19 counties, TX/FL/NC/ND/KY). A `drifted` record (live ≠ recorded) uses the live value and flags the module for a prospector refresh.

**D4. Wiring into the SIR:**
- resolve-site requires `properties.native_sr` and `properties.source_layer` on every feature in `parcel-rings.geojson`, whether it came from a surveyor tool or from `arcgis_query.py`. `arcgis_query.py` gets the same one-request lookup. The prompt change is one sentence at line 36.
- `sir_add_parcel_geo` gains: if `native_sr.latestWkid` (else `wkid`) is projected and present in `spatial_ref_sys`, set `geom_local = ST_Transform(geom_wgs84, that code)` and `srid_local` to match. Otherwise NULL, as today. `geom_wgs84` stays authoritative for `county_api` rows, consistent with geom-local.
- Note that the RPC is insert-once on `(sir_id, kind, label)` and **returns the existing id without updating** (`geo_helpers.sql:71-116`). Existing rows need a one-off backfill (Q11).
- **Q6 (answered yes):** also fetch the *subject* ring in its native system (an unbuffered query with no `outSR`), so the fit target is exactly what the county digitized, with no round trip through WGS84 and no datum ambiguity (NAD83 ≈ WGS84 to about 1 m). It rides on the WGS84 feature as `properties.native_geometry = {rings, wkid}` (GeoJSON geometry stays WGS84); the RPC uses it via `ST_SetSRID` when its wkid matches `native_sr` and it lies within 50 m of the WGS84 ring, else `ST_Transform`.

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

This touches extract-geometry-v2 (merged 2026-09-24 as one finished PR; no longer under active work). *(v2.)* The prompt changes land in both cartographer's v1 prompts and v2's (bureau#1813); the scripts are shared. Because `cartographer_geometry_evidence` constrains `role` and `source_kind`, **P0c also needs a substation migration** (substation#309): five columns on `cartographer_geometries` (`basis_of_bearings jsonb`, `distance_units`, `grid_or_surface`, `combined_scale_factor`, `control_points jsonb`), roles `control_point | basis_of_bearings | distance_units | scale_factor`, source kind `plat_note`. In the artifact the fields are `basisOfBearings`, `distanceUnits`, `gridOrSurface`, `combinedScaleFactor`, `controlPoints[] {vertex, n, e, verbatim}` (vertex 0 = POB).

### 3.5 Piece D: anchoring math (`cartographer/src/lib/geometry/anchor.ts`)

These are pure functions next to `placement.ts`, imported by runbook scripts. As in geometry-extraction D6, there's no second copy. Agents never produce coordinates (extract-geometry AGENTS.md rule 1).

**D7. One ladder, three solvers.** Choosing the solver and running it are both done by `3.1 solve` (§3.6), a script, once per frame, with no agent in the loop. The agent step before it, `2.1 correspond`, never names a solver. It supplies the *inputs* a rung needs (control points, ties, ring matches), and the highest rung whose inputs are present is the one that runs. D7a is the choice. D7b, D7c and D7d are the three solvers. Every tolerance below is a proposal; P1's tests set the real values.

**D7a. Choosing the solver: the eligibility ladder.** Per frame, `3.1 solve` gathers the frame's inputs. From `correspondences.json` (2.1): the control points, the ties and the ring matches, all by figure id and vertex or course index. From the published evidence (D6): the basis of bearings, the distance units and the combined scale factor. Then it takes the first rung whose inputs are present:

| Rung | Runs when the frame has | Solver | Class |
|---|---|---|---|
| 1 | at least 2 control points (a figure vertex matched to a printed N/E box) **and** a zone: stated on the plat (D6 `basis_of_bearings.zone`), or, failing that, `target_srid` confirmed by the sanity gate in D7b | `fromPrintedCoordinates` | `survey` |
| 2 | ties that fix all three unknowns (θ, tE, tN): 2 vertex ties, or 1 vertex tie + 1 edge tie, or 1 vertex tie + a grid basis of bearings | `fromTies` | `tied` |
| 3 | a `same_as` or `union_of` ring match for at least one figure in the frame | `fitToRing` | `gis_fit` |
| none | none of the above, e.g. an easement-only frame whose only match is `within` | none | `unanchorable` (D9) |

Rules:
- **A rung's own residual gate decides eligibility, not just the presence of inputs.** Rung 1 with a control point whose residual exceeds `PRINTED_COORD_ACCEPT_FT` (proposed 1.0 ft, the placement check budget) is ineligible: its inputs are inconsistent, from a misread box or a plat defect such as geometry-placement §1.1's 180° boxes. The frame drops to the next rung, and the failure is written to `metrics.demoted_from` and shown in the readout (Q12). Rung 2 behaves the same at its gate (D7c).
- **Ties that cannot fix the transform are not thrown away. They pass down as constraints.** An edge tie alone fixes θ. A grid basis fixes θ ≈ 0. A single vertex tie fixes (tE, tN) once θ is known. Rung 3 then solves only the unknowns that are still free.
- **Every anchor gets the ring metrics when a ring match exists**, whatever rung solved it. A `survey` anchor whose IoU against the county ring is poor is still `survey` (the county drawing is the less accurate side), but the readout says so. That gap is the §3.8 measurement.
- **The class is the rung, never the score.** A perfect-looking `gis_fit` is still `gis_fit`.

**D7b. `fromPrintedCoordinates` (rung 1).** Inputs: control points `{figure, vertex, n, e}` (D6's `control_point` evidence plus the POB's printed coordinates, matched to vertices by 2.1), the zone, `distance_units`, `combined_scale_factor`.
1. **Bring the printed coordinates into `target_srid`.** If the plat's zone, resolved to an EPSG code, is not `target_srid`, transform the printed (E, N) into `target_srid` first (`ST_Transform` or proj). Record both codes on the anchor (§7 datum realizations); never silently mix them. If the plat states no zone, assume `target_srid` and run the **sanity gate** from the 3089 spec: one control point transformed to WGS84 must land inside the SIR parcel ring's bounding box grown by 500 ft. If it does not, rung 1 is ineligible.
2. **Local side.** Each control point's frame position is its figure's `ring[vertex] + (offset_x, offset_y)` (placement's frame coordinates), times `k_units` into the target's units (D6 `distance_units`: feet stay feet for a ftUS zone; varas × 2.7778; metres × 3.2808).
3. **Solve the rigid transform** (θ, tE, tN) with scale fixed at `s` = 1, or the stated combined scale factor. Closed form, the 2D Helmert or orthogonal Procrustes fit: centre both point sets on their centroids, `θ = atan2(Σ(x′N′ − y′E′), Σ(x′E′ + y′N′))`, then `(tE, tN) = target centroid − s·R(θ)·local centroid`. With exactly 2 points this is still over-determined by one (the two points' separation must match in both frames), so the residual means something from the first plat on.
4. **Residual per control point** = `|s·R(θ)·p·k_units + t − q|` in target units. The largest must pass `PRINTED_COORD_ACCEPT_FT` for the rung to hold (D7a).
5. **Free-scale diagnostic.** Re-solve with `s` free (`s = Σ q′·R(θ)p′ / Σ|p′|²`). Reported, never applied. A value far from 1, or from the stated factor, means wrong units, a wrong zone or a misread box.
6. **Metrics (D8)**, including the ring metrics when 2.1 also gave a ring match.

**D7c. `fromTies` (rung 2).** Inputs: vertex ties (`{figure, vertex}` ↔ a located point (E, N)) and edge ties (`{figure, course}` ↔ a located line, with `sense`), both in `target_srid`. In v1 a located feature is a vertex or an edge of one of the SIR's `geo` parcel rows (`geom_local`). A monument with published coordinates is the same input from a later source (§8). Unknowns: θ, tE, tN, with `s` fixed as in D7b. What each input contributes: a vertex tie gives two equations (both translation components, once θ is known); an edge tie gives θ (the located line's bearing minus the course's local bearing, after `sense`) plus one equation (the perpendicular offset), with the position along the line free; a grid basis gives θ ≈ 0.
1. **θ first.** From edge ties: the mean of (located bearing − local bearing) over the edge ties. From 2 or more vertex ties with no edge tie: the D7b closed form gives θ and t together. From a grid basis alone: θ = 0.
2. **t second.** With θ fixed, each vertex tie gives `t = q − s·R(θ)·p·k_units`; each edge tie constrains `t` along the line's normal. Least squares over all of them.
3. **Residual gate.** The largest vertex residual and the largest edge perpendicular residual must pass `TIE_ACCEPT_FT`, which depends on what the tie is to: proposed 1.0 ft for a monument, 10 ft for county linework (Q13). Written to `metrics.residuals[]` and `metrics.tie_source`.
4. **Insufficient ties** never anchor by themselves. They pass down to rung 3 as constraints (D7a).

**D7d. `fitToRing` (rung 3).** Inputs: the frame's **fit figures**, meaning every figure with a `same_as` match (one parcel row) or a `union_of` match (several rows); the **target**, the union of the matched rows' `geom_local` (`ST_Union`, one polygon in `target_srid`); and any constraint handed down from rung 2 (θ fixed, or `t` confined to a line). Figures matched only `within` (an easement inside the lot) ride on the frame's transform (D9) and take no part in the fit. Steps:
- (a) **Units.** Each fit figure's ring, plus its frame offset, times `k_units`.
- (b) **Candidate rotations.** Every (fit-figure edge i, target edge j) pair votes `Δθ = bearing_j − bearing_i`, with weight `min(len_i, len_j) / (1 + |len_i − len_j|)`, into a 1° histogram over [0°, 360°). The top 4 peaks (each refined to the weighted mean inside its bin) are the candidates. On a grid basis θ = 0 is always a candidate and wins a near-tie. If θ came down as a constraint, it is the only candidate. Chords of curves vote like any other edge, weakly, because they are short.
- (c) **Initial translation.** Rotate the fit figures by the candidate θ, then move their area-weighted centroid onto the target's centroid.
- (d) **Refine** (θ, tE, tN), or only the ones still free, by minimizing the **symmetric mean boundary distance**: sample both outlines at a fixed spacing (every 2 ft, and at least 200 samples per ring), take each sample's nearest distance to the other polyline, and average both directions. Nelder–Mead on three parameters, stopping when a step is under 0.01 ft and 0.001°. Symmetric, so a county ring with an extra vertex (a dogleg the plat lacks) or a missing one (a merged neighbour) costs a little instead of derailing the fit.
- (e) **Pick and score.** The candidate with the lowest refined score wins. `ambiguity` = best score ÷ second-best score after refinement (1.0 is a coin flip; the readout flags anything above 0.8, proposed). A rectangle has a 180° look-alike, a square has 90° ones. Only a tie or a grid basis breaks them; the ladder never picks silently.
- (f) **Scale stays fixed** at 1, or the stated factor. One free-scale re-solve from the winning solution is reported as a diagnostic (D8): a drift past 1% points at wrong units (varas read as feet is 2.78×) or a wrong ring.
- (g) **Metrics (D8)** from the winning transform: IoU (polygon intersection over union), Hausdorff, mean boundary distance, area ratio (fit figures ÷ target), θ against grid.

Class `gis_fit`.

**D8. Every solve reports the same metrics:** IoU, Hausdorff and mean boundary distance (ft), rotation θ (and its gap from 0 when the basis is grid), area ratio, residual per control point or edge, and **ambiguity**: how close the second-best solution scored. Rectangles and symmetric lots have 90° and 180° look-alikes, and a tie breaks the tie. Two bookkeeping fields: `demoted_from`, the rung that was eligible but failed its own residual gate (D7a, Q12), and `tie_source`, `county_parcel` or `monument`, for a `tied` anchor (D7c, Q13).

**D9. The anchor applies to the whole frame.** A lot and its easements that placement put in the same frame share one transform, so an easement inherits its lot's anchor. A figure placement left `unplaced` is its own frame and needs its own correspondence. With none, it's reported `unanchorable`, never guessed.

### 3.6 Piece E: the `anchor-geometry` runbook (bureau, conductor2, launched manually)

**D10.** A **separate runbook** from extract-geometry-v2 (Q3). It needs a SIR target, it re-runs whenever parcel data or extraction changes, and v2 is under active work. Inputs: `{file: cartographer_files.id, sir_id, run_slug?}`. It shells out to cartographer scripts, as v2 does.

| Step | Runner | Output |
|---|---|---|
| 1.1 inputs / 1.2 fetch | script | the file's published geometries + evidence + frame offsets; the SIR's `geo` parcel rows (`geom_local` in native State Plane, or transformed through the D3 fallback); adjoining rings re-queried from the county when needed; `target_srid` |
| 2.1 correspond | **agent** (judgment) | `correspondences.json`: ring matches (figure ↔ parcel: `same_as`, `within`, `union_of`), vertex and edge ties (figure vertex or course ↔ parcel vertex or edge), control points (figure vertex ↔ printed coordinate box). It reads labels ("LOT 7"), POB descriptions, legal descriptions and parcel properties. **Only indices and ids, never numbers, never a solver name.** These are the inputs D7a's rungs test for. |
| 3.1 solve | script | `anchors.json`: one transform per frame, with solver, class and D8 metrics. **This is where D7 runs**: the ladder (D7a) picks the rung, then the rung's solver (D7b, D7c or D7d) computes the transform |
| 3.2 render | script | overlay PNG per frame: county rings (all nearby), anchored figures, POB markers, over an aerial where available |
| 3.3 check | **agent** (vision) | `check.md`: does the easement sit where the sketch says; is the lot in the right place and the right way round; flags. `check.md` is also the readout 4.1 shows, so it carries each frame's solver, class, metrics against D11's threshold and any demotion (D7a) |
| 4.1 hitl | none | operator accepts, rejects, or sends it back to 2.1 with a note, per frame |
| 5.1 publish | script | `cartographer_anchors` rows + materialized `geo` rows (§3.7) |

**Which step does which part of D7.** No step chooses a solver except `3.1 solve`, and it does so by inspection of its inputs:
- **1.2 fetch** (script) supplies the raw material: the SIR's `geo` parcel rows in `target_srid` (rung 2's located features and rung 3's targets), adjoining rings re-queried from the county when the plat lot spans more than the subject parcel, and the D6 evidence (basis of bearings, units, scale factor, control-point boxes).
- **2.1 correspond** (agent) supplies what a rung needs, by id and index: control points for rung 1, vertex and edge ties for rung 2, ring matches for rung 3. It writes one block per frame:

  ```jsonc
  {
    "frames": [{
      "frame_key": "frame-1",
      "ring_matches":   [{ "figure": "figure-1", "relation": "same_as", "geo_ids": ["<geo.id>"], "evidence": "label LOT 7 = parcel 0412-07" }],
      "vertex_ties":    [{ "figure": "figure-1", "vertex": 0, "geo_id": "<geo.id>", "ring_vertex": 3, "evidence": "POB is called as the NE corner of Lot 11" }],
      "edge_ties":      [{ "figure": "figure-1", "course": 2, "geo_id": "<geo.id>", "ring_edge": 5, "sense": "reversed", "evidence": "along the north line of Lot 7" }],
      "control_points": [{ "figure": "figure-1", "vertex": 4, "evidence_id": "<cartographer_geometry_evidence.id>" }],
      "unmatched":      [{ "figure": "figure-9", "why": "separate exhibit; no parcel, corner or coordinate on the sheet" }]
    }]
  }
  ```

  `relation` is `same_as` (the figure is this parcel), `union_of` (the figure is these parcels together, a replat) or `within` (the figure lies inside this parcel, an easement). A `within` match anchors nothing by itself; it tells 3.2 which rings to draw. Vertex indices and course numbers are the geometry's (course k runs from vertex k−1 to vertex k; vertex 0 is the POB); `ring_vertex` and `ring_edge` index the parcel row's `geom_local` exterior ring.
- **3.1 solve** (script), per frame: (1) gather the frame's inputs from `correspondences.json` and the evidence; (2) walk the ladder (D7a) to the highest eligible rung; (3) run that rung's solver (D7b, D7c or D7d); (4) if the rung's own residual gate fails, record `demoted_from` and take the next rung; (5) compute the ring metrics whenever a ring match exists; (6) apply the transform to every figure in the frame, `within` figures included (D9); (7) write `anchors.json`: `{frame_key, solver, accuracy_class, params, metrics, constraints_used, demoted_from}`.
- **3.2 render** and **3.3 check** judge the result; **4.1** is the operator's call; **5.1** writes it. None of them touches the transform.

**D11. A proposed auto-accept threshold, applied only in the readout.** For example: IoU ≥ 0.9, mean boundary distance ≤ 5 ft, ambiguity margin clear, and θ ≈ 0 when the basis is grid. v1 always stops at the HITL step (Q8).

### 3.7 Piece F: storage

**D12. The transform is the record; `geo` rows are produced from it.** New table `cartographer_anchors`:

```
id uuid pk, file_id → cartographer_files, run_slug text, frame_key text,
sir_id → site_intelligence_report, target_geo_ids uuid[],   -- the parcel rows fitted/tied to
target_srid int, method text check (printed_coordinates|ties|ring_fit|manual),
accuracy_class text check (survey|tied|gis_fit|approximate),
params jsonb  {theta_rad, scale, t_e, t_n, k_units},
metrics jsonb {iou, hausdorff_ft, mean_dist_ft, theta_vs_grid_deg, area_ratio, ambiguity, residuals[], demoted_from?, tie_source?},
evidence jsonb (correspondences + overlay path), status text check (proposed|accepted|rejected|stale),
anchor_run_slug text, decided_by uuid, created_at
```

Keyed on `(file_id, run_slug, frame_key, anchor_run_slug)` (one proposal per anchor run per frame; *v2*) with **no FK to geometry ids**, because Cartographer's publish deletes and re-inserts all of a file's geometries. An anchor whose `run_slug` ≠ the file's `metadata.lastGeometryRun` is **stale** by definition.

**D13. Producing `geo` rows.** A new RPC, `sir_put_anchored_geo(anchor_id)`, replaces all `geo` rows for that anchor. It does not follow `sir_add_parcel_geo`'s insert-once behavior. Each row gets:
- `kind` = the Cartographer kind (easement, lot, right_of_way, …) and `label` = the figure label.
- `method='anchored'`.
- `geom_local` = the transformed polygon in `target_srid`, **authoritative**. This is the traverse direction from geom-local §1.
- `geom_wgs84 = ST_Transform(geom_local, 4326)`.
- `closure_error` and `stated_area` from the geometry.
- `properties {anchor_id, cartographer_geometry_label, frame_key, run_slug, file_id, accuracy_class, method}`.

The SIR map shows these with no cityhall change. Distinguishing them by accuracy class is later UI work.

*(v2, as built in substation#310.)* `sir_put_anchored_geo(p_anchor_id, p_figures jsonb)` takes the figures already transformed by the solve script (`{label, kind, geometry: GeoJSON in target_srid, closure_error?, stated_area?, cartographer_geometry_label?}`) and requires the anchor to be `accepted`. Two companions: `cartographer_anchor_decide(p_anchor_id, 'accepted'|'rejected', p_decided_by?)` (rejecting deletes the anchor's `geo` rows) and `cartographer_mark_anchors_stale(p_file_id, p_new_run_slug)` (D14; called by cartographer's geometry publish). `sir_geo_in_srid(p_sir, p_srid)` returns every `geo` row of a SIR as a FeatureCollection transformed into `p_srid` (from `geom_local` when present, else `geom_wgs84`), which is how the runbook's fetch step gets rings in the target system for older SIRs whose county rows have no `geom_local`. All four are service-role only.

**D14. Staleness never deletes anything.** Re-extracting a file marks its anchors `stale` and leaves their `geo` rows in place with `properties.stale=true`, until an anchor run on the new `run_slug` replaces them.

### 3.8 Accuracy and how we measure it

A `gis_fit` anchor combines a survey-exact shape with a position that's only as good as the county's drawing, which is commonly off by several feet or more. We measure it instead of assuming:
- **Car-wash plat 2024178771:** solve it with `fromPrintedCoordinates` (truth, KY 3089), then pretend no coordinates exist and run `fitToRing` against the Jefferson County parcel ring. The gap between the two, per vertex, is our first real `gis_fit` error number.

  **Measured (P1, cartographer#31, 2026-09-25, EPSG:3089, fixture `src/lib/geometry/__fixtures__/car-wash-2024178771.json`):**

  | | `survey` (rung 1, 6 control points) | `gis_fit` (rung 3, no coordinates) |
  |---|---|---|
  | θ vs grid | 0.0061° | −0.0008° |
  | t (E, N) | (4953690.47, 3955650.20) | (4953689.10, 3955652.68) |
  | control-point residuals | 0.17 / 0.31 / 0.15 / 0.14 / 0.15 / 0.29 ft | — |
  | IoU vs county rings | 0.973 | 0.997 |
  | mean boundary distance | 2.22 ft | 0.28 ft |
  | Hausdorff | — | 6.65 ft |
  | ambiguity | — | 0.005 |
  | free scale (diagnostic) | 1.000250 | 1.0000 |

  Gap `survey` → `gis_fit` over the 23 lot vertices: **mean 2.86 ft, max 2.90 ft**, near-uniform (2.81–2.90 ft), i.e. a pure translation of about 2.9 ft. The county drawing has the plat's exact shape but sits 2.9 ft from where the printed monuments put it. The hand-built 3089 rows agree with the rung-1 solve to under 0.5 ft at the POB. One number from one county; the Palm Bay and Conroe runs (P2 exit test) add the next two.
- **Palm Bay Lot 7** (ALTA survey with a FL East NAD83(2011) grid basis): `fitToRing` should give θ ≈ 0. A large rotation means a bad fit or a bad ring.
- **One Conroe tract** (TxDOT right-of-way-map basis): no grid basis, so θ is a real unknown. This tests the ambiguity metric.

### 3.9 Piece G: `cartographer/VISION.md` records the anchoring direction

`VISION.md` (repo root, cartographer main `58ac25e`) is where this initiative's high-level direction lives. Today it says only that the near-term focus is SRID:0 display and that WGS84 display with MapLibre comes "eventually". It says nothing about how an SRID:0 shape *becomes* an anchored one.

**D15.** The first cartographer PR of this work (P0c or P1, whichever lands first) updates `VISION.md` with a short, spec-independent section. Draft:

> **From shapes to places (anchoring).** Cartographer's shapes are exact but
> float: SRID:0, feet, oriented to the plat's own north. The SIR pipeline
> already knows roughly where the land is: the county's parcel polygon. We
> anchor a shape by solving one rotation + translation (+ scale) that lays it
> onto the county's own State Plane grid: from printed coordinates when the plat
> has them (rare), from named corners and lines when the description ties to
> them, and otherwise by fitting it to the county parcel. Every anchored shape
> carries how it was anchored and how much to trust its position. Anchored shapes
> land in the same `geo` table the SIR map reads, so easements, lots and rights-of-way
> appear on the map beside the parcel. Why this approach: across the 10 newest
> SIRs, metes and bounds defined 42% of 315 geometries, while printed State Plane
> coordinates appeared in about 1%
> ([IG survey](https://inspector-general-gamma.vercel.app/reports/view/2026-09-23-sir-geometry-source-survey/)).
> Design: winston `workspaces/cartographer/anchoring-geometries/DESIGN-SPEC.md`.

It also edits "Eventually" so WGS84/MapLibre display is described as the viewer for *anchored* geometries (P3), not a separate goal. VISION.md stays high-level: no tables, no decision numbers.

---

## 4. Phases

| Phase | Scope | Exit test |
|---|---|---|
| **P0a Native SR** (surveyor, bureau, substation) | D1–D4: `getLayerSpatialReference` + `native_sr` backfilled into `layer-identity.json` for the SIR-path modules; those parcel tools and `arcgis_query.py` emit `native_sr`; resolve-site requires it; `sir_add_parcel_geo` fills `geom_local`; curated fallback table for the states we've seen (TX, FL, ND, KY); one-off backfill of the 21 existing rows | A new SIR's parcel rows have `srid_local` = the county layer's `latestWkid`; the Austin, Bexar and Travis cases come out 2277/2278 |
| **P0b Linking** (substation, cartographer) | D5: columns + hash-deduplicating importer | One SIR supporting document imported; importing it from a second SIR reuses the same file |
| **P0c Extraction metadata** (cartographer) | D6; D15 `VISION.md` update if this is the first cartographer PR | Car-wash re-extraction publishes its basis of bearings and its printed coordinates at non-POB corners |
| **P1 Math** (cartographer) | D7–D9 + tests | Synthetic round trips recover θ/t/s; the car-wash `survey` vs `gis_fit` gap is measured and written into this spec as v2 (done, §3.8) |
| **P2 Runbook + storage** (bureau, substation) | D10–D14 | Car-wash (KY), Palm Bay Lot 7 + its plat easements (FL), one Conroe tract (TX) anchored, operator-accepted, and drawn on the SIR map |
| **P3 Scale** (later) | Triage using the spike's classifier; automatic import; an optional SIR step; a MapLibre/cityhall view with accuracy styling | Anchored easements appear in a SIR without anyone launching them |

P0a, P0b and P0c are independent and can run in parallel. P1 needs only P0c's fixtures. P2 needs all of them.

**Implementation status (v2, 2026-09-25).** All open, none merged; merging and every run is Will's call. Deploy order within a phase: substation migration first, then the code that reads it; `supabase/functions/geo_helpers.sql` needs a hand apply to prod after substation#307 and again after #310 (non-overlapping hunks in one file).

| Phase | PRs |
|---|---|
| P0a | surveyor#426 (`getLayerSpatialReference`, `native_sr` in 141 manifests, 3 parcel tools) · bureau#1812 (`arcgis_query.py sr` + `--native-ring`, `spcs-by-county.json`, `spcs_lookup.py`, resolve-site prompt + contract) · substation#307 (`sir_add_parcel_geo` fills `geom_local`, `geo_projected_srid` helper) |
| P0b | substation#308 (`cartographer_files` provenance columns) · cartographer#29 (`import-sir-artifact`, upload-path hash, `VISION.md` D15) |
| P0c | substation#309 (evidence roles + metadata columns) · cartographer#30 (transcribe prompt, assemble, publish) · bureau#1813 (v2 prompt + contracts, `plat_notes` region kind) |
| P1 | cartographer#31 (`anchor.ts`, 35 tests, car-wash fixture) |
| P2 | substation#310 (`cartographer_anchors`, four RPCs) · cartographer#32 (anchor-geometry scripts: fetch/solve/render/publish, D14 wired into geometry publish; stacked on #31) · bureau#1815 (`anchor-geometry` runbook, 8 steps; revise = void 2.1 with the ruling as findings) |

Still to do after merge, each its own go: apply `geo_helpers.sql` to prod; the Q11 backfill of the 26 `county_api` rows; re-extract the car-wash plat (P0c exit test); the three P2 anchor runs (car-wash KY, Palm Bay Lot 7 FL, one Conroe tract TX); write their numbers into §3.8.

---

## 5. Open questions

- **Q1. Where do anchored results live?** Proposed: `cartographer_anchors` holds the transform and `geo` holds the output rows (D12/D13). The alternative is PostGIS columns on `cartographer_geometries`, which keeps things in one place but leaves the SIR map reading two tables.
- **Q2. Link granularity:** `sir_artifact`, `project`, or content hash? Proposed: content hash for identity, `source_sir_artifact_id` as provenance, `sir_id` given at anchor time (D5).
- **Q3. Separate `anchor-geometry` runbook, or a stage 8 of extract-geometry-v2?** Proposed: separate (D10).
- **Q4. Does a `gis_fit` anchor count as "anchored"?** Proposed: yes, always carrying `accuracy_class`, and any consumer that draws or measures must show it.
- **Q5. Target system:** the subject parcel layer's native `latestWkid` (proposed), the zone the plat states (which may be a different datum realization, e.g. NAD83(2011) vs NAD83(1986)), or one canonical EPSG per county from the D3 table? When the plat and the county disagree, the anchor records both, and `geom_local` uses the target.
- **Q6. Fetch the subject ring in its native system** (one extra unbuffered query) instead of transforming the WGS84 copy? *(Answered yes, 2026-09-25; D4.)*
- **Q7. Where does the registry live, and who fills it?** *(Answered in v1.2.)* There is no separate registry. The record is the `native_sr` field on the parcel layer's entry in the module's `layer-identity.json` (D2), which prospector already writes and the layer-identity guard already checks. "Surveyor jurisdiction data" in v1 was vague: the `jurisdictions/<slug>.md` field guides are prompt prose, and the Library project holds prospector status, not layer metadata. Neither fits. A county-keyed lookup exists only as D3's curated fallback table.
- **Q8. Replats and multi-parcel mismatches** (the plat lot ≠ today's county parcel). Should the correspond agent be allowed `union_of`/`within` claims, and should a low IoU auto-reject, or always go to the operator? Proposed: always the operator in v1.
- **Q9. Curves as chords:** acceptable for v1 fits? Proposed: yes; `has_approximated_curves` caps the class at `gis_fit` and lowers the auto-accept threshold.
- **Q10. `geo.kind` vocabulary for anchored rows:** *(Answered 2026-09-25: reuse Cartographer's `kind` verbatim; `method='anchored'` is the discriminator, and `sir_parcels` already returns `method`. An anchored plat lot drawn in the same tab as the county ring is the comparison we want.)* Cartographer already emits `kind='parcel'` for 3 of its 8 car-wash figures, so a consumer that wants only county rings must filter on `method='county_api'`, not on `kind`.
- **Q11. Backfilling existing `county_api` rows:** *(Answered 2026-09-25: a hand-curated SQL keyed by `sir_id` using the county table, reviewed row by row, run as its own go after P0a merges.)* Prod's 26 rows (20 SIRs) carry `properties.source` as free text that names the layer differently per SIR, so a mechanical re-read is not possible; the two old rows with a bare `native_sr: 102739` must map through EPSG (2277), not the ESRI code.
- **Q12. Demote on a failed residual gate, or anchor and flag?** When rung 1's control points disagree with the walked shape by more than `PRINTED_COORD_ACCEPT_FT`, D7a drops to the next rung and reports it. The alternative is geometry-placement D2's rule: the higher-ranked evidence places the figure and the disagreement is reported. Proposed: demote. A `survey` class on a misread box is a false accuracy claim the map cannot show, while a `gis_fit` with a note is honest, and the operator can send the frame back to 2.1.
- **Q13. Does `tied` to county linework outrank `gis_fit`?** In v1 every located feature is a county parcel vertex or edge, so a `tied` anchor's position is only as good as the county's drawing, the same as `gis_fit`. Proposed: keep rung 2 above rung 3, because a named tie removes the rotation ambiguity a fit has, but record `metrics.tie_source` and gate residuals per source (1 ft for a monument, 10 ft for county linework). A consumer that needs position accuracy treats `tied` + `county_parcel` like `gis_fit`.

## 6. Decisions index

D1 the county layer declares the zone (reverses geom-local §2 for the county path) · D2 `getLayerSpatialReference(layerUrl)` + `native_sr` in `layer-identity.json`, prospector fills it · D3 fallback: recorded/live layer value → curated county table → NULL, no point-in-box · D4 resolve-site/RPC wiring · D5 content-hash linking · D6 extraction records basis/units/scale/control points · D7 one ladder (D7a, run by 3.1 solve) and three solvers (D7b printed coordinates, D7c ties, D7d ring fit) · D8 shared metrics incl. ambiguity, demoted_from, tie_source · D9 one anchor per frame · D10 separate manual runbook · D11 auto-accept suggestion only · D12 anchors table, no geometry FK · D13 `geo` rows produced as `method='anchored'` · D14 staleness never deletes · D15 `cartographer/VISION.md` gains an anchoring section in the first cartographer PR (done, cartographer#29).

## 7. Coordination and risks

- **extract-geometry-v2** landed as one finished PR (bureau#1696, 2026-09-24). P0c's prompt changes went into both v1 (cartographer#30) and v2 (bureau#1813); the scripts are shared through the `carto` wrapper.
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
- Survey data: IG report <https://inspector-general-gamma.vercel.app/reports/view/2026-09-23-sir-geometry-source-survey/> (§1.5). `data.json` has every geometry with its source `sir_artifact` ids.
