# Phase 2: Zoning Pathway Research

**Property:** 9101 Cameron Rd, Austin, TX 78753
**Parcel ID:** 928312 (TCAD)
**Lot Area:** 44,150 SF (1.01 AC)
**Base Zoning:** CS (General Commercial Services)
**Zoning String:** CS (no combining districts per City of Austin open data)
**Proposed Use:** AutoZone retail store (Retail Sale of Auto Parts), 7,375 SF single-story
**Jurisdiction:** City of Austin, full-purpose city limits
**Research Date:** 2026-06-04

---

## 1. CS Zoning District Standards

### Permitted Uses

The CS (General Commercial Services) district is Austin's most permissive general commercial zoning district. It allows virtually all commercial, retail, service, and light industrial uses. Per LDC Section 25-2-491(C), the Permitted Use Chart designates uses as "P" (permitted by right), "C" (conditional use), or "X" (prohibited) for each base district.

**"Retail Sale of Auto Parts" in CS:** Permitted by right (P). The CS district permits general retail sales uses without conditional use restrictions. Retail sales -- including automotive parts -- fall within the broad retail/commercial use categories that CS accommodates by right. The LDC use category "General Retail Sales (Convenience)" and "General Retail Sales (General)" are both permitted in CS. Auto parts retail is classified under general retail sales, not under automotive repair or service uses that might carry conditional designations.

**Citation:** Austin LDC Section 25-2-491(C), Permitted Use Chart; LDC Section 25-2-3 (CS district description: "the designation for a commercial or industrial use of a service nature").

**Development Implication:** No conditional use permit or rezoning is required. The proposed AutoZone use is permitted by right in CS.

**Confidence:** HIGH -- CS is the broadest commercial district and retail sales of auto parts is a standard retail use.

### Site Development Regulations (LDC Section 25-2-492)

| Standard | CS District Value | Proposed | Compliant? |
|---|---|---|---|
| **Maximum Height** | 60 feet | Single-story (~20 ft) | Yes |
| **Maximum FAR** | 2:1 | 0.17:1 (7,375 / 44,150) | Yes |
| **Minimum Lot Size** | 5,750 SF | 44,150 SF | Yes |
| **Minimum Lot Width** | 50 feet | Exceeds | Yes |
| **Front Setback** | 10 feet | 10 feet (per concept plan) | Yes (at minimum) |
| **Street Side Setback** | 10 feet | TBD | Verify |
| **Interior Side Setback** | 0 feet | TBD | Likely compliant |
| **Rear Setback** | 0 feet | TBD | Likely compliant |
| **Maximum Impervious Cover** | 95% | 37.75% (16,666 SF) | Yes |
| **Maximum Building Coverage** | 95% (no separate limit in CS) | 17% (7,375 SF) | Yes |

**Citation:** Austin LDC Section 25-2-492(D), Site Development Regulation Table; Acreus Austin Zoning Developer Guide (2026) confirming CS parameters.

**Development Implication:** The proposed development is well within all dimensional standards. The 17% building coverage and 37.75% IC are far below the 95% maximum. The 10-foot front setback matches the minimum exactly -- verify this is measured correctly from the property line (not the ROW line) per LDC definitions.

**Confidence:** HIGH for height, FAR, IC, building coverage. MEDIUM for exact setback values -- the 10-foot front and 0-foot side/rear setbacks are consistent across multiple secondary sources, but the official LDC table (Section 25-2-492(D)) should be verified directly as the Municode digital table was not fully extractable during research.

---

## 2. Overlays and Combining Districts

### Finding

The City of Austin Zoning By Address open data (dataset nbzi-qabm) returns **zoning_ztype = "CS"** for 9101 Cameron Rd, with no combining district suffix. This means the parcel carries only the base CS zoning -- no NP (Neighborhood Plan), CO (Conditional Overlay), MU (Mixed Use), or other combining district applies.

For comparison, nearby parcels carry overlays:
- 9100 Cameron Rd (across the street): LI-NP
- 9201 Cameron Rd (north): CS-MU-CO
- 9200 Cameron Rd (east): LI-NP

The subject parcel at 9101 is notably free of combining district restrictions that apply to neighboring properties.

### Overlay Assessment

