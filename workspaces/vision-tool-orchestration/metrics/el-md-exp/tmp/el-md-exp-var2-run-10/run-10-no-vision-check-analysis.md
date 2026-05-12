# RUN_9 — Items where expected `measure-distance` but classifier did NOT pick `measurement`

**Run:** `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_9_LOCAL` · `el-md-exp` · var-2 · 3 runs · haiku · local conductor.

**Scope:** of the 51 items where `expected_specialist = measure-distance`, this analysis covers the **46** where `majority_vision_check ≠ measurement` (43 `none` + 2 `generic` + 1 `3-way-tie`). For each, we read each run's `agentTrace.observation` + `agentTrace.reasoning` and classify the skip as valid (the agent's reasoning shows vision/measure-distance wouldn't have helped) or invalid (the agent gave up exactly where measure-distance would have fired).

**Classification (heuristic, applied per item across the 3 runs):**

| verdict | meaning |
|---|---|
| `valid_not_applicable` | ≥2 runs marked `n/a` or reasoning explicitly says "requirement does not apply" / "not a triggering condition". The checklist item didn't apply to this site. |
| `valid_no_feature` | ≥2 runs observed that the relevant feature (transformer pads, retaining walls, fences, etc.) is not present on the plan. Nothing to measure. |
| `valid_other` | ≥2 runs reached a real verdict (pass/fail) without needing measurement (e.g. confident worst-case reasoning). |
| `valid_other_data_gap` | ≥2 runs cite a non-spatial data gap (plant schedule lacks species names, ECM Appendix F UC designation absent, etc.). measure-distance wouldn't have helped — these need textual data, not pixels. |
| `invalid_missing_dimensions` | ≥2 runs `not-verifiable` with reasoning citing "no dimension annotations" / "dimensions not provided" or similar. This is the canonical case for `measure-distance` to fire — the agent gave up exactly where the specialist would have computed the distance. |
| `invalid_probable` | All 3 runs `not-verifiable` and the agent didn't cite a non-spatial data gap. The agent ran out of options without trying to measure — probable invalid skip but worth manual review since reasoning didn't trip the explicit "no dimensions" regex. |
| `mixed` | Runs disagreed materially; no dominant signal. Inconclusive. |

## Headline

Total items analyzed: **43**

| verdict | count | share |
|---|---:|---:|
| `invalid_missing_dimensions` | 7 | 16.3% |
| `invalid_probable` | 5 | 11.6% |
| `valid_not_applicable` | 15 | 34.9% |
| `valid_no_feature` | 0 | 0.0% |
| `valid_other` | 2 | 4.7% |
| `valid_other_data_gap` | 4 | 9.3% |
| `mixed` | 10 | 23.3% |

**Reading:**

- **7 confirmed *invalid skips*** — the agent saw the feature on the plan and explicitly said dimensions weren't annotated. Exactly what `measure-distance` is built for. Latent Goal B headroom: if the classifier had fired `measurement`, the specialist would have computed the distance instead of the agent declaring `not-verifiable`.
- **5 probable invalid skips** — all 3 runs `not-verifiable`, no non-spatial data gap cited, but reasoning didn't trip the strict "no dimensions" regex. Worth manual confirmation.
- **21 valid skips** — `measure-distance` wouldn't have helped: feature not on plan (0), requirement doesn't apply (15), real verdict reached without measurement (2), or non-spatial data gap (4).
- **10 mixed.** Runs disagreed; needs manual review.

If we restrict Goal B's denominator to the 30 items where vision/measurement *could* have helped (i.e. drop the 21 valid-skip items from the 51), RUN_9's adjusted Goal B becomes **5 / 30 = 16.7%**. The remaining 22 items in this denominator are where the agent skipped vision but probably shouldn't have, and represent the real Goal B headroom.

## Per-item detail

Each entry: item_id (verdict), expected item text, then per-run status + observation snippet + reasoning snippet.

### EL-1.10 — `invalid_missing_dimensions`

> Fence posts do not maintain minimum 10-foot horizontal clearance from overhead electric poles

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 31 shows fence symbols and the OHE line location, but no electrical pole locations or fence post locations with specific dimensions are called out on the landscape plan.
- *reasoning:* Without dimension annotations showing the distance from pole centers/edges to fence post locations, the 10-foot clearance requirement cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Existing Conditions Survey (Sheet 4) shows utility poles marked as symbols. Landscape Plan shows fence alignments. No dimension annotations showing pole-to-fence-post distances.
- *reasoning:* Clearance verification requires specific dimension annotations from fence post centers to pole centers. Without such annotations, the 10-foot minimum separation cannot be confirmed.

**run-3** — status=`n/a`
- *observation:* Review of site plan shows boundary fences at property lines. No fence post locations are specifically marked or dimensioned relative to electric pole locations.
- *reasoning:* Fence posts are not shown in conflict with electric poles. This item is not applicable to the proposed work.

---

### EL-1.2 — `invalid_missing_dimensions`

> Customer facilities do not maintain minimum 15-foot radial clearance from outside conductor of overhead distribution primary and neutral conductors

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Overhead electric line (OHE) is shown on Sheet 31 passing through the site, but no plan sheets contain radial clearance dimension annotations from the conductor to customer facilities. The conductor type (primary vs. secondary) is not specified on the plans.
- *reasoning:* UCM § 1.10.3 requires verification of 15-foot radial clearance from primary and neutral conductors. Without explicit dimension callouts and without confirmation of the conductor type, compliance cannot be verified from the submitted plans.

**run-2** — status=`not-verifiable`
- *observation:* OHE line shown on Landscape Plan. Plans do not identify conductor types or provide clearance dimensions from conductors to customer facilities.
- *reasoning:* The 15-foot radial clearance requirement applies specifically to distribution primary and neutral conductors measured from the outside conductor. Without conductor type identification and explicit clearance dimensions, compliance cannot be verified.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 9 site plan shows OHE lines and building locations. Sheet 21 shows electrical infrastructure with transformers and meters. No dimension annotations showing 15-foot radial clearances from outside conductor to any customer facilities.
- *reasoning:* Radial clearance requirement (15-foot in all directions from conductor) requires explicit documentation on utility plan showing conductor location, facility location, and measured distance. Absence of this documentation prevents verification of compliance.

---

### EL-1.22 — `invalid_missing_dimensions`

> Existing electric poles in conflict with proposed driveways not relocated minimum 30 feet from edge of driveway

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 31 shows driveway routing and utility pole symbols (marked differently from the OHE line), but no specific dimension callouts confirm whether existing poles are within 30 feet of any proposed driveway edges or whether relocation is required.
- *reasoning:* Without explicit dimension annotations confirming either pole-to-driveway distances or relocation notes indicating poles moved 30+ feet from driveway edges, compliance cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Survey shows pole symbols. Site plan shows driveway alignments. No dimension annotations showing pole offset from driveways, and no relocation notes provided.
- *reasoning:* Verification requires either dimension annotations showing >30-foot clearance or relocation notes. Without these, conflict status cannot be determined.

**run-3** — status=`n/a`
- *observation:* Site plan shows driveway layout within site boundaries. Existing utility pole locations (if any) shown on existing conditions survey (Sheet 4) are not in direct conflict with proposed driveway alignments.
- *reasoning:* No pole relocation requirement triggered. Item not applicable.

---

### EL-1.25 — `invalid_missing_dimensions`

