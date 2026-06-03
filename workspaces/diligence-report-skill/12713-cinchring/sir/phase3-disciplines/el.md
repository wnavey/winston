# Environmental — 12713 Cinchring Ln, Austin TX 78727

## Summary

- **This is a clean environmental parcel.** Walnut Creek Suburban watershed, no CEFs, no Edwards Aquifer zones, no salamander or other ESA habitat, no EHZ, no waterway buffers, no UST/LPST sites in the area, no historic or archaeological overlay. The Phase 2 environmental research returned "no constraint" on 13 of 16 layers, and the three that did return findings (watershed classification, DDZ status, WUI Zone C) are administrative rather than design-binding.
- **The only construction-cost driver from this discipline is WUI Zone C** — the parcel sits in the lowest tier of Austin's Wildland-Urban Interface overlay, triggering ignition-resistant construction details under the WUI Code. Cost adder for a duplex of this scale is estimated at $5K–$15K and is fully internalized in design (Class A roof, ember-resistant vents, ignition-resistant exterior assemblies).
- **DDZ status is an affirmative opportunity**, not a neutral condition: the parcel is squarely in the Desired Development Zone, which is the precondition for SMART Housing fee waivers if an affordability path is elected. See `programs` for the SMART Housing analysis.
- **Watershed regulation (LDC §25-8 Article 9) does not bind this lot.** Walnut Creek is a Suburban watershed, but §25-8-63(B) carves SF and duplex lots out of the subchapter IC limits — the binding IC will be set by MF-3 zoning and/or the McMansion FAR envelope. Watershed-driven WQ controls collapse to standard residential RSMP fee-in-lieu (cross-reference `sde`).
- **Tree protection is the only binding environmental-adjacent constraint, and it lives in `eptp`.** This file deliberately defers all tree analysis. Floodplain confirmation (Zone X on current panel 48453C0270J, eff. 2014-08-18) lives in `fwp`.

## Findings

### Watershed: Walnut Creek (Suburban classification)
**Severity:** note
**Citation:** LDC §25-8 Subch. A Article 9 (Suburban Watershed Requirements) — §§25-8-391 (applicability), 25-8-392 (Uplands Zone IC limits), 25-8-393 (intensity transfer); §25-8-63(B) (SF/duplex carve-out); COA Watershed Regulation Areas layer (Open Data `2xkn-3rmn`, Shared/Environmental_3/0 WATERSHED_DEVELOPMENT_TYPE field).
**Finding:** Parcel drains to Walnut Creek (the 36,000-acre / ~43 sq mi master watershed discharging at Longhorn Dam, downstream of all Austin drinking water intakes). COA's watershed regulation layer returns `WATERSHED_DEVELOPMENT_TYPE = Suburban` for the parcel — verified at the point geometry against the City's authoritative ArcGIS REST endpoint. The parcel is in the Uplands Zone of the watershed (no creek frontage, no Critical Water Quality Zone or Water Quality Transition Zone touching the lot).
**Implication for the developer:** Suburban watershed IC limits in §25-8-392 (50%–60% by lot size and sub-watershed) apply at the **subdivision** scale, not the individual lot. §25-8-63(B) explicitly provides that subchapter IC requirements **do not restrict** impervious cover on an individual SF or duplex lot. The binding IC for this duplex will therefore come from (i) MF-3 base zoning IC maximum and (ii) the McMansion / Subchapter F gross floor area envelope if applicable — not from §25-8. No watershed-driven design constraint on the duplex envelope.
**Recommended next step:** Confirm sub-watershed branch ID via FloodPro for downstream WQ control design context, but no watershed work product is required at submittal. Defer site-level WQ controls and RSMP fee-in-lieu treatment to `sde`.

