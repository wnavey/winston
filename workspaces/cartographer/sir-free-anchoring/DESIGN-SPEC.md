# Anchoring without a SIR — a loose PDF from upload to the map

**Status:** Draft v1.3
**Date:** 2026-10-14
**Repos touched:** `bureau` (`anchor-geometry` steps 1.1 and 1.2; a zone-name reverse index in `spcs_lookup.py` and a page-1 reader under `site-research/bin`), `cartographer` (`runbooks/anchor-geometry/scripts/{fetch,publish}.ts`; `src/routes/anchored`; a new `src/routes/anchor/[id]`), `substation` (`geo` and `cartographer_anchors` ownership columns; the three RPCs in `geo_helpers.sql`)
**Repos NOT touched:** `cityhall-new`, `surveyor`, `conductor2`, `claude-plugins`, `quarry`
**Prod:** Supabase **Noetic App** (`mgxqsrjutswbciyrltwd`)
**Parent:** [`../north-star/NORTH-STAR-SPEC.md`](../north-star/NORTH-STAR-SPEC.md) (winston#303) — this is **P2a + P2b**, the decoupling and the manual path, peeled off on their own.
**Predecessor:** [`../anchoring-geometries/DESIGN-SPEC.md`](../anchoring-geometries/DESIGN-SPEC.md) (winston#279/#281) — the anchoring algorithm. Nothing here changes `anchor.ts`.

> **Revision note (v1.1, 2026-10-13).** Adds **§2.5 "Showing the work"** (D15–D20): an evidence
> trail for an anchor, modelled on the one `/processed` → `/geometry/[id]` already gives an
> extracted figure, reached by a link on the `/anchored` tile. A claim is **cited** (an existing
> `cartographer_geometry_evidence` row, referenced by id and never copied — `basis_of_bearings`
> and both `scale_factor` rows already exist on the White Water figure with crops, boxes and
> grounds), **read** (the county off page 1, rendered in situ by `PdfPageOverlay` with no crop
> upload) or **computed** (the `spcs_lookup` resolution and the ArcGIS fetch, which have no page
> and must not pretend to). Sections 2–4 of the page are almost entirely data that is **already
> in prod and never rendered** — correspondences' prose justifications, `metrics.notes`' reason
> per unmatched figure, 28 residuals, the overlay PNG — so the page can be built against anchor
> `e94fae93` before any decoupling lands. New **S5**; new **Q9–Q11**, of which Q11 is a possible
> bug: `evidence.check_md` is null on that run.

> **Revision note (v1.2, 2026-10-14, after audit).** Two gaps closed and five facts corrected.
> **(1) D10 had no location.** It fetched the ring by `--lat --lon` and nothing on the loose-file
> path supplies a point — §1.5's coordinates came from the project this spec promises not to use.
> New **D10a**: a location ladder — `request.site_point` (operator override, new optional field in
> D3) → the plat's **legal description** queried against the parcel layer's legal-description
> field → an address through a jurisdiction locator — closed by an **area gate** against the
> plat's stated area. Measured on White Water: the legal description resolves to the same parcel
> §1.5 found by point; the City of Austin locator scores the address 100; the free Census geocoder
> returns **nothing** for a 2021 subdivision, which is why address is the last rung and not the
> first. **(2) D8's "exit 75" named no mechanism.** conductor2 parks a script step only when its
> *contract* exits 75 after `BLOCKED.md` is written; `fetch.py`'s no-target path today is
> `sys.exit(message)`, exit 1, a failed step. D8 now says who writes what. **Corrections:** D9 is
> already implemented (`frames.ts:230-233` → `anchor.ts:683`) and is restated as "unchanged, do not
> break"; its "~0.9 ppm" was ~33 ppm. §1.4's `e94fae93` is a rung-1 `printed_coordinates` anchor,
> not a ring fit — `fitToRing` has **no prod precedent**, which §5 now says. §1.5's first bearing
> read 285.4444°, it is 285.4556°. §3 omitted three files that hard-code the SIR
> (`1.2-fetch/contract.test.ts`, cartographer `lib/contracts.ts`, the `Database` types); added.
> Q1's path is in `noetic-inc/cityhall` (`cityhall-new` redirects). New **Q12** (area-gate
> tolerance); Q3 grows a second column. Audit points that would change functional logic beyond
> these (FIRM-panel `C` check, a `file_id` column instead of parsing `source_doc`, D13's effect on
> the SIR path, the pre-gate county write, an `anchor_id` index, Q7) are **not** folded in; they
> are listed in the PR thread for a decision.

> **Revision note (v1.3, 2026-10-14).** Reverses how v1.2 derived the target SRID. The county
> FIPS and the FIRM panel are gone: a FIPS is a county id, not a coordinate system, and its only
> job was to key a county → zone table. **The ring brings its own coordinate system.** The parcel
> layer returns `native_sr` with the feature (§1.5: `latestWkid 2277`), which is how the SIR path
> already gets `srid_local`; the loose-file path now takes it from the same place, one row earlier.
> **D4** is now request → ring → county table → stop; **D5** the ring is the source; **D6** the
> county is a *name*, read from the plat's recording reference, used only to pick the layer (Q3)
> and as the fallback when a layer is published geographic; **D7** the plat's zone is a *check*
> (zone name → the set of its EPSG codes; the derived code must be in it), no longer a source, and
> a plat with an `assumed` or `deed` basis proceeds with the check recorded as unavailable instead
> of parking; **D8** keeps the hard stop and its mechanism with the cases restated. **D10a** runs
> before the SRID exists, not after. D17's claim chain, §3 items 3, 4, 6 and 7, S3, §5 steps 1–2
> and the second negative, Q3 and Q6 follow. The audit's FIRM-panel countywide-`C` point closes
> itself. The `plan_set_county.py` name stays; its output drops `fips`.

---

## 1. Problem

### 1.1 What this is for

One sentence: **upload a site plan PDF to Cartographer, run `extract-geometry-v2`, run `anchor-geometry`, and see the result on the map** — with no SIR, no project, and no plan set anywhere in the loop.

That is north star §7's manual path, stated there as a design constraint rather than a feature: *"it must be possible to upload a loose PDF into Cartographer, carry it as far down the pipeline as the data allows, and see an anchored geometry on a map."* It is P2a (the anchoring target) and P2b (the manual path end-to-end).

### 1.2 The file this is specified against

Everything below is verified against one real file already in prod.

`cartographer_files.cc2e3a53-db9b-493f-b270-e9039b03284c` — `White Water Express Car Wash 071326.pdf`, 30 pages, 30,727,110 bytes, `status: processed`, `project_id: null`, `source_sir_artifact_id: null`, `content_sha256: ee1c0b6b…`. Autodesk Civil 3D 2021 vector output, 2592 × 1728 pt sheets.

`extract-geometry-v2` ran on it as `whitewater-cc2e3a53-v2-run1` and published **exactly one figure**, `cartographer_geometries.5ab01b03-67ac-43ea-bc99-f38f29690ebf`:

| field | value |
|---|---|
| `label` / `kind` | `LOT 1` / `parcel` |
| `source_pages` | `[2, 7, 12, 19]` |
| `frame_key` | `frame-1`, `placement_method: reference`, offsets `(0, 0)` |
| `mete.courses` | `N15°27'20"E 195.00` · `S74°32'40"E 217.63` · `S12°50'40"W 95.83` · `S09°53'38"W 99.74` · `N74°32'40"W 231.66` |
| `misclosure_feet` | `0.0024` |
| `computed_area_sqft` / `stated_area_sqft` | `43,560.21` / `43,560` |
| `basis_of_bearings` | `{kind: "grid", zone: "TEXAS CENTRAL ZONE", datum: "NAD 83", verbatim: "HORIZONTAL DATUM BASED ON THE TEXAS STATE PLANE COORDINATE SYSTEM, NAD 83, TEXAS CENTRAL ZONE."}` |
| `grid_or_surface` / `combined_scale_factor` | `surface` / `1.0000327271` |
| `distance_units` | **`null`** |
| `control_points` | **`null`** |

One figure is the **correct** answer, not an under-read. Sheet 2 is the recorded plat and it dimensions exactly one thing: Lot 1. Every easement on it carries a recording reference and nothing else — `WATER EASEMENT DOC. NO. 2020062709`, `15' AERIAL ELECTRIC DISTRIBUTION, TELECOMMUNICATIONS AND ELECTRIC FIBER EASEMENT DOC. NO. 2019035034`, `EXCLUSIVE WATER LINES VAULT EASEMENT DOC. NO. 2019079124`, `WASTEWATER EASEMENT DOC. NO. 2019129105`, `DRAINAGE EASEMENT DOC. NO. 2019129457`, `25' WATER EASEMENT DOC. NO. 2006240270`, `ELECTRIC TRANSMISSION DISTRIBUTION LINE EASEMENT VOL. 548, PG. 327`. No bearings, no distances. They are IG's *"27% located only by reference to another document"* bucket and belong to north star **D10 / P3**, deferred.

`control_points: null` is likewise correct. There are **no printed State Plane coordinates anywhere in the 30 sheets** — a grep of the full text layer for the Texas Central range at this site (`3,0xx,xxx` easting / `10,0xx,xxx` northing) returns nothing, and the only two benchmarks are vertical:

```
BM#50: ELEVATION = 653.11'   SQUARE CUT ON NORTHEAST SIDE OF CONCRETE MANHOLE RISER…
BM#51: ELEVATION = 651.45'   SQUARE CUT ON THE CENTER OF THE WEST EDGE OF A STORM WATER CURB INLET…
```

So this file is **rung 3, `fitToRing`**. Rungs 1 and 2 are unavailable by construction. For rung 3 the county ring *is* the anchor, which is why §1.4 is about sourcing a ring and not only an EPSG code.

### 1.3 Why it cannot run today

The project this file belongs to (`project.7a697ef1-733f-4d3b-87e6-9cce995d8f1e`, *WhiteWater Express Car Wash - 78747*, `jurisdiction_slug: austin`) has **no `site_intelligence_report` row and no `geo` rows at all**. The only `workflow_runs` row for it is a completeness check (`116d55ac`, `submissionVersionId: 6688de93-71ba-4827-8092-8ec61d92c8b1`).

Three couplings stop the run, and they are of different difficulty:

| | Where | What the SIR supplies |
|---|---|---|
| **C-a** | `bureau/runbooks/anchor-geometry/steps/1.1-inputs/contract.test.ts:13` — `sir_id: z.string().uuid()` | the request will not validate without one |
| **C-b** | `cartographer/runbooks/anchor-geometry/scripts/fetch.ts:126` → `:144` | the **target CRS**, as the modal `srid_local` of the SIR's `county_api` parcel rows |
| **C-c** | `fetch.ts:152-156` → `:161` | the **fitting target**, as `sir_geo_in_srid(sir, srid)` → `inputs/parcels.json` |
| **C-d** | `publish.ts:119`, `geo_helpers.sql:326-328` and `:434-436` | the **output destination** — `cartographer_anchors.sir_id` is `NOT NULL`, `geo.sir_id` is `NOT NULL`, and both delete-keys are `(sir_id, properties->>'anchor_id')` |
| **C-e** | `cartographer/src/routes/anchored/+page.server.ts:67,92-93,106` | the **viewer** loops `sirIds` and calls `sir_parcels(p_sir)` per SIR |

**C-b already has an escape hatch that ships.** `target_srid` is optional on the request (`contract.test.ts:15`), passed through by `fetch.py:45-47`, and takes precedence at `fetch.ts:116-121` with `source: 'flag'`. It exists because SIRs researched before bureau#1812 have no `srid_local`.

But it does **not** remove the SIR. `sirId` is required unconditionally at `fetch.ts:46-48`, and `sir_geo_in_srid` is called unconditionally at `:152` *even when `target_srid` was supplied*. On White Water today, `target_srid: 2277` gets past `:144` and dies at `:161`: `SIR … has no geo rows; the anchor run needs at least the county parcel`.

### 1.4 The ring is the work, and it is already solved for SIRs

The one anchor run in existence, `cartographer_anchors.e94fae93-b3b6-42e5-9a24-fd16c476bee1` (car-wash plat, Jefferson County KY, target 3089, accepted 2026-09-28), is a **rung-1 `printed_coordinates`** anchor, class `survey`: the frame was placed from the plat's own coordinate boxes, and its two ring correspondences were targets for the metrics, not the thing it was fitted to. Those targets were two ordinary `county_api` rows:

| geo id | label | method | `source_doc` | area ft² |
|---|---|---|---|---|
| `71fd4e9f-d710-49b0-8235-e8b8117202a7` | 4401 Fegenbush Ln | `county_api` | `parcel-rings.geojson` | 44,558 |
| `22824c2a-fe7a-49c2-a042-4b4d4c81d4a2` | 4403 Fegenbush Ln | `county_api` | `parcel-rings.geojson` | 113,595 |

Those were written by `sir_add_parcel_geo` (`geo_helpers.sql:143`) at SIR publish, from the county ArcGIS fetch `site-research` had already staged. **The ring came from the county. The SIR was only the row it hung off.** So the *sourcing* pattern this spec needs is not new — it is the existing pattern with the owner removed.

What *is* new is the solver rung. `fitToRing` (rung 3) has never run end to end on real data: the one prod anchor is rung 1, and White Water cannot be anything but rung 3 (§1.2). §5 step 3 is therefore a first, not a regression test, and should be read that way.

Two findings from reading that run, both of which this spec acts on:

- **"8 figures, 1 anchor" verifies.** The plat had 8 figures and the SIR had only 2 county rings. LOT 2 (44,546 extracted) fitted 4401; LOT 3 (113,595) fitted 4403; the remaining six — LOT 1 at 168,282 ft², three ROW dedications, two easements — had **no target at all** and rode the frame's transform. North star §4.4 confirmed against real data.
- **`cartographer_anchors.target_geo_ids` already dangles.** It lists three ids; only two exist. `68ca747d-fc39-41a7-9187-5c54b093fa06` is gone from `geo`. It is a bare `uuid[]` with no foreign key and it has already rotted on the only anchor run we have. §3.6 gives it a job; **Q7** asks whether to constrain it.

### 1.5 What a live county fetch returns, measured

Run during this spec against the layer `jurisdictions/austin-tx.md` names, at the site:

```
arcgis_query.py point https://maps.austintexas.gov/arcgis/rest/services/Shared/AppraisalDistricts/MapServer/0 \
  --lat 30.15026 --lon -97.79345 --geometry --native-ring --out tcad
→ 1 feature: PID_10 0436110202, PROP_ID 775822
→ native_sr {wkid: 102739, latestWkid: 2277, projected: true, source: "layer"}
→ ring: 1 ring, 7 points
```

The ring's edges against the plat's courses:

| TCAD native edge | plat course |
|---|---|
| 231.64 ft @ 285.4487° | `N74°32'40"W 231.66` (285.4556°) |
| 195.00 ft @ 15.4481° | `N15°27'20"E 195.00` (15.4556°) |
| 217.63 ft @ 105.4480° | `S74°32'40"E 217.63` (105.4556°) |
| 95.83 ft @ 192.8446° | `S12°50'40"W 95.83` (192.8444°) |
| 86.82 + 12.92 ft @ 189.894° | `S09°53'38"W 99.74` (189.8939°) — TCAD splits the single call at a collinear vertex |

Area 43,557.77 ft² against the plat's 43,560. **The rung-3 fit on this file should be near-exact.** Lenox Springs Section III is a 2021 plat and TCAD digitised it from the recording; this is not representative of older parcels, which are the ±3 ft `gis_fit` case north star §9.4 warns about.

One more measured fact: `project.site_outline` for this project is **vertex-identical to that live fetch** — same seven points to ≤ 1.8 × 10⁻⁹ degrees, wound the opposite way. So the parcel is already resolved and already in the database, despite there being no SIR and no site-research run. What `site_outline` lacks is everything but the shape: no `parcel_id`, no legal description, no `native_geometry`, no `native_sr`. See **D10**'s rejected alternatives for why that is not good enough to build a `county_api` row from.

**Where the point came from, and what else finds the parcel (v1.2).** The `--lat --lon` above were the project's `site_address` geocoded by hand — nothing a loose file carries. A parcel layer answers a point query or an attribute query and never an address, so the routes that start from the plan set's own text were measured too (2026-10-14):

| route | input off the plan set | result |
|---|---|---|
| legal description → `arcgis_query.py where` on `…/AppraisalDistricts/MapServer/8` (OmniParcel, which has `LEGAL_DESCRIPTION`; layer 0 has only `PID_10`/`PROP_ID`) | `LOT 1 … LENOX SPRINGS SECTION III` (page 1, line 150) | 4 Lenox Springs rows, exactly one `SEC III`: `PARCEL_NUMBER 0436110202` — the same PID the point query returned |
| address → City of Austin `Geocode/COA_Locator` | `10416 Brezza Ln` (title block) | score 100 at (30.15016, −97.79374), 12 m from the point above |
| address → Census `geocoder/locations/onelineaddress` | same | **0 matches** — a 2021 subdivision is not in TIGER yet |

The plat's legal description is the parcel's own name in the county's table and needs no geocoder; the address needs a locator the jurisdiction happens to publish; the one free national geocoder fails on precisely the new-plat case this spec is built for. That ordering is **D10a**.

### 1.6 Scope

**In:** making `anchor-geometry` run on a `cartographer_files` row that nothing owns, resolving the target SRID without an operator typing it, sourcing and persisting the fitting target, making `geo` and `cartographer_anchors` accept no owner or an optional one, and making `/anchored` draw the result.

**Out, deliberately:**

- **The sheet-linework reader.** Reading the *drawn* geometry off a vector plan sheet — tracing the dashed property line with `plan_vectors.py`, solving page-pixels → State Plane, and placing the building, pond, curbs and mains — is north star §6 / **P5**. It is where the value is on a plan set (metes-and-bounds prose gives you the boundary and, by construction, nothing else), and it looks tractable: on sheet 12 the heavy dashed property line merges across its 28 dashes into one run of **3475.00 px**, which at 300 dpi is **231.67 ft** against the plat's 231.66, and **15.0004 px/ft** — exactly 1″=20′, self-confirming. None of that is in this spec. §6 names only the seams it must not foreclose.
- Schema elegance. Duplicating an RPC is preferred to generalising one where generalising costs a migration on 56 live rows.
- Any change to `anchor.ts`, to `extract-geometry-v2`, or to steps 2.1, 3.1, 3.2, 3.3 and 4.1 of `anchor-geometry` — **five of nine steps are untouched**, because none of them has a SIR concept and they only read `inputs/parcels.json`, whose shape does not change.
- Backfilling the 56 existing `geo` rows to a new ownership model. All 56 derive a `project_id` cleanly (31 SIRs → 31 projects, 1:1, zero orphans) if that is ever wanted; **Q8**.

---

## 2. Decisions

### 2.1 Ownership

**D1. `geo.sir_id` becomes nullable, and `geo` gains a nullable `submission_version_id`.** A `geo` row may be owned by a SIR (today's rows, unchanged), by a site-plan submission version, or by **nothing**. Nothing is a first-class case — it is what a loose PDF produces, and it is the case this spec exists to serve.

`submission_version` is the right grain: for White Water, `submission_version.6688de93-71ba-4827-8092-8ec61d92c8b1` → `submission.38ddbfd8` → `project.7a697ef1`, and `plan_set_version.6b4c9887.submission_version_id = 6688de93`, so the join to the plan set already exists and nothing new is needed to reach the project.

There are **no RLS policies on `geo`, `cartographer_files`, `cartographer_geometries` or `cartographer_anchors`** (verified: `pg_policies` returns zero rows for all four), so this is a column change, not a policy rewrite.

**D2. `cartographer_anchors` takes the same treatment** — `sir_id` nullable, new nullable `submission_version_id`.

**D3. The run request's owner fields are all optional.** `1.1-inputs`'s `Request` becomes `{file, anchor_run_slug?, scope_note?, target_srid?, site_point?, sir_id?, submission_version_id?}`. The only required field is `file`. A request naming both owners is accepted (**Q2** asks whether to forbid it). `site_point` is `{lat, lon}` (WGS84), the operator's override for *where the parcel is* (D10a), the sibling of `target_srid`'s override for *which grid*; it is ignored on the SIR path, where the SIR's rows are the target.

### 2.2 Resolving the target SRID

**D4. The ladder is: the request, then the ring, then the county table, then stop.**

1. `request.target_srid` — the existing operator override (`contract.test.ts:15` → `fetch.py:45` → `fetch.ts:116`), unchanged, always wins.
2. **The fetched ring's native spatial reference** (D5). The parcel is found first (D10a); the layer returns `native_sr` with the feature. When it is projected, that is the target.
3. **The county table** (D6), only when the layer is published geographic: the county *by name* from the plat's prose → `spcs_lookup --state --county` → EPSG + unit.
4. **Fail fast** (D8). There is no silent fallback.

In every derived case the plat's own zone must agree with the result (D7).

**D5. The ring brings its own coordinate system.** §1.5's fetch returned `native_sr {wkid: 102739, latestWkid: 2277, projected: true, source: "layer"}` with the feature. `arcgis_query.py` already reports it, `sir_add_parcel_geo` already stores it as `srid_local`, and the SIR path's target CRS (C-b) is nothing but the modal `srid_local` of those rows. So the loose-file path derives the target the way the SIR path already does, from the layer rather than from the SIR's copy of the layer. No county id is involved. The v1.2 alternative — a county → zone table — was itself reconciled against this layer (its Travis row's note says so), so the table agreeing with the ring was partly the layer agreeing with itself.

**D6. The county is a name, used for two things: finding the layer, and the fallback.** It is read from page 1's prose — `line 150: … PUBLIC RECORDS TRAVIS COUNTY, TEXAS.` — which every recorded plat carries in its recording reference and certification block. `spcs_lookup.py --state TX --county Travis` already accepts a name; nothing needs a FIPS.

- *Finding the layer.* The jurisdiction → parcel-layer registry (**Q3**) is keyed by it. This is the one real gap, and it is a registry problem, not a parsing problem: `jurisdictions/austin-tx.md` is prose for an agent and `site-research/steps/1-resolve-site` is an agent step; surveyor's `native_sr` is recorded **per GIS layer**, not per county — inside Travis County's own server, `DBO.Parcels` is 2277 while `DBO.County` and `DBO.Precincts` are published as geographic WGS84 WKT — so surveyor cannot stand in for the registry either.
- *The fallback.* When the ring layer is published geographic (4326) or in Web Mercator, `native_sr` names no State Plane and the county table is the only source: `spcs_lookup.py --state TX --county Travis` → `{"epsg":2277,"units":"ftUS","zone":"tx_central","basis":"ngs_zone"}`. Stdlib, zero network, already in bureau. This is the only case where the county matters for the SRID.

The FIRM panel number is **not read**. Its only advantage was a FIPS without a name lookup, which nothing needs; its costs are real — community-based panels carry a community id in the FIPS slot, panels get cited without their prefix, and flood notes are common on site plans but absent from a bare recorded plat, which is P2b's input.

**D7. The plat's zone is the check, not the source — no new vision call.** `extract-geometry-v2` already captured `basis_of_bearings` (§1.2), and `fetch.ts` already reads it into `inputs/README.md`; re-reading the PDF is not an option because **page 2 has 641 non-whitespace characters in its text layer** (the plat's lettering is vector outlines). A new reverse index in `spcs_lookup.py` maps a zone name and datum to the **set** of its codes — `("TEXAS CENTRAL ZONE", "NAD 83") → {2277 (ftUS), 32139 (m)}` — and the derived code must be a member. The set, not a code, because the bearing-basis note never states a unit (*"COORDINATES AND DISTANCES ARE SURFACE VALUES. COMBINED SCALE FACTOR IS 1.0000327271."*), which is why `distance_units` is `null` on the extracted row; the unit comes with the layer's code, so the ambiguity never has to be resolved by the plat. The check is recorded as a computed claim (D17) in three states: `agrees`, `disagrees` (a D8 stop), or `unavailable` when `basis_of_bearings.kind` is `assumed` or `deed` — the run proceeds in that case, since the ring's system is authoritative and `fitToRing` solves the rotation anyway, and the readout at `4.1` shows that no check was possible.

