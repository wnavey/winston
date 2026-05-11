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

Total items analyzed: **46**

| verdict | count | share |
|---|---:|---:|
| `invalid_missing_dimensions` | 7 | 15.2% |
| `invalid_probable` | 3 | 6.5% |
| `valid_not_applicable` | 14 | 30.4% |
| `valid_no_feature` | 2 | 4.3% |
| `valid_other` | 4 | 8.7% |
| `valid_other_data_gap` | 3 | 6.5% |
| `mixed` | 13 | 28.3% |

**Reading:**

- **7 confirmed *invalid skips*** — the agent saw the feature on the plan and explicitly said dimensions weren't annotated. Exactly what `measure-distance` is built for. Latent Goal B headroom: if the classifier had fired `measurement`, the specialist would have computed the distance instead of the agent declaring `not-verifiable`.
- **3 probable invalid skips** — all 3 runs `not-verifiable`, no non-spatial data gap cited, but reasoning didn't trip the strict "no dimensions" regex. Worth manual confirmation.
- **23 valid skips** — `measure-distance` wouldn't have helped: feature not on plan (2), requirement doesn't apply (14), real verdict reached without measurement (4), or non-spatial data gap (3).
- **13 mixed.** Runs disagreed; needs manual review.

### Adjusted Goal B

Restricting Goal B's denominator to the items where vision/measurement could plausibly have helped:

| variant | denominator | calc | rate |
|---|---|---|---|
| Goal B raw | 51 expected-md items | 5/51 | **9.8%** |
| Goal B adjusted (TSV-based) | drop the 21 `valid_*` rows tagged by the TSV's `no_call_verdict` column | 5/30 | **16.7%** |
| Goal B strict-clear | also drop the 13 `mixed` rows where the 3 runs disagreed materially | 5/17 | **29.4%** |

The TSV-based view (5/30) is the headline cited in `metrics/source-runs.md`. The standalone classifier in this analysis flags 23 valid skips rather than 21 — the extra 2 are items where the agent invoked generic vision but the underlying skip-of-measure-distance is still valid (`expected_specialist=measure-distance` but `majority_vision_check=generic`), which the TSV's `no_call_verdict` column tags as `n/a` rather than valid. Using the standalone-analysis numerator/denominator gives **5/28 = 17.9%** — within noise of the TSV-based 16.7%.

Reproducible: `python3 scripts/goal-b-adjusted.py`.

## Per-item detail

Each entry: item_id (verdict), expected item text, then per-run status + observation snippet + reasoning snippet.

### EL-1.10 — `invalid_missing_dimensions`

> Fence posts do not maintain minimum 10-foot horizontal clearance from overhead electric poles

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Utility poles are depicted on the existing conditions survey (Sheet 4) and referenced on the site plan, but specific pole locations are not dimensioned with measurements to proposed fence post locations.
- *reasoning:* Without dimension annotations showing the distance from existing utility poles to proposed fence post locations, compliance with the 10-foot horizontal clearance requirement cannot be verified.

**run-2** — status=`n/a`
- *observation:* Site plan shows no proposed fence posts positioned within 30 feet of existing electric pole locations. Utility poles are shown on plan, but fence layout is internal to the site and not adjacent to poles.
- *reasoning:* Fence post clearance from poles is not a triggering condition on this project; requirement does not apply.

**run-3** — status=`not-verifiable`
- *observation:* Existing conditions survey (Sheet 4) and site plan (Sheet 9) both show utility pole symbols along the western property boundary. Fences are shown on landscape plan and site plan. No dimension annotations specifically showing fence post spacing relative to pole locations are provided.
- *reasoning:* Applicability is met (fences proposed, utility poles exist). However, the 10-foot clearance distance from fence posts to poles is not explicitly dimensioned on the plans. While visual inspection suggests adequate separation, the required clearance cannot be verified by measurement from the submitted documents.

---

### EL-1.14 — `invalid_missing_dimensions`

> Retaining walls do not maintain minimum 7.5-foot horizontal sky-to-ground clearance from outermost electric line where overhead facilities are present

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Retaining walls are depicted on the grading plan (Sheet 11) and detailed on the wall plan (Sheet 38), but their locations are not dimensioned relative to the overhead electric lines shown on the site plan.
- *reasoning:* Without dimension annotations or cross-reference showing the clearance distance from overhead electric conductors to the outermost face of retaining walls, compliance with the 7.5-foot horizontal clearance requirement cannot be verified.

**run-2** — status=`fail`
- *observation:* Vision analysis of Site Plan (Sheet 9) measured wall positions relative to easement lines and OHE line marking. Retaining wall (shown as heavy solid line) runs within the 5-foot dashed easement boundary on both southern and eastern sides, placing wall structure within the easement zone.
- *reasoning:* Walls within electric easements are prohibited without utility company consent. Additionally, no clearance dimensions from wall face to outer conductor are provided. Retaining wall detail sheets (Sheets 38-39) would need to demonstrate either: (1) wall relocation outside easements, or (2) special easement agreement and clearance dimensions.

**run-3** — status=`not-verifiable`
- *observation:* Grading plan (Sheet 11) shows retaining wall locations, and wall plan sheets (Sheets 38-39) provide detailed specifications. Overhead electric line depicted on grading plan shows general alignment but no dimension from outer conductor to nearest wall location is annotated.
- *reasoning:* Retaining walls are proposed and overhead electric facilities exist, satisfying applicability. However, the required clearance dimensions from the outer conductor to the outermost edge of the walls are not shown. Without these measurements, compliance with the 7.5-foot sky-to-ground clearance cannot be verified.

---

### EL-1.22 — `invalid_missing_dimensions`

> Existing electric poles in conflict with proposed driveways not relocated minimum 30 feet from edge of driveway

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Utility poles are depicted on the existing conditions survey (Sheet 4) and their locations are reflected on the site plan, but no dimension annotations specify whether proposed driveways conflict with existing pole locations or verify the 30-foot minimum relocation distance.
- *reasoning:* Without explicit dimension annotations or conflict analysis showing the clearance between proposed driveway edges and existing utility pole locations, compliance with pole relocation requirements cannot be verified.

**run-2** — status=`n/a`
- *observation:* Site plan layout shows driveways and circulation that do not intersect with pole locations shown on utility map.
- *reasoning:* Pole relocation requirement applies only when proposed driveways conflict with existing pole locations within 30 feet. No such conflict is evident.

**run-3** — status=`not-verifiable`
- *observation:* Existing conditions survey shows utility poles marked along western boundary. Site plan shows driveways within the development. These plans do not explicitly dimension the separation between driveway edges and pole locations.
- *reasoning:* Existing poles are evident on the plans and driveways are proposed. The requirement is met if poles are relocated minimum 30 feet from driveway edges or if they are already adequately separated. Without dimension annotations showing this separation, verification is not possible.

---

### EL-1.25 — `invalid_missing_dimensions`

> Sidewalks not cleared from existing power poles at each end of property along right-of-way

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sidewalks are shown along Valley View Road on the site plan, and utility poles are depicted on the existing conditions survey, but no dimension annotations show the clearance between proposed sidewalk locations and existing utility poles at property corners.
- *reasoning:* Without dimension annotations or conflict analysis showing sidewalk clearances from utility poles at the property ends along the ROW frontage, compliance cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Site plan indicates sidewalk network including connections to property frontage on Valley View Road and shows pole symbols on site perimeter, but exact pole-to-sidewalk endpoint clearances are not dimensioned.
- *reasoning:* Requirement is to clear sidewalks from poles at each end of property along ROW frontage. Applicability depends on confirming whether existing poles actually occupy sidewalk alignment at property corners; current plan detail is insufficient to verify.

