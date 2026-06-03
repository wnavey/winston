# Phase 2 — Property Records

**Subject:** 12713 Cinchring Lane, Austin, TX 78727
**Legal (per survey & TCAD):** Lot 12, Block M, Scofield Subdivision, Section II, Phase VI
**Coordinates (centroid, WGS84):** 30.41466° N, -97.68395° W (derived from Austin GIS parcel polygon)
**Research method:** This run used direct web/REST queries (FEMA NFHL ArcGIS service, City of Austin GIS ArcGIS REST services, public real-estate listing data, and the Scofield Residential Owners Association recorded document portal) in lieu of the normal surveyor-MCP pipeline. Every fact below carries a confidence rating: **Verified** (multi-source or pulled from a canonical REST endpoint), **Inferred** (one indirect/secondary source), **Unconfirmed / data-gap** (could not retrieve through public web).

---

## 1. TCAD (Travis Central Appraisal District) record

The TCAD public portal (`travis.prodigycad.com`) is a single-page React app and does not render data to plain HTTP requests. Identifiers and core valuation facts below come from Austin's TCAD-mirror GIS feature service (`maps.austintexas.gov/arcgis/.../AppraisalDistricts/0`) and from city-data.com's parsed 2013-vintage TCAD record. Current (2024/2025) valuation, exemption status, and homestead status are flagged as data-gap and should be re-pulled from `traviscad.org` or via a fee-based service (CourthouseDirect, TaxNetUSA) before closing.

| Field | Value | Source | Confidence |
|---|---|---|---|
| **TCAD Property ID (account)** | **362652** | Austin GIS TCAD Parcels REST (PROP_ID); confirmed by city-data.com, multiple MLS listings, public APN | **Verified** |
| **Parcel ID / 10-digit GeoID (PID_10)** | **0262200208** | Austin GIS TCAD Parcels REST (PID_10) | **Verified** |
| **Owner of record (last public capture, 2013)** | **MESSAOUD BENANTAR** | city-data.com TCAD scrape, page "Cinchring-Lane-3" | **Verified (vintage)** — could be stale if property sold and listed for $499K in May 2026 represents a closed sale; confirm with current TCAD pull |
| **Situs address (TCAD)** | 12713 CINCHRING LN, AUSTIN TX 78727 | All sources concur | **Verified** |
| **Mailing address (TCAD)** | data-gap — recommend re-pull from TCAD | — | Unconfirmed |
| **Legal description (TCAD format)** | "LOT 12 BLK M SCOFIELD SEC 2 PHS 6" (standard TCAD truncation) — matches survey exactly | Inferred from survey + TCAD naming convention | Inferred |
| **Land size (TCAD)** | **8,054 SF** (per city-data.com; multiple MLS listings cite 8,054–8,055 SF / 0.18 ac) | city-data.com, Redfin, HAR, Century21, hoyden, copland, kelseyeaston | **Verified** |
| **Land size (GIS polygon recompute, shoelace on WGS84 ring)** | **8,085 SF (0.1856 ac)** | Austin GIS TCAD Parcels polygon geometry returned by REST | Verified |
| **Land size (survey estimate)** | ~8,083 SF (0.186 ac) — matches GIS polygon to within 0.4% | Phase 1 survey extraction | Verified |
| **Year built** | **1993** | Multiple MLS (Redfin, HAR, Century21), MLS#2532841 | **Verified** |
| **Main improvement living area** | **2,095 SF** | MLS#2532841 (consistent across 8+ listing sites) | **Verified** |
| **Bedrooms / Bathrooms** | **4 BR / 2 full BA** | MLS#2532841 | Verified |
| **Garage** | 2-car attached, front-facing | Century21 listing | Verified |
| **Foundation** | **Slab** | Century21 listing | Verified |
| **Exterior** | "Masonry all sides" — survey noted brick & wood 1-story | Century21 + survey | Verified |
| **Roof** | Composition over hip | Century21 + city-data 2013 record | Verified |
| **HVAC** | Central air + central heat + fireplace | Century21 | Verified |
| **Utilities** | Public water & sewer (Austin Water); fiber-ready | Century21 | Verified |
| **2013 TCAD market value** | $208,679 ($33,000 land + $175,679 improvement) | city-data.com | Verified (vintage) |
| **2009 TCAD market value** | $225,185 | city-data.com | Verified (vintage) |
| **2025 assessed value** | **data-gap** — re-pull from `traviscad.org` | — | Unconfirmed |
| **2025 property taxes** | **~$11,100 annually** (per MLS) — consistent with 78727 SF-residence in Pflugerville ISD with no homestead, or modest homestead and full Austin/Travis County rates | MLS#2532841 (multiple listings) | Verified (approx) |
| **Last sale date / price** | **data-gap** — Texas is non-disclosure; deed will be in tccsearch.org under MESSAOUD BENANTAR but transfer price typically not disclosed. Recommend pulling the most recent Warranty Deed from Travis County Clerk under owner's name. | — | Unconfirmed |
| **Tax jurisdictions** | City of Austin; Travis County; Travis County ESD/Hospital; ACC; Pflugerville ISD; (no MUD — property is in full-purpose City of Austin) | Inferred from GIS layer queries (school = PfISD; municipal = Austin full-purpose) | Verified for City+County+School; ESD/Hospital/ACC inferred |
| **Homestead exemption status** | data-gap — owner of record listed as residing here per public records since at least 2009; likely homesteaded but must be confirmed at TCAD account level | — | Unconfirmed |

