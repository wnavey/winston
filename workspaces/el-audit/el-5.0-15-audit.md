# Audit: EL-5.0 Guide 15 — "Transformer and Meter Documentation on Plans"

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/15.md`
**5.1 corpus:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` on branch `feat/inspection-alias-ui`; most recent el/ update at commit `aed4f1b` ("Update Austin review guides + glossary from training v5.1 (#245)"). `el-md-exp/` excluded per instructions.
**5.1 el/ files:** `el/1.md` (Overhead and Vertical Electrical Clearances), `el/2.md` (Underground Utility Routing and Placement), `el/3.md` (Austin Energy Service and ROW Utility Coordination).

## Summary

5.0 el/15 was a 49-row checklist that exhaustively documented plan-sheet artifacts for every physical component of an AE service: transformer (shown/labeled/sized/typed/routed/clearanced) across 27 rows, meters (location/grouping/flood/sight-line) across 14 rows, and miscellaneous service infrastructure (pull-box, manhole, load center, bollards, moonlight tower guy wires, switchgear) across the remainder. It was organized around UCM §§ 1.16.0, 1.9.3.1/.4, 1.10.4, 1.10.10.4, and COA § 14-11-201.

In 5.1, this "show it on every sheet and label it" discipline was almost entirely abandoned. Most of the "not shown on X plan sheet" rows were removed outright, along with all of the meter-specific checklist items (sight line to transformer, flood elevation, gas meter radius, meter-to-disconnect distance, meter labeling, grouping, meter bank). A very small residue survives:

- Transformer pad sizing, clearances, AE-truck access, and AE easement encumbering the pad → consolidated into **el/2 EL-2.22** (with numeric clearances moved into the Regulatory Overview prose, and a parallel full-clearance item living in **zlu/15 ZLU-15.40**).
- Transformer in parkland / public ROW → **el/2 EL-2.13** (also duplicated in park/5 and park/6).
- Transformer screening (on private property vs. in ROW) → moved cross-department to **sduf/9 SDUF-9.7 / SDUF-9.23 / SDUF-9.27** and **zlu/27 ZLU-27.23**.
- Moonlight tower guy-wire proximity → moved cross-department to **zlu/21 ZLU-21.6**, with permit-language notes in **el/3 EL-3.13 / EL-3.14 / EL-3.15**.
- Meter labeling by 911 unit ID → moved cross-department to **zlu/25 ZLU-25.36** (for multifamily only).
- Transformer pad impervious-cover inclusion → moved cross-department to **sde/51 SDE-51.6**.

The largest surprises:

1. Every meter item (EL-15.28 through EL-15.49, minus the handful retained in adjacent files) was dropped. No 5.1 checklist row enforces the UCM § 1.9.3.1.B line-of-sight requirement, the 1-ft-above-flood-level rule, the 3-ft gas-meter radius (UCM § 1.9.3.1.C), or the 20-ft meter-to-disconnect limit. These checks still appear in the 5.1 el/ narrative (Regulatory Overview of older 5.0 el/ files) but have no pass/fail checklist equivalent.
2. The entire "show and label on all required sheets" family (EL-15.1, 15.2, 15.4–15.6, 15.14, 15.18–15.24, 15.28, 15.30, 15.40, 15.41) was removed. 5.1 trusts that the AE design set implies these.
3. The oil-filled-transformer grading / drainage-away-from-building rule (EL-15.45) and the flammable-liquid separation rule (EL-15.46) are both dropped.
4. The Network Area niche-service exception (EL-15.25) is dropped as a checklist row; the concept survives only in the Regulatory Overview of the old 5.0 material — no 5.1 el file currently covers it.

## Status counts

- retained: 0
- reworded: 1 (EL-15.43 → zlu/21 ZLU-21.6, wording tightened and code citation adjusted)
- renumbered: 0
- moved-within-el: 2 (EL-15.8, EL-15.47)
- moved-cross-department: 6 (EL-15.18 → sduf/9 + zlu/27; EL-15.32 / EL-15.19 partially absorbed into zlu/25; EL-15.43 → zlu/21; implicit moves noted in table)
- combined: 4 (EL-15.8, EL-15.9, EL-15.13, EL-15.17 all fold into el/2 EL-2.22)
- split: 0
- removed: 31
- partial: 5 (paired with primary classification where unsure)

