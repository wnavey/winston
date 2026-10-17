# Lewisville, TX — Parcel Resolution Audit

- **Slug:** `lewisville-tx`
- **County:** Denton · **State:** TX
- **Parcel sources reviewed:** `denton-cad` (`src/sources/denton-cad/{search,details,config}.ts`), `lewisville-gis` (`src/sources/lewisville-gis/{parcel,zoning,config}.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `dentoncad_search` | `src/sources/denton-cad` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `dentoncad_details` | `src/sources/denton-cad` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `dentoncad_search` — source `denton-cad`, module `src/sources/denton-cad/search.ts` (also `lewisville_gis_parcel` by address)
- **Upstream request:** `GET https://geo.dentoncad.com/arcgis/rest/services/Parcels/MapServer/1/query?where=UPPER(situs_full_address) LIKE 'ADDRESS%' AND UPPER(situsCity)='LEWISVILLE'&outFields=pid,geoID,...&returnGeometry=false&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "owner", "account"] },
      "city": { "type": "string" },
      "limit": { "type": "number" }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": { "resultCount": 1, "results": [
    { "pid": 986704, "geoID": "SL9833A-000000A-0000-0001-0000", "name": "...", "situs_full_address": "100 E MAIN ST", "instrumentNum": "2020-110194" }
  ] } }
  ```
- **Sample curl (upstream):**
  ```bash
  curl "https://geo.dentoncad.com/arcgis/rest/services/Parcels/MapServer/1/query?where=UPPER(situs_full_address)%20LIKE%20'100%20E%20MAIN%20ST%25'%20AND%20UPPER(situsCity)='LEWISVILLE'&outFields=pid,geoID,situs_full_address&returnGeometry=false&f=json"
  ```
- **How the parcel ID is obtained / caveats:** Address searches default the `situsCity` filter to `LEWISVILLE` (pass empty string for county-wide). Each feature returns both `pid` (numeric property id) and `geoID` (string account). `lewisville_gis_parcel` is an alternate address→`PROPERTY_ID` bridge against the city's hosted DCAD parcel layer (`Parcels_Hosted/FeatureServer/0`).

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `dentoncad_details` — source `denton-cad`, module `src/sources/denton-cad/details.ts`
- **Upstream request:** `GET https://geo.dentoncad.com/arcgis/rest/services/Parcels/MapServer/1/query?where=pid=PARCEL_ID&outFields=...&returnGeometry=true&outSR=2276&f=json`
- **Tool input schema:**
  ```json
  { "type": "object", "properties": { "account": { "type": "string" } }, "required": ["account"] }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": {
    "pid": 986704, "geoID": "SL9833A-...",
    "geometry": { "rings": [[[x,y],...]], "centroid": {"x":..,"y":..}, "spatialReference": 2276 },
    "centroidWgs84": { "latitude": 33.04, "longitude": -96.99 }
  } }
  ```
- **Sample curl (upstream):**
  ```bash
  curl "https://geo.dentoncad.com/arcgis/rest/services/Parcels/MapServer/1/query?where=pid=986704&outFields=pid,geoID&returnGeometry=true&outSR=2276&f=json"
  ```
- **How the geometry is obtained / caveats:** The **boundary polygon returned to the caller is in State Plane WKID 2276** (primary query). A second query at `outSR=4326` is issued but only its **centroid** is kept (`centroidWgs84`) — the WGS84 rings are discarded. `lewisville_gis_parcel` likewise requests `outSR=4326` with geometry but returns only `centroidWgs84`, not the rings. No tool emits a WGS84 boundary polygon/GeoJSON → **Partial**.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate-to-parcel tool. `dentoncad_search` takes address/owner/account only. `lewisville_gis_zoning` accepts lat/lon but queries the zoning layer and returns zoning/overlays — it does **not** return a parcel `PROPERTY_ID`. `lewisville_gis_parcel` accepts account or address, not a coordinate.
- **Q3 is Partial, not full:** the boundary polygon is only surfaced in native SR 2276; the WGS84 path yields a centroid point only.
