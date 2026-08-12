# Woodward, OK — Parcel Resolution Audit

- **Slug:** `woodward-ok`
- **County:** Woodward · **State:** OK
- **Parcel sources reviewed:** `woodward-gis` (`src/sources/woodward-gis/parcel-search.ts`, `parcel-at-point.ts`, `property-profile.ts`, `config.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `woodward_parcel_search` | `src/sources/woodward-gis` |
| 2. Lat/Lon → Parcel ID | Y | `woodward_parcel_at_point` | `src/sources/woodward-gis` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `woodward_property_profile` | `src/sources/woodward-gis` |

All three key off the City of Woodward `New2026Parcel` FeatureServer (Web Mercator source that accepts `inSR=4326` and returns `outSR=4326`).

### Q1 — Address → Parcel ID  ✅
- **Tool:** `woodward_parcel_search` (`searchType:"address"`) — module `src/sources/woodward-gis/parcel-search.ts`
- **Upstream request:** `GET https://services9.arcgis.com/PZDYj8nlIDAHxNx4/ArcGIS/rest/services/New2026Parcel/FeatureServer/0/query?where=UPPER(situs) LIKE '%ADDRESS%'&outFields=parcelid,account,ownername,situs,…&returnGeometry=false&resultRecordCount=50&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["account", "parcelId", "owner", "address"] }
    },
    "required": ["query"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "searchType": "address",
      "count": 1,
      "records": [ { "account": "770012622", "parcelid": "0410-06-22N-20W-4-423-00",
        "ownername": "HUTCHINSON OIL COMPANY, LLC", "situs": "06131 S HWY 270", "legal": "…" } ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://services9.arcgis.com/PZDYj8nlIDAHxNx4/ArcGIS/rest/services/New2026Parcel/FeatureServer/0/query?where=UPPER(situs)%20LIKE%20'%25ADDRESS%25'&outFields=parcelid,account,ownername,situs&returnGeometry=false&f=json"
  ```
- **How the parcel ID is obtained / caveats:** Address is a `UPPER(situs) LIKE '%…%'` contains match; each record carries the canonical bare `account` (e.g. `770012622`) and the formatted `parcelid`. Owner/account/parcelId search types share the same endpoint.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `woodward_parcel_at_point` — module `src/sources/woodward-gis/parcel-at-point.ts`
- **Upstream request:** `GET …/New2026Parcel/FeatureServer/0/query?geometry=LON,LAT&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=parcelid,account,ownername,situs,…&returnGeometry=false&f=json`
- **Sample response JSON:**
  ```json
  {
    "success": true,
    "data": { "latitude": 36.40756, "longitude": -99.37226, "found": true,
      "record": { "account": "770012622", "parcelid": "0410-06-22N-20W-4-423-00", "ownername": "…", "situs": "…" } }
  }
  ```
- **Sample curl:**
  ```bash
  curl "https://services9.arcgis.com/PZDYj8nlIDAHxNx4/ArcGIS/rest/services/New2026Parcel/FeatureServer/0/query?geometry=LON,LAT&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=account,parcelid,ownername,situs&returnGeometry=false&f=json"
  ```
- **How the parcel ID is obtained / caveats:** A point-intersect query; the first intersecting feature's attributes (incl. `account` + `parcelid`) are returned. Purpose-built to turn a subject-site coordinate into a parcel + owner.

### Q3 — Parcel ID → WGS84 polygon / GeoJSON  ✅
- **Tool:** `woodward_property_profile` — module `src/sources/woodward-gis/property-profile.ts` (`fetchParcel`)
- **Upstream request:** `GET …/New2026Parcel/FeatureServer/0/query?where=account='ACCOUNT' OR UPPER(parcelid)='PARCEL_ID'&outFields=…&returnGeometry=true&outSR=4326&f=json`
- **Sample response JSON:**
  ```json
  {
    "success": true,
    "data": {
      "parcelId": "0410-06-22N-20W-4-423-00",
      "account": "770012622",
      "centroid": { "latitude": 36.40756, "longitude": -99.37226 },
      "geometry": { "rings": [[[ -99.373, 36.408 ], "…" ]], "spatialReference": 4326 },
      "zoning": { "zone": "C-2", "source": "Official City of Woodward zoning map (2022 Zones)" },
      "platting": { "SUB_NAME": "…", "LOT_NAME": "…", "BLOCK_NAME": "…" }
    }
  }
  ```
- **Sample curl:**
  ```bash
  curl "https://services9.arcgis.com/PZDYj8nlIDAHxNx4/ArcGIS/rest/services/New2026Parcel/FeatureServer/0/query?where=account='ACCOUNT'&outFields=parcelid,account&returnGeometry=true&outSR=4326&f=json"
  ```
- **How the geometry is obtained / caveats:** `fetchParcel` queries the parcel layer with `returnGeometry=true&outSR=4326`, and the handler returns `geometry: { rings, spatialReference: 4326 }` plus a WGS84 centroid. Native source SR is Web Mercator (3857), reprojected to WGS84 via `outSR`. Accepts either the account number or the formatted parcel id via `parcelId`. Rings are ArcGIS rings in EPSG:4326 (not GeoJSON).

## Not supported
- None of the three. (The county Assessor's qPublic/Beacon portal is Cloudflare-Turnstile-blocked and not wired; `woodward-gis` is the free authoritative substitute and satisfies all three.)
