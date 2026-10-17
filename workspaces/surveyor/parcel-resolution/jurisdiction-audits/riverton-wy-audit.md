# Riverton / Fremont County, WY — Parcel Resolution Audit

- **Slug:** `riverton-wy`
- **County:** Fremont · **State:** WY
- **Parcel sources reviewed:** `greenwood-terragis-assessor` (`src/sources/greenwood-terragis-assessor/resolve.ts`, `search.ts`, `config.ts`); `fremont-county-wy-gis` (`src/sources/fremont-county-wy-gis/tools.ts`, `records.ts`); shared client `src/lib/greenwood-terragis.ts` (behaviour referenced). `riverton-wy-zoning` reviewed — zoning-only, no parcel tools.

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `assessor_resolve_address` | `src/sources/greenwood-terragis-assessor` |
| 2. Lat/Lon → Parcel ID | Y | `assessor_resolve_point` / `fremont_wy_point_identify` | `src/sources/greenwood-terragis-assessor` / `src/sources/fremont-county-wy-gis` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `fremont_wy_parcel_geometry` | `src/sources/fremont-county-wy-gis` |

The Fremont County stack is TerraGIS / Greenwood 'gwmap' (UMN MapServer behind a PHP API). Native coordinate system is **EPSG:3738** (NAD83(HARN) WY West Central, US survey feet); the tools accept/return WGS84 via reprojection helpers.