**run-3** — status=`not-verifiable`
- *observation:* Site plan shows proposed sidewalks and existing utility poles along Valley View Road (western boundary). No specific dimension showing separation between sidewalk edges and pole locations at property endpoints is annotated.
- *reasoning:* While sidewalks and poles are visible on the plans, the explicit clearance dimensions required to confirm compliance are not documented. Verification from plan geometry alone is difficult without dimensional callouts.

---

### EL-1.27 — `invalid_missing_dimensions`

> Customer facilities proposed to be installed under or over Austin Energy overhead distribution facilities in violation of prohibition, or items within electric easements do not maintain minimum 7.5-foot clearance from outside conductor

- **majority vision_check:** `generic`  ·  **per-run intent:** run-1=`none`, run-2=`generic`, run-3=`generic`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* The site plan shows proposed buildings, utilities, and structures, and the property facts identify 5-foot and 7.5-foot electric easements. However, no dimension annotations or easement boundary callouts show which proposed improvements (if any) fall within the electric easement boundaries.
- *reasoning:* Without clear identification of easement boundaries and dimension verification that any items within easements maintain 7.5-foot clearance from outer conductors, compliance with the prohibition against facilities under/over distribution lines cannot be verified.

**run-2** — status=`fail`
- *observation:* Vision analysis of Site Plan measured retaining wall position relative to 5-foot dashed easement boundary lines. Heavy solid line representing proposed retaining walls runs within the 5-foot Electric Easement strips on southern and eastern boundaries, placing the wall structure directly in the easement zone where utilities have access rights.
- *reasoning:* Structures within electric easements require utility authorization and verified clearances from outside conductor. Current plans show walls in easement zone without: (1) Austin Energy authorization documentation, (2) clearance dimensions from conductor, or (3) notation that walls will be relocated. This violates the absolute prohibition on structures with…

**run-3** — status=`not-verifiable`
- *observation:* Grading plan (Sheet 11) indicates 'electric easements' as part of the easement legend and shows easement boundaries on the drawing. However, no specific dimension from outer conductor to structures within or adjacent to these easements is provided. General notes in Sheet 3 reference the prohibition but site-specific verification is absent.
- *reasoning:* The 7.5-foot clearance requirement applies to all items within electric easements. Without dimension annotations showing this clearance from the outer conductor to proposed structures (buildings, fences, drainage, detention ponds) within or near easements, compliance cannot be verified from the submitted plans.

---

### EL-1.29 — `invalid_missing_dimensions`

> Water lines do not maintain minimum clearance from existing overhead electrical distribution facilities

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Water lines are depicted on the utility plan (Sheet 19), but no dimension annotations verify clearance distances from these lines to overhead electric distribution facilities.
- *reasoning:* Without dimension annotations showing clearance from water line routing to overhead distribution poles and conductors, compliance with clearance requirements cannot be verified.

**run-2** — status=`n/a`
- *observation:* Utility tap plan (Sheet 19-20) shows water line routing as underground service from main; no water line conflict with overhead distribution conductors is evident.
- *reasoning:* Water line clearance from overhead distribution is not an issue; requirement does not apply.

**run-3** — status=`not-verifiable`
- *observation:* Utility tap plans (Sheets 19-20) show water service lines but no dimensions showing clearance from overhead electric conductors are provided.
- *reasoning:* New water lines are proposed and overhead facilities exist. Without clearance documentation, compliance cannot be verified.

---

### EL-2.7 — `invalid_missing_dimensions`

> Trees proposed within 10 lateral feet of pad-mounted electric equipment, or between equipment access door and drivable surface

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`generic`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 21 shows transformer locations in schematic diagram form; Sheet 31 landscape plan does not mark these same equipment locations relative to tree symbols.
- *reasoning:* Verification requires synchronized documentation of equipment locations on the landscape plan with tree positions. Cross-sheet references alone are insufficient without dimensional or spatial correlation visible on the primary landscape plan.

**run-2** — status=`not-verifiable`
- *observation:* Electrical design plan (Sheet 21) describes underground transformers and pull boxes; landscape plan (Sheet 31) does not show pad-mounted transformer symbols or locations. Utility plan references show underground infrastructure.
- *reasoning:* EL-2.7 applies only if pad-mounted equipment is present. The electrical infrastructure shown is underground, suggesting no above-ground pad-mounts. However, the site might have existing pad-mounts not addressed in the new electrical design. This cannot be definitively determined from the submitted plans.

**run-3** — status=`not-verifiable`
- *observation:* Vision analysis of Sheet 21 identified four labeled 'Electrical Transformer Pad' locations. At Location 1 (west of Bldg 1), vision notes 'The edge of the closest plotted tree canopy appears to be immediately adjacent to or slightly overlapping the area just north of the transformer pad.' The electrical plan symbol shows a simple rectangle with letter 'E' …
- *reasoning:* The requirement prohibits trees within 10 feet of pad-mounted equipment, and additionally restricts trees between equipment access doors and drivable surfaces. The electrical plan does not clearly show pad-mounted equipment boundaries, access door orientations, or the required clearance zones. While trees appear to be positioned very close to at least one…

---

### EL-13.15 — `invalid_probable`

> Trees within 20 lateral feet of underground electric equipment lack required root barriers (minimum 4 feet deep, installed 5 feet from equipment)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Landscape plan (Sheet 31) shows tree locations. Plant list (Sheet 35) confirms proposed tree species. However, no root barrier detail sheets or specifications are provided on any of the submitted plan sheets or supplementary documents.
- *reasoning:* While the requirement is potentially applicable to proposed trees, the plans do not include root barrier detail drawings or specifications demonstrating compliance with the minimum 4-foot depth and 5-foot offset requirements.

**run-2** — status=`not-verifiable`
- *observation:* Landscape plan does not identify transformer pad locations or reference any root barrier details near electrical infrastructure.
- *reasoning:* Without transformer locations marked on landscape sheets and without root barrier specifications shown, this requirement cannot be verified.

**run-3** — status=`not-verifiable`
- *observation:* Vision review of landscape plan and detail sheets shows no transformer pad symbols.
- *reasoning:* Without transformer locations identified on the landscape plan, the 20-foot tree proximity trigger and required root barrier specifications cannot be evaluated.

---

### EL-2.8 — `invalid_probable`

> Trees proposed within 5 lateral feet of underground electric equipment

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`generic`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 21 contains underground utility details; Sheet 31 contains tree locations. No dimensional cross-reference or overlay showing distances from trees to underground equipment is provided.
- *reasoning:* The 5-foot underground equipment clearance requires explicit verification. Without dimensional documentation linking equipment to tree positions, verification is not possible.

**run-2** — status=`not-verifiable`
- *observation:* Electrical plan (Sheet 21) shows underground electric lines and pull boxes; landscape plan (Sheet 31) does not show underground utility locations or dimensions to proposed trees. Plans not cross-referenced.
- *reasoning:* To verify EL-2.8, underground equipment locations must be shown on the landscape plan with clearance dimensions to nearby trees. The electrical plan shows infrastructure but not its spatial relationship to landscaping on the landscape plan itself.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 21 identifies multiple 'Electrical Pull Box' locations throughout the site and underground electric lines routing through the property. The vision analysis noted that some appear to intersect or be near tree canopy outlines on that sheet. However, the electrical plan explicitly references the landscape plan for tree details, indicating incomplete co…
- *reasoning:* The requirement prohibits trees within 5 feet of underground electric equipment. The electrical and landscape plans appear to be separate documents not fully overlaid or cross-coordinated for tree-utility distance verification. The electrical plan's reference to 'Refer to landscape plan sheet 32 for the tree list' confirms that comprehensive verification …

