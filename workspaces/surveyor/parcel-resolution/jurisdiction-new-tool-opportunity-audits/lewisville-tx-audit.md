# Lewisville, TX — Parcel→Geopolygon Opportunity

- **Slug:** `lewisville-tx`
- **County:** Denton · **State:** TX
- **Current gap:** `dentoncad_details` returns the parcel boundary polygon only in native State Plane WKID 2276. It *does* issue a second query at `outSR=4326`, but keeps only the centroid (`centroidWgs84`) and discards the WGS84 rings. `lewisville_gis_parcel` behaves the same. No tool emits a WGS84 boundary polygon.
- **Possible new tool?:** **Y**

## Methodology
Read `lewisville-tx-audit.md` (Q1 upstream = DentonCAD `geo.dentoncad.com/arcgis/rest/services/Parcels/MapServer/1`, ID field `pid`; Q3 = polygon returned in SR 2276 only). Attempted to hit the DentonCAD server directly to confirm outSR support — the host was returning a transient `9017$SITE_NOT_INITIALIZED` 500 during this session, but the prior audit already documents that the existing tool successfully makes an `outSR=4326` returnGeometry call against this exact layer (it just drops the rings), which is direct proof the server reprojects. Additionally searched for and verified a sibling **Denton County GIS** parcel service as a live backup.

## Findings
Two viable upstreams, both reproject to WGS84 server-side:

1. **Primary — DentonCAD (same server already used):** `https://geo.dentoncad.com/arcgis/rest/services/Parcels/MapServer/1`, ID field `pid` (numeric) or `geoID` (string account). The surveyor tool ALREADY calls this layer with `returnGeometry=true&outSR=4326` and gets rings back; it simply reduces them to a centroid. Surfacing those rings (or requesting `f=geojson`) is the entire fix — no new endpoint needed.

2. **Sibling backup — Denton County GIS (verified live this session):** `https://gis.dentoncounty.gov/arcgis/rest/services/County_parcels/MapServer/0` (name "Parcels", `esriGeometryPolygon`, `capabilities: Query,Map,Data`, `supportedQueryFormats: JSON, geoJSON, PBF`). Parcel-ID field `prop_id` (same numeric id as DentonCAD's `pid`). A live `where=1=1 … outSR=4326&f=geojson` query returned a real `Polygon` in lon/lat (first vertex `[-97.0317, 33.1300]`) — confirms server-side reprojection works. (Layer requires `orderByFields`/OID for pagination; include `orderByFields=OBJECTID`.)

### Sample request
`GET https://gis.dentoncounty.gov/arcgis/rest/services/County_parcels/MapServer/0/query?where=prop_id=986704&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "prop_id": 986704, "situs": "100 E MAIN ST, LEWISVILLE, TX", "owner_name": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -96.9945, 33.0461 ], [ -96.9943, 33.0462 ], "..." ]] } } ] }
```

### Sample curl
```bash
# Sibling Denton County GIS (verified reprojects to 4326):
curl -s -G "https://gis.dentoncounty.gov/arcgis/rest/services/County_parcels/MapServer/0/query" \
  --data-urlencode "where=prop_id=986704" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"

# Primary DentonCAD (same layer the tool already hits; drop the centroid-only reduction):
curl -s -G "https://geo.dentoncad.com/arcgis/rest/services/Parcels/MapServer/1/query" \
  --data-urlencode "where=pid=986704" \
  --data-urlencode "outFields=pid,geoID" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence.** The existing DentonCAD tool already retrieves WGS84 geometry and throws away the rings; simply returning them closes the gap with zero new integration. Independently, the Denton County GIS `County_parcels` layer was verified live to return a WGS84 GeoJSON polygon via `outSR=4326&f=geojson`, keyed on the same `prop_id`. No client-side reprojection required.
