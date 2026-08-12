# Hays County, TX — Parcel Resolution Audit

- **Slug:** `hays-county-tx`
- **County:** Hays · **State:** TX
- **Parcel sources reviewed:** `hayscad` (`src/sources/hayscad/search.ts`, `details.ts`, `client.ts`), `hays-county-gis` (`src/sources/hays-county-gis/parcel-lookup.ts`, `property-profile.ts`, `config.ts`), shared `src/lib/gis-client.ts`

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
      "query": { "type": "string", "description": "situs address, owner name, Quick Ref ID, or geo ID" },
      "searchType": { "type": "string", "enum": ["address", "owner", "parcelId"], "description": "advisory only" },
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
          "propertyId": "R184168",
          "geoId": "11-2603-000A-00100-2",
          "ownerName": "EDCOUCH COMMUNITY HOUSING FINANCE CORP",
          "address": "167 HARGRAVES DR",
          "legalDescription": "...",
          "appraisedValue": 35500000
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -H 'User-Agent: Mozilla/5.0' -H 'X-Requested-With: XMLHttpRequest' \
    -H 'Referer: https://esearch.hayscad.com/' \
    'https://esearch.hayscad.com/Search/SearchResults?keywords=167%20HARGRAVES%20DR&isArb=false&page=1&pageSize=25'
  ```
- **How the parcel ID is obtained / caveats:** Same open BIS eSearch full-text `keywords` endpoint as Dripping Springs (unincorporated Hays shares the CAD). Each `resultsList[]` row yields `propertyId` (Quick Ref ID `R#####`) + `geoId`. The bare numeric prop_id and the prefixed Quick Ref ID are two different HaysCAD key spaces — `hayscad_details` refuses a bare number to avoid the silent-wrong-parcel trap — but `hayscad_search` returns the prefixed ID directly, which is the parcel key for the GIS parcel layer.

## Not supported

- **Q2 (Lat/Lon → Parcel ID):** No coordinate-accepting tool returns a parcel ID. `hays_parcel_lookup` and `hays_property_profile` both key on the HaysCAD Quick Ref ID / prop_id (`hays_property_profile` internally resolves the parcel via `lookupParcel(propertyId)` then point-queries context overlays at the resulting centroid — the coordinate is derived from the ID, never accepted as input). No `parcel_at_point` tool is wired for this jurisdiction.
- **Q3 (Parcel ID → WGS84 polygon) — Partial:** `hays_parcel_lookup` returns `geometry.rings` from the `Hays_County_Parcels/FeatureServer/0` layer requested with `outSR=2278` (State Plane) — polygon in native SR, not WGS84/GeoJSON. A separate `returnCentroid=true&outSR=4326` query yields only a WGS84 **centroid**. WGS84 point yes, WGS84 boundary polygon no → Partial.
