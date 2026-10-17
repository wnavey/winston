# Texas (statewide overlay) — Parcel Resolution Audit

- **Slug:** `texas-tx`
- **County:** Statewide · **State:** TX
- **Parcel sources reviewed:** `texas` (`src/sources/texas/index.ts` + all tool modules)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | N | — | `src/sources/texas` |
| 2. Lat/Lon → Parcel ID | N | — | `src/sources/texas` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | — | `src/sources/texas` |

## Not supported
- **Overlay source, not a parcel jurisdiction.** The `texas` module is a statewide environmental + water-data overlay. Its five tools — `texas_groundwater_profile`, `texas_water_utility_lookup`, `texas_environmental_sites`, `texas_public_water_sources`, `texas_lidar_coverage` — are all spatial lookups keyed on a WGS84 lat/lon (supplied by the base-city CAD/GIS source). There is no appraisal/assessor, county-clerk, or parcel/plat system here.
- **Q1 (Address→Parcel):** N — no address-search or assessor tool exists.
- **Q2 (Lat/Lon→Parcel):** N — tools take a coordinate but return TWDB/PUC/TCEQ overlay data (aquifers, utilities, regulated sites, PWS, lidar), never a parcel/account ID.
- **Q3 (Parcel→WGS84 polygon):** N — no tool accepts a parcel ID.
