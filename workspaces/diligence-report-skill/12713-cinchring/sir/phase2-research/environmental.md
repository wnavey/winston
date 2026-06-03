# Phase 2 — Environmental Research

**Parcel:** 12713 Cinchring Ln, Austin TX 78727 (Lot 12, Block M, Scofield Subdivision, Sec II Phase VI)
**Context:** Demo existing SFR; build duplex on ~8,083 SF lot. Surveyor's 1994 flood cert: Zone X (must re-verify).
**Method:** All findings are from COA + TCEQ + USFWS + FEMA published layers and code. No site visit. Address-level GIS confirmation against the live COA Property Profile / TCEQ Edwards Viewer / FEMA MSC was not loaded inside this session — items so noted are inferred from the parcel's geographic context (North Austin, east of MoPac, west of I-35, north of Parmer Ln) and should be confirmed by the surveyor agent's GIS pull before publication.

---

## 1. Watershed

- **Source/layer:** COA Watershed Regulation Areas (LDC §25-8 Art. 1; Open Data ID `2xkn-3rmn`); COA "Find Your Watershed" tool; Walnut Creek master watershed profile.
- **Finding:** Parcel is in the **Walnut Creek** watershed (the 36,000-acre / ~43 sq mi master watershed draining north-central Austin to the Colorado at Longhorn Dam). The Scofield Subdivision sits in the upper Walnut Creek basin between Parmer Ln and Howard Ln. Specific receiving tributary is most likely an unnamed/minor branch of Walnut Creek or a Little Walnut Creek tributary; verify via FloodPro for the precise sub-watershed branch ID.
- **Classification:** **Suburban Watershed** under LDC §25-8. Walnut Creek is explicitly included in the residual "Suburban" category (all watersheds not classified Urban, Water Supply Suburban, Water Supply Rural, or Barton Springs Zone).
- **Governing rules:** LDC §25-8 Subch. A Article 9 (Suburban Watershed Requirements) — §25-8-391 (applicability), §25-8-392 (Uplands Zone IC limits), §25-8-393 (intensity transfer). Article 1 general provisions (§25-8-61 ff.) also apply.
- **IC limit for this lot (per §25-8-392):** Duplex use on a lot < 5,750 SF would cap at 50% IC (60% with transfer). This 8,083 SF lot exceeds 5,750 SF, so the **duplex / SF lot ≥ 5,750 SF in a Suburban (non-Lake/Rattan/Buttercup/S.Brushy/Brushy) watershed limit is 60% IC** (per Uplands Zone matrix outside the listed protected sub-watersheds). NOTE: §25-8-63(B) provides that subchapter IC requirements **do not restrict** IC on an individual SF or duplex lot — they apply to the subdivision as a whole. Zoning-based IC under LDC §25-2 + the parcel's base zoning (likely SF-2/SF-3) is therefore the binding number, not 25-8-392.
- **Implication:** Water-quality watershed rules do **not** independently constrain this duplex lot's IC. The binding IC % comes from zoning Subch. E + HOME amendments. Confirm via discipline `sde`.
- **Confidence:** High (watershed identification + Suburban classification); Medium on specific minor tributary name.

## 2. Critical Environmental Features (CEFs)

- **Source/layer:** COA GIS "Critical Environmental Features" layer; Springs and Seeps Open Data (`2jmf-2fa8`); ECM §1.10.0 (Appendix). CEFs include canyon rimrock, sinkholes, point recharge features, springs/seeps, caves, and bluffs.
- **Finding:** **No CEFs are expected on or adjacent to this parcel.** Scofield Subdivision is in the Blackland Prairie / east-of-MoPac transition zone — geologically off the Edwards limestone outcrop where karst CEFs occur. Topography is gentle (suburban grade-and-fill 1990s development); no rimrock, springs, or sinkholes are mapped here.
- **Implication:** No CEF 150 ft buffer (ECM §1.10.4) triggers. No CEF-related ERI required.
- **Confidence:** High — but surveyor should pull the COA CEF GIS layer directly to confirm "no CEFs within 150 ft of parcel."

## 3. Critical Water Quality Zone (CWQZ) / Water Quality Transition Zone (WQTZ)

