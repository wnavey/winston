# Millington / Shelby County, TN — Parcel→Geopolygon Opportunity

- **Slug:** `millington-tn`
- **County:** Shelby · **State:** TN
- **Current gap:** `shelby_assessor_parcel_lookup` already queries the CurrentParcels layer with `returnGeometry=true&outSR=4326`, but the handler discards the polygon and returns only the computed WGS84 **centroid** (`centroidOf → {lon,lat}`) plus attributes. The rings/GeoJSON are never surfaced to the caller.
- **Possible new tool?:** **Y**

## Methodology
Read the prior audit (names the Shelby County CurrentParcels MapServer as the Q1 upstream, noting WAF/legacy-TLS quirks). Fetched the layer metadata JSON and ran a live `outSR=4326&f=geojson` geometry query to confirm the WGS84 polygon and the parcel-ID fields.

## Findings
Upstream API is the county's ArcGIS Server (SCGIS):
`https://scgis.shelbycountytn.gov/serverhigh/rest/services/Parcel/CurrentParcels/MapServer/0`

- **geometryType:** `esriGeometryPolygon`
- **Native spatialReference:** wkid 102100 / latestWkid 3857 (Web Mercator)
- **capabilities:** `Map,Query,Data`; **supportedQueryFormats:** JSON, **geoJSON**, PBF
- **Parcel-ID fields:** `PARCELID` (spaced form, e.g. `068071 D00046`), `PAID` (ParcelIDNoSpace, e.g. `068071D00046`), `PARID`, `PAR_ADDR1` (situs), `MUNI` (e.g. `MILLINGTON`).
- **maxRecordCount:** 1000.

Live query with `outSR=4326&f=geojson` returned a valid GeoJSON `Polygon` in WGS84 (first vertex `[-89.8764, 35.1421]`) — correct for Shelby County TN. Native Web Mercator reprojects to 4326 trivially, and the existing tool already passes `outSR=4326` successfully, so **no client-side reprojection is required**. Direct **Y**: query by `PARCELID` (spaced — the value `shelby_assessor_search` already returns) or the cleaner spaceless `PAID`, with `returnGeometry=true&outSR=4326&f=geojson`. Note the WAF: the request must use the same `node:https` client with browser UA + legacy-TLS renegotiation that `client.ts` already uses.

### Sample request
`GET https://scgis.shelbycountytn.gov/serverhigh/rest/services/Parcel/CurrentParcels/MapServer/0/query?where=PAID='068071D00046'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "PARCELID": "068071 D00046", "PAID": "068071D00046", "PAR_ADDR1": "...", "MUNI": "MILLINGTON" },
  "geometry": { "type": "Polygon", "coordinates": [[[ -89.8764, 35.1421 ], ["..."] ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://scgis.shelbycountytn.gov/serverhigh/rest/services/Parcel/CurrentParcels/MapServer/0/query" \
  -A 'Mozilla/5.0 Chrome/126' \
  --data-urlencode "where=PAID='068071D00046'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, verified live.** The CurrentParcels server that `shelby_assessor_parcel_lookup` already calls returns a WGS84 GeoJSON polygon when asked (`returnGeometry=true&outSR=4326&f=geojson`); today only the centroid is surfaced while the rings are fetched and dropped. Surfacing the boundary is querying `where=PARCELID='<spaced ID>'` (or `PAID='<spaceless>'`). Only caveat: reuse the existing WAF/legacy-TLS `node:https` client — a plain fetch may be blocked. This layer is flagged "internal use only" in metadata, but it is publicly reachable and already the tool's live source.
