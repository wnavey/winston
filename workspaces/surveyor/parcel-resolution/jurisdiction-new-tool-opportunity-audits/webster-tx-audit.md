# Webster, TX — Parcel→Geopolygon Opportunity

- **Slug:** `webster-tx`
- **County:** Harris · **State:** TX
- **Current gap:** Same HCAD pattern. `hcad_parcel_lookup` fetches the parcel geometry with `returnGeometry=true&outSR=4326`, then reduces `features[0].geometry.rings` to a single `centroid` via `centroidOf()` and returns only that point; the WGS84 boundary polygon is discarded. (`webster_zoning_lookup` returns zoning districts, not a parcel, so it doesn't help.)
- **Possible new tool?:** **Y**

## Methodology
Read the prior Webster audit (Q1 = `hcad_search` → HCAD Parcels MapServer; Webster sits entirely inside Harris County, so HCAD is the sole parcel entry point; Q3 fails on centroid reduction). Probed the same live upstream: layer-0 metadata plus a WHERE-by-`HCAD_NUM` query with `returnGeometry=true&outSR=4326&f=geojson`, using the Webster parcel `1384440020024` (WYCOFF RE I LLC, 1408 W NASA PKWY) from the prior audit.

## Findings
Webster is fully within HCAD coverage; parcels resolve through the **HCAD Parcels MapServer**, layer 0:
`https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0`

- **ID field:** `HCAD_NUM` (string; the account `hcad_search` returns).
- **Geometry:** `esriGeometryPolygon`; native SR wkid 102740 / latestWkid **2278** (NAD83 Texas South Central, ft).
- **Reprojection:** `outSR=4326` reprojects server-side to WGS84 directly; no client-side step.
- **Query:** `Query` capability present; `where=HCAD_NUM='<id>'`; `f=geojson` supported.

**Verified live (the Webster parcel itself):** the WHERE-by-`HCAD_NUM='1384440020024'` request with `outSR=4326&f=geojson` returned a WGS84 Polygon `FeatureCollection` (coordinates around `[-95.1345, 29.5261]`, owner `WYCOFF RE I LLC`). This is the exact server `hcad_search` already calls — the polygon is one field away from what the existing tool discards.

### Sample request
`GET https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?where=HCAD_NUM='1384440020024'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "HCAD_NUM": "1384440020024", "owner_name_1": "WYCOFF RE I LLC", "legal_dscr_1": "ODYSSEY PARK R/P AMEND BLK 020 LT 24" },
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
**Y — high confidence, live-verified against the Webster parcel itself.** The HCAD Parcels MapServer already behind `hcad_search` answers a `HCAD_NUM` WHERE query and returns the parcel polygon in WGS84 via `outSR=4326&f=geojson`, no client-side reprojection. The gap is only that `hcad_parcel_lookup` collapses the rings to a centroid.
