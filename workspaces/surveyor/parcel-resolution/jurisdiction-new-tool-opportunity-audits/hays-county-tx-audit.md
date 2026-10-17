# Hays County, TX — Parcel→Geopolygon Opportunity

- **Slug:** `hays-county-tx`
- **County:** Hays · **State:** TX
- **Current gap:** `hays_parcel_lookup` returns `geometry.rings` from the `Hays_County_Parcels/FeatureServer/0` layer requested with `outSR=2278` (NAD83 / Texas Central, ftUS — State Plane). Only a WGS84 centroid is returned (`returnCentroid=true&outSR=4326`); the boundary polygon is never emitted in EPSG:4326 or GeoJSON.
- **Possible new tool?:** **Y**

## Methodology
Read the prior parcel-resolution audit (Q1 = HaysCAD eSearch address→parcel returning `propertyId` Quick Ref ID `R#####`; Q3 = `hays_parcel_lookup` on `Hays_County_Parcels/FeatureServer/0` at `outSR=2278`). Unincorporated Hays shares the same CAD/GIS backbone as Dripping Springs. Located the Hays County parcel ArcGIS FeatureServer, fetched layer-0 metadata, and ran a live `outSR=4326&f=geojson` query.

## Findings
Same Hays County parcel FeatureServer as Dripping Springs (shared CAD):
`https://gis.urbaneng.com/arcgis/rest/services/HaysCountyParcels/FeatureServer/0` (Hays CAD / Urban Engineering; equivalent to the surveyor's `Hays_County_Parcels/FeatureServer/0`).

- Layer name: **Hays County** (parcel polygons).
- Parcel-ID field: **`PROP_ID`**, in the **`R#####` Quick Ref ID** format (e.g. `R10884`) — the exact key `hayscad_search` already returns as `propertyId` (e.g. `R184168`). Direct `where=PROP_ID='<id>'` match.
- Native SR: `wkid 102740 / latestWkid 2278` (Texas Central, ftUS).
- `capabilities`: `Query`; `supportedQueryFormats`: **`JSON, AMF, geoJSON`** — GeoJSON supported.
- **Live-verified**: a query with `outSR=4326&f=geojson` returned a `FeatureCollection` Polygon in lon/lat (first vertex `[-97.99631, 29.75530]`, Hays County). The foot-denominated 2278 FeatureServer reprojects to WGS84 server-side; no client-side reprojection needed.

The gap is only the hardcoded `outSR=2278`; swapping to `outSR=4326` (optionally `f=geojson`) on the same layer returns the WGS84 boundary.

### Sample request
`GET https://gis.urbaneng.com/arcgis/rest/services/HaysCountyParcels/FeatureServer/0/query?where=PROP_ID='R184168'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "PROP_ID": "R184168", "RefName": "R184168" },
  "geometry": { "type": "Polygon", "coordinates": [[[ -97.99631, 29.75530 ], [ -97.996, 29.755 ], "..." ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://gis.urbaneng.com/arcgis/rest/services/HaysCountyParcels/FeatureServer/0/query" \
  --data-urlencode "where=PROP_ID='R184168'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, live-verified.** The Hays County parcel FeatureServer (2278-native, ftUS) reprojects to WGS84 GeoJSON under `outSR=4326&f=geojson`, and its `PROP_ID` is the same `R#####` Quick Ref ID the surveyor already carries from `hayscad_search`. The existing State-Plane `hays_parcel_lookup` becomes a WGS84-polygon tool with a one-line `outSR` change. Same caveat as Dripping Springs: verified against the `gis.urbaneng.com` Hays parcel service (a 2020 CAD snapshot); a live Hays hosted FeatureServer of the same ArcGIS class would reproject identically.
