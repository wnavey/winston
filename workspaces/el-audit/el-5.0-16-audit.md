# EL-5.0 File 16 Audit — "Vegetation Near Electric Facilities"

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/16.md` — "Vegetation Near Electric Facilities"
**5.1 corpus:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` (main)
**5.1 training commit:** `aed4f1b13e2fcdf3e9a0c1d2d28179ed92d7ed95` — "Update Austin review guides + glossary from training v5.1 (#245)"
**Audit date:** 2026-04-23

## Summary

The entire subject of "Vegetation Near Electric Facilities" moved **cross-department** from `el/` (electrical) to `eptp/` (environmental / parks / tree protection) in v5.1, consistent with the discipline-scoping change: tree and landscape-adjacency issues are now owned by the arborist/landscape discipline rather than the electrical discipline. The primary destination is `eptp/10.md` ("Root Barriers, Utility-Tree Clearances, and Infrastructure in Critical Root Zones"), with overflow into `eptp/22.md` (parking/street-tree landscape), plus remnant electrical-side guardrails in `el/1.md`, `el/2.md`, `el/3.md`. Several granular distance-threshold items from UCM § 1.10.10.4 were consolidated into a single "not maintaining minimum 10-foot clearance" item or folded into prose; a few were dropped entirely.

## Status counts (24 items)

| Status | Count |
|---|---|
| moved-cross-department (retained in eptp/, substantively preserved) | 8 |
| moved-cross-department + combined (merged with sibling rule) | 4 |
| moved-cross-department + partial (coverage weaker) | 4 |
| moved-cross-department + reworded | 1 |
| combined (within el/ or across guides) | 2 |
| partial (partially covered; threshold dropped) | 2 |
| removed | 3 |

Net: 100% of items moved out of `el/` (expected — `el/` no longer owns vegetation). Of the 24, ~17 are substantively preserved in some form; 3 are outright removed; 4 have weakened/partial coverage.

## Main table

