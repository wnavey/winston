# Driveways and curbs from plan sets — existing and proposed, with widths, lengths and return radii, and the adjacent driveways the sheet leaves off

**Status:** Draft v1
**Date:** 2026-10-19
**Repos touched:** `bureau` (`extract-geometry-v2` steps 1.2, 2.1, 3.4, 3.5, 4.2, 6.1 and their contracts; `anchor-geometry` steps 2.1, 3.2, 3.3, 5.1 and one new step `1.3-frontage`; one new data file under `runbooks/site-research/data/`), `cartographer` (`src/lib/features/registry.ts`; `runbooks/extract-geometry/scripts/lib/{pdf_paths.py,trace.ts,evidence.ts,traced.ts}`; new `lib/curb.ts`, `lib/frontage.ts`, `lib/driveway.ts`; `trace.ts`, `assemble.ts`, `place.ts`, `publish.ts`; `runbooks/anchor-geometry/scripts/{fetch,render,publish}.ts` and `lib/{contracts,frames}.ts`; `/geometry/[id]`, `/anchored`, `/anchor/[id]` draw lines), `cityhall-new` (the schema: `supabase/schemas/public/tables/{cartographer_geometries,cartographer_geometry_evidence,geo}.sql`, `functions/sir_put_anchored_geo.sql`, one new function `sir_put_context_geo.sql`, and the migration `supabase db schema declarative sync` writes)
**Repos NOT touched:** `substation` (retired 2026-09-29), `cityhall` (the old app), `conductor2`, `surveyor` (Q5 asks whether the Austin street layers should move into its registry; v1 keeps them in bureau data), `prospector`, `claude-plugins`, `navalbase`, `quarry`
**Prod:** Supabase **Noetic App** (`mgxqsrjutswbciyrltwd`)
**Parent:** [`../north-star/NORTH-STAR-SPEC.md`](../north-star/NORTH-STAR-SPEC.md) (winston#303) — the second slice of **P5 (plan sets)**, and the first use of its **D14** (derived geometry is a fourth path).
**Sibling:** [`../plan-set-footprints/DESIGN-SPEC.md`](../plan-set-footprints/DESIGN-SPEC.md) (winston#322, **shipped** — cartographer #40, #41, #42; bureau #2132, #2134, #2148; prod migration `20261016210300_plan_set_footprints`). Its registry (D17), tracer ladder (D4), sheet registration (D7), posture (D10) and `within` anchoring (D14) are the ground this spec stands on. Its D18 row for curbs and driveways — "`tracer: 'segments'` with dash bridging" and "a polygon derived from curb returns and the ROW line" — is what this spec writes out, with one correction (§8).
**Sizing:** IG report [`2026-10-13-geometry-opportunity-formal-review`](https://inspector-general-gamma.vercel.app/reports/view/2026-10-13-geometry-opportunity-formal-review) — **curb / face of curb / returns** is the fifth-most-demanded layer (34 of 134 geometric comments, 18 A-tier) and **driveway / drive aisle** the tenth (19, 12 A-tier); the report lists "neighbouring driveways" among the county-side geometry that 62 of 134 comments (46 %) need, and the only non-PostGIS operation in its ranking is an **arc radius fit**.

---

## 1. Problem

### 1.1 What this is for

One sentence: **run `extract-geometry-v2` on a site plan set, get every proposed and existing curb line as a figure beside the lot, with its arcs' radii and its length, derive each driveway from the curbs that cross the lot's frontage with the numbers TCM Section 7 asks for, run `anchor-geometry`, and have the grid say how far that driveway sits from the driveways next door, the intersecting street and the curb inlets — the part no sheet shows.**

Two things make this harder than the building footprint, and the spec is organised around them:

1. **A curb is a line with arcs, not a closed ring.** The footprint tracer keeps closed rings and flattens every Bézier to eight chords (`pdf_paths.py` `BEZIER_STEPS = 8`). A curb return's radius is in the Bézier's control points, and the review question (*is the return 15 ft?*) is answered by that radius, not by the chords.
2. **Dimensioning adjacent driveways is a regulatory requirement, and the sheet does not carry them.** TCM 7.6.2's spacing is measured to the next driveway along the street; the review guide reads a 200 ft window on each side, the completeness check 300 ft; the White Water survey base stops 10–35 ft past the lot. The answer has to come from somewhere the plan set is not, and it has to land on the same grid as the proposed driveway so one `ST_Distance` can compare them.

On names: the extract runbook is `extract-geometry-v2` (the conductor port). The anchor runbook is `anchor-geometry` — there is no `-v2` directory in bureau; the version this spec changes is the one winston#322 P3 left (`bureau/runbooks/anchor-geometry/`, eight steps).

### 1.2 What a reviewer measures, and against what

The numbers come from Bureau's copy of the TCM (`bureau/jurisdictions/austin/codes/tcm/contents/Section 7 - Driveways/…`) and the review guide `bureau/jurisdictions/austin/review-guides/ta/site-access-and-circulation.md` (contract prefix `SAC`, 27 items; `SAC-03` width at the property line is "the single most repeated line in this department's comment slice", 305 atomic comments). Every row is a geometry question with a measurement convention, and the convention is the design input:

| what | the number | measured how | rule |
|---|---|---|---|
| spacing to the next driveway, same side | Level 1: minor 50 ft / major 75; Level 2: 75 / 150; Level 3: 200; Level 4: 280 | **inside edge of pavement to inside edge of pavement** of the two driveways (Fig. 7-5); to an intersecting street, from its edge of pavement | TCM Table 7-5, §7.6.2 |
| clearance to a curb inlet | 10 ft | inlet opening edge to the driveway's **point of tangency** | TCM 7.6.2(C) |
| offset to an opposing driveway | ≥ 80 ft when offset right; offset left → right-in/right-out only | **throat edge to throat edge** across the street | TCM 7.6.3 |
| curb return radius | Level 1/2 typical 10 ft; Level 2 three-lane and Level 3/4 typical 15; fire access 15–25; industrial 15–50 | the return arc's radius | TCM Table 7-1, §7.5.1.1 |
| width | Level 1/2 typical 20 ft; fire 20–25; industrial 25; high-capacity ≤ 32 | **face of curb to face of curb at the throat** (TCM); **at the property line** (`SAC-03`) | TCM Table 7-2, §7.5.1.2 |
| angle to the street | 90° | the driveway axis against the through lanes | TCM 7.5.1.3 |
| throat storage | 25–150 ft by use and spaces | **from the property line** to the first interruption (first aisle, stall or crossing drive) | TCM Table 9-5, §9.3.4.3.1 |
| count per frontage | < 300 ft: 1; 300–600: 2; > 600: 3 | existing plus proposed per frontage | TCM Table 7-4, §7.6.1 |
| existing approaches | remove the ones no longer needed; an existing driveway may be required to conform | — | LDC 25-6-295, 25-6-321, 25-6-322 |
| joint use | an easement on the City Attorney's form; the return may not cross the projected side lot line without the neighbour's consent | — | TCM 7.6.4, 7.6.2(D); LDC 25-6-451 |

Two conventions decide the derivation in §2.4: **a driveway is bounded by its two curb faces where they cross the right-of-way line**, and **spacing is between pavement edges, not centrelines**. The completeness check's items say what must be on the sheet: `CC-22-12` driveway spacing dimensions, `CC-22-13` widths and curb return radii, `CC-22-14` adjacent driveways within **300 ft**, `CC-22-15` offsets from opposing driveways (`completeness-check/v2.7-trimmed/cc-22.md`). The review guide's `SAC-04` reads a **200 ft** context window. Both are live Bureau text; this spec fetches 300 ft (the superset) and reports against both (Q6).

### 1.3 What the sheets actually contain (verified 2026-10-19)

Measured with PyMuPDF 1.26.5 and shapely 2.0.7 against the three plan sets on disk.

**White Water** (`cartographer_files.cc2e3a53`, 30 sheets, Civil 3D 2021, 803 OCGs). Sheet 12 SITE PLAN, the design layers (xref `JCE BASE|`):

| layer | items | what it is |
|---|---|---|
| `C-CURB FOC` | 233 lines + **44 curves** + 1 quad | the proposed face of curb |
| `C-CURB BOC` | 27 lines + **38 curves** | the proposed back of curb |
| `C-SIDEWALK` | 90 + 30 curves | the proposed sidewalk edges |
| `C-SAWCUT` | 34 | where new pavement meets old |
| `C-EXIST CONC` | 293 | existing concrete, screened, inside the lot |
| `C-FIRELANE`, `C-STRIPING`, `C-ADA PATH` | 876 / 237 / 2,142 | striping |

and the survey base the design was drawn over, present on every plan-view sheet:

| layer | items | length | where |
|---|---|---|---|
| `V-ASPHALT-LINE` | 29 | 493 ft, **all outside the lot** | the street's pavement edge and the neighbour's parking edge |
| `V-CONC-LINE` | 282 | 2,275 ft, 2,063 ft outside | the public sidewalk, the street curb and gutter, the existing driveway |
| `V-BNDY-ADJ-LINE` | 20 | 105 ft | adjacent lot lines |
| `V-ESMT-LINE` | 179 | 771 ft | easements |
| `V-ROAD-TEXT` | 868 | — | `BREZZA LANE`, `S. I-35`: vector glyphs, not text |

Sheet 7 EXISTING CONDITIONS & DEMOLITION adds `C-DEMO CONC` (38 lines: two chains of **86 and 85 ft**, the curb the note says to remove, *"CONTRACTOR TO REMOVE EXIST. CONC. CURB (84 LF)"*) and `C-IC EXIST PAVING` (45 lines: one closed ring, 2,278 ft², 94.6 × 43.6 ft, inside the lot). Every dimension label — `R20.0'`, `R25.0'`, `R28.0'`, `6" CURB`, `2–3' CURB CUTS`, `SAWCUT EXISTING CURB/PAVEMENT`, `EXISTING CONCRETE DRIVEWAY`, `CALLED 0.0565 ACRES JOINT ACCESS EASEMENT` — is drawn as glyphs on `C-DIM TEXT` (1,903 items) and `C-SITE TEXT` (3,661); the text layer has 142 words on sheet 12, none of them a dimension. The labels are read by vision or not at all.

**Arcs are arcs.** `page.get_drawings()` reports the curb returns as cubic Béziers (`'c'` items), not chorded polylines. The footprint tracer's reader flattens each to eight chords (`cartographer/runbooks/extract-geometry/scripts/lib/pdf_paths.py:30-33`, `BEZIER_STEPS = 8`, with the comment *"a building's corners are rarely curves"*). Right for a building; for a curb it discards the one number the review wants.

**The survey base stops short.** How far the sheet's linework extends past the lot line, in feet, west / north / east / south: sheet 12 `V-ASPHALT-LINE` 11 / 26 / 35 / 12, `V-CONC-LINE` 19 / 26 / 34 / 10; sheet 7 `V-CONC-LINE` 28 / 26 / 81 / 10, `V-BNDY-ADJ-LINE` 26 / 112 / 33 / 2. No sheet in the set reaches 200 ft from the lot in any direction.

**What the site's access actually is.** Brezza Lane is the south frontage: course 5 (`N74°32'40"W 231.66`) is the right-of-way line, the public sidewalk sits just outside it, the street's curb 10.8–11.6 ft off it. The I-35 southbound frontage road is the east (courses 3 and 4, TxDOT, no access). The west and north are Lot 1, Lennox Springs Section 2 (apartments). The site's **only** access is the *EXISTING CONCRETE DRIVEWAY* on the west, shared with the apartments under a 0.0565-acre joint access easement (Inst. 2021084780). On sheet 7 that driveway's two curb lines cross the Brezza Lane right-of-way line at stations **76.9–77.8 ft** and **111.0–111.8 ft** from the southwest corner: an opening **33.2 ft** face to face, 34.9 ft outside to outside. On sheet 12 **no proposed curb face crosses any lot line**: the proposed `R28.0'` and `R20.0'` returns tie into the existing driveway 24–30 ft inside the lot at the sawcut, and the 84 LF of existing curb between them comes out. So White Water is a joint-use, retained-approach case — the questions it raises are TCM 7.6.4 and LDC 25-6-321 (does a 33 ft opening on a Level 1 street conform to Table 7-2's 20 ft?), not a new return at the right-of-way. It is a good first fixture precisely because the derivation has to say *"no proposed driveway; one existing driveway, retained, 33.2 ft at the right-of-way line, shared"* rather than find a return that is not there.

**The other two sets are layer-less where it matters.** 2008 San Antonio (53 sheets, 0 OCGs): the IG spike measured its garage entrance at 15.0 × 15.2 ft and face-to-curb at 12.3 ft through stroke styles. 1700 S Lamar v7 (`~/noetic/tmp/TestProjFromLamarCollier/v7/`, Civil 3D 2024, 67 sheets, **440 OCGs in the file** — but sheets 15 and 16, SITE PLAN 1 OF 2 and 2 OF 2, carry **one** layer each; the layers survive on the hatch sheets, not the site plan). Of three sets, one has curb layers. Rung 2 (stroke style) is the common case for curbs, as D19 of the sibling already predicted for every split sheet.

### 1.4 Spike: radii, pairs and lengths, deterministically

Sheet 12, at the registration winston#322 solved for it (1″ = 20.000′, so 0.27778 ft/pt; nothing below reads the title block). A circle fitted through each Bézier's two endpoints and its midpoint, then grouped by centre:

| face of curb | pieces | sweep | back of curb, same centre | printed |
|---|---|---|---|---|
| R **20.05** | 9 | 47.6° | 19.52 | the drive-through loop |
| R **28.02** | 1 | 90.0° | 27.52 | `R28.0'` — the tie-in to the existing driveway |
| R **20.02** | 1 | 88.6° | 19.52 | `R20.0'` — the southwest return |
| R **25.02** | 1 / 5 | 24.2° / 22.9° | 25.52 / 24.52 | `R25.0'` |
| R **15.02** | 2 | 92.6° | 15.52 | `R15.0'` |
| R 10.02 / 10.01 | 6 / 4 | 62.6° / 44.3° | 9.52 / 9.49 | `R10.0'` |
| R 5.01 / 3.02 / 2.02 / 1.52 | 3 / 2 / 2 / 4 | — | 4.52 / 2.52 / 1.52 / 1.02 | `R5.0'`, the dumpster pad corners |

Nineteen centres on the face, seventeen matched on the back at **R − 0.50 ft** on every one: the curb is six inches wide, which is what `6" CURB` says, read from the geometry with no label. The printed radii agree within 0.05 ft; the 0.02–0.05 excess is the three-point fit on a Bézier (a least-squares fit over the sampled curve brings it under 0.01, S2). Lengths: **894 ft** of face of curb on sheet 12 in 170 chains (broken by the 2–3 ft curb cuts, the ramps and every label that sits on the line), 43 back-of-curb chains, 717 ft of sidewalk with five closed rings (the islands). Existing: the two `C-DEMO CONC` chains are 86 and 85 ft against the note's 84 LF. Crossing the Brezza Lane line: the proposed 4 ft sidewalk at stations 66.6–71.0 (4.33 ft; the label says `PROPOSED 4' SIDEWALK`), the existing driveway at 77.8–111.0 (33.2 ft), the proposed curb nowhere.

Every number is reproducible from the PDF and the registration. The labels served only to check.

### 1.5 Off the sheet: what Austin publishes (checked 2026-10-19)

Queried at the site's address point (`LOCATION_address_points`: `10416 BREZZA LN` → −97.79374, 30.15016), keyless, from the City of Austin ArcGIS organisation (`services.arcgis.com/0L95CJ0VTaxqcmED`, 2,184 services):

| layer | geometry | what it holds here, within 300 ft | vintage | use |
|---|---|---|---|---|
| `impervious_cover_2023` | polygon; `FEATURE`, `ORIGIN_FEATURE_CLASS` (has a `Driveways` class) | **0** `Driveways`-class polygons; **16** `Pavement`, **3** `Paved Parking`, **2** `Paved Road` (`Double_Line_Streets`), **9** `Sidewalk`, **4** buildings | hand-digitized from early-2023 imagery | a commercial driveway is a `Pavement` polygon that touches the `Paved Road` polygon. The opening is **derivable** — the shared boundary — not labelled |
| `TRANSPORTATION_sidewalks` | polyline; `PEDESTRIAN_FACILITY_TYPE` includes `DRIVEWAY` | 4 segments, all `EXISTING_SIDEWALK` / `PLANNED_SIDEWALK` on Brezza Ln and S IH 35 SVRD SB; **no** `DRIVEWAY` here | 2006/07 inventory, edited to 2025 | a cross-check where it has driveways; not an inventory |
| `TRANSPORTATION_street_segment` | polyline; `FULL_STREET_NAME`, `ROAD_CLASS`, `SPEED_LIMIT` | `BREZZA LN`, class 8, 30 mph | current | the street, its name, the intersecting streets |
| `TRANSPORTATION_asmp_street_network` | polyline; `STREET_LEVEL`, `REQUIRED_ROW_ALPHA` | only `OLD SAN ANTONIO RD`, Level 2, within 200 ft — Brezza Lane is not an ASMP street | current | the Table 7-5 row; a street absent from the ASMP is Level 1 (Q10) |
| `UTILITIESCOMMUNICATION_CurbInlet` | point | **3** inlets (two built 2016) | current | TCM 7.6.2(C), the 10 ft rule |
| `PLANNINGCADASTRE_right_of_way` | polygon; "under construction, completion TBD" | 1 polygon, document `201700317` | partial | the street side of the right-of-way where it exists |
| `EXTERNAL_tcad_parcel` | polygon | the abutters | current | whose frontage each opening is on (`abutters.py` already sweeps it at 75 ft) |
| StratMap21 CapArea orthoimagery (`imagery.geographic.texas.gov/…/StratMap21_NCCIR_CapArea_Brazos_Kerr/ImageServer`) | 4-band, **0.1524 m (6 in) pixels**, EPSG 3857, keyless `exportImage` | the frontage as flown January 2021, leaf-off | 2021 (2019 also published) | the picture a checker sees under the overlay; the fallback outside Austin (Q7) |

The honest reading: **no Austin layer names driveways reliably along a commercial frontage** — the `Driveways` class is residential — but the boundary between a paved area and the paved road is a driveway opening, with a width, at the accuracy of a hand digitization over 6 in imagery (about ±1–2 ft). That is enough for Table 7-5 (whose smallest number is 50 ft) and for the count, and it is a prior for the person, never the figure a sheet is held to.

Prior art this spec reuses rather than rewrites: `bureau/runbooks/site-research/bin/arcgis_query.py` (the keyless query with paging in object-id order, `outSR=4326`, ring winding, `--distance` buffers in feet, native-ring capture, and the rule that a zero-feature answer is not an absence), `abutters.py` (sides and shared boundary), `access_trace.py` (frontages from the road network), `_visual_walk_geo.py` (keyless aerial fetches). `anchor-geometry`'s `1.2-fetch` already calls `arcgis_query.py` through `locate` (`cartographer/runbooks/anchor-geometry/scripts/fetch.py:51-70`), with `tools: [cartographer, surveyor, bureau]`.

### 1.6 Why it cannot run today

| | Where | What stops it |
|---|---|---|
| **C1** | `cartographer/runbooks/extract-geometry/scripts/lib/trace.ts:388-396` `traceFeature` throws unless `entry.geometry === 'polygon'`; `traceBoundary` (:604) returns raw segments, unchained; `registry.ts:22` `FeatureTracer = 'closed_ring' \| 'segments'` | Nothing chains a polyline feature, ranks a *set* of chains, or draws a set on an overlay. |
| **C2** | `lib/pdf_paths.py:30-33, 64` | Every Bézier is eight chords; the radius is gone before the tracer sees the path. |
| **C3** | `lib/evidence.ts:335-396` `traceSchema.pathPt` is one closed ring; `cityhall-new/…/cartographer_geometries.sql` `polygon jsonb NOT NULL`, `closed boolean NOT NULL`, `computed_area_sqft`; `frames.ts:80` `ringInFrame` reads `polygon.rings[0]`; `/geometry/[id]` draws rings | A figure is a polygon all the way down. Sibling §6.4, left shut by winston#322, has to open. |
| **C4** | `cartographer_geometries.reading_method` CHECK `mete \| traced`; `evidence.ts` `TRACE_METHODS` | A driveway is read from nothing: it is computed from two curb figures and a lot line. North star D14 names the path; no row can say it took it. |
| **C5** | nowhere | Nothing in a run says which course of the lot fronts which street. `assemble.ts` walks the lot; the survey reads the course calls; no figure, attribute or file names a frontage. |
| **C6** | `anchor-geometry/scripts/lib/frames.ts:97-104` `toInputFigure` → `ring`; `:440` `toGeoJsonPolygon`; `bureau/…/2.1-correspond/contract.test.ts:18` `relation: z.enum(['same_as','union_of','within'])`; `sir_put_anchored_geo.sql:52-60` refuses anything but `ST_Polygon \| ST_MultiPolygon` | A line cannot be fetched, claimed, transformed or published by the anchor run. The existing street curb is *outside* the lot, so even `within` is the wrong word. |
| **C7** | `anchor-geometry/1.2-fetch` fetches the parcel ring and the SIR's rows; surveyor's registry has `role: parcels` and `role: legal_description`; no step fetches a street, a sidewalk, an inlet or an aerial | The 300 ft context has no producer. |
| **C8** | `geo.method` is free text (`anchored`, `county_api`, `estimated` in prod); `geo.kind` is free text (`parcel`, `building`, `easement`, `easement_sanitary_drainage`, `right_of_way`) | A vocabulary gap, not a CHECK: no word yet for "a city GIS polygon, clipped to this frontage". |

What is **not** a coupling, and this spec leans on: D7's sheet registration is one similarity per sheet, and every path on the sheet rides it — a curb registers exactly as the building did, by the lot drawn beside it; `posture` already admits `existing` (sibling Q10: the CHECK was widened, nothing writes it); `anchorFrame` transforms any list of points; `geo.geom_local` is untyped and `geo.geom_wgs84` is `geometry(Geometry, 4326)`, so a LineString is storable today without DDL; `sir_parcels()` returns `st_asgeojson(geom_wgs84)` whatever the type (`sir_parcels.sql:20`), so the map draws a line the day one lands.

**Prod as it stands (2026-10-19).** The sibling's acceptance run happened: `cc2e3a53` carries two figures from `whitewater-cc2e3a53-v2-run2` (`LOT 1` mete/recorded, `CAR WASH` traced/proposed, `sheet_registration`), anchor `53d65a90` (`whitewater-cc2e3a53-anchor-2`) is **accepted** and `f290425a` stale, and `geo` holds four rows for the file (the TCAD ring, the stale and the live `LOT 1`, and `CAR WASH` as the first `proposed` row). `cartographer_geometries` has 14 rows, one of them traced. This spec's first publish stales anchor 2 the same way (sibling D12, Q9).

### 1.7 Scope

In: three registry entries (`curb`, `curb_existing`, `driveway`), arcs preserved in the reader, polyline tracing and confirmation, face/back pairing, the lot's frontage found from the sheet, the driveway derived with its measures, lines in the figure model and in `geo` (expand only), the anchor run carrying lines, a frontage-context fetch of Austin's layers published beside the anchored figures, and the queries that compare the two. Out (§10): trees, sidewalks and striping as features, grades and Z, the demolition-resolved "resulting" driveway, vision-drawn openings from the orthophoto, jurisdictions other than Austin, the agent tool surface, and the `polygon` column's contract phase.

---

## 2. Decisions

### 2.1 Three registry entries

**D1. Curbs are two registry entries by posture, and the driveway is a third with no tracer.** `cartographer/src/lib/features/registry.ts` gains:

```ts
curb: {
  geometry: 'polyline', posture: 'proposed', kind: 'curb',
  layerPatterns: [/\bCURB\b/, /\bFOC\b/, /\bBOC\b/, /CURB.?(FACE|BACK)/],
  layerExclude: [/TEXT/, /EXIST/, /\bEX\b/, /DEMO/, /REMOVE/, /\bV-/, /\bX-/, /\bE-/, /RAMP/, /INLET/],
  labelPatterns: [/\bR\s?\d+(\.\d+)?'/, /\d+"\s*CURB/, /CURB\s*CUT/],
  minAreaFt2: null, minLengthFt: 3, tracer: 'polyline',
  edge: (layer) => /\bFOC\b|FACE/.test(layer) ? 'face' : /\bBOC\b|BACK/.test(layer) ? 'back' : null,
  survey: 'the curb lines of the proposed pavement: paired parallel lines about 6 in apart along every drive aisle, parking bay and island, with rounded returns where one meets another or the street; not striping, not the sidewalk edge, not a screened or lighter existing curb',
},
curb_existing: {
  geometry: 'polyline', posture: 'existing', kind: 'curb',
  layerPatterns: [/EXIST.*(CONC|CURB|PAV)/, /\bEX\b.*CURB/, /V-CONC-LINE/, /V-ASPHALT-LINE/, /\bEOP\b/, /DEMO.*(CONC|CURB)/, /\bX-CURB/, /\bE-CURB/],
  layerExclude: [/TEXT/, /TXT/],
  labelPatterns: [/EXIST(ING)?\.?\s*(CONC(RETE)?)?\s*(CURB|DRIVEWAY|PAV)/, /REMOVE/, /\d+\s*LF/],
  minAreaFt2: null, minLengthFt: 3, tracer: 'polyline',
  demolish: (layer) => /DEMO|REMOVE/.test(layer),
  survey: 'existing curbs and pavement edges, drawn screened or lighter: the street's curb and gutter and edge of pavement, the existing driveways on this lot and the neighbours', and any existing curb marked to be removed',
},
driveway: {
  geometry: 'polygon', posture: 'proposed', kind: 'driveway',
  layerPatterns: [], layerExclude: [], labelPatterns: [/\d+(\.\d+)?'\s*(WIDE|DRIVEWAY|DRWY)/, /\bR\s?\d+/],
  minAreaFt2: null, tracer: null, derive: 'driveway',
  survey: 'a driveway: where the site's pavement meets the street between two curb returns or flares, crossing the property line; proposed or existing; usually labelled with a width and its return radii',
},
```

Why two curb entries rather than one with a posture flag: the layer vocabularies are disjoint by convention (survey base `V-…` and `EXIST` / `DEMO` on one side, design `C-CURB …` on the other), and `curb`'s exclusion list *is* `curb_existing`'s inclusion list. One entry would need a rule the other already states. Both publish `kind: 'curb'`; posture tells them apart in every query. `curb_existing` includes the street's own curb and pavement edge (`V-ASPHALT-LINE`, `V-CONC-LINE`): that is what D6 needs to find the frontage, and TCM's "edge of pavement" is literally that line.

`driveway` has no patterns and no tracer: it is **derived** (north star D14) from the other two and the lot. Its survey paragraph exists so the survey marks one `feature` region per driveway a reader sees; the derivation (D7) is then counted against that reading in the readout — a driveway the survey saw and the derivation did not find is the loudest line in the readout.

`FeatureTracer` becomes `'closed_ring' | 'polyline' | 'segments' | null` (`segments` stays for `boundary`, which registers the sheet and is never a figure); `FeatureEntry` gains `minLengthFt`, `derive`, `edge`, `demolish`. `registryJson()` serialises the two functions as their source regexes, so `features.json` (bureau's view) says `edge: {face: "\\bFOC\\b|FACE", back: "\\bBOC\\b|BACK"}`.

### 2.2 The reader keeps the arc

**D2. `pdf_paths.py` emits every cubic Bézier twice: as the eight chords it emits today, and as an `arc` record beside them.** For each `'c'` item: the four control points in page points; a circle fitted by least squares to 17 samples of the curve; `{centrePt, radiusPt, sweepDeg, startPt, endPt, residualPt}`. A Bézier that is not an arc (a spline, a leader's S-curve) has `residualPt > 0.25` and is kept as chords only. The chords are unchanged, so `chain()`, `bridge()` and `ringAreaPt2` behave exactly as today and every S1 fixture of the sibling still passes byte-identical. The arcs ride on the `PathRecord` (`arcs: Arc[]`, `[]` for lines, rectangles and quads).

The tracer carries arcs through onto each chain (D3): a chain's `arcs[]` are the arc records whose chords it contains. `traced.ts` then has what §1.4 computed by hand: on sheet 12, 44 face-of-curb Béziers group to 19 centres. Grouping is one more pure function, `lib/curb.ts groupArcs(arcs, tolPt)` → one `Return` per centre: `{centreFt, radiusFt, sweepDeg, pieces, chainIds}`; radius in feet comes out through the sheet registration like every other length.

### 2.3 Tracing a polyline feature

**D3. A polyline feature's candidate is a *set* of chains, and the worker's only edit is to remove from it.** `traceFeature` gains the `polyline` branch:

- **Rung 1 (`vector_layer`):** chain the matching layers' segments with the existing `chain` + `bridge` (the dash bridging built for the boundary works unchanged: `BRIDGE_PT = 6`, `BRIDGE_ANGLE_DEG = 10`). Keep open chains and rings alike (a curbed island is a ring). Drop chains shorter than `minLengthFt` (at the coarsest plausible scale, as `minAreaFt2` is today). All chains of one layer are **one candidate**, `kind: 'polyline_set'`, ranked 1; a second matching layer (face and back) is a second set ranked by total length. On a layered sheet `FOC` and `BOC` are two sets; both are kept (D4 pairs them).
- **Rung 2 (`vector_style`):** when no layer matches, every (layer, style) group becomes a candidate set, ranked by the length of chain inside the region, capped at `MAX_STYLE_CANDIDATES`. This is the common case (§1.3).
- **Rungs 3 and 4** do not apply to a polyline in v1: `handAllowed` refuses with "a line feature has no contour to flood or ring to draw"; a raster sheet's curbs are Q8.

A candidate is `{id, rung, layer, style, kind: 'polyline_set', chains: [{id, pathPt, closed, lengthPt, arcs: [...]}], chainCount, totalLengthPt, edge: 'face' | 'back' | null, rank, why}`. The overlay crop (D13 of the sibling, `crop.ts outline`) draws every chain of the set on the region crop; `outline` already takes one path and gains a list.

The 3.5 worker's answer for a polyline region keeps the sibling's shape (`chosen`, `why`, readings) and adds `exclude: [chainId, …]` — chains in the chosen set that are not the feature (a leader line sharing the style, a sidewalk edge the layer standard put on the curb layer) — and `labels[]` (D8). A worker may **remove** chains from a set and may not add, join, move or draw one. The contract refuses an `exclude` naming a chain not in the set.

**D4. Face and back are paired in code; the width of the curb is measured, not read.** `lib/curb.ts pairEdges(chains)`: for every chain, the chain on the other set (or, on a layer-less sheet, any other chain of the same candidate) that runs parallel within 0.33–1.0 ft for at least 80 % of its sampled length is its partner; a pair is a `Curb {faceChain, backChain, widthFt (median offset), lengthFt (the face's), arcs}`; an unpaired chain is a `Curb` with one edge and `widthFt: null` (a flush curb, a sawcut, a broken pair). On a layered sheet the registry's `edge()` says which is the face. On a layer-less sheet `edge` is `unknown` for every pair, both lines are carried, and every width measure in D7 is reported as the pair **(inner, outer)** — the two differ by exactly the curb width, so a reviewer reading "20.0 / 21.0 ft" knows which to use; the confirm worker may set `faceSide` from what the drawing shows (the gutter hatch, the side the drive aisle is on), recorded as a reading, never assumed. Q1 asks whether to go further.

### 2.4 The frontage, and the driveway derived from it

**D6. The lot's frontage is found by code from the lot and the existing curbs, and a worker names the street.** New pure module `lib/frontage.ts findFrontages({lotRing, existingChainsLotFt})` → for each edge of the lot, the nearest existing-curb chain **outside** the lot that runs parallel to it (≤ 8°) within 3–60 ft for at least half the edge's length: `{edgeIndex, courseIndex, chainId, offsetFt (right-of-way line to pavement edge, sampled), parallelDeg, coverage}`. On White Water that finds three: course 5 at 10.8–11.6 ft (Brezza Lane), courses 3 and 4 at 10.8 ft (the I-35 frontage road), and **course 1 at 11.6 ft — the apartments' parking lot**, which is not a street. Geometry cannot tell a street's pavement edge from a neighbour's; a reader can, from the name drawn along it. So the confirm fan-out gains one item per primary sheet, `frontage`, whose worker looks at the sheet with the candidate edges drawn on it (an overlay crop per candidate) and writes, per candidate, `{street: "BREZZA LANE" | null, verbatim, cropId, location, why}` — `null` with the reason ("a parking lot on the adjacent lot; the adjacent lot line is drawn 26 ft beyond it") for the ones that are not streets. The frontage is recorded as `frontage.json` in 4.2-assemble, on every derived driveway's trace (D7), and in the readout; it is checked again on the grid by D13 (a public street segment within 60 ft of the course, or not). Where it should live permanently is Q4.

**D7. A driveway is a derived figure: the polygon bounded by the right-of-way line, the two curb faces that cross it, and the throat line — and its measures are computed once, in lot feet, by code.** New pure module `lib/driveway.ts deriveDriveways({frontages, curbs, lotRing})`, run by `assemble.ts` after the curb figures are registered and before placement:

1. **Crossings.** Every curb face (proposed or existing) that crosses a frontage course, or ends within 1 ft of it, with its station along the course and whether it runs into the lot. Sheet 7's existing driveway: 77.8 and 111.0 ft. Sheet 12's proposed curbs: none.
2. **Openings.** Successive crossings 8–60 ft apart with no third between them are one opening; an unpaired crossing is reported and makes no figure. The opening's `widthAtRowFt` is the gap between the two faces on the right-of-way line (`SAC-03`'s number).
3. **Returns.** On each edge, the arc within 40 ft of the right-of-way whose circle is tangent to the street's pavement edge (centre-to-chain distance = R ± 0.5 ft) is the return: `returnRadiusFt.left / .right` (Table 7-1's number). No arc → a **flare**, with its angle. The return's far end is its point of tangency with the throat.
4. **The throat.** The line across the driveway at the farther of the two points of tangency; `throatWidthFt` there, face to face (Table 7-2's number).
5. **Angle.** Between the driveway axis (right-of-way midpoint → throat midpoint) and the street's pavement edge; 90 is perpendicular (7.5.1.3).
6. **Throat depth.** From the right-of-way line along the axis to the first curb chain or striping line crossing it (Table 9-5's "first interruption"); `null` when nothing crosses within 200 ft.
7. **Posture.** Both edges proposed → `proposed`; both existing and neither `demolish` → `existing`; one of each, or an existing edge marked for removal → `proposed` with `trace.edges[]` saying which is which (Q3).
8. **The polygon.** Right-of-way segment → right face to the throat → the throat line → left face back, in lot feet; its area; `vertex 0` at the right-of-way's left crossing.

The figure: `{id, readingMethod: 'derived', kind: 'driveway', posture, label: "<street> driveway 1", sourcePages, trace: {method: 'derived', rule: 'driveway/1', from: [curb figure ids], frontage: {courseIndex, street, offsetFt}, stationFt: [a, b], measures: {widthAtRowFt, throatWidthFt, returnRadiusFt: {left, right}, flare: {left, right}, angleDeg, throatDepthFt}, edges: [{figure, chainId, posture, demolish}], labels: [...]}}` (D9). Every number is a function of two traced figures and one walked course; none is a reading.

On White Water the derivation must return: proposed openings **0**; existing openings **1** on course 5 at stations 77.8–111.0, `widthAtRowFt` 33.2, posture `existing`, one edge (the east) `demolish: true` → reported as **retained and altered**; and the unpaired proposed returns `R28.0'` and `R20.0'` listed as "proposed returns that end 24–30 ft inside the lot at a sawcut and cross no frontage". That is the finding a reviewer wants handed over, and the spec's acceptance (§6) is that the run says exactly that.

**D8. Printed dimensions are checks, never sources.** The sibling's D8 pattern, applied to every label the confirm worker reads (`labels[]`: verbatim, crop, location, parsed `{kind: 'radius' | 'width' | 'length' | 'note', valueFt}`): `assemble.ts` matches each parsed value to the nearest derived number of its kind inside the region — a radius to the nearest return centre, a width to the nearest opening, a length (`84 LF`) to the nearest chain — and the readout prints **agrees / disagrees / unlabelled** per measure at 0.1 ft. White Water: `R20.0'` / `R25.0'` / `R28.0'` against 20.02 / 25.02 / 28.02 (agree); `84 LF` against 86 / 85 (disagrees by 2 ft; the note rounds, the chain does not — exactly the kind of disagreement a readout should show and a reviewer should ignore).

### 2.5 The figure model and the schema

**D9. `reading_method` gains `derived`, and the trace says what it was derived from.** `cartographer_geometries.reading_method` CHECK `mete | traced | derived`; the completeness CHECK's second arm becomes `reading_method IN ('traced','derived') AND mete IS NULL AND trace IS NOT NULL`; `TRACE_METHODS` gains `derived`; `figureSchema` becomes a three-way union on `readingMethod` with `derivedFigureSchema` (strict: no `pathPt`, no `courses`; `trace.from` non-empty; `trace.measures` by rule). The rule name (`driveway/1`) is versioned in the trace so a second derivation can tell the first's rows from its own.

**D10. Lines enter the figure through an expand-only change: a `geometry` column beside `polygon`.** D18 of the sibling named the seam (§6.4) and the shape (expand → migrate → contract). This spec does the **expand** and as much of the migrate as its own readers need:

| column | change |
|---|---|
| `geometry jsonb` | **new**, `NOT NULL` after backfill: a GeoJSON geometry in frame feet — `Polygon` (rings closed, vertex 0 at the origin as today) or `LineString` / `MultiLineString` (the chains, first vertex at the origin) |
| `polygon jsonb` | `NOT NULL` → **nullable**; CHECK `(polygon IS NOT NULL) = (geometry->>'type' IN ('Polygon','MultiPolygon'))`; written for every polygon figure exactly as today, so nothing that reads `polygon` breaks before it is migrated |
| `closed boolean` | unchanged (`false` on an open chain set, `true` on a ring or polygon) |
| `computed_area_sqft` | `null` on a line |
| `length_ft double precision` | **new**, nullable: a line figure's length; a polygon's `null` (the reviewer's "LF") |
| `has_approximated_curves` | `true` when `trace.arcs` is non-empty — the stored vertices are chords; the arcs are in the trace, which is what the column has always meant |

The migration backfills `geometry` from `polygon` for the 14 rows in prod (`jsonb_build_object('type','Polygon','coordinates', …)` over `polygon->'rings'`) in the same transaction that adds the column, then sets `NOT NULL`. Readers migrate in P1: `frames.ts ringInFrame` → `geometryInFrame` (reads `geometry`, returns rings or paths), `traced.ts`, `publish.ts` (writes both), `/geometry/[id]` (draws paths and rings). The **contract** (dropping `polygon`, retargeting `sir_put_anchored_geo`'s callers) is its own spec, after every reader is on `geometry` (§10).

Evidence (`cartographer_geometry_evidence`): the `trace` role row of a line figure carries `value = {rung, chains, lengthPt, arcs: [{radiusPt, sweepDeg, centrePt}], excluded}` and cites the set's overlay crop; a `label` row per printed dimension (source kind `marker`, as today); and a new role **`derivation`** for a derived figure: `value = {rule, from, measures}`, `bbox` the apron's box, `crop_id` an overlay of the derived polygon drawn on the region crop (`crop.ts outline` with the derived ring, the same op).

**D11. `geo` needs no DDL for a line; the RPC needs one more branch.** `geo.geom_local` is untyped and `geom_wgs84` is `geometry(Geometry, 4326)` (C8 is vocabulary only). `sir_put_anchored_geo` keys its validation on the payload's GeoJSON type: `Polygon | MultiPolygon` → today's path (`st_collectionextract(st_makevalid(g), 3)`, polygon-or-refuse); `LineString | MultiLineString` → `st_collectionextract(st_makevalid(g), 2)`, line-or-refuse; anything else refused as today. `kind` carries `curb` / `driveway`; `posture` carries `existing` for the first time; `properties.trace_method` carries `derived`; `properties.measures` carries D7's numbers so a query can read them without joining back to cartographer (they are frame-exact and do not change on the grid). `computed_area` (generated, geography) is 0 for a line and stays as it is.

### 2.6 The anchor run carries lines

**D12. A line figure rides the frame and is claimed against nothing: one new relation, `carried`.** `InputFigure` (`anchor-geometry/scripts/lib/contracts.ts`) gains `geometryType` and its `ring` becomes `coords` (a ring for a polygon, a path list for a line); `buildAnchorInputs` and `fitSets` use only `Polygon` figures with `same_as` / `union_of` (as today: `within` is skipped, and so is `carried`); `anchorFrame` transforms every figure's coordinates (it already transforms the `within` and unmatched ones, `anchor.ts:181`); `toGeoJsonPolygon` gets a sibling `toGeoJsonLine`, chosen by type. `2.1-correspond`'s contract enum becomes `same_as | union_of | within | carried`; its prompt says a `curb` or `driveway` figure is `carried`: placed by the frame's transform, never a fit target, and — unlike `within` — making no claim about the parcel ring, because the street's curb is outside it and a driveway straddles its line. `3.2-render` draws lines in the posture colours (proposed solid, existing lighter, the derived driveway filled) over the ortho tile D13 fetched; `3.3-check` asks two more questions — *do the existing curb lines sit on the aerial's curbs, and does each driveway opening sit on an apron in the aerial (existing) or at the sawcut (proposed)?* — and quotes nothing it computed. `5.1-publish` passes `geometryType`, `posture`, `trace_method` and `measures` per figure.

### 2.7 The frontage context, from off the sheet

**D13. A new script step in `anchor-geometry`, `1.3-frontage`, fetches the 300 ft context of every frontage from the jurisdiction's public layers, and publish writes it to `geo` beside the anchored figures.** Zero tokens; runs after `1.2-fetch` (it needs only the parcel ring and the target SRID, both of which fetch wrote) and before `2.1-correspond` (so the render and the check can use it); tolerates "not found" the way `arcgis_query.py` does — a layer that fails is an error, a layer that answers nothing is recorded as such, and a jurisdiction with no layers writes `frontage/none.json` with the reason and the run continues (T8).

The layers are named per jurisdiction in a new bureau data file, `runbooks/site-research/data/frontage-layers.json`, beside the road-centreline registry `access_trace.py` already reads (Q5 asks whether they belong in surveyor instead): for `austin`, the seven layers of §1.5 by role — `streets`, `street_levels`, `paved_areas`, `sidewalk_inventory`, `curb_inlets`, `right_of_way`, `parcels` — and the ortho `ImageServer`. Per frontage of the parcel ring (a `streets` segment within 60 ft of an edge and parallel to it; the same test D6 runs on the sheet, now with the city's own line), the step writes `frontage/<n>.json`:

- the street: name, `ROAD_CLASS`, speed, the ASMP `STREET_LEVEL` where a segment exists within 60 ft and **`1` with `levelSource: 'default'`** where none does (Q10), `REQUIRED_ROW_ALPHA`;
- **openings** on this side and on the opposite side within 300 ft of the frontage's ends: every `paved_areas` polygon of class `Pavement`, `Paved Parking` or origin `Driveways` whose boundary comes within 3 ft of the `Paved Road` polygon's boundary; the shared stretch is the opening — its length (the width at the curb), its station along the street, its centroid, and the abutting parcel it sits on (`EXTERNAL_tcad_parcel` at the opening's inner point); openings shorter than 8 ft are dropped as noise; each carries `{sourceLayer, objectId, source: 'Imagery 2023'}`;
- `sidewalk_inventory` segments of type `DRIVEWAY` within the window, as a second list, for the cross-check;
- `curb_inlets` within 300 ft, as points;
- the `right_of_way` polygon(s) touching the frontage, when the layer has one;
- the ortho tile: `exportImage` with `bbox` = the frontage grown 300 ft along and 150 ft across, `imageSR` = the target SRID, 6 in pixels, with its world file — the georeferenced picture `3.2-render` draws the overlay on and `3.3-check` looks at.

**Publish.** A new RPC `sir_put_context_geo(p_anchor_id, p_features)` (sibling of `sir_put_anchored_geo`, same anchor key, same `properties.anchor_id`, same stale-together behaviour) writes one `geo` row per opening, inlet and right-of-way polygon with `method: 'city_gis'`, `posture: 'existing'`, `kind: 'driveway_opening' | 'curb_inlet' | 'right_of_way'`, and `properties: {source_layer, object_id, source_vintage, accuracy_class: 'digitized', frontage, street, street_level, level_source}`. The anchored figures and their context share an `anchor_id`, which is what makes D14 a join and not a search. Why a second RPC rather than a branch in the first: `sir_put_anchored_geo` writes `method: 'anchored'` and the anchor's `accuracy_class` on every row, and a context row has neither; two short functions with one honest signature each beat one with a mode flag (Q9).

**D14. The payoff is a set of queries, and they are the acceptance test.** With the rows of §6 in `geo`:

```sql
-- every driveway of the file, with the numbers the sheet gave it
select d.label, d.posture, d.properties->'measures' as m, d.properties->>'trace_method' as how
from geo d where d.file_id = :file and d.kind = 'driveway';

-- spacing to every opening on the same frontage, inside edge to inside edge (TCM Table 7-5)
select d.label, o.properties->>'street' as street, o.properties->>'street_level' as level,
       round(st_distance(d.geom_local, o.geom_local)::numeric, 1) as spacing_ft,
       o.properties->>'accuracy_class' as theirs, d.properties->>'trace_method' as ours
from geo d join geo o on o.properties->>'anchor_id' = d.properties->>'anchor_id'
where d.kind = 'driveway' and o.kind = 'driveway_opening'
  and o.properties->>'side' = 'same' order by spacing_ft;

-- the nearest curb inlet (TCM 7.6.2(C), 10 ft)
select d.label, min(st_distance(d.geom_local, i.geom_local)) as inlet_ft
from geo d join geo i on i.properties->>'anchor_id' = d.properties->>'anchor_id' and i.kind = 'curb_inlet'
where d.kind = 'driveway' group by d.label;

-- the count per frontage, existing plus proposed (TCM Table 7-4)
select o.properties->>'street' as street, count(*) filter (where o.properties->>'on_subject' = 'true') as on_this_lot
from geo o where o.properties->>'anchor_id' = :anchor and o.kind in ('driveway','driveway_opening') group by 1;
```

plus the opposing-driveway offset (openings with `side = 'opposite'`, throat edge to throat edge along the street, against 80 ft) and the corner clearance (the opening to the intersecting `streets` segment's pavement edge). Every readout of a number carries both honesty labels: *"33.2 ft at the right-of-way line, vector, ring fit"* on our side and *"a 2023 digitized opening, about ±2 ft"* on theirs, as north star §9.4 requires; a spacing computed between a ±0.01 ft line and a ±2 ft polygon is a ±2 ft number and says so.

### 2.8 The readouts

**D15. The extract readout gains a curbs-and-driveways section; the anchor readout gains the frontage table.** `6.1-readout` (extract): per feature region — the set chosen, chains excluded, pairs found and unpaired chains, feet of curb by posture, every return with its radius and its label check (D8); per frontage — the street the worker named, the offset to the pavement edge, the openings derived with their measures, the survey's driveway regions matched and unmatched, and the unpaired proposed returns, in words. The anchor readout (`3.3-check` writes it): per frontage — street, Level and its source, openings on each side with widths and stations, inlets, the right-of-way polygon, and the D14 numbers as a table with both labels; a frontage the sheet named that the city's streets layer does not know (or the reverse) is a line of its own.

### 2.9 Hand-off from preprocessing

**D16. Same as the sibling's D19: read the upload's `source.pdf`, never a split sheet.** The arcs survive Ghostscript as Béziers (verified on White Water: `optimized.pdf` and `sheets/12.pdf` keep 16,479 paths), the layer names do not. For curbs that is a rung-1 loss, which is what rung 2 is for.

---

## 3. The change, piece by piece

### 3.1 The extract runbook

```diff
 extract-geometry-v2
   1.1-inputs                 request.json              unchanged
   1.2-fetch                  source.json, features.json  features.json now carries curb, curb_existing, driveway (edge / demolish as regexes) (D1)
   1.3-classify               document.json             unchanged
   2.1-survey/page            survey.json               + the three survey paragraphs, from the registry; + `feature: driveway` regions (D1)
   2.2-plan                   regions.json              unchanged (keeps every registered feature kind)
   3.1-transcribe/region      transcript.json           unchanged
   3.2-inventory              figures.json, calls.json  unchanged
   3.3-order/figure           order.json                unchanged
   3.4-trace                  traces.json, ws/          polyline sets per curb region, arcs on every chain, one overlay per set (D2, D3)
   3.5-confirm/region         confirm.json              + exclude[], labels[], faceSide? for a polyline region (D3, D4, D8)
+  3.5-confirm/frontage       frontage.json             one worker per primary sheet: names the street on each candidate edge, or says it is not one (D6)
   4.1-merge                  raw-artifact.json         unchanged (mete figures only)
   4.2-assemble               ws/artifact.json          assemble.py appends curb figures; assemble.ts registers them, pairs edges, groups arcs, finds frontages, derives driveways, checks labels (D4, D6, D7, D8)
   5.1-place-claims           claims.json               unchanged (tolerates derived figures as it does traced, bureau#2148)
   5.2-place-solve            placement.json            sheet_registration edge per curb figure; a derived figure takes its parents' frame (D7)
   6.1-readout                readout.md                + curbs and driveways section (D15)
   6.2-hitl                   decision.json             unchanged
   7.1-publish                                          geometry, length_ft, reading_method derived, derivation evidence (D9, D10)
```

The 3.4 roster is every `feature` region of a tracer-bearing kind on every sheet (as today) — `driveway` regions are not traced, they are counted; 3.5's roster is the primary sheet's curb regions plus one `frontage` item. On a plat every roster is empty and S5 (a) is byte-identical.

### 3.2 Cartographer

```diff
 cartographer/
 ├── src/lib/features/registry.ts        + curb, curb_existing, driveway; FeatureTracer + 'polyline' | null; minLengthFt, derive, edge, demolish (D1)
 ├── src/lib/geometry/
 │   ├── sheet.ts                        unchanged (a curb registers like a building)
 │   └── placement.ts                    + a derived figure's frame = its parents' (D7)
 ├── runbooks/extract-geometry/scripts/
 │   ├── lib/pdf_paths.py                + arc records beside the chords (D2)
 │   ├── lib/trace.ts                    + the polyline branch: sets, minLengthFt, arcs on chains, rung 2 by style; handAllowed refuses lines (D3)
+│   ├── lib/curb.ts                     pairEdges(), groupArcs() (D2, D4)
+│   ├── lib/frontage.ts                 findFrontages() (D6)
+│   ├── lib/driveway.ts                 deriveDriveways(): crossings, openings, returns, throat, angle, depth, posture, polygon (D7)
 │   ├── lib/evidence.ts                 figureSchema → 3-way union; derivedFigureSchema; TRACE_METHODS + derived; + role derivation (D9, D10)
 │   ├── lib/traced.ts                   deriveTraced() handles a LineString set; length; has_approximated_curves (D10)
 │   ├── trace.ts                        `carto trace feature` on a polyline entry; `--exclude` on re-trace (D3)
 │   ├── crop.ts                         `outline` takes a list of paths (D3)
 │   ├── assemble.ts                     curb figures → pairs → arcs → frontages → driveways → label checks (D4–D8)
 │   ├── place.ts                        derived figures (D7)
 │   └── publish.ts                      geometry + polygon, length_ft, reading_method, derivation evidence (D10)
 ├── runbooks/anchor-geometry/scripts/
 │   ├── lib/contracts.ts                InputFigure.geometryType, coords; relation + carried (D12)
 │   ├── lib/frames.ts                   geometryInFrame(); toGeoJsonLine(); fitSets ignore carried (D12)
 │   ├── fetch.ts                        reads geometry, not polygon (D10)
+│   ├── frontage.ts                     1.3-frontage: layers by role, openings from paved ∩ road, inlets, ROW, the ortho tile (D13)
 │   ├── render.ts                       lines by posture over the ortho tile (D12)
 │   └── publish.ts                      by geometry type; p_figures[].measures; sir_put_context_geo for frontage/*.json (D11, D13)
 └── src/routes/
     ├── geometry/[id]/                  draws paths; a derived figure shows its parents and measures (D10)
     └── anchored/, anchor/[id]/         lines by posture; context rows as a layer (D12, D13)
```

### 3.3 cityhall-new (the schema)

```diff
 cartographer_geometries
+  geometry         jsonb NOT NULL                       GeoJSON in frame feet; backfilled from polygon (D10)
   polygon          jsonb NOT NULL  →  jsonb NULL        CHECK (polygon IS NOT NULL) = (geometry type is a polygon)
+  length_ft        double precision                     a line's length (D10)
   reading_method   CHECK (mete | traced)  →  (mete | traced | derived)   (D9)
   reading_complete CHECK second arm: reading_method IN (traced, derived) AND mete IS NULL AND trace IS NOT NULL
 cartographer_geometry_evidence
   role             CHECK (…)  →  + derivation           (D10)
 geo
   (no DDL: geom columns already take a line; posture already admits existing)
 sir_put_anchored_geo(p_anchor_id, p_figures)
+  LineString | MultiLineString branch: st_collectionextract(st_makevalid(g), 2); measures into properties   (D11)
+sir_put_context_geo(p_anchor_id, p_features)
+  one row per opening / inlet / right-of-way polygon: method city_gis, posture existing, kind by role, properties {source_layer, object_id, source_vintage, accuracy_class: digitized, frontage, street, street_level, level_source, side, on_subject}   (D13)
```

### 3.4 The anchor runbook

```diff
 anchor-geometry
   1.1-inputs                 unchanged
   1.2-fetch                  reads geometry; passes geometryType, posture, reading_method through (D10, D12)
+  1.3-frontage               frontage/<n>.json + the ortho tile per frontage; frontage/none.json with why (D13)
   2.1-correspond             prompt: curb and driveway figures are `carried`; contract enum + carried (D12)
   3.1-solve                  unchanged (carried figures transformed, never fitted)
   3.2-render                 lines by posture, the derived driveway filled, over the ortho tile (D12)
   3.3-check                  + the two line questions; + the frontage table in the readout (D12, D15)
   4.1-hitl                   unchanged
   5.1-publish                figures by type with measures; context rows through sir_put_context_geo (D11, D13)
```

---

## 4. Testing seams

**S1: `trace.ts`'s CLI on a polyline feature** (existing seam, extended)
- **Proves:** D1, D3, D4 — White Water sheet 12, a `curb` region over the whole site → two candidate sets (`JCE BASE|C-CURB FOC`: 170 chains, 894 ft ± 2; `C-CURB BOC`: 43 chains), `edge` face / back from the layer; the FOC set carries 44 arcs on its chains; `pairEdges` → 17 pairs at 0.50 ± 0.02 ft, the unpaired chains listed; sheet 7, a `curb_existing` region → the `C-DEMO CONC` chains (86 and 85 ft ± 1) with `demolish: true`, the `V-CONC-LINE` and `V-ASPHALT-LINE` chains with `demolish: false`; a re-trace with `--exclude <chainId>` → the set without it, nothing else moved; 1700 S Lamar sheet 15 (one layer) → `layers: []`, rung 2 sets by style, ranked by length, capped, no throw; 2008 San Antonio sheet 10 → the entrance's two curb lines in one of the sets; `--seed` or `--vertices` on a polyline region → refused with the D3 message. Byte-identical output for the sibling's `building` fixtures.
- **Prior art:** the sibling's S1 fixtures in `runbooks/extract-geometry/scripts/trace.test.ts`, `lib/evidence.test.ts`.
- **Runs:** `bun test` in `cartographer`, CI.

**S2: `pdf_paths.py` and `groupArcs()`** (new, pure)
- **Proves:** D2 — a Bézier built from a known circle (κ = 0.5523, 90°) → `radiusPt` within 0.03 %, `sweepDeg` 90.0 ± 0.1, `residualPt` < 0.05; an S-curve → no arc, chords unchanged; sheet 12's 44 face Béziers → 19 centres with the §1.4 radii at the 1″ = 20′ registration (20.0, 28.0, 25.0, 15.0, 10.0, 5.0 within 0.02 ft under least squares; the back set at R − 0.50 ± 0.02); the chord output byte-identical to today's for every path.
- **Prior art:** `lib/page.test.ts` for the Python reader's fixtures.
- **Runs:** `bun test` (the TypeScript side) and `python3 -m pytest runbooks/extract-geometry/scripts/lib/` (the reader), CI.

**S3: `findFrontages()` and `deriveDriveways()`** (new, pure)
- **Proves:** D6, D7 — the White Water lot ring plus sheet 7's existing chains in lot feet → three frontage candidates (courses 5, 3+4 at 10.8–11.6 ft; course 1 at 11.6 ft), each with its coverage; with course 5 named `BREZZA LANE` and the others `null`, `deriveDriveways` → **0** proposed openings, **1** existing on course 5 at stations 77.8 / 111.0 ± 0.3, `widthAtRowFt` 33.2 ± 0.3, posture `existing`, the east edge `demolish: true`, and the two proposed returns (28.0, 20.0) reported as unpaired, crossing nothing; a synthetic lot with a straight frontage and a 24 ft driveway with 15 ft returns at 90° → `widthAtRowFt` 24.0, `throatWidthFt` 24.0, radii 15.0 / 15.0, angle 90.0, the apron polygon's area = 24 × throat depth + the two fillets to 0.1 ft²; the same at 75° → angle 75.0; with one return replaced by a 45° flare → `flare.left` 45°, `returnRadiusFt.left` null; two crossings 70 ft apart → no opening, both reported unpaired.
- **Prior art:** `src/lib/geometry/sheet.test.ts`, `placement.test.ts`, `src/lib/geometry/__fixtures__`.
- **Runs:** `bun test`, CI.

**S4: the extract scripts on a run directory with line and derived figures** (existing seam, extended)
- **Proves:** D9, D10 — a `raw-artifact.json` with the lot, two curb figures (one `curb` set with arcs, one `curb_existing` set with a `demolish` chain) and the confirm and frontage readings, through `assemble.ts` → `derived[curb].geometry` a `MultiLineString` with its first vertex at the origin, `length_ft` 894 ± 2, `has_approximated_curves: true`, the derived driveway figure with D7's measures and its polygon; `place.ts solve` → the curb figures in `frame-1` by `sheet_registration`, the driveway in `frame-1` by its parents; `publish.ts --dry-run` → rows with `geometry` and `polygon` both set for the lot and the driveway, `polygon: null` for the curbs, `reading_method: derived` and a `derivation` evidence row for the driveway, `trace` rows citing set overlays. The union refuses a derived figure with `pathPt`, a traced polyline with `courses`, and a `curb_existing` figure with posture `proposed`.
- **Prior art:** the sibling's S3 fixture; `anchor-e2e.test.ts` (a run directory as the fixture).
- **Runs:** `bun test`, CI.

**S5: the `extract-geometry-v2` runbook, inputs → outputs** (existing)
- **Proves:** D1–D8, D15 end to end, in two runs. **(a) Regression:** the car-wash plat `2024178771` → byte-identical `raw-artifact.json` / `artifact.json` to the sibling's S4 (a). **(b) White Water** (`run_slug: whitewater-cc2e3a53-v2-run3`): the survey marks `curb` on sheets 12 and 13, `curb_existing` on 7 and 12, and `driveway` once (the existing driveway, sheet 7 or 12); 3.4 traces every one; 3.5 confirms sheet 12's `curb` and `curb_existing` regions and names `BREZZA LANE` on course 5 and `null` on courses 1 and 3+4; `assemble.log` prints the two registrations (12 and 7, both 1″ = 20.000′), 17 pairs at 0.50 ft, 19 returns with `R20.0'` / `R25.0'` / `R28.0'` **agrees**, `84 LF` **disagrees (86)**, one frontage, 0 proposed / 1 existing opening at 33.2 ft, two proposed returns unpaired; the readout's section says it in words; `publish` → five figures (`LOT 1`, `CAR WASH`, `curb` proposed, `curb` existing, `BREZZA LANE driveway 1` existing), anchor `53d65a90` **stale**.
- **Prior art:** the step contracts; the sibling's S4.
- **Runs:** locally with `conductor`, against the two files; (b) is §6 step 1.

**S6: the RPCs and the migration, against a local Supabase** (existing suite)
- **Proves:** D9, D10, D11, D13 — the migration backfills `geometry` for every existing row and the CHECKs then hold (a polygon row with `polygon: null` refused; a line row with `polygon` set refused; `reading_method: derived` with `mete` set refused); `sir_put_anchored_geo` accepts a `LineString` payload and writes a `ST_LineString` row with `posture: existing` and `properties.measures`, refuses a `Point`, and still publishes yesterday's payload unchanged; `sir_put_context_geo` writes rows with `method: city_gis` under the anchor's id, and `cartographer_mark_anchors_stale` flags them with the anchored rows.
- **Prior art:** `cityhall-new/tests/db/anchor-unowned-geo.test.ts`; the sibling's S5.
- **Runs:** `tests/db` against the local stack; CI's `supabase db schema declarative sync --no-apply`.

**S7: the `anchor-geometry` runbook, inputs → outputs** (existing)
- **Proves:** D12–D14 — `{file, anchor_run_slug: whitewater-cc2e3a53-anchor-3}` on the re-extracted file → `1.3-frontage` writes one frontage for Brezza Lane (`street_level: 1`, `level_source: default`; the I-35 frontage road is reported as TxDOT with no Level), **0** `Driveways`-class polygons, N ≥ 1 openings from paved ∩ road on the same side (the site's own existing driveway among them, flagged `on_subject`), 3 inlets, 1 right-of-way polygon, the ortho tile with its world file; `correspondences.json` with `LOT 1` `same_as`, `CAR WASH` `within`, the two curb figures and the driveway `carried`; `anchors.json` with every figure under frame-1 and the fit metrics equal to anchor 2's to three decimals (the lot did not change); the overlay with lines by posture over the aerial; accept → `geo` rows: three anchored polygons, two anchored lines, one anchored derived polygon, and the context rows, all under one `anchor_id`; D14's queries return the existing driveway at 33.2 ± 0.3 ft wide with `inlet_ft` and `spacing_ft` numbers that agree with a hand measurement on the 2023 imagery within 3 ft.
- **Prior art:** `anchor-e2e.test.ts`; the sibling's S6.
- **Runs:** locally; §6 steps 2–3.

---

## 5. PR plan

**P0: the schema and the two RPCs** — `cityhall-new`
- **Blocked by:** nothing (can start now).
- **How:** edit the declarative files under `supabase/schemas/public/`, `npx supabase@2.119.0 db schema declarative sync --no-apply -f plan_set_driveways_curbs`, read the migration, add the `geometry` backfill statement to it by hand (declarative sync writes the column, not the data), commit both.
- **Delivers:** D9's CHECKs, D10's `geometry` (backfilled) and `length_ft`, the `derivation` role, D11's line branch, D13's `sir_put_context_geo`. Nothing writes the new columns yet; today's extract and anchor publishes keep working because `geometry` is filled by the backfill for old rows and `publish.ts` (P1) for new ones — **until P1 merges, a new extract publish would fail the `geometry NOT NULL`**, so P0 ships with `geometry` nullable and **P1 flips it** to `NOT NULL` in a second one-line migration once the writer is live. That is the expand discipline, stated so nobody is surprised.
- **Tested at:** S6.
- **Door:** two-way for the columns and CHECKs; **one-way for the backfill** in the sense that it is data (it can be re-run: `geometry` is a pure function of `polygon`). The rollback for everything else is dropping the columns and restoring the two CHECK lists.
- **Blast radius:** none until P1; a wrong CHECK refuses the next publish, which S6 catches.

**P1: the reader, the tracer, the three pure modules, the figure union, the extract scripts** — `cartographer`
- **Blocked by:** P0 (`database.ts` regeneration; `publish.ts` typechecks against `geometry`).
- **Delivers:** D1–D4, D6–D10 in code: arcs in `pdf_paths.py`, the polyline branch, `curb.ts`, `frontage.ts`, `driveway.ts`, the three-way union, `traced.ts` for lines, `assemble.ts` / `place.ts` / `publish.ts`, `crop outline` on a list, every reader of `polygon` moved to `geometry`, `/geometry/[id]` drawing paths; and the one-line `geometry NOT NULL` migration in cityhall-new as a trailing PR (`P1b`). After it merges the scripts take a hand-built run directory with curb and driveway figures to the database (S4), and a mete-only or building-only run exercises none of the new code.
- **Tested at:** S1, S2, S3, S4.
- **Door:** two-way.
- **Blast radius:** every `extract-geometry-v2` publish (the scripts are shared) and every `/geometry/[id]` page; the sibling's S3 fixture and S4 (a) are the guards.

**P2: the extract runbook learns curbs, frontages and driveways** — `bureau`
- **Blocked by:** P1.
- **Delivers:** D1's survey paragraphs (read from `features.json`, no prompt edit for the paragraphs themselves), `trace.py` on polyline entries, the 3.5 prompt and contract for a polyline region (`exclude`, `labels`, `faceSide`) and the new `frontage` item, `assemble.py` appending curb figures and handing the readings to `assemble.ts`, the readout section. After it merges, §6 step 1 runs.
- **Tested at:** S5 (a) and (b).
- **Door:** two-way for the runbook; one-way for prod data once §6 step 1 publishes (anchor `53d65a90` goes stale; the anchoring spec's rollback: nothing is deleted).
- **Blast radius:** every `extract-geometry-v2` run; S5 (a) is the guard.

**P3: the anchor side carries lines** — `cartographer` + `bureau`
- **Blocked by:** P0 (the RPC's line branch). Independent of P1 and P2 in code; it does nothing until a line figure exists.
- **Delivers:** D11's payload, D12 — `InputFigure.geometryType`, `carried`, `geometryInFrame`, `toGeoJsonLine`, render by posture, the check questions, publish by type with measures. After it merges an anchor run on a polygon-only file behaves exactly as today.
- **Tested at:** S7 (and the sibling's S6 as the regression).
- **Door:** two-way.
- **Blast radius:** every anchor publish; the RPC's unchanged polygon branch is the guard.

**P4: the frontage context** — `bureau` + `cartographer`
- **Blocked by:** P0 (`sir_put_context_geo`) and P3 (the anchor publish that calls it).
- **Delivers:** D13 — `frontage-layers.json` for `austin`, the `1.3-frontage` step and its contract, `frontage.ts`, the ortho tile under the render, the context rows in publish, the readout table. After it merges, §6 step 2 produces D14's rows.
- **Tested at:** S7.
- **Door:** two-way (the context rows are keyed by `anchor_id` and go stale with it).
- **Blast radius:** every anchor run in Austin makes seven network calls more; a layer outage is an error in `frontage/<n>.json`, never a failed run.

Deploy order: **P0 → P1 (then P1b) and P3 in either order → P2 → P4 → §6.**

---

## 6. Acceptance

On `cc2e3a53` as it stands (§1.6), after P0–P4:

1. **Extract.** `extract-geometry-v2` with `{file: cc2e3a53…, run_slug: whitewater-cc2e3a53-v2-run3}`. Expect S5 (b): five figures published; `assemble.log`'s lines for 17 pairs at 0.50 ft, the three printed radii agreeing, the 84 LF disagreeing by 2 ft, one frontage named `BREZZA LANE`, **0 proposed / 1 existing** opening at 33.2 ft retained-and-altered, the proposed `R28.0'` and `R20.0'` returns listed as unpaired; anchor `53d65a90` stale.
2. **Anchor.** `anchor-geometry` with `{file, anchor_run_slug: whitewater-cc2e3a53-anchor-3}`. Expect S7: `1.3-frontage` with Brezza Lane Level 1 by default, the openings from paved ∩ road, 3 inlets, 1 right-of-way polygon, the aerial under the overlay; the lot `same_as`, the building `within`, the lines and the driveway `carried`; metrics equal to anchor 2's; accept → the anchored rows and the context rows under one `anchor_id`.
3. **Measure.** D14's queries: the driveway's measures as published; `spacing_ft` to each opening on Brezza Lane with both labels; `inlet_ft`; the count on the frontage (1, existing, shared). The readout hands a person: *"one existing joint-use driveway, 33.2 ft at the right-of-way line on a Level 1 street (Table 7-2 typical 20 ft; LDC 25-6-321 applies to a retained approach); no proposed approach; the east curb of the existing driveway is removed (86 ft measured, 84 LF noted) and replaced by R28.0 and R20.0 returns inside the lot"* — and decides nothing.
4. **Regression.** S5 (a) on the car-wash plat; the sibling's S6 on the car-wash anchor; a building-only run of the sibling's fixture publishes two figures with `geometry` and `polygon` both set.

Two deliberate negatives: a `curb` region whose worker answers `chosen: null` publishes no curb figure and no driveway, and the readout names it; a frontage whose worker names no street derives no driveway on that edge, and the readout lists the crossings it would have paired.

---

## 7. Open questions

**Q1.** Face versus back on a layer-less sheet (D4). Both lines are carried and every width is a pair. Should code pick the face by a geometric rule — the member of the pair that the drive-aisle striping or the building sits on the far side of — or stay silent until a worker says? Proposed: silent; the pair is honest and the difference is the curb's own width.

**Q2.** The resulting condition. A driveway with one edge marked `demolish` is published as `proposed` with its existing edges (D7 step 7), which is what the sheet draws, not what will be built. Deriving the post-construction driveway needs the demolition semantics (what replaces the removed curb — on White Water the `R28.0'` return, which ends inside the lot). Proposed: v2, once a second set with a reconstructed approach is on disk; v1 reports both postures and the alteration in words.

**Q3.** Posture for a mixed driveway. `recorded | proposed | existing` has no `altered`. Proposed: `proposed` plus `trace.edges[].posture`, as D7 says; the audit should push back if a review query would want `WHERE posture = 'altered'`.

**Q4.** Where the frontage lives permanently. D6 records it on every derived driveway's trace and in the readout. A lot with no driveway loses it. Proposed: an `attributes.frontages[]` on the lot figure in a later slice (the lot is the merge agent's figure today; `assemble.py` could stamp it), or the north star's feature table when it exists (north star D2).

**Q5.** Austin's street, paved-area, inlet and right-of-way layers in bureau data (`frontage-layers.json`) or in surveyor's registry as new roles? Proposed: bureau data now — the roles are new, the consumers are two scripts, and `access_trace.py` set the precedent with `road-centerlines.json`; move to surveyor when a second jurisdiction's layers are trained (north star I2).

**Q6.** 200 ft (`SAC-04`) or 300 ft (`CC-22-14`). D13 fetches 300 and D14 reports against both. Should Bureau reconcile the two texts, and which way? Proposed: raise it on the review-guide side; this spec does not pick.

**Q7.** Openings from the orthophoto. Outside Austin, and in Austin where the 2023 digitization is stale or the frontage is residential (the `Driveways` class), the aerial is the only source, and reading it is a vision step: a worker boxes each apron on the georeferenced tile, code maps the box through the world file (the sibling's rung 4, on an aerial). Proposed: v2 — the tile is already fetched and shown to the check worker, so the step is one prompt and one contract when it is wanted.

**Q8.** Raster sheets (D3). A scanned plan set's curbs are pixels; `contour.ts` floods a region, it does not trace a line. Proposed: out until a raster plan set is on disk; `handAllowed` refuses cleanly.

**Q9.** One RPC or two (D13). `sir_put_context_geo` beside `sir_put_anchored_geo`, or one function with a `p_method`. Proposed: two; the audit may disagree if cityhall-new's function count is a cost.

**Q10.** The Street Level when the ASMP has no segment (D13). Brezza Lane is not on the ASMP network; TCM's tables key on Level. Proposed: `1` with `level_source: 'default'` and the fact in the readout, because the ASMP covers Level 2 and up by design — but the audit should confirm that reading of the ASMP with a transportation reviewer before a Table 7-5 number is ever quoted on a defaulted Level.

**Q11.** Opposing driveways (TCM 7.6.3) need the far side's right-of-way line to measure throat edge to throat edge. D13 has the far side's openings; it has a right-of-way polygon only where Austin's layer has one. Proposed: measure along the street's centreline projection when no right-of-way polygon exists, and say so.

**Q12.** When the `polygon` column's contract phase runs (D10). Proposed: after P1 has been in prod for one anchor run and one extract run, as its own small spec, together with retiring `rings` from `/geometry/[id]`.

---

## 8. Seams, against the sibling's list

The sibling (§8) scored itself against sir-free's eight seams. The same table for this spec, with one correction to its D18 row: it said driveways open **6.1 frame identity** because "the ROW (county side) and the curb (sheet side) must share a frame, which is the anchor, not the sheet". They do not: the right-of-way line a driveway is derived against is the lot's own frontage course, which is in frame-1 already — the **recorded** line and the **proposed** curb are on one sheet and one registration. What needs the anchor is the *adjacent* driveway, and that is D13's join on the grid, not a frame.

| sir-free §6 | this spec |
|---|---|
| 6.1 frame identity | **Still shut.** Curbs register to the lot's frame like the building; the driveway is derived in it. The context rows are on the grid, keyed by `anchor_id`, not by a frame. |
| 6.2 fixed scale | unchanged (`registerSheet` solves it; `anchor.ts` does not). |
| 6.3 units | not opened: page points stay inside the tracer; every stored coordinate is feet. |
| 6.4 polygon-only | **Opened — expand only** (D10): `geometry` beside `polygon`; the contract is Q12's spec. |
| 6.5 reading model | **Opened further** (D9): `derived` beside `mete` and `traced`. |
| 6.6 correspondence vocabulary | **Opened** (D12): `carried`. |
| 6.7 posture | **`existing` written for the first time** (D1, D7). |
| 6.8 provenance | **Opened on the context side** (D13): `properties.source_layer`, `object_id`, `source_vintage` on every `city_gis` row; `trace.page` still names the sheet on a figure. |

---

## 9. Not yet specified

- **The minimum coverage for a frontage candidate** (D6, "at least half the edge"): a short frontage on a corner lot with a curb return across half of it may fail it; the first corner lot will set the number.
- **The opening pairing window** (D7, 8–60 ft): a high-capacity three-lane driveway is 32 ft wide at the throat and wider at the right-of-way with 25 ft returns; 60 may be tight at R = 50 (industrial). The first industrial set decides.
- **How the rung-2 set is cut down** on a layer-less site plan: 1700 S Lamar sheet 15 has one layer and thousands of paths; by style the curb may share a pen with the building. What the worker sees (how many overlays, each of how many chains) comes with the first run on it.
- **The opening rule's tolerance** against the impervious layer (D13, 3 ft, ≥ 8 ft): tuned on the first three Austin frontages.
- **What `3.3-check` is told about the aerial** — leaf-off 2021 imagery against a 2026 plan set will disagree wherever the site changed; the prompt has to say so.
- **The confirm prompt's words for a polyline region** in full: D3 and D8 say what it must ask; the words come with P2.

## 10. Out of scope

- Trees, sidewalks, striping, drive aisles and parking as features (each a registry entry; sidewalks are the obvious next polyline, the same tracer).
- Grades and Z: throat grades (TCM 7.5.2), the 6 in rise at the right-of-way line, ramp slopes (IG slice 3).
- The post-construction driveway (Q2) and the demolition semantics generally.
- Vision-drawn openings from the orthophoto (Q7); any jurisdiction but Austin (Q5).
- The PostGIS tool surface for agents (north star P4); D14 is a query a person runs.
- The `polygon` column's contract phase (Q12); additive publish across re-extractions (sibling Q9).
- `cityhall`, the SIR runbook, the completeness check's vision path (`CC-22-12..15` are checked by a different product; this spec produces what they would check against).

---

## Appendix A: evidence pointers

- **Prod rows (2026-10-19):** `cartographer_geometries` 14 rows, 1 traced; `cc2e3a53` → `240c28fc` (`LOT 1`, mete, recorded, reference) and `160814af` (`CAR WASH`, traced, proposed, `sheet_registration`), both `whitewater-cc2e3a53-v2-run2`; `cartographer_anchors` `f290425a` stale, `53d65a90` accepted (`whitewater-cc2e3a53-anchor-2`, frame-1); `geo` for the file: `183eced8` county ring, `2ceb7683` LOT 1 stale, `e1cac23b` LOT 1 live, `387bd2cb` CAR WASH proposed; `geo` vocabulary in prod: kinds `building, easement, easement_sanitary_drainage, parcel, right_of_way`; methods `anchored, county_api, estimated`; geometry types `ST_Polygon, ST_MultiPolygon` only.
- **The PDFs:** `~/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf` (sheet 12 layers and counts as tabulated; sheet 7 `C-DEMO CONC` 38 / `C-IC EXIST PAVING` 45); `~/noetic/tmp/Quiddity/Electronic Submittal/00. 2008 San Antonio St Site Plans.pdf` (0 OCGs); `~/noetic/tmp/TestProjFromLamarCollier/v7/PLAN_SET__260723 Update 1700 S Lamar.pdf` (Civil 3D 2024, 440 OCGs, sheets 15–16 one layer each).
- **The spike (§1.4):** PyMuPDF 1.26.5 `get_drawings()` with `layer`; shapely 2.0.7 `linemerge` for chains, `MultiPoint.convex_hull` for the lot in page space (43,807 ft² against 43,560 — the hull takes the dash ends), a three-point circle through each Bézier's ends and midpoint; the frontage edge = the lot edge nearest the `V-ASPHALT-LINE` union; stations by `LineString.project`. Scripts: `probe1.py`–`probe5.py` in the session scratchpad; the numbers are the tables above and belong in S1–S3's fixtures.
- **Austin layers (§1.5):** `services.arcgis.com/0L95CJ0VTaxqcmED/ArcGIS/rest/services/{impervious_cover_2023, TRANSPORTATION_sidewalks, TRANSPORTATION_street_segment, TRANSPORTATION_asmp_street_network, UTILITIESCOMMUNICATION_CurbInlet, PLANNINGCADASTRE_right_of_way, EXTERNAL_tcad_parcel, LOCATION_address_points}/FeatureServer/0`; queries at −97.79374, 30.15016 with `distance` 50–300 ft; `imagery.geographic.texas.gov/server/rest/services/StratMap/StratMap21_NCCIR_CapArea_Brazos_Kerr/ImageServer` (`pixelSizeX` 0.1524003, `capabilities: Catalog,Image,Metadata`, 4 bands).
- **The rules (§1.2):** `bureau/jurisdictions/austin/codes/tcm/contents/Section 7 - Driveways/7.5.0 - Driveway Geometric Design Criteria/7.5.1 - Driveway Approach/{7.5.1.1 - Driveway Curb Radius., 7.5.1.2 - Driveway Widths., 7.5.1.3 - Driveway Angle.}.md`, `7.6.0 - Access Management/{7.6.1 - Property Frontage Driveway Requirements, 7.6.2 - Driveway Placement, 7.6.3 - Opposing Driveways With Offsets, 7.6.4 - Joint Use Driveways}.md`, `Section 9 - Parking and Loading/9.3.0 …/9.3.4 …/9.3.4.3.1 - Throat Storage Length..md`; LDC `§ 25-6-295`, `§ 25-6-321`, `§ 25-6-322`, `§ 25-6-451`; `review-guides/ta/site-access-and-circulation.md` `SAC-01`–`SAC-07`, `SAC-26`; `completeness-check/v2.7-trimmed/cc-22.md` `CC-22-12`–`CC-22-15`. Not in Bureau: the standard-detail sheets 433S-1 / 433S-2 / 433S-2A / 433S-3 themselves (cited in `SAC-02`, not scraped).
- **The extract runbook:** `bureau/runbooks/extract-geometry-v2/` — `README.md` (the plan-set paragraph), `scripts/{trace,assemble,roster}.py` (`trace.py primary_page`, `assemble.py append_traced` :66, `roster.py confirm` :7/:25), `steps/2.1-survey/steps/page/prompt.md` :59-81 (the plan-sheet section, reads `features.json`), `steps/3.5-confirm/steps/region/prompt.md`, `steps/3.4-trace/step.yaml`.
- **The cartographer scripts:** `runbooks/extract-geometry/scripts/lib/trace.ts` (`traceFeature` :388, `traceBoundary` :604, `BRIDGE_PT` :84, `MAX_STYLE_CANDIDATES` :88, `addHandCandidate` :548, `handAllowed` :583), `lib/pdf_paths.py` (:30-33, :64), `lib/evidence.ts` (`traceSchema` :335-372, `tracedFigureSchema` :376, `figureSchema` :396), `lib/traced.ts`, `assemble.ts` (:254-303 the traced branch), `src/lib/features/registry.ts`, `src/lib/geometry/sheet.ts` (`registerSheet` :370, `SheetRegistration` :67), `placement.ts` (`sheetEdge` :269).
- **The anchor side:** `runbooks/anchor-geometry/scripts/lib/frames.ts` (`ringInFrame` :80, `toInputFigure` :97, `buildAnchorInputs` :252, `anchoredGeoPayload` :427, `toGeoJsonPolygon` :440), `publish.ts` :248, `fetch.py` :51-70 (`arcgis` via `locate`), `bureau/runbooks/anchor-geometry/steps/{1.2-fetch,5.1-publish}/step.yaml`, `steps/2.1-correspond/contract.test.ts` :18, `src/lib/geometry/anchor.ts` :181.
- **Schema (cityhall-new `supabase/schemas/public/`):** `tables/cartographer_geometries.sql` (`polygon NOT NULL`, `closed NOT NULL`, the three CHECKs), `tables/cartographer_geometry_evidence.sql` (:25-31 the role and source-kind lists), `tables/geo.sql` (untyped `geom_local`, `geometry(Geometry,4326)`, `posture` CHECK), `functions/sir_put_anchored_geo.sql` (:52-60 the polygon gate, :77-78 posture, :93 trace_method), `functions/sir_parcels.sql` :20; migrations `20261016210300_plan_set_footprints.sql` and the five before it.
- **Site-research prior art:** `bureau/runbooks/site-research/bin/{arcgis_query.py, abutters.py, access_trace.py, _visual_walk_geo.py, site-visual-walk.sh}`, `data/road-centerlines.json`.
- **Prior specs:** `../plan-set-footprints/DESIGN-SPEC.md` (D4 the ladder, D6 the primary sheet, D7 registration, D8 checks-not-sources, D13 evidence, D17–D18 the registry and the next features, D19 split sheets, Q8–Q10), `../north-star/NORTH-STAR-SPEC.md` (§1.3, D12, D14, §9.3–9.4), `../sir-free-anchoring/DESIGN-SPEC.md` (§6 the seams), `../geometry-placement/DESIGN-SPEC.md` (winston#270), `../anchoring-geometries/DESIGN-SPEC.md` (winston#279 D14 stale anchors).
- **The IG report:** §4 "Feature layers by demand" (curb 34 / 18, driveway 19 / 12, street centreline 11 / 7), "Plan set and county geometry, together" (62 of 134 need the county side, "neighbouring driveways" named), the ranked operations ("(non-PostGIS) arc radius fit"), the spike row #28 (entrance 15.0 × 15.2 ft, face-to-curb 12.3 ft), §5 slice 2 ("join the ROW, centerline, easements, overlays, neighbouring driveways").
