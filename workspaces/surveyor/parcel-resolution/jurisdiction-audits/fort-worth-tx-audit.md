# Fort Worth, TX — Parcel Resolution Audit

- **Slug:** `fort-worth-tx`
- **County:** Tarrant · **State:** TX
- **Parcel sources reviewed:** `tad` (`src/sources/tad/search.ts`, `details.ts`, `config.ts`), `fort-worth-gis` (`src/sources/fort-worth-gis/parcel-lookup.ts`, `property-profile.ts`, `config.ts`), shared `src/lib/gis-client.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `tad_search` | `src/sources/tad` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `fort_worth_parcel_lookup` / `tad_details` | `src/sources/fort-worth-gis`, `src/sources/tad` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `tad_search` — source `tad`, module `src/sources/tad/search.ts`
- **Upstream request:** `GET https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19/query?where=ADD_NO='<NO>' AND UPPER(STREET_NAME) LIKE '<NAME>%'&outFields=...&returnGeometry=false&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Address: \"3001 CROCKETT ST\"; Owner: name fragment; Account: TAD account (e.g. \"42328053\")" },
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
          "ACCOUNT": "42328053",
          "PIDN": "...",
          "SITUS_ADDR": "3001 CROCKETT ST",
          "OWNER_NAME": "...",
          "PARCEL_LEGAL_DESCRIPTION": "VAN ZANDT PARK ADDITION Block 10 Lot 1R",
          "DEED_BOOK": "D221353777",
          "CITYNAME": "FORT WORTH"
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19/query?where=ADD_NO%3D%27<NO>%27%20AND%20UPPER(STREET_NAME)%20LIKE%20%27<NAME>%25%27&outFields=ACCOUNT,OWNER_NAME,SITUS_ADDR,PARCEL_LEGAL_DESCRIPTION,DEED_BOOK,CITYNAME&returnGeometry=false&f=json"
  ```
- **How the parcel ID is obtained / caveats:** Identical TAD backbone as Benbrook — TAD parcels hosted as Fort Worth GIS layer 19. `tad_search searchType:"address"` parses `ADD_NO` + `STREET_NAME LIKE` and returns the `ACCOUNT` field, the TAD account that is the parcel key for all Fort Worth GIS tools (`fort_worth_parcel_lookup` / `fort_worth_zoning_lookup` / `fort_worth_property_profile` all key on `ACCOUNT`).

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `fort_worth_parcel_lookup` (source `fort-worth-gis`, module `src/sources/fort-worth-gis/parcel-lookup.ts`); `tad_details` (source `tad`) is the sibling by-account geometry tool
- **Upstream request:** `GET https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19/query?where=ACCOUNT='<ACCOUNT>'&outFields=*&returnGeometry=true&outSR=2276&f=json`
- **Tool input schema:**
  ```json
  { "type": "object", "properties": { "account": { "type": "string", "description": "TAD account number (e.g. \"42328053\")" } }, "required": ["account"] }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "account": "42328053",
      "parcel": { "account": "42328053", "pidn": "...", "situsAddress": "...", "owner": "..." },
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
  curl "https://mapit.fortworthtexas.gov/ags/rest/services/Planning_Development/PlanningDevelopment/MapServer/19/query?where=ACCOUNT%3D%27<ACCOUNT>%27&outFields=*&returnGeometry=true&outSR=2276&f=json"
  ```
- **How the parcel ID is obtained / caveats:** **Partial** — `fort_worth_parcel_lookup` returns the boundary `geometry.rings` in `outSR=2276` (NAD83 / Texas North Central, US Feet — State Plane), centroid computed in the same 2276 SR. No WGS84/GeoJSON boundary is emitted. `tad_details` (by account) returns the same 2276 rings but additionally projects the *centroid* to WGS84 (`centroidWgs84` via the FW geometry service `/project` → `outSR=4326`). WGS84 point yes; WGS84 boundary polygon no.

## Not supported

- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate to return a parcel/account ID. `tad_details`, `fort_worth_parcel_lookup`, `fort_worth_zoning_lookup`, and `fort_worth_property_profile` all key on the TAD `account`; the profile/zoning tools derive the parcel geometry from the account and polygon-intersect overlay layers — they never take lat/lon in nor resolve an account from a point. No `parcel_at_point` tool is wired.
- **Q3 is Partial, not Y:** boundary geometry is returned only in native State Plane 2276 (no `outSR=4326`, no GeoJSON). Only the centroid is available in WGS84 (from `tad_details.centroidWgs84`).
