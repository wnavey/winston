# Audit: el/7.md — Electric Easement Legal Documentation (5.0 → 5.1)

- **5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/7.md` (worktree @ `ced6e10`)
- **5.1 corpus:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` @ commit `8fccc32b3` (main; training v5.1 merged via PR #245 `aed4f1b13`)
- **5.0 items audited:** 24 (EL-7.1 through EL-7.24)

## Summary

5.0 el/7.md was entirely devoted to the legal documentation layer of electric easements — separate-instrument dedication, metes and bounds survey exhibits, title documents, unified development, transmission encroachment agreements, and a long catalog of required plat notes. In 5.1 (el/1.md, el/2.md, el/3.md), most of this legal/documentation machinery was **removed** as standalone checklist items; a few pieces of regulatory narrative survive in the "Regulatory Overview" sections of el/2.md and el/3.md but without corresponding checklist items. The mandatory-plan-note items (EL-7.12–EL-7.16, EL-7.19, EL-7.21–EL-7.24) were **combined** into just two 5.1 checklist items: EL-3.6 (the "four Standard Austin Energy Notes") and EL-3.32 (the consolidated transmission-easement plat-notes item under AEDC 1.16.0(8)/(9)). The license-agreement concept (EL-7.10) was generalized into EL-2.16 (easement licensing — covers landscape/paving/structures). No items were split.

The biggest semantic loss: the actionable checks for **separate-instrument dedication vs. plat dedication** (EL-7.1), **metes and bounds exhibits** (EL-7.2, EL-7.3), **title commitment / ALTA submission** (EL-7.4), **cross-property facilities & unified development** (EL-7.7), **Austin Energy pre-approval for easements crossing transmission easements** (EL-7.8), **Law Department encroachment agreements for transmission-easement construction** (EL-7.9), and **inadequate existing transmission easements on subdivision** (EL-7.20) have no 5.1 checklist counterpart. The citation basis (Code §§ 14-1-11/-21/-22, § 15-9-123, UCM 1.3.8, UCM 1.14.7) is almost entirely absent from 5.1 el/.

## Status counts

| Status | Count |
|---|---|
| retained | 0 |
| reworded | 0 |
| renumbered | 0 |
| moved-within-el | 0 |
| moved-cross-department | 0 |
| combined | 9 |
| split | 0 |
| removed | 13 |
| partial | 2 |
| **total** | **24** |

## Audit table

| 5.0 ID | Deficiency (truncated) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-7.1 | Electric easements not dedicated by separate instrument (shown on plat instead) | removed | — | No 5.1 checklist distinguishes plat vs. separate-instrument dedication. Code §§ 14-1-11/14-1-21 basis dropped from el/ entirely. |
| EL-7.2 | Metes and bounds / field notes not provided to AE for easement dedication | partial | el/3.md §Regulatory Overview (AEDC 1.16.0 text) | Metes-and-bounds requirement surfaces in el/3.md §11 prose ("dedicate additional easements if insufficient... with metes and bounds descriptions") but no checklist item asks a reviewer to verify the exhibit. |
| EL-7.3 | Metes and bounds / field notes not provided for each utility crossing through transmission easements | removed | — | UCM 1.14.7 basis dropped from el/ checklists. |
| EL-7.4 | Title commitment / title policy / O&E Report / ALTA survey not submitted to AE | removed | — | No 5.1 item references title documents or ALTA submission. |
| EL-7.5 | Duct bank installations not located within dedicated easement | removed | — | el/1.md EL-1.10 mentions duct banks only in the joint-trench context, not easement-containment. UCM 1.3.24 basis dropped. |
| EL-7.6 | Electric easements not shown on site plan sheets for all AE facilities | partial | el/3.md EL-3.11 | EL-3.11 requires the georeferenced AutoCAD submittal to show "all public and private easements" and existing AE facilities — overlaps but frames as AE submittal content rather than site-plan-sheet depiction. |
| EL-7.7 | Electrical facilities extend across property lines without easements / unified development designation | removed | — | UCM 1.3.8 / Code § 15-9-123 unified-development check has no 5.1 counterpart. |
| EL-7.8 | Proposed easements crossing/within transmission easements not reviewed and approved by AE | removed | — | UCM 1.14.7 advance-approval check dropped. |
| EL-7.9 | Encroachment agreement from City Law Department not obtained for construction within transmission easements | removed | — | No 5.1 item covers Law Department encroachment agreements; el/3.md EL-3.32 covers plat notes only, not the agreement itself. |
| EL-7.10 | License agreement not obtained for landscaping/trees/irrigation within electric easements | combined | el/2.md EL-2.16 | EL-2.16 generalizes to "items placed within a utility easement (structures, paving, landscaping, retaining walls) have not been licensed" — subsumes the landscape-specific case (same UCM 1.10.10.3 cite). |
| EL-7.11 | License agreement not obtained for construction activities when clearances to energized lines cannot be met | removed | — | UCM 1.14.9 clearance-exception license pathway dropped. el/1.md EL-1.18/1.19/1.25 cover transmission construction clearances but not the license-agreement remedy when clearances cannot be met. |
| EL-7.12 | Note missing: AE right to prune/remove trees per LDC Ch. 25-8, Sub. B | combined | el/3.md EL-3.6 (note 1) | One of the four "Standard Austin Energy Notes" in EL-3.6. |
| EL-7.13 | Note missing: Owner/developer shall provide AE easements and access | combined | el/3.md EL-3.6 (note 2) | Same consolidated note. |
| EL-7.14 | Note missing: Owner responsible for costs of raising lines if final grades don't meet clearances | removed | — | This specific line-raising cost note is not among EL-3.6's four standard notes nor listed elsewhere in 5.1 el/. UCM 1.16.0(3) basis dropped for this specific note. |
| EL-7.15 | Note missing: Owner responsible for initial tree pruning within 10 ft of centerline / erosion control | combined | el/3.md EL-3.6 (note 3) | EL-3.6 note 3 text matches. |
| EL-7.16 | Note missing: Owner maintains NESC/NEC/OSHA/City/Texas clearances near overhead power lines | combined | el/3.md EL-3.6 (note 4) | EL-3.6 note 4 matches (5.1 text omits "NEC" but otherwise equivalent). |
| EL-7.17 | Note missing: Relocation of electric facilities at landowner's/developer's expense | removed | el/2.md §Regulatory Overview (UCM 1.3.19 prose); el/2.md EL-2.21 | The relocation-cost principle is discussed in el/2.md §23 and EL-2.21 references UCM 1.3.19, but no 5.1 checklist asks whether a "relocation at landowner's expense" plan note is present. Call it removed as a plan-note check. |
| EL-7.18 | Note missing: Moonlight tower removed/stored/reinstalled during construction at developer's expense | removed | — | el/3.md EL-3.13/EL-3.14/EL-3.15 cover the 100-ft permit, advance-notification, and 25-ft ROW prohibition but not the removal-and-storage-and-reinstallation note. UCM 5.2.1 basis dropped. |
| EL-7.19 | Land within transmission easement labeled/dedicated as parkland | combined | el/3.md EL-3.32 | EL-3.32 trailing clause covers parkland prohibition via AEDC 1.16.0(9). |
| EL-7.20 | Existing transmission easement inadequate; not expanded/replaced upon subdivision | removed | — | UCM 1.14.7 adequacy-on-subdivision check dropped. |
| EL-7.21 | Note missing: Permanent structures / clearance-violating structures prohibited in transmission easements | combined | el/3.md EL-3.32 (plat note v) | EL-3.32 consolidates all eight AEDC 1.16.0(8) plat notes. |
| EL-7.22 | Note missing: Owner provides AE 24-hour access across property to transmission easement | combined | el/3.md EL-3.32 (plat note vi) | Same consolidated item. |
| EL-7.23 | Note missing: Roads/driveways in transmission easement sustain 48,000 lb tandem axle load | combined | el/3.md EL-3.32 (plat note vii) | Same. |
| EL-7.24 | Note missing: All construction/grading in transmission easement coordinated with AE, 48-hour notice | combined | el/3.md EL-3.32 (plat note viii) | Same. |

## Patterns

- **Plan-note consolidation.** 5.0's "one item per required plan note" pattern (9 distinct note items in el/7.md) collapsed to exactly 2 consolidated items in 5.1: EL-3.6 (four Standard AE Notes) + EL-3.32 (eight AEDC 1.16.0(8) transmission plat notes, plus the (9) parkland prohibition). EL-7.14 (line-raising cost) and EL-7.17 (relocation cost) and EL-7.18 (moonlight tower removal) are the three specific plan notes that did not survive consolidation.
- **Legal-instrument checks dropped.** Every item requiring verification of a recorded legal document (separate-instrument deed, metes-and-bounds exhibit, title commitment/ALTA, encroachment agreement) was removed. 5.1 retains only the AE AutoCAD submittal check (EL-3.11) and the easement licensing check (EL-2.16).
- **Citation attrition.** Code §§ 14-1-11, 14-1-21, 14-1-22, § 15-9-123, UCM 1.3.8, UCM 1.3.24, UCM 1.14.7, and UCM 5.2.1 — all cited in 5.0 el/7.md — are absent from 5.1 el/ checklists. AEDC supplanted UCM for the surviving AE plan-note items.
- **Cross-property / unified-development concept is gone.** No 5.1 item asks whether electrical facilities cross property lines without easements or unified-development designation; this was previously a distinct EL-7.7 check with LDC/UCM authority.
- **"Partial" tagging.** Items EL-7.2 and EL-7.6 were tagged partial rather than removed because their core concepts (metes-and-bounds dedication, easements shown on submittals) appear in 5.1 prose or adjacent items (EL-3.11), just not as direct checklist equivalents.

## Surprises

- I expected some items (title commitment, unified development, encroachment agreement) to have migrated cross-department (ta/ or zlu/). Cross-department searches for "metes and bounds," "unified development," "encroachment agreement," "title commitment" returned no electric-context hits outside el/; the wwp/ and ta/ matches relate to water easements and traffic impact analysis unrelated to AE electric easement legal documentation.
- EL-7.14 (line-raising cost note) is **not** among the four Standard AE Notes in 5.1 EL-3.6. The four 5.1 notes are: pruning rights, easement/access provision, erosion-control + initial tree pruning, and NESC/OSHA clearance maintenance. The "line-raising cost if grades don't meet clearances" language is a distinct fifth note in 5.0 that simply does not appear in el/3.md's Regulatory Overview or checklist.
- EL-3.6 in 5.1 drops "NEC" from the clearance-standards note (keeps NESC/OSHA/City/Texas), a minor substantive shift versus EL-7.16.

Report path: `/Users/winston/workspace/winston/workspaces/el-audit/el-5.0-7-audit.md`
