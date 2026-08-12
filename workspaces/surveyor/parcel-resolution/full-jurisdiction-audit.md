# Surveyor Parcel-Resolution Audit — Full Jurisdiction Report

**Scope:** every file in `surveyor/jurisdictions/*.md` (56 files), cross-read against the actual
tool handler code in `surveyor/src/sources/*`. For each jurisdiction we asked three questions:

1. **Address → Parcel ID** — is there a tool that takes a street address and returns a parcel/account/property ID?
2. **Lat/Lon → Parcel ID** — is there a tool that takes a coordinate and returns the parcel it falls in?
3. **Parcel ID → WGS84 geo-polygon / GeoJSON** — is there a tool that takes a parcel ID and returns the boundary geometry in WGS84 (EPSG:4326)?

Every **Y** below was confirmed in the handler code (endpoint, params, return shape), not merely in
the field-guide prose. Per-jurisdiction detail — tool I/O schemas, upstream request style, sample
response JSON, and sample `curl` — lives in [`jurisdiction-audits/`](jurisdiction-audits/).

---

## Executive Summary

Of the 56 jurisdiction files, **3 are non-parcel overlay sources** (`federal-us`, `texas-tx`,
`txdot` — national/statewide wetlands, water, roads, aquifer, flood). They expose no parcel tooling
and are excluded from the percentages below. That leaves **53 real parcel jurisdictions**.

| Question | Supported (of 53 real) | Share |
|---|---|---|
| **Q1 — Address → Parcel ID** | **53** | **100%** |
| **Q2 — Lat/Lon → Parcel ID** | **11** | **21%** |
| **Q3 — Parcel ID → WGS84 polygon** (strict) | **29** | **55%** |
| Q3 — parcel polygon available in *some* SR (WGS84 **or** State Plane) | 41 | 77% |

Reading the numbers:

- **Address→Parcel is universal (100%).** Every real jurisdiction has a working address search that
  yields a canonical parcel/account ID — the CAD/assessor "search" tools (TrueProdigy, Spatialest,
  Megabyte MPTS, BIS eSearch, GSA, ArcGIS parcel-layer `LIKE` queries, or a geocoder like NYC
  GeoSearch). This is the mature capability of the fleet. One caveat: San Antonio's `bcad_search` is
  code-correct but its upstream (`esearch.bcad.org`) is flagged **DEGRADED** in the field guide.

- **Lat/Lon→Parcel is the big gap (21%).** Only **11** jurisdictions expose a true point-in-polygon
  "what parcel is at this coordinate?" resolver. The overwhelmingly common pattern is that the
  jurisdiction *has* a coordinate-accepting tool (`*_property_profile`, `*_zoning_lookup`), but it
  queries **overlay/zoning/district layers only and returns no parcel ID** — often it even excludes
  the parcel layer deliberately. The machinery to do Q2 (`queryPointIntersect` /
  `queryLayerAtPoint` in `src/lib/gis-client.ts`) is present and used elsewhere; it is simply not
  pointed at the parcel layer for most jurisdictions.

- **Parcel→WGS84 polygon is a coin-flip (55%), but really 77% "almost".** 29 jurisdictions return a
  proper WGS84 boundary. Another **12** return the polygon **only in native State Plane** (`outSR`
  hard-coded to a foot-denominated SRID like 2276/2277/2278/102739/2236) — the rings exist, they're
  just in the wrong datum. A further handful **fetch WGS84 rings and then throw them away**, surfacing
  only the centroid. Both classes are one-line fixes away from Y (see *Near-misses* below).

### The 8 "full-triple" jurisdictions (all three = Y) ★

`albuquerque-nm` · `defiance-county-oh` · `ector-county-tx` · `fort-lauderdale-fl` ·
`los-angeles-ca` · `odessa-tx` · `riverton-wy` · `woodward-ok`

These are the reference implementations for a complete parcel-resolution stack. Two shapes recur:
a **single CAMA/assessor ArcGIS layer** that answers all three by varying the query
(Defiance, Woodward, Pinal-family, Lancaster, Ector), and a **CAD-search + county-GIS pair** where
the CAD does address→ID and the GIS does point→ID and ID→polygon (LA, Fort Lauderdale).

---

## The Matrix

**Q3 legend:** `Y` = WGS84 polygon/GeoJSON returned · `N ᵖ` = polygon returned but **only in native
State Plane** (WGS84 reprojection missing) · `N ᶜ` = WGS84 geometry fetched but **only the centroid
is surfaced** (polygon discarded) · `N ˣ` = no parcel geometry returned by any tool · `—` = overlay
source (not a parcel jurisdiction). `★` = supports all three.