**D8. Disagreement is a hard stop.** The run parks at `1.2-fetch` with a message naming the readings and the fix (`target_srid` in `request.json`). The cases:

- the ring's code is projected but **not in the plat zone's set** — the plat says Texas Central and the layer stores 2278 South Central: the registry entry points at the wrong layer, or the parcel found is in the wrong county;
- the plat names a zone the reverse index does not know — a **low-distortion or county projection**, increasingly common on Texas plats — so the check cannot run and the plat's grid is not the layer's;
- the layer is geographic and `spcs_lookup` has no row for the county (split between zones, `_about.unassigned`), or page 1 names no county, or more than one (**Q6**);
- the PDF is a scan with no page-1 text layer and no `site_point` was given (a D10a stop).

A wrong SRID does not fail loudly. It produces a plausible similarity transform onto the wrong grid, and `fitToRing` will cheerfully report an IoU for it. The escape hatch already exists and costs the operator one number.

**How the stop is delivered.** "Parks" has one mechanism in conductor2 and it is not the script's exit code: *a step is parked when its contract exits 75 after the step wrote `BLOCKED.md`* (conductor2 README, "Exit 75 from a contract"; the pattern is in `bureau/runbooks/lib/contract-helpers.ts:764-787`). Today `fetch.py`'s no-target path is `sys.exit(message)` — exit 1, a **failed** step that `advance` will not retry and `status` shows as an error, not as `waiting`. So:

