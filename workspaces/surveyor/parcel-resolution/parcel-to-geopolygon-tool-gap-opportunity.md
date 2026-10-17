# Parcel ID → WGS84 Geopolygon — Gap / Opportunity Audit

**Scope:** The 24 jurisdictions that the [full jurisdiction audit](./full-jurisdiction-audit.md) found had
**no surveyor tool** returning a parcel boundary in WGS84 (EPSG:4326 / wkid:4326) — either no geometry at
all, centroid-only, or native **State Plane** rings that were never reprojected.

**Question asked (per jurisdiction):** *Is there likely an existing (or closely-related sibling) upstream API
that surveyor could call to close the gap — i.e. build a `parcelID → WGS84 polygon` tool?* Column value
**"Possible new tool?"** is **Y** when such an API realistically exists, **N** when there is no reachable path.

**Method:** 5 subagents, each working a serial queue of 4–5 counties, researched exhaustively via web search
(county/city ArcGIS REST directories, parcel FeatureServer/MapServer layer metadata, open-data hubs), starting
from each jurisdiction's existing address→parcel endpoint recorded in the prior audit. Per-jurisdiction
write-ups live in [`jurisdiction-new-tool-opportunity-audits/`](./jurisdiction-new-tool-opportunity-audits/).

---

## Metrics summary

- **24 / 24 (100%)** of the gap jurisdictions have a **possible new tool** → every gap is closable. **0 dead ends.**
- **23 / 24 were verified live this session** — a real `outSR=4326&f=geojson` query returned an actual WGS84
  GeoJSON polygon. The one exception (Lewisville) hit a transient upstream outage (`SITE_NOT_INITIALIZED`) on
  its primary DentonCAD host, but a sibling Denton County GIS layer was verified live and the prior audit already
  records the tool making a successful `outSR=4326` call.
- **~14 / 24 are handler-change-only:** the existing surveyor tool *already fetches WGS84-capable geometry from
  the exact layer* and then throws it away (reduces to a centroid, or sets `returnGeometry=false`, or fetches
  the rings but never returns them). These are the cheapest wins — no new integration, just stop discarding the
  polygon. Examples: all 4 Harris/HCAD jurisdictions (centroid via `centroidOf()`), Miami-Dade, Charlotte/Punta
  Gorda, Morganton, Lancaster, Maricopa, Pinal, Millington, Lewisville.
- **~10 / 24 are same-API-family extensions:** the address→parcel tool is CAD/assessor-based, but the county
  publishes a parcel geometry layer on the *same GIS server family* keyed on the same ID the tool already returns
  — add one `outSR=4326&f=geojson` query. Examples: the Williamson cities (shared WCAD parcel layer), Hays,
  Tarrant (Benbrook/Fort Worth), Dallas/DCAD, New Braunfels.
- **1 / 24 upgrades a prior "N":** **Pearland/Brazoria** — the address path runs through the geometry-less BIS
  eSearch assessor API, but Brazoria County separately publishes an ArcGIS parcel layer keyed on the same
  `prop_id`/`geo_id`, verified returning WGS84 GeoJSON.
- **Server-side reprojection everywhere:** every server that stores parcels natively in State Plane
  (SR 2276 / 2277 / 2278 / 2236 / 102739) or Web Mercator honored `outSR=4326` and reprojected on request.
  **No jurisdiction required client-side reprojection.** The prior "State-Plane-only" verdicts reflected what the
  *surveyor handler* asked for, not a limit of the upstream API.

**Takeaway:** the entire 24-county WGS84-geometry gap is closable, and roughly 60% of it is a pure handler fix on
APIs surveyor already calls. This strongly supports the unified proxy-layer proposal in the main audit — the
`GET /api/v1/parcel/geometry` endpoint could reach 100% of the audited jurisdictions with modest per-source work.

---

## Table — Possible new tool?

