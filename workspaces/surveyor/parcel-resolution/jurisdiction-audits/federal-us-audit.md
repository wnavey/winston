# Federal (national overlay) — Parcel Resolution Audit

- **Slug:** `federal-us`
- **County:** National · **State:** US
- **Parcel sources reviewed:** `federal` (`src/sources/federal/index.ts` + all tool modules)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | N | — | `src/sources/federal` |
| 2. Lat/Lon → Parcel ID | N | — | `src/sources/federal` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | — | `src/sources/federal` |

## Not supported
- **Overlay source, not a parcel jurisdiction.** The `federal` module is a national spatial-data overlay. Its seven tools — `federal_wetlands_inventory`, `federal_waters_screen`, `federal_airport_proximity`, `federal_airspace_lookup`, `federal_soil_profile`, `federal_elevation_profile`, `federal_pipeline_proximity` — are all spatial lookups keyed on a WGS84 lat/lon (FWS NWI, USGS NHD, FAA, USDA NRCS SSURGO, USGS 3DEP). No appraisal/assessor, county-clerk, or parcel/plat system.
- **Q1 (Address→Parcel):** N — no address-search tool.
- **Q2 (Lat/Lon→Parcel):** N — tools take a coordinate but return federal overlay data (wetlands, waters, airspace, soils, elevation, pipelines), never a parcel/account ID.
- **Q3 (Parcel→WGS84 polygon):** N — no tool accepts a parcel ID.
