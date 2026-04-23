# Audit: EL-5.0 Guide 12 — "Electric Equipment Clearances and Technical Documentation"

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/12.md`
**5.1 corpus:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` on branch `feat/inspection-alias-ui`; most recent el/ update at commit `aed4f1b` ("Update Austin review guides + glossary from training v5.1 (#245)")
**5.1 el/ files:** `el/1.md` (Overhead and Vertical Electrical Clearances), `el/2.md` (Underground Utility Routing and Placement), `el/3.md` (Austin Energy Service and ROW Utility Coordination). `el-md-exp/` excluded per instructions.

## Summary

5.0 el/12 was a 74-row omnibus on AE equipment clearances and the associated documentation/exhibits. Topics spanned: setup areas and truck access (1–2, 17, 26, 57), niche and vault construction (3, 16), padmount/switchgear/vista gear clearances (5–7, 46–48, 58–61), underground clearances and crossings (14–15, 22–24, 62–63), overhead clearances and conflicts (8–13, 19–20, 27–36), transmission features (10–11, 28, 56, 65–68, 73), meters/SDE (45), electrical documentation artifacts (37–39, 42–43, 55), required plat/cover-sheet notes (25, 40, 44, 50–54, 64, 69–74), and a miscellaneous design-compatibility group (18, 21, 41, 49, 59–60).

In 5.1, this content was redistributed across the three surviving el/ files and (lightly) into eptp/ for transmission-area vegetation. **el/1.md** absorbed all overhead-clearance and exhibit-documentation content, the transmission clearance and access-corridor items, and the elevation/plan-profile exhibit items. **el/2.md** absorbed the padmount/vista/switchgear clearances, floodplain elevation requirement, parkland exclusion, and transformer sizing/easement items. **el/3.md** absorbed the AE land-development submittal items (AutoCAD, plat notes, conceptual-design coordination) and the plat-note list (via AEDC 1.16.0(8) / EL-3.32).

The retraining substantially consolidated granular items — in particular, the individual padmount clearance rows (5–7, 46–48, 58–61) collapsed into a single omnibus EL-2.22, the elevation-exhibit rows (27–36) largely collapsed into EL-1.26 / EL-1.27 / EL-1.28, and the separate plat-note rows (69–73) collapsed into EL-3.32 (eight-note bundle under AEDC 1.16.0(8)).

**Notable removals/gaps vs 5.0:**
- **Niche service checks** (EL-12.3 entrance clearance) — no dedicated row; niche mentioned only in prose of el/2.
- **8-ft clearance around pedestals/subsurface vaults/manholes** (EL-12.4) — survives only as a parenthetical in el/2's Regulatory Overview; no checklist row.
- **Vault fire rating / NEC Article 450 / UCM 1.11.1.Q** (EL-12.16) — NEC Article 450 references gone entirely; vault construction not a standalone check.
- **Structures-in-easement vehicle-load ratings** (EL-12.17; 72,180 lb / 48,000 lb tandem axle) — collapsed into EL-3.32 bullet (vii) for transmission easements only; distribution-easement structural rating dropped as standalone check.
- **Meter banking/grouping per UCM § 1.9.3.4** (EL-12.45) — removed; no 5.1 equivalent.
- **One Call note** (EL-12.64) — removed.
- **Cross-section details at storm/water crossings** (EL-12.22–23; including crossings with underground electric) — compressed into EL-1.12 (crossing method trenchless/open-cut only); the "elevations on crossings" and "cross-section drawings required" rows are dropped.
- **Conceptual-design / not-for-bidding disclaimer notes** (EL-12.50–51) — removed.
- **Relocation-cost / service-continuity / OH-to-UG-conversion / existing-facilities-protection notes** (EL-12.40, 52–54) — all removed.
- **Building construction type callout** (EL-12.41) — removed as a standalone row; logic folded into el/12 Regulatory Overview prose of 5.0 but not surfaced in 5.1.
- **Electrical documentation artifacts** — single line diagram (37), lighting plan/foot candles (38), RCP (39), riser rooms (42), conduit size callouts (43), electric rooms (55) — all removed as el/ checklist items. Street lighting retained separately in el/3 (EL-3.18/20/21) but at the coordination level, not design-artifact level.
- **AutoCAD version / georeferencing / north arrow** (EL-12.74) — survives but only for the AE land-development submittal itself (EL-3.11), not as a general plan check.

