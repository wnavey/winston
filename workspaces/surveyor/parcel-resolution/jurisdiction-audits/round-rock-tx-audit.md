# Round Rock, TX — Parcel Resolution Audit

- **Slug:** `round-rock-tx`
- **County:** Williamson · **State:** TX
- **Parcel sources reviewed:** `wcad` (`src/sources/wcad/{search.ts,details.ts,client.ts}`), `round-rock-gis` (`src/sources/round-rock-gis/{parcel-lookup.ts,property-profile.ts,config.ts}`), shared `src/lib/gis-client.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `wcad_search` | `src/sources/wcad` |
| 2. Lat/Lon → Parcel ID | N | — | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `rr_parcel_lookup` | `src/sources/round-rock-gis` |

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
          "propertyQuickRefID": "R538863",
          "propertyNumber": "...",
          "ownerName": "KENNEY FORT HOLDINGS LLC",
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
- **How the parcel ID is obtained / caveats:** The handler maps each upstream `ResultList[].PropertyQuickRefID` into `results[].propertyQuickRefID` — the WCAD PropertyQuickRefID (e.g. `R538863`) that keys the Round Rock GIS tools. Same free quick-search endpoint serves address/owner/property-ID; `searchType` only documents intent.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `rr_parcel_lookup` — source `round-rock-gis`, module `src/sources/round-rock-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=102739&where=QuickRefID%3D%27<PARCEL_ID>%27`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "propertyId": { "type": "string", "description": "WCAD PropertyQuickRefID (e.g. \"R538863\")" }
    },
    "required": ["propertyId"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "propertyId": "R538863",
      "wilcoParcel": { "quickRefID": "R538863", "siteAddress": "...", "acres": 5.969 },
      "rrParcel": { "parcelId": "...", "subdivision": "...", "mffe": "...", "status": "Active" },
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
  curl "https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=102739&where=QuickRefID%3D%27R538863%27"
  ```
- **How the parcel ID is obtained / caveats:** **Partial** because the polygon boundary (`geometry.rings`) is returned in **EPSG:102739 (State Plane Texas Central, US Feet)** — the handler hardcodes `outSR=${gisConfig.spatialReference}` = `102739` — not WGS84 and not GeoJSON. It returns only the State Plane `centroid` (no WGS84 projection). The secondary RR parcels layer (`Base/Parcels/0`, matched by `RCODE`) is queried with `returnGeometry=false` and de-duplicates retired records; it adds attributes (MFFE, status), not WGS84 geometry. A WGS84/GeoJSON polygon would require re-querying the WilCo layer with `outSR=4326` or re-projecting the rings.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate. `wcad_search` takes only a text query; `wcad_details`, `rr_parcel_lookup`, `rr_zoning_lookup`, `rr_property_profile`, and `rr_adjacent_context` all require `propertyId` (WCAD QuickRefID). No point-in-parcel / `parcel_at_point` handler exists in the Round Rock sources. (The tool's file-header comment mentions "or by point geometry," but the implemented handler and input schema accept only `propertyId`.)
