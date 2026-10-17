# Phoenix, AZ — Parcel Resolution Audit

- **Slug:** `phoenix-az`
- **County:** Maricopa · **State:** AZ
- **Parcel sources reviewed:** `mcassessor` (`src/sources/mcassessor/search.ts`, `details.ts`, `config.ts`); `phoenix-gis` (`src/sources/phoenix-gis/zoning-lookup.ts`, `property-profile.ts`, `parcel.ts`, `config.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `mcassessor_search` | `src/sources/mcassessor` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `mcassessor_details` | `src/sources/mcassessor` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `mcassessor_search` (with `searchType: "address"`) — source `mcassessor`, module `src/sources/mcassessor/search.ts`
- **Upstream request:** `POST https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0/query` (form-encoded body: `f=json`, `where=<component clause>`, `outFields=<SEARCH_FIELDS>`, `returnGeometry=false`, `resultRecordCount=25`)
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Street address, APN dashed/undashed, or owner name" },
      "searchType": { "type": "string", "enum": ["address", "apn", "owner"] }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON (shape the handler returns):**
  ```json
  {
    "success": true,
    "data": {
      "searchType": "address",
      "where": "PHYSICAL_STREET_NUM = '802' AND UPPER(PHYSICAL_STREET_NAME) = '1ST' AND UPPER(PHYSICAL_STREET_DIR) = 'N' AND UPPER(PHYSICAL_STREET_TYPE) = 'AVE'",
      "parsedAddress": { "num": "802", "dir": "N", "name": "1ST", "type": "AVE" },
      "matchPrecision": "exact-components",
      "resultCount": 1,
      "ambiguous": false,
      "results": [
        { "APN": "11140127", "APN_DASH": "111-40-127", "OWNER_NAME": "…", "PHYSICAL_ADDRESS": "802 N 1ST AVE", "LATITUDE": 33.45, "LONGITUDE": -112.08 }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0/query' \
    --data-urlencode 'f=json' \
    --data-urlencode "where=PHYSICAL_STREET_NUM = 'NUM' AND UPPER(PHYSICAL_STREET_NAME) = 'NAME'" \
    --data-urlencode 'outFields=*' \
    --data-urlencode 'returnGeometry=false' \
    --data-urlencode 'resultRecordCount=25'
  ```
- **How the parcel ID is obtained / caveats:** The handler parses the free-text address into components (`PHYSICAL_STREET_NUM/_DIR/_NAME/_TYPE/_CITY/_ZIP`) and builds an equality-constrained WHERE, with a relaxation ladder used only when a stricter rung returns zero rows. Each result carries `APN` (8-digit) and `APN_DASH`. It sets `ambiguous:true` + `warnings` when >1 distinct address matches — read those before taking a row. Owner and APN searches are also supported via the same tool.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `mcassessor_details` — source `mcassessor`, module `src/sources/mcassessor/details.ts`
- **Upstream request:** `POST https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0/query` (body: `f=json`, `where=APN = 'APN' OR APN_DASH = 'APN'`, `outFields=*`, `returnGeometry=true`, `outSR=4326`)
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "apn": { "type": "string", "description": "Maricopa County APN, dashed or undashed" }
    },
    "required": ["apn"]
  }
  ```
- **Sample response JSON (shape the handler returns):**
  ```json
  {
    "success": true,
    "data": {
      "apn": "11140127",
      "attributes": { "APN": "11140127", "OWNER_NAME": "…", "MCR_BOOK": "1670", "DEED_NUMBER": "20220420392" },
      "geometry": {
        "rings": [[[-112.081, 33.451], [-112.080, 33.451], [-112.080, 33.452], [-112.081, 33.451]]],
        "spatialReference": 4326,
        "centroid": { "lat": 33.4515, "lon": -112.0805 }
      },
      "centroid": { "lat": 33.4515, "lon": -112.0805 }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0/query' \
    --data-urlencode 'f=json' \
    --data-urlencode "where=APN = 'PARCEL_ID' OR APN_DASH = 'PARCEL_ID'" \
    --data-urlencode 'outFields=*' \
    --data-urlencode 'returnGeometry=true' \
    --data-urlencode 'outSR=4326'
  ```
- **How the geometry is obtained / caveats:** The handler explicitly requests geometry with `outSR: '4326'` (WGS84) and returns `geometry.rings` alongside `spatialReference: 4326` and a computed WGS84 `centroid`. This is true WGS84 ArcGIS ring output (not GeoJSON, but the ring array + `spatialReference:4326`). Note: `phoenix-gis`'s own `resolveParcelGeometry` (`parcel.ts`) also fetches the Assessor parcel polygon but projects it into Phoenix's native SR 2868 (US survey feet) for internal area-share math and does not return WGS84 rings — the WGS84 boundary comes from `mcassessor_details`.

## Not supported
- **Q2 (Lat/Lon → Parcel ID): N.** No tool accepts a coordinate and returns a parcel/APN. `mcassessor_search` accepts only `searchType` of `address` / `apn` / `owner` (no coordinate path). The `phoenix_zoning_lookup` and `phoenix_property_profile` tools *do* accept `lat`/`lon`, but that "centroid mode" runs a point-in-polygon query against the City zoning/overlay/GIS layers and returns those districts/features — it does not resolve or return the underlying parcel's APN. So there is no lat/lon → parcel-ID capability for this jurisdiction.