1. `fetch.ts` exits 3 (its existing `NO_TARGET` code) for every D8 case and prints a one-line reason and the fix to stderr, as it does now.
2. `fetch.py` catches 3, writes `fetch.log` as today **and** `BLOCKED.md` — the readings, the case, and the exact `request.json` key to set (`target_srid`, or `site_point` for a D10a stop) — then exits 0.
3. `1.2-fetch/contract.test.ts` answers 75 when `BLOCKED.md` exists and `ws/inputs/target.json` does not, so the pass ends `waiting`, `status` names the step with `BLOCKED.md` as its readout, and editing `request.json` and advancing relaunches the step cold.

The same path carries the D10a stops. Nothing here is new machinery: it is site-research's `1-resolve-site` browser-gone pattern applied to a script step.

**D9. `grid_or_surface` and `combined_scale_factor` stay in the solve — this is already the case; do not break it.** The plat's distances are **surface**; the target grid is not. `frames.ts:230-233` (`frameScaleFactor`) already lifts `combined_scale_factor` off every `surface` figure in a frame and hands it to `anchor.ts` as `statedScaleFactor` (`frames.ts:353` → `anchor.ts:683`), and on this file it is `1.0000327271`. Nothing in this spec touches that path; D9 exists so that the D4–D8 rewrite of `fetch.ts` does not drop the two fields from `inputs/geometries.json` on the way through. Discarding the factor would put the ring out by ~33 ppm (0.0076 ft on the 231.66 ft course) — negligible on a 1-acre lot, and exactly the class of thing that silently poisons a fit at scale.

