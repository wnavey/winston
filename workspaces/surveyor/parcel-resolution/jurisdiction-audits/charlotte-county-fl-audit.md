# Charlotte County, FL — Parcel Resolution Audit

- **Slug:** `charlotte-county-fl`
- **County:** Charlotte · **State:** FL
- **Parcel sources reviewed:** `ccpa` (`src/sources/ccpa/{index,search,details,client,config}.ts`), `ccgis` (`src/sources/ccgis/{index,property-profile,layers,config}.ts`); shared `src/lib/{property-profile-core,gis-client}.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `ccpa_search` | `src/sources/ccpa` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` | — |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `ccpa_search` — source `ccpa`, module `src/sources/ccpa/search.ts` (+ `client.ts`)
- **Upstream request:** `GET https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17/query?f=json&where=<WHERE>&outFields=<fields>&outSR=4326`
- **How it works:** `searchType:"address"` splits the query into a street number + street-name tokens and builds an ArcGIS WHERE against the county-published Property Ownership roll layer (layer 17): `streetnumber = '26140' AND UPPER(propertyaddress) LIKE '%JONES%' AND UPPER(propertyaddress) LIKE '%LOOP%'`. The returned feature's `ACCOUNT` attribute is the 12-digit parcel id.
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
          "zoningCode": "HC",
          "landUse": "...",
          "shortLegal": "..."
        }
      ]
    }
  }
  ```
- **Sample curl (against upstream):**
  ```bash
  curl 'https://agis.charlottecountyfl.gov/arcgis/rest/services/Essentials/CCGIS_Web_Layers2022/MapServer/17/query?f=json&where=streetnumber%3D%2726140%27%20AND%20UPPER(propertyaddress)%20LIKE%20%27%25JONES%25%27&outFields=ACCOUNT,ownersname,propertyaddress&outSR=4326&returnGeometry=false'
  ```
- **How the parcel ID is obtained / caveats:** `ACCOUNT` (bare 12-digit strap) is read straight off layer 17's attributes via `normalizeParcel`. Address matching is token-LIKE, so multiple matches are possible; `searchType:"owner"` and `"parcel"` also key on the same layer.

## Not supported
- **Q2 (Lat/Lon → Parcel ID): N.** No tool accepts a coordinate. `ccpa_search` accepts only address/owner/parcel strings; `ccgis_property_profile` accepts only `propertyId` (the ACCOUNT). There is no point-in-parcel query that returns an ACCOUNT from a lat/lon.
- **Q3 (Parcel ID → WGS84 polygon): N.** No tool returns the parcel boundary geometry to the caller. `ccpa_search`'s underlying `queryParcels` supports a `returnGeometry`/`outSR=4326` option, but the `ccpa_search` and `ccpa_parcel_details` handlers call it with geometry off and `normalizeParcel` drops any geometry — the tools return only attributes. `ccgis_property_profile` fetches the parcel polygon internally (in Web Mercator WKID 102100, via `property-profile-core.getParcelRings`) purely to intersect overlays; it returns overlay results + a catalog, never the rings. So no parcel→WGS84-polygon capability is exposed.
