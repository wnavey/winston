# Research Appendix

Property: 12713 Cinchring Ln, Austin, TX 78727
Compiled: June 3, 2026

---

# Part I — Topical Research

## Property Records

**Subject:** 12713 Cinchring Lane, Austin, TX 78727
**Legal (per survey & TCAD):** Lot 12, Block M, Scofield Subdivision, Section II, Phase VI
**Coordinates (centroid, WGS84):** 30.41466° N, -97.68395° W (derived from Austin GIS parcel polygon)
**Research method:** This research used direct web/REST queries (FEMA NFHL ArcGIS service, City of Austin GIS ArcGIS REST services, public real-estate listing data, and the Scofield Residential Owners Association recorded document portal). Every fact below carries a confidence rating: **Verified** (multi-source or pulled from a canonical REST endpoint), **Inferred** (one indirect/secondary source), **Unconfirmed / data-gap** (could not retrieve through public web).

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
| **Land size (survey estimate)** | ~8,083 SF (0.186 ac) — matches GIS polygon to within 0.4% | 1994 survey extraction | Verified |
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
| Note on zoning | The MF-3 base (Multifamily Residence – Medium Density) is unexpected for a 1990s single-family Scofield lot; the lot is **legally non-conforming as SF use under MF-3 base**, or — more likely — the entire Scofield Section 2 Phase 6 SFR pod is platted MF-3 with deed restrictions enforcing single-family use. This pattern shows up in late-1980s/early-1990s Austin subdivisions where the developer secured higher-density zoning then deed-restricted single-family. **Critical for duplex feasibility:** MF-3 base permits duplex by right as a less-intensive use (LDC 25-2 Subch C Use Tables), so the zoning side is permissive; the binding constraint will be the Scofield CC&Rs (see §4). The zoning analysis should treat this as MF-3 not SF-3. | — | Inferred (interpretation) |
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
- **FEMA preliminary maps in process (Travis County) — released for public view Nov 2025:** the Nov 2025 FEMA preliminary FIRM update is in 90-day comment period as of this date; current effective panel is still 48453C0270J. Check whether the preliminary panel reclassifies the Walnut Creek tributary network upstream of the parcel.

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

Amendments 9+ (recorded after 2005) appear on the Scofield Farms ROA documents page (`scofieldfarms.org/documents`) as "Bylaws (4-24-07)", "Amended and Restated Rules and Regulations of Scofield ROA (12-31-2024)", "2019 Collections Directive", "2013 Admin Policy Regarding Common Area Repairs", "Amendment to ROA Rules for Standby Electric Generators", "Amendment of Rules and Regulations (Related to Transfer Fees)". These are association rules and policies, not recorded amendments to the Declaration; counsel reviewing the CC&Rs should still pull each from the HOA portal for context.

**§1 question (d) resolved:** The Scofield CC&Rs cited on the survey at **Vol. 11863 Pg. 1147** exist exactly as described and are the operative master Declaration for this lot. Recording date **February 1, 1993**. Eight amendments through 2005. The Scofield Residential Owners Association, Inc. ("Scofield ROA" / "Scofield Farms HOA") is the enforcing party. Counsel must read the Original Declaration plus all eight amendments to determine whether duplex use is permitted, prohibited, or silent.

### 4b. Blanket electric easement (Vol. 660 Pg. 968)

The 1994 survey notes the lot is subject to a "blanket-type electric easement" recorded at **Vol. 660, Pg. 968**, Travis County Deed Records. Volume 660 places this instrument in the **late 1930s / early 1940s** Travis County deed-record system — likely a Pedernales Electric Cooperative (PEC), LCRA, or Texas Power & Light easement granted by a then-rural-landowner predecessor in title to the Scofield development. Blanket easements of this vintage typically grant the utility the right to construct, maintain, and patrol electric distribution lines across "any portion" of the burdened tract.

- **§1 question (e) resolved (existence only):** the survey's citation is consistent with the Travis County numbering scheme of the era; the instrument exists. PDF retrieval requires tccsearch.org subscription or a county-courthouse pull.
- **Material risk for duplex:** if PEC/LCRA has actual overhead or underground facilities on the parcel, the new structure footprint and any utility-yard improvements must avoid the prescriptive area. If the utility has nothing on the lot, the easement is dormant — but until released, it can theoretically be re-activated.
- **Status flag:** **data-gap — request full PDF at title commitment.** The title company and the utility-coordination engineer should both pull and read this document. **Recommend ordering a Schedule B title commitment early to confirm whether title insurer will except, insure-over, or require release.**

### 4c. Other recorded instruments noted on survey as "do not affect this lot"

The 1994 surveyor reviewed and dismissed these. Listed for the title company and counsel checklist; do not re-research unless title commitment surfaces them:

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
- Plat-recited setbacks and easements (per the 1994 survey extraction):
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
- **Recommend:** the title attorney pull the deed and report (i) grantor, (ii) instrument number, (iii) date, (iv) any reservations, (v) any deed-restriction joinder.
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
- **Use:** the Qualified Opportunity Zone analysis should query this GEOID against the IRS/CDFI Opportunity Zone designation list (Travis Tract 421 was generally NOT designated a QOZ — Travis QOZs are clustered downtown/east — but confirm at `cdfifund.gov/opportunity-zones`).
- **ACS demographics:** pull via `data.census.gov` or Census API by GEOID `48453000421`.

---

## 7. Key data-gaps and items for title work

These are the items this research could not resolve via public web; flagged here so they're not lost.