| Overlay | Applicable? | Notes |
|---|---|---|
| Neighborhood Plan (NP) | **No** | No NP suffix in zoning string |
| Conditional Overlay (CO) | **No** | No CO suffix |
| Mixed Use (MU) | **No** | No MU suffix |
| NCCD | **No** | Not located in a Neighborhood Conservation Combining District |
| TOD (Transit-Oriented Development) | **No** | No TOD overlay identified; Cameron Rd is not a designated TOD corridor |
| Capitol View Corridor | **No** | Property is ~7 miles north of Capitol; not in any CVC zone |
| Historic | **No** | No historic designation identified |
| University Neighborhood Overlay | **No** | Not in UNO area |
| Waterfront Overlay | **No** | Not applicable |

**Citation:** City of Austin Open Data Portal, Zoning By Address dataset (nbzi-qabm), queried 2026-06-04; Austin LDC Section 25-2, Subchapter A, Article 2, Division 6 (Combining and Overlay Districts).

**Development Implication:** No overlay-specific restrictions constrain this development. No additional overlay review, design standards, or use limitations beyond base CS requirements apply. This simplifies the entitlement pathway.

**Confidence:** HIGH -- confirmed via City open data API query returning "CS" with no suffix.

---

## 3. Subchapter E Applicability (Design Standards and Mixed Use)

### Finding

Austin LDC Chapter 25-2, Subchapter E establishes minimum site and building design standards for most new non-residential and mixed-use development outside the Downtown Overlay. Subchapter E applies to:

- New commercial/non-residential construction
- Additions or renovations exceeding certain thresholds
- Sites outside the Downtown Overlay (CBD)

The proposed 7,375 SF new commercial building on a CS-zoned parcel **triggers Subchapter E compliance**. This is new non-residential construction outside the Downtown Overlay.

### Key Subchapter E Requirements

1. **Building Design Standards (Article 3):** Facades visible from public streets must incorporate articulation, material variation, and transparency. Blank wall restrictions apply -- long uninterrupted facades (typically over 50 feet) require architectural treatment (recesses, projections, material changes, fenestration).

2. **Site Design Standards (Article 2):** Pedestrian connectivity from the public sidewalk to the building entrance. Internal pedestrian circulation where multiple buildings or pad sites exist. Pedestrian-scaled lighting.

3. **Connectivity (Article 1):** At least two connectivity options must be selected and implemented from a menu of choices (e.g., sidewalk connections, cross-access easements, stub-outs to adjacent parcels).

4. **Landscaping:** Street-facing landscaping requirements, parking lot landscaping and screening, and compatibility buffers where applicable.

5. **Alternative Compliance (Article 5):** If strict compliance with a specific standard is impractical, applicants may propose alternative designs that meet the intent of the standard through the Alternative Compliance process (administrative review).

**Citation:** Austin LDC Chapter 25-2, Subchapter E (Design Standards and Mixed Use), Articles 1-5; AIA Austin Code Card #4 (Subchapter E Design Standards summary).

**Development Implication:** The AutoZone building design must comply with Subchapter E facade articulation, pedestrian connectivity, and landscaping standards. AutoZone's standard prototype may need modifications to meet blank-wall requirements on the Cameron Rd facade. Recommend early coordination with City staff on facade design compliance. Alternative compliance is available if the standard prototype conflicts with specific standards.

**Confidence:** HIGH that Subchapter E applies. MEDIUM on specific threshold details (the exact square footage trigger for renovations vs. new construction exemptions was not fully confirmed from primary sources, but new ground-up commercial construction clearly triggers compliance).

---

## 4. Parking Requirements

### Finding

On November 2, 2023, Austin City Council voted to eliminate all minimum off-street parking requirements citywide (Ordinance No. 20231102-005, Item C20-2023-010). The elimination took effect on November 12, 2023.

**Current rules:**
- **No minimum parking required** for any land use, including retail
- **ADA accessible parking** remains required per federal law (ADA) and Texas Accessibility Standards (TAS)
- **Bicycle parking** requirements remain in effect per LDC Section 25-6, Subchapter E
- **No maximum parking limit** established citywide (the ordinance removed minimums but did not impose maximums)

### Parking Analysis for Proposed Development

