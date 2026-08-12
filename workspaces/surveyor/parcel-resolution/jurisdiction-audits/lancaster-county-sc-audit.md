# Lancaster County, SC — Parcel Resolution Audit

- **Slug:** `lancaster-county-sc`
- **County:** Lancaster · **State:** SC
- **Parcel sources reviewed:** `lancaster-county-sc-assessor` (`src/sources/lancaster-county-sc-assessor/gis-search.ts`, `config.ts`, `normalize.ts`, `index.ts`), `lancaster-county-sc-gis` (`src/sources/lancaster-county-sc-gis/property-profile.ts`, `index.ts`), plus shared `src/lib/gis-client.ts`, `src/lib/point-profile.ts`.

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `lancaster_assessor_search` | `src/sources/lancaster-county-sc-assessor` |
| 2. Lat/Lon → Parcel ID | Y | `lancaster_assessor_search` (point mode) | `src/sources/lancaster-county-sc-assessor` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | `-` | `-` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `lancaster_assessor_search` — source `lancaster-county-sc-assessor`, module `src/sources/lancaster-county-sc-assessor/gis-search.ts`
- **Upstream request:** `GET https://services3.arcgis.com/rJcpRneDUBgTeCT3/arcgis/rest/services/LC_Parcels/FeatureServer/0/query?where=UPPER(PROP_LOCAT) LIKE '%ADDRESS%'&outFields=...&returnGeometry=true&outSR=4326&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "dashed PIN, owner fragment, or address fragment" },
      "searchType": { "type": "string", "enum": ["parcelId", "owner", "address"], "description": "default parcelId" },
      "lon": { "type": "number", "description": "WGS84 longitude (point lookup)" },
      "lat": { "type": "number", "description": "WGS84 latitude (point lookup)" }
    },
    "required": []
  }
  ```
- **Sample response JSON (shape the tool returns):**
  ```json
  {
    "success": true,
    "data": {
      "source": "Lancaster County SC LC_Parcels — complete cadastral (ArcGIS Online)",
      "mode": "address",
      "count": 1,
      "records": [
        {
          "pin": "0010-00-030.00",
          "pin2": "0010  00 030 00",
          "owner": "521 LAND PARTNERS LLC",
          "situsAddress": "... CHARLOTTE HWY",
          "deedBookPage": "762/106",
          "platBookPage": "...",
          "centroid": { "lon": -80.8486, "lat": 34.9761 }
        }
      ]
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  curl "https://services3.arcgis.com/rJcpRneDUBgTeCT3/arcgis/rest/services/LC_Parcels/FeatureServer/0/query?f=json&returnGeometry=true&outSR=4326&outFields=PIN,OWNER_NAME,PROP_LOCAT,DEED_BOOK,DEED_PAGE&where=$(python3 -c "import urllib.parse;print(urllib.parse.quote(\"UPPER(PROP_LOCAT) LIKE '%ADDRESS%'\"))")"
  ```
- **How the parcel ID is obtained / caveats:** `buildWhere('address', …)` builds `UPPER(PROP_LOCAT) LIKE '%ADDRESS%'` against LC_Parcels; `shapeRecord()` returns `pin` (dashed PIN, the county join key) from feature attribute `PIN`. `searchType: parcelId` and `owner` are the other keyed modes.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `lancaster_assessor_search` (point mode — pass `lon` + `lat`, omit `query`) — source `lancaster-county-sc-assessor`, module `src/sources/lancaster-county-sc-assessor/gis-search.ts`
- **Upstream request:** `POST https://services3.arcgis.com/rJcpRneDUBgTeCT3/arcgis/rest/services/LC_Parcels/FeatureServer/0/query` with `geometry={"x":LON,"y":LAT,"spatialReference":{"wkid":4326}}`, `geometryType=esriGeometryPoint`, `inSR=4326`, `outSR=4326`, `spatialRel=esriSpatialRelIntersects`, `returnGeometry=true`, `outFields=...`.
- **Tool input schema:** (same schema as Q1 — the point branch triggers when `lon`+`lat` are finite; `query`/`searchType` are then ignored)
- **Sample response JSON (shape the tool returns):**
  ```json
  {
    "success": true,
    "data": {
      "source": "Lancaster County SC LC_Parcels — complete cadastral (ArcGIS Online)",
      "mode": "point",
      "count": 1,
      "records": [
        { "pin": "0010-00-030.00", "owner": "521 LAND PARTNERS LLC", "centroid": { "lon": -80.8486, "lat": 34.9761 } }
      ]
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  curl 'https://services3.arcgis.com/rJcpRneDUBgTeCT3/arcgis/rest/services/LC_Parcels/FeatureServer/0/query' \
    --data-urlencode 'geometry={"x":LON,"y":LAT,"spatialReference":{"wkid":4326}}' \
    --data 'geometryType=esriGeometryPoint&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=true&outFields=PIN,OWNER_NAME&f=json'
  ```
- **How the parcel ID is obtained / caveats:** When `lon`/`lat` are supplied the handler's `byPoint` branch does a true point-in-polygon `esriGeometryPoint` / `esriSpatialRelIntersects` query against LC_Parcels and returns `pin` from the intersecting feature. This is a genuine coordinate → parcel-ID resolution (not merely overlay context).

## Not supported
- **Q3 (Parcel ID → WGS84 polygon/GeoJSON): N.** No tool returns the parcel boundary polygon. `lancaster_assessor_search` *fetches* geometry (`returnGeometry=true`, `outSR=4326`), but `shapeRecord()` uses `geometry.rings[0]` only to compute a `centroid` (`computeCentroid`) and discards the rings — the caller receives just a centroid point, never the boundary. `lancaster_property_profile` accepts a point and returns context layers (zoning/overlays/utilities) via `runPointProfile`, no parcel geometry. Since no polygon is surfaced in any SR, this is N (not Partial) — the WGS84 boundary is retrieved upstream but not exposed by any tool.