## Status counts

- retained: 0
- reworded: 5 (EL-12.1, EL-12.2, EL-12.8, EL-12.10, EL-12.19 — each now appears with different framing in el/1 or el/2)
- renumbered: 0
- moved-within-el: 14 (EL-12.14, 18, 21, 26, 56, 57, 65, and others now in el/1 or el/2)
- moved-cross-department: 1 (EL-12.56 → eptp/10 EPTP-10.22 for transmission-easement vegetation; also tracked in eptp/28)
- combined: 19 (the padmount-clearance cluster → EL-2.22; the plat-note cluster → EL-3.32; the elevation-exhibit cluster → EL-1.26–1.28)
- split: 0
- removed: 30
- partial: 5

(Totals 74. "moved-within-el" counts items whose primary intent survives as a distinct row in a different el/ guide; "combined" counts items absorbed into an omnibus row alongside other 5.0 items; "partial" means the concept is present but substantively narrowed or weakened.)

## Main audit table

| 5.0 ID | Deficiency (truncated) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-12.1 | Setup area in front of AE equipment not min 20 ft × 35 ft horizontal per UCM § 1.3.16 | reworded | el/2 Regulatory Overview "AE Facility Access and Relocation"; el/2 EL-2.21 (partially) | Setup-area dimensions described in prose under UCM 1.3.16; EL-2.21 cites 1.3.16 in context of power-pole relocation. No standalone "equipment setup area dimension" checklist row. |
| EL-12.2 | Setup area vertical clearance not min 35 ft per UCM § 1.3.16 | reworded | el/2 Regulatory Overview | Same 35-ft vertical mentioned in prose only; no standalone row. |
| EL-12.3 | Min 35-ft vertical clearance not provided inside niche and niche entrance | removed | — | Niche configuration mentioned only glancingly in el/2 EL-2.13 note; no 35-ft-in-niche check retained. |
| EL-12.4 | Min 8 ft clearance around pedestals, subsurface vaults, manholes | partial | el/2 Regulatory Overview (prose mention of "8-foot minimum clearance around all pedestals and subsurface AE vaults/manholes") | Exists as a regulatory statement but not as a checklist item. |
| EL-12.5 | Switchgear clearance in front of door not min 10 ft (hot-stick) | combined | el/2 EL-2.22 | Rolled into transformer-pad-clearance omnibus; hot-stick 10-ft cited in item text. |
| EL-12.6 | Protective bollards 4-in min galvanized when equipment within 4 ft of parking/traffic | removed | — | No bollard-spacing checklist item retained anywhere in el/. |
| EL-12.7 | Clearances from padmount/distribution vaults not shown or fail UCM § 1.10.4 | combined | el/2 EL-2.22 | Principal landing for all padmount-clearance checks. |
| EL-12.8 | Proposed buildings/awnings/canopies not maintaining clearances from OH conductors (7.5 ft, 15 ft radial) | reworded | el/1 EL-1.2; el/1 EL-1.3 | Split into two rows in 5.1 — one per clearance threshold; both must be satisfied simultaneously. |
| EL-12.9 | Customer facilities installed under or over AE OH distribution (prohibited) | combined | el/1 EL-1.3 | Absolute "under or over" prohibition captured at end of EL-1.3. |
| EL-12.10 | Above-ground obstructions within 100 ft of transmission structure without AE approval | reworded | el/1 EL-1.18; el/1 EL-1.25 | 100-ft-from-transmission prose rephrased as pre-construction safety/barricade/spoils-in-easement checks (UCM 1.14.9). 5.0's standalone "100-ft obstructions" concept is only partially captured. |
| EL-12.11 | Buildings near HV OH facilities do not account for AE-engineering-determined clearances | partial | el/1 EL-1.26 | EL-1.26 flags missing AE transmission-review documentation but does not itemize specific building-clearance-analysis deficiencies. |
| EL-12.12 | OSHA/AE clearance compliance not demonstrated during construction (10 ft for ≤50 kV; higher for HV) | partial | el/1 EL-1.6 (partial); el/1 EL-1.18 (transmission-specific) | OSHA 1910.333 10-ft at ≤50 kV reflected via UCM 1.10.2 reference, but not as a dedicated "demonstrate during construction" check for distribution. |
| EL-12.13 | Existing OH facilities don't meet AE/NESC/OSHA clearances; upgrade/burial plan or easement not provided | removed | — | No direct equivalent. el/2 coverage of CTC/Urban Roadway undergrounding is condition-specific, not a general deficient-clearance remediation. |
| EL-12.14 | Clearances from AE underground cable/conduit/facilities not shown or fail UCM § 1.10.5 (60 in from bldgs, 12 in, 24–36 in from gas) | moved-within-el | el/1 EL-1.9 (12-in perpendicular crossing); el/2 EL-2.22 (pad clearances); — | 60-in UG-to-building clearance not preserved as a dedicated row. 12-in crossing preserved. 24–36-in gas/fuel preserved in EL-1.9 as "fuel lines and high-pressure gas (≥60 psi) require 36-inch." |
| EL-12.15 | OSHA/AE clearance compliance from UG infrastructure during construction not demonstrated | removed | — | |
| EL-12.16 | Vault 3-hour fire rating per NEC Article 450 and UCM § 1.11.1.Q not shown; vault opening clearances | removed | — | No NEC Article 450 or UCM 1.11.1.Q references in any 5.1 el/ file. Vault construction detail check dropped entirely. |
| EL-12.17 | Structures within easement not designed for AE vehicle weights (72,180 lbs distribution; 48,000 lbs tandem axle transmission) | partial | el/3 EL-3.32 (bullet vii — 48,000 lb tandem axle for transmission easement) | Transmission-easement road-load preserved via EL-3.32; 72,180-lb distribution structural rating dropped as standalone. |
| EL-12.18 | Distance from transformer pad to building exceeds AE-allowed distance | removed | — | No transformer-pad distance-to-building check retained. |
| EL-12.19 | Rain garden / bio-retention clearances from OH distribution or transmission ROW | reworded | sde/29 (general prohibition on drainage/filtration/detention in transmission easement, UCM 1.14.7.C) | Rain-garden-specific "7.5-ft horizontal / 15-ft radial" check dropped; transmission-ROW prohibition moved cross-department to sde/. |
| EL-12.20 | Detention pond clearances from electric conductors not demonstrated / resolved | moved-cross-department | sde/29 (prose & UCM 1.14.7.C reference) | |
| EL-12.21 | Proposed structures conflict with existing electric facilities — redesign/relocation not addressed | partial | el/2 EL-2.21 (power-pole relocation); el/3 EL-3.8 (pole guy anchor) | Broad "conflicts not addressed" concept narrowed to pole-relocation and guy-anchor-conflict cases. |
| EL-12.22 | Cross-section details not provided where storm drains/water cross UG electric | partial | el/1 EL-1.12 | EL-1.12 requires crossing method (trenchless/open-cut) to be identified for crossings with AW mains; does not require cross-sections for all storm/water-over-electric crossings. Concept narrowed. |
| EL-12.23 | Cross-section utility design drawings not provided with horizontal/vertical clearances between UG electric and crossing utilities | partial | el/1 EL-1.9; el/1 EL-1.12 | Similar narrowing — dimensional clearance capture preserved for specific rules; general "cross-section required" dropped. |
| EL-12.24 | Elevations not provided on utility crossings | removed | — | |
| EL-12.25 | AE lock not specified on gates/barriers restricting access | partial | el/3 EL-3.12 (general "development must not limit AE access" framing); el/1 EL-1.23 (SCM access, but not AE-specific lock) | No "AE lock" language found anywhere in 5.1 corpus. Transmission-gate AE lock (EL-12.68) also removed. |
| EL-12.26 | Truck access path not min 12 ft horizontal, 16 ft vertical, 72,180-lb surface | moved-within-el | el/2 Regulatory Overview (full restatement of UCM 1.3.16 dimensions); el/2 EL-2.21 (embedded in pole-relocation check); el/3 EL-3.12 | Dimensions preserved only in prose and inside scoped rows; no standalone generic "truck access" check. |
| EL-12.27 | Building elevations not provided showing streets, streetlights, electric poles | combined | el/1 EL-1.26 | Omnibus "clearance zones not graphically delineated" row. |
| EL-12.28 | Transmission lines not shown on building elevations | combined | el/1 EL-1.26 | Same; EL-1.26 covers both distribution and transmission envelope graphical representation. |
| EL-12.29 | Building elevations not showing relationship between buildings and electric easements/facilities | combined | el/1 EL-1.26; el/1 EL-1.27 | |
| EL-12.30 | Poles/OH lines/conductors/cross arms/prop boundaries not shown on building elevations | combined | el/1 EL-1.26 | |
| EL-12.31 | Retaining wall elevations / footing details not shown near OH facilities | removed | — | |
| EL-12.32 | Pole-and-cross-arm section/plan-view exhibit with dimensions from outer conductor | combined | el/1 EL-1.5; el/1 EL-1.26 | EL-1.5 "measure from outermost conductor, not pole centerline" is the modern equivalent of the 8-ft-cross-arm exhibit concept. |
| EL-12.33 | Clearance exhibits missing AE/NESC/OSHA clearance envelopes | combined | el/1 EL-1.26 | |
| EL-12.34 | Exhibit not provided showing dimensions from buildings to proposed electric routing | combined | el/1 EL-1.26 | |
| EL-12.35 | Plan and profile not submitted to verify existing electric vs. proposed buildings | removed | — | |
| EL-12.36 | Plan and profile views not provided where proposed facilities cross existing electric | removed | — | |
| EL-12.37 | Single line diagram not provided | removed | — | Electrical design artifacts dropped from site-plan review scope. |
| EL-12.38 | Lighting plan / foot candles / fixture types not provided | removed | — | No foot-candle/lighting-plan row in el/; street lighting coordinated at pole-spacing level (el/3 EL-3.18, EL-3.21) not design-sheet level. |
| EL-12.39 | Reflected ceiling plan not provided | removed | — | |
| EL-12.40 | Plans don't show how existing customers will continue to be served during relocation | removed | — | Service-continuity-during-relocation concept dropped entirely. |
| EL-12.41 | Building construction type (brick/masonry 2-hr fire rating vs. other) not shown | reworded | el/2 Regulatory Overview (implicit in Table 1.10.4 reference within EL-2.22) | No standalone construction-type labeling check; reviewer expected to default to non-brick/masonry clearances via EL-2.22 text. |
| EL-12.42 | Riser rooms not labeled on electrical/architectural floor plans | removed | — | |
| EL-12.43 | Conduit sizes not called out/labeled on utility plan | removed | — | |
| EL-12.44 | Transmission notes not removed/added as appropriate on coversheet, grading, landscape | combined | el/3 EL-3.32 | EL-3.32 handles the eight AEDC 1.16.0(8) plat notes when transmission easement is present; "remove if not present" framing not preserved. |
| EL-12.45 | Meters not banked/grouped per UCM § 1.9.3.4 | removed | — | No meter-banking or 1.9.3.4 reference anywhere in 5.1 el/. |
| EL-12.46 | Vista gear / switchgear not shown with required clearances/dimensions | combined | el/2 EL-2.22 | Vista-specific language dropped; absorbed into omnibus padmount clearance row. |
| EL-12.47 | Vista gear not on private property with 10×10 footprint and 10-ft F/R clearance | removed | — | Vista-specific check dropped. |
| EL-12.48 | Switchgear dimensions not shown with clear area (20×20 or 30×15) on private property | removed | — | Switchgear clear-area check dropped as a standalone row. |
| EL-12.49 | Plans don't show compliance with UCM § 1.3.0 basic requirements | removed | — | |
| EL-12.50 | Plans don't note electric facilities shown are conceptual | removed | — | |
| EL-12.51 | Plans don't note that electric facility layout should not be used for bidding | removed | — | |
| EL-12.52 | Plans don't note relocation costs at landowner/developer expense | removed | — | |
| EL-12.53 | Note not added about OH-to-UG conversion | removed | — | |
| EL-12.54 | Note not added about existing facilities protected during construction | removed | — | |
| EL-12.55 | Electric room requirements not addressed on plans | removed | — | |
| EL-12.56 | Landscaping species type in transmission areas not labeled | moved-cross-department | eptp/10 EPTP-10.22; eptp/28 EPTP-28.29 | Transmission-easement vegetation and utility-compatible species moved to EPTP reviews (ECM Appendix F / UCM 1.10.10.3 / 1.10.10.4). |
| EL-12.57 | AE equipment not min 2 ft above 100-year floodplain | moved-within-el | fwp/7 FWP-7.9 (ancillary buildings including AE utility vaults) | FWP item covers AE utility vaults under LDC 25-12-53(C)(1), capturing the concept via the FFE freeboard requirement rather than UCM 1.3.16. No el/ row retained; partial because threshold is now FFE-based, not "2 ft above 100-yr" specifically. Classified as moved-within-el to "moved-cross-department" — FWP is a different review guide. |
| EL-12.58 | Equipment pads not within 6 ft of parking/traffic | combined | el/2 EL-2.22 | Explicitly preserved in EL-2.22 text ("pad within 6 ft of parking/traffic area for truck access"). |
| EL-12.59 | Equipment pads not min 2 ft from back of sidewalks | combined | el/2 EL-2.22 | Explicitly preserved in EL-2.22 text. |
| EL-12.60 | Transformer pads near flammable liquids (prohibited) | removed | — | Flammable-liquid prohibition not carried into any 5.1 checklist row. |
| EL-12.61 | Reduced pad clearance without AE Design written approval per UCM § 1.10.4 footnote 2 | combined | el/2 EL-2.22 | Footnote-2 exception prose preserved indirectly ("clearances per UCM § 1.10.4") but no standalone "reduced without approval" row. |
| EL-12.62 | UG AE facilities not min 60 in horizontal from customer building/foundation | removed | — | The 60-inch underground-to-building horizontal clearance is absent from all 5.1 el/ files. Significant omission. |
| EL-12.63 | Concrete encasement not shown at utility crossings (2-in/24 in; 3-in/36 in for fuel/gas) | removed | — | |
| EL-12.64 | Plans do not document One Call notification before digging | removed | — | One Call note lives only in wwp/39 Construction Notes (Note 2: Texas 811); not in el/. |
| EL-12.65 | Transmission access corridor not min 25 ft wide with 16 ft vertical | moved-within-el | el/1 EL-1.19 | Directly preserved. |
| EL-12.66 | Grade slopes in transmission ROW exceed 8% | removed | — | UCM 1.14.4(D) 8%-slope transmission-ROW rule not preserved as a checklist row. |
| EL-12.67 | Curbing in transmission ROW not lay-down curbs | removed | — | UCM 1.14.4(E) lay-down-curb-in-transmission-ROW rule dropped. |
| EL-12.68 | Transmission gates not min 16 ft wide or no AE lock | removed | — | UCM 1.16.0(8)(vi) gate-width + lock rule dropped. |
| EL-12.69 | Plat note: AE pruning rights | combined | el/3 EL-3.6 (bullet 1 of Standard AE Notes); el/3 EL-3.32 (bullet i of AEDC 1.16.0(8) plat notes) | Present in both the four Standard AE Notes and the AEDC 1.16.0(8) plat-note bundle for transmission easements. |
| EL-12.70 | Plat note: owner responsibility for tree pruning/removal within 10 ft of centerline of OH facilities | combined | el/3 EL-3.6 (bullet 3) | Preserved as part of Standard AE Notes. |
| EL-12.71 | Plat note: temporary erosion control, revegetation, tree protection | combined | el/3 EL-3.6 (bullet 3); el/3 EL-3.32 (bullet iii) | |
| EL-12.72 | Plat note: owner responsibility for NESC/NEC/OSHA/City/Texas clearance maintenance | combined | el/3 EL-3.6 (bullet 4); el/3 EL-3.32 (bullet iv) | |
| EL-12.73 | Land in transmission easement proposed/labeled as parkland (prohibited) | combined | el/3 EL-3.32 (final clause); el/2 EL-2.13 (parkland exclusion) | Dual coverage — EL-3.32 handles the AEDC 1.16.0(9) rule, EL-2.13 handles parkland-vs-AE-equipment generally. |
| EL-12.74 | Electronic drawing not AutoCAD 2016+, georeferenced, missing north arrow | partial | el/3 EL-3.11 | Preserved only for AE land-development-submittal drawings, not as a general plan-set check. |

