# Benbrook, TX — Parcel Resolution Audit

- **Slug:** `benbrook-tx`
- **County:** Tarrant · **State:** TX
- **Parcel sources reviewed:** `tad` (`src/sources/tad/search.ts`, `details.ts`, `config.ts`), `benbrook-gis` (`src/sources/benbrook-gis/parcel-lookup.ts`, `property-profile.ts`, `config.ts`), shared `src/lib/gis-client.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `tad_search` | `src/sources/tad` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `benbrook_parcel_lookup` / `tad_details` | `src/sources/benbrook-gis`, `src/sources/tad` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `tad_search` — source `tad`, module `src/sources/tad/search.ts`
- **Upstream request:** `GET https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19/query?where=ADD_NO='<NO>' AND UPPER(STREET_NAME) LIKE '<NAME>%'&outFields=...&returnGeometry=false&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Address: \"3001 CROCKETT ST\"; Owner: name fragment; Account: TAD account" },
      "searchType": { "type": "string", "enum": ["address", "owner", "account"] },
      "limit": { "type": "number" }
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
        {
          "ACCOUNT": "42509465",
          "PIDN": "...",
          "SITUS_ADDR": "...",
          "OWNER_NAME": "AURA BENBROOK BLUE LP",
          "PARCEL_LEGAL_DESCRIPTION": "TRG VISTA WAY ADDITION Block 1 Lot 1",
          "DEED_BOOK": "D225076138",
          "CITYNAME": "BENBROOK"
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19/query?where=ADD_NO%3D%27<NO>%27%20AND%20UPPER(STREET_NAME)%20LIKE%20%27<NAME>%25%27&outFields=ACCOUNT,OWNER_NAME,SITUS_ADDR,PARCEL_LEGAL_DESCRIPTION,DEED_BOOK,CITYNAME&returnGeometry=false&f=json"
  ```
- **How the parcel ID is obtained / caveats:** TAD has no public JSON API of its own; the parcel layer is hosted as layer 19 of the City of Fort Worth GIS. `tad_search` with `searchType:"address"` parses the input into `ADD_NO` + `STREET_NAME LIKE` (dropping the street-type token) and returns the `ACCOUNT` field — the TAD account number that is the parcel key for every Benbrook GIS tool (`Account_Nu` on the Benbrook ParcelsFull layer = the TAD account).

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `benbrook_parcel_lookup` (source `benbrook-gis`, module `src/sources/benbrook-gis/parcel-lookup.ts`); `tad_details` (source `tad`, module `src/sources/tad/details.ts`) is the sibling by-account geometry tool
- **Upstream request:** `GET https://gis.newedgeservices.com/arcgis/rest/services/Benbrook/BenbrookPublicData/MapServer/31/query?where=Account_Nu='<ACCOUNT>'&outFields=*&returnGeometry=true&outSR=2276&f=json`
- **Tool input schema:**
  ```json
  { "type": "object", "properties": { "account": { "type": "string", "description": "TAD account number (e.g. \"42509465\")" } }, "required": ["account"] }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "account": "42509465",
      "parcel": { "account": "42509465", "owner": "AURA BENBROOK BLUE LP", "situsAddress": "...", "subdivision": "TRG VISTA WAY ADDITION" },
      "geometry": {
        "rings": [[[/* State Plane 2276 x,y */]]],
        "centroid": { "x": 0, "y": 0 },
        "spatialReference": 2276
      }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://gis.newedgeservices.com/arcgis/rest/services/Benbrook/BenbrookPublicData/MapServer/31/query?where=Account_Nu%3D%27<ACCOUNT>%27&outFields=*&returnGeometry=true&outSR=2276&f=json"
  ```
- **How the parcel ID is obtained / caveats:** **Partial** — the boundary `geometry.rings` is returned in `outSR=2276` (NAD83 / Texas North Central, US Feet — State Plane), and the centroid is computed in that same 2276 SR. No WGS84/GeoJSON boundary is emitted. `tad_details` (by account) is the same story for the geometry, but additionally projects the *centroid* to WGS84 (`centroidWgs84`, via the Fort Worth geometry service `/project` → `outSR=4326`) — so a WGS84 point is available, but the polygon is only ever in State Plane 2276. WGS84 polygon = no.

## Not supported

- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate to return a parcel/account ID. `tad_details`, `benbrook_parcel_lookup`, `benbrook_zoning_lookup`, and `benbrook_property_profile` all key on the TAD `account`; the profile/zoning tools derive parcel geometry from the account and polygon-intersect overlay layers, never taking lat/lon in or returning an account from a point. No `parcel_at_point` tool is wired.
- **Q3 is Partial, not Y:** boundary geometry is returned only in native State Plane 2276 (no `outSR=4326`, no GeoJSON). Only the centroid is available in WGS84 (from `tad_details.centroidWgs84`).
