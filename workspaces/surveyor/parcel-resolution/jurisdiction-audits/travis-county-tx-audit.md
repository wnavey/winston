# Travis County, TX (Unincorporated) — Parcel Resolution Audit

- **Slug:** `travis-county-tx`
- **County:** Travis · **State:** TX
- **Parcel sources reviewed:** `tcad` (`src/sources/tcad/{index,search,details,client}.ts` + `src/lib/trueprodigy-client.ts`); `travis-county-gis` (`src/sources/travis-county-gis/{index,config,parcel-lookup,jurisdiction-profile}.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `appraisal_search` | `src/sources/tcad` |
| 2. Lat/Lon → Parcel ID | N | — | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `county_parcel_lookup` | `src/sources/travis-county-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `appraisal_search` — source `tcad`, module `src/sources/tcad/search.ts` (transport in `src/lib/trueprodigy-client.ts`)
- **Upstream request:** `POST https://prod-container.trueprodigyapi.com/public/property/searchfulltext` (address/owner full-text; `parcelId` → `POST /public/property/search?page=1&pageSize=20` with `geoID begins`). Preceded by `POST /trueprodigy/cadpublic/auth/token` `{office:"Travis"}`.
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
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "resultCount": 1,
      "results": [ { "geoID": "0332550101", "pAccountID": 332550, "pID": 332550, "name": "OWNER", "legalDescription": "ABS 18 NAVARRO J A ACR 5.2000" } ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  TOKEN=$(curl -s -X POST https://prod-container.trueprodigyapi.com/trueprodigy/cadpublic/auth/token \
    -H 'Content-Type: application/json' -d '{"office":"Travis"}' | jq -r .user.token)
  curl -s -X POST 'https://prod-container.trueprodigyapi.com/public/property/searchfulltext' \
    -H 'Content-Type: application/json' -H "Authorization: $TOKEN" \
    -H 'Origin: https://travis.prodigycad.com' -H 'Referer: https://travis.prodigycad.com/' \
    -d '{"pYear":{"operator":"=","value":2026},"fullTextSearch":{"operator":"match","value":"ADDRESS"}}'
  ```
- **How the parcel ID is obtained / caveats:** Same TCAD (TrueProdigy, office `Travis`) portal covering all of Travis County. Address full-text match returns rows carrying `geoID` (= county GIS `geo_id`, 10-digit) + `pAccountID` + rough lat/lon. The geoID is the resolver key that feeds `county_parcel_lookup`.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `county_parcel_lookup` — source `travis-county-gis`, module `src/sources/travis-county-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/MapServer/0/query?where=geo_id='<PARCEL_ID>'&outFields=*&returnGeometry=true&outSR=4326&f=json` (or `where=PROP_ID = <PROP_ID>` when `propId` supplied).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "propId": { "type": "string", "description": "TCAD property ID (PROP_ID / pid from appraisal_search)." },
      "geoId": { "type": "string", "description": "10-digit TCAD geo_id (e.g. 0332550101)." }
    }
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "attributes": { "PROP_ID": 332550, "geo_id": "0332550101", "OWNER": "...", "situs": "...", "acreage": 5.2, "deed_num": "...", "deed_book_id": "...", "deed_book_page": "..." },
      "centroid": { "lon": -97.71, "lat": 30.16 },
      "geometry": { "type": "Polygon", "rings": [[[-97.71,30.16],[-97.71,30.17]]] }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -s "https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/MapServer/0/query?where=geo_id%3D%27PARCEL_ID%27&outFields=*&returnGeometry=true&outSR=4326&f=json"
  ```
- **How geometry is obtained / caveats:** The county ArcGIS Server (v11.2) natively publishes in State Plane 102739/2277 but accepts `outSR=4326` and auto-reprojects, so the polygon returns directly in WGS84 as ArcGIS `rings` (under `geometry.rings`) with a WGS84 `{lon,lat}` centroid. This is **WGS84 ArcGIS rings, not strict GeoJSON**; coordinates are already EPSG:4326, satisfying Q3. Accepts the geoID or PROP_ID.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate→parcel tool. `county_parcel_lookup` keys only on `propId`/`geoId`. `county_jurisdiction_profile` accepts a lat/lon but point-queries the political/special-district layers (City/CITCODE, MUD, WCID, ESD, School, Precinct) and returns jurisdiction/district data — **not** a parcel/account ID (the Parcels layer is never point-queried). `tcad appraisal_search` accepts only address/parcelId/owner. A bare coordinate cannot be resolved to a parcel by any exposed tool.
