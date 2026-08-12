# Charlotte County, FL — Parcel→Geopolygon Opportunity

- **Slug:** `charlotte-county-fl`
- **County:** Charlotte · **State:** FL
- **Current gap:** No tool returns parcel geometry at all. `ccpa_search`/`ccpa_parcel_details` call `queryParcels` with geometry OFF and `normalizeParcel` drops any geometry; `ccgis_property_profile` fetches the polygon internally (Web Mercator 102100) only to intersect overlays and returns overlay results, never the rings.
- **Possible new tool?:** **Y**

## Methodology
Read `charlotte-county-fl-audit.md` (Q1 = CCGIS `Essentials/CCGIS_Web_Layers2022/MapServer` layer 17 "Property Ownership", ID field `ACCOUNT`). Pulled the MapServer + layer-17 metadata and ran a live `outSR=4326&f=geojson` query by ACCOUNT.

## Findings
The Q1 upstream layer is itself the parcel polygon layer — no separate service needed. `https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17` is name **"Property Ownership"**, `geometryType: esriGeometryPolygon`, `capabilities: Map,Query,Data`; the parent service advertises `supportedQueryFormats: JSON, geoJSON`. Native SR is Web Mercator (`wkid 102100 / latestWkid 3857`), and the server reprojects to 4326 on request. Parcel-ID field is `ACCOUNT` (12-digit strap) — exactly the key `ccpa_search` already returns. A live `where=ACCOUNT='412321151011' … returnGeometry=true&outSR=4326&f=geojson` returned a real WGS84 `Polygon` (vertices around `[-82.0146, 26.8962]`). The existing tool queries this same layer with `returnGeometry=false`; flipping geometry on with `outSR=4326` is the entire fix.

### Sample request
`GET https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17/query?where=ACCOUNT='412321151011'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "ACCOUNT": "412321151011", "propertyaddress": "26140 JONES LOOP RD", "...": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -82.0146, 26.8962 ], [ -82.0184, 26.8962 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17/query" \
  --data-urlencode "where=ACCOUNT='412321151011'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, verified live.** The parcel geometry lives on the very layer the address→parcel tool already hits (layer 17, keyed on `ACCOUNT`), and it returns a WGS84 GeoJSON polygon directly via `outSR=4326&f=geojson`. The current "no geometry" state is purely a client-side choice (`returnGeometry=false` + geometry dropped in `normalizeParcel`), not an upstream limitation. No new endpoint, no reprojection needed.
