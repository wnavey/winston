# Audit: EL-5.0 Guide 10 — "Electric Infrastructure Plan Completeness"

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/10.md`
**5.1 corpus:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` on branch `feat/inspection-alias-ui`; main HEAD commit `c66e398bb24866ba0dd6b4d865daf2424e8dfd9d`.
**5.1 el/ files:** `el/1.md` (Overhead/Vertical Clearances), `el/2.md` (Underground Utility Routing), `el/3.md` (AE Service & ROW Utility Coordination). `el-md-exp/` excluded per instructions.

## Summary

5.0 el/10 was a 63-row checklist devoted to "plan completeness" — what must be shown on site plans for AE review, organized around existing-facilities documentation (items 1–7), proposed facilities (8–15), equipment identification (16–18), required notes (19–23), easement depiction (24–32), cross-sheet coordination (33–36), proximity and clearance exhibits (37–41), organizational/formatting conventions (42–46), alley/cross-property/unified-development edge cases (47–51), load calculation (52), plat notes (53–60), meter location (61), proximity survey (62), and the 200-foot subdivision trigger (63).

In 5.1, this material was consolidated primarily into **el/3.md** ("Austin Energy Service and ROW Utility Coordination"), which absorbs the AEDC 1.16.0 land-development submittal checks, the transmission-easement plat-note bundle, and the AE Standard Notes verbatim check. Transformer-clearance and pad-placement content landed in **el/2.md** and was also cross-referenced by **zlu/15.md** (ZLU-15.40) for the clearance-to-building test. Overhead-clearance-envelope graphical requirements landed in **el/1.md** (EL-1.26 / EL-1.27 / EL-1.28). Cross-sheet tree/electric coordination items (EL-10.36) landed in **eptp/10.md** / **eptp/22.md**. Alley vacation moved to **zlu/24.md** ZLU-24.62.

Notable compressions: the eight individual plat-note rows (EL-10.53–EL-10.60) were collapsed into a single 5.1 row (EL-3.32) that bundles all AEDC 1.16.0(8) notes plus the AEDC 1.16.0(9) parkland-in-transmission-easement prohibition. The four AE Standard Notes (EL-10.19) became EL-3.6 (same bundling). The eight separate "show existing/proposed facility" checks (EL-10.1, .2, .4, .5, .6, .8, .10, .14, .15) were absorbed into EL-3.11 (AEDC 1.16.0(1) drawing-content check) with a narrative enumerating required contents.

Largest surprises: (a) meter-location prohibited-locations rule (EL-10.61, UCM 1.9.3.1) is **entirely dropped** from 5.1 — neither the porch/stairway/overhang rule nor the 1-foot flood-elevation requirement survives in any el/ file; the 3-ft gas-meter separation (EL-10.18) is also dropped. (b) The 50-foot site-lighting illumination-calculation rule near transmission easements (EL-10.37) is dropped; transmission-adjacency lighting is not addressed in 5.1 el/. (c) The MEP-authored "master electrical plan" rule (EL-10.41) is dropped. (d) The primary-vs-secondary service identification rule (EL-10.17) is dropped. (e) The unified-development property-line-crossing rule (EL-10.49) is dropped, although AEDC 1.3.6 easement grants cover a narrow adjacent concept in EL-3.10. (f) The 200-foot-subdivision-proximity trigger (EL-10.63, LDC § 25-4-200(B)) is not carried forward as a checklist row. (g) The NEC compliance row (EL-10.45) is dropped outright; NESC survives only indirectly via EL-3.6 Standard Note 4.

## Status counts

- retained: 0
- reworded: 4 (EL-10.8, EL-10.19, EL-10.52, EL-10.23)
- renumbered: 0
- moved-within-el: 11
- moved-cross-department: 2 (EL-10.36, EL-10.47)
- combined: 15 (plat notes 53–60 into EL-3.32; facility-show items into EL-3.11; etc.)
- split: 1 (EL-10.23 → EL-3.12 + EL-2.22)
- removed: 22
- partial: 13

## Main audit table

