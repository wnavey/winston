# Los Angeles, CA — Parcel Resolution Audit

- **Slug:** `los-angeles-ca`
- **County:** Los Angeles · **State:** CA
- **Parcel sources reviewed:** `lacounty-assessor` (`src/sources/lacounty-assessor/search.ts`, `client.ts`, `config.ts`), `lacounty-gis` (`src/sources/lacounty-gis/parcel-lookup.ts`, `config.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `lacounty_assessor_search` | `src/sources/lacounty-assessor` |
| 2. Lat/Lon → Parcel ID | Y | `lacounty_parcel_lookup` | `src/sources/lacounty-gis` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `lacounty_parcel_lookup` | `src/sources/lacounty-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `lacounty_assessor_search` — source `lacounty-assessor`, module `src/sources/lacounty-assessor/search.ts`
- **Upstream request:** `GET https://portal.assessor.lacounty.gov/api/search?search=<ADDRESS>` (browser User-Agent required). Optional `resolvePrincipal` fires follow-up `GET /api/parceldetail?ain=<AIN>` calls to fetch SqftMain and flag the principal parcel.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Situs address or text (e.g. \"900 WILSHIRE BLVD\")." },
      "city": { "type": "string", "description": "Optional situs-city filter (case-insensitive substring, e.g. \"LOS ANGELES\")." },
      "resolvePrincipal": { "type": "boolean", "description": "Enrich matches with SqftMain and flag the principal parcel (max SqftMain). Default false." },
      "limit": { "type": "number", "description": "Max candidates to return (1-50, default 25)." }
    },
    "required": ["query"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "query": "900 WILSHIRE BLVD",
      "totalCount": 13,
      "returnedCount": 13,
      "cityFilter": "LOS ANGELES",
      "resolvePrincipal": true,
      "candidates": [
        {
          "ain": "5144008027",
          "situsStreet": "900 WILSHIRE BLVD",
          "situsCity": "LOS ANGELES CA",
          "situsZip": "90017",
          "legalDescription": "TR=71141 LOT 3",
          "sqftMain": 738975,
          "principal": true
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124.0.0.0' \
    'https://portal.assessor.lacounty.gov/api/search?search=ADDRESS'
  ```
- **How the parcel ID is obtained / caveats:** `/api/search` is a situs/address/text index; each returned `Parcels[]` element carries the `AIN` (bare 10-digit assessor ID). AIN is NOT a search key here (returns 0). Downtown/airspace buildings stack many AINs at one situs — `resolvePrincipal:true` enriches each candidate with SqftMain (via parceldetail) and flags the max-SqftMain parcel as the principal.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `lacounty_parcel_lookup` — source `lacounty-gis`, module `src/sources/lacounty-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query?geometry={x,y}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&outFields=AIN,APN,...&returnGeometry=true&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "ain": { "type": "string", "description": "Assessor ID Number, bare 10-digit (e.g. \"5144008027\")." },
      "lon": { "type": "number", "description": "WGS84 longitude (with lat; used if ain omitted)." },
      "lat": { "type": "number", "description": "WGS84 latitude (with lon)." }
    }
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "mode": "point",
      "parcelCount": 13,
      "principalAin": "5144008027",
      "principal": {
        "attributes": { "AIN": "5144008027", "SitusFullAddress": "900 WILSHIRE BLVD", "SQFTmain1": 738975 },
        "geometry": { "rings": [[[-118.26, 34.05], "..."]], "spatialReference": 4326, "centroid": { "lon": -118.26, "lat": 34.05 } },
        "sqftMain": 738975
      },
      "parcels": ["..."],
      "note": "Point query returned 13 stacked airspace parcels — principal chosen by max SQFTmain1."
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query?f=json&geometry=%7B%22x%22%3ALON%2C%22y%22%3ALAT%7D&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&outFields=AIN,SQFTmain1&returnGeometry=true'
  ```
- **How the parcel ID is obtained / caveats:** The handler accepts `lon`/`lat`, sends an `esriGeometryPoint` intersect query to the LACounty_Parcel layer, and reads `AIN` off each intersecting feature's `attributes`. On stacked airspace parcels the point returns the whole stack; results are sorted by `SQFTmain1` and the top is exposed as `principalAin`.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `lacounty_parcel_lookup` — source `lacounty-gis`, module `src/sources/lacounty-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query?where=AIN='<AIN>'&outSR=4326&outFields=AIN,APN,SitusFullAddress,...&returnGeometry=true&f=json`
- **Tool input schema:** (same as Q2 — `ain` branch)
  ```json
  { "type": "object", "properties": { "ain": { "type": "string", "description": "Assessor ID Number, bare 10-digit." } } }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "mode": "ain",
      "parcelCount": 1,
      "principalAin": "5144008027",
      "principal": {
        "attributes": { "AIN": "5144008027" },
        "geometry": {
          "rings": [[[-118.2612, 34.0501], [-118.2609, 34.0501], "..."]],
          "spatialReference": 4326,
          "centroid": { "lon": -118.2610, "lat": 34.0503 }
        }
      }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query?f=json&where=AIN%3D%27PARCEL_ID%27&outSR=4326&outFields=AIN&returnGeometry=true"
  ```
- **How the parcel ID is obtained / caveats:** An `ain` query returns exactly one parcel. Geometry is requested with `outSR=4326`; the handler returns ArcGIS `rings` explicitly stamped `spatialReference: 4326` plus a computed WGS84 centroid. Native SR is Web Mercator (102100/3857) but is reprojected to WGS84 by the `outSR=4326` request. Output is ArcGIS rings (not RFC-7946 GeoJSON), but confirmed WGS84.

## Not supported
- None — all three questions are supported. (Q1 via the assessor address index; Q2/Q3 via the county GIS parcel layer, both point and AIN modes returning WGS84 geometry.)
