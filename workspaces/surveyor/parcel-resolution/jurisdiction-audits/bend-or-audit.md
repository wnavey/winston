# Bend, OR — Parcel Resolution Audit

- **Slug:** `bend-or`
- **County:** Deschutes · **State:** OR
- **Parcel sources reviewed:** `deschutes-county` (`src/sources/deschutes-county/index.ts`, `search.ts`, `geometry.ts`, `profile.ts`, `config.ts`). `deschutes-helion` reviewed and confirmed to contain only recorded-image/document tools (no parcel-resolution tools).

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `deschutes_property_search` | `src/sources/deschutes-county` |
| 2. Lat/Lon → Parcel ID | N | `-` | `src/sources/deschutes-county` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `deschutes_parcel_geometry` | `src/sources/deschutes-county` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `deschutes_property_search` — source `deschutes-county`, module `src/sources/deschutes-county/search.ts`
- **Upstream request:** `GET https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0/query?f=json&where=<addr WHERE>&outFields=<taxlot fields>&returnGeometry=false`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search value. For address use \"198 SW 18TH ST\" (house number + street). For owner use a name fragment. For account use the numeric tax account. For maptaxlot use e.g. \"181206B000300\"." },
      "searchType": { "type": "string", "enum": ["address", "owner", "account", "maptaxlot"], "description": "Which field to search. Defaults to \"address\"." },
      "limit": { "type": "number", "description": "Max rows (default 25, max 100)." }
    },
    "required": ["query"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "searchType": "address",
    "query": "198 SW 18TH ST",
    "count": 1,
    "results": [
      {
        "accountId": "119732",
        "mapTaxlot": "181206B000300",
        "owner": "SIMPSON AFFORDABLE ...",
        "situsAddress": "198 SW 18TH ST",
        "city": "BEND",
        "zip": "97702",
        "townshipRangeSection": "18-12-06",
        "subdivision": null,
        "block": null,
        "lot": null,
        "mailingAddress": "..."
      }
    ]
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0/query' \
    --data-urlencode 'f=json' \
    --data-urlencode "where=Taxlot_Assessor_Account.House_Number = 'HOUSE_NUM' AND UPPER(Taxlot_Assessor_Account.Street_Name) LIKE '%STREETNAME%'" \
    --data-urlencode 'outFields=dbo_GIS_MAILING.ACCOUNT_ID,dbo_GIS_MAILING.MAP_TAXLOT,Taxlot_Assessor_Account.Address' \
    --data-urlencode 'returnGeometry=false' -G
  ```
- **How the parcel ID is obtained / caveats:** The handler parses the address into house number + street-name tokens, builds an ArcGIS SQL WHERE against the joined DIAL2 Taxlot layer (`Dial2_Taxlots/MapServer/0`), and `shapeRow` extracts `accountId` (`dbo_GIS_MAILING.ACCOUNT_ID`) and `mapTaxlot` (`dbo_GIS_MAILING.MAP_TAXLOT`) per feature. Address matching is fuzzy (strips leading direction and trailing street-type, matches street name via LIKE), so multiple rows can return; caller disambiguates.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `deschutes_parcel_geometry` — source `deschutes-county`, module `src/sources/deschutes-county/geometry.ts`
- **Upstream request:** two queries against the same Taxlot layer — native `GET https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0/query?...&returnGeometry=true&outSR=102100`, then a best-effort WGS84 `GET ...&returnGeometry=true&outSR=4326` used to build the GeoJSON.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "accountId": { "type": "string", "description": "Deschutes tax account number (e.g. \"119732\")." },
      "mapTaxlot": { "type": "string", "description": "Map-taxlot (e.g. \"181206B000300\")." }
    }
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "accountId": "119732",
    "mapTaxlot": "181206B000300",
    "situsAddress": "198 SW 18TH ST",
    "owner": "SIMPSON AFFORDABLE ...",
    "geometry": {
      "native": { "rings": [[[ -13600000, 5250000 ], "..."]], "spatialReference": 102100 },
      "centroid": { "x": -13600000, "y": 5250000 },
      "geojson": {
        "type": "Feature",
        "geometry": { "type": "Polygon", "coordinates": [[[ -121.34, 44.05 ], "..."]] },
        "properties": { "accountId": "119732", "mapTaxlot": "181206B000300" }
      }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0/query' \
    --data-urlencode 'f=json' \
    --data-urlencode "where=dbo_GIS_MAILING.ACCOUNT_ID = 'PARCEL_ID'" \
    --data-urlencode 'outFields=dbo_GIS_MAILING.ACCOUNT_ID' \
    --data-urlencode 'returnGeometry=true' \
    --data-urlencode 'outSR=4326' -G
  ```
- **How the parcel ID is obtained / caveats:** Accepts `accountId` OR `mapTaxlot`. Native rings are fetched in Web Mercator (102100); a second query with `outSR=4326` returns WGS84 rings which `buildGeoJSON` converts into a proper GeoJSON `Feature` (ring orientation normalized, Polygon/MultiPolygon). The WGS84 GeoJSON is explicit and confirmed in code, so Q3 is a clean **Y** (not merely Partial). The GeoJSON step is wrapped in try/catch and is best-effort, so `geojson` can be `null` if the 4326 query fails, but native rings + centroid still return.

## Not supported
- **Q2 (Lat/Lon → Parcel ID): N.** No tool accepts a coordinate and returns a parcel/account ID. `bend_property_profile` is the only coordinate-accepting tool, but (a) it takes `{x,y}` in Web Mercator 102100, not lat/lon, and (b) it point-queries the Operational_Layers overlays (zoning, flood, wildfire, soils, districts) and returns only overlay in/out/attributes — it never queries the Taxlot layer at the point and never returns an accountId/mapTaxlot. `deschutes_parcel_geometry` and `deschutes_property_search` only accept accountId/mapTaxlot/address/owner, not coordinates. So there is no reverse point-in-parcel resolution tool.
