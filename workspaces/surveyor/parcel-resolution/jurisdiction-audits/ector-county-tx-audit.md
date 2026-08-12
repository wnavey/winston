# Ector County, TX — Parcel Resolution Audit

- **Slug:** `ector-county-tx`
- **County:** Ector · **State:** TX
- **Parcel sources reviewed:** `ectorcad` (`src/sources/ectorcad/{index,search,details,client}.ts`), `ector-gis` (`src/sources/ector-gis/{index,parcel-lookup,client}.ts`), `ector-county-clerk` (`src/sources/ector-county-clerk/index.ts`, records-index only — no parcel resolution)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `ectorcad_search` | `src/sources/ectorcad` |
| 2. Lat/Lon → Parcel ID | Y | `ector_parcel_at_point` | `src/sources/ector-gis` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `ector_parcel_lookup` | `src/sources/ector-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `ectorcad_search` — source `ectorcad`, module `src/sources/ectorcad/search.ts` (client `client.ts`)
- **Upstream request:** `GET https://search.ectorcad.org/search/r/{URL-encoded query}` — server-rendered GSA Corp. HTML results table. The handler scrapes each `<tr>` with a regex; the parcel link `/parcel/{strap}` yields the canonical dotted strap.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Free-text query: street address (e.g. \"10119 W UNIVERSITY BLVD ODESSA\"), owner name (e.g. \"HARRIS JAMES\"), or account number/strap."
      }
    },
    "required": ["query"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "query": "10119 W UNIVERSITY BLVD ODESSA",
    "count": 1,
    "results": [
      {
        "parcelId": "34900.02850.00000",
        "ownerName": "HARRIS JAMES",
        "siteAddress": "10119 W UNIVERSITY BLVD",
        "netAssessedValue": "$123,456"
      }
    ]
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://search.ectorcad.org/search/r/10119%20W%20UNIVERSITY%20BLVD%20ODESSA' \
    -H 'User-Agent: Mozilla/5.0' -H 'Referer: https://search.ectorcad.org/'
  ```
- **How the parcel ID is obtained / caveats:** The handler regex-parses the HTML results table; `parcelId` (`m[1]`) comes from the `<a href="/parcel/([0-9.]+)">` link — the dotted strap. Free-text query accepts address, owner, OR account, so address→parcel is supported. HTML scrape (no JSON API), so it is brittle to portal markup changes.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `ector_parcel_at_point` — source `ector-gis`, module `src/sources/ector-gis/parcel-lookup.ts` (client `client.ts`)
- **Upstream request:** `GET https://gis11.cama.io/arcgis/rest/services/Ector/EctorCounty_Thematic/MapServer/10/query` with an `esriGeometryPoint` at `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, `outFields=*`, `returnGeometry=false`, `f=json` (via `queryLayerAtPoint(PARCEL_LAYER, lon, lat)`).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "latitude": { "type": "number", "description": "Latitude (WGS84)" },
      "longitude": { "type": "number", "description": "Longitude (WGS84, negative for Texas)" }
    },
    "required": ["latitude", "longitude"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "found": true,
    "latitude": 31.85419,
    "longitude": -102.44662,
    "parcelId": "34900.02850.00000",
    "pin": "34900-02202-01001",
    "ownerName": "HARRIS JAMES",
    "useDescription": "Vacant Lots & Tracts",
    "landArea": 0.25,
    "neighborhood": "WESTGATE SUB"
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -G 'https://gis11.cama.io/arcgis/rest/services/Ector/EctorCounty_Thematic/MapServer/10/query' \
    --data-urlencode 'geometry=LON,LAT' \
    --data-urlencode 'geometryType=esriGeometryPoint' \
    --data-urlencode 'inSR=4326' \
    --data-urlencode 'spatialRel=esriSpatialRelIntersects' \
    --data-urlencode 'outFields=*' \
    --data-urlencode 'returnGeometry=false' \
    --data-urlencode 'f=json'
  ```
- **How the parcel ID is obtained / caveats:** Point-in-polygon intersect against the "Property ID" CAMA layer (10); the first feature's `attributes.strap` is returned as `parcelId`. Coordinate is passed as WGS84 (`inSR=4326`) and the server reprojects from its native SP TX Central (2277).

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `ector_parcel_lookup` — source `ector-gis`, module `src/sources/ector-gis/parcel-lookup.ts` (client `client.ts` `queryParcelById`)
- **Upstream request:** `GET https://gis11.cama.io/arcgis/rest/services/Ector/EctorCounty_Thematic/MapServer/10/query?where=strap='{id}' OR dsp_strap='{id}' OR PIN='{id}' OR gis_parcel_id='{id}'&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=1&f=json`.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "parcelId": {
        "type": "string",
        "description": "Dotted strap (34900.02850.00000) or hyphenated PIN (34900-02202-01001)."
      }
    },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "found": true,
    "parcelId": "34900.02850.00000",
    "pin": "34900-02202-01001",
    "ownerName": "HARRIS JAMES",
    "useDescription": "Vacant Lots & Tracts",
    "landArea": 0.25,
    "centroid": { "longitude": -102.44662, "latitude": 31.85419 },
    "geometry": { "rings": [[[-102.4468, 31.8543], [-102.4464, 31.8543], [-102.4464, 31.8540], [-102.4468, 31.8540], [-102.4468, 31.8543]]] }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -G 'https://gis11.cama.io/arcgis/rest/services/Ector/EctorCounty_Thematic/MapServer/10/query' \
    --data-urlencode "where=strap='PARCEL_ID' OR dsp_strap='PARCEL_ID' OR PIN='PARCEL_ID' OR gis_parcel_id='PARCEL_ID'" \
    --data-urlencode 'outFields=*' \
    --data-urlencode 'returnGeometry=true' \
    --data-urlencode 'outSR=4326' \
    --data-urlencode 'resultRecordCount=1' \
    --data-urlencode 'f=json'
  ```
- **How the parcel ID is obtained / caveats:** `queryParcelById` hard-codes `outSR=4326`, so geometry rings come back in WGS84 `[lon,lat]`. Output is ArcGIS `{ rings }` (esriGeometryPolygon in EPSG:4326), NOT GeoJSON — a straightforward rings→GeoJSON Polygon transform. `ringCentroid` averages the first ring's vertices for the WGS84 centroid.

## Not supported
- None. All three capabilities are supported. (The `ector-county-clerk` source exposes only a recorded-document index/preview — `ector_clerk_search` / `ector_clerk_fetch_preview` — and performs no address/coordinate→parcel or parcel→geometry resolution.)
