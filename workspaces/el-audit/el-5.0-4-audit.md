# EL 5.0 Guide 4 Audit — "Transmission Lines and Construction Safety"

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/4.md` (worktree @ `ced6e10`)
**5.1 corpus:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` @ main HEAD `8fccc32`
**Scope:** el/, zlu/, eptp/, park/, sduf/, fire/, ta/, sde/, fwp/, wwp/ (el-md-exp/ excluded)

## Summary

5.0's EL guide 4 held 55 items spanning three domains: (1) OSHA construction-safety clearances, pre-con coordination, and barricading near transmission; (2) permanent transmission-easement restrictions on grading, vegetation, irrigation, hydrants, water-quality features, access corridors, load capacity; and (3) overhead-to-underground relocation policy on CTCs/TODs plus facility relocation / PUE vacation. In 5.1, this guide was dissolved. The permanent-design transmission items mostly collapsed into a single AEDC 1.16.0(8) plat-notes checklist (`EL-3.32`) and into `EL-1.19`'s 25-ft/16-ft access corridor check. OSHA working-clearance items (EL-4.3, 4.10–4.14) were consolidated into `EL-1.18` (demolition-sequence note) and `EL-1.24` (work-zone vertical clearance). Moonlight tower items ported cleanly to `EL-3.13–3.15`. CTC/TOD undergrounding (EL-4.31–4.32) expanded into `EL-2.1–2.8` with explicit regulating-plan coverage. Tree/vegetation items near transmission (EL-4.22–4.27, 4.44–4.45) were largely dropped from the el guide and partially covered by `EPTP-22.51/22.52` and `EPTP-10.22` (which address ROW trees / easement plantings, not transmission-specific). Many granular construction-safety items (scaffolding, dumpsters by voltage, spoils by voltage, sprinkler 25-ft, fire-hydrant 20-ft, shrubbery, compost/mulch, septic in easement, 60-in underground clearance, distribution truck-access, etc.) have no 5.1 counterpart and are classified `removed`.

## Status counts

| Status | Count |
|--------|-------|
| retained | 0 |
| reworded | 3 |
| renumbered | 0 |
| moved-within-el | 14 |
| moved-cross-department | 3 |
| combined | 12 |
| split | 0 |
| partial | 5 |
| removed | 18 |
| **Total** | **55** |

(Primary-status tally; items with `(partial)` qualifiers counted under their primary status.)

## Audit table