### No Critical Environmental Features (CEFs) on or adjacent to the parcel
**Severity:** note (absence of constraint)
**Citation:** LDC §25-8-281 / ECM §1.10.0 (CEF identification — canyon rimrock, sinkholes, point recharge features, springs/seeps, caves, bluffs); ECM §1.10.4 (150-ft CEF setback); COA Critical Environmental Features Setback layer (Shared/Environmental_1/7); Springs and Seeps Open Data (`2jmf-2fa8`).
**Finding:** COA's CEF Setback layer returns **no features** at the parcel point and within the 150-ft buffer that would matter for a CEF setback. Geological context confirms the absence: Scofield Subdivision is in the Blackland Prairie east of MoPac, off the Edwards limestone outcrop where karst CEFs (caves, sinkholes, point recharge) occur. No mapped springs, seeps, rimrock, or bluffs in the vicinity. Topography is gentle suburban grade-and-fill.
**Implication for the developer:** No 150-ft CEF buffer reduces buildable area. No CEF-related Environmental Resource Inventory (ERI) is required. Standard development.
**Recommended next step:** None. A physical site walk during pre-design will incidentally confirm no unmapped CEF (extraordinarily unlikely on a 1991-platted suburban interior lot), but no formal investigation is warranted.

### Outside Edwards Aquifer regulatory zones (Recharge, Transition, Contributing)
**Severity:** note
**Citation:** TCEQ Edwards Aquifer Map Viewer; 30 TAC Chapter 213 (Edwards Aquifer Protection Program — §213.5 WPAP, §213.23 CZP); LDC §25-8 Subch. A Article 11 (Edwards Aquifer protection); COA Open Data `ahuv-whai`; verified at Shared/Environmental_3/4, /5, /6 (no features at point).
**Finding:** Parcel is outside the Edwards Aquifer Recharge Zone, Recharge Verification Zone, Transition Zone, and Contributing Zone. The Recharge Zone boundary follows the Balcones Fault several miles west of I-35; the Contributing Zone lies upgradient further west and northwest. Scofield is east of MoPac, on Blackland Prairie — well east of all three regulated Edwards zones.
**Implication for the developer:** No TCEQ Edwards Aquifer Protection Program application required — no Water Pollution Abatement Plan (WPAP) under 30 TAC §213.5, no Contributing Zone Plan (CZP) under §213.23. No COA §25-8 Article 11/12 Edwards-driven WQ controls, no Edwards-specific fees, no Edwards-driven SCM requirements. Eliminates a class of cost and schedule that would otherwise apply to a recharge-zone parcel.
**Recommended next step:** None.

### Outside ESA habitat (Eurycea salamanders, golden-cheeked warbler, karst invertebrates, vireo)
**Severity:** note
**Citation:** USFWS IPaC tool (Travis County); USFWS Critical Habitat designations (50 CFR Part 17, 78 FR 51328 Aug 2013 — Austin blind and Jollyville Plateau salamanders); COA salamander habitat layer (Shared/Environmental_1/15 — no features at point); Balcones Canyonlands Conservation Plan (BCCP) boundary (parcel outside).
**Finding:** No USFWS-designated critical habitat overlaps this parcel for any listed species:
- **Jollyville Plateau salamander (Eurycea tonkawae)** — Walnut Creek occurrence is a single 53-acre Jollyville Plateau headwaters unit west of MoPac. Parcel is east of MoPac, off the plateau, outside the unit. COA salamander layer confirms no habitat at the point.
- **Barton Springs salamander (E. sosorum)** and **Austin blind salamander (E. waterlooensis)** — Barton Springs only.
- **Golden-cheeked warbler (Setophaga chrysoparia)** — Ashe juniper-oak woodland on the Edwards Plateau (west/NW Travis Co.). Parcel is post-agricultural Blackland Prairie; no warbler habitat.
- **Six karst invertebrates** (Bee Creek Cave harvestman, Tooth Cave ground beetle, Tooth Cave spider, Tooth Cave pseudoscorpion, Bone Cave harvestman, Kretschmarr Cave mold beetle) — karst limestone outcrop in NW Travis County only. Parcel is off the Edwards outcrop.
- **Black-capped vireo** delisted in 2018.
**Implication for the developer:** No federal ESA Section 7 consultation (no federal nexus expected for a residential duplex) and no Section 10 incidental take permit / BCCP participation. No karst feasibility study under the Travis County BCCP. No design or schedule impact from federal endangered species law.
**Recommended next step:** None at this stage. If a federal nexus arises later (unlikely — federal grant funding, federal wetland permit, etc.), a USFWS IPaC pull by coordinate would confirm the finding.

