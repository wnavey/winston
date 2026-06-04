# Fire (AFD) — Discipline Finding

**Property:** 9101 Cameron Rd, Austin, TX 78753
**Zoning:** CS (General Commercial Services)
**Lot Area:** 1.01 AC / 44,150 SF
**Proposed:** AutoZone retail store, 7,375 SF single-story (Prototype 74)
**Occupancy:** Group M (Mercantile) — IBC
**Construction Type:** Not specified on concept plan (shown as "XX"); assumed Type V-B for worst-case fire flow analysis
**Discipline:** Austin Fire Department (AFD) — fire access, hydrants, sprinklers, fire flow, FDC
**Risk Level:** LOW-TO-MODERATE — standard single-story commercial retail; no high-rise, no standpipe, no unusual hazards; primary risks are fire lane geometry on a tight site and hydrant coverage verification

---

## 1. Building Classification and Sprinkler Determination

### Occupancy and Construction Type

The proposed AutoZone is a single-story retail store selling auto parts. Under the IBC this is **Group M (Mercantile)** occupancy. The concept plan does not specify the construction type (labeled "XX"), but typical single-story AutoZone prototype buildings use **Type V-B (unprotected combustible frame)** or **Type II-B (unprotected non-combustible steel)**. The fire flow analysis below uses the worst-case assumption of Type V-B; if the building is ultimately Type II-B, fire flow demand will be lower.

### Sprinkler Requirement

Under the 2021 IFC as locally amended by the City of Austin, an automatic sprinkler system is required for Group M occupancies exceeding **12,000 SF** (IFC 903.2.7). At 7,375 SF, this building is **below the IFC area threshold** for a mandatory sprinkler system based solely on occupancy area.

However, several factors may still trigger or motivate a sprinkler installation:

1. **AutoZone corporate standard:** AutoZone prototype stores typically include NFPA 13 sprinkler systems as a corporate design standard regardless of code mandates.
2. **IFC 903.2.7 Exception 1:** The building must also be evaluated for high-piled storage provisions (IFC Chapter 32) if storage exceeds 12 ft in height within any portion of the building. AutoZone stores routinely store inventory on racks above 12 ft, which would trigger **IFC 3206.2** sprinkler requirements for high-piled combustible storage regardless of building area.
3. **Fire flow and hydrant benefits:** A sprinklered building earns relaxed fire access distance (200 ft vs. 150 ft) and hydrant distance (500 ft vs. 400 ft), both of which are advantageous on this constrained site.

**Assessment:** An **NFPA 13 sprinkler system** should be assumed for this project. If the building is sprinklered, it will be NFPA 13 (not 13R or 13D) because this is a commercial M-occupancy building. This triggers TRG-01 and TRG-05 in the AFD review framework.

### High-Rise and Standpipe

- **High-rise (IFC 403):** Not applicable. The building is single-story, approximately 20 ft tall, well below the 75-ft high-rise threshold.
- **Standpipe (IFC 905.3.1):** Not required. The highest floor is not more than 30 ft above the lowest level of fire department vehicle access.

---

## 2. Fire Flow Analysis

### Fire Flow Demand Calculation

Per IFC Appendix B, Table B105.1(2) for commercial buildings:

| Parameter | Value |
|---|---|
| Building fire area | 7,375 SF (single story, no horizontal roof projection overhang specified) |
| Construction type (worst-case) | Type V-B |
| Fire flow demand per Table B105.1(2) | **1,500 gpm at 20 psi residual** |

For a Type V-B building with fire area of 7,375 SF, Table B105.1(2) yields a required fire flow of 1,500 gpm. If construction is Type II-B (non-combustible), the fire flow would drop to approximately 1,500 gpm as well (the table floor for this area range is 1,500 gpm regardless of type at this building size).

### Sprinkler Reduction

Assuming an NFPA 13 sprinkler system is installed:

| Construction Type | Maximum Reduction | Minimum After Reduction | Reduced Fire Flow |
|---|---|---|---|
| Type V-B (combustible) | 50% per IFC Table B105.2 | 750 gpm, but 1,000 gpm minimum per table | **1,000 gpm** |
| Type II-B (non-combustible) | 75% per IFC Table B105.2 | 1,000 gpm minimum | **1,000 gpm** |

**Key note on combustible construction:** If the building is Type V (combustible), the maximum fire flow reduction is **50%**, not 75%. This is a frequent AFD comment (REQ-14, TRG-16). The reduced fire flow lands at 1,000 gpm minimum regardless of construction type for this building.

### Hydrant Count Threshold