| 5.0 ID | Deficiency (truncated) | Status | 5.1 Location(s) | Notes |
|--------|------------------------|--------|-----------------|-------|
| EL-4.1 | Pre-construction safety meeting not scheduled 48 hrs before work | combined | el/1.md EL-1.18; el/3.md EL-3.9 | Rolled into demolition-sequence four-part check; EL-3.9 covers AE pre-con meeting note for demo generally. |
| EL-4.2 | One Call (1-800-344-8377) not contacted before digging | removed | — | No 5.1 checklist item references One Call / UCM 1.10.10.5. Keyword grep confirms no hit in any dept. |
| EL-4.3 | Crane 20-ft OSHA clearance from transmission | combined | el/1.md EL-1.18 | Regulatory overview in el/1 mentions 20-ft crane buffer; EL-1.18 covers barricades/warning signs but not crane-specific. Coverage is thin. |
| EL-4.4 | Tower crane license agreement / liability insurance | removed | — | No explicit checklist item in 5.1 about license agreement or insurance for tower cranes. |
| EL-4.5 | Tower crane location discussion w/ AE safety coordinator | removed | — | No equivalent 5.1 item. |
| EL-4.6 | Barricades 10-ft from transmission structures/guys/anchors | moved-within-el | el/1.md EL-1.18 | Explicitly listed among the four demolition-sequence notes. |
| EL-4.7 | Warning signs under overhead transmission | moved-within-el | el/1.md EL-1.18 | Explicitly listed. |
| EL-4.8 | Staging in transmission easement / OSHA clearances | moved-within-el | el/1.md EL-1.25; el/1.md EL-1.18 | EL-1.25 covers staging/spoils overlapping utility alignments / transmission easement. |
| EL-4.9 | Spoils in transmission easement / OSHA clearances | moved-within-el | el/1.md EL-1.25; el/1.md EL-1.18 | Same as EL-4.8. |
| EL-4.10 | Aerial equipment OSHA clearances by voltage | combined (partial) | el/1.md EL-1.24; el/1.md EL-1.18 | Voltage-stratified table (10/11.33/15.33 ft) appears in regulatory overview but not as a discrete check; EL-1.24 addresses work-zone vertical clearance with 18-ft/16-ft thresholds, not voltage-based. |
| EL-4.11 | Dumpsters OSHA clearances by voltage | removed | — | Dumpster-specific item not present. |
| EL-4.12 | Staging areas OSHA clearances by voltage | combined (partial) | el/1.md EL-1.25 | EL-1.25 prohibits staging in transmission easement; voltage-specific OSHA clearance values dropped. |
| EL-4.13 | Spoils OSHA clearances by voltage | combined (partial) | el/1.md EL-1.25 | Same as EL-4.12; voltage thresholds not enumerated. |
| EL-4.14 | Scaffolding OSHA 1926.451(f)(6) clearance by voltage | removed | — | No scaffolding-specific item in 5.1. |
| EL-4.15 | Clearance measured from pole centerline vs outside conductor | reworded | el/1.md EL-1.5 | Same rule, now universal across distribution (not just transmission); better-written. |
| EL-4.16 | Moonlight tower permit within 100 ft | moved-within-el | el/3.md EL-3.13 | Cleanly ported (with correct citation § 14-11-201). |
| EL-4.17 | Moonlight tower protective barrier | partial | el/3.md EL-3.13; el/3.md EL-3.14 | 5.1 replaces barrier-specific item with a "permit required" note (EL-3.13) and advance-notification practice note (EL-3.14); the § 14-11-204 barrier check itself isn't a discrete 5.1 item. |
| EL-4.18 | Grading/excavation within 25 ft of transmission w/o AE coord | combined | el/3.md EL-3.32 | Folded into AEDC 1.16.0(8) plat-notes check; specific note (viii) requires 48-hr notice. |
| EL-4.19 | Excavation >1 ft within 25 ft of transmission foundation | combined (partial) | el/3.md EL-3.32 | 1-ft depth trigger lost; plat-note (viii) covers general 48-hr notice but not the depth threshold. |
| EL-4.20 | Structures not maintaining NESC 234 clearance / easement restriction | combined | el/3.md EL-3.32; el/1.md EL-1.26 | Plat-note (v) covers NESC clearance restriction on structures in transmission easement. |
| EL-4.21 | Foundation excavation depths not provided to AE | removed | — | Not present as standalone check. |
| EL-4.22 | Irrigation within 25 ft of transmission structures | removed | — | Sprinkler/irrigation-near-transmission not present anywhere in 5.1; EL-1 regulatory overview omits the 25-ft rule. |
| EL-4.23 | Irrigation w/in 15-ft radius of distribution primary/neutral | removed | — | UCM 1.10.3's 15-ft radius is in 5.1 but scoped to customer facilities (EL-1.3), not irrigation specifically. |
| EL-4.24 | Fire hydrants <20 ft from transmission structures | removed | — | Not in 5.1 — fire/*.md covers hydrant spacing but not transmission-structure setback. |
| EL-4.25 | Water quality features (detention, rain gardens) in transmission ROW | removed | — | No 5.1 check for detention/bioswales blocking transmission access. |
| EL-4.26 | Compost/mulch above transmission foundations | removed | — | Dropped entirely. |
| EL-4.27 | Shrubbery obstructing transmission structure base | removed | — | Dropped entirely. |
| EL-4.28 | 25-ft turnaround / 100-ft working area obstruction | moved-within-el | el/1.md EL-1.19 | EL-1.19 covers 25-ft-wide access corridor; 100-ft working area concept is lost. |
| EL-4.29 | Medians in transmission easement not laydown curbs | removed | — | Laydown-curb requirement not present in 5.1. |
| EL-4.30 | Guy wire foundations/anchors not shown or clearances | combined (partial) | el/3.md EL-3.8; el/3.md EL-3.11 | EL-3.8 covers driveway-vs-guy-anchor conflict; EL-3.11 requires AutoCAD drawing showing guys/anchors. Specific 25-ft clearance check dropped. |
| EL-4.31 | OH facilities not relocated underground on Core Transit Corridor | moved-within-el | el/2.md EL-2.1; el/2.md EL-2.3 | Split into building-to-PL (EL-2.1) and ROW-to-rear (EL-2.3). Now expanded across CTC/Urban Roadway/TOD/NBG. |
| EL-4.32 | OH facilities not relocated underground in TOD zones | moved-within-el | el/2.md EL-2.5; el/2.md EL-2.6; el/2.md EL-2.7; el/2.md EL-2.8 | Split across Plaza Saltillo TOD (three street types) + NBG. |
| EL-4.33 | Proposed development does not meet clearances / no relocation scheduled | combined | el/1.md EL-1.2; el/1.md EL-1.3; el/1.md EL-1.26 | Clearance-violation framing preserved; explicit "schedule relocation at customer expense" not a checklist item. |
| EL-4.34 | Existing facilities in conflict not tied down w/ easement / relocation | reworded | el/2.md EL-2.21 | EL-2.21 is pole-relocation-specific and includes AE 1.3.19 consent requirement. |
| EL-4.35 | AULCC approval not obtained before OH→UG in ROW | moved-within-el | el/3.md EL-3.23 | Generalized AULCC completeness-letter check (not OH→UG specific). |
| EL-4.36 | Pole relocation costs not including all customers served | removed | — | No 5.1 cost-allocation check. |
| EL-4.37 | Removal of OH facilities serving others without continuous-service plan | removed | — | No equivalent in 5.1. |
| EL-4.38 | PUEs not vacated when facilities removed | removed | — | No 5.1 PUE-vacation item; EL-2.15 covers easement/ROW boundary conflict, not vacation. |
| EL-4.39 | "No new building without relocation" plan note | removed | — | Specific plan-note check dropped. |
| EL-4.40 | OH service proposed where only UG permitted | combined | el/2.md EL-2.1; el/2.md EL-2.5–2.8 | Subsumed by CTC/Urban/TOD/NBG undergrounding checks and Hill Country EL-2.2. |
| EL-4.41 | UG service crosses PL before disconnect switch | removed | — | No 5.1 check for disconnect-switch placement relative to PL. |
| EL-4.42 | UG electrical trenches under water meter vault | removed | — | Dropped. |
| EL-4.43 | UG electrical in dedicated parkland | moved-cross-department | el/2.md EL-2.13; el/3.md EL-3.32 | EL-2.13 prohibits transformers/util boxes in parkland; EL-3.32 plat-note (9) forbids transmission easement being labeled parkland. PARK guide also covers parkland encroachment generally. |
| EL-4.44 | Trees >50 ft / non-"UC" species near transmission | moved-cross-department (partial) | eptp/22.md EPTP-22.51; eptp/22.md EPTP-22.52 | 5.1 handles overhead-utility tree setback at 10 ft via ordinance § 6-3-62(1) and UCM 1.10.10.4 — the transmission-specific 50-ft / ECM Appendix F UC-species rule is lost. |
| EL-4.45 | Climbing vegetation on electric facilities | removed | — | Not a standalone 5.1 check. |
| EL-4.46 | Gates crossing transmission ROW <16 ft wide / no AE lock | removed | — | No 5.1 item; EL-1.19 covers 16-ft vertical clearance but not gate-width/lock. |
| EL-4.47 | Security gate encompassing transmission easement w/o 24-hr AE lock | removed | — | Dropped. |
| EL-4.48 | Slopes >8% in transmission ROW | removed | — | Dropped. |
| EL-4.49 | <16-ft vertical clearance in transmission access corridor | moved-within-el | el/1.md EL-1.19 | Cleanly carried forward as the 25-ft/16-ft corridor check. |
| EL-4.50 | Roads in transmission easement not 48,000 lb tandem axle | combined | el/3.md EL-3.32 | Plat-note (vii) explicitly states ≥48,000 lb tandem-axle capacity requirement. |
| EL-4.51 | Septic/drain field in transmission easement | removed | — | No 5.1 transmission-easement septic check. wwp guides cover septic generally but not transmission-easement prohibition. |
| EL-4.52 | Buildings <60-inch clearance from UG electric | removed | — | UCM 1.10.5 60-in rule not present as 5.1 checklist item. |
| EL-4.53 | Building installed over UG electric facilities | removed | — | Dropped. |
| EL-4.54 | Distribution facility truck access (12-ft H / 16-ft V / 72,180 lb) | partial | el/2.md EL-2.21; el/3.md EL-3.12 | EL-2.21 references AEDC 1.3.16 dimensional standard for pole relocations; EL-3.12 addresses personnel access generally. The 72,180 lb / 32,530 lb axle load specifics aren't checklist-enforced. |
| EL-4.55 | 20×35 ft setup area / 35-ft vertical for distribution | partial | el/2.md EL-2.22 | EL-2.22 transformer-pad check references UCM 1.10.4 clearances; the UCM 1.3.16 setup-area dims are in el/3 regulatory overview but not a discrete check. |

## Notable patterns

1. **Transmission specialization collapsed into plat notes.** A huge portion of 5.0 guide 4 (EL-4.18, 4.20, 4.24–4.27, 4.46–4.50) encoded permanent design rules for land inside transmission easements. 5.1 largely replaces the piece-by-piece checks with a single omnibus plat-notes item (`EL-3.32`) citing AEDC 1.16.0(8) — plan reviewers now look for eight specific required notes rather than independently verifying each restriction on the drawings. This is efficient but potentially reduces coverage for sites where the notes are present but the drawings violate the substance.
2. **Voltage-specific OSHA clearances lost as checklist rules.** 5.0 had several items differentiating 69 kV / 138 kV / 345 kV clearances (10 / 11.33 / 15.33 ft) for cranes, dumpsters, staging, spoils, scaffolding, aerial equipment. 5.1 keeps the values in el/1.md's regulatory-overview prose but does not surface them as discrete checklist items; only a generic demolition-sequence note (`EL-1.18`) exists. Voltage-stratified clearance verification appears to have been deliberately deprioritized.
3. **Vegetation / irrigation near transmission nearly eliminated.** EL-4.22 (sprinkler 25-ft), EL-4.24 (hydrant 20-ft), EL-4.25 (detention features), EL-4.26 (compost), EL-4.27 (shrubbery), EL-4.29 (laydown curbs), EL-4.45 (climbing vines), EL-4.51 (septic) are all `removed`. The 5.1 `el/` guides have essentially no coverage of "what can't be inside a transmission easement" beyond plat notes and the access corridor. EPTP's tree-setback items address only ordinary utility poles, not the transmission-easement context.
4. **Undergrounding requirements expanded, not contracted.** EL-4.31/4.32 became 7 separate checklist items (`EL-2.1–2.8`) with explicit regulating-plan coverage (Plaza Saltillo TOD per street type, NBG, Hill Country, Urban Roadways). This is the one area where 5.1 has more specificity than 5.0.
5. **One Call / § 14-11-204 / § 25-4-132 / ECM Appendix F UC-species — all absent.** Code citations that formed the basis of distinctive 5.0 items have no counterpart in 5.1, suggesting a deliberate scope reduction rather than incidental drift.
6. **`Reviewer Convention`-citation items had the highest mortality.** 5.0 EL-4.34, 4.35, 4.36, 4.37, 4.39, 4.41, 4.42 (all Reviewer Convention) — only EL-4.34 and 4.35 survived in any form. Items without code citation were preferentially dropped during retraining.

## Report

- **File written:** `/Users/winston/workspace/winston/workspaces/el-audit/el-5.0-4-audit.md`
- **Status counts:** retained 0, reworded 3, renumbered 0, moved-within-el 14, moved-cross-department 3, combined 12, split 0, partial 5, removed 18 (total 55)
- **Biggest surprise:** complete loss of voltage-stratified OSHA checklist rules and of all permanent transmission-easement vegetation/irrigation/hydrant/compost/septic prohibitions. 5.1 relies on plat-note verification (`EL-3.32`) rather than drawing-level enforcement for most of what was guide 4's substantive content.
