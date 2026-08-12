# Louisville / Jefferson County, KY — Parcel Resolution Audit

- **Slug:** `louisville-ky`
- **County:** Jefferson · **State:** KY
- **Parcel sources reviewed:** `louisville-cad` (`src/sources/louisville-cad/tools.ts`, `client.ts`, `config.ts`), `louisville-gis` (`src/sources/louisville-gis/parcel-lookup.ts`, `property-profile.ts`, `config.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `louisville_appraisal_search` | `src/sources/louisville-cad` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `louisville_parcel_lookup` | `src/sources/louisville-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `louisville_appraisal_search` — source `louisville-cad`, module `src/sources/louisville-cad/tools.ts` (handler → `pvaSearch` in `client.ts`)
- **Upstream request:** `GET https://jeffersonpva.ky.gov/property-search/property-listings/?psfldAddress=ADDRESS&searchType=StreetSearch&propertySearchFormButton=Search` — a single match 302-redirects to `…/property-details/?lrsn=<LRSN>`, which is then fetched and parsed for the free core fields (owner, **parcel ID**, assessed value, acres, neighborhood).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Street address or 12-char PARCELID" },
      "searchType": { "type": "string", "enum": ["address", "parcel"] }
    },
    "required": ["query"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "found": true,
    "query": "400 W Market St",
    "searchType": "address",
    "lrsn": 8001337,
    "core": { "owner": "…", "parcelId": "014E02790000", "assessedValueTotal": 50141110, "acres": "…", "neighborhood": "…" },
    "via": "pva-302-detail"
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -L 'https://jeffersonpva.ky.gov/property-search/property-listings/?psfldAddress=ADDRESS&searchType=StreetSearch&propertySearchFormButton=Search'
  ```
- **How the parcel ID is obtained / caveats:** The PVA WordPress search resolves the LRSN from the 302 `Location` header (or the first `lrsn=` on a multi-match listing page); the details page is then parsed for the free core fields, which include the 12-char PARCELID. Address search only (`searchType:"address"`); the same tool also accepts a PARCELID directly (`searchType:"parcel"`).

### Q3 — Parcel ID → WGS84 polygon / GeoJSON  ✅
- **Tool:** `louisville_parcel_lookup` — source `louisville-gis`, module `src/sources/louisville-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://gis.lojic.org/maps/rest/services/LojicSolutions/OpenDataPVA/MapServer/1/query?where=UPPER(PARCELID)='PARCEL_ID'&outFields=PARCELID,LRSN,PIN&returnGeometry=true&outSR=4326&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "parcelId": { "type": "string", "description": "12-char PARCELID, e.g. 014E02790000" } },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "found": true,
    "parcelId": "014E02790000",
    "lrsn": 8001337,
    "pin": "…",
    "centroid": { "lon": -85.757178, "lat": 38.254934 },
    "rings": [[[ -85.7574, 38.2551 ], [ -85.7569, 38.2551 ], "…" ]]
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://gis.lojic.org/maps/rest/services/LojicSolutions/OpenDataPVA/MapServer/1/query?where=UPPER(PARCELID)='PARCEL_ID'&outFields=PARCELID,LRSN,PIN&returnGeometry=true&outSR=4326&f=json"
  ```
- **How the geometry is obtained / caveats:** LOJIC parcels layer (OpenDataPVA/1) is queried with `outSR=4326`, so the returned `rings` and the computed `centroid` are WGS84 decimal degrees (native SR is KY State Plane North NAD83, reprojected server-side). Rings are returned as ArcGIS rings (not GeoJSON), in EPSG:4326.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool resolves a coordinate to a parcel ID. `louisville_property_profile` accepts `lon`/`lat` but only runs point-in-polygon against zoning/overlay/form/land-use/district layers and returns those attributes — not a parcel/LRSN/PARCELID. `louisville_parcel_lookup` and the PVA/JCSO tools key on PARCELID/LRSN/address only. A coordinate cannot be turned into a parcel ID here.
