# City of Maricopa, AZ — Parcel Resolution Audit

- **Slug:** `maricopa-az`
- **County:** Pinal · **State:** AZ  *(the `.md` frontmatter reads `county: Pinal` — the City of Maricopa is in PINAL County, NOT Maricopa County/Phoenix)*
- **Parcel sources reviewed:** `maricopa-az-gis` (`src/sources/maricopa-az-gis/parcel-lookup.ts`, `property-profile.ts`, `config.ts`); `pinal-assessor` (`src/sources/pinal-assessor/gis-search.ts`, `config.ts`); `pinal-gis` (`src/sources/pinal-gis/zoning-lookup.ts`, `plat-citation.ts`, `situs-lookup.ts`, `property-profile.ts` + `src/lib/property-profile-core.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `maricopa_city_parcel_lookup` | `src/sources/maricopa-az-gis` |
| 2. Lat/Lon → Parcel ID | Y | `assessor_parcel_search` | `src/sources/pinal-assessor` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` | `-` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `maricopa_city_parcel_lookup` — source `maricopa-az-gis`, module `src/sources/maricopa-az-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://services7.arcgis.com/MlfUGd2UJYefAS7v/arcgis/rest/services/County_Tax_Parcels_SmartGov/FeatureServer/0/query?f=json&outSR=4326&returnGeometry=false&where=UPPER(site_address)+LIKE+'%25ADDRESS%25'&outFields=parcel_number,site_address,site_city,site_zip,owner_name,subdivision,longitude,latitude`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "apn": { "type": "string", "description": "Pinal County APN. Bare 9-char preferred; dashed and 10-digit forms normalized." },
      "address": { "type": "string", "description": "Situs address or fragment. Substring match — ambiguous; prefer apn." }
    },
    "required": []
  }
  ```
- **Sample response JSON (address path — the shape the handler returns):**
  ```json
  {
    "success": true,
    "found": true,
    "query": { "address": "20205 N JOHN WAYNE" },
    "matchCount": 1,
    "matches": [
      {
        "apn": "512049250",
        "siteAddress": "20205 N JOHN WAYNE PKWY",
        "siteCity": "MARICOPA",
        "siteZip": "85139",
        "ownerName": "…",
        "subdivision": "…",
        "longitude": -111.97,
        "latitude": 33.05
      }
    ],
    "notes": ["Address search is a SUBSTRING match and is ambiguous — confirm the APN before using any result downstream."]
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -G 'https://services7.arcgis.com/MlfUGd2UJYefAS7v/arcgis/rest/services/County_Tax_Parcels_SmartGov/FeatureServer/0/query' \
    --data-urlencode 'f=json' \
    --data-urlencode "where=UPPER(site_address) LIKE '%ADDRESS%'" \
    --data-urlencode 'outFields=parcel_number,site_address,site_city,site_zip,owner_name,subdivision,longitude,latitude' \
    --data-urlencode 'outSR=4326' \
    --data-urlencode 'returnGeometry=false'
  ```
- **How the parcel ID is obtained / caveats:** The handler builds a `LIKE '%…%'` clause over `site_address` on the City's SmartGov-synced parcel layer and maps each feature's `parcel_number` to `apn`. It is an intentionally ambiguous substring match (the code warns "20205 N JOHN WAYNE" also matches "20265 N JOHN WAYNE PKWY"). No `token` is sent (an empty token yields error 498). `assessor_parcel_search` (pinal-assessor) is a second address route: `SITEADDRESS LIKE 'ADDRESS%'` → `PARCELID`.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `assessor_parcel_search` — source `pinal-assessor`, module `src/sources/pinal-assessor/gis-search.ts`
- **Upstream request:** `GET https://gis.pinal.gov/mapping/rest/services/TaxParcels/MapServer/3/query?f=json&geometry={"x":LON,"y":LAT}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=…&outSR=4326&returnGeometry=false`
- **Tool input schema (coordinate fields):**
  ```json
  {
    "type": "object",
    "properties": {
      "apn": { "type": "string" },
      "address": { "type": "string" },
      "owner": { "type": "string" },
      "subdivision": { "type": "string" },
      "longitude": { "type": "number", "description": "WGS84 longitude for a point-in-polygon lookup." },
      "latitude": { "type": "number", "description": "WGS84 latitude for a point-in-polygon lookup." },
      "maxResults": { "type": "number" }
    },
    "required": []
  }
  ```
- **Sample response JSON (shape the handler returns):**
  ```json
  {
    "success": true,
    "data": {
      "source": "Pinal County ArcGIS TaxParcels (gis.pinal.gov/mapping) — public, anonymous",
      "count": 1,
      "parcels": [
        {
          "PARCELID": "512049250",
          "OWNERNME1": "…",
          "SITEADDRESS": "…",
          "fullCashValue": 000000,
          "limitedPropertyValue": 000000,
          "valuationWarning": "CNTASSDVAL/CNTTXBLVAL are FCV/LPV, not assessed value"
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -G 'https://gis.pinal.gov/mapping/rest/services/TaxParcels/MapServer/3/query' \
    --data-urlencode 'f=json' \
    --data-urlencode 'geometry={"x":LON,"y":LAT}' \
    --data-urlencode 'geometryType=esriGeometryPoint' \
    --data-urlencode 'inSR=4326' \
    --data-urlencode 'spatialRel=esriSpatialRelIntersects' \
    --data-urlencode 'outFields=*' \
    --data-urlencode 'outSR=4326' \
    --data-urlencode 'returnGeometry=false'
  ```
- **How the parcel ID is obtained / caveats:** When `longitude`+`latitude` are both finite, the handler switches to an `esriGeometryPoint` intersect (`inSR=4326`) against the county TaxParcels layer and returns each feature's `PARCELID`. `returnGeometry=false`, so the point→parcel resolution yields the ID (and attributes) but no boundary geometry. `maricopa-az-gis` itself has no coordinate→parcel tool (`maricopa_city_parcel_lookup` takes apn/address only; `maricopa_city_property_profile` takes lon/lat but returns zoning/overlay layers, not a parcel ID) — this capability comes from the county `pinal-assessor` module that this jurisdiction also loads.

## Not supported
- **Q3 (Parcel ID → WGS84 polygon/GeoJSON): N.** No tool available to this jurisdiction returns the parcel boundary geometry to the caller. `maricopa_city_parcel_lookup` queries with `returnGeometry:'false'` (it returns only centroid `longitude`/`latitude`, not a polygon). The `pinal-*` tools that *do* fetch parcel rings — `pinal_zoning_lookup`, `pinal_plat_citation`, `pinal_property_profile` (via `getParcelRings` in `src/lib/property-profile-core.ts`) — request the rings in WGS84 (`outSR=4326`) **only for internal use** (to intersect zoning / plat / catalog layers) and never surface the parcel polygon in their return payloads. `pinal_situs_lookup` returns geometry, but of the address *point*, not the parcel polygon. So the underlying data is WGS84-capable, but no exposed tool emits the parcel boundary.