---

### EL-2.9 — `invalid_probable`

> Trees proposed within 20 lateral feet of underground electric equipment lack required root barriers (minimum 4 feet deep, positioned 5 feet from equipment)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 31 does not overlay underground equipment from Sheet 21 with tree symbols. No dimensional analysis linking trees to 20-foot equipment zones is visible.
- *reasoning:* Root barrier requirements are conditional on trees being within 20 feet of underground equipment. Without documentary evidence of which trees fall in this zone and what root barriers have been specified, compliance cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Landscape plan (Sheet 31) does not overlay underground utility locations; no root barrier details visible on landscape plan or referenced detail sheets for trees near underground utilities. Electrical plan (Sheet 21) shows underground systems but not in relation to proposed plantings.
- *reasoning:* EL-2.9 requires identification of trees within 20 feet of underground equipment AND verification of 4-foot-deep root barriers positioned 5 feet from equipment. Neither the proximity identification nor the barrier specifications are documented on the landscape plan.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 37 provides standard tree planting details including pit size, stake specifications, and mulch requirements, but does not address root barrier requirements for trees near underground electrical equipment. The landscape plan does not indicate which trees are within 20 feet of underground equipment or show root barrier details.
- *reasoning:* The requirement for root barriers is conditional on proximity to underground equipment. The plans do not establish which trees fall within the 20-foot trigger distance for this requirement, nor do they show root barrier specifications where required. This prevents verification of compliance.

---

### EL-1.26 — `mixed`

> Enclosed trash areas and trash receptacles placed under overhead electric facilities creating risk of contact when trash bins are raised during service

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* The site plan includes general notes about trash collection and containers, and a trash collection note prohibiting unattended curbside placement, but specific trash enclosure locations are not dimensioned relative to overhead electric lines.
- *reasoning:* Without explicit identification and dimensioning of trash enclosure locations relative to overhead lines, and without verification that bin lift height during service will not contact conductors, clearance compliance cannot be determined.

**run-2** — status=`n/a`
- *observation:* Site plan shows trash collection requirement but does not depict specific trash enclosure or receptacle locations; landscape plan shows no trash collection areas beneath OHE lines.
- *reasoning:* Trash enclosure placement is not a site plan issue if receptacles are not positioned under overhead facilities. Requirement does not apply.

**run-3** — status=`not-verifiable`
- *observation:* Site plan shows general site layout and references trash collection notes, but specific trash receptacle or enclosure locations are not clearly marked or dimensioned on the drawings.
- *reasoning:* Applicability depends on trash enclosures being located beneath overhead lines. Without clear identification of these facilities on the plans, the item cannot be evaluated.

---

### EL-1.28 — `mixed`

> Water meters do not maintain minimum 7.5-foot horizontal sky-to-ground clearance from outside conductor of existing overhead electric service drops

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Water meters are shown on the utility plans (Sheets 19 and 21), but no dimension annotations show their location relative to overhead electric service-drop conductors.
- *reasoning:* Without dimension annotations showing clearance from water meter locations to overhead service-drop conductors, the minimum 7.5-foot clearance requirement cannot be verified.

**run-2** — status=`n/a`
- *observation:* Utility plan review (Sheet 21) shows water service tap locations but no overhead electric service drops or water meter locations in relation to OHE lines.
- *reasoning:* Water meter clearance from service drops is not evident as an issue on this project; requirement does not apply.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 21 shows electrical infrastructure (proposed underground service) but water meter locations are not clearly marked. Water utility plan (Sheet 19-20) would be the primary reference, but specific meter location clearance from overhead lines is not documented.
- *reasoning:* The 7.5-foot sky-to-ground clearance requirement applies to water meters near overhead electric service drops. Without documentation of meter locations and their distances from overhead service conductors, compliance cannot be verified.

---

### EL-1.30 — `mixed`

> Permanent foundations within 5 feet of property line do not allow necessary clearance space for electric facilities

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`pass`
- *observation:* The site plan shows building locations with measured setbacks of 27.8 to 86.2 feet from the property line where overhead lines run.
- *reasoning:* When buildings are positioned 27+ feet from the property line, they clearly maintain more than 5 feet of clearance space, satisfying the requirement that permanent foundations within 5 feet of property line allow necessary clearance space for electric facilities.

**run-2** — status=`not-verifiable`
- *observation:* Site plan shows all building setbacks exceed 18 feet from property lines; buildings are well clear of the 5-foot Electric Easement strips.
- *reasoning:* Foundations well exceed the 5-foot proximity threshold; requirement is satisfied. Detailed verification of ROW facility locations and required foundation clearance would be determined during building permit review.

**run-3** — status=`not-verifiable`
- *observation:* Site plan shows buildings and property boundaries but does not provide specific dimensions for buildings relative to the 5-foot setback threshold.
- *reasoning:* Applicability depends on structures being within 5 feet of property line. Without explicit dimensions showing this setback distance, determination cannot be made. The issue is the applicability gate cannot be clearly resolved.

---

### EL-1.39 — `mixed`

> Proposed development does not maintain required clearances from existing streetlights

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* The site plan does not explicitly identify existing streetlight pole locations in the adjacent right-of-way along Valley View Road; only general utility pole information from the existing survey is available.
- *reasoning:* Without explicit documentation of existing streetlight pole locations and dimension annotations showing proposed building/structure clearances from these poles, compliance cannot be verified.

**run-2** — status=`n/a`
- *observation:* Site plan shows no streetlight pole symbols positioned near building locations.
- *reasoning:* Building proximity to existing streetlights is not evident; requirement does not apply.

**run-3** — status=`not-verifiable`
- *observation:* Existing conditions survey shows utility pole symbols but does not differentiate streetlight poles. Site plan shows building locations relative to these poles at general plan-view distance but no specific dimension annotations.
- *reasoning:* Without clear identification of which poles are streetlights and specific clearance dimensions, verification cannot be completed.

---

### EL-1.9 — `mixed`

> Fences do not maintain minimum 7.5-foot horizontal sky-to-ground clearance from outside conductor of overhead electric facilities

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`fail`
- *observation:* Fence symbols (marked with 'X') are shown on the site plan along the property lines, including the western boundary along Valley View Road and the southern boundary where overhead electric lines run.
- *reasoning:* The property line fences depicted on the site plan are positioned at or along the property boundary where the existing overhead electric lines run. These fences do not appear to maintain the required 7.5-foot horizontal clearance from the overhead conductors.

**run-2** — status=`n/a`
- *observation:* Site plan and landscape plan show wooden privacy fences (H.6 symbol) as internal building separators, not structures relating to overhead utility clearances.
- *reasoning:* The requirement addresses fences subject to horizontal sky-to-ground clearance from utility conductors (e.g., fence posts, gates, wire fencing). Residential privacy fences at typical heights are not the subject of this utility clearance requirement.

**run-3** — status=`not-verifiable`
- *observation:* Site plan and landscape plan show fences marked along property boundaries, particularly visible as fence symbols (X marks) on Sheets 9 and 31. Overhead electric line is depicted on these sheets. No dimension annotations showing clearance from the outer conductor to fence locations are present.
- *reasoning:* The applicability gate is satisfied—fences are proposed and overhead electric facilities exist. However, clearance dimensions from the outer conductor (the actual electric wire, not pole center) to the fence are not documented. The 7.5-foot sky-to-ground clearance requirement cannot be verified without these dimensions, but they are also not clearly absen…