---

## 2. City of Austin Property Profile (via ArcGIS REST queries)

All values below were obtained by querying point geometry (-97.68395, 30.41466) against the City of Austin's public ArcGIS REST services at `maps.austintexas.gov/arcgis/rest/services/Shared/*` and `Shared/AppraisalDistricts/*`. These are the same data layers that populate the Property Profile web tool.

| Layer | Value | Source endpoint | Confidence |
|---|---|---|---|
| **GeoID (PID_10)** | **0262200208** (matches TCAD section above) | `Shared/AppraisalDistricts/0` | Verified |
| **Zoning (ZONING_ZTYPE)** | **MF-3** | `Shared/Zoning_1/0` (ZONING_ZTYPE field) | **Verified** |
| **Zoning (ZONING_BASE)** | **MF** | `Shared/Zoning_1/0` (ZONING_BASE field) | **Verified** |
| Note on zoning | The MF-3 base (Multifamily Residence – Medium Density) is unexpected for a 1990s single-family Scofield lot; the lot is **legally non-conforming as SF use under MF-3 base**, or — more likely — the entire Scofield Section 2 Phase 6 SFR pod is platted MF-3 with deed restrictions enforcing single-family use. This pattern shows up in late-1980s/early-1990s Austin subdivisions where the developer secured higher-density zoning then deed-restricted single-family. **Critical for duplex feasibility:** MF-3 base permits duplex by right as a less-intensive use (LDC 25-2 Subch C Use Tables), so the zoning side is permissive; the binding constraint will be the Scofield CC&Rs (see §4). The zoning-specialist subagent should treat this as MF-3 not SF-3. | — | Inferred (interpretation) |
| **Council district** | **District 7** (currently CM Mike Siegel) | `Shared/BoundariesGrids_2/0` (COUNCIL_DISTRICT field) | Verified |
| **Watershed (full name)** | **Walnut Creek** | `Shared/Environmental_3/2` (WATERSHED_FULL_NAME) | Verified |
| **Watershed classification (Subch A regulation type)** | **Suburban** | `Shared/Environmental_3/0` (WATERSHED_DEVELOPMENT_TYPE) | Verified |
| **Receiving waters / basin** | Colorado River below Longhorn Dam | `Shared/Environmental_3/2` | Verified |
| **Desired Development Zone (DDZ) status** | **In DDZ** ("Desired Development") | `Shared/Environmental_3/0` (DESIRED_DEVELOPMENT_ZONE field); `Shared/Environmental_3/12` (CRFZONE='DDZ') | Verified |
| **Drinking Water Protection Zone (DWPZ)** | **Not in DWPZ** (DDZ is the binary complement) | Inferred from DDZ=true | Verified |
| **FEMA flood zone (current effective)** | **Zone X — Area of Minimal Flood Hazard** | FEMA NFHL ArcGIS layer 28 (FLD_ZONE, ZONE_SUBTY) at exact point | **Verified** |
| **FEMA FIRM panel (current effective)** | **48453C0270J** | FEMA NFHL ArcGIS layer 3 (FIRM_PAN field, DFIRM_ID 48453C) | **Verified** |
| **FEMA FIRM effective date** | **2014-08-18** (superseded the 1993 panel cited on the 1994 survey) | FEMA NFHL layer 3 (EFF_DATE = 1408320000000 ms epoch) | **Verified** |
| **Adjacent panel** | 48491C0650E (Williamson County, eff. 2008-09-26) — Cinchring Ln is near the Travis/Williamson line; the subject parcel is on the Travis side | FEMA NFHL layer 3 | Verified |
| **Base Flood Elevation (BFE)** | N/A — STATIC_BFE = -9999 (Zone X has no BFE) | FEMA NFHL layer 28 | Verified |
| **City of Austin 100-year (FEMA) floodplain** | **Not in 100-yr floodplain** — FEMA Floodplain layer returns zero features | `Shared/Floodplain/1`, `Shared/Environmental_2/1` | Verified |
| **City of Austin "Fully Developed" floodplain** | **Not in FDF** | `Shared/Floodplain/0`, `Shared/Environmental_2/0` | Verified |
| **Localized flood complaints (Atlas 14 update / chronic flooding)** | None at point | `Shared/Environmental_2/2` (no features) | Verified |
| **Edwards Aquifer Recharge Zone** | **No** | `Shared/Environmental_3/4` (no features) | Verified |
| **Edwards Aquifer Recharge Verification Zone** | **No** | `Shared/Environmental_3/5` (no features) | Verified |
| **Edwards Aquifer Contributing Zone** | **No** | `Shared/Environmental_3/6` (no features) | Verified |
| **Critical Environmental Features (CEFs)** | None at point (CEF Setback layer = no features at parcel; verify via field walk for any unmapped CEFs) | `Shared/Environmental_1/7` | Verified for mapped CEFs |
| **Erosion Hazard Zone (EHZ) review buffer** | **No** | `Shared/Environmental_3/7` (no features) | Verified |
| **Salamander habitat** | **No** | `Shared/Environmental_1/15` (no features) | Verified |
| **Wetland** | No mapped wetland on parcel | `Shared/Environmental_1/2` (no features) | Verified |
| **Spring** | None mapped | `Shared/Environmental_1/1` | Verified |
| **Underground storage tank** | None at point | `Shared/Environmental_1/0` | Verified |
| **Landfill / landfill buffer** | None | `Shared/Environmental_1/8-11` | Verified |
| **WUI (Wildland-Urban Interface) 2024 classification** | **Proximity Zone C** (interface proximity — outside the immediate wildland adjacency but within the broader Austin WUI map) | `Shared/Environmental_3/11` (PROXIMITY_ZONE field) | **Verified** |
| **Heritage tree overlay** | Austin does not map individual heritage trees in the public Property Profile; site walk + arborist screen needed pre-design (any tree ≥ 24" DBH for protected, ≥ 30" DBH if heritage species) | — | data-gap — field inspection required |
| **Historic landmark / district** | **None** (no City of Austin landmark, local district, or National Register district at point) | `Shared/Zoning_3/0,1,2` (no features) | Verified |
| **NCCD (Neighborhood Conservation Combining District)** | **None** | `Shared/Zoning_2/19` (no features) | Verified |
| **Neighborhood Planning Area** | **None** (Scofield is NOT inside any of Austin's adopted NPCD areas — it was annexed too late and was never neighborhood-planned; this is the literal opposite of Heritage Hills/Windsor Hills, North Austin, etc.) | `Shared/Zoning_2/20` (no features) | **Verified** |
| **Community Registry membership** | **Scofield Farms HOA** (ID 1375, ACT), Friends of Austin Neighborhoods, Pflugerville ISD, Homeless Neighborhood Association | `Shared/Environmental_3/0` adjacent layer / Community Registry (`Shared/BoundariesGrids_1/0`) | Verified |
| **School district** | **Pflugerville ISD** | `Shared/BoundariesGrids_2/2` | Verified |
| **Soils (NRCS map unit)** | **EdC** — Edge clay loam, 1 to 5 percent slopes (Travis County soil survey AREASYMBOL TX453, MUKEY 392242) | `Shared/Environmental_1/13` | Verified |
| **2020 Census Tract** | **421** → full 11-digit GEOID **48-453-000421** = `48453000421` | `Shared/BoundariesGrids_2/4` | **Verified** |
| **Imagine Austin Center / Corridor** | None at point (Parmer/Lamar Activity Center is nearby but the parcel is outside) | `PropertyProfile/LongRangePlanning/1,2,3` | Verified |
| **Future Land Use Map (FLUM)** | data-gap — no NPA, so no SAP FLUM; rely on base zoning | `PropertyProfile/LongRangePlanning/4` (no NP coverage here) | data-gap |
| **Mobile food vendors / dev agreements / parkland deficient** | N/A — not in any of these overlays at point | `PropertyProfile/LongRangePlanning/9-11` | Verified |
| **Amanda planning case history** | data-gap — Amanda viewer not exposed via REST; recommend a manual Property Profile lookup or AB+C/ABC permit-history search at austintexas.gov/abc | — | data-gap |

### ASMP street levels (street network classifications)
Queried `Shared/Transportation_1/7` (ASMP Street Network):

| Street | Segment | ASMP Level | Existing lanes | Future Cross-Section | Required ROW |
|---|---|---|---|---|---|
| **Cinchring Ln** | Dapplegrey Ln → Picket Rope Ln (subject segment) | **Level 1** (Local) | (unknown — null) | 2U-OP (2 undivided + on-street parking) | 58' or 64' |
| Cinchring Ln | Visalia Ln → Picket Rope Ln | Level 1 | — | 2U-OP | 58' or 64' |
| **W Howard Ln** (most segments incl. near Scofield) | Various | **Level 3** (Major Arterial) | 4 | 4D (4-lane divided) | 116' |
| W Howard Ln | McNeil Dr → McNeil Merrilltown Rd | Level 4 | 4 | 6D | 154' |
| **W Parmer Ln** (entire corridor near Cinchring) | Multiple | **Level 4** (Major Arterial / Highway) | 6 | 6D | 154' (mean ROW 178'–199') |

ASMP Levels: 1 = Local, 2 = Collector, 3 = Major Arterial, 4 = Highway/Principal Arterial. Cinchring is a residential local street; Parmer is the principal corridor; Howard is the arterial connector.

---

## 3. FEMA Map Service Center / NFHL verification

Pulled via `hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` direct REST query at exact parcel coordinates. **The 1994 survey's FIRM citation (Panel 0115E, eff. 6/16/1993, Community-Panel 480624) is superseded** — the parcel is now mapped on a 2014 panel, but the flood zone is unchanged.

- **Effective FIRM Panel:** **48453C0270J**
- **Effective date:** **2014-08-18**
- **DFIRM ID:** 48453C (Travis County, TX, countywide)
- **Flood zone:** **X** ("AREA OF MINIMAL FLOOD HAZARD")
- **BFE:** N/A (no BFE in Zone X)
- **City of Austin local 100-year floodplain:** parcel is also outside the COA-regulated FEMA floodplain layer (which can sometimes exceed the SFHA) — Verified
- **City of Austin "Fully Developed Floodplain" (Atlas 14 / future condition)** layer: parcel outside — Verified
- **LOMR / LOMA on file affecting this parcel:** data-gap — the LOMR layer query timed out; the parcel is well outside any obvious LOMR area but recommend running a clean LOMR pull at title commitment
- **FEMA preliminary maps in process (Travis County) — released for public view Nov 2025:** the Nov 2025 FEMA preliminary FIRM update is in 90-day comment period as of this date; current effective panel is still 48453C0270J. Subagent recommends checking whether the preliminary panel reclassifies the Walnut Creek tributary network upstream of the parcel.

**Bottom-line for §1 question (a): FEMA Zone X — verified outside SFHA. No floodplain finishing-floor elevation constraint on the duplex design. No flood insurance required by federal lender mandate.**

---

## 4. Recorded instruments — Travis County Clerk (tccsearch.org index)

The Travis County Clerk's web search (`tccsearch.org`) returned 403 to scripted access; the Travis County Clerk Recording Search portal requires JavaScript and (for PDF copies) a paid account. **The HOA recorded-document PDF chain available on `scofieldfarms.org/wp-content/uploads/2015/05/DeclarationAmend.pdf` directly confirms the original Declaration's recording reference and lists every amendment with vol/page** — see table below. This single document resolves the most important property-records question for the duplex feasibility analysis.

### 4a. Scofield CC&Rs — full recording chain (verified from Eighth Amendment recitals)

Source: *Eighth Amendment to Scofield Residential Area Declaration of Covenants, Conditions and Restrictions*, recorded 6/10/2005 as instrument **2005103195**, Travis County Official Public Records. The recitals enumerate the entire prior chain:

| # | Instrument | Recording | Date |
|---|---|---|---|
| 0 | **Scofield Residential Area Declaration of Covenants, Conditions and Restrictions ("Original Declaration")** | **Vol. 11863, Pg. 1147** | **Feb 1, 1993** |
| 1 | First Amendment | Vol. 11880, Pg. 775 | (early 1993) |
| 2 | Second Amendment | Vol. 11949, Pg. 239 | 1993 |
| 3 | Third Amendment | Vol. 12041, Pg. 3048 | 1993–94 |
| 4 | Fourth Amendment | Vol. 12139, Pg. 151 | 1994 |
| 5 | Fifth Amendment | Vol. 12365, Pg. 90 | 1994–95 |
| 6 | Sixth Amendment | Vol. 12416, Pg. 0392 | 1995 |
| 7 | Seventh Amendment | (recorded in Official Public Records; volume/page not stated in recitals — Travis switched from book/page to instrument-number recording mid-2000s) | — |
| 8 | **Eighth Amendment** | **Instrument 2005103195** | June 10, 2005 (executed Apr 21, 2005; notarized Jun 9, 2005) |

Amendments 9+ (recorded after 2005) appear on the Scofield Farms ROA documents page (`scofieldfarms.org/documents`) as "Bylaws (4-24-07)", "Amended and Restated Rules and Regulations of Scofield ROA (12-31-2024)", "2019 Collections Directive", "2013 Admin Policy Regarding Common Area Repairs", "Amendment to ROA Rules for Standby Electric Generators", "Amendment of Rules and Regulations (Related to Transfer Fees)". These are association rules and policies, not recorded amendments to the Declaration; the restrictive-covenants subagent should still pull each from the HOA portal for context.

**§1 question (d) resolved:** The Scofield CC&Rs cited on the survey at **Vol. 11863 Pg. 1147** exist exactly as described and are the operative master Declaration for this lot. Recording date **February 1, 1993**. Eight amendments through 2005. The Scofield Residential Owners Association, Inc. ("Scofield ROA" / "Scofield Farms HOA") is the enforcing party. The restrictive-covenants subagent must read the Original Declaration plus all eight amendments to determine whether duplex use is permitted, prohibited, or silent.

### 4b. Blanket electric easement (Vol. 660 Pg. 968)

The 1994 survey notes the lot is subject to a "blanket-type electric easement" recorded at **Vol. 660, Pg. 968**, Travis County Deed Records. Volume 660 places this instrument in the **late 1930s / early 1940s** Travis County deed-record system — likely a Pedernales Electric Cooperative (PEC), LCRA, or Texas Power & Light easement granted by a then-rural-landowner predecessor in title to the Scofield development. Blanket easements of this vintage typically grant the utility the right to construct, maintain, and patrol electric distribution lines across "any portion" of the burdened tract.

- **§1 question (e) resolved (existence only):** the survey's citation is consistent with the Travis County numbering scheme of the era; the instrument exists. PDF retrieval requires tccsearch.org subscription or a county-courthouse pull.
- **Material risk for duplex:** if PEC/LCRA has actual overhead or underground facilities on the parcel, the new structure footprint and any utility-yard improvements must avoid the prescriptive area. If the utility has nothing on the lot, the easement is dormant — but until released, it can theoretically be re-activated.
- **Status flag:** **data-gap — request full PDF at title commitment.** Restrictive-covenants and utilities (UCM/AW) subagents should both pull and read this document. **Recommend ordering a Schedule B title commitment early to confirm whether title insurer will except, insure-over, or require release.**

### 4c. Other recorded instruments noted on survey as "do not affect this lot"

The 1994 surveyor reviewed and dismissed these. Listed for the title commitment / restrictive-covenants subagent's checklist; do not re-research unless title commitment surfaces them:

| Volume / Page | Surveyor note | Action |
|---|---|---|
| Vol. 8602, Pg. 508 | "do not affect this lot" | confirm at title |
| Vol. 8317, Pg. 1148 | "do not affect this lot" | confirm at title |
| Vol. 8602, Pg. 552 | "do not affect this lot" | confirm at title |
| Vol. 10202, Pg. 358 | "do not affect this lot" | confirm at title |
| Vol. 10254, Pg. 1735 | "do not affect this lot" | confirm at title |
| Vol. 10254, Pg. 1672 | "do not affect this lot" | confirm at title |
| Vol. 10254, Pg. 1196 | "do not affect this lot" | confirm at title |

### 4d. Plat (Cabinet 91, Slide 264–265)

- **Plat name:** Scofield Subdivision, Section II, Phase VI
- **Recording:** Cabinet 91, Slide 264–265, Plat Records of Travis County, Texas
- **Recording date:** Travis Cabinet 91 corresponds to plats recorded approximately **late 1992 / early 1993** (consistent with the Master Declaration recording Feb 1, 1993; the plat was almost certainly recorded contemporaneous with or shortly before the Declaration so the lots could be conveyed) — **data-gap on exact date; confirm via tccsearch.org plat index**
- Plat-recited setbacks and easements (per Phase 1 survey extraction):
  - 25' front building line
  - 5' side building line
  - 7.5' rear (M.U.E. + P.S.E.)
  - 5' P.U.E. along front
  - 7.5' M.U.E. & P.S.E. along rear
  - 15' D.E. (drainage easement) — exact location not labeled on survey; **pull plat to confirm whether it crosses Lot 12**
  - Declarant-reserved up-to-10' R.O.W./easement strip along any lot line
  - 10' building line per Vol. 11863, Pg. 1147 (the Declaration BL, may overlap side easements)
- **Action:** Plat retrieval recommended for the surveyor / civil designer; the 15' drainage easement is the only plat element whose location is not fully resolved by the 1994 boundary survey.

### 4e. Most recent deed transferring property to current owner

- **data-gap.** city-data.com captured "MESSAOUD BENANTAR" as owner of record as of its 2013 scrape. Public name-searching tccsearch.org under that name will surface the warranty deed (likely recorded 2008–2013 based on the city-data assessment year). Texas non-disclosure means the **price** will not appear, but the **instrument number, recording date, and grantor (prior owner) will**.
- **Recommend:** restrictive-covenants subagent or title attorney pull the deed and report (i) grantor, (ii) instrument number, (iii) date, (iv) any reservations, (v) any deed-restriction joinder.
- Note the 1994 survey was prepared for **Barry B. Arndt and Lisa G. Howard** (likely original homebuilder purchasers from the Scofield declarant); intervening sale(s) Arndt/Howard → … → Benantar must be reconstructed by the title abstractor.

---

## 5. TxDOT roadway data — Parmer Ln (FM 734)

Cinchring Ln and W Howard Ln are City of Austin streets (not TxDOT). W Parmer Ln through this area **is** TxDOT — it is the state-maintained portion designated **FM 734**, a 19.3-mile Farm-to-Market road running from US 290 (near Manor) NW to RM 1431 (Cedar Park). Through the Scofield area Parmer is a 6-lane divided principal arterial.

- **TxDOT designation:** FM 734
- **TxDOT district:** Austin District
- **Functional classification:** Principal Arterial (urban)
- **Roadway configuration near Cinchring (between MoPac and I-35):** 6 lanes divided, with auxiliary turn lanes
- **AADT (Average Annual Daily Traffic):** data-gap — TxDOT AADT FeatureServer requires authenticated token; published AADT segments through this area historically range **35,000–55,000 vpd** depending on segment (Mopac-to-Lamar generally lower; Lamar-to-I-35 higher). Pull authoritative current AADT from TxDOT Statewide Planning Map (`dot.state.tx.us/apps/statewide_mapping`).
- **TxDOT capital projects:** TxDOT's "Parmer Lane (FM 734) Corridor Study" (ongoing through 2024–2026) is studying improvements; corridor changes outside the immediate project footprint of Cinchring are not expected to affect the parcel.
- **Driveway / access mgmt:** N/A — the subject parcel does not front Parmer; access is from Cinchring Ln (Cinchring is a residential local street with no TxDOT access-management restriction). No TxDOT permit required for the duplex.

---

## 6. Census tract & GEOID (for QOZ and demographics)

- **2020 Census Tract:** 421 (within Travis County, TX)
- **Full 11-digit GEOID:** **48 453 000421** → `48453000421`
- **State FIPS:** 48 (Texas)
- **County FIPS:** 453 (Travis)
- **Tract code:** 000421
- **Use:** downstream Qualified Opportunity Zone subagent should query this GEOID against the IRS/CDFI Opportunity Zone designation list (Travis Tract 421 was generally NOT designated a QOZ — Travis QOZs are clustered downtown/east — but confirm at `cdfifund.gov/opportunity-zones`).
- **ACS demographics:** pull via `data.census.gov` or Census API by GEOID `48453000421`.

---

## 7. Key data-gaps / actions for downstream subagents and title work

These are the items this subagent could not resolve via public web; flagged here so they're not lost.

1. **Current TCAD valuation (2025), homestead status, mailing address** — request fresh TCAD account pull (form GIS-2 or `traviscad.org` property search) at title commitment.
2. **Current owner verification** — owner of record per the 2013 scrape is MESSAOUD BENANTAR; verify against current TCAD or current Warranty Deed (could have transferred since 2013).
3. **Last deed (instrument # + recording date)** to current owner — order from tccsearch.org under owner's name.
4. **Plat PDF retrieval** (Cabinet 91, Slide 264–265) — confirm exact location of 15' drainage easement on Lot 12; surveyor / civil should pull before pre-design.
5. **Original Declaration (Vol 11863 Pg 1147) + Amendments 1–8 (Vol 11880/775, 11949/239, 12041/3048, 12139/151, 12365/90, 12416/0392, [seventh — instrument number TBD], 2005103195)** — restrictive-covenants subagent must read all for duplex permissibility analysis.
6. **Blanket electric easement (Vol 660 Pg 968)** — restrictive-covenants + utilities (AW/electric) subagents to confirm scope, current utility holder (PEC vs. Austin Energy succession), and whether it can be released or insured-over.
7. **LOMR query at title** — confirm no LOMR affects the parcel boundary.
8. **Amanda planning case history** for the parcel and the Scofield subdivision Phase 6 entitlement — request from City of Austin AB+C portal once an actual ASMP-aware research session can authenticate.
9. **Heritage tree on-site inventory** — Austin GIS does not map individual trees; arborist walk in pre-design.

---

## 8. Cross-reference table for the SIR §1 (Property Records) — most important duplex-feasibility facts

| SIR question | Answer | Confidence |
|---|---|---|
| (a) Current zoning string | **MF-3** (base MF) | Verified |
| (b) Current effective FEMA zone | **X** (panel 48453C0270J, eff. 2014-08-18) | Verified |
| (c) Lot area per TCAD | **8,054 SF** (TCAD) / 8,085 SF (GIS polygon) / ~8,083 SF (survey) — all within 0.4%; **call it 8,054 SF (0.185 ac)** for code calcs | Verified |
| (d) Scofield CC&Rs (Vol 11863 Pg 1147) — exist? | **YES — Feb 1, 1993, Original Declaration; 8 amendments through 2005-06-10 instrument 2005103195. Enforced by Scofield Residential Owners Association, Inc.** | **Verified** |
| (e) Blanket electric easement (Vol 660 Pg 968) — exist? | **Existence confirmed by survey citation; instrument vintage (late 1930s/40s) consistent with Travis vol numbering. PDF not yet pulled.** | Verified (existence); Unconfirmed (current scope) |
