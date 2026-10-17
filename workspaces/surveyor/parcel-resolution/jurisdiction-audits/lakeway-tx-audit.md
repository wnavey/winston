# Lakeway, TX — Parcel Resolution Audit

- **Slug:** `lakeway-tx`
- **County:** Travis · **State:** TX
- **Parcel sources reviewed:** `tcad` (`src/sources/tcad/{index,search,details,client}.ts` + `src/lib/trueprodigy-client.ts`); `lakeway-gis` (`src/sources/lakeway-gis/{index,config,parcel-lookup,property-profile,zoning-lookup,adjacent-context}.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `appraisal_search` | `src/sources/tcad` |
| 2. Lat/Lon → Parcel ID | N | — | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `lakeway_parcel_lookup` | `src/sources/lakeway-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `appraisal_search` — source `tcad`, module `src/sources/tcad/search.ts` (transport in `src/lib/trueprodigy-client.ts`)
- **Upstream request:** `POST https://prod-container.trueprodigyapi.com/public/property/searchfulltext` (address/owner full-text; `parcelId` uses `POST /public/property/search?page=1&pageSize=20` with `geoID begins`). Preceded by `POST /trueprodigy/cadpublic/auth/token` `{office:"Travis"}` for an anonymous token.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "parcelId", "owner"] }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "resultCount": 1,
      "results": [ { "geoID": "0135700330", "pAccountID": 456789, "pID": 135700, "name": "OWNER", "legalDescription": "LOT 7 BLK B OAKS AT LAKEWAY SUBD" } ]
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  TOKEN=$(curl -s -X POST https://prod-container.trueprodigyapi.com/trueprodigy/cadpublic/auth/token \
    -H 'Content-Type: application/json' -d '{"office":"Travis"}' | jq -r .user.token)
  curl -s -X POST 'https://prod-container.trueprodigyapi.com/public/property/searchfulltext' \
    -H 'Content-Type: application/json' -H "Authorization: $TOKEN" \
    -H 'Origin: https://travis.prodigycad.com' -H 'Referer: https://travis.prodigycad.com/' \
    -d '{"pYear":{"operator":"=","value":2026},"fullTextSearch":{"operator":"match","value":"ADDRESS"}}'
  ```
- **How the parcel ID is obtained / caveats:** Same TCAD (TrueProdigy, office `Travis`) portal Lakeway shares countywide. Address full-text match returns rows with `geoID` (= Lakeway GIS `PID_10`, 10-digit) plus `pAccountID`. Lakeway GIS tools take only a parcelId, so address→parcel resolution is TCAD's.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `lakeway_parcel_lookup` — source `lakeway-gis`, module `src/sources/lakeway-gis/parcel-lookup.ts`
- **Upstream request:** `GET https://services8.arcgis.com/Ovzem8VyXkJhfTgz/arcgis/rest/services/TCAD_Parcels/FeatureServer/0/query?f=json&where=PID_10='<PARCEL_ID>'&outFields=PID_10&returnGeometry=true&outSR=4326` (WGS84 ring fetch, run in parallel with a native-SR 102100 fetch for attributes + centroid).
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "parcelId": { "type": "string", "description": "10-digit TCAD geoID (e.g. \"0135700330\")" } },
    "required": ["parcelId"]
  }
  ```
- **Sample response JSON (shape the tool returns to the caller):**
  ```json
  {
    "success": true,
    "data": {
      "parcelId": "0135700330",
      "attributes": { "PID_10": "0135700330", "PROP_ID": 135700, "SITUS": "...", "Jurisdiction": "CITY LIMITS" },
      "geometry": {
        "native": { "rings": [[[-10870000,3540000]]], "spatialReference": 102100 },
        "centroid": { "x": -10870050, "y": 3540050 },
        "geojson": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-97.99,30.36]]] }, "properties": { "parcelId": "0135700330" } }
      }
    }
  }
  ```
- **Sample curl (against the upstream; placeholders OK):**
  ```bash
  curl -s "https://services8.arcgis.com/Ovzem8VyXkJhfTgz/arcgis/rest/services/TCAD_Parcels/FeatureServer/0/query?f=json&where=PID_10%3D%27PARCEL_ID%27&outFields=PID_10&returnGeometry=true&outSR=4326"
  ```
- **How geometry is obtained / caveats:** Native SR is Web Mercator (102100); the handler issues a second `outSR=4326` query and rebuilds the ring into a GeoJSON `Polygon`/`MultiPolygon` via `buildParcelGeoJSON` under `geometry.geojson`. Native Web-Mercator rings + centroid also returned. Input is the parcelId (geoID) — a true parcel→polygon tool.

## Not supported
- **Q2 (Lat/Lon → Parcel ID):** No coordinate→parcel tool. `lakeway_parcel_lookup`, `lakeway_property_profile`, and `lakeway_zoning_lookup` all require a 10-digit `parcelId`; `lakeway_adjacent_context` requires a `geoId`. None runs a point-in-polygon query against the `TCAD_Parcels` layer to identify the parcel under a coordinate. `tcad appraisal_search` accepts only address/parcelId/owner. Resolution path is address→geoID via TCAD first.
