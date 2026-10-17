# Charlotte, NC — Parcel Resolution Audit

- **Slug:** `charlotte-nc`
- **County:** Mecklenburg · **State:** NC
- **Parcel sources reviewed:** `mecklenburg-assessor` (`src/sources/mecklenburg-assessor/search.ts`, `normalize.ts`, `config.ts`), `mecklenburg-gis` (`src/sources/mecklenburg-gis/search.ts`, `details.ts`, `districts.ts`, `config.ts`), plus shared `src/lib/spatialest-client.ts`, `src/lib/gis-client.ts`. `meckrod` (`src/sources/meckrod/`) reviewed and confirmed to be a Register-of-Deeds index, not a parcel source.

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `mecklenburg_assessor_search` (also `meck_parcel_search`) | `src/sources/mecklenburg-assessor` (`mecklenburg-gis`) |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `meck_parcel_details` | `src/sources/mecklenburg-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `mecklenburg_assessor_search` — source `mecklenburg-assessor`, module `src/sources/mecklenburg-assessor/search.ts` (normalization in `normalize.ts`). Secondary GIS-native path: `meck_parcel_search` (`src/sources/mecklenburg-gis/search.ts`), which runs `UPPER(situsaddress1) LIKE '%ADDRESS%'` against the meckgis CAMA layer and returns `pid`.
- **Upstream request (assessor):** `POST https://property.spatialest.com/nc/mecklenburg/api/v2/search/suggestions` (canonicalize the term → suggestion id) then `GET https://property.spatialest.com/nc/mecklenburg/api/v1/recordcard/{id}` with the cookie jar + `X-CSRF-TOKEN` meta token (session primed first).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "street address, owner name, or 8-char PID" },
      "searchType": { "type": "string", "enum": ["address", "owner", "parcel"] },
      "maxResults": { "type": "number", "description": "default 3" }
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
      "totalSuggestions": 1,
      "results": [
        {
          "suggestion": "200 S TRYON ST",
          "parcelId": "07301611",
          "recordId": "12345",
          "situsAddress": "200 S TRYON ST",
          "owners": "SUMMIT 200 SOUTH TRYON LLC",
          "wgs84": { "lon": -80.8404, "lat": 35.2258 },
          "boundsWkt": "MULTIPOLYGON(((...)))"
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  # 1. resolve address → suggestion id
  curl 'https://property.spatialest.com/nc/mecklenburg/api/v2/search/suggestions' \
    -X POST -H 'X-Requested-With: XMLHttpRequest' \
    --data 'query=200 S TRYON ST CHARLOTTE'
  # 2. fetch the record card (parcel.header.ParcelID = PID)
  curl 'https://property.spatialest.com/nc/mecklenburg/api/v1/recordcard/RECORD_ID' \
    -H 'X-CSRF-TOKEN: <meta-token>' -b '<cookie-jar>'
  ```
- **How the parcel ID is obtained / caveats:** The PID is `parcel.header.ParcelID` on the Spatialest record card (`normalize.ts` → `parcelId`), the 8-char Mecklenburg county PID. The `meck_parcel_search` alternative returns `pid` straight off the CAMA layer via a `LIKE` address match — either path yields the join key.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `meck_parcel_details` — source `mecklenburg-gis`, module `src/sources/mecklenburg-gis/details.ts`
- **Upstream request:** `POST https://meckgis.mecklenburgcountync.gov/server/rest/services/TaxParcelBoundaries/FeatureServer/0/query` with `where=pid = 'PID'`, `returnGeometry=true`, `outSR=4326` (a second call with `outSR=2264` for native rings + a CAMA-attribute call to `TaxParcel_Camaownershipvalues/FeatureServer/0/query`).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "parcelId": { "type": "string", "description": "8-char Mecklenburg PID (e.g. \"07301611\")" }
    },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON (shape the tool returns):**
  ```json
  {
    "success": true,
    "data": {
      "parcelId": "07301611",
      "ncPin": "07301611...",
      "cama": { "owner": "...", "deedBook": "32110", "deedPage": "228" },
      "geometry": {
        "native": { "rings": [[[1451000,540000], "..."]], "spatialReference": 2264 },
        "centroid": { "x": 1451050, "y": 540120 },
        "wgs84Centroid": { "lon": -80.8404, "lat": 35.2258 },
        "geojson": {
          "type": "Feature",
          "geometry": { "type": "Polygon", "coordinates": [[[-80.8405,35.2257], "..."]] },
          "properties": { "parcelId": "07301611" }
        }
      }
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  curl 'https://meckgis.mecklenburgcountync.gov/server/rest/services/TaxParcelBoundaries/FeatureServer/0/query' \
    --data-urlencode "where=pid = 'PARCEL_ID'" \
    --data 'f=json&outFields=pid&returnGeometry=true&outSR=4326'
  ```
- **How the geometry is obtained / caveats:** The handler fetches the parcel rings twice — once at native SR 2264, once at `outSR=4326` — and `buildGeoJSON()` reverses ring winding to emit RFC-7946 `Polygon`/`MultiPolygon` in WGS84 lon/lat under `geometry.geojson`. Full WGS84 GeoJSON boundary, not merely a centroid. (`mecklenburg_assessor_search` also returns a `boundsWkt` MULTIPOLYGON in WGS84, a secondary polygon path.)

## Not supported
- **Q2 (Lat/Lon → Parcel ID): N.** No exposed tool accepts a coordinate and returns a parcel ID. `meck_special_districts` accepts `lon`/`lat` (or `x`/`y`) but queries the special/service/regulatory *district* layers (MSD, fire, stormwater, watershed) — it never queries `TaxParcelBoundaries` by point and returns no `pid`. Notably, the shared `src/lib/spatialest-client.ts` exposes a latent `searchByPoint()` (`GET /api/v2/search?filters[lat]=&filters[lng]=`) that would resolve a WGS84 point to a Spatialest parcel, but no tool in `mecklenburg-assessor` imports or wires it — so the capability is present in the library but not surfaced as a tool.
