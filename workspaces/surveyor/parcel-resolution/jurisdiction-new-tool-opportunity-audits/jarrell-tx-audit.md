# Jarrell, TX — Parcel→Geopolygon Opportunity

- **Slug:** `jarrell-tx`
- **County:** Williamson · **State:** TX
- **Current gap:** `jarrell_parcel_lookup` (source `jarrell-gis`) hardcodes `outSR=102739` against the WilCo WCAD Parcels layer, so boundary `geometry.rings` are EPSG:102739 (State Plane Texas Central, US ft). This module returns no WGS84 centroid at all (only the State Plane centroid); the field guide even flags a "coordinate gotcha" that the agent must project itself. No WGS84/GeoJSON polygon is emitted.
- **Possible new tool?:** **Y**

## Methodology
Read the prior parcel-resolution audit for the Q3 endpoint (`gis.wilco.org/.../public/county_wcad_parcels/MapServer/0`) and ID field (`QuickRefID`). Fetched the layer metadata live and ran a live `outSR=4326&f=geojson` query by `QuickRefID` to confirm WGS84 output.

## Findings
Jarrell shares the same **Williamson County "WCAD Parcels" layer** (`MapServer/0` of `public/county_wcad_parcels` on `gis.wilco.org`). Polygon feature layer; `sourceSpatialReference` `wkid 102739 / latestWkid 2277`; parcel-ID field **`QuickRefID`** (string, e.g. `R500629`). The tool additionally runs internal point-in-polygon jurisdiction checks (`county_incorporated_cities/0`, `rb/rb_parcels_mud_etj/0`) off the computed centroid, but those are unrelated to boundary output.

A live `where=QuickRefID='...'&returnGeometry=true&outSR=4326&f=geojson` request returns a valid WGS84 GeoJSON `Polygon`. The server reprojects on demand; the tool just never requests `outSR=4326`. One-line fix on the existing endpoint — no new upstream, no client-side reprojection.

### Sample request
`GET https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?where=QuickRefID='R500629'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "QuickRefID": "R500629", "PropertyNumber": "...", "CNVYNAME": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -97.6045, 30.8231 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query" \
  --data-urlencode "where=QuickRefID='R500629'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, endpoint verified live.** Same WilCo layer the existing `jarrell_parcel_lookup` already calls returns a WGS84 GeoJSON polygon with `outSR=4326&f=geojson` keyed by `QuickRefID`. It also removes the flagged "coordinate gotcha" — the server does the projection. Parameter change only.
