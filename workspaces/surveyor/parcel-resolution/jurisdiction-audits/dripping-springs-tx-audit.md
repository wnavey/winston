# Dripping Springs, TX — Parcel Resolution Audit

- **Slug:** `dripping-springs-tx`
- **County:** Hays · **State:** TX
- **Parcel sources reviewed:** `hayscad` (`src/sources/hayscad/search.ts`, `details.ts`, `client.ts`), `hays-county-gis` (`src/sources/hays-county-gis/parcel-lookup.ts`, `property-profile.ts`, `config.ts`), `dripping-springs-gis` (`src/sources/dripping-springs-gis/special-districts.ts`, `config.ts`), shared `src/lib/gis-client.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `hayscad_search` | `src/sources/hayscad` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `hays_parcel_lookup` | `src/sources/hays-county-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `hayscad_search` — source `hayscad`, module `src/sources/hayscad/search.ts`
- **Upstream request:** `GET https://esearch.hayscad.com/Search/SearchResults?keywords=<ADDRESS>&isArb=false&page=1&pageSize=25`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "situs address (e.g. \"330 MERCER ST\"), owner name, Quick Ref ID, or geo ID" },
      "searchType": { "type": "string", "enum": ["address", "owner", "parcelId"], "description": "advisory only — HaysCAD uses one full-text keywords search" },
      "page": { "type": "number" }
    },
    "required": ["query"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "resultCount": 1,
      "totalResults": 1,
      "totalPages": 1,
      "page": 1,
      "results": [
        {
          "propertyId": "R23565",
          "geoId": "11-1425-0100-00600-4",
          "ownerName": "CARTER CORE FUND I LP",
          "address": "330 MERCER ST",
          "legalDescription": "...",
          "appraisedValue": 752670
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -H 'User-Agent: Mozilla/5.0' -H 'X-Requested-With: XMLHttpRequest' \
    -H 'Referer: https://esearch.hayscad.com/' \
    'https://esearch.hayscad.com/Search/SearchResults?keywords=330%20MERCER%20ST&isArb=false&page=1&pageSize=25'
  ```
- **How the parcel ID is obtained / caveats:** The BIS eSearch portal exposes a single open JSON full-text `keywords` endpoint; the handler maps each `resultsList[]` row to `propertyId` (the HaysCAD Quick Ref ID, e.g. `R23565`) plus `geoId`. That `propertyId` is the parcel key carried into `hays_parcel_lookup` / `hayscad_details`. `searchType` is advisory only (all intents funnel into the same keywords query).

## Not supported

- **Q2 (Lat/Lon → Parcel ID):** No tool in this jurisdiction accepts a coordinate to return a parcel ID. `hays_parcel_lookup` and `hays_property_profile` both take a HaysCAD Quick Ref ID / prop_id (not a coordinate). `dripping_springs_special_districts` *does* take a WGS84 lat/lng, but it point-intersects the city's TIRZ/PID/zoning/DA overlay layers and returns district membership only — it never returns a parcel/account ID. There is no `parcel_at_point` / point-in-parcel tool wired for this jurisdiction.
- **Q3 (Parcel ID → WGS84 polygon) — Partial:** `hays_parcel_lookup` returns the parcel boundary `geometry.rings`, but it requests `outSR=2278` (NAD83 / Texas Central ftUS, State Plane) — the rings come back in native State Plane, not WGS84/GeoJSON. Only a **centroid** is returned in WGS84 (a second query with `returnCentroid=true&outSR=4326`). The boundary polygon itself is never emitted in EPSG:4326 or as GeoJSON, so this is Partial: WGS84 point yes, WGS84 polygon no.
