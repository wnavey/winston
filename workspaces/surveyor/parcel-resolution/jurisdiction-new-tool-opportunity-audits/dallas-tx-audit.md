# Dallas, TX — Parcel→Geopolygon Opportunity

- **Slug:** `dallas-tx`
- **County:** Dallas · **State:** TX
- **Current gap:** `dcad_details` / `dallas_parcel_lookup` return the parcel boundary `geometry.rings` from the DCAD `ParcelQuery` MapServer with `outSR=2276` hardcoded (NAD83 / Texas North Central, US ft — State Plane). Only a WGS84 centroid is derived (projected through the City of Dallas geometry service); the boundary polygon is never emitted in EPSG:4326 or GeoJSON.
- **Possible new tool?:** **Y**

## Methodology
Read the prior parcel-resolution audit (names the Q1/Q3 endpoint: `maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4`, keyed on `PARCELID`). Fetched the layer-4 metadata JSON and ran a live `outSR=4326&f=geojson` query by `PARCELID`.

## Findings
Upstream API is the **same** Dallas Central Appraisal District (DCAD) ArcGIS MapServer already used for both address→parcel and the State-Plane geometry lookup:
`https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4`.

- Layer name: **ParcelPublishing**.
- Parcel-ID field: **`PARCELID`** (17-digit DCAD account — the exact key the surveyor already carries from `dcad_search`).
- Native SR: `wkid 102100 / latestWkid 3857` (Web Mercator; the current tool asks for 2276, but the source is not locked to State Plane).
- `capabilities`: `Map,Query,Data`; `supportedQueryFormats`: **`JSON, geoJSON`** — GeoJSON is supported.
- **Live-verified**: a query with `outSR=4326&f=geojson` returned a `FeatureCollection` Polygon with lon/lat coordinates (first vertex `[-96.91211, 32.73138]`, i.e. Dallas). Server reprojects on demand.

No client-side reprojection needed — swap the hardcoded `outSR=2276` for `outSR=4326` (optionally `f=geojson`) on the existing `dcad_details` query.

### Sample request
`GET https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query?where=PARCELID='00767100140010000'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "PARCELID": "00767100140010000", "SITEADDRESS": "5050 KEENELAND PKWY", "OWNERNME1": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -96.91211, 32.73138 ], [ -96.912, 32.731 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query" \
  --data-urlencode "where=PARCELID='00767100140010000'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, live-verified.** The identical DCAD `ParcelQuery` MapServer layer 4 already used for address→parcel and State-Plane geometry returns a WGS84 GeoJSON polygon under `outSR=4326&f=geojson`, keyed on the `PARCELID` the surveyor already holds. The layer is natively Web Mercator (not State-Plane-locked), so reprojection to 4326 is trivial — a one-line change.