At a reduced fire flow of **1,000 gpm** (below the 1,500 gpm threshold), only **one** fire hydrant is required within the applicable distance. A second hydrant is not required by code. TRG-02 (fire flow >= 1,500 gpm requiring a second hydrant) does **not** trigger if the sprinkler system is installed and the reduction is taken.

If the building is **not** sprinklered, the full 1,500 gpm demand applies and a **second hydrant within 500 ft** would be required per IFC 507.5.1.

### Available Fire Flow

The concept plan does not include an AFD fire hydrant flow test. An AFD-conducted flow test (not third-party) must be obtained within 1 year of site plan submittal, tested at or near the point of connection. Both pages of the test report must be submitted (REQ-12).

The site is served by an existing **36-inch water main** and an existing **14-inch water main** along Cameron Road, plus an existing 8-inch line. A 36-inch trunk main is likely to provide ample available fire flow (well above 1,500 gpm at 20 psi residual). **Available fire flow is not expected to be a constraint**, but formal verification via the AFD flow test is mandatory.

**Citation:** IFC 507.4 (Local Amendment), Fire Criteria Manual Appendix E.

---

## 3. Fire Department Access Roads (Fire Lanes)

### Fire Access Distance Requirement

| Condition | Maximum Hose Lay Distance | Code Reference |
|---|---|---|
| Non-sprinklered building | 150 ft from fire lane to all exterior wall points | IFC 503.1.1 |
| Sprinklered building (NFPA 13) | 200 ft from fire lane to all exterior wall points | IFC 503.1.1 |

Distance is measured as **hose lay at ground level around obstructions** -- it cannot be measured through or under the building (REQ-01).

### Fire Lane Layout Assessment (from Concept Plan)

The concept plan (Sheet 01) shows a "Proposed Fire Lane" line type in the legend, and the plan depicts fire lane routing on the site. Based on the concept plan images:

**Access points:**
- **Primary:** Driveway from Cameron Road (north side of site)
- **Secondary:** Access from the west/southwest connecting to the Pecan Springs Road area

**Fire lane routing observed on concept plan:**
- The fire lane enters from Cameron Road, runs along the **west side** of the building, curves around the **south side** through the parking area, and continues along the **east side** past the dumpster enclosure.
- This creates a roughly U-shaped or three-sided fire lane wrapping west-south-east around the building.

**Coverage analysis:**
- **North face (Cameron Rd side):** The driveway approach from Cameron Road and the potential ROW dedication area place the north face of the building approximately 60-80 ft from the Cameron Road curb line. If the driveway/drive aisle from Cameron Road qualifies as fire lane, this face is adequately served. However, the preliminary pond between the building and Cameron Road may create an obstruction for hose lay measurement. The fire lane line type should extend along the north face or the hose lay path from the nearest fire lane segment around the pond must be confirmed to be within 200 ft (sprinklered).
- **West face:** Directly served by the fire lane running along the western side. Appears compliant.
- **South face:** Served by the fire lane/drive aisle through the parking area. Appears compliant.
- **East face:** The fire lane continues past the dumpster enclosure on the east side. The building's eastern face is approximately 15-20 ft from the east property line. Fire lane routing along this face is tight but appears shown on the plan.

**Potential risk areas:**
1. **Northeast corner:** The CWQZ boundaries, CEF setback lines, and preliminary pond in the NE quadrant of the site may limit fire lane access to the northeast building corner. The hose lay distance from the nearest fire lane segment to the NE corner of the building should be verified to be within 200 ft (measured around obstructions).
2. **Site width constraint:** The lot is approximately 162 ft N-S, and the building plus fire lane, parking, and maneuvering consume most of this dimension. The 25-ft fire lane width requirement, combined with the truck-turn note indicating 35-40 ft is needed for delivery truck maneuvering, creates a tight condition south of the building.

### Fire Lane Width

| Requirement | Standard | Code Reference |
|---|---|---|
| Two-way fire lane | 25 ft minimum | IFC 503.2.1 |
| One-way non-dead-end | 20 ft minimum | IFC 503.2.1 |
| Vertical clearance | 14 ft minimum | IFC 503.2.1 |

The concept plan does not dimension the fire lane width. Site plan must call out 25-ft minimum width at all fire lane segments, with 14-ft vertical clearance confirmed (including under any overhead power lines). No overhead power lines are visible on the concept plan within the fire lane routing, but this must be verified (REQ-02).

### Turning Radii

Fire lane turns require **50-ft outside / 25-ft inside turning radii** (IFC 503.2.4). The concept plan shows what appear to be 10-ft radius curves at certain corners (the crop images show "R10'" callouts at the northeast driveway). These **do not meet** the 50/25 requirement and must be revised at site plan. All turning radii along fire lanes, including the Cameron Road entrance, must be called out and dimensioned (REQ-03).

