# Georgetown, TX — Parcel Resolution Audit

- **Slug:** `georgetown-tx`
- **County:** Williamson · **State:** TX
- **Parcel sources reviewed:** `wcad` (`src/sources/wcad/{search.ts,details.ts,client.ts}`), `georgetown-gis` (`src/sources/georgetown-gis/{parcel-lookup.ts,property-profile.ts,config.ts}`), shared `src/lib/gis-client.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `wcad_search` | `src/sources/wcad` |
| 2. Lat/Lon → Parcel ID | N | — | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `gtx_parcel_lookup` | `src/sources/georgetown-gis` |

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
          "propertyQuickRefID": "R648705",
          "propertyNumber": "...",
          "ownerName": "PDC WILLIAMS PLAZA LTD",
          "situsAddress": "...",
          "taxYear": 2026
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://search.wcad.org/ProxyT/Search/Properties/quick/?f=<ADDRESS>&pn=1&st=4&so=desc&pt=RP;PP;MH;NR&ty=2026'
  ```
- **How the parcel ID is obtained / caveats:** The handler maps each upstream `ResultList[].PropertyQuickRefID` into `results[].propertyQuickRefID` — the WCAD PropertyQuickRefID (e.g. `R648705`) that keys every downstream Georgetown GIS tool. Same free quick-search endpoint serves address/owner/property-ID; `searchType` only documents intent. Use the module-shaped `/quick/` GET (a bare `/Search/Properties?f=...` returns an empty envelope, per the WCAD portal quirk note).

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `gtx_parcel_lookup` — source `georgetown-gis`, module `src/sources/georgetown-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=102739&where=QuickRefID%3D%27<PARCEL_ID>%27`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "propertyId": { "type": "string", "description": "WCAD PropertyQuickRefID (e.g. \"R648705\")" }
    },
    "required": ["propertyId"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "propertyId": "R648705",
      "wilcoParcel": { "quickRefID": "R648705", "siteAddress": "...", "acres": 5.1 },
      "gtxParcel": { "wcadr": "R648705", "subdivision": "...", "jurisdiction": "..." },
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
  curl "https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=102739&where=QuickRefID%3D%27R648705%27"
  ```
- **How the parcel ID is obtained / caveats:** **Partial** because the polygon boundary (`geometry.rings`) is returned in **EPSG:102739 (State Plane Texas Central, US Feet)** — the handler hardcodes `outSR=${gisConfig.spatialReference}` = `102739` — not WGS84 and not GeoJSON. Unlike Cedar Park, `gtx_parcel_lookup` does **not** even project a WGS84 centroid; it returns only the State Plane `centroid`. No tool delivers a WGS84/GeoJSON polygon; a WGS84 boundary would require re-querying the WilCo layer with `outSR=4326` or re-projecting the rings.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate. `wcad_search` takes only a text query; `wcad_details`, `gtx_parcel_lookup`, `gtx_zoning_lookup`, `gtx_property_profile`, and `gtx_adjacent_context` all require `propertyId` (WCAD QuickRefID). No point-in-parcel / `parcel_at_point` handler exists in the Georgetown sources.
