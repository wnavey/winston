# Gwinnett County, GA — Parcel Resolution Audit

- **Slug:** `gwinnett-county-ga`
- **County:** Gwinnett · **State:** GA
- **Parcel sources reviewed:** `gwinnett-county-gis` (`src/sources/gwinnett-county-gis/{search,details,property-profile,config}.ts`); `gwinnett-permits` reviewed (`src/sources/gwinnett-permits/{search,detail}.ts` — Accela permit records, no parcel-geometry / parcel-ID resolution tool)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `gwinnett_assessor_search` | `src/sources/gwinnett-county-gis` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `gwinnett_parcel_details` | `src/sources/gwinnett-county-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `gwinnett_assessor_search` — source `gwinnett-county-gis`, module `src/sources/gwinnett-county-gis/search.ts`
- **Upstream request:** `POST https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer/3/query` (Tax Master table, layer/table id 3)
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "street address, parcel ID / PIN, or owner name" },
      "searchType": { "type": "string", "enum": ["address", "parcel", "owner"] }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "resultCount": 1,
      "results": [
        { "LRSN": 1300886, "PIN": "7076 015", "RPIN": "R7076 015", "LOCADDR": "2625 BRECKINRIDGE", "OWNER1": "VIASAT INC", "ZONING": "M2", "ZONEDESC": "M2-Heavy Industry", "PROPCLAS": "320", "TOTVAL1": 971400 }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer/3/query' \
    --data-urlencode "f=json" \
    --data-urlencode "where=UPPER(LOCADDR) LIKE '%ADDRESS%'" \
    --data-urlencode "outFields=LRSN,PIN,RPIN,LOCADDR,OWNER1,ZONING,ZONEDESC,PROPCLAS,PCDESC,TOTVAL1,LEGALAC" \
    --data-urlencode "returnGeometry=false" \
    --data-urlencode "orderByFields=LOCADDR" \
    --data-urlencode "resultRecordCount=25"
  ```
- **How the parcel ID is obtained / caveats:** Handler builds `WHERE UPPER(LOCADDR) LIKE '%<addr>%'` against the Property_and_Tax FeatureServer **Tax Master table** (id 3 — the CAMA entry point holding the full situs `LOCADDR`; the Parcels layer's `ADDRESS` is a street number only). Each result carries both join keys — `PIN` (parcel ID, embedded space, e.g. `7076 015`) and `LRSN` (numeric serial). `searchType: "parcel"` matches on `PIN`; none accept a coordinate.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `gwinnett_parcel_details` — source `gwinnett-county-gis`, module `src/sources/gwinnett-county-gis/details.ts`
- **Upstream request:** Tax Master `.../FeatureServer/3/query` (PIN → LRSN) → LRSN joins to `/4`, `/8`, `/10` → geometry from Parcels layer `.../FeatureServer/0/query` issued twice: `returnGeometry=true&outSR=2240` (native rings + centroid) and `returnGeometry=true&outSR=4326` (WGS84 rings → GeoJSON + lon/lat centroid).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "parcelId": { "type": "string", "description": "PIN, e.g. \"7076 015\" (embedded space, verbatim)" } },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON (trimmed):**
  ```json
  {
    "success": true,
    "data": {
      "parcelId": "7076 015",
      "lrsn": 1300886,
      "taxMaster": { "PIN": "7076 015", "OWNER1": "VIASAT INC", "ZONING": "M2" },
      "landValue": { "WATER": "Y", "SEWER": "Y" },
      "geometry": {
        "native": { "rings": [[[2380000, 1500000], "…"]], "spatialReference": 2240 },
        "centroid": { "x": 2380050, "y": 1500050 },
        "wgs84Centroid": { "lon": -84.13, "lat": 33.98 },
        "geojson": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-84.13, 33.98], "…"]] }, "properties": { "parcelId": "7076 015" } }
      }
    }
  }
  ```
- **Sample curl (WGS84 GeoJSON leg, against the upstream):**
  ```bash
  curl "https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer/0/query?f=json&where=PIN%20%3D%20'PIN'&outFields=PIN&returnGeometry=true&outSR=4326"
  ```
- **How the geometry is obtained / caveats:** After resolving PIN→LRSN via Tax Master and joining the split CAMA tables, the Parcels layer (id 0) is queried once natively (SR 2240) and once with `outSR=4326`; `buildParcelGeoJSON` emits a WGS84 GeoJSON `Feature` under `geometry.geojson` and a `wgs84Centroid` (lon/lat) directly. WGS84 leg is best-effort (try/catch) but on the normal path Q3 is fully satisfied as WGS84 GeoJSON.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** N. No tool accepts a coordinate and returns a parcel ID. `gwinnett_assessor_search` accepts only address/parcel/owner. `gwinnett_property_profile` accepts `parcelId` OR `x`/`y` in **SR 2240 feet** (not lat/lon); a point call intersects only overlay layers (`OVERLAY_LAYERS` — zoning, TADs, CID, OZ, river corridor, subdivisions, land lots — the Parcels layer 0 is not among them), so it returns overlay attributes, never a PIN. `gwinnett_permit_search` keys on record number / address / parcel number / project name (browser-driven Accela), not a coordinate. No `parcel_at_point` capability.