> Sidewalks not cleared from existing power poles at each end of property along right-of-way

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 9 shows the site plan with Valley View Road frontage (western boundary) and sidewalk routing indicated. However, no specific callouts confirm whether existing poles at the property corners are addressed through relocation, clearance, or other means.
- *reasoning:* Without dimension annotations or notes clarifying the treatment of power poles at property corners where sidewalks meet the ROW, compliance cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Survey shows existing poles. Landscape plan shows sidewalk routing along property boundary. No dimension annotations showing sidewalk edge-to-pole clearances at property limits.
- *reasoning:* Verification requires specific dimensions showing sidewalk cleared from poles at each property end.

**run-3** — status=`not-verifiable`
- *observation:* Site plan and landscape plan show sidewalks at property boundaries including along Valley View Road frontage. Existing conditions survey (Sheet 4) notes utility lines and poles but specific locations of adjacent ROW poles relative to sidewalk termination points are not dimensioned.
- *reasoning:* Pole location data for adjacent ROW is not provided in sufficient detail to verify whether sidewalks conflict with existing pole positions. Verification would require clearer existing utility infrastructure mapping.

---

### EL-1.28 — `invalid_missing_dimensions`

> Water meters do not maintain minimum 7.5-foot horizontal sky-to-ground clearance from outside conductor of existing overhead electric service drops

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheets 19 (Utility Tap Plan), 20 (Utility Tap Public Plan and Profile), and 21 (Preliminary Electrical Design) show utility infrastructure including water service connections. However, specific water meter locations relative to overhead service-drop conductor routing and clearance dimensions are not shown with annotations.
- *reasoning:* Without explicit dimension callouts showing the distance from overhead service-drop conductors to water meter locations, compliance with the 7.5-foot clearance requirement cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Utility Tap Plan (Sheet 20) shows water main connections. Electric Meter/Service Plan (Sheet 21) shows underground electric infrastructure. Water meter specific locations relative to overhead service drops not clearly documented.
- *reasoning:* Verification requires specific meter location coordinates and clearance dimensions from overhead conductors. These are not annotated on the plans.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 21 shows electrical infrastructure (transformers, pull boxes, meters) but water meter locations are not explicitly identified. Service drop conductor routing relative to meter locations cannot be determined from available plans.
- *reasoning:* Water meter clearance verification requires showing meter location and overhead service drop location with distance dimensions. These are not provided.

---

### EL-1.29 — `invalid_missing_dimensions`

> Water lines do not maintain minimum clearance from existing overhead electrical distribution facilities

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheets 19-20 show water utility connections, and Sheet 31 shows the overall site with OHE line routing. However, specific dimension callouts showing horizontal clearances from the water line trenching to overhead distribution poles and conductors are not provided.
- *reasoning:* Without dimension annotations confirming safe clearance distances between water line routing and overhead distribution infrastructure, compliance cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Utility plan sheets show water line routing but no dimension annotations showing clearances from overhead facilities. OHE shown on separate landscape plan.
- *reasoning:* Clearance verification requires specific dimension annotations showing utility-to-conductor relationships. These are absent.

**run-3** — status=`not-verifiable`
- *observation:* Sheets 19-20 show water service connections; Sheet 31 landscape plan shows OHE markings. However, no cross-reference with dimension annotations shows clearance between these utilities.
- *reasoning:* Clearance verification between water lines and overhead electric requires dimensional documentation. This is not provided on plans.

---

### EL-2.6 — `invalid_missing_dimensions`

> Trees proposed within 10 lateral feet of overhead electric utility pole

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`generic`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`fail`
- *observation:* Vision analysis of Sheet 31 measured trees at 5-8 feet from OHE line running along site boundary. The OHE line marking indicates utility poles exist along this line.
- *reasoning:* Overhead distribution lines require poles at regular intervals (typically 100-150 feet). The measured distance of 5-8 feet from the OHE line centerline places trees within 10 feet of where utility poles must exist to support the line.

**run-2** — status=`not-verifiable`
- *observation:* Site Plan (Sheet 9) shows utility poles at various points along the overhead electric route, particularly near the driveway entrance on the western side and along the southern perimeter. Landscape Plan (Sheet 31) shows tree symbols with circular canopy outlines. Both poles and trees exist on the same site, but pole locations are documented on Sheet 9 and …
- *reasoning:* While both overhead electric poles and trees are present on the site, their relative proximity cannot be verified from the submitted plans. The poles are detailed on the site plan (Sheet 9) and trees on the landscape plan (Sheet 31), but no explicit clearance dimensions are provided to confirm the 10-foot minimum distance. Scaling and measuring from diffe…

**run-3** — status=`not-verifiable`
- *observation:* Sheet 21 (Electrical Design) depicts underground transformers, pull boxes, and lines but shows no overhead poles. Sheet 31 (Landscape Plan) shows OHE line but does not clearly mark pole locations in relation to proposed trees.
- *reasoning:* Compliance with the 10-foot pole clearance requirement cannot be verified from available plans. Either the applicant must show pole locations clearly on the landscape plan with clearance dimensions, or the absence of pole markings indicates poles are not part of this electrical design (possible if service is entirely underground at this site).

---

### EL-1.1 — `invalid_probable`

> Buildings and permanent structures do not maintain minimum 7 feet 6 inches horizontal sky-to-ground clearance from overhead electric conductors

- **majority vision_check:** `generic`  ·  **per-run intent:** run-1=`generic`, run-2=`generic`, run-3=`measurement`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 9 (Site Plan) and Sheet 31 (Landscape Plan) show proposed buildings and overhead electric line routing, but no building elevation sheets were found with conductor elevation data or clearance dimensions labeled from the outside conductor to building faces.
- *reasoning:* While overhead electric facilities are confirmed to exist on the site (OHE line shown on Landscape Plan), the requirement for surveyed conductor elevations and clearance dimension annotations to buildings is a specific documentation requirement under UCM § 1.10.3. Without explicit clearance dimension callouts or registered surveyor data on building elevat…

**run-2** — status=`not-verifiable`
- *observation:* Landscape Plan shows OHE line along southern site boundary. Vision check confirmed OHE routing but no clearance dimensions were shown between OHE and building footprints.
- *reasoning:* Without surveyed conductor elevations and explicit clearance dimensions shown on plans, the 7.5-foot horizontal sky-to-ground clearance from overhead conductors to buildings cannot be verified. The code requires maintenance of this clearance but the plans provide no documentary evidence of compliance.

**run-3** — status=`not-verifiable`
- *observation:* Vision analysis of Sheet 9 shows OHE markings with multiple distance measurements from conductor to building exteriors (27.9 to 91.3 feet), but no dimensional callouts on the actual plan drawing annotating or confirming clearances.
- *reasoning:* While measured distances suggest adequate clearance, site plan best practice requires explicit dimension annotations from outside conductor to building faces. Absence of these annotations prevents verification that the measurement methodology (from conductor, not pole) is correct or that the engineer intended compliance to be demonstrated through these di…

---

### EL-1.26 — `invalid_probable`

