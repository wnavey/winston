# Harris County, TX — Parcel→Geopolygon Opportunity

- **Slug:** `harris-county-tx`
- **County:** Harris · **State:** TX
- **Current gap:** `hcad_parcel_lookup` already requests the HCAD Parcels layer with `returnGeometry=true&outSR=4326`, but its handler runs `features[0].geometry.rings` through `centroidOf()`/`computeCentroid()` and returns only the centroid `{lon,lat}`. The WGS84 boundary polygon is fetched and then discarded — never surfaced to the caller.
- **Possible new tool?:** **Y**

## Methodology
Read the prior Harris audit (Q1 = `hcad_search` → HCAD Parcels MapServer; Q3 fails because the polygon is reduced to a centroid). Directly probed the live upstream: fetched the layer-0 metadata (`f=json`) and ran a WHERE-by-parcel-ID query with `returnGeometry=true&outSR=4326&f=geojson`.

## Findings
The upstream is the **HCAD Parcels MapServer**, layer 0 "HCAD Parcels":
`https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0`

- **ID field:** `HCAD_NUM` (esriFieldTypeString, the 13-digit account already returned by `hcad_search`). Also `acct_num`, `LOWPARCELID`.
- **Geometry:** `esriGeometryPolygon`. Native `sourceSpatialReference` = wkid 102740 / latestWkid **2278** (NAD83 Texas South Central, US ft).
- **Reprojection:** The server reprojects on demand — `outSR=4326` returns lon/lat directly; no client-side reprojection needed.
- **Query capability:** `capabilities` includes `Query`; a `where=HCAD_NUM='<id>'` clause returns geometry. `f=geojson` is supported and emits a clean WGS84 `FeatureCollection`.

**Verified live (real parcel 1384440020024):** the WHERE-by-ID + `outSR=4326&f=geojson` request returned a WGS84 Polygon with coordinates around `[-95.1344, 29.5261]`. This is the identical server `hcad_search` already calls — the polygon is one field away. Closing the gap is a handler change (return `rings`/GeoJSON alongside, or in place of, the centroid), not a new integration.

### Sample request
`GET https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?where=HCAD_NUM='1384440020024'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "HCAD_NUM": "1384440020024", "owner_name_1": "WYCOFF RE I LLC", "Acreage": null },
  "geometry": { "type": "Polygon", "coordinates": [[[ -95.134460, 29.526128 ], [ -95.135047, 29.526756 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query" \
  --data-urlencode "where=HCAD_NUM='1384440020024'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, live-verified.** The exact server surveyor already hits for `hcad_search` answers a `HCAD_NUM` WHERE query and returns the parcel polygon in WGS84 via `outSR=4326&f=geojson`. No new upstream, no client-side reprojection. The only reason there's no tool today is that `hcad_parcel_lookup` collapses the already-fetched rings to a centroid.
