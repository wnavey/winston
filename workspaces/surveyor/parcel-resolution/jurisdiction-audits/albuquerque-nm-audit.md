# Albuquerque, NM — Parcel Resolution Audit

- **Slug:** `albuquerque-nm`
- **County:** Bernalillo · **State:** NM
- **Parcel sources reviewed:** `bernco-assessor` — `src/sources/bernco-assessor/parcel.ts`, `config.ts`, `index.ts` (the countywide assessor roll is the parcel authority; `cabq-gis`/`bernco-gis` geocoders return points, not parcel IDs)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `bernco_parcel_search` | `src/sources/bernco-assessor` |
| 2. Lat/Lon → Parcel ID | Y | `bernco_parcel_point_lookup` | `src/sources/bernco-assessor` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `bernco_parcel_lookup` | `src/sources/bernco-assessor` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `bernco_parcel_search` — source `bernco-assessor`, module `src/sources/bernco-assessor/parcel.ts`
- **Upstream request:** `POST https://assessormap.bernco.gov/server/rest/services/GIS/Assessor_Parcels_Public/MapServer/0/query` with form body `f=json&where=UPPER(SITUSADD) LIKE '<ADDRESS>%'&outFields=<PARCEL_CORE_FIELDS>&returnGeometry=false&outSR=4326&resultRecordCount=25&orderByFields=UPC`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Address, owner name, or 18-digit UPC" },
      "searchType": { "type": "string", "enum": ["address", "owner", "upc", "auto"], "description": "\"auto\" (default) infers UPC vs address vs owner from the query shape" },
      "limit": { "type": "number" }
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
      "query": "1 CIVIC PLAZA",
      "count": 1,
      "parcels": [
        { "UPC": "101905912705531702", "OWNER": "…", "SITUSADD": "…", "LEGALDESC": "…", "TAXYR": 2026, "TOTVALUE": 0 }
      ]
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  curl -X POST "https://assessormap.bernco.gov/server/rest/services/GIS/Assessor_Parcels_Public/MapServer/0/query" \
    --data-urlencode "f=json" \
    --data-urlencode "where=UPPER(SITUSADD) LIKE '<ADDRESS>%'" \
    --data-urlencode "outFields=UPC,OWNER,SITUSADD,LEGALDESC,TAXYR" \
    --data-urlencode "returnGeometry=false" --data-urlencode "outSR=4326" --data-urlencode "resultRecordCount=25"
  ```
- **How the parcel ID is obtained / caveats:** Leading-anchored `UPPER(SITUSADD) LIKE '<addr>%'` against the TAXYR-2026 assessor roll (layer 0); returns the 18-digit `UPC`, the universal join key. Every response asserts `TAXYR` and warns on vintage drift (seven parcel layers exist; the stale ones return clean 200s).

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `bernco_parcel_point_lookup` — source `bernco-assessor`, module `src/sources/bernco-assessor/parcel.ts`
- **Upstream request:** `POST .../GIS/Assessor_Parcels_Public/MapServer/0/query` with form body `f=json&geometry={"x":<LON>,"y":<LAT>,"spatialReference":{"wkid":4326}}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=<PARCEL_CORE_FIELDS>&returnGeometry=false&outSR=4326`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "longitude": { "type": "number", "description": "WGS84 longitude (e.g. -106.564471)" },
      "latitude": { "type": "number", "description": "WGS84 latitude (e.g. 35.103247)" },
      "includeGeometry": { "type": "boolean", "description": "Return the WGS84 polygon rings (default false)" }
    },
    "required": ["longitude", "latitude"]
  }
  ```
- **Sample response JSON (trimmed):**
  ```json
  {
    "success": true,
    "data": {
      "point": { "longitude": -106.564471, "latitude": 35.103247 },
      "found": true,
      "count": 1,
      "parcels": [ { "attributes": { "UPC": "101905912705531702", "OWNER": "…", "SITUSADD": "…", "TAXYR": 2026 } } ]
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  curl -X POST "https://assessormap.bernco.gov/server/rest/services/GIS/Assessor_Parcels_Public/MapServer/0/query" \
    --data-urlencode "f=json" \
    --data-urlencode 'geometry={"x":<LON>,"y":<LAT>,"spatialReference":{"wkid":4326}}' \
    --data-urlencode "geometryType=esriGeometryPoint" --data-urlencode "inSR=4326" \
    --data-urlencode "spatialRel=esriSpatialRelIntersects" \
    --data-urlencode "outFields=UPC,OWNER,SITUSADD,TAXYR" --data-urlencode "returnGeometry=false" --data-urlencode "outSR=4326"
  ```
- **How the parcel ID is obtained / caveats:** True point-in-polygon `esriSpatialRelIntersects` on a WGS84 point; returns the containing parcel's `UPC`. Documented as "the ONLY sound way to confirm parcel identity from coordinates" (the UPC geocoder proves existence, never identity). A zero result is a legitimate answer (public right-of-way / Isleta Pueblo tribal land are off the roll), not an error.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `bernco_parcel_lookup` — source `bernco-assessor`, module `src/sources/bernco-assessor/parcel.ts`
- **Upstream request:** `POST .../GIS/Assessor_Parcels_Public/MapServer/0/query` with `f=json&where=UPC = '<PARCEL_ID>'&outFields=<PARCEL_CORE_FIELDS>&returnGeometry=true&outSR=4326`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "upc": { "type": "string", "description": "18-digit Bernalillo County UPC (unpunctuated; dashes are stripped)" },
      "includeGeometry": { "type": "boolean", "description": "Return the full WGS84 polygon rings (default true)" }
    },
    "required": ["upc"]
  }
  ```
- **Sample response JSON (trimmed):**
  ```json
  {
    "success": true,
    "data": {
      "upc": "101905912705531702",
      "found": true,
      "attributes": { "UPC": "101905912705531702", "OWNER": "…", "LEGALDESC": "…", "TAXYR": 2026 },
      "centroid": { "longitude": -106.56, "latitude": 35.10 },
      "geometry": { "type": "Polygon", "rings": [[[-106.56,35.10],…]], "spatialReference": 4326 }
    }
  }
  ```
- **Sample curl (against the upstream):**
  ```bash
  curl -X POST "https://assessormap.bernco.gov/server/rest/services/GIS/Assessor_Parcels_Public/MapServer/0/query" \
    --data-urlencode "f=json" --data-urlencode "where=UPC = '<PARCEL_ID>'" \
    --data-urlencode "outFields=UPC,OWNER,LEGALDESC,TAXYR" \
    --data-urlencode "returnGeometry=true" --data-urlencode "outSR=4326"
  ```
- **How the geometry is obtained / caveats:** The shared `queryParcels` helper hard-codes `outSR=4326` on every request, so geometry comes back as WGS84 rings; the handler returns `geometry: { type: "Polygon", rings, spatialReference: 4326 }` plus a WGS84 `centroid` computed from those rings (shoelace, native `returnCentroid` unsupported on this MapServer). WGS84 confirmed — rings, not a strict GeoJSON `Feature` wrapper, but explicitly `wkid:4326`.

## Not supported
- All three questions are supported. (No caveats rise to N/Partial — Q3 returns WGS84 rings with `spatialReference:4326`, meeting the WGS84 requirement.)
