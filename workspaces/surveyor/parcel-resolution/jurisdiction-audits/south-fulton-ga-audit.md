# South Fulton, GA — Parcel Resolution Audit

- **Slug:** `south-fulton-ga`
- **County:** Fulton · **State:** GA
- **Parcel sources reviewed:** `fulton-county-gis` (`src/sources/fulton-county-gis/{search,details,property-profile,config}.ts`), `south-fulton-gis` (`src/sources/south-fulton-gis/{property-profile,config}.ts` — city overlay, no parcel tools)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `fulton_assessor_search` | `src/sources/fulton-county-gis` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `fulton_parcel_details` | `src/sources/fulton-county-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `fulton_assessor_search` — source `fulton-county-gis`, module `src/sources/fulton-county-gis/search.ts` (South Fulton parcel/owner data comes from Fulton County; the city source has no parcel tool).
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
        { "ParcelID": "14F0118  LL0146", "Address": "…", "Owner": "…", "LUCode": "…", "LandAcres": 1.0, "TotAppr": 500000 }
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
- **How the parcel ID is obtained / caveats:** Handler builds `WHERE UPPER(Address) LIKE '%<addr>%'` against the Fulton PropertyMapViewer Tax Parcel layer (layer 11); `ParcelID` is the Board-of-Assessors parcel ID (South Fulton parcels carry an embedded double space, e.g. `14F0118  LL0146`). The City-of-South-Fulton source (`south-fulton-gis`) exposes only `south_fulton_property_profile` (overlay/zoning) — it has no address search.

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
      "parcelId": "14F0118  LL0146",
      "attributes": { "ParcelID": "14F0118  LL0146", "Owner": "…" },
      "geometry": {
        "native": { "rings": [[[2180000, 1330000], "…"]], "spatialReference": 2240 },
        "centroid": { "x": 2180050, "y": 1330050 },
        "geojson": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-84.574886, 33.699048], "…"]] }, "properties": { "parcelId": "14F0118  LL0146" } }
      }
    }
  }
  ```
- **Sample curl (WGS84 GeoJSON leg, against the upstream):**
  ```bash
  curl "https://gismaps.fultoncountyga.gov/arcgispub2/rest/services/PropertyMapViewer/PropertyMapViewer/MapServer/11/query?f=json&where=ParcelID%20%3D%20'PARCEL_ID'&outFields=ParcelID&returnGeometry=true&outSR=4326"
  ```
- **How the geometry is obtained / caveats:** Identical to Fulton County — native rings/centroid are SR 2240 (feet); a second `outSR=4326` query builds a WGS84 GeoJSON `Feature` under `geometry.geojson` (best-effort, try/catch). Satisfies Q3 as WGS84 GeoJSON. Average the GeoJSON ring to get the lon/lat centroid to feed `south_fulton_property_profile` and the statewide/national tools.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** N. No tool accepts a coordinate and returns a parcel ID. `fulton_assessor_search` accepts only address/parcel/owner. `south_fulton_property_profile` accepts lon/lat but queries only City-of-South-Fulton overlay layers (zoning `ZClass`, overlay district, 2045 FLUM, council district, city-limits) and returns overlay attributes — its FLU-2045 layer carries a `ParcelID` outField, but that is incidental overlay attribute data (the city's parcel-level FLU cut), not a queried assessor parcel record, so it is not a reliable lat/lon→parcel resolution. `fulton_property_profile` takes x/y in SR 2240 (not lat/lon) and never returns a ParcelID. No `parcel_at_point` capability.