| Item | Detail |
|---|---|
| Proposed spaces | 12 |
| Former minimum (pre-2023) | ~25 spaces (1 per 300 SF of GFA for retail = 7,375/300 = ~25) |
| ADA minimum | 1 accessible space (for 1-25 total spaces per TAS) |
| Bicycle parking | Required per LDC 25-6; typically 1 rack per 10 auto spaces |
| Maximum parking | No cap applies |

**Citation:** Austin City Council Ordinance No. 20231102-005 (C20-2023-010); NPR (2024-01-02); KUT Radio (2024-09-18); Austin LDC Section 25-6.

**Development Implication:** The 12 proposed parking spaces are legally sufficient -- there is no minimum. However, the applicant should confirm ADA compliance (minimum 1 van-accessible space) and bicycle parking requirements. From a practical standpoint, 12 spaces for a 7,375 SF auto parts retail store may be adequate given AutoZone's typical customer traffic patterns, but this is a business decision, not a code requirement.

**Confidence:** HIGH -- parking minimum elimination is well-documented and unambiguous.

---

## 5. Signage

### Finding

Austin sign regulations are governed by LDC Chapter 25-10. The sign district for a property is determined by its zoning classification and location. CS-zoned commercial properties along arterial roads like Cameron Rd typically fall within the **Commercial Sign District** (not Neighborhood Commercial or Scenic Roadway).

### Commercial Sign District Regulations (LDC Chapter 25-10)

| Sign Type | Regulation |
|---|---|
| **Freestanding Sign -- Number** | 1 per lot (additional may be permitted for wide frontages, corner lots, or pad sites per Section 25-10-131) |
| **Freestanding Sign -- Max Height** | Lesser of 30 feet above adjacent pavement grade or 6 feet above grade at base of sign |
| **Freestanding Sign -- Max Area** | Lesser of: 0.7 SF per linear foot of street frontage OR 200 SF (single tenant) / 250 SF (multi-tenant) |
| **Wall Sign -- Max Area** | 20% of the facade area of the first 15 feet of building height |
| **Wall Sign -- Number** | One per facade facing a street or parking area (generally) |
| **Illumination** | Permitted; external or internal illumination allowed; no flashing or animated signs |
| **Electronic Message Center** | Subject to additional restrictions |

### Estimated Sign Entitlement

For a typical AutoZone prototype on Cameron Rd:
- If Cameron Rd frontage is ~200 LF: freestanding sign area up to 140 SF (0.7 x 200) or 200 SF max
- Wall sign area: 20% of front facade area within first 15 feet of height. For a ~75-foot-wide facade at 15 feet = 1,125 SF facade area x 20% = 225 SF max wall signage

**Citation:** Austin LDC Chapter 25-10, Article 6 (Commercial Sign District Regulations); Austin Sign Co. reference guide.

**Development Implication:** AutoZone's standard signage package (pylon/monument sign + wall-mounted channel letters) should be accommodable within the commercial sign district limits. Confirm the sign district through the City's Sign District Determination Tool before finalizing the sign package. If the property is in a Neighborhood Plan area (it is not, per Section 2 above), different rules would apply.

**Confidence:** MEDIUM-HIGH -- sign district regulations are confirmed from secondary sources; the exact sign district determination for this specific parcel should be confirmed via the City's online Sign District Determination Tool.

---

## 6. Conditional Use Permit (CUP)

### Finding

A CUP is **not required** for this use in CS zoning. Per LDC Section 25-2-491(C), retail sales uses are permitted by right ("P") in the CS district. A CUP would only be required if the use were designated "C" (conditional) in the Permitted Use Chart for the CS column.

Uses that typically require a CUP in CS include certain high-impact uses such as:
- Outdoor entertainment
- Pawn shops (in some contexts)
- Certain automotive service/repair uses (note: repair, not retail)

"Retail Sale of Auto Parts" is a retail sales use, not an automotive service use. It does not trigger CUP requirements.

**Citation:** Austin LDC Section 25-2-491(C), Permitted Use Chart; LDC Section 25-2-808 et seq. (Conditional Use regulations).

**Development Implication:** No CUP application, public hearing, or Planning Commission review is needed for the use itself. This eliminates a significant timeline and discretionary risk from the entitlement process.

