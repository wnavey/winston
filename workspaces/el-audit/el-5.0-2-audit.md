# Audit: EL 5.0 / 2.md — "Tree Clearances from Overhead Electric Lines"

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/2.md` (worktree pinned to commit `ced6e10`)
**5.1 target:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` — current `main` HEAD `8fccc32b3370c31521f245904ad65a10372ebadc` ("Restore Overview, Documents to Review, and Validation Methodology")
**Scope:** 15 checklist items (EL-2.1 through EL-2.15)

## Summary

The 5.0 `el/2.md` guide was a landscape-electrical crossover guide: every item was a tree-placement rule framed as an electrical reviewer's concern. In 5.1 the entire topic area was moved out of the `el/` department (which is now only 3 files covering overhead/underground clearances, underground routing, and AE coordination) and consolidated into the `eptp/` (Environmental Protection / Tree Protection) department — primarily `eptp/10.md` ("Root Barriers, Utility-Tree Clearances, and Infrastructure in Critical Root Zones") with secondary landing zones in `eptp/22.md` (street/parking-lot tree landscape) and partial coverage in `el/1.md` (measurement methodology).

A significant portion of the 5.0 rule set has been partially ported or dropped. Specifically, the UCM 1.10.10.4 quantitative structure that the 5.0 guide is built around — the 15 / 25 / 50 ft distribution-vs-transmission tiers keyed to UC status and 40-ft mature-height classification — has been flattened in 5.1. The 5.1 corpus cites ECM 2.4.1.D / 2.4.2.C (10 ft underground) and UCM 1.10.10.4 (10 ft from pole, 10 ft from pad-mount) but the distinct "15 ft distribution conductor," "25 ft large tree," "50 ft transmission conductor," and "root barrier 4 ft deep / 5 ft from equipment" provisions are not separately checklist-ified anywhere in 5.1.

## Status Counts

| Status | Count |
|---|---|
| retained | 0 |
| reworded | 1 |
| renumbered | 0 |
| moved-within-el | 1 |
| moved-cross-department | 5 |
| combined | 2 |
| split | 0 |
| partial (cross-department) | 3 |
| removed | 3 |
| **Total** | **15** |

## Main Audit Table

| 5.0 ID | Deficiency (truncated) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-2.1 | Non-UC trees within 15 lateral ft of overhead distribution conductor/equipment | partial (moved-cross-department) | `eptp/10.md` EPTP-10.25, EPTP-10.26, EPTP-10.22 | 5.1 references "utility-compatible species" and Appendix F but does not preserve the specific 15-ft distribution-conductor threshold. EPTP-10.25/26 address UC species vs. overhead utility conflicts in general terms (ECM 2.4.1.D / Appendix F), not the UCM 1.10.10.4 15-ft quantitative tier. |
| EL-2.2 | Non-UC trees within 50 lateral ft of overhead transmission conductor/equipment | partial (moved-cross-department) | `eptp/10.md` EPTP-10.22; Regulatory Overview line 15 | Overview text in `eptp/10.md` states "only utility-compatible species may be planted within 50 feet of overhead transmission outside the easement (UCM 1.10.10.3 / 1.10.10.4)," but there is no dedicated checklist row for the 50-ft UC-only zone. EPTP-10.22 covers the transmission-easement prohibition, not the 50-ft UC zone outside it. |
| EL-2.3 | Large trees (MH ≥ 40 ft) within 25 lateral ft of distribution conductor/equipment | removed | — | The "40 ft mature height / 25 ft lateral" distribution threshold from UCM 1.10.10.4 has no direct counterpart in 5.1. ECM Appendix F elsewhere uses a 30-ft "large tree" definition; the 40-ft electrical-specific tier is absent. |
| EL-2.4 | Large trees (MH ≥ 40 ft) within 50 lateral ft of transmission conductor/equipment | removed | — | Same gap as EL-2.3. 5.1 has no checklist item for the large-tree-vs-transmission conductor distance. |
| EL-2.5 | Trees (any species) proposed within transmission easement boundaries | moved-cross-department | `eptp/10.md` EPTP-10.22 | Transmission-easement tree prohibition is preserved ("Trees or shrubs proposed within Public Utility Easements or electric transmission easements"). Citation retained as UCM 1.10.10.3 / 1.10.10.4. |
| EL-2.6 | Trees within 10 lateral ft of overhead electric utility pole | moved-cross-department (reworded) | `eptp/22.md` EPTP-22.52 | Direct port. EPTP-22.52 explicitly cites UCM 1.10.10.4 and preserves the 10-ft lateral standard; expanded to include streetlight poles and other AE infrastructure. Also referenced in `zlu/15.md` and overview in `eptp/22.md`. |
| EL-2.7 | Trees within 10 lateral ft of pad-mount electric equipment; or between access door and drivable surface | partial (moved-cross-department) | `eptp/10.md` EPTP-10.19 | EPTP-10.19 preserves the 10-ft pad-mount separation (with shrub adjuncts — "shrubs within 10 ft of access doors, 5 ft of other sides") but the specific "between access door and drivable surface" geometric rule is absorbed into the access-door clause rather than called out as its own violation. |
| EL-2.8 | Trees within 5 lateral ft of underground electric equipment | moved-cross-department (reworded) | `eptp/10.md` EPTP-10.17 | 5.1 changes the threshold: EPTP-10.17 requires 10 ft from underground electric facilities (citing ECM 2.4.2.C / 2.4.1.D), not 5 ft. The 5.0 5-ft figure (from UCM 1.10.10.4) is superseded by the 10-ft ECM figure in 5.1. Reviewer should note this is a substantive change, not just wording. |
| EL-2.9 | Trees within 20 lateral ft of underground electric equipment lack root barriers (4 ft deep, 5 ft from equipment) | removed | — | The specific UCM 1.10.10.4 root-barrier spec for electric equipment (4-ft deep, 5-ft offset) is absent. 5.1 has extensive root-barrier coverage (EPTP-10.1 through EPTP-10.12) but keyed to Austin Water infrastructure per UCM 2.9.1.C (48-inch / 7-ft trunk / 2-ft utility). District-energy barriers (UCM 1.15.2, 3-ft) appear at EPTP-10.70. No row carries the 4-ft / 5-ft / 20-ft-trigger electrical variant. |
| EL-2.10 | Plant legend/schedule does not identify species of trees near electric facilities | combined | `eptp/1.md` EPTP-1.12 | General plant-schedule species-identification completeness is covered by EPTP-1.12 ("Tree species not listed using full species names … abbreviations … not sufficient") keyed to ECM 3.3.2.A. The electrical-specific trigger is dropped; it becomes a universal tree-survey requirement. |
| EL-2.11 | Large trees (MH 40+ ft) not differentiated on plans to allow clearance verification | removed | — | No 5.1 item requires plans to differentiate large trees specifically for electric-clearance verification. EPTP-28.31 references the Appendix F mature-height classification but in a landscape-yard context, not for overhead-electric clearance checking. |
| EL-2.12 | Tree clearances measured from pole centerline instead of outer conductor | moved-within-el (reworded) | `el/1.md` EL-1.5; overview line 15 of `el/1.md` | The conductor-vs-pole-centerline measurement rule is retained in `el/1.md` EL-1.5, but reframed as applying to customer-facility clearances (EL-1.2/1.3/1.4), not tree clearances. The rule survives as an `el/` principle; its tree-specific invocation is gone. |
| EL-2.13 | Tree clearances measured from tree canopy instead of trunk (planting location) | removed | — | No 5.1 checklist item addresses the trunk-vs-canopy measurement reference for electric-clearance dimensions. |
| EL-2.14 | Trees not shown on landscape plan in relation to overhead electric facilities | combined | `eptp/21.md` EPTP-21.67; `eptp/21.md` EPTP-21.66 | Absorbed into general landscape-vs-utility-plan coordination requirements. EPTP-21.67 covers landscape-plan-not-coordinated-with-utility-plan-sheets; EPTP-21.66 covers missing dimensions. The overhead-electric-specific framing is lost. |
| EL-2.15 | Trees in prohibited zones without documented Austin Energy written approval | partial (moved-cross-department) | `eptp/10.md` EPTP-10.17, EPTP-10.30; `el/1.md` EL-1.4 | The "Austin Energy written approval for lesser separation" concept survives in narrower contexts: EPTP-10.17 (underground electric, lesser clearance) and EPTP-10.30 (electrical service connection in CRZ) both require written AE approval. `el/1.md` EL-1.4 requires AE written clearance for vault-vs-overhead. No single rule captures the 5.0 umbrella requirement of "any tree in any prohibited zone without documented AE approval." |

