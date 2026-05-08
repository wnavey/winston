# vision-check call inspector — el-md-exp / var-2

**runLabel:** `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_3`
**workflow_runs.id:** `f66d1589-616f-4830-ae0d-c02d450a3265`
**review id:** `bb326fd5-6b1d-4fb7-988a-754656dc768c`
**Inngest event:** `01KR3VNSV2V2PVAKCQ8DGMX39D`
**Submission:** Valley View Townhomes v1
**Guide:** el-md-exp
**enabledVisionSpecialists:** `generic-vision,measure-distance`
**Wall-clock:** ~15 min

## Why this report exists

The measure-distance debug viewer can't render this run because every measurement-routed dispatch fell back to generic via `measurement_arg_construction_not_implemented` (the conductor's measurement arg-construction is deferred). No `measure-distance-calls/` directory exists. The actual Gemini-vision prompt that the dispatched-to-generic call sent isn't logged either (standalone vision tool prompt-traceability gap).

What we DO have, and what this report surfaces: each `vision_check` call's per-call `metadata.json` records (a) the agent's high-level question, (b) the classifier's intent + reasoning, and (c) the dispatch outcome (with fallback reason).

**Total calls:** 56  ·  **Unique items invoked:** 31

## Distribution by classifier intent

| Intent | Calls | Unique items |
|---|---:|---:|
| `measurement` | 16 | 12 |
| `drawing_inspect` | 0 | 0 |
| `generic` | 40 | 25 |

