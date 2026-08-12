# City of Maricopa, AZ — Parcel→Geopolygon Opportunity

- **Slug:** `maricopa-az`
- **County:** Pinal · **State:** AZ *(City of Maricopa is in PINAL County, not Maricopa County/Phoenix)*
- **Current gap:** `maricopa_city_parcel_lookup` queries the City's SmartGov-synced parcel layer with `returnGeometry=false` (returns only centroid lon/lat). The county `pinal-*` tools that fetch parcel rings request them in WGS84 for internal intersects only and never surface the boundary. No tool available to this jurisdiction emits the parcel polygon.
- **Possible new tool?:** **Y**

## Methodology
Read the prior audit (names two upstreams: the City SmartGov FeatureServer for Q1, and the Pinal County TaxParcels MapServer for Q2/point). Fetched metadata for both and ran live `outSR=4326&f=geojson` geometry queries against each to confirm WGS84 polygons.

## Findings
Two viable upstreams, both verified live to return WGS84 polygons:

**1. City of Maricopa SmartGov parcel layer (ArcGIS Online hosted):**
`https://services7.arcgis.com/MlfUGd2UJYefAS7v/arcgis/rest/services/County_Tax_Parcels_SmartGov/FeatureServer/0`
- geometryType `esriGeometryPolygon`; native NAD83 StatePlane AZ Central FIPS 0202 Int'l Feet; capabilities `Query`; supportedQueryFormats include **geoJSON**; `supportsReturningQueryGeometry:true`; maxRecordCount 2000.
- Parcel-ID field: `parcel_number` (≤30 chars); situs `site_address`.
- Live `outSR=4326&f=geojson` query returned a valid WGS84 `Polygon` (first vertex `[-111.9121, 32.9693]`). Being AGOL-hosted it reprojects freely.

**2. Pinal County TaxParcels (county ArcGIS Server) — same layer used for pinal-county-az:**
`https://gis.pinal.gov/mapping/rest/services/TaxParcels/MapServer/3` — field `PARCELID`; live `outSR=4326&f=geojson` returns WGS84 polygon (verified). Useful because the point→parcel tool (`assessor_parcel_search`) already returns `PARCELID` from this exact layer.

Either path is a direct **Y** with no client-side reprojection. Simplest is to reuse the SmartGov layer the city tool already calls, flipping `returnGeometry` to true.

### Sample request
`GET https://services7.arcgis.com/MlfUGd2UJYefAS7v/arcgis/rest/services/County_Tax_Parcels_SmartGov/FeatureServer/0/query?where=parcel_number='512049250'&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

### Sample response (placeholders)
```json
{ "type": "FeatureCollection", "features": [ { "type": "Feature",
  "properties": { "parcel_number": "512049250", "site_address": "...", "owner_name": "..." },
  "geometry": { "type": "Polygon", "coordinates": [[[ -111.9121, 32.9693 ], ["..."] ]] } } ] }
```

### Sample curl
```bash
curl -s -G "https://services7.arcgis.com/MlfUGd2UJYefAS7v/arcgis/rest/services/County_Tax_Parcels_SmartGov/FeatureServer/0/query" \
  --data-urlencode "where=parcel_number='512049250'" \
  --data-urlencode "outFields=*" --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" --data-urlencode "f=geojson"
```

## Verdict
**Y — high confidence, verified live.** Two independent upstreams (the City SmartGov FeatureServer and the Pinal County TaxParcels MapServer) both return a WGS84 GeoJSON polygon by parcel ID when queried with `returnGeometry=true&outSR=4326&f=geojson`. Both are already called by existing tools with the ID in hand; the boundary is one flag away. No reprojection caveat.
