# San Diego, CA — Parcel Resolution Audit

- **Slug:** `san-diego-ca`
- **County:** San Diego · **State:** CA
- **Parcel sources reviewed:** `sandag-parcels` (`src/sources/sandag-parcels/search.ts`, `details.ts`, `config.ts`), `sandiego-gis` (`src/sources/sandiego-gis/property-profile.ts`, `config.ts`), `sdcounty-arcc` (`src/sources/sdcounty-arcc/assessor-context.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `parcel_search` | `src/sources/sandag-parcels` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `parcel_details` | `src/sources/sandag-parcels` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `parcel_search` — source `sandag-parcels`, module `src/sources/sandag-parcels/search.ts`
- **Upstream request:** `POST https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0/query` with form body `f=json&where=UPPER(situs_street) LIKE 'STREET%' AND situs_address = HOUSE_NUM&outFields=apn,situs_address,...&returnGeometry=false&resultRecordCount=50`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Street address (e.g. \"1011 Union St\") or APN. Suffixes like ST/AVE are stripped automatically." },
      "searchType": { "type": "string", "enum": ["address", "apn"], "description": "Type of search: address or apn" }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "where": "UPPER(situs_street) LIKE 'UNION%' AND situs_address = 1011",
      "resultCount": 3,
      "results": [
        { "apn": "5335170211", "situs_address": 1011, "situs_street": "UNION", "situs_suffix": "ST",
          "asr_total": 201517309, "asr_zone": "CCPD-PC", "unitqty": 349, "subname": "PARCEL MAP NO 21781" }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -X POST 'https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0/query' \
    --data-urlencode "where=UPPER(situs_street) LIKE 'STREET%' AND situs_address = HOUSE_NUM" \
    --data-urlencode 'outFields=apn,situs_address,situs_street,asr_total' \
    --data 'f=json&returnGeometry=false&resultRecordCount=50'
  ```
- **How the parcel ID is obtained / caveats:** The handler parses the leading house number and street name from the query (stripping the street-type suffix), builds a SanGIS `situs_street LIKE` + `situs_address =` WHERE clause, and returns each feature's `attributes` — every row carries the 10-digit `apn`. Addresses are frequently "stacked" (many condo APNs at one situs); the caller picks the principal (largest `unitqty`/`asr_total`).

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `parcel_details` — source `sandag-parcels`, module `src/sources/sandag-parcels/details.ts`
- **Upstream request:** two `POST …/Hosted/Parcels/FeatureServer/0/query` calls — one at `outSR=2230` (native attributes + rings), one at `outSR=4326` (`outFields=apn&returnGeometry=true`) to build the WGS84 GeoJSON polygon.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "apn": { "type": "string", "description": "Assessor Parcel Number, digits only or dashed (e.g. \"5335170211\")" } },
    "required": ["apn"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "apn": "5335170211",
      "attributes": { "apn": "5335170211", "situs_address": 1011, "asr_total": 201517309 },
      "recorderDocument": { "doctype": "GRANT DEED", "docnmbr": "2020-0551922", "docdate": "..." },
      "geometry": {
        "rings": [[[6300000.1, 1840000.2], "..."]],
        "spatialReference": 2230,
        "centroid": { "x": 6300123.4, "y": 1840456.7 },
        "geojson": {
          "type": "Feature",
          "geometry": { "type": "Polygon", "coordinates": [[[-117.163, 32.712], "..."]] },
          "properties": { "apn": "5335170211" }
        }
      }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -X POST 'https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0/query' \
    --data-urlencode "where=apn = 'PARCEL_ID'" \
    --data 'f=json&outFields=apn&returnGeometry=true&outSR=4326'
  ```
- **How the parcel ID is obtained / caveats:** The handler queries by `apn` and issues a second `outSR=4326` request; the WGS84 rings are wrapped into a proper GeoJSON `Feature`/`Polygon` (`geometry.geojson`). Native geometry/centroid stays in SR 2230 (CA State Plane Zone VI feet), but the caller-facing `geojson` field is confirmed WGS84 (EPSG:4326). The WGS84 GeoJSON step is wrapped in try/catch and treated as optional, but succeeds in normal operation.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate and returns an APN. `parcel_search` takes address or APN only; `parcel_details` takes APN only. The GIS point tools that do accept coordinates — `sd_property_profile` / `sd_zoning_lookup` (accept `x`/`y` in SR 2230) and `county_assessor_context` (accepts `x`/`y`) — query overlay/zoning/administrative-geography layers and return zoning, environmental, and TRA/appraiser-area data, NOT a parcel/APN identifier. The SANDAG parcel layer is only ever queried by `apn` (or by address WHERE clause), never as a point-in-polygon that returns the APN. Note the GIS coordinate inputs are SR 2230, not WGS84 lat/lon, further confirming there is no lat/lon→parcel path.