| 5.0 ID | Deficiency (truncated) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-10.1 | Existing overhead electric facilities not shown (poles, conductors, neutrals, transmission, towers) | combined | el/3 EL-3.11 | Absorbed into the AEDC 1.16.0(1) drawing-content check; EL-3.11 enumerates "existing AE facilities (transmission/distribution structures, guys, anchors, transformers)". Dedicated granular row dropped. |
| EL-10.2 | Existing down guy wires and anchors not shown | combined | el/3 EL-3.11 | Rolls into EL-3.11 AEDC 1.16.0(1) content list (guys, anchors). |
| EL-10.3 | Section-view exhibits missing height of existing poles/conductors with clearance envelopes | moved-within-el | el/1 EL-1.26; el/1 EL-1.27; el/1 EL-1.28 | 5.1 recasts the section-view-exhibit concept as dashed height-limit-line annotations (horizontal/sloped) plus the conductor-envelope graphical check; no longer gated on "section views provided". |
| EL-10.4 | Existing underground electric facilities not shown (duct banks, cabling, network, routing, meters) | combined | el/3 EL-3.11 | Absorbed into AEDC 1.16.0(1) drawing content requirement. Meter-location specifics dropped. |
| EL-10.5 | Existing streetlights not shown | combined | el/3 EL-3.11 | Rolls into EL-3.11. Streetlight placement/conflict rules survive separately at EL-3.16, EL-3.18, EL-3.21, EL-3.22. |
| EL-10.6 | Power source for existing buildings not shown | removed | — | No equivalent in el/1–3. Concept outside AEDC 1.16.0(1) enumerated fields; dropped. |
| EL-10.7 | Existing facilities shown from GIS approximation rather than field survey | partial | el/1 EL-1.4 (vault-proximity survey only) | The broad GIS-vs-survey completeness check is dropped. Only the vault-proximity AE survey (UCM 1.10.3) remains (EL-1.4); general accuracy concern not preserved. |
| EL-10.8 | Proposed electric facilities not shown/incomplete (distribution, switchgear, metering, transformers, poles) | reworded | el/3 EL-3.11; el/3 EL-3.7 | EL-3.11 covers the drawing-content requirement; EL-3.7 narrows to new/relocated transformers and pull boxes requiring AE approval. Switchgear/metering granularity lost. |
| EL-10.9 | Power source for proposed buildings not shown | removed | — | Dropped. |
| EL-10.10 | Street lighting layout, poles, and conduit connections not shown | partial | el/3 EL-3.18; el/3 EL-3.21; el/3 EL-3.22 | 5.1 items cover pole coordination/spacing/conflict, not the base "layout and conduit not shown" completeness check; partial coverage only. |
| EL-10.11 | Proposed conduit routing not shown on profile view | removed | — | No 5.1 equivalent; profile-view conduit routing not preserved as a checklist row. |
| EL-10.12 | Relocation plans for existing electric facilities not provided | partial | el/2 EL-2.21; el/3 EL-3.10 | EL-2.21 addresses power-pole relocation coordination; EL-3.10 addresses electrical-easement coordination before sign-off. The generic "relocation plans not provided" concept is fragmented. |
| EL-10.13 | Demolition of electric facilities not shown; AE asset numbers missing | partial | el/3 EL-3.9 | EL-3.9 requires the preconstruction-meeting note for demolition; the AE-asset-number requirement and the "show on demolition plan" completeness check are dropped. |
| EL-10.14 | Point of connection to existing AE facilities not shown | combined | el/3 EL-3.11 | Concept absorbed into AEDC 1.16.0(1) drawing content (point of service enumeration). |
| EL-10.15 | Proposed electrical route from existing AE service to proposed service not shown | combined | el/3 EL-3.11 | Absorbed. |
| EL-10.16 | Equipment misidentified (manholes vs streetlights, transformers vs telecom, meters vs vaults) | removed | — | Plan-legend accuracy check dropped. No 5.1 equivalent. |
| EL-10.17 | Electrical service not identified as primary or secondary | removed | — | Dropped. UCM § 1.3.3 "one point of service/one voltage" concept survives in EL-3.11 narrative but not as a dedicated primary/secondary labeling check. |
| EL-10.18 | Gas-using components not identified when site uses both gas and electric service | removed | — | Dropped. UCM § 1.9.3.1(C)(3) 3-ft meter separation not preserved in 5.1 el/. |
| EL-10.19 | AE Standard Notes not provided on plans | reworded | el/3 EL-3.6 | EL-3.6 requires all four AE Standard Notes verbatim and lists them; the "not provided" framing is narrowed to "missing or altered from required verbatim text". |
| EL-10.20 | Note missing stating all electric infrastructure is shown and exceptions require AE pre-approval | removed | — | Specific cover-sheet certification note is dropped. |
| EL-10.21 | Plans do not reflect latest AE-approved electric design (conduit sizes, routing, equipment) | partial | el/3 EL-3.10; el/3 EL-3.7 | EL-3.10 covers final layout/easement coordination; EL-3.7 covers pre-construction transformer/pull-box approval. The general "plans don't match AE-approved design" check is not preserved as a standalone row. |
| EL-10.22 | Plans do not match electric facilities design agreed with AE Network | removed | — | Network-Area coordination specificity dropped. |
| EL-10.23 | Electric site plan not fully coordinated with AE Design (clearances, disconnect, staging, mountable curb, bollard, truck access) | split | el/3 EL-3.12; el/2 EL-2.22 | EL-3.12 covers AE personnel access / truck-access dimensions; EL-2.22 covers transformer pad clearances and truck access (6-ft rule, bollards implicit via UCM 1.10.4). Mountable-curb/disconnect-location completeness checks dropped. |
| EL-10.24 | Existing electric easements not shown on all required plan sheets | partial | el/3 EL-3.11 | EL-3.11 requires public/private easements in the AutoCAD submittal; "all required plan sheets" cross-sheet test dropped. |
| EL-10.25 | Plans do not distinguish between aerial and underground electric easements | removed | — | Aerial-vs-non-aerial easement typology check dropped from 5.1 el/ (despite being a common-violation pattern in 5.0 overview). |
| EL-10.26 | Recording information not provided for existing electric easements | partial | wwp/19 WWP-19.x (cross-department) | Easement-recording-label requirements survive in wwp/19 for water/WW easements (LDC § 25-4-132(A)); no el/-specific row. Marginal applicability to electric easements. |
| EL-10.27 | Existing electric easements not labeled with dimensions | partial | wwp/19 WWP-19.13 | Generic easement-label rule (type/width/purpose) survives at WWP-19.13 under LDC § 25-4-132(A). |
| EL-10.28 | Plans inconsistent with recorded plat re: easement location/dimensions/designation | partial | wwp/19 WWP-19.14; wwp/19 WWP-19.17; zlu/23 ZLU-23.12 | LDC § 25-4-132 plat-consistency concept survives outside el/; no el/-specific row. |
| EL-10.29 | Note missing when no existing electric easements exist on property | removed | — | Dropped. |
| EL-10.30 | Proposed electric easements not shown on all required plan sheets | partial | el/3 EL-3.10; el/3 EL-3.11 | EL-3.10 covers new-easement recording coordination; EL-3.11 covers the submittal drawing. "All required plan sheets" cross-sheet check dropped. |
| EL-10.31 | Electric easements not shown on face of plat | removed | — | Plat-face electric-easement check dropped; no el/ equivalent. |
| EL-10.32 | Additional easements required by AE Design not shown on updated plans | partial | el/3 EL-3.10 | EL-3.10 addresses new-easement coordination; the "updated plans missing AE-identified easements" pattern is narrower than preserved. |
| EL-10.33 | Electric facilities not shown on all required plan sheets (site/utility/landscape/grading/irrigation/architectural) | removed | — | Broad cross-sheet completeness check dropped. Partial overlap with EPTP-10.x for tree/landscape coordination. |
| EL-10.34 | Equipment symbols inconsistent across plan sheets | removed | — | Dropped. |
| EL-10.35 | Electric facility locations do not match across plan sheets | removed | — | Dropped. WWP-39.27 covers analogous cross-sheet utility consistency for W/WW, but no el/ equivalent. |
| EL-10.36 | Tree locations and electric infrastructure not coordinated across plan sheets | moved-cross-department | eptp/10 EPTP-10.17; eptp/10 EPTP-10.19; eptp/10 EPTP-10.22; eptp/10 EPTP-10.25; eptp/10 EPTP-10.26; eptp/10 EPTP-10.30; eptp/22 EPTP-22.51; eptp/22 EPTP-22.52 | 5.1 redistributes tree/electric coordination to Environmental/Planning (EPTP) department; multiple granular rows replace the single 5.0 consolidated check. |
| EL-10.37 | Lighting calculations not provided within 50 ft of AE Transmission Line Easement | removed | — | Dropped. 50-ft transmission-easement illumination-calc rule has no 5.1 el/ landing. UCM § 1.14.0 survives only for construction clearances (el/1 EL-1.18/.19). |
| EL-10.38 | Profile plan missing utility poles with cross arms (~8 ft wide) or AE/NESC/OSHA clearance envelopes | partial | el/1 EL-1.26 | Conductor-envelope graphical requirement survives in EL-1.26; the profile-specific / cross-arm-width / OSHA-envelope granularity dropped. |
| EL-10.39 | Landscape within required 20'×35' staging area near transformers | partial | el/2 EL-2.22; eptp/10 EPTP-10.19 | EL-2.22 covers pad clearances under UCM 1.10.4 (3/5/10-ft rules) but the 20×35 set-up-area vertical-and-horizontal clear-zone check is absorbed into EL-3.12 narrative (not its own row). EPTP-10.19 covers the 10-ft tree/shrub rule around equipment. |
| EL-10.40 | AE infrastructure improvements requiring accessibility standards not shown | removed | — | Dropped. No 5.1 el/ accessibility-for-AE-infrastructure row. TA-22.5 covers sidewalk accessibility around existing meters/boxes but not AE-infrastructure accessibility design. |
| EL-10.41 | Master electrical plan not drafted by MEP for major projects | removed | — | Dropped. EL-3.19 covers MEP plan-coverage extent but does not require MEP authorship. |
| EL-10.42 | Electric design not on separate sheet / not labeled "Electric Only" | removed | — | Dropped. |
| EL-10.43 | Inapplicable/outdated notes included (EV charging, chilled water not proposed) | removed | — | Dropped. ZLU-33.40 covers outdated LDC citations but not inapplicable-system notes. |
| EL-10.44 | Plans do not demonstrate NESC compliance per LDC § 25-4-200 | partial | el/3 EL-3.6 (Note 4) | Only survives indirectly: AE Standard Note 4 (owner responsibility for NESC/OSHA/City/state clearances) is required via EL-3.6. No dedicated "NESC demonstration" row. |
| EL-10.45 | Plans do not demonstrate NEC compliance per LDC § 25-4-200 | removed | — | Dropped entirely; NEC not referenced in any 5.1 el/ checklist row. |
| EL-10.46 | Plans do not demonstrate UCM §§ 1.3.0/1.3.3/1.3.8/1.3.12/1.9.3 and Ch. 15-9 compliance | removed | — | Omnibus UCM-compliance check dropped. Subsections survive elsewhere: 1.3.16 in el/1 EL-1.19 (via 1.14.4) and el/3 EL-3.12; 1.3.15/.19 in el/2 EL-2.21. § 1.9.3 (meter location) and § 15-9-123 (unified development) have no 5.1 landing. |
| EL-10.47 | Alley vacation not approved and recorded | moved-cross-department | zlu/24 ZLU-24.62 | Moved to Zoning/Land-Use department. |
| EL-10.48 | Rear service easements not shown (20-ft rear + 20-ft access) when rear electrical service selected | removed | — | Dropped. No 5.1 equivalent. |
| EL-10.49 | Electrical service conductors crossing property lines without unified-development approval or easements | removed | — | Dropped. UCM § 1.3.8 and City Code § 15-9-123 unified-development framework not preserved as a checklist row in 5.1 el/. |
| EL-10.50 | Additional easement dedication / metes-and-bounds not provided when current easements insufficient | partial | el/3 EL-3.10 | EL-3.10 references AEDC 1.16.0(3) easement-sufficiency coordination; metes-and-bounds granularity lost. |
| EL-10.51 | Plans do not demonstrate preservation of AE personnel access | moved-within-el | el/3 EL-3.12 | EL-3.12 is near-verbatim carryforward of this concept under AEDC 1.16.0(4), with the 12-ft/16-ft truck-access dimensions retained. |
| EL-10.52 | Projected electrical load not shown | reworded | el/3 EL-3.11 | Absorbed into AEDC 1.16.0(1) narrative — EL-3.11 Regulatory Overview mentions "projected load shown"; no dedicated 5.1 row specifically for load calculation. |
| EL-10.53 | Plat note missing: AE pruning/removal rights in easements | combined | el/3 EL-3.32; el/3 EL-3.6 (Note 1) | Collapsed into EL-3.32 (full 1.16.0(8) plat-note bundle) and into EL-3.6 Standard Note 1 for the site-plan version. |
| EL-10.54 | Plat note missing: Owner obligation for additional easements/access | combined | el/3 EL-3.32; el/3 EL-3.6 (Note 2) | Same as EL-10.53. |
| EL-10.55 | Plat note missing: Owner erosion/revegetation/tree protection within 10 ft of overhead centerline | combined | el/3 EL-3.32; el/3 EL-3.6 (Note 3) | Same. |
| EL-10.56 | Plat note missing: Owner clearance-maintenance responsibility near overhead | combined | el/3 EL-3.32; el/3 EL-3.6 (Note 4) | Same. |
| EL-10.57 | Plat note missing: transmission easements — no structures, NESC, no AE access impairment | combined | el/3 EL-3.32 | Collapsed into EL-3.32 transmission-easement plat-note bundle (AEDC 1.16.0(8)(v)). |
| EL-10.58 | Plat note missing: 24-hour AE access to transmission easements | combined | el/3 EL-3.32 | Same. |
| EL-10.59 | Plat note missing: road/driveway 48,000 lb tandem-axle capacity in transmission easements | combined | el/3 EL-3.32 | Same. |
| EL-10.60 | Plat note missing: 48-hour notice before construction/grading in transmission easements | combined | el/3 EL-3.32 | Same. The AEDC 1.16.0(9) parkland-in-transmission-easement prohibition is also bundled into EL-3.32 (no 5.0 counterpart). |
| EL-10.61 | Meter location violates UCM 1.9.3.1 prohibited locations or flood elevation | removed | — | Dropped. UCM § 1.9.3.1 meter-location rules (porches, stairways, overhangs >72", 3-ft gas-meter separation, 1-ft above 100-year flood) have no 5.1 el/ landing. FWP-7.43 covers transformer flood elevation but not meters. Major gap. |
| EL-10.62 | Survey of customer facilities to AE primary voltage facilities not provided | partial | el/1 EL-1.4 | EL-1.4 covers the AE-survey/written-clearance-approval requirement under UCM 1.10.3, but scoped to vault-vertical-clearance not customer-facility proximity generally. |
| EL-10.63 | Subdivision within 200 ft of existing AE infrastructure lacks AE approval | removed | — | Dropped. LDC § 25-4-200(B) 200-ft proximity trigger not preserved in 5.1 el/. |

## Patterns

- **Plat-note collapse (EL-10.53–EL-10.60).** Eight granular plat-note checks collapsed into a single 5.1 row EL-3.32 with the full 1.16.0(8) bundle plus AEDC 1.16.0(9). Trade-off: loses the ability to surface precisely which plat note is missing.
- **AE Standard Notes collapse (EL-10.19, EL-10.20, EL-10.53–.56 duplicates).** Both the site-plan notes (EL-3.6) and the plat notes (EL-3.32) use bundled rows. 5.0 maintained parallel checklist rows for each note; 5.1 requires the reviewer to identify which note within the bundle is missing.
- **"Completeness" checklist rows dropped wholesale.** Rows like EL-10.1/.2/.4/.5/.8/.14/.15 ("facility X not shown") were absorbed into the single AEDC 1.16.0(1) drawing-content row (EL-3.11). This implies 5.1 expects reviewers to treat plan-completeness as a single discrete check rather than per-facility-type.
- **Meter-location rules fully dropped.** EL-10.18, EL-10.61 (both UCM 1.9.3.1) have no survivor in any 5.1 el/ file. The "prohibited meter locations" common-violation pattern was in the 5.0 Regulatory Overview but is not present in el/1, el/2, or el/3. This is the largest gap in 5.1 el/ coverage relative to 5.0 el/10.
- **Cross-sheet consistency rules weakened.** EL-10.24, .25, .27, .28, .30, .33, .34, .35 all dropped or partially moved to WWP-19 / EPTP-10 / EPTP-22. 5.1 el/ does not have its own cross-sheet-coordination row structure.
- **Transmission-adjacency lighting gap.** EL-10.37 (50-ft transmission-easement illumination calcs) is dropped and not picked up elsewhere. UCM § 1.14.0 only survives in el/ for construction clearances, not design-time lighting analysis.
- **Cross-department moves** are limited: only EL-10.36 (→ EPTP) and EL-10.47 (→ ZLU) are genuine cross-department moves. Most other "moves" are actually within-el or to the AEDC 1.16.0(1) AutoCAD-content row in el/3.