## Patterns

1. **Documentation artifacts purged.** 5.0 treated many plan artifacts (single-line diagrams, RCPs, lighting photometrics, riser-room labels, conduit sizes, electric rooms, conceptual-vs-final disclaimers, not-for-bidding notes, service-continuity notes, relocation-cost notes, facility-protection notes, OH-to-UG conversion notes, meter banking labels, 60-in UG-to-building, cross-section elevations) as independent checklist items. Almost all of these were removed from 5.1 — consistent with retraining away from items that a plan-reading agent cannot reliably verify from site-plan data alone.

2. **Omnibus consolidation.** Four 5.1 "landing pad" rows absorbed most surviving 5.0 content: **EL-2.22** (padmount/vault/transformer clearances — absorbs 12.5, 12.6 partial, 12.7, 12.46, 12.58, 12.59, 12.61), **EL-1.26** (clearance-envelope graphical delineation — absorbs 12.27–12.34), **EL-3.32** (transmission-easement plat notes via AEDC 1.16.0(8) — absorbs 12.17 partial, 12.44, 12.69, 12.71, 12.72, 12.73), and **EL-3.6** (four Standard AE Notes — absorbs 12.69, 12.70, 12.71, 12.72). The omnibus approach reduces row count but moves specificity into the row descriptions.

