# Floodplain — 12713 Cinchring Ln, Austin TX 78727

## Summary
- Parcel is a dry, interior 1990s suburban infill lot with **no FEMA SFHA, no COA-regulated floodplain, no CWQZ/WQTZ, no EHZ, and no CEFs**. The entire FWP discipline reduces to confirming the absence of constraint.
- The 1994 survey's Zone X determination remains accurate under the current effective FIRM Panel **48453C0270J** (eff. 2014-08-18, supersedes the 1993 panel). Verified directly against the FEMA NFHL service in Phase 2.
- No floodplain permits, no FFE / freeboard requirements, no compensatory storage, no LOMA / LOMR, no Council variance pathway implicated. Cross-discipline handoffs for drainage and erosion control live in `sde` and `eptp`.

## Findings

### Outside FEMA SFHA (Zone X confirmed on current effective panel)
**Severity:** note (absence of constraint)
**Citation:** FEMA NFHL; FIRM Panel 48453C0270J, eff. 2014-08-18 (DFIRM_ID 48453C, countywide Travis); LDC §25-12 Article 1 (Floodplain Regulations); LDC §25-12-52 (design flood elevation).
**Finding:** Parcel is in **Zone X — Area of Minimal Flood Hazard** (outside the 100-year SFHA and outside any 500-year shaded Zone X). Confirmed by direct ArcGIS query of the FEMA NFHL service at the parcel centroid (-97.68395, 30.41466) in property-records Phase 2 (Verified). STATIC_BFE = -9999 (no BFE applies). The 1994 survey's Zone X cert (then on superseded Panel 0115E, eff. 1993-06-16) remains accurate under the 2014 panel: zone classification is unchanged.
**Implication for the developer:** No FEMA-driven design flood elevation, no 2-ft freeboard requirement under LDC §25-12-53(C)(1), no ASCE 24-14 structural compliance, no flood openings, no MEP elevation, no safe-refuge requirements. No FEMA Elevation Certificate (Form 086-0-33) required at CO. Federal flood insurance is not required for any conventional or government-backed mortgage. Standard slab-on-grade foundation (matches the existing 1993 house typology) is permissible.
**Recommended next step:** Re-confirm Zone X with the floodplain administrator at building permit submittal (standard formality — the permit application asks for current FIRM panel + zone). Document Zone X status on the title insurance commitment. Owner may elect inexpensive preferred-risk flood insurance but it is not required.

### Outside City of Austin locally-regulated floodplain (FEMA & Fully-Developed)
**Severity:** note
**Citation:** COA Watershed Protection FEMA Floodplain layer (`Shared/Floodplain/1`) + Fully-Developed Floodplain layer (`Shared/Floodplain/0`); LDC §25-7 (Drainage); DCM §1.2.6.B (floodplain delineation); Rule R161-20.01 (Atlas 14 compliance).
**Finding:** Both the COA FEMA-mirror layer and the COA **Fully-Developed Floodplain (FDF)** layer return zero features at the parcel point (Phase 2 Verified via direct REST query). The FDF is the City's regulatory boundary derived from approved hydraulic models intersected with site topo — it is often **broader** than the FEMA SFHA in Atlas 14-updated watersheds. Walnut Creek has been subject to Atlas 14 study and the FDF layer in this area reflects that. The parcel sits well upgradient of any mapped Walnut Creek tributary channel and is outside both the 100-yr and the 25-yr (= COA floodway) regulatory boundaries.
**Implication for the developer:** No COA Floodplain Development Permit required. No 0.00-ft rise certification (LDC §25-12-54), no PE-sealed no-rise letter, no WSE comparison table, no compensatory-storage analysis. No drainage easement dedication of regulatory floodplain on the lot (LDC §25-7-152) — the platted 15' D.E. is a private subdivision drainage easement, not a regulatory floodplain easement.
**Recommended next step:** Re-confirm "no FDF at point" via FloodPro at the time of permit submittal (the Nov 2025 FEMA preliminary FIRM update for Travis County, noted in property-records Phase 2, is in 90-day public comment as of this report; current effective panel remains 48453C0270J, and the preliminary update is not expected to reclassify this interior parcel — but worth a final FloodPro check before architectural lock-in).

### No Erosion Hazard Zone (EHZ)
**Severity:** note
**Citation:** LDC §25-7-32(C) (EHZ trigger); DCM Appendix E (EHZ delineation procedure); COA EHZ Review Buffer layer (Open Data `pmnk-72i4`).
**Finding:** Parcel is outside the EHZ review buffer (Phase 2 Verified — `Shared/Environmental_3/7` returns no features at point). EHZ delineation is only required where development is within 100 ft of the centerline of a classified waterway (≥64 acres contributing drainage). This interior subdivision lot is not adjacent to any such waterway. No meander-belt analysis, no bankfull-geometry workup, no side-slope projection to 100 ft, no 20-ft minimum top-of-bank setback applies. No WPD/ERM concurrence on protective works is required.
**Implication for the developer:** No mandatory creek-side erosion setbacks beyond standard Subchapter E zoning setbacks. No geotechnical erosion-stability report required by EHZ.

