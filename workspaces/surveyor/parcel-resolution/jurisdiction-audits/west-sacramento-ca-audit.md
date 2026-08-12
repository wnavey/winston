# West Sacramento, CA — Parcel Resolution Audit

- **Slug:** `west-sacramento-ca`
- **County:** Yolo · **State:** CA
- **Parcel sources reviewed:** `yolo-assessor` (`src/sources/yolo-assessor/search.ts`, `client.ts`, `config.ts`), `yolo-county-gis` (`src/sources/yolo-county-gis/parcel-lookup.ts`, `config.ts`), `west-sacramento-gis` (`src/sources/west-sacramento-gis/profile.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `yolo_assessor_search` | `src/sources/yolo-assessor` |
| 2. Lat/Lon → Parcel ID | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `yolo_parcel_lookup` | `src/sources/yolo-county-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `yolo_assessor_search` — source `yolo-assessor`, module `src/sources/yolo-assessor/search.ts`
- **Upstream request:** `GET https://common1.mptsweb.com/mbap/yolo/idaddress/<ADDRESS>` (Megabyte MPTS/MBAP; browser User-Agent). `searchType:"apn"` → `/idfeeparcel/<APN>`; `searchType:"assessment"` → `/idasmt/<ASMT>`.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "searchType": { "type": "string", "enum": ["apn", "assessment", "address"], "description": "Which index to search. Default \"apn\"." },
      "query": { "type": "string", "description": "APN/fee-parcel (dashes optional), assessment number, or situs address text." }
    },
    "required": ["query"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "searchType": "address",
    "query": "400 BALLPARK",
    "count": 2,
    "results": [
      {
        "assessment": "058320093000",
        "feeParcel": "058320093000",
        "assessmentStatus": "...",
        "taxRateArea": "004005",
        "situsAddress": "400 BALLPARK DR",
        "isRealProperty": true,
        "raw": { "Asmt": "058320093000", "FeeParcel": "058320093000", "TRA": "004005" }
      }
    ]
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -H 'User-Agent: Mozilla/5.0 Chrome/126.0.0.0' \
    'https://common1.mptsweb.com/mbap/yolo/idaddress/ADDRESS'
  ```
- **How the parcel ID is obtained / caveats:** The Megabyte search returns string-double-encoded JSON `{Table:{Row:[…]}}` (decoded by `src/lib/megabyte-mpts.ts`); each row's `Asmt`/`FeeParcel` is the packed 12-digit assessment number (the APN spine). The real-property row has `isRealProperty=true` (Asmt == FeeParcel); 800-series rows are possessory/personal assessments. Address search hits the `idaddress` index directly.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `yolo_parcel_lookup` — source `yolo-county-gis`, module `src/sources/yolo-county-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://gis.yolocounty.gov/ext/rest/services/.../Parcels_Public/FeatureServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=4326&where=MPTS_ASMT_NUMBER='<ASMT>'`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "assessment": { "type": "string", "description": "Assessment number / MPTS_ASMT_NUMBER (dashes optional), e.g. \"058320093000\"." } },
    "required": ["assessment"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "assessment": "058320093000",
      "packedApn": "058320093",
      "situsAddress": "400 BALLPARK DR",
      "city": "WEST SACRAMENTO",
      "taxRateArea": "004005",
      "assessorMapPage": "058-32",
      "geometry": {
        "rings": [[[-121.5136, 38.5806], [-121.5131, 38.5806], "..."]],
        "centroid": { "x": -121.51337, "y": 38.58044 },
        "spatialReference": 4326
      }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl "https://gis.yolocounty.gov/ext/rest/services/Public/Parcels_Public/FeatureServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=4326&where=MPTS_ASMT_NUMBER%3D%27PARCEL_ID%27"
  ```
- **How the parcel ID is obtained / caveats:** The handler keys on `MPTS_ASMT_NUMBER` (the packed assessment number from `yolo_assessor_search`) and requests geometry with `outSR=4326`; it returns ArcGIS `rings` explicitly stamped `spatialReference: 4326` plus a computed WGS84 centroid. Native SR is NAD83 CA Zone 2 US-ft (102642/2226), reprojected to WGS84 by `outSR=4326`. Output is ArcGIS rings (not RFC-7946 GeoJSON), but confirmed WGS84.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool accepts a coordinate and returns an assessment/APN. `yolo_parcel_lookup` takes the assessment number only (there is no point/geometry branch). The only coordinate-accepting tools — `westsac_zoning_lookup` and `westsac_property_profile` (accept WGS84 `longitude`/`latitude`) — run point-in-polygon against the City of West Sacramento zoning/land-use/overlay layers and return regulatory zoning and General Plan data, NOT a parcel identifier (the city polygons have no reliable APN join, per the module notes). The lat/lon → parcel direction is therefore unsupported.
