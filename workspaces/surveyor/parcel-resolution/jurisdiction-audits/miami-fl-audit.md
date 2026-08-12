# Miami, FL — Parcel Resolution Audit

- **Slug:** `miami-fl`
- **County:** Miami-Dade · **State:** FL
- **Parcel sources reviewed:** `mdpa` (`src/sources/mdpa/{index,search,details,config}.ts`), `mdc-gis` (`src/sources/mdc-gis/{index,property-profile,config}.ts`); also referenced `coc-gis` (City lat/lon overlay sweep) and `miami-permits-arcgis` (permit search by folio/address). Shared `src/lib/gis-client.ts`.

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | Y | `mdpa_search` | `src/sources/mdpa` |
| 2. Lat/Lon → Parcel ID | N | `-` | — |
| 3. Parcel ID → WGS84 polygon/GeoJSON | Partial | `mdpa_details` | `src/sources/mdpa` |

### Q1 — Address → Parcel ID  ✅
- **Tool:** `mdpa_search` — source `mdpa`, module `src/sources/mdpa/search.ts` (+ `config.ts`)
- **Upstream request:** `GET https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx?Operation=GetAddress&clientAppName=PropertySearch&myAddress=<ADDRESS>&myUnit=&from=1&to=200`
- **How it works:** `searchType:"address"` calls the PA Services Proxy `GetAddress` operation. Each `MinimumPropertyInfos[]` row carries `Strap` (dashed folio); the handler normalizes it to the 13-digit `folio` (digits only), the universal downstream key.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "searchType": { "type": "string", "enum": ["address", "owner", "partial-folio", "subdivision"] }
    },
    "required": ["query", "searchType"]
  }
  ```
- **Sample response JSON:**
  ```json
  {
    "success": true,
    "data": {
      "searchType": "address", "query": "700 NW 1 AVE", "total": 1, "resultCount": 1,
      "results": [
        { "folio": "0141370720120", "strap": "01-4137-072-0120", "siteAddress": "700 NW 1 AVE", "owner1": "...", "municipality": "MIAMI" }
      ]
    }
  }
  ```
- **Sample curl (against upstream):**
  ```bash
  curl 'https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx?Operation=GetAddress&clientAppName=PropertySearch&myUnit=&myAddress=700%20NW%201%20AVE&from=1&to=200'
  ```
- **How the parcel ID is obtained / caveats:** Folio is derived from the row's `Strap` via `normalizeFolio`. `partial-folio` and `subdivision` search types bulk-list parcels by folio stem / subdivision name; `owner` is `GetOwners`.

### Q3 — Parcel ID → WGS84 polygon/GeoJSON  ⚠️ Partial
- **Tool:** `mdpa_details` — source `mdpa`, module `src/sources/mdpa/details.ts` (+ `config.ts`)
- **Upstream requests:** detail attributes from `GET .../PaServicesProxy.ashx?Operation=GetPropertySearchByFolio&folioNumber=<folio>`; geometry from the PA GIS parcel MapServer `GET https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/1/query?where=FOLIO='<folio>'&returnGeometry=true&outSR=2236` (layer 0 point fallback for condo/renumbered folios).
- **Why Partial:** the tool DOES return the parcel polygon `geometry.rings`, but those rings are in **native SR 2236** (NAD83 HARN Florida East State Plane, US survey feet) — `fetchGeometry` requests `outSR=${PA_SPATIAL_REFERENCE}` where `PA_SPATIAL_REFERENCE = 2236`. A separate `outSR=4326` query IS made, but its result is used only to compute the WGS84 **centroid** (`wgs84:{lat,lon}`) — the WGS84 ring is discarded, never returned. So the caller gets a State-Plane polygon + a WGS84 point, not a WGS84 polygon.
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "properties": { "folio": { "type": "string" } },
    "required": ["folio"]
  }
  ```
- **Sample response JSON (geometry excerpt):**
  ```json
  {
    "success": true,
    "data": {
      "folio": "0141370720120",
      "geometry": {
        "folioUsed": "0141370720120",
        "rings": [[[938000.1, 528000.2], "..."]],
        "spatialReference": 2236,
        "centroid": { "x": 938050.0, "y": 528050.0 },
        "wgs84": { "lat": 25.7846, "lon": -80.1963 },
        "geometrySource": "pa-gis-polygon"
      }
    }
  }
  ```
- **Sample curl (upstream, the WGS84 form the tool queries internally but does not surface as rings):**
  ```bash
  curl "https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/1/query?f=json&where=FOLIO%3D%270141370720120%27&outFields=FOLIO&returnGeometry=true&outSR=4326"
  ```
- **Verdict:** Partial — a parcel→polygon capability exists, but the returned polygon SR is State Plane 2236; only the centroid is WGS84. To get a true WGS84 polygon a caller would have to hit the upstream layer directly with `outSR=4326` (as shown), which no tool exposes.

## Not supported
- **Q2 (Lat/Lon → Parcel ID): N.** No tool resolves a coordinate to a folio. `mdc_property_profile` accepts `folio` OR `x`/`y`, but (a) `x`/`y` are SR 2236 State Plane, not lat/lon, and (b) with `x`/`y` it queries overlay layers at the point and returns overlay data — it never queries the parcel layer for the point's FOLIO (the parcel layer is used only for the folio→centroid direction in `resolveCentroidFromFolio`). `coc_property_profile` accepts lat/lon but returns City of Miami overlays (Miami 21 zoning, FLUM, etc.), no parcel id. `mdpa_search` has no coordinate mode; `miami_permits_search` keys on folio/address. So coordinate→parcel is unsupported.