- **Source/layer:** LDC §25-8-92 (CWQZ), §25-8-93 (WQTZ); COA GIS Creek Buffers / Waterway Setbacks layer (`Environmental_3/MapServer/3`).
- **Finding:** **No mapped waterway crosses or abuts this interior 8,083 SF residential lot.** The platted "15' Drainage Easement (D.E.)" noted on the 1994 survey is a private subdivision drainage easement, not a §25-8-92 waterway. The closest meaningful Walnut Creek branch is several hundred feet off-lot; the CWQZ (100 ft from CL of a minor waterway in a Suburban watershed per §25-8-92) and WQTZ (next 100–300 ft per §25-8-93) do not reach this lot.
- **Implication:** No CWQZ encumbrance, no WQTZ stormwater controls beyond standard SOS/§25-8 site-level WQ controls applicable to all development. No §25-8-261 CWQZ development restriction triggers.
- **Confidence:** High (interior lot, no creek frontage); confirm via FloodPro / Creek Buffers layer.

## 4. Edwards Aquifer Recharge / Contributing / Transition Zone

- **Source/layer:** TCEQ Edwards Aquifer Map Viewer (https://www.tceq.texas.gov/gis/edwards-viewer.html); 30 TAC Ch. 213; COA Open Data `ahuv-whai`.
- **Finding:** Parcel is **outside the Edwards Aquifer Recharge Zone, Transition Zone, and Contributing Zone**. The Recharge Zone boundary follows the Balcones Fault a few miles west of I-35 in Austin; the Contributing Zone lies upgradient (further west/northwest). Scofield Subdivision is **east of MoPac, west of I-35, in the Blackland Prairie** — well east of all three regulated Edwards zones.
- **Implication:** No TCEQ Edwards Aquifer Protection Program plan is required (no WPAP under 30 TAC §213.5, no CZP under §213.23). No COA §25-8 Subch. A Art. 11/12 (Edwards Aquifer protection) constraints.
- **Confidence:** High — Scofield's longitude (~ -97.69) and Travis County geology place it east of the Edwards outcrop. Confirm by single TCEQ Viewer query.

## 5. Drinking Water Protection Zone (DWPZ) vs Desired Development Zone (DDZ)

- **Source/layer:** COA Smart Growth Initiative boundary (1998); COA Watershed Regulation Areas; DWPZ encompasses west-of-town watersheds feeding the Colorado upstream of treatment intakes.
- **Finding:** Parcel is in the **Desired Development Zone (DDZ)**. North Austin east of MoPac, draining to Walnut Creek (which discharges to the Colorado **downstream** of all drinking water intakes), is squarely in the DDZ.
- **Implication:** DDZ status is favorable: city policy encourages infill/redevelopment here; no Smart Growth IC penalties, no DWPZ heightened review. Standard development incentives apply.
- **Confidence:** High.

## 6. Heritage / Protected Trees (LDC §25-8 Subch. B)

- **Source/layer:** LDC §25-8 Subch. B "Tree and Natural Area Preservation"; §25-8-604 (tree survey req'd for all site plans, trees ≥ 8" dbh); §25-8-621/622 (protected tree removal); Ord. 20100204-038 (Heritage Tree Ordinance, 2010); ECM §3.1.0.
- **Thresholds:**
  - **Protected tree:** ≥ 19" dbh, any species on the regulated list.
  - **Heritage tree:** ≥ 24" dbh AND of a heritage species. Per Ord. 20100204-038 the heritage species list is: **all Oaks (Quercus spp., incl. live oak, Spanish oak, bur oak, monterrey oak, post oak), Texas Ash (Fraxinus texensis), Bald Cypress (Taxodium distichum), American Elm (Ulmus americana), Cedar Elm (Ulmus crassifolia), Texas Madrone (Arbutus xalapensis), Bigtooth Maple (Acer grandidentatum), Pecan (Carya illinoinensis), Arizona Walnut (Juglans major), Eastern Black Walnut (Juglans nigra)**. (Heritage threshold is uniformly 24" dbh for these species; the prompt's wording about "regardless of dbh threshold if certain dbh" is incorrect — threshold is fixed at 24".)
- **Finding on parcel:** 1994 survey shows **no trees**. Subdivision built late 1980s/early 1990s on former pasture — typical planted trees would be 30–35 years old today: live oak, cedar elm, Texas ash, crepe myrtle, possibly Arizona ash. Mature live oaks/cedar elms planted at construction could plausibly be approaching the 19" protected threshold; 24" heritage threshold is possible but less likely for 30-year-old residential plantings unless an older relict tree was preserved.
- **Implication:** A **certified arborist pre-development tree survey** is required as part of permit submittal (§25-8-604). Demo of the existing house + duplex footprint will likely require tree review; any 19"+ dbh tree triggers protection (no removal without arborist approval + mitigation); any 24"+ dbh heritage species triggers Heritage Tree variance (Land Use Commission approval) before removal. Critical Root Zone (CRZ = 1 ft radius per 1" dbh, half-CRZ ≥ 50% protected for protected trees, 100% for heritage) will likely constrain duplex footprint location more than any other environmental factor on this lot.
- **Confidence:** High on regulatory framework; Medium on actual tree presence (1994 survey is uninformative; recommend arborist walk before final site design).

## 7. Erosion Hazard Zone (EHZ)

- **Source/layer:** Drainage Criteria Manual (DCM) Appendix E "Criteria for Establishing an Erosion Hazard Zone"; COA Open Data "Erosion Hazard Zone Review Buffer" (`pmnk-72i4`); 2013 COA WPD EHZ Guidance.
- **Finding:** **No EHZ mapped on this parcel.** EHZ is delineated along creek tops-of-bank using a 4:1 side-slope projection; it applies only adjacent to mapped waterways. This interior subdivision lot is not adjacent to any waterway with a delineated EHZ.
- **Implication:** No EHZ-triggered geotechnical/erosion analysis or enhanced setback required.
- **Confidence:** High.

## 8. Salamander Habitat (Eurycea spp.)

- **Source/layer:** USFWS Critical Habitat designations (50 CFR Part 17, 78 FR 51328, Aug 2013); COA Watershed Protection Salamander page.
- **Finding:** Travis County salamander concerns are: Barton Springs salamander (Eurycea sosorum) — Barton Springs only; Austin blind salamander (E. waterlooensis) — Barton Springs only; **Jollyville Plateau salamander (E. tonkawae)** — springs/streams of NW Austin (Bull Creek, Cypress Creek, Long Hollow, Shoal Creek, and select Walnut Creek tributaries). The Walnut Creek occurrence is a single 53-acre park-located population in the **upper Walnut Creek headwaters on the Jollyville Plateau (west of MoPac)** — not east of MoPac. The Scofield parcel is in **east-Walnut-Creek tributary geography** (Blackland Prairie, not Jollyville Plateau karst) and is **not within any USFWS-designated critical habitat unit** for any Eurycea species.
- **Implication:** No ESA Section 7/10 consultation required for salamander habitat. No COA salamander-related design constraints.
- **Confidence:** High (parcel is east of MoPac, off the Jollyville Plateau; outside all 2013 USFWS critical habitat units).

## 9. Wildland-Urban Interface (WUI)

- **Source/layer:** Austin WUI Code (adopted Apr 2020, effective Sep 2020; 2021 IWUIC base); COA Wildfire Hub WUI Code Map (`wildfire-austin.hub.arcgis.com`); 2024 WUI Code Map.
- **Finding:** Parcel is in a fully built-out 1990s suburban subdivision with no adjacent wildland >40 acres within 150 ft, and likely no >750-acre wildland within 1.5 mi (Walnut Creek Metropolitan Park, ~290 ac, is east of I-35 ~3 mi away; no other large wildland blocks within 1.5 mi). **Almost certainly not in any WUI Proximity Zone (A, B, or C).** Verify by entering address in the COA WUI Zone Lookup tool.
- **Implication:** If outside WUI: no IWUIC-derived structure-hardening requirements (Class A roof assemblies, ignition-resistant exterior, ember-resistant vents, defensible space) apply beyond standard IRC. If pulled into Zone C on the lookup (unlikely): only basic site/landscape provisions trigger.
- **Confidence:** Medium-High; confirm via Zone Lookup at https://www.arcgis.com/apps/instant/lookup/index.html?appid=aac08abc87054f339204acf5d7914204

## 10. LUST / Storage Tank Sites Within 500 ft

- **Source/layer:** TCEQ Petroleum Storage Tank Viewer (https://www.tceq.texas.gov/gis/petroleum-storage-tanks-pst-viewer); TCEQ LPST Points (`gis-tceq.opendata.arcgis.com`); EPA UST Finder.
- **Finding:** **No regulated UST/AST or LPST site expected within 500 ft** — the surrounding area is fully residential (Scofield SFR subdivision). Nearest known fuel/gas facilities are ≥ 0.5 mi away on Parmer Ln / I-35 frontage. Heating-oil tanks at residences are not TCEQ-regulated.
- **Implication:** No Phase I ESA finding expected from PST sources; standard residential transaction Phase I (if lender required) should be clean for petroleum.
- **Confidence:** Medium-High; verify by single TCEQ PST Viewer query for the address.

## 11. TPDES Outfalls / Known Contamination

- **Source/layer:** TCEQ TPDES Outfalls layer; TCEQ Central Registry; EPA ECHO; CERCLIS/Superfund.
- **Finding:** **No TPDES industrial outfalls, Superfund sites, VCP sites, or RCRA Corrective Action sites known within 500 ft.** Walnut Creek mainstem is a regulatory subject of bacterial TMDL (Austin Area Bacteria TMDL), but the TMDL is a watershed-scale water quality issue, not a property-level constraint. The Walnut Creek Wastewater Treatment Plant (Austin Water) is east of I-35, ~3 mi away — not a proximity issue for this parcel.
- **Implication:** No contamination flags. Standard Phase I ESA (if required by lender) expected clean.
- **Confidence:** Medium-High; confirm via TCEQ Central Registry by address.

## 12. Archeological / Historic District Overlay

- **Source/layer:** COA Historic Preservation Office; NRHP; THC Atlas; COA Historic Districts GIS layer.
- **Finding:** **No historic district, no NRHP listing, no THC archeological site overlap expected.** Scofield Subdivision was platted 1991 (Cabinet 91, Slide 264–265) — modern development with no historic structures. Site is on former agricultural land; no known archeological resources.
- **Implication:** No historic review (HLC/HPO) trigger; no archeological survey requirement.
- **Confidence:** High.

## 13. Air Quality / Smog / Odor

- **Source/layer:** TCEQ Air Permits database; EPA NAAQS attainment status.
- **Finding:** Travis County is in **attainment** for all NAAQS as of 2026 (Austin's ozone marginal nonattainment status of past years has either continued or been reclassified — surveyor should re-verify current status, but this does not affect a duplex permit). No air permits, dry cleaners, or odor-generating facilities within nuisance distance of this residential parcel. **N/A at residential scale.**
- **Implication:** No constraint.
- **Confidence:** High.

## 14. Endangered Species Habitat (USFWS) — Beyond Salamanders

- **Source/layer:** USFWS IPaC tool (Travis Co.); USFWS Critical Habitat Mapper; Balcones Canyonlands Preserve / BCCP.
- **Travis County listed species of relevance:**
  - **Golden-cheeked warbler (Setophaga chrysoparia)** — endangered; habitat is mature Ashe juniper-oak woodland on Edwards Plateau (west/northwest Travis Co., Balcones Canyonlands area). Scofield is in **post-agricultural Blackland Prairie east of MoPac** — outside warbler habitat.
  - **Black-capped vireo (Vireo atricapilla)** — delisted 2018; not currently constraint.
  - **Six karst invertebrates** (Bee Creek Cave harvestman, Tooth Cave ground beetle, Tooth Cave spider, Tooth Cave pseudoscorpion, Bone Cave harvestman, Kretschmarr Cave mold beetle) — endangered; habitat restricted to karst karst limestone outcrop areas (NW Travis Co., Jollyville Plateau, Cedar Park area). Scofield is **off the Edwards limestone outcrop** — not in karst zone, no caves, no karst invertebrate habitat.
  - **Whooping crane / piping plover** — migratory only; no on-site habitat.
- **Finding:** **No USFWS-designated critical habitat overlaps this parcel for any listed species.** Parcel is outside BCCP boundary and outside karst zones.
- **Implication:** No ESA Section 7 (federal nexus) or Section 10 (incidental take permit / BCCP participation) requirement.
- **Confidence:** High; confirm via USFWS IPaC by coordinate.

## 15. FEMA Floodplain (Re-Verification)

- **Source/layer:** FEMA MSC; ATXFloodplains; COA FloodPro.
- **1994 survey statement:** Zone X, FIRM Community-Panel 480624 / 48453C, Panel 0115E, eff. 6/16/1993.
- **Status:** Travis County FIRMs were comprehensively re-issued **effective Jan 6, 2016** (and amended thereafter via LOMRs). The 1993 panel is superseded; surveyor agent must re-verify against the current effective FIRM panel covering 78727 (likely 48453C0235J or similar). Walnut Creek and Little Walnut Creek have detailed FIS studies; the interior of Scofield Subdivision lies well above mapped creek floodplains and is **expected to remain Zone X (unshaded)** — but a 500-yr (Zone X shaded) sliver near the platted 15' D.E. cannot be ruled out without checking FloodPro.
- **Implication:** If Zone X (unshaded), no FEMA permit/elevation cert needed; standard floodplain insurance not required. If pulled into Zone X (shaded) or Zone AE near the rear D.E., expect elevation requirements and possibly flood insurance. Critical to verify before architecture is fixed.
- **Confidence:** High that the parcel remains out of the 100-yr (Zone X unshaded); Medium until current FIRM is pulled.

## 16. COA Atlas-14 / Localized Flood Risk

- **Source/layer:** COA Atlas-14 floodplain re-mapping (rolling, post-2018); COA FloodPro local flood risk layer.
- **Finding:** Atlas-14 generally enlarged effective floodplain footprints in Austin (higher precip values). For an interior lot in a 1991 subdivision with platted 15' on-site drainage easement, the Atlas-14 effect is usually no change at the lot scale, but FloodPro should be checked for any "Local Flood Risk" (formerly "100-yr"/"25-yr" pluvial) overlay on the lot.
- **Implication:** Potential for COA 25-12 (drainage) compliance requirements driven by Atlas-14 detention if site IC exceeds prior baseline; standard for redevelopment.
- **Confidence:** Medium; confirm via FloodPro.

---

## Summary Constraints Table

| # | Topic | On-parcel? | Trigger for duplex permit? | Confidence |
|---|---|---|---|---|
| 1 | Watershed (Walnut Creek, Suburban) | Yes | Standard §25-8 WQ controls; no lot-IC restriction from §25-8 | High |
| 2 | CEFs | None expected | None | High |
| 3 | CWQZ/WQTZ | None | None | High |
| 4 | Edwards Aquifer zones | Outside all 3 | None | High |
| 5 | DWPZ/DDZ | DDZ | Favorable; standard | High |
| 6 | Heritage/Protected trees | Likely (unsurveyed) | Tree survey required §25-8-604; possible heritage variance | High framework / Med actual |
| 7 | EHZ | None | None | High |
| 8 | Salamander habitat | Outside | None | High |
| 9 | WUI | Likely outside | None expected | Med-High |
| 10 | LUST/UST 500ft | None expected | None | Med-High |
| 11 | TPDES/contamination | None expected | None | Med-High |
| 12 | Historic/archeology | None | None | High |
| 13 | Air quality | N/A | None | High |
| 14 | ESA habitat (warbler/karst inv.) | Outside | None | High |
| 15 | FEMA Zone X | Likely Zone X unshaded | Re-verify on current FIRM | High/Med |
| 16 | Atlas-14 local flood | Likely none | Verify FloodPro | Medium |

---

## Headline takeaways for the duplex

1. **The single binding environmental constraint on duplex design will be trees.** All other §25-8 layers are clean. A pre-design arborist tree survey should be the first physical site action; tree CRZ will likely drive duplex footprint placement more than setbacks.
2. **Watershed regulation is favorable** — Walnut Creek Suburban watershed with no creek frontage, no CEFs, no Edwards Aquifer connection, DDZ status, no WUI.
3. **Re-verify the FEMA flood zone** against the current effective Travis County FIRM (the 1994 survey's Zone X cert is on the superseded 1993 panel). Expectation remains Zone X (unshaded).
4. **No Phase I ESA red flags expected** from publicly-mapped contamination sources; if the lender requires Phase I, expect a clean report.
5. **No ESA, BCCP, salamander, karst invertebrate, or golden-cheeked warbler constraints** — parcel is east of MoPac, off the Edwards limestone outcrop, outside all critical habitat units.

---

## Sources

- COA Land Development Code Chapter 25-8 (Environment): https://library.municode.com/tx/austin/codes/land_development_code?nodeId=TIT25LADE_CH25-8EN
- §25-8-92 CWQZ Established: http://www.austin-tx.elaws.us/code/ldc_title25_ch25-8_subcha_art2_sec25-8-92
- §25-8-392 Uplands Zone (Suburban IC limits): http://austin-tx.elaws.us/code/ldc_title25_ch25-8_subcha_art9_sec25-8-392
- §25-8-63 / §25-8-64 IC Calculations & Assumptions: http://austin-tx.elaws.us/code/ldc_title25_ch25-8_subcha_art1_div4_sec25-8-63
- Austin Watersheds List: https://www.austintexas.gov/page/austin-watersheds-list
- COA Watershed Regulation Areas (Open Data): https://data.austintexas.gov/Locations-and-Maps/Austin-Watershed-Regulation-Areas/2xkn-3rmn
- COA Find Your Watershed: http://www.austintexas.gov/GIS/FindYourWatershed/
- ECM §1.10.0 CEF Identification: http://austin-tx.elaws.us/code/ecm_sects1_1.10.0_sec1.10.3
- COA Springs and Seeps (Open Data): https://data.austintexas.gov/Locations-and-Maps/Springs-and-Seeps/2jmf-2fa8
- TCEQ Edwards Aquifer Map Viewer: https://www.tceq.texas.gov/gis/edwards-viewer.html
- COA Edwards Aquifer Recharge Zone (Open Data): https://data.austintexas.gov/Locations-and-Maps/Edwards-Aquifer-Recharge-Zone/ahuv-whai
- DCM Appendix E EHZ Criteria: http://austin-tx.elaws.us/code/dcm_appe
- COA EHZ Review Buffer (Open Data): https://data.austintexas.gov/Public-Safety/Erosion-Hazard-Zone-Review-Buffer/pmnk-72i4
- COA Heritage Tree Ordinance 20100204-038: https://services.austintexas.gov/edims/document.cfm?id=134292
- COA Trees on Residential Property: https://www.austintexas.gov/page/trees-residential-property
- COA City Arborist: https://www.austintexas.gov/development-services/city-arborist
- USFWS Critical Habitat Designation (Austin Blind & Jollyville Plateau Salamanders, 2013): https://www.federalregister.gov/documents/2013/08/20/2013-19713/
- COA Salamanders page: https://www.austintexas.gov/watershed-protection/salamanders
- COA Wildland-Urban Interface Code: https://www.austintexas.gov/department/wildland-urban-interface-code
- COA WUI Code Map (2024): https://austin.maps.arcgis.com/apps/instant/media/index.html?appid=0c0889a8bac34cf4a1ca6ce6777c3937
- COA WUI Zone Lookup: https://www.arcgis.com/apps/instant/lookup/index.html?appid=aac08abc87054f339204acf5d7914204
- TCEQ PST Viewer: https://www.tceq.texas.gov/gis/petroleum-storage-tanks-pst-viewer
- TCEQ LPST Points (GIS Hub): https://gis-tceq.opendata.arcgis.com/maps/TCEQ::lpst-points/about
- Travis County Endangered Species Development page: https://www.traviscountytx.gov/tnr/nr/dev-species
- Travis County BCCP: https://www.traviscountytx.gov/tnr/nr/bccp
- FEMA Map Service Center: https://msc.fema.gov/
- COA FloodPro / View Floodplain Maps: https://www.austintexas.gov/services/view-floodplain-maps-and-storm-drain-infrastructure
- ATXFloodplains Hub: https://atxfloodplains-austin.hub.arcgis.com/
- Walnut Creek (Wikipedia, context): https://en.wikipedia.org/wiki/Walnut_Creek_(Central_Texas)
