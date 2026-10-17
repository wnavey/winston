# Cedar Park, TX — Parcel Resolution Audit

- **Slug:** `cedar-park-tx`
- **County:** Williamson · **State:** TX
- **Parcel sources reviewed:** `wcad` (`src/sources/wcad/{search.ts,details.ts,client.ts}`), `cedar-park-gis` (`src/sources/cedar-park-gis/{parcel-lookup.ts,property-profile.ts,zoning-lookup.ts,config.ts}`), shared `src/lib/gis-client.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `wcad_search` | `src/sources/wcad` |
| 2. Lat/Lon → Parcel ID | N | — | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `cp_parcel_lookup` | `src/sources/cedar-park-gis` |

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
          "propertyQuickRefID": "R631559",
          "propertyNumber": "...",
          "ownerName": "FLOOR AND DECOR OUTLETS OF AMERICA INC",
          "situsAddress": "1200 ARROWPOINT DR",
          "taxYear": 2026
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://search.wcad.org/ProxyT/Search/Properties/quick/?f=1200%20ARROWPOINT%20DR&pn=1&st=4&so=desc&pt=RP;PP;MH;NR&ty=2026'
  ```
- **How the parcel ID is obtained / caveats:** The handler maps each upstream `ResultList[].PropertyQuickRefID` into `results[].propertyQuickRefID` — the WCAD PropertyQuickRefID (e.g. `R631559`) that keys every downstream Cedar Park GIS tool. Same free quick-search endpoint serves address, owner, and property-ID queries; `searchType` only documents intent. Pick the `R`-prefix (real-property) record over any `P`-prefix (personal-property) hit.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `cp_parcel_lookup` — source `cedar-park-gis`, module `src/sources/cedar-park-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=102739&where=QuickRefID%3D%27<PARCEL_ID>%27`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "propertyId": { "type": "string", "description": "WCAD PropertyQuickRefID (e.g. \"R631559\")" }
    },
    "required": ["propertyId"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "propertyId": "R631559",
      "wcadParcel": { "quickRefID": "R631559", "siteAddress": "1200 ARROWPOINT DR", "acres": 3.1 },
      "geometry": {
        "rings": [[[3110000.1, 10120000.2], [3110100.4, 10120050.6], "..."]],
        "centroid": { "x": 3110050.0, "y": 10120025.0 },
        "centroidWgs84": { "latitude": 30.5321, "longitude": -97.7997 },
        "spatialReference": 102739
      }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=102739&where=QuickRefID%3D%27R631559%27"
  ```
- **How the parcel ID is obtained / caveats:** **Partial** because the polygon boundary (`geometry.rings`) is returned in **EPSG:102739 (State Plane Texas Central, US Feet)** — the handler hardcodes `outSR=${gisConfig.spatialReference}` = `102739` — not WGS84 and not GeoJSON. The tool does additionally project the parcel **centroid** to WGS84 (`geometry.centroidWgs84`, via the WilCo geometry service `/project` with `outSR=4326`), but that is a single point, not the boundary. A WGS84/GeoJSON polygon is not delivered by any tool; obtaining one would require re-requesting the WilCo layer with `outSR=4326` (the layer supports it) or re-projecting the rings.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate. `wcad_search` takes only a text query (address/owner/ID); `wcad_details`, `cp_parcel_lookup`, `cp_zoning_lookup`, and `cp_property_profile` all require `propertyId` (WCAD QuickRefID). There is no point-in-parcel / `parcel_at_point` handler in the Cedar Park sources.
