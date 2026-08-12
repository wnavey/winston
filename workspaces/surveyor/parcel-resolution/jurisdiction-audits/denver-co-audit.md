# Denver, CO — Parcel Resolution Audit

- **Slug:** `denver-co`
- **County:** Denver · **State:** CO
- **Parcel sources reviewed:** `denver-assessor` — `src/sources/denver-assessor/search.ts`, `details.ts`, `config.ts`; `denver-gis` — `src/sources/denver-gis/parcel-lookup.ts`, `property-profile.ts`, `adjacent-context.ts`, `config.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `denver_assessor_search` | `src/sources/denver-assessor` |
| 2. Lat/Lon → Parcel ID | N | `-` | `src/sources/denver-gis` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `denver_parcel_lookup` | `src/sources/denver-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `denver_assessor_search` — source `denver-assessor`, module `src/sources/denver-assessor/search.ts`
- **Upstream request:** `POST https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_PROP_PARCELS_A/FeatureServer/245/query` with form body `f=json&where=UPPER(SITUS_ADDRESS_LINE1) LIKE '%<ADDRESS>%'&outFields=SCHEDNUM,OWNER_NAME,SITUS_ADDRESS_LINE1,ZONE_10,…&returnGeometry=false&resultRecordCount=20`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "street address, 13-digit SCHEDNUM, or owner name" },
      "searchType": { "type": "string", "enum": ["address", "schednum", "owner"] }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON (shape the tool returns):**
  ```json
  {
    "success": true,
    "data": {
      "resultCount": 1,
      "results": [
        {
          "SCHEDNUM": "0503403047000",
          "OWNER_NAME": "…",
          "SITUS_ADDRESS_LINE1": "650 W COLFAX AVE",
          "ZONE_10": "D-GT",
          "APPRAISED_TOTAL_VALUE": 0,
          "SITUS_X_COORD": 0,
          "SITUS_Y_COORD": 0
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  curl -X POST "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_PROP_PARCELS_A/FeatureServer/245/query" \
    --data-urlencode "f=json" \
    --data-urlencode "where=UPPER(SITUS_ADDRESS_LINE1) LIKE '%650 W COLFAX AVE%'" \
    --data-urlencode "outFields=SCHEDNUM,OWNER_NAME,SITUS_ADDRESS_LINE1,ZONE_10" \
    --data-urlencode "returnGeometry=false" --data-urlencode "resultRecordCount=20"
  ```
- **How the parcel ID is obtained / caveats:** `UPPER(SITUS_ADDRESS_LINE1) LIKE '%…%'` against the Denver assessor FeatureServer (layer 245); returns the 13-digit `SCHEDNUM` (Denver's primary parcel identifier) per match. The assessor layer is unusually rich — the same query also carries zoning + valuation + situs coords.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `denver_parcel_lookup` — source `denver-gis`, module `src/sources/denver-gis/parcel-lookup.ts`
- **Upstream request:** two queries against `.../ODC_PROP_PARCELS_A/FeatureServer/245/query` — a `POST` with `outSR=2877` (native rings + attrs) and a `GET …?f=json&where=SCHEDNUM='<PARCEL_ID>'&outFields=SCHEDNUM&returnGeometry=true&outSR=4326` (WGS84 rings for GeoJSON).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "schednum": { "type": "string", "description": "13-digit Denver schedule number (e.g. \"0503403047000\")" } },
    "required": ["schednum"]
  }
  ```
- **Sample response JSON (trimmed):**
  ```json
  {
    "success": true,
    "data": {
      "schednum": "0503403047000",
      "attributes": { "SCHEDNUM": "0503403047000", "OWNER_NAME": "…", "ZONE_10": "D-GT" },
      "geometry": {
        "native": { "rings": [[[x,y],…]], "spatialReference": 2877 },
        "centroid": { "x": 0, "y": 0 },
        "geojson": {
          "type": "Feature",
          "geometry": { "type": "Polygon", "coordinates": [[[-104.99,39.74],…]] },
          "properties": { "schednum": "0503403047000" }
        }
      }
    }
  }
  ```
- **Sample curl (WGS84 geometry leg):**
  ```bash
  curl "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_PROP_PARCELS_A/FeatureServer/245/query?f=json&where=SCHEDNUM='<PARCEL_ID>'&outFields=SCHEDNUM&returnGeometry=true&outSR=4326"
  ```
- **How the geometry is obtained / caveats:** Keyed by 13-digit `SCHEDNUM` (validated `length === 13`). The handler makes a dedicated `outSR=4326` query and reprojects the rings into a GeoJSON `Feature` (`buildParcelGeoJSON`). WGS84 GeoJSON confirmed; the WGS84 leg is wrapped in try/catch so it degrades gracefully to native SR-2877 only if the reproject fails.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool resolves a coordinate to a SCHEDNUM. `denver_parcel_lookup`, `denver_assessor_details`, and `denver_adjacent_context` all require `schednum`; `denver_assessor_search` takes only text. `denver_property_profile` accepts an optional `x`/`y` point, **but** that point is expressed in native SR 2877 (State Plane, not WGS84 lat/lon) and in the x/y path the handler queries only the overlay layers — it never queries the parcels layer, so it returns `schednum: undefined` and yields no parcel ID. The `esriGeometryPoint` usage in the module is only for buffering around a parcel already resolved by SCHEDNUM.