### No Critical Water Quality Zone (CWQZ) / Water Quality Transition Zone (WQTZ)
**Severity:** note
**Citation:** LDC §25-8-92 (CWQZ established); LDC §25-8-93 (WQTZ); LDC §25-8-261 (CWQZ development restriction); ECM §1.5.2.D (buffer averaging); COA Creek Buffers / Waterway Setbacks GIS layer.
**Finding:** No mapped waterway crosses or abuts the parcel. Parcel is interior; closest Walnut Creek tributary is several hundred feet off-lot. In Suburban watersheds, CWQZ buffer widths from centerline are 100 ft (minor, 64–320 ac contributing), 200 ft (intermediate), or 300 ft (major) — none of these buffers reach the parcel. WQTZ extends a further 100–300 ft beyond CWQZ and likewise does not reach. The platted 15' Drainage Easement noted on the 1994 survey is a private subdivision drainage easement (a §25-7 utility/private easement, **not** a §25-8-92 classified waterway buffer); it does not establish a CWQZ.
**Implication for the developer:** No CWQZ encroachment, no LUC variance under the enhanced §25-8-41(B) standard, no ECM §1.7 floodplain-modification analysis, no FAFH (Functional Assessment of Floodplain Health), no restoration ratios. No buffer-averaging design needed. No riparian / water-quality buffer reduces the buildable envelope. Standard §25-8 site-level water quality controls (sde discipline) still apply to all development, but no buffer-driven constraint exists.

### Walnut Creek watershed classification (Suburban)
**Severity:** note
**Citation:** LDC §25-8 Subchapter A Article 9 (Suburban Watershed Requirements); LDC §25-8-391 (applicability); LDC §25-8-392 (Uplands Zone IC); LDC §25-8-63(B) (IC requirements do not restrict individual SF/duplex lots).
**Finding:** Parcel is in Walnut Creek watershed, classified **Suburban** under LDC §25-8 (Phase 2 Verified via COA Environmental layer). Suburban watersheds set IC ceilings at subdivision scale per §25-8-63(B); they do not independently restrict IC on an individual single-family or duplex lot. The binding IC % for this duplex therefore comes from zoning (LDC §25-2) plus HOME amendments, not from §25-8-392. Walnut Creek is **not** in the Barton Springs Zone — no Save Our Springs (Article 13) IC ceiling applies.
**Implication for the developer:** No watershed-driven structure prohibition. No watershed-driven IC cap on this lot. Standard §25-8 site-level water quality controls (0.5"/1.0" capture, biofiltration / vegetative or equivalent BMPs at the duplex scale) still apply — see `sde` for sizing.

### Downstream peak-flow considerations
**Severity:** note
**Citation:** LDC §25-7 (Drainage); DCM §1.2.2 (peak-flow attenuation); DCM §1.2.2.F (TIRZ / Waller Creek tunnel exception — not applicable here).
**Finding:** The site drains via on-lot grading and the platted 15' subdivision drainage easement into the Walnut Creek tributary network and eventually to the Colorado below Longhorn Dam. Demolition of the existing ~2,095 SF house plus driveway and construction of a duplex on an 8,054 SF lot will produce a marginal increase in impervious cover (order-of-magnitude ~600–1,200 SF additional IC, depending on final design) and correspondingly small incremental peak runoff (~0.025 cfs at a 10-yr design storm — engineer to confirm). At duplex scale this is negligible relative to the Walnut Creek mainstem hydraulic regime; drainage-criteria compliance is handled at the site scale by `sde`.
**Implication for the developer:** No downstream impact analysis is required at this scale; drainage compliance is the standard residential-redevelopment pathway (sde discipline).

### Cross-references
- See `sde` for drainage / water quality control sizing for the duplex (Suburban watershed §25-8 site-level WQ capture; Atlas 14 detention sizing if redevelopment IC threshold triggered).
- See `el` for environmental layers (CEFs, watershed, salamander, ESA, heritage trees) — all clean per Phase 2.
- See `eptp` for SWPPP / construction-phase erosion and sediment control (TPDES Construction General Permit applicability at >1 ac disturbance — this 0.185 ac lot is well below threshold but COA still requires construction E&SC controls).
- See `property-records` (Phase 2) for the 15' drainage easement: location on Lot 12 is not labeled on the 1994 survey and must be resolved by pulling the recorded plat (Cabinet 91, Slide 264–265) before duplex site design.

## Plan-specific findings
(N/A — no concept plan provided. SIR scope only.)

## Open questions for the engineer
- Confirm Zone X with the COA floodplain administrator at building permit submittal (standard formality — Permit Application Form references current FIRM panel + zone).
- Re-check FloodPro at permit submittal to confirm no change from the Nov 2025 FEMA preliminary FIRM update (Travis County preliminary panels are in 90-day public comment as of this report; current effective panel 48453C0270J remains binding until final adoption, and the parcel is not expected to be reclassified, but worth a final check before architectural lock-in).
- Confirm exact location of the platted 15' drainage easement on Lot 12 by pulling the recorded plat (Cabinet 91, Slide 264–265 — Travis County Plat Records). Easement is a private subdivision drainage easement (no regulatory floodplain implication) but its on-lot footprint constrains structure placement and must be respected by the duplex site plan. Handoff to `sde` and `sduf`.