| Jurisdiction (County, State) | Possible new tool? | Upstream that closes the gap |
|---|:---:|---|
| [Harris County, TX](./jurisdiction-new-tool-opportunity-audits/harris-county-tx-audit.md) | **Y** | HCAD Parcels `MapServer/0`, `where=HCAD_NUM='<id>'` + `outSR=4326&f=geojson` (tool already fetches, discards via centroid) |
| [Houston, TX](./jurisdiction-new-tool-opportunity-audits/houston-tx-audit.md) | **Y** | Same county-wide HCAD Parcels `MapServer/0` (`gis.hctx.net`) |
| [Katy, TX](./jurisdiction-new-tool-opportunity-audits/katy-tx-audit.md) | **Y** | HCAD Parcels `MapServer/0` (Harris side); Fort Bend / Waller sides need separate CAD services |
| [Webster, TX](./jurisdiction-new-tool-opportunity-audits/webster-tx-audit.md) | **Y** | HCAD Parcels `MapServer/0` — live-verified on the Webster parcel |
| [Pearland, TX](./jurisdiction-new-tool-opportunity-audits/pearland-tx-audit.md) | **Y** | Brazoria County Parcels `MapServer/1` (keyed on `prop_id`/`geo_id`) — **upgrades prior N** |
| [Cedar Park, TX](./jurisdiction-new-tool-opportunity-audits/cedar-park-tx-audit.md) | **Y** | WilCo `county_wcad_parcels/MapServer/0` (`QuickRefID`) + `outSR=4326&f=geojson` |
| [Georgetown, TX](./jurisdiction-new-tool-opportunity-audits/georgetown-tx-audit.md) | **Y** | Same shared WilCo `county_wcad_parcels/MapServer/0` |
| [Jarrell, TX](./jurisdiction-new-tool-opportunity-audits/jarrell-tx-audit.md) | **Y** | Same shared WilCo `county_wcad_parcels/MapServer/0` |
| [Round Rock, TX](./jurisdiction-new-tool-opportunity-audits/round-rock-tx-audit.md) | **Y** | Same shared WilCo `county_wcad_parcels/MapServer/0` (QuickRefID R538863 verified) |
| [New Braunfels, TX](./jurisdiction-new-tool-opportunity-audits/new-braunfels-tx-audit.md) | **Y** | City `OpenData/AddressesBoundaries/MapServer/4` (`Prop_ID`), advertises geoJSON |
| [Dripping Springs, TX](./jurisdiction-new-tool-opportunity-audits/dripping-springs-tx-audit.md) | **Y** | `HaysCountyParcels/FeatureServer/0` (`PROP_ID`), 2278→WGS84 via `outSR=4326` |
| [Hays County, TX](./jurisdiction-new-tool-opportunity-audits/hays-county-tx-audit.md) | **Y** | Same shared Hays parcel FeatureServer |
| [Benbrook, TX](./jurisdiction-new-tool-opportunity-audits/benbrook-tx-audit.md) | **Y** | Benbrook `ParcelsFull/MapServer/31` (`Account_Nu` = TAD account), 2276→WGS84 |
| [Fort Worth, TX](./jurisdiction-new-tool-opportunity-audits/fort-worth-tx-audit.md) | **Y** | FW/TAD Parcels `MapServer/19` (`ACCOUNT`), 2276→WGS84 |
| [Dallas, TX](./jurisdiction-new-tool-opportunity-audits/dallas-tx-audit.md) | **Y** | DCAD `ParcelQuery/MapServer/4` (`PARCELID`), 3857→WGS84 via `outSR=4326` |
| [Lewisville, TX](./jurisdiction-new-tool-opportunity-audits/lewisville-tx-audit.md) | **Y** | DentonCAD `Parcels/MapServer/1` already fetches `outSR=4326` (keeps centroid); sibling `County_parcels/MapServer/0` verified |
| [Miami, FL](./jurisdiction-new-tool-opportunity-audits/miami-fl-audit.md) | **Y** | `MD_PA_PropertySearch/MapServer/1` (`FOLIO`) — tool already calls it, discards rings |
| [Charlotte County, FL](./jurisdiction-new-tool-opportunity-audits/charlotte-county-fl-audit.md) | **Y** | Same `CCGIS_Web_Layers2022/MapServer/17` (`ACCOUNT`) the search tool already hits |
| [Punta Gorda, FL](./jurisdiction-new-tool-opportunity-audits/punta-gorda-fl-audit.md) | **Y** | Identical shared countywide CCGIS `MapServer/17` (`ACCOUNT`) |
| [Morganton, NC](./jurisdiction-new-tool-opportunity-audits/morganton-nc-audit.md) | **Y** | Burke County `ProdParcelViewFC/MapServer/0` (`REID`) — tool hits it with `returnGeometry=false` |
| [Lancaster County, SC](./jurisdiction-new-tool-opportunity-audits/lancaster-county-sc-audit.md) | **Y** | `LC_Parcels/FeatureServer/0` (`PIN`) — rings already fetched + discarded |
| [City of Maricopa, AZ](./jurisdiction-new-tool-opportunity-audits/maricopa-az-audit.md) | **Y** | City SmartGov `FeatureServer/0` (`parcel_number`) or Pinal `TaxParcels/3` (`PARCELID`) |
| [Pinal County, AZ](./jurisdiction-new-tool-opportunity-audits/pinal-county-az-audit.md) | **Y** | `gis.pinal.gov/.../TaxParcels/MapServer/3` (`PARCELID`), State Plane→WGS84 via `outSR=4326` |
| [Millington, TN](./jurisdiction-new-tool-opportunity-audits/millington-tn-audit.md) | **Y** | Shelby `CurrentParcels/MapServer/0` (`PARCELID`/`PAID`) — needs legacy-TLS client already in repo |

