# Defiance County, OH — Parcel Resolution Audit

- **Slug:** `defiance-county-oh`
- **County:** Defiance · **State:** OH
- **Parcel sources reviewed:** `defiance-county-auditor` (`src/sources/defiance-county-auditor/parcel-search.ts`, `normalize.ts`, `config.ts`); `defiance-zoning` (`src/sources/defiance-zoning/lookup.ts`) reviewed for completeness — it is an overlay/zoning resolver, not a parcel resolver.

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `defiance_parcel_search` | `src/sources/defiance-county-auditor` |
| 2. Lat/Lon → Parcel ID | Y | `defiance_parcel_search` | `src/sources/defiance-county-auditor` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `defiance_parcel_search` | `src/sources/defiance-county-auditor` |

All three are satisfied by the single entry-point tool `defiance_parcel_search`, which accepts a parcel ID (either form), owner fragment, situs-address fragment, **or** a lon/lat point, and always returns each geometry feature's rings in WGS84.

### Q1 — Address → Parcel ID  ✅
- **Tool:** `defiance_parcel_search` (`searchType:"address"`) — module `src/sources/defiance-county-auditor/parcel-search.ts`
- **Upstream request:** `GET https://services1.arcgis.com/nOy1DpPkzXSFJsGp/arcgis/rest/services/parcel_joinedDefOH/FeatureServer/0/query?where=UPPER(PPAddress) LIKE '%ADDRESS%'&outFields=<AUDITOR_FIELDS>&returnGeometry=true&outSR=4326&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["parcelId", "owner", "address"] },
      "lon": { "type": "number" },
      "lat": { "type": "number" },
      "limit": { "type": "number" },
      "returnGeometry": { "type": "boolean" }
    },
    "required": []
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "mode": "address",
      "parcelCount": 1,
      "records": [
        { "parcelId": "J09-0029-0-004-02", "parcelIdCanonical": "J090029000402",
          "owner": "…", "situsAddress": "…", "featureCount": 1,
          "geometries": [ { "representativePoint": { "lon": -84.36, "lat": 41.28 }, "rings": [[[…]]] } ] }
      ]
    }
  }
  ```
- **How the parcel ID is obtained / caveats:** Address is a `UPPER(PPAddress) LIKE '%…%'` contains match; the tool returns `parcelIdCanonical` (13-char undashed join key) and `parcelId` (dashed display form). Note the Recorder-side address index is empty county-wide, but the **Auditor** address search used here works.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `defiance_parcel_search` (with `lon` + `lat`) — same module
- **Upstream request:** `POST https://services1.arcgis.com/nOy1DpPkzXSFJsGp/arcgis/rest/services/parcel_joinedDefOH/FeatureServer/0/query` with form body `geometry={"x":LON,"y":LAT,"spatialReference":{"wkid":4326}}&geometryType=esriGeometryPoint&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&outFields=<AUDITOR_FIELDS>&returnGeometry=true&f=json`
- **Sample response JSON:** identical record shape to Q1 (`records[].parcelIdCanonical` + per-feature `representativePoint` and `rings`).
- **Sample curl:**
  ```bash
  curl -X POST 'https://services1.arcgis.com/nOy1DpPkzXSFJsGp/arcgis/rest/services/parcel_joinedDefOH/FeatureServer/0/query' \
    --data-urlencode 'geometry={"x":LON,"y":LAT,"spatialReference":{"wkid":4326}}' \
    --data 'geometryType=esriGeometryPoint&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=true&f=json&outFields=Parcel,Parcel2,PPOwner,PPAddress'
  ```
- **How the parcel ID is obtained / caveats:** When `lon`/`lat` are finite the handler switches to a point-intersect POST; the intersecting feature(s) carry `Parcel2` → `parcelIdCanonical`. One tax parcel can be several disjoint features (grouped by canonical ID), so a point returns the containing parcel with its full attribute record.

### Q3 — Parcel ID → WGS84 polygon / GeoJSON  ✅
- **Tool:** `defiance_parcel_search` (`searchType:"parcelId"`, default `returnGeometry:true`) — same module
- **Upstream request:** `GET …/parcel_joinedDefOH/FeatureServer/0/query?where=Parcel='J09-0029-0-004-02' OR Parcel2='J090029000402'&outFields=<AUDITOR_FIELDS>&returnGeometry=true&outSR=4326&f=json`
- **Sample response JSON:**
  ```json
  {
    "success": true,
    "data": { "records": [ {
      "parcelIdCanonical": "J090029000402",
      "featureCount": 2,
      "geometries": [
        { "featureIndex": 0, "ringCount": 1, "representativePoint": { "lon": -84.36, "lat": 41.28, "method": "…" },
          "bboxWgs84": [ -84.37, 41.27, -84.35, 41.29 ], "rings": [[[ -84.37, 41.29 ], "…" ]] }
      ]
    } ] }
  }
  ```
- **How the geometry is obtained / caveats:** The query requests `outSR=4326`, and `shapeGeometries` returns each feature's `rings` (ArcGIS rings, EPSG:4326) plus a guaranteed-interior `representativePoint` and a WGS84 bbox. Native SR is wkid 3728 (Ohio North ftUS), reprojected server-side. Because the parcel ID query sends **both** the dashed `Parcel` and undashed `Parcel2` forms, either input form resolves. Multi-feature parcels return every disjoint ring (never summed/merged).

## Not supported
- None of the three. (Overlay-only sources for this jurisdiction — `oh-state-overlays`, `federal` — carry no parcel tools, but that is out of scope for the three parcel questions, all of which are satisfied by the Auditor tool.)
