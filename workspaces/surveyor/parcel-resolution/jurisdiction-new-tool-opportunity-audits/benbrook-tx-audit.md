# Benbrook, TX — Parcel→Geopolygon Opportunity

- **Slug:** `benbrook-tx`
- **County:** Tarrant · **State:** TX
- **Current gap:** `benbrook_parcel_lookup` returns `geometry.rings` from the Benbrook `ParcelsFull` layer with `outSR=2276` (NAD83 / Texas North Central, US ft — State Plane); `tad_details` also returns 2276 rings. Only a WGS84 centroid is produced (via the FW geometry service). The boundary polygon is never emitted in EPSG:4326 or GeoJSON.
- **Possible new tool?:** **Y**

## Methodology
Read the prior parcel-resolution audit (names the Q3 endpoint: `gis.newedgeservices.com/.../Benbrook/BenbrookPublicData/MapServer/31`, keyed on `Account_Nu` = TAD account). Fetched the layer-31 metadata JSON and ran a live `outSR=4326&f=geojson` query by `Account_Nu`. Also confirmed the sibling Fort Worth/TAD layer 19 path is available.

## Findings
Upstream API is the **same** New Edge Services ArcGIS MapServer already used for Benbrook parcel geometry:
`https://gis.newedgeservices.com/arcgis/rest/services/Benbrook/BenbrookPublicData/MapServer/31`.

- Layer name: **ParcelsFull**.
- Parcel-ID field: **`Account_Nu`** (= the TAD account the surveyor already carries from `tad_search`).
- Native SR: `wkid 102738 / latestWkid 2276`.
- `capabilities`: `Map,Query,Data`; `supportedQueryFormats`: **`JSON, geoJSON, PBF`** — GeoJSON is supported.
- **Live-verified**: a query with `outSR=4326&f=geojson` returned a `FeatureCollection` Polygon with lon/lat coordinates (first vertex `[-97.46223, 32.68407]`, i.e. Benbrook). Server reprojects on demand.

Fallback path (also Y): the TAD fabric on the Fort Worth server (`.../PlanningDevelopment/MapServer/19`, keyed on `ACCOUNT`) equally returns WGS84 GeoJSON with `outSR=4326` — verified in the Fort Worth audit. Either server closes the gap.

### Sample request
`GET https://gis.newedgeservices.com/arcgis/rest/services/Benbrook/BenbrookPublicData/MapServer/31/query?where=Account_Nu='42509465'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "Account_Nu": "42509465", "...": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -97.46223, 32.68407 ], [ -97.462, 32.684 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gis.newedgeservices.com/arcgis/rest/services/Benbrook/BenbrookPublicData/MapServer/31/query" \
  --data-urlencode "where=Account_Nu='42509465'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, live-verified.** The same Benbrook `ParcelsFull` MapServer already used for State-Plane geometry returns a WGS84 GeoJSON polygon under `outSR=4326&f=geojson`, keyed on the `Account_Nu` (TAD account) the surveyor already holds. A one-line reprojection change; the FW/TAD layer-19 path is a verified backup.