| 5.0 ID | Deficiency (truncated ~80) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-16.1 | Trees within 5 lateral ft of underground electric equipment | moved-cross-department; partial | eptp/10.md EPTP-10.17 | 10.17 cites ECM 2.4.2.C/2.4.1.D 10-ft rule, not the stricter UCM 1.10.10.4 5-ft absolute-prohibition threshold; the 5-ft-absolute / 5-to-20-ft-with-barrier tiered structure from UCM 1.10.10.4 is not preserved for underground electric. |
| EL-16.2 | Trees within 5–20 ft of underground electric without root barriers | moved-cross-department; partial | eptp/10.md EPTP-10.1 through EPTP-10.13 | Root-barrier checks exist comprehensively but are scoped to **Austin Water** (UCM 2.9.1.C) and District Energy (UCM 1.15.2). UCM 1.10.10.4 root-barrier requirement for underground electric equipment is not a distinct checklist item. |
| EL-16.3 | Root barrier details incorrect (not ≥4 ft deep or not 5 ft from equipment) | moved-cross-department; reworded | eptp/10.md EPTP-10.2, EPTP-10.3, EPTP-10.9, EPTP-10.10 | 5.1 specifies 48-inch vertical (same as 4 ft) and 7-ft-from-trunk / 2-ft-from-utility per UCM 2.9.1.C (AW standard). The UCM 1.10.10.4 "5 ft from equipment" specific to electric is not separately checked. |
| EL-16.4 | Trees directly on top of underground duct banks/conduits | removed | — | No grep hit for "duct bank" as a restricted tree-planting zone. Likely absorbed into eptp/10 utility-routing prose but no checklist item. |
| EL-16.5 | Tree wells/pits on top of underground electric utilities | moved-cross-department; combined | eptp/10.md EPTP-10.67, EPTP-10.68 | Generalized to "trees over subsurface structures" and tree-well-to-large-conveyance-pipe separation. Electric-specific framing lost. |
| EL-16.6 | Trees within 10 ft of pad-mounted transformers | moved-cross-department | eptp/10.md EPTP-10.19 | Direct retention; EPTP-10.19 cites UCM 1.10.10.4. |
| EL-16.7 | Non-UC trees within 15 ft of overhead distribution | removed | — | No checklist item for the 15-ft UC zone around overhead distribution. Referenced only indirectly in eptp/10.md EPTP-10.25 (overhead utility conflicts, generic). |
| EL-16.8 | Large trees (≥40 ft MH) within 25 ft of overhead distribution | removed | — | The 25-ft large-tree threshold for overhead distribution has no checklist item in 5.1. eptp/22.md EPTP-28.31 references "large trees" but for landscape yard coverage, not utility clearance. |
| EL-16.9 | Trees within electric transmission easements | moved-cross-department | eptp/10.md EPTP-10.22 | Retained as "Trees or shrubs within Public Utility Easements or electric transmission easements." |
| EL-16.10 | Non-UC trees within 50 ft of overhead transmission | moved-cross-department; partial | eptp/10.md EPTP-10.25, EPTP-10.22 (Code References line cites 50 ft) | The 50-ft UC zone is acknowledged in the eptp/10 Code References prose but there is no dedicated checklist item with that threshold. EPTP-10.25 is generic ("overhead utility easement conflicts"). |
| EL-16.11 | Large trees (≥40 ft MH) within 50 ft of overhead transmission | removed | — | No checklist item. The 50-ft UC species rule is partially represented (EL-16.10) but the separate 50-ft large-tree restriction is dropped. |
| EL-16.12 | Trees in electric easements without AE Public Involvement license agreement | moved-cross-department; combined | el/2.md EL-2.16; eptp/10.md EPTP-10.22 | EL-2.16 covers license-agreement requirement for any items in AE easements (UCM 1.10.10.3 + § 14-11-41). EPTP-10.22 covers vegetation-in-easement prohibition. Tree-specific license check merged. |
| EL-16.13 | Trees in easements obstructing AE access (not at outer edge / center-line positioning) | partial | el/3.md EL-3.12; eptp/10.md prose | EL-3.12 covers "development does not limit AE personnel access to facilities" — generic, not the tree-in-easement center-vs-edge geometry. The specific easement-center-vs-outer-edge guidance is not retained as a checklist item. |
| EL-16.14 | Trees within 10 ft of electric utility poles | moved-cross-department | eptp/22.md EPTP-22.52 | Direct retention with UCM 1.10.10.4 citation. |
| EL-16.15 | Shrubs within 10 ft of access-door side of pad-mounted equipment | moved-cross-department; combined | eptp/10.md EPTP-10.19 | 10.19 combines EL-16.6 + EL-16.15 + EL-16.16: "Pad-mounted transformers not maintaining 10-ft separation from tree trunks; shrubs within 10 ft of access doors or within 5 ft of other sides." |
| EL-16.16 | Shrubs within 5 ft of non-access sides of pad-mounted equipment | moved-cross-department; combined | eptp/10.md EPTP-10.19 | Same combined item as EL-16.15. |
| EL-16.17 | Shrubs obstructing 8-ft clearance around subsurface vaults/manholes | moved-cross-department; partial | el/2.md prose (Regulatory Overview, line 25) | "8-foot minimum clearance is required around all pedestals and subsurface AE vaults/manholes" appears in el/2.md prose citing UCM § 1.10.10.2, but there is **no dedicated checklist item** enforcing the 8-ft shrub clearance. Downgraded to prose. |
| EL-16.18 | Trees between access door of pad-mounted equipment and drivable surface | moved-cross-department; partial | el/3.md EL-3.12; eptp/10.md EPTP-10.19 | 10.19 covers shrub/vegetation clearances around pad-mounted equipment; the specific "between access door and drivable surface" geometric check is not separately itemized. |
| EL-16.19 | Trees blocking truck access to AE equipment (turning radii, set-up areas) | combined | el/3.md EL-3.12 | EL-3.12 covers "development will not limit AE personnel access" with truck dimension (12-ft × 16-ft) callout. Tree-specific obstruction merged into this generic access rule. |
| EL-16.20 | Trees in front of electric vaults blocking 8-ft clearance / access | removed | — | No checklist item in el/ or eptp/ specifically enforcing 8-ft tree clearance around vaults. UCM 1.10.10.2 is cited in el/2.md prose only. |
| EL-16.21 | Trees within 10 ft of easement edge where canopy spread would obstruct access | partial | el/3.md EL-3.12 (generic access) | The canopy-overhang-into-easement-boundary analytical check is not preserved; only generic "access not limited" is kept. |
| EL-16.22 | AE overhead/underground facilities not shown on landscape plans | removed | — | No checklist item requires electric facilities to appear on landscape plans. The implicit coordination is handled by individual clearance items requiring "check landscape plan vs. electric utility plan." |
| EL-16.23 | Variations from clearance/species without written AE approval | moved-cross-department; combined | eptp/10.md EPTP-10.17, EPTP-10.30 | "Written Austin Energy approval not obtained where lesser separation is proposed" is embedded in individual distance items (10.17 underground, 10.30 service connections) rather than a standalone variation-approval item. |
| EL-16.24 | Tree species not in Appendix F or not UC-designated near electric facilities | moved-cross-department | eptp/10.md EPTP-10.25, EPTP-10.26 | 10.25 covers non-UC species at overhead utility conflicts (cites ECM 2.4.1.D + Appendix F); 10.26 covers non-UC species in ROW with utilities. |