| Jurisdiction | County | State | Q1 Address→Parcel | Q2 Lat/Lon→Parcel | Q3 Parcel→WGS84 polygon |
|---|---|---|:--:|:--:|:--:|
| [Albuquerque, NM](jurisdiction-audits/albuquerque-nm-audit.md) ★ | Bernalillo | NM | Y | Y | Y |
| [Atlanta, GA](jurisdiction-audits/atlanta-ga-audit.md) | Fulton/DeKalb | GA | Y | N | Y |
| [Austin, TX](jurisdiction-audits/austin-tx-audit.md) | Travis | TX | Y | N | Y |
| [Benbrook, TX](jurisdiction-audits/benbrook-tx-audit.md) | Tarrant | TX | Y | N | N ᵖ |
| [Bend, OR](jurisdiction-audits/bend-or-audit.md) | Deschutes | OR | Y | N | Y |
| [Boulder, CO](jurisdiction-audits/boulder-co-audit.md) | Boulder | CO | Y | N | Y |
| [Cedar Park, TX](jurisdiction-audits/cedar-park-tx-audit.md) | Williamson | TX | Y | N | N ᵖ |
| [Charlotte County, FL](jurisdiction-audits/charlotte-county-fl-audit.md) | Charlotte | FL | Y | N | N ˣ |
| [Charlotte, NC](jurisdiction-audits/charlotte-nc-audit.md) | Mecklenburg | NC | Y | N | Y |
| [Dallas, TX](jurisdiction-audits/dallas-tx-audit.md) | Dallas | TX | Y | N | N ᵖ |
| [Defiance County, OH](jurisdiction-audits/defiance-county-oh-audit.md) ★ | Defiance | OH | Y | Y | Y |
| [Denver, CO](jurisdiction-audits/denver-co-audit.md) | Denver | CO | Y | N | Y |
| [Dripping Springs, TX](jurisdiction-audits/dripping-springs-tx-audit.md) | Hays | TX | Y | N | N ᵖ |
| [Ector County, TX](jurisdiction-audits/ector-county-tx-audit.md) ★ | Ector | TX | Y | Y | Y |
| [Federal (overlay)](jurisdiction-audits/federal-us-audit.md) | National | US | — | — | — |
| [Fort Lauderdale, FL](jurisdiction-audits/fort-lauderdale-fl-audit.md) ★ | Broward | FL | Y | Y | Y |
| [Fort Worth, TX](jurisdiction-audits/fort-worth-tx-audit.md) | Tarrant | TX | Y | N | N ᵖ |
| [Fulton County, GA](jurisdiction-audits/fulton-county-ga-audit.md) | Fulton | GA | Y | N | Y |
| [Georgetown, TX](jurisdiction-audits/georgetown-tx-audit.md) | Williamson | TX | Y | N | N ᵖ |
| [Gwinnett County, GA](jurisdiction-audits/gwinnett-county-ga-audit.md) | Gwinnett | GA | Y | N | Y |
| [Haines City, FL](jurisdiction-audits/haines-city-fl-audit.md) | Polk | FL | Y | N | Y |
| [Harris County, TX](jurisdiction-audits/harris-county-tx-audit.md) | Harris | TX | Y | N | N ᶜ |
| [Hays County, TX](jurisdiction-audits/hays-county-tx-audit.md) | Hays | TX | Y | N | N ᵖ |
| [Houston, TX](jurisdiction-audits/houston-tx-audit.md) | Harris | TX | Y | N | N ᶜ |
| [Jarrell, TX](jurisdiction-audits/jarrell-tx-audit.md) | Williamson | TX | Y | N | N ᵖ |
| [Katy, TX](jurisdiction-audits/katy-tx-audit.md) | Harris | TX | Y | N | N ᶜ |
| [Lakeway, TX](jurisdiction-audits/lakeway-tx-audit.md) | Travis | TX | Y | N | Y |
| [Lancaster County, SC](jurisdiction-audits/lancaster-county-sc-audit.md) | Lancaster | SC | Y | Y | N ᶜ |
| [Lewisville, TX](jurisdiction-audits/lewisville-tx-audit.md) | Denton | TX | Y | N | N ᵖ |
| [Los Angeles, CA](jurisdiction-audits/los-angeles-ca-audit.md) ★ | Los Angeles | CA | Y | Y | Y |
| [Louisville, KY](jurisdiction-audits/louisville-ky-audit.md) | Jefferson | KY | Y | N | Y |
| [City of Maricopa, AZ](jurisdiction-audits/maricopa-az-audit.md) | Pinal | AZ | Y | Y | N ᶜ |
| [Miami, FL](jurisdiction-audits/miami-fl-audit.md) | Miami-Dade | FL | Y | N | N ᵖ |
| [Millington, TN](jurisdiction-audits/millington-tn-audit.md) | Shelby | TN | Y | N | N ᶜ |
| [Morganton, NC](jurisdiction-audits/morganton-nc-audit.md) | Burke | NC | Y | N | N ˣ |
| [New Braunfels, TX](jurisdiction-audits/new-braunfels-tx-audit.md) | Comal | TX | Y | N | N ᵖ |
| [New York, NY](jurisdiction-audits/new-york-ny-audit.md) | New York | NY | Y | N | Y |
| [Odessa, TX](jurisdiction-audits/odessa-tx-audit.md) ★ | Ector | TX | Y | Y | Y |
| [Pearland, TX](jurisdiction-audits/pearland-tx-audit.md) | Brazoria | TX | Y | N | N ˣ |
| [Phoenix, AZ](jurisdiction-audits/phoenix-az-audit.md) | Maricopa | AZ | Y | N | Y |
| [Pinal County, AZ](jurisdiction-audits/pinal-county-az-audit.md) | Pinal | AZ | Y | Y | N ᶜ |
| [Punta Gorda, FL](jurisdiction-audits/punta-gorda-fl-audit.md) | Charlotte | FL | Y | N | N ˣ |
| [Riverton, WY](jurisdiction-audits/riverton-wy-audit.md) ★ | Fremont | WY | Y | Y | Y |
| [Round Rock, TX](jurisdiction-audits/round-rock-tx-audit.md) | Williamson | TX | Y | N | N ᵖ |
| [San Antonio, TX](jurisdiction-audits/san-antonio-tx-audit.md) | Bexar | TX | Y | N | Y |
| [San Diego, CA](jurisdiction-audits/san-diego-ca-audit.md) | San Diego | CA | Y | N | Y |
| [Seattle, WA](jurisdiction-audits/seattle-wa-audit.md) | King | WA | Y | N | Y |
| [South Fulton, GA](jurisdiction-audits/south-fulton-ga-audit.md) | Fulton | GA | Y | N | Y |
| [Texas (overlay)](jurisdiction-audits/texas-tx-audit.md) | Statewide | TX | — | — | — |
| [Travis County, TX](jurisdiction-audits/travis-county-tx-audit.md) | Travis | TX | Y | N | Y |
| [TxDOT (overlay)](jurisdiction-audits/txdot-audit.md) | Statewide | TX | — | — | — |
| [Waxahachie, TX](jurisdiction-audits/waxahachie-tx-audit.md) | Ellis | TX | Y | N | Y |
| [Webster, TX](jurisdiction-audits/webster-tx-audit.md) | Harris | TX | Y | N | N ᶜ |
| [West Lake Hills, TX](jurisdiction-audits/west-lake-hills-tx-audit.md) | Travis | TX | Y | N | Y |
| [West Sacramento, CA](jurisdiction-audits/west-sacramento-ca-audit.md) | Yolo | CA | Y | N | Y |
| [Woodward, OK](jurisdiction-audits/woodward-ok-audit.md) ★ | Woodward | OK | Y | Y | Y |

