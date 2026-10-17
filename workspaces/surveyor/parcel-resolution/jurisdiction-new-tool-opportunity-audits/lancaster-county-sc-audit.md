# Lancaster County, SC — Parcel→Geopolygon Opportunity

- **Slug:** `lancaster-county-sc`
- **County:** Lancaster · **State:** SC
- **Current gap:** The existing `lancaster_assessor_search` tool already fetches parcel geometry from LC_Parcels with `returnGeometry=true&outSR=4326`, but `shapeRecord()` uses `geometry.rings[0]` only to compute a `centroid` and then discards the rings. The caller receives a centroid point, never the WGS84 boundary polygon. No tool surfaces geometry.
- **Possible new tool?:** **Y**

## Methodology
Read the prior audit (names the Q1/Q2 upstream: LC_Parcels FeatureServer on ArcGIS Online). Fetched the layer metadata JSON and ran two live queries against the same endpoint to confirm it returns a WGS84 polygon by parcel ID field.

## Findings
Upstream API is the county's ArcGIS Online hosted feature service:
`https://services3.arcgis.com/rJcpRneDUBgTeCT3/arcgis/rest/services/LC_Parcels/FeatureServer/0`

- **geometryType:** `esriGeometryPolygon`
- **Native spatialReference:** wkid 102100 / latestWkid 3857 (Web Mercator)
- **capabilities:** `Query`; **supportedQueryFormats:** JSON, **geoJSON**, PBF
- **Parcel-ID field:** `PIN` (15-char, dashed format e.g. `0025-00-070.00`); also `PIN2` (spaced form) and `PROP_LOCAT` (situs).
- **maxRecordCount:** 2000.

Live query with `outSR=4326&f=geojson` returned a valid GeoJSON `Polygon` with WGS84 coordinates (first vertex `[-80.8479, 34.8559]`, PIN `0025-00-070.00`) — correct for Lancaster County SC. This is a hosted AGOL service that reprojects freely; no client-side reprojection needed. Direct **Y**: query `where=PIN='<dashed PIN>'` (the same join key `lancaster_assessor_search` already returns) with `returnGeometry=true&outSR=4326&f=geojson`.

### Sample request
`GET https://services3.arcgis.com/rJcpRneDUBgTeCT3/arcgis/rest/services/LC_Parcels/FeatureServer/0/query?where=PIN='0025-00-070.00'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "PIN": "0025-00-070.00", "OWNER_NAME": "...", "PROP_LOCAT": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -80.8479, 34.8559 ], ["..."] ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://services3.arcgis.com/rJcpRneDUBgTeCT3/arcgis/rest/services/LC_Parcels/FeatureServer/0/query" \
  --data-urlencode "where=PIN='0025-00-070.00'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, verified live.** The exact server that `lancaster_assessor_search` already calls returns a WGS84 GeoJSON polygon when asked (`returnGeometry=true&outSR=4326&f=geojson`); the rings are already fetched and simply discarded. Adding a `parcelID → WGS84 polygon` tool is a matter of surfacing the rings by querying `where=PIN='<dashed PIN>'`. No caveats.
