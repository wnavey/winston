# New Braunfels, TX — Parcel→Geopolygon Opportunity

- **Slug:** `new-braunfels-tx`
- **County:** Comal · **State:** TX
- **Current gap:** `nb_parcel_lookup` (source `nb-gis`) queries the city's AddressesBoundaries Parcels layer with `outSR=2278`, so the boundary polygon returned to the caller is State Plane WKID 2278 (NAD83 / Texas South Central, US ft). A secondary `outSR=4326` query is made but only its **centroid** is kept (`wgs84`); the WGS84 rings are discarded. No tool emits a WGS84 boundary polygon/GeoJSON.
- **Possible new tool?:** **Y**

## Methodology
Read the prior parcel-resolution audit for the endpoint (`gismaps.newbraunfels.gov/.../OpenData/AddressesBoundaries/MapServer/4`) and ID field (`Prop_ID`). Fetched the layer metadata live and ran a live `outSR=4326&f=geojson` query by `Prop_ID` to confirm WGS84 output.

## Findings
The upstream is the **City of New Braunfels "Parcels" layer**, `MapServer/4` of the `OpenData/AddressesBoundaries` service on `gismaps.newbraunfels.gov`. It is a polygon feature layer; native SR is `wkid 102740 / latestWkid 2278` (State Plane Texas South Central, US ft). `capabilities` = `Query,Map,Data`; **`supportedQueryFormats` explicitly lists `geoJSON`** (`"JSON, geoJSON, PBF"`). The parcel-ID field is **`Prop_ID`** (integer Comal CAD property id, e.g. `1458`) — the primary key the address→parcel path already produces. (`Geographic_Id` exists but is mostly null; do not rely on it.)

A live `where=Prop_ID=1458&returnGeometry=true&outSR=4326&f=geojson` request returned a valid WGS84 GeoJSON `Polygon` (coords like `[-98.128, 29.6979]`). The tool already runs an `outSR=4326` query internally — it simply throws away the rings and keeps the centroid. Closing the gap means retaining the WGS84 polygon (or requesting `f=geojson`) on the existing endpoint. No new upstream, no client-side reprojection needed. (Fallback layer `MapServer/5`, outside-ETJ parcels, is the same service and behaves identically if needed.)

### Sample request
`GET https://gismaps.newbraunfels.gov/arcserverwa22/rest/services/OpenData/AddressesBoundaries/MapServer/4/query?where=Prop_ID=1458&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "Prop_ID": 1458, "CAD_Situs": "699 W SAN ANTONIO ST", "Subdivision": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -98.128014, 29.697893 ], [ -98.128195, 29.698022 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gismaps.newbraunfels.gov/arcserverwa22/rest/services/OpenData/AddressesBoundaries/MapServer/4/query" \
  --data-urlencode "where=Prop_ID=1458" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, endpoint verified live.** The same city Parcels layer `nb_parcel_lookup` already calls advertises `geoJSON` support and returns a WGS84 GeoJSON polygon with `outSR=4326&f=geojson` keyed by `Prop_ID`. The tool even runs the 4326 query already; it just discards the rings. No new service and no client-side reprojection required.