**Confidence:** HIGH -- CS permits virtually all commercial uses by right; retail sales of auto parts is unambiguously a permitted use category.

---

## 7. Site Plan Trigger and Procedural Path

### Finding

New commercial construction of 7,375 SF on a 1.01-acre site **triggers a site development permit (site plan)** under Austin LDC Chapter 25-5. The project does not qualify for a site plan exemption because:

1. The project exceeds the 1,000 SF threshold for exemption
2. It involves new ground-up construction (not a minor addition)
3. It increases impervious cover on the site

### Procedural Path

| Step | Detail |
|---|---|
| **Permit Type** | Site Development Permit (Site Plan) |
| **Review Type** | Administrative (staff-level review) |
| **Approval Authority** | Development Services Department (Director) |
| **P&Z/Council Review** | Not required (no rezoning, no CUP, no variance needed) |
| **Public Hearing** | Not required for administrative site plan |
| **Notification** | No neighborhood notification required for administrative site plan on CS-zoned land with no NP overlay |
| **Estimated Review Timeline** | 30-60 days initial review; 2-4 review cycles typical for commercial site plans |
| **Concurrent Review** | Building permit can be submitted concurrently or after site plan approval |

### Required Submittals

- Site plan application through Austin Build + Connect (AB+C)
- Civil engineering plans (grading, drainage, utilities)
- Tree survey and preservation plan (LDC Chapter 25-8)
- Subchapter E compliance documentation
- Transportation Impact Analysis (if trip generation thresholds are met; a 7,375 SF retail store likely generates ~370 daily trips per ITE, which may trigger a TIA)
- Environmental review (watershed compliance)

**Citation:** Austin LDC Chapter 25-5 (Site Plan); City of Austin Development Services, Site Plan Requirements page; PermitPlace Austin Site Plan Exemption Guide.

**Development Implication:** The project follows a fully administrative review path with no discretionary approval required. No City Council or Planning Commission hearing is needed. This is the most streamlined entitlement path available for commercial development in Austin. The primary timeline risk is review cycle duration, not political/discretionary risk.

**Confidence:** HIGH -- new commercial construction clearly requires a site plan; administrative review path is confirmed by absence of CUP, rezoning, or variance triggers.

---

## 8. Alternative Compliance

### Finding

Austin LDC Subchapter E, Article 5 provides an **Alternative Compliance** mechanism. This allows applicants to propose alternative designs that meet the intent of Subchapter E design standards when strict compliance with a specific standard is impractical or produces an inferior result.

### Key Features

- **Review:** Administrative (staff-level decision by the Director of Development Services or designee)
- **Standard:** The alternative must meet the stated intent/purpose of the standard from which relief is sought
- **Documentation:** Written justification required explaining how the alternative meets the intent
- **Common uses:** Facade articulation alternatives, pedestrian connectivity alternatives when site constraints exist, parking lot screening alternatives
- **Not available for:** Base zoning dimensional standards (height, setbacks, FAR, IC) -- those require a variance through the Board of Adjustment

### Applicability to This Project

If AutoZone's standard building prototype does not meet specific Subchapter E facade articulation or blank-wall standards, the applicant can propose alternative compliance rather than fully redesigning the building. This is particularly relevant for:
- Rear and side facades that may lack windows/transparency
- Standard prototype facades that may not meet articulation frequency requirements

**Citation:** Austin LDC Chapter 25-2, Subchapter E, Article 5 (Alternative Compliance).

**Development Implication:** Alternative compliance provides a viable fallback if the AutoZone prototype conflicts with Subchapter E design standards. This avoids the need for a variance (Board of Adjustment process) and remains an administrative-level decision. Recommend identifying potential Subchapter E conflicts early in design to prepare alternative compliance requests concurrently with the site plan.

**Confidence:** HIGH -- Alternative Compliance is a well-established mechanism in Austin's LDC.

---

## 9. Condominium Regime Implications

### Finding

The property is identified as **Unit 1, Cameron Ferguson Condominiums**, a commercial condominium regime. Under Texas law (Texas Uniform Condominium Act, Tex. Prop. Code Chapter 82), a condominium unit is a separately deeded interest in real property created by a condominium declaration.

### Zoning Implications