(Numbers include `partial` classifications alongside their primary — "partial" totals reflect rows where only a fragment of the 5.0 intent is preserved.)

## Main audit table

| 5.0 ID | Deficiency (truncated) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-15.1 | Transformer locations not shown on all required plan sheets | removed | — | "Shown on sheets X/Y/Z" discipline dropped across 5.1. |
| EL-15.2 | Transformer type (pad-mounted, pole, vault, service drop) not specified | removed | — | Labeling-level check dropped. No 5.1 row requires type callout. |
| EL-15.3 | Pole locations not shown on all plan sheets | removed | — | Pole-show check dropped; nearest survivor is ta/22 TA-22.4 (generic ROW obstructions), not EL-specific. |
| EL-15.4 | Transformer locations not shown on elevation sheets | removed | — | Elevation-sheet discipline dropped. |
| EL-15.5 | Existing transformer locations not shown on all applicable sheets | removed | — | "Existing utility shown" survives only for AE overhead via el/1 but not transformers. |
| EL-15.6 | Transformer locations not consistent across all plan sheets | removed | — | Cross-sheet consistency check dropped. |
| EL-15.7 | Transformer routing not shown on landscape plan to verify tree clearances | partial | eptp/10 EPTP-10.19 | 5.1 enforces tree/transformer separation via landscape plan but does not require a "routing shown" artifact. |
| EL-15.8 | Transformer clearances not shown on plans | combined; moved-within-el | el/2 EL-2.22; zlu/15 ZLU-15.40 | Clearance requirement itself survives; the "shown on plans" framing does not. ZLU-15.40 carries the full numeric clearance check with building-type qualifier. |
| EL-15.9 | Transformer clearances from building features (windows, stairs, doors) not demonstrated on architectural sheets | combined | el/2 EL-2.22; zlu/15 ZLU-15.40 | Architectural-sheet dimension check folded into pad-clearance items. "Windows/doors/stairs" specificity dropped. |
| EL-15.10 | Plan and profile exhibits showing proximity to existing electrical facilities not provided | removed | — | Plan-and-profile exhibit requirement dropped from checklists (narrative mention only in el/1 regulatory overview). |
| EL-15.11 | Transformer pad distance from existing overhead lines not shown | partial | el/1 EL-1.2, EL-1.3 | 5.1 enforces the 7.5-ft/15-ft clearances from overhead to customer facilities but does not explicitly require the pad-to-overhead dimension to be labeled. |
| EL-15.12 | Laydown curb not shown/labeled in transmission easement or along transformer access routes | removed | — | EL-specific laydown-curb-in-transmission-easement check dropped. Nearest 5.1 items (eptp/16 EPTP-16.12, eptp/18 EPTP-18.48, ta/9 TA-9.39, ta/22 TA-22.39) govern parking-lot islands and sidewalk tie-ins — a different use of "laydown curb." UCM § 1.14.4.E 46,000-lb load rule is gone. |
| EL-15.13 | Drivable access routes to transformer pads not shown | combined | el/2 EL-2.22; el/3 EL-3.12 | "Accessible to AE service trucks" survives in EL-2.22; EL-3.12 covers access to AE facilities more generally (12-ft width, 16-ft clearance). |
| EL-15.14 | Underground electric cabling routing from service stubs to transformer pad not shown | removed | — | Routing-shown artifact dropped. |
| EL-15.15 | Profile showing transformer routing crosses stormwater piping not provided | removed | — | Profile-at-crossing rule dropped; el/1 EL-1.9 covers 12-in perpendicular-crossing clearance but not "profile provided." |
| EL-15.16 | Transformer door location not clearly indicated | removed | — | Door-orientation artifact dropped. Door-swing language survives only in EL-15.18's partial descendant (sduf/9 SDUF-9.7 — "screening method identified"). |
| EL-15.17 | Electrical easement around transformer not shown or not adequate | combined | el/2 EL-2.22 | "Lacks a dedicated AE easement encumbering the pad area" language in EL-2.22 preserves the concept. |
| EL-15.18 | Transformer screening extent, dimensions, and door swings not shown on all plan sheets | moved-cross-department | sduf/9 SDUF-9.7, SDUF-9.23, SDUF-9.27; zlu/27 ZLU-27.23 (ERC only) | Screening moved out of el/. Door-swing element dropped. SDUF-9.23 adds the important ROW exemption ("electric service transformers in the ROW are explicitly exempt from screening"). |
| EL-15.19 | Transformer labels missing on plans | removed | — | Labeling check dropped (general); zlu/25 ZLU-25.36 covers meter labels for MF only. |
| EL-15.20 | Transformer size not specified | removed | — | Size-callout check dropped; pad dimensions now governed by AE Design per EL-2.22 narrative. |
| EL-15.21 | Transformer pad dimensions not consistent across all plan sheets | removed | — | Cross-sheet-dimension-match check dropped. |
| EL-15.22 | Transformer quantity not adequate to serve all buildings | removed | — | Quantity check dropped. ESPA/EL-3.1 implicitly covers load but not transformer count. |
| EL-15.23 | Transformer metering method not labeled (CT metered / building metered) | removed | — | Metering-method label check dropped. |
| EL-15.24 | Transformers not delineated in legend as proposed utilities | partial | wwp/37 WWP-37.33 | Nearest analog is WWP-37.33 ("Transformer pad symbols appear on the plan but are not defined in the plan legend") — useful fallback but housed in wwp/ rather than el/. |
| EL-15.25 | Transformer niche plan and profile not provided; AE Design consultation missing | removed | — | Niche-service checklist item dropped. Concept appears only in passing in el/2 EL-2.13 applicability prose ("padmount/vault/niche equipment must be on customer's property"). Network Area framing entirely absent from 5.1 checklists. |
| EL-15.26 | Each site in multi-site development does not have its own transformer | removed | — | Multi-site-per-transformer rule dropped. |
| EL-15.27 | Switchgear location not shown when required | partial | wwp/29 WWP-29.48 | WWP-29.48 requires generators/switchgear/UPS locations on plan per LDC § 25-12-173 — broader scope, but captures the switchgear-not-shown concept outside el/. |
| EL-15.28 | Meter locations not shown on all required plan sheets | removed | — | All meter-location-show items dropped. |
| EL-15.29 | Meter bank/rack locations not shown | removed | — | Meter-bank rule dropped; zlu/25 ZLU-25.36 covers meter-bank labeling for MF only. |
| EL-15.30 | Existing meter locations not shown | removed | — | Existing-meter discipline dropped. |
| EL-15.31 | Meters and disconnects not grouped when served from one service point | removed | — | Grouping rule dropped. UCM § 1.9.3.4 narrative not carried forward to any 5.1 checklist. |
| EL-15.32 | Meters and disconnects not labeled on plans | partial | zlu/25 ZLU-25.36 | Preserved only for multifamily-specific 911-unit-ID labeling. Generic "meter labeled" dropped. |
| EL-15.33 | Meter locations not within sight of AE transformer (UCM § 1.9.3.1.B) | removed | — | Line-of-sight meter rule entirely dropped from 5.1 checklists. |
| EL-15.34 | Meter not 1 ft above flood level when site subject to 100-yr flood datum | removed | — | Closest survivor is fwp/7 FWP-7.43 (generator/emergency-power/transformer above DFE) — different equipment scope; meter-specific rule dropped. |
| EL-15.35 | Point-of-service location not shown | partial | el/3 EL-3.3 | EL-3.3 addresses "point of service in AE service area" (availability letter) rather than the geometric POS location. Concept weakened. |
| EL-15.36 | Service conductors from point of service to AE facilities not shown | removed | — | Dropped. |
| EL-15.37 | Pull box locations not shown | removed | — | Pull-box-show check dropped. Nearest 5.1 references are el/1 EL-1.9 (perpendicular crossings include pull-boxes) and wwp/21 WWP-21.43 (existing pull boxes on profiles — wwp scope). |
| EL-15.38 | Existing pull box locations not shown | removed | — | See EL-15.37. wwp/11 WWP-11.3 requires existing overhead pull-boxes on wwp plans — wwp scope only. |
| EL-15.39 | Load center locations not shown | removed | — | Load-center-show rule dropped. |
| EL-15.40 | Manhole locations not shown on all required plan sheets | removed | — | Dropped from el/. wwp/ covers sanitary manholes; no 5.1 el row for electrical manholes. |
| EL-15.41 | Existing manhole locations not shown | removed | — | See EL-15.40. |
| EL-15.42 | Pole or driveway relocation required not shown | partial | el/3 EL-3.8; el/2 EL-2.21 | EL-3.8 (driveway conflicts with guy anchor, AE coordination) and EL-2.21 (power pole relocation coordination) partially absorb this; "shown on plans" framing dropped. |
| EL-15.43 | Moon Tower guy post and guy wire locations not shown when construction within 100 ft | reworded; moved-cross-department | zlu/21 ZLU-21.6; el/3 EL-3.13, EL-3.14, EL-3.15 | ZLU-21.6 is the checklist item nearest 5.0's intent (requires identification on plans within 100 ft). El/3 items cover plan notes and the 25-ft ROW prohibition. Citation shifted from LDC/COA combo to COA § 14-11-201 alone. |
| EL-15.44 | Bollards not shown or spaced to allow door opening when pad within 4 ft of traffic | partial | zlu/15 ZLU-15.40 | ZLU-15.40 carries the "bollards when ≤ 4 feet" condition into its clearance table but does not explicitly test door-opening spacing. Specificity reduced. |
| EL-15.45 | Grading around oil-filled transformer does not direct liquid flow away from building | removed | — | UCM 1.10.4 Table 1.10.4 footnote 1 rule dropped entirely. |
| EL-15.46 | Transformer pad near flammable liquids without AE Design approval | removed | — | Flammable-liquid separation rule dropped. |
| EL-15.47 | Transformer equipment shown in public ROW instead of customer property | moved-within-el | el/2 EL-2.13; park/5 PARK-5.3; park/6 PARK-6.17 | EL-2.13 covers parkland + "not in public ROW"; park/ duplicates the parkland portion. |
| EL-15.48 | Meter within 3-ft radius of gas meters, regulators, relief valves, or electrical apparatus | removed | — | UCM § 1.9.3.1.C 3-ft gas-meter radius dropped. |
| EL-15.49 | Meter-to-disconnect distance >20 ft or not within line of sight of each other | removed | — | UCM § 1.9.3.1.J 20-ft rule dropped. |