> Enclosed trash areas and trash receptacles placed under overhead electric facilities creating risk of contact when trash bins are raised during service

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 9 shows trash collection notes indicating trash containers are not permitted at curbside unattended, but specific trash enclosure or dumpster locations are not distinctly marked on the site plan, and no vertical clearance dimensions relative to overhead lines are shown.
- *reasoning:* Without specific location identification and vertical clearance dimension callouts accounting for raised bin heights, the clearance requirement cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Site plan shows trash collection areas labeled. OHE line location on landscape plan. No section view showing relationship between trash bin locations and OHE line height.
- *reasoning:* Verification requires specific location coordinates and height analysis of raised bins during service. These details are not provided.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 9 includes trash collection requirements but specific trash enclosure location is not clearly identified on the plan drawing. No section view shows trash area vertical clearance from overhead lines.
- *reasoning:* Trash enclosure location and overhead line proximity relationship is unclear from plans. Clearance verification would require precise location and vertical section view.

---

### EL-1.30 — `invalid_probable`

> Permanent foundations within 5 feet of property line do not allow necessary clearance space for electric facilities

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 9 shows building locations with setbacks from Valley View Road (western boundary), but no specific dimension callouts confirm setbacks of foundations from the property line, nor do plans show anticipated electric facility locations in the adjacent ROW.
- *reasoning:* Without dimension annotations from building foundations to property lines showing sufficient space for utility clearances, and without documentation of expected facility locations in adjacent properties, compliance cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Site plan shows building locations and property boundaries. No specific dimension annotations or note addressing foundation-to-property-line clearances for utility access.
- *reasoning:* Verification requires specific documentation showing 5-foot minimum clearance from property line for electric facility work areas.

**run-3** — status=`not-verifiable`
- *observation:* Site plan shows building setbacks from property lines. Exact distances from foundations to property line are not all explicitly dimensioned. Existing and proposed electric facility locations on adjacent properties in ROW are not detailed.
- *reasoning:* Verification requires coordination with Austin Energy to confirm space available for electric facilities on adjacent ROW. This coordination is not documented.

---

### EL-1.39 — `invalid_probable`

> Proposed development does not maintain required clearances from existing streetlights

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 9 (Site Plan) shows building locations and notes lighting requirements, but specific streetlight pole locations and dimension callouts showing clearances from buildings to streetlights are not explicitly marked.
- *reasoning:* Without dimension annotations confirming distances from buildings to existing streetlight poles, the adequacy of clearances cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Survey shows existing street-side poles. Site plan shows building positions relative to property boundaries and ROW. No specific clearance annotations.
- *reasoning:* Verification requires dimension annotations showing building clearances from existing streetlight poles.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 4 existing survey shows utility lines and pole symbols, but adjacent ROW streetlight locations are not precisely dimensioned relative to site boundary.
- *reasoning:* Verification of building clearances from existing adjacent streetlights would require more detailed existing utility mapping. This coordination data is not provided.

---

### EL-1.45 — `invalid_probable`

> Construction staging areas, equipment operation zones, and work platforms do not maintain minimum 10-foot radial clearance from energized overhead electric lines per OSHA and Texas law

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 5 (Erosion and Sedimentation Control Plan) and the Sequence of Construction (Sheet 3 Block 10) address temporary facilities and construction staging, but no specific dimension annotations show 10-foot radial clearance zones around the overhead electric line.
- *reasoning:* Without dimension callouts or clearance zone markings on the construction logistics plan showing the required 10-foot construction clearance from energized overhead lines, compliance cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* No construction logistics or phasing plan provided. Site plan does not show designated staging areas, crane swing zones, or material storage areas with reference to OHE line location.
- *reasoning:* Verification requires construction logistics plan with clearance annotations. This document is not in the submitted set.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 5 ESC plan shows temporary staging and erosion control but does not include dimension annotations showing 10-foot clearances from overhead lines to equipment zones or crane operating areas.
- *reasoning:* Construction clearance verification requires dimensional callouts on construction phasing/logistics plan. These are not provided.

---

### EL-1.14 — `mixed`

> Retaining walls do not maintain minimum 7.5-foot horizontal sky-to-ground clearance from outermost electric line where overhead facilities are present

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`measurement`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheets 38 and 39 (Wall Plan and Wall Plan Details) show retaining wall locations and cross-sections, and Sheet 31 shows the overall site with retaining walls and the OHE line routing. However, no clearance dimension callouts from the outside conductor to the retaining wall faces appear on any of these sheets.
- *reasoning:* Without explicit horizontal clearance dimension annotations from the outside conductor location to retaining wall surfaces, compliance with the 7.5-foot clearance requirement cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Sheet 38 provides retaining wall structural details and plan view. No cross-section view shows vertical clearance relationship between wall top and OHE line conductors.
- *reasoning:* Clearance verification requires either plan dimensions showing horizontal distance or section/profile views showing vertical relationships. These are not provided for the retaining walls relative to the OHE line.

**run-3** — status=`fail`
- *observation:* Vision check measurement of Sheet 9 site plan shows retaining wall running parallel to OHE line on south boundary with only 0.2-foot separation. Wall is essentially touching the conductor envelope.
- *reasoning:* The 0.2-foot clearance represents a critical safety violation. The 7.5-foot clearance requirement is not met. Retaining wall position must be relocated away from overhead line or line must be relocated.

---

### EL-1.24 — `mixed`

> Streetlight poles located under overhead electric lines

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 9 (site plan) references lighting per Subchapter E 2.5, and Sheet 31 shows the site layout with the OHE line. However, specific streetlight fixture locations are not distinctly marked on the landscape plan with dimensions to the overhead line.
- *reasoning:* Without explicit identification and dimension callouts showing streetlight positions relative to overhead lines, compliance cannot be verified.

**run-2** — status=`n/a`
- *observation:* Site plan and photometric/lighting plan reviewed. No new streetlight poles shown beneath OHE line routing.
- *reasoning:* Requirement applies only when new streetlights under overhead lines are proposed.

**run-3** — status=`pass`
- *observation:* Site plan Block 1 notes that all exterior lighting must be full cut-off and fully shielded per Subchapter E 2.5, with site lighting to be located on buildings. No pole-mounted streetlights are shown beneath overhead lines.
- *reasoning:* Site design avoids pole-mounted streetlights under overhead lines through building-mounted lighting approach. Requirement satisfied.

---

### EL-1.36 — `mixed`

> Decorative lighting proposed under existing overhead electric lines does not meet clearance requirements or is not relocated

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 9 requires that all exterior lighting be full cut-off and fully shielded per Subchapter E 2.5, and site lighting will be on buildings per plan notes. However, specific decorative lighting fixture locations relative to the OHE line and clearance dimensions are not explicitly documented on the photometric plan or landscape plan.
- *reasoning:* Without dimension callouts confirming clearances or notes documenting relocation of decorative lights from beneath overhead lines, compliance cannot be verified.

**run-2** — status=`n/a`
- *observation:* Landscape plan does not show decorative lighting features positioned beneath OHE line.
- *reasoning:* Requirement applies only when decorative lighting under overhead lines is proposed.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 9 Block 1 requires full cut-off building-mounted lighting. Sheet 31 landscape plan shows general site features but does not clearly identify decorative lighting locations with clearance dimensions from overhead lines.
- *reasoning:* If decorative lighting fixtures are proposed, their locations relative to overhead lines and clearance compliance would require dimension verification. This is not provided.

---

### EL-1.6 — `mixed`

> Buildings do not maintain minimum 7.5-foot horizontal sky-to-ground clearance and 15-foot radial clearance from overhead electric facilities in right-of-way adjacent to site

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 9 shows buildings with setbacks from Valley View Road (western property boundary), and Sheet 3 notes indicate electric facilities in or near the right-of-way. However, no explicit clearance dimension annotations or setback dimensions from buildings to overhead lines in the ROW are shown on the plans.
- *reasoning:* Permanent clearance requirements from buildings to overhead electric facilities in adjacent ROW must be verified with explicit dimension callouts. Without dimension annotations or setback notes, compliance cannot be confirmed.

