# TxDOT (statewide overlay) — Parcel Resolution Audit

- **Slug:** `txdot`
- **County:** Statewide · **State:** TX
- **Parcel sources reviewed:** `txdot` (`src/sources/txdot/index.ts`, `roadway-lookup.ts`, `traffic-counts.ts`, `row-parcels.ts`)

## Capability Summary

| Question | Supported | Tool | Source module |
|---|---|---|---|
| 1. Address → Parcel ID | N | — | `src/sources/txdot` |
| 2. Lat/Lon → Parcel ID | N | — | `src/sources/txdot` |
| 3. Parcel ID → WGS84 polygon/GeoJSON | N | — | `src/sources/txdot` |

## Not supported
- **Overlay source, not a parcel jurisdiction.** The `txdot` module is a statewide transportation/ROW overlay. Its three tools — `txdot_roadway_lookup`, `txdot_traffic_counts`, `txdot_row_parcels` — are spatial lookups keyed on a WGS84 lat/lon. No appraisal/assessor, county-clerk, or property-parcel system.
- **Q1 (Address→Parcel):** N — no address-search tool.
- **Q2 (Lat/Lon→Parcel):** N — `txdot_row_parcels` takes a lat/lon, but it queries the *TxDOT ROW Proposed-Parcels* layer and returns TxDOT right-of-way **acquisition** parcels (`PRCL_ID`, project CSJ, take acreage) tied to highway projects — a coordination/conflict flag, NOT the subject property's assessor/account parcel ID. An empty result is the normal case. It does not resolve a coordinate to the underlying property parcel.
- **Q3 (Parcel→WGS84 polygon):** N — no tool accepts a parcel ID as input; `txdot_row_parcels` runs `returnGeometry=false` and does not return parcel boundaries.
