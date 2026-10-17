# Round Rock, TX — Parcel→Geopolygon Opportunity

- **Slug:** `round-rock-tx`
- **County:** Williamson · **State:** TX
- **Current gap:** `rr_parcel_lookup` (source `round-rock-gis`) hardcodes `outSR=102739` against the WilCo WCAD Parcels layer, returning boundary `geometry.rings` in EPSG:102739 (State Plane Texas Central, US ft) and only a State Plane centroid (no WGS84). The secondary RR `Base/Parcels/0` layer (matched by `RCODE`) is queried with `returnGeometry=false` for attributes only. No WGS84/GeoJSON polygon is emitted.
- **Possible new tool?:** **Y**

## Methodology
Read the prior parcel-resolution audit for the Q3 endpoint (`gis.wilco.org/.../public/county_wcad_parcels/MapServer/0`) and ID field (`QuickRefID`). Fetched the layer metadata live and ran a live `outSR=4326&f=geojson` query by `QuickRefID` to confirm WGS84 output.

## Findings
Round Rock resolves boundaries via the same shared **Williamson County "WCAD Parcels" layer** (`MapServer/0` of `public/county_wcad_parcels` on `gis.wilco.org`). Polygon feature layer; `sourceSpatialReference` `wkid 102739 / latestWkid 2277`; parcel-ID field **`QuickRefID`** (string, e.g. `R538863`), the WCAD PropertyQuickRefID `wcad_search` returns.

A live `where=QuickRefID='R538863'&returnGeometry=true&outSR=4326&f=geojson` request (run during this audit) returned a valid WGS84 GeoJSON `Polygon` (coords like `[-97.6386, 30.5104]`). The server reprojects on demand; the tool just hardcodes `outSR=102739`. One-line fix on the existing endpoint — no new upstream, no client-side reprojection.

### Sample request
`GET https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?where=QuickRefID='R538863'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "QuickRefID": "R538863", "PropertyNumber": "...", "CNVYNAME": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -97.638610, 30.510444 ], [ -97.638033, 30.509718 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query" \
  --data-urlencode "where=QuickRefID='R538863'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, endpoint verified live** (this exact `R538863` query returned WGS84 GeoJSON). Same WilCo layer as the existing `rr_parcel_lookup` upstream; `outSR=4326&f=geojson` keyed by `QuickRefID` yields the boundary in WGS84. Parameter change only, no reprojection.