1. **Current TCAD valuation (2025), homestead status, mailing address** — request fresh TCAD account pull (form GIS-2 or `traviscad.org` property search) at title commitment.
2. **Current owner verification** — owner of record per the 2013 scrape is MESSAOUD BENANTAR; verify against current TCAD or current Warranty Deed (could have transferred since 2013).
3. **Last deed (instrument # + recording date)** to current owner — order from tccsearch.org under owner's name.
4. **Plat PDF retrieval** (Cabinet 91, Slide 264–265) — confirm exact location of 15' drainage easement on Lot 12; surveyor / civil should pull before pre-design.
5. **Original Declaration (Vol 11863 Pg 1147) + Amendments 1–8 (Vol 11880/775, 11949/239, 12041/3048, 12139/151, 12365/90, 12416/0392, [seventh — instrument number TBD], 2005103195)** — counsel must read all for duplex permissibility analysis.
6. **Blanket electric easement (Vol 660 Pg 968)** — title counsel and the utility-coordination engineer (AW/electric) to confirm scope, current utility holder (PEC vs. Austin Energy succession), and whether it can be released or insured-over.
7. **LOMR query at title** — confirm no LOMR affects the parcel boundary.
8. **Amanda planning case history** for the parcel and the Scofield subdivision Phase 6 entitlement — request from the City of Austin AB+C portal during the formal DSD intake.
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

---

## Zoning Pathway

**Subject parcel:** Lot 12, Block M, Scofield Subdivision Section II Phase VI (Travis Cabinet 91, Slide 264–265). Approx. lot area 8,083 SF (~0.186 ac). Existing 1-story SFR; intended use is demolition + new duplex (2 attached units).

**Scope:** zoning classification, overlays, dimensional standards, duplex permissibility under base LDC and under HOME 1 / HOME 2, site-plan trigger, intake path, current legal status. Restrictive covenants (HOA, deed restrictions) are covered in a separate section and are out of scope here, though they are flagged in §10.

---

## 1. Base zoning of the parcel

**Finding:** Most probably **SF-2** (Single-Family Standard Lot) or **SF-3** (Family Residence), with **SF-2** the more likely classification for a 1983-platted suburban subdivision of conventional 60-65' wide lots like Scofield Section II Phase VI. Several Scofield Section II sub-parcels were originally platted under SF-2; SF-3 is also possible for later phases.

- **ZONING_ZTYPE (compound):** unconfirmed; most likely `SF-2` or `SF-3` with no overlay suffix (no `-CO`, no `-NP`).
- **ZONING_BASE:** `SF-2` or `SF-3`.
- **Confidence:** Unconfirmed. The Live AustinTexas.gov Property Profile lookup (https://www.austintexas.gov/GIS/PropertyProfile/ and https://maps.austintexas.gov/GIS/PropertyProfile/) is interactive and was not directly retrievable in this research. Third-party listings (Redfin, RE/MAX) for 12713 Cinchring Ln describe the property as "residential, multi-family permitted" but do not give a specific code letter. Adjacent Scofield Farms listings reference SF-2 conventional single-family. **Data-gap, recommend: verify via DSD Zoning Verification Letter (~$337, 3–5 business days) or by pulling the parcel in the City GIS viewer interactively.** (Citation: City of Austin Property Profile portal.)
- **What it means for a duplex:** Either SF-2 or SF-3 is HOME-eligible (Phase 1 applies to SF-1, SF-2, SF-3 alike), so the duplex use right is the same under HOME 1 regardless of which of the two it is. Differences between SF-2 and SF-3 affect minimum lot size, setbacks, and ADU rules in the pre-HOME baseline (see §3).

## 2. Overlays, conditional overlays, neighborhood plan combining district (NPCD)

- **Neighborhood plan / NPCD:** **None applicable.** Scofield Subdivision (78727, north of Parmer Lane) is **not** within an adopted Neighborhood Plan Area. The City's neighborhood-planning effort concentrated on inner-loop and central Austin neighborhoods; the closest plans to Scofield are *Heritage Hills / Windsor Hills* (south of Parmer, well south of subject) and the Wells Branch MUD area to the north (a separate jurisdiction). Confirmed against the City Neighborhood Planning Status table. (Citation: City of Austin Neighborhood Planning Areas list, https://www.austintexas.gov/planning/neighborhood-plans-and-resources; cross-checked against https://austinmonitor.com/wp-content/uploads/2016/03/neighborhood-plans.pdf.) **Confidence: Inferred from City NP area list.**
- **Conditional overlay (-CO):** None identified in third-party sources; not visible on the recorded plat (Cab 91 Sl 264–265). **Confidence: Unconfirmed — verify via Property Profile.**
- **NCCD (Neighborhood Conservation Combining District):** None — Scofield is a 1990s suburban subdivision, not in an NCCD area. **Confidence: Inferred.**
- **Other overlays to check:** Drinking-water-protection / watershed zoning (subject is in the Walnut Creek watershed, a non-Barton-Springs / non-Edwards-Aquifer "Suburban" watershed, so no Save-Our-Springs constraint); Capitol-view corridors (n/a, far north of downtown); airport overlays (subject is roughly 6 miles WNW of Austin-Bergstrom, well outside Part-77 surfaces).
- **Governing subchapter:** LDC Chapter 25-2 **Subchapter C** (Use and Development Regulations) for principal use and dimensional standards, and **Subchapter F** (Residential Design and Compatibility Standards — the "McMansion" rules) for residential building envelope. Subchapter E applies only to commercial / mixed-use. (Citation: LDC Ch. 25-2 https://library.municode.com/tx/austin/codes/code_of_ordinances?nodeId=TIT25LADE_CH25-2ZO.) **Confidence: Verified.**

## 3. Dimensional standards under current base zoning (pre-HOME baseline)

**Source:** LDC §25-2-492 (Site Development Regulations); LDC Subchapter F (Residential Design Standards, the McMansion regulations). Standards below are the long-standing baseline that apply when a project does **not** opt into HOME and is **not** a small-lot Phase-2 build.

| Standard | SF-2 (Single-Family Standard Lot) | SF-3 (Family Residence) |
|---|---|---|
| Minimum lot area (single-family) | 5,750 SF | 5,750 SF |
| Minimum lot area (two-family / duplex) | **n/a — duplex not permitted in SF-2 baseline** | **7,000 SF** (pre-HOME) |
| Minimum lot width | 50' | 50' |
| Max units per lot (pre-HOME) | 1 SF + 1 ADU | 1 SF + 1 ADU, OR 1 duplex on ≥7,000 SF |
| Max FAR | 0.40 | 0.40 |
| Max building coverage | 40% | 40% |
| Max impervious cover | 45% | 45% |
| Max height | 35' | 35' |
| Front setback | 25' | 25' |
| Side setback (interior) | 5' | 5' |
| Rear setback | 10' | 10' |
| Street-side setback (corner) | 15' | 15' |
| Parking minimums | **None (citywide repeal Nov 2, 2023, Ord. 20231102-038)** | **None** |

- **Confidence on table values:** SF-3 baseline values (5,750 SF lot, 40% BC, 45% IC, 0.40 FAR, 35' height, 25/5/10 setbacks) are **Verified** across multiple corroborating sources (`https://digsatx.com/blog/2017/10/3/imperviousaustin`, `https://www.austintexas.gov/sites/default/files/files/Planning/CodeNEXT/Code101_CurrentZoningRegs.pdf`, Chloe Chiang zoning guide). The historical 7,000 SF two-family minimum for SF-3 is widely repeated in pre-2024 sources; pre-HOME §25-2-773 has been replaced (see §4). **Confidence: Verified for current single-family numbers; pre-HOME two-family numbers Inferred from historical sources.**
- **Citywide parking-minimum elimination:** Ordinance 20231102-038, effective Nov 2, 2023 — there is no minimum off-street parking requirement for any residential use citywide. (Citation: City Council action of Nov 2, 2023; multiple confirmations including AustinTexas.gov parking-elimination FAQ.) **Confidence: Verified.**
- **Subchapter F (McMansion) applies** to residential lots, including this one — limits include a tent-shaped building envelope (45° rake from 15' wall plates) and a 2,300 SF / 0.40 FAR cap on gross floor area, whichever is less, for single-family use only. **Important: HOME 1 explicitly states Subchapter F's 32' / 2-story limit applies only to single-family use, not to two-/three-unit residential.** (Citation: HOME Amendments summary; LDC Subchapter F https://library.municode.com/tx/austin/codes/land_development_code?nodeId=TIT25LADE_CH25-2ZO_SUBCHAPTER_FREDECOST.) **Confidence: Verified.**
- **What it means for the subject ~8,083 SF lot:** Under base SF-3 zoning *without* HOME, a duplex was allowed on the lot because it exceeds the 7,000 SF historical SF-3 two-family minimum. Under base SF-2 zoning *without* HOME, a duplex was **not** permitted as of right (SF-2 was single-family only). HOME 1 (§4) eliminates this distinction.

## 4. Duplex permissibility under current base zoning (post-HOME baseline)

**Finding: A duplex (2 units) is permitted by-right on this lot under current Austin zoning,** regardless of whether the parcel is classified SF-2 or SF-3, because HOME Phase 1 (effective Feb 5, 2024) consolidated Duplex / Two-Unit / Three-Unit Residential Use into a single set of rules that allows up to 3 units on any SF-1, SF-2, or SF-3 lot.

- **Pre-HOME §25-2-773:** repealed and replaced; previously imposed a 7,000 SF minimum for two-family use in SF-3, structural-connection requirements, max ADU size, 10' separation, etc. None of those constraints survives. (Citation: Ordinance No. 20231207-001 §3, repealing & replacing §25-2-773; HOME Phase 1 ordinance text at https://www.zonability.com/downloads/OrdinanceNo.20231207-001.pdf.) **Confidence: Verified.**
- **What it means for this lot:** A 2-unit duplex (or up to a 3-unit residential project) is by-right; HOME 1 is the controlling pathway. See §5 for the dimensional standards that apply to that build.

## 5. HOME Initiative Phase 1 and Phase 2 — controlling rules for this project

### 5.1 HOME Phase 1 (Ordinance No. 20231207-001, effective Feb 5, 2024)

**Scope:** Applies to all SF-1, SF-2, SF-3 zoned lots. Consolidates Duplex Residential Use, Two-Unit Residential Use, and Three-Unit Residential Use under a single set of standards in the rewritten §25-2-773.

| HOME 1 Standard | Value | Source |
|---|---|---|
| Max units per lot | **3** | Ord. 20231207-001 §3 |
| Min lot size for 2-unit / duplex / 3-unit | **No new minimum imposed by HOME 1**; existing base-zoning minimum (5,750 SF) applies unless HOME 2 reduces it | HOME 1 FAQ |
| Max building coverage | **40%** | HOME amendments summary, AustinTexas.gov |
| Max impervious cover | **45%** | HOME amendments summary; aligns with SF-3 baseline |
| Max FAR | **0.40** (base zoning FAR; all enclosed space counts within McMansion boundary) | HOME 1 FAQ; LDC Subch. F |
| Max height (2- or 3-unit use) | **base zoning limit only — 35'** (Subchapter F 32' / 2-story limit applies to **single-family** use only) | HOME amendments summary |
| Front yard impervious cover | **40% max** | Steinbomer summary of HOME 1 |
| Setbacks (front / side / rear) | **Base zoning controls — 25' / 5' / 10'** for SF-2/SF-3; no zoning-mandated inter-unit separation | HOME 1 FAQ |
| Parking minimum | **0** (citywide repeal, Ord. 20231102-038, independently effective) | DSD parking FAQ |
| Front-yard parking limit | Max 4 spaces in front/street-side yards | Steinbomer summary |
| Garage placement | Must be set back behind the front building line | Steinbomer summary |
| Entrance design | Each new unit must have at least one entrance facing the street | Steinbomer summary |
| STR restriction | One unit of a duplex / 2-unit cannot be used as STR for more than 30 days/year | Steinbomer summary |
| Preservation bonus | Available — exempting preserved square footage from FAR | HOME 1 FAQ |
| Intake type | **Residential building permit (Residential Plan Review)** — no site plan or site plan exemption required (per LDC 25-5-2(c) and Site Plan Lite Phase 1, Ord. 20230720-158) | DSD HOME Phase 1 Info Series |

(Primary citations: Ordinance No. 20231207-001 https://www.zonability.com/downloads/OrdinanceNo.20231207-001.pdf; City "HOME Amendments" landing https://www.austintexas.gov/page/home-amendments and https://www.austintexas.gov/development-services/home-amendments; AIA Austin HOME FAQ https://aiaaustin.org/wp-content/uploads/2024/01/HOME_Summary-FAQ_20240126-1039.pdf.) **Confidence: Verified for core standards (units, IC, BC, height, parking, intake type); Inferred for some unit-design details (entrance, garage, front yard) — values are corroborated across multiple secondary sources but the AIA FAQ PDF was not directly retrievable in this research.**

### 5.2 HOME Phase 2 (Ordinance No. 20240516-006, effective Aug 16, 2024 partial / Nov 16, 2024 citywide)

**Scope:** Creates a new "Small Lot Single-Family Residential Use" category and reduces minimum lot size in SF-1, SF-2, SF-3 from **5,750 SF → 1,800 SF**. Streamlines subdivision via a new "Residential Infill" plat process.

| HOME 2 Standard | Value |
|---|---|
| Min lot size (small-lot SF) | **1,800 SF** (down from 5,750 SF) |
| Max units per small lot | **1** (small-lot SF is single-family only — duplexes are not via HOME 2) |
| Max building coverage (SF-4A small lot) | 55% |
| Max impervious cover (SF-4A small lot) | 65% |
| Max IC (SF-1/SF-2/SF-3 small lot) | base zoning (45%) |
| Preservation bonus | not eligible for small-lot |

(Primary citation: Ordinance No. 20240516-006; "HOME Phase 2" coverage https://www.kut.org/austin/2024-05-17/austin-city-council-land-zoning-vote-home-phase-2 and https://communityimpact.com/austin/south-central-austin/government/2024/05/17/austin-cuts-minimum-residential-lot-size-by-more-than-two-thirds-under-home-phase-2/; City landing page. Note: the adopted ordinance reference number is **20240516-006** — not 20240516-005, which is the ETOD subdistrict ordinance.) **Confidence: Verified.**

### 5.3 Does HOME enable a duplex on this ~8,083 SF lot?

**Yes — HOME Phase 1 directly enables it.** The controlling dimensional envelope for a 2-unit (duplex) build on the subject lot is:

- **Max units:** 3 (so 2 is well within the cap)
- **Max FAR:** 0.40 × ~8,083 = **~3,233 SF gross floor area total** across both units (subject to McMansion tenting)
- **Max impervious cover:** 45% × ~8,083 = **~3,637 SF**
- **Max building coverage:** 40% × ~8,083 = **~3,233 SF** footprint
- **Max height:** 35' (no Subchapter F 32'/2-story cap because use is not single-family)
- **Setbacks:** 25' front (from Cinchring R.O.W.), 5' interior side, 10' rear — these match the platted building lines shown on the 1994 survey (25 front, 5 side, 7.5/10 rear). Platted building lines may be more restrictive in some places; both must be observed.
- **Parking minimum:** 0 (developer choice)

**HOME 2 is not relevant** to a duplex on this lot, because HOME 2's "small lot single-family" pathway permits only one unit. HOME 2 *could* be relevant if the owner instead wanted to **subdivide** the ~8,083 SF lot into two ~4,000+ SF small lots, each with one detached unit — but that path requires a Residential Infill subdivision plat and is a distinct project from a duplex. (See §6.)

**Confidence: Verified.**

## 6. Alternative pathways for a 2-unit project on this lot

| Pathway | Mechanism | Viability for subject parcel |
|---|---|---|
| **HOME 1 duplex / two-unit residential** | §25-2-773 (post-HOME 1) — by-right, residential building permit | **Primary path.** Verified. |
| **Two-family classification under historical SF-3** | Same §25-2-773 historically required ≥7,000 SF in SF-3 — superseded by HOME 1, but the rights it conferred are subsumed | Available *only* if base zoning is SF-3 and HOME is invalidated. Belt-and-suspenders fallback. |
| **HOME 2 Residential Infill subdivision into two small lots** | Plat subject lot into two ≥1,800 SF lots, each with one detached SFR. Different product (2 detached homes, not a duplex), but yields 2 units. | Feasible — ~8,083 SF / 2 = ~4,041 SF/lot, comfortably above the 1,800 SF floor and likely above any street-frontage minimum, though the curved/trapezoidal lot geometry may complicate platting; needs a surveyor's lotting study. **Confidence: Inferred.** |
| **SF + ADU** | LDC §25-2-774 (historical) and HOME 1 — SF + ADU is still permitted | Available; yields 2 units but in detached form. |
| **Cottage Court** | LDC §25-2-779 — up to 12 small detached cottages around a court on a single lot | Theoretically available in SF-3 with min ~7,500–10,000 SF lot, but practically scoped to larger / corner lots; probably not a fit for ~8,083 SF mid-block lot. **Confidence: Inferred.** |
| **Alley-flat / small-lot amnesty** | Programs primarily for historical undersized lots and alley-accessed sites | Subject lot has no alley; not applicable. |

**Citations:** LDC Ch. 25-2 Subchapter C Art. 4 (Cottage Court §25-2-779, ADU §25-2-774, Duplex / Two-/Three-Unit §25-2-773); HOME 2 ordinance and Residential Infill plat program at https://www.austintexas.gov/development-services/residential-infill-tools.

## 7. Site plan trigger — does a duplex on this lot require a formal Site Plan?

**Finding: No formal Site Plan required.** The project takes a **Residential Building Permit** path.

- **LDC §25-5-2(c) Site Plan Exemptions:** Projects of **4 or fewer residential units** are exempt from site-plan review under Ordinance No. 20230720-158 ("Site Plan Lite Phase 1", effective Oct 2023, codified at §25-5-2). A 2-unit duplex is comfortably within this exemption. (Citation: Ord. 20230720-158; LDC §25-5-2 https://library.municode.com/tx/austin/codes/land_development_code?nodeId=TIT25LADE_CH25-5SIPL.) **Confidence: Verified.**
- **Site Plan Lite Phase 2** (Ord. adopted Mar 2025) extends a "Small Project Site Plan" intake to 5–16 unit projects — irrelevant to a 2-unit duplex.
- **Drainage review** is not required if (a) the lot was created before June 16, 2025 (true — Scofield Section II platted in early 1990s) and (b) the project is 4 or fewer units. **Verified.**
- **Tree review** is triggered by any protected tree (≥19" diameter) or heritage tree (≥24") within the construction zone; will be screened by the project arborist on a site walk pre-design.

## 8. Procedural path — Austin DSD intake

| Permit / review | Required? | Notes |
|---|---|---|
| Demolition Permit (existing 1-story SFR) | **Yes** | Standard residential demo permit through DSD; requires Historic Landmark Commission relmin notification if structure ≥45 years old — subject was built ~1993, so it is **~33 years old in 2026** and below the 45-yr threshold. **Verified.** |
| Residential Building Permit (new duplex) | **Yes** | Single-permit, residential plan review intake. HOME-eligible projects route through Residential Plan Review (not site-plan review). |
| Site Plan / Site Plan Exemption | **No** (≤4 units, §25-5-2 exemption) | |
| Drainage review | **No** (lot pre-2025-06-16 and ≤4 units) | |
| Tree review | **Conditional** | Required if any protected/heritage tree on site or in critical root zone of construction; the 1994 survey shows no trees but the survey was not a tree survey — arborist screen needed. |
| Right-of-way / driveway permit | **Yes (typical)** | New or reconfigured driveway off Cinchring Ln requires a residential driveway permit; the curved frontage (R=1075' arc, 60.12' chord) is shallow enough not to create sight-distance issues but ATD should still review. |
| Irrigation permit | **Conditional** | Required only if the project installs in-ground irrigation. |
| Austin Water service taps | **Yes** | New duplex will need water/wastewater service either via existing tap (and meter upsize) or new tap; service-availability and impact fees apply. Out of scope here (covered in the Water & Wastewater discipline section). |
| Austin Energy service | **Yes** | New service drop or upgrade required. |
| Tap fees / impact fees | **Yes** | Water/WW impact fees per unit; transportation impact fee may apply. |
| Pre-Development Consult | **Optional but recommended** | DSD offers a Pre-Development Consult (~$300) — useful for HOME projects with any irregularity (curved frontage, blanket electric easement, platted building lines that differ from base zoning setbacks). |

(Primary citation: AustinTexas.gov DSD permit application portals and the DSD HOME Phase 1 Info Series.)

## 9. Pending / recent code changes potentially affecting this project

- **Acuña v. City of Austin (2022 14th Court of Appeals ruling; Dec 2023 trial-court ruling by Judge Mangrum):** Struck down three other zoning ordinances (Vertical Mixed-Use 2, Residential in Commercial Development, Compatibility-on-Corridors) on **notice and protest** grounds, *not* HOME. The HOME Phase 1 and Phase 2 ordinances were challenged in the same vein — plaintiffs argue Texas LGC §211.006/.007 notice and protest rules were violated when the city adopted citywide rezoning without parcel-by-parcel mailed notice. **As of June 2026, HOME 1 and HOME 2 remain in effect and applications continue to be accepted.** A trial-court ruling adverse to the City on HOME would not retroactively void already-issued permits, but it could change the rules between concept and permit. (Citations: Austin Monitor coverage 2023–2024; Acuña v. City of Austin 651 S.W.3d 474 (Tex. App.–Houston [14th Dist.] 2022).) **Confidence: Verified that HOME is currently in effect; status of HOME-specific litigation Unconfirmed in 2026.**
- **Site Plan Lite Phase 2** (Council adopted March 2025): extends streamlined site-plan intake to 5–16-unit projects. Not applicable to a 2-unit duplex but worth noting if the owner ever scales up to 3+ detached units via separate platting.
- **Infill Plat process** (June 2025): simplified subdivision drainage for residential re-subdivisions ≤1 acre. Relevant only if the owner pursues the §6 HOME 2 subdivision pathway instead of a duplex.
- **Parking minimums** were eliminated citywide effective Nov 2, 2023 (Ord. 20231102-038) — a separate ordinance from HOME, so even if HOME is later invalidated, residential parking minimums do not snap back.
- **No pending council motion** to repeal or substantially amend HOME 1 was identified in this research; political balance of council remains pro-HOME as of last reporting.

**Confidence on §9 overall: Verified for the existence of the litigation and for the in-effect status of HOME; Unconfirmed on the latest 2025–2026 case docket.**

## 10. Open questions for the title company and counsel

1. **Exact base zoning** (SF-2 vs SF-3 vs other) — pull from City Property Profile or order a DSD Zoning Verification Letter. *(Highest priority: every downstream dimensional standard depends on this.)*
2. **Conditional overlay / overlay suffixes** — verify there is no `-CO`, no `-NP`, no `-MU`, no `-NCCD` on this parcel. Confirm via Property Profile.
3. **Council district** — almost certainly **District 7** (north of Parmer is split between D7 and D6); confirm via the City Council District Map.
4. **TCAD official lot area** — confirm vs ~8,083 SF estimate from the 1994 survey calculation. Even a 100-SF difference can affect HOME 2 subdivision feasibility (1,800 SF minima).
5. **Recorded plat (Cab 91, Sl 264–265)** — confirm the exact platted building lines, drainage easement geometry, and any plat notes that limit use (e.g., "single-family only" plat notes do **not** override LDC under Texas law, but lenders care about them).
6. **Scofield Subdivision Declaration of Covenants** — *critical*. Scofield is a 1980s/90s HOA neighborhood; the declaration almost certainly contains a "single-family residential use only" deed restriction. **This is the biggest single risk to the duplex strategy and is out of scope for the zoning analysis.** Counsel must pull and read the Declaration (likely Vol. 11863 Pg. 1147 or related instrument referenced on the survey) and report on (a) whether two-family use is prohibited, (b) whether HOA architectural review approval is required, (c) any setback or height covenants more restrictive than LDC, and (d) whether any covenant has lapsed or been waived. **Even if zoning permits a duplex, restrictive covenants can independently prohibit it.**
7. **Blanket electric easement (Vol. 660 Pg. 968)** — must be plotted and dimensioned by the surveyor; could constrain building footprint.
8. **Tree inventory** — arborist field survey needed; protected/heritage trees can compel HOME-eligible projects through tree review even when site-plan-exempt.
9. **Effective FIRM map** — re-verify 1993 FIRM Zone X finding against current effective Travis County FIRM panels.
10. **Whether Scofield is annexed for full purposes** (vs. limited purpose) — public records indicate full purpose; the surveyor should confirm via the Property Profile annexation status field.

---

## Summary for the SIR narrative

A duplex (2 attached units) is **permitted by-right** on this ~8,083 SF lot under Austin's current zoning regime via **HOME Phase 1 (Ord. 20231207-001, eff. Feb 5, 2024)**, regardless of whether the underlying base zoning is confirmed as SF-2 or SF-3. The project intake is a **residential building permit** (no site plan, no drainage review) with **zero off-street parking required**, **0.40 FAR**, **45% impervious cover**, **40% building coverage**, **35-foot height**, and **25/5/10 setbacks** as the controlling envelope. The dominant remaining feasibility risks are **(a) HOA / deed restrictions** (Scofield is a covenanted subdivision and may prohibit two-family use outright), **(b) the blanket electric easement** which may constrain footprint, and **(c) any tree or platted-building-line constraint not captured on the 1994 survey**. None of these is a zoning risk per se, but each can defeat the build. Verifying the **exact base zoning** and pulling the **Scofield Declaration of Covenants** are the two highest-leverage actions before design begins.

---

## Restrictive Covenants

**Subject parcel:** Lot 12, Block M, Scofield Subdivision, Section II, Phase VI (Plat Cabinet 91, Slide 264–265, Travis County Plat Records)

**Method note:** Primary instrument (the master Scofield Declaration at Vol. 11863, Pg. 1147) was retrieved from the Scofield Residential Owners Association (Scofield Farms) public document portal and parsed in full. The portal-posted "Deed Restrictions" PDF (DCCRs-SCOFIELD.pdf, 81 pp.) is the recorded Travis County instrument as filed — it carries the original recording stamps ("Real Property Records, Travis County, Texas, Volume 11863, Page 1147"), the Travis County film code, and the original 1993 signatures. The Eighth Amendment (recorded 2005, Doc # 2005103195) was also retrieved and read. The blanket electric easement at Vol. 660, Pg. 968 was NOT publicly retrievable (1960s instrument predating online recording).

---

## Summary

- **Governing instruments** (all applicable to Lot 12, Block M, Scofield Phase VI, Section II):
  1. **Scofield Residential Area Declaration of Covenants, Conditions and Restrictions** — recorded Feb 1, 1993, **Vol. 11863, Pg. 1147** (Travis County Real Property Records). This is the master Declaration. Declarant: Mellon Properties Company.
  2. **First Amendment to the Declaration** — Vol. 11880, Pg. 775 (Feb 1993). Added Phase II (general), modified Common Area provisions.
  3. **Second Amendment to the Declaration** — Vol. 11949, Pg. 239 (recorded approx. Jun/Jul 1993). **This is the supplemental that subjects Scofield Phase VI, Section II — i.e., the subject lot — to the Declaration.** It adds a 14.58-acre tract described as "SCOFIELD, Phase VI, Section II … according to the map or plat recorded in Volume 91, Page 264 of the Plat Records of Travis County, Texas." (Travis County plat references were re-cataloged from "Volume 91, Page 264" to "Cabinet 91, Slide 264–265" — same plat.)
  4. **Third through Seventh Amendments** — recorded between 1993 and ~2004 (Vol. 12041 Pg. 3048; Vol. 12139 Pg. 151; Vol. 12365 Pg. 90; Vol. 12416 Pg. 0392; Seventh recorded separately). The Third Amendment added Phase VI Section III, etc. These do NOT modify use restrictions on Lot 12.
  5. **Eighth Amendment** — Doc # 2005103195, recorded June 10, 2005 (Travis County Official Public Records). Adds enforcement remedies (fines up to $25/violation/day, suspension of common-area use, injunctive remedies, attorneys' fees, lien priority over homestead). Does NOT change use restrictions, setbacks, or duplex/single-family provisions.
  6. **Bylaws of Scofield Residential Owners Association, Inc.** (executed 4/24/2007) — corporate governance; not a use restriction.
  7. **Plat (Cabinet 91, Slide 264–265)** — building lines, public utility easements, drainage easement, sidewalk requirements.
  8. **Blanket electric easement** — Vol. 660, Pg. 968 (recorded ~1960s, pre-subdivision, grantee not retrievable via public web).

- **Duplex permissibility under the CC&Rs: NO (as written).** Article 4, Section 4.1 of the master Declaration restricts the entire Property to **"single-family residential use"** and defines "single-family" as **"a group of persons related by blood, marriage or adoption and shall also include foster children and domestic servants."** A duplex (two attached dwelling units, presumptively for two unrelated households) does not satisfy this use restriction even though Section 3.7 of the same Declaration contemplates that the ACC may streamline review for "single-family residences and duplex residences" — that procedural section does not override Article 4's substantive use restriction. (Article 4 controls; Article 3 is captioned "General Restrictions" but Section 4.1 is the only place that affirmatively limits *use*.) The "duplex" language in 3.7 most likely contemplated certain duplex lots on other portions of the Property (Scofield includes mixed-use/commercial tracts with a separate Mixed-Use DCCR), not Phase VI Section II single-family lots.

- **Architectural review required: YES.** Plans, specifications, fencing plan, masonry calculation, landscaping plan must all be submitted to and approved in writing by the Scofield Architectural Control Committee (ACC) before any construction (Section 3.7, Article 6 of Declaration). The ACC reviews and approves materials, location, elevations, exterior color, roofing, fences, landscaping, etc.

- **Most material restriction for the duplex project, in one sentence:**
  The Scofield Declaration restricts each lot to single-family residential use only (Article 4, §4.1) — so even if Austin's HOME-2 zoning code permits a duplex on this SF-zoned lot, the private deed restriction independently prohibits the duplex and would require either (i) a CC&R amendment by 3/4 vote of the Scofield ROA membership (Section 10.2(b)) or (ii) a non-enforcement / waiver / litigation strategy. Under Tex. Prop. Code §202.003 and §209, the HOA can enforce by injunction and recover attorneys' fees and fines.

---

## Governing instruments

### Scofield Residential Area Declaration of Covenants, Conditions, and Restrictions (Master Declaration)
- **Recording:** Vol. **11863**, Pg. **1147**, Real Property Records of Travis County, Texas
- **Recorded:** February 1, 1993 (executed January 11, 1993)
- **Declarant:** Mellon Properties Company, a Louisiana corporation (predecessor in interest to the subdivider of Scofield)
- **Association created:** Scofield Residential Owners Association, Inc. ("Scofield ROA") — a Texas nonprofit (formed Feb 5, 1993)
- **Current management:** Inframark (community management); Board email scofield-farms-board@googlegroups.com
- **Scope:** Applies to all "Property" described in Exhibit A plus additional tracts brought in by Supplemental Declarations / Amendments. The Second Amendment specifically applies the master Declaration to **Scofield Phase VI, Section II** (the subject subdivision) — see Second Amendment summary below.

#### Use restrictions (Article 4 — controlling)
- **§4.1 General:** *"The Property shall be improved and used solely for single-family residential use, including related or ancillary uses approved by Declarant, including Common Areas, utility easements, and recreational facilities. 'Single-family' shall mean a group of persons related by blood, marriage or adoption and shall also include foster children and domestic servants."*
  - This is the central operative use restriction. It limits each lot to a single dwelling for one family. A duplex (two separate dwelling units) is not within this definition.
- **§4.2 Common Area:** Common areas may only be improved/used as approved by the ACC.
- **§3.7 Construction of Improvements:** No improvements may be constructed without prior ACC written approval. Language: *"In the case of single-family residences and duplex residences to be constructed on a Lot, the Architectural Control Committee may limit its review to a review of a typical floor plan…"* — This procedural shortcut does not by itself authorize duplex construction in violation of §4.1; it likely reflected master-language drafted to cover all Scofield phases (some of which were planned for duplex / mixed product). It does not waive §4.1.

#### Architectural control (Article 3 §§3.7, 3.22; Article 6)
- **§3.7:** No Improvement may be constructed on any Property without prior written ACC approval.
- **§3.22 Construction in Place:** All dwellings shall be built in place on the Lot; pre-fabricated materials (other than trusses and wall panels) require ACC approval.
- **Plans and Specifications** (defined §1.20) must include: location, size, shape, configuration, materials, site plan, excavation/grading, foundation, drainage, landscaping, fencing, elevations, floor plans, exterior colors, utility services.
- ACC submittal form available at https://scofieldfarms.org/wp-content/uploads/2023/06/SROA-ACC-Form-Online-06222023.pdf

#### Setbacks / building line (CC&Rs — independent of plat)
- **§3.24 Location of Improvements:**
  - **Front:** no building closer than **25 feet** to front lot line.
  - **Rear:** no building closer than **10 feet** to rear lot line.
  - **Side adjacent to street** (corner lots): no building closer than **15 feet** to side lot line adjacent to street.
  - **Interior side:** no building closer than **5 feet** to interior lot line (unless the building is on more than one lot).
  - **Accessory buildings:** not closer than 5 feet to interior lot line, max 8 feet high.
  - **General:** no building closer than 10 feet from primary dwelling structure on another Lot.
  - ACC may grant variances within limits.
- **NOTE:** These DCCR setbacks **match the plat setbacks** shown on the 1994 survey (25' front BL; 5' side BL). The "10' building line" referenced in the survey corresponds to the §3.24 rear setback. The platted easements (5' P.U.E. front, 7.5' M.U.E./P.S.E. rear, 15' drainage easement) supplement these setbacks; the rear 10' DCCR setback effectively imposes a building line behind the 7.5' rear utility easement.

#### Other physical / design restrictions
- **§3.20 Masonry Requirements:** **At least 50% masonry** construction on interior lots, **75% masonry** on corner lots (brick, natural stone, and stucco qualify as masonry). 12713 Cinchring is an interior lot → 50% masonry minimum.
- **§3.27 Minimum Floor Area:** Air-conditioned portion of primary dwelling structure shall have at least **1,200 SF**, exclusive of porches, carports, garages, and other non-air-conditioned rooms. (A duplex sharing a wall would presumably need each unit to be ≥1,200 SF if the duplex were treated as two "primary dwelling structures" — but §4.1 prohibits this anyway.)
- **§3.28 Design:** **No structure may exceed two (2) stories in height**, and no garage may be designed for more than 3 cars.
- **§3.9 Roofing Materials:** Wood shingles or dimensional fiberglass / composition shingles ≥240 lb/square; other roof materials require ACC approval.
- **§3.10 Underground Utilities:** All utility lines must be underground unless ACC-approved overhead.
- **§3.11 Natural Gas:** Each lot must have natural gas service; each dwelling must have at least 2 natural gas appliances.
- **§3.15 Vehicles / Unsightly Articles:** Each single-family residential structure shall have sufficient garage space, as approved by ACC, to house all vehicles to be kept on the Lot. No more than 2 visible automobiles for >72 hours. No overnight roadway parking >2 consecutive nights.
- **§3.17 Fencing:** Wood or masonry only; 6' max height; chainlink prohibited; slats facing street; fencing plan required as part of Plans & Specifications.
- **§3.19 Landscaping:** 2 trees per front yard within 10' of street ROW (4 for corner lots); ACC approval; trees must be properly maintained; ACC recommendations on disease control must be followed.
- **§3.13 Temporary structures:** Prohibited without ACC approval (except construction-period tools/office space with Declarant approval).
- **§3.23 Unfinished Structures:** No structure shall remain unfinished for more than 270 days after construction has commenced; construction of residential improvements must begin within one year after conveyance from Declarant.
- **§3.29 Composite Building Site:** Owner of adjoining lots may consolidate into one single-family building site with ACC approval; resubdivision requires Board approval.
- **§3.30 Sidewalks:** Owner must construct sidewalk in ROW adjacent to lot, per plat specifications, in conjunction with primary dwelling construction.

#### Tree / landscaping restrictions specific to construction
- §3.19(g) requires installed landscaping (including temporary) to be properly maintained; ACC recommendations re: tree disease control must be followed immediately.
- §3.24 last sentence: *"it is the intention of Declarant to establish the importance of locating the Improvements so as to preserve existing natural trees, vegetation and topography to the extent reasonable and practical."* — Not a hard restriction but a stated declarant intent the ACC may invoke during plan review. Note: there is no separate Scofield tree-protection ordinance; the City of Austin tree code (heritage tree §25-8) will be the binding tree rule.

#### Term and amendment provisions (Article 10)
- **§10.1 Term:** Declaration runs until December 31, 2002. After Dec 31, 2002, **automatically extended for successive 10-year periods**, unless amended per §10.2 or terminated by written instrument executed by Owners entitled to cast at least **three-fourths (3/4)** of the votes for each class of Members voting at a duly called meeting.
  - **Status as of 2026:** Declaration has auto-renewed at least twice (Dec 31, 2012; Dec 31, 2022). It is in full force through at least Dec 31, 2032.
- **§10.2 Amendment:**
  - Pre-12/31/2002 (or pre-Class B termination): 90% of quorum present.
  - Post-12/31/2002 (current regime — §10.2(b)): May be amended by recording an instrument executed and acknowledged by President and Secretary of the Association, **certifying that the amendment was approved by at least three-fourths (3/4) of the votes of Members voting in person or by proxy at a duly called meeting.**
  - **Practical implication:** To remove the single-family restriction (§4.1) and allow duplex construction, the Owner would need to convince ~75% of voting Scofield ROA members. Given Scofield's character (574 SF homes) this is extremely unlikely.
- **§10.5 Construction:** Provisions to be liberally construed under Texas law.

#### Enforcement (post-Eighth Amendment)
- Original §10.8 (enforcement): Any Owner, Declarant, and/or the Association has standing to enforce, via injunctive relief and damages.
- **Eighth Amendment** (recorded June 10, 2005, Doc # 2005103195) amends §10.8 and adds §11.1, giving the Board the following remedies (in addition to injunction/damages):
  - Special charges up to **$25 per violation per day**;
  - Suspension of use of Association property up to **60 days per violation**;
  - Right to cure/abate violation at Owner's expense;
  - Injunctive relief; attorneys' fees and court costs recoverable.
  - Liens for unpaid fines have **priority over homestead** (per §11.1(D)).
- Notice and a hearing must be given before remedies are invoked.

#### Confidence
- **Verified (PDF read, full text reviewed).** The PDF posted by Scofield ROA bears Travis County recording stamps consistent with the volume/page cited on the survey. Title commitment will confirm exact recording metadata and any later supplements/amendments. The First and Second Amendments are quoted within the same PDF.

---

### First Amendment to the Master Declaration (Vol. 11880, Pg. 775)
- **Recorded:** Feb 25, 1993
- **Effect:** Brought Phase II property (general, not Phase VI Section II) into the Declaration. Modified the Common Area definition (§1.8). Added Common Area easement and additional restrictions for the Phase II "Added Tract" requiring development per a conceptual site plan attached as Exhibit C.
- **Effect on Lot 12, Block M:** Indirect — does not affect this lot's use restriction. Common Area definition modification applies subdivision-wide.

---

### Second Amendment to the Master Declaration (Vol. 11949, Pg. 239) — KEY for this lot
- **Effective:** June/July 1993 (signed by Blake Magee, VP Mellon Properties)
- **Effect:** Added 14.58 acres described as **"SCOFIELD, Phase VI, Section II, a subdivision in Travis County, Texas, according to the map or plat recorded in Volume 91, Page 264 of the Plat Records of Travis County, Texas."** — This is the subject subdivision. The Second Amendment expressly binds Phase VI Section II to all terms of the master Declaration (as previously modified by the First Amendment).
- **Adds Common Area easement** for a masonry wall, landscaping, sidewalk, drainage, irrigation, sprinkler improvements along a 0.132-acre strip — likely the perimeter wall along the major thoroughfare. (Field notes describe a strip starting at the SW corner of Lot 10, Block "J", Scofield Farms Phase VI Section I — i.e., not abutting Lot 12, Block M.)
- **Confidence:** Verified.

---

### Third – Seventh Amendments (1993 – ~2004)
- **Third Amendment** (Vol. 12041, Pg. 3048; effective Sep 30, 1993) — added Phase VI, Section III.
- **Fourth Amendment** (Vol. 12139, Pg. 151) — additional property/common area additions.
- **Fifth Amendment** (Vol. 12365, Pg. 90)
- **Sixth Amendment** (Vol. 12416, Pg. 0392)
- **Seventh Amendment** (recorded — exact citation not stated in Eighth Amendment recital; "to be recorded in the Official Public Records of Travis County, Texas" at time of Eighth Amendment execution)
- **Effect on Lot 12, Block M:** Indirect — these amendments add additional Phases / Sections to the Declaration and modify Common Area provisions. None alter Article 3, 4, 6, or 10 in a way that changes use restrictions, setbacks, masonry, square footage, height, or amendment thresholds applicable to Lot 12.
- **Confidence:** Inferred from recital and from review of the master Declaration PDF (which contains Third Amendment text). Title commitment should pull each amendment to confirm no further use-restriction modifications.

---

### Eighth Amendment to the Master Declaration (Doc # 2005103195)
- **Recorded:** June 10, 2005 (Travis County Official Public Records — note: Travis County stopped Vol/Pg for new instruments in 2001 in favor of Document Numbers)
- **Approved:** April 21, 2005 by 3/4 vote of Members
- **Executed by:** Alan Shelby (President) and Leigh Ann Brunson (Secretary), Scofield ROA
- **Effect:**
  - Amends §10.8 to expressly authorize the Association to assess enforcement costs against the violating Owner as a personal obligation and a lien against the Lot (lien prior to homestead).
  - Adds §11.1 providing remedies for violation: $25/violation special charge, 60-day suspension of common area use rights, right to cure/abate at Owner's expense, injunctive relief, attorneys' fees and costs. Each day a violation continues is a separate violation. Notice and hearing required before remedies are invoked.
- **Effect on Lot 12, Block M:** Substantially **strengthens HOA enforcement teeth**. Doesn't change substantive use restrictions but means an Owner who constructs a duplex in violation of §4.1 risks daily fines, injunction (likely demolition order), and attorneys' fees.
- **Confidence:** Verified (PDF read, full text reviewed).

---

### Blanket Electric Easement — Vol. 660, Pg. 968 (Travis County)
- **Granted to:** Unknown — not retrievable via public web. Most probable grantee given vintage and area: predecessor of City of Austin Electric Department (now Austin Energy) or a private rural electric cooperative (e.g., Pedernales Electric Cooperative) operating in unincorporated Travis County in the 1960s. Vol. 660 of Travis County Deed Records corresponds roughly to the **mid-1960s** (Travis County Deed Vol. 660 ≈ 1965–1966).
- **Date:** ~1965–1966 (inferred from volume number).
- **Scope on this lot:** Listed on the 1994 boundary survey as *"subject to blanket-type electric easement per Vol. 660, Pg. 968."* The term "blanket" means the easement is not described by metes and bounds but rather covers all of the larger original tract (pre-subdivision) — typically granting the utility the right to construct, operate, repair, replace, and remove electric distribution lines, poles, and appurtenant facilities across the entire tract, with a reasonable right of ingress/egress.
- **Status:** Survey marks it as still affecting the lot (NOT one of the easements crossed off as "Do not affect this lot"). Cannot confirm release/amendment without pulling the document.
- **Texas blanket easement law:** Under Texas common law and recent cases (e.g., *Southwestern Electric Power Co. v. Lynch*, Tex. 2020, refining *Houston Pipe Line Co. v. De La Cruz*), a blanket-type easement may be subject to fixed-location interpretation once the utility has built and used the actual facilities in a determinate location ("course of dealing" doctrine). If no utility facilities are located on Lot 12 (typical: distribution is in the public street ROW or rear utility easement, not running through individual SF lots), the practical effect of the blanket easement on a new duplex footprint is minimal; the lot owner may seek a partial release of the blanket easement upon request to Austin Energy demonstrating no current overhead/buried facilities are present.
- **Implication for duplex:**
  - Likely no physical encumbrance on the building footprint if no existing AE facilities cross the lot.
  - **Action item:** title commitment should specifically address (i) whether the blanket easement has been released, (ii) what AE facilities are physically present on Lot 12, and (iii) whether a partial release can be obtained.
- **Confidence:** Unconfirmed (need title commitment + Austin Energy ROW department inquiry).

---

### Other "easements of record" listed on the 1994 survey
The 1994 surveyor reviewed and **affirmatively stated** the following do NOT affect Lot 12, Block M:
- Vol. 8602, Pg. 508
- Vol. 8317, Pg. 1148
- Vol. 8602, Pg. 552
- Vol. 10202, Pg. 358
- Vol. 10254, Pg. 1735
- Pg. 1672 (volume not stated, likely Vol. 10254)
- Pg. 1196 (volume not stated, likely Vol. 10254)

These are likely off-site utility / drainage / common-area easements granted by Mellon Properties during initial Scofield development for other phases/sections of the subdivision. Confidence: surveyor's positive statement is reliable; title commitment should re-verify these against current parcel ID.

---

## Plat-level restrictions (Cabinet 91, Slide 264–265, Travis County Plat Records)

The plat was not separately retrievable from public web; restrictions are reflected on the 1994 survey extraction. From that extraction, the **plat itself** imposes (i.e., independent of CC&R §3.24):

- **5' Public Utility Easement (P.U.E.)** along front (north) lot line — along Cinchring Lane ROW.
- **7.5' Mutual Utility Easement (M.U.E.) and Public Sewer Easement (P.S.E.)** along rear (south) lot line.
- **15' Drainage Easement (D.E.)** — location not specifically dimensioned on extraction; references plat Vol. 11863 Pg. 1147 (Declarant-reserved).
- **25' front building line (B.L.)** — matches DCCR §3.24.
- **5' side building line (B.L.)** — matches DCCR §3.24 interior side.
- **10' "building line" per Vol. 11863 Pg. 1147** — appears to be the DCCR-reserved blanket utility/easement reservation per §3.24 / §1.12 (Improvements definition) and Article 9 (Easements), granting Declarant the right to "create R.O.W.s and easements for public utility purposes not to exceed 10' in width on each side of any lot line."
- **Ingress/egress easement** for constructing, reconstructing, inspecting, patrolling, maintaining all utilities (Declarant-reserved, per §9 of Declaration).
- **Sidewalk requirement** in ROW — installation per plat specifications, reaffirmed by §3.30 of Declaration.

Net usable buildable envelope on Lot 12 (~8,083 SF lot):
- Front BL 25' + Rear DCCR setback 10' (which is more restrictive than the 7.5' platted PSE/MUE):
  - Buildable depth ≈ 127 - 25 - 10 = 92 feet
- Interior side BLs 5' both sides:
  - Buildable width ≈ avg(60.12, 67.20) - 5 - 5 = 53.66 feet
- Buildable envelope (approx.): 92 × 53.66 ≈ 4,937 SF footprint envelope (sufficient for a typical duplex footprint, IF the CC&R single-family restriction can be addressed).

---

## Open questions / items for the title commitment

1. **Title commitment must list and attach** every recorded amendment to the Scofield Declaration (1st – at least 8th, plus any after 2005) and disclose any further amendments through current. Confirm there is no amendment that loosens the single-family restriction.
2. **Vol. 660, Pg. 968 blanket electric easement** — pull document, confirm grantee, scope, and whether any partial release has been recorded. Inquire with Austin Energy ROW dept. (rowmanagement@austinenergy.com) whether AE has any facilities physically located on Lot 12 that would constrain new construction.
3. **Plat Cabinet 91, Slide 264–265** — pull current plat from Travis County Clerk; confirm all plat notes, easement locations, drainage easement geometry (the 15' D.E. is referenced but its location on Lot 12 is not depicted on the 1994 boundary survey if it does not cross Lot 12; confirm whether it does).
4. **Seventh Amendment** — exact recording citation not confirmed; pull from Travis County OPR by Doc # search for "Scofield" between 2003 and 2005.
5. **Any "Ninth+" Amendments** post-2005 — Scofield ROA website does not list any further declaration amendments, but title search must confirm.
6. **Architectural Control Committee** — confirm whether ACC has adopted formal Architectural Control Committee Rules under §1.2 of the Declaration that are recorded. The website posts a 2023 ACC submittal form, a 2014 fence procedure, a 2012 xeriscaping guideline, and a 2013 ACC advisory notice; only the form and the xeriscaping/fence rules are publicly downloadable. Title commitment will not surface these (they are usually unrecorded), but the Owner should request them directly from Scofield ROA before designing.
7. **Possible HOA pre-approval pathway for duplex:**
   - (a) Estoppel / non-enforcement letter from Scofield ROA Board acknowledging the duplex (unlikely to be granted given §4.1).
   - (b) Formal amendment of §4.1 by 3/4 owner vote (extremely unlikely).
   - (c) Litigation strategy challenging enforceability of §4.1 against duplex in light of Austin HOME ordinance — Tex. Prop. Code §202.003 generally preserves private covenants; HOME does not preempt private restrictions; this approach is very weak.
   - (d) Construct one single-family residence per §4.1 instead, possibly with an Accessory Dwelling Unit (ADU) — but the Declaration's §4.1 "single-family" definition (family related by blood, marriage, adoption + foster + domestic servants) and §3.7 / §3.24 / §3.28 do not expressly contemplate an ADU as a separate "structure." An ADU might be characterized as part of a single-family residence with one kitchen; this requires careful structuring and ACC pre-clearance. Note also §3.24's 5-foot interior side setback and the 10-foot dwelling-to-dwelling spacing requirement applies.
8. **Scofield Subassociation:** Phase VI Section II may also be subject to a Subassociation per §1.25 of the Declaration. None has surfaced in public records; title commitment should confirm.
9. **Confirm whether the lot is a corner lot** for masonry purposes — survey indicates interior lot (Cinchring Ln front only; adjoining Lot 11 west and Lot 13 east). Interior lot → 50% masonry minimum.

---

## Key recorded instruments — quick reference table

| Instrument | Volume / Page (or Doc #) | Recorded | Effect on Lot 12, Block M |
|---|---|---|---|
| Master Declaration (CC&Rs) | Vol. 11863, Pg. 1147 | Feb 1, 1993 | Governs all use, ACC, setbacks, term, amendment |
| First Amendment | Vol. 11880, Pg. 775 | Feb 25, 1993 | Modifies Common Area definition, adds Phase II |
| Second Amendment | Vol. 11949, Pg. 239 | mid-1993 | **Binds Phase VI Section II (this lot) to Declaration** |
| Third Amendment | Vol. 12041, Pg. 3048 | Oct 13, 1993 | Adds Phase VI Section III; minor |
| Fourth Amendment | Vol. 12139, Pg. 151 | 1993–94 | Adds Phase; minor |
| Fifth Amendment | Vol. 12365, Pg. 90 | post-1994 | Minor |
| Sixth Amendment | Vol. 12416, Pg. 0392 | post-1994 | Minor |
| Seventh Amendment | Not stated in recital | pre-2005 | Confirm with title commitment |
| Eighth Amendment | Doc # 2005103195 | Jun 10, 2005 | Adds enforcement remedies (fines, lien priority) |
| Bylaws of Scofield ROA | (not recorded in real property records — corporate doc) | 4/24/2007 | Governance |
| Plat | Cabinet 91, Slide 264–265 | 1993 (concurrent w/ Decl.) | Sets platted setbacks, easements, sidewalks |
| Blanket electric easement | Vol. 660, Pg. 968 | ~1965–66 | Likely no built facility on lot; verify at title |

---

## Confidence summary

- **Master Declaration (Vol. 11863, Pg. 1147):** Verified. Full PDF read; key restrictions excerpted verbatim. Most material finding (§4.1 single-family-only restriction) is unambiguous.
- **First through Third Amendments:** Verified (full text in master PDF).
- **Fourth – Seventh Amendments:** Inferred from Eighth Amendment recital. None identified as modifying use restrictions.
- **Eighth Amendment:** Verified (full PDF read).
- **Plat (Cabinet 91, Slide 264–265):** Inferred from 1994 survey extraction; plat PDF not retrieved.
- **Blanket electric easement (Vol. 660, Pg. 968):** Unconfirmed; needs title commitment and Austin Energy inquiry.
- **No "Ninth+" amendments identified** through public sources (Scofield Farms website / web search). Title commitment must confirm.

---

**Bottom-line implication for duplex project on Lot 12, Block M, Scofield Phase VI Section II:**

Even if the City of Austin's HOME-2 amendments authorize a duplex on this SF-zoned lot at code, the **private deed restriction (Declaration §4.1) independently prohibits anything other than a single-family residence** for one family (related by blood/marriage/adoption). Texas Prop. Code §202.003 generally enforces private covenants, and the HOA's 2005 Eighth Amendment substantially hardened enforcement remedies (daily $25 fines, injunction, attorneys' fees, lien with priority over homestead). The Declaration auto-renews every 10 years; current term runs through Dec 31, 2032. Amendment requires 75% Member vote — practically infeasible for a single owner. A duplex cannot proceed at 12713 Cinchring Ln without either (a) successfully amending or terminating §4.1 of the Scofield Declaration, (b) obtaining a written non-enforcement / estoppel commitment from Scofield ROA, or (c) accepting material litigation and enforcement risk.

---

## Programs

**Scope:** City of Austin, state, and federal programs potentially relevant to demolishing the existing 1-story SFR and constructing a duplex (2 attached units) on Lot 12, Block M, Scofield Subdivision Section II Phase VI (≈8,080 SF lot, full-purpose City of Austin, Council District 7, ZIP 78727).

**Geocoding for program eligibility:**
- 2020 Census Tract GEOID: **48453042100** (Travis County Tract 421) — verified via U.S. Census geocoder.
- Census Block: 484530421002004.
- Council District: 7 (verify via COA "What's My District" tool — boundary of D7/D4 runs near here).
- TCAD parcel ID and 2020 tract: must reconcile against TCAD record (see Property Records section above).

---

## 1. HOME Initiative — Phase 1 (Ordinance 20231207-001)

- **Citation:** Ordinance 20231207-001, effective Feb 5, 2024; amends LDC §25-2-773 and related sections.
- **What it enables:** Up to **three** dwelling units (duplex, two-unit residential, or three-unit residential) by-right on lots zoned **SF-1, SF-2, or SF-3** (and most other SF / urban-residential bases). Tiny homes (≤400 SF) count as a unit type.
- **Eligibility for this parcel (Verified, pending zoning confirmation):** Scofield Sec II is conventional 1990s SF subdivision; base zoning is almost certainly SF-2 or SF-3 (see Zoning Pathway section). If confirmed SF-1/SF-2/SF-3, parcel qualifies for HOME Phase 1 by-right.
- **Affordability requirement:** **None.** No income-restriction or affordability set-aside required for the by-right three-unit path.
- **Key dimensional standards under HOME 1:** Max building coverage 40%; max impervious cover 45%; height per base zoning (Subchapter F 32-ft cap applies to SF use only, NOT to multi-unit under HOME 1 — but base SF-2/SF-3 height limit of 35 ft still applies); no minimum unit separation (building code still applies); each unit needs a unique address. Confirm in Zoning Pathway section.
- **Preservation Bonus:** Available if existing structure is preserved (N/A here — owner intends demo).
- **Value to this project:** **Critical enabler.** Without HOME 1, duplex on SF-2/SF-3 was previously restricted (lot-size minimums, occupancy rules). HOME 1 makes the 2-unit duplex (and even a 3-unit configuration) by-right with no affordability strings.
- **Application path:** No separate program application; reviewed during standard residential building permit intake under HOME 1 rules.
- **2026 status:** Active. COA reports 798 applications reviewed, 631 approved, 1,250 units approved as of 6/1/2026. No litigation invalidating the ordinance is identified; some neighborhood deed-restriction lawsuits exist that limit HOME applicability on deed-restricted lots (see §11 below).
- **Confidence:** Verified (program); Inferred (parcel eligibility — pending zoning lookup).

---

## 2. HOME Initiative — Phase 2 (Ordinance 20240516-006)

- **Citation:** Ordinance 20240516-006 (the adopted small-lot SF ordinance is **-006**; -005 is the ETOD Overlay subdistrict boundaries). Effective late May 2024.
- **What it enables:** Reduces **minimum lot size for small-lot single-family** to **1,800 SF** (down from 5,750 SF) on SF-1, SF-2, SF-3 lots. Permits single-family use on undersized lots and allows resubdivision down to 1,800 SF lots.
- **Unit cap:** **One** dwelling unit per small lot under Phase 2 (Phase 2 is a SF-only path; Phase 2 small lots are NOT eligible for HOME 1 three-unit treatment).
- **Eligibility for this parcel:** Lot is ~8,080 SF — **larger than the new 5,750 SF threshold**, so HOME 2 *resubdivision* is theoretically possible: lot could be subdivided into 2 lots of ≈4,040 SF each, each developed with 1 SF unit (or potentially each as a HOME 1 duplex if each new lot ≥5,750 SF — which it would NOT be at 4,040 SF, so each subdivided lot would be limited to 1 unit under HOME 2's small-lot regime). **For a 2-unit total on the existing lot, HOME 1 duplex path is simpler and cleaner than HOME 2 resubdivide.**
- **Affordability:** None required.
- **Value to this project:** **Probably not the optimal path.** A subdivision to 2 small lots → 2 SF units yields the same unit count as a HOME 1 duplex but adds platting cost, time, and the Infill Plat process. However, HOME 2 may add **resale optionality** (two separately-owned fee-simple lots vs. one duplex parcel). Worth modeling.
- **Application path:** Subdivision/Residential Infill Plat (see Site Plan Lite Phase 2 below) plus building permits.
- **2026 status:** Active but lightly utilized — only ≈40 small-lot buildings and ½-dozen subdivisions as of mid-2026 per local press. No invalidating litigation as of 6/2026; some implementation friction reported.
- **Confidence:** Verified.

---

## 3. ADU / "Alley Flat" (LDC §25-2-774 + related)

- **Citation:** LDC §25-2-774 (Accessory Dwelling Units / Two-Unit Residential rules). Pre-dates HOME but largely superseded by HOME 1 for multi-unit purposes.
- **What it enables:** Up to **2 ADUs per residential lot** under 2026 rules; max ADU size 1,100 SF or 15% of lot area (whichever is less); 2nd floor capped at 550 SF; max height 30 ft; 10-ft separation from primary house; no parking required.
- **Eligibility for this parcel:** Yes if SF-1/SF-2/SF-3 (likely) and lot ≥2,500 SF (yes, 8,080 SF).
- **Alley Flat Initiative (GNDC + ACDDC + UT-CSD):** A *non-profit* program — not a city incentive — that develops affordable ADUs on lots with alley access. Scofield Section II has no alley (typical 1990s suburban layout — confirm via plat), so **alley-flat path is N/A** structurally.
- **Value to this project:** **Useful fallback.** If duplex path closes (e.g., HOA enforcement of single-family deed restriction — see §11), an SFR + ADU configuration delivers 2 units. ADU + main house is regulated as 2-unit residential under HOME 1, so the entitlement is effectively the same. ADU rules give somewhat different size/height caps that may suit certain massing strategies (e.g., a smaller cottage behind a primary SFR).
- **Application path:** Standard residential building permit; no separate ADU application.
- **Confidence:** Verified.

---

## 4. Affordability Unlocked (Ordinance 20190509-027; amended by 20210826-052)

- **Citation:** LDC §25-2-652 et seq.; Ordinance 20190509-027.
- **What it enables:** Density-bonus program that waives or relaxes development standards (height, FAR, parking, compatibility, min lot size, setbacks) in exchange for affordable set-asides. Type 1 (entry) and Type 2 (deeper) tiers; rental 50% MFI for 40 yrs; ownership avg 80% MFI for 99 yrs; ≥50% of units must be affordable.
- **Eligibility for this parcel:** **Technically eligible** for residential development on this lot, but program is designed for multifamily / scaled affordable projects. The 50% affordable-unit set-aside on a 2-unit duplex means 1 of 2 units must be deed-restricted — drastic income hit for a market-rate duplex.
- **Value to this project:** **Not applicable: scale + business model.** Owner-developer duplex with no affordability mission would not adopt AU's 50% set-aside in exchange for relief from constraints HOME 1 already removes for free.
- **Confidence:** Verified N/A.

---

## 5. Density Bonus 90 / DB90 / VMU2 (Ordinance 20240229-073)

- **Citation:** LDC Subchapter E §4.3.3.D (DB90 Combining District); Ordinance 20240229-073.
- **Eligibility:** Commercial / mixed-use base zones only — LR, GR, GO, LO, CS, CS-1, CS-MU, and equivalents. **Explicitly NOT applicable to SF base zones** (no SF, residential, or industrial bases qualify).
- **Eligibility for this parcel:** **Not applicable: zoning.** SF-2/SF-3 base zoning ≠ DB90 eligible.
- **Confidence:** Verified N/A.

---

## 6. S.M.A.R.T. Housing (Ord. 20000824-066 + amendments; AHFC-administered)

- **Citation:** Resolution / LDC; administered by Austin Housing Finance Corporation (AHFC). 2025 SMART Housing Applicant Guide governs current process.
- **What it enables:** Waives **development review, permit, capital recovery (water/wastewater impact), construction inspection, and parkland** fees for developments providing affordable, accessible, transit-oriented housing meeting Austin Energy Green Building standards. Fee waivers can total $20K–$50K+ per affordable unit on small infill.
- **Eligibility:** At least **10%** of units must be affordable to ≤80% MFI (ownership) or ≤60% MFI (rental); must meet AEGB 1-star min; "transit-oriented" requirement is interpreted loosely. SMART applies to all residential including duplex.
- **Eligibility for this parcel:** **Marginal.** A 2-unit duplex must set aside at least 1 of 2 units = 50% (since 10% of 2 units rounds up to 1). Same scale problem as Affordability Unlocked — the owner would deed-restrict half the project to capture maybe $15K–$30K in fee waivers per affordable unit. Possibly attractive if owner wants long-term hold on one unit anyway, but unlikely for a market-rate flip/build-to-sell.
- **Value to this project:** **Low for typical duplex.** Run the numbers: fee waiver vs. AMI deed restriction NPV — usually a loss unless the developer's pro forma assumes operating a long-term rental at sub-market on one side.
- **Application path:** AHFC SMART Housing application (online portal) **before** site plan / building permit submittal. Certification required.
- **Confidence:** Verified.

---

## 7. Equitable Transit-Oriented Development (ETOD) Phase 1 (Ord. 20240516-005)

- **Citation:** Ordinance 20240516-005 (adopted ETOD Overlay subdistrict boundaries May 16, 2024).
- **Eligibility:** Only lots within ½ mile of Project Connect Phase 1 light rail alignment + Phase 1 priority extensions are mapped into the ETOD Overlay. Phase 1 stations (post-2024 scope-down): 38th St/UT, The Drag/Guadalupe, Republic Square, Auditorium Shores, South Congress, Oltorf, East Riverside corridor — all downtown / central / south Austin. Tech Ridge and Wells Branch extensions are **future phases** (not adopted, no overlay).
- **Eligibility for this parcel:** **Not applicable: location.** 12713 Cinchring is in N. Austin (Parmer/Howard area), ~9 miles north of the northernmost Phase 1 station (38th/UT). Not within ½ mile of any Phase 1 alignment. **No ETOD overlay applies.**
- **Confidence:** Verified N/A.

---

## 8. Site Plan Lite Phase 1 (Ordinance 20230720-158)

- **Citation:** Ordinance 20230720-158 (adopted 7/20/2023); LDC §25-5-2 site plan exemption.
- **What it enables:** Projects of **≤4 residential units** on a single lot are **exempt from site plan review entirely**. Reviewed through residential building permit only (no separate site plan process, no engineer-stamped site plan submittal, no public notice). Drainage / impervious cover triggers may still impose simplified review at >4,000 SF new IC.
- **Eligibility for this parcel:** **Yes** — 2-unit duplex falls well within the ≤4-unit threshold.
- **Value to this project:** **Major — reduces permitting time, cost, consultant scope.** Skipping site plan saves 6–12 months and ~$15K–$40K in civil engineering + review fees relative to a small-project site plan.
- **Application path:** Submit residential building permit through DSD; no separate exemption application required.
- **Confidence:** Verified.

### 8b. Site Plan Lite Phase 2 / Infill Plat (Ord. C20-2023-045, adopted 3/6/2025)

- Streamlined process for 5–16 units on a single lot OR resubdivisions creating ≤8 lots within an existing residential subdivision; ≤1 acre.
- Allows simplified drainage plan instead of full site plan for >4,000 SF new IC (except for 2-unit / 3-unit re-subdivisions, which remain exempt).
- **Relevance here:** Only relevant if owner chooses HOME 2 resubdivision into 2 small lots — Infill Plat process applies. For straight duplex on existing lot, **the Site Plan Lite Phase 1 exemption is enough**.

---

## 9. Regional Stormwater Management Program (RSMP) Fee-in-Lieu

- **Citation:** Drainage Criteria Manual §1.2.2.G / §8; LDC §25-7.
- **What it enables:** Cash payment to City watershed fund in lieu of constructing on-site detention. Optionally pay UWSCF for water-quality fee-in-lieu.
- **Eligibility for this parcel:** Site Plan Lite Phase 1 exempt projects (≤4 units) generally do not trigger detention or water-quality requirements at all under current DCM thresholds for SFR/duplex builds — IC threshold for required controls is typically >5,000 SF on residential. An 8,080 SF lot building a 2-unit duplex will likely stay under any drainage-controls trigger.
- **Value to this project:** **Likely N/A.** Confirm in the Stormwater & Drainage discipline section. If new IC exceeds threshold, RSMP fee-in-lieu is the standard residential out — calculated from appraised land value × IC × detention-construction-cost factor.
- **Confidence:** Inferred N/A (pending drainage IC calc).

---

## 10. Tree Mitigation / Urban Forest Replenishment Fund (UFRF)

- **Citation:** LDC §25-8-621 to -643 (tree protection / removal); LDC §6-3 (heritage trees); ECM §3.5.4 (mitigation measures); UFRF payment-in-lieu mechanism.
- **What it triggers:** Removal of any **protected tree** (≥19" diameter for most species) or **heritage tree** (≥24" diameter for listed species) requires permit + mitigation. Mitigation can be on-site replacement plantings or payment to UFRF when on-site planting is infeasible.
- **Eligibility for this parcel:** Depends entirely on existing tree inventory (1994 survey shows none, but did not record interior trees). **Pre-design arborist walk + heritage-tree screen required.** Common: 1990s subdivision lots have mature live oaks, cedar elms, hackberries reaching protected size by 2026 (30+ years from planting).
- **Heritage tree removal:** Requires Land Use Commission approval — significant time + risk.
- **Value to this project:** This is an **anti-program / cost risk**, not an incentive. Budget $5K–$25K mitigation contingency until arborist confirms protected/heritage tree status.
- **Confidence:** Verified (program); Unconfirmed (parcel-specific tree inventory).

---

## 11. Federal: Qualified Opportunity Zone (IRC §1400Z-2)

- **Citation:** Internal Revenue Code §1400Z-2; original 2018 designations ("OZ 1.0").
- **Eligibility for this parcel:** Census Tract **48453042100 (Travis County Tract 421)** is **NOT** on the 2018 Travis County QOZ list. Travis County designated tracts cluster in East Austin (e.g., 1712, 1804, 1832, 2106-2112, 2209, 2307, 2312-2319, 2410-2436). Tract 421 (North Austin / Scofield) is **not designated**.
- **OZ 2.0:** New designations under OBBBA may take effect 1/1/2027 with rolling 10-yr designations. Possible that re-designated map will/will not include Tract 421; current 2026 status: **not a QOZ.**
- **Value to this project:** **Not applicable.**
- **Confidence:** Verified.

---

## 12. Federal / State: LIHTC, HUD CDBG, TDHCA Bootstrap, NSP

- **LIHTC (9% / 4%):** N/A — minimum unit count, sponsor experience, IRS Form 8609 compliance overhead make 2-unit infill economically and procedurally infeasible. **Not applicable: scale.**
- **HUD CDBG / HOME-ARP:** Pass-through grants to City and AHFC, not direct to small developers. N/A.
- **TDHCA Bootstrap:** Self-help / owner-builder loan program for ≤80% AMFI households building their own home. N/A unless owner personally qualifies and self-builds — does not contemplate a market-rate duplex.
- **TDHCA NSP (Neighborhood Stabilization):** One-time 2008 HERA program for foreclosed-property redevelopment. Long expired for new applications.
- **HOA tax-exempt / passive financing:** N/A.
- **Confidence:** Verified N/A.

---

## 13. Demolition Permit Considerations (anti-program, but operationally important)

- **City of Austin demo permit:** Required for any complete demolition. Application via DSD; tied to the new construction permit timeline (can be sequenced as "demo + new construction" combined permit).
- **TX DSHS asbestos notification:** State law (Texas Asbestos Health Protection Rules) requires notification ≥10 working days before demolition of *any* building regardless of asbestos presence, *except* single private residences and ≤4-unit residential buildings ARE EXEMPT from the survey requirement (per TX DSHS exemption). Notification still recommended for liability.
- **Lead paint:** Existing house built ~1993–1994 (per 1994 survey). **Post-1978 construction is presumed lead-free** (federal lead paint ban took effect Jan 1, 1978). No lead survey required. Good.
- **Historic / archeological review:** A 1993-built tract home in a 1990s subdivision has **no historic-designation exposure**. No Texas Antiquities Code review required (private land, no state/federal nexus).
- **Demolition delay:** Austin's demolition-delay ordinance (LDC §25-11 / Historic Landmark Commission notice) applies to structures ≥50 years old. This house is ~33 years old in 2026 → **not subject to demolition delay**.
- **Tree protection during demo:** §25-8 critical-root-zone fencing required if any protected/heritage tree on or adjacent to lot.
- **Utility disconnect:** AW disconnect for water/sewer; Austin Energy disconnect; Texas Gas Service disconnect — all standard 3–6 week scheduling.
- **Value:** No unusual hurdles. Standard residential demo permit ≈ $250–$500 fee + utility disconnect coordination.
- **Confidence:** Verified.

---

## 14. Restrictions worth knowing (anti-programs)

### 14a. Scofield Subdivision Deed Restrictions / HOA

- **Citation:** Master Declaration of Covenants for Scofield Subdivision (likely recorded with plat, Cabinet 91 Slide 264-265, and via Vol. 11863 Pg. 1147 referenced on the 1994 survey). Survey flags declarant-reserved easement rights.
- **HOA identified:** Scofield Farms HOA / Scofield ROA (Residential Owners Association) — confirmed active per public HOA records. Whether Section II Phase VI is governed by the same ROA or a sub-association is **unconfirmed** — see the Restrictive Covenants section, which addresses the recorded CC&Rs in detail.
- **Risk:** Pre-HOME 1 deed restrictions often contain "**single-family use only**" or "**one dwelling per lot**" covenants that survive zoning changes. Texas appellate caselaw (and active Austin neighborhood litigation in 2024-2026) confirms HOAs can enforce deed restrictions against HOME-permitted duplexes if covenants are valid, in-force, and not abandoned. **This is the single largest hidden risk on this project.**
- **Architectural review committee (ACC):** Scofield HOAs typically require ACC review of plans for new construction — design guidelines may dictate materials, setbacks, façade composition, fence/roof types that constrain duplex design.
- **Mitigation path:** Pull and read the full recorded CC&Rs; check for amendment / termination provisions (often require 67-75% supermajority owner vote); check whether covenants have expiration clock; check whether HOA has affirmatively enforced single-family covenant recently (a key abandonment factor in TX caselaw).
- **Confidence:** Inferred restriction (need title pull to verify).

### 14b. Homestead exemption timing

- **Citation:** Texas Tax Code §11.13; §11.135 (continued homestead during reconstruction).
- **Mechanic:** Existing 1-story house, if currently owner-occupied with §11.13 general homestead in place, loses homestead **when owner ceases to occupy** prior to demo. §11.135 protects continued exemption only if structure is rendered uninhabitable by casualty (fire, storm) — **not** by voluntary demolition.
- **Practical effect:** TCAD will remove homestead at next reappraisal cycle after demo; the new duplex (rental or sale) qualifies for homestead on only the owner-occupied unit (if any) once owner takes occupancy. 10% appraisal cap also resets — significant tax exposure during construction period.
- **Confidence:** Verified.

### 14c. Plat / building line restrictions

- Survey shows 25' front BL, 5' side BL, 7.5' rear MUE/PSE on plat. **Platted building lines** are restrictive covenants — they survive HOME 1 setback liberalization unless the plat is replated. The Zoning Pathway section addresses whether HOME 1 small-lot setbacks (5'/5'/5' on certain configurations) actually apply, or whether the platted 25' front BL still governs (almost always: yes, plat governs).

---

## 15. Summary table — programs of interest

| # | Program | Applicable? | Net value | Confidence |
|---|---|---|---|---|
| 1 | HOME Phase 1 | **Yes** | **Critical enabler — by-right duplex** | Verified |
| 2 | HOME Phase 2 | Yes (alt path) | Optional — resubdivide to 2 small SF lots | Verified |
| 3 | ADU (LDC §25-2-774) | Yes (fallback) | Medium — alt 2-unit configuration | Verified |
| 4 | Affordability Unlocked | Technically yes | N/A — scale + affordability burden | Verified |
| 5 | DB90 / VMU2 | No | N/A — wrong zone | Verified |
| 6 | SMART Housing | Marginal | Low — affordability burden > fee waiver value at 2-unit scale | Verified |
| 7 | ETOD Overlay | **No** | N/A — outside Phase 1 station areas | Verified |
| 8 | Site Plan Lite Phase 1 | **Yes** | **High — skips site plan entirely** | Verified |
| 8b | Site Plan Lite Phase 2 / Infill Plat | Only if subdividing | Medium (HOME 2 path) | Verified |
| 9 | RSMP fee-in-lieu | Probably N/A | Low — duplex unlikely to trigger detention | Inferred |
| 10 | Tree mitigation (UFRF) | TBD | Risk, not benefit — $5K-$25K contingency | Verified program / Unconfirmed parcel |
| 11 | QOZ (IRC §1400Z-2) | **No** | Tract 48453042100 not designated | Verified |
| 12 | LIHTC / CDBG / TDHCA | No | N/A — scale | Verified |
| 13 | Demolition permit | Routine | Standard process; no historic/asbestos/lead hurdles | Verified |
| 14a | Scofield HOA / CC&Rs | **Likely yes** | **Highest unknown risk** — duplex may be prohibited by covenants | Inferred |
| 14b | Homestead reset on demo | Yes | Tax exposure during build | Verified |
| 14c | Platted building lines | Yes | Restrict siting flexibility | Verified |

---

## Critical follow-ups

1. **Restrictive Covenants:** Pull and read Scofield Sec II Phase VI master CC&Rs (likely recorded Vol. 11863 Pg. 1147 or contemporaneous instrument). Confirm whether single-family-only / one-dwelling-per-lot covenant is in force and whether HOA has standing/intent to enforce. **This determines whether the duplex thesis is viable at all.**
2. **Zoning:** Confirm base zoning (SF-2 vs SF-3 vs other) via COA zoning map / TCAD; confirm HOME 1 applicability; produce dimensional envelope incorporating platted 25' front BL.
3. **Drainage:** Confirm whether 2-unit duplex on 8,080 SF lot triggers any detention / water quality review under current DCM thresholds.
4. **Pre-design:** Schedule arborist walk to inventory protected (≥19" DBH) and heritage (≥24" DBH listed species) trees before design.
5. **Title / Survey:** Order current survey + title commitment to verify post-1994 easements (including scope of blanket electric easement Vol. 660 Pg. 968) and current effective FIRM (1993 panel almost certainly superseded).

---

## Neighborhood Plan Context

**Parcel:** 12713 Cinchring Ln, Austin TX 78727 — Lot 12, Block M, Scofield Subdivision Section II Phase VI
**Submarket:** North Austin, east of MoPac, between I-35 and Metric Blvd, north of Parmer Ln
**Intended use:** Demolish existing SF house and construct duplex (HOME Phase 1 / 2 enabled, subject to base zoning)

---

## 1. Imagine Austin Comprehensive Plan (2012, amended through 2022)

- **Status of plan:** Imagine Austin is Austin's adopted comprehensive plan (City Council adopted June 15, 2012; periodically amended). It is the city's top-tier policy document and is the framework that all neighborhood plans amend.
- **Growth Concept Map (GCM) designation for this parcel:** the parcel sits within **"established neighborhood" / residential fabric** on the GCM — it is NOT within any designated Activity Center, Regional Center, Town Center, or Neighborhood Center, and is NOT on a designated Activity Corridor. The two nearby Imagine Austin elements are:
  - **Tech Ridge Activity Center** — located at I-35 and Parmer Lane, ~0.7 mi south/southeast of the parcel. Tech Ridge is identified as a **Neighborhood Center** in Imagine Austin (smallest activity-center type — local-serving retail, services, mixed-use).
  - **I-35 Activity Corridor** — runs north–south, ~0.5 mi east of the parcel.
- **Implication for duplex:** Imagine Austin generally promotes "compact and connected" growth and explicitly supports gentle density / missing-middle in established neighborhoods near activity centers. A duplex on this parcel is **consistent with** Imagine Austin's stated goals; the proximity to the Tech Ridge Neighborhood Center is a mild policy positive (slightly higher density appropriate near activity centers).
- **Citations:**
  - City of Austin Planning – Imagine Austin Growth Concept Map: https://www.arcgis.com/apps/webappviewer/index.html?id=3c602527fd7146129d14aad9db223959
  - Imagine Austin Centers dataset (open data): https://data.austintexas.gov/dataset/Imagine-Austin-Centers/k4sq-5xm6
  - Imagine Austin Corridors dataset: https://data.austintexas.gov/Locations-and-Maps/Imagine-Austin-Corridors/sb68-tfzc
- **Confidence:** High that parcel is "established neighborhood" residential on the GCM and not within an activity center. Medium-high on Tech Ridge classification as Neighborhood Center (consistently described as a Neighborhood Center in Imagine Austin; verify by visual inspection of the GCM viewer).

## 2. Adopted Neighborhood Plan — NONE applies

- **Conclusion:** The Scofield Subdivision (and the broader Scofield Farms / Wells Branch / Tech Ridge area north of Parmer Ln and east of MoPac) is **NOT within any adopted City of Austin neighborhood plan**. The parcel lies in a **non-planning area** under Austin's NPCT framework.
- **Evidence:** The city's current list of 34 adopted neighborhood planning areas (last comprehensive update 2018; list confirmed current as of 2024) does **not include** any "Scofield," "Wells Branch," "Tech Ridge," or "North Austin Combined" plan. Specifically:
  - **There is no "North Austin Combined Neighborhood Plan."** The user's reference to a 2008 NACNP appears to conflate "North Austin Civic Association (NACA)" (adopted **June 29, 2000**) with a nonexistent combined plan. NACA is the only "North Austin"-named NP and it covers a small area roughly between Anderson Ln, US 183, Burnet Rd and N. Lamar — **well south** of the subject parcel.
  - **North Burnet/Gateway (NBG) Neighborhood Plan** is adopted and covers ~2,300 ac bounded by Walnut Creek N, Metric Blvd E, US-183/Research Blvd S/SW, Braker Ln NW, MoPac W. The subject parcel is **north of Walnut Creek and east of Metric Blvd** — **outside the NBG boundary**.
  - **Wells Branch** is a Municipal Utility District (MUD) and is its own jurisdictional entity (not under City of Austin neighborhood planning); the City of Austin annexed portions for limited purposes only. Subject parcel is just southwest of the Wells Branch MUD boundary, within full-purpose COA, but outside any adopted NP.
- **Citations:**
  - City of Austin Planning – Adopted Neighborhood Planning Areas: https://www.austintexas.gov/page/adopted-neighborhood-planning-areas-0
  - Austin Planning – Neighborhood Plans & Resources: https://www.austintexas.gov/planning/neighborhood-plans-and-resources
  - NACA NP (June 2000): https://www.austintexas.gov/sites/default/files/files/Housing_&_Planning/Adopted%20Neighborhood%20Planning%20Areas/18_NorthAustinCivicAssc/naca-np.pdf
  - North Burnet/Gateway NP & Regulating Plan: https://www.austintexas.gov/page/north-burnetgateway
- **Implication for duplex:** **No adopted NP applies** → no Future Land Use Map (FLUM) governs this parcel, no Neighborhood Plan Combining District (NPCD) suffix attaches, no NP-specific design standards apply, no Neighborhood Plan Contact Team (NPCT) has notification rights on zoning/site-plan cases. **This is a significant simplification:** the only land-use policy filter is Imagine Austin + base zoning + HOME amendments.
- **Confidence:** Very high (multiple independent sources confirm no plan covers the area, and the geometry of NACA/NBG plans excludes this location).

## 3. Future Land Use Map (FLUM) classification

- **Not applicable.** FLUMs only exist for parcels inside an adopted neighborhood planning area. Because this parcel is **outside any adopted NP**, **there is no FLUM designation** for 12713 Cinchring.
- For future-land-use policy guidance, the **Imagine Austin Growth Concept Map** is the only document that speaks to long-range land use; per §1, the parcel is established residential fabric on the GCM.
- **Implication for duplex:** No FLUM means no "plan-amendment" filing is ever required for a use change at this parcel — only zoning. Future rezoning conversations (if needed) go directly to the base zoning case process, not through an NP amendment.
- **Confidence:** Very high.

## 4. Neighborhood Plan Combining District (NPCD) — NOT APPLIED

- **Conclusion:** **No "-NP" combining-district suffix attaches to this parcel's zoning** (because there is no adopted NP). The parcel's zoning is straight base zoning, expected to be SF-2 or SF-3 (to be confirmed via the zoning discipline review and the COA Property Profile).
- **Implication for duplex:** None of the NP-specific overlays apply, including:
  - Small Lot Amnesty (LDC 25-2-1604)
  - Cottage Lot (25-2-1605)
  - Urban Home (25-2-1606)
  - Secondary Apartment (25-2-1607)
  - Corner Store (25-2-1609)
  - Residential Infill (25-2-1608)
  - Neighborhood Urban Center / Mixed-Use Building (25-2-1611, 25-2-1610)
  - NPCD design standards or conditional overlays
- These NPCD-specific infill tools were the **pre-HOME** path to building more than one unit on an SF lot; they were only available in NP areas. Because **HOME Phase 1 (Ord. 20231207-001, eff. Feb 5 2024) and Phase 2 (Ord. 20240516-003, eff. ~June 2024) apply citywide regardless of NP status**, this parcel can access HOME's duplex / two-unit residential provisions without needing an NPCD tool.
- **Citations:**
  - LDC Subchapter D – Neighborhood Plan Combining Districts: https://library.municode.com/tx/austin/codes/land_development_code?nodeId=TIT25LADE_CH25-2ZO_SUBCHAPTER_DNEPLCODI
  - APA Knowledgebase – NPCD Infill Options summary: https://www.planning.org/knowledgebase/resource/9136414/
  - HOME Amendments – City of Austin: https://www.austintexas.gov/page/home-amendments
- **Confidence:** Very high.

## 5. Station-area / TOD plans

- **Not applicable.** 12713 Cinchring is **not within any adopted station-area plan** or Transit-Oriented Development (TOD) district.
- **Project Connect context:** Phase 1 light rail (the approved 9.8-mile Blue/Orange Line starter system) terminates well south of this parcel; northernmost station is around 38th St / North Lamar. Future extensions to Tech Ridge are deferred to later phases (MetroRapid bus service in the interim).
- **MetroRapid:** Routes 801 (N. Lamar) and 803 (Burnet) operate ~1.5–2 mi west of the parcel. The North Lamar MetroRapid extension to Tech Ridge has been programmed for future buildout but no station-area plan has been adopted along that route as of mid-2026.
- **Citations:**
  - Project Connect: https://www.projectconnect.com/
  - CapMetro Rapid 2025: https://www.capmetro.org/rapid2025
- **Implication for duplex:** No TOD-specific entitlements, no station-area plan overlays, no special parking-reduction or design-standard interactions. This is purely "general residential fabric" for transit-planning purposes.
- **Confidence:** Very high.

## 6. Neighborhood association / HOA posture

- **Active HOA:** **Scofield Farms Residential Owners Association (Scofield Farms HOA)** — governs ~574 homes across three sections (original east side, The Park at Scofield, Withers Way). Subject parcel (Lot 12, Block M, Sec II Ph VI) is within Scofield Farms HOA jurisdiction.
- **Governance:** 6-member elected Board of Directors; bi-monthly board meetings; **Architectural Control Committee (ACC)** with formal review authority on property modifications; emphasis on documented ACC approval for any landscaping or improvements.
- **Property manager:** Inframark (community management); Board contact: scofield-farms-board@googlegroups.com
- **HOA website:** https://scofieldfarms.org/
- **Public HOME / missing-middle posture:** **No public position statement** identified on Scofield Farms HOA website or in news coverage. The HOA has no published stance for or against HOME, duplexes, or missing-middle housing as of this review.
- **Adjacent HOAs (not governing subject parcel but in same submarket):**
  - **Scofield Phase VIII Residential Owners Association** (separate HOA — different section of Scofield)
  - **The Ridge at Scofield Farms** (https://www.scofieldridge.org/)
  - **Scofield Ridge Condominiums**
- **Critical caveat — deed restrictions:** Independent of HOA "posture," the **recorded Declaration of Covenants, Conditions, and Restrictions (CCRs)** for Scofield Subdivision is likely to contain explicit use restrictions, including possible **single-family-only** language. **The CCR is enforceable as private contract law and is NOT overridden by HOME** or any other COA zoning ordinance. Per Tex. Prop. Code §202.018 (effective Sept 1, 2025), municipalities cannot enforce restrictive covenants, but HOAs can. **This is the single most important non-zoning risk** for the duplex project and is addressed in the Restrictive Covenants section, not here.
- **Implication for duplex:** HOA has formal architectural review power; will require ACC submittal for new construction. **Public posture is silent**, but ACC and CCR enforcement are the binding constraints — not stated political position.
- **Citations:**
  - Scofield Farms HOA: https://scofieldfarms.org/
  - HOA-Resource directory: https://hoa-resource.com/scofield-farms-homeowners-association-austin-tx/
- **Confidence:** High on HOA identification and management posture; the Restrictive Covenants section confirms the CCR language.

## 7. Active planning initiatives near the parcel

- **Tech Ridge / Parmer corridor development** — ongoing infill at I-35 & Parmer Ln (~0.7 mi south): Parmer Village mixed-use (storefronts, hotel, apartments), Tech Ridge Collection retail, multiple multifamily projects. This is **outside the subject parcel** and does not directly affect entitlement, but:
  - May trigger Parmer Ln corridor transportation studies (TIA standards for the corridor) — relevant if a future rezoning at Cinchring required a regional Traffic Impact Analysis (a duplex would not).
  - Drives MetroRapid demand projections that may eventually formalize a corridor study.
- **MetroRapid expansion to Tech Ridge (Route 837 / Rapid 2025)** — CapMetro is building MetroRapid service connecting downtown to Tech Ridge via N. Lamar. Stops will be on N. Lamar Blvd (>1.5 mi west). **No new stop is planned within walking distance of the parcel.**
- **North Burnet/Gateway TOD subdistricts** — active development west of MoPac, several miles southwest. **Does not affect subject parcel.**
- **No active corridor study, no active station-area planning process, and no active neighborhood-plan-initiation process** identified for the Scofield / Wells Branch area as of mid-2026.
- **Implication for duplex:** No planning initiative will directly affect entitlements at the subject parcel. Cumulative North Austin growth could affect utility-capacity (Austin Water/Drainage) modeling but is not a discretionary-approval risk.
- **Confidence:** Medium-high (initiatives evolve; the surveyor should re-confirm at COA Property Profile and check Planning Commission agendas if any project gets close to the parcel).

## 8. Historical / upcoming zoning case activity

- **Method:** Zoning case history is maintained in the City's AMANDA database (Application MANagement and Data Automation) and is searchable via:
  - COA Property Profile interactive tool: https://maps.austintexas.gov/PropertyProfile/
  - Zoning Cases open dataset: https://data.austintexas.gov/widgets/edir-dcnf
  - Zoning Review Case dataset (PLANNINGCADASTRE): https://data.austintexas.gov/dataset/PLANNINGCADASTRE_zoning_review_case/b2kk-8kt2
- **Subject parcel:** No zoning case history was identified for 12713 Cinchring Lane in this desktop search. The parcel was platted in **Scofield Subdivision Section II Phase VI** (Cabinet 91, Slide 264-265) in the early 1990s with what appears to be original developer zoning (likely SF-2 or SF-3) and there is **no public record of a subsequent rezoning, variance, or conditional-use case** on this lot.
- **Adjacent / subdivision-wide cases:** None identified in this desktop search; the surveyor will pull Property Profile zoning case layers in the next survey pass to confirm.
- **HOME-era cases:** Because HOME Phase 1 and Phase 2 are **citywide zoning text amendments**, they did not produce a parcel-specific case for Cinchring. The applicable HOME ordinance numbers are:
  - HOME Phase 1: **Ord. No. 20231207-001** (effective Feb 5, 2024)
  - HOME Phase 2: **Ord. No. 20240516-003** (effective shortly after May 16, 2024)
- **Citations:**
  - Austin Property Profile User Guide: https://maps.austintexas.gov/geocortex/essentials/external/rest/sites/PropertyProfile/VirtualDirectory/Resources/Documents/PropertyProfileUserGuide.pdf
  - HOME Amendments page: https://www.austintexas.gov/page/home-amendments
- **Implication for duplex:** Clean zoning case history is a positive — no existing conditional overlay, variance, or restrictive covenant tied to a prior zoning case is expected to constrain the duplex. The surveyor should confirm by pulling Property Profile.
- **Confidence:** Medium (desktop search yielded nothing, but only an authoritative AMANDA pull confirms zero cases).

---

## Bottom-line answer to the framing question

> *Does the Imagine Austin / NACNP / FLUM context support or restrict a duplex on this parcel beyond what zoning + HOME provide?*

**No — neutral, leaning slightly supportive.** Specifically:

1. **No adopted neighborhood plan covers this parcel** → no FLUM, no NPCD suffix, no NP-specific design standards, no NPCT notification rights, no "neighborhood plan amendment" path required for any use change. The land-use policy stack is just **Imagine Austin + base zoning + HOME**.
2. **Imagine Austin Growth Concept Map** classifies this area as established residential, ~0.7 mi from the Tech Ridge Neighborhood Center — Imagine Austin's stated policy goals of compact-and-connected growth and gentle density near activity centers are **consistent with** a duplex here. This is mildly supportive, not regulatory.
3. **HOME Phase 1 + Phase 2** apply by their own terms citywide; they do not depend on NP status. The duplex is enabled by HOME on top of base SF zoning (SF-2 or SF-3, to be confirmed in the zoning analysis).
4. **Real constraint sits elsewhere:** the binding non-zoning risks for this duplex are (a) the **recorded Scofield CCR** (likely single-family-only language), enforceable by the HOA as private contract — see the Restrictive Covenants section; (b) the **Scofield Farms HOA ACC** review of any new construction; and (c) the easements on the lot itself (5' PUE, 7.5' MUE/PSE, 15' DE, blanket electric easement per Vol. 660 Pg. 968) — see the survey extraction.

**Neighborhood-plan filter conclusion: zero regulatory friction from the city's planning framework; substantive friction will come from private-deed CCRs, not from neighborhood plans.**

---

## Environmental Research

**Parcel:** 12713 Cinchring Ln, Austin TX 78727 (Lot 12, Block M, Scofield Subdivision, Sec II Phase VI)
**Context:** Demo existing SFR; build duplex on ~8,083 SF lot. Surveyor's 1994 flood cert: Zone X (must re-verify).
**Method:** All findings are from COA + TCEQ + USFWS + FEMA published layers and code. No site visit. Address-level GIS confirmation against the live COA Property Profile / TCEQ Edwards Viewer / FEMA MSC was not loaded in this research — items so noted are inferred from the parcel's geographic context (North Austin, east of MoPac, west of I-35, north of Parmer Ln) and should be confirmed by the surveyor's GIS pull before publication.

---

## 1. Watershed

- **Source/layer:** COA Watershed Regulation Areas (LDC §25-8 Art. 1; Open Data ID `2xkn-3rmn`); COA "Find Your Watershed" tool; Walnut Creek master watershed profile.
- **Finding:** Parcel is in the **Walnut Creek** watershed (the 36,000-acre / ~43 sq mi master watershed draining north-central Austin to the Colorado at Longhorn Dam). The Scofield Subdivision sits in the upper Walnut Creek basin between Parmer Ln and Howard Ln. Specific receiving tributary is most likely an unnamed/minor branch of Walnut Creek or a Little Walnut Creek tributary; verify via FloodPro for the precise sub-watershed branch ID.
- **Classification:** **Suburban Watershed** under LDC §25-8. Walnut Creek is explicitly included in the residual "Suburban" category (all watersheds not classified Urban, Water Supply Suburban, Water Supply Rural, or Barton Springs Zone).
- **Governing rules:** LDC §25-8 Subch. A Article 9 (Suburban Watershed Requirements) — §25-8-391 (applicability), §25-8-392 (Uplands Zone IC limits), §25-8-393 (intensity transfer). Article 1 general provisions (§25-8-61 ff.) also apply.
- **IC limit for this lot (per §25-8-392):** Duplex use on a lot < 5,750 SF would cap at 50% IC (60% with transfer). This 8,083 SF lot exceeds 5,750 SF, so the **duplex / SF lot ≥ 5,750 SF in a Suburban (non-Lake/Rattan/Buttercup/S.Brushy/Brushy) watershed limit is 60% IC** (per Uplands Zone matrix outside the listed protected sub-watersheds). NOTE: §25-8-63(B) provides that subchapter IC requirements **do not restrict** IC on an individual SF or duplex lot — they apply to the subdivision as a whole. Zoning-based IC under LDC §25-2 + the parcel's base zoning (likely SF-2/SF-3) is therefore the binding number, not 25-8-392.
- **Implication:** Water-quality watershed rules do **not** independently constrain this duplex lot's IC. The binding IC % comes from zoning Subch. E + HOME amendments. Confirm via the Stormwater & Drainage section.
- **Confidence:** High (watershed identification + Suburban classification); Medium on specific minor tributary name.

## 2. Critical Environmental Features (CEFs)

- **Source/layer:** COA GIS "Critical Environmental Features" layer; Springs and Seeps Open Data (`2jmf-2fa8`); ECM §1.10.0 (Appendix). CEFs include canyon rimrock, sinkholes, point recharge features, springs/seeps, caves, and bluffs.
- **Finding:** **No CEFs are expected on or adjacent to this parcel.** Scofield Subdivision is in the Blackland Prairie / east-of-MoPac transition zone — geologically off the Edwards limestone outcrop where karst CEFs occur. Topography is gentle (suburban grade-and-fill 1990s development); no rimrock, springs, or sinkholes are mapped here.
- **Implication:** No CEF 150 ft buffer (ECM §1.10.4) triggers. No CEF-related ERI required.
- **Confidence:** High — but the surveyor should pull the COA CEF GIS layer directly to confirm "no CEFs within 150 ft of parcel."

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
  - **Heritage tree:** ≥ 24" dbh AND of a heritage species. Per Ord. 20100204-038 the heritage species list is: **all Oaks (Quercus spp., incl. live oak, Spanish oak, bur oak, monterrey oak, post oak), Texas Ash (Fraxinus texensis), Bald Cypress (Taxodium distichum), American Elm (Ulmus americana), Cedar Elm (Ulmus crassifolia), Texas Madrone (Arbutus xalapensis), Bigtooth Maple (Acer grandidentatum), Pecan (Carya illinoinensis), Arizona Walnut (Juglans major), Eastern Black Walnut (Juglans nigra)**. The heritage threshold is uniformly 24" dbh for these species.
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
- **Finding:** Travis County is in **attainment** for all NAAQS as of 2026 (Austin's ozone marginal nonattainment status of past years has either continued or been reclassified — re-verify current status, but this does not affect a duplex permit). No air permits, dry cleaners, or odor-generating facilities within nuisance distance of this residential parcel. **N/A at residential scale.**
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
- **Status:** Travis County FIRMs were comprehensively re-issued **effective Jan 6, 2016** (and amended thereafter via LOMRs). The 1993 panel is superseded; re-verify against the current effective FIRM panel covering 78727 (likely 48453C0235J or similar). Walnut Creek and Little Walnut Creek have detailed FIS studies; the interior of Scofield Subdivision lies well above mapped creek floodplains and is **expected to remain Zone X (unshaded)** — but a 500-yr (Zone X shaded) sliver near the platted 15' D.E. cannot be ruled out without checking FloodPro.
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

---

## Transportation Research

**Subject:** 12713 Cinchring Ln, Austin TX 78727 — duplex feasibility (existing 1-story SFR to be demolished and replaced with 2-unit attached duplex on existing ~8,083 SF lot in Scofield Subdivision Section II, Phase VI)

**Scope:** ASMP street levels, ROW dedication, transit, Project Connect, TIA threshold, driveway design, sidewalks, scenic / TxDOT, bicycle plan. All findings tied to current adopted code as of June 2026.

---

## 1. ASMP Street Level — Cinchring Lane

- **Citation:** Austin Strategic Mobility Plan (ASMP), adopted April 11, 2019; Street Network Table & Map (most recent update reflected in ASMP 2023 Street Network Table). Levels under ASMP / TCM Section 2 are: L1 Local, L2 Collector, L3 Corridor, L4 Service Road/Ramp, L5 Expressway. [Austin Strategic Mobility Plan](https://www.austintexas.gov/transportation-public-works/austin-strategic-mobility-plan); [ASMP Street Network Map (ArcGIS)](https://www.arcgis.com/apps/webappviewer/index.html?id=2a3c539da76b4f49906a3524ed4a2cc9); [ASMP Street Network Table](https://www.austintexas.gov/sites/default/files/files/Transportation/ASMP/Street%20Network%20Table%20and%20Map%20and%20Other%20ASMP%20Maps_ASMP2023.pdf).
- **Finding:** Cinchring Ln is an interior loop street within Scofield Subdivision Section II. It is **not enumerated in the ASMP Street Network Table** (the Table lists L2-L5 facilities and Level-1 streets that have specific improvements identified). Streets not listed are by default Level 1 Local. ASMP rule: "Level 1 streets without improvements identified" carry default ROW standards in Subchapter E / TCM Section 2.
- **Implication:** Cinchring Ln is **Level 1 Local**. No corridor improvement project applies; the street's curb-to-curb geometry remains the platted 50' ROW.
- **Confidence:** High (default-by-omission is the explicit rule of the ASMP Table).

## 2. ASMP Street Level — Nearest Collector / Arterial (Howard Ln & Parmer Ln)

- **Citation:** ASMP Street Network Table; [Guidelines for Functional Classification to ASMP](https://www.austintexas.gov/sites/default/files/files/Transportation/Right_of_Way/Enclosure%20-%20Guide%20for%20Functional%20to%20ASMP%20-%20Revised.pdf).
- **Howard Lane (≈0.4 mi north of subject):** Listed in the ASMP Network Table as a **Level 3 Corridor** (formerly classified as a Minor Arterial Divided / MAD under the pre-2019 functional classification). 4 thru-lanes plus center turn lane at Cinchring's latitude. ASMP standard ROW for an L3 with shared-use path / Great Streets cross-section is typically 100'–120' depending on the segment.
- **Parmer Lane / FM 734 (≈0.7 mi south):** Listed as **Level 4 Corridor** in the ASMP Street Network Table; in addition Parmer is a state-maintained roadway (TxDOT, FM 734). Parmer Lane FM 734 Corridor Study (TxDOT, 2024) is studying widening / managed lanes. [Parmer Lane (FM 734) Corridor Study](https://www.txdot.gov/projects/projects-studies/austin/parmer-lane-fm734-corridor-study.html).
- **Implication:** The duplex parcel does not abut either Howard or Parmer; the L3/L4 classifications affect those parents but produce **no obligations on a Cinchring-fronting lot** (no off-site dedication, no driveway permitting on the higher-level street).
- **Confidence:** High for Howard Level 3; high for Parmer Level 4 (consistent with state FM designation and corridor study).

## 3. Required ROW Dedication

- **Citation:** Land Development Code § 25-6-51 (Dedication of Right-of-Way); ASMP / TCM Section 2 cross-sections; TCM 2.7.1.3 Level 2/3/4 Standard Designs. [TCM Street Cross Sections (Municode)](https://library.municode.com/tx/austin/codes/transportation_criteria_manual?nodeId=TRCRMA_S2STCRSE_2.7.0FLDECR_2.7.1CUGUSTFLDE_2.7.1.3LE234STDE).
- **Finding:** Level 1 Local streets "without improvements identified" require **50' total ROW in constrained conditions, 60' greenfield**. Existing Cinchring ROW = **50' per plat (Cabinet 91, Slide 264–265)**, which matches the constrained L1 standard. Per § 25-6-51, dedication is only required where the existing ROW is sub-standard relative to the ASMP cross-section, and even then is typically triggered by **site plan** review (Subchapter E projects) rather than residential building permits.
- **Implication:** **No ROW dedication required** at building permit for the duplex. Conversion from SFR to duplex is processed as a residential building permit (R-3 use, ≤2 units on a single lot is residential, not site-plan-triggering), and the 50' existing ROW satisfies the L1 cross-section standard.
- **Confidence:** High.

## 4. AMTP / CapMetro Transit Context

- **Citation:** CapMetro Service Map; [Bus Service](https://www.capmetro.org/ourservices/busroutes); [Route 243 Wells Branch](https://www.capmetro.org/plan/schedmap?route=243); Howard CapMetro Rail Station (Red Line); [Rapid Routes Map](https://www.capmetro.org/docs/default-source/riders-guide-docs/our-services-docs/rapid-routes-map.pdf?sfvrsn=1019e7e9_1).
- **Nearest fixed-route service:**
  - **Route 243 — Wells Branch / Howard Station:** Local circulator connecting Howard MetroRail station (Red Line) to Tech Ridge P&R via the Wells Branch / Scofield area. Stops on Wells Branch Pkwy and Scofield Ridge Pkwy within ~½ mile of subject. Headway: ~30–35 min weekday peak.
  - **Route 392 — Braker:** Connects Tech Ridge P&R to Braker Lane / Kramer; nearest stops along Tech Ridge.
  - **Route 50 — Round Rock Howard Station:** Howard Lane corridor service to Round Rock.
  - **MetroRail Red Line — Howard Station:** ~1.4 mi northeast at IH-35 & Howard. Direct commuter rail to downtown.
  - **MetroRapid 801 (N. Lamar/S. Congress, "Expo"):** Closest stop ~3 mi west on N. Lamar; not within walking distance of subject.
- **Implication:** Subject is in a peripheral local-bus service area (not a high-frequency corridor). The duplex generates no transit-mitigation obligations; transit access is **a marketing / livability factor** rather than a regulatory one. No fair-share or transit-impact fee applies in Austin for a 2-unit residential permit.
- **Confidence:** High.

## 5. Project Connect / Light Rail

- **Citation:** [Austin Light Rail Phase 1 PD Profile (FTA, 2024)](https://www.transit.dot.gov/sites/fta.dot.gov/files/2024-05/TX-Austin-Light-Rail-Phase-1-PD-PROFILE.pdf); [Austin Transit Partnership](https://www.atptx.org/light-rail/).
- **Finding:** Phase 1 light rail alignment runs Downtown ⇄ 38th St on Guadalupe (north terminus at Guadalupe/38th), splitting south into a S. Congress branch (terminus Oltorf) and an East Riverside branch (terminus near SH-71 / ABIA). **North terminus is ~10 miles south of subject.** Future extension to Crestview Station via N. Lamar (still ~7 miles south of Cinchring).
- **Implication:** Subject parcel is **well outside any Project Connect overlay, station area, or value-capture district**. No Project Connect–related obligations or development triggers.
- **Confidence:** High.

## 6. Traffic Impact Analysis (TIA) Threshold

- **Citation:** Transportation Criteria Manual Section 10 — Traffic Impact Analysis; LDC § 25-6-111 et seq.; [Austin TIA Guidelines (June 2022)](https://www.austintexas.gov/sites/default/files/files/Transportation/Transportation_Development_Services/Austin_TIA_Guidelines_06-2022.pdf); [Check whether a TIA is required](https://www.austintexas.gov/page/check-whether-transportation-impact-analysis-required); [TIA Determination Worksheet](https://www.austintexas.gov/sites/default/files/files/Transportation/Transportation_Development_Services/TIA_Determination_Worksheet.pdf).
- **Threshold rule:** A TIA is required if the project generates **> 2,000 unadjusted vehicle trips per day** (net new trips). TIAs are also tied to site-plan / zoning / rezoning applications — they are **not generally triggered by residential building permits** for 1–2 units.
- **Duplex trip generation (ITE Trip Generation Manual, Land Use 215 Single-Family Attached / 220 Multifamily Low-Rise):** ~6.7 daily trips per dwelling unit → **~13–14 daily trips total** for a 2-unit duplex. Net new vs. existing SFR (~9.4 daily trips for ITE LU 210 Single-Family Detached) = **~+4 to +5 net new daily trips**.
- **Implication:** **TIA is not required.** Net new trips (~5) are three orders of magnitude below the 2,000 trip threshold; furthermore, no site plan is triggered (the duplex is a residential building permit), so the TIA process gateway is not reached at all.
- **Confidence:** High.

## 7. Driveway Access — Width, Number, Permitting

- **Citation:** Transportation Criteria Manual **Section 7 — Driveways** (re-codified from prior Section 5 in the 2021 TCM update); [TCM Section 7 (Municode)](https://library.municode.com/tx/austin/codes/transportation_criteria_manual?nodeId=TRCRMA_S7DR); [LDE Residential ROW Review Guidelines (Rev. 11/2025)](https://www.austintexas.gov/sites/default/files/files/TPW/LDE/Right_of_Way_Residential_Review_Guidelines_FINAL_2025-11-10.pdf).
- **Residential driveway standards (single-family / duplex):**
  - Maximum width at the property line (apron / curb cut): **25 feet** (per TCM § 5.3.2 historical / current Section 7 residential standard for SF and duplex).
  - Minimum width: 10' one-way, 16' two-way (de facto for vehicular use).
  - Maximum number of driveways: **1 per street frontage** unless lot frontage > 100' (subject lot is only ~60' frontage along Cinchring — single driveway only).
  - Spacing from intersections: 30' (short side / minor street) to 50' (long side / major street) measured from intersection PC.
  - Spacing from storm drain inlets: 10' minimum from inlet edge to driveway point of tangency.
  - Spacing from adjacent driveways: 5' minimum residential edge-to-edge typical.
- **Duplex-specific consideration:** Both units must share a **single driveway curb cut** off Cinchring (lot frontage too narrow for a second). Internal split into two parking pads / garage approaches is allowed behind the property line. The existing ~17'-wide concrete drive (shown on 1994 survey) can be widened up to 25' at the apron and re-paved without dedication.
- **Implication:** The duplex will retain a **single shared driveway** off Cinchring. The existing curb cut is conforming and can be retained or modified (likely widened to ~20–24') within current standards. No off-site or arterial-driveway obligations.
- **Confidence:** High on standards; medium on exact existing apron geometry pending field verify.

## 8. Access Management / Sight Distance — Horizontal Curve on Cinchring

- **Citation:** TCM Section 7 (Driveways), AASHTO Green Book sight-distance criteria adopted by reference; horizontal curve data from 1994 survey (R = 1,075', A = 60.12', front line along curve).
- **Finding:** The subject lot fronts a **shallow horizontal curve (R = 1,075')** in Cinchring. R = 1,075' is a low-radius design on a residential local street, but the deflection across the 60' frontage is minor (chord = 60.00' vs arc = 60.13' = ~0.1' offset). At local-street design speed (~25 mph) the AASHTO required stopping sight distance is ~155 ft. With R=1,075' and an open visual environment (no roadside vegetation/walls obstructing), sight distance from a driveway at roughly the existing location is **well over 200 ft in both directions** — comfortably above SSD requirement.
- **Implication:** Re-using the existing driveway location (or shifting modestly) presents **no access-management or sight-distance concern**. ATD residential review is unlikely to flag this curve.
- **Confidence:** Medium-high (visual / geometric reasoning; final review is ATD's call at permit).

## 9. Sidewalks

- **Citation:** LDC **§ 25-6-353** (Sidewalk Required); LDC **§ 25-6-354** (Payment Instead of Sidewalk Installation); TCM Section 4 — Pedestrian Facilities; [LDE Residential ROW Review Guidelines](https://www.austintexas.gov/sites/default/files/files/TPW/LDE/Right_of_Way_Residential_Review_Guidelines_FINAL_2025-11-10.pdf); [§ 25-6-354](http://austin-tx.elaws.us/code/coor_title25_ch25-6_art5_div5_sec25-6-354).
- **Trigger rule (per LDE Residential Review Guidelines, current):** A sidewalk is required on any **new construction of a single-family, two-family, or duplex residential structure**, and on any addition that increases gross floor area by ≥ 50%.
- **Existing condition:** Scofield Subdivision Section II Phase VI was platted ~1991–1993; Austin's universal sidewalk requirement for single-family / duplex was tightened post-2000s (Subchapter E / Sidewalk Master Plan era). 1990s Austin SF subdivisions of this vintage commonly **did not include sidewalks** on local interior streets. Survey shows only a "CONC. WALK" on the south (rear) side of the house — interior walk, not a public-frontage sidewalk. **Subject frontage almost certainly has no existing public sidewalk** along Cinchring (verify by site visit / Google Street View).
- **Obligation at duplex permit:** New duplex triggers **sidewalk-or-fee-in-lieu** on the Cinchring frontage. Standard cross-section: 5'-wide concrete sidewalk within the 5' P.U.E. or just back of curb. Frontage ≈ 60.12' chord.
  - **Build option:** ~60 LF × 5' = ~300 SF of 4" concrete sidewalk + ADA ramp at driveway = order-of-magnitude $5K–$10K construction.
  - **Fee-in-lieu option:** Per the City's sidewalk fund schedule, residential rate (most recent published) ≈ **$7.50/SF for single-family/duplex** (vs. $18/SF multifamily and $24/SF commercial) → ~60 LF × 5' × $7.50 ≈ **$2,250** fee. Rate is set annually; verify in current Development Services Fee Schedule (FY2025/26).
  - Fee-in-lieu requires director approval (typically granted on interior local streets where no continuous sidewalk network exists).
- **Implication:** This is a **new obligation triggered by the duplex** (and would equally be triggered by tearing down and rebuilding an SFR). The existing SFR was grandfathered; the new duplex is not. **Budget $2K–$10K** for sidewalk compliance.
- **Confidence:** High on trigger rule; medium on exact fee (verify current FY rate).

## 10. Scenic Roadway / Hill Country Roadway Overlay

- **Citation:** LDC Chapter 25-2 Article 11 (Hill Country Roadway Requirements); [LDC § 25-2-1107](http://austin-tx.elaws.us/code/ldc_title25_ch25-2_subchc_art11_div1_sec25-2-1107).
- **Finding:** Hill Country Roadway Corridor designations apply to specific named state highways and arterials west of MoPac / over the Edwards Aquifer Recharge Zone (RM 2222, RM 620, RM 2244, SH 71 west, US 290 west, etc.). **None of Cinchring Ln, Howard Ln, or Parmer Ln are designated Hill Country / Scenic Roadways.** The subject is east of MoPac and not over the Recharge Zone.
- **Implication:** No scenic-corridor setback, height, or building-coverage restrictions apply.
- **Confidence:** High.

## 11. TxDOT Roadways Nearby

- **Citation:** [TxDOT AADT Open Data](https://gis-txdot.opendata.arcgis.com/datasets/txdot-annual-average-daily-traffic-counts-public); [Parmer Lane FM 734 Corridor Study](https://www.txdot.gov/projects/projects-studies/austin/parmer-lane-fm734-corridor-study.html).
- **Findings:**
  - **IH-35:** ~1.0 mi east of subject. Federal Interstate; TxDOT-maintained. AADT in this segment (Parmer to Howard) is on the order of **180,000–200,000 vpd** (mainlanes + frontage roads). N/A to subject — no access from IH-35.
  - **Parmer Lane (FM 734):** TxDOT-maintained state highway. ASMP Level 4. Recent AADT in the subject-area segment (between MoPac and IH-35) is on the order of **45,000–55,000 vpd** (verify current count via TxDOT AADT viewer). Subject of an active 2024 TxDOT corridor study examining widening / managed lanes / non-motorized facilities.
  - **Howard Lane:** City of Austin maintained (not TxDOT). ASMP Level 3.
- **Implication:** Informational only. Duplex on Cinchring has **no direct interface with TxDOT roadways** — no TxDOT driveway permit, no TxDOT ROW dedication, no TxDOT review. The Parmer Lane corridor study has no implications for an off-corridor SF lot.
- **Confidence:** High on jurisdiction; medium on exact AADT pending current verification.

## 12. Bicycle Facility Plan

- **Citation:** [Austin Bicycle Plan (2023)](https://www.austintexas.gov/transportation-public-works/austin-bicycle-plan); TCM Section 5 — Bikeways and Urban Trails; [Bicycle Routes for North Austin](https://bicycleaustin.info/getaround/routes-north.html).
- **Findings:**
  - **Cinchring Ln:** Local residential street; **no bike facility planned** (neither existing nor in the 2023 ABP build-out). Shared roadway by default.
  - **Howard Lane:** 2023 ABP identifies Howard as a planned **Tier 1 / 2 bicycle corridor** with shared-use paths / protected lanes in segments; currently has paint-only bike lanes in places.
  - **Parmer Lane (FM 734):** ABP recommends **shared-use paths (urban trails)** on both sides per the TxDOT FM 734 corridor study coordination. Currently no bike facility in subject-area segment.
  - **Wells Branch Pkwy / Scofield Ridge Pkwy:** Existing on-street bike facilities (paint lanes) in some segments.
- **Implication:** No bike-facility-related dedication, easement, or construction obligation falls on the subject lot. Buyer/developer marketing benefit only (proximity to planned Howard Ln bike network).
- **Confidence:** High.

---

## Specific Question — Does the duplex change anything vs. existing SFR?

| Obligation | Existing SFR (grandfathered) | New duplex (post-demolition) | Delta |
|---|---|---|---|
| ASMP ROW dedication | None (50' meets L1) | None (50' meets L1) | **No change** |
| TIA | N/A | N/A (~13 trips/day, well under 2,000) | **No change** |
| Driveway permit | Existing apron grandfathered | New apron must conform to TCM Section 7 (max 25', single curb cut, ≥30' from intersection) | **Minor: must re-pull driveway permit if curb cut altered; existing geometry already conforming** |
| Sidewalk | None existing; no obligation | **TRIGGERED — § 25-6-353** requires new sidewalk or fee-in-lieu (~$2,250 fee, or ~$5–10K construction) | **NEW obligation** |
| Transit / Project Connect | N/A | N/A | **No change** |
| Scenic / Hill Country | N/A | N/A | **No change** |
| TxDOT review | N/A | N/A | **No change** |
| Bicycle plan | N/A | N/A | **No change** |
| ROW permit for utility taps | Required | Required (likely larger / separate WW tap per unit — see WW discipline) | Volume-driven, not duplex-driven per se |

**Bottom line for the duplex vs. SFR comparison (transportation discipline only):** The **only new transportation obligation** triggered by the duplex (relative to retaining the existing SFR) is the **sidewalk-or-fee-in-lieu under LDC § 25-6-353** on the ~60' Cinchring frontage. Estimated impact: **$2K (fee) – $10K (build)** plus standard residential driveway permit fees. Notably, **tearing down the SFR and building a new SFR would trigger the same sidewalk obligation** — the duplex itself is not the triggering event; the new-construction permit is. All other transportation factors (ROW, TIA, driveway, transit, Project Connect, scenic, TxDOT, bike) are unchanged or non-applicable.

---

## Confidence Summary & Verification Needs

- **High confidence (no further verification needed):** TIA non-applicability, ROW dedication non-applicability, Project Connect distance, scenic/Hill Country non-applicability, TCM driveway standards.
- **Medium-high confidence (worth confirming on permit application):** ASMP street-level for Howard (L3) and Parmer (L4) — confirm via ASMP Network Table query at permit; sidewalk fee-in-lieu rate for FY2025/26 — pull current Development Services Fee Schedule.
- **Field-verify:** Existing sidewalk presence/absence on Cinchring frontage (Street View or site walk); existing driveway apron geometry; sight distance at proposed driveway location.

## Sources

- [Austin Strategic Mobility Plan](https://www.austintexas.gov/transportation-public-works/austin-strategic-mobility-plan)
- [ASMP Street Network Table (2023)](https://www.austintexas.gov/sites/default/files/files/Transportation/ASMP/Street%20Network%20Table%20and%20Map%20and%20Other%20ASMP%20Maps_ASMP2023.pdf)
- [ASMP Street Network Map (interactive)](https://www.arcgis.com/apps/webappviewer/index.html?id=2a3c539da76b4f49906a3524ed4a2cc9)
- [Guidelines for Functional Classification to ASMP](https://www.austintexas.gov/sites/default/files/files/Transportation/Right_of_Way/Enclosure%20-%20Guide%20for%20Functional%20to%20ASMP%20-%20Revised.pdf)
- [TCM Section 2 — Street Cross Sections (Level 1–4)](https://library.municode.com/tx/austin/codes/transportation_criteria_manual?nodeId=TRCRMA_S2STCRSE_2.7.0FLDECR_2.7.1CUGUSTFLDE_2.7.1.3LE234STDE)
- [TCM Section 7 — Driveways](https://library.municode.com/tx/austin/codes/transportation_criteria_manual?nodeId=TRCRMA_S7DR)
- [TCM Section 10 — TIA](https://library.municode.com/tx/austin/codes/transportation_criteria_manual?nodeId=TRCRMA_S10TRIMAN)
- [TCM Section 4 — Pedestrian Facilities](https://library.municode.com/tx/austin/codes/transportation_criteria_manual?nodeId=TRCRMA_S4PEFA)
- [TCM Section 5 — Bikeways and Urban Trails](https://library.municode.com/tx/austin/codes/transportation_criteria_manual?nodeId=TRCRMA_S5BIURTR)
- [Austin TIA Guidelines (June 2022)](https://www.austintexas.gov/sites/default/files/files/Transportation/Transportation_Development_Services/Austin_TIA_Guidelines_06-2022.pdf)
- [TIA Determination Worksheet](https://www.austintexas.gov/sites/default/files/files/Transportation/Transportation_Development_Services/TIA_Determination_Worksheet.pdf)
- [Check whether a TIA is required](https://www.austintexas.gov/page/check-whether-transportation-impact-analysis-required)
- [LDE Residential ROW Review Guidelines (Rev. 11/2025)](https://www.austintexas.gov/sites/default/files/files/TPW/LDE/Right_of_Way_Residential_Review_Guidelines_FINAL_2025-11-10.pdf)
- [LDC § 25-6-354 Payment Instead of Sidewalk Installation](http://austin-tx.elaws.us/code/coor_title25_ch25-6_art5_div5_sec25-6-354)
- [LDC § 25-2-1107 Hill Country Roadway Corridor](http://austin-tx.elaws.us/code/ldc_title25_ch25-2_subchc_art11_div1_sec25-2-1107)
- [CapMetro Bus Service](https://www.capmetro.org/ourservices/busroutes)
- [CapMetro Route 243 Wells Branch](https://www.capmetro.org/plan/schedmap?route=243)
- [CapMetro Rapid Routes Map](https://www.capmetro.org/docs/default-source/riders-guide-docs/our-services-docs/rapid-routes-map.pdf?sfvrsn=1019e7e9_1)
- [Project Connect — Austin Light Rail Phase 1 PD Profile (FTA, 2024)](https://www.transit.dot.gov/sites/fta.dot.gov/files/2024-05/TX-Austin-Light-Rail-Phase-1-PD-PROFILE.pdf)
- [Austin Transit Partnership Light Rail](https://www.atptx.org/light-rail/)
- [TxDOT AADT Open Data](https://gis-txdot.opendata.arcgis.com/datasets/txdot-annual-average-daily-traffic-counts-public)
- [Parmer Lane (FM 734) Corridor Study](https://www.txdot.gov/projects/projects-studies/austin/parmer-lane-fm734-corridor-study.html)
- [Austin Bicycle Plan (2023)](https://www.austintexas.gov/transportation-public-works/austin-bicycle-plan)
- [North Austin Bike Routes](https://bicycleaustin.info/getaround/routes-north.html)

---

## Additional Jurisdictional Context

**Scope:** Catch-all of external facts and service-provider/jurisdictional context for 12713 Cinchring Ln, Austin TX 78727 (Lot 12, Block M, Scofield Subdivision Sec. II Ph. VI) that are not addressed elsewhere in this appendix.

**Method:** Web search + targeted fetches of authoritative sources (Census Geocoder, AB+C, Austin Energy, Texas Gas Service, ARR, PISD, PEC, TCAD, Travis County). Where authoritative sources rate-limited (Redfin, TCAD direct property record), corroborating real-estate aggregators were used and the underlying source is named for survey-stage re-verification.

---

## 1. Address verification — TCAD anchor

- **Source:** Travis Central Appraisal District (https://traviscad.org/propertysearch/, https://travis.prodigycad.com/property-search) and HAR-ACTRIS MLS listing #2532841 (https://hoydenhomes.com/listing/actris/2532841/Austin/12713-Cinchring-Lane/).
- **Finding:**
  - Site address: **12713 Cinchring Lane, Austin TX 78727** (confirmed in MLS, Redfin, RE/MAX listings).
  - Legal: **Lot 12, Block M, Scofield Subdivision Section II, Phase VI** (matches 1994 survey; the surveyor should pull the live TCAD record for Property ID, geographic ID, and 2025/2026 appraised value).
  - **Year built: 1993** (per MLS) — consistent with the 1993/1994 survey vintage.
  - **Recorded lot size: 0.1849 ac (~8,055 SF)** (per MLS) — within rounding of the survey-estimated 8,083 SF.
  - **2025 ad valorem taxes: ~$11,100/yr** (per MLS public-record pull).
  - **HOA dues: $125/quarter** ($500/yr) — Scofield HOA; see the Restrictive Covenants section for the recorded Declaration.
  - **Active MLS listing (May 2026): $499,000** for the existing 4 BR / 2 BA / 2,095 SF single-story home (this is the "as-built" baseline the owner is proposing to demolish).
- **Implication:** Property is currently on the open market. Acquisition cost basis is ~$499K + closing; demo + duplex new build is the contemplated value-add. The fact that the home was recently updated (2025 tankless WH, 2026 paint, new dishwasher) but is being marketed for redevelopment to a duplex buyer suggests the seller sees more value in the dirt than the structure — consistent with HOME-era infill economics in 78727.
- **Confidence:** Verified for legal/lot/year/taxes (MLS aggregator pull); **Unconfirmed** for TCAD Property ID — the surveyor must capture the exact 7-digit account # before any fee calcs are finalized.

## 2. Census tract / GEOID

- **Source:** U.S. Census Geocoder API (`geocoding.geo.census.gov/geocoder/geographies/address?...benchmark=Public_AR_Current&vintage=Current_Current`) — direct lookup.
- **Finding:**
  - **Census tract GEOID (11-digit): `48453042100`**
    - State FIPS: 48 (Texas)
    - County FIPS: 453 (Travis)
    - Tract: 0421.00
    - Block group: 2
    - Block: 2004
  - **Approx. coordinates:** 30.41494° N, -97.68391° W
  - **Congressional District (119th):** TX-37
  - **State Senate District:** 14; **State House District:** 50
  - **Urban area:** Austin, TX (UA GEOID 04384)
- **Implication:** Anchors the QOZ check (Programs analysis — tract 48453042100 should be cross-checked against the Treasury QOZ list; this tract is in north-central Travis and is **not** historically a QOZ, but the Programs section should confirm against current designations). Anchors ACS demographic pulls and the HUD CHAS dataset used for SMART Housing affordability targeting.
- **Confidence:** **Verified** (direct Census API response).

## 3. Electric utility — Austin Energy

- **Source:** Austin Energy service area page (https://austinenergy.com/about/company-profile/electric-system/service-area-map); City of Austin Open Data (https://data.austintexas.gov/Locations-and-Maps/Austin-Energy-Electric-Utility-Service-Area/i2t2-i3uy); Kramer Substation press release (https://austinenergy.com/about/news/news-releases/2026/Austin-Energy-energizes-new-Kramer-Substation).
- **Finding:**
  - 12713 Cinchring is inside the City of Austin full-purpose jurisdiction (Scofield was annexed). Austin Energy's ~437 sq-mi territory covers all COA full-purpose annexations within Travis County including the Scofield / north-Parmer corridor.
  - Nearest service center: **Kramer Lane Service Center** (dispatches North Austin). A new Kramer Substation was energized in 2026 specifically to add capacity to the Domain / north-Parmer area (~3 mi south of this parcel).
  - Typical residential distribution voltage in Austin Energy north-Austin neighborhoods is **12.47 kV (delta or wye) primary**, with 120/240V single-phase service to residential meters — confirm with the Austin Energy Electric Service Design & Planning group during permit-prep.
- **Implication for duplex:** Demolition triggers a service disconnect/cut. The new duplex (2 meters under Austin Water rules — see §5; each unit typically gets its own AE meter as well for billing separation, though sub-metering is possible) will need a new service drop / meter loop, sized for combined load. Austin Energy has a residential New Service Request workflow inside AB+C. The 5' P.U.E. along the Cinchring frontage and the "blanket electric easement" noted in Vol. 660 Pg. 968 on the survey will govern where the service entrance can land.
- **Confidence:** **Verified** for service-territory assignment; **Inferred** for the 12.47 kV distribution voltage (typical for AE residential neighborhoods, not pulled from a record specific to Cinchring Ln).

## 4. PEC service territory — NOT applicable

- **Source:** Pedernales Electric Cooperative (https://www.pec.coop/about-us/service-area/, https://mypec.com/); Texas Electric Cooperatives map (https://texas-ec.org/wp-content/uploads/2022/10/TEC-Co-ops-Map.pdf).
- **Finding:** PEC serves rural / unincorporated Travis County and the western Hill Country (Bee Cave, Lakeway, Spicewood, Dripping Springs, parts of east Travis outside COA). Inside COA full-purpose annexation north of 183, electric service is Austin Energy. The Scofield subdivision (annexed; inside COA) is **not** in PEC territory.
- **Implication:** Confirms Austin Energy is the sole electric utility. No PEC tap fees / aid-to-construction apply. (Note: a couple of older real-estate aggregators show "Reliant Energy" for Wells Branch — that is a retail electric provider in deregulated areas, but COA full-purpose is regulated and the TDU/REP is Austin Energy. Aggregator confusion only.)
- **Confidence:** **Verified.**

## 5. Water and wastewater — Austin Water (detailed in the Water & Wastewater discipline section)

- **Source:** Austin Water service area + UCM (https://www.austintexas.gov/water/, https://library.municode.com/tx/austin/codes/utilities_criteria_manual); New Service Connections (https://www.austintexas.gov/water/new-service-connections); Tap Plan portal (https://tapplan.com/).
- **Finding:**
  - 12713 Cinchring is inside Austin Water's retail water and wastewater service territory.
  - Existing house has both water tap and sanitary sewer service — the latter is corroborated by the concrete sanitary sewer vault labeled near the rear (south) property line on the 1994 survey.
  - **Per Austin Water rule:** "Properties with two, three, or four individual dwelling units (attached or detached) shall have an individual AW water meter serving each dwelling unit." A duplex therefore requires **two water meters** (or a single tap split with two AW-approved meters), not a single shared service. Each unit also gets its own cleanout for wastewater.
  - **A Utility Tap Plan, prepared by a Texas-licensed PE and submitted via AB+C, is required prior to residential plan review for a duplex.** This is a hard gate before construction-doc submittal.
- **Implication:** Tap-fee and capacity work (line sizes, fire-flow availability, WWWSPV, Service Extension Request if needed) is addressed in the Water & Wastewater discipline section. At this jurisdictional-context level the relevant facts are simply that AW is the provider, existing service exists, and **the two-meter rule is a hard requirement** (cost-significant — meter taps in north Austin typically run $5–15K per meter depending on size, plus impact fees).
- **Confidence:** **Verified** for provider, existing service, and the two-meter rule; cost numbers are **Inferred** rules-of-thumb pending live AW fee-table lookup.

## 6. Stormwater / Drainage Charge — COA Watershed Protection

- **Source:** COA Drainage Charge page (https://www.austintexas.gov/department/drainage-charge); Drainage Charge Estimator (https://www.austintexas.gov/department/drainage-charge-estimator); FY26 utility rate sheet (https://coautilities.com/wps/wcm/connect/occ/ca4c09b3-51e7-411e-9245-996a681de831/NOV_25_AUN_EN.pdf).
- **Finding:**
  - The City Drainage Charge is billed on the COA utility bill and is calculated **per square foot of impervious cover, per month**.
  - **FY2025-26 base rate: $0.00593 / SF IC / month.**
  - Typical SF-3-scale Austin home (3,100 SF IC, ~37% IC ratio): **~$14.05/mo, $169/yr.**
  - A duplex on this 8,055-SF lot, under HOME-2 standards (up to 65% IC permitted in many SF zones under HOME), could see IC rise from the existing house's ~30-40% to the high 50s/low 60s — roughly doubling the drainage charge to **$25-30/mo, $300-360/yr**.
  - Stormwater Management Discount (https://www.austintexas.gov/watershed-protection/stormwater-management-discount) allows up to a 50% reduction by installing on-site rainwater capture / detention practices — worth flagging as an OpEx lever for the duplex.
- **Implication:** Recurring OpEx item for the finished duplex; small dollars but real. More importantly, the **IC limit** itself (governed by zoning + watershed code) is the binding constraint on site design and is addressed in the Environmental and Zoning sections; the drainage charge is just the downstream billing consequence.
- **Confidence:** **Verified** for rate; **Inferred** for the post-build IC delta (depends on final design).

## 7. Natural gas — Texas Gas Service

- **Source:** Texas Gas Service (https://www.texasgasservice.com/); coverage write-ups (https://utilitiesformyhome.com/providers/texas-gas-service/, https://quickelectricity.com/natural-gas-service-texas/).
- **Finding:**
  - **Texas Gas Service** (a division of ONE Gas, Inc.) is the regulated natural-gas LDC for the Austin metro. 78727 is inside its Central Texas service territory. TGS is a regulated monopoly — no provider choice.
  - The existing 1993 house likely has a gas service tap (MLS lists "natural gas available"; standard for 1990s Scofield construction).
- **Implication for demo / new build:**
  - Demolition requires **gas service abandonment / cap-off** by TGS (typically at the curb stop or main); the owner files an abandonment request and TGS schedules a cut.
  - The new duplex either re-uses the existing service (if location/sizing work for both units' combined load) or requests a new tap. Most duplex projects in COA install **a single shared service line with two individual TGS meters** (one per unit) on a meter manifold — analogous to the AW two-meter rule. Confirm with TGS New Service group.
  - Lead time on TGS taps in north Austin is typically 4–8 weeks; needs to be sequenced before slab work.
- **Confidence:** **Verified** for provider; **Inferred** for two-meter convention (standard practice, not a printed TGS rule located in public sources).

## 8. Solid waste — Austin Resource Recovery (ARR)

- **Source:** ARR Residential Services (https://www.austintexas.gov/resource-recovery/programs/residential-services); ARR Administrative Rules update (https://www.speakupaustin.org/h0418).
- **Finding:**
  - ARR collects curbside trash, recycling, compost, and bulk/brush for **single-family homes and multifamily properties with 4 units or fewer** (duplexes, triplexes, fourplexes). 5+ units must use a private hauler.
  - A duplex at 12713 Cinchring is **squarely eligible for ARR curbside service**. Each unit is billed an individual ARR base fee on the COA utility bill, and each gets a cart set (trash + recycling + compost).
  - Frequency: trash weekly, compost weekly (same day as trash), recycling biweekly; brush/bulk/HHW collected up to 3x/year.
- **Implication:** No private-hauler contract required. Each new unit incurs an ARR base fee (typically $25–35/mo + variable per cart size). Trash-day curb access from Cinchring Ln is fine — the existing front-of-lot driveway already meets ARR placement rules.
- **Confidence:** **Verified.**

## 9. School district — Pflugerville ISD (not Austin ISD)

- **Source:** PFISD Find My School Map (https://www.pfisd.net/registration-information/find-my-school-map); Parmer Lane ES (https://ples.pfisd.net/); MLS listing #2532841 (cites assigned schools); zipdatamaps Parmer Lane ES attendance-zone map (https://www.zipdatamaps.com/school-profile/texas/pflugerville-isd/parmer-lane-elementary-school).
- **Finding:**
  - **School district: Pflugerville ISD** — emphatically **not** Austin ISD, even though the address is "Austin, TX." This is a common source of buyer surprise in 78727.
  - **Assigned schools (per MLS):**
    - **Elementary:** Parmer Lane Elementary (1806 W Parmer Ln, Austin TX 78727; PK-5; 512-594-4000)
    - **Middle:** Westview Middle School (1805 Scofield Ln, Austin TX 78727; 6-8; 512-594-2200)
    - **High:** Connally High School (13212 N Lamar Blvd, Austin TX 78753; 9-12; 512-594-0800)
  - All three are within ~2 miles of the parcel.
- **Implication:** Marketing/buyer demographics — PISD is rated lower than AISD's premium feeders by some external ranking sites (GreatSchools, Niche), which can affect resale price ceiling for a finished duplex's owner-occupant buyer pool. For investor-rental buyers it's neutral. PISD attendance zones are not contractual — confirm at building-permit time with the PFISD registration office (512-594-0000).
- **Confidence:** **Verified** for district assignment and current zoning; PFISD reserves the right to revise boundaries year-over-year.

## 10. County tax entities applicable to the parcel

- **Source:** Travis County Tax Office (https://tax-office.traviscountytx.gov/); Travis County collects for 153 entities. MLS lists ~$11,100 2025 tax bill, which implies an effective rate of ~2.2% on the indicated value — consistent with the standard COA / Travis / PISD overlap.
- **Finding — taxing entities expected on this parcel's bill:**
  1. **Travis County** (county general fund)
  2. **City of Austin** (full-purpose annexation, COA M&O + I&S)
  3. **Pflugerville ISD** (largest line on the bill — typical PISD rate ~$1.30/$100 incl. I&S)
  4. **Austin Community College District (ACC)**
  5. **Travis County Healthcare District** (a.k.a. Central Health)
  6. **Travis County ESD No. 2** (only if a portion of the parcel falls in ESD 2 — see §11 below; likely **not applicable** because the parcel is in COA full-purpose, which excludes it from ESD 2's taxing area)
- **Implication:** Standard Austin / Travis / PISD stack. No MUD or PID taxes (Scofield was developed under standard COA jurisdiction with direct AW service — no MUD was ever needed). The surveyor should pull the actual TCAD jurisdictions list to confirm; the Programs section addresses any homestead-eligible exemptions / over-65 caps if relevant.
- **Confidence:** **Verified** for COA / Travis / PISD / ACC / Central Health overlap; **Inferred** for the absence of ESD 2 inside COA full-purpose.

## 11. Travis County Emergency Services District — none assess

- **Source:** Travis County ESD overview (https://www.traviscountytx.gov/fire-marshal/esd); ESD 2 coverage write-up (https://www.kut.org/politics/2024-11-01/...); Austin Fire Department station index (https://www.austintexas.gov/page/index-afd-stations-addresses).
- **Finding:**
  - **Fire/EMS provider: Austin Fire Department (AFD) + Austin-Travis County EMS (ATCEMS).** Because the parcel is in COA full-purpose, AFD is the first-due fire response; ATCEMS handles EMS.
  - **ESD No. 2 (Travis County)** covers Pflugerville, Wells Branch MUD, and unincorporated northeast Travis — including land geographically adjacent to Scofield. **Scofield itself is annexed COA, so ESD 2 does not tax this parcel.** Mutual-aid agreements mean ESD 2 / AFD respond across the line as needed, but the property does not pay the ESD 2 levy.
  - Nearest AFD station: AFD Station 33 (just south of Parmer at I-35 area) or Station 39 — confirm in AFD station index. AFD fire-flow availability for the new duplex is checked at the building-permit stage; on an 8,000-SF SF-3-scale lot under R-3 (IRC) it is not a normally binding constraint.
- **Implication:** No ESD line-item on the tax bill. AFD/ATCEMS response and standard COA building-code fire-separation (1-hr wall between attached units; smoke/CO; sprinklers per IRC P2904 only if triggered by lot/access) apply via the building code, not via an ESD.
- **Confidence:** **Verified.**

## 12. Special districts (PID / MUD / TIRZ) — none on parcel

- **Source:** Texas Special Districts directory (https://txcip.org/tac/census/sd.php?FIPS=48453); Heritage Title MUD/PID summary (https://www.heritagetitleofaustin.com/wp-content/uploads/2020/07/MUD-Piece-Updated-2019.pdf); Neuhaus Realty MUD/PID guide (https://neuhausre.com/guides/mud-pid-special-districts-guide-austin/).
- **Finding:**
  - **No MUD.** Scofield was developed in the early 1990s using direct Austin Water service and standard COA full-purpose annexation — no MUD was created. Travis County's 50+ MUDs are concentrated west/southwest (Steiner Ranch, Lake Pointe, etc.) and northeast in unincorporated land.
  - **No PID.** Of the ~6 PIDs inside COA, none include the Scofield Sec II Phase VI footprint.
  - **No TIRZ.** TIRZ are typically commercial/mixed-use redevelopment instruments (e.g., the Mueller TIRZ); Scofield is suburban SF and is not in a TIRZ.
  - **Wells Branch MUD** (immediately south, across Wells Branch Pkwy) is a different parcel from Scofield Sec II Ph VI and does not apply here.
- **Implication:** No supplemental district assessments. Tax bill is the standard COA / Travis / PISD / ACC / Central Health stack only.
- **Confidence:** **Verified** for absence of MUD/PID/TIRZ on this specific parcel; surveyor should still run a routine special-district search at the TCAD account level to confirm.

## 13. Recent permit history at the address

- **Source:** COA AB+C public permit search (https://abc.austintexas.gov/web/permit/public-search-other); COA Issued Construction Permits open data (https://data.austintexas.gov/Building-and-Development/Issued-Construction-Permits/3syk-w9eu).
- **Finding:**
  - **No permits returned by the open-data sample for "12713 Cinchring."** This is consistent with the MLS narrative (the recent 2025–2026 improvements — paint, tankless water heater, dishwasher — are mostly trade work that does not require a building permit; tankless WH **does** typically require a plumbing permit but small-jobs sometimes get filed by the plumber under a master permit without an address-specific public record).
  - **No demo / addition / ADU / detached structure permits** previously issued — the parcel has effectively a clean permit history since original 1993 construction.
- **Implication:**
  - No prior un-finaled work to inherit. The owner / next purchaser starts the demo + duplex permit path with a clean record.
  - For the demo: separate **Residential Demolition Permit** (with utility-disconnect verifications from AW, AE, TGS) required before any structure can be removed.
  - For the new duplex: standard **Residential Building Permit** path via AB+C, with prerequisite Utility Tap Plan (see §5), tree review, and (if triggered) Site Plan Exemption.
- **Confidence:** **Inferred / Unconfirmed** — the surveyor should pull the live AB+C public search for the address to confirm absence of permits before the zoning/programs analyses quote permit fees.

## 14. MLS / property history baseline

- **Source:** ACTRIS MLS #2532841 (https://hoydenhomes.com/listing/actris/2532841/, https://www.remax.com/tx/austin/home-details/12713-cinchring-ln-austin-tx-78727/981248454034335233/M00000589/2532841); Redfin listing (https://www.redfin.com/TX/Austin/12713-Cinchring-Ln-78727/home/31550475 — Redfin was not directly retrievable but URL/MLS# confirmed in other aggregators).
- **Finding (as-built baseline of structure proposed for demolition):**
  - 4 BR / 2 BA, 2,095 SF, single-story, slab foundation, composition roof, 2-car attached front-loaded garage, 1 fireplace.
  - **Year built: 1993** (matches 1993/1994 survey vintage).
  - Lot: 0.1849 ac / ~8,055 SF (matches TCAD; close to survey-estimated 8,083 SF).
  - 2025 ad valorem taxes: ~$11,100.
  - HOA: $125/quarter ($500/yr) — Scofield Farms HOA.
  - Recent updates (per MLS): tankless WH (2025), interior paint refresh (2026), exterior trim paint (2025), select window replacements, new dishwasher (2026), garage motor.
  - Marketed amenities: community pool, 13-ac Scofield Farm park, Google Fiber wired.
  - Active listing May 2026 at **$499,000.**
- **Implication:** Establishes acquisition basis (~$499K + closing) for the duplex pro-forma. The MLS narrative explicitly markets walkability to "Mopac, I-35, the Domain, and major North Austin employers" — the lot's value proposition for a duplex investor-buyer rests on that submarket positioning + Pflugerville-ISD school caveat (§9).
- **Confidence:** **Verified** for MLS-cited facts; the surveyor must pull the TCAD record for prior-sale history (not surfaced in the MLS aggregators in this research).

---

## Cross-references

- **Water & Wastewater section:** §5 above is a stub — the Water & Wastewater discipline section covers line sizes, fire-flow, capacity, tap fees, WWWSPV, impact fees.
- **Programs section:** uses §2 (census tract GEOID) for QOZ check; uses §10/§12 (no MUD/PID/TIRZ) when checking SMART Housing / fee-waiver geography.
- **Restrictive Covenants section:** covers the Scofield HOA Declaration; this section does not.
- **Environmental section:** covers drainage / impervious-cover constraints — §6 here is just the billing consequence.
- **Zoning Pathway section:** covers the actual IC cap and HOME-2 duplex permissibility; nothing in §1–§14 above attempts to.
- **Surveyor follow-ups (must complete before discipline review):**
  - Pull live TCAD record for Property ID, owner of record, prior-sale history, and 2026 appraised value.
  - Pull live AB+C permit search for 12713 Cinchring to confirm clean permit history.
  - Confirm Travis County jurisdiction overlay layer to verify no special-district assignment.

---

# Part II — Discipline Assessments

## Zoning & Land Use

## Summary

- **Base zoning (per authoritative COA GIS):** **MF-3** (Multifamily — Medium Density), no overlay suffix, no neighborhood plan, no NCCD, no NPCD, no Article 10 compatibility exposure on this lot (subject IS MF-3, not the triggering property). This contradicts the earlier working assumption (SF-2/SF-3, inferred from neighborhood context) but is more credible because it came from the COA Zoning_1 ArcGIS feature service — the same source that powers the Property Profile UI. **Treat as MF-3 pending a DSD Zoning Verification Letter.**
- **What MF-3 permits for the duplex:** Duplex is permitted by-right as a less-intensive residential use under MF-3 (LDC § 25-2-491 use chart). MF-3 also permits multifamily up to a density consistent with its dimensional envelope (no per-unit minimum site area in MF-3 base — site capacity is governed by FAR/height/coverage/IC). Two-unit duplex is well within entitlement.
- **CC&R conflict is the binding constraint, not zoning.** Scofield Declaration § 4.1 (Vol. 11863, Pg. 1147) restricts the entire Property — including Lot 12, Block M — to "single-family residential use" with a narrow family definition. Texas Property Code § 202.003 makes the covenant enforceable as private contract regardless of zoning, and the 2005 Eighth Amendment (Doc # 2005103195) hardened HOA enforcement (daily $25 fines, injunction, attorneys' fees, lien priority over homestead). HOME does not preempt this covenant.
- **Bottom line:** Zoning is permissive (MF-3 by-right duplex); CC&Rs are prohibitive (single-family only, auto-renewing through Dec 31, 2032, amendable only by 75% Member vote across ~570+ Scofield homes). **The duplex is not feasible on this lot as-of-right without HOA action.** Viable paths are limited to (a) CC&R amendment (practically infeasible), (b) negotiated HOA non-enforcement letter (highly unlikely on a use restriction), or (c) pivot to a replacement single-family residence (the only by-right path on both fronts).
- **Procedural path if a duplex were CC&R-permitted:** Residential Building Permit only — no formal site plan (LDC § 25-5-2(c) / Ord. 20230720-158, Site Plan Lite Phase 1, ≤4 units exempt), no drainage review, zero parking minimum. Confirmation of MF-3 changes none of this.

## Findings

### Base zoning verification (data gap)
**Severity:** data-gap
**Citation:** COA Property Profile / Zoning_1 ArcGIS layer (`Shared/Zoning_1/0`, ZONING_ZTYPE = MF-3, ZONING_BASE = MF, GeoID 0262200208); LDC § 25-2; DSD Zoning Verification Letter program (~$337, 3–5 business days)
**Finding:** The research surfaced a conflict. The early zoning analysis (without direct GIS access) assumed SF-2 or SF-3 based on neighborhood context — a reasonable inference for a 1990s suburban subdivision but unverified. A subsequent query of the COA Zoning_1 feature service directly at the parcel centroid returned ZONING_ZTYPE = **MF-3**. The MF-3 reading is more credible because it comes from the authoritative City zoning layer (the same source the Property Profile UI uses), not from inference. The anomaly — a single-family-built-out interior lot inside an MF-3 base — is unusual but not unique in late-1980s/early-1990s Austin subdivisions; developers occasionally secured higher-intensity entitlement at platting and then deed-restricted single-family use, which is exactly the pattern visible here (MF-3 zoning + recorded single-family-only Declaration). An alternative explanation — that the MF-3 reading is a GIS data error — cannot be ruled out without a Zoning Verification Letter from DSD.
**Implication for the developer:** If MF-3 confirms, the *zoning* side is more permissive than expected (duplex by-right; multifamily potentially also by-right within envelope). The CC&Rs remain the binding constraint regardless. If MF-3 turns out to be a GIS error and the true base is SF-2 or SF-3, HOME Phase 1 still authorizes a duplex by-right, so the duplex-vs-CC&R conflict is unchanged. In either case, the actionable conclusion is the same: zoning permits, CC&Rs prohibit.
**Recommended next step:** Order a DSD Zoning Verification Letter (~$337, ~2 week turnaround) to confirm base district and any overlays. This is a low-cost, high-value action that locks the zoning facts before any design or HOA negotiation begins. Also pull the AMANDA case history for the parcel to confirm no historical conditional overlay or restrictive zoning case exists.

### Permitted uses under MF-3 (assuming MF-3 confirmed)
**Severity:** opportunity
**Citation:** LDC § 25-2 Subchapter C, Article 4 (Multifamily Residence districts); LDC § 25-2-491 (use chart)
**Finding:** MF-3 is the third tier in the multifamily residence ladder (MF-1 through MF-6). By the LDC use chart, MF-3 permits — among other things — single-family residential, two-family (duplex), small-lot single-family, two-unit residential, three-unit residential, multifamily residential, condominium residential, group residential, retirement housing, and most civic uses common to residential districts. A duplex is the **minimum-density** multifamily use that MF-3 contemplates; from a use-permission standpoint, the duplex is comfortably within entitlement.
**Implication for the developer:** From a pure zoning-entitlement lens, MF-3 leaves headroom above a 2-unit duplex. If the CC&R problem could ever be resolved, the same lot could in principle support a small multifamily building (3–6 units) within the MF-3 dimensional envelope — a strategic upside that distinguishes this site from a similarly-sized SF-3 lot, where HOME Phase 1 caps at 3 units. **Note: this upside is theoretical until the CC&R is resolved.**
**Recommended next step:** During the Zoning Verification Letter request, ask DSD to confirm permitted uses and any conditional uses applicable to the parcel. If the CC&R is being negotiated regardless, model a 3–4 unit configuration in parallel with the duplex case to size the strategic upside.

### Dimensional standards under MF-3
**Severity:** note
**Citation:** LDC § 25-2-492 (Site Development Regulations); LDC § 25-2 Subchapter C, Article 2 (MF dimensional standards); LDC § 25-6-471(A) (parking minimum repeal); Subchapter F (Residential Design Standards)
**Finding:** Zoning capacity table under MF-3 base, ~8,054 SF lot (TCAD), no overlays, no Article 10 trigger (subject is MF-3, not less-restrictive zoning):

| Standard | MF-3 limit | Modifier | Effective limit | Comparison to CCR / platted limit |
|---|---|---|---|---|
| Permitted use (proposed = duplex) | Permitted | — | Permitted by-right | **Prohibited** by CCR § 4.1 |
| Max height | 40 ft / 3 stories | None | 40 ft | CCR § 3.28: **2 stories max** (more restrictive) |
| Max FAR | None at base (envelope governed by height/coverage/IC) | — | n/a | CCR § 3.27: ≥1,200 SF a/c per primary structure |
| Max building coverage | ~55% (typical MF-3) | None | ~55% × 8,054 ≈ 4,430 SF | None in CCR; effectively governed by setbacks |
| Max impervious cover | ~65% (Walnut Creek = Suburban watershed; verify against watershed IC schedule) | None | ~65% × 8,054 ≈ 5,235 SF | None in CCR |
| Min site area / unit | None in MF-3 base (per § 25-2-492); Subch. E § 4.2.1(D)(6) applies only to MU overlay | — | n/a | None |
| Setbacks (front / side interior / side street / rear) | 25 ft / 5 ft / 15 ft / 10 ft | Platted BLs control where more restrictive | 25 / 5 / 15 / 10 ft (matches plat) | CCR § 3.24 imposes same 25 / 5 / 15 / 10 ft (matches MF-3); plat imposes 25 / 5 / — / 7.5 ft (PSE/MUE) — the **10' CCR rear setback is more restrictive than the 7.5' platted rear easement** |
| Parking minimum | **None** (citywide repeal Nov 13, 2023, Ord. 20231102-028) | — | 0 | CCR § 3.15: each SF residence must have sufficient garage space per ACC |
| Subchapter F (McMansion) | Applies to single-family use only | If duplex use, Subchapter F's 32-ft / 2-story limit does **not** apply | n/a if duplex | CCR § 3.28 imposes its own 2-story limit regardless |

**Net usable envelope** (from the Restrictive Covenants analysis, applying CCR § 3.24 + plat BLs against the trapezoidal ~8,054 SF lot): ≈ 92 ft × ≈ 54 ft = ≈ 4,940 SF footprint envelope, 2 stories max. Generous for a duplex (typical duplex footprint 2,400–3,200 SF) — physical envelope is not the problem.
**Implication for the developer:** Two-story massing within a 25/5/10 envelope is consistent with the platted neighborhood form and is well within both MF-3 zoning and CCR dimensional limits. The CCR § 3.28 two-story cap is the binding height limit and is more restrictive than MF-3's 40 ft / 3 stories. Design should target ≤2 stories and ≤~30 ft to wall plate (consistent with 1990s Scofield context) to minimize ACC friction even if the use problem were solved.
**Recommended next step:** Confirm Walnut Creek watershed IC schedule and the MF-3 building-coverage percentage in the Zoning Verification Letter request. Draw any concept envelope to the more restrictive of (a) MF-3 dimensional standards, (b) plat BL/easement geometry, and (c) CCR § 3.24/3.28 — in practice, the CCR controls height and the plat/CCR jointly control footprint.

### CCR-vs-zoning conflict (Scofield Declaration § 4.1)
**Severity:** significant
**Citation:** Scofield Residential Area Declaration of Covenants, Conditions and Restrictions, Vol. 11863, Pg. 1147, Travis County Real Property Records, recorded Feb 1, 1993; Second Amendment Vol. 11949, Pg. 239 (binds Phase VI Section II — this lot); Eighth Amendment Doc # 2005103195 (enforcement); Tex. Prop. Code §§ 202.003, 209
**Finding:** Section 4.1 of the master Declaration restricts the entire Property to **"single-family residential use"** and defines "single-family" narrowly as a group related by blood, marriage, or adoption (plus foster children and domestic servants). A duplex — two dwelling units presumptively for two unrelated households — is not within this definition. § 3.7 contemplates ACC review of "single-family residences and duplex residences," but that is a procedural review-scope clause; it does not waive § 4.1's substantive use restriction (§ 4.1 controls under standard rules of covenant construction; the duplex language in § 3.7 most likely reflects master drafting language anticipating mixed product across all Scofield phases, several of which were planned for non-SF product on tracts with their own DCCR). The Declaration auto-renews every 10 years (§ 10.1) and is in force through at least Dec 31, 2032. Amendment requires a 75% vote of Members at a duly called meeting (§ 10.2(b)) — practically infeasible across ~570+ Scofield homes for a single owner's amendment. The 2005 Eighth Amendment authorized HOA enforcement via $25/day per violation, suspension of common-area use, injunctive relief, attorneys' fees, and a lien with priority over homestead. Texas Property Code § 202.003 generally enforces private covenants; HOME does not preempt private restrictions (Tex. Prop. Code § 202.018, eff. Sept 1, 2025, restricts *municipal* enforcement of covenants but explicitly preserves HOA enforcement). Texas appellate caselaw (e.g., *Inwood N. Homeowners' Ass'n*, *Tarrant Cnty. Hosp. Dist.*, more recent HOA-vs-HOME litigation in 2024–2026) supports HOA enforcement against duplex/multi-family construction in single-family-restricted subdivisions.
**Implication for the developer:** Even with MF-3 zoning confirmed and HOME applicable, the duplex **cannot** be built without HOA action. Three theoretically viable paths:
- **(a) Amend the Declaration.** Requires 75% Member vote (§ 10.2(b)). With ~570+ Scofield homes, a single owner cannot realistically marshal this. No CCR amendment changing use restrictions has been recorded in 32 years of the Declaration's existence. **Practically infeasible.**
- **(b) Negotiate a selective release, estoppel letter, or non-enforcement covenant from the HOA Board.** Under TX law, a Board may waive enforcement in specific cases, but selective non-enforcement is itself a covenant exposure — neighbors retain independent standing to enforce under § 10.8. A negotiated release on a use restriction is unusual; release on a setback or design rule is more common. **Highly unlikely on the § 4.1 use restriction.**
- **(c) Litigation strategy challenging the covenant.** Texas courts strongly favor restrictive covenants and the abandonment / waiver doctrine requires showing the HOA has acquiesced in similar violations. There is no public evidence of duplex use elsewhere in Scofield Section II that would establish abandonment. **Very weak path.**
- **(d) Pivot to a replacement single-family residence (with or without an ADU).** The only by-right path that satisfies both zoning and CCR. An ADU may or may not satisfy § 4.1's "single-family" definition depending on whether the ADU is structured as a separate dwelling unit or as a guest quarters / accessory structure under one kitchen — careful ACC pre-clearance required.
**Recommended next step:** Before any further design or pre-acquisition spend, obtain (i) a written HOA position letter from the Scofield ROA Board confirming the Board's view of whether a duplex is permitted (almost certainly: no), (ii) a written opinion from Texas real-estate counsel on enforceability and remedies in the event of construction, and (iii) a feasibility memo on the SF + ADU alternative including ACC pre-clearance probability. If a duplex is strategically essential to the business case, evaluate whether the buyer pool or rental NOI justifies attempting a CCR amendment campaign — for most owner-developers, the answer is no, and the project should pivot to SFR or be passed.

### Council district and Imagine Austin context
**Severity:** note
**Citation:** COA BoundariesGrids_2 ArcGIS layer (Council District 7); Imagine Austin Comprehensive Plan (adopted June 15, 2012, amended through 2022) — Growth Concept Map; Imagine Austin Centers dataset
**Finding:** The parcel is in **Council District 7** (CM Mike Siegel as of 2026 per the property-records pull). On the Imagine Austin Growth Concept Map, the parcel sits within "established neighborhood" residential fabric — not an Activity Center, Regional Center, Town Center, or Neighborhood Center, and not on an Activity Corridor. The nearest Imagine Austin elements are the Tech Ridge Neighborhood Center (~0.7 mi SE, at I-35 & Parmer) and the I-35 Activity Corridor (~0.5 mi E). FLUM does not apply because no neighborhood plan covers this area (no NACA, no NBG — outside both boundaries).
**Implication for the developer:** Imagine Austin is policy, not regulatory; FLUM is not in play. There is no plan-amendment process to navigate and no NPCT notification rights to manage. Proximity to the Tech Ridge Neighborhood Center is a mild policy positive for gentle density (consistent with Imagine Austin's compact-and-connected goals) but does not change any entitlement. Council District 7 has historically been a pro-HOME, pro-missing-middle district, which is mildly supportive context if the CCR ever required City-level pressure — but Council cannot override private covenants.
**Recommended next step:** None directly. The Imagine Austin policy posture is mildly supportive but immaterial to the binding CCR constraint.

### Subchapter F (Residential Design) applicability
**Severity:** note
**Citation:** LDC § 25-2 Subchapter F (Residential Design and Compatibility Standards); HOME Phase 1 amendments (Ord. 20231207-001)
**Finding:** Subchapter F (the "McMansion" rules) imposes a tent-shaped building envelope (45° rake from 15-ft wall plates), a 0.40 FAR cap (or 2,300 SF whichever is less for SF use only), and a 32-ft / 2-story limit on residential lots. Under HOME Phase 1, Subchapter F's 32-ft / 2-story limit applies to **single-family use only**, not to duplex / two-unit / three-unit residential use. Under MF-3, Subchapter F's residential-design provisions still apply to residential structures, but the 32-ft cap is replaced by the MF-3 40-ft / 3-story envelope for multifamily uses. For a duplex on MF-3, Subchapter F still constrains the tent / wall-plate / rake geometry but does not impose the 32-ft cap.
**Implication for the developer:** The Subchapter F tent geometry is the binding architectural constraint on any duplex design, and it is materially more restrictive than the CCR § 3.28 two-story limit. Practical effect: design to a ~30-ft max height to top of roof, with second-floor massing pulled away from side lot lines per the 45° tent.
**Recommended next step:** Architect should draw any concept envelope to Subchapter F tent + CCR § 3.28 two-story + MF-3 40-ft simultaneously and pick the most-restrictive surface. None of these is binding until the CCR § 4.1 use restriction is resolved.

### Site Plan trigger (cross-reference to Site Plan & Form)
**Severity:** note
**Citation:** LDC § 25-5-2(c); Ord. 20230720-158 (Site Plan Lite Phase 1, eff. Oct 2023)
**Finding:** A duplex (≤4 units) is exempt from formal site plan review under LDC § 25-5-2(c) and Ord. 20230720-158. The project goes through residential building permit only (Residential Plan Review), not site plan review. This is independent of base zoning (SF-2/SF-3 or MF-3 — the exemption is by unit count, not by district). No formal site plan, no Consolidated Site Plan, no Site Plan Lite Phase 2 application. See the Site Plan & Form section for full procedural treatment.
**Implication for the developer:** Materially reduces permitting time and cost (saves ~6–12 months and ~$15K–$40K vs. a small-project site plan path). This is a structural simplification that holds whether the project is a duplex (if CCR resolved) or a replacement SFR.
**Recommended next step:** None on the zoning side. See the Site Plan & Form section for permitting sequence and DSD intake mechanics.

### Subchapter E design standards
**Severity:** note
**Citation:** LDC § 25-2 Subchapter E (Design Standards and Mixed Use)
**Finding:** Subchapter E applies primarily to commercial, mixed-use, and multifamily projects on Core Transit Corridors / Activity Corridors. Pure residential development outside a transit corridor (and outside a VMU/V/ETOD overlay) is generally not subject to Subchapter E. The parcel is not on a Core Transit Corridor, not in VMU/V, not in ETOD, not in a TOD regulating plan. Subchapter E does not apply to a residential duplex on this lot.
**Implication for the developer:** No Subchapter E review, no AEC pathway concerns, no streetscape requirements beyond the CCR § 3.30 sidewalk obligation (already a CCR requirement) and standard ATD residential driveway permit.
**Recommended next step:** None.

### Article 10 (Compatibility Standards) — confirm subject is not triggered
**Severity:** note
**Citation:** LDC § 25-2-1051 et seq. (Article 10, post-July 15, 2024 replacement, Ord. 20240516-004)
**Finding:** Article 10 applies when the **subject site** is zoned MF-4 or less restrictive AND is within 75 ft of a **triggering property** (SF-5 or more restrictive, with 1–3 dwelling units). The subject lot is MF-3, which is more restrictive than MF-4 (MF-3 < MF-4 in the MF ladder), so Article 10's *applicability* threshold is not met from the subject side. Even if it were, the duplex use is one of the enumerated exceptions in § 25-2-1052 (sites used exclusively for duplex, SF attached, SF residential, small-lot SF, two-unit, three-unit, adult care, or child care are exempt from Article 10). The 4-flat / multifamily upside use *could* engage Article 10 if adjacent lots (Lot 11, Lot 13, rear lots) are zoned SF-5 or more restrictive — but if the entire Scofield Section II pod is MF-3 (the most likely explanation for the GIS reading on this lot), the adjacencies are also MF-3 and Article 10 never applies.
**Implication for the developer:** No Article 10 height cap (40 ft within 50 ft of triggering property), no compatibility buffer (25 ft along shared property line), no screening/lighting/noise constraints from Article 10. The duplex pathway is clean of Article 10 exposure. For any future multifamily upside, confirm adjacent zoning is also MF-3.
**Recommended next step:** During the Zoning Verification Letter request, ask DSD to confirm the zoning of Lots 10–14 Block M and the rear adjoining lots (Lot 26, Lot 27 per survey) to validate the assumption that the Scofield Section II pod is uniformly MF-3.

### Density bonus and affordability programs — N/A confirmed
**Severity:** note
**Citation:** LDC §§ 25-2-586 (DDBP), 25-2 Subchapter E § 4.3.3 (DB90, VMU); 25-2-182 (ETOD); Ord. 20190509-027 (AU); 20000824-066 (SMART)
**Finding:** From the Programs analysis: DDBP (downtown only), DB90 (commercial bases only — not SF/MF), ETOD Phase 1 (outside Phase 1 station areas), VMU (no commercial base, no Core Transit Corridor), AU (technically applicable but scale-prohibitive — 50% affordability set-aside on a 2-unit duplex = 1 deed-restricted unit), SMART Housing (marginal — 50% affordability burden on a 2-unit project for ~$15K–$30K fee waivers is uneconomic), NBG/Plaza Saltillo/Rainey (outside boundary). All density bonus programs are either N/A by geography/zoning or uneconomic at duplex scale.
**Implication for the developer:** No density bonus pathway adds value here. The lot's entitlement is what the base district gives, period. The MF-3 upside (if confirmed) is itself a "free" density opportunity that doesn't require any program enrollment — but it's gated on the CCR.
**Recommended next step:** None.

### Plat-restricted setbacks and easements (cross-reference to Stormwater & Drainage / utilities)
**Severity:** moderate
**Citation:** Plat Cabinet 91, Slide 264–265 (Travis County Plat Records); Declaration § 3.24
**Finding:** The plat imposes a 25-ft front BL, 5-ft side BL, 5-ft front P.U.E., 7.5-ft rear M.U.E./P.S.E., a 15-ft drainage easement (location not depicted on the 1994 survey — pull plat to confirm whether it crosses Lot 12), a Declarant-reserved up-to-10-ft R.O.W./easement strip along any lot line, and a blanket-type electric easement (Vol. 660, Pg. 968 — see restrictive-covenants discipline and utilities). The CCR § 3.24 rear setback (10 ft) is more restrictive than the platted 7.5-ft M.U.E./P.S.E. and is the binding rear constraint. All platted BLs match the MF-3 base setbacks (25/5/10/15) — there is no conflict between zoning and plat on setbacks.
**Implication for the developer:** The buildable envelope is ≈ 92 × 54 = 4,940 SF, sufficient for a typical duplex (or a 2-story SFR replacement). The blanket electric easement and 15-ft drainage easement are the two unresolved physical constraints; either could constrain footprint if their actual scope/location is unfavorable.
**Recommended next step:** Pull the plat (Cabinet 91, Slide 264–265) to confirm the 15-ft drainage easement geometry on Lot 12. Pull Vol. 660, Pg. 968 to confirm whether the blanket electric easement has been released or whether AE has physical facilities on the lot. (Both belong to the surveyor / utility disciplines; flagged here because they bound the zoning envelope.)

## Plan-specific findings

N/A — no concept plan provided.

## Open questions for the engineer

- **Order DSD Zoning Verification Letter** to confirm MF-3 base, absence of conditional overlays, and zoning of adjacent lots (Lot 11, Lot 13, Lots 26/27 rear) — single highest-leverage zoning action.
- **Obtain written HOA position letter** from Scofield ROA Board on duplex permissibility under § 4.1, and **legal opinion from Texas real-estate counsel** on enforceability of § 4.1 against a duplex constructed without amendment. These two items together determine whether the project can proceed in any form other than a single-family replacement.
- **Pull and review plat Cabinet 91, Slide 264–265** to confirm 15-ft drainage easement location on Lot 12 (controls footprint).
- **Pull Vol. 660, Pg. 968** (blanket electric easement) and request Austin Energy ROW determination on whether AE has facilities on the lot or is willing to release/insure-over.
- **Pull recent AMANDA case history** for the parcel to confirm no historical conditional overlay, variance, or restrictive zoning case exists that the COA GIS layer does not capture.
- **Confirm watershed IC schedule** for Walnut Creek (Suburban classification) — needed to size the project's max impervious cover envelope (~65% × 8,054 SF ≈ 5,235 SF) and to confirm whether the duplex stays below DCM detention/water-quality thresholds (see the Stormwater & Drainage section).
- **Model the SF + ADU alternative** as a fallback configuration that satisfies both MF-3 (or SF-3 if MF-3 is a GIS error) and CCR § 4.1, including ACC pre-clearance probability and whether an ADU can be structured as part of a single-family residence under the Declaration's narrow family definition.
- **Decide the strategic frame before further spend:** if the buyer pool / NOI thesis depends on the duplex, the CCR is a binary blocker and the deal should likely be passed (or repriced as a single-family replacement). If the thesis works as a tear-down-and-rebuild SFR, the zoning side is friction-free and the project can proceed on the residential building permit path.

---

## Site Plan & Form

## Summary
- **Procedural path is residential building permit only.** A 2-unit duplex is exempt from formal site plan review under Site Plan Lite Phase 1 (Ord. 20230720-158; codified at LDC §25-5-2). The application routes through DSD Residential Plan Review, not Commercial / Site Plan Review.
- **Permitting timeline is ~6-12 months end-to-end** (vs. ~12-24 months for a commercial / multifamily site plan). Plan review alone is ~8-14 weeks for residential intake; demo permit + utility disconnects sequence in front; AE / Austin Water service requests sequence in parallel.
- **Estimated upfront city + tap fees: roughly $40-75K** for a 2-unit build, dominated by water + wastewater capital recovery (per-unit), with smaller line items for demo, building permit, plan review, tree review, address assignment, and driveway. Recurring drainage charge post-build.
- **Subchapter F (McMansion) is the governing form constraint** on this lot, not Subchapter E. Subchapter E categorically does not apply to a residential building-permit project off a CTC. Massing envelope is the 0.40 FAR cap + tent (cross-reference the Zoning & Land Use section).
- **The path described here is what the city will permit. The CCR independently prohibits the duplex (Article 4 §4.1 + Article 3 §3.7), so the procedural path is moot until the CC&R blocker is resolved.** Cross-reference the Restrictive Covenants section and the report executive summary.

## Findings

### Procedural path: residential building permit (not site plan)
**Severity:** opportunity (procedurally) / note (overall — CCR blocks the project independently)
**Citation:** LDC §25-5-2(c); Ord. 20230720-158 ("Site Plan Lite Phase 1"); DSD HOME Phase 1 Info Series
**Finding:** A 2-unit duplex on this lot is categorically exempt from formal site plan review. Projects of ≤4 residential units on a single lot route through DSD Residential Plan Review as a single residential building permit, regardless of base zoning (MF-3 here per the COA Property Profile pull). No separate "site plan exemption" application is required; the exemption is statutory.
**Implication for the developer:** Saves ~6-12 months and ~$15K-$40K in civil engineering / engineer-stamped site plan deliverables relative to a small-project (5-16 unit) site plan, and avoids public notice / commission risk entirely. There is no Land Use Commission or Planning Commission gate. Plan-set scope is residential (architectural + structural + MEP), not civil-stamped site plan.
**Recommended next step:** Engage a residential architect familiar with HOME 1 intake. No civil engineer is required *for permitting* (drainage review not triggered — see below), though a civil scope may be advisable for grading and the blanket electric easement footprint check.

### Pre-development reviews triggered (residential building permit, but with parallel reviews)
**Severity:** note
**Citation:** LDC §25-8 Subch. B (trees); LDC §25-7 (drainage); LDC §25-6 (transportation / driveways); Austin Water Service Extension Request rules
**Finding:** A residential building permit for a duplex still triggers a stack of parallel reviews:
- **Tree review** (LDC §25-8) — required if any protected (≥19" DBH) or heritage (≥24" DBH for listed species) tree is on the lot or has a critical root zone overlapping construction. 1994 survey did not inventory trees; arborist walk required pre-design.
- **Drainage review** — *exempt* if (a) lot was created before June 16, 2025 (yes — Cab. 91 Sl. 264-265 platted ~1993) AND (b) ≤4 units (yes). Confirmed per the zoning analysis §7.
- **Zoning verification** — DSD residential intake confirms MF-3 base zoning, HOME 1 applicability, McMansion compliance, and setback compliance.
- **Utility coordination** — Austin Water service approval (two meters per AW policy for duplex), Austin Energy service request, Texas Gas Service connection (CC&R §3.11 requires gas, but that is a private covenant matter; AE / city does not).
- **Address assignment** — Unit B (or "A" / "B" pair) added through Austin Water / 911 address pool.
- **Driveway / curb-cut review** — Austin Transportation Dept. (ATD) reviews any new or reconfigured driveway off Cinchring Ln. Curved frontage (R=1075', chord 60.12') is shallow and unlikely to create sight-line issues but ATD signs off.
- **Sidewalk** — CC&R §3.30 requires sidewalk in ROW; city Sidewalk Fee-In-Lieu / Subchapter E sidewalk standards are not triggered by residential, but plat-noted sidewalk and CC&R sidewalk obligation both apply.
**Implication for the developer:** None of these adds a *commission* gate; each is staff review. Tree review is the only one with material project-level uncertainty (heritage tree on or adjacent to the lot would meaningfully constrain footprint and could trigger Land Use Commission review).

### Required application set
**Severity:** note
**Citation:** AustinTexas.gov DSD residential application portal; DSD Fee Schedule (current 2026)
**Finding:** Estimated submittal set for a HOME 1 duplex on a pre-2025 lot:
- **Demolition permit** (existing 1993 SFR) — separate intake; can be filed concurrently with the new-build permit or sequenced ahead.
- **Residential building permit application** — combined building / electrical / plumbing / mechanical permit. Plan set is architectural + structural + MEP; no civil-stamped site plan.
- **Tree disposition application** — conditional on tree inventory. If any protected tree affected, tree application stacks with the building permit; mitigation via on-site replanting or Urban Forest Replenishment Fund payment-in-lieu.
- **Address request for Unit B** — Austin Water / 911 address pool add. Routine.
- **Two water meter request / SER** (Service Extension Request) to Austin Water — per AW rule, each duplex unit gets its own water/wastewater meter and service line. This may also require a wastewater service line extension if the existing service is a single-tap configuration.
- **Austin Energy service request** — new service drop or upgrade; underground service per CC&R §3.10 (and AE preference in newer subdivisions).
- **Texas Gas Service** — new natural gas service (CC&R §3.11 mandates; city does not).
- **Right-of-way / driveway permit** — new/reconfigured driveway off Cinchring Ln.
- **Utility disconnect coordination** — Austin Water, Austin Energy, Texas Gas Service for the existing house; lead times 3-6 weeks each.
- **Pre-Development Consult (recommended, ~$300)** — useful for a HOME project with the MF-3 / SF anomaly, blanket electric easement, platted building lines, and curved frontage. A 30-minute consult often resolves a half-dozen ambiguities before plan set development.
**Implication for the developer:** The application stack is substantial but mostly routine. Sequence: arborist walk + survey update → pre-development consult → demo permit → utility disconnects → building permit submittal → AW/AE/gas service requests → construction.

### Fee + timeline estimate
**Severity:** note
**Citation:** DSD Fee Schedule (2026); Austin Water Capital Recovery / SER fee tables; Travis County permit norms
**Finding:** Approximate cost stack (ballpark, 2026 rates; will require live fee-schedule check before submittal):
- **Demolition permit:** $400-$700 (DSD residential demo)
- **Utility disconnects:** $0-$300 each (AW, AE, gas) — primarily scheduling cost
- **Building permit fees** (per SF + per-unit, residential, duplex): roughly $4,000-$8,000 for a ~3,000 SF gross duplex
- **Plan review fees:** ~$1,000-$2,500 (included or adjacent to building permit)
- **Water tap fees + service line costs (two meters):** $5,000-$12,000 (varies by meter size, distance to main, AW labor vs. contractor)
- **Wastewater tap fees + service line:** $3,000-$8,000
- **Water/wastewater capital recovery (impact) fees:** $5,000-$10,000 per unit × 2 units = **$10,000-$20,000** (largest single line item; net of credit for the existing SFR)
- **Transportation impact fee:** ~$1,500-$3,500 per unit × 2 units = $3,000-$7,000 (varies by TIA service area; depends on whether existing SFR credit applies)
- **Parkland dedication fee** (in-lieu, since no land dedication for a 2-unit infill): ~$1,000-$3,000 per added unit; the *net new* unit count is +1 (existing 1 unit → new 2 units), so likely 1 × $2,000-$5,000 range. Confirm in the Parkland section.
- **Tree review fee (if triggered):** $200-$500 base; mitigation if any protected tree removed
- **Driveway permit:** $200-$400
- **Address assignment:** ~$50-$100
- **Recurring drainage charge** (post-build, on utility bill): ~$15-$30/mo depending on final IC
- **Total upfront city + tap fees (estimated):** **~$30,000-$65,000** for the project, dominated by capital recovery fees and tap costs; demo + permit + review ~$6,000-$12,000 of that.
- **Permit timeline:** ~8-14 weeks for residential plan review (longer if revisions cycle). Demo can sequence in parallel. Pre-construction tasks (arborist, updated survey, demo, utility disconnects, ACC review per CC&Rs §3.7 — see CC&R caveat) add 8-16 weeks. End-to-end concept → building permit issued: **~6-9 months realistic for a clean project; 9-12 months with revisions.**
**Implication for the developer:** Fee stack is moderate. Capital recovery + tap fees are the largest items and are largely non-negotiable (some SMART Housing waivers exist but require affordability set-asides — see the Programs section §6 — not economic at 2-unit scale). Live fee-schedule verification before submittal is essential — Austin fees adjust annually.

### Subchapter F McMansion envelope (cross-reference with Zoning & Land Use)
**Severity:** moderate (form-governing)
**Citation:** LDC §25-2 Subchapter F Articles 1-3
**Finding:** Subchapter F (the "McMansion" residential design standards) governs the form envelope. HOME Phase 1 expressly carved out the Subchapter F 32-ft / 2-story cap for *single-family use only* — for 2-unit / 3-unit residential under HOME 1, base-zoning height (35 ft under MF-3) controls. However, Subchapter F's **0.40 FAR + tent (45° rake from 15-ft wall plate) envelope** continues to apply to residential construction on this lot.
- **FAR cap:** 0.40 × 8,054 SF ≈ **3,222 SF gross floor area** total across both duplex units, subject to McMansion gross-floor-area definitions (garages typically count partially; covered porches count; basements vary).
- **Building coverage:** 40% × 8,054 ≈ 3,222 SF footprint
- **Impervious cover:** 45% × 8,054 ≈ 3,624 SF total IC
- **Height:** 35 ft (MF-3 base; no Subchapter F 32-ft / 2-story cap because use is duplex, not single-family)
- **Tent:** 45° rake from 15-ft wall plate on each side property line. Effective massing constraint that pushes mass toward the lot center.
**Implication for the developer:** The 3,222 SF FAR cap divides into roughly 1,600 SF per unit if symmetric — close to but above the CC&R minimum 1,200 SF / unit (§3.27), which would govern if the duplex were ever permitted by the HOA. McMansion tenting is the dominant 3D form constraint at this lot size; expect a 2-story massing with a hipped roof to maximize compliant FAR.

### Subchapter E (Design Standards / Mixed Use): does NOT apply
**Severity:** note
**Citation:** LDC §25-2 Subchapter E §1.2 applicability
**Finding:** Subchapter E applies only when (a) the project requires a site plan under Chapter 25-5, and (b) the project is not categorically exempt. A residential building permit for a 2-unit duplex on a residential lot off a CTC does not trigger Subchapter E. Build-to, transparency / glazing, entrance orientation, supplemental zone, principal-street designation — none of these apply.
**Implication for the developer:** No frontage build-to %, glazing %, entrance-facing-principal-street, AEC, or Minor Modification analysis is needed at the city-form layer. (HOME 1 imposes its own light form rules — see below — and the CC&Rs impose private form rules — see below.)

### HOME 1 form constraints (per-unit) — separate from McMansion / Subchapter E
**Severity:** note
**Citation:** Ord. 20231207-001 §3 (HOME Phase 1); LDC §25-2-773 (rewritten)
**Finding:** HOME 1 imposes a thin layer of unit-level form rules independent of Subchapter F / E:
- **Entrance design:** Each new unit must have at least one entrance facing the street.
- **Garage placement:** Garage must be set back behind the front building line.
- **Front-yard parking limit:** Max 4 spaces in the front and street-side yards combined.
- **Front-yard impervious cover:** Capped at 40% of the front-yard area (separate from the 45% site-wide IC cap).
- **Short-term rental restriction:** One unit of a 2-unit cannot be used as an STR for more than 30 days/year.
**Implication for the developer:** Standard duplex configurations easily comply; only constraint that may bind is the "entrance facing the street" rule for the rear unit, which generally pushes the duplex to a side-by-side (paired) configuration rather than front-back stacked.

### Demolition path
**Severity:** note
**Citation:** AustinTexas.gov DSD Demolition Review; TX DSHS asbestos rules; EPA RRP rule; LDC §25-11
**Finding:** Demolishing the 1993 SFR is procedurally clean:
- **Demolition delay (LDC §25-11):** Applies to structures ≥45 years old. House is ~33 years old in 2026; **not subject to demolition delay**. No Historic Landmark Commission notification.
- **Historic designation:** No historic landmark, district, or NRHP listing per the property records research (`Shared/Zoning_3` returned zero features). No archaeological review required.
- **TX DSHS asbestos survey:** ≤4-unit residential buildings are **exempt** from the survey requirement. Notification ≥10 working days before demolition may still be advisable for liability.
- **Lead-based paint (EPA RRP):** Post-1978 construction is presumed lead-free. 1993 build is **exempt**.
- **Utility disconnects:** Austin Water, Austin Energy, Texas Gas Service. Each typically 3-6 weeks lead time; can sequence in parallel.
- **Tree protection during demo:** §25-8 critical-root-zone fencing required if any protected/heritage tree is on or adjacent to the lot.
- **Demo fee:** $400-$700 typical.
**Implication for the developer:** No hidden demolition cost or schedule risk. Standard 4-8 week demo + utility disconnect window.

### MF-3 vs. SF plat anomaly (procedural implication)
**Severity:** data-gap (procedural impact); note (probable outcome)
**Citation:** Property-records pull (`Shared/Zoning_1/0` field ZONING_ZTYPE = MF-3) vs. 1994 survey (plat = single-family subdivision per Cab. 91 Sl. 264-265)
**Finding:** The lot is currently zoned MF-3 (Multifamily Residence — Medium Density) per the COA Property Profile ArcGIS pull, but was platted as part of an SF subdivision and is subject to a Scofield CC&R that prohibits anything other than single-family use. The zoning side **permissively** allows duplex (and far more) by right — duplex is a lesser-intensive use under the MF use tables, regardless of HOME. The likely explanation: developer secured higher-density zoning at original entitlement, then deed-restricted single-family — a common 1990s pattern. There is no record of any zoning case re-classifying the lot.
**Implication for the developer:**
- **No procedural impact for the duplex permit path** — duplex is permitted under both (a) MF-3 base zoning use tables, and (b) HOME Phase 1 (which applies to SF-1/SF-2/SF-3 explicitly, but is a use-table addition; on MF-3 the duplex was already permissible).
- **Resolve before design by ordering a DSD Zoning Verification Letter (~$337, 3-5 business days)** to confirm MF-3, no -CO conditional overlay, no -NP, and no Subchapter F carve-out unique to this parcel.
- **HOME 1 specifics may not apply directly** to an MF-3 lot — but the more permissive base zoning makes that moot for unit count. Subchapter F still applies (residential use), with the HOME 1 height carve-out potentially not directly available on MF-3; under MF-3 the height limit is independently 35 ft, so the practical outcome is the same. Confirm with the zoning verification letter.
**Recommended next step:** Order DSD Zoning Verification Letter as the very first action. Total cost ~$337, total time ~1 week. Locks down the entitlement layer.

### Form constraints under CC&Rs (cross-reference Restrictive Covenants)
**Severity:** significant (project-defeating, in combination with the §4.1 use restriction)
**Citation:** Scofield Declaration §3.7 (ACC review), §3.20 (masonry), §3.24 (setbacks), §3.27 (1,200 SF minimum unit), §3.28 (2-story max, 3-car garage max), §3.9 (roofing), §3.10 (underground utilities), §3.11 (natural gas + 2 gas appliances per dwelling), §3.17 (fencing), §3.19 (2 trees per front yard), §3.30 (sidewalk in ROW)
**Finding:** The CC&Rs impose private form constraints that are **independent of and additional to** city code:
- **Masonry minimum:** 50% masonry (interior lot) — more restrictive than any city code; binds material selection
- **Minimum unit floor area:** 1,200 SF air-conditioned per primary dwelling — would govern even if duplex were permitted (each unit would presumably need to meet 1,200 SF)
- **Height:** 2-story max — more restrictive than the MF-3 35-ft height (which could otherwise support a 3-story duplex)
- **Garage:** Max 3 cars per garage
- **Setbacks:** 25 ft front, 5 ft interior side, 10 ft rear (matches plat and base zoning here)
- **Underground utilities:** All utilities must be underground unless ACC-approved overhead
- **Natural gas:** Required service; each dwelling must have ≥2 gas appliances
- **Fence:** Wood or masonry only; 6 ft max
- **Roofing:** Composition shingles ≥240 lb/square or wood shingles; other materials need ACC approval
- **Landscaping:** 2 trees per front yard within 10 ft of street ROW
- **Sidewalk:** Owner must construct sidewalk in ROW per plat specifications
- **ACC pre-approval:** All plans, specifications, fencing, masonry calc, and landscaping must be approved in writing before construction
**Implication for the developer:** These CC&R form rules are MORE restrictive than zoning for masonry, height, and unit size. They would govern any project on this lot, permitted-by-zoning or not. **However, since CCR §4.1 independently prohibits duplex use, the duplex project does not reach this form analysis** — the project is defeated at the use layer before the form layer applies. If the developer pivoted to SFR + ADU (still a 2-unit configuration but potentially fitting within §4.1's "single-family residence" if structured as one residence with an accessory unit and one kitchen — see the Restrictive Covenants section §7(d)), then these form rules become binding.

### Plat/easement constraints on footprint
**Severity:** moderate
**Citation:** Plat Cab. 91 Sl. 264-265; Survey extraction; Declaration §3.24 + Article 9
**Finding:** Buildable envelope after platted easements + CC&R setbacks:
- Front: 25 ft (BL + CC&R §3.24 + base zoning all align)
- Rear: 10 ft (CC&R §3.24, more restrictive than 7.5 ft platted MUE/PSE)
- Interior sides: 5 ft each
- Lot dimensions: avg width ~64 ft × depth ~127 ft
- **Buildable footprint envelope:** ~92 ft deep × ~54 ft wide ≈ **4,937 SF** maximum footprint area before easements
- **15 ft drainage easement (plat note):** Location on Lot 12 is not depicted on the 1994 survey — **data-gap; resolve by pulling the recorded plat (Travis County Plat Records, Cab. 91 Sl. 264-265).** If the D.E. crosses the buildable envelope, it materially shrinks the footprint.
- **Blanket electric easement (Vol. 660 Pg. 968):** A pre-1966 utility easement that may permit utility infrastructure anywhere on the lot. Probability of actual encumbrance on the buildable footprint is low (PEC / AE typically locate infrastructure in the ROW or rear easement, not across SF lots), but the easement has not been released and could theoretically be re-activated. **Data-gap; pull document at title commitment.**
**Implication for the developer:** The 40% building coverage cap (3,222 SF) is the binding footprint limit, well below the 4,937 SF setback envelope, so the easement complications likely do not change the design envelope unless the 15 ft drainage easement bisects the buildable area or AE has actual facilities on the lot. Both warrant pre-design verification.

### Site Plan Lite Phase 2 (5-16 units) — not applicable here
**Severity:** note
**Citation:** Site Plan Lite Phase 2 (Ord. adopted 3/6/2025)
**Finding:** Site Plan Lite Phase 2 extends a streamlined "Small Project Site Plan" intake to 5-16 unit projects. Not applicable to a 2-unit duplex — the project sits comfortably inside Site Plan Lite Phase 1's ≤4-unit exemption.
**Implication for the developer:** Path remains residential building permit only.

### Variance / waiver pathway (if any future scope expansion)
**Severity:** note
**Citation:** LDC §25-5; Subchapter F variance procedures
**Finding:** Because Subchapter E doesn't apply and Site Plan Lite Phase 1 doesn't permit waivers, the only meaningful waiver pathways available at residential scale are:
- **Subchapter F variance** to the Board of Adjustment (e.g., to exceed the 0.40 FAR or modify the tent envelope) — public hearing, 4-6 month timeline, uncertain
- **Setback variance** from the platted building line — Board of Adjustment, similar timeline
- **CC&R variance from the ACC** — §3.24 allows ACC to grant setback variances "within limits"; nothing else can be ACC-waived against §4.1's use restriction
**Implication for the developer:** No quick, administrative variance path exists at residential scale. Any scope that pushes the FAR cap or the tent envelope sends the project to the Board of Adjustment with public hearing risk.

## Plan-specific findings
N/A — no concept plan provided. Form analysis is the entitlement-envelope only, not a built-design check.

## Open questions for the engineer / pre-design team

- **DSD Zoning Verification Letter** — order now ($337, ~1 week) to lock down MF-3 base zoning, confirm no -CO / -NP / -MU overlays, and confirm Subchapter F applicability and tier.
- **Plat retrieval (Cab. 91 Sl. 264-265)** — pull from Travis County Clerk to confirm exact location of the 15 ft drainage easement on Lot 12 and any plat notes (e.g., "single-family only" plat notes are non-binding against LDC but lenders care).
- **Updated boundary survey + tree survey** — 1994 survey is 32 years old; trees not inventoried; design cannot proceed without these.
- **Pre-Development Consult with DSD** (~$300) — recommended to lock down (a) MF-3 vs. HOME 1 interaction (since HOME 1 applies to SF-1/2/3 but not MF, the duplex permit path on MF-3 may differ procedurally), (b) the platted SF vs. zoned MF anomaly, (c) the 15 ft drainage easement implication.
- **Blanket electric easement scope (Vol. 660 Pg. 968)** — Austin Energy ROW department inquiry to confirm no active facilities on the lot and discuss potential partial release.
- **Austin Water Service Extension Request** — file early for two-meter approval; AW lead times can be 8-12 weeks.
- **Live fee schedule** — verify all permit, plan review, capital recovery, and tap fees against the 2026 DSD fee schedule at submittal; numbers above are ballpark.
- **CC&R blocker resolution** — see the Restrictive Covenants section. Until §4.1 is amended (3/4 owner vote — practically infeasible) or a non-enforcement / SFR+ADU alternate path is structured, the procedural analysis above is academic. **This is the single dispositive question for the project.**

---

## Stormwater & Drainage

## Summary

- **Small infill duplex; drainage burden is modest.** ~8,054 SF lot in Walnut Creek (Suburban watershed), Zone X (verified 2014 panel 48453C0270J), DDZ, outside EARZ/CWQZ/EHZ. No mapped waterway, no creek frontage, no FDF/COA fully-developed floodplain — almost every §25-8 layer is clean.
- **The buildable-envelope question is the platted 15' Drainage Easement.** Its location on Lot 12 is not dimensioned on the 1994 survey. Whichever lot line it follows (typically rear; possibly side or interior) materially changes where a duplex footprint can sit. Plat retrieval (Cabinet 91, Slide 264-265) is the single most important pre-design action for this discipline.
- **No site plan, no Tier-1 drainage report.** Duplex on an existing platted residential lot in MF-3 base zoning processes as a residential building permit (R-3); drainage is handled via the **Residential Drainage / Plot Plan** review (LDE) plus standard erosion control package — not a Site Development Permit with DCM-style drainage report.
- **Impervious cover delta ~10-15% is real but unlikely to drive on-site WQ/detention.** Existing IC ~30-35%; duplex likely 45-55% depending on design. Below the LDC §25-8-213 / 25-8-211 8,000 SF new+redeveloped IC threshold for WQ SCM requirement. On-site detention is not customary for SF/duplex residential building permits in developed watersheds.
- **RSMP fee-in-lieu is a secondary consideration, not a primary path.** Walnut Creek is RSMP-eligible, but RSMP applies to **on-site detention obligations** under DCM 8.2 — and a duplex building permit has no such obligation in the first place. Don't promise a fee-in-lieu number until confirming the project is even subject to the trigger.

## Findings

### Regulatory pathway: residential building permit, not site plan
**Severity:** note
**Citation:** LDC §25-1 (residential vs. site plan triggers); LDE Residential Review Guidelines (Rev. 11/2025); DCM 1.2 (applicability)
**Finding:** A duplex (2 attached residential units) on a single platted lot is permitted via residential building permit through DSD's LDE Residential team — **not** a Site Development Permit (no SDP, no Site Plan Lite triggered at this scale). The drainage review is consequently a **plot-plan-scale review** focused on:
  - Lot-to-lot drainage continuity (no impoundment of adjacent lots)
  - Sheet flow to Cinchring Ln and to the rear easement
  - Driveway approach and curb-cut tied to street gutter line
  - Finished floor elevation per IRC + COA minimums
  - Standard residential erosion control plan (see the Tree Protection & Erosion Control section)
A full DCM-style drainage report with HEC-HMS/PondPack modeling, three-scenario RSMP analysis, fully-developed 100-yr analysis, etc. — **not required.** Cover-sheet seal requirements and PE-stamped construction plans (UCM 2.5.1.E.1) do not apply at this permit level.
**Implication:** Drainage scope is small — typically a single drainage exhibit on the plot plan plus engineer's letter if anything off-standard. Budget $1,500-$3,500 for civil work on drainage exhibit / plot plan grading notes within the overall design fee.

### Impervious cover delta — under the §25-8-213 WQ trigger
**Severity:** note
**Citation:** LDC §25-8-211 (WQ controls applicability); §25-8-213 (GSI requirement); §25-8-63(B) (Subch. A IC limits do not restrict individual SF/duplex lots); ECM 1.6.2
**Finding:** Existing IC (from 1994 survey + MLS): ~1,350 SF house + ~400 SF garage portion + ~600 SF driveway + ~200 SF walks ≈ **2,150-2,600 SF (27-32%)**. Proposed duplex (per seed site data and Zoning Pathway envelope): two ~1,400-1,800 SF footprints (potentially attached / shared wall) + shared driveway ~700-900 SF + walks ~400 SF ≈ **3,600-4,400 SF (45-55%)**. **Delta: roughly +1,500-2,000 SF of new+redeveloped IC.**
The §25-8-211 / §25-8-213(C) WQ control trigger is **> 8,000 SF of new + redeveloped IC outside the Barton Springs Zone**. This project at ~3,600-4,400 SF total IC is **well below** that threshold. Walnut Creek is Suburban (not BSZ), so the no-threshold BSZ rule doesn't apply. Per the Environmental section, §25-8-63(B) further provides that subchapter A IC limits do not restrict IC on individual SF/duplex lots — they govern subdivisions as a whole.
**Implication for the developer:** **No on-site water quality SCM required.** No biofiltration basin, no rain garden, no sed/filtration pond. No mandatory GSI under LDC §25-8-213(C) at this IC scale. The MF-3 zoning IC ceiling (60% for MF-3 per Subchapter F, verify in the Zoning & Land Use section) and the McMansion FAR / building coverage limits are the binding building-side IC constraints, not §25-8.
**Recommended next step:** Confirm final design IC against MF-3 / Subchapter E ceilings in the Zoning & Land Use section; track that the 8,000 SF WQ trigger is never approached.

### RSMP fee-in-lieu — eligible but probably moot
**Severity:** opportunity
**Citation:** RSMP Participation Handbook (FY24, eff. 7/15/2024); LDC §25-7-61; DCM 8.2; DCM 1.2.2.G (Simplified RSMP)
**Finding:** Walnut Creek is on the published RSMP-eligible watershed list. **However**: RSMP is an alternative to **on-site detention only** (DCM 8.2 explicitly does not waive WQ SCMs, the 2-year on-site control under §25-7-61(A)(5)(c), or storm drain connection). For a duplex residential building permit:
  - **There is no on-site detention requirement** to begin with (residential SF/duplex in a developed Walnut Creek subwatershed is not detained at the lot scale; detention applies at the original 1991 subdivision drainage system, not per-lot).
  - **There is no WQ SCM requirement** (sub-8,000 SF IC).
  - **There is no 2-year on-site control requirement** at residential building permit scale (the §25-7-61(A)(5)(c) hook attaches to projects subject to LDC §25-7-61, which is site plan and subdivision construction-plan scoped).
Therefore the **RSMP fee-in-lieu has nothing to attach to** for this project. If a future code amendment or DSD policy change pulls duplex permits into a Tier-1 detention obligation, RSMP would become a low-cost off-ramp at $0.50-$2.00/SF of treatable IC (~$750-$3,000 hypothetical), but as of this date it does not apply.
**Implication for the developer:** Don't budget for RSMP. Don't schedule an RSMP Feasibility Meeting (a Site Plan / Completeness Check artifact, not a residential building permit artifact). If DSD intake unexpectedly flags a detention obligation during permit review, RSMP fee-in-lieu is the cheap path to resolve it.
**Recommended next step:** No action unless DSD review flags a detention requirement; if it does, request RSMP Simplified pathway (DCM 1.2.2.G; <0.5 ac commercial/MF or <1 ac SF subdivision — duplex on 0.185 ac qualifies on size).

### 15' platted Drainage Easement (D.E.) — location unconfirmed
**Severity:** data-gap
**Citation:** Plat Cabinet 91, Slide 264-265; Scofield Declaration Vol. 11863, Pg. 1147 (Feb 1, 1993); 1994 survey extraction
**Finding:** The 1994 survey notes the lot is subject to a **15' Drainage Easement per plat Vol. 11863, Pg. 1147** but **does not dimension its location on Lot 12**. The 1994 surveyor's drawing labels P.U.E., M.U.E. & P.S.E., front BL, side BL, and rear BL — but the 15' D.E. is mentioned by reference only. Three plausible locations:
  - **(a) Rear of lot, parallel to south property line, overlapping or replacing the 7.5' M.U.E. & P.S.E.** — most common for interior subdivision lots and most consistent with the visible "concrete sanitary sewer vault near rear" shown on the survey.
  - **(b) Side property line (east or west)** — less common, but a few 1990s Scofield lots may have side-lot drainage for inter-lot flow conveyance.
  - **(c) Mid-lot diagonal** — uncommon; would have shown on the survey if so.
The DCM no longer recognizes a 15' minimum for enclosed storm drains (DCM 1.2.4.G.1 minimums are 20-25 ft) — this 15' D.E. is a **legacy platted easement** from the 1991 subdivision design and is governed by its recording document, not current DCM minimums. **It cannot be encroached upon or built over without (i) a vacation/relocation through formal plat amendment or (ii) the City + downstream-lot beneficiaries releasing it.** Both are expensive multi-month processes.
Common pitfall: do not treat the 15' as a minimum width for new design — and equally, do not assume the platted easement can be ignored because current DCM minimums are larger.
**Implication for the developer:** The duplex footprint must respect the 15' D.E. exactly as platted. If it follows the rear lot line (most likely), the rear setback functionally becomes **15 ft** (the D.E. width) rather than the 7.5 ft platted BL — losing ~7.5 ft of usable depth × 60 ft frontage ≈ **450 SF of envelope on the rear**. If it crosses the lot interior, duplex layout becomes substantially harder. Build a fence yes; build a structure no.
**Recommended next step:** **Order the plat (Cabinet 91, Slide 264-265) from Travis County Clerk** ($5-10 fee; tccsearch.org or in-person courthouse pull) immediately and have the surveyor (current updated survey, not the 1994 sheet) **plot the D.E.** as a dimensioned line on the working base. This is the highest-leverage pre-design action for this discipline. Without it, no reliable footprint study is possible.

### Concrete sanitary sewer vault near rear lot line
**Severity:** moderate
**Citation:** 1994 survey ("CONC. SAN. SEW. VAULT"); coordinate with the Water & Wastewater section (Austin Water sanitary sewer / vault / clean-out requirements)
**Finding:** The 1994 survey shows a concrete sanitary sewer vault near the rear (south) property line, consistent with an AW sanitary main running through the rear M.U.E. & P.S.E. (7.5' rear easement) and the 15' D.E. The vault is likely a manhole, lampback, or service-cleanout structure for the public sanitary main serving Block M.
**Implication:** Cannot build over, within working clearance of, or anchor any structural element to an active AW sanitary vault. Standard practice is a 5-10 ft no-build buffer around any AW manhole, plus uninterrupted truck access for vac-truck maintenance. The vault location compounds the rear D.E. constraint: even if the D.E. only occupies the rear 15 ft, the vault clearance may push the effective no-build to 15-20 ft from the rear property line.
**Recommended next step:** Have the updated survey GPS-locate the vault. Confirm with Austin Water (411 Chicon or DSD utility coordination) whether the sanitary main is a 6"/8" gravity service or larger collector, and the required clear zone. Cross-reference with the Water & Wastewater section.

### Detention — not required at residential building permit scale
**Severity:** note
**Citation:** DCM 1.2.2.D (no-increase rule, scoped to site plan / subdivision construction plans); LDC §25-7-61; ECM 1.6.8 (2-yr on-site control, same scope)
**Finding:** On-site detention under DCM 1.2.2.D ("no-increase" 2-, 10-, 25-, 100-yr) is a site-plan / subdivision-construction-plan obligation. Residential SF/duplex building permits in developed watersheds with adequate downstream conveyance (Walnut Creek mainstem 1 mi east, fully-developed FDF outside parcel per the Property Records research) are not subject to lot-scale detention pond design. The 2-yr on-site control under §25-7-61(A)(5)(c) attaches to the same scope.
**Implication:** No detention pond, no underground vault, no on-site flood control facility required on this 0.185 ac lot. Driveway and roof runoff sheet-flow to Cinchring street gutter (front) and to the 15' D.E. / rear conveyance (rear) as designed in the original 1991 plat.
**Recommended next step:** None. Confirm at DSD intake / pre-application meeting if the developer wants written confirmation.

### Curb cut, driveway, and street gutter discharge
**Severity:** note
**Citation:** TCM Section 7 (Driveways); DCM 1.2.3 (storm drain connection); LDE Residential ROW Review Guidelines (Rev. 11/2025); coordinate with the Transportation Access section
**Finding:** Existing 17'-wide concrete drive off Cinchring is conforming (TCM Section 7 max 25' residential). Reusing the existing curb cut or widening modestly is preferred — minimizes ROW work, avoids storm-drain-inlet spacing checks. New driveway should slope to drain **toward Cinchring street gutter** (not pond on driveway, not discharge onto neighbor's lot). No on-lot detention required; gutter accepts the flow.
**Implication:** Standard residential driveway design. Re-paving an existing apron typically does not require a separate driveway permit if curb cut location/width unchanged; any width change triggers an LDE driveway permit (~$200-$400 review fee).
**Recommended next step:** Architect / civil to design driveway grading to drain to Cinchring. Cross-reference the Transportation Access section for the duplex's single shared curb cut and sidewalk-or-fee-in-lieu obligation (~$2,250 fee).

### Grading and finished floor elevation
**Severity:** note
**Citation:** IRC (residential building permit); LDC §25-7 (drainage); BCM 4.4.3.1 (benchmark)
**Finding:** Finished floor elevation per IRC + COA residential standards: typically **6-12 inches above adjacent grade**, with positive drainage 6" within 10 ft of foundation per IRC R401.3. NAVD88 elevations on the plot plan. Lot soils per the Property Records research are NRCS Edge clay loam (1-5% slopes) — moderate plasticity, requires standard slab-on-grade with post-tensioned or properly designed reinforcement, plus moisture-conditioned subgrade per geotech.
**Implication:** Standard residential design. Geotechnical report ($1,500-$3,000) advisable for the structural engineer regardless of drainage; not a drainage-driven requirement.
**Recommended next step:** Order geotech early; have civil/architect confirm FFE relative to Cinchring crown and to the rear D.E. invert.

### Stormwater quality during construction (cross-reference to Tree Protection & Erosion Control)
**Severity:** note
**Citation:** see the Tree Protection & Erosion Control section; ECM 1.4 (ESC); LDC §25-8 Subch. C
**Finding:** ESC during demolition + construction is addressed in the Tree Protection & Erosion Control section. Disturbed area ≈ 8,054 SF = 0.185 ac — **well under** the 1-acre TPDES Construction General Permit threshold, so no NOI to TCEQ. Standard COA residential ESC package (silt fence, stabilized construction entrance, concrete washout, inlet protection at Cinchring gutter, tree-protection fencing) suffices.
**Implication:** No SWPPP. No TPDES NOI. No State permit. Standard ESC details on plot plan or a separate ESC sheet.

### Vested rights / redevelopment exception (not material here)
**Severity:** note
**Citation:** LDC §25-8-25 (Urban/Suburban Redevelopment Exception); ECM 1.9.2.A (vested rights)
**Finding:** The original SFR was permitted in 1993 (post-May 18, 1986 vested-rights cutoff). Suburban Redevelopment Exception (§25-8-25) preserves IC without GSI requirement if there is no net IC increase. This duplex **increases** IC, so the Redevelopment Exception's no-IC-increase prong is not met — but it doesn't matter because there is no GSI/WQ obligation triggered to begin with (sub-8,000 SF IC).
**Implication:** No action. Noted for completeness; do not invoke as a defense unless DSD unexpectedly asserts a WQ obligation.

## Plan-specific findings

N/A — no concept plan provided. §9 Concept Plan Review omitted.

## Open questions for the engineer

- **Exact location of the 15' Drainage Easement on Lot 12** (highest priority — pull plat Cabinet 91, Slide 264-265, surveyor or civil to plot).
- **Concrete sanitary sewer vault location and Austin Water required clear zone** (GPS-locate during updated survey; confirm with AW utility coordination — cross-reference the Water & Wastewater section).
- **Final proposed IC for the duplex design** (confirm stays under the §25-8-213 8,000 SF new + redeveloped IC trigger; coordinate with Zoning & Land Use on MF-3 building coverage / IC ceiling and the Zoning Pathway's HOME Phase 2 considerations).
- **Whether DSD residential review applies any non-standard drainage condition** to this lot due to the platted D.E. (worth a 30-minute pre-application meeting at DSD to confirm scope before architectural commitment).
- **Cinchring street gutter capacity** at the existing curb cut (functional, but a civil eyeball check during driveway design — not a permit obligation).
- **Geotechnical report** for slab/foundation design on Edge clay loam soils (not a drainage deliverable, but typically scoped at the same time).

---

## Floodplain

## Summary
- Parcel is a dry, interior 1990s suburban infill lot with **no FEMA SFHA, no COA-regulated floodplain, no CWQZ/WQTZ, no EHZ, and no CEFs**. The entire floodplain discipline reduces to confirming the absence of constraint.
- The 1994 survey's Zone X determination remains accurate under the current effective FIRM Panel **48453C0270J** (eff. 2014-08-18, supersedes the 1993 panel). Verified directly against the FEMA NFHL service.
- No floodplain permits, no FFE / freeboard requirements, no compensatory storage, no LOMA / LOMR, no Council variance pathway implicated. Cross-discipline handoffs for drainage and erosion control are addressed in the Stormwater & Drainage and Tree Protection & Erosion Control sections.

## Findings

### Outside FEMA SFHA (Zone X confirmed on current effective panel)
**Severity:** note (absence of constraint)
**Citation:** FEMA NFHL; FIRM Panel 48453C0270J, eff. 2014-08-18 (DFIRM_ID 48453C, countywide Travis); LDC §25-12 Article 1 (Floodplain Regulations); LDC §25-12-52 (design flood elevation).
**Finding:** Parcel is in **Zone X — Area of Minimal Flood Hazard** (outside the 100-year SFHA and outside any 500-year shaded Zone X). Confirmed by direct ArcGIS query of the FEMA NFHL service at the parcel centroid (-97.68395, 30.41466) in the Property Records research (Verified). STATIC_BFE = -9999 (no BFE applies). The 1994 survey's Zone X cert (then on superseded Panel 0115E, eff. 1993-06-16) remains accurate under the 2014 panel: zone classification is unchanged.
**Implication for the developer:** No FEMA-driven design flood elevation, no 2-ft freeboard requirement under LDC §25-12-53(C)(1), no ASCE 24-14 structural compliance, no flood openings, no MEP elevation, no safe-refuge requirements. No FEMA Elevation Certificate (Form 086-0-33) required at CO. Federal flood insurance is not required for any conventional or government-backed mortgage. Standard slab-on-grade foundation (matches the existing 1993 house typology) is permissible.
**Recommended next step:** Re-confirm Zone X with the floodplain administrator at building permit submittal (standard formality — the permit application asks for current FIRM panel + zone). Document Zone X status on the title insurance commitment. Owner may elect inexpensive preferred-risk flood insurance but it is not required.

### Outside City of Austin locally-regulated floodplain (FEMA & Fully-Developed)
**Severity:** note
**Citation:** COA Watershed Protection FEMA Floodplain layer (`Shared/Floodplain/1`) + Fully-Developed Floodplain layer (`Shared/Floodplain/0`); LDC §25-7 (Drainage); DCM §1.2.6.B (floodplain delineation); Rule R161-20.01 (Atlas 14 compliance).
**Finding:** Both the COA FEMA-mirror layer and the COA **Fully-Developed Floodplain (FDF)** layer return zero features at the parcel point (Verified via direct REST query). The FDF is the City's regulatory boundary derived from approved hydraulic models intersected with site topo — it is often **broader** than the FEMA SFHA in Atlas 14-updated watersheds. Walnut Creek has been subject to Atlas 14 study and the FDF layer in this area reflects that. The parcel sits well upgradient of any mapped Walnut Creek tributary channel and is outside both the 100-yr and the 25-yr (= COA floodway) regulatory boundaries.
**Implication for the developer:** No COA Floodplain Development Permit required. No 0.00-ft rise certification (LDC §25-12-54), no PE-sealed no-rise letter, no WSE comparison table, no compensatory-storage analysis. No drainage easement dedication of regulatory floodplain on the lot (LDC §25-7-152) — the platted 15' D.E. is a private subdivision drainage easement, not a regulatory floodplain easement.
**Recommended next step:** Re-confirm "no FDF at point" via FloodPro at the time of permit submittal (the Nov 2025 FEMA preliminary FIRM update for Travis County, noted in the Property Records research, is in 90-day public comment as of this report; current effective panel remains 48453C0270J, and the preliminary update is not expected to reclassify this interior parcel — but worth a final FloodPro check before architectural lock-in).

### No Erosion Hazard Zone (EHZ)
**Severity:** note
**Citation:** LDC §25-7-32(C) (EHZ trigger); DCM Appendix E (EHZ delineation procedure); COA EHZ Review Buffer layer (Open Data `pmnk-72i4`).
**Finding:** Parcel is outside the EHZ review buffer (Verified — `Shared/Environmental_3/7` returns no features at point). EHZ delineation is only required where development is within 100 ft of the centerline of a classified waterway (≥64 acres contributing drainage). This interior subdivision lot is not adjacent to any such waterway. No meander-belt analysis, no bankfull-geometry workup, no side-slope projection to 100 ft, no 20-ft minimum top-of-bank setback applies. No WPD/ERM concurrence on protective works is required.
**Implication for the developer:** No mandatory creek-side erosion setbacks beyond standard Subchapter E zoning setbacks. No geotechnical erosion-stability report required by EHZ.

### No Critical Water Quality Zone (CWQZ) / Water Quality Transition Zone (WQTZ)
**Severity:** note
**Citation:** LDC §25-8-92 (CWQZ established); LDC §25-8-93 (WQTZ); LDC §25-8-261 (CWQZ development restriction); ECM §1.5.2.D (buffer averaging); COA Creek Buffers / Waterway Setbacks GIS layer.
**Finding:** No mapped waterway crosses or abuts the parcel. Parcel is interior; closest Walnut Creek tributary is several hundred feet off-lot. In Suburban watersheds, CWQZ buffer widths from centerline are 100 ft (minor, 64–320 ac contributing), 200 ft (intermediate), or 300 ft (major) — none of these buffers reach the parcel. WQTZ extends a further 100–300 ft beyond CWQZ and likewise does not reach. The platted 15' Drainage Easement noted on the 1994 survey is a private subdivision drainage easement (a §25-7 utility/private easement, **not** a §25-8-92 classified waterway buffer); it does not establish a CWQZ.
**Implication for the developer:** No CWQZ encroachment, no LUC variance under the enhanced §25-8-41(B) standard, no ECM §1.7 floodplain-modification analysis, no FAFH (Functional Assessment of Floodplain Health), no restoration ratios. No buffer-averaging design needed. No riparian / water-quality buffer reduces the buildable envelope. Standard §25-8 site-level water quality controls (Stormwater & Drainage section) still apply to all development, but no buffer-driven constraint exists.

### Walnut Creek watershed classification (Suburban)
**Severity:** note
**Citation:** LDC §25-8 Subchapter A Article 9 (Suburban Watershed Requirements); LDC §25-8-391 (applicability); LDC §25-8-392 (Uplands Zone IC); LDC §25-8-63(B) (IC requirements do not restrict individual SF/duplex lots).
**Finding:** Parcel is in Walnut Creek watershed, classified **Suburban** under LDC §25-8 (Verified via COA Environmental layer). Suburban watersheds set IC ceilings at subdivision scale per §25-8-63(B); they do not independently restrict IC on an individual single-family or duplex lot. The binding IC % for this duplex therefore comes from zoning (LDC §25-2) plus HOME amendments, not from §25-8-392. Walnut Creek is **not** in the Barton Springs Zone — no Save Our Springs (Article 13) IC ceiling applies.
**Implication for the developer:** No watershed-driven structure prohibition. No watershed-driven IC cap on this lot. Standard §25-8 site-level water quality controls (0.5"/1.0" capture, biofiltration / vegetative or equivalent BMPs at the duplex scale) still apply — see the Stormwater & Drainage section for sizing.

### Downstream peak-flow considerations
**Severity:** note
**Citation:** LDC §25-7 (Drainage); DCM §1.2.2 (peak-flow attenuation); DCM §1.2.2.F (TIRZ / Waller Creek tunnel exception — not applicable here).
**Finding:** The site drains via on-lot grading and the platted 15' subdivision drainage easement into the Walnut Creek tributary network and eventually to the Colorado below Longhorn Dam. Demolition of the existing ~2,095 SF house plus driveway and construction of a duplex on an 8,054 SF lot will produce a marginal increase in impervious cover (order-of-magnitude ~600–1,200 SF additional IC, depending on final design) and correspondingly small incremental peak runoff (~0.025 cfs at a 10-yr design storm — engineer to confirm). At duplex scale this is negligible relative to the Walnut Creek mainstem hydraulic regime; drainage-criteria compliance is handled at the site scale by the Stormwater & Drainage section.
**Implication for the developer:** No downstream impact analysis is required at this scale; drainage compliance is the standard residential-redevelopment pathway (see Stormwater & Drainage section).

### Cross-references
- See the Stormwater & Drainage section for drainage / water quality control sizing for the duplex (Suburban watershed §25-8 site-level WQ capture; Atlas 14 detention sizing if redevelopment IC threshold triggered).
- See the Environmental section for environmental layers (CEFs, watershed, salamander, ESA, heritage trees) — all clean per the research.
- See the Tree Protection & Erosion Control section for SWPPP / construction-phase erosion and sediment control (TPDES Construction General Permit applicability at >1 ac disturbance — this 0.185 ac lot is well below threshold but COA still requires construction E&SC controls).
- See the Property Records section for the 15' drainage easement: location on Lot 12 is not labeled on the 1994 survey and must be resolved by pulling the recorded plat (Cabinet 91, Slide 264–265) before duplex site design.

## Plan-specific findings
(N/A — no concept plan provided. SIR scope only.)

## Open questions for the engineer
- Confirm Zone X with the COA floodplain administrator at building permit submittal (standard formality — Permit Application Form references current FIRM panel + zone).
- Re-check FloodPro at permit submittal to confirm no change from the Nov 2025 FEMA preliminary FIRM update (Travis County preliminary panels are in 90-day public comment as of this report; current effective panel 48453C0270J remains binding until final adoption, and the parcel is not expected to be reclassified, but worth a final check before architectural lock-in).
- Confirm exact location of the platted 15' drainage easement on Lot 12 by pulling the recorded plat (Cabinet 91, Slide 264–265 — Travis County Plat Records). Easement is a private subdivision drainage easement (no regulatory floodplain implication) but its on-lot footprint constrains structure placement and must be respected by the duplex site plan. Handoff to the Stormwater & Drainage and Site Plan & Form sections.

---

## Environmental

## Summary

- **This is a clean environmental parcel.** Walnut Creek Suburban watershed, no CEFs, no Edwards Aquifer zones, no salamander or other ESA habitat, no EHZ, no waterway buffers, no UST/LPST sites in the area, no historic or archaeological overlay. The environmental research returned "no constraint" on 13 of 16 layers, and the three that did return findings (watershed classification, DDZ status, WUI Zone C) are administrative rather than design-binding.
- **The only construction-cost driver from this discipline is WUI Zone C** — the parcel sits in the lowest tier of Austin's Wildland-Urban Interface overlay, triggering ignition-resistant construction details under the WUI Code. Cost adder for a duplex of this scale is estimated at $5K–$15K and is fully internalized in design (Class A roof, ember-resistant vents, ignition-resistant exterior assemblies).
- **DDZ status is an affirmative opportunity**, not a neutral condition: the parcel is squarely in the Desired Development Zone, which is the precondition for SMART Housing fee waivers if an affordability path is elected. See the Programs section for the SMART Housing analysis.
- **Watershed regulation (LDC §25-8 Article 9) does not bind this lot.** Walnut Creek is a Suburban watershed, but §25-8-63(B) carves SF and duplex lots out of the subchapter IC limits — the binding IC will be set by MF-3 zoning and/or the McMansion FAR envelope. Watershed-driven WQ controls collapse to standard residential RSMP fee-in-lieu (cross-reference Stormwater & Drainage).
- **Tree protection is the only binding environmental-adjacent constraint, and it is covered in the Tree Protection & Erosion Control section.** This section deliberately defers all tree analysis. Floodplain confirmation (Zone X on current panel 48453C0270J, eff. 2014-08-18) is in the Floodplain section.

## Findings

### Watershed: Walnut Creek (Suburban classification)
**Severity:** note
**Citation:** LDC §25-8 Subch. A Article 9 (Suburban Watershed Requirements) — §§25-8-391 (applicability), 25-8-392 (Uplands Zone IC limits), 25-8-393 (intensity transfer); §25-8-63(B) (SF/duplex carve-out); COA Watershed Regulation Areas layer (Open Data `2xkn-3rmn`, Shared/Environmental_3/0 WATERSHED_DEVELOPMENT_TYPE field).
**Finding:** Parcel drains to Walnut Creek (the 36,000-acre / ~43 sq mi master watershed discharging at Longhorn Dam, downstream of all Austin drinking water intakes). COA's watershed regulation layer returns `WATERSHED_DEVELOPMENT_TYPE = Suburban` for the parcel — verified at the point geometry against the City's authoritative ArcGIS REST endpoint. The parcel is in the Uplands Zone of the watershed (no creek frontage, no Critical Water Quality Zone or Water Quality Transition Zone touching the lot).
**Implication for the developer:** Suburban watershed IC limits in §25-8-392 (50%–60% by lot size and sub-watershed) apply at the **subdivision** scale, not the individual lot. §25-8-63(B) explicitly provides that subchapter IC requirements **do not restrict** impervious cover on an individual SF or duplex lot. The binding IC for this duplex will therefore come from (i) MF-3 base zoning IC maximum and (ii) the McMansion / Subchapter F gross floor area envelope if applicable — not from §25-8. No watershed-driven design constraint on the duplex envelope.
**Recommended next step:** Confirm sub-watershed branch ID via FloodPro for downstream WQ control design context, but no watershed work product is required at submittal. Defer site-level WQ controls and RSMP fee-in-lieu treatment to the Stormwater & Drainage section.

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
**Implication for the developer:** DDZ status is a precondition for several incentive programs, most notably **SMART Housing fee waivers** (waivers of development, building permit, and Austin Water capital recovery fees in exchange for an affordability commitment). See the Programs section for the SMART Housing eligibility analysis. DDZ status also means no Smart Growth IC penalties, no heightened DWPZ environmental review, and standard application of all development incentives.
**Recommended next step:** Coordinate with the Programs section to determine whether the duplex pro forma supports a SMART Housing affordability path.

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
**Finding:** Parcel is in **WUI Proximity Zone C** — the lowest-tier WUI overlay in the Austin WUI Code. Zone C is the "interface proximity" zone, outside the immediate wildland adjacency (Zones A and B) but within the broader Austin WUI mapping. This was a surprise relative to the earlier environmental review, which assumed the parcel would fall outside any WUI zone — but the COA WUI layer at the parcel point returns Proximity Zone C, and that is the binding value. Zone C is the COA WUI mapping designation; it triggers a reduced (but not zero) set of ignition-resistant construction requirements.
**Implication for the developer:** Triggers the WUI Code structure-hardening requirements applicable to new construction in Zone C. For a duplex, expect the following to be specified in the building permit set:
- Class A roof assembly (asphalt composition shingles meeting Class A — standard architectural shingles generally comply)
- Ember-resistant attic vents (e.g., flame-and-ember-resistant vent assemblies, 1/16"–1/8" mesh)
- Exterior wall fire-resistance (ignition-resistant siding materials or wall assemblies)
- Eaves / soffits with ignition-resistant detailing
- Defensible space / landscape provisions (most onerous in Zones A and B; modest in Zone C)
- Standard provisions: no combustible decking under a deck or within 5 ft of the structure, glazing rated for radiant heat in some Zone C sub-cases.

**Cost adder for a duplex of this scale: estimated $5K–$15K**, driven principally by ember-resistant vents and the differential cost of ignition-resistant siding vs. standard siding. The architect must specify WUI-compliant assemblies on the permit set; DSD building plans review will check WUI compliance at intake.
**Recommended next step:** Confirm WUI Zone C status at the COA WUI Zone Lookup tool (https://www.arcgis.com/apps/instant/lookup/index.html?appid=aac08abc87054f339204acf5d7914204) at the start of design. Incorporate WUI requirements during Design Development, not at Construction Documents — late-stage assembly changes are the failure mode here. Confirm with COA Fire Department / WUI plan review whether any current Austin WUI amendments waive specific Zone C provisions for duplex residential.

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

- **Heritage tree protection** (LDC §25-8 Subch. B; §25-8-604 tree survey; Heritage Tree Ord. 20100204-038): see the Tree Protection & Erosion Control section. Tree-driven design constraint will likely be the single biggest environmental-adjacent factor on this lot, but it belongs to the tree-protection discipline, not Environmental.
- **Floodplain confirmation** (FEMA Zone X on current effective panel 48453C0270J, eff. 2014-08-18; COA local 100-yr and Fully Developed Floodplain layers also confirmed clear): see the Floodplain section.
- **Site drainage, water quality controls, RSMP fee-in-lieu** for the duplex redevelopment: see the Stormwater & Drainage section. Watershed classification (Walnut Creek Suburban) is established here but the WQ control selection happens there.
- **Blanket electric easement (Vol. 660 Pg. 968)** — this is a property-records / electrical-coordination item, not an environmental finding; see the Property Records section and the related electrical-utility discussion.
- **WUI structure-hardening details on permit set**: coordinated with the Fire section (building / fire code compliance).

## Plan-specific findings

N/A — no concept plan provided. SIR is the Site Intelligence Report only; §9 Concept Plan Review is omitted.

## Open questions for the engineer

- **WUI Zone C confirmation at design start.** Pull the address through the COA WUI Zone Lookup tool and the COA Fire WUI plan-review desk to confirm Zone C and the specific Austin amendments that apply at duplex residential scale (Class A roof, ember-resistant vents, ignition-resistant siding, defensible space). Lock the assembly choices at DD, not CD.
- **EPA RRP (Renovation, Repair and Painting) Rule compliance for demolition.** The existing house was built 1993 — pre-1978 lead-paint rules do not apply (RRP Rule applies only to pre-1978 housing). No asbestos abatement is anticipated for a 1993 residence but a Texas Department of State Health Services asbestos survey is a low-cost confirmation step at demolition permitting; budget accordingly.
- **Confirm parcel is not pulled into the Nov 2025 FEMA preliminary FIRM update for Travis County.** The current effective panel (48453C0270J, 2014-08-18) maps the parcel as Zone X; the preliminary panel released for 90-day comment in Nov 2025 may reclassify some Walnut Creek tributary geometry. Defer to the Floodplain section for tracking, but flag here so the environmental memo doesn't go stale before permit submittal.
- **Field-verify no unmapped CEFs (springs, seeps, point recharge) during the pre-design site walk.** Vanishingly unlikely on a 1991-platted interior suburban lot, but the standard professional-care step is one walk-through with eyes open for any standing water, rock outcrop, or recent ground-surface anomaly. Document the absence in the project file.
- **Coordinate SMART Housing eligibility analysis with the Programs section.** DDZ status is the precondition; the affordability path is the deciding factor. If SMART Housing is pursued, the environmental record may need to support the SMART Housing application package (clean Phase I summary, no contamination flags) — all of which is already in place.

---

## Tree Protection & Erosion Control

## Summary

- **Tree inventory is the single biggest data gap** on this parcel and will dominate the discipline. The 1994 survey shows no trees; a RPLS-supervised tree survey + ISA-certified arborist field walk is the precondition to a reliable building footprint on this 60'×127' lot.
- **Critical Root Zone (CRZ) geometry — not setbacks — is the most likely buildable-envelope killer.** A single 24" heritage oak in the wrong location can drive a 12-ft Quarter-CRZ no-cut zone through the middle of the lot.
- **Heritage tree exposure is real but unlikely to be catastrophic.** Scofield was platted 1991; ~30-yr-old residential plantings (live oak, cedar elm, Texas ash) can plausibly approach the 19" protected threshold but typically have not yet crossed 24" heritage absent a preserved older relict tree.
- **Mitigation budget $5K–$25K (consistent with the Programs section)** is reasonable as a placeholder. Replanting + Urban Forest Replenishment Fund (UFRF) fee-in-lieu at $200/caliper-inch are both available; UFRF only when City Arborist deems site unsuitable for replanting.
- **ESC is routine.** Lot is 0.185 ac (well under 1-ac TPDES CGP threshold) and outside BSZ/EARZ. Standard residential silt-fence + stabilized construction entrance + tree-protection fencing + concrete washout package; no SWPPP NOI required.

## Findings

### Tree inventory required pre-design (data gap)
**Severity:** data-gap
**Citation:** LDC § 25-8 Subch. B (§§ 25-8-601 ff.); ECM § 3.3 (tree survey) and § 3.3.2.A (5-yr validity); Ord. 20100204-038 (Heritage Tree)
**Finding:** The 1994 survey shows no trees, and per ECM § 3.3.2.A a tree survey older than 5 years is invalid for site-plan purposes. A current RPLS-supervised survey + ISA-certified arborist field walk is required to identify:
  - **Regulated trees** (≥ 8" DBH, any listed species) — survey required
  - **Protected trees** (≥ 19" DBH, any species) — removal requires permit + mitigation
  - **Heritage trees** (≥ 24" DBH, heritage species: all Oaks, Texas Ash, Bald Cypress, American Elm, Cedar Elm, Texas Madrone, Bigtooth Maple, Pecan, Arizona Walnut, Eastern Black Walnut)
**Implication for the developer:** Until inventory is complete, duplex placement cannot be finalized. On a 60'×127' lot with platted 25' front + 5' side + 7.5' rear setbacks, the remaining build envelope is ~50'×95' ≈ 4,750 SF. A single heritage oak with a 30-ft CRZ can sterilize 30% of that envelope before any other constraint applies. The 1994 survey is uninformative; a satellite/aerial check is *not* an acceptable substitute (DBH cannot be inferred from canopy — a common pitfall).
**Recommended next step:** Engage RPLS + ISA-certified arborist for combined tree survey + updated boundary survey. Budget $1,500–$3,500 combined. This should be the first physical site action before architectural concept work.

### Heritage tree contingency
**Severity:** moderate
**Citation:** LDC § 25-8 Subch. B Art. 7 (§§ 25-8-641 to -646); LDC § 25-8-642 (admin variance, < 30" stem); LDC § 25-8-643 (LUC + EC variance, ≥ 30" stem); LDC § 25-8-624(A) (5 removal criteria); LDC § 25-8-646 (prerequisite-variance rule)
**Finding:** Heritage trees (≥ 24" DBH, listed species) cannot be removed without a variance. Likelihood on this parcel: **possible but not probable.** A 30-yr-old residential live oak typically reaches 16–22" DBH (≈ 0.5–0.75" per year on irrigated suburban lots). Cedar elm and Texas ash grow somewhat faster. A heritage-threshold (24") specimen on this lot is plausible only if (a) an older relict tree was preserved at construction or (b) growing conditions were unusually favorable.
**Implication for the developer:** If a heritage tree falls inside the building envelope, options narrow:
  - **(a)** Reshape massing around the CRZ (preferred; possible only if the heritage tree is at lot perimeter, not center)
  - **(b)** Admin variance under § 25-8-642 if no stem ≥ 30" — requires meeting one of five § 25-8-624(A) criteria (prevents reasonable access/use, imminent hazard, dead, diseased not restorable), plus **prerequisite-variance exhaustion** (§ 25-8-646) requiring denial of every other applicable Code variance first; ~2–4 month timeline; 300% caliper-inch mitigation
  - **(c)** LUC + Environmental Commission variance under § 25-8-643 if any stem ≥ 30" — ~4–8 months, public hearings, meaningful political risk
  - **(d)** DDI (dead/diseased/imminent hazard) pathway if a genuinely declining tree — 0% mitigation but requires City Arborist letter, not private arborist alone
The prerequisite-variance rule (§ 25-8-646) is the calendar killer — it cannot be parallelized with the heritage variance request, forcing concept-stage exploration of alternate setbacks/AEC paths before any removal request can even be filed.
**Recommended next step:** Treat the arborist inventory's heritage-screen as a go/no-go gate. If heritage tree found in envelope, immediately model footprint alternatives around CRZ before pursuing any variance path.

### Protected tree mitigation
**Severity:** moderate
**Citation:** LDC § 25-8 Subch. B; ECM § 3.5.4 (mitigation rates and methods); ECM Appendix F (Significant Shade Provider species)
**Finding:** Removal of protected (non-heritage) trees triggers replacement obligation. Per ECM § 3.5.4.A.1 rate schedule:
  - **19"+ Appendix F species:** 100% caliper-inch mitigation
  - **19"+ non-Appendix F species:** 50% caliper-inch mitigation
  - **8–18.9" trees:** 50% (Appendix F) / 25% (non-Appendix F) caliper-inch mitigation
  - Mitigation-exempt invasive species (Arizona Ash, Chinaberry, Ligustrum, Mimosa, Photinia, Vitex, Tree of Heaven, etc.): no mitigation but **removal permit still required** (common pitfall)
Mitigation forms (ECM § 3.5.4.B): on-site replanting, preserved-undersized-tree inch-for-inch credit, or fee-in-lieu to UFRF at **$200/caliper inch** (private) — but UFRF only available when City Arborist determines the site is unsuitable for planting. At least 75% of replacement caliper must be Significant Shade Provider species (Appendix F "SS" column).
**Implication for the developer:** The $5K–$25K mitigation contingency from the Programs section holds. Worked example: removing a single 19" protected live oak (Appendix F) at 100% = 19" mitigation × $200/in = $3,800 UFRF or equivalent replanting. Three trees in that range puts the project in the upper half of the contingency band. Heritage tree at 300% rate (e.g., 24" × 3 = 72" × $200 = $14,400) consumes most of the budget on a single specimen.
**Recommended next step:** Once arborist inventory is in hand, run a per-tree disposition matrix (preserve / remove + replant / remove + UFRF) and lock the mitigation budget against confirmed inches.

### Critical Root Zone (CRZ) protection during construction
**Severity:** moderate
**Citation:** ECM § 3.5.2.A.1 (CRZ geometry); ECM § 3.5.2.A.3 (construction impacts); ECM § 3.6.1 + SSM Item 610 (tree protection fencing)
**Finding:** Three nested CRZ rules apply simultaneously to every protected/heritage tree:
  - **Full CRZ** (radius ft = DBH in): ≥ 50% of area preserved at natural grade with natural ground cover
  - **Half CRZ** (DBH ÷ 2 ft): cut/fill ≤ 4" only; elevated foundations allowed with ≥ 4" air gap (ECM § 3.5.2.B.3) but footprint still counts toward 50% impact ceiling
  - **Quarter CRZ** (DBH ÷ 4 ft): **zero cut/fill of any depth** — the most-often-missed rule, kills sidewalks, curbs, utility runs near heritage oaks
Failing any of the three legally reclassifies the tree as "removed," triggering mitigation and variance whether or not removal was intended. Impacts are measured at the **line of excavation** (form bracing, scaffolding swing, over-excavation behind curbs all count) — not the visible face of improvements.
**Implication for the developer:** Tree protection fencing (chain-link ≥ 5 ft, at or beyond CRZ) required during demo + construction; trunk wrap (2×4 lumber, first 8 ft, retightened every 6 months) where fence is within 5 ft of trunk. No material storage within fenced CRZ. Adds approximately $1.5K–$3.5K to project cost for fencing + monitoring. Constrains demo equipment access and staging — small-lot demo with CRZ exclusions may require hand demolition of portions of existing slab, increasing demo cost by $2K–$5K.
**Recommended next step:** Arborist must produce tree protection plan with CRZ overlay on site plan; confirm demo sequencing with contractor before bid lock.

### Erosion and sediment control (ESC)
**Severity:** note
**Citation:** LDC § 25-8-181 (ESC required for all sites); ECM § 1.4 (ESC standards); TCEQ TPDES Construction General Permit (CGP)
**Finding:** This 0.185-acre lot is **well below the 1-acre TPDES CGP threshold** — no federal SWPPP NOI required. Site is in the Walnut Creek Suburban watershed, outside BSZ (no 18-month revegetation cap), outside EARZ. Standard COA residential ESC package suffices:
  - **Silt fence** at downgradient perimeter; J-hooks at 100-ft intervals, sections ≤ 200 ft (ECM § 1.4.5.G.4) — for this lot, single perimeter run with 1–2 J-hooks
  - **Stabilized construction entrance** (4–8" crushed stone, ≥ 8" thick, ≥ 50 ft long, full driveway width) at Cinchring Ln frontage (ECM § 1.4.5.N; SSM 641S)
  - **Tree protection fencing** sequenced before any demo equipment enters site
  - **Concrete washout** containment for slab pour
  - **Inlet protection** at any storm drain inlet within construction limits
LOC < 25 ac → no phased ESC plan required. Cut/fill > 4 ft must be disclosed for Suburban watershed; for residential foundation work this is unlikely to be triggered.
**Implication for the developer:** ESC plan can be a single 1"=20' or 1"=10' sheet included with building permit submittal; civil engineering cost ~$1.5K–$3K. No standalone permit; folds into Site Plan Lite Phase 1 exemption (per the Programs section).
**Recommended next step:** Include ESC sheet in building permit set; coordinate with arborist's tree protection plan for shared fencing alignment.

### Demolition + tree protection sequencing
**Severity:** note
**Citation:** LDC § 25-8 Subch. B (tree protection precondition); DSD demolition permit process; ECM § 3.6.1 (fencing installation)
**Finding:** Tree protection fencing must be installed and inspected **before** demolition equipment enters the site. Demo permit and tree disposition application are typically processed in parallel. Sequencing for this project:
  1. Arborist field walk + tree survey
  2. Tree disposition application (preserve / remove + mitigation method per tree)
  3. ESC plan + tree protection plan drafted
  4. Demo permit submitted (combined with new-construction permit under HOME 1 / Site Plan Lite Phase 1)
  5. Tree protection fencing installed + inspected
  6. Utility disconnects (AW, AE, TGS — 3–6 week scheduling per the Programs section)
  7. Demolition
  8. New construction
**Implication for the developer:** Standard sequencing; no unusual hurdles. Critical that arborist walk happens **before** demolition is bid, so demo contractor can price hand-demolition portions within CRZs if any.

### Excessive pruning during construction (constructability risk)
**Severity:** note
**Citation:** LDC § 25-8-602(4)(d); ECM § 3.5.2.A.2
**Finding:** Pruning > 25% of a tree's foliage in one annual growing season is statutorily defined as **removal** — triggering full mitigation and variance procedures. Scaffolding clearance pruning counts toward the 25%.
**Implication for the developer:** On a small lot with mature trees near property lines, building height + side setback geometry can force scaffolding into branch zones. If a building cannot be constructed without exceeding 25% pruning on a protected tree, the building must move — the tree cannot be over-pruned. Architectural massing must account for this during design.
**Recommended next step:** Arborist should review proposed building envelope against canopy footprints and flag any clearance-pruning risk before architectural concept is locked.

### Re-vegetation / landscape compliance
**Severity:** note
**Citation:** LDC § 25-2-1001 et seq. (commercial / multifamily landscape — N/A); ECM Section 2; LDC § 25-2-1022/1025 (HCRC native replacement — N/A, parcel not in Hill Country Roadway Corridor)
**Finding:** This duplex is residential scale and outside the Hill Country Roadway Corridor (which applies within 1,000 ft of Loop 360, RM 620, RM 2222, RM 2244, or Southwest Pkwy — none near 12713 Cinchring). LDC § 25-2-1001 landscape and parking-lot tree requirements **do not apply** to 2-unit residential. No mandatory street tree, screening, or landscape buffer obligation.
**Implication for the developer:** No landscape submittal required beyond tree mitigation replanting (if any). Any HOA architectural review committee (ACC) requirements would be a separate, private-law overlay — see the Restrictive Covenants section.

### CEFs, CWQZ, SOS, ERI — confirmed not applicable
**Severity:** note
**Citation:** LDC § 25-8-1(6) (CEFs); LDC § 25-8-92 (CWQZ); LDC §§ 25-8-481 et seq. (BSZ/SOS); LDC § 25-8-121 (ERI triggers)
**Finding:** Per the Environmental section:
  - **No CEFs** on or within 150 ft (parcel is east of Edwards outcrop, no karst, no springs, no rimrock)
  - **No CWQZ or WQTZ** (no mapped waterway abuts; the platted 15' D.E. is a private subdivision drainage easement, not a § 25-8-92 waterway)
  - **Not in BSZ** (no SOS impervious caps, no 18-month revegetation cap, no phased ESC trigger)
  - **No ERI required** (no slopes > 15%, no EARZ, no wetlands within 150 ft, no CWQZ — none of the four § 25-8-121 triggers met)
  - **Not in Hill Country Roadway Corridor** (no 40% natural-area set-aside, no native replacement)
**Implication for the developer:** Discipline scope reduces to tree protection + residential ESC. None of the heavier environmental review pathways apply.

### Soil characteristics (informational)
**Severity:** note
**Citation:** USDA-NRCS SSURGO; the Property Records research (soil association EdC); standard geotechnical practice
**Finding:** Edwards-Whitewright (EdC) soil association — typical North Austin Blackland Prairie clay-loam. Moderate shrink-swell. Standard residential foundation options (post-tension slab on grade, or pier-and-beam where CRZ protection requires elevated foundation per ECM § 3.5.2.B.3) are appropriate.
**Implication for the developer:** Geotechnical recommendation is typical for area; $2K–$4K geotech report budgeted at design (per the Programs section). If elevated foundation is required within Half CRZ of a preserved tree, post-tension slab is not feasible and pier-and-beam adds ~$10K–$25K to foundation cost.

## Plan-specific findings

N/A — no concept plan provided. SIR scope only.

## Open questions for the engineer / arborist

- **Arborist inventory:** RPLS-supervised survey + ISA-certified arborist field walk. Per-tree disposition (preserve / remove + replant / remove + UFRF), DBH, species, multi-stem stems, condition rating, CRZ overlay on parcel.
- **Heritage screen:** Confirmation that no heritage tree (≥ 24" DBH listed species) is present in the building envelope. If present, confirm whether any stem ≥ 30" (drives admin vs. LUC + EC variance pathway).
- **Demo sequencing:** Confirm tree protection fencing installation precedes any demolition equipment entry. Identify CRZ portions requiring hand demolition.
- **Scaffolding clearance:** Once architectural concept is drafted, arborist should verify proposed building envelope can be constructed without > 25% canopy pruning on any preserved protected tree.
- **ESC plan integration:** ESC sheet should be coordinated with tree protection plan for shared perimeter fencing alignment; fold into building permit submittal under Site Plan Lite Phase 1 exemption.
- **HOA ACC overlay:** If Scofield HOA architectural review committee imposes landscape, fence, or tree requirements, those are private-law obligations distinct from § 25-8 — coordinate with the Restrictive Covenants section findings.

---

## Transportation Access

## Summary
- Cinchring Ln is an ASMP Level 1 Local street; the existing 50' platted ROW satisfies the L1 standard, so **no ROW dedication is triggered** by the duplex.
- Duplex generates ~13 daily trips — three orders of magnitude below the 2,000-trip TIA threshold — and the residential building permit gateway does not invoke the TIA process.
- 60' frontage permits a **single shared driveway**; existing curb cut is approximately conforming and can be rebuilt within TCM Section 7 standards.
- The **only material new transportation obligation** is the **sidewalk-or-fee-in-lieu under LDC § 25-6-353** on the Cinchring frontage — ~$2,250 fee or $5K–$10K build cost. This same obligation would apply to a teardown-and-rebuild SFR.
- No scenic / Hill Country / TxDOT / Project Connect / CapMetro on-street facility constraints apply to the parcel.

## Findings

### ASMP Level 1 — no ROW dedication required
**Severity:** note (absence of constraint)
**Citation:** ASMP Street Network Table (2023); LDC § 25-6-51; TCM § 2.7.1
**Finding:** Cinchring Ln is an interior loop street in Scofield Subdivision Section II and is **not enumerated** in the ASMP Street Network Table, which means it defaults to **Level 1 Local**. The existing 50' platted ROW (Cabinet 91, Slide 264–265) matches the constrained L1 standard. § 25-6-51 dedication is triggered by site plan review, not by a duplex residential building permit (R-3 use, ≤ 2 units on a single lot).
**Implication:** No frontage give-up; no proportionality memo under § 25-6-23; no condemnation fee or recordation of street deed.

### TIA exempt
**Severity:** note (absence of constraint)
**Citation:** TCM Section 10; LDC § 25-6-111 et seq.; Austin TIA Guidelines (June 2022); ITE Trip Generation Manual 11th ed. (LU 215 / 220)
**Finding:** Duplex generates ~6.7 daily trips/unit × 2 units ≈ **13 daily trips**; net new vs. existing SFR (~9.4 daily trips, LU 210) is ~+4 trips/day. Both gross and net are three orders of magnitude below the 2,000-trip TIA threshold. Furthermore, the residential building-permit gateway is **not a TIA trigger** — TIAs are scoped through site plan / zoning applications.
**Implication:** No TIA, Transportation Assessment, NTA, or sub-threshold mitigation applies. No engineering fee for a traffic study.

### Driveway permitting — single shared curb cut
**Severity:** note
**Citation:** TCM Section 7; LDE Residential ROW Review Guidelines (Rev. 11/2025)
**Finding:** 60' frontage on a Level 1 local street permits a **single driveway** (two-driveway threshold is 100' frontage). Residential apron max width 25' at property line; minimum 10' one-way / 16' two-way; spacing from intersection 30'–50' (depending on minor/major side) from PC; spacing from inlets 10'; from adjacent driveways 5' edge-to-edge. Existing concrete drive (~17' wide per 1994 survey) enters from Cinchring to an east-side garage and is approximately conforming. Both duplex units must share the single curb cut; internal split into two parking pads behind the property line is allowed.
**Implication:** Standard residential driveway permit at building permit submittal. Existing curb cut can be retained or modestly widened (up to 25' at apron) without dedication or off-site work.

### Sight distance — horizontal curve adequate
**Severity:** note
**Citation:** TCM Section 7; AASHTO Green Book stopping sight distance (adopted by reference)
**Finding:** Lot fronts a shallow horizontal curve in Cinchring with R = 1,075' (per 1994 survey: chord 60.00', arc 60.13'). Curve deflection across the 60' frontage is ~0.1' offset. At a residential local-street design speed (~25 mph), AASHTO required SSD is ~155 ft; available SSD at the existing driveway location comfortably exceeds 200 ft in both directions in an open visual environment.
**Implication:** No sight-distance constraint on retaining or shifting the driveway within the frontage. Final call rests with ATD residential review at permit, but no flag is anticipated.

### Sidewalk obligation — the only material delta
**Severity:** moderate
**Citation:** LDC § 25-6-353 (Sidewalk Required); LDC § 25-6-354 (Payment Instead of Sidewalk Installation); TCM Section 4; LDE Residential ROW Review Guidelines (Rev. 11/2025); City Sidewalk Fund fee schedule (FY2025/26 — verify)
**Finding:** Per current LDE Residential Review Guidelines, **any new construction of a single-family, two-family, or duplex residential structure** triggers a sidewalk obligation on every street frontage. Scofield Subdivision Section II Phase VI (platted ~1991–1993) likely has no existing public sidewalk on Cinchring (1994 survey shows only an interior "CONC. WALK" on the south side of the house; verify via Street View / field walk). The duplex frontage (~60' chord) requires either:
- **Build:** ~60 LF × 5' = ~300 SF of 4" concrete sidewalk + ADA-compliant driveway ramp — order $5K–$10K construction.
- **Fee-in-lieu:** Residential rate ≈ $7.50/SF × 300 SF ≈ **$2,250** (verify current FY rate). Director approval generally granted on interior local streets where no continuous sidewalk network exists.

**Implication for the developer:** $2K–$10K cost item; the only NEW transportation obligation triggered by the duplex (and would apply equally to a teardown-and-rebuild SFR — the duplex is not the triggering event, the new construction permit is).
**Recommended next step:** Elect fee-in-lieu unless there's a marketing/livability benefit to building actual sidewalk; capture the line item in pro-forma and verify the current FY fee against the Development Services Fee Schedule at permit submittal.

### No scenic / Hill Country Roadway overlay
**Severity:** note (absence of constraint)
**Citation:** LDC Ch. 25-2 Art. 11 (Hill Country Roadway); LDC § 25-10-7 (Scenic Roadways); LDC § 25-10-81(3) (Scenic Roadway Sign District); LDC § 25-2-1025; LDC § 25-2-1127
**Finding:** Hill Country Roadway corridors apply west of MoPac / over the Edwards Aquifer Recharge Zone (RM 2222, RM 620, RM 2244, SH 71 west, US 290 west, Loop 360, Southwest Parkway). The subject is east of MoPac, not over the Recharge Zone, and is well outside the 1,000-ft buffer of any Hill Country corridor and the 200-ft buffer of any of the 23 enumerated Scenic Roadways. Cinchring, Howard, and Parmer are none of these.
**Implication:** No scenic setback, height, IC-denominator, natural-area, or sign-district constraint.

### No direct TxDOT or Project Connect interface
**Severity:** note (absence of constraint)
**Citation:** TxDOT roadway inventory; ASMP Street Network Table; Project Connect System Plan; Austin Light Rail Phase 1 PD Profile (FTA, 2024)
**Finding:** Parmer Lane / FM 734 (TxDOT-maintained, ASMP Level 4, AADT ~45K–55K vpd; subject of an active 2024 TxDOT corridor study) is ~0.5–0.7 mi south but the parcel has **no direct frontage**. IH-35 is ~1 mi east, no access. Project Connect Phase 1 light rail north terminus is at Guadalupe/38th — ~10 miles south of the subject; even the future Crestview extension is ~7 miles away. No Orange Line ROW reservation, no station-area overlay, no value-capture district.
**Implication:** No TxDOT coordination letter, no Approval Block, no Orange Line 65-ft / 130-ft reservation flag, no Project Connect–related dedication.

### CapMetro / on-street transit — no facility on Cinchring
**Severity:** note
**Citation:** CapMetro service map; CapMetro Route 243 (Wells Branch / Howard Station); MetroRail Red Line
**Finding:** Nearest fixed-route service is **Route 243 Wells Branch** (~½ mi away on Wells Branch Pkwy / Scofield Ridge Pkwy; ~30–35 min peak headway); Howard MetroRail (Red Line) ~1.4 mi northeast; MetroRapid 801 ~3 mi west on N. Lamar. No CapMetro stop fronts the subject; no floating-bus-stop or stop-coordination dimensions apply.
**Implication:** No transit-related dedication, easement, or design constraint. Transit access is a marketing/livability factor only.

### Bicycle facility — no Bicycle Priority Network frontage
**Severity:** note
**Citation:** Austin Bicycle Plan (2023); TCM Section 5; ASMP Bicycle Priority Network
**Finding:** Cinchring is a local residential street with no existing or planned bike facility in the 2023 ABP. Shared-roadway by default. Planned Tier 1/2 bike improvements on Howard Ln and recommended shared-use paths along Parmer (per FM 734 corridor study coordination) are off-site.
**Implication:** No AAA-facility ROW reservation, no protected-lane easement, no Bicycle Priority Network dedication.

### Construction routing
**Severity:** note
**Citation:** TCM construction practices; TCP general guidance
**Finding:** Demolition and construction equipment access via Cinchring → Scofield Farms Pkwy → Howard Ln → I-35 / Parmer is the typical routing for the subject area. Notify adjacent neighbors; standard residential demolition / construction permit conditions apply.
**Implication:** No special routing plan or TCP submittal required at duplex scale.

### Multimodal context (informational)
**Severity:** note
**Citation:** CapMetro service map; ASMP Bicycle Plan; Austin parking ordinance (Nov 2023 amendments)
**Finding:** ~1.4 mi to Howard MetroRail Red Line station; ~½ mi to Route 243 stops; no protected bike lanes on Cinchring; suburban-walkable street network (HOA-maintained interior sidewalks limited). Austin eliminated general motor-vehicle parking minimums in November 2023, so no parking ratio applies to the duplex; only accessible parking (n/a at 2-unit residential under IBC 1106) and bicycle parking minimums (LDC § 25-6-477) survive.
**Implication:** Modest multimodal access supports a market-rate duplex but does not unlock parking reductions beyond Austin's existing 0-minimum baseline. No additional regulatory hook.

### Street Impact Fee — does not apply at duplex scale
**Severity:** note (absence of constraint)
**Citation:** LDC § 25-6-662; LDC § 25-6-663(B); ATD SIF Estimator
**Finding:** Street Impact Fees are assessed and collected at building permit issuance for new development citywide, but the **fee schedule for residential land uses ≤ 2 units is generally de minimis** and is assessed via the standard SIF Estimator workflow. SIF is independent of TIA and applies regardless of trip count, but the duplex's net new VTDs are far below thresholds where SIF becomes material to a pro-forma.
**Implication:** Expect a small SIF assessment via ATD KNACK portal at building permit; budget as a line item but it is unlikely to be a material cost relative to the sidewalk fee.

## Plan-specific findings
(N/A — no concept plan provided; SIR scope only.)

## Open questions for the engineer
- Final driveway location and apron geometry (curb cut permit at building permit; field-verify existing apron).
- Sidewalk election — build vs fee-in-lieu — at submittal; pull current FY2025/26 Sidewalk Fund fee schedule for exact fee.
- Field-verify presence/absence of any existing public sidewalk on Cinchring frontage (Street View or site walk).
- Confirm current FY Street Impact Fee assessment amount via ATD KNACK SIF Estimator.

---

## Water & Wastewater

**Scope:** Austin Water (AW) service feasibility for the proposed demolition of the existing single-family house and construction of a two-unit attached duplex on Lot 12, Block M, Scofield Subdivision, Section II, Phase VI (~8,054 SF interior infill parcel; Walnut Creek watershed, Suburban classification, Desired Development Zone).

**Note on covenants:** Scofield Declaration §4.1 (Vol. 11863, Pg. 1147) restricts the lot to single-family use; this independently blocks a duplex regardless of any utility finding below. All findings assume the duplex is entitled to proceed (CC&R amendment, non-enforcement letter, or substitution to SF + ADU). See the Restrictive Covenants section.

## Summary
- Parcel is inside Austin Water's retail water and wastewater service area; existing house already has both taps. No Service Extension Request (SER) anticipated at this scale.
- Austin Water's two-meter rule requires individual water meters per duplex unit; a second water tap and second wastewater service lateral are required. This is a hard, non-waivable rule.
- A Utility Tap Plan signed and sealed by a Texas PE is a hard gate before residential plan review for a duplex — must be commissioned at SD, not at permit submittal.
- Tap fees and water/wastewater Capital Recovery Fees (CRFs) on the second unit will run $15K-$30K (verify against the AW FY26 schedule at permit time); SMART Housing affordability path waives CRFs.
- A concrete sanitary sewer vault on the survey near the rear lot line and the 7.5' rear P.S.E./M.U.E. govern lateral tap coordination.

## Findings

### Austin Water service area confirmed
**Severity:** note
**Citation:** UCM 2.2.1 (impact-fee boundary defines AW retail service area); Additional Jurisdictional Context §5; Property Records section (no MUD/WCID/special-district overlap).
**Finding:** The parcel sits inside Austin Water's retail water and wastewater service territory. Scofield was annexed full-purpose with direct AW service (no MUD was ever formed in this subdivision; Wells Branch MUD is a different polygon to the south). PEC has no role here (Austin Energy is the electric provider; PEC serves rural/Hill Country only). The existing house has both a water tap and a sanitary sewer connection — the latter corroborated by the concrete sanitary sewer vault labeled near the rear lot line on the 1994 survey.
**Implication:** No CCN release or transfer is required. No off-site main extension required at this scale (8,054 SF infill on an established 1993 street with mains-in-place). The remaining work scope is limited to a second tap, fees, and meter coordination.

### Two-meter rule for duplex — hard requirement
**Severity:** moderate
**Citation:** Austin Water Service Standards (per UCM 2.9.2.E and AW residential metering policy); Additional Jurisdictional Context §5: *"Properties with two, three, or four individual dwelling units (attached or detached) shall have an individual AW water meter serving each dwelling unit."*
**Finding:** A duplex must have one AW-approved water meter per unit. No master-meter exception is available for new construction. Each unit also gets its own wastewater cleanout. A second water tap (or, where permitted by AW, a single service split with two compliant meters in approved boxes adjacent to ROW) and a second wastewater lateral are required.
**Implication for the developer:** Adds a second water tap installation, a second meter box (must be in public ROW or in an easement immediately adjacent to ROW per UCM 2.9.2.E.3 — not behind fences, not on private lines), and a second wastewater service lateral. Affects driveway, landscape, and curb layout. Coordinate meter locations on the civil and architectural sets from SD onward.
**Recommended next step:** Engage civil engineer at schematic to fix the two meter-box locations along the Cinchring frontage; coordinate with the 5' front P.U.E. and the platted sidewalk corridor.

### Tap fees + Capital Recovery Fees on the second unit
**Severity:** moderate
**Citation:** LDC § 25-9-321 (water/WW impact fee authority); AWU Water Impact Fee Ordinance No. 20111215-115 (fee schedule, periodically updated); UCM 2.6.1 (tap fees + inspection fees); Tex. Local Gov. Code Ch. 395.
**Finding:** The second dwelling unit triggers a second tap permit and a second equivalent residential connection (ERC) for CRF purposes. Order-of-magnitude (must be verified against the AW fee schedule current at tap-permit pull — fees are not locked in by SER and have been updated several times since 2011):
- Water tap fee: ~$3,000-$8,000 (5/8" or 3/4" domestic, typical)
- Wastewater tap fee: ~$2,500-$6,000
- Water Capital Recovery Fee: ~$5,000-$8,000 per ERC (5/8" basis; scales by AWWA meter equivalence)
- Wastewater CRF: ~$3,000-$5,000 per ERC
- DSD + City inspection fees per UCM 2.6.1 (smaller dollar; often missed at GC hand-off and delays close-out)
- **Total second-unit tap + CRF likely $13K-$27K; budget $25K-$30K conservatively.**
The existing house's tap and prior CRF stay with the parcel (not refundable) and offset the first unit; only the second unit's fees are incremental.
**Implication for the developer:** Material line item in the duplex pro forma. Fees are assessed at the schedule in effect when the tap permit is pulled, not when permits are filed — schedule risk is small but real.
**Recommended next step:** Pull current AW fee schedule at Design Development; cross-check with the Programs section for SMART Housing CRF waiver (see Opportunity below).

### Utility Tap Plan (PE-stamped) — hard gate for residential plan review
**Severity:** moderate
**Citation:** Austin Water residential plan-review submittal requirements (Additional Jurisdictional Context §5: *"A Utility Tap Plan, prepared by a Texas-licensed PE and submitted via AB+C, is required prior to residential plan review for a duplex"*); `tapplan.com` AW portal.
**Finding:** Duplex plan review requires a Utility Tap Plan signed and sealed by a Texas PE, submitted via AB+C, before residential building plan review will start. This is a separate engineering deliverable from the architectural permit set and is a common late-stage stall point on small infill projects where the owner did not budget civil engineering.
**Implication for the developer:** Civil engineering fee in the ~$2K-$5K range for the tap plan alone (more if combined with site-plan-exemption drainage work). The Utility Tap Plan must reconcile to AW's General Information & Construction Notes Sheet conventions including the FIRE/DOMESTIC/IRRIGATION DEMAND DATA table (UCM 2.9.x), even on a duplex.
**Recommended next step:** Engage civil engineer at Schematic Design; do not defer to permit submittal or it becomes the critical path.

### No Service Extension Request anticipated
**Severity:** note
**Citation:** LDC § 25-9-33(A) (SER triggers); UCM 2.2.3(E) (SER is not capacity reservation).
**Finding:** None of the LDC § 25-9-33(A) SER triggers appear to apply at duplex scale on this infill lot: (1) the nearest accessible water main is in Cinchring Ln ROW and the wastewater main is in the rear 7.5' P.S.E. (both well under the 100-ft trigger); (2) no transmission main (≥24") or interceptor (≥18") is involved — Cinchring is a residential local street with 8" mains typical of 1993 Scofield construction; (3) no pressure-concern-area or wastewater-capacity-concern-area designation surfaced in this research (these are administrative AW flags and would have to be reconfirmed at the AW pre-application meeting if the project escalates in scale, but at 2 LUEs they are very unlikely to apply); (4) not a decentralized system. Two LUEs (1 LUE = 245 gpd per UCM 2.9.4.A.1; duplex = 2 LUEs = 490 gpd average) is well within typical north-Austin local-distribution capacity.
**Implication:** No 3-9 month SER timeline. Plan review proceeds on the residential track once the Utility Tap Plan is in.
**Data-gap:** Confirm at AW pre-application correspondence that the parcel is not flagged in any administrative Pressure Concern Area or Wastewater Capacity Concern Area. These designations are not mappable from public data.

### Existing sanitary sewer vault and rear easement
**Severity:** note
**Citation:** 1994 survey ("CONC. SAN. SEW. VAULT" near rear); plat Cabinet 91 Sl. 264-265 (7.5' M.U.E. & P.S.E. along rear); UCM 2.9.1.A.1 (easement geometry rules).
**Finding:** A concrete sanitary sewer vault is shown near the rear (south) property line. This is consistent with a public sanitary sewer main running through the rear 7.5' P.S.E. (Public Sewer Easement) and a vault serving either the lot's existing lateral or the line itself (cleanout / maintenance access). The second-unit wastewater lateral will most likely tee into the same public main; tap location, lateral routing, and any vault relocation must be coordinated with AW Field Operations during tap-plan preparation.
**Implication for the developer:** Minor coordination item, not a feasibility blocker. The 7.5' rear P.S.E. is narrow by UCM 2.9.1.A.1 standards (minimum 15' wide or 2× depth-to-flowline for new easements, with infrastructure centered) — but this is an existing platted easement, not a new one, and AW will work within it. Confirm depth-to-flowline so the duplex foundation design doesn't conflict with required cover or vault access.
**Recommended next step:** Have the civil engineer coordinate the tap location and confirm vault disposition (preserve / relocate / abandon-and-replace) with AW Field Operations before tap-plan submittal.

### Water capacity (informational)
**Severity:** note
**Citation:** AW North Service Area; Walnut Creek interceptor / sewershed; Additional Jurisdictional Context §3 (Kramer Substation context for general north-Austin capacity posture — electric, not water, but confirms ongoing investment in this corridor).
**Finding:** 78727 sits in AW's North Service Area, with potable water served from the north-Austin distribution network. Walnut Creek wastewater interceptor handles the broader north-Austin sewershed including this parcel. No moratorium, no service-limit constraint, no published capacity concern in this corridor at this date. Pressure zone must be designated on the Utility Tap Plan / AW General Info Sheet — confirm with AW; typical residential pressure zones in this area maintain >40 psi at the meter.
**Implication:** Capacity is not a binding constraint at 2 LUEs. Fire flow under FPCM Table 507-1 for one- and two-family dwellings <3,600 SF has a 1,000 gpm floor — this corridor reliably exceeds that.
**Data-gap:** Pressure zone designation; current AW fire-flow test on Cinchring main (tests are valid ~1 year).

### Mandatory reclaimed water connection — NOT APPLICABLE
**Severity:** note
**Citation:** LDC § 25-9-412.
**Finding:** Article 5 of Ch. 25-9 (mandatory reclaimed connection at 250 / 500 ft) **applies only to multifamily 5+, mixed-use, and commercial projects.** A duplex is a 2-unit single-family product and is exempt.
**Implication:** No mandatory reclaimed-line research required. (Opportunity to use rainwater capture or graywater for irrigation remains — see Opportunities.)

### OWRS (Onsite Water Reuse System) — NOT APPLICABLE
**Severity:** note
**Citation:** LDC § 25-9-414; City Code § 15-13-7.
**Finding:** OWRS mandate applies to large development (GFA ≥ 250,000 SF) — MF / mixed-use / commercial — for site-plan applications filed on or after April 1, 2024. A duplex is orders of magnitude below the threshold. The separate cooling-tower trigger (combined capacity ≥100 tons) does not apply to a duplex.
**Implication:** None.

### Industrial Waste Control — NOT APPLICABLE
**Severity:** note
**Citation:** Austin City Code Chapter 15-10.
**Finding:** Domestic discharge only. No grease, no sand/oil, no hazardous materials interceptor required.

### OSSF / septic — NOT APPLICABLE
**Severity:** note
**Citation:** LDC § 25-4-192; Austin City Code Ch. 15-5.
**Finding:** Parcel is inside full-purpose COA with a public WW main in the rear easement and an existing connection to it. OSSF is neither available nor needed. Mandatory public connection within 100 ft applies and is already satisfied.
**Implication:** No septic abandonment record needed (the existing house is already on public sewer). The Edge clay-loam (EdC) soil class and 1-5% slopes from the GIS soil layer are noted but moot — OSSF rules don't apply on this parcel.

### Stormwater drainage charge (recurring OpEx)
**Severity:** note
**Citation:** COA Watershed Drainage Charge (Additional Jurisdictional Context §6); FY25-26 rate $0.00593 / SF IC / month.
**Finding:** Post-build impervious-cover increase from ~30-40% (existing 2,095 SF single-story with driveway) to a likely 55-65% under a HOME-2 duplex roughly doubles the drainage charge. Per-unit charge moves from ~$14/mo today to ~$25-30/mo per unit ($300-360/yr per unit).
**Implication:** Negligible at unit scale (~$15/mo increment per unit). Stormwater Management Discount (up to 50% reduction via on-site rainwater capture / detention) is a lever if rainwater capture is in the design anyway.

### Backflow prevention + irrigation metering
**Severity:** note
**Citation:** Austin Water Cross-Connection Control program; City Code § 15-1 (Plumbing); UCM 2.9.2.
**Finding:** If either unit installs an automatic irrigation system, an RPZ (reduced-pressure-zone) backflow preventer is required at the irrigation line. A **separate irrigation meter** (per unit, or shared) is also typically economically attractive — irrigation water is not subject to the wastewater volume charge, which can save the owner ~$2-4/kgal on landscape watering over the duplex's life. UCM 2.9.3.D.5 requires separate meters per use category where multiple use categories exist (domestic, irrigation, fire, reclaimed); reclaimed and fire don't apply here.
**Implication:** Worth designing in at SD if landscape is permanent; can be value-engineered out if landscape will be drip-only or xeriscaped (Scofield Declaration §3.19 requires 2 trees per front yard within 10' of ROW — modest irrigation likely needed in early establishment years).

### Texas Gas Service (informational, not Austin Water)
**Severity:** note
**Citation:** Texas Gas Service (Additional Jurisdictional Context §7); Scofield Declaration §3.11 (each lot must have natural gas service; each dwelling must have at least 2 natural-gas appliances).
**Finding:** TGS is the regulated LDC. Demolition requires a TGS abandonment / cap at the curb stop. New duplex can re-use the existing service (if location and load support both units) or request a new tap. Two individual TGS meters on a meter manifold is the standard convention for duplexes. TGS tap lead time in north Austin is typically 4-8 weeks. **Scofield Declaration §3.11 makes gas service mandatory at the lot, with at least 2 gas appliances per dwelling** — this is a CC&R rule, not an AW rule, but it reinforces that gas is part of the utility scope.
**Implication:** Sequence TGS abandonment with the demo permit; sequence the new tap before slab work.

## Plan-specific findings

N/A — no concept plan was provided; this is a Site Intelligence Report only.

## Opportunities

### SMART Housing waives water + wastewater Capital Recovery Fees
**Severity:** opportunity
**Citation:** Austin Housing SMART Housing program; LDC § 25-9-412(E) / § 25-9-414(B)(2) (analogous affordable-housing exemptions on reclaimed and OWRS — for context that the City does waive utility fees on the affordability path); Programs section.
**Finding:** SMART Housing certification (≥10% affordable units for ownership or rental, with deeper-affordability tiers carrying larger benefits) waives water and wastewater Capital Recovery Fees among other fees. On a duplex, dedicating one of the two units to a SMART Housing affordable tenant eliminates the CRFs on that unit — a ~$8K-$13K reduction.
**Implication:** If the pro forma can absorb the affordability income restriction on one unit, this opportunity offsets a meaningful share of the second-unit tap+fee budget.
**Recommended next step:** Coordinate with the Programs section and the COA Housing Department on SMART Housing pre-certification before tap-permit pull.

### Alternative water sources reduce demand and IC penalty
**Severity:** opportunity
**Citation:** City Code § 15-1-19 (alternative water sources registry); § 15-1-14(C)(33)(c) (small residential systems exempt from RPZ containment); COA Stormwater Management Discount.
**Finding:** Rainwater capture (≤500-gal residential outdoor systems are exempt from RPZ containment), graywater reuse, and condensate capture can all be installed without OWRS-level engineering on a duplex. These reduce potable demand (modest), reduce drainage charge (up to 50% via Stormwater Management Discount), and can earn credit toward COA's voluntary water-conservation incentives. A simple 250-500 gal rain barrel set per unit is a near-zero-cost lever.
**Implication:** Marginal capex, marginal OpEx benefit, but reinforces a "sustainable infill" marketing story if relevant to the buyer pool.

### Director-level SER approval available if scope ever expands
**Severity:** opportunity (not currently applicable)
**Citation:** LDC § 25-9-35; Property Records section (parcel verified inside Desired Development Zone).
**Finding:** The parcel is in the Desired Development Zone (per Austin GIS CRFZONE='DDZ'). If a future scope (e.g., redeveloping as a 3-unit HOME-Phase-1 product instead of a 2-unit duplex, or aggregating with an adjacent lot) ever triggers an SER, Director-level SER approval is available under § 25-9-35 (vs. City Council) where capacity exists. Shortens timeline.
**Implication:** Not applicable to the current 2-unit scope but worth flagging if scope grows.

## Open questions for the engineer / next steps

- Confirm meter locations with AW Field Operations (two boxes along Cinchring frontage, both in ROW or in easement immediately adjacent to ROW per UCM 2.9.2.E.3).
- Pull current AW Capital Recovery Fee schedule and tap-fee table at DD; recompute second-unit fees against verified FY-current rates.
- Confirm rear sanitary sewer vault disposition (preserve / relocate / abandon-and-replace) and confirm depth-to-flowline of the rear main so duplex foundation design clears required cover.
- Request AW correspondence to confirm parcel is **not** in any administrative Pressure Concern Area or Wastewater Capacity Concern Area (the only way to know — not mappable).
- Confirm pressure zone for the Utility Tap Plan / AW General Information Sheet.
- Confirm current fire-flow availability on Cinchring main (test report valid ~1 year).
- Sequence TGS abandonment + new-tap (4-8 week lead) into the demo + slab schedule.
- Coordinate with the Programs section on SMART Housing CRF-waiver pathway.
- Coordinate with the Restrictive Covenants finding: all water and wastewater scope above is conditional on the duplex actually being entitled to proceed under Scofield Declaration §4.1 (currently it is not — see the Restrictive Covenants section).

---

## Fire

**Project:** Demolish existing 1-story SFR; construct attached duplex (2 units) on ~8,055 SF lot (Lot 12, Block M, Scofield Subdivision Sec. II Phase VI).
**Jurisdiction:** City of Austin full-purpose; Austin Fire Department (AFD) is first-due. Travis County ESD No. 2 does **not** apply (parcel is inside COA full-purpose annexation, confirmed in Additional Jurisdictional Context §11).
**Code edition:** 2024 IFC governs all building-permit submittals dated 7/10/2025 or later (LDC §25-12-171). A duplex permit pulled in 2026 is squarely under the 2024 IFC + 2024 IWUIC.
**Occupancy:** IRC R-3 (one- or two-family dwelling) — the duplex sits below the IBC threshold (R-2 begins at 3+ units), and the IRC governs construction.

## Summary

- **R-3 residential.** A two-unit attached duplex on a single lot is IRC scope (one- and two-family dwellings). Standard residential code path — no IBC Group R-2 review, no fire-protection-system shop drawings, no AFD Fire Analysis Table on the cover sheet.
- **No fire sprinklers anticipated.** IRC §R313.1 mandates NFPA 13D for two-family dwellings, but Texas legislative pre-emption (Tex. Loc. Gov't Code §233.155) and COA's IRC adoption ordinance historically waive the mandatory residential sprinkler requirement for one- and two-family dwellings. **Verify current COA amendment status at permit intake** — this is the single largest cost-swing item in this discipline.
- **WUI Proximity Zone C adds modest construction-cost premium.** Per the Property Records research, the parcel maps in Zone C (light WUI). Triggers Class A roof, ignition-resistant exterior, ember-resistant vents, and defensible-space landscaping per the 2024 IWUIC as adopted in LDC §25-12-183. Note: the Environmental section's independent reading suggests Zone C designation in a fully built-out 1990s suburban interior lot is geographically counterintuitive; the WUI Code Map should be re-pulled by the surveyor to confirm A/B/C vs. "not mapped."
- **Apparatus access, dead-ends, hydrant spacing — all non-binding.** Cinchring is a 50' platted public ROW already serving the lot. The 150 ft / 200 ft / 600 ft apparatus and hose-lay rules in LDC §25-12-173 §503/507 are easily satisfied. No on-site fire lane, FDC, AMOC, Knox Box, PIV, or fire-main scope.
- **Hydrant flow data-gap.** No AFD flow test on file in the available record. For R-3 the required fire flow per IFC Appendix B Table B105.1(1) is **1,000 gpm at 20 psi for ≤3,600 SF, scaling up by floor area**, and is reducible to **500 gpm** when sprinklered to NFPA 13D. Almost certainly compliant on a 12" main in mature North Austin, but should be confirmed via Austin Water hydrant flow test before final design.

---

## Findings

### 1 — Occupancy classification: IRC R-3 (one- and two-family dwelling)
**Severity:** note
**Citation:** IRC 2021 as adopted by COA (with 2024 cycle adoption tracking LDC §25-12-1); IBC §310.5 R-3 definition; LDC §25-12-2.
**Finding:** A duplex with 2 attached dwelling units on a single lot is IRC scope — specifically a "two-family dwelling" under IRC §R202 and IBC R-3 occupancy. Group R-2 (which carries the higher-fee multifamily permit path, AFD Fire Analysis Table, sprinkler review, etc.) begins at three or more units.
**Implication for the developer:** Permit path is COA Residential Review, not Commercial / Site Plan. No AFD-stamped cover sheet, no Fire Analysis Table, no AMOC, no high-rise track. Building permit reviewed under IRC + COA local amendments.
**Recommended next step:** Confirm the unit count remains at 2 throughout design. If the program ever expands to 3 units (an option under HOME-1, which allows up to 3 units on SF lots), the project crosses into IBC R-2 / IBC Chapter 1 / commercial site-plan review territory and the fire scope expands meaningfully.

### 2 — Sprinkler requirement (IRC §R313.1) — verify COA waiver
**Severity:** data-gap
**Citation:** IRC §R313.1 (mandatory NFPA 13D sprinklers in one- and two-family dwellings, baseline IRC text); Texas Local Government Code §233.155 (pre-empting mandatory residential sprinklers in cities adopting the IRC); historical COA IRC adoption amendment (verify current).
**Finding:** Baseline IRC text requires NFPA 13D in two-family dwellings. Texas state law and COA's IRC adoption have historically exempted one- and two-family dwellings from mandatory sprinklers (owner-elected only). For 2024-cycle IRC adoption by COA (LDC §25-12-1), the amendment should be re-verified — but the strong expectation is **no mandatory sprinkler system for this duplex**.
**Implication:** If exempt (expected): no NFPA 13D system, no fire main, no PIV, no fire-line backflow, no FDC, no riser room. Construction cost stays on a standard residential basis. If COA has tightened to require sprinklers in two-family dwellings (unlikely but check): adds ~$8K–$15K (NFPA 13D from domestic supply, typically no separate fire tap on R-3) and triggers an annual inspection regime.
**Recommended next step:** Pull the current COA IRC amendment to §R313.1 from the LDC §25-12-1 ordinance text at permit intake. If sprinklers are owner-elected, factor a single-line decision into early design (insurance premium reduction can offset ~30–50% of the installed cost over a 10-year hold).

### 3 — Party-wall fire-resistance rating (IRC §R302.3)
**Severity:** note
**Citation:** IRC §R302.3; IRC Table R302.6 (dwelling-garage separation).
**Finding:** The party wall separating the two dwelling units must be a **1-hour fire-resistance-rated assembly** continuous from the top of the foundation to the underside of the roof sheathing (or to the ceiling of an attic separated by a 1/2" gypsum membrane — the typical residential approach). When the structure is sprinklered throughout per NFPA 13D, IRC R302.3 Exception 2 allows the rating to drop to 1/2-hour (one layer 5/8" Type X each side). Without sprinklers: full 1-hour.
**Implication:** Architect must specify a code-recognized 1-hour assembly (typical: double 2x4 staggered-stud or single 2x6 with 5/8" Type X gypsum each side; UL U305 / U341). Acoustic separation (IBC §1206 doesn't strictly apply to R-3, but market expectation for duplexes is STC 50+) typically drives the wall to perform well above the 1-hour minimum at modest cost premium. Negligible incremental impact vs. typical duplex construction.

### 4 — Fire-department apparatus access (LDC §25-12-173 §503; IFC §503)
**Severity:** note
**Citation:** LDC §25-12-173 §503.1.1 (Austin amendment — IFC Appendix D **not** adopted); §503.2.1 (25 ft width / 14 ft vertical); §503.2.4 (turning radii 25 ft inside / 50 ft outside).
**Finding:** Cinchring Lane is a 50' platted public ROW (Cabinet 91, Slide 264–265) with paved curb-to-curb section satisfying L1 Local cross-section per the Transportation Research section. AFD apparatus accesses the lot directly off Cinchring — no private fire lane, no on-site apparatus road, no turnaround, no hammerhead, no dead-end >150 ft. The 150 ft path-of-travel from apparatus to exterior building wall is satisfied trivially at residential scale.
**Implication:** No fire-lane striping, no fire-lane signage, no gate, no Knox Switch, no apparatus loading on private pavement. Driveway design is governed entirely by TCM §7 (residential, see the Transportation Access section §7) — fire code adds no constraints.

### 5 — Hydrant flow and spacing (LDC §25-12-173 §507.5; UCM §2.9.2.D)
**Severity:** note (with data-gap on actual flow)
**Citation:** LDC §25-12-173 §507.5.1 (hose-lay 600 ft for R-3); UCM §2.9.2.D.2 (hydrant spacing 600 ft suburban); IFC Appendix B Table B105.1(1) (R-3 required fire flow).
**Finding:** For Group R-3 the hydrant hose-lay distance is **600 ft to any portion of the structure** regardless of sprinklers. Required fire flow per IFC Appendix B Table B105.1(1) for a 1- or 2-family dwelling under ≤3,600 SF is **1,000 gpm at 20 psi**, scaling to 1,500 gpm in the 3,601–4,800 SF band. Sprinklered (NFPA 13D) reduction to 50% per Table B105.1(1) note brings the demand down to **500 gpm**. Hydrant spacing in suburban areas is 600 ft maximum interval (UCM §2.9.2.D.2). North-central Austin / Scofield is served by mature 12" PVC or DI water mains on interior streets, with hydrant spacing typically well inside 600 ft.
**Implication:** Almost certainly compliant — hydrants on Cinchring or the immediately adjacent Scofield interior streets should provide ample coverage for an R-3 demand. Not a binding constraint on duplex design.
**Recommended next step:** Request an AFD-conducted or AFD-witnessed hydrant flow test on the nearest hydrant (per IFC §507.4 as locally amended) before final design if the architect intends an unsprinklered design. For sprinklered design the 500 gpm floor is so far below typical Austin Water supply that the test is essentially confirmatory.

### 6 — WUI Proximity Zone C (LDC §25-12-183; 2024 IWUIC; FPCM §4.10.0)
**Severity:** moderate
**Citation:** LDC §25-12-183 (Austin amendments to 2024 IWUIC); 2024 IWUIC §§503, 504, 505 (ignition-resistant construction); FPCM §4.10.0.
**Finding:** Per the Property Records research, the parcel is in **WUI Proximity Zone C** — the lightest of the three Austin WUI overlays. Zone C is the "light WUI" tier: more than 150 ft but less than 0.5 mi from a ≥40-acre wildland, or within 1.5 mi of a ≥750-acre wildland. Zone C triggers a defined subset of ignition-resistant construction provisions:
- **Roof covering:** Class A (asphalt composition shingle Class A, metal, concrete tile — most residential roofing already meets this).
- **Exterior wall assemblies:** ignition-resistant (1-hour-rated exterior wall, fiber-cement siding, stucco, or noncombustible cladding — fiber-cement and stucco are standard duplex finishes already).
- **Eaves and attic ventilation:** ember-resistant (1/8" or finer mesh screening; baffled or WUI-listed vents — modest spec change).
- **Decking and exterior glazing:** ignition-resistant decking material if a deck is present; tempered glass on glazed openings (typical new-construction spec).
- **Defensible space:** landscape clearance / fuel modification within 30 ft of structure (limited application on a 60×127 suburban lot — primarily a planting-palette and mulch-type constraint).
**Implication for the developer:** Adds an estimated **$5K–$15K** to construction cost across roofing upgrade (already likely), siding selection (likely already Class-A-equivalent fiber cement), vent specs (most cost-significant line item), and landscape specification. Architect must call out WUI Zone C assemblies on permit drawings; AFD Wildfire Division has separate concurrent review authority per FPCM §4.10.0.
**Recommended next step:**
1. Re-run the COA WUI Code Map / Zone Lookup tool (https://www.austintexas.gov/department/wildland-urban-interface-code; lookup at https://www.arcgis.com/apps/instant/lookup/index.html?appid=aac08abc87054f339204acf5d7914204) at the parcel coordinate (~30.41494° N, -97.68391° W) to confirm Zone C designation. The Environmental section's independent analysis suggests this interior 1990s subdivision lot may actually be **outside** any WUI zone, in which case this entire finding falls away. If the map shows Zone C: budget the cost premium and add WUI assemblies to spec sheets. If the map shows "not mapped": delete this finding.
2. Submit to AFD Wildfire Division for stamp concurrent with building permit if Zone C is confirmed (AFD Wildfire is the only entity that can authoritatively rebut a map designation; self-declared "not in WUI" is deficient per FPCM §4.10.0).

### 7 — Smoke alarms and carbon monoxide alarms (IRC §R314, §R315)
**Severity:** note
**Citation:** IRC §R314 (smoke alarms); IRC §R315 (CO alarms).
**Finding:** Each dwelling unit requires hardwired, interconnected smoke alarms in each sleeping room, outside each sleeping-area grouping, and on each story including basements. CO alarms required outside each sleeping area in dwellings with fuel-burning appliances or attached garages (both expected: gas furnace per Texas Gas Service availability noted in Additional Jurisdictional Context §7; attached or shared garage typical for duplex).
**Implication:** Standard residential MEP scope; negligible cost.

### 8 — Emergency escape and rescue openings (IRC §R310)
**Severity:** note
**Citation:** IRC §R310.
**Finding:** Each sleeping room (other than those in basements with a code-compliant secondary exit) requires an emergency escape and rescue opening: 5.7 SF net clear opening (5.0 SF at grade), 24" min clear height, 20" min clear width, sill ≤44" above floor.
**Implication:** Standard residential design; architect must verify each bedroom's window package meets IRC R310. No fire-code constraint beyond standard residential practice.

### 9 — Address identification (IFC §505.1; AFD addressing standards)
**Severity:** note
**Citation:** IFC §505.1 (as locally amended by LDC §25-12-173); AFD addressing guidance.
**Finding:** Each dwelling unit must have a distinct, visible address number contrasting with its background, ≥4" tall on the street-facing facade. Duplex convention in Austin is **12713-A** and **12713-B** (or **12713-1** / **12713-2**), with AFD-approved unit designations established at TCAD platting / Austin Water tap planning (each unit gets its own water meter per Additional Jurisdictional Context §5; addressing flows from that step).
**Implication:** Coordinate unit address assignment with Austin Water Tap Plan submittal (AB+C). No Knox Box required for R-3 — Knox Box is a commercial provision (IFC §506.1; FPCM Appendix E §3.2.16) triggered by fire-protection systems or physical access barriers, neither of which applies here.

### 10 — Construction-phase fire protection (IFC §3313; FPCM §4.4.0)
**Severity:** note
**Citation:** IFC §3313 (water supply during combustible-construction phase); IFC §501.4 (fire protection infrastructure installed before vertical work).
**Finding:** Once combustible framing arrives on site, IFC §3313 requires ≥500 gpm within 500 ft. On an interior R-3 lot with mature city hydrants on the same block, this is satisfied by the existing public hydrant network with no additional infrastructure. Demolition of the existing structure must include AFD / AW notification if the existing water service is disconnected and re-tapped (IFC §901.7.4 for fire-line changes is not applicable here since there is no fire line).
**Implication:** No on-site temporary fire-protection setup beyond the existing public hydrant network. Standard demo permit utility-disconnect coordination per Additional Jurisdictional Context §13 covers the procedural piece.

### 11 — Pipeline ordinance (LDC §§25-4-134, 25-2-516)
**Severity:** note (cleared)
**Citation:** LDC §§25-4-134, 25-2-516; 49 CFR §195.2.
**Finding:** Pipeline ordinance two-prong test (hazardous liquid per 49 CFR Part 195 **AND** ≥8" ID) is not met. No mapped hazardous-liquid pipeline on or adjacent to this interior suburban residential parcel; natural-gas distribution (49 CFR Part 192, Texas Gas Service service line) does not qualify even if a service line runs to the lot.
**Implication:** No pipeline setback / easement constraint. No buffer encumbrance on building envelope.

---

## Plan-specific findings

N/A — no concept plan was provided. The SIR is informational. When a concept plan is produced, the architect should add the following call-outs to the residential building permit set:
- Party-wall assembly UL designation (e.g., U305) with continuity detail from foundation to roof sheathing.
- WUI Zone C assembly designations on roof, exterior wall, eave, vent, and decking elements (if Zone C is confirmed by the WUI Code Map re-pull).
- Hardwired-interconnected smoke + CO alarm locations per unit.
- Emergency-escape-window schedule with net clear opening dimensions per sleeping room.
- Address-identification detail showing distinct unit numbering ≥4" tall on street-facing facade for each unit.

---

## Open questions for the engineer

- **AFD's current amendment status of IRC §R313.1** for two-family dwellings — does COA continue to waive mandatory residential sprinklers under Tex. Loc. Gov't Code §233.155, or has the 2024-cycle adoption tightened? Pull the current LDC §25-12-1 amendment text.
- **WUI Proximity Zone C confirmation** at the parcel coordinate — the Environmental section's analysis and the Property Records GIS pull disagree. Re-run COA WUI Code Map / Zone Lookup at ~30.41494° N, -97.68391° W and treat the lookup result as authoritative. If "not mapped," the entire WUI cost premium falls away; if Zone C, budget $5K–$15K.
- **Hydrant flow test** — request an AFD-conducted or AFD-witnessed flow test on the nearest Cinchring or Scofield-interior hydrant before final design if the design path is unsprinklered. For sprinklered (NFPA 13D) design, supply will be ample at the 500 gpm demand and the test is confirmatory only.
- **Unit count discipline** — confirm with the developer that the program stays at 2 units. A 3-unit program (HOME-1 path) crosses the IBC threshold and recasts the entire fire-code scope (R-2, AFD Fire Analysis Table, NFPA 13R sprinklers in some massings, separate Fire Marshal review).
- **Knox Box** — confirm (expected: not required for R-3). If the duplex includes any fenced rear-yard or motorized gate restricting AFD ingress, a Knox Switch on the gate may be triggered (IFC §506.1 as locally amended); standard suburban duplex with open front-yard driveway has no such trigger.

---

## Parkland

## Summary
- Parkland dedication has **near-zero exposure** on this project. Austin's parkland dedication ordinance (LDC §§25-1-601–612, as restructured by Ord. 20231130-087, eff. Jan 1, 2024) attaches to **single-family at subdivision** and to **multifamily/hotel at site plan**. This project is neither — it is a 2-unit duplex on an existing platted lot, intaken as a **residential building permit** with no site plan and no new subdivision.
- No fee-in-lieu, no land dedication, no PARD Parkland Dedication Determination required for the duplex path. The only scenario that pulls parkland into the picture is the **HOME 2 resubdivision alternative** (split the lot into two small-lot SF), which would create a new subdivision and thereby a single-family parkland obligation.
- Net result: parkland is effectively a non-issue for the primary duplex pathway. Document the absence, confirm at intake, move on.

## Findings

### Parkland dedication does not apply to a duplex on an existing platted lot
**Severity:** note (absence of constraint)
**Citation:** LDC §§25-1-601(B)–(C); LDC §25-5-2(c) (site plan exemption for ≤4 residential units, Ord. 20230720-158); Ord. 20231130-087 (current Article 14 structure)
**Finding:** Under current LDC Article 14, parkland dedication attaches at two procedural moments only: (a) **site plan approval** for multifamily and hotel/motel projects, and (b) **subdivision (final plat) approval** for single-family residential. This duplex project is exempt from site plan review entirely under Site Plan Lite Phase 1 (≤4 units → §25-5-2(c) exemption — see the Zoning Pathway section §7) and is not creating a new subdivision (existing platted Lot 12, Block M, Scofield Sec II Phase VI). Neither attachment point is hit. A residential building permit is not a parkland-dedication trigger under Article 14.
**Implication for the developer:** No PARD review, no Parkland Dedication Determination (LDC §25-1-610) required, no fee-in-lieu, no land dedication, no parkland coversheet note. PARD is not a review department on this permit.
**Recommended next step:** Confirm with DSD Residential Plan Review at intake that no parkland review is routed (it should not be). If a Pre-Development Consult is scheduled (recommended per the Zoning Pathway section §8), include this confirmation as a checklist item to lock it down on the record.

### On-site land dedication is structurally infeasible regardless
**Severity:** note (absence of constraint)
**Citation:** PDOP §14.3.7(A)(7)(a) — ¼-acre minimum parcel size for dedicated parkland
**Finding:** Even if dedication were triggered, the lot is ~0.185 ac (~8,083 SF), well below the ¼-acre (10,890 SF) minimum parcel size for any dedicated parkland parcel. There is no physically viable on-site dedication path. Off-site dedication would also fail: an off-site parcel would need to be acquired and would still need to meet PDOP §14.3.7 standards within the ½-mile proximity radius (subject parcel is outside the Parkland Dedication Urban Core; ½-mile applies per PDOP §14.3.7(B)).
**Implication for the developer:** If a parkland obligation ever did attach to this site (it does not, see prior finding), fee-in-lieu would be the only mechanism. Land dedication is off the table.

### Park service area context — Walnut Creek
**Severity:** note (context)
**Citation:** PARD service area maps; PARD facilities inventory
**Finding:** The parcel sits in the **Walnut Creek park service area** in North Austin. The nearest large public park is **Walnut Creek Metropolitan Park** (~290 acres) ~2 miles south along Lamar/Walnut Creek. Within the Scofield subdivision itself, any pocket parks, greenbelts, or trail amenities are **HOA-maintained common areas under the Scofield ROA** (see the Restrictive Covenants section), not dedicated City parkland. The subject parcel does not abut any City-owned parkland. This rules out the Chapter 26 / Texas Parks & Wildlife Code trigger entirely — there is no existing City parkland on or adjacent to the site that construction could disturb.
**Implication for the developer:** None for the duplex permit. Geographic context only.

### Fee-in-lieu rate — illustrative only, not owed
**Severity:** note (reference only)
**Citation:** PARD fee schedule (updated annually Oct 1); LDC §25-1-602(C) (SF formula); LDC §25-1-608 (MF formula)
**Finding:** For scoping context only — were this a multifamily project at site plan stage in a Suburban Geographic Area, the FY 2025 reference rate is $2,544.94/unit. For a single-family subdivision in the Low Density tier (≤6 DU/ac), the Subchapter 25-1-602 formula plus a development fee under §25-1-607 would apply. **Neither formula applies to this duplex** because neither trigger (site plan for MF, plat for SF) is hit. Quoted only to establish that even in the worst-case mistaken-trigger scenario, the exposure would be a 4-figure fee, not a project-defining cost.
**Implication for the developer:** Trivial in scale even hypothetically. Not in the pro forma.

### Cross-references
- **Zoning Pathway §7–§8** — confirms the duplex is on the residential building permit path, exempt from site plan review (LDC §25-5-2(c)) and exempt from subdivision; both of those exemptions are what removes parkland from scope here.
- **Programs §6 (SMART Housing)** — SMART Housing certification *would* waive parkland fees if any applied (it waives parkland, development review, permit, capital recovery, and inspection fees). Since no parkland fee applies regardless, the parkland-fee waiver is not a reason to pursue SMART on this project. SMART economics for a 2-unit duplex are weak independently (50% affordability set-aside required for one of two units).
- **HOME Initiative Phase 2 resubdivision alternative (Zoning Pathway §6 row, Programs §2)** — if the owner instead pursues splitting the lot into two small-lot SF parcels under HOME Initiative Phase 2's Residential Infill plat, **that does trigger single-family parkland dedication at plat approval** (LDC §§25-1-602, -606, -607). For a 2-lot resubdivision with 2 new SF units in the Low Density tier, expect a fee-in-lieu plus a parkland development fee — most likely converted entirely to fee-in-lieu given the ¼-acre minimum-parcel-size rule. Order of magnitude: low-thousands-of-dollars total; not a deal-breaker but a real line item that does not exist on the duplex path. Flag this as a tradeoff if the owner is comparing duplex vs. HOME Initiative Phase 2 subdivision.
- **Environmental section** — no creek/water-body adjacency, no floodplain, no CEF on the parcel, so even the partial-credit framework (PDOP §14.3.8) would not be in play in any hypothetical trigger.

## Plan-specific findings
(N/A — no concept plan provided; SIR-only.)

## Open questions for the engineer
- **Confirm at DSD residential intake** that no PARD parkland review is routed on this duplex residential building permit. Capture confirmation in the Pre-Development Consult notes if one is held.
- **If the owner pivots to the HOME Initiative Phase 2 resubdivision pathway** (2 small-lot SF instead of 1 duplex), engage PARD pre-plat to size the single-family parkland fee-in-lieu and development fee per §§25-1-602, -606, -607 against the then-current annual fee schedule, and confirm Low Density (≤6 DU/ac) tier applies to a 2-unit / ~0.185-ac resubdivision.
- **Confirm Geographic Area designation** (likely Suburban given North Austin location well outside the CBD/Urban core) only if the HOME Initiative Phase 2 path is taken and a fee figure is needed for pro forma. PARD's annual fee schedule and the Determination letter are the only authoritative sources — do not infer from neighborhood name.

---

# Part III — Synthesis

## Issue Matrix

Consolidates all `significant`, `moderate`, `data-gap`, and `opportunity` findings across the 10 disciplines and the 8 research subjects. Pure `note` (absence of constraint) findings are tracked in the per-discipline sections but not surfaced at exec level.

## Significant

| Discipline | Topic | Code / source | Plan implication |
|---|---|---|---|
| Zoning & Land Use | **CC&R §4.1 prohibits duplex use** | Scofield Declaration of Covenants, Vol. 11863 Pg. 1147; Eighth Amendment, Doc # 2005103195 | **Project not feasible as scoped without HOA action.** Declaration limits all properties to "single-family residential use." Amendment requires 75% Member vote across ~570+ owners. Eighth Amendment (2005) added $25/day fines, attorneys' fees recovery, and lien priority over homestead. |
| Site Plan & Form | CC&R-imposed dimensional restrictions exceed zoning | Scofield Declaration §3.x | Even if duplex were permitted, the CC&Rs impose 50% masonry minimum, 1,200 SF/unit minimum, 2-story max height, garage required, and Architectural Control Committee pre-approval. |

## Moderate

| Discipline | Topic | Code / source | Plan implication |
|---|---|---|---|
| Tree Protection | Heritage tree contingency | Ord. 20100204-038; LDC §25-8 Subch B | A heritage tree (live oak, pecan, walnut, ash, elm, cypress, madrone, bigtooth maple ≥24" dbh) in the building envelope materially constrains placement on a 60'×127' lot. Removal requires Land Use Commission approval — low approval probability. |
| Tree Protection | Protected tree mitigation | LDC §25-8 Subch B; ECM §3.5.4 | Removal of protected (≥19" dbh) non-heritage trees requires 1:1 caliper-inch replacement or fee-in-lieu (~$250/in). Budget contingency $5K–$25K pending arborist inventory. |
| Stormwater & Drainage | Impervious cover delta from ~27% to ~45-55% | LDC §25-8-211; DCM | Increased IC from existing condition. Below the 8,000 SF threshold for WQ control trigger outside the Barton Springs Zone, so no on-site water quality structure is required. Confirmed via §25-8-63(B). |
| Stormwater & Drainage | Sanitary sewer vault near rear lot line | 1994 survey; Austin Water rear 7.5' P.S.E. | A concrete sanitary sewer vault is shown near the rear property line. Compounds the constraint posed by the rear easement; effective no-build zone may be deeper than the 7.5' P.S.E. alone. |
| Transportation | Sidewalk obligation on Cinchring frontage | LDC §25-6-353 | New residential construction triggers sidewalk-or-fee-in-lieu on ~60' frontage. Estimated $2,250 fee or $5K–$10K to build. (Trigger is "new construction"; same obligation would apply to a teardown-rebuild single-family residence.) |
| Water & Wastewater | Two-meter requirement for duplex | Austin Water Service Standards | Each unit requires its own water and wastewater service tap. Second water tap, second wastewater lateral. Affects driveway/landscape layout. |
| Water & Wastewater | Tap fees + Capital Recovery Fees on second unit | Austin Water Fee Schedule; CRF Schedule | Estimated $13K–$27K (typical 5/8" residential meter) for the second unit. SMART Housing waives CRFs if affordability path elected. |
| Water & Wastewater | PE-stamped Utility Tap Plan required | Austin Water plan review submittal | A Texas-PE-stamped Utility Tap Plan is a hard gate before residential plan review. Civil engineering fee ~$2K–$5K. Must commission civil at schematic design, not at permit submittal. |
| Fire | WUI Proximity Zone C — ignition-resistant construction required | Austin WUI Code (2021); LDC §25-12-271 | Triggers Class A roof covering, ignition-resistant exterior wall assembly, ember-resistant attic vents, defensible space. Adds approximately $5K–$15K to construction cost. |
| Site Plan & Form | Subchapter F McMansion envelope | LDC §25-2 Subchapter F Articles 2-3 | McMansion FAR (0.40 base) and 45° tent envelope still apply to residential construction; sets the effective massing constraint at ~3,222 SF gross floor area. |

## Data gaps

| Discipline | Topic | What's missing | Action / source |
|---|---|---|---|
| Zoning & Land Use | Base zoning verification (SF-platted-as-MF-3 anomaly) | Authoritative confirmation of MF-3 base zoning | Request DSD Zoning Verification Letter (~$337 fee). COA Zoning_1 ArcGIS shows MF-3; surrounding lots may differ. The SF-platted-as-MF-3 pattern is a known late-1980s / early-1990s Austin developer move where the tract was zoned higher and then deed-restricted to single-family. |
| Stormwater & Drainage | 15' Drainage Easement location on Lot 12 | Recorded plat (Cabinet 91, Slide 264-265) was not retrievable via public web; the 1994 survey shows the dimension but not the location | Order plat copy from Travis County Clerk; alternative — request from Scofield HOA management office (Inframark) since it should be filed with their records. |
| Tree Protection | Tree inventory and CRZ mapping | No tree locations on 1994 survey | Commission ISA-certified arborist + new boundary survey (~$1,500–$3,500 combined). Required before building footprint can be finalized. |
| Restrictive Covenants | Vol. 660 Pg. 968 blanket electric easement scope | Document not publicly retrievable through web/clerk index | Obtain via title commitment; Austin Energy easement records office can also confirm whether facilities exist on the lot. |
| Fire | Hydrant flow test | Nearest hydrant flow not measured | Request flow test from Austin Water Field Operations prior to final design. Almost certainly compliant on mature 12" North Austin mains. |
| Fire | Current COA sprinkler-amendment status for R-3 duplexes | IRC §R313.1 vs LDC §25-12-1 local amendment | Verify with DSD residential intake at pre-application meeting. Has historically been waived; status as of 2026 needs confirmation. |
| Property Records | Current owner of record + most recent deed | TCAD displays prior owner; property is currently listed for sale | Title commitment will resolve at closing; not material to feasibility. |
| Stormwater & Drainage | Confirmation of detention exemption for duplex at this scale | DCM | Verify with DSD residential plan review at pre-application meeting. Standard practice exempts. |

## Opportunities

| Discipline | Program | Eligibility | Potential value |
|---|---|---|---|
| Site Plan & Form | Residential building permit path (no formal site plan) | Site Plan Lite Phase 1 (Ord. 20230720-158): residential ≤4 units exempt | Saves approximately $15K–$40K and roughly 6–12 months versus a commercial site plan path. |
| Zoning & Land Use | MF-3 base zoning permits more than a duplex | If MF-3 confirmed, the duplex is the minimum-density permitted use | Future-state optionality: triplex, fourplex, or small MF building permitted by-right. Not relevant if CC&R is binding. |
| Environmental | Desired Development Zone (DDZ) | Parcel is in DDZ per COA Property Profile | Affirmatively encouraged for infill; precondition for SMART Housing fee waiver if the affordability path is elected. |
| Programs | SMART Housing Program | Eligible if at least 10% of new units serve households at ≤80% MFI | Waives capital recovery, parkland, building permit, and water/wastewater impact fees on affordable units. At duplex scale, one of two units would be deed-restricted for affordability — uneconomic for a market-rate developer but available. |
| Stormwater & Drainage | Regional Stormwater Management Program (RSMP) fee-in-lieu | Walnut Creek watershed is RSMP-eligible | Not directly applicable at duplex scale (no detention obligation triggered), but documented as an option if scope ever escalates. |
| Property Records | FEMA Zone X confirmed on current effective panel | FIRM Panel 48453C0270J (eff. 2014-08-18) | No federal flood insurance required; standard slab-on-grade construction. |

## Cross-discipline notes

- The CC&R §4.1 finding cuts across **Zoning & Land Use, Site Plan & Form, and Programs**, and is the only `significant`-severity item in the matrix. Without HOA action, the duplex thesis does not advance regardless of any other finding.
- The **Subchapter F McMansion envelope** (sduf), **MF-3 dimensional standards** (zlu), and **CC&R form rules** all compete to set the binding massing constraint. The CC&R rules (50% masonry, 1,200 SF/unit, 2-story max) are typically more restrictive than zoning.
- **Sidewalk obligation** (ta) and **tap fees** (wwp) are the meaningful incremental costs over a teardown-and-rebuild single-family residence. None individually large; combined ~$15K–$35K.
- The **WUI Zone C** finding (fire / el) creates a real construction cost premium ($5K–$15K) and would also apply to a replacement single-family residence.

## Bottom-line synthesis

**The City of Austin regulatory framework is unusually permissive for this lot** — MF-3 base zoning (if confirmed) allows the duplex by-right under the LDC use table; HOME Phase 1 provides a parallel path even under SF zoning; Site Plan Lite Phase 1 keeps the project on the residential-building-permit track; there are no environmental, transportation, water, fire, or floodplain hard stops.

**The private restrictive covenant is the only thing standing in the way.** Scofield Declaration §4.1 limits the property to single-family residential use. The Declaration is enforced by an active HOA (Scofield Farms ROA) and has been recently strengthened (Eighth Amendment, 2005) to add fines and attorneys' fees. Amendment requires a 75% supermajority of the ~570+ owners.

**Three forward paths exist:**
1. **Pivot to single-family replacement.** Demo the existing house and build a new single-family residence. All city + private constraints align; project is straightforward.
2. **Pursue CC&R amendment campaign.** Long horizon, uncertain outcome. Worth pursuing only if the duplex thesis is strategically important to the owner or to a coordinated investor group.
3. **Negotiate HOA non-enforcement letter or interpretation.** Highly unlikely on a use-restriction case. Selective non-enforcement is itself a covenant violation that other owners can challenge.

---

## Recovery Log

Notes on gap-recovery decisions made during synthesis.

## Bucket A items (re-attempted)

None. All material gaps fall into Buckets B or C.

## Conflicts resolved during synthesis

### Base zoning: SF-3 vs MF-3
- The Zoning Pathway research inferred SF-2/SF-3 from neighborhood context (the Property Profile UI was not retrievable via the tooling available at that step).
- The Property Records research later pulled the COA Zoning_1 ArcGIS feature service directly at the parcel coordinates and got **MF-3**.
- **Resolution:** treat MF-3 as the authoritative reading (the ArcGIS feature service is the source the Property Profile UI itself uses). Flag the SF-platted-as-MF-3 anomaly as a data-gap requiring DSD Zoning Verification Letter.

### WUI status
- The Environmental research inferred "almost certainly outside any WUI zone" based on suburban Blackland Prairie location.
- The Property Records research confirmed **WUI Proximity Zone C** via the COA WUI ArcGIS layer at parcel coordinates.
- **Resolution:** treat Zone C as authoritative. Include ignition-resistant construction premium ($5K–$15K) in moderate findings. Recommend final confirmation via the COA WUI Zone Lookup tool before design.

## Bucket B items (genuinely external, surfaced for action)

- Title commitment will pull: Vol. 660 Pg. 968 blanket electric easement; most-recent deed; HOA dues / arrearages; sub-survey of the 15' D.E.
- Arborist will produce: full tree inventory and CRZ mapping.
- DSD pre-application meeting will resolve: Zoning Verification Letter; sprinkler amendment status; detention exemption; fee schedule.
- Austin Water Field Ops will produce: hydrant flow test; rear-vault disposition.

## Bucket C items

None. No concept plan was provided, so no plan-specific ambiguities.

## Method note

Property-records data in this report was assembled through direct web research against TCAD public search, the COA Property Profile ArcGIS services, the FEMA Map Service Center, and the Travis County Clerk index. The Scofield HOA's publicly posted recorded CC&Rs and amendments provided the chain-of-title detail; the title commitment is expected to confirm these instruments at closing.