**Overlay footnote:** `federal-us`, `texas-tx`, `txdot` are point-keyed environmental/transport
overlays (FWS/USGS/FAA/NRCS, TWDB/TCEQ/PUC, TxDOT roadway/ROW). `txdot_row_parcels` takes a
coordinate but returns TxDOT right-of-way *acquisition* parcels (project CSJ), not the subject
property's assessor parcel — so it does **not** satisfy Q2.

---

## Patterns & Findings

**1. Q1 is a solved problem; Q2 is the frontier.** The fleet is excellent at address→ID and good at
ID→geometry, but coordinate→ID is rare. If the unified service (below) does one new thing, it should
be to standardize a `parcel_at_point` capability, because the ArcGIS primitive already exists.

**2. The State-Plane tax.** Twelve jurisdictions (`N ᵖ`) return the parcel polygon in a
foot-denominated State Plane SR because a shared code path deliberately omits `outSR` (an ArcGIS
quirk: sending `outSR=4326` alongside foot-based geometry can corrupt buffers — see the warning
comment in `src/lib/gis-client.ts:625`). For *display* geometry this is over-cautious; the fix is a
second, geometry-only query at `outSR=4326`, exactly as `coa-gis`/`lakeway-gis`/Georgia/NYC already do.

**3. The discard-the-polygon bug class (`N ᶜ`).** Harris (all four HCAD jurisdictions), Shelby
(Millington), Lancaster, Miami, and the Pinal-family `*_property_profile` tools **already fetch rings
at `outSR=4326`** and then collapse them to a `{lon,lat}` centroid before returning. These are the
cheapest wins in the whole fleet — the WGS84 polygon is one field away.

