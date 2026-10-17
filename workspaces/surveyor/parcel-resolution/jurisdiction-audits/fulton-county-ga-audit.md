# Fulton County, GA — Parcel Resolution Audit

- **Slug:** `fulton-county-ga`
- **County:** Fulton · **State:** GA
- **Parcel sources reviewed:** `fulton-county-gis` (`src/sources/fulton-county-gis/{search,details,property-profile,config}.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `fulton_assessor_search` | `src/sources/fulton-county-gis` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `fulton_parcel_details` | `src/sources/fulton-county-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `fulton_assessor_search` — source `fulton-county-gis`, module `src/sources/fulton-county-gis/search.ts`
- **Upstream request:** `POST https://gismaps.fultoncountyga.gov/arcgispub2/rest/services/PropertyMapViewer/PropertyMapViewer/MapServer/11/query`
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
        { "ParcelID": "14F0133  LL0360", "Address": "6047 FULTON INDUSTRIAL", "Owner": "ES 6047 6049 FULTON INDUSTRIAL LLC", "LUCode": "I4", "LandAcres": 9.47, "TotAppr": 10050000 }
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
- **How the parcel ID is obtained / caveats:** Handler builds `WHERE UPPER(Address) LIKE '%<addr>%'` against the PropertyMapViewer Tax Parcel layer (layer 11) and returns each feature's `attributes`; the `ParcelID` field is the Board-of-Assessors parcel ID. FIBD / unincorporated parcels carry an embedded double space (`14F0133  LL0360`) which is preserved verbatim. `searchType: "parcel"` and `"owner"` are also supported; none accept a coordinate.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `fulton_parcel_details` — source `fulton-county-gis`, module `src/sources/fulton-county-gis/details.ts`
- **Upstream request:** two calls to `.../MapServer/11/query` — first `returnGeometry=true&outSR=2240` (attributes + native State Plane rings), then `returnGeometry=true&outSR=4326` (WGS84 rings → GeoJSON Feature).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "parcelId": { "type": "string", "description": "e.g. \"14 008500030279\"" } },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON (trimmed):**
  ```json
  {
    "success": true,
    "data": {
      "parcelId": "14F0133  LL0360",
      "attributes": { "ParcelID": "14F0133  LL0360", "Owner": "…", "LandAcres": 9.47 },
      "geometry": {
        "native": { "rings": [[[2180000, 1350000], "…"]], "spatialReference": 2240 },
        "centroid": { "x": 2180050, "y": 1350050 },
        "geojson": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-84.586566, 33.72151], "…"]] }, "properties": { "parcelId": "14F0133  LL0360" } }
      }
    }
  }
  ```
- **Sample curl (WGS84 GeoJSON leg, against the upstream):**
  ```bash
  curl "https://gismaps.fultoncountyga.gov/arcgispub2/rest/services/PropertyMapViewer/PropertyMapViewer/MapServer/11/query?f=json&where=ParcelID%20%3D%20'PARCEL_ID'&outFields=ParcelID&returnGeometry=true&outSR=4326"
  ```
- **How the geometry is obtained / caveats:** Native rings are SR 2240 (State Plane West, feet) and the returned `centroid` is in feet; the tool re-queries with `outSR=4326` and runs `buildParcelGeoJSON` to emit a WGS84 GeoJSON `Feature` under `geometry.geojson`. The WGS84 leg is wrapped in a try/catch and is best-effort (`geojson: null` if it fails), but on the normal path Q3 is fully satisfied as WGS84 GeoJSON. Derive lon/lat by averaging the GeoJSON ring for the downstream statewide/national tools.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** N. No tool accepts a coordinate and returns a parcel ID. `fulton_assessor_search` accepts only address/parcel/owner. `fulton_property_profile` accepts `x`/`y` but in **SR 2240 feet** (not lat/lon) and queries only overlay layers (zoning, FLU, TAD, CID, subdivisions, land lots — the Tax Parcel layer 11 is not in `OVERLAY_LAYERS`), so a point call returns overlay attributes, never a ParcelID. There is no `parcel_at_point` capability.