- **Zoning runs with the land, not the condominium regime.** The CS zoning applies to the entire parent tract. The condominium declaration does not alter, restrict, or expand the zoning entitlements available under CS.
- **The condominium declaration may contain private restrictions** (CC&Rs) that impose limitations beyond zoning -- such as architectural review requirements, use restrictions, or signage limitations. These are private covenants, not City code requirements.
- **Site plan review:** The City reviews the site plan against the zoning of the entire tract. If the condo unit's boundaries differ from the legal lot, the City may require a determination of how dimensional standards (setbacks, IC, building coverage) are calculated -- whether against the unit footprint or the parent tract.

### Potential Issues

1. **Impervious cover calculation:** The City may calculate IC against the entire condominium tract or against Unit 1's boundaries. This must be clarified during site plan review. If calculated against the unit alone, the IC percentage may be higher than the 37.75% shown on the concept plan.
2. **Shared access and easements:** The condominium regime likely includes shared access drives, parking areas, and utility easements. The site plan must reflect these and demonstrate that the proposed development does not conflict with existing easements.
3. **Condominium association approval:** The Cameron Ferguson Condominiums may have an association with architectural review authority. Private approval may be needed before or concurrent with City permitting.
4. **No additional City approval required:** The City of Austin does not require a separate approval for development within a condominium regime beyond the standard site plan process. The condominium declaration is a private document recorded with Travis County.

**Citation:** Texas Property Code Chapter 82 (Texas Uniform Condominium Act); Winstead PC, "Texas Site Condominiums" (Robert D. Burton, Esq.); Austin LDC (no specific condominium overlay provisions).

**Development Implication:** The condominium regime does not create additional City entitlement hurdles, but the applicant must: (a) confirm how the City calculates dimensional standards for a condo unit, (b) review the condominium declaration for private use/design restrictions, and (c) obtain any required condominium association approvals. Recommend obtaining and reviewing the recorded declaration and bylaws before finalizing the site plan.

**Confidence:** MEDIUM-HIGH -- zoning principles are clear, but the specific terms of the Cameron Ferguson Condominium declaration were not reviewed and may contain material restrictions.

---

## 10. Adjacent Zoning

### Finding (from City of Austin Open Data, queried 2026-06-04)

| Direction | Address | Zoning | Base Zone Category |
|---|---|---|---|
| **East** (across Cameron Rd) | 9100 Cameron Rd | LI-NP | Limited Industrial Services |
| **East** (across Cameron Rd) | 9104 Cameron Rd | LI-NP | Limited Industrial Services |
| **South** (same side) | 9001 Cameron Rd | CS | General Commercial Services |
| **North** | 9201 Cameron Rd | CS-MU-CO | General Commercial Services (w/ Mixed Use + Conditional Overlay) |
| **North** | 9207 Cameron Rd | GR-CO | Community Commercial (w/ Conditional Overlay) |
| **Rear/West** (Ferguson Ln) | 1404-1508 Ferguson Ln | CS | General Commercial Services |
| **Rear/West** (Ferguson Ln) | 1512-1600 Ferguson Ln | LI | Limited Industrial Services |
| **Further south** | 8900 Cameron Rd | LI-NP | Limited Industrial Services |
| **Further south** | 8903-8907 Cameron Rd | CS | General Commercial Services |

### Compatibility Standards Analysis

Austin LDC Section 25-2-1063 et seq. imposes **compatibility standards** when commercial or multifamily development is within 200-540 feet of SF (single-family) zoned property. These standards impose graduated height limits, additional setbacks, and screening requirements.

**Key finding:** The immediately adjacent parcels are zoned CS, LI, and GR -- all commercial or industrial. However, Ferguson Lane further west (1619+ Ferguson Ln) transitions to **SF-3 (Single Family Residence)** zoning. If any SF-3 parcels are within 540 feet of the subject property, compatibility standards may apply to the western building face.

| Distance to SF-3 | Compatibility Trigger |
|---|---|
| 0-100 ft | 2-story / 30 ft max height; 25 ft setback |
| 100-200 ft | 3-story / 40 ft max height |
| 200-300 ft | 40 ft max height |
| 300-540 ft | 60 ft max height (equals CS base) |

