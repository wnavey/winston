# Fort Lauderdale, FL — Parcel Resolution Audit

- **Slug:** `fort-lauderdale-fl`
- **County:** Broward · **State:** FL
- **Parcel sources reviewed:** `bcpa` (`src/sources/bcpa/{index,search,config}.ts`), `broward-gis` (`src/sources/broward-gis/{index,parcel-lookup,property-profile,config}.ts`), `fortlauderdale-gis` (`src/sources/fortlauderdale-gis/{index,property-profile,config}.ts`); shared `src/lib/{point-profile,gis-client}.ts`

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `bcpa_search` | `src/sources/bcpa` |
| 2. Lat/Lon → Parcel ID | Y | `fortlauderdale_property_profile` | `src/sources/fortlauderdale-gis` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Y | `broward_parcel_lookup` | `src/sources/broward-gis` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `bcpa_search` — source `bcpa`, module `src/sources/bcpa/search.ts`
- **Upstream request:** `POST https://web.bcpa.net/BcpaClient/search.aspx/GetData` (the `BCPA_GETDATA_URL` ASP.NET page-method) with a JSON body `{ value, cities, orderBy, pageNumber, pageCount, ... }`.
- **How it works:** `searchType:"address"` posts the address as `value` with `cities` defaulting to `'FL'` (BCPA's in-city Fort Lauderdale discriminator). The response's `resultListk__BackingField[]` rows carry `folioNumber`; the handler normalizes each to the bare 12-digit FOLIO.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "owner", "folio"] },
      "cities": { "type": "string" }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON:**
  ```json
  {
    "success": true,
    "data": {
      "searchType": "address", "query": "401 E LAS OLAS", "cities": "FL",
      "total": 1, "resultCount": 1,
      "results": [
        { "folio": "504210820021", "ownerName1": "LSREF7 401 PROPCO LLC", "siteAddress1": "401 E LAS OLAS BLVD" }
      ]
    }
  }
  ```
- **Sample curl (against upstream):**
  ```bash
  curl -X POST 'https://web.bcpa.net/BcpaClient/search.aspx/GetData' \
    -H 'Content-Type: application/json' \
    -d '{"value":"401 E LAS OLAS","cities":"FL","orderBy":"","pageNumber":"1","pageCount":"50","arrayOfValues":"","selectedFromList":"false","totalCount":"0"}'
  ```
- **How the parcel ID is obtained / caveats:** FOLIO comes from `folioNumber` in the GetData result list. `cities=''` widens to the whole county.

### Q2 — Lat/Lon → Parcel ID  ✅
- **Tool:** `fortlauderdale_property_profile` — source `fortlauderdale-gis`, module `src/sources/fortlauderdale-gis/property-profile.ts` (+ `config.ts`)
- **Upstream request:** `POST https://gis.fortlauderdale.gov/arcgis/rest/services/Gridics/Layers/MapServer/6/query` (the "Tax Parcel (BCPA CAMA)" layer) with an `esriGeometryPoint` at the lon/lat, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, `outFields=FOLIO,PARCELID,SITEADDRESS,...`.
- **How it works:** the tool takes `lon`/`lat` (WGS84) and fans a point-in-polygon intersect across ~30 city layers (via `runPointProfile`). One of them — `tax-parcel` (Gridics layer 6, category `property`) — is a 195k-parcel BCPA CAMA layer whose `outFields` include `FOLIO` (12-digit) and `PARCELID` (10-digit). So a coordinate resolves to the parcel's FOLIO. (Layer spans 18 Broward municipalities + unincorporated, so it resolves even outside city limits.)
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "lon": { "type": "number" },
      "lat": { "type": "number" },
      "categories": { "type": "string" }
    },
    "required": ["lon", "lat"]
  }
  ```
- **Sample response JSON (trimmed to the parcel-bearing layer):**
  ```json
  {
    "point": { "lon": -80.1392, "lat": 26.1198 },
    "results": {
      "property": [
        {
          "layerId": "tax-parcel",
          "status": "ok",
          "features": [
            { "FOLIO": "504210820021", "PARCELID": "5042108200", "SITEADDRESS": "401 E LAS OLAS BLVD", "OWNERNME1": "...", "SALE1CIN": "120064764" }
          ]
        }
      ],
      "zoning": [ { "layerId": "zoning-districts", "features": [ { "ZONECLASS": "RAC-CC" } ] } ]
    }
  }
  ```
- **Sample curl (against upstream, just the parcel layer):**
  ```bash
  curl -X POST 'https://gis.fortlauderdale.gov/arcgis/rest/services/Gridics/Layers/MapServer/6/query' \
    -d 'f=json' -d 'geometry={"x":-80.1392,"y":26.1198}' -d 'geometryType=esriGeometryPoint' \
    -d 'inSR=4326' -d 'outSR=4326' -d 'spatialRel=esriSpatialRelIntersects' \
    -d 'outFields=FOLIO,PARCELID,SITEADDRESS' -d 'returnGeometry=false'
  ```
- **How the parcel ID is obtained / caveats:** FOLIO is a returned attribute on the intersected Tax Parcel polygon. Filter `categories=property` to isolate the parcel layer. The tool's primary purpose is a city zoning/overlay sweep, but the Tax Parcel layer makes it a genuine coordinate→FOLIO resolver.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ✅
- **Tool:** `broward_parcel_lookup` — source `broward-gis`, module `src/sources/broward-gis/parcel-lookup.ts` (+ `config.ts`)
- **Upstream request:** `GET https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services/PARCEL_POLY_BCPA_TAXROLL/FeatureServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=4326&where=FOLIO='<folio>'`
- **How it works:** takes the bare 12-digit FOLIO, queries the authoritative parcel+tax-roll layer with `returnGeometry=true&outSR=4326`, and returns `geometry.rings` + a computed centroid, explicitly tagged `spatialReference: 4326` with a `wgs84:{lon,lat}` convenience.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "folio": { "type": "string" } },
    "required": ["folio"]
  }
  ```
- **Sample response JSON:**
  ```json
  {
    "success": true,
    "data": {
      "folio": "504210820021",
      "inFortLauderdale": true,
      "taxRoll": { "owner1": "TAF GG LAS OLAS LP", "situsAddress": "401 E LAS OLAS BLVD", "useCode": "..." },
      "geometry": {
        "rings": [[[-80.1394, 26.1200], [-80.1390, 26.1200], "..."]],
        "centroid": { "x": -80.1392, "y": 26.1198 },
        "wgs84": { "lon": -80.1392, "lat": 26.1198 },
        "spatialReference": 4326
      }
    }
  }
  ```
- **Sample curl (against upstream):**
  ```bash
  curl "https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services/PARCEL_POLY_BCPA_TAXROLL/FeatureServer/0/query?f=json&outFields=*&returnGeometry=true&outSR=4326&where=FOLIO%3D%27504210820021%27"
  ```
- **How the geometry is obtained / caveats:** Native SR is 102658/2236 (State Plane ft); the tool forces `outSR=4326`, so the rings ARE WGS84 (ArcGIS rings, not GeoJSON — but WGS84 as required). Owner attributes can lag the live BCPA record; use `bcpa_details` for the current owner.

## Not supported
- (None — all three questions supported.)
