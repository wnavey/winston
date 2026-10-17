# Seattle, WA — Parcel Resolution Audit

- **Slug:** `seattle-wa`
- **County:** King · **State:** WA
- **Parcel sources reviewed:** `kingcounty-gis` — `src/sources/kingcounty-gis/parcel.ts`, `config.ts`, `index.ts` (King County GIS is the parcel authority; `seattle-gis`, `kingcounty-ereal`, and `kingcounty-special-districts` reviewed to confirm none resolve a coordinate to a PIN)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `kingcounty_parcel_search` | `src/sources/kingcounty-gis` |
| 2. Lat/Lon → Parcel ID | N | `-` | `src/sources/kingcounty-gis` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `kingcounty_parcel_lookup` | `src/sources/kingcounty-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `kingcounty_parcel_search` — source `kingcounty-gis`, module `src/sources/kingcounty-gis/parcel.ts`
- **Upstream request:** `GET https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query?where=UPPER(ADDR_FULL) LIKE '%<ADDRESS>%'&outFields=PIN,MAJOR,MINOR,ADDR_FULL,KCA_ZONING,APPRLNDVAL,…&returnGeometry=false&resultRecordCount=25&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Street address (e.g. \"700 BROADWAY E\") or 10-digit PIN (e.g. \"9831200640\")" },
      "searchType": { "type": "string", "enum": ["address", "pin"], "description": "default: inferred — all-digits => pin" }
    },
    "required": ["query"]
  }
  ```
- **Sample response JSON (shape the tool returns):**
  ```json
  {
    "success": true,
    "data": {
      "searchType": "address",
      "resultCount": 1,
      "results": [
        {
          "PIN": "9831200640",
          "ADDR_FULL": "700 BROADWAY E",
          "KCA_ZONING": "…",
          "APPRLNDVAL": 0,
          "PREUSE_DESC": "…"
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  curl "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query?where=UPPER(ADDR_FULL)%20LIKE%20'%25700%20BROADWAY%20E%25'&outFields=PIN,ADDR_FULL,KCA_ZONING&returnGeometry=false&resultRecordCount=25&f=json"
  ```
- **How the parcel ID is obtained / caveats:** `UPPER(ADDR_FULL) LIKE '%…%'` against the KingCo_PropertyInfo roll (layer 2); returns the 10-digit `PIN` (MAJOR 6 + MINOR 4) per match. Owner/full-sales are NOT on this roll (use `kingcounty_assessor_detail`), but PIN + address + KCA zoning + appraised values come back here.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `kingcounty_parcel_lookup` — source `kingcounty-gis`, module `src/sources/kingcounty-gis/parcel.ts`
- **Upstream request:** two queries against `.../Property/KingCo_Parcels/MapServer/0/query` — a `POST` with `outSR=3857` (native rings) and a `GET …?f=json&where=PIN='<PARCEL_ID>'&outFields=PIN&returnGeometry=true&outSR=4326` (WGS84 rings + centroid); roll attributes enriched from `KingCo_PropertyInfo/MapServer/2`.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "pin": { "type": "string", "description": "10-digit King County PIN (e.g. \"9831200640\")" } },
    "required": ["pin"]
  }
  ```
- **Sample response JSON (trimmed):**
  ```json
  {
    "success": true,
    "data": {
      "pin": "9831200640",
      "attributes": { "PIN": "9831200640", "ADDR_FULL": "700 BROADWAY E", "KCA_ZONING": "…" },
      "geometry": {
        "native": { "rings": [[[x,y],…]], "spatialReference": 3857 },
        "wgs84": { "rings": [[[-122.32,47.62],…]], "spatialReference": 4326 },
        "centroid": { "lon": -122.32, "lat": 47.62 }
      }
    }
  }
  ```
- **Sample curl (WGS84 geometry leg):**
  ```bash
  curl "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_Parcels/MapServer/0/query?f=json&where=PIN='<PARCEL_ID>'&outFields=PIN&returnGeometry=true&outSR=4326"
  ```
- **How the geometry is obtained / caveats:** Keyed by 10-digit `PIN` (normalized, dashes stripped). The handler issues a dedicated `outSR=4326` query and returns the WGS84 rings under `geometry.wgs84` (`spatialReference: 4326`) plus a WGS84 `centroid`. Returned as ArcGIS rings with `wkid:4326` rather than a GeoJSON `Feature` wrapper, but WGS84 is confirmed. The WGS84 leg is try/catch-wrapped so it degrades to native SR-3857 only if the reproject fails.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No tool resolves a coordinate to a PIN. `kingcounty-gis` exposes only `kingcounty_parcel_search` (address/PIN text) and `kingcounty_parcel_lookup` (PIN). No `esriGeometryPoint`/point-in-polygon parcel query exists in the module (grep for latitude/longitude/esriGeometryPoint returns nothing in `kingcounty-gis`/`kingcounty-ereal`). The Seattle point-accepting tools (`seattle_zoning_lookup`, `seattle_property_profile`, `seattle_eca_lookup`, `seattle_street_classification`, `kingcounty_special_districts`) take a WGS84 point but return zoning/overlays/ECA/street-classification/district data — never a parcel PIN.
