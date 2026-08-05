# SIR Findings that Rely on Geo-Spatial Reasoning

**Site Intelligence Report:** *Fegenbush Ln at Bardstown Rd · Louisville, KY* — a car-wash feasibility read on two vacant Hutton pads (4401 & 4403 Fegenbush Ln).

**Source artifact:** `sir_artifact` `55a2720c-c809-40fd-b589-6525cc48e3bb` (v1, "Fixed page 11 aerial image"), report `caac753c-128b-4311-8d10-2480be0268eb`, stored at `sir-artifacts/sir/caac753c-128b-4311-8d10-2480be0268eb/v1/site-intelligence-report.pdf` (118 pp, 11.3 MB).

---

## Coverage at a glance — how much of the SIR is geo-spatial

The SIR enumerates two formal top-line lists — **7 Top Risks** (§1.3, pp. 5–7) and **3 Top Opportunities** (§1.4, pp. 7–8) — and behind them **10 Discipline Findings** (§8, "the ten disciplines," p. 19). The share of each that is carried by geo-spatial reasoning:

| Category | Geo-spatial / total | % | The non-geospatial remainder |
|----------|:-------------------:|:--:|------------------------------|
| **Top risks** (§1.3) | **6 / 7** | **86%** | R1 approval-path (interpretive: code text vs. local practice) |
| **Top opportunities** (§1.4) | **2 / 3** | **67%** | O3 OZ-2.0 finalist (financing eligibility) |
| **Top-line items combined** (risks + opportunities) | **8 / 10** | **80%** | R1, O3 |
| **Discipline sections** carrying geo-spatial reasoning (§8.1–§8.10) | **8 / 10** | **80%** | §8.8 Water/Wastewater, §8.10 Parks (availability/fee logic) |

Read: **geo-spatial reasoning is the dominant analytical mode of this SIR** — it drives ~5 of every 6 top risks and 4 of every 5 discipline sections. The two enumerated exclusions (R1, O3) are called out in §4 below; §8.8 and §8.10 are the two disciplines whose headline finding turns on availability/fees rather than space.

> **Note on labels.** `R#` and `O#` mirror the SIR's own top-risk / top-opportunity ordering (R1 = the SIR's first risk, and so on). **`A1`–`A10` are labels assigned by *this* report**, not SIR-native IDs — they collect the geo-spatial findings drawn from the SIR's 10 Discipline Findings (§8), Parcel Facts (§2), Demand & Competition (§9), and the research appendices, i.e. everything outside the two enumerated top-line lists. So the A-items are "regular" discipline/parcel findings, surfaced here because their logic is spatial; the 8/10 discipline ratio above is the honest denominator for that bucket (the A-count itself is a selection, not a fraction of a native list).

---

## What this report is

The user asked for **every top finding that involves geo-spatial reasoning**. The canonical example they gave:

> *"Of the 2.61 ac gross, a recorded 20-ft drainage easement (~0.19 ac) plus an embedded detention remainder (~0.86 ac) leave roughly 1.56 ac, and the wash's own basin lands on top of that [V]."*

That sentence is geo-spatial reasoning because it **subtracts areas** on the ground and then reasons about **two features competing for the same footprint** (the basin landing on the encumbered strip).

**Working definition used here.** A finding relies on geo-spatial reasoning when its logic turns on *physical space*: distance/proximity, area and area subtraction, overlay/containment (is a lot inside a polygon/zone), adjacency and orientation (N/S/E/W, what fronts what), geometry and dimensions (frontage lengths, setbacks, buffers, queue/stacking geometry, sight lines, turning radii), siting/placement of features (basins, transformers, driveways), gradient direction (up- vs down-gradient), coordinates/centroids, and radius screens. Findings that turn purely on legal interpretation, use tables, or financing are **excluded** and flagged at the end.

Each entry gives the SIR location, the geo-spatial reasoning verbatim (numbers/bearings/areas preserved), and the **spatial operation** it performs. The Executive Summary (§1) and Discipline Findings (§8) state each finding; the Research Appendices (B–T) carry the underlying spatial computation, and are quoted where they add the geometry.

