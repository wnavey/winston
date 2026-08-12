# Pinal County, AZ — Parcel Resolution Audit

- **Slug:** `pinal-county-az`
- **County:** Pinal · **State:** AZ
- **Parcel sources reviewed:** `pinal-assessor` (`src/sources/pinal-assessor/gis-search.ts`, `detail.ts`, `config.ts`); `pinal-gis` (`src/sources/pinal-gis/property-profile.ts`, `zoning-lookup.ts`, `plat-citation.ts`, `situs-lookup.ts`, `config.ts` + `src/lib/property-profile-core.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `assessor_parcel_search` | `src/sources/pinal-assessor` |
| 2. Lat/Lon → Parcel ID | Y | `assessor_parcel_search` | `src/sources/pinal-assessor` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` | `-` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `assessor_parcel_search` (with `address`) — source `pinal-assessor`, module `src/sources/pinal-assessor/gis-search.ts`
- **Upstream request:** `GET https://gis.pinal.gov/mapping/rest/services/TaxParcels/MapServer/3/query?f=json&where=SITEADDRESS+LIKE+'ADDRESS%25'&outFields=…&outSR=4326&returnGeometry=false&resultRecordCount=25`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "apn": { "type": "string", "description": "Bare 9-character APN, no dashes. Exact match." },
      "address": { "type": "string", "description": "Situs address. Starts-with match against SITEADDRESS." },
      "owner": { "type": "string", "description": "Owner/entity name. Starts-with." },
      "subdivision": { "type": "string", "description": "CNVYNAME. Starts-with." },
      "longitude": { "type": "number" },
      "latitude": { "type": "number" },
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
          "PARCELID": "50501667A",
          "OWNERNME1": "…",
          "SITEADDRESS": "1161 E O'NEIL DR",
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
    --data-urlencode "where=SITEADDRESS LIKE 'ADDRESS%'" \
    --data-urlencode 'outFields=*' \
    --data-urlencode 'outSR=4326' \
    --data-urlencode 'returnGeometry=false' \
    --data-urlencode 'resultRecordCount=25'
  ```
- **How the parcel ID is obtained / caveats:** `buildWhere` maps a supplied `address` to `SITEADDRESS LIKE 'ADDRESS%'` (starts-with) on the county TaxParcels layer and returns each feature's `PARCELID`. `NAP` placeholder rows are filtered out. Also supports APN/owner/subdivision search on the same tool. A vacant parcel legitimately has an empty situs, so an address may not resolve for undeveloped land.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `assessor_parcel_search` (with `longitude`+`latitude`) — source `pinal-assessor`, module `src/sources/pinal-assessor/gis-search.ts`
- **Upstream request:** `GET https://gis.pinal.gov/mapping/rest/services/TaxParcels/MapServer/3/query?f=json&geometry={"x":LON,"y":LAT}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=…&outSR=4326&returnGeometry=false`
- **Tool input schema:** *(same schema as Q1 above; the coordinate path activates when both `longitude` and `latitude` are finite numbers)*
- **Sample response JSON (shape the handler returns):**
  ```json
  {
    "success": true,
    "data": {
      "source": "Pinal County ArcGIS TaxParcels (gis.pinal.gov/mapping) — public, anonymous",
      "count": 1,
      "parcels": [
        { "PARCELID": "50501667A", "OWNERNME1": "…", "SITEADDRESS": "…", "fullCashValue": 000000, "limitedPropertyValue": 000000, "valuationWarning": "…" }
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
- **How the parcel ID is obtained / caveats:** When both coordinates are finite the handler issues an `esriGeometryPoint` intersect (`inSR=4326`) against the TaxParcels layer and returns the intersecting feature's `PARCELID`. `returnGeometry=false`, so the point→parcel resolution yields the ID and attributes but not the boundary geometry.

## Not supported
- **Q3 (Parcel ID → WGS84 polygon/GeoJSON): N.** No exposed tool returns the parcel boundary polygon to the caller. `assessor_parcel_search` sets `returnGeometry:'false'`. The tools that internally fetch the parcel rings — `pinal_zoning_lookup` and `pinal_plat_citation` (each via a private `getParcelRings` helper) and `pinal_property_profile` (via `getParcelRings` in `src/lib/property-profile-core.ts`) — all request the rings in WGS84 (`outSR=4326`) purely to drive an intersect against zoning / plat / catalog layers, and none of them include the parcel geometry in their return payload (they return zoning attributes, plat citations, or per-layer catalogs respectively). `pinal_situs_lookup` returns geometry, but of the `SiteAddressPoint` (an address point), not the parcel polygon. `assessor_parcel_detail` scrapes the Assessor HTML page and carries no geometry. The upstream TaxParcels layer is WGS84-capable, but no tool emits the parcel boundary.