**run-2** — status=`not-verifiable`
- *observation:* Site plan shows Valley View Road to the west of property. Landscape plan shows OHE line on site but not clearly related to ROW. No separate utility/ROW coordination plan provided.
- *reasoning:* Verification requires utility plan showing overhead electric facility locations in the adjacent ROW and clearance dimensions from buildings. These specific exhibits are not in the provided plans.

**run-3** — status=`pass`
- *observation:* Vision analysis shows OHE line along west property boundary (ROW) with buildings positioned 86+ feet away from this line. South boundary also shows OHE with building-to-line distances of 27+ feet.
- *reasoning:* Measured distances confirm adequate clearance from buildings to overhead lines in ROW regardless of the specific clearance standard (7.5-foot or 15-foot). Requirement is satisfied.

---

### EL-1.9 — `mixed`

> Fences do not maintain minimum 7.5-foot horizontal sky-to-ground clearance from outside conductor of overhead electric facilities

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 31 landscape plan shows fence symbols (marked with 'X') along perimeter boundaries, and the OHE line is shown on the same sheet. However, no horizontal dimension callouts show the distance from the outside conductor to any fence.
- *reasoning:* Without explicit horizontal clearance dimension annotations from the conductor to the fence line, compliance with the 7.5-foot sky-to-ground clearance requirement cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Landscape Plan shows fence symbols at property boundaries. OHE line shown along southern boundary. Vision check did not provide clear measurement of fence position relative to OHE line.
- *reasoning:* Without explicit clearance dimensions annotated on the fence details or site plan, compliance with the 7.5-foot clearance requirement cannot be verified.

**run-3** — status=`pass`
- *observation:* Site plan (Sheet 9) shows fences at property boundaries. Vision analysis indicates fences positioned at property lines with OHE lines shown 27+ feet away on south boundary and 86+ feet away on west boundary.
- *reasoning:* Measured distances from fences to overhead conductors exceed 7.5-foot minimum requirement, satisfying clearance standard.

---

### EL-13.14 — `mixed`

> Shrubs or low-lying vegetation lack minimum 10 lateral feet clearance from transformer access door side, or lack minimum 5 lateral feet clearance from other sides (non-access door)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`measurement`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 31 shows generic vegetation symbols and categories, and Sheet 21 transformer pads lack orientation markings. Direct spatial relationship between specific shrubs and specific pad sides cannot be established.
- *reasoning:* The clearance requirement is directional (10 feet access side, 5 feet other sides), and without access door orientation, the directional requirement cannot be evaluated.

**run-2** — status=`fail`
- *observation:* Vision measurement of landscape plan shows shaded groundcover and shrub planting area directly surrounding the southwest transformer pad at 0.3 feet distance.
- *reasoning:* The measured 0.3 feet clearance is far less than the 5-foot minimum (and 10-foot for access sides), representing clear non-compliance.

**run-3** — status=`n/a`
- *observation:* Review of landscape plan (Sheet 31) found minimal plantings adjacent to transformer pad locations, with primary landscaping concentrated in parking lot islands and common open space areas away from the pads.
- *reasoning:* The requirement applies only when shrubs or vegetation are proposed adjacent to transformers. The absence of such plantings in proximity to pads makes this requirement inapplicable.

---

### EL-13.15 — `mixed`

> Trees within 20 lateral feet of underground electric equipment lack required root barriers (minimum 4 feet deep, installed 5 feet from equipment)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Review of Sheet 31 (Landscape Plan) found tree symbols and categories but no detail references (e.g., 'See Sheet 37 Detail RB-1') or notes specifying root barrier installation for trees within 20 feet of underground electric equipment.
- *reasoning:* The plan does not show or reference root barrier details. Without explicit specifications or callouts, compliance with the 4-foot depth and 5-foot setback requirement cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Landscape plan shows trees and shrubs near transformer locations but contains no explicit root barrier details or specifications.
- *reasoning:* Root barrier requirements cannot be verified from available landscape detail sheets. Detail drawings with root barrier specifications are required.

**run-3** — status=`n/a`
- *observation:* Review of landscape plan (Sheet 31) and vision checks of tree locations relative to transformer pads found no trees within the 20-foot critical distance that would trigger root barrier requirements.
- *reasoning:* The root barrier requirement applies only to trees within 20 lateral feet of underground electric equipment. The absence of trees in this proximity makes this requirement inapplicable.

---

### EL-2.7 — `mixed`

> Trees proposed within 10 lateral feet of pad-mounted electric equipment, or between equipment access door and drivable surface

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`generic`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`fail`
- *observation:* Vision analysis of Sheet 21 identified multiple labeled 'Electrical Transformer Pad' and 'Electrical Pull Box' locations with tree canopy symbols (circles) drawn directly overlapping or very close to these equipment locations. Measured distances show 6.9 feet (well within 10 feet) and visual overlaps.
- *reasoning:* UCM § 1.10.10.4 prohibits trees within 10 feet of pad-mounted equipment. Multiple equipment locations have trees within or overlapping the 10-foot restriction zone.

**run-2** — status=`n/a`
- *observation:* Preliminary Electrical Design Plan (Sheet 21) shows underground transformers, pull boxes, and electrical meters. No pad-mounted electric equipment is depicted on the site plan.
- *reasoning:* This item applies only when pad-mounted electric equipment is present or proposed. The electrical equipment shown on Sheet 21 is underground (transformers, pull boxes, meters). No pad-mount transformers or pad-mounted equipment are indicated. This item does not apply.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 21 shows electrical transformers and pads marked on the electrical design. Sheet 31 shows proposed trees and landscaping. However, the two plans do not provide synchronized callouts showing pad-mount locations relative to proposed trees, and no clearance dimensions from trees to equipment are provided.
- *reasoning:* To verify the 10-foot clearance requirement, the applicant must either: (1) show pad-mount locations clearly on the landscape plan with distance callouts, or (2) provide a cross-reference analysis. Current plans lack sufficient coordination to confirm compliance.

---

### EL-2.8 — `mixed`

