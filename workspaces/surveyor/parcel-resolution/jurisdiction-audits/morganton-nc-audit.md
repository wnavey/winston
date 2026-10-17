# Morganton, NC — Parcel Resolution Audit

- **Slug:** `morganton-nc`
- **County:** Burke · **State:** NC
- **Parcel sources reviewed:** `burke-county-gis` (`src/sources/burke-county-gis/parcel.ts`, `districts.ts`, `config.ts`), `morganton-gis` (`src/sources/morganton-gis/parcel.ts`, `jurisdiction.ts`, `zoning.ts`, `profile.ts`, `config.ts`), `burke-county-tax` (`src/sources/burke-county-tax/search.ts`), plus shared `src/lib/gis-client.ts`.

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `burke_parcel_search` (also `morganton_parcel_lookup`) | `src/sources/burke-county-gis` (`morganton-gis`) |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` | `-` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `burke_parcel_search` — source `burke-county-gis`, module `src/sources/burke-county-gis/parcel.ts`. Equivalent city path: `morganton_parcel_lookup` (`src/sources/morganton-gis/parcel.ts`), which runs `UPPER(LOCATION_ADDR) LIKE '%ADDRESS%'` against the fresh city parcel mirror (zoning-service layer 34) and returns `PIN`/`REID`.
- **Upstream request:** `POST https://gis.burkenc.org/arcgis/rest/services/ProdParcelViewFC/MapServer/0/query` with `where=UPPER(LOCATION_ADDR) LIKE '%ADDRESS%'`, `outFields=*`, `returnGeometry=false`, `outSR=2264`. (Morganton path: `POST https://gis.morgantonnc.gov/server/rest/services/Planning/Morganton_Zoning_Latest/MapServer/34/query`.)
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "REID, PIN, owner substring, or address substring" },
      "searchType": { "type": "string", "enum": ["reid", "pin", "owner", "address"] },
      "maxResults": { "type": "number", "description": "default 25" }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON (shape the tool returns):**
  ```json
  {
    "success": true,
    "data": {
      "resultCount": 1,
      "rawFeatureCount": 1,
      "results": [
        {
          "REID": "47193",
          "PIN": "1792966585",
          "PROPERTY_OWNER": "FULENWIDER INVESTMENT HOLDINGS, LLC",
          "LOCATION_ADDR": "... BURKEMONT AVE",
          "DEED_BOOK": "002564",
          "DEED_PAGE": "00716",
          "trueValue": 1234500,
          "taxableValueDiffersFromTrueValue": false
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  curl 'https://gis.burkenc.org/arcgis/rest/services/ProdParcelViewFC/MapServer/0/query' \
    --data-urlencode "where=UPPER(LOCATION_ADDR) LIKE '%ADDRESS%'" \
    --data 'f=json&outFields=*&returnGeometry=false&outSR=2264'
  ```
- **How the parcel ID is obtained / caveats:** `REID` (Burke's canonical key) is read directly off the parcel-spine feature attributes and deduped by REID (preferring the `PARCEL_PK`-not-null row). `PIN` is also returned but is NOT unique in Burke County — the guide/tool warn to disambiguate by `PIN_EXT`. Note `burke_tax_search` (`burke-county-tax`) does **not** accept address (only PIN/REID/owner), so the address→parcel path is the GIS parcel layers, not the CAMA portal.

## Not supported
- **Q2 (Lat/Lon → Parcel ID): N.** No exposed tool accepts a coordinate and returns a parcel ID. Point-accepting tools resolve context, not parcel identity: `morganton_jurisdiction_check` (point → city/ETJ/neither), `morganton_zoning_lookup` and `morganton_property_profile` (point → zoning/overlays/districts), and `burke_county_districts` (point → fire/township/overlays). None query a parcel layer by point or return `REID`/`PIN`. `burke_parcel_search` and `morganton_parcel_lookup` accept only `reid`/`pin`/`owner`/`address`, never a coordinate.
- **Q3 (Parcel ID → WGS84 polygon/GeoJSON): N.** No tool returns the parcel boundary polygon at all. `burke_parcel_search` explicitly sets `returnGeometry=false`. `morganton_parcel_lookup` also sets `returnGeometry=false` and surfaces only the WGS84 **centroid** (`XCoord`/`YCoord` → `lon`/`lat`), a point, not a boundary. Confirmed by grep: no `returnGeometry: 'true'` exists anywhere in `morganton-gis/` or `burke-county-gis/`. The native SR of both servers is NC State Plane 2264, but since no boundary geometry is returned in any SR, this is N (not Partial).
