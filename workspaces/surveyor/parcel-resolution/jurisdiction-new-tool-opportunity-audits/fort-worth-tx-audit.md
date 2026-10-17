# Fort Worth, TX — Parcel→Geopolygon Opportunity

- **Slug:** `fort-worth-tx`
- **County:** Tarrant · **State:** TX
- **Current gap:** `fort_worth_parcel_lookup` / `tad_details` return the parcel boundary `geometry.rings` from Fort Worth GIS layer 19, but hardcode `outSR=2276` (NAD83 / Texas North Central, US ft — State Plane). Only the centroid is projected to WGS84 (`centroidWgs84`); the boundary polygon is never emitted in EPSG:4326 or GeoJSON.
- **Possible new tool?:** **Y**

## Methodology
Read the prior parcel-resolution audit (names the Q1/Q3 endpoint: `mapit.fortworthtexas.gov/.../PlanningDevelopment/MapServer/19`, the TAD Parcels layer hosting the `ACCOUNT` key). Fetched the layer-19 metadata JSON and ran a live `outSR=4326&f=geojson` query by `ACCOUNT`.

## Findings
Upstream API is the **same** City of Fort Worth ArcGIS MapServer already used for address→parcel and for the State-Plane geometry lookup:
`https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19`.

- Layer name: **Parcels** (the Tarrant Appraisal District / TAD parcel fabric published on the FW server).
- Parcel-ID field: **`ACCOUNT`** (TAD account number — the exact key the surveyor already carries from `tad_search`).
- Native SR: `wkid 102738 / latestWkid 2276`.
- `capabilities`: `Data,Map,Query`; `supportedQueryFormats`: **`JSON, geoJSON, PBF`** — GeoJSON is supported.
- **Live-verified**: the server happily reprojects to WGS84. A query with `outSR=4326&f=geojson` returned a proper `FeatureCollection` Polygon with lon/lat coordinates (first vertex `[-97.36031, 32.74934]`, i.e. downtown Fort Worth).

No client-side reprojection needed — the server reprojects on demand. The only change is dropping `outSR=2276` → `outSR=4326` (and optionally `f=geojson`) on the existing query.

### Sample request
`GET https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19/query?where=ACCOUNT='42328053'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "ACCOUNT": "42328053", "SITUS_ADDR": "3001 CROCKETT ST", "OWNER_NAME": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -97.36031, 32.74934 ], [ -97.360, 32.749 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19/query" \
  --data-urlencode "where=ACCOUNT='42328053'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, live-verified.** The identical FW/TAD MapServer layer 19 already used for address→parcel and State-Plane geometry returns a WGS84 GeoJSON polygon when asked with `outSR=4326&f=geojson`; the parcel key (`ACCOUNT`) is already in hand. This is a one-line reprojection change, no new server, no client-side math.