### Dead-End Fire Lanes

If the fire lane terminates at the east side of the building without a through-connection, it would constitute a dead end. Dead-end fire lanes cannot exceed **150 ft** without an approved turnaround per IFC 503.2.5 and Fire Criteria Manual Appendix G (REQ-04). The concept plan should be evaluated for whether the fire lane forms a through-route (west-to-south-to-east with egress) or a dead end requiring a turnaround.

Based on the concept plan, the fire lane appears to form a loop or through-route with access at both the Cameron Road driveway and the southwest access point. If both access points connect to fire lanes, no dead-end turnaround is required. This must be confirmed at site plan.

### Fire Lane Surface and Loading

Fire lanes must be asphalt or concrete, rated for **HS-20 loading** (32,000 lb/axle, 80,000 lb gross), with maximum grades of 13% (asphalt) or 15% (concrete) and maximum grade change of 10% in 20 ft (REQ-05). The site has a gentle slope (approximately 4-6 ft grade change across the site, per contour lines 626-636), so grades are unlikely to be an issue. The pavement section detail must state HS-20 loading on the site plan drawings.

### Fire Lane Markings and Signage

The site plan must include (REQ-07):
- Fire lane line type on all fire lane segments
- "FIRE ZONE/TOW-AWAY ZONE" stenciled in white letters at least 3 inches high at 35-ft intervals along the curb
- Signs per COA Standard Detail 901S-6 at both ends and every 50 ft or less
- Sign height 5-8 ft above grade

---

## 4. Fire Hydrant Coverage

### Primary Hydrant Distance

| Condition | Maximum Distance | Code Reference |
|---|---|---|
| Non-sprinklered | 400 ft from hydrant to all exterior wall points | IFC 507.5.1 |
| Sprinklered (NFPA 13) | 500 ft from hydrant to all exterior wall points | IFC 507.5.1 |

Distance is measured as hose lay at ground level, not through buildings or across divided highways.

### Existing Hydrant Locations

The concept plan legend includes an "Existing Fire Hydrant" symbol, but no existing fire hydrant is clearly visible on or immediately adjacent to the subject parcel in the concept plan images. The existing 36-inch water main along Cameron Road is expected to serve multiple fire hydrants along the corridor.

**Assessment:** The nearest existing public fire hydrant must be identified and its distance to all portions of the building exterior measured. Given the building footprint of approximately 75 ft x 98 ft (7,375 SF), the maximum diagonal from corner to corner is roughly 124 ft. If a hydrant exists within approximately 375 ft of the nearest building corner (for a sprinklered building), the most remote building point will be within 500 ft.

**If no existing hydrant is within range:** A new private or public hydrant will need to be installed. If private, this triggers TRG-03 (hydraulic calculations sealed by TX PE, NFPA 24 notes, "all private hydrants shall be painted red" note).

### Hydrant Location Requirements (REQ-10)

Any fire hydrant (existing or proposed) serving this site must:
- Be directly adjacent to the fire lane or public street
- Have the steamer (4-inch) opening facing fire access
- Be set back 3-6 ft from curb line
- Have 3 ft clear in all directions
- Not be within the building collapse zone (40 ft from building corner)
- Not be located in pond slopes or detention areas (the preliminary pond area is not a suitable hydrant location)

---

## 5. Fire Department Connection (FDC)

If an NFPA 13 sprinkler system is installed (expected), an FDC is required (REQ-23):

| Requirement | Standard | Code Reference |
|---|---|---|
| Location | Street side of building, fully visible from street or fire lane | IFC 912.2.1 |
| Orientation | Must face designated fire lane (Austin local amendment) | IFC 912.3 |
| Clear area | 3 ft clear around FDC | IFC 912.2.1 |
| Proximity to hydrant | Within 100 ft of hydrant (for standpipe FDC); no specific distance for sprinkler-only FDC, but adjacency preferred | NFPA 14-6.4.5.4 |

**Recommended FDC placement:** The FDC should be located on the **north face** of the building (Cameron Road side), facing the fire lane/driveway from Cameron Road. This provides maximum visibility for responding apparatus and proximity to the public water main. If the north face is not feasible due to the preliminary pond and CWQZ, the **west face** facing the western fire lane is the second-best option.

The FDC location must be shown on both the site plan and utility plan at site plan submittal.

---

## 6. Fire Line, PIV, and Riser Room

### Fire Line Sizing (REQ-18)

For an NFPA 13 sprinkler system, the underground fire line must be a minimum of **6 inches** unless calculations from a licensed sprinkler designer justify a smaller line. The fire line material must be specifically called out (generic "PVC" is not acceptable).

