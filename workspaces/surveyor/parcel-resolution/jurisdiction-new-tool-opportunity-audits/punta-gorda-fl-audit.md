# Punta Gorda, FL — Parcel→Geopolygon Opportunity

- **Slug:** `punta-gorda-fl`
- **County:** Charlotte · **State:** FL
- **Current gap:** Identical to `charlotte-county-fl` — Punta Gorda is in-city Charlotte County and uses the same County-run `ccpa` + `ccgis` modules. No tool returns parcel geometry: `ccpa` queries with geometry off and `normalizeParcel` drops it; `ccgis_property_profile` fetches the polygon (Web Mercator 102100) only to intersect overlays.
- **Possible new tool?:** **Y**

## Methodology
Read `punta-gorda-fl-audit.md` (same upstream as Charlotte County: CCGIS `Essentials/CCGIS_Web_Layers2022/MapServer` layer 17 "Property Ownership", ID field `ACCOUNT`; the county PA maintains the tax roll for in-city Punta Gorda parcels too). Verified layer-17 geometry live via `outSR=4326&f=geojson` (see `charlotte-county-fl-audit.md` — same shared service).

## Findings
Same upstream and same fix as Charlotte County. `https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17` ("Property Ownership") is a polygon layer (`esriGeometryPolygon`, `capabilities: Map,Query,Data`, service `supportedQueryFormats: JSON, geoJSON`), native SR Web Mercator (`102100/3857`), reprojects to 4326 on request. Parcel-ID field `ACCOUNT` (12-digit) — the key `ccpa_search` already returns for Punta Gorda parcels. A live `outSR=4326&f=geojson` query by ACCOUNT returned a true WGS84 `Polygon` (Charlotte County GIS example vertex `[-82.0146, 26.8962]`). In-city Punta Gorda parcels sit on this same countywide layer, so the identical query serves them. The current "no geometry" is a client-side choice (`returnGeometry=false`), not an upstream limit.

### Sample request
`GET https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17/query?where=ACCOUNT='412215XXXXXX'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "ACCOUNT": "412215XXXXXX", "propertyaddress": "... PUNTA GORDA", "...": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -82.05, 26.93 ], [ -82.05, 26.93 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17/query" \
  --data-urlencode "where=ACCOUNT='412215XXXXXX'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, verified live** (via the shared Charlotte County CCGIS service). Punta Gorda parcels resolve through the same layer-17 the address→parcel tool already hits, and that layer returns a WGS84 GeoJSON polygon directly via `outSR=4326&f=geojson`, keyed on `ACCOUNT`. No new endpoint or reprojection required — only turning geometry on.