Given the proposed single-story building (~20 ft), compatibility height limits are unlikely to be triggered even if SF-3 is within range. However, enhanced setback or screening requirements from the western property line may apply and should be verified during site plan review.

**Citation:** City of Austin Open Data Portal, Zoning By Address (nbzi-qabm); Austin LDC Section 25-2-1063 (Compatibility Standards).

**Development Implication:** The surrounding area is predominantly commercial/industrial (CS, LI, GR), which is favorable for the proposed auto parts retail use. No residential compatibility conflicts are anticipated for the building height. Verify distance to nearest SF-3 property for western-face setback/screening compliance.

**Confidence:** HIGH for adjacent zoning data (confirmed via API). MEDIUM for compatibility analysis (distance to SF-3 parcels needs GIS measurement).

---

## Summary: Entitlement Pathway

| Item | Status | Risk Level |
|---|---|---|
| Use permitted by right | Yes (CS allows retail) | LOW |
| Rezoning needed | No | N/A |
| CUP needed | No | N/A |
| Site plan required | Yes (administrative) | LOW |
| Overlays/combining districts | None | LOW |
| Subchapter E compliance | Required | LOW-MEDIUM (facade design) |
| Parking compliance | No minimums; 12 spaces adequate | LOW |
| Height/FAR/IC compliance | All well within limits | LOW |
| Compatibility standards | Possibly triggered (west, to SF-3) | LOW (single-story) |
| Condominium regime | Private restrictions TBD | MEDIUM |
| Signage | Commercial sign district likely | LOW |

### Recommended Procedural Sequence

1. **Pre-application conference** with Austin Development Services (recommended, not required)
2. **Review condominium declaration** for private restrictions and IC allocation
3. **Submit site plan** through AB+C with Subchapter E compliance documentation
4. **Concurrent submissions:** Sign permit, building permit (after site plan approval or concurrently if allowed)
5. **Estimated total timeline:** 4-8 months from site plan submission to building permit issuance

---

## Sources

- [Austin LDC Chapter 25-2 (Zoning) -- Municode Library](https://library.municode.com/tx/austin/codes/land_development_code?nodeId=TIT25LADE_CH25-2ZO)
- [LDC Section 25-2-491 -- Permitted Uses](http://austin-tx.elaws.us/code/ldc_title25_ch25-2_subchc_art2_div1_sec25-2-491)
- [LDC Section 25-2-492 -- Site Development Regulations](http://austin-tx.elaws.us/code/ldc_title25_ch25-2_subchc_art2_div1_sec25-2-492)
- [Subchapter E -- Design Standards and Mixed Use](https://library.municode.com/tx/austin/codes/code_of_ordinances?nodeId=TIT25LADE_CH25-2ZO_SUBCHAPTER_EDESTMIUS)
- [Chapter 25-10 -- Sign Regulations](https://library.municode.com/tx/austin/codes/code_of_ordinances?nodeId=TIT25LADE_CH25-10SIRE)
- [City of Austin Zoning By Address Open Data](https://data.austintexas.gov/Building-and-Development/Zoning-By-Address/nbzi-qabm)
- [City of Austin -- Site Plan Requirements](https://www.austintexas.gov/development-services/site-plan-requirements)
- [City of Austin -- Zoning Resources & Site Regulations](https://www.austintexas.gov/planning/zoning-resources-site-regulations)
- [Acreus Austin Zoning Developer Guide (2026)](https://www.acreus.io/guides/zoning/austin-tx)
- [PermitPlace -- Site Plan Exemption Austin](https://permitplace.com/site-plan-exemption-austin/)
- [Austin Parking Minimum Elimination -- NPR (2024-01-02)](https://www.npr.org/2024/01/02/1221366173/u-s-cities-drop-parking-space-minimums-development)
- [Austin Parking -- KUT Radio (2024-09-18)](https://www.kut.org/housing/2024-09-18/austin-texas-developers-minimum-parking-requirements)
- [Winstead PC -- Texas Site Condominiums](https://www.winstead.com/portalresource/lookup/wosid/cp-base-4-115702/overrideFile.name=/Burton,%20Texas%20Site%20Condominiums.pdf)
- [Austin Council Eliminates Parking Requirements -- Planetizen](https://www.planetizen.com/news/2023/05/123149-austin-eliminates-parking-requirements)