### Post Indicator Valve (REQ-21)

An NFPA 13 system requires one of:
- A **PIV in the underground fire line lead-in**, at least 40 ft from the building, downstream of the backflow preventer; or
- A **wall-mounted PIV**; or
- An **exterior door with direct access to the riser room**

For a single-story AutoZone prototype, the most practical approach is typically an exterior riser room door with a Knox box, eliminating the need for a freestanding PIV.

### Fire Line Notes (REQ-19)

The utility plan must include the standard NFPA 13 fire line note: "Underground mains feeding NFPA 13 sprinkler systems must be installed and tested in accordance with NFPA 13, and the Fire Code, by a licensed sprinkler contractor with a plumbing permit. The entire main must be hydrostatically tested at one time, unless isolation valves are provided between tested sections."

### Riser Room (REQ-38)

The fire riser room location must be shown on both site and utility plans. The fire line entry point must match the riser room location. A Knox box is required at the riser room exterior door (REQ-39).

---

## 7. Dumpster Separation (REQ-31)

The concept plan shows a **proposed dumpster enclosure on the east side** of the building. Per IFC 304.3.3, dumpsters of 1.5 cubic yards or greater shall not be stored within 10 ft of combustible walls, openings, or roof eave lines.

**Assessment:** The dumpster appears to be approximately 10-15 ft from the east building wall based on the concept plan layout. At site plan, the exact dimension must be verified to confirm the 10-ft minimum separation from any combustible wall, opening, or roof eave line. If the building is sprinklered (expected), an exception applies for areas protected by the sprinkler system; however, the dumpster is **exterior** to the building and the sprinkler exception may not extend to exterior dumpster locations.

**Action Required:** Dimension the dumpster enclosure location relative to the nearest building wall/opening and verify >= 10 ft separation, or demonstrate the exception applies.

---

## 8. High-Piled Storage (REQ-34)

The building at 7,375 SF is **below the 12,000 SF threshold** that triggers the AFD high-piled storage review under IFC 3206.2. However, AutoZone stores routinely use racking systems with storage heights exceeding 12 ft. Even though the building is under 12,000 SF, the AFD reviewer may request confirmation of:
- Maximum storage height
- Commodity classification
- Rack type (if any)

This is typically addressed at building permit rather than site plan, but the design team should be prepared to provide this information if requested.

---

## 9. Wildland-Urban Interface (WUI)

**Finding:** The site at 9101 Cameron Rd is in a **fully urbanized commercial corridor** surrounded by existing commercial, industrial, and residential development. The site is **not within the City of Austin Wildland-Urban Interface zone**. WUI zones in Austin are concentrated in the western hills and Barton Springs Zone, not in the northern commercial corridors.

No WUI-related vegetation management plan, ignition-resistant construction, or defensible space requirements apply.

---

## 10. Cover Sheet Requirements (REQ-28, REQ-29, REQ-30)

The site plan must include the following AFD-specific items:

### AFD Information Table (Cover Sheet)

| Field | Required Content |
|---|---|
| Fire Design Codes | 2021 IFC with City of Austin local amendments |
| Fire Flow Demand @ 20 psi | 1,500 gpm (before reductions) |
| Intended Use | Retail Sale of Auto Parts (Group M) |
| Construction Classification | IBC Type [V-B or II-B -- must match actual design] |
| Building Fire Area | 7,375 SF |
| Automatic Fire Sprinkler System Type | NFPA 13 (if sprinklered) |
| Reduced Fire Flow Demand @ 20 psi | 1,000 gpm (minimum after reduction) |
| AFD Fire Hydrant Flow Test Date | [from AFD test -- must be within 1 year of submittal] |
| AFD Fire Hydrant Flow Test Location | [near point of connection on Cameron Rd] |
| High-Rise | No |
| AMOC | N/A (unless required) |

### Fire Department Notes (REQ-30)

The general notes sheet must include the 7 standard Fire Department Notes exactly as indicated in the current City of Austin Fire Criteria Manual. These cover timing of installations, hydrant installation, HS-20 loading, fire lane registration, and vertical clearance.

### SP Number (REQ-29)

The full site plan number must appear on all sheets.

---

## 11. Cross-Property Access (REQ-37)

The concept plan shows a secondary access point from the west/southwest connecting to the Pecan Springs Road area. If this fire lane access crosses the **west property line** into Block A of the Resubdivision of Cameron Ferguson Park (Housing Authority of the City of Austin property), a **Unified Development Agreement (UDA) or Joint Use Access Easement (JUAE)** would be required (TRG-09).