---

### EL-13.12 — `mixed`

> Transformer pads lack minimum 5-foot clearance from fire hydrants

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`measurement`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of site plan found one private fire hydrant location remote from transformer pads, with no hydrants adjacent to any transformer pad.
- *reasoning:* This requirement only applies when fire hydrants are present adjacent to transformer pads. No such proximity conditions exist on the site plan.

**run-2** — status=`pass`
- *observation:* Fire Protection Plan shows one private fire hydrant on the site. Transformer pad locations are in separate areas of the development.
- *reasoning:* The visible spatial separation between hydrant and transformer pad locations exceeds the 5-foot minimum clearance requirement.

**run-3** — status=`not-verifiable`
- *observation:* Fire protection plan shows one private fire hydrant location, but no dimensions relate this to transformer pad positions.
- *reasoning:* The specific distance between the fire hydrant and transformer pads cannot be determined from the plans provided.

---

### EL-13.19 — `mixed`

> Transformer pads lack minimum 15-foot clearance from fire lanes

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`generic`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of Sheet 10 (Fire Protection Plan) and overall site plan found no designated fire lanes adjacent to transformer pads.
- *reasoning:* This requirement only applies when fire lanes are designated adjacent to transformer pads. No such designations are shown on the plans.

**run-2** — status=`pass`
- *observation:* Fire Protection Plan shows fire lane routing. Transformer pad locations are positioned in utility service areas away from fire circulation routes.
- *reasoning:* The spatial separation between transformer pads and designated fire lanes exceeds the 15-foot minimum requirement.

**run-3** — status=`not-verifiable`
- *observation:* Fire protection plan (Sheet 10) shows fire lanes but does not depict transformer pad locations.
- *reasoning:* The distance between transformer pads and fire lanes cannot be determined without transformer symbols shown on the fire protection plan.

---

### EL-13.20 — `mixed`

> Transformer pads lack minimum 5-foot clearance from other transformer pads

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Electrical plan (Sheet 21) shows five discrete transformer pad locations spaced throughout the site with substantial separations between them.
- *reasoning:* All transformer pads are separated by distances greater than 5 feet, so this requirement is satisfied. No deficiency exists.

**run-2** — status=`pass`
- *observation:* Electrical plan shows five distinct transformer pad locations. Measured separations between pads range from approximately 15 feet to over 70 feet.
- *reasoning:* All transformer-to-transformer separations exceed the 5-foot minimum clearance requirement.

**run-3** — status=`not-verifiable`
- *observation:* Electrical plan shows five transformer pad locations but no dimensions are provided between adjacent pads.
- *reasoning:* Without specific distance callouts between transformer pads, compliance with 5-foot separation cannot be verified.

---

### EL-13.27 — `mixed`

> Transformer locations lack minimum 7.5-foot horizontal sky-to-ground clearance from overhead distribution line conductors (primary, neutral, and secondary), extending from ground to sky

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Electrical plan (Sheet 21) and Utility Tap Plan (Sheet 19) do not indicate the presence of overhead distribution conductors. Landscape plan references 'OHE' on the plan legend but this may refer to existing external overhead lines.
- *reasoning:* The requirement applies only when overhead distribution lines are present. The status cannot be definitively determined from the submitted plans without clarification on whether overhead service is planned or existing.

**run-2** — status=`pass`
- *observation:* Landscape Plan (Sheet 31) and Electrical Plan (Sheet 21) show underground electrical service routing with no overhead distribution infrastructure.
- *reasoning:* Without overhead distribution lines present, the vertical clearance requirement is not applicable to transformer pad locations.

**run-3** — status=`n/a`
- *observation:* Site plan and utility plan review shows underground utility service with no overhead distribution conductors shown on or adjacent to the property.
- *reasoning:* This requirement is conditionally applicable only when overhead distribution lines are present. Underground service is provided.

---

### EL-13.28 — `mixed`

> Transformer locations or proposed facilities lack minimum 15-foot radius clearance from overhead distribution primary and neutral conductors (measured from conductors, not pole centerline)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Electrical plan (Sheet 21) and utility plans do not explicitly show overhead distribution primary or neutral conductors. If overhead lines exist on adjacent property, they would be external to this site.
- *reasoning:* This requirement applies only when overhead distribution primary/neutral conductors are present on or immediately adjacent to the property. The submitted plans do not clearly document such presence.

**run-2** — status=`pass`
- *observation:* Electrical and utility plans show underground distribution service. No overhead conductors are visible on any sheet.
- *reasoning:* The applicability condition (overhead distribution conductors present) is not met.

**run-3** — status=`n/a`
- *observation:* Utility documentation indicates underground electric service throughout the site.
- *reasoning:* This requirement is conditionally applicable only when overhead distribution conductors are present. The project has underground electrical service.

---

### EL-13.39 — `mixed`

> Customer facilities (buildings, parking garages, light poles, signs, billboards, chimneys, antennas, tanks) installed under or over Austin Energy overhead distribution facilities

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Electrical and utility plans do not clearly identify overhead distribution conductors as present on this site. If overhead service exists, its location and spatial relationship to proposed site features would need to be confirmed.
- *reasoning:* This requirement applies only when overhead distribution facilities are present. The submitted plans do not clearly document whether overhead distribution serves this property.

**run-2** — status=`pass`
- *observation:* Site plan and electrical plan show no overhead distribution infrastructure on the property.
- *reasoning:* The applicability condition (overhead distribution facilities present) is not met.

**run-3** — status=`n/a`
- *observation:* Utility and site plans confirm underground electric service with no overhead distribution lines shown.
- *reasoning:* This requirement applies only when overhead distribution facilities are present. The project has underground electrical service.

---

### EL-13.9 — `mixed`

> Transformer pads lack minimum 20-foot horizontal/radial clearance from fire escapes or stairs serving as fire escapes (oil-filled equipment)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Electrical design plan (Sheet 21) and all supplementary documents do not specify whether transformers are oil-filled or dry-type. No ESPA or AE Design equipment specifications were provided.
- *reasoning:* This requirement is gated by equipment type - it only applies to oil-filled equipment. Without confirmation of equipment type from AE Design specifications, applicability cannot be determined.

**run-2** — status=`n/a`
- *observation:* Reviewed fire protection plan (Sheet 10) and site plan. No fire escapes or exterior stairs serving as fire escapes are located near transformer pads.
- *reasoning:* The applicability condition (fire escapes/stairs present) is not met.

**run-3** — status=`not-verifiable`
- *observation:* Fire protection plan (Sheet 10) does not depict transformer pads, and no fire escape locations are shown on sheets containing transformer pads.
- *reasoning:* Fire escape clearances apply specifically to oil-filled equipment, which is not identified on these plans. The requirement cannot be evaluated without knowing equipment type and fire escape proximity.

---

### EL-2.6 — `mixed`

> Trees proposed within 10 lateral feet of overhead electric utility pole

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`generic`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 31 shows overhead electric line ('-OHE-') but no pole symbols or locations marked. Sheet 21 depicts only underground electrical components without indicating pole positions.
- *reasoning:* Verification of the 10-foot pole clearance requirement requires knowing pole locations. Absence of explicit pole location documentation prevents verification.

**run-2** — status=`not-verifiable`
- *observation:* Existing conditions survey (Sheet 4) shows utility pole symbols in legend; landscape plan (Sheet 31) depicts OHE line but does not show pole locations or dimensions from poles to trees. Proposed trees shown near utility line but pole positions not clearly marked relative to tree symbols.
- *reasoning:* To verify EL-2.6, utility pole locations must be clearly identified on the landscape plan with dimensions to proposed trees. While poles exist (shown in survey legend), their exact positions and distances from proposed trees are not documented on the landscape plan.