(With `enabledVisionSpecialists='generic-vision,measure-distance'`, drawing_inspect is removed from the classifier's prompt, so the classifier should never pick it. Confirmed: 0 calls.)

## Per-call detail

### Classifier intent: `measurement` (16 calls)

#### `20260508T131708004Z-xb7z`

- **Item:** `EL-13.1` — expected_specialist=measure-distance
- **Sheet:** 21
- **Agent question:** Where are the transformer pads shown on this electrical plan, and what are the distances from transformer pads to the nearest building structures?
- **Checklist text:** Transformer pads lack minimum 5-foot clearance from buildings, structures, and building foundations
- **Classifier reasoning:** Although the agent question begins with a presence/location inquiry ('where are the transformer pads'), the primary and substantive part of the question asks for 'distances from transformer pads to the nearest building structures,' which is a direct clearance measurement request aligned with the 5-foot minimum clearance requirement.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131711370Z-4ca2`

- **Item:** `EL-13.1` — expected_specialist=measure-distance
- **Sheet:** 21
- **Agent question:** Where are the transformer pads located on this electrical plan, and what are the measured clearances from nearby buildings and structures? List the location of each transformer pad and its distance to the nearest building or structure.
- **Checklist text:** Transformer pads lack minimum 5-foot clearance from buildings, structures, and building foundations
- **Classifier reasoning:** The agent question explicitly requests measured clearances ('measured clearances', 'distance to the nearest building'), which is the core compliance check. Although the question begins with a location/presence component, the primary ask is quantitative distance measurement between transformer pads and buildings—directly aligned with the 5-foot clearance requirement.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131718613Z-didx`

- **Item:** `EL-13.1` — expected_specialist=measure-distance
- **Sheet:** 21
- **Agent question:** Are there transformer pads or electrical equipment pads shown on this site plan? If yes, how many are shown, where are they located on the site, what are their approximate dimensions, and what is their distance/clearance from the nearest building or structure?
- **Checklist text:** Transformer pads lack minimum 5-foot clearance from buildings, structures, and building foundations
- **Classifier reasoning:** Although the agent question begins with a presence check, it culminates in a clearance measurement request ('what is their distance/clearance from the nearest building or structure?'), which is the core compliance question. The agent is asking for the actual clearance distance that must be verified against the 5-foot minimum requirement.
- **Confidence:** 0.92
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131731676Z-nkj0`

- **Item:** `EL-2.1` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Are any trees shown on the landscape plan positioned within 15 feet of overhead electric distribution lines or poles? What is the distance from the tree symbols to the labeled overhead electric (OHE) infrastructure?
- **Checklist text:** Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment
- **Classifier reasoning:** The agent question explicitly asks for distance measurement ('What is the distance from the tree symbols to the labeled overhead electric infrastructure?'), which is the core compliance check for the 15-foot lateral clearance requirement. Although the question begins with a presence check, the primary ask is quantitative distance verification.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131742974Z-lm1s`

- **Item:** `EL-2.3` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Looking at the landscape plan, estimate the approximate lateral distance from the overhead electric (OHE) line along the southern property boundary to the nearest proposed trees shown on the plan. Which tree species are closest to the OHE line?
- **Checklist text:** Large trees (mature height 40+ feet per ECM Appendix F) proposed within 25 lateral feet of overhead electric distribution conductor or equipment
- **Classifier reasoning:** The agent is asking for a lateral distance measurement from the OHE line to the nearest proposed trees, which directly addresses the 25-foot clearance requirement. Although the agent also asks for tree species identification, the primary question is a distance/clearance measurement between two physical features (OHE conductor and trees).
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131749647Z-f2rw`

- **Item:** `EL-1.1` — expected_specialist=measure-distance
- **Sheet:** 9
- **Agent question:** Are overhead electric conductors shown on the site plan, and if so, what clearance dimensions are labeled from the outside conductor to the nearest building faces? Identify specific buildings and the clearance dimensions in feet and inches.
- **Checklist text:** Buildings and permanent structures do not maintain minimum 7 feet 6 inches horizontal sky-to-ground clearance from overhead electric conductors
- **Classifier reasoning:** The agent is asking for specific clearance dimensions between overhead electric conductors and building faces, which directly addresses the requirement's 7'6" horizontal clearance compliance check. Although the question begins with a presence check, the primary ask is for labeled clearance measurements and their values.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131759773Z-rp3v`

- **Item:** `EL-1.1` — expected_specialist=measure-distance
- **Sheet:** 9
- **Agent question:** What is the distance between the building footprints (especially Buildings 1 and 2 on the west side) and the overhead electric lines shown running along Valley View Road on the western property boundary?
- **Checklist text:** Buildings and permanent structures do not maintain minimum 7 feet 6 inches horizontal sky-to-ground clearance from overhead electric conductors
- **Classifier reasoning:** The agent is directly asking for a distance measurement between specific building footprints and overhead electric lines to verify compliance with the 7'6" clearance requirement. This is a clearance measurement question, not a presence or discovery check.
- **Confidence:** 0.98
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131802912Z-5hka`

- **Item:** `EL-13.10` — expected_specialist=measure-distance
- **Sheet:** 21
- **Agent question:** For each of the four transformer pads on this plan, which side of the transformer pad is the access door facing, and what is the horizontal distance from that access door side to the nearest building or structure? Provide measurements for all four transformer pads.
- **Checklist text:** Transformer pad hot-stick use area (access door side) lacks minimum 10-foot clearance to open area or adjacent building/structure
- **Classifier reasoning:** The agent is asking for specific horizontal distance measurements from transformer pad access doors to nearby buildings/structures across multiple pads. This directly addresses the 10-foot clearance requirement and requires plan-view distance measurement between physical features.
- **Confidence:** 0.98
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131852687Z-8bpi`

- **Item:** `EL-1.9` — expected_specialist=measure-distance
- **Sheet:** 9
- **Agent question:** Are there any fences shown on the site plan? If so, what is their location and distance from the overhead electric lines (OHE) shown on the western and northern boundaries?
- **Checklist text:** Fences do not maintain minimum 7.5-foot horizontal sky-to-ground clearance from outside conductor of overhead electric facilities
- **Classifier reasoning:** The agent question explicitly asks for distance measurement from fences to overhead electric lines, which directly addresses the 7.5-foot clearance requirement. Although the question begins with a presence check, the primary ask is quantitative (distance/clearance), making measurement the appropriate routing.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131858389Z-8m4n`

- **Item:** `EL-13.13` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Are there any trees shown on the landscape plan within 10 feet of any of the five transformer pads? If so, identify the location and type of each tree near the transformers.
- **Checklist text:** Trees within 10 lateral feet of pad-mounted equipment are not identified as utility-compatible species per ECM Appendix F, or trees within 15 lateral feet of overhead electric distribution conductors …
- **Classifier reasoning:** The agent is asking for identification of trees within a specific distance threshold (10 feet) of transformer pads, which requires measuring lateral distances between physical features to determine compliance with the clearance requirement.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131910933Z-n5cp`

- **Item:** `EL-2.14` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** Using the scale provided (1"=20'), measure the approximate lateral distance from the centers of the three "M" (mitigation) trees near the bottom of the landscape plan to the OHE line. What are these distances?
- **Checklist text:** Trees not shown on landscape plan in relation to overhead electric facilities, preventing clearance verification
- **Classifier reasoning:** The agent is asking for specific distance measurements between tree centers and the OHE line using the plan scale, which is a direct clearance/distance measurement task, even though the checklist requirement frames the problem as trees not being shown.
- **Confidence:** 0.98
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T131945849Z-i50a`

- **Item:** `EL-2.1` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Looking at the landscape plan, are the three "M" trees positioned NORTH of the OHE line (meaning they are inside the property boundary on the site being developed), or are they positioned on or south of the OHE line? How far north (measured from the OHE line) are these trees located?
- **Checklist text:** Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment
- **Classifier reasoning:** The agent is asking for a specific distance measurement ('How far north are these trees located?') from the OHE line to determine if trees fall within the 15-foot lateral clearance requirement. Although the question begins with a directional presence check (north vs. south of OHE), the primary ask is quantitative distance measurement, which is the core compliance verification needed.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T132007691Z-lfh1`

- **Item:** `EL-1.37` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Identify all trees shown on the landscape plan within 50 feet of the overhead electric lines. For each tree, specify: (1) lateral distance from the line in feet, (2) tree species if labeled, and (3) whether species appear to be utility-compatible (generally mature height ≤20 feet, such as live oaks or other UC-marked species).
- **Checklist text:** Trees proposed within 10 lateral feet of overhead distribution conductors or 50 lateral feet of overhead transmission conductors are not from Utility Compatible Shade Trees list, or site grading does …
- **Classifier reasoning:** The agent is asking for lateral distance measurements from trees to overhead electric lines (the core compliance question), combined with species identification. The distance measurement is the primary task and determines compliance; species verification is secondary context. This is a measurement problem.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T132034627Z-m79m`

- **Item:** `EL-13.14` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** On the landscape plan, are any trees, shrubs, or groundcover plantings shown within 10 feet of any of the five transformer pads? Which transformer pads have vegetation nearby, and what are the approximate distances?
- **Checklist text:** Shrubs or low-lying vegetation lack minimum 10 lateral feet clearance from transformer access door side, or lack minimum 5 lateral feet clearance from other sides (non-access door)
- **Classifier reasoning:** The agent is asking for specific distance measurements between vegetation and transformer pads ('what are the approximate distances?'), which directly addresses the clearance requirement's quantitative thresholds (10 feet vs. 5 feet). Although the question begins with a presence check, the core ask is measurement-based.
- **Confidence:** 0.92
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T132047933Z-8pf8`

- **Item:** `EL-1.20` — expected_specialist=none
- **Sheet:** 11
- **Agent question:** Are there any cross-section or profile views that show vertical relationships between finished driveway/road elevations and overhead transmission line elevations with labeled clearance dimensions? If transmission line poles are shown, what are the heights of the structures and the clearances to grade?
- **Checklist text:** Final road and driveway grades do not maintain minimum 30-foot vertical clearance from electric transmission lines to ground surface
- **Classifier reasoning:** The agent is asking for vertical clearance dimensions between finished grades and transmission line elevations—this is a direct measurement question about the 30-foot vertical clearance requirement, not a preliminary presence or sheet-discovery check.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

#### `20260508T132116331Z-15ps`

- **Item:** `EL-13.21` — expected_specialist=none
- **Sheet:** 21
- **Agent question:** Looking at the electrical plan (Sheet 21), what is the clearance distance between the five transformer pads and any visible water supply lines, water meters, or wastewater lines? Are these utilities labeled on the plan, and are there any dimension callouts showing clearances?
- **Checklist text:** Transformer pads lack minimum 5-foot horizontal clearance from water lines
- **Classifier reasoning:** The agent is directly asking for clearance distance measurements between transformer pads and water lines, which is the core compliance question. While the agent also asks about labeling and dimension callouts (generic elements), the primary and explicit request is quantitative: 'what is the clearance distance,' which requires plan-view measurement.
- **Confidence:** 0.95
- **Dispatched to:** `vision` — fallback `measurement_arg_construction_not_implemented`

### Classifier intent: `generic` (40 calls)

#### `20260508T131712219Z-bn24`

- **Item:** `EL-1.1` — expected_specialist=measure-distance
- **Sheet:** 4
- **Agent question:** Are there any overhead electric utility poles or overhead electric lines depicted on this existing conditions survey?
- **Checklist text:** Buildings and permanent structures do not maintain minimum 7 feet 6 inches horizontal sky-to-ground clearance from overhead electric conductors
- **Classifier reasoning:** The agent is performing a presence check for overhead electric infrastructure on the survey sheet, which is a prerequisite step before any clearance measurement can occur. This is sheet discovery and feature identification, not yet a measurement task.
- **Confidence:** 0.98
- **Dispatched to:** `vision`

#### `20260508T131720553Z-virg`

- **Item:** `EL-2.1` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Are overhead electric poles, conductors, or transmission lines shown on the landscape plan? If so, describe their location on the site.
- **Checklist text:** Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment
- **Classifier reasoning:** The agent is asking a presence and location discovery question (does OHE infrastructure appear on the landscape plan, and where?), which is a prerequisite step before any lateral distance measurement can be performed. This is progressive verification—sheet/feature discovery before the actual 15-foot clearance measurement.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131726925Z-vvw4`

- **Item:** `EL-2.1` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Are there any overhead electric distribution lines or facilities shown on the site plan, or are all electric utilities underground?
- **Checklist text:** Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment
- **Classifier reasoning:** The agent is performing a presence/discovery check to determine whether overhead electric infrastructure exists on the plan at all, which is a prerequisite step before any lateral distance measurement could be performed. This is a sheet-discovery and feature-presence question, not yet a measurement question.
- **Confidence:** 0.98
- **Dispatched to:** `vision`

#### `20260508T131727576Z-ttx5`

- **Item:** `EL-1.1` — expected_specialist=measure-distance
- **Sheet:** 4
- **Agent question:** Are overhead electric transmission or distribution lines/poles shown on the existing conditions survey? If so, what are their locations relative to the site?
- **Checklist text:** Buildings and permanent structures do not maintain minimum 7 feet 6 inches horizontal sky-to-ground clearance from overhead electric conductors
- **Classifier reasoning:** The agent is performing a presence and location discovery check for overhead electric infrastructure on the survey sheet, which is a prerequisite step before any clearance measurement can occur. This is not yet asking for the actual 7'6" clearance distance measurement between buildings and conductors.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131731982Z-h5xu`

- **Item:** `EL-13.10` — expected_specialist=measure-distance
- **Sheet:** 21
- **Agent question:** Are transformer pads shown on the site plan? If so, are their access door orientations indicated, and are there any markings showing the 10-foot clearance zone from the access door?
- **Checklist text:** Transformer pad hot-stick use area (access door side) lacks minimum 10-foot clearance to open area or adjacent building/structure
- **Classifier reasoning:** The agent is performing a progressive presence and feature-identification check (do transformer pads exist, are door orientations marked, are clearance zones indicated) rather than measuring an actual clearance distance; the 10-foot clearance measurement itself would come in a subsequent question.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131744866Z-4zri`

- **Item:** `EL-2.1` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Which specific trees shown on the landscape plan are located near the overhead electric line marked as OHE? What are their species and approximate distances from the OHE line? Are any clearance dimensions shown on the plan?
- **Checklist text:** Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment
- **Classifier reasoning:** The agent is asking for tree identification, species readout, and whether clearance dimensions are labeled on the plan—all label/presence checks. Although the checklist requirement ultimately requires a 15-foot clearance measurement, the agent question is a progressive presence and feature-identification step (which trees are near OHE, what species, are dimensions shown) that precedes the actual distance measurement.
- **Confidence:** 0.92
- **Dispatched to:** `vision`

#### `20260508T131745121Z-y3k5`

- **Item:** `EL-13.37` — expected_specialist=none
- **Sheet:** 21
- **Agent question:** Are transformer pad dimensions or detail notes shown on the electrical plan? Are there references to Austin Energy Design detail sheets?
- **Checklist text:** Transformer pad dimensions do not match Austin Energy Design-approved transformer pad detail sheets for specified service type (single-phase or three-phase)
- **Classifier reasoning:** The agent is performing a presence and reference check (do dimensions/notes/detail-sheet references appear on the plan?) rather than measuring or comparing actual dimensions against a standard. This is a progressive verification step before any dimensional comparison would occur.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131748437Z-4w1q`

- **Item:** `EL-13.37` — expected_specialist=none
- **Sheet:** 21
- **Agent question:** Are transformer pad dimensions explicitly labeled or dimensioned anywhere on Sheet 21 or other electrical plan sheets? Are there any references to Austin Energy Design-approved transformer pad detail specifications or standard sizes?
- **Checklist text:** Transformer pad dimensions do not match Austin Energy Design-approved transformer pad detail sheets for specified service type (single-phase or three-phase)
- **Classifier reasoning:** The agent is performing a presence/discovery check for labeled dimensions and specification references on the sheets, not yet measuring or comparing actual pad dimensions against approved details. This is a preliminary step to locate where dimension information exists before any compliance comparison can occur.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131753116Z-hze9`

- **Item:** `EL-2.10` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** Are all tree species clearly identified by scientific and/or common name on the landscape plan and plant schedule? Does the plant legend show the tree type symbols with corresponding species?
- **Checklist text:** Plant legend or plant schedule does not identify species of trees proposed near electric facilities
- **Classifier reasoning:** The agent is asking whether tree species are identified and whether the plant legend shows symbols with corresponding species — this is a label readout and legend/schedule verification task, not a measurement. The checklist requirement concerns species identification completeness, which is a presence/documentation check rather than a spatial clearance measurement.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131758304Z-0a4a`

- **Item:** `EL-1.1` — expected_specialist=measure-distance
- **Sheet:** 9
- **Agent question:** On the main site plan, are the overhead electric lines and utility poles shown? Are there clearance dimensions labeled between the proposed buildings and the overhead electric lines?
- **Checklist text:** Buildings and permanent structures do not maintain minimum 7 feet 6 inches horizontal sky-to-ground clearance from overhead electric conductors
- **Classifier reasoning:** The agent is asking a presence and labeling question (are OHE lines shown? are clearance dimensions labeled?) rather than requesting an actual measurement between features. This is a progressive verification step to identify whether the necessary elements and annotations exist on the plan before attempting to measure or verify clearance compliance.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131807881Z-jmt3`

- **Item:** `EL-13.35` — expected_specialist=none
- **Sheet:** 21
- **Agent question:** Are there transformer easements or electrical easements explicitly shown around the transformer pad locations? Are any easement widths or dimensions specified? What easements (if any) are shown on the site plan near the transformer pads?
- **Checklist text:** Transformer easements not shown around pads, or easement width inadequate for Austin Energy accessibility requirements
- **Classifier reasoning:** The agent is asking about presence and identification of easements on the plan (do they exist? are they labeled? what dimensions are shown?), which is a feature-presence and label-readout question. The requirement's compliance check (adequacy of easement width) requires measurement, but the agent is first doing progressive verification to discover whether easements are even depicted and what information is available.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131809478Z-6coh`

- **Item:** `EL-2.14` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** Are overhead electric lines (including poles and conductors) clearly shown on the landscape plan alongside the tree locations? Can you see both the electric infrastructure and tree symbols on the same drawing to verify clearances?
- **Checklist text:** Trees not shown on landscape plan in relation to overhead electric facilities, preventing clearance verification
- **Classifier reasoning:** The agent is asking a presence/visibility question—whether both overhead electric infrastructure and trees are depicted together on the landscape plan—which is a prerequisite sheet-discovery and feature-presence check before any clearance measurement could occur. This is progressive verification; the actual clearance measurement would come later.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131809837Z-ccc1`

- **Item:** `EL-2.10` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** On the landscape plan, identify which specific tree species (common name or botanical name) are labeled with "M" (Mitigation Tree) and "P" (Parking Buffer Point Tree) symbols. Cross-reference with the plant list if needed.
- **Checklist text:** Plant legend or plant schedule does not identify species of trees proposed near electric facilities
- **Classifier reasoning:** The agent is asking for label readout and legend interpretation (identifying tree species by symbol designation and cross-referencing a plant list), which is a feature identification and documentation check, not a spatial measurement. This is a presence/identification question aligned with the checklist requirement to verify species are identified.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131813610Z-dnca`

- **Item:** `EL-1.7` — expected_specialist=none
- **Sheet:** 9
- **Agent question:** Are there building elevation sheets or profile sections showing surveyed overhead electric conductor elevations, and do they include clearance dimension annotations from the conductors to building roofs/projections?
- **Checklist text:** Surveyed elevations and locations of overhead conductors not included on building elevation sheets to demonstrate required clearances are met
- **Classifier reasoning:** The agent is asking whether specific sheets exist and whether they contain dimension annotations—a document/sheet presence and label-readout question. Although the checklist requirement is ultimately about clearance compliance, the agent question is a prerequisite presence and annotation check (do the sheets exist? do they have the required dimensions?) rather than a direct measurement of clearance distance between features.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131821798Z-6hfr`

- **Item:** `EL-1.7` — expected_specialist=none
- **Sheet:** 1
- **Agent question:** Are there any building elevation sheets showing the height of overhead electric conductors and the vertical clearances from building roof lines or projections? If so, what clearance dimensions are shown?
- **Checklist text:** Surveyed elevations and locations of overhead conductors not included on building elevation sheets to demonstrate required clearances are met
- **Classifier reasoning:** The agent is asking a presence/discovery question first ('Are there any building elevation sheets...') before attempting to read clearance dimensions. This is progressive verification — identifying whether the required sheets exist and what information they contain, rather than measuring a specific clearance distance.
- **Confidence:** 0.92
- **Dispatched to:** `vision`

#### `20260508T131826896Z-ykg8`

- **Item:** `EL-2.1` — expected_specialist=measure-distance
- **Sheet:** 9
- **Agent question:** Are overhead electric lines shown on Sheet 9 (Site Plan)? If so, where are they located and are conductor positions or pole locations identified with dimensions?
- **Checklist text:** Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment
- **Classifier reasoning:** The agent is performing sheet discovery and feature identification (locating OHE lines and identifying dimensional callouts), not yet measuring lateral distance. The actual 15-foot clearance measurement will come after confirming presence and location; this question is a prerequisite presence/location check.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131835579Z-gvof`

- **Item:** `EL-13.33` — expected_specialist=none
- **Sheet:** 21
- **Agent question:** Are all five transformer pads clearly shown to be located within the property lines of the private site, or do any appear to be straddling the property boundary or located within an easement that might be in the public right-of-way?
- **Checklist text:** Transformer pads not located 100% on private property, located in public right-of-way, or straddling property lines
- **Classifier reasoning:** The agent is asking whether transformer pads are visibly located within property lines versus straddling boundaries or in public ROW—this is a presence/location verification question (do the pads appear to be on private property?), not a distance measurement between two features. While the requirement concerns property-line compliance, the agent question is asking for visual confirmation of pad positioning relative to drawn property boundaries, which is a feature-location check rather than a clearance measurement.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131836630Z-8ntt`

- **Item:** `EL-13.38` — expected_specialist=measure-distance
- **Sheet:** 9
- **Agent question:** On the site plan, what is the proximity of each transformer pad to parking areas, drive aisles, or vehicle circulation routes? Are any bollards shown around the transformer pads?
- **Checklist text:** Equipment pad installed within 4 feet of parking areas or vehicle routes lacks required 4-inch minimum diameter galvanized rigid metal posts (bollards) per AE Design equipment pad details, or bollards…
- **Classifier reasoning:** The agent is asking a two-part presence and proximity question: (1) identifying transformer pad locations relative to parking/vehicle areas, and (2) checking whether bollards are shown at all. This is progressive verification before any specific clearance measurement—the agent needs to establish which pads are within the 4-foot threshold and whether bollards exist, not measure the exact distance yet.
- **Confidence:** 0.92
- **Dispatched to:** `vision`

#### `20260508T131846266Z-iep7`

- **Item:** `EL-1.23` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** On the site plan, are any clearance dimension annotations shown? If yes, do they originate from the outside conductor wire itself, or from the pole centerline/structure?
- **Checklist text:** Clearance dimensions measured from utility pole or centerline instead of from outside conductor or outermost electric line as required by code
- **Classifier reasoning:** The agent is asking whether clearance dimension annotations are present on the plan and where they originate from (conductor vs. pole centerline) — this is a feature presence and label-origin check, not a measurement of actual distance between two physical features. The measurement compliance itself comes later; this is progressive verification of annotation correctness.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131850403Z-wfzj`

- **Item:** `EL-2.12` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** Are there any dimension lines shown on the landscape plan measuring distances from trees to overhead electric infrastructure? If yes, what is the reference point for these measurements - from the pole/structure or from the conductor location?
- **Checklist text:** Tree clearances measured from utility pole centerline or structure instead of from outer electric conductor
- **Classifier reasoning:** The agent is asking whether dimension lines exist on the plan and what their reference points are—a presence and label-readout question. Although the checklist requirement concerns measurement methodology, the agent question is a progressive verification step that precedes actual clearance measurement: it's discovering whether measurements are even shown and identifying their reference points, not performing the measurement itself.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131858790Z-sm0o`

- **Item:** `EL-2.5` — expected_specialist=measure-distance
- **Sheet:** 11
- **Agent question:** Does the grading plan show any transmission easement boundaries? Are there any easements labeled as "transmission" or with dimensions exceeding 25 feet in width? If electric easements are shown, what are their widths and locations?
- **Checklist text:** Trees (any species) proposed within transmission easement boundaries
- **Classifier reasoning:** The agent is asking about presence and identification of transmission easement boundaries on the grading plan (sheet discovery, feature presence, and label readout), not measuring distances or clearances between trees and easement lines. This is a progressive verification step to locate easements before any tree-proximity assessment.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131900974Z-fzgi`

- **Item:** `EL-1.46` — expected_specialist=none
- **Sheet:** 3
- **Agent question:** Is there a note on the cover sheet or general notes stating that owner/contractor must notify Austin Energy at least 48 hours before work begins near high-voltage overhead lines?
- **Checklist text:** Plans do not include required note that owner/contractor must notify Austin Energy at least 48 hours before work begins near high-voltage overhead lines
- **Classifier reasoning:** The agent is asking whether a specific note/text exists on the plan sheets (presence and content check of a compliance note), not measuring any physical distance or clearance.
- **Confidence:** 0.99
- **Dispatched to:** `vision`

#### `20260508T131904157Z-9ew0`

- **Item:** `EL-13.13` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** On the landscape plan, are there any trees or vegetation shown within 10 feet of any transformer pad locations? If so, are these trees identified as utility-compatible species?
- **Checklist text:** Trees within 10 lateral feet of pad-mounted equipment are not identified as utility-compatible species per ECM Appendix F, or trees within 15 lateral feet of overhead electric distribution conductors …
- **Classifier reasoning:** The agent is asking a presence question first (are there trees within 10 feet of transformer pads?) before any measurement or species verification. This is progressive verification—identifying whether trees exist in the relevant zone precedes the measurement and species-compatibility check that would follow.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131904597Z-zvlq`

- **Item:** `EL-2.11` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** Are large trees (with mature height of 40 feet or more) differentiated or marked differently on the landscape plan from other trees? Is the mature height of each proposed tree species clearly identified?
- **Checklist text:** Large trees (mature height 40+ feet per ECM Appendix F) not differentiated on plans to allow verification of clearances from overhead electric facilities
- **Classifier reasoning:** The agent is asking whether large trees are visually differentiated/marked on the plan and whether mature heights are labeled—a presence and labeling check. While the ultimate requirement involves clearance measurement, this question is a prerequisite presence and identification check, not a measurement of distance between trees and overhead electric facilities.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131923201Z-06pl`

- **Item:** `EL-1.46` — expected_specialist=none
- **Sheet:** 3
- **Agent question:** Is there a note on the cover sheet, general notes, or any sheet stating that the owner/contractor must notify Austin Energy at least 48 hours before work begins near high-voltage overhead lines? Check Sheet 3 (general notes) carefully for this specific requirement.
- **Checklist text:** Plans do not include required note that owner/contractor must notify Austin Energy at least 48 hours before work begins near high-voltage overhead lines
- **Classifier reasoning:** The agent is asking whether a specific note/text exists on the plans (presence check and label readout), not measuring any physical distance or clearance. This is a document-content verification task.
- **Confidence:** 0.99
- **Dispatched to:** `vision`

#### `20260508T131924642Z-0l7o`

- **Item:** `EL-1.14` — expected_specialist=measure-distance
- **Sheet:** 9
- **Agent question:** Are there any retaining walls shown on the site plan? If so, what is their location and distance from the overhead electric lines shown on the site boundaries?
- **Checklist text:** Retaining walls do not maintain minimum 7.5-foot horizontal sky-to-ground clearance from outermost electric line where overhead facilities are present
- **Classifier reasoning:** The agent is performing a progressive presence and location check for retaining walls before measuring clearance; the actual clearance measurement (the core compliance requirement) will follow once walls are identified.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131925441Z-tg8k`

- **Item:** `EL-13.38` — expected_specialist=measure-distance
- **Sheet:** 21
- **Agent question:** Are any of the five transformer pads located within 4 feet of parking areas, driveways, or vehicle circulation routes? If yes, are bollards or protective posts shown around those pads, and if so, what are their specifications?
- **Checklist text:** Equipment pad installed within 4 feet of parking areas or vehicle routes lacks required 4-inch minimum diameter galvanized rigid metal posts (bollards) per AE Design equipment pad details, or bollards…
- **Classifier reasoning:** The agent is asking a two-part presence/feature question: (1) whether transformer pads exist within 4 feet of vehicle routes, and (2) whether bollards are visible and what their specs are. This is progressive verification—identifying which pads need bollards before measuring bollard spacing or diameter. The actual clearance measurement (4-foot distance) and bollard specification compliance (4-inch diameter, spacing) are secondary to the current presence and identification task.
- **Confidence:** 0.92
- **Dispatched to:** `vision`

#### `20260508T131929609Z-h3ms`

- **Item:** `EL-13.33` — expected_specialist=none
- **Sheet:** 21
- **Agent question:** Are the transformer pad locations shown entirely within the private property boundary, or do any of them appear to straddle a property line or extend into the right-of-way?
- **Checklist text:** Transformer pads not located 100% on private property, located in public right-of-way, or straddling property lines
- **Classifier reasoning:** The agent is asking whether transformer pads are visually located within private property boundaries versus straddling lines or extending into ROW—this is a feature-location and boundary-relationship presence/position check, not a quantitative distance measurement between two features.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131929618Z-yorp`

- **Item:** `EL-2.15` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** Are there any notes, correspondence, or documentation on the plans indicating written approval from Austin Energy for trees proposed within restricted zones from overhead electric facilities?
- **Checklist text:** Plans propose trees within prohibited clearance zones without documented Austin Energy written approval
- **Classifier reasoning:** The agent is asking whether documentation or notes exist on the plans (a presence/readout check), not measuring clearance distances. This is a progressive verification step to identify whether approval evidence is present before any clearance measurement would be evaluated.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131942293Z-1t4c`

- **Item:** `EL-13.37` — expected_specialist=none
- **Sheet:** 21
- **Agent question:** Are there transformer pad detail sheets included in this plan set that show specific dimensions for the pad foundation and match Austin Energy Design standards? List the pad dimensions for each transformer if shown.
- **Checklist text:** Transformer pad dimensions do not match Austin Energy Design-approved transformer pad detail sheets for specified service type (single-phase or three-phase)
- **Classifier reasoning:** The agent is asking whether transformer pad detail sheets exist in the plan set and requesting a readout of dimensions shown on those sheets. This is a document-presence check and label/dimension readout task, not a measurement between physical features on the plan. The actual compliance verification (whether dimensions match Austin Energy standards) comes after this discovery step.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131942702Z-hkq6`

- **Item:** `EL-2.6` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Can you identify the locations of overhead electric utility poles on the landscape plan? Are there trees positioned within approximately 10 feet of these poles?
- **Checklist text:** Trees proposed within 10 lateral feet of overhead electric utility pole
- **Classifier reasoning:** The agent is asking for presence and location identification of poles and trees on the plan (sheet discovery and feature presence), not yet requesting a specific distance measurement between them. Once poles and trees are located, a subsequent measurement question would follow.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131950031Z-60z7`

- **Item:** `EL-13.13` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** On the landscape plan (Sheet 31), are there any trees shown within 10 lateral feet of any of the transformer pads shown on Sheet 21? If yes, which transformer pads, and what tree species are shown near them? Are tree species labeled with utility-compatible designations?
- **Checklist text:** Trees within 10 lateral feet of pad-mounted equipment are not identified as utility-compatible species per ECM Appendix F, or trees within 15 lateral feet of overhead electric distribution conductors …
- **Classifier reasoning:** The agent is asking a presence and identification question (are trees shown within 10 feet, which pads, what species, are they labeled?) rather than requesting a measurement of the actual distance between trees and pads. This is a progressive verification step to identify relevant features and their labels before any clearance measurement would occur.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131951725Z-e8ov`

- **Item:** `EL-1.37` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Are there any trees being planted near the overhead electric lines shown on the western and northern boundaries of the site? What species are being proposed in those areas and how far from the OHE lines?
- **Checklist text:** Trees proposed within 10 lateral feet of overhead distribution conductors or 50 lateral feet of overhead transmission conductors are not from Utility Compatible Shade Trees list, or site grading does …
- **Classifier reasoning:** The agent is asking a presence and identification question (are trees being planted, what species), which is a prerequisite check before measuring clearances; the actual distance measurement from OHE lines will follow this feature-discovery step.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T131955959Z-txlp`

- **Item:** `EL-1.18` — expected_specialist=none
- **Sheet:** 11
- **Agent question:** Are section or profile views provided showing vertical clearances from finished driveway grade elevations to overhead electric facility elevations? If yes, what are the specific vertical clearance dimensions shown?
- **Checklist text:** Driveways do not maintain minimum 16-foot vertical clearance (parking without truck traffic) or 18-foot vertical clearance (areas with truck traffic) from lowest point of overhead electric facilities …
- **Classifier reasoning:** The agent is asking whether section/profile views exist and requesting label readout of dimensions shown on those views. This is a document-presence and label-readout question, not a measurement task. The actual clearance verification (comparing shown dimensions against 16-foot or 18-foot minimums) would come later; this step is discovering whether the necessary views and their annotated dimensions are present on the plans.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T132013614Z-hpn1`

- **Item:** `EL-2.10` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** What are all the tree symbols shown on the landscape plan (Block 2, Sheet 31) and what does the legend in Block 5 indicate about what each symbol means (e.g., SY, PL, P, M, and any symbols with crosses or dots)? List each symbol type and its meaning.
- **Checklist text:** Plant legend or plant schedule does not identify species of trees proposed near electric facilities
- **Classifier reasoning:** The agent is asking for a legend/symbol readout and identification of tree symbols and their meanings on the landscape plan. This is a label and table interpretation task, not a distance or clearance measurement. The checklist requirement concerns species identification completeness, and the agent question is the progressive first step: discovering what symbols exist and what the legend says they mean (before verifying whether species are actually identified).
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T132030739Z-3bhn`

- **Item:** `EL-2.2` — expected_specialist=measure-distance
- **Sheet:** 31
- **Agent question:** Is there any indication on the landscape plan or other sheets that transmission lines (not just distribution) are present on or near the property? Are transmission structures or facilities identified?
- **Checklist text:** Non-utility-compatible trees proposed within 50 lateral feet of overhead electric transmission conductor or equipment
- **Classifier reasoning:** The agent is performing a presence/discovery check for transmission infrastructure (structures, facilities, lines) on the plans before attempting any distance measurement. This is a preliminary feature-identification question, not yet a clearance measurement.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T132055382Z-uqlt`

- **Item:** `EL-2.12` — expected_specialist=none
- **Sheet:** 31
- **Agent question:** Are there any notes, dimensions, or labels on Sheet 31 (landscape plan) that specifically address clearances from the overhead electric (OHE) line? Are there any pole locations marked with symbols or dimensions? Are there any measurements shown from trees to utilities?
- **Checklist text:** Tree clearances measured from utility pole centerline or structure instead of from outer electric conductor
- **Classifier reasoning:** The agent is asking whether certain visual elements (notes, dimensions, labels, pole symbols, measurements) exist on the sheet, which is a presence/discovery question. Although the checklist requirement concerns measurement methodology (clearance from conductor vs. pole centerline), the agent is not yet asking to measure or verify a specific clearance distance—only to identify what documentation or markings are present on the plan.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T132058752Z-pb32`

- **Item:** `EL-1.8` — expected_specialist=none
- **Sheet:** 9
- **Agent question:** On the site plan (Sheet 9), what specific clearance dimensions are shown between the overhead electric lines and the nearest building faces? Are these dimensions measured from the conductor wire or from a different reference point? Are any section views provided?
- **Checklist text:** Section and plan view exhibits do not show dimensions from outer electric conductor to outermost edge of buildings and building projections for clearance verification
- **Classifier reasoning:** The agent is asking about the presence and location of dimension labels on the plan sheet, and whether section views exist—this is a document/drawing inspection question (what dimensions are shown, where are they measured from, do sections exist) rather than a measurement task. The agent is not asking the vision system to measure a clearance; they are asking what dimensions are already labeled and documented on the plan.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T132140558Z-uj98`

- **Item:** `EL-13.27` — expected_specialist=measure-distance
- **Sheet:** 21
- **Agent question:** Are there overhead electric distribution lines shown on Sheet 21? If yes, where are they located relative to the five transformer pads, and are there any dimension callouts showing the clearance distance between the transformer pads and the overhead conductors?
- **Checklist text:** Transformer locations lack minimum 7.5-foot horizontal sky-to-ground clearance from overhead distribution line conductors (primary, neutral, and secondary), extending from ground to sky
- **Classifier reasoning:** The agent is performing progressive verification by first asking whether overhead electric lines are present on the sheet and their general location relative to transformers, before attempting to measure clearance distances; this is a sheet-discovery and feature-presence question, not yet a measurement question.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

#### `20260508T132206581Z-vsqy`

- **Item:** `EL-13.32` — expected_specialist=none
- **Sheet:** 11
- **Agent question:** On the grading plan (Sheet 11), what is shown regarding grading and surface drainage around the five transformer pad locations? Are the transformer pads labeled on the grading plan, and is there any indication of whether the drainage slopes flow toward or away from the buildings? Also, are the transformers specified as oil-filled or dry-type in the electrical notes?
- **Checklist text:** Grading plan shows drainage slopes toward building from oil-filled transformer pad location (liquid flow must be away from building)
- **Classifier reasoning:** The agent is asking for feature identification, labeling verification, and note readout (presence of transformer pads, their labels, drainage indication symbols, and transformer type specification in notes) rather than a quantitative slope or distance measurement. This is progressive verification before any slope-angle or drainage-direction measurement would occur.
- **Confidence:** 0.95
- **Dispatched to:** `vision`

## Items invoked by canonical intent (post-aggregation)

The metrics framework aggregates per-item canonical intent across all calls for that item, then applies majority vote (`per-item.tsv`). Below: each invoked item, with the strongest classifier intent seen.

| Item | Calls | Strongest intent | Expected (TSV 1) |
|---|---:|---|---|
| `EL-1.1` | 5 | `measurement` | `measure-distance` ✓ |
| `EL-1.14` | 1 | `generic` | `measure-distance` ✗ |
| `EL-1.18` | 1 | `generic` | `none` |
| `EL-1.20` | 1 | `measurement` | `none` |
| `EL-1.23` | 1 | `generic` | `none` |
| `EL-1.37` | 2 | `measurement` | `measure-distance` ✓ |
| `EL-1.46` | 2 | `generic` | `none` |
| `EL-1.7` | 2 | `generic` | `none` |
| `EL-1.8` | 1 | `generic` | `none` |
| `EL-1.9` | 1 | `measurement` | `measure-distance` ✓ |
| `EL-13.1` | 3 | `measurement` | `measure-distance` ✓ |
| `EL-13.10` | 2 | `measurement` | `measure-distance` ✓ |
| `EL-13.13` | 3 | `measurement` | `measure-distance` ✓ |
| `EL-13.14` | 1 | `measurement` | `measure-distance` ✓ |
| `EL-13.21` | 1 | `measurement` | `none` |
| `EL-13.27` | 1 | `generic` | `measure-distance` ✗ |
| `EL-13.32` | 1 | `generic` | `none` |
| `EL-13.33` | 2 | `generic` | `none` |
| `EL-13.35` | 1 | `generic` | `none` |
| `EL-13.37` | 3 | `generic` | `none` |
| `EL-13.38` | 2 | `generic` | `measure-distance` ✗ |
| `EL-2.1` | 6 | `measurement` | `measure-distance` ✓ |
| `EL-2.10` | 3 | `generic` | `none` |
| `EL-2.11` | 1 | `generic` | `none` |
| `EL-2.12` | 2 | `generic` | `none` |
| `EL-2.14` | 2 | `measurement` | `none` |
| `EL-2.15` | 1 | `generic` | `none` |
| `EL-2.2` | 1 | `generic` | `measure-distance` ✗ |
| `EL-2.3` | 1 | `measurement` | `measure-distance` ✓ |
| `EL-2.5` | 1 | `generic` | `measure-distance` ✗ |
| `EL-2.6` | 1 | `generic` | `measure-distance` ✗ |