**Assessment:** The concept plan's western access appears to utilize the existing road network within the Cameron Ferguson Condominiums plat. Because the subject property is Unit 1 of the Cameron Ferguson Condominiums, shared access may already be established through the condominium declaration (Doc. No. 2018119069). However, AFD will require:
- Confirmation that the condominium declaration provides fire lane access rights in perpetuity
- The recording number called out on the plans
- Fire lane boundaries shown on plans within the shared access area

If the condominium declaration does not explicitly provide fire lane access, a separate UDA or JUAE will be needed.

---

## 12. Gates (REQ-27)

No gates across fire lanes are shown on the concept plan. If gates are added during design development, they must comply with IFC 503.6 (Knox key switch for motorized, Knox box for manual, minimum 25-ft width for two-way fire lane gates).

---

## Summary of Required Actions at Site Plan

| Item | Requirement | Priority | Code Reference |
|---|---|---|---|
| AFD flow test | Obtain AFD-conducted flow test within 1 year of submittal, both pages, at/near Cameron Rd connection point | High | IFC 507.4 (Local) |
| Fire lane dimensions | Call out 25-ft width at all fire lane segments; verify 14-ft vertical clearance | High | IFC 503.2.1 |
| Turning radii | Revise to 50-ft outside / 25-ft inside at all fire lane turns; call out on plans | High | IFC 503.2.4 |
| Fire access distance | Verify hose lay <= 200 ft (sprinklered) from fire lane to all exterior wall points, especially NE corner | High | IFC 503.1.1 |
| Hydrant coverage | Identify/provide hydrant within 500 ft (sprinklered) of all exterior wall points; verify location is not in pond slope or collapse zone | High | IFC 507.5.1 |
| FDC location | Show FDC on site plan and utility plan, facing fire lane, street-side preferred | High | IFC 912.3 (Local) |
| Fire line (6-inch min) | Show fire line on utility plan with specific material callout; include NFPA 13 installation note | Medium | NFPA 13 |
| PIV or riser room exterior door | Provide PIV in fire line (40 ft from building) or exterior riser room door with Knox box | Medium | NFPA 13-8.16.1 |
| AFD information table | Complete table on cover sheet with all 11 fields | High | AFD requirement |
| Fire department notes | 7 standard notes per current Fire Criteria Manual, verbatim | Medium | AFD requirement |
| Fire lane markings/signage | Show fire lane line type, stencil details, sign locations per COA Detail 901S-6 | Medium | IFC 503.3.2 (Local) |
| Pavement section | Include HS-20 loading statement in pavement section detail | Medium | IFC 503.2.6 |
| Dumpster separation | Dimension >= 10 ft from combustible walls/openings | Medium | IFC 304.3.3 |
| Dead-end fire lane | Confirm through-route or provide turnaround per Appendix G if dead end > 150 ft | Medium | IFC 503.2.5 |
| Cross-property access | Confirm condo declaration provides fire lane access or obtain UDA/JUAE for western access | Medium | AFD requirement |
| Construction type | Specify actual IBC construction classification (not occupancy) on cover sheet | High | AFD requirement |
| SP number on all sheets | Full site plan number on every sheet | Low | AFD requirement |

---

## Risk Assessment

**Overall Fire Discipline Risk: LOW-TO-MODERATE**

| Risk Factor | Rating | Rationale |
|---|---|---|
| Fire flow availability | Low | 36-inch water main on Cameron Rd; ample capacity expected |
| Hydrant coverage | Low-Moderate | No hydrant positively identified on concept plan; likely available on Cameron Rd but must be verified |
| Fire lane geometry | Moderate | Tight 1.01-acre site with CWQZ, pond, and truck-turn constraints; 25-ft fire lane width + 50/25 turning radii will consume significant site area |
| Sprinkler requirement | Low | Building is below mandatory area threshold but expected to be sprinklered per corporate standard and high-piled storage provisions |
| FDC/fire line | Low | Standard single-building connection; no unusual complexity |
| Dead-end fire lane | Low | Appears to have through-route; confirm at site plan |
| Cross-property access | Moderate | Western access through condo regime must be documented |
| High-piled storage | Low | Below 12,000 SF threshold; may be raised at building permit |
| Dumpster separation | Low | Appears adequate; confirm dimension at site plan |
| WUI | None | Urban corridor; not in WUI zone |

**No show-stoppers identified.** The primary engineering challenge is fitting a code-compliant fire lane (25-ft width, 50/25 turning radii) on this constrained 1.01-acre site while respecting the CWQZ, detention pond, and truck-turn requirements. The fire lane geometry is the item most likely to draw AFD comments at first review.