> Trees proposed within 5 lateral feet of underground electric equipment

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`measurement`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`fail`
- *observation:* Vision measurement specialist calculated distance between underground electric line west of Bldg 1 and adjacent tree at 5.3 feet using the drawing scale (1" = 20').
- *reasoning:* UCM § 1.10.10.4 requires 5 lateral feet minimum from underground electric equipment. The measured 5.3 feet is technically compliant but with only 0.3 feet margin, representing marginal/borderline compliance rather than clear separation.

**run-2** — status=`not-verifiable`
- *observation:* Preliminary Electrical Design Plan (Sheet 21) shows underground transformers, pull boxes, and other underground electrical equipment on the site. Landscape Plan (Sheet 31) shows proposed tree locations with symbol circles. The two plans do not include dimension callouts or clearance analysis showing the distance from tree planting locations to underground…
- *reasoning:* Underground electrical equipment exists on the site (transformers and pull boxes per Sheet 21), and trees are being planted (per Sheet 31), but the relative spacing and clearances are not documented with explicit dimensions. Without documented clearance distances, it cannot be verified that trees are not proposed within the 5-foot prohibition zone from un…

**run-3** — status=`not-verifiable`
- *observation:* Sheet 21 depicts underground electrical infrastructure (transformers, pull boxes, lines) with general routing shown. Sheet 31 shows proposed trees but does not reference or dimension clearances from these underground facilities.
- *reasoning:* The 5-foot clearance requirement from underground equipment cannot be verified without coordinate information or clearance callouts on the landscape plan. Applicant must either overlay underground equipment locations on landscape plan or provide a clearance matrix.

---

### EL-2.9 — `mixed`

> Trees proposed within 20 lateral feet of underground electric equipment lack required root barriers (minimum 4 feet deep, positioned 5 feet from equipment)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`generic`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`fail`
- *observation:* Vision measurement identified transformer pad west of Bldg 2 with tree at 21.6 feet from the equipment. Sheet 37 Landscape Details shows tree planting and protection standard details including tree protection fencing (610S-4) and mulching requirements, but no root barrier specifications for electric equipment protection.
- *reasoning:* Trees within 20 feet of underground electric equipment require root barriers per UCM § 1.10.10.4. The measured 21.6-foot distance is within this threshold. Sheet 37 shows comprehensive landscape details but the absence of root barrier specifications (minimum 4 feet deep, positioned 5 feet from equipment) indicates this requirement has not been addressed i…

**run-2** — status=`not-verifiable`
- *observation:* Underground electrical transformers and pull boxes are depicted on Sheet 21 (Preliminary Electrical Design Plan). Trees are shown on Sheet 31 (Landscape Plan). No root barrier details or specifications are called out on the landscape plan for trees proposed within any distance of underground equipment.
- *reasoning:* Root barriers are required only when trees are proposed within 20 lateral feet of underground electrical equipment. However, the plans do not document clearances from trees to underground equipment (per EL-2.8), nor do they identify which trees, if any, might fall within the 20-foot zone requiring root barriers. Therefore, it cannot be verified whether ro…

**run-3** — status=`not-verifiable`
- *observation:* Sheet 21 shows underground infrastructure routing generally; Sheet 31 shows proposed trees. Neither sheet provides clearance analysis or coordinate dimensions that would allow determination of 20-foot root barrier zones.
- *reasoning:* Compliance with root barrier requirements cannot be verified without either: (1) specific coordinate data showing which proposed trees fall within 20-foot zones, or (2) root barrier detail specifications on landscape sheets. Current plans lack this level of coordination.

---

### EL-1.27 — `valid_other`

> Customer facilities proposed to be installed under or over Austin Energy overhead distribution facilities in violation of prohibition, or items within electric easements do not maintain minimum 7.5-foot clearance from outside conductor

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`fail`
- *observation:* Sheet 31 shows the OHE line routing along the southern site boundary and through landscaping areas, and the site plan shows buildings and structures distributed across the site. However, no easement exhibit is provided showing the precise easement boundaries, and no clearance dimension callouts confirm that structures within easements (if any) maintain 7.…
- *reasoning:* UCM § 1.10.3 imposes an absolute prohibition on installing customer facilities under or over distribution lines and requires documented 7.5-foot clearances within easements. The absence of an easement exhibit with clearance annotations fails to demonstrate compliance with these requirements.

**run-2** — status=`fail`
- *observation:* Vision check confirmed multiple trees on landscape plan positioned with canopies overlapping the OHE line path. Plant list includes large tree species (Oak, Elm) unsuitable for positions under overhead lines.
- *reasoning:* UCM § 1.10.3 contains an absolute prohibition against installing customer facilities under or over overhead distribution facilities, distinct from maintaining clearance distances. Tree canopies shown overlapping the conductor violate this prohibition.

**run-3** — status=`fail`
- *observation:* Vision measurement of Sheet 9 confirms retaining wall position at only 0.2 feet from OHE line running along south property boundary. The wall is directly adjacent to the conductor envelope.
- *reasoning:* UCM § 1.10.3 prohibits customer facilities 'under or over' Austin Energy distribution facilities absolutely, independent of clearance distances. The retaining wall is essentially at the same location as the conductor, violating this prohibition.

---

### EL-13.38 — `valid_other`

> Equipment pad installed within 4 feet of parking areas or vehicle routes lacks required 4-inch minimum diameter galvanized rigid metal posts (bollards) per AE Design equipment pad details, or bollards not spaced to allow equipment door opening

- **majority vision_check:** `generic`  ·  **per-run intent:** run-1=`generic`, run-2=`generic`, run-3=`generic`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`fail`
- *observation:* Vision analysis confirmed that four transformer pad locations are immediately adjacent to parking and driveway areas, and inspection of Sheet 21 revealed no bollard symbols, callout bubbles, or references to detail sheets showing bollard specifications.
- *reasoning:* The required protection (4-inch diameter galvanized bollards) is mandatory when pads are within 4 feet of vehicle circulation. The complete absence of bollard documentation is a clear deficiency.

**run-2** — status=`fail`
- *observation:* Vision checks show all four transformer pads are within 4 feet of parking/circulation areas; review of electrical plan, site plan, and detail sheets reveals no bollard symbols or specifications anywhere in the submitted documents.
- *reasoning:* The requirement for bollards when pads are within 4 feet of parking/circulation is clearly triggered and not met. No bollards are shown, documented, or detailed.

**run-3** — status=`fail`
- *observation:* Vision check identified a transformer pad labeled 'Electrical Transformer Pad' immediately adjacent to a line labeled 'Concrete Curb & Gutter' forming a curved driveway on Sheet 21, with the measured distance less than 4 feet. A separate visual analysis confirmed no bollards are labeled or shown around any of the four transformer pad locations on the plan.
- *reasoning:* When transformer equipment is within 4 feet of parking or vehicle routes, bollards are required per AE Design equipment pad details. The absence of bollard symbols, callouts, or references indicates this protective element is missing from the design.

---

### EL-1.37 — `valid_other_data_gap`

> Trees proposed within 10 lateral feet of overhead distribution conductors or 50 lateral feet of overhead transmission conductors are not from Utility Compatible Shade Trees list, or site grading does not meet required clearances from transmission facilities

- **majority vision_check:** `generic`  ·  **per-run intent:** run-1=`generic`, run-2=`generic`, run-3=`generic`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Vision analysis of Sheet 31 confirmed three proposed trees within 10 feet of the OHE line at the eastern end of the line. Sheet 35 contains plant schedules with species names but does not explicitly mark which specific trees are utility-compatible (UC-marked per ECM Appendix F) or which species are planted at the specific locations near the OHE line.
- *reasoning:* While tree species are listed on the plant schedule, the plans do not provide explicit mapping of species to specific locations near the OHE line, nor do they mark species as utility-compatible per ECM Appendix F requirements. Without this documentation, compliance cannot be verified.

**run-2** — status=`fail`
- *observation:* Vision check of Landscape Plan confirmed trees within 10 feet of OHE line at multiple locations. Plant list shows: 10 Cedar Elm, 2 Live Oak (not utility-compatible); 2 Texas Mountain Laurel, 6 Mexican Redbud (utility-compatible). Large oaks and elms have canopies shown overlapping OHE line.
- *reasoning:* ECM and UCM standards limit trees within 10 feet of distribution conductors to utility-compatible species (generally ≤20 feet mature height). Live Oaks and Cedar Elms grow 40-50 feet and are not on the utility-compatible list. Their placement within 10 feet violates tree clearance requirements.

**run-3** — status=`fail`
- *observation:* Vision analysis of Sheet 31 shows 'M' (mitigation) tree symbols within 10 feet of OHE line on south boundary. The vision report noted the plan does not include a plant schedule identifying the exact botanical species for these trees or 'UC' utility compatible markings.
- *reasoning:* Trees within 10 lateral feet of distribution conductors must be from ECM Appendix F Utility Compatible list (generally mature height ≤20 feet). The species identification is not provided on the landscape plan or is not cross-referenced clearly to the tree list sheets, preventing verification of compliance.

---

### EL-1.40 — `valid_other_data_gap`

> Down guy wires conflicting with accessible paths, driveways, or other site features not resolved through pole relocation or conversion to self-supporting steel poles

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 31 shows utility pole symbols but does not distinguish between single-line poles, three-phase structures, or down guy cable anchors. Sheet 4 (Existing Conditions Survey) includes a legend showing utility poles, but specific down guy locations in conflict with proposed site features are not identified.
- *reasoning:* Without explicit identification of down guy locations and dimension callouts or relocation notes addressing conflicts with accessible routes, compliance cannot be verified. Note: Electric utility infrastructure is frequently omitted or incompletely shown on site plans.

**run-2** — status=`not-verifiable`
- *observation:* Survey shows pole symbols but down guy anchor points are typically not clearly marked. Site plan shows driveway and path routing. No note addressing down guy conflict resolution.
- *reasoning:* Down guys are frequently omitted from plans but are real infrastructure that must be addressed when site design conflicts exist. Cannot confirm resolution without explicit documentation.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 4 survey includes utility line markings and pole locations but does not specifically call out down guy anchor positions or guy wire alignments. Sheet 9 site plan shows proposed features but does not reference down guy conflicts.
- *reasoning:* Down guy wire conflicts would be identified if existing guy infrastructure were clearly mapped and proposed features were dimensioned against them. This detailed coordination is not visible in the plans.

---

### EL-2.1 — `valid_other_data_gap`

> Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment

- **majority vision_check:** `generic`  ·  **per-run intent:** run-1=`generic`, run-2=`generic`, run-3=`measurement`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`fail`
- *observation:* Vision analysis of Sheet 31 measured trees at the bottom boundary 0.1 to 2 feet from the OHE line. Plant schedule on Sheet 35 identifies Cedar Elm and Live Oak as proposed trees; the grouping guidance identifies these as maturing to 40-50+ feet and 40-80 feet respectively.
- *reasoning:* Trees of this size and species are not listed among the utility-compatible exceptions in the grouping guidance (which notes only trees with mature height ≤20 feet are generally UC, with specific exceptions like Texas Mountain Laurel at 25 feet). Being non-UC, they cannot be placed within 15 feet of distribution conductors per UCM § 1.10.10.4. The 0.1-2 fo…

**run-2** — status=`not-verifiable`
- *observation:* Overhead electric (OHE) lines are shown on both the Site Plan (Sheet 9) and Landscape Plan (Sheet 31) running along the property boundary. A plant schedule on Sheet 35 lists tree species (Live Oak, Cedar Elm, Texas Mountain Laurel, Mexican Redbud) with common and scientific names, but contains no designation of utility-compatibility status per ECM Appendi…
- *reasoning:* While the requirement for non-utility-compatible tree placement near distribution conductors is clearly applicable (distribution infrastructure is present), the plan set does not indicate which, if any, of the proposed species meet the utility-compatible (UC) designation criteria. Additionally, no clearance distances are dimensioned between trees and the …

**run-3** — status=`not-verifiable`
- *observation:* Vision analysis of landscape plan Sheet 31 identified multiple trees at 0, 0.4, 0.9, and 6.2 feet from the OHE line along the southern boundary. Plant schedule (Sheet 35) lists proposed species (Cedar Elm, Live Oak, Mexican Redbud, Texas Mountain Laurel) but does not indicate UC status. No clearance dimensions or UC verification notes appear on either sheet.
- *reasoning:* The requirement mandates non-UC trees must be minimum 15 feet from distribution lines. Proposed trees are clearly within this zone, but cannot confirm non-compliance because UC status is not documented. Applicant must verify species against ECM Appendix F UC column and provide clearance calculations.

---

### EL-2.3 — `valid_other_data_gap`

> Large trees (mature height 40+ feet per ECM Appendix F) proposed within 25 lateral feet of overhead electric distribution conductor or equipment

- **majority vision_check:** `3-way-tie`  ·  **per-run intent:** run-1=`measurement`, run-2=`generic`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`fail`
- *observation:* Vision measurement of Sheet 31 shows multiple trees positioned 0.1-2 feet from the OHE line at site boundary. Plant schedule on Sheet 35 specifies Cedar Elm and Live Oak as proposed trees; these species mature to 40-80 feet per standard arboricultural references.
- *reasoning:* UCM § 1.10.10.4 restricts large trees (≥40 feet) to locations more than 25 feet from distribution conductors. The measured distances of 0.1-2 feet are well within this 25-foot restriction zone. Cedar Elm and Live Oak, both exceeding the 40-foot threshold, violate this requirement.

**run-2** — status=`not-verifiable`
- *observation:* Landscape Plan (Sheet 31) shows tree symbols near the overhead electric line. Plant schedule on Sheet 35 lists four primary tree species: Live Oak (installation height 16'), Cedar Elm (16'), Texas Mountain Laurel (8'), and Mexican Redbud (10'). Only installation/minimum heights are documented; mature height specifications are not provided anywhere on the …
- *reasoning:* Large trees (40+ feet mature height) are a subset of trees requiring special clearance distances from distribution conductors. However, the plant schedule provides only installation heights (the minimum size at planting), not mature heights. Species like Live Oak and Cedar Elm typically reach 40+ feet at maturity, but this cannot be verified from the subm…

**run-3** — status=`fail`
- *observation:* Plant schedule (Sheet 35) lists 10 Cedar Elm and 2 Live Oak as proposed trees. Vision analysis confirmed trees at 0, 0.4, 0.9, and 6.2 feet from OHE line. Cedar Elm and Live Oak have typical mature heights of 40-50 feet, placing them in the 'large tree' category (≥40 feet per ECM Appendix F definition for electrical purposes). No mature height verificatio…
- *reasoning:* Large trees (mature height ≥40 feet) must be minimum 25 feet from distribution conductors. Proposed Cedar Elm and Live Oak are clearly within this restricted zone at distances of 0-6.2 feet. Failure to document mature heights and clearance requirements for large trees violates UCM § 1.10.10.4.

---

### EL-1.15 — `valid_not_applicable`

> Retaining walls adjacent to Austin Energy substation walls do not maintain minimum 5-foot separation to allow for grounding grid extension, wall inspection, wall replacement, and proper drainage

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`n/a`
- *observation:* Review of site plan and property facts shows no Austin Energy substation property adjacent to the Valley View Townhomes site.
- *reasoning:* EL-1.15 only applies when retaining walls are proposed adjacent to Austin Energy substation property. No substation exists on or adjacent to this site.

**run-2** — status=`n/a`
- *observation:* No substation shown on plans or mentioned in facts.
- *reasoning:* Substation separation requirement does not apply.

**run-3** — status=`n/a`
- *observation:* Review of site plan and utility plans shows no electric substation on or immediately adjacent to project boundaries.
- *reasoning:* Substation wall separation requirements are not triggered. Item not applicable.

---

### EL-1.35 — `valid_not_applicable`

> New power poles for underground service located less than 20 feet from existing power poles

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* The electrical design (Sheet 21) shows underground service distribution to the proposed buildings. No new poles for underground conversion are identified on the utility plans.
- *reasoning:* EL-1.35 applies only when new poles are proposed for converting existing overhead service to underground. The proposed service is being installed new (not converting existing), making this requirement inapplicable.

**run-2** — status=`n/a`
- *observation:* Electrical Design Plan (Sheet 21) shows underground infrastructure. No new above-ground power poles indicated.
- *reasoning:* Requirement applies only when new poles are proposed for underground conversion.

**run-3** — status=`n/a`
- *observation:* Sheet 21 Preliminary Electrical Design Plan shows only underground electrical routing and pad-mounted transformers. No new pole installations are proposed.
- *reasoning:* New power pole spacing requirement does not apply. Item not applicable.

---

### EL-1.4 — `valid_not_applicable`

> Gas pump canopies do not maintain required clearances from overhead electric lines

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of site plan sheets (Sheet 9 main site plan, Sheet 31 landscape plan, and supplementary utility plans) shows no gas pump canopy features proposed.
- *reasoning:* EL-1.4 is only applicable when gas pump canopies are proposed. No evidence of gas pump canopies exists on the plans, making this requirement inapplicable.

**run-2** — status=`n/a`
- *observation:* Site plan shows only residential townhome buildings, no gas pumps or fuel service stations.
- *reasoning:* Requirement applies only when gas pump canopies are proposed. No such facilities exist in this project scope.

**run-3** — status=`n/a`
- *observation:* Review of site plan (Sheet 9) and all associated sheets shows 39 townhome units with parking, driveways, and landscaping. No gas service or pump canopies are shown or proposed.
- *reasoning:* Gas pump canopies are not part of the proposed development. This item is not applicable.

---

### EL-13.17 — `valid_not_applicable`

> Transformer pads lack minimum 5-foot clearance from bike racks

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`measurement`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Sheet 31 shows bicycle parking symbols in designated zones on the site plan, which are not adjacent to transformer pad locations shown on Sheet 21.
- *reasoning:* The applicability condition (bike racks present adjacent to transformer) is not met based on the plan layout.

**run-2** — status=`pass`
- *observation:* Vision measurement shows bicycle parking area 11.6 feet from transformer pad location.
- *reasoning:* The measured distance exceeds the 5-foot minimum requirement, therefore the requirement is satisfied.

**run-3** — status=`n/a`
- *observation:* Review of site plan (Sheet 9) identified 41 bicycle parking spaces (39 long-term, 2 short-term) but found no bike rack symbols adjacent to any transformer pad locations.
- *reasoning:* The 5-foot clearance requirement applies only when bike racks are adjacent to transformers. The absence of such adjacency makes this requirement inapplicable.

---

### EL-13.18 — `valid_not_applicable`

> Transformer pads lack minimum 5-foot clearance from light poles

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of electrical plan (Sheet 21) shows no light pole symbols in proximity to transformer pads, and no photometric plan details are present showing light pole locations.
- *reasoning:* The applicability condition (light poles adjacent to transformer) is not met.

**run-2** — status=`not-verifiable`
- *observation:* Site plan review did not reveal explicitly labeled light pole locations relative to transformer pads.
- *reasoning:* Without a detailed photometric plan or clear light pole symbols on the site plan, clearance distances cannot be measured.

**run-3** — status=`n/a`
- *observation:* Review of landscape plan (Sheet 31) and site plan (Sheet 9) found no light pole symbols positioned adjacent to any transformer pads.
- *reasoning:* The requirement applies only when light poles are adjacent to transformers. Their absence in proximity to pads makes this requirement inapplicable.

---

### EL-13.20 — `valid_not_applicable`

> Transformer pads lack minimum 5-foot clearance from other transformer pads

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`measurement`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Vision analysis of Sheet 21 identified 5 transformer pads all associated with a single electrical service routing for the buildings. No separate transformer pad installations or groups are shown.
- *reasoning:* The requirement applies when multiple independent transformer installations are proposed. This project shows a single electrical service delivery system; therefore, the inter-pad spacing requirement does not apply.

**run-2** — status=`pass`
- *observation:* Vision measurements show transformer pad-to-pad distances ranging from 49.8 to 81.2 feet.
- *reasoning:* All measured distances significantly exceed the 5-foot minimum requirement, therefore the requirement is satisfied.

**run-3** — status=`n/a`
- *observation:* Review of Sheet 21 identified multiple individual transformer pad locations, but they are distributed across the site and do not have another transformer pad as a neighboring feature requiring 5-foot separation.
- *reasoning:* The requirement applies only when multiple transformer pads are located in proximity requiring separation from one another. With each pad standing alone in its location, this requirement is inapplicable.

---

### EL-13.27 — `valid_not_applicable`

> Transformer locations lack minimum 7.5-foot horizontal sky-to-ground clearance from overhead distribution line conductors (primary, neutral, and secondary), extending from ground to sky

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of electrical plan (Sheet 21) shows only underground electric lines labeled and depicted. No overhead lines or conductor symbols are present. Sheet 31 landscape plan also labels 'Overhead Electric' area notation but indicates no actual conductors.
- *reasoning:* The applicability condition (overhead distribution lines present) is not met based on submitted plans.

**run-2** — status=`not-verifiable`
- *observation:* Electrical plan shows overhead line routes but does not provide vertical clearance analysis or cross-section drawings.
- *reasoning:* Without vertical cross-sections or explicit clearance documentation, the sky-to-ground clearance requirement cannot be directly verified from plan view alone.

**run-3** — status=`n/a`
- *observation:* Review of site plan (Sheet 9) and electrical plan (Sheet 21) shows only underground electrical service, with no overhead distribution lines, poles, or conductors depicted.
- *reasoning:* The 7.5-foot sky-to-ground clearance requirement applies only when overhead distribution lines are present. Their absence makes this requirement inapplicable.

---

### EL-13.28 — `valid_not_applicable`

> Transformer locations or proposed facilities lack minimum 15-foot radius clearance from overhead distribution primary and neutral conductors (measured from conductors, not pole centerline)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`measurement`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Comprehensive review of electrical plan (Sheet 21) and all utility notation shows only underground electric service. No overhead distribution infrastructure is depicted.
- *reasoning:* The applicability condition (overhead primary/neutral conductors present) is not met.

**run-2** — status=`pass`
- *observation:* Vision measurements show radial distances to overhead distribution conductors ranging from 42.4 to 105.9 feet.
- *reasoning:* All measured distances significantly exceed the 15-foot minimum radial clearance requirement, therefore the requirement is satisfied.

**run-3** — status=`n/a`
- *observation:* Review of site plan (Sheet 9) and electrical plan (Sheet 21) indicates all electrical service is underground, with no overhead distribution conductors or poles shown.
- *reasoning:* The 15-foot radial clearance requirement applies only when overhead distribution primary or neutral conductors are present. Their absence makes this requirement inapplicable.

---

### EL-13.3 — `valid_not_applicable`

> Transformer pads lack required clearance from fences and gates - 5 feet for sides with operators/controls, 3 feet for sides without operators/controls (from removable ventilated fences)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`measurement`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Vision analysis of Sheet 21 confirmed that transformer pad symbols are simple squares with no markings indicating access door location or orientation.
- *reasoning:* The 5-foot vs. 3-foot clearance requirement depends on identifying which side of the pad faces operators/controls. Since this orientation is not indicated, clearance verification is impossible.

**run-2** — status=`n/a`
- *observation:* Vision analysis of site plan identified transformer pad locations; no fences or gates were found adjacent to any of the four identified pads.
- *reasoning:* The applicability condition (fences or gates adjacent to pads) is not met, therefore this item does not apply.

**run-3** — status=`n/a`
- *observation:* Review of Sheet 21 found no fence or gate symbols adjacent to any of the labeled transformer pad locations.
- *reasoning:* The requirement is conditional and only applies when fences or gates are present adjacent to transformer pads. The absence of such features means this item is not applicable.

---

### EL-13.39 — `valid_not_applicable`

> Customer facilities (buildings, parking garages, light poles, signs, billboards, chimneys, antennas, tanks) installed under or over Austin Energy overhead distribution facilities

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Sheet 21 and all utility notations show only underground electric lines. No overhead poles, conductors, or distribution infrastructure are depicted on electrical or utility plan sheets.
- *reasoning:* The applicability condition (overhead distribution facilities present) is not met.

**run-2** — status=`n/a`
- *observation:* Site plan and utility plan review shows overhead distribution lines running along property boundaries and adjacent areas; no buildings or major customer facilities are located directly under these lines.
- *reasoning:* The applicability condition (customer facilities under overhead lines) is not present, therefore this item does not apply.

**run-3** — status=`n/a`
- *observation:* Review of site plan (Sheet 21) and electrical plan shows all electrical service is underground, with no overhead distribution lines, poles, or other overhead facilities depicted.
- *reasoning:* The requirement applies only when overhead distribution facilities are present on the site. The absence of such facilities makes this requirement inapplicable.

---

### EL-13.8 — `valid_not_applicable`

> Transformer pads lack required clearance from stairwells serving as fire exits

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Comprehensive review of electrical plan (Sheet 21) and fire protection plan (Sheet 10) shows no stairwell structures adjacent to any transformer pad locations.
- *reasoning:* The applicability condition (stairwell present adjacent to transformer) is not met, making the requirement non-applicable.

**run-2** — status=`n/a`
- *observation:* Review of site plan and building floor plans shows no stairwells positioned adjacent to transformer locations.
- *reasoning:* The applicability condition (stairwells adjacent to pads) is not present, therefore this item does not apply.

**run-3** — status=`n/a`
- *observation:* Review of site plan and building floor plan references found no stairwells labeled as fire exits or emergency exits positioned adjacent to transformer pads.
- *reasoning:* The requirement applies only when stairwells are present adjacent to transformers. Their absence makes this requirement inapplicable.

---

### EL-13.9 — `valid_not_applicable`

> Transformer pads lack minimum 20-foot horizontal/radial clearance from fire escapes or stairs serving as fire escapes (oil-filled equipment)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`generic`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`n/a`
- *observation:* Vision analysis of Sheet 21 found no fire escapes or exit stairs depicted. Fire protection plan (Sheet 10) shows fire zones and hydrants but no fire escape structures.
- *reasoning:* The requirement applies only when fire escapes are present and equipment is oil-filled. Neither condition is demonstrated on the plans.

**run-2** — status=`n/a`
- *observation:* Fire protection plan and site plan show no fire escapes or external emergency stairs adjacent to transformer locations.
- *reasoning:* The applicability trigger (fire escapes present) is not present, therefore this item does not apply to this project.

**run-3** — status=`n/a`
- *observation:* Review of fire protection plan (Sheet 10) and site plan found no fire escape symbols or labels adjacent to any buildings or transformer locations.
- *reasoning:* The 20-foot clearance requirement applies only to oil-filled equipment with fire escapes present. The absence of fire escapes makes this requirement inapplicable.

---

### EL-2.2 — `valid_not_applicable`

> Non-utility-compatible trees proposed within 50 lateral feet of overhead electric transmission conductor or equipment

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`generic`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Landscape Plan shows a line labeled 'OHE' (Overhead Electric) without voltage classification. Vision analysis found no explicit 'transmission' labels, voltage markings (60kV+), or structural characteristics distinguishing transmission infrastructure.
- *reasoning:* The grouping distinguishes distribution (<60kV) from transmission (≥60kV) facilities with different clearance requirements. Without evidence of transmission classification on the landscape plan, it cannot be determined whether the 50-foot transmission clearances or the 15-foot distribution clearances apply. Applicability of this item is conditional on ide…

**run-2** — status=`n/a`
- *observation:* Examination of the site plans shows electric easements marked as '5' Electric Easement' and '5' Elec. & Tele. Easement' on the property. No transmission facilities (69kV, 138kV, or 345kV infrastructure) are labeled or identified.
- *reasoning:* The applicability condition for this item requires transmission lines (energized at 60kV or higher). The electric infrastructure shown is marked as distribution (5-foot easement widths are typical for distribution), not transmission. No transmission easement, transmission-class conductor, or high-voltage infrastructure labeling is present. This item does …

**run-3** — status=`n/a`
- *observation:* Landscape plan shows overhead electric (OHE) infrastructure labeled as distribution on southern boundary. No transmission easements or higher-voltage facilities are documented in facts.md or visible on site plan sheets.
- *reasoning:* Transmission-specific requirements do not apply when only distribution facilities are present. This item is inapplicable to the project.

---

### EL-2.4 — `valid_not_applicable`

> Large trees (mature height 40+ feet per ECM Appendix F) proposed within 50 lateral feet of overhead electric transmission conductor or equipment

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* No transmission facility designations found on landscape plan or electrical plan documents reviewed.
- *reasoning:* This requirement is conditional on transmission facilities being present or proposed. Since transmission infrastructure cannot be identified, applicability cannot be determined.

**run-2** — status=`n/a`
- *observation:* No transmission facility is identified on the site plans.
- *reasoning:* This item applies only when transmission facilities (60kV or higher) are present. As determined for EL-2.2, the electrical infrastructure shown is distribution-class, not transmission. This item does not apply.

**run-3** — status=`n/a`
- *observation:* Site plan shows only distribution-level overhead electric infrastructure. No transmission easements, transmission poles, or transmission conductor configurations are documented.
- *reasoning:* Transmission-specific requirements apply only when transmission facilities are present. This item is inapplicable.

---

### EL-2.5 — `valid_not_applicable`

> Trees (any species) proposed within transmission easement boundaries

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`generic`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Attempted vision analysis of Sheet 2 (Plat) to identify transmission easement boundaries did not complete. Facts.md references transmission line requirements but does not indicate whether a transmission easement crosses the property.
- *reasoning:* The requirement depends on whether a transmission easement exists on the site. Sheet 3 Block 13 notes reference transmission easements and structures, suggesting they may exist, but specific easement locations on this parcel were not verified.

**run-2** — status=`n/a`
- *observation:* Site plan notes and easement documentation show '5' Electric Easement' designations, consistent with distribution infrastructure. No transmission easement boundaries are shown or referenced on the grading plan, site plan, or plat.
- *reasoning:* This item applies only when a transmission easement is present. The electric easements on site are 5-foot width, typical of distribution easements. No transmission easement is identified. This item does not apply.

**run-3** — status=`n/a`
- *observation:* Facts.md identifies plat-dedicated 5-foot electric easements (Easement 7 & 8) but no transmission easement. Grading plan and site plan show no transmission easement boundaries.
- *reasoning:* The categorical prohibition against trees in transmission easements applies only when such easements are present. No transmission easement is shown, so this requirement is inapplicable.

---
