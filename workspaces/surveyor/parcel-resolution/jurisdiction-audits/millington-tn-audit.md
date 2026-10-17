# Millington / Shelby County, TN — Parcel Resolution Audit

- **Slug:** `millington-tn`
- **County:** Shelby · **State:** TN
- **Parcel sources reviewed:** `shelby-assessor` (`src/sources/shelby-assessor/search.ts`, `parcel-lookup.ts`, `client.ts`, `config.ts`), `shelby-gis` (`src/sources/shelby-gis/flood.ts`, `property-profile.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `shelby_assessor_search` | `src/sources/shelby-assessor` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` (only centroid surfaced) | `src/sources/shelby-assessor` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `shelby_assessor_search` — source `shelby-assessor`, module `src/sources/shelby-assessor/search.ts` (query builder + fetch in `client.ts`)
- **Upstream request:** `GET https://scgis.shelbycountytn.gov/serverhigh/rest/services/Parcel/CurrentParcels/MapServer/0/query?where=<addr WHERE>&outFields=…,PARCELID,…&returnGeometry=false&outSR=4326&resultRecordCount=25&f=json` — issued through a `node:https` client with a browser UA + legacy-TLS renegotiation (WAF/TLS quirks).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "owner", "parcel"] },
      "municipality": { "type": "string" }
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
        { "parcelId": "M0105   00215", "owner": "…", "situsAddress": "8669 US HIGHWAY 51 N",
          "zoning": "…", "landUse": "…", "subdivision": "…", "municipality": "MILLINGTON" }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -A 'Mozilla/5.0 Chrome/126' \
    "https://scgis.shelbycountytn.gov/serverhigh/rest/services/Parcel/CurrentParcels/MapServer/0/query?where=PAR_ADDR1%20LIKE%20'8669%20%25'%20AND%20UPPER(PAR_ADDR1)%20LIKE%20'%25HIGHWAY%2051%25'&outFields=PARCELID,OWNER,PAR_ADDR1,MUNI,ZONING&returnGeometry=false&outSR=4326&f=json"
  ```
- **How the parcel ID is obtained / caveats:** For `searchType:"address"` the client parses the query into a house number (`PAR_ADDR1 LIKE '8669 %'`) + significant street-name tokens (`LIKE '%…%'`, AND-ed), drops street suffixes/directionals, and returns the normalized parcel records including `PARCELID`. Optional `municipality` filter (`MUNI = 'MILLINGTON'`) disambiguates common street names.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate-to-parcel tool. `shelby_assessor_search` accepts only address/owner/parcel; `shelby_assessor_parcel_lookup` takes a parcel ID. The `shelby-gis` tools (`shelby_flood_lookup`, `shelby_property_profile`) do accept a `lon`/`lat`, but they run point-in-polygon against the DFIRM flood layer and the ZoningCases overlay and return flood/zoning attributes only — they never return a parcel/PARCELID. A coordinate cannot be resolved to a parcel ID.
- **Q3 (Parcel ID → WGS84 polygon):** No tool returns the parcel boundary geometry. `shelby_assessor_parcel_lookup` does query the Assessor layer with `returnGeometry=true&outSR=4326`, but the handler discards the polygon and returns only the computed WGS84 **centroid** (`centroidOf` → `{ lon, lat }`) plus attributes — the rings/GeoJSON are never surfaced to the caller. So while the upstream geometry is fetched in WGS84, no tool exposes the polygon; marked **N** (a centroid is not a boundary). (`shelby_property_profile` likewise consumes the centroid internally and returns overlay data, not geometry.)