### Q1 — Address → Parcel ID  ✅
- **Tool:** `assessor_resolve_address` — module `src/sources/greenwood-terragis-assessor/resolve.ts`
- **Upstream request:** `GET https://maps.terragis.net/fremontwy/tabList.php?ts=ADDRESS` (browser UA required — HTTP 418 otherwise). When only hollow address-points match, it recovers the containing parcel via `infoTool.php?p=<x>,<y>` server-side identify.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "address": { "type": "string" },
      "includeGeometry": { "type": "boolean" },
      "maxRows": { "type": "number" },
      "tenant": { "…": "…" }
    },
    "required": ["address"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "query": { "address": "3410 W MAIN ST" },
    "parcelCount": 1,
    "parcels": [ { "parcelId": "91142930008500", "accountNo": "R0019858",
      "ownerName": "…", "situsAddress": "…", "hasParcelGeometry": true } ],
    "diagnostics": { "route": "direct-parcel-hit", "addressPointsRejected": [], "notes": [] }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -A 'Mozilla/5.0' 'https://maps.terragis.net/fremontwy/tabList.php?ts=ADDRESS'
  ```
- **How the parcel ID is obtained / caveats:** Free-text `tabList.php` search; a hollow-address-point discriminator rejects `AP`-prefixed rows (id must be 14-digit numeric PIDN **and** carry a non-null `accountNo`). If only address points match, the parcel is recovered from the AP's own EPSG:3738 coordinates via the identify route (`route: recovered-from-address-point`) — the recovered situs is often a different house number on the same street (correct cadastral behaviour). Returns both `parcelId` (PIDN) and `accountNo` (the unique key). `assessor_search` (`searchType:"text"|"id"`) is the lower-level sibling.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `assessor_resolve_point` (greenwood-terragis-assessor) and `fremont_wy_point_identify` (fremont-county-wy-gis) — both accept WGS84 or EPSG:3738 coordinates.
- **Upstream request:** `GET https://maps.terragis.net/fremontwy/infoTool.php?p=<x>,<y>&layers=ownership&…` (server-side point identify, radius 0 = strict containment). WGS84 lon/lat are reprojected to EPSG:3738 before the call.
- **Tool input schema (`assessor_resolve_point`):**
  ```json
  {
    "type": "object",
    "properties": {
      "x": { "type": "number", "description": "Easting EPSG:3738 (or longitude if wgs84=true)" },
      "y": { "type": "number", "description": "Northing EPSG:3738 (or latitude if wgs84=true)" },
      "wgs84": { "type": "boolean" },
      "layers": { "type": "array", "items": { "type": "string" } },
      "radiusFeet": { "type": "number" },
      "includeGeometry": { "type": "boolean" }
    },
    "required": ["x", "y"]
  }
  ```
- **Sample response JSON:**
  ```json
  {
    "success": true,
    "query": { "x": 1850000, "y": 950000, "epsg": 3738, "radiusFeet": 0 },
    "numRows": 1,
    "parcel": { "parcelId": "91142930008500", "accountNo": "R0019858", "hasParcelGeometry": true },
    "alternates": [],
    "cadastralPolicy": "…",
    "addressPointsRejected": []
  }
  ```
- **Sample curl:**
  ```bash
  curl -A 'Mozilla/5.0' 'https://maps.terragis.net/fremontwy/infoTool.php?p=EASTING,NORTHING&layers=ownership'
  ```
- **How the parcel ID is obtained / caveats:** The county's own server-side identify returns the containing parcel row(s); `pickCadastralParcel` chooses the preferred parcel (roll polygons legitimately overlap, so alternates are surfaced, never silently dropped). Pass `wgs84:true` (with x=lon, y=lat) or `fremont_wy_point_identify`'s `longitude`/`latitude` to supply WGS84 — reprojected for you. Both yield `parcelId` (PIDN) + `accountNo`. Keep `radiusFeet:0` (strict containment; larger = proximity search).

### Q3 — Parcel ID → WGS84 polygon / GeoJSON  ✅
- **Tool:** `fremont_wy_parcel_geometry` — module `src/sources/fremont-county-wy-gis/tools.ts` (WGS84 reprojection via `geometryToWgs84` in `records.ts`)
- **Upstream request:** by PIDN → `GET https://maps.terragis.net/fremontwy/infoTool.php?layers=ownership&filter=(pidn in('PIDN'))`; by account → `tabList.php?idnum=R#######` then resolve geometry from the row's PIDN.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "pidn": { "type": "string", "description": "14-digit PIDN" },
      "accountNo": { "type": "string", "description": "R####### (unique key)" },
      "includeGeometry": { "type": "boolean" }
    },
    "required": []
  }
  ```
- **Sample response JSON:**
  ```json
  {
    "query": { "pidn": "91142930008500", "accountNo": null },
    "numRows": 1,
    "parcel": {
      "parcelId": "91142930008500", "accountNo": "R0019858",
      "geometrySummary": { "type": "Polygon", "ringCount": 1, "vertexCount": 12,
        "bbox3738": [1849000, 949000, 1851000, 951000],
        "bboxWgs84": [-108.39, 43.02, -108.38, 43.03] },
      "geometryEpsg3738": { "type": "Polygon", "coordinates": [[[1849000, 951000], "…"]] },
      "geometryWgs84":   { "type": "Polygon", "coordinates": [[[-108.39, 43.03], "…"]] }
    }
  }
  ```
- **Sample curl:**
  ```bash
  curl -A 'Mozilla/5.0' "https://maps.terragis.net/fremontwy/infoTool.php?layers=ownership&filter=(pidn%20in('PIDN'))"
  ```
- **How the geometry is obtained / caveats:** With `includeGeometry` (default true) the tool returns `geometryWgs84` — a GeoJSON-coordinate reprojection of the parcel polygon to WGS84 lon/lat (`projectGeoJSONCoords(..., EPSG_3738)`), alongside the authoritative native `geometryEpsg3738` and a WGS84 bbox. The module explicitly notes the native EPSG:3738 feet geometry is the authoritative record and `geometryWgs84` is "a convenience reprojection" — so WGS84 GeoJSON **is** provided (Q3 = Y), just flagged as derived. `accountNo` is the unique key; `pidn` is not (737 rows share sentinel `99999999999999`). `assessor_parcel_record` also returns polygon geometry but in EPSG:3738 only.

## Not supported
- None of the three. (Riverton the city publishes no GIS service; all parcel resolution runs through the county Fremont/TerraGIS stack, which satisfies Q1–Q3.)
