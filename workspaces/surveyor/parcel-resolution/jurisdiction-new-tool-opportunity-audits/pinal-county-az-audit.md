# Pinal County, AZ — Parcel→Geopolygon Opportunity

- **Slug:** `pinal-county-az`
- **County:** Pinal · **State:** AZ
- **Current gap:** `assessor_parcel_search` queries the county TaxParcels layer with `returnGeometry=false`, returning only `PARCELID` + attributes. The tools that DO fetch parcel rings (`pinal_zoning_lookup`, `pinal_plat_citation`, `pinal_property_profile` via `getParcelRings`) request them in WGS84 (`outSR=4326`) purely for internal intersects and never surface the boundary. No tool emits the parcel polygon.
- **Possible new tool?:** **Y**

## Methodology
Read the prior audit (names the Pinal TaxParcels MapServer as the Q1/Q2 upstream). Fetched the layer metadata JSON and ran a live geometry query with `outSR=4326&f=geojson` to confirm the State-Plane-native server reprojects to WGS84.

## Findings
Upstream API is the county's own ArcGIS Server:
`https://gis.pinal.gov/mapping/rest/services/TaxParcels/MapServer/3`

- **geometryType:** `esriGeometryPolygon`
- **Native spatialReference:** NAD_1983 StatePlane Arizona Central FIPS 0202 Int'l Feet (foot-denominated State Plane)
- **capabilities:** `Map,Query,Data`; **supportedQueryFormats:** JSON, **geoJSON**, PBF
- **Parcel-ID field:** `PARCELID` (string, ≤30 chars, bare 9-char APN form e.g. `50501667A`); situs `SITEADDRESS`.
- **maxRecordCount:** 2000.

Despite the foot-denominated State Plane storage, a live query with `outSR=4326&f=geojson` returned a valid GeoJSON `Polygon` in WGS84 (first vertex `[-111.1964, 32.5070]`) — correct for southern Arizona. The server honors `outSR` reprojection (the existing tools already pass `outSR=4326` successfully), so **no client-side reprojection is required**. Direct **Y**: query `where=PARCELID='<APN>'` (the exact ID `assessor_parcel_search` already returns) with `returnGeometry=true&outSR=4326&f=geojson`.

### Sample request
`GET https://gis.pinal.gov/mapping/rest/services/TaxParcels/MapServer/3/query?where=PARCELID='50501667A'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "PARCELID": "50501667A", "SITEADDRESS": "...", "OWNERNME1": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -111.1964, 32.5070 ], ["..."] ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gis.pinal.gov/mapping/rest/services/TaxParcels/MapServer/3/query" \
  --data-urlencode "where=PARCELID='50501667A'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, verified live.** The county TaxParcels server that all pinal-* tools already hit reprojects its State-Plane parcels to WGS84 on request; a live `outSR=4326&f=geojson` query returned a proper WGS84 GeoJSON polygon. Surfacing the boundary is just querying `where=PARCELID='<APN>'` — the rings are already being fetched internally. No reprojection caveat.
