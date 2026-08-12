# Punta Gorda, FL — Parcel Resolution Audit

- **Slug:** `punta-gorda-fl`
- **County:** Charlotte · **State:** FL
- **Parcel sources reviewed:** `ccpa` (`src/sources/ccpa/{index,search,details,client,config}.ts`), `ccgis` (`src/sources/ccgis/{index,property-profile,layers,config}.ts`); shared `src/lib/{property-profile-core,gis-client}.ts`. (Punta Gorda is in-city Charlotte County; property data is County-run, so it uses the identical `ccpa` + `ccgis` modules as `charlotte-county-fl`.)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `ccpa_search` | `src/sources/ccpa` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` | — |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `ccpa_search` — source `ccpa`, module `src/sources/ccpa/search.ts` (+ `client.ts`)
- **Upstream request:** `GET https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17/query?f=json&where=<WHERE>&outFields=<fields>&outSR=4326`
- **How it works:** `searchType:"address"` builds an ArcGIS WHERE against the county Property Ownership roll layer (layer 17) — `streetnumber = '<n>' AND UPPER(propertyaddress) LIKE '%<token>%'` — and returns the feature's `ACCOUNT` (12-digit) attribute. The same layer/tool serves in-city Punta Gorda parcels (the county PA maintains the tax roll for city parcels too).
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
- **Sample response JSON (shape returned to caller):**
  ```json
  {
    "success": true,
    "data": {
      "resultCount": 1,
      "results": [
        {
          "account": "412321151011",
          "owner": "BIG SREG JONES LOOP LLC",
          "situsAddress": "26140 JONES LOOP RD",
          "zoningCode": "HC"
        }
      ]
    }
  }
  ```
- **Sample curl (against upstream):**
  ```bash
  curl 'https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17/query?f=json&where=streetnumber%3D%2726140%27%20AND%20UPPER(propertyaddress)%20LIKE%20%27%25JONES%25%27&outFields=ACCOUNT,ownersname,propertyaddress&outSR=4326&returnGeometry=false'
  ```
- **How the parcel ID is obtained / caveats:** `ACCOUNT` is read off layer 17 attributes. `zoningCode` on the roll is an assessor convenience — the authoritative in-city district comes from the `pg-zoning` layer in `ccgis_property_profile`, not from search.

## Not supported
- **Q2 (Lat/Lon → Parcel ID): N.** No coordinate-accepting tool. `ccpa_search` takes only address/owner/parcel; `ccgis_property_profile` takes only `propertyId` (ACCOUNT). No point-in-parcel lookup returns an ACCOUNT from lat/lon.
- **Q3 (Parcel ID → WGS84 polygon): N.** No tool returns the parcel boundary geometry. `ccpa`'s `queryParcels` can request `outSR=4326` geometry, but neither tool handler enables it and `normalizeParcel` discards geometry. `ccgis_property_profile` fetches the polygon internally (Web Mercator WKID 102100) only to intersect overlays and returns overlay results, not the rings.
