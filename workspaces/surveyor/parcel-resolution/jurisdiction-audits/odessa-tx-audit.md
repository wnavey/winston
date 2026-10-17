# Odessa, TX — Parcel Resolution Audit

- **Slug:** `odessa-tx`
- **County:** Ector · **State:** TX
- **Parcel sources reviewed:** `ectorcad` (`src/sources/ectorcad/{index,search,details,client}.ts`), `ector-gis` (`src/sources/ector-gis/{index,parcel-lookup,client}.ts`), `ector-county-clerk` (`src/sources/ector-county-clerk/index.ts`, records-index only — no parcel resolution)

> Odessa shares the exact same Ector County source modules as `ector-county-tx` (`ectorcad` + `ector-gis`). Capability and code are identical; the tool set differs only by additional non-parcel overlays (`census-qoz`, extra FEMA/TxDOT tools). County-line caveat: some far-east-Odessa parcels fall in Midland County and are not wired here.

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `ectorcad_search` | `src/sources/ectorcad` |
| 2. Lat/Lon → Parcel ID | Y | `ector_parcel_at_point` | `src/sources/ector-gis` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `ector_parcel_lookup` | `src/sources/ector-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `ectorcad_search` — source `ectorcad`, module `src/sources/ectorcad/search.ts` (client `client.ts`)
- **Upstream request:** `GET https://search.ectorcad.org/search/r/{URL-encoded query}` — server-rendered GSA Corp. HTML results table; the handler regex-scrapes each row and pulls the strap from the `/parcel/{strap}` link.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Free-text query: street address (e.g. \"4015 BILLY HEXT RD\"), owner name, or account number/strap."
      }
    },
    "required": ["query"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "query": "4015 BILLY HEXT RD",
    "count": 1,
    "results": [
      {
        "parcelId": "07245.00120.00000",
        "ownerName": "KJ TEXAS PROPERTIES",
        "siteAddress": "4015 BILLY HEXT RD",
        "netAssessedValue": "$250,000"
      }
    ]
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://search.ectorcad.org/search/r/4015%20BILLY%20HEXT%20RD' \
    -H 'User-Agent: Mozilla/5.0' -H 'Referer: https://search.ectorcad.org/'
  ```
- **How the parcel ID is obtained / caveats:** `parcelId` is `m[1]` from `<a href="/parcel/([0-9.]+)">` — the canonical dotted strap. Free-text query accepts address, so address→parcel is supported. HTML scrape (no JSON API); Midland-County Odessa parcels won't appear in EctorCAD.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `ector_parcel_at_point` — source `ector-gis`, module `src/sources/ector-gis/parcel-lookup.ts` (client `client.ts`)
- **Upstream request:** `GET https://gis11.cama.io/arcgis/rest/services/Ector/EctorCounty_Thematic/MapServer/10/query` with an `esriGeometryPoint` at `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, `outFields=*`, `returnGeometry=false`, `f=json` (via `queryLayerAtPoint(PARCEL_LAYER, lon, lat)`).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "latitude": { "type": "number", "description": "Latitude (WGS84)" },
      "longitude": { "type": "number", "description": "Longitude (WGS84, negative for Texas)" }
    },
    "required": ["latitude", "longitude"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "found": true,
    "latitude": 31.85419,
    "longitude": -102.44662,
    "parcelId": "07245.00120.00000",
    "pin": "07245-00102-00300",
    "ownerName": "KJ TEXAS PROPERTIES",
    "useDescription": "Commercial Real Estate",
    "landArea": 1.2,
    "neighborhood": "CROSSROADS EAST"
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -G 'https://gis11.cama.io/arcgis/rest/services/Ector/EctorCounty_Thematic/MapServer/10/query' \
    --data-urlencode 'geometry=LON,LAT' \
    --data-urlencode 'geometryType=esriGeometryPoint' \
    --data-urlencode 'inSR=4326' \
    --data-urlencode 'spatialRel=esriSpatialRelIntersects' \
    --data-urlencode 'outFields=*' \
    --data-urlencode 'returnGeometry=false' \
    --data-urlencode 'f=json'
  ```
- **How the parcel ID is obtained / caveats:** Point-in-polygon intersect against the "Property ID" CAMA layer (10); the first feature's `attributes.strap` is returned as `parcelId`. Input coordinate is WGS84 (`inSR=4326`), reprojected server-side from native SP TX Central (2277).

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `ector_parcel_lookup` — source `ector-gis`, module `src/sources/ector-gis/parcel-lookup.ts` (client `client.ts` `queryParcelById`)
- **Upstream request:** `GET https://gis11.cama.io/arcgis/rest/services/Ector/EctorCounty_Thematic/MapServer/10/query?where=strap='{id}' OR dsp_strap='{id}' OR PIN='{id}' OR gis_parcel_id='{id}'&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=1&f=json`.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "parcelId": {
        "type": "string",
        "description": "Dotted strap (07245.00120.00000) or hyphenated PIN (07245-00102-00300)."
      }
    },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "found": true,
    "parcelId": "07245.00120.00000",
    "pin": "07245-00102-00300",
    "ownerName": "KJ TEXAS PROPERTIES",
    "useDescription": "Commercial Real Estate",
    "landArea": 1.2,
    "centroid": { "longitude": -102.44662, "latitude": 31.85419 },
    "geometry": { "rings": [[[-102.4468, 31.8543], [-102.4464, 31.8543], [-102.4464, 31.8540], [-102.4468, 31.8540], [-102.4468, 31.8543]]] }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -G 'https://gis11.cama.io/arcgis/rest/services/Ector/EctorCounty_Thematic/MapServer/10/query' \
    --data-urlencode "where=strap='PARCEL_ID' OR dsp_strap='PARCEL_ID' OR PIN='PARCEL_ID' OR gis_parcel_id='PARCEL_ID'" \
    --data-urlencode 'outFields=*' \
    --data-urlencode 'returnGeometry=true' \
    --data-urlencode 'outSR=4326' \
    --data-urlencode 'resultRecordCount=1' \
    --data-urlencode 'f=json'
  ```
- **How the parcel ID is obtained / caveats:** `queryParcelById` hard-codes `outSR=4326`, so geometry rings return in WGS84 `[lon,lat]`. Output is ArcGIS `{ rings }` (esriGeometryPolygon in EPSG:4326), NOT GeoJSON — a trivial rings→GeoJSON Polygon transform. `ringCentroid` averages the first ring for a WGS84 centroid.

## Not supported
- None. All three capabilities are supported. (The `ector-county-clerk` source exposes only a recorded-document index/preview — `ector_clerk_search` / `ector_clerk_fetch_preview` — and performs no address/coordinate→parcel or parcel→geometry resolution.)
