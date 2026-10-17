# San Antonio, TX — Parcel Resolution Audit

- **Slug:** `san-antonio-tx`
- **County:** Bexar · **State:** TX
- **Parcel sources reviewed:** `bcad` (`src/sources/bcad/{search,details,client}.ts`), `cosa-gis` (`src/sources/cosa-gis/{parcel-lookup,zoning-lookup,property-profile,adjacent-properties,config}.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `bcad_search` | `src/sources/bcad` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `cosa_parcel_lookup` | `src/sources/cosa-gis` |

### Q1 — Address → Parcel ID  ✅ (upstream currently DEGRADED)
- **Tool:** `bcad_search` — source `bcad`, module `src/sources/bcad/{search,client}.ts`
- **Upstream request:** `GET https://esearch.bcad.org/search/requestSessionToken` then `POST https://esearch.bcad.org/search/SearchResults?keywords=ADDRESS` with `{ searchToken }` in the body (BIS Consultants esearch, token-based, no credentials).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "owner", "propertyId", "geoId"] }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": { "resultCount": 1, "results": [
    { "propertyId": "1374110", "geoId": "13814-003-0181", "address": "222 S ALAMO ST", "ownerName": "...", "legalDescription": "...", "subdivision": "..." }
  ] } }
  ```
- **Sample curl (upstream):**
  ```bash
  TOKEN=$(curl -s 'https://esearch.bcad.org/search/requestSessionToken' | jq -r .searchSessionToken)
  curl -X POST "https://esearch.bcad.org/search/SearchResults?keywords=222%20S%20Alamo%20St" \
    -H 'Content-Type: application/json' --data "{\"searchToken\":\"$TOKEN\"}"
  ```
- **How the parcel ID is obtained / caveats:** Address search returns `geoId` (BCAD geographic ID, format NNNNN-NNN-NNNN) + `propertyId`. **The `bcad` source is flagged DEGRADED in the field guide ("fetch failed" — TLS/cert + endpoint failure at esearch.bcad.org)**; the handler code fully implements address→parcel, but the upstream is presently unreliable. No COSA tool accepts an address (all COSA tools are keyed by `geoId`), so `bcad_search` is the only address entry point.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `cosa_parcel_lookup` — source `cosa-gis`, module `src/sources/cosa-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://services.arcgis.com/g1fRTDLeMgspWrYp/ArcGIS/rest/services/BCAD_Parcels/FeatureServer/0/query?where=Geo_id='GEOID'&outFields=*&returnGeometry=true&outSR=4326&f=json` (runs in parallel with a native-SR 102740 query; the WGS84 rings are converted to GeoJSON).
- **Tool input schema:**
  ```json
  { "type": "object", "properties": { "geoId": { "type": "string" } }, "required": ["geoId"] }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": {
    "geoId": "13814-003-0181", "propId": 1374110, "situs": "...", "ownerName": "...",
    "geometry": {
      "native": { "rings": [[[x,y],...]], "spatialReference": 102740 },
      "centroid": { "x": .., "y": .. },
      "geojson": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-98.49,29.42],...]] }, "properties": { "geoId": "13814-003-0181" } }
    }
  } }
  ```
- **Sample curl (upstream):**
  ```bash
  curl "https://services.arcgis.com/g1fRTDLeMgspWrYp/ArcGIS/rest/services/BCAD_Parcels/FeatureServer/0/query?where=Geo_id='13814-003-0181'&outFields=*&returnGeometry=true&outSR=4326&f=json"
  ```
- **How the geometry is obtained / caveats:** Keyed by BCAD `Geo_id`. The `outSR=4326` rings are assembled into a proper GeoJSON `Polygon`/`MultiPolygon` (`buildParcelGeoJSON`, with ring winding normalized) under `data.geometry.geojson` — a genuine WGS84 boundary → **Y**. A native SR 102740 polygon + centroid are also returned.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate-to-parcel tool. Every COSA tool (`cosa_parcel_lookup`, `cosa_zoning_lookup`, `cosa_property_profile`, `cosa_adjacent_properties`) is keyed by `geoId`; none accept lat/lon. `bcad_search` accepts address/owner/propertyId/geoId only. No point-in-parcel query is exposed.
