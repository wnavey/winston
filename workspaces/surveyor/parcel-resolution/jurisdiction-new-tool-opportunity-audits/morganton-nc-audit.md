# Morganton, NC — Parcel→Geopolygon Opportunity

- **Slug:** `morganton-nc`
- **County:** Burke · **State:** NC
- **Current gap:** No tool returns the parcel boundary at all. `burke_parcel_search` explicitly sets `returnGeometry=false`; `morganton_parcel_lookup` also sets `returnGeometry=false` and surfaces only the WGS84 centroid (`XCoord`/`YCoord`), a point. Grep confirmed no `returnGeometry:'true'` anywhere in `burke-county-gis/` or `morganton-gis/`.
- **Possible new tool?:** **Y**

## Methodology
Read `morganton-nc-audit.md` (Q1 upstream = Burke County GIS `ProdParcelViewFC/MapServer/0`, ID fields `REID`/`PIN`; native SR NC State Plane 2264; city mirror = `Morganton_Zoning_Latest/MapServer/34`). Pulled the Burke parcel layer metadata and ran a live `outSR=4326&f=geojson` query by REID.

## Findings
The Q1 upstream layer is a full polygon layer that reprojects to WGS84 server-side. `https://gis.burkenc.org/arcgis/rest/services/ProdParcelViewFC/MapServer/0` (name `burke_vector.BURKE.PROD_PARCEL_VIEW_FC`, `geometryType: esriGeometryPolygon`, `capabilities: Map,Query,Data`, `supportedQueryFormats: JSON, geoJSON, PBF`). Native SR is NC State Plane (`wkid 102719 / latestWkid 2264`), but a live `where=REID='47193' … returnGeometry=true&outSR=4326&f=geojson` query returned a true WGS84 `Polygon` (vertices around `[-81.6961, 35.7164]`) — server-side reprojection works. Parcel-ID field is `REID` (Burke's canonical key that `burke_parcel_search` already returns); `PIN` also present but non-unique (disambiguate by `PIN_EXT`). The existing tool hits this exact layer with `returnGeometry=false`; flipping geometry on with `outSR=4326` is the entire fix. (City path `Morganton_Zoning_Latest/MapServer/34` is an alternate mirror keyed on `PIN`/`REID` if a city-scoped source is preferred.)

### Sample request
`GET https://gis.burkenc.org/arcgis/rest/services/ProdParcelViewFC/MapServer/0/query?where=REID='47193'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "REID": "47193", "PIN": "1792966585", "LOCATION_ADDR": "... BURKEMONT AVE", "...": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -81.696054, 35.716367 ], [ -81.696094, 35.716505 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gis.burkenc.org/arcgis/rest/services/ProdParcelViewFC/MapServer/0/query" \
  --data-urlencode "where=REID='47193'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, verified live.** The address→parcel layer the tool already hits (`ProdParcelViewFC/0`, keyed on `REID`) returns a WGS84 GeoJSON polygon directly via `outSR=4326&f=geojson`. The current centroid-only / no-geometry state is purely a client-side choice (`returnGeometry=false`), not an upstream limitation. No new endpoint or client-side reprojection needed.
