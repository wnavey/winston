# Cedar Park, TX — Parcel→Geopolygon Opportunity

- **Slug:** `cedar-park-tx`
- **County:** Williamson · **State:** TX
- **Current gap:** `cp_parcel_lookup` (source `cedar-park-gis`) hardcodes `outSR=102739` when querying the WilCo WCAD Parcels layer, so the boundary `geometry.rings` come back in EPSG:102739 (State Plane Texas Central, US ft), not WGS84 and not GeoJSON. The tool only projects the parcel *centroid* to WGS84 (via the WilCo geometry service), never the polygon.
- **Possible new tool?:** **Y**

## Methodology
Read the prior parcel-resolution audit to get the Q3 upstream endpoint (`gis.wilco.org/.../public/county_wcad_parcels/MapServer/0`) and the parcel-ID field (`QuickRefID`). Fetched the layer metadata live (`?f=json`) and ran a live `outSR=4326&f=geojson` query by `QuickRefID` to confirm WGS84 output.

## Findings
The upstream is the **Williamson County (WilCo) "WCAD Parcels" layer**, `MapServer/0` of the `public/county_wcad_parcels` service on `gis.wilco.org`. It is a polygon feature layer whose `sourceSpatialReference` is `wkid 102739 / latestWkid 2277` (State Plane), served by default in Web Mercator (`wkid 102100/3857`). The parcel-ID field is **`QuickRefID`** (string, e.g. `R631559`) — exactly the WCAD PropertyQuickRefID the address→parcel tool (`wcad_search`) already returns.

A live `where=QuickRefID='...'&returnGeometry=true&outSR=4326&f=geojson` request returns a proper WGS84 GeoJSON `Polygon` (verified: coordinates like `[-97.6386, 30.5104]`). The server reprojects on demand — the current tool simply never asks. Closing the gap is a one-line change (request `outSR=4326`, optionally `f=geojson`) on the existing endpoint; no new upstream, no client-side reprojection needed.

### Sample request
`GET https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?where=QuickRefID='R631559'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "QuickRefID": "R631559", "PropertyNumber": "...", "CNVYNAME": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -97.638610, 30.510444 ], [ -97.638033, 30.509718 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query" \
  --data-urlencode "where=QuickRefID='R631559'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, endpoint verified live.** The identical WilCo layer the tool already calls returns a WGS84 GeoJSON polygon when queried with `outSR=4326&f=geojson` by `QuickRefID`. No new API and no client-side reprojection required; it is a parameter change on the existing `cp_parcel_lookup` upstream.
