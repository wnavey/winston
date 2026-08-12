# Pearland, TX — Parcel Resolution Audit

- **Slug:** `pearland-tx`
- **County:** Brazoria (+ Harris) · **State:** TX
- **Parcel sources reviewed:** `hcad-gis` (`src/sources/hcad-gis/{search,parcel-lookup,client,config}.ts`), `brazoria-cad` (`src/sources/brazoria-cad/{search,details,client}.ts`), `pearland-gis` (`src/sources/pearland-gis/{config,zoning-lookup,property-profile}.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `hcad_search` / `brazoria_cad_search` | `src/sources/hcad-gis`, `src/sources/brazoria-cad` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` | — |

Pearland straddles two counties: **Harris** (Lower Kirby / SH-288 corridor) → HCAD; **Brazoria** (most of the city) → Brazoria CAD. The City of Pearland GIS publishes **no parcel layer** — its tools are point-in-polygon only over planning/regulatory overlays.

### Q1 — Address → Parcel ID  ✅
- **Tool:** `hcad_search` — source `hcad-gis`, module `src/sources/hcad-gis/{search,client}.ts` (Brazoria: `brazoria_cad_search`)
- **Upstream request (Harris):** `GET https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?where=site_str_num=NUM AND UPPER(site_str_name) LIKE '%NAME%'&outFields=...&returnGeometry=false&outSR=4326&f=json`
- **Upstream request (Brazoria):** `GET https://esearch.brazoriacad.org/search/requestSessionToken` then `POST https://esearch.brazoriacad.org/search/SearchResults?keywords=ADDRESS` (BIS Consultants esearch, token in body).
- **Tool input schema (`hcad_search`):**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "owner", "hcadNum"] }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON (`hcad_search`):**
  ```json
  { "success": true, "data": { "resultCount": 1, "results": [
    { "hcadNum": "1294200000001", "siteAddress": "1000 BASS PRO DR", "ownerName": "...", "legalDescription": "...", "totalMarketValue": 1234567 }
  ] } }
  ```
- **Sample response JSON (`brazoria_cad_search`):**
  ```json
  { "success": true, "data": { "resultCount": 1, "results": [
    { "propertyId": "544787", "geoId": "7943-2101-019", "address": "...", "ownerName": "...", "legalDescription": "... (PEARLAND) BLK 1 LOT 19", "subdivision": "..." }
  ] } }
  ```
- **Sample curl (upstream, Harris):**
  ```bash
  curl "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?where=site_str_num=1000%20AND%20UPPER(site_str_name)%20LIKE%20'%25BASS%20PRO%25'&outFields=HCAD_NUM,site_str_name&returnGeometry=false&outSR=4326&f=json"
  ```
- **How the parcel ID is obtained / caveats:** HCAD splits the address into `site_str_num` + `site_str_name LIKE` and returns `HCAD_NUM` (13-digit account). Brazoria CAD returns `propertyId` (integer) + `geoId` (hyphenated). Identify the county first (HCAD north, Brazoria south).

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate-to-parcel tool. `hcad_search` / `brazoria_cad_search` accept address/owner/id only. Pearland GIS **has no parcel fabric** (`config.ts`: "Pearland does NOT publish a parcel layer") — `pearland_zoning_lookup` / `pearland_property_profile` take a WGS84 point but return only planning/overlay features, never a parcel account.
- **Q3 (Parcel ID → WGS84 polygon/GeoJSON):** No tool returns a parcel boundary. `hcad_parcel_lookup` requests geometry at `outSR=4326` but its handler returns **only the centroid** (`centroidOf`), discarding the rings — no polygon reaches the caller. `brazoria_cad_details` returns no geometry at all (search-API record only). Pearland GIS has no parcel layer. Therefore even a native-SR polygon is unavailable → **N** (not merely Partial).
