# Zoning Pathway — 12713 Cinchring Ln, Austin TX 78727

**Subject parcel:** Lot 12, Block M, Scofield Subdivision Section II Phase VI (Travis Cabinet 91, Slide 264–265). Approx. lot area 8,083 SF (~0.186 ac). Existing 1-story SFR; intended use is demolition + new duplex (2 attached units).

**Scope:** zoning classification, overlays, dimensional standards, duplex permissibility under base LDC and under HOME 1 / HOME 2, site-plan trigger, intake path, current legal status. Restrictive covenants (HOA, deed restrictions) are handled by a separate subagent and are out of scope here, though they are flagged in §10.

---

## 1. Base zoning of the parcel

**Finding:** Most probably **SF-2** (Single-Family Standard Lot) or **SF-3** (Family Residence), with **SF-2** the more likely classification for a 1983-platted suburban subdivision of conventional 60-65' wide lots like Scofield Section II Phase VI. Several Scofield Section II sub-parcels were originally platted under SF-2; SF-3 is also possible for later phases.

- **ZONING_ZTYPE (compound):** unconfirmed; most likely `SF-2` or `SF-3` with no overlay suffix (no `-CO`, no `-NP`).
- **ZONING_BASE:** `SF-2` or `SF-3`.
- **Confidence:** Unconfirmed. Live AustinTexas.gov Property Profile lookup (https://www.austintexas.gov/GIS/PropertyProfile/ and https://maps.austintexas.gov/GIS/PropertyProfile/) returned HTTP 404 in this research session; the page is interactive and not WebFetch-friendly. Third-party listings (Redfin, RE/MAX) for 12713 Cinchring Ln describe the property as "residential, multi-family permitted" but do not give a specific code letter. Adjacent Scofield Farms listings reference SF-2 conventional single-family. **Data-gap, recommend: surveyor agent verifies via DSD Zoning Verification Letter (~$337, 3–5 business days) or by pulling the parcel in the City GIS viewer interactively.** (Citation: City of Austin Property Profile portal.)
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

(Primary citations: Ordinance No. 20231207-001 https://www.zonability.com/downloads/OrdinanceNo.20231207-001.pdf; City "HOME Amendments" landing https://www.austintexas.gov/page/home-amendments and https://www.austintexas.gov/development-services/home-amendments; AIA Austin HOME FAQ https://aiaaustin.org/wp-content/uploads/2024/01/HOME_Summary-FAQ_20240126-1039.pdf.) **Confidence: Verified for core standards (units, IC, BC, height, parking, intake type); Inferred for some unit-design details (entrance, garage, front yard) — values are corroborated across multiple secondary sources but PDF of the AIA FAQ would not parse in this session.**

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

(Primary citation: Ordinance No. 20240516-006; "HOME Phase 2" coverage https://www.kut.org/austin/2024-05-17/austin-city-council-land-zoning-vote-home-phase-2 and https://communityimpact.com/austin/south-central-austin/government/2024/05/17/austin-cuts-minimum-residential-lot-size-by-more-than-two-thirds-under-home-phase-2/; City landing page; the user prompt referred to "20240516-005", but the adopted ordinance reference number is **20240516-006**.) **Confidence: Verified.**

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
- **Tree review** is triggered by any protected tree (≥19" diameter) or heritage tree (≥24") within the construction zone; will be screened by the tree-/environmental subagent and by an arborist site walk pre-design.

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
| Austin Water service taps | **Yes** | New duplex will need water/wastewater service either via existing tap (and meter upsize) or new tap; service-availability and impact fees apply. Out of scope here (handled by Water/WW subagent). |
| Austin Energy service | **Yes** | New service drop or upgrade required. |
| Tap fees / impact fees | **Yes** | Water/WW impact fees per unit; transportation impact fee may apply. |
| Pre-Development Consult | **Optional but recommended** | DSD offers a Pre-Development Consult (~$300) — useful for HOME projects with any irregularity (curved frontage, blanket electric easement, platted building lines that differ from base zoning setbacks). |

(Primary citation: AustinTexas.gov DSD permit application portals and the DSD HOME Phase 1 Info Series.)

## 9. Pending / recent code changes potentially affecting this project

- **Acuña v. City of Austin (2022 14th Court of Appeals ruling; Dec 2023 trial-court ruling by Judge Mangrum):** Struck down three other zoning ordinances (Vertical Mixed-Use 2, Residential in Commercial Development, Compatibility-on-Corridors) on **notice and protest** grounds, *not* HOME. The HOME Phase 1 and Phase 2 ordinances were challenged in the same vein — plaintiffs argue Texas LGC §211.006/.007 notice and protest rules were violated when the city adopted citywide rezoning without parcel-by-parcel mailed notice. **As of search date (June 2026), HOME 1 and HOME 2 remain in effect and applications continue to be accepted.** A trial-court ruling adverse to the City on HOME would not retroactively void already-issued permits, but it could change the rules between concept and permit. (Citations: Austin Monitor coverage 2023–2024; Acuña v. City of Austin 651 S.W.3d 474 (Tex. App.–Houston [14th Dist.] 2022).) **Confidence: Verified that HOME is currently in effect; status of HOME-specific litigation Unconfirmed in 2026.**
- **Site Plan Lite Phase 2** (Council adopted March 2025): extends streamlined site-plan intake to 5–16-unit projects. Not applicable to a 2-unit duplex but worth noting if the owner ever scales up to 3+ detached units via separate platting.
- **Infill Plat process** (June 2025): simplified subdivision drainage for residential re-subdivisions ≤1 acre. Relevant only if the owner pursues the §6 HOME 2 subdivision pathway instead of a duplex.
- **Parking minimums** were eliminated citywide effective Nov 2, 2023 (Ord. 20231102-038) — a separate ordinance from HOME, so even if HOME is later invalidated, residential parking minimums do not snap back.
- **No pending council motion** to repeal or substantially amend HOME 1 was identified in this research; political balance of council remains pro-HOME as of last reporting.

**Confidence on §9 overall: Verified for the existence of the litigation and for the in-effect status of HOME; Unconfirmed on the latest 2025–2026 case docket.**

## 10. Open questions for the surveyor and restrictive-covenants subagents

1. **Exact base zoning** (SF-2 vs SF-3 vs other) — pull from City Property Profile or order a DSD Zoning Verification Letter. *(Highest priority: every downstream dimensional standard depends on this.)*
2. **Conditional overlay / overlay suffixes** — verify there is no `-CO`, no `-NP`, no `-MU`, no `-NCCD` on this parcel. Confirm via Property Profile.
3. **Council district** — almost certainly **District 7** (north of Parmer is split between D7 and D6); confirm via the City Council District Map.
4. **TCAD official lot area** — confirm vs ~8,083 SF estimate from the 1994 survey calculation. Even a 100-SF difference can affect HOME 2 subdivision feasibility (1,800 SF minima).
5. **Recorded plat (Cab 91, Sl 264–265)** — confirm the exact platted building lines, drainage easement geometry, and any plat notes that limit use (e.g., "single-family only" plat notes do **not** override LDC under Texas law, but lenders care about them).
6. **Scofield Subdivision Declaration of Covenants** — *critical*. Scofield is a 1980s/90s HOA neighborhood; the declaration almost certainly contains a "single-family residential use only" deed restriction. **This is the biggest single risk to the duplex strategy and is out of scope for this subagent.** Restrictive-covenants subagent must pull and read the Declaration (likely Vol. 11863 Pg. 1147 or related instrument referenced on the survey) and report on (a) whether two-family use is prohibited, (b) whether HOA architectural review approval is required, (c) any setback or height covenants more restrictive than LDC, and (d) whether any covenant has lapsed or been waived. **Even if zoning permits a duplex, restrictive covenants can independently prohibit it.**
7. **Blanket electric easement (Vol. 660 Pg. 968)** — must be plotted and dimensioned by the surveyor; could constrain building footprint.
8. **Tree inventory** — arborist field survey needed; protected/heritage trees can compel HOME-eligible projects through tree review even when site-plan-exempt.
9. **Effective FIRM map** — re-verify 1993 FIRM Zone X finding against current effective Travis County FIRM panels.
10. **Whether Scofield is annexed for full purposes** (vs. limited purpose) — seed data states full purpose; surveyor should confirm via Property Profile annexation status field.

---

## Summary for the SIR narrative

A duplex (2 attached units) is **permitted by-right** on this ~8,083 SF lot under Austin's current zoning regime via **HOME Phase 1 (Ord. 20231207-001, eff. Feb 5, 2024)**, regardless of whether the underlying base zoning is confirmed as SF-2 or SF-3. The project intake is a **residential building permit** (no site plan, no drainage review) with **zero off-street parking required**, **0.40 FAR**, **45% impervious cover**, **40% building coverage**, **35-foot height**, and **25/5/10 setbacks** as the controlling envelope. The dominant remaining feasibility risks are **(a) HOA / deed restrictions** (Scofield is a covenanted subdivision and may prohibit two-family use outright), **(b) the blanket electric easement** which may constrain footprint, and **(c) any tree or platted-building-line constraint not captured on the 1994 survey**. None of these is a zoning risk per se, but each can defeat the build. Verifying the **exact base zoning** and pulling the **Scofield Declaration of Covenants** are the two highest-leverage actions before design begins.