### Desired Development Zone (DDZ) — affirmative opportunity
**Severity:** opportunity
**Citation:** COA Smart Growth Initiative (1998); COA Watershed Regulation Areas / Environmental_3/0 (DESIRED_DEVELOPMENT_ZONE field returns "Desired Development"); Environmental_3/12 (CRFZONE='DDZ').
**Finding:** Parcel is in the Desired Development Zone — the half of Austin (east of the Balcones Fault, draining downstream of drinking water intakes) where city policy affirmatively encourages infill development. The complementary Drinking Water Protection Zone (DWPZ) — where development is discouraged — does not apply here. The Walnut Creek drainage discharges to the Colorado **below** Longhorn Dam, downstream of all water treatment intakes; this is the geographic basis for DDZ designation.
**Implication for the developer:** DDZ status is a precondition for several incentive programs, most notably **SMART Housing fee waivers** (waivers of development, building permit, and Austin Water capital recovery fees in exchange for an affordability commitment). See `programs` for the SMART Housing eligibility analysis. DDZ status also means no Smart Growth IC penalties, no heightened DWPZ environmental review, and standard application of all development incentives.
**Recommended next step:** Coordinate with `programs` discipline to determine whether the duplex pro forma supports a SMART Housing affordability path.

### No Critical Water Quality Zone (CWQZ) or Water Quality Transition Zone (WQTZ) on parcel
**Severity:** note
**Citation:** LDC §25-8-92 (CWQZ established), §25-8-93 (WQTZ); §25-8-261 (CWQZ development restrictions); COA Creek Buffers / Waterway Setbacks layer (Environmental_3/MapServer/3).
**Finding:** No mapped waterway crosses or abuts this interior 8,054 SF residential lot. The closest meaningful Walnut Creek tributary branch is several hundred feet off-lot; CWQZ (100 ft from CL of a minor waterway in a Suburban watershed) and WQTZ (next 100–300 ft) do not reach the parcel. The platted "15' Drainage Easement" noted on the survey is a private subdivision drainage feature, not a §25-8-92 waterway.
**Implication for the developer:** No §25-8-261 CWQZ development restrictions. No WQTZ stormwater control requirements beyond standard residential WQ. No buffer encumbrance reducing the buildable envelope.
**Recommended next step:** None.

### No Erosion Hazard Zone (EHZ) on parcel
**Severity:** note
**Citation:** Drainage Criteria Manual (DCM) Appendix E (EHZ Criteria); COA Erosion Hazard Zone Review Buffer (`pmnk-72i4`, Shared/Environmental_3/7 — no features at point); 2013 COA WPD EHZ Guidance.
**Finding:** No EHZ delineated on or adjacent to the parcel. EHZ is projected from creek tops-of-bank on a 4:1 slope; it applies only adjacent to mapped waterways. This interior subdivision lot is not adjacent to any waterway with a delineated EHZ.
**Implication for the developer:** No EHZ-triggered geotechnical or erosion analysis, no enhanced setback from a top-of-bank, no DCM Appendix E work product.
**Recommended next step:** None.