---

## The load-bearing spatial constants

A handful of measured spatial facts recur across the whole report and back most findings below:

| Constant | Value | Where it drives a finding |
|----------|-------|---------------------------|
| Subject centroid | **38.184861, -85.636991** | every point-in-polygon zone/district test |
| Fegenbush frontage | **369.36 ft**, west edge, bearing **~274°** (outward normal 273.248°) | only public frontage; access, fire, setback |
| Union footprint | **583 ft (E–W) × 438 ft (N–S)**, long axis **91.9° azimuth** | orientation, layout |
| South boundary | **574.0 ft**, abuts apartments (S/SW) | buffer + Part 7 transition |
| Site area | **158,179 sf (3.63 ac)** combined | canopy %, buffer %, flow |
| Lot 3 gross → net | **2.61 ac (113,613 sf) → ~1.56 ac** after detention carve-out | buildable-area squeeze |
| No-build strips on Lot 3 | **20-ft drainage** (~0.19 ac / 8,317 sf) + **15-ft sanitary** (DB 6516) | basin/lateral/structure siting |
| Dairy Mart release | **~120–150 m NW / up-cross-gradient** of Lot 3 centroid | Phase-I priority |
| ZIPS competitor | **~0.13 mi (~700 ft)**, same Bardstown/Fegenbush node | demand |
| ROW dedicated at corner | **0.488 ac** (0.237 + 0.179 + 0.072) + sight-distance easement | driveway window |
| Cross-access easement | **0.392 ac**, through the Wawa (Lot 1) | second fire egress |

---

## Index

*"SIR p." is the PDF page (of 118) where the finding is stated; the Report-location column points to the deeper geometry in the discipline sections and appendices.*

| # | Finding | SIR p. | Report location | Severity | Spatial operation |
|---|---------|:------:|-----------------|----------|-------------------|
| — | **Site-orientation foundation** (bearings, azimuth, adjacencies) | 11, 39 | §Site Orientation; Appx D | — | Bearing/azimuth geometry, adjacency |
| R2 | Plan-certain overlay on the larger lot only | 5 | §1.3; §8.1; Appx J/T | Significant | Polygon containment |
| R3 | State-route frontages → entrance permit + stacking sized to KY-864 | 6 | §1.3; §8.7; Appx H/R | Significant | Frontage/throat geometry, sight triangle |
| R4 | Detention-governed buildable area (the example) | 6 | §1.3; §8.3; Appx B/P | Significant | Area subtraction, basin-siting conflict |
| R5 | Karst forces lined basins & constrains basin siting | 6 | §1.3; §8.5; Appx B/L/P | Significant | Mapped-terrain overlay, siting constraint |
| R6 | One public way in; second fire access via cross-access | 7 | §1.3; §8.6; Appx M | Significant | Access-route topology, adjacency |
| R7 | Adjacent petroleum release → Phase-I ESA | 7 | §1.3; §8.5; Appx B/L/I | Significant | Radius/proximity screen, gradient direction |
| O1 | Constrained drainage/buffer land double-duties as open space | 7 | §1.4; §8.3; Appx N/O | Opportunity | Area double-use overlay |
| O2 | Off-site flood-compensation storage | 8 | §1.4; §8.3 | Opportunity | On-site vs off-site siting trade |
| A1 | Marketed vs. recorded acreage reconciliation (D1) | 13 | §2; Appx P/Q | Note | Area reconciliation |
| A2 | Map-pin re-anchored from Wawa to the vacant pads | 13 | §2 | No constraint | Point-in-polygon correction |
| A3 | Site-design setbacks, south buffer + Part 7 transition, replat | 20 | §8.2; Appx Q/T | Moderate | Setback/buffer geometry, edge budget |
| A4 | Floodplain cleared *at the parcel centroid* | 21 | §8.4; Appx B/N | No constraint | Point-in-polygon zone test |
| A5 | Easement spatial attribution (LG&E/MSD burden the Wawa only) | 16 | §4; §8.9; Appx F/K | Moderate/Note | Easement-to-parcel attribution |
| A6 | Streams/wetlands/receiving-water proximity + buffer bands | 35 | Appx B/N/P | Note | Buffer proximity (500 m), band geometry |
| A7 | Slope/DEM ground sweep, airport, pipelines | 35 | Appx B/P | Note | DEM terrain analysis, proximity |
| A8 | On-pad transformer/equipment siting conflict | 74 | §8.9; Appx K | Moderate | Equipment-vs-buildable siting |
| A9 | Special-district & overlay containment at centroid | 21 | Appx I/J/N/Q/T | Note | Point-in-polygon / overlay null |
| A10 | Competitor proximity & radial demand rings | 52 | §9; Appx G | Note | Radius/ring proximity screen |

