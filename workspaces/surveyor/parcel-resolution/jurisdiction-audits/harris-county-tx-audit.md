# Harris County, TX — Parcel Resolution Audit

- **Slug:** `harris-county-tx`
- **County:** Harris · **State:** TX
- **Parcel sources reviewed:** `hcad-gis` (`src/sources/hcad-gis/{index,search,parcel-lookup,client,config}.ts`), plus checked `hcfcd` (`src/sources/hcfcd/flood-context.ts`) and `harris-county-clerk` (`src/sources/harris-county-clerk/index.ts`) for parcel-ID capability — neither adds any.

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `hcad_search` | `src/sources/hcad-gis` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` (`hcad_parcel_lookup` returns centroid only) | `src/sources/hcad-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `hcad_search` — source `hcad-gis`, module `src/sources/hcad-gis/search.ts` (WHERE built in `client.ts`)
- **Upstream request:** `GET https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?where=<clause>&outFields=HCAD_NUM,...&returnGeometry=false&outSR=4326&resultRecordCount=25&f=json`
  - For `searchType:"address"`, the WHERE is built by splitting the query: first token → `site_str_num = <num>`, remaining non-directional/non-suffix words → `UPPER(site_str_name) LIKE '%<NAME>%'`, joined with `AND`.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "For address: \"24700 Katy Fwy\". For owner: \"EHAJ\". For hcadNum: \"1328730020014\"." },
      "searchType": { "type": "string", "enum": ["address", "owner", "hcadNum"] }
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
      "results": [
        {
          "hcadNum": "1448410010001",
          "acctNum": "...",
          "stateClass": "F2",
          "ownerName": "MOLTO 290 BARKER CYPRESS ...",
          "siteAddress": "12020 BARKER CYPRESS",
          "siteCity": "CYPRESS",
          "siteCounty": "HARRIS",
          "legalDescription": "MOLTO 290 BARKER CYPRESS INDUSTRIAL RES A BLK 1",
          "acreage": "...",
          "totalMarketValue": null
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query' \
    --get \
    --data-urlencode "where=site_str_num = HOUSE_NUM AND UPPER(site_str_name) LIKE '%STREET%'" \
    --data-urlencode 'outFields=HCAD_NUM,owner_name_1,site_str_name,site_str_num,legal_dscr_1,Acreage' \
    --data-urlencode 'returnGeometry=false' \
    --data-urlencode 'outSR=4326' \
    --data-urlencode 'f=json'
  ```
- **How the parcel ID is obtained / caveats:** `normalizeProperty()` maps the ArcGIS attribute `HCAD_NUM` → `hcadNum` (13-digit account, no dashes). That value is the parcel ID and the key for `hcad_parcel_lookup`. Address parsing is heuristic (house-number token + fuzzy street `LIKE`), so ambiguous streets can return multiple rows.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate to identify a parcel. `hcad_search` only takes `address`/`owner`/`hcadNum`; `hcad_parcel_lookup` takes only `hcadNum`. The lat/lon-input tools in this jurisdiction (`hcfcd_flood_context`) do point-in-polygon against flood/watershed layers and return drainage context, not a parcel/HCAD account. No point-in-parcel query exists.
- **Q3 (Parcel ID → WGS84 polygon/GeoJSON):** `hcad_parcel_lookup` queries the HCAD Parcels layer with `returnGeometry=true&outSR=4326`, so WGS84 ring geometry is fetched — but the handler passes `features[0].geometry.rings` through `centroidOf()`/`computeCentroid()` and returns only the `centroid` `{lon, lat}` point. The boundary polygon is discarded and never surfaced to the caller, so no parcel polygon/GeoJSON is returned. (A one-line change to also return `features[0].geometry.rings` would make this Y, since the rings are already in EPSG:4326.)