3. **Transmission ROW physical-design content (curbing, grades, gates, vegetation species) largely gone.** Only access-corridor width/vertical-clearance (EL-1.19) and access-road tandem-axle load (EL-3.32 bullet vii) survive. The 8% slope, lay-down curb, and 16-ft gate checks have no 5.1 equivalent. Transmission-area species labeling migrated cross-department to EPTP (ECM Appendix F framework).

4. **Cross-department migrations.** Detention-pond-in-transmission-easement moved to sde/29 (UCM 1.14.7.C); floodplain elevation for AE equipment moved to fwp/7 (LDC 25-12-53(C)(1) FFE framework); transmission-zone species labeling to eptp/10 and eptp/28.

5. **NEC Article 450 and UCM 1.11 vault references are gone entirely.** Network Area / niche / vault terminology survives only as prose in el/2 and a single mention in el/2 EL-2.13. Any vault-construction fire-rating check has no checklist-row equivalent — a notable gap given the 5.0 prominence of this topic.

6. **Clearance-measurement rule elevated.** 5.0's EL-12.32 (pole-cross-arm exhibit with dimensions from outer conductor) is preserved more sharply as EL-1.5 — a dedicated row specifically targeting the "measured from pole centerline, not outer conductor" error, which 5.0 identified as the single most common measurement violation. This is an improvement in specificity.
