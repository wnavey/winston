# Atlanta, GA — Parcel Resolution Audit

- **Slug:** `atlanta-ga`
- **County:** Fulton/DeKalb · **State:** GA
- **Parcel sources reviewed:** `fulton-county-gis` (`src/sources/fulton-county-gis/{search,details,property-profile,config}.ts`), `dekalb-county-gis` (`src/sources/dekalb-county-gis/{search,details,config}.ts`), `atlanta-gis` (`src/sources/atlanta-gis/{property-profile,config}.ts` — city overlay, no parcel tools)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `fulton_assessor_search` / `dekalb_assessor_search` | `src/sources/fulton-county-gis` / `src/sources/dekalb-county-gis` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `fulton_parcel_details` / `dekalb_parcel_details` | `src/sources/fulton-county-gis` / `src/sources/dekalb-county-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `fulton_assessor_search` — source `fulton-county-gis`, module `src/sources/fulton-county-gis/search.ts` (DeKalb-side addresses: `dekalb_assessor_search`, `src/sources/dekalb-county-gis/search.ts`).
- **Upstream request:** `POST https://gismaps.fultoncountyga.gov/arcgispub2/rest/services/PropertyMapViewer/PropertyMapViewer/MapServer/11/query` (DeKalb: `POST https://dcgis.dekalbcountyga.gov/hosted/rest/services/PropertyAppraisal/Parcels_IASWorld/MapServer/0/query`)
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "street address, parcel ID, or owner name" },
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
        { "ParcelID": "14 008500030279", "Address": "375 WHITEHALL ST", "Owner": "…", "LUCode": "…", "LandAcres": 0.5, "TotAppr": 1000000 }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://gismaps.fultoncountyga.gov/arcgispub2/rest/services/PropertyMapViewer/PropertyMapViewer/MapServer/11/query' \
    --data-urlencode "f=json" \
    --data-urlencode "where=UPPER(Address) LIKE '%ADDRESS%'" \
    --data-urlencode "outFields=ParcelID,Address,Owner,LUCode,ClassCode,LandAcres,TotAppr,TotAssess" \
    --data-urlencode "returnGeometry=false" \
    --data-urlencode "orderByFields=Address" \
    --data-urlencode "resultRecordCount=25"
  ```
- **How the parcel ID is obtained / caveats:** The handler builds a SQL `WHERE UPPER(Address) LIKE '%<addr>%'` against the PropertyMapViewer Tax Parcel layer (layer 11) and maps each feature's `attributes` — the `ParcelID` field is the Fulton Board-of-Assessors parcel ID (embedded space preserved). DeKalb is identical against Parcels_IASWorld layer 0, `WHERE UPPER(SITEADDRESS) LIKE …`, field `PARCELID`. Atlanta straddles both counties; try Fulton first, then DeKalb.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `fulton_parcel_details` — source `fulton-county-gis`, module `src/sources/fulton-county-gis/details.ts` (DeKalb: `dekalb_parcel_details`, `src/sources/dekalb-county-gis/details.ts`).
- **Upstream request:** Fulton makes two calls to `.../MapServer/11/query` — one `returnGeometry=true&outSR=2240` (native attributes + State Plane rings) and a second `returnGeometry=true&outSR=4326` (WGS84 rings → GeoJSON Feature). DeKalb makes one call to `.../MapServer/0/query` with `outSR=4326` (the DeKalb service is natively WGS84).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "parcelId": { "type": "string", "description": "e.g. \"14 008500030279\"" } },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON (Fulton, trimmed):**
  ```json
  {
    "success": true,
    "data": {
      "parcelId": "14 008500030279",
      "attributes": { "ParcelID": "14 008500030279", "Owner": "…", "LandAcres": 0.5 },
      "geometry": {
        "native": { "rings": [[[2226000, 1360000], "…"]], "spatialReference": 2240 },
        "centroid": { "x": 2226050, "y": 1360050 },
        "geojson": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-84.4003, 33.7459], "…"]] }, "properties": { "parcelId": "14 008500030279" } }
      }
    }
  }
  ```
- **Sample curl (WGS84 GeoJSON leg, against the upstream):**
  ```bash
  curl "https://gismaps.fultoncountyga.gov/arcgispub2/rest/services/PropertyMapViewer/PropertyMapViewer/MapServer/11/query?f=json&where=ParcelID%20%3D%20'PARCEL_ID'&outFields=ParcelID&returnGeometry=true&outSR=4326"
  ```
- **How the geometry is obtained / caveats:** Fulton's native rings are SR 2240 (State Plane West, feet); the tool separately re-queries with `outSR=4326` and runs `buildParcelGeoJSON` (ring winding fixed via `isClockwise`) to emit a WGS84 GeoJSON `Feature` under `geometry.geojson`. DeKalb returns WGS84 rings + GeoJSON directly (`SPATIAL_REFERENCE = 4326`) plus a lon/lat `centroid`. Both satisfy Q3 as true WGS84 GeoJSON.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** N. No tool accepts a coordinate and returns a parcel ID. `fulton_assessor_search` / `dekalb_assessor_search` accept only address/parcel/owner (no coordinate). `atlanta_property_profile` accepts lon/lat but queries only City-of-Atlanta overlay layers (zoning, historic, NPU, FLU, etc.) and returns overlay attributes, not a parcel record — its Future-Land-Use layer's `PIN` field is incidental overlay data, not a resolved assessor parcel ID. `fulton_property_profile` accepts x/y in SR 2240 (not lat/lon) and queries overlay layers only (the Tax Parcel layer 11 is not among them), so a point query yields no ParcelID. There is no `parcel_at_point` capability for this jurisdiction.