**run-3** — status=`fail`
- *observation:* Vision analysis of the landscape plan identified a utility pole symbol at the southeast corner with guy wire, and multiple tree symbols (both smooth circles for proposed trees and irregular outlines for existing trees) positioned immediately adjacent to this pole, well within 10 feet based on the 1"=20' scale.
- *reasoning:* The requirement is a categorical prohibition: trees (any species, any size) are not permitted within 10 lateral feet of any overhead electric utility pole. The presence of tree symbols adjacent to the pole constitutes a clear violation of this requirement.

---

### EL-1.2 — `valid_other`

> Customer facilities do not maintain minimum 15-foot radial clearance from outside conductor of overhead distribution primary and neutral conductors

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`pass`
- *observation:* Customer facilities (buildings) are positioned 27.8 to 86.2 feet from overhead distribution lines based on site plan measurements.
- *reasoning:* The minimum 15-foot radial clearance requirement is satisfied by a wide margin when buildings are 27+ feet from the nearest overhead conductor.

**run-2** — status=`not-verifiable`
- *observation:* OHE lines shown on Site Plan and Landscape Plan but labeled only as '- OHE -' without voltage designation (12.47kV, 34.5kV, 69kV, etc.). No analysis provided of conductor types (primary, neutral, secondary) or facility classification.
- *reasoning:* 15-foot radial clearance requirement applies only to distribution primary and neutral conductors, not secondary or transmission lines. Without voltage/conductor type specification, compliance cannot be verified.

**run-3** — status=`pass`
- *observation:* Vision measurements confirmed all proposed buildings are minimum 30+ feet from overhead electric line(s) depicted on existing conditions survey and site plan.
- *reasoning:* The 15-foot radial clearance applies to distribution primary and neutral conductors. Buildings at 30+ feet exceed this requirement. Applicability confirmed and requirement met—no deficiency.

---

### EL-1.45 — `valid_other`

> Construction staging areas, equipment operation zones, and work platforms do not maintain minimum 10-foot radial clearance from energized overhead electric lines per OSHA and Texas law

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`fail`
- *observation:* The site plan does not depict a detailed construction logistics plan, construction staging area, or equipment operation zones. Overhead electric lines run along the western and southern property boundaries, directly adjacent to where construction staging and equipment operation would occur.
- *reasoning:* UCM § 1.10.2 requires construction staging areas, equipment laydown zones, and work platforms to maintain minimum 10-foot radial clearance from energized overhead electric lines. This safety requirement must be documented in a construction phasing plan, but no such plan is provided.

**run-2** — status=`not-verifiable`
- *observation:* Sheet index (Sheet 1) lists 39 sheets but no construction phasing, site logistics, or equipment staging plans are included in the reviewed sheet set.
- *reasoning:* 10-foot working clearance from energized overhead lines is an OSHA and construction phase requirement enforced separately from site plan approval. Site plan review cannot verify construction staging clearances without logistics documentation.

**run-3** — status=`fail`
- *observation:* Erosion control plan (Sheet 5) shows general site layout and construction access but does not provide a detailed construction staging/logistics plan showing construction equipment zones with 10-foot radial clearance buffer from overhead lines.
- *reasoning:* UCM § 1.10.2 and OSHA 1910.333 require 10-foot radial working clearance from energized overhead lines during construction. This is a construction-phase requirement distinct from permanent clearances. A construction logistics plan documenting this clearance is required but not provided.

---

### EL-1.6 — `valid_other`

> Buildings do not maintain minimum 7.5-foot horizontal sky-to-ground clearance and 15-foot radial clearance from overhead electric facilities in right-of-way adjacent to site

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`pass`
- *observation:* Buildings 1, 2, 7, and 8 are positioned 27.8 to 86.2 feet from the overhead electric lines that run along Valley View Road right-of-way.
- *reasoning:* The 7.5-foot horizontal and 15-foot radial clearances from facilities in the right-of-way are satisfied when buildings are positioned 27+ feet away from the overhead conductors running along the adjacent roadway.

**run-2** — status=`not-verifiable`
- *observation:* OHE lines shown along property boundaries with '5' Electric Easement' labels referencing county plat records (Vol. 69, Vol. 73). Site plan does not explicitly state whether these are existing public right-of-way facilities or private easements.
- *reasoning:* Building-to-OHE clearance is verified (EL-1.1), but applicability of this specific item requires confirmation that OHE facilities are in ROW and will remain or be relocated; ambiguity regarding facility ownership/status prevents full verification.

**run-3** — status=`pass`
- *observation:* Vision measurements of site plan confirmed buildings on western side (Buildings 1, 2, 8) are 85-96 feet from overhead electric line shown along Valley View Road. This line represents existing utility infrastructure in or adjacent to ROW.
- *reasoning:* UCM § 1.10.3 establishes permanent clearance requirements distinct from construction working clearances. Buildings at 85-96 feet exceed both the 7.5-foot sky-to-ground and 15-foot radial clearance envelopes. Permanent clearances are maintained—no deficiency.

---

### EL-13.7 — `valid_other`

> Transformer pads not located minimum 2 feet from back of sidewalks

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`measurement`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`pass`
- *observation:* Vision measurement on Sheet 9 measured 10.2 feet from the back edge of the sidewalk adjacent to the transformer pad west of Building 2.
- *reasoning:* The requirement specifies minimum 2 feet clearance from back of sidewalks. 10.2 feet exceeds this minimum, so the requirement is satisfied.

**run-2** — status=`pass`
- *observation:* Reviewed site plan showing site perimeter and internal layout. No sidewalks are shown immediately adjacent to transformer pad locations.
- *reasoning:* The applicability condition (sidewalks adjacent to pads) is not met. Transformer pads are in internal site areas, not at property boundaries with adjacent sidewalks.

**run-3** — status=`not-verifiable`
- *observation:* Site plans do not provide dimension callouts showing distances from transformer pad edges to any sidewalk edges.
- *reasoning:* While sidewalks exist on the site, the specific proximity relationship between sidewalk edges and transformer pads cannot be verified from the available dimensions.

---

### EL-13.13 — `valid_other_data_gap`

> Trees within 10 lateral feet of pad-mounted equipment are not identified as utility-compatible species per ECM Appendix F, or trees within 15 lateral feet of overhead electric distribution conductors are not utility-compatible

- **majority vision_check:** `3-way-tie`  ·  **per-run intent:** run-1=`measurement`, run-2=`generic`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`pass`
- *observation:* Vision measurement on Sheet 31 (Landscape Plan) identified a tree labeled 'M' (mitigation tree) 21.5 feet from nearest transformer pad. Landscape plan list (Sheet 35) specifies Cedar Elm and Live Oak as shade trees, with both being ECM Appendix F utility-compatible species.
- *reasoning:* The 10-foot proximity threshold that would trigger utility-compatible species requirements is not met - the nearest tree is 21.5 feet away. Therefore, this requirement is satisfied even without detailed species verification.

**run-2** — status=`not-verifiable`
- *observation:* Landscape plan shows trees with symbol designations but no species names. Transformer pads are not marked/labeled on landscape sheet, preventing proximity analysis. Tree species and utility compatibility information is not on Sheet 31.
- *reasoning:* Without tree species identification linked to transformer locations, and with transformer pad locations not marked on the landscape sheet, utility compatibility cannot be verified. The plant schedule/tree list required for this verification is on a different sheet not yet cross-referenced.

