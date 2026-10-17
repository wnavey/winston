# Houston, TX — Parcel→Geopolygon Opportunity

- **Slug:** `houston-tx`
- **County:** Harris · **State:** TX
- **Current gap:** Same as Harris County. `hcad_parcel_lookup` fetches the HCAD Parcels geometry with `returnGeometry=true&outSR=4326`, then reduces `features[0].geometry.rings` to a single `centroid` via `centroidOf()` and returns only that point. The WGS84 boundary polygon is discarded.
- **Possible new tool?:** **Y**

## Methodology
Read the prior Houston audit (Q1 = `hcad_search` → HCAD Parcels MapServer; Q3 fails on centroid reduction). Probed the same live upstream used for all City-of-Houston/Harris parcels: layer-0 metadata plus a WHERE-by-`HCAD_NUM` query with `returnGeometry=true&outSR=4326&f=geojson`.

## Findings
Houston parcels resolve through the county-wide **HCAD Parcels MapServer**, layer 0:
`https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0`

- **ID field:** `HCAD_NUM` (string; the account `hcad_search` already returns).
- **Geometry:** `esriGeometryPolygon`; native SR wkid 102740 / latestWkid **2278** (NAD83 Texas South Central, ft).
- **Reprojection:** server reprojects to `outSR=4326` on request — WGS84 returned directly; no client-side step.
- **Query:** `Query` capability present; `where=HCAD_NUM='<id>'` returns geometry; `f=geojson` supported (server lists geoJSON among `supportedQueryFormats`).

**Verified live:** a WHERE-by-`HCAD_NUM` request with `outSR=4326&f=geojson` returned a WGS84 Polygon `FeatureCollection` from this server (same endpoint tested under harris-county-tx). Houston is entirely inside HCAD coverage; the only fringe exceptions (Fort Bend / Montgomery slivers) fall to other CAD modules and are out of scope. The polygon is already fetched by the existing tool — surfacing it is a handler change, not a new integration.

### Sample request
`GET https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?where=HCAD_NUM='0401600000064'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "HCAD_NUM": "0401600000064", "owner_name_1": "...", "legal_dscr_1": "BRAESWOOD PLACE BLK 12 LT 7" },
  "geometry": { "type": "Polygon", "coordinates": [[[ -95.4321, 29.7010 ], [ -95.4320, 29.7015 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query" \
  --data-urlencode "where=HCAD_NUM='0401600000064'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, live-verified.** Houston reuses the same HCAD Parcels MapServer already wired into `hcad_search`. A `HCAD_NUM` WHERE query returns the parcel polygon in WGS84 via `outSR=4326&f=geojson` with no client-side reprojection. The gap is purely that `hcad_parcel_lookup` throws the rings away.
