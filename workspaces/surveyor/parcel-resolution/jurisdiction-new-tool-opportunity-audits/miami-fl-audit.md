# Miami, FL — Parcel→Geopolygon Opportunity

- **Slug:** `miami-fl`
- **County:** Miami-Dade · **State:** FL
- **Current gap:** `mdpa_details` returns the parcel polygon (`geometry.rings`) but in native SR **2236** (NAD83 HARN FL East State Plane, US ft). It also issues a separate `outSR=4326` query, but uses that result only to compute the WGS84 **centroid** (`wgs84:{lat,lon}`) and discards the WGS84 ring. Caller gets a State-Plane polygon + a WGS84 point, never a WGS84 polygon.
- **Possible new tool?:** **Y**

## Methodology
Read `miami-fl-audit.md` (Q1 = MDPA PA Services Proxy; Q3 = PA GIS parcel MapServer, polygon in SR 2236, centroid-only in 4326). The audit already names the exact geometry endpoint: `https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/1` keyed on `FOLIO`. Verified this layer live with a real folio.

## Findings
Upstream is the **Miami-Dade PA property-search parcel polygon layer**: `https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/1` (layer name `MDC.Parcel_poly`, `esriGeometryPolygon`, `capabilities: Map,Query,Data`, `supportedQueryFormats: JSON, geoJSON, PBF`). Parcel-ID field is `FOLIO` (13-digit, the exact key `mdpa_details` already uses). A live query `where=FOLIO='0141370720120' … outSR=4326&f=geojson` returned a true WGS84 `Polygon` (vertices around `[-80.19610, 25.78078]`). The server reprojects to 4326 server-side — the surveyor tool ALREADY makes this call; it just reduces the result to a centroid. Surfacing the rings (or requesting `f=geojson`) is the whole fix.

### Sample request
`GET https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/1/query?where=FOLIO='0141370720120'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "FOLIO": "0141370720120", "...": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -80.196101, 25.780783 ], [ -80.196101, 25.780801 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/1/query" \
  --data-urlencode "where=FOLIO='0141370720120'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, verified live.** The same PA GIS layer the tool already queries returns a WGS84 GeoJSON polygon via `outSR=4326&f=geojson`, keyed on the folio the tool already holds. No new endpoint, no client-side reprojection — just stop discarding the rings. (Note: condo/renumbered folios may fall back to the layer-0 point representation, as the existing tool already handles.)