**run-3** — status=`not-verifiable`
- *observation:* Landscape plan (Sheet 31) shows vegetation and tree locations, but transformer pad symbols are not depicted on this sheet.
- *reasoning:* Without transformer pad locations shown on the landscape plan, proximity relationships between trees and transformers cannot be evaluated.

---

### EL-13.14 — `valid_other_data_gap`

> Shrubs or low-lying vegetation lack minimum 10 lateral feet clearance from transformer access door side, or lack minimum 5 lateral feet clearance from other sides (non-access door)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Landscape plan (Sheet 31) shows shrub symbols throughout the site. Shrub list (Sheet 35) specifies Texas Sage, Dwarf Wax Myrtle, Dwarf Palmetto, and Muhly species with spacing requirements (3' O.C. and 'SEE PLANS'). Exact positioning relative to transformer access door sides cannot be precisely determined from plan view.
- *reasoning:* While the plant species appear appropriate for utility clearance, the specific positioning of shrubs relative to the 10-foot (access door side) and 5-foot (other sides) clearance requirements cannot be verified without detailed measurement or additional documentation.

**run-2** — status=`not-verifiable`
- *observation:* Landscape plan shows various plantings but transformer pads are not identified or marked with access door orientation.
- *reasoning:* Without transformer pad locations and access door orientation marked on the landscape plan, and without access door orientation specified anywhere on the electrical plan, the required 10-foot clearance from access door side and 5-foot clearance from other sides cannot be verified.

**run-3** — status=`not-verifiable`
- *observation:* Transformer pads are not depicted on the landscape plan (Sheet 31), preventing verification of vegetation clearances.
- *reasoning:* Cross-referencing between vegetation locations and transformer access door orientation requires transformer symbols on the landscape plan, which are absent.

---

### EL-2.3 — `valid_other_data_gap`

> Large trees (mature height 40+ feet per ECM Appendix F) proposed within 25 lateral feet of overhead electric distribution conductor or equipment

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`generic`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`fail`
- *observation:* Vision analysis of Sheet 31 confirmed trees labeled 'M' and one unlabeled large tree symbol within 5-25 feet of the '-OHE-' line in the southern landscaped area. Sheet 35 plant schedule specifies 10 Cedar Elm and 2 Live Oak, both containerized at 100 gal (indicating large specimens). Standard horticultural data indicates Cedar Elm and Live Oak reach 40-50…
- *reasoning:* Large trees (≥40 ft mature height) are prohibited within 25 feet of distribution conductors per UCM § 1.10.10.4. Cedar Elm and Live Oak are known to reach ≥40 feet at maturity. The landscape plan's functional labels (M, SY, etc.) cannot be definitively linked to specific species without additional cross-reference data, but the presence of these species in…

**run-2** — status=`fail`
- *observation:* Plant schedule (Sheet 35) lists Cedar Elm at 100-gallon size (mature height ~40-50 ft) and Live Oak at 100-gallon size (mature height ~40-80 ft) positioned near OHE line. Landscape plan (Sheet 31) shows these trees (marked M for mitigation) directly along OHE line. No clearance dimensions provided.
- *reasoning:* Cedar Elm and Live Oak are species with documented mature heights ≥40 feet, meeting the ECM large tree definition. The landscape plan shows them positioned on or immediately adjacent to the OHE line without distance callouts. At 0-5 feet from the distribution line, they violate the 25-foot minimum clearance for large trees. Large trees should be different…

**run-3** — status=`not-verifiable`
- *observation:* The plant schedule on Sheet 35 provides minimum installation heights in the 'MIN. SPEC.' column (e.g., '16' HT. MINIMUM') but does not provide mature height specifications. Cedar Elm and Live Oak are species commonly reaching 40+ feet at maturity, but the plan does not document these mature heights.
- *reasoning:* The requirement prohibits trees with mature height ≥40 feet from being planted within 25 feet of distribution conductors per UCM § 1.10.10.4. The distinction between installation height and mature height is critical; minimum container-grown specification (16' at planting) does not address eventual mature size. Without documented mature heights in the plan…

---

### EL-1.40 — `valid_no_feature`

> Down guy wires conflicting with accessible paths, driveways, or other site features not resolved through pole relocation or conversion to self-supporting steel poles

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`not-verifiable`
- *observation:* The site plan and existing conditions survey show utility poles but do not document the presence or location of down guy wires (support cables from poles to ground anchors) that may conflict with proposed accessible paths, driveways, or other site features.
- *reasoning:* Down guys from utility poles are frequently omitted from site plans, as noted in the grouping guide. Without explicit documentation of down guy locations and conflicts with proposed site features, compliance cannot be verified.

**run-2** — status=`not-verifiable`
- *observation:* Site plan shows pole symbols at property boundaries but does not include down guy wire routing or ground anchor locations. Accessible path network is shown but relationship to potential guy anchors is not documented.
- *reasoning:* Down guy conflicts cannot be verified without explicit depiction of guy anchor locations. Engineer must either: (1) verify no down guys exist on poles shown, or (2) depict guy wire and anchor locations and confirm accessible path avoidance, or (3) note pole relocation or conversion to self-supporting design to eliminate guy conflicts.

**run-3** — status=`not-verifiable`
- *observation:* Existing conditions survey (Sheet 4) shows utility poles with legend symbols for guy wires. However, the specific locations of down guy anchors where guy wires attach to ground are not clearly marked on the plan. Proposed accessible paths and driveway locations are shown on the site plan.
- *reasoning:* Down guy wires (support cables from distribution poles to ground anchors) may conflict with accessible paths or driveways. The survey legend indicates guy wires are documented, but specific ground anchor locations are not clearly depicted, making conflict determination difficult. Additionally, the grouping text notes that electric utility infrastructure i…

---

### EL-2.1 — `valid_no_feature`

> Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment

- **majority vision_check:** `generic`  ·  **per-run intent:** run-1=`generic`, run-2=`generic`, run-3=`measurement`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`not-verifiable`
- *observation:* Sheet 31 landscape plan shows overhead electric line labeled '-OHE-' along southern boundary with tree symbols nearby, but uses only functional labels (M, SY, PL, P) without species identification. Sheet 35 plant schedule lists species separately without location cross-references.
- *reasoning:* The requirement to verify utility-compatibility depends on knowing species identity on the landscape plan itself or having clear spatial cross-references. Functional labels alone (M = mitigation tree) cannot be evaluated against utility-compatibility standards without species data. The separation of species information from the landscape plan constitutes …

**run-2** — status=`not-verifiable`
- *observation:* Landscape plan (Sheet 31) depicts OHE line with adjacent tree symbols; plant schedule (Sheet 35) lists 20 proposed trees (Cedar Elm, Live Oak, Texas Mountain Laurel, Mexican Redbud) but does not cite ECM Appendix F or mark any as utility-compatible. No clearance dimensions or measurements are provided on landscape plan.
- *reasoning:* The deficiency cannot be confirmed as pass because no explicit verification of utility-compatible status appears on plans or in plant schedule. The deficiency cannot be confirmed as fail because the tree species are shown but their compliance category is not documented. This is a documentation gap rather than confirmable non-compliance.

**run-3** — status=`not-verifiable`
- *observation:* Vision analysis of the landscape plan identified multiple trees within 15 feet of the OHE line at the southern boundary (0.7 to 11 feet from conductor). The plant schedule identifies Live Oak, Cedar Elm, Texas Mountain Laurel, and Mexican Redbud by name and symbol, but mitigation trees ('M' symbols) visible on the landscape plan are not linked to any spec…
- *reasoning:* The regulatory requirement specifies that only utility-compatible trees (per ECM Appendix F UC designation) are permitted within 15 feet of distribution conductors. The plant schedule lacks species identification for mitigation trees, and the ECM Appendix F utility-compatible status of the shade and ornamental trees is not documented on the plans. Without…

---

### EL-1.15 — `valid_not_applicable`

> Retaining walls adjacent to Austin Energy substation walls do not maintain minimum 5-foot separation to allow for grounding grid extension, wall inspection, wall replacement, and proper drainage

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`n/a`
- *observation:* No Austin Energy substation walls or substation property boundaries are identified on the site plan or in the project documentation.
- *reasoning:* This requirement applies only when retaining walls are proposed adjacent to Austin Energy substation property. Since no substation is identified, the requirement does not apply.

**run-2** — status=`n/a`
- *observation:* Site plan review found no substation facilities on or adjacent to property boundaries.
- *reasoning:* 5-foot separation from substation walls is required only when retaining walls are proposed adjacent to Austin Energy substation property. No such condition exists.

**run-3** — status=`not-verifiable`
- *observation:* Review of site plan and grading plan shows no clearly labeled Austin Energy substation facility on or adjacent to the property. The facts.md mentions electric easements but does not identify a substation property.
- *reasoning:* Applicability requires the presence of Austin Energy substation property adjacent to the site. No such facility is identified on the submitted plans, so the item cannot be evaluated.

---

### EL-1.24 — `valid_not_applicable`

> Streetlight poles located under overhead electric lines

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* The site plan notes require all exterior lighting to be 'full cut-off and fully shielded' and located on buildings. No standalone streetlight poles are depicted in the site plan or noted as proposed.
- *reasoning:* This requirement applies only when new standalone streetlight poles are proposed. The site plan shows lighting mounted on buildings, not independent pole-mounted fixtures, so the requirement does not apply.

**run-2** — status=`n/a`
- *observation:* Site plan notes lighting is located on building in compliance with Subchapter E 2.5; no separate streetlight pole locations are shown.
- *reasoning:* Streetlight pole placement beneath overhead lines is not applicable; no such poles are proposed.

**run-3** — status=`not-verifiable`
- *observation:* Landscape plan (Sheet 31) indicates 'light poles' in the legend but specific new streetlight locations are not clearly differentiated or dimensioned on the drawings.
- *reasoning:* Without clear identification of new streetlight pole locations and their distances from overhead electric lines, compliance cannot be verified. The submittals do not provide sufficient clarity on this point.

---

### EL-1.35 — `valid_not_applicable`

> New power poles for underground service located less than 20 feet from existing power poles

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* The site plan shows underground electric service distribution (Sheet 21 depicts transformers and pull boxes for underground infrastructure), but no new standalone power poles for underground service conversion are depicted.
- *reasoning:* This requirement applies only when new power poles are proposed for underground service conversion. The electrical design plan shows underground service as the primary design approach, not conversion with new poles.

**run-2** — status=`n/a`
- *observation:* Electrical design plan shows underground distribution; no new pole locations are shown.
- *reasoning:* Requirement applies only to new poles for underground service conversion. No such poles are proposed.

**run-3** — status=`not-verifiable`
- *observation:* Sheet 21 (Electrical Design) shows underground electric service proposed for the development. No new poles are identified for service conversion.
- *reasoning:* This requirement applies only 'when new power poles are proposed for underground service conversion and existing power poles will remain.' No new poles are proposed in this project. Item is not applicable.

---

### EL-1.36 — `valid_not_applicable`

> Decorative lighting proposed under existing overhead electric lines does not meet clearance requirements or is not relocated

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* The site plan requires all exterior lighting to be 'full cut-off and fully shielded' in compliance with Land Development Code Subchapter E 2.5. The lighting is specified to be mounted on buildings and reviewed during building plan review.
- *reasoning:* While decorative site lighting may be included in landscape features, all lighting is subject to full cut-off and shielding requirements. This specification effectively addresses clearance concerns. Decorative lighting specifically beneath overhead lines is not identified as a distinct element.

**run-2** — status=`n/a`
- *observation:* Site plan notes (Sheet 9) indicate lighting compliance and building-mounted light fixtures per Subchapter E 2.5.
- *reasoning:* Decorative lighting beneath overhead lines is not proposed; requirement does not apply.

**run-3** — status=`not-verifiable`
- *observation:* Landscape plan shows site features and references lighting notes (full cut-off, fully shielded per requirements) but specific decorative light fixture locations and their clearance from overhead lines are not documented.
- *reasoning:* Without clear identification of decorative light locations beneath overhead lines and clearance dimensions, compliance cannot be verified. The item cannot be definitively evaluated from submitted plans.

---

### EL-1.4 — `valid_not_applicable`

> Gas pump canopies do not maintain required clearances from overhead electric lines

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* No gas pump canopies or fueling infrastructure are depicted anywhere in the site plan set.
- *reasoning:* This requirement applies only when gas pump canopies are part of the proposed development. Since no such facilities are shown, the requirement does not apply.

**run-2** — status=`n/a`
- *observation:* Site plan shows multi-family townhome use with no commercial or fueling facilities; site plan notes, schedules, and legend review found no gas pump canopy features.
- *reasoning:* Gas pump canopies are not a proposed feature; requirement is not applicable.

**run-3** — status=`not-verifiable`
- *observation:* Review of site plan (Sheet 9) shows residential townhomes with parking (garage and surface lots) but no gas pump canopies are indicated on the plan.
- *reasoning:* Under the applicability gate principle, if gas pump canopies are not proposed, this item is not applicable. From available plans, no gas pump canopies are shown or proposed. The deficiency cannot be verified because the triggering feature (proposed gas pump) is absent.

---

### EL-13.16 — `valid_not_applicable`

> Transformer pads lack minimum 5-foot clearance from dumpsters

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of site plan found no dumpster or trash collection areas positioned adjacent to any transformer pad.
- *reasoning:* This requirement only applies when dumpsters are present adjacent to transformer pads. No such features are shown on the site plan.

**run-2** — status=`pass`
- *observation:* Site plan shows dumpster locations in separate areas from transformer pad locations.
- *reasoning:* The spatial separation between dumpster enclosures and transformer pads exceeds the 5-foot minimum requirement.

**run-3** — status=`n/a`
- *observation:* Site plan review shows trash collection areas, but no dumpster or trash enclosure is positioned adjacent to transformer pads.
- *reasoning:* This requirement is conditionally applicable only when dumpsters are present adjacent to transformers. No such condition exists.

---

### EL-13.17 — `valid_not_applicable`

> Transformer pads lack minimum 5-foot clearance from bike racks

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of site plan and Sheet 22 (bicycle parking details) found no bike racks positioned adjacent to transformer pads.
- *reasoning:* This requirement only applies when bike racks are present adjacent to transformer pads. No such proximity exists on the site plan.

**run-2** — status=`pass`
- *observation:* Site plan shows bicycle parking in building areas. Transformer pads are in separate utility areas of the site.
- *reasoning:* Spatial separation between bicycle parking facilities and transformer pads exceeds the 5-foot minimum.

**run-3** — status=`n/a`
- *observation:* Bicycle parking is shown on the site plan within building garages, but no bike racks are positioned adjacent to transformer pads.
- *reasoning:* This requirement is conditionally applicable only when bike racks are adjacent to transformers. No such condition exists.

---

### EL-13.18 — `valid_not_applicable`

> Transformer pads lack minimum 5-foot clearance from light poles

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of site plan found no light pole callouts positioned adjacent to transformer pads.
- *reasoning:* This requirement only applies when light poles are adjacent to transformer pads. No such features are shown adjacent to transformer pad locations.

**run-2** — status=`not-verifiable`
- *observation:* Site plan and landscape plan show site layout but light pole positions are not explicitly cross-referenced with transformer pad locations.
- *reasoning:* Without explicit identification of light pole locations relative to transformer pads, the 5-foot clearance requirement cannot be verified.

**run-3** — status=`n/a`
- *observation:* Site plan shows lighting locations but no light poles are positioned adjacent to transformer pads.
- *reasoning:* This requirement is conditionally applicable only when light poles are adjacent to transformers. No such condition exists.

---

### EL-13.2 — `valid_not_applicable`

> Transformer pads lack minimum 5-foot clearance from retaining walls

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`measurement`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Vision check of Sheet 9 (Site Plan) confirmed no retaining walls are located adjacent to or near any of the five transformer pads shown.
- *reasoning:* The requirement only applies when retaining walls are present adjacent to transformer pads. Since no retaining walls are adjacent to transformer pads, this item is not applicable.

**run-2** — status=`n/a`
- *observation:* Reviewed site plan sheets showing building layout, grading plan, and electrical plan. No retaining walls are positioned adjacent to any transformer pad.
- *reasoning:* The applicability condition (retaining walls present and adjacent to pads) is not met. This item is not applicable to this project.

**run-3** — status=`n/a`
- *observation:* Examination of site plan (Sheet 9) and grading plan (Sheet 11) shows retaining walls located around site perimeter and pond, but none adjacent to transformer pad locations.
- *reasoning:* The item is conditionally applicable only when retaining walls are present adjacent to transformer pads. No such proximity exists on this project.

---

### EL-13.3 — `valid_not_applicable`

> Transformer pads lack required clearance from fences and gates - 5 feet for sides with operators/controls, 3 feet for sides without operators/controls (from removable ventilated fences)

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of site plan and electrical plan found no fence or gate callouts immediately adjacent to any transformer pad.
- *reasoning:* This requirement only applies when fences or gates are adjacent to transformer pads. Site plan shows no such features adjacent to transformer pads.

**run-2** — status=`pass`
- *observation:* Examined site plan and electrical plan to identify fence locations relative to transformer pads. Fences exist on site but are not positioned directly adjacent to any transformer pad.
- *reasoning:* While fences are present on the site, they do not appear to be located at the minimum clearance distances from any transformer pad, suggesting adequate separation or that the applicability condition is not triggered.

**run-3** — status=`n/a`
- *observation:* Site plan review shows no fence lines or gates in proximity to any transformer pad locations.
- *reasoning:* This requirement is conditionally applicable only when fences/gates are adjacent to transformer pads. No such condition exists on this project.

---

### EL-13.8 — `valid_not_applicable`

> Transformer pads lack required clearance from stairwells serving as fire exits

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-only`)

**run-1** — status=`n/a`
- *observation:* Review of site plan found no fire exit stairwells positioned adjacent to any transformer pad.
- *reasoning:* This requirement only applies when stairwells serving as fire exits are present adjacent to transformer pads. No such features are shown on the plans.

**run-2** — status=`n/a`
- *observation:* Reviewed site plan and building floor plans. No external stairwells are positioned adjacent to any transformer pad.
- *reasoning:* The applicability condition (stairwells adjacent to transformer) is not met.

**run-3** — status=`n/a`
- *observation:* Building floor plans and fire protection plan show no stairwells positioned adjacent to transformer pad locations.
- *reasoning:* This requirement is conditionally applicable only when stairwells are present adjacent to transformers. No such condition exists on this project.

---

### EL-2.2 — `valid_not_applicable`

> Non-utility-compatible trees proposed within 50 lateral feet of overhead electric transmission conductor or equipment

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`generic`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`n/a`
- *observation:* Sheet 31 shows '-OHE-' (overhead electric) line with no indication of transmission voltage class. Facts.md lists easements but none are described as transmission easements; no transmission line poles or structures visible on site plans.
- *reasoning:* Transmission facilities have voltage ≥60kV and are typically marked explicitly with transmission designation, larger pole structures, and dedicated easements. The present facility appears to be distribution based on typical site plan conventions and facts.md documentation. Without evidence of transmission infrastructure, this requirement is not applicable.

**run-2** — status=`n/a`
- *observation:* Grading plan (Sheet 11) shows only 5-foot electric easements; facts.md lists no transmission easement; vision check of Sheet 11 found no transmission lines or structures labeled. General Notes contain transmission requirements but as apparent boilerplate.
- *reasoning:* For EL-2.2 to be applicable, transmission facilities must be present or proposed. The evidence indicates distribution-only infrastructure (narrow easements, no transmission structures shown). Therefore, this item is not applicable.

**run-3** — status=`n/a`
- *observation:* Vision analysis and document review identified only 'OHE' (Overhead Electric) line marking on plans, consistent with distribution voltage (typically 12.47kV or 34.5kV). Facts.md identified 5-foot electric easements (plat-dedicated), which are standard for distribution. No transmission easement plat notes or transmission-voltage labeling were found.
- *reasoning:* The applicability gate principle requires first determining whether the triggering condition exists. Transmission lines are characterized by voltage ≥60kV, dedicated easements, larger structures, and plat notation. The absence of these indicators, combined with the presence of distribution-voltage markings and smaller easements, provides strong evidence t…

---

### EL-2.4 — `valid_not_applicable`

> Large trees (mature height 40+ feet per ECM Appendix F) proposed within 50 lateral feet of overhead electric transmission conductor or equipment

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`none`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`n/a`
- *observation:* No transmission-class infrastructure identified in facts.md or on site plans; only distribution line ('-OHE-') is depicted.
- *reasoning:* Transmission requirement is not applicable when transmission infrastructure is absent.

**run-2** — status=`n/a`
- *observation:* Grading plan and site documentation show distribution easements only; no transmission structures, lines, or easements depicted.
- *reasoning:* This item applies only when transmission facilities are present. No transmission infrastructure is shown on plans.

**run-3** — status=`n/a`
- *observation:* Same observation as EL-2.2: only distribution-voltage infrastructure is documented on the plans.
- *reasoning:* The applicability gate requires presence of transmission facilities. No transmission lines have been identified.

---

### EL-2.5 — `valid_not_applicable`

> Trees (any species) proposed within transmission easement boundaries

- **majority vision_check:** `none`  ·  **per-run intent:** run-1=`none`, run-2=`generic`, run-3=`none`
- **expected:** `expected_specialist = measure-distance` (`subClassification=distance-plus`)

**run-1** — status=`n/a`
- *observation:* Facts.md lists all recorded easements affecting the property; none are transmission easements. No transmission lines or easements shown on site plans.
- *reasoning:* Transmission easement requirement is triggered only when transmission easements exist. No such easement is documented.

**run-2** — status=`n/a`
- *observation:* Grading plan shows 5-foot electric easements only; facts.md lists no transmission easement in property records; vision check found no transmission easement labeled.
- *reasoning:* This requirement applies only when a transmission easement exists. No transmission easement is documented as present on this site.

**run-3** — status=`n/a`
- *observation:* Grading plan (Sheet 11) shows drainage easements, wastewater easements, electric easements, and greenbelt easement, but no transmission easement. Facts.md documents 5-foot electric easements (plat-dedicated), inconsistent with transmission facility scale.
- *reasoning:* The applicability gate requires presence of transmission easement. No transmission easement has been identified on the submitted plans.

---
