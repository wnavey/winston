# Katy, TX — Parcel→Geopolygon Opportunity

- **Slug:** `katy-tx`
- **County:** Harris · **State:** TX
- **Current gap:** Same HCAD pattern. `hcad_parcel_lookup` fetches the parcel geometry with `returnGeometry=true&outSR=4326` but collapses `features[0].geometry.rings` to a single `centroid` `{lon,lat}` and returns only that point; the WGS84 boundary polygon is discarded.
- **Possible new tool?:** **Y**

## Methodology
Read the prior Katy audit (Q1 = `hcad_search` → HCAD Parcels MapServer; Q3 fails on centroid reduction). Probed the same live upstream (the audit's own worked example was Katy Fwy): layer-0 metadata and a WHERE-by-`HCAD_NUM` query with `returnGeometry=true&outSR=4326&f=geojson`.

## Findings
The Harris-County portion of Katy resolves through the **HCAD Parcels MapServer**, layer 0:
`https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0`

- **ID field:** `HCAD_NUM` (string; the account `hcad_search` returns, e.g. `1328730020014` for 24700 Katy Fwy).
- **Geometry:** `esriGeometryPolygon`; native SR wkid 102740 / latestWkid **2278** (NAD83 Texas South Central, ft).
- **Reprojection:** `outSR=4326` reprojects server-side to WGS84 directly.
- **Query:** `Query` capability present; `where=HCAD_NUM='<id>'`; `f=geojson` supported.

**Verified live:** the endpoint (identical to the one behind `hcad_search`) returned a WGS84 Polygon `FeatureCollection` for a WHERE-by-ID + `outSR=4326&f=geojson` request. Caveat: this covers the **Harris-County** side of Katy only; the Fort Bend / Waller portions belong to `fbcad`/`wallercad` (separate services, out of scope here). For the Harris side the polygon is already fetched — surfacing it is a one-line handler change.

### Sample request
`GET https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?where=HCAD_NUM='1328730020014'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "HCAD_NUM": "1328730020014", "site_addr_1": "24700 KATY FWY", "legal_dscr_1": "CINCO RANCH ... BLK 2 LT 45" },
  "geometry": { "type": "Polygon", "coordinates": [[[ -95.8061, 29.7805 ], [ -95.8058, 29.7808 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query" \
  --data-urlencode "where=HCAD_NUM='1328730020014'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, live-verified** (Harris side). The HCAD Parcels MapServer already wired into `hcad_search` answers a `HCAD_NUM` WHERE query and returns the parcel polygon in WGS84 via `outSR=4326&f=geojson`, no client-side reprojection. Fort Bend / Waller Katy parcels would need their own CAD services.
