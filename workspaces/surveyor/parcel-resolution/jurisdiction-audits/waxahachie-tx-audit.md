# Waxahachie, TX — Parcel Resolution Audit

- **Slug:** `waxahachie-tx`
- **County:** Ellis · **State:** TX
- **Parcel sources reviewed:** `ecad` (`src/sources/ecad/{search,details,geometry,client}.ts`) + shared `src/lib/trueprodigy-client.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `ecad_search` | `src/sources/ecad` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `ecad_parcel_geometry` | `src/sources/ecad` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `ecad_search` — source `ecad`, module `src/sources/ecad/search.ts` (transport in `src/lib/trueprodigy-client.ts`)
- **Upstream request:** `POST https://prod-container.trueprodigyapi.com/public/property/searchfulltext?page=1&pageSize=20` (address/owner full-text "match"); parcelId searches use `POST /public/property/search`. Auth token fetched first; full Chrome User-Agent header is mandatory (WAF gates on UA).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "parcelId", "owner"] }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": { "resultCount": 1, "results": [
    { "geoID": "90.9191.901.001.00.112", "pAccountID": 1770969, "pID": 138051, "propType": "R", "owner": "...", "marketValue": 123456 }
  ] } }
  ```
- **Sample curl (upstream):**
  ```bash
  curl -X POST 'https://prod-container.trueprodigyapi.com/public/property/searchfulltext?page=1&pageSize=20' \
    -H 'Authorization: <token>' -H 'Origin: https://www.elliscad.com' \
    -H 'User-Agent: Mozilla/5.0 ... Chrome/120.0.0.0 Safari/537.36' \
    -H 'Content-Type: application/json' --data '{"match":"1316 HIGHWAY 77","year":"2026"}'
  ```
- **How the parcel ID is obtained / caveats:** Every result carries three IDs: `geoID` (human parcel number), `pAccountID` (→ `ecad_details`), and `pID` (→ `ecad_parcel_geometry`). Filter `propType: "R"` for real property.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `ecad_parcel_geometry` — source `ecad`, module `src/sources/ecad/geometry.ts` (via `fetchParcelShapes` in `src/lib/trueprodigy-client.ts`)
- **Upstream request:** `POST https://prod-container.trueprodigyapi.com/gama/parcelshapes` with JSON body `{ "pIDList": ["138051"] }` → GAMA service returns GeoJSON polygon features already in **WGS84 (EPSG:4326, lon/lat)**.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "pid": { "type": "string" },
      "pids": { "type": "array", "items": { "type": "string" } }
    }
  }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": { "resultCount": 1, "parcels": [
    { "pid": 138051,
      "geometry": { "type": "Polygon", "coordinates": [[[-96.84,32.39],...]] },
      "centroidWgs84": { "latitude": 32.39, "longitude": -96.84 } }
  ] } }
  ```
- **Sample curl (upstream):**
  ```bash
  curl -X POST 'https://prod-container.trueprodigyapi.com/gama/parcelshapes' \
    -H 'Authorization: <token>' -H 'Content-Type: application/json' \
    -H 'Origin: https://www.elliscad.com' -H 'User-Agent: Mozilla/5.0 ... Chrome/120.0.0.0 Safari/537.36' \
    --data '{"pIDList":["138051"]}'
  ```
- **How the geometry is obtained / caveats:** Keyed by `pID` (the displayed account, not `pAccountID`). The GAMA response envelope is unwrapped (`results[].row_to_json.features[]`) into GeoJSON `(Multi)Polygon` features whose coordinates are lon/lat WGS84 — feeds FEMA/TxDOT directly with no reprojection. This is a genuine WGS84 GeoJSON boundary → **Y**.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate input anywhere. `ecad_search` takes address/parcelId/owner; `ecad_details` takes `pAccountID`; `ecad_parcel_geometry` takes `pID`. The county ArcGIS server (`ecgis.co.ellis.tx.us`) that could do point-in-polygon is firewalled and unwrapped by any tool.
