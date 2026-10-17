# West Lake Hills, TX — Parcel Resolution Audit

- **Slug:** `west-lake-hills-tx`
- **County:** Travis · **State:** TX
- **Parcel sources reviewed:** `tcad` (`src/sources/tcad/{index,search,details,client}.ts` + `src/lib/trueprodigy-client.ts`); `travis-county-gis` (`src/sources/travis-county-gis/{index,config,parcel-lookup,jurisdiction-profile}.ts`). (WLH publishes no queryable municipal GIS — its `wlh-iamgis` maps are auth-gated with no Surveyor module — so the parcel stack is the shared county/CAD stack.)

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
      "results": [ { "geoID": "0111150420", "pAccountID": 111015, "pID": 111150, "name": "OWNER", "legalDescription": "LOT ... " } ]
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
- **How the parcel ID is obtained / caveats:** WLH shares TCAD (TrueProdigy, office `Travis`) countywide. Address match returns rows with `geoID` (10-digit) + `pAccountID`. TCAD `appraisal_search` also returns a rough lat/lon per the field guide, but the resolver key is the geoID.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `county_parcel_lookup` — source `travis-county-gis`, module `src/sources/travis-county-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/MapServer/0/query?where=geo_id='<PARCEL_ID>'&outFields=*&returnGeometry=true&outSR=4326&f=json` (or `where=PROP_ID = <PROP_ID>` when `propId` is supplied).
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
      "attributes": { "PROP_ID": 111150, "geo_id": "0111150420", "OWNER": "...", "situs": "...", "deed_book_id": "...", "deed_book_page": "..." },
      "centroid": { "lon": -97.80, "lat": 30.29 },
      "geometry": { "type": "Polygon", "rings": [[[-97.80,30.29],[-97.80,30.30]]] }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -s "https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/MapServer/0/query?where=geo_id%3D%27PARCEL_ID%27&outFields=*&returnGeometry=true&outSR=4326&f=json"
  ```
- **How geometry is obtained / caveats:** The query requests `outSR=4326`, so the parcel polygon comes back directly in WGS84 as ArcGIS `rings` (returned under `geometry.rings`) plus a WGS84 `{lon,lat}` centroid. This is **WGS84 ArcGIS rings, not GeoJSON** — the coordinates are already EPSG:4326, so it satisfies Q3 (a caller must wrap the rings itself to get strict GeoJSON). Input accepts the geoID or PROP_ID.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate→parcel tool. `county_parcel_lookup` keys only on `propId`/`geoId`. `county_jurisdiction_profile` *does* take a lat/lon, but it point-queries the political/special-district boundary layers (City/CITCODE, MUD, WCID, ESD, School, Precinct) and returns jurisdiction/district data — **not** a parcel/account ID (it never touches the Parcels layer). So no tool resolves a bare coordinate to a parcel. `tcad appraisal_search` accepts only address/parcelId/owner.
