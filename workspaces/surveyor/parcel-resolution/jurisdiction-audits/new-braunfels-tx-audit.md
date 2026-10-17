# New Braunfels, TX — Parcel Resolution Audit

- **Slug:** `new-braunfels-tx`
- **County:** Comal · **State:** TX
- **Parcel sources reviewed:** `nb-gis` (`src/sources/nb-gis/{parcel-lookup,property-profile,geocode,config}.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `nb_parcel_lookup` | `src/sources/nb-gis` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `nb_parcel_lookup` | `src/sources/nb-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `nb_parcel_lookup` — source `nb-gis`, module `src/sources/nb-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://gismaps.newbraunfels.gov/arcserverwa22/rest/services/OpenData/AddressesBoundaries/MapServer/4/query?where=UPPER(CAD_Situs)='ADDRESS'&outFields=*&returnGeometry=true&outSR=2278&f=json` (exact match first, then `LIKE '%ADDRESS%'`; falls back to the outside-ETJ parcels layer `MapServer/5`).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "propId": { "type": "number" },
      "address": { "type": "string" }
    }
  }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": {
    "propId": 1458, "owner": "...", "address": "699 W SAN ANTONIO ST",
    "legalDescription": "...", "subdivision": "...", "deedNumber": "...",
    "geometry": { "rings": [[[x,y],...]], "centroid": {"x":..,"y":..}, "spatialReference": 2278 },
    "wgs84": { "latitude": 29.70, "longitude": -98.12 }
  } }
  ```
- **Sample curl (upstream):**
  ```bash
  curl "https://gismaps.newbraunfels.gov/arcserverwa22/rest/services/OpenData/AddressesBoundaries/MapServer/4/query?where=UPPER(CAD_Situs)%20LIKE%20'%25699%20W%20SAN%20ANTONIO%20ST%25'&outFields=*&returnGeometry=true&outSR=2278&f=json"
  ```
- **How the parcel ID is obtained / caveats:** Matches on the `CAD_Situs` field; the returned `Prop_ID` (Comal CAD property id, integer) is the primary key for all other NB tools. `Geographic_Id` is mostly null — do not rely on it.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `nb_parcel_lookup` (by `propId`) — source `nb-gis`, module `src/sources/nb-gis/parcel-lookup.ts`
- **Upstream request:** primary geometry query `...MapServer/4/query?where=Prop_ID=PARCEL_ID&returnGeometry=true&outSR=2278&f=json`; a secondary `outSR=4326` query is made only to compute a centroid.
- **Tool input schema:** (same as Q1 — pass `propId`)
  ```json
  { "type": "object", "properties": { "propId": { "type": "number" }, "address": { "type": "string" } } }
  ```
- **Sample response JSON:**
  ```json
  { "success": true, "data": {
    "propId": 1458,
    "geometry": { "rings": [[[x,y],...]], "centroid": {"x":..,"y":..}, "spatialReference": 2278 },
    "wgs84": { "latitude": 29.70, "longitude": -98.12 }
  } }
  ```
- **Sample curl (upstream):**
  ```bash
  curl "https://gismaps.newbraunfels.gov/arcserverwa22/rest/services/OpenData/AddressesBoundaries/MapServer/4/query?where=Prop_ID=1458&outFields=*&returnGeometry=true&outSR=2278&f=json"
  ```
- **How the geometry is obtained / caveats:** The **boundary polygon returned to the caller is in State Plane WKID 2278** (NAD83 / Texas South Central, US ft). The `getWgs84Centroid` helper re-queries at `outSR=4326` but keeps only the computed **centroid** (`wgs84`), discarding the WGS84 rings. No tool emits a WGS84 boundary polygon/GeoJSON → **Partial**. (`nb_property_profile` also returns geometry only in 2278.)

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate-to-parcel tool. `nb_parcel_lookup` takes `propId` or `address`; `nb_zoning_lookup` / `nb_property_profile` / `nb_adjacent_properties` all take `propId`; `nb_geocode` takes an address and returns coordinates only (no parcel id).
- **Q3 is Partial, not full:** boundary geometry is surfaced only in native SR 2278; WGS84 output is a centroid point.