**4. Latent Q2 that isn't wired up.** `src/lib/spatialest-client.ts` has a `searchByPoint()` helper
that Charlotte/Mecklenburg never exposes as a tool. Several `*_property_profile` tools accept a point
but exclude the parcel layer from their layer set. Q2 coverage could jump substantially with no new
upstream integrations — just re-pointing existing point queries at the parcel layer.

**5. Two-county cities split their answers.** Atlanta (Fulton **and** DeKalb), Pearland (Harris +
Brazoria), Katy (Harris + Fort Bend + Waller). Coverage is only as good as the module wired for the
side the subject parcel sits on — a routing concern the unified layer must handle (see below).

### Near-misses — jurisdictions one small change from a higher score

| Jurisdiction | Current | Blocker | Fix |
|---|---|---|---|
| Harris ×4 (Houston/Katy/Webster/Harris Co.) | Q3 `N ᶜ` | `hcad_parcel_lookup` returns centroid, discards WGS84 rings | Return `features[0].geometry.rings` (already 4326) |
| Millington (Shelby) | Q3 `N ᶜ` | Shelby lookup surfaces centroid only | Same one-field change |
| Lancaster County SC | Q3 `N ᶜ` | `shapeRecord()` drops the fetched 4326 rings | Return the rings |
| Miami (Miami-Dade) | Q3 `N ᵖ` | `mdpa_details` keeps SR-2236 rings, discards the 4326 fetch | Surface the WGS84 rings it already pulls |
| Maricopa / Pinal County | Q3 `N ᶜ` | profile tools fetch WGS84 rings internally, never return them | Expose a `*_parcel_geometry` tool |
| Dallas/Lewisville/New Braunfels/Williamson ×4/Hays ×2/Tarrant ×2 | Q3 `N ᵖ` | polygon only in State Plane | Add a geometry-only `outSR=4326` re-query |
| Charlotte NC (Mecklenburg) | Q2 `N` | `searchByPoint()` exists in the client, unwired | Register it as a tool |

---

## Proposed Unified Parcel-Resolution Proxy

The audit motivates a thin **unified proxy layer** inside surveyor: one stable API, keyed by a
`jurisdiction` (or `county`) slug, that dispatches to the correct backing tool and normalizes the
response. Callers (diligence Phase 0, the `parcel-geo-location-resolution` skill, external
consumers) stop caring that Austin is TCAD+COA-GIS while Bend is a single Deschutes ArcGIS layer.

### Design principles