## Patterns

1. **Cross-department migration is clean at the topic level.** All vegetation-near-electric content left `el/` as intended; `el/` now scopes to conductor clearances, pad/vault/service design, and ROW coordination. The remaining electric-facing items (EL-2.16, EL-3.12) are generic coordination rules, not tree-specific.

2. **UCM § 1.10.10.4's fine-grained distance tiers were collapsed.** The 5.0 guide enforced a rich threshold stack from UCM § 1.10.10.4 table: 0–5 ft absolute prohibition underground; 5–20 ft with root barrier; 10 ft pads; 15 ft UC overhead distribution; 25 ft large trees distribution; 50 ft UC transmission; 50 ft large trees transmission; 10 ft poles. In 5.1 only three thresholds are preserved as checklist items: **10 ft pads (EPTP-10.19), 10 ft poles (EPTP-22.52), and 10 ft underground (EPTP-10.17, using the weaker ECM 2.4.2.C source)**. The 15/25/50-ft overhead regime is effectively downgraded to prose.

3. **Root barriers were re-aligned to AW infrastructure.** The 5.0 guide's root-barrier checks were scoped to electric equipment under UCM § 1.10.10.4. 5.1 replaces this with UCM 2.9.1.C (AW) and UCM 1.15.2 (district energy) as the governing standards. Electric-specific root-barrier enforcement is not independently retained.

4. **The 8-ft vault/manhole shrub clearance rule (UCM § 1.10.10.2) lost its checklist slot.** It survives only as Regulatory Overview prose in `el/2.md` — reviewers will not flag this unless they notice it during narrative reading.

5. **Three items were dropped outright:** duct-bank direct-overlay (EL-16.4), large trees near distribution 25 ft (EL-16.8), large trees near transmission 50 ft (EL-16.11), and the AE-facilities-on-landscape-plan coordination check (EL-16.22). These were reviewer-convention items or secondary to the primary UC rules.

6. **Access-obstruction items were merged into a single generic "access" rule.** EL-16.13 (center-vs-edge easement positioning), EL-16.19 (turning radii), EL-16.20 (vault front), and EL-16.21 (canopy overhang into easement) all collapse into EL-3.12's generic "development does not limit AE personnel access" check, losing geometric specificity.

## Surprises

- The **8-ft vault clearance** (EL-16.17, EL-16.20) — a personnel-safety-driven UCM § 1.10.10.2 rule — was demoted to prose only. This is a meaningful reviewer-coverage regression.
- The **15-ft UC / 25-ft large-tree / 50-ft large-tree overhead rules** are absent as checklist items even though UCM § 1.10.10.4 still governs. The table in 5.0's Regulatory Overview distinguishing ECM vs. UCM controlling standards is also gone.
- `eptp/10.md` is comprehensive but structured around **AW root barriers** first, with electric as secondary; reviewers may miss that UCM § 1.10.10.4 vs. UCM 2.9.1.C are parallel, not overlapping, root-barrier regimes.
