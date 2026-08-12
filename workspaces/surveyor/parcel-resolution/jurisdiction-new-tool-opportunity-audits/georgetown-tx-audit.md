# Georgetown, TX — Parcel→Geopolygon Opportunity

- **Slug:** `georgetown-tx`
- **County:** Williamson · **State:** TX
- **Current gap:** `gtx_parcel_lookup` (source `georgetown-gis`) hardcodes `outSR=102739` against the WilCo WCAD Parcels layer, returning boundary `geometry.rings` in EPSG:102739 (State Plane Texas Central, US ft). Unlike Cedar Park it does not even project a WGS84 centroid — only the State Plane centroid is surfaced. No WGS84/GeoJSON polygon is produced.
- **Possible new tool?:** **Y**

## Methodology
Read the prior parcel-resolution audit for the Q3 endpoint (`gis.wilco.org/.../public/county_wcad_parcels/MapServer/0`) and ID field (`QuickRefID`). Fetched the layer metadata live and ran a live `outSR=4326&f=geojson` query by `QuickRefID` to confirm WGS84 output.

## Findings
Georgetown uses the same shared **Williamson County "WCAD Parcels" layer** (`MapServer/0` of `public/county_wcad_parcels` on `gis.wilco.org`) as every other WilCo city here. Polygon feature layer; `sourceSpatialReference` `wkid 102739 / latestWkid 2277`; parcel-ID field **`QuickRefID`** (string, e.g. `R648705`), the same WCAD PropertyQuickRefID `wcad_search` returns.

A live `where=QuickRefID='...'&returnGeometry=true&outSR=4326&f=geojson` request returns a valid WGS84 GeoJSON `Polygon`. The server reprojects foot-denominated data to 4326 on demand; the current tool just hardcodes `outSR=102739`. One-line fix on the existing endpoint — no new upstream, no client-side reprojection.

### Sample request
`GET https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?where=QuickRefID='R648705'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "QuickRefID": "R648705", "PropertyNumber": "...", "CNVYNAME": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -97.6771, 30.6321 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query" \
  --data-urlencode "where=QuickRefID='R648705'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, endpoint verified live.** Same WilCo layer as the existing `gtx_parcel_lookup` upstream returns a WGS84 GeoJSON polygon with `outSR=4326&f=geojson` keyed by `QuickRefID`. Pure parameter change; no reprojection or new service needed.