> **Excluded as non-geospatial:** Top Risk R1 (car-wash approval path — pure code-vs-practice interpretation) and Top Opportunity O3 (Opportunity-Zone-2.0 financing — the OZ test *is* a point-in-polygon at the centroid, but the finding's conclusion is financial). See the final section.

---

## 0. Site-orientation foundation

Nearly every geo-spatial finding rests on an independently measured orientation the report establishes up front (Site Orientation, Part Two; Appendix D). Spatial operations: *bearing/azimuth geometry, frontage geometry, cardinal adjacency.*

- **Single west frontage, located by bearing vs. centroid longitude.** *"The parcel has exactly one frontage: Fegenbush Lane, bearing 274.03° (running roughly east–west), with both site access points attached to it. The frontage sits on the parcel's western edge (frontage longitude ~-85.6382, west of the centroid at -85.63740). The pads front Fegenbush Lane along their west edge."*
- **Long axis by union footprint.** *"The union footprint measures 583 ft (E–W) × 438 ft (N–S), long axis 91.9° azimuth — within about 2° of due east,"* consistent with the north-up aerials.
- **Cardinal adjacencies corroborated.** *"Wawa immediately north/northeast (between the pads and Bardstown Road), apartments to the south/southwest, and Bardstown Road (US-31E / 150) running northeast–southwest beyond the Wawa."*
- **Frontage-constraint vantages by bearing.** Eight candidates traced along the frontage with vantage bearings (e.g. *name-split severance "c1, vantage bearing 123.3°, ~26.7 m setback"*; dead-end stubs at 182.7°/274.0°/123.7°; four uncorroborated stubs c5–c8 at listed lat/long vantages, bearings 303.7°/33.9°/8.8°/3.8°).
- **No plan-north to reconcile.** The only graphic is a marketing flyer with no north arrow, so *"no cardinal delta can be computed against the site's measured orientation"* — a spatial reconciliation the report explicitly performs and finds vacuous (correctly).

Every downstream "west frontage," "south buffer," and "north/northeast Wawa" claim inherits from this measured frame.

---

## 1. Top Risks that use geo-spatial reasoning

Six of the seven top risks (§1.3) rely on geo-spatial reasoning. (The seventh — the approval-path risk — is purely interpretive; see the exclusions section.)

### R2 — A recorded development plan sits on the larger lot (polygon containment)
*SIR p. 5 · §1.3 · §8.1 Zoning & Land Use · Appendix J/T.* Spatial operation: **polygon containment (one lot in, one out).**

> *"The 2.61-ac lot is inside a plan-certain overlay; the 1.02-ac lot is not."* … *"Binding development plan 20-ZONE-0006 … runs with the 2.61-ac lot [V]."*

The appendices state it as a pure containment test: *"The 20-ZONE-0006 polygon (~6.52 ac) covers only Lot 3 (061801410000); Lot 2 (061801400000) is outside it"* (Appx J) and *"binds the 2.61-ac pad, PARCELID 061801410000; the 1.02-ac pad … is outside the polygon (separately owned in 2020)"* (Appx T). The base C-1 zoning is itself confirmed *"by point-query at the primary-pad centroid (LOJIC Zoning layer)."* The whole entitlement fork turns on **which lot falls inside the polygon**.

### R3 — Both frontages are state routes; stacking must be sized to the frontage (frontage + throat geometry, sight triangle)
*SIR p. 6 · §1.3 · §8.7 Transportation & Access · Appendix H/R.* Spatial operation: **frontage geometry, perpendicular throat/queue geometry, corner sight-distance triangle, corner clearance.**

> *"Bardstown Rd (US-31E/KY-150) and Fegenbush Ln (KY-864) are both KYTC-maintained, so the entrance is a KYTC District 5 permit — not a Metro permit [V]. An express wash's queue must be sized off the KY-864 frontage so stacking does not spill onto a state route; a recorded sight-distance easement sits at the corner."*

The appendices carry the geometry:
- **Only frontage, measured.** *"Fegenbush frontage length 369.36 ft, outward normal 273.248° (W), a collinear two-segment run spanning both parcels"* (Appx R); a deterministic OSM trace found *"Fegenbush Lane (bearing 274°) as the only frontage … The independent approach count is 1"* (Appx H).
- **Throat depth is a perpendicular measurement.** *"throat depth from the Fegenbush curb line to the first conflict point must be deep enough that the queue never spills onto the state route … throat depth is measured perpendicular into the site, and buildable depth is compressed by the SMC front build-to setback and the net-developable carve-out"* (Appx R). Express stacking runs *"~20–30+ vehicles ahead of the tunnel"* (Appx H).
- **Corner sight triangle + chamfer window.** *"corner clearance from the signalized Bardstown/Fegenbush intersection is a hard constraint, and the plat's Sight Distance Easement sits at that corner"* (Appx H); *"The NW corner is a multi-segment chamfer … so usable frontage for a driveway begins south of the chamfer"* (Appx R).
- **ROW already carved at the corner.** *"The 2024 minor plat dedicated 0.488 ac of public right-of-way (a 0.237-ac and 0.179-ac dedication at the Fegenbush/Bardstown corner and along Fegenbush, plus 0.072 ac along the Bardstown frontage) together with a corner Sight Distance Easement"* (Appx H).

The driveway is a spatial pass/fail: which road touches the parcel sets jurisdiction, and the queue must physically fit perpendicular into a footprint already compressed by setbacks.

### R4 — Detention-governed buildable footprint (the canonical example — area subtraction + basin-siting conflict)
*SIR p. 6 · §1.3 · §8.3 Stormwater & Drainage · Appendix B/P.* Spatial operation: **area subtraction, basin-siting overlay conflict.**

> *"Of the 2.61 ac gross, a recorded 20-ft drainage easement (~0.19 ac) plus an embedded detention remainder (~0.86 ac) leave roughly 1.56 ac, and the wash's own basin lands on top of that [V]."*

Appendix P does the full accounting and the overlap argument: *"The county gross area is 2.6082 ac (113,613.4 sf); the brokerage flyer markets ~1.56 ac net — meaning ~1.05 ac is already committed to drainage or undevelopable use. Of that … the recorded plat sewer and drainage easement is only ~0.19 ac … the balance (~0.86 ac) is the detention/undevelopable remainder. … The 20-ft drainage easement is an interior recorded band, not a boundary run."* And the siting conflict: *"the basin cannot double-count the existing drainage easement without a grades reconciliation. … The basin must be sited to reconcile with the existing 20-foot easement corridor"* (Appx B/P). This is the report's flagship geo-spatial finding: **gross-minus-encumbrance area** plus a **spatial-overlap** argument (basin vs. easement corridor on the same ground).

### R5 — Karst forces lined basins and constrains basin siting (mapped-terrain overlay + siting)
*SIR p. 6 · §1.3 · §8.5 Environmental · Appendix B/L/P.* Spatial operation: **map-unit lookup at centroid, feature-siting constraint.**

> *"Both lots are mapped karst terrain [V]; a sinkhole/void geotechnical screen and lined (not infiltration) basins are effectively required."*

Grounded in soils geography by a **map-unit lookup at each parcel centroid**: *"The SSURGO map unit at both centroids is the Urban land–Alfic Udarents–Crider complex, 0–12% slopes (mukey 1533091) … Crider-series ground indicates soluble carbonate bedrock at depth"* (Appx B). The terrain containment then **constrains where and how basins sit**: *"MSD and geotech practice over karst is lined/sealed basins and closed conveyance. If a geotechnical investigation finds a solution feature or sinkhole on the pad, §10.3.9 escalates the basin to a … 100-yr/24-hr no-outlet storage"* (Appx P), with basin siting *"cross-reference[d] … to the recorded 20-ft drainage easement"* (Appx L).

### R6 — One public way in; the required second fire access rides on private cross-access (access-route topology)
*SIR p. 7 · §1.3 · §8.6 Fire Protection · Appendix M.* Spatial operation: **access-route topology, adjacency/pass-through, hydrant spacing/hose-lay geometry.**

> *"The only public frontage is Fegenbush Ln; the recorded Bardstown Driveway cross-access through the Wawa (ECR 2024163213) is the second way out [V]."*

Appendix M frames it as a connectivity graph: *"The site has exactly one independent approach on its own frontage — Fegenbush Ln (KY-864) on the west edge, a continuous 369.36-ft frontage run … The practical second way out is the recorded Bardstown Driveway, a perpetual reciprocal cross-access easement running through the adjacent Wawa (Lot 1) to Bardstown Rd — a legal second access, not a physically independent public one"* (cross-access easement **0.392 ac**). The remaining fire geometry is deferred for want of a plan but named spatially: *"hydrant coverage and maximum hose-lay to the most remote point cannot be adjudicated,"* and aerial-apparatus access (*over 30 ft / 3 stories*) is weighed against the *"Fegenbush frontage 369.36 ft continuous."*

### R7 — Adjacent documented petroleum release → Phase-I ESA (radius/proximity screen + gradient)
*SIR p. 7 · §1.3 · §8.5 Environmental · Appendix B/L/I.* Spatial operation: **proximity/adjacency, radius screen, gradient direction.**

> *"The neighboring corner (former Dairy Mart) has a documented petroleum release (PSTEAF #104120 / KY-TEMPO 68685)."*

Heavily geo-spatial in the appendices:
- **Distance + bearing + gradient to the source:** *"The corner sits ~120-150 m NW / up-cross-gradient of Lot 3 — the single highest-priority off-site concern for the Phase I ESA"* (Appx I); *"roughly 120–150 m northwest of the Lot 3 centroid"* (Appx B/L).
- **Radius screen:** *"An off-site petroleum cluster sits within a half-mile up- and cross-gradient screen (EPA FRS geospatial query, 0.5-mile radius, 2026-08-03, 25 facilities)"* (Appx B); a further LUST case (Speedway 9710) is *"roughly half a mile, likely off-gradient"* (Appx L).
- **Migration-path reasoning:** *"If the Dairy Mart release migrated on-gradient toward the pads, the car wash's own excavation and dewatering could encounter impacted soil or groundwater … confirm gradient direction relative to the pads"* (Appx L).

The environmental risk is sized by **how close, in which direction, and up/down the groundwater gradient** each source sits relative to the pads.

---

## 2. Top Opportunities that use geo-spatial reasoning

### O1 — Constrained drainage/buffer land can double as credited open space (area double-use)
*SIR p. 7 · §1.4 · §8.3 · Appendix N/O.* Spatial operation: **area double-use overlay.**

> *"MSD and LDC open-space provisions let encumbered drainage land do double duty where the local regime reaches a pad [P]. A latent offset to the detention remainder on the larger lot."*

The appendices quantify the credit: *"that constrained land earns 50% open-space credit, and required buffer areas can count toward open-space obligations"* (Appx N); *"detention basins, stream buffers, and constrained land can double as credited open space"* (Appx O). Spatial because the **same physical acreage** (the R4 remainder) serves **two overlapping functions**.

### O2 — Off-site flood-compensation storage may relieve on-site detention (on-site vs off-site siting)
*SIR p. 8 · §1.4 · §8.3.* Spatial operation: **relocation of stored volume off-parcel.**

> *"Where on-site detention is tight, MSD's compensatory-storage mechanisms can move part of the obligation off-site [P]."*

Spatial because it trades **where** detention volume physically lives — moving obligation off the tight parcel to free on-site footprint.

---

## 3. Ancillary & discipline findings that use geo-spatial reasoning

### A1 — Marketed vs. recorded acreage reconciliation (D1) (area reconciliation)
*SIR p. 13 · §2 Parcel Facts · Appendix P/Q.* Spatial operation: **area reconciliation (net vs. gross).**

> *"The recorded plat and county GIS establish 1.02 ac and 2.608 ac. The larger figure is ~1.05 ac (~40%) below the recorded gross, consistent with the marketing stating a net-of-detention area rather than the gross parcel."*

The report attributes the flyer's "1.56 ac" vs. recorded 2.608 ac **~1.05-ac delta** to the drainage easement plus detention remainder — the R4 subtraction, reused to explain the marketing gap: *"marketed pad areas (1.0 ac + 1.56 ac, the latter net-of-detention on the 2.61-ac county gross)"* (Appx Q).

### A2 — Operator map-pin re-anchored from the Wawa to the vacant pads (point-in-polygon correction)
*SIR p. 13 · §2 Parcel Facts.* Spatial operation: **point-in-polygon correction.**

> *"The operator-supplied map pin resolved to the Wawa lot and was re-anchored to the vacant land. [V]"*

A supplied **coordinate point** landed inside the wrong parcel polygon (the developed Wawa) and was corrected onto the subject pads.

### A3 — Form setbacks, south buffer + Part 7 transition, two-lot replat (setback/buffer geometry with exact area subtraction)
*SIR p. 20 · §8.2 Site Design & Urban Form · Appendix Q/T.* Spatial operation: **setback/build-line geometry, buffer strip, transition-zone depth, edge budget.**

> *"The Suburban Marketplace Corridor form district sets the front build-line off ½ the standard ROW (a ~30-ft swing on the KY-864 functional class) and a 25-ft south landscaped buffer; because the south neighbor is a Neighborhood form district, LDC Part 7 transition standards stack on top. A wash spanning both lots raises a replat/lot-line question."*

Appendix Q turns each edge into an exact area clip:
- **Front build-line off centerline.** *"Under collector the floor is 40 ft off centerline (80 ÷ 2); under minor arterial it is 60 ft (120 ÷ 2). … that puts the front building line roughly 10 ft (collector) to 30 ft (minor arterial) behind the existing frontage property line. A 30-ft inward clip off the frontage line is 11,215.3 sf (7.09% of the 158,179 sf site)."*
- **South buffer + 200-ft transition zone.** *"The south boundary (574.0 ft, abutting the multifamily apartment complex …) triggers the SMC 25-ft landscaped side/rear buffer. A 25-ft clip off it is 14,348.1 sf (9.07% of the site) … LDC §5.7.1 imposes a 200-ft-deep transition zone on the SMC side in addition to the 25-ft buffer, carrying a 45-ft height cap and a Type C buffer yard … At minimum ~14,300 sf on the south edge is off-limits."*
- **Cross-lot layout forces a replat.** *"A car wash straddling both lots, or carving the Lot-3 detention remainder into its own tract, requires a Planning-Commission-approved replat."*
- **Noise-source siting.** *"Site the tunnel and vacuums toward the north side"* (away from the south residential edge).

### A4 — Floodplain cleared at the parcel centroid (point-in-polygon zone test)
*SIR p. 21 · §8.4 Floodplain & Watershed · Appendix B/N.* Spatial operation: **point-in-polygon zone containment (negative).**

> *"Both lots are FEMA Zone X (FIRM 21111C0078F) and outside the MSD Local Regulatory Floodplain, Conveyance Zone, and Combined Sewer Floodprone Area, confirmed at the parcel. [V]"*

Appendix N: *"Both subject pads return FLD_ZONE=X … SFHA_TF=F … Neither pad, nor the recorded cross-access driveways that reach them, lies in an SFHA or floodway. … This is a point-query confirmation at each parcel centroid."* Even the "no constraint" outcome is reached by a **spatial containment test** against the flood-zone polygons.

### A5 — Easement spatial attribution: LG&E/MSD burdens land on the Wawa, not the pads (easement-to-parcel attribution)
*SIR p. 16 · §4 Recorded Encumbrances · §8.9 Electrical · Appendix F/K.* Spatial operation: **easement-to-parcel attribution via legal description / strip geometry.**

> *"The MSD stormwater agreement (2024114301) and LG&E easement (2024176896) burden the Wawa lot only, verified against each instrument's legal description."*

Appendix F/K read the strip geometry onto specific lots: *"two underground strips (254' × 20' and 88' × 15') tied … to the Wawa tract (Lot 1). Both subject pads are free of it. … The plat's generic 10' utility easement and 20' drainage easement are the only recorded no-build strips on the pads"* (Appx K). The reciprocal-access grant is likewise spatial: *"§ 2.1 grants perpetual reciprocal access over the Fegenbush and Bardstown driveways among the three lots"*; the 15-ft sanitary strips *"run along the Lot 3 / cemetery boundary — a burden on Lot 3"* (Appx F).

### A6 — Streams, wetlands, receiving water, and buffer bands (proximity + band geometry)
*SIR p. 35 · Appendix B · Appendix N · Appendix P.* Spatial operation: **buffer/proximity screen (500 m), buffer-band geometry, drainage-edge adjacency.**

> *"Within 500 m, NHD maps two unnamed intermittent streams and NWI maps one riverine wetland (Cowardin R4SBC, 4.25 acres) coincident with the mapped intermittent channel … On the pads themselves the NWI feature is the channel, so the constraint sits at the drainage-feature edge."*

Appendix N adds the band geometry: a protected waterway *"would carry a Type 'B' 100-ft buffer (25-ft streamside + 50-ft middle + 25-ft outer), and buffers reach across property lines … Whether a buffer actually clips a pad turns on a field top-of-bank … delineation."* A Site Disturbance Permit trigger is a proximity band: *"within 50 ft of a drainageway"* (Appx L). Receiving water is the *"unnamed tributary of South Fork Beargrass Creek"* — the same basin the MSD Beargrass Area Tunnel serves (a **2-mi buffer at the centroid**, Appx I/S).

### A7 — Slope/DEM ground sweep, airport, pipelines (DEM terrain + proximity)
*SIR p. 35 · Appendix B (Ground sweep) · Appendix P.* Spatial operation: **DEM terrain analysis, distance/containment screens.**

- **Slope from a DEM:** *"A 1 m LiDAR-grade DEM at the centroid (81 samples over a 120 m area) shows 9.31 m relief, mean slope 3.8%, max 6.5%, and 100% of area under 25% slope … there is no slope-driven constraint on buildable area or basin siting."*
- **Airport proximity:** *"Bowman Field (KLOU) is 3.32 miles away. A standard car-wash canopy under 35 feet does not trigger 14 CFR Part 77."*
- **Pipeline corridor sweep:** *"the only utility corridors to be LG&E underground electric easements confined to Lot 1, the Wawa parcel … plus a 10-foot utility easement and the 20-foot drainage easement shown on the 2024 plat,"* with *"no petroleum or gas transmission pipeline … on either subject pad."*

### A8 — On-pad transformer/equipment siting conflict (equipment vs. buildable area)
*SIR p. 74 · §8.9 Electrical · Appendix K.* Spatial operation: **equipment-siting conflict against an already-reduced footprint and no-build strips.**

> *"On-pad transformer siting also consumes buildable area on a pad already reduced by drainage and detention … reserve the transformer pad location in the layout."*

The report explicitly places equipment relative to the recorded strips and edges: *"the developer should site clear of the plat drainage and utility strips … Where does the on-pad transformer/meter and any standby generator sit relative to the 20' plat drainage easement, the 10' utility easement, and the south residential-buffer edge"* (Appx K). A gas-main need is framed by frontage location: *"a main extension along KY-864."*

### A9 — Special-district and overlay containment at the centroid (point-in-polygon / overlay null)
*SIR p. 21 · Appendix I/J/N/Q/T.* Spatial operation: **point-in-polygon district membership and overlay null-queries.**

Several findings are decided purely by testing the centroid against a district polygon:
- **Fire district (positive):** *"The subject lies inside the Fern Creek Fire Protection District (JCFD number F60) (LOJIC Suburban Fire Districts, point query at centroid)"* (Appx I) — the F60 authority in R6.
- **Urban Service District (negative):** *"together ~3.63 ac … outside the Urban Service District"* (Appx I).
- **Overlay nulls:** the Floyds Fork Special Zoning Overlay *"covers the eastern county … the subject is on the Bardstown/Fegenbush corridor and is confirmed outside it"*; *"No Development Review Overlay (DRO) or Waterfront Review Overlay (WRO) applies"* (Appx J/Q/T); *"No registered neighborhood-association polygon overlays the parcel (LOJIC … point query returned empty)"* (Appx I). Each "none applies" is the result of a spatial query, not an assumption.

### A10 — Competitor proximity & radial demand rings (radius/ring screen)
*SIR p. 52 · §9 Demand & Competition · Appendix G.* Spatial operation: **straight-line distance from centroid, radial-ring aggregation, visual occlusion.**

- **Competitor distances from the centroid:** *"Straight-line distances from the subject centroid (38.184861, -85.636991): ZIPS Car Wash, 4405 Bardstown Rd … ~0.13 mi … Fern Creek Auto Wash … ~3.2 mi … SpeedWash … ~5.8 mi; beyond the 5-mi ring."* ZIPS *"sits within ~700 ft on the same arterial."*
- **Radial demand rings (area-weighted):** *"True radial tract aggregation (area-weighted) … 1-mi 9,750 … 3-mi 103,757 … 5-mi 243,401,"* screened against a *"≥25,000–40,000 population within a 3-mi ring"* threshold.
- **Visual occlusion:** *"the pads front Fegenbush and the Wawa sits between the pads and the arterial, so a wash reads off Fegenbush Ln frontage more than off Bardstown pylon exposure."*

---

## 4. Findings deliberately excluded (not carried by geo-spatial reasoning)

- **Top Risk R1 — car-wash approval path unsettled (SIR p. 5; §8.1).** Turns entirely on *code text vs. local practice* (over-the-counter vs. hearing) and a lender-consent covenant. No spatial component; it rides *alongside* the polygon-containment point (R2) but is itself interpretive.
- **Top Opportunity O3 — Opportunity-Zone-2.0 finalist (SIR p. 8; §7).** The eligibility test *is* geospatial — *"the KY … designated-OZ layer returned no feature at the centroid … a … 'Jefferson County OZ 2026 Finalists' layer returns tract 115.08 … as a 2026 OZ finalist"* (Appx E/I), a point-in-polygon at the coordinate — but the finding's payload is **financing eligibility**, so it is listed here rather than as a spatial finding. (Same for the legacy Enterprise-Zone null-query.)
- **§8.8 Water & Wastewater, §8.10 Parks, §7 Incentives, Appendix E incentives** — primarily availability, fee-schedule, use-permission, and program-eligibility reasoning. Minor spatial threads exist and are captured above where load-bearing (Beargrass basin/tunnel buffer in A6; no-build sanitary strips in A5/A8; acreage-driven design flow *"3.63-ac assemblage yields 72.6 equivalent population = 7,260 gpd"* and gravity-fall-to-Fegenbush-main in Appx S), but the disciplines' headline findings are not carried by spatial logic.

---

## Provenance

- SIR PDF downloaded from Supabase Storage bucket `sir-artifacts`, path `sir/caac753c-128b-4311-8d10-2480be0268eb/v1/site-intelligence-report.pdf`, via the Noetic App project (`mgxqsrjutswbciyrltwd`), authenticated with the field-agent service-role key. Byte size 11,275,023 matches the `sir_artifact` row.
- Text extracted with `pdftotext -layout`. Quotes are verbatim from the report's Executive Summary (§1), Site/Regulatory Overview (§2–§7), Discipline Findings (§8.1–§8.10), and Research Appendices B–T.
- Spatial-operation labels are this analysis's; every quoted claim carries the report's own verification tag ([V] verified, [P] partial) where the report attached one.