**Totals: 24 Y · 0 N.**

---

## Mechanism breakdown

### A. Handler-change-only (already fetching WGS84-capable geometry, then discarding it)
The surveyor tool already queries the exact layer that can return the polygon; it just reduces the result to a
centroid, requests `returnGeometry=false`, or fetches the rings and never returns them. Closing the gap is a
handler edit, not a new integration.
- **Harris / HCAD:** `harris-county-tx`, `houston-tx`, `katy-tx`, `webster-tx` — rings dropped via `centroidOf()`.
- **Miami-Dade:** `miami-fl` — calls the parcel layer, discards rings (keeps centroid only).
- **Charlotte FL:** `charlotte-county-fl`, `punta-gorda-fl` — already hit CCGIS layer 17; no geometry returned.
- **Burke NC:** `morganton-nc` — hits the parcel layer with `returnGeometry=false`.
- **Lancaster SC:** `lancaster-county-sc` — rings fetched in 4326, then discarded.
- **Pinal AZ:** `maricopa-az`, `pinal-county-az` — rings fetched in WGS84, not returned.
- **Shelby TN:** `millington-tn` — rings fetched in 4326, reduced to centroid.
- **Denton TX:** `lewisville-tx` — DentonCAD layer already queried with `outSR=4326`; keeps only the centroid.

### B. Same-API-family extension (add one `outSR=4326&f=geojson` query on a sibling layer)
The address→parcel tool is CAD/assessor-based, but the county publishes a parcel geometry layer on the same GIS
server family, keyed on the same ID the tool already returns.
- **Williamson (shared WCAD parcel layer):** `cedar-park-tx`, `georgetown-tx`, `jarrell-tx`, `round-rock-tx`.
- **Hays (shared CAD FeatureServer):** `dripping-springs-tx`, `hays-county-tx`.
- **Tarrant / TAD:** `benbrook-tx`, `fort-worth-tx`.
- **Dallas / DCAD:** `dallas-tx`.
- **New Braunfels (city OpenData layer):** `new-braunfels-tx`.

### C. New sibling service (address path had no geometry; a separate county ArcGIS layer supplies it)
- **Brazoria:** `pearland-tx` — address via BIS eSearch (geometry-less); Brazoria County ArcGIS parcel layer
  supplies WGS84 GeoJSON keyed on `prop_id`/`geo_id`. **Upgrades the prior audit's N.**

---

## Canonical request shape

Every **Y** resolves to the same ArcGIS pattern — query the parcel layer by its ID field, ask for WGS84 GeoJSON:

```
GET {service}/{layer}/query
  ?where={IDFIELD}='{PARCEL_ID}'
  &outFields=*
  &returnGeometry=true
  &outSR=4326
  &f=geojson
```

```bash
curl -s -G "{service}/{layer}/query" \
  --data-urlencode "where={IDFIELD}='{PARCEL_ID}'" \
  --data-urlencode "outFields=*" \
  --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" \
  --data-urlencode "f=geojson"
```

Response (WGS84 GeoJSON `FeatureCollection`, trimmed):
```json
{
  "type": "FeatureCollection",
  "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
  "features": [
    {
      "type": "Feature",
      "properties": { "{IDFIELD}": "{PARCEL_ID}", "OWNER": "…", "SITUS": "…" },
      "geometry": { "type": "Polygon", "coordinates": [ [ [ -LON, LAT ], [ -LON, LAT ], "…" ] ] }
    }
  ]
}
```

Per-jurisdiction files give the concrete `{service}`, `{layer}`, and `{IDFIELD}` for each county, plus the
specific caveats (e.g. Katy's Fort Bend/Waller split, Millington's legacy-TLS requirement, the handler-discard
cases where the fix is even smaller than a new query).

---

## Relationship to the unified proxy proposal

This closes the biggest open question from the [main audit](./full-jurisdiction-audit.md)'s
`GET /api/v1/parcel/geometry` design: **coverage.** With all 24 gaps confirmed closable — and no client-side
reprojection required anywhere — the geometry endpoint is viable for **100% of the audited parcel jurisdictions**,
not the 55–77% the first pass measured. The registry's `ParcelCapabilityRow` should carry, per source: the
geometry service URL, the layer index, the parcel-ID field name, and the native SR (for the handful of servers
worth a client-side reprojection fallback if `outSR` is ever refused). The ~14 handler-change-only jurisdictions
are the recommended first implementation wave — highest coverage gain per line changed.
