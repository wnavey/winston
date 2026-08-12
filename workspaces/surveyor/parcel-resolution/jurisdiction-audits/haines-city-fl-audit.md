# Haines City, FL — Parcel Resolution Audit

- **Slug:** `haines-city-fl`
- **County:** Polk · **State:** FL
- **Parcel sources reviewed:** `polkpa` (`src/sources/polkpa/{index,search,client}.ts`), `polk-county-gis` (`src/sources/polk-county-gis/{index,parcel-lookup,config}.ts`), `haines-city-gis` (`src/sources/haines-city-gis/flu-lookup.ts`); shared `src/lib/gis-client.ts`.

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `polkpa_search` | `src/sources/polkpa` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `polk_county_gis_parcel` | `src/sources/polk-county-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `polkpa_search` — source `polkpa`, module `src/sources/polkpa/search.ts` (+ `client.ts`)
- **Upstream request:** `POST https://www.polkflpa.gov/CamaSearch.aspx` — a bespoke ASP.NET WebForms search (stateful `__VIEWSTATE` handshake) that returns a results grid of 18-digit parcel ids. (Backing host `polkflpa.gov`; the parse layer extracts the grid rows.)
- **How it works:** `searchType:"address"` drives the CAMA WebForms search and parses each results-grid row into `{ parcelId (18-digit), owner, siteAddress, lastSaleDate }`. The 18-digit `parcelId` is the universal key for every downstream Polk tool.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "owner", "parcel"] }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON:**
  ```json
  {
    "success": true,
    "data": {
      "resultCount": 1,
      "results": [
        { "parcelId": "272719744117000010", "owner": "MATHEWS FLORIDA INVESTMENTS", "siteAddress": "1004 COMMERCE AVE W", "lastSaleDate": "..." }
      ]
    }
  }
  ```
- **Sample curl:** Browser-automation-adjacent (stateful WebForms POST — `CamaSearch.aspx` requires a `__VIEWSTATE`/`__EVENTVALIDATION` handshake, not a clean single-shot GET). MCP-call form:
  ```bash
  surveyor call polkpa polkpa_search --args '{"query":"COMMERCE AVE W","searchType":"address"}'
  ```
- **How the parcel ID is obtained / caveats:** `parcelId` is parsed from the CAMA results grid. The roll is WAF-throttled (~10 rapid requests trip a 302 to a denied page); reuse the parcelId once obtained. The mailing/situs ZIP city is NOT a reliable incorporation test — use `polkpa_parcel_details` (Municipality code 90420) for that.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `polk_county_gis_parcel` — source `polk-county-gis`, module `src/sources/polk-county-gis/parcel-lookup.ts` (+ `config.ts`)
- **Upstream request:** `GET https://gis.polk-county.net/server/rest/services/Map_Property_Appraiser/MapServer/1/query?f=json&outFields=*&returnGeometry=true&outSR=4326&where=PARCELID='<id>'`
- **How it works:** takes the 18-digit PARCELID and queries the authoritative county Parcels layer with `returnGeometry=true` and `outSR=4326` (the module's `gisConfig.spatialReference = 4326`). Returns `geometry.rings` + a computed centroid, tagged `spatialReference: 4326` with `lon`/`lat` convenience fields.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "parcelId": { "type": "string" } },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON:**
  ```json
  {
    "success": true,
    "data": {
      "parcelId": "272719744117000010",
      "roll": { "owner": "MATHEWS FLORIDA INVESTMENTS", "siteAddress": "...", "propCity": "HAINES CITY", "dorUse": "..." },
      "geometry": {
        "rings": [[[-81.6416, 28.1175], [-81.6412, 28.1175], "..."]],
        "centroid": { "x": -81.64144, "y": 28.11739 },
        "spatialReference": 4326,
        "lon": -81.64144, "lat": 28.11739
      },
      "cityBoundaryTest": { "status": "in-city", "cityName": "Haines City" }
    }
  }
  ```
- **Sample curl (against upstream):**
  ```bash
  curl "https://gis.polk-county.net/server/rest/services/Map_Property_Appraiser/MapServer/1/query?f=json&outFields=*&returnGeometry=true&outSR=4326&where=PARCELID%3D%27272719744117000010%27"
  ```
- **How the geometry is obtained / caveats:** rings are returned in WGS84 (ArcGIS rings, `outSR=4326`) — required datum met. The whole module standardizes on SR 4326 so the centroid feeds the federal/FEMA point tools directly.

## Not supported
- **Q2 (Lat/Lon → Parcel ID): N.** No tool resolves a coordinate to a parcel id. `polkpa_search` takes only address/owner/parcel strings. `polk_county_gis_parcel`, `polk_county_gis_property_profile`, and `polk_county_gis_adjacent` all key on the 18-digit PARCELID. `haines_city_flu_lookup` accepts lon/lat but returns a coarse CFRPC Future-Land-Use class + an in/out-of-city test + PDF pointers — no parcel/account id. So coordinate→parcel is unsupported.