### 2.3 Sourcing the fitting target

**D10. `1.2-fetch` fetches the county ring live and writes it into `geo` as a `county_api` row before solving.** This is the pattern that already runs (§1.4), with the owner removed. Concretely: find the parcel (D10a), fetch it with `arcgis_query.py … --geometry --native-ring`, then an RPC that is `sir_add_parcel_geo` with the ownership changed, then `fetch.ts` reads the row back and builds `inputs/parcels.json` exactly as it does today.

**D10a. Finding the parcel is a ladder, and the ladder ends in an area gate.** It runs **before** the target SRID exists, because the ring is where the SRID comes from (D5). The solver never needs a lat/lon; only the fetch does, and a loose file carries none (§1.5). The layer to query is the registry entry (Q3) for the county named in the prose (D6). The rungs, first match wins:

1. **`request.site_point`** (D3) → `arcgis_query.py point <layer> --lat --lon`. The operator override; always wins when present. This alone makes S1 runnable.
2. **The plat's legal description** → `arcgis_query.py where <layer> --where "<legal-description field> LIKE …"`. The page-1 reader (§3 item 4) already has the text layer open for the county name; it takes the lot/block/subdivision line beside it (`LOTS 1 OF LENOX SPRINGS SECTION III`). The query must return **exactly one** feature after section/phase disambiguation — on White Water, four Lenox Springs rows, one `SEC III`. This is the primary derived rung because it is the parcel's own name in the county's table, needs no geocoder, and is the thing a plat cannot omit.
3. **The address** → a locator → point → rung 1's query. Only when the jurisdiction publishes one (`Geocode/COA_Locator` for Austin). Never a national geocoder as the sole source: Census returns nothing for this 2021 plat.
4. **Stop** (D8's mechanism), naming what was read and the fix: `site_point` in `request.json`.

**The gate.** Whatever rung found the feature, `fetch.ts` compares the fetched ring's native area with the figure's `stated_area_sqft` (or `computed_area_sqft` when none is stated) and stops when they differ by more than the **Q12** tolerance. On White Water that is 43,557.77 vs 43,560. A rung-2 string match on the wrong section, or a rung-1 point in the neighbour's lot, fails here rather than producing a confident fit to the wrong parcel — the same reasoning as D8's "a wrong SRID does not fail loudly".

Each rung is a §2.5 claim: rung 2 is a **read** (page 1, bbox, verbatim, `basis: "legal_description"`); rungs 1 and 3 are **computed** (`{kind: "fetched", url, where | point, feature_count, pid, native_sr}`); the gate is a computed claim with both areas. The fetched claim's `native_sr` is also the D5 SRID source, so one claim serves both ladders.

What this does *not* solve: rung 2 needs the layer to have a legal-description field and the registry (Q3) to name it. TCAD's geometry layer (`MapServer/0`) has only `PID_10` and `PROP_ID`; its sibling `MapServer/8` (OmniParcel) carries `LEGAL_DESCRIPTION`. So Q3's per-jurisdiction entry is two things, not one: the parcel-ring layer and the legal-description layer + field.

Three consequences, all wanted:

- `inputs/parcels.json` keeps its shape, so **`2.1-correspond` needs no changes** — it still reads `properties.legal_desc`, per-feature rings, and the county's own ids to make and quote its claims.
- `cartographer_anchors.target_geo_ids` points at real rows, which is what D11 needs.
- The project ends up with its county parcel ring in `geo`, which is `geo`'s dominant row type anyway (46 of 56).

Rejected alternatives:

- **Transient fetch** (no `geo` write): `target_geo_ids` would go empty and the viewer's context layer would be empty, so you would see an anchored lot floating on the aerial with nothing to judge it against — which is the entire point of looking at it on a map.
- **Promote `project.site_outline`**: zero network and present for 57 of 59 projects, but it is a collected, deduped geometry with no parcel id, no legal description, no `native_geometry` and no `native_sr`. `geom_local` would become a reprojection rather than the county's own digitisation — the exact distinction `sir_add_parcel_geo` goes to trouble to preserve (it Hausdorff-checks the native ring against the WGS84 one in a 50 m two-sided containment test before trusting it, `geo_helpers.sql` ~:190-215). Throwing that away to save one HTTP call is the wrong trade on the table that is meant to become the derived spatial layer. It also breaks correspond's evidence.

**D11. The idempotency key for an unowned `county_api` row is the cartographer file.**

Today's key (`geo_helpers.sql:172-175`) is:

```sql
where sir_id = p_sir and kind = p_kind
  and method = 'county_api' and label is not distinct from p_label
```

With `p_sir` NULL this is a **never-match**, not a wrong-match: `sir_id = NULL` is NULL, so the lookup finds nothing and always inserts. Run the anchor runbook twice on the same loose PDF and you get two county rings, then three, and `/anchored`'s context layer accumulates duplicates. The naive repair (`sir_id is not distinct from p_sir`) is worse — it makes every unowned county row collide with every *other* unowned county row sharing a kind and label, across unrelated sites.

So the new RPC keys on `(file_id, kind, label, method='county_api')`, with `file_id` taken from the `source_doc` the function already writes (`'cartographer:' || file_id`). It is stable across re-runs of both runbooks, and it makes "this file's county context" a single well-defined set regardless of whether anything owns it.

### 2.4 Publishing and the map

**D12. The delete-key for an anchor's rows becomes `properties->>'anchor_id'` alone.** It appears twice — `sir_put_anchored_geo` (`geo_helpers.sql:326-328`) and the reject path of `cartographer_anchor_decide` (`:434-436`) — and both are currently `(sir_id, anchor_id)`. `anchor_id` is already sufficient and unique; the `sir_id` conjunct is redundant today and wrong once `sir_id` is nullable. This is the one place where the decoupling makes the schema simpler rather than wider.

**D13. `/anchored` finds its context through the anchor, not through an owner.**

```
figures = geo WHERE properties->>'anchor_id' = anchor.id      -- unchanged (+page.server.ts:139)
context = geo WHERE id = ANY(anchor.target_geo_ids)           -- replaces sir_parcels(p_sir)
```

This works with zero owners and gives `target_geo_ids` a real job — which is incidentally the reason to fix its integrity (§1.4, **Q7**). The SIR rail subtitle (`+page.server.ts:71`) becomes optional rather than per-anchor-required.

**D14. The `4.1-hitl` gate is unchanged.** It exists so a fit cannot publish itself. Even on the near-perfect car-wash run `auto_accept_suggested` was `false`, because of the C5 union-outline metric bug (north star **P0c** / winston#289 B3), so the gate is still the only real check. Removing it is a separate decision that depends on P0c.

### 2.5 Showing the work

`/processed` → `/geometry/[id]` gives an extracted figure a real evidence trail: every course, the stated area, the basis of bearings and the scale factor each carry a **verbatim**, a **page**, a **box**, a **crop** and a prose **grounds**, rendered over the source PDF. An anchor has nothing equivalent — `/anchored` is a flat list whose only link is to the file (`anchored/+page.svelte:183`). D4–D10 make that worse before they make it better: the run now *derives* its coordinate system instead of being handed one, and a derivation you cannot inspect is a guess with better manners.

**D15. Every fact the anchor run uses to place a frame is recorded as a claim**, and a claim is one of three kinds: **cited** (an evidence row the extract run already proved), **read** (something this run read off the PDF), or **computed** (a lookup or a fetch, with no page at all).

**D16. Cited claims are referenced by id, never copied.** The three facts D4–D9 depend on already exist on the White Water figure, with crops and grounds:

| role | verbatim | page | crop |
|---|---|---|---|
| `basis_of_bearings` | "HORIZONTAL DATUM BASED ON THE TEXAS STATE PLANE COORDINATE SYSTEM, NAD 83, TEXAS CENTRAL ZONE." | 2 | `6e77e887…jpg` |
| `scale_factor` | "COORDINATES AND DISTANCES ARE SURFACE VALUES." | 2 | `6e77e887…jpg` |
| `scale_factor` | "COMBINED SCALE FACTOR IS 1.0000327271." | 2 | `1cea8d28…jpg` |

Their `confidence.grounds` are already doing the argument's work and must be surfaced verbatim, because each names the exact limit this spec works around: the basis-of-bearings row says *"no zone number or datum realization is printed"* (which is why the ring, not the plat, is the SRID source — D5, D7), and the scale-factor row says *"the note does not say whether the factor takes grid to surface or surface to grid"* (which is a live caveat on D9, and should be shown next to the applied factor rather than buried).

So the anchor stores `{kind: "cited", evidence_id}` and the page renders that row's verbatim, grounds and crop. No new evidence machinery, no duplication of a reading, and the trail stays single-sourced — if a re-extraction corrects the note, the anchor page corrects with it.

**D17. Read and computed claims carry what they can, and are honest about what they cannot.**

- **read** — the county, off page 1's text layer (D6): `{kind: "read", value: {county: "Travis", state: "TX"}, page: 1, bbox, verbatim: "PUBLIC RECORDS TRAVIS COUNTY, TEXAS", basis: "recording_reference"}`, and the legal description for D10a rung 2. `pdftotext -bbox` gives the box, so these render **in situ** over page 1 — `PdfPageOverlay` takes normalized `[x0,y0,x1,y1]` fractions plus a `kind` for colour and needs no stored crop image. A stored crop stays optional (**Q10**).
- **computed** — the fetch and the check have no page and must not pretend to: `{kind: "fetched", url, where | point, pid: "0436110202", native_sr: {wkid: 102739, latestWkid: 2277, projected: true}, feature_count: 1, fetched_at}` is the SRID source (D5); `{kind: "computed", tool: "spcs_lookup.py --zone", input: {zone: "TEXAS CENTRAL ZONE", datum: "NAD 83"}, output: [2277, 32139], check: "agrees"}` is the D7 check; and, only when the fallback ran, `{kind: "computed", tool: "spcs_lookup.py", input: {state: "TX", county: "Travis"}, output: {epsg: 2277, units: "ftUS", zone: "tx_central"}, table_note: "…"}`. The page renders these as a request and a lookup, not as a reading.

The chain the page must make legible, end to end, is: *the plat says Texas Central / NAD 83 but prints no zone number and no unit* → *the plat's recording reference says Travis County, which picks the TCAD layer* → *the TCAD layer stores its parcels in 2277* → *2277 is a Texas Central code, so the plat agrees* → *no operator input was needed*.

**D18. The derivation record travels the path `correspondences.json` already takes.** `1.2-fetch` writes it into `inputs/target.json`; `5.1-publish` carries it into `cartographer_anchors.evidence.derivation`, beside the `correspondences` key `publish.ts` already assembles. No new table.

**D19. `/anchored`'s tile gains a link to a new `/anchor/[id]`**, mirroring `/processed` → `/geometry/[id]` (`processed/+page.svelte:420`), which is the prior art for the whole page — signed PDF, box overlay, a rail of claims, four queries and no joins.

**D20. The page reads in four sections, in this order.**

1. **How we got the system** — the D15 claim chain ending in EPSG 2277, each claim showing its kind, and the cited ones showing their crop and grounds. This is the section that did not exist before and the reason for the whole item.
2. **What we fitted to** — the ring fetch, and the correspondences. `evidence.correspondences` **already** stores the agent's prose justification per ring match and it has never been rendered: *"plat label 'LOT 2' = county parcel '4401 Fegenbush Ln' (PVA parcel_id 061801400000, role 'subject-vacant-pad'), whose PVA acres 1.023 equal both the plat's stated LOT 2 area and the SIR's own 'Lot 2' row"*.
3. **The solve** — rung and accuracy class, `params` (θ, scale, tE, tN, k_units), the residual table, the metrics, and the overlay PNG from `evidence.overlay_path`. `metrics.notes` already carries a prose reason per *unmatched* figure — *"'RIGHT-OF-WAY DEDICATION AREA 1' is a strip dedicated to the public road out of the lots' frontage; the SIR carries no right-of-way row … It rides on the frame through its own printed coordinate boxes"* — which is the clearest explanation of "8 figures, 1 anchor" we have and is currently invisible.
4. **The result** — the map, as `/anchored` draws it today.

Sections 2 and 3 are **almost entirely rendering data that already exists and is thrown away**: on the one anchor run in prod, `evidence` holds `correspondences`, `constraints_used`, `overlay_path`, `check_md` and `decision_note`, and `metrics` holds 28 control-point residuals, five prose notes, IoU, Hausdorff, area ratio, free scale and θ-vs-grid. The only genuinely new recording is §2.5's derivation.

One gap worth naming: **`evidence.check_md` is null on that run**, so the `3.3-check` vision readout — the step whose entire job is to say whether the overlay looks right — reached the database empty. Whether that is a publish bug or a step that wrote nothing is **Q11**.

---

## 3. The change, piece by piece

| # | File | Change |
|---|---|---|
| 1 | `bureau/.../steps/1.1-inputs/contract.test.ts:13` | `sir_id` → optional; add optional `submission_version_id` and `site_point` (D3) |
| 1b | `bureau/.../steps/1.2-fetch/contract.test.ts:41,56-62,64-67` | `Target.sir_id` → optional; the request-match test tolerates no SIR; the "[BLOCKING] SIR has at least one parcel ring" test becomes "parcels.json has at least one parcel ring"; **answer 75 when `BLOCKED.md` exists and `target.json` does not** (D8) |
| 2 | `bureau/.../scripts/fetch.py` | pass the owner fields, `site_point` and the resolved SRID through; on exit 3 write `BLOCKED.md` and exit 0 (D8) |
| 3 | `bureau/runbooks/site-research/bin/spcs_lookup.py` | add a **zone-name → set of EPSG codes** reverse index over the table it already owns (D7); `--state --county` by name is the fallback (D6) |
| 4 | `bureau/runbooks/site-research/bin/` (new) | `plan_set_county.py` — page-1 text layer → `{county, state, legal_description, address, evidence}` from the recording reference and title block (D6); the county picks the layer (Q3), the legal description and address feed D10a rungs 2 and 3 |
| 5 | `cartographer/.../scripts/fetch.ts:46-48` | `--sir` → optional; new `--submission-version`, `--site-point`; owner may be absent |
| 5b | `cartographer/.../scripts/lib/contracts.ts:102,104,196` | `TargetFile.source` gains `'derived'`; `TargetFile.sir_id` and `AnchorsFile.sir_id` → nullable; `TargetFile` gains `derivation` (D18) |
| 5c | `cartographer/src/lib/types/database.ts` | regenerate after item 9: `sir_id` nullable, `submission_version_id` on both tables |
| 6 | `cartographer/.../scripts/fetch.ts:116-147` | insert the D4 ladder between the flag and the stop — ring `native_sr`, else the county table — and the D7 zone check; every stop is exit 3 with a reason (D8) |
| 7 | `cartographer/.../scripts/fetch.ts:152-161` | when there is no SIR: find the parcel (D10a ladder + area gate) **first**, fetch the county ring (D10), take the target from its `native_sr` (D5), write it, read it back; `sir_geo_in_srid` is used only on the SIR path |
| 8 | `cartographer/.../scripts/publish.ts:119` | `sir_id` may be null; carry `submission_version_id` |
| 9 | `substation/supabase/migrations/` (new) | `geo.sir_id` nullable + `geo.submission_version_id`; same on `cartographer_anchors` (D1, D2) |
| 10 | `substation/supabase/functions/geo_helpers.sql` | new `add_parcel_geo` (D10, D11); `sir_put_anchored_geo` and `cartographer_anchor_decide` delete-keys → `anchor_id` (D12) |
| 11 | `cartographer/src/routes/anchored/+page.server.ts:67,92-93,106` | context by `target_geo_ids` (D13) |
| 12 | `cartographer/.../scripts/fetch.ts` + `publish.ts` | emit the derivation record into `inputs/target.json`, carry it to `evidence.derivation` (D15–D18) |
| 13 | `cartographer/src/routes/anchored/+page.svelte:183` | tile links to `/anchor/{anchor.id}` (D19) |
| 14 | `cartographer/src/routes/anchor/[id]/` (new) | the evidence page (D20), modelled on `routes/geometry/[id]` |

**Untouched:** `anchor.ts` and every solver; `extract-geometry-v2`; `cartographer_geometry_evidence` and `cartographer_geometry_crops` (read, never written); and `anchor-geometry` steps `2.1-correspond`, `3.1-solve`, `3.2-render`, `3.3-check`, `4.1-hitl`.

**Deploy order:** substation (9, 10) → bureau (1–4) + cartographer scripts (5–8, 12) → cartographer app (11, 13, 14). Items 1b, 5b and 5c are on S1's critical path: with any one of them missing, a request without `sir_id` fails at the 1.2 contract, the 5.1 typecheck or the insert, respectively.

Items 13 and 14 are the only ones that can ship on their own: §2.5's sections 2–4 render data that is already in prod on anchor `e94fae93`, so the page can be built and reviewed against the existing car-wash run before any of the decoupling lands.

---

## 4. Testing seams

**S1: the `anchor-geometry` runbook, inputs → outputs** (existing)
- **Proves:** D1–D3, D10, D12 end to end — a `request.json` carrying only `{file, anchor_run_slug}` produces `anchors.json`, a `cartographer_anchors` row with `sir_id IS NULL`, and `geo` rows with no owner.
- **Prior art:** `cartographer/runbooks/anchor-geometry/scripts/anchor-e2e.test.ts`.
- **Runs:** locally against the White Water file; it is the §5 acceptance test.

**S2: `fetch.ts`'s CLI** (existing)
- **Proves:** D4–D9, D10 and D10a. The location ladder, the SRID ladder and the ring materialisation are all observable in `inputs/target.json` (`target_srid` + `source` + `derivation`) and `inputs/parcels.json`, with no database assertions needed. Each D8 and D10a stop is one invocation and one expected exit 3 with its reason on stderr; the area gate gets a case where the legal description matches the wrong section. Then one `fetch.py` case per stop proves `BLOCKED.md` is written and the 1.2 contract answers 75.
- **Prior art:** `cartographer/runbooks/anchor-geometry/scripts/lib/contracts.test.ts`, `frames.test.ts`.
- **Runs:** `bun test` in `cartographer`, CI.

**S3: the SRID resolver** (new, in `spcs_lookup.py`)
- **Proves:** D6 and D7's arithmetic alone — `("TEXAS CENTRAL ZONE", "NAD 83") → {2277, 32139}`; `2277 ∈ set` agrees; `2278 ∉ set` is the stop; an unknown zone name is the stop; `--state TX --county Travis → 2277/ftUS` is the fallback; a split county returns the stop rather than a guess.
- **Prior art:** `bureau/runbooks/site-research/bin/test_spcs_lookup.py` — same file, same style, stdlib `unittest`.
- **Runs:** `python3 -m unittest test_spcs_lookup`, CI.

**S4: the RPCs, against a local Supabase** (existing)
- **Proves:** D11 (two runs on one file produce **one** county row) and D12 (the `anchor_id`-only delete-key removes exactly the right rows with `sir_id` null).
- **Prior art:** `substation/src/lib/cartographer-anchors.integration.test.ts`, `geo-parcel-native-srid.integration.test.ts`.
- **Runs:** substation's integration suite against a local Supabase.

**S5: the `/anchor/[id]` server load** (new, mirroring an existing shape)
- **Proves:** D15–D20 — that a cited claim resolves to its `cartographer_geometry_evidence` row and signs its crop, that a read claim carries a page and a box the overlay can draw, that a computed claim renders without pretending to have a page, and that an anchor with **no** `derivation` key (every row published before this spec) still renders rather than 500s.
- **Prior art:** `cartographer/src/routes/geometry/[id]/+page.server.ts` — same four-queries-no-joins shape, same `createSignedUrls` batching, and the same additive posture (winston#274 D11: a figure published before the evidence tables existed renders with "no evidence recorded").
- **Runs:** `bun test` in `cartographer`; manually against anchor `e94fae93` in prod, which already has correspondences, residuals and an overlay and no derivation.

---

## 5. Acceptance

Upload `White Water Express Car Wash 071326.pdf` to Cartographer as a loose file — **no project, no SIR, no plan set**. Run `extract-geometry-v2`. Run `anchor-geometry` with a request carrying only `{file, anchor_run_slug}`.

1. `1.2-fetch` reads **Travis County, Texas** off page 1, picks the TCAD layer, finds the parcel from the plat's **legal description** (D10a rung 2, no `site_point` in the request), fetches the ring (PID `0436110202`, `native_sr` 2277), passes the area gate (43,557.77 vs 43,560), and writes **one** `county_api` `geo` row with no owner.
2. It resolves **EPSG 2277** on its own from that ring, `source: "derived"`, with `fetch.log` naming the check: `basis_of_bearings` "TEXAS CENTRAL ZONE / NAD 83" → {2277, 32139}, agrees. No FIPS, no FIRM panel, no county table.
3. `3.1-solve` fits LOT 1 by `ring_fit` / `gis_fit`, with the stated surface scale factor applied. **This is `fitToRing`'s first run on real data** (§1.4); the near-exact TCAD ring (§1.5) is the easiest case it will ever get, so an IoU below ~0.99 here is a solver finding, not a data finding.
4. `/anchored` draws the anchored lot in marine over the county ring in amber.
5. **Re-running the whole thing produces one county row, not two.**

A deliberate negative: run it again with `target_srid: 32139` in the request and it must solve in metres and produce a visibly wrong result — the override has to still be an override. A second one for D8's mechanism: a file whose page 1 has no text layer (or a registry entry pointed at a layer whose code is not in the plat zone's set) must leave the run **`waiting`** at `1.2-fetch` with `BLOCKED.md` naming the fix, not **failed**; setting `site_point` (or `target_srid`) and advancing must relaunch the step and go through. A third, for D7: the same file with its `basis_of_bearings.kind` edited to `assumed` must **not** park — it proceeds, and the `4.1` readout shows the zone check as unavailable.

---

## 6. Seams this must not foreclose

Named only so the decoupling does not harden against north star **P5**. None is addressed here.

1. **Frame identity.** `frame_key` is per-document today (`frame-1` for all of White Water). A plan set has ~14 plan-view sheets, each its own viewport — on sheets 7 and 12 the same property line sits at different page coordinates — so a sheet reader needs one frame per sheet. Nothing links a frame to `sheet_version`. Do not make `frame_key` *mean* "document".
2. **Fixed scale.** `anchor.ts` fixes `s` at 1 or the stated combined factor, which is right for courses already in feet and wrong for page pixels. `freeScale` is already computed and reported but never applied.
3. **Units.** `DistanceUnits = ft | ftUS | varas | m` has no page-pixel member.
4. **Polygon-only.** `cartographer_geometries.polygon` is `{rings}` and `sir_put_anchored_geo` rejects anything not (Multi)Polygon after `ST_MakeValid`. Hydrants are points; mains and curbs are lines.
5. **Reading model.** `mete.courses` + `misclosure_feet` has no meaning for a traced polyline.
6. **Correspondence vocabulary.** `2.1-correspond` claims ring matches, vertex ties, edge ties and control points; a sheet's natural claims are "this run is the property line" and "this is the scale bar and it reads 20 ft".
7. **Posture.** `geo.method` ∈ `county_api | anchored | estimated` has no *recorded vs proposed* axis, and north star §1.3's headline use case measures between the two.
8. **Provenance.** `geo.source_doc` is `'cartographer:' || file_id`; a sheet reader wants the sheet. D1's `submission_version_id` is the first step toward that.

---

## 7. Open questions

**Q1.** Does the new parcel RPC get a fresh name (`add_parcel_geo`) alongside `sir_add_parcel_geo`, or does `sir_add_parcel_geo` gain nullable owner params and keep its name? Duplication is cheap and explicitly acceptable; a rename touches `cityhall/src/lib/publish/sir.ts:382` (the repo is `noetic-inc/cityhall`; `cityhall-new` redirects to it) and both test doubles.

**Q2.** Should `geo` forbid carrying both `sir_id` and `submission_version_id` (a CHECK), or are they independent provenance links with no XOR?

**Q3.** Where does the **parcel layer URL** come from for a county we have not met? D10 needs one and there is no registry (D6). *(v1.3)* This is now the only real gap in the derivation: the county name is on every plat and the ring carries its own SRID, so everything else is a fetch. For v1 it can be a constant for Austin plus an optional request field — but that is the thing that stops this generalising, and it is the same gap north star **D11** names. *(v1.2)* The entry is now two things: the ring layer, and the **legal-description layer + field name** D10a rung 2 queries (Austin: `MapServer/8`, `LEGAL_DESCRIPTION`), plus optionally a locator URL for rung 3.

**Q4.** `/anchored` currently has one rail row per anchor with a SIR subtitle. With no owner, what labels an anchor — the file name alone, or `submission_version` → `submission` → `project.name` when the chain exists?

**Q5.** Does a re-run under a *new* `anchor_run_slug` reuse the county row (D11 says yes, the key is the file) or mint a fresh one per anchor run so a run's context is immutable?

**Q6.** A plan set naming more than one county (a TxDOT note, an adjacent jurisdiction, a county-line subdivision). Stop and ask, or take the county in the recording reference specifically, since that is the one whose records hold the plat?

**Q7.** Should `cartographer_anchors.target_geo_ids` get referential integrity now that D13 reads the map through it? It has already dangled once on one row (§1.4). An array FK needs a trigger or a join table.

**Q8.** Backfill posture for the 56 existing `geo` rows. All 56 derive a `project_id` cleanly, so north star **D4** (project ownership) stays available — but this spec does not need it and does not do it. Does anything want it before P5?

**Q9.** Does `/anchor/[id]` reuse `/geometry/[id]`'s PDF viewer wholesale, or is the anchor page's PDF read-only (no rotation, no zoom, no selection rail)? The extracted-figure page needs the full instrument because a reader is checking 5 courses against the drawing; an anchor cites three or four claims on two pages. Reuse is tempting and the component is already extracted (`PdfPageOverlay`), but `/geometry/[id]`'s 455 lines of page are mostly the rail and the controls around it.

**Q10.** Does the **county read** (D17) get a stored crop like the extract run's readings do, or stay box-only? Box-only is free and renders identically in situ; a stored crop is what makes the two pages consistent, and is the only way the claim survives the source PDF being replaced. Storing one means writing a `cartographer_geometry_crops` row from a runbook that is not the extract runbook, against a `geometry_id` that is not really its parent — which may be a sign the crop table wants an owner other than a geometry.

**Q11.** **Possible bug:** `evidence.check_md` is null on anchor `e94fae93`, so `3.3-check`'s vision readout — the step whose only job is to say whether the overlay looks right — reached the database empty. `publish.ts` reads `check.md` from the run directory and tolerates its absence. Did the step write nothing, or did the file not survive to publish? Worth settling before the page is built around showing it.

**Q12.** *(v1.2)* The D10a **area-gate tolerance**. White Water is 0.005 % off; north star §9.4's ±3 ft `gis_fit` case on an older parcel is a ~3 ft band around a ~840 ft perimeter, roughly 6 % of a 1-acre lot. A tolerance that admits the second without admitting the neighbour's lot is probably ~10 % — but the right number depends on how often adjacent lots in a subdivision are near-equal in area, which is exactly the plat case. Start at 10 %, record both areas in the claim either way, and tune on the first stop.
