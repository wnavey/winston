# New York, NY (5 boroughs) — Parcel Resolution Audit

- **Slug:** `new-york-ny`
- **County:** New York (5 boroughs) · **State:** NY
- **Parcel sources reviewed:** `nyc-geosearch` (`src/sources/nyc-geosearch/geocode.ts`), `nyc-pluto` (`src/sources/nyc-pluto/lookup.ts`, `geometry.ts`, `config.ts`), `nyc-acris` (`src/sources/nyc-acris/`), `nyc-dob` (`src/sources/nyc-dob/`) — the latter two are recorded-doc / permit tools keyed off BBL/BIN, no parcel-resolution role.

The NYC "parcel ID" is the **BBL** (Borough-Block-Lot, 10-digit tax-lot key).

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID (BBL) | Y | `nyc_geocode_address` | `src/sources/nyc-geosearch` |
| 2. Lat/Lon → Parcel ID (BBL) | N | `-` | `-` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `nyc_pluto_geometry` | `src/sources/nyc-pluto` |

### Q1 — Address → Parcel ID (BBL)  ✅
- **Tool:** `nyc_geocode_address` — module `src/sources/nyc-geosearch/geocode.ts`
- **Upstream request:** `GET https://geosearch.planninglabs.nyc/v2/search?text=ADDRESS&size=3` (NYC DCP GeoSearch / Pelias over PAD/Geosupport)
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "address": { "type": "string" },
      "size": { "type": "number", "description": "Max candidates 1-10, default 3" }
    },
    "required": ["address"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "best": { "label": "18 India Street, Brooklyn, NY, 11222", "bbl": "3025380001",
        "bin": "3061234", "borough": "Brooklyn", "lat": 40.729, "lon": -73.958, "confidence": 1 },
      "candidates": [ "…" ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl 'https://geosearch.planninglabs.nyc/v2/search?text=ADDRESS&size=3'
  ```
- **How the parcel ID is obtained / caveats:** The BBL and BIN come from the feature's `addendum.pad` block; the first feature is the best match. If the top match lacks a BBL (intersection / non-addressable point) the tool returns a warning but still surfaces candidates. BBL is the tax-lot/parcel key for every downstream NYC tool.

### Q3 — Parcel ID (BBL) → WGS84 polygon / GeoJSON  ✅
- **Tool:** `nyc_pluto_geometry` — module `src/sources/nyc-pluto/geometry.ts`
- **Upstream request:** `GET https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0/query?where=BBL=<numeric BBL>&outFields=BBL,Address,ZoneDist1,LotArea&returnGeometry=true&outSR=4326&f=json`
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "bbl": { "type": "string", "description": "10-digit Borough-Block-Lot key" } },
    "required": ["bbl"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "bbl": "3025380001",
      "spatialReference": 4326,
      "centroid": { "lat": 40.7291, "lon": -73.9585 },
      "geometry": { "rings": [[[ -73.9587, 40.7293 ], "…" ]] },
      "geojson": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[ -73.9587, 40.7293 ], "…" ]] }, "properties": { "bbl": "3025380001" } }
    }
  }
  ```
- **Sample curl:**
  ```bash
  curl "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0/query?where=BBL=3025380001&outFields=BBL,Address&returnGeometry=true&outSR=4326&f=json"
  ```
- **How the geometry is obtained / caveats:** MapPLUTO FeatureServer is queried with `outSR=4326`; the handler returns the ArcGIS `rings`, a computed WGS84 `centroid`, **and** a proper GeoJSON Feature (`buildGeoJSON` flips ArcGIS clockwise rings to GeoJSON counter-clockwise and nests holes into Polygon/MultiPolygon). This is a genuine WGS84 GeoJSON output.

## Not supported
- **Q2 (Lat/Lon → Parcel ID / BBL):** No tool resolves a coordinate to a BBL. `nyc_geocode_address` is text-only (Pelias `text=` forward geocode) with no reverse/point mode; `nyc_pluto_*`, `nyc_acris_*`, `nyc_dob_*` all key on an already-known BBL/BIN. There is no point-in-lot or reverse-geocode handler in any NYC module, so a coordinate cannot be turned into a BBL.
