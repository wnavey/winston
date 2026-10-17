# Boulder, CO — Parcel Resolution Audit

- **Slug:** `boulder-co`
- **County:** Boulder · **State:** CO
- **Parcel sources reviewed:** `boulder-gis` — `src/sources/boulder-gis/parcel-search.ts`, `parcel-lookup.ts`, `property-profile.ts`, `config.ts`, `index.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `boulder_parcel_search` | `src/sources/boulder-gis` |
| 2. Lat/Lon → Parcel ID | N | `-` | `src/sources/boulder-gis` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `boulder_parcel_lookup` | `src/sources/boulder-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `boulder_parcel_search` — source `boulder-gis`, module `src/sources/boulder-gis/parcel-search.ts`
- **Upstream request:** `GET https://maps.bouldercolorado.gov/arcgis/rest/services/plan/EnerGovCss3/MapServer/1/query?f=json&where=UPPER(SITEADDRESS)+LIKE+'%25<ADDRESS>%25'&outFields=ACCOUNTNO,PARCELNUM,SITEADDRESS,OWNERPRIM,...&returnGeometry=false&resultRecordCount=25`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search term (address, owner name, account number, or parcel number)" },
      "searchType": { "type": "string", "enum": ["address", "owner", "account", "parcel"], "description": "address (default), owner, account (ACCOUNTNO like R0616353), or parcel (PARCELNUM like 146332300022)" }
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
      "query": "770 28TH ST",
      "resultCount": 1,
      "results": [
        {
          "accountNo": "R0616353",
          "parcelNum": "146332300022",
          "address": "770 28TH ST",
          "owner": "…",
          "legalDesc": "…",
          "cobpin": "173243000117",
          "subdivision": "…",
          "areaSqFt": 12345.6
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://maps.bouldercolorado.gov/arcgis/rest/services/plan/EnerGovCss3/MapServer/1/query?f=json&where=UPPER(SITEADDRESS)%20LIKE%20'%25770%2028TH%20ST%25'&outFields=ACCOUNTNO,PARCELNUM,SITEADDRESS,OWNERPRIM&returnGeometry=false&resultRecordCount=25"
  ```
- **How the parcel ID is obtained / caveats:** Builds a `UPPER(SITEADDRESS) LIKE '%…%'` WHERE clause against the EnerGov Parcels layer (layer 1) and returns `ACCOUNTNO` (Boulder County Assessor account number) plus `PARCELNUM` and `COBPIN` per match. Address is a substring LIKE match, so partial/uppercase street text works ("770 28TH ST", no city/state).

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `boulder_parcel_lookup` — source `boulder-gis`, module `src/sources/boulder-gis/parcel-lookup.ts`
- **Upstream request:** two parallel queries against `GET .../EnerGovCss3/MapServer/1/query` — one with `outSR=2876` (native attrs+geometry, `outFields=*`) and one with `outSR=4326&outFields=ACCOUNTNO&returnGeometry=true` (WGS84 rings for the GeoJSON).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "accountNo": { "type": "string", "description": "Boulder County ACCOUNTNO (e.g. \"R0616353\")" } },
    "required": ["accountNo"]
  }
  ```
- **Sample response JSON (trimmed):**
  ```json
  {
    "success": true,
    "data": {
      "accountNo": "R0616353",
      "parcelNum": "146332300022",
      "address": "770 28TH ST",
      "owner": "…",
      "geometry": {
        "native": { "rings": [[[x,y],…]], "spatialReference": 2876 },
        "centroid": { "x": 0, "y": 0 },
        "geojson": {
          "type": "Feature",
          "geometry": { "type": "Polygon", "coordinates": [[[-105.27,40.01],…]] },
          "properties": { "accountNo": "R0616353" }
        }
      }
    }
  }
  ```
- **Sample curl (WGS84 geometry leg):**
  ```bash
  curl "https://maps.bouldercolorado.gov/arcgis/rest/services/plan/EnerGovCss3/MapServer/1/query?f=json&where=ACCOUNTNO='<PARCEL_ID>'&outFields=ACCOUNTNO&returnGeometry=true&outSR=4326"
  ```
- **How the geometry is obtained / caveats:** Keyed by `ACCOUNTNO`. The handler explicitly issues a second query with `outSR=4326` and reprojects the ArcGIS rings into a GeoJSON `Feature` (`buildParcelGeoJSON`, ring-winding corrected). Native SR-2876 rings are also returned. WGS84 GeoJSON confirmed in code.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate. `boulder_parcel_search` takes only text (`address`/`owner`/`account`/`parcel`); `boulder_parcel_lookup`, `boulder_property_profile`, and `boulder_adjacent_context` all require `accountNo`. There is no point-in-polygon parcel-identify tool (the module has an `ADDRESSES_LAYER`/geocode-style layer defined in config but no exposed tool that resolves a coordinate to a parcel).