### Wildland-Urban Interface (WUI) Proximity Zone C
**Severity:** moderate
**Citation:** Austin Wildland-Urban Interface Code (adopted April 2020, effective September 2020; 2021 International Wildland-Urban Interface Code base, with Austin amendments); LDC §25-12-271 (adoption of IWUIC); 2024 COA WUI Code Map; verified via Shared/Environmental_3/11 (PROXIMITY_ZONE field = "C").
**Finding:** Parcel is in **WUI Proximity Zone C** — the lowest-tier WUI overlay in the Austin WUI Code. Zone C is the "interface proximity" zone, outside the immediate wildland adjacency (Zones A and B) but within the broader Austin WUI mapping. This was a surprise relative to the Phase 2 environmental research, which assumed the parcel would fall outside any WUI zone — but the COA WUI layer at the parcel point returns Proximity Zone C, and that is the binding value. Zone C is the COA WUI mapping designation; it triggers a reduced (but not zero) set of ignition-resistant construction requirements.
**Implication for the developer:** Triggers the WUI Code structure-hardening requirements applicable to new construction in Zone C. For a duplex, expect the following to be specified in the building permit set:
- Class A roof assembly (asphalt composition shingles meeting Class A — standard architectural shingles generally comply)
- Ember-resistant attic vents (e.g., flame-and-ember-resistant vent assemblies, 1/16"–1/8" mesh)
- Exterior wall fire-resistance (ignition-resistant siding materials or wall assemblies)
- Eaves / soffits with ignition-resistant detailing
- Defensible space / landscape provisions (most onerous in Zones A and B; modest in Zone C)
- Standard provisions: no combustible decking under a deck or within 5 ft of the structure, glazing rated for radiant heat in some Zone C sub-cases.

