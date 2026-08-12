# Jarrell, TX — Parcel Resolution Audit

- **Slug:** `jarrell-tx`
- **County:** Williamson · **State:** TX
- **Parcel sources reviewed:** `wcad` (`src/sources/wcad/{search.ts,details.ts,client.ts}`), `jarrell-gis` (`src/sources/jarrell-gis/{parcel-lookup.ts,property-profile.ts,zoning-lookup.ts,config.ts}`), shared `src/lib/gis-client.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `wcad_search` | `src/sources/wcad` |
| 2. Lat/Lon → Parcel ID | N | — | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `jarrell_parcel_lookup` | `src/sources/jarrell-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `wcad_search` — source `wcad`, module `src/sources/wcad/search.ts` (client `src/sources/wcad/client.ts`)
- **Upstream request:** `GET https://search.wcad.org/ProxyT/Search/Properties/quick/?f=<ADDRESS>&pn=1&st=4&so=desc&pt=RP;PP;MH;NR&ty=<YEAR>`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "street address, owner name, or property ID" },
      "searchType": { "type": "string", "enum": ["address", "owner", "propertyId"] },
      "page": { "type": "number" },
      "taxYear": { "type": "number" }
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
      "currentPage": 1,
      "results": [
        {
          "propertyQuickRefID": "R500629",
          "propertyNumber": "...",
          "ownerName": "WAL-MART REAL ESTATE BUSINESS TRUST",
          "situsAddress": "860 FB SCHWERTNER RD",
          "taxYear": 2026
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://search.wcad.org/ProxyT/Search/Properties/quick/?f=860%20FB%20SCHWERTNER%20RD&pn=1&st=4&so=desc&pt=RP;PP;MH;NR&ty=2026'
  ```
- **How the parcel ID is obtained / caveats:** The handler maps each upstream `ResultList[].PropertyQuickRefID` into `results[].propertyQuickRefID` — the WCAD PropertyQuickRefID (e.g. `R500629`) that keys the Jarrell GIS tools. Same free quick-search endpoint serves address/owner/property-ID; `searchType` only documents intent.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `jarrell_parcel_lookup` — source `jarrell-gis`, module `src/sources/jarrell-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=102739&where=QuickRefID%3D%27<PARCEL_ID>%27` (plus two point-in-polygon jurisdiction checks against `county_incorporated_cities/0` and `rb/rb_parcels_mud_etj/0` using the computed centroid)
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "propertyId": { "type": "string", "description": "WCAD PropertyQuickRefID (e.g. \"R500629\")" }
    },
    "required": ["propertyId"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "propertyId": "R500629",
      "wilcoParcel": { "quickRefID": "R500629", "siteAddress": "860 FB SCHWERTNER RD", "taxingUnits": ["CJA", "F02", "SJA"] },
      "jurisdiction": {
        "inJarrellCityLimits": true,
        "inJarrellEtj": false,
        "taxCodeIndicators": { "cityOfJarrell": true, "jarrellFire": true, "jarrellIsd": true }
      },
      "geometry": {
        "rings": [[[3110000.1, 10120000.2], "..."]],
        "centroid": { "x": 3110050.0, "y": 10120025.0 },
        "spatialReference": 102739
      }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=102739&where=QuickRefID%3D%27R500629%27"
  ```
- **How the parcel ID is obtained / caveats:** **Partial** because the polygon boundary (`geometry.rings`) is returned in **EPSG:102739 (State Plane Texas Central, US Feet)** — the handler hardcodes `outSR=${gisConfig.spatialReference}` = `102739` — not WGS84 and not GeoJSON. This module returns **no** WGS84 centroid at all (only the State Plane `centroid`); the field guide explicitly flags a "coordinate gotcha" that the agent must project to WGS84 itself. The WilCo layer would accept `outSR=4326`, but the tool does not request it.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a caller-supplied coordinate. `wcad_search` takes only a text query; `jarrell_parcel_lookup`, `jarrell_property_profile`, `jarrell_zoning_lookup`, and `jarrell_comprehensive_plan_lookup` all require `propertyId` (WCAD QuickRefID). Note: `jarrell_parcel_lookup` *does* run internal point-in-polygon checks, but only against the parcel's own computed centroid to determine city/ETJ membership — it does not accept a lat/lon input and does not resolve an arbitrary point to a parcel ID.
