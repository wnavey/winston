# Houston, TX — Parcel Resolution Audit

- **Slug:** `houston-tx`
- **County:** Harris · **State:** TX
- **Parcel sources reviewed:** `hcad-gis` (`src/sources/hcad-gis/{index,search,parcel-lookup,client,config}.ts`), plus checked `harris-county-clerk` (`src/sources/harris-county-clerk/index.ts`) for parcel-ID capability — it adds none. (This guide also lists `fbcad`/`fort-bend-county-clerk` for the SW fringe, out of scope for this Harris-County audit assignment.)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `hcad_search` | `src/sources/hcad-gis` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` (`hcad_parcel_lookup` returns centroid only) | `src/sources/hcad-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `hcad_search` — source `hcad-gis`, module `src/sources/hcad-gis/search.ts` (WHERE built in `client.ts`)
- **Upstream request:** `GET https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?where=<clause>&outFields=HCAD_NUM,...&returnGeometry=false&outSR=4326&resultRecordCount=25&f=json`
  - For `searchType:"address"`: first token → `site_str_num = <num>`, remaining non-directional/non-suffix words → `UPPER(site_str_name) LIKE '%<NAME>%'`, `AND`-joined.
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
          "hcadNum": "0401600000064",
          "stateClass": "A1",
          "ownerName": "...",
          "siteAddress": "...",
          "siteCity": "HOUSTON",
          "siteCounty": "HARRIS",
          "legalDescription": "BRAESWOOD PLACE, BLOCK 12, LOT 7"
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
    --data-urlencode 'outFields=HCAD_NUM,owner_name_1,site_str_name,site_str_num,legal_dscr_1' \
    --data-urlencode 'returnGeometry=false' \
    --data-urlencode 'outSR=4326' \
    --data-urlencode 'f=json'
  ```
- **How the parcel ID is obtained / caveats:** `normalizeProperty()` maps ArcGIS `HCAD_NUM` → `hcadNum` (13-digit account). That is the parcel ID / key for `hcad_parcel_lookup`. HCAD covers the vast majority of City-of-Houston parcels; Fort Bend / Montgomery fringe parcels use other CAD modules (fbcad) or a manual fallback, not audited here.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate-to-parcel tool. `hcad_search` takes only `address`/`owner`/`hcadNum`; `hcad_parcel_lookup` takes only `hcadNum`. Lat/lon-input tools in the Houston toolset (`hcfcd_flood_context`, plus the shared overlay tools) return flood/watershed/overlay context, not a parcel/HCAD account. No point-in-parcel query exists.
- **Q3 (Parcel ID → WGS84 polygon/GeoJSON):** `hcad_parcel_lookup` fetches geometry with `returnGeometry=true&outSR=4326`, but the handler reduces `features[0].geometry.rings` to a single `centroid` `{lon, lat}` via `centroidOf()` and returns only that point. The boundary polygon is never surfaced, so no WGS84 parcel polygon/GeoJSON is returned. (Rings are already in EPSG:4326 internally — returning them would make this Y.)
