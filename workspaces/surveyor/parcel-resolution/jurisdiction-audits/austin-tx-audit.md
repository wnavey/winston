# Austin, TX — Parcel Resolution Audit

- **Slug:** `austin-tx`
- **County:** Travis · **State:** TX
- **Parcel sources reviewed:** `tcad` (`src/sources/tcad/{index,search,details,client}.ts` + `src/lib/trueprodigy-client.ts`); `coa-gis` (`src/sources/coa-gis/{index,config,parcel-lookup,property-profile,adjacent-context}.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `appraisal_search` | `src/sources/tcad` |
| 2. Lat/Lon → Parcel ID | N | — | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `parcel_lookup` | `src/sources/coa-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `appraisal_search` — source `tcad`, module `src/sources/tcad/search.ts` (transport in `src/lib/trueprodigy-client.ts`)
- **Upstream request:** `POST https://prod-container.trueprodigyapi.com/public/property/searchfulltext` (address/owner use full-text; `searchType:"parcelId"` instead hits `POST /public/property/search?page=1&pageSize=20` with a `geoID begins` operand). A prior `POST /trueprodigy/cadpublic/auth/token` `{office:"Travis"}` fetches an anonymous bearer token.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query — address, parcel/geo ID, or owner name" },
      "searchType": { "type": "string", "enum": ["address", "parcelId", "owner"] }
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
        { "geoID": "0252080902", "pAccountID": 9301211, "pID": 263746, "name": "OWNER NAME", "legalDescription": "LOT 2 ..." }
      ]
    }
  }
  ```
  (Results are the raw TrueProdigy rows, filtered to those with a non-null `geoID`; `geoID` is the 10-digit parcel ID, `pAccountID` feeds `appraisal_details`.)
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  TOKEN=$(curl -s -X POST https://prod-container.trueprodigyapi.com/trueprodigy/cadpublic/auth/token \
    -H 'Content-Type: application/json' -d '{"office":"Travis"}' | jq -r .user.token)
  curl -s -X POST 'https://prod-container.trueprodigyapi.com/public/property/searchfulltext' \
    -H 'Content-Type: application/json' -H "Authorization: $TOKEN" \
    -H 'Origin: https://travis.prodigycad.com' -H 'Referer: https://travis.prodigycad.com/' \
    -d '{"pYear":{"operator":"=","value":2026},"fullTextSearch":{"operator":"match","value":"ADDRESS"}}'
  ```
- **How the parcel ID is obtained / caveats:** Full-text address match returns rows carrying `geoID` (10-digit TCAD parcel/geo ID) plus `pAccountID`/`pID`. The COA GIS tools do not accept an address, so address→parcel resolution is TCAD's job; the geoID it yields is the key every coa-gis tool consumes.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `parcel_lookup` — source `coa-gis`, module `src/sources/coa-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://maps.austintexas.gov/gis/rest/Shared/AppraisalDistricts/MapServer/0/query?f=json&outFields=*&spatialRel=esriSpatialRelIntersects&outSR=4326&where=UPPER(PID_10)='<PARCEL_ID>'` (the WGS84 ring fetch). It also runs a native-SR (102739) geometry fetch + an intersecting-property query on `.../Property/MapServer/0/query` for placeId/RSN.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "parcelId": { "type": "string", "description": "10-digit TCAD geoID (e.g. \"0252080902\")" } },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "parcelId": "0252080902",
      "placeId": 123456,
      "rsn": 654321,
      "propertyCount": 1,
      "properties": [ { "PLACE_ID": 123456, "RSN": 654321 } ],
      "geometry": {
        "native": { "rings": [[[3110000,10070000]]], "spatialReference": 102739 },
        "centroid": { "x": 3110050, "y": 10070050 },
        "geojson": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-97.74,30.27]]] }, "properties": { "parcelId": "0252080902" } }
      }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -s "https://maps.austintexas.gov/gis/rest/Shared/AppraisalDistricts/MapServer/0/query?f=json&outFields=*&spatialRel=esriSpatialRelIntersects&outSR=4326&where=UPPER(PID_10)%3D%27PARCEL_ID%27"
  ```
- **How geometry is obtained / caveats:** The handler fetches the parcel ring with `outSR=4326` and rebuilds it into a GeoJSON `Polygon`/`MultiPolygon` (`buildParcelGeoJSON`, CW/CCW ring→hole grouping, coordinate order reversed). WGS84 GeoJSON is emitted under `geometry.geojson`; native State Plane rings are also returned. Input is the parcel ID (geoID), so this is a true parcel→polygon tool.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate and returns a parcel ID. `coa-gis` `parcel_lookup`, `property_profile`, and `adjacent_context` all require a 10-digit `parcelId` (geoID) as input — none does a point-in-polygon query against the appraisal/parcel layer. `tcad appraisal_search` accepts only address/parcelId/owner, not lat/lon. (A caller must go address→geoID via TCAD first; reverse geocoding a bare coordinate to a parcel is not exposed.)
