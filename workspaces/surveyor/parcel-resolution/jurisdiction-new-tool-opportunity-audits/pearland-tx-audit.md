# Pearland, TX — Parcel→Geopolygon Opportunity

- **Slug:** `pearland-tx`
- **County:** Brazoria (+ Harris) · **State:** TX
- **Current gap:** Two-county city with no polygon path today. Harris side: `hcad_parcel_lookup` fetches the HCAD polygon at `outSR=4326` but returns only the centroid. Brazoria side: `brazoria_cad_search`/`brazoria_cad_details` hit the BIS Consultants **esearch** API (`esearch.brazoriacad.org`), which is a tabular assessor search with **no geometry at all**. City of Pearland GIS publishes no parcel layer. So neither county side surfaces a boundary.
- **Possible new tool?:** **Y** (both county sides)

## Methodology
Read the prior Pearland audit (Q1 = `hcad_search` north / `brazoria_cad_search` south; Q3 fails — HCAD centroid-only, Brazoria esearch geometry-less, Pearland GIS has no parcel fabric). For Harris, reused the verified HCAD path. For Brazoria, searched the county's ArcGIS ecosystem (the assessor's esearch is not a GIS server), found the county enterprise portal `maps.brazoriacountytx.gov/arcgis/rest/services`, located the `general/Parcels` service, and live-tested queries by `prop_id`, `geo_id`, and `situs_city` with `returnGeometry=true&outSR=4326&f=geojson`.

## Findings
**Two upstreams, both return WGS84 polygons:**

**1. Harris (Lower Kirby / SH-288 corridor) — HCAD Parcels MapServer, layer 0:**
`https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0` — ID field `HCAD_NUM`; native SR 2278; `where=HCAD_NUM='<id>'` + `outSR=4326&f=geojson` returns a WGS84 polygon (verified live under the other Harris audits). Same server `hcad_search` already uses.

**2. Brazoria (most of the city) — a NEW, separate county GIS service** (distinct from the geometry-less esearch assessor API): Brazoria County enterprise ArcGIS, **`general/Parcels` MapServer, layer 1 "Parcel Information"**:
`https://maps.brazoriacountytx.gov/arcgis/rest/services/general/Parcels/MapServer/1`

- **ID fields:** `prop_id` (integer) and `geo_id` (string) — these are exactly what `brazoria_cad_search` already returns as `propertyId` / `geoId`, so the search tool's output keys straight into this layer. Also `situs_*` address fields, `py_owner_name`, `legal_desc`, `legal_acreage`.
- **Geometry:** `esriGeometryPolygon`; native SR wkid 102740 / latestWkid **2278** (NAD83 Texas South Central, ft).
- **Reprojection:** server reprojects to `outSR=4326` directly; no client-side step.
- **Query:** `capabilities` = `Map,Query,Data`; `supportedQueryFormats` includes **geoJSON**.
- Note: layer 0 ("Flagged Parcels") is a QA subset — use **layer 1** for full coverage.

**Verified live (Pearland/Brazoria):** `where=prop_id=647863` and a `situs_city='PEARLAND'` query each returned a WGS84 Polygon `FeatureCollection` (coordinates around `[-95.2812, 29.5963]`). The `prop_id`→polygon join is confirmed. (A `prop_id` that doesn't exist returns HTTP 400, so callers should pass a `prop_id`/`geo_id` known from `brazoria_cad_search`.)

### Sample request
`GET https://maps.brazoriacountytx.gov/arcgis/rest/services/general/Parcels/MapServer/1/query?where=prop_id=647863&outFields=*&returnGeometry=true&outSR=4326&f=geojson`
(Harris side: `GET https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?where=HCAD_NUM='<id>'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`)

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "prop_id": 647863, "geo_id": "7457-9003-001", "py_owner_name": "...", "SITUS": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -95.281181, 29.596325 ], [ -95.281209, 29.596339 ], "..." ]] } } ] }
```

### Sample curl
```bash
# Brazoria (most of Pearland) — by prop_id or geo_id
curl -s -G "https://maps.brazoriacountytx.gov/arcgis/rest/services/general/Parcels/MapServer/1/query" \
  --data-urlencode "where=geo_id='7943-2101-019'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"

# Harris (Lower Kirby) — by HCAD_NUM
curl -s -G "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query" \
  --data-urlencode "where=HCAD_NUM='<id>'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, live-verified on both county sides.** This upgrades the prior audit's **N**: the earlier miss was that Brazoria parcel resolution went through the BIS **esearch** assessor API (no geometry), while the county actually publishes a separate ArcGIS parcel layer (`maps.brazoriacountytx.gov .../general/Parcels/MapServer/1`) that returns WGS84 GeoJSON polygons and is keyed on the same `prop_id`/`geo_id` that `brazoria_cad_search` already yields. Harris-side parcels reuse the verified HCAD path. No client-side reprojection needed on either side.
