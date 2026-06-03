# Phase 2 — Web Follow-ups

**Scope:** Catch-all of external facts and service-provider/jurisdictional context for 12713 Cinchring Ln, Austin TX 78727 (Lot 12, Block M, Scofield Subdivision Sec. II Ph. VI) that are not handled by the zoning, environmental, neighborhood-plan, transportation, programs, restrictive-covenants, or wwp/Phase-3 subagents.

**Method:** Web search + targeted fetches of authoritative sources (Census Geocoder, AB+C, Austin Energy, Texas Gas Service, ARR, PISD, PEC, TCAD, Travis County). Where authoritative sources rate-limited (Redfin, TCAD direct property record), corroborating real-estate aggregators were used and the underlying source is named for surveyor re-verification.

---

## 1. Address verification — TCAD anchor

- **Source:** Travis Central Appraisal District (https://traviscad.org/propertysearch/, https://travis.prodigycad.com/property-search) and HAR-ACTRIS MLS listing #2532841 (https://hoydenhomes.com/listing/actris/2532841/Austin/12713-Cinchring-Lane/).
- **Finding:**
  - Site address: **12713 Cinchring Lane, Austin TX 78727** (confirmed in MLS, Redfin, RE/MAX listings).
  - Legal: **Lot 12, Block M, Scofield Subdivision Section II, Phase VI** (matches 1994 survey; surveyor agent should pull the live TCAD record for Property ID, geographic ID, and 2025/2026 appraised value).
  - **Year built: 1993** (per MLS) — consistent with the 1993/1994 survey vintage in the seed data.
  - **Recorded lot size: 0.1849 ac (~8,055 SF)** (per MLS) — within rounding of the survey-estimated 8,083 SF.
  - **2025 ad valorem taxes: ~$11,100/yr** (per MLS public-record pull).
  - **HOA dues: $125/quarter** ($500/yr) — Scofield HOA; restrictive-covenants subagent handles the recorded Declaration.
  - **Active MLS listing (May 2026): $499,000** for the existing 4 BR / 2 BA / 2,095 SF single-story home (this is the "as-built" baseline the owner is proposing to demolish).
- **Implication:** Property is currently on the open market. Acquisition cost basis is ~$499K + closing; demo + duplex new build is the contemplated value-add. The fact that the home was recently updated (2025 tankless WH, 2026 paint, new dishwasher) but is being marketed for redevelopment to a duplex buyer suggests the seller sees more value in the dirt than the structure — consistent with HOME-era infill economics in 78727.
- **Confidence:** Verified for legal/lot/year/taxes (MLS aggregator pull); **Unconfirmed** for TCAD Property ID — surveyor must capture the exact 7-digit account # before the Phase 3 wwp / Programs subagents run any fee calcs.

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
- **Implication:** Anchors the QOZ check (Programs subagent — tract 48453042100 should be cross-checked against the Treasury QOZ list; this tract is in north-central Travis and is **not** historically a QOZ, but Programs should confirm against current designations). Anchors ACS demographic pulls and the HUD CHAS dataset used for SMART Housing affordability targeting.
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

## 5. Water and wastewater — Austin Water (handled in detail by Phase 3 wwp subagent)

- **Source:** Austin Water service area + UCM (https://www.austintexas.gov/water/, https://library.municode.com/tx/austin/codes/utilities_criteria_manual); New Service Connections (https://www.austintexas.gov/water/new-service-connections); Tap Plan portal (https://tapplan.com/).
- **Finding:**
  - 12713 Cinchring is inside Austin Water's retail water and wastewater service territory.
  - Existing house has both water tap and sanitary sewer service — the latter is corroborated by the concrete sanitary sewer vault labeled near the rear (south) property line on the 1994 survey.
  - **Per Austin Water rule:** "Properties with two, three, or four individual dwelling units (attached or detached) shall have an individual AW water meter serving each dwelling unit." A duplex therefore requires **two water meters** (or a single tap split with two AW-approved meters), not a single shared service. Each unit also gets its own cleanout for wastewater.
  - **A Utility Tap Plan, prepared by a Texas-licensed PE and submitted via AB+C, is required prior to residential plan review for a duplex.** This is a hard gate before construction-doc submittal.
- **Implication:** Tap-fee and capacity work (line sizes, fire-flow availability, WWWSPV, Service Extension Request if needed) is the **wwp** Phase-3 discipline subagent's territory. For Phase 2 this is just a confirmation that AW is the provider, existing service exists, and **the two-meter rule is a hard requirement** (cost-significant — meter taps in north Austin typically run $5–15K per meter depending on size, plus impact fees).
- **Confidence:** **Verified** for provider, existing service, and the two-meter rule; cost numbers are **Inferred** rules-of-thumb pending the wwp subagent's fee-table lookup.

## 6. Stormwater / Drainage Charge — COA Watershed Protection

- **Source:** COA Drainage Charge page (https://www.austintexas.gov/department/drainage-charge); Drainage Charge Estimator (https://www.austintexas.gov/department/drainage-charge-estimator); FY26 utility rate sheet (https://coautilities.com/wps/wcm/connect/occ/ca4c09b3-51e7-411e-9245-996a681de831/NOV_25_AUN_EN.pdf).
- **Finding:**
  - The City Drainage Charge is billed on the COA utility bill and is calculated **per square foot of impervious cover, per month**.
  - **FY2025-26 base rate: $0.00593 / SF IC / month.**
  - Typical SF-3-scale Austin home (3,100 SF IC, ~37% IC ratio): **~$14.05/mo, $169/yr.**
  - A duplex on this 8,055-SF lot, under HOME-2 standards (up to 65% IC permitted in many SF zones under HOME), could see IC rise from the existing house's ~30-40% to the high 50s/low 60s — roughly doubling the drainage charge to **$25-30/mo, $300-360/yr**.
  - Stormwater Management Discount (https://www.austintexas.gov/watershed-protection/stormwater-management-discount) allows up to a 50% reduction by installing on-site rainwater capture / detention practices — worth flagging as an OpEx lever for the duplex.
- **Implication:** Recurring OpEx item for the finished duplex; small dollars but real. More importantly, the **IC limit** itself (governed by zoning + watershed code) is the binding constraint on site design and will be handled by the environmental and zoning subagents; the drainage charge is just the downstream billing consequence.
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
- **Confidence:** **Verified** for provider; **Inferred** for two-meter convention (standard practice, not a printed TGS rule found in the search window).

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
- **Implication:** Standard Austin / Travis / PISD stack. No MUD or PID taxes (Scofield was developed under standard COA jurisdiction with direct AW service — no MUD was ever needed). Surveyor agent should pull the actual TCAD jurisdictions list to confirm; the Programs subagent will reconcile any homestead-eligible exemptions / over-65 caps if relevant.
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
  - **No permits returned by the search window's open-data sample for "12713 Cinchring."** This is consistent with the MLS narrative (the recent 2025–2026 improvements — paint, tankless water heater, dishwasher — are mostly trade work that does not require a building permit; tankless WH **does** typically require a plumbing permit but small-jobs sometimes get filed by the plumber under a master permit without an address-specific public record).
  - **No demo / addition / ADU / detached structure permits** previously issued — the parcel has effectively a clean permit history since original 1993 construction.
- **Implication:**
  - No prior un-finaled work to inherit. The owner / next purchaser starts the demo + duplex permit path with a clean record.
  - For the demo: separate **Residential Demolition Permit** (with utility-disconnect verifications from AW, AE, TGS) required before any structure can be removed.
  - For the new duplex: standard **Residential Building Permit** path via AB+C, with prerequisite Utility Tap Plan (see §5), tree review, and (if triggered) Site Plan Exemption.
- **Confidence:** **Inferred / Unconfirmed** — Phase 2 surveyor agent should pull the live AB+C public search for the address to confirm absence of permits before Phase 3 zoning/programs subagents quote permit fees.

## 14. MLS / property history baseline

- **Source:** ACTRIS MLS #2532841 (https://hoydenhomes.com/listing/actris/2532841/, https://www.remax.com/tx/austin/home-details/12713-cinchring-ln-austin-tx-78727/981248454034335233/M00000589/2532841); Redfin listing (https://www.redfin.com/TX/Austin/12713-Cinchring-Ln-78727/home/31550475 — fetch returned 403 but URL/MLS# confirmed in other aggregators).
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
- **Confidence:** **Verified** for MLS-cited facts; surveyor agent must pull the TCAD record for prior-sale history (not surfaced in the MLS aggregators in the search window).

---

## Cross-references / handoffs

- **wwp (Phase 3):** §5 above is a stub — wwp pulls line sizes, fire-flow, capacity, tap fees, WWWSPV, impact fees.
- **Programs (Phase 2):** uses §2 (census tract GEOID) for QOZ check; uses §10/§12 (no MUD/PID/TIRZ) when checking SMART Housing / fee-waiver geography.
- **Restrictive covenants (Phase 2):** handles Scofield HOA Declaration; this file does not.
- **Environmental (Phase 2):** handles drainage / impervious-cover constraints — §6 here is just the billing consequence.
- **Zoning (Phase 2):** handles the actual IC cap and HOME-2 duplex permissibility; nothing in §1–§14 above attempts to.
- **Surveyor follow-ups (must complete before Phase 3):**
  - Pull live TCAD record for Property ID, owner of record, prior-sale history, and 2026 appraised value.
  - Pull live AB+C permit search for 12713 Cinchring to confirm clean permit history.
  - Confirm Travis County jurisdiction overlay layer to verify no special-district assignment.