## Notable Patterns

1. **Wholesale department reassignment.** The 5.0 `el/2.md` topic (tree-electric clearances) was entirely decoupled from the `el/` department. The current `el/2.md` is unrelated ("Underground Utility Routing and Placement"). The tree-clearance content lives almost exclusively in `eptp/` now, reflecting an editorial view that these are tree-protection/landscape concerns triggered by electric infrastructure, not electric reviewer concerns triggered by trees.

2. **UCM 1.10.10.4's quantitative tier structure was flattened.** The 5.0 guide is built around a carefully articulated table of distance tiers (15 / 25 / 50 ft for distribution/transmission, with UC-status and mature-height subtypes). 5.1 retains only the simplest pieces of this structure (10 ft from pole, 10 ft from pad-mount, transmission-easement prohibition). The 15-ft distribution-conductor UC threshold, the 25-ft large-tree distribution threshold, and the 50-ft transmission-conductor UC threshold are not separately enforced by checklist rows — they appear only in overview prose.

3. **Substantive threshold change at EL-2.8.** 5.0 used UCM 1.10.10.4's 5-ft figure for underground electric; 5.1 uses ECM 2.4.2.C's 10-ft figure. This is a code-interpretation shift (which code governs), not merely reorganization. Worth flagging to whoever owns the training pipeline.

4. **Measurement-methodology rules survived only for customer facilities.** The conductor-vs-pole-centerline rule (EL-2.12) moved to `el/1.md` EL-1.5 but is now scoped to customer-facility clearances. The canopy-vs-trunk rule (EL-2.13) was dropped entirely. This means 5.1 has no checklist rule catching a plan that dimensions tree clearance from the tree canopy edge, even though that remains a real violation pattern per UCM 1.10.10.4.

5. **Root-barrier coverage pivoted from electrical to water.** 5.0 EL-2.9 encoded UCM 1.10.10.4's electrical-equipment root-barrier spec (4-ft deep, 5-ft offset, 20-ft trigger). 5.1 has twelve root-barrier rules (EPTP-10.1 through EPTP-10.12) but all keyed to UCM 2.9.1.C (Austin Water: 48-inch depth, 7-ft trunk, 2-ft utility). The electrical variant is not represented.

6. **Plant-schedule/legend completeness generalized.** EL-2.10 and EL-2.11 both addressed plant-schedule documentation needed for electric-clearance review specifically. 5.1 has general species-identification requirements (EPTP-1.12) but nothing triggered by proximity to electric facilities.