**Cost adder for a duplex of this scale: estimated $5K–$15K**, driven principally by ember-resistant vents and the differential cost of ignition-resistant siding vs. standard siding. The architect must specify WUI-compliant assemblies on the permit set; DSD building plans review will check WUI compliance at intake.
**Recommended next step:** Confirm WUI Zone C status at the COA WUI Zone Lookup tool (https://www.arcgis.com/apps/instant/lookup/index.html?appid=aac08abc87054f339204acf5d7914204) at the start of design. Incorporate WUI requirements at the DD (Design Development) phase, not at CD — late-stage assembly changes are the failure mode here. Confirm with COA Fire Department / WUI plan review whether any current Austin WUI amendments waive specific Zone C provisions for duplex residential.

### No LUST / UST / AST sites within proximity
**Severity:** note
**Citation:** TCEQ Petroleum Storage Tank Viewer; TCEQ LPST Points (gis-tceq.opendata.arcgis.com); EPA UST Finder; COA UST layer (Shared/Environmental_1/0 — no features at point).
**Finding:** No regulated UST/AST or LPST (leaking petroleum storage tank) site at or in the vicinity of the parcel. COA's UST layer returns zero features at the point. Surrounding area is fully residential (Scofield SFR subdivision); nearest known commercial fuel/gas facilities are ≥ 0.5 mi away on Parmer Ln / I-35 frontage. No expected Phase I ESA petroleum finding from the publicly mapped sources.
**Implication for the developer:** Standard Phase I ESA (if required by lender) is expected to be clean for petroleum impacts. No contamination-driven design constraint, no remediation contingency, no environmental insurance complication.
**Recommended next step:** If lender requires a Phase I ESA at closing, expect a clean report; budget for a standard residential Phase I only if the lender requires one (most owner-occupant or small-scale residential transactions do not).

### No TPDES outfalls, Superfund, VCP, or RCRA sites known nearby
**Severity:** note
**Citation:** TCEQ TPDES Outfalls layer; TCEQ Central Registry; EPA ECHO; CERCLIS/Superfund database.
**Finding:** No TPDES industrial outfalls, no Superfund / CERCLIS sites, no Texas Voluntary Cleanup Program (VCP) sites, and no RCRA Corrective Action sites known within the project's environmental due-diligence radius. The Walnut Creek mainstem is subject to the Austin Area Bacteria TMDL (a watershed-scale water quality issue) but that is not a property-level constraint. The Walnut Creek Wastewater Treatment Plant is east of I-35, approximately 3 miles away — not a proximity issue.
**Implication for the developer:** No contamination flags from regulatory database screens. Phase I ESA (if required) expected clean.
**Recommended next step:** None.

### No archaeological or historic concern
**Severity:** note
**Citation:** COA Historic Preservation Office; National Register of Historic Places; Texas Historical Commission Atlas; COA Historic Districts GIS (Shared/Zoning_3/0,1,2 — no features); COA Landmark layer (no features).
**Finding:** Structure built 1993 — not historic (50-year NRHP threshold not yet reached and not anticipated). Parcel is not in a designated historic district (no Local Historic District, no National Register district, no NCCD), not in a Neighborhood Conservation Combining District, and not flagged on the COA Landmark layer. No known archaeological resources on file for the parcel; site is on former agricultural land developed as suburban subdivision in 1991. The Scofield platting (Cabinet 91, Slide 264–265) and Master Declaration (Vol. 11863 Pg. 1147) are both 1993-era instruments with no historic-preservation provisions.
**Implication for the developer:** No Historic Landmark Commission review, no HPO consultation, no archaeological survey required, no historic-review schedule impact on demolition or new construction permits.
**Recommended next step:** None.

### Cross-references

- **Heritage tree protection** (LDC §25-8 Subch. B; §25-8-604 tree survey; Heritage Tree Ord. 20100204-038): see `eptp`. Tree-driven design constraint will likely be the single biggest environmental-adjacent factor on this lot, but it belongs to the tree-protection discipline, not Environmental.
- **Floodplain confirmation** (FEMA Zone X on current effective panel 48453C0270J, eff. 2014-08-18; COA local 100-yr and Fully Developed Floodplain layers also confirmed clear): see `fwp`.
- **Site drainage, water quality controls, RSMP fee-in-lieu** for the duplex redevelopment: see `sde`. Watershed classification (Walnut Creek Suburban) is established here but the WQ control selection happens in `sde`.
- **Blanket electric easement (Vol. 660 Pg. 968)** — this is a property-records / electrical-coordination item, not an environmental finding; see `property-records.md` and the `el`-electrical-utility analysis (note: the discipline file `el.md` is the Electrical & Utility feasibility guide; the Phase 2 utility coordination on this easement is captured there, not here).
- **WUI structure-hardening details on permit set**: coordinated with `fire` (building / fire code compliance).

## Plan-specific findings

N/A — no concept plan provided. SIR is the Site Intelligence Report only; §9 Concept Plan Review is omitted per Phase 0 (`seed-site-data.md`).

## Open questions for the engineer

- **WUI Zone C confirmation at design start.** Pull the address through the COA WUI Zone Lookup tool and the COA Fire WUI plan-review desk to confirm Zone C and the specific Austin amendments that apply at duplex residential scale (Class A roof, ember-resistant vents, ignition-resistant siding, defensible space). Lock the assembly choices at DD, not CD.
- **EPA RRP (Renovation, Repair and Painting) Rule compliance for demolition.** The existing house was built 1993 — pre-1978 lead-paint rules do not apply (RRP Rule applies only to pre-1978 housing). No asbestos abatement is anticipated for a 1993 residence but a Texas Department of State Health Services asbestos survey is a low-cost confirmation step at demolition permitting; budget accordingly.
- **Confirm parcel is not pulled into the Nov 2025 FEMA preliminary FIRM update for Travis County.** The current effective panel (48453C0270J, 2014-08-18) maps the parcel as Zone X; the preliminary panel released for 90-day comment in Nov 2025 may reclassify some Walnut Creek tributary geometry. Defer to `fwp` for tracking, but flag here so the environmental memo doesn't go stale before permit submittal.
- **Field-verify no unmapped CEFs (springs, seeps, point recharge) during the pre-design site walk.** Vanishingly unlikely on a 1991-platted interior suburban lot, but the standard professional-care step is one walk-through with eyes open for any standing water, rock outcrop, or recent ground-surface anomaly. Document the absence in the project file.
- **Coordinate SMART Housing eligibility analysis with `programs`.** DDZ status is the precondition; the affordability path is the deciding factor. If SMART Housing is pursued, the environmental file may need to support the SMART Housing application package (clean Phase I summary, no contamination flags) — all of which is already in place.