- **Slug-routed.** The proxy owns a registry mapping `jurisdiction slug → { q1Tool, q2Tool, q3Tool }`
  (many rows already share a backing module — Harris' four slugs all point at `hcad-gis`).
- **Capability-honest.** Every jurisdiction advertises which of Q1/Q2/Q3 it supports; an unsupported
  call returns a typed `unsupported_capability` error, never a silent wrong answer. This inherits the
  **canonical-parcel-ID discipline** from `src/sources/PARCEL-ID-NAMESPACES.md`: assert the returned
  record's own ID echoes what was asked; degrade to empty, never to another parcel.
- **Datum-normalizing.** The proxy always emits WGS84 GeoJSON for Q3, reprojecting State-Plane rings
  (`N ᵖ` jurisdictions) at the proxy boundary using the transforms already in
  `src/lib/transverse-mercator.ts` / `projectToWgs84`. That turns the 55% strict Q3 into an
  effective ~77% at the API surface without touching every module.
- **Namespace-explicit parcel IDs.** Q1/Q2 return the ID **plus** its namespace (e.g. TCAD geoID,
  HCAD_NUM, APN/AIN, BBL, dotted-strap) so a Q3 caller can't cross a display ID with an internal key.

### Unified endpoints

```
POST /api/v1/parcel/resolve-by-address      # Q1
POST /api/v1/parcel/resolve-by-point        # Q2
POST /api/v1/parcel/geometry                # Q3
GET  /api/v1/parcel/jurisdictions           # capability catalog (which slugs support Q1/Q2/Q3)
```

#### Q1 — Address → Parcel ID

```
POST /api/v1/parcel/resolve-by-address
{
  "jurisdiction": "austin-tx",        // slug; or "county": "Travis" + "state": "TX"
  "address": "1100 Congress Ave, Austin, TX 78701"
}
```
```jsonc
// 200 OK
{
  "success": true,
  "jurisdiction": "austin-tx",
  "capability": "address_to_parcel",
  "results": [
    {
      "parcelId": "0208051301",
      "parcelIdNamespace": "tcad-geoid-10",   // explicit namespace
      "address": "1100 CONGRESS AVE",
      "owner": "…",
      "confidence": "exact",                  // exact | multiple | fuzzy
      "backingTool": "tcad/appraisal_search"
    }
  ]
}
```

#### Q2 — Lat/Lon → Parcel ID

```
POST /api/v1/parcel/resolve-by-point
{ "jurisdiction": "albuquerque-nm", "lat": 35.0844, "lon": -106.6504 }
```
```jsonc
// 200 OK
{
  "success": true,
  "jurisdiction": "albuquerque-nm",
  "capability": "point_to_parcel",
  "parcel": {
    "parcelId": "101205…",
    "parcelIdNamespace": "bernco-upc",
    "backingTool": "bernco-assessor/bernco_parcel_point_lookup"
  }
}
// 422 when unsupported
{ "success": false, "error": "unsupported_capability",
  "capability": "point_to_parcel", "jurisdiction": "austin-tx",
  "hint": "Austin has no lat/lon→parcel tool; use resolve-by-address." }
```

#### Q3 — Parcel ID → WGS84 GeoJSON

```
POST /api/v1/parcel/geometry
{ "jurisdiction": "ector-county-tx", "parcelId": "34900.02850.00000" }
```
```jsonc
// 200 OK — ALWAYS normalized to WGS84 GeoJSON, even for N ᵖ jurisdictions
{
  "success": true,
  "jurisdiction": "ector-county-tx",
  "capability": "parcel_to_geometry",
  "parcelId": "34900.02850.00000",
  "geometry": {                              // RFC 7946 GeoJSON, EPSG:4326
    "type": "Feature",
    "geometry": { "type": "Polygon", "coordinates": [[[-102.4468,31.8543], …]] },
    "properties": { "parcelId": "34900.02850.00000" }
  },
  "centroid": { "lon": -102.44662, "lat": 31.85419 },
  "sourceSpatialReference": 2277,            // native SR before proxy reprojection
  "reprojected": true,                       // true when proxy converted from State Plane
  "backingTool": "ector-gis/ector_parcel_lookup"
}
```

### Registry sketch

```ts
interface ParcelCapabilityRow {
  slug: string;                 // "austin-tx"
  county: string; state: string;
  parcelIdNamespace: string;    // "tcad-geoid-10"
  q1?: { source: string; tool: string };        // address→parcel
  q2?: { source: string; tool: string };        // point→parcel
  q3?: { source: string; tool: string;
         nativeSR: number;      // 4326 | 2277 | 102739 | …
         needsReproject: boolean };
}
// e.g.
{ slug:"austin-tx", county:"Travis", state:"TX", parcelIdNamespace:"tcad-geoid-10",
  q1:{source:"tcad",    tool:"appraisal_search"},
  q2:undefined,                                   // unsupported → 422
  q3:{source:"coa-gis", tool:"parcel_lookup", nativeSR:4326, needsReproject:false} }
```

The registry is directly derivable from the per-jurisdiction audits in this folder — each already
records the backing tool, source module, native SR, and the exact upstream request for all three
capabilities. Building the proxy is therefore mostly **wiring**, plus two reusable shims: a
State-Plane→WGS84 reprojector (fixes all `N ᵖ`) and a "return-the-rings-you-already-fetched" patch
(fixes all `N ᶜ`).

### Rollout leverage

1. **Ship the proxy over the 8 full-triple jurisdictions first** — zero module changes needed.
2. **Add the reprojection shim** → the 12 `N ᵖ` jurisdictions gain Q3 (55% → ~77% at the API).
3. **Add the rings-passthrough patch** → the `N ᶜ` jurisdictions (Harris ×4, Shelby, Lancaster,
   Miami, Pinal-family) gain Q3.
4. **Wire the latent point queries** (`searchByPoint`, parcel-layer point intersects) → Q2 climbs
   from 21% toward the ~40%+ that the underlying ArcGIS services can already answer.

---

## Per-Jurisdiction Reports

All 56 detailed reports (tool schemas, request styles, sample responses, curl commands) are in
[`jurisdiction-audits/`](jurisdiction-audits/), one `<slug>-audit.md` per jurisdiction. The
**Jurisdiction** column in the matrix above links directly to each.
