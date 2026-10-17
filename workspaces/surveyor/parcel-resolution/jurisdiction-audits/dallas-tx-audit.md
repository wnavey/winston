# Dallas, TX — Parcel Resolution Audit

- **Slug:** `dallas-tx`
- **County:** Dallas · **State:** TX
- **Parcel sources reviewed:** `dcad` (`src/sources/dcad/{search,details,config,parcel-geometry}.ts`), `dallas-gis` (`src/sources/dallas-gis/{parcel-lookup,property-profile,site-constraints,config}.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `dcad_search` | `src/sources/dcad` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `dcad_details` | `src/sources/dcad` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `dcad_search` — source `dcad`, module `src/sources/dcad/search.ts`
- **Upstream request:** `GET https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query?where=UPPER(SITEADDRESS) LIKE 'ADDRESS%'&outFields=PARCELID,...&returnGeometry=false&orderByFields=SITEADDRESS&resultRecordCount=20&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "owner", "account"] },
      "limit": { "type": "number" }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": { "resultCount": 1, "results": [
    { "PARCELID": "00767100140010000", "SITEADDRESS": "5050 KEENELAND PKWY", "OWNERNME1": "...", "PRPRTYDSCRP": "BLK 14/7671 LT 1" }
  ] } }
  ```
- **Sample curl (upstream):**
  ```bash
  curl "https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query?where=UPPER(SITEADDRESS)%20LIKE%20'5050%20KEENELAND%25'&outFields=PARCELID,SITEADDRESS,OWNERNME1&returnGeometry=false&f=json"
  ```
- **How the parcel ID is obtained / caveats:** WHERE clause matches the leading portion of `SITEADDRESS`; each returned feature carries `PARCELID` (17-digit DCAD account). Business-personal-property rows (PARCELID starting `99`) are filtered out via `isRealProperty`.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `dcad_details` (also `dallas_parcel_lookup`) — source `dcad`, module `src/sources/dcad/details.ts`
- **Upstream request:** `GET https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query?where=PARCELID='PARCEL_ID'&outFields=...&returnGeometry=true&outSR=2276&f=json`
- **Tool input schema:**
  ```json
  { "type": "object", "properties": { "parcelId": { "type": "string" } }, "required": ["parcelId"] }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": {
    "parcelId": "00767100140010000",
    "attributes": { "PARCELID": "...", "SITEADDRESS": "..." },
    "geometry": { "rings": [[[x,y],...]], "centroid": {"x":..,"y":..}, "spatialReference": 2276 },
    "centroidWgs84": { "latitude": 32.9, "longitude": -96.8 }
  } }
  ```
- **Sample curl (upstream):**
  ```bash
  curl "https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query?where=PARCELID='00767100140010000'&outFields=PARCELID,SITEADDRESS&returnGeometry=true&outSR=2276&f=json"
  ```
- **How the geometry is obtained / caveats:** The parcel **boundary polygon is returned only in State Plane WKID 2276** (NAD83 / Texas North Central, US ft) — `outSR=2276` is hardcoded. Only a WGS84 **centroid** (a point, not the boundary) is derived, by projecting the centroid through the City of Dallas geometry service (`.../Utilities/Geometry/GeometryServer/project`). `dallas_parcel_lookup` behaves identically (rings in 2276). No tool returns the boundary as WGS84 rings or GeoJSON, hence **Partial**.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate. `dcad_search` accepts only address/owner/account; every `dallas-gis` tool (`dallas_parcel_lookup`, `dallas_property_profile`, `dallas_site_constraints`) is keyed by `acct` (= DCAD PARCELID). No point-in-parcel query exists.
- **Q3 is Partial, not full:** parcel boundary geometry is emitted only in native SR 2276; WGS84 output is limited to a centroid point.