## Patterns

1. **"Shown on sheets" discipline abandoned.** 5.0 el/15 had 20+ rows of the form "X not shown on [site plan / wet utilities / landscape / elevation / grading / storm] sheet." 5.1 drops this pattern uniformly and instead relies on whether the substantive rule (clearance, easement, access) is testable from any plan sheet.
2. **Meter chapter entirely excised.** Every UCM § 1.9.3.x meter rule (line of sight, flood elevation, gas proximity, disconnect distance, grouping, bank labeling) is gone from the 5.1 el/ checklist. The multifamily 911-unit-ID meter label (zlu/25 ZLU-25.36) is the only survivor.
3. **Screening moved out of el/.** Any transformer-screening concept is now a site-design/urban-form review (sduf/9, zlu/27), not an electrical-review deficiency.
4. **Clearance numerics moved to regulatory-overview prose.** 5.0 itemized bollard-at-4-ft, 6-ft-from-parking, hot-stick sides, brick/masonry differentiation. 5.1 inlines all of this into the EL-2.22 narrative and the zlu/15 ZLU-15.40 row, replacing row-per-rule granularity with a single composite row.
5. **Plan-and-profile exhibit checks dropped.** The "profile provided / plan and profile exhibit" family (EL-15.10, 15.15) is entirely absent from 5.1 checklist rows.
6. **Network Area / niche-service concept lost.** The UCM § 1.11.5 Network Area framework and the niche-service exception (5.0 EL-15.25) do not appear in any 5.1 el/ checklist row. This is arguably the most consequential substantive loss.
7. **Cross-department redundancy.** Transformers-in-parkland now appears in el/2, park/5, and park/6. Screening appears in sduf/9 and zlu/27. This reflects 5.1's consolidation strategy: rules common to multiple departments migrated to department-specific guides, sometimes in duplicate.
