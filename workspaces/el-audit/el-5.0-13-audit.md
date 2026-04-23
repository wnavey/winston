# EL 5.0 File 13 Audit — Transformer Pad Clearances and Location Requirements

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/13.md` — "Transformer Pad Clearances and Location Requirements" (39 checklist items, EL-13.1–EL-13.39)
**5.1 corpus commit:** `aed4f1b13e2fcdf3e9a0c1d2d28179ed92d7ed95` — "Update Austin review guides + glossary from training v5.1 (#245)" on `main`
**5.1 scope searched:** all subdirs of `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` except `el-md-exp/`

## Summary

The 5.0 file `el/13.md` was a dedicated, heavily decomposed guide of 39 distinct transformer-pad checklist items. In 5.1, the entire subject has been consolidated and largely **combined** into a single checklist item — `ZLU-15.40` — which covers most 5.0 horizontal/fence/sidewalk/bollard clearances in one multi-part row under Zoning & Land Use. Remaining coverage is scattered across `el/2.md` (routing/placement/easement aspects), `eptp/10.md` (vegetation/tree/root-barrier items), `fwp/5.md`+`fwp/7.md` (floodplain/CWQZ transformer siting), `park/5.md`+`park/6.md` (transformer in parkland), and `sduf/9.md` (transformer screening). A number of reviewer-convention 5-ft clearances (retaining wall, dumpster, bike rack, light pole, other transformers, fire hydrant, stairwell, fire lane) and many detail-level 5.0 items (overhead distribution 15-ft radius, 7.5-ft sky-to-ground, niche 35-ft, cross-section drawings, drainage direction for oil-filled equipment, 12-ft window/door, reduced-clearance documentation) were **dropped** from the retrained corpus. Several overhead-distribution items were **moved-within-el** to `el/1.md` (now covering overhead clearance generically, not specifically for transformer siting).

## Status counts

| Status | Count |
|---|---|
| retained | 0 |
| reworded | 0 |
| renumbered | 0 |
| moved-within-el | 3 |
| moved-cross-department | 5 |
| combined | 11 |
| split | 0 |
| removed | 17 |
| partial | 3 |
| **Total** | **39** |

Note: items combined into ZLU-15.40 where only part of the 5.0 check is expressed there are classified as `partial` when important sub-conditions (e.g., written-approval documentation, fire-rating verification) are missing from the 5.1 row. The `combined` status is used where the 5.1 ZLU-15.40 row substantively captures the check.

## Checklist Item Audit

| 5.0 ID | Deficiency (truncated ~80) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-13.1 | Transformer pads lack minimum 5-foot clearance from buildings, structures, and building foundations | combined | `zlu/15.md` ZLU-15.40 (a,b,c) | ZLU-15.40 rolls up 5-ft brick/masonry, 10-ft hot-stick, 12-ft non-masonry into one row. |
| EL-13.2 | Transformer pads lack minimum 5-foot clearance from retaining walls | removed | — | No retaining-wall-specific transformer clearance found; reviewer-convention dropped. |
| EL-13.3 | Transformer pads lack required clearance from fences and gates — 5 ft operator / 3 ft non-operator | combined | `zlu/15.md` ZLU-15.40 (d,e); `el/2.md` EL-2.22 | Both 5.1 items enumerate the 3-ft/5-ft fence thresholds. |
| EL-13.4 | Reduced clearance (3 ft to brick/masonry) lacks AE written approval / fire rating / conditions | partial | `zlu/15.md` ZLU-15.40 (b) | ZLU-15.40 parenthetically notes "may be reduced to 3 ft with AE Design written approval under specific conditions" but does not require documentation of approval, confined-space non-status, window/door offsets, or 3-hour fire rating as a discrete check. |
| EL-13.5 | Transformer pads lack 5-ft lateral clearance from balconies/overhangs; no coverings above pad | removed | — | Balcony/overhang/"no covering above pad" deficiency not expressed as a checklist item anywhere in 5.1. |
| EL-13.6 | 12-ft horizontal from windows/doors/ducts when <12 ft from grade or <5 ft lateral (oil-filled) | partial | `zlu/15.md` ZLU-15.40 (c) | ZLU-15.40 (c) mentions 12-ft non-brick/masonry oil-filled clearance but does not capture the full windows/doors/ducts conditional or the vertical-grade qualifier. |
| EL-13.7 | Transformer pads not located minimum 2 feet from back of sidewalks | combined | `zlu/15.md` ZLU-15.40 (g); `el/2.md` EL-2.22 | Explicit in both. |
| EL-13.8 | Transformer pads lack required clearance from stairwells serving as fire exits | removed | — | Reviewer-convention item dropped. Fire-escape 20-ft radial (EL-13.9) also dropped. |
| EL-13.9 | 20-ft radial clearance from fire escapes / stairs as fire escape (oil-filled) | removed | — | No 20-ft fire escape check present in 5.1 corpus. |
| EL-13.10 | Hot-stick side lacks 10-ft clearance to open area or building/structure | combined | `zlu/15.md` ZLU-15.40 (a); `el/2.md` EL-2.22 | Explicit in both. |
| EL-13.11 | Hot-stick side lacks 15-ft clearance when facing confined space (niche/vault/enclosed ≥3 sides) | combined | `zlu/15.md` ZLU-15.40 (f) | Captured as "15 feet in confined space or vault installations". |
| EL-13.12 | Transformer pads lack 5-ft clearance from fire hydrants | removed | — | Reviewer-convention item dropped. |
| EL-13.13 | Trees within 10 lateral ft of pad (or 15 ft of overhead) not utility-compatible per ECM Appendix F | moved-cross-department | `eptp/10.md` EPTP-10.19; EPTP-10.22 | EPTP-10.19 covers 10-ft separation; utility-compatible species check is partial — ECM Appendix F "UC" column is not explicitly called out. |
| EL-13.14 | Shrubs lack 10-ft lateral from access-door side / 5-ft from other sides | moved-cross-department | `eptp/10.md` EPTP-10.19 | EPTP-10.19 explicitly addresses shrubs within 10 ft of access doors and 5 ft of other sides. |
| EL-13.15 | Trees within 20 lateral ft of underground electric equipment lack root barriers (4 ft deep, 5 ft from equipment) | removed | — | `eptp/10.md` root-barrier items are about AW infrastructure (UCM 2.9.1.C), not the 20-ft / 4-ft / 5-ft electric-equipment standard under UCM 1.10.10.4. Dropped. |
| EL-13.16 | Transformer pads lack 5-ft clearance from dumpsters | removed | — | Reviewer-convention item dropped. |
| EL-13.17 | Transformer pads lack 5-ft clearance from bike racks | removed | — | Reviewer-convention item dropped. |
| EL-13.18 | Transformer pads lack 5-ft clearance from light poles | removed | — | Reviewer-convention item dropped. |
| EL-13.19 | Transformer pads lack 15-ft clearance from fire lanes | removed | — | Reviewer-convention item dropped. |
| EL-13.20 | Transformer pads lack 5-ft clearance from other transformer pads | removed | — | Reviewer-convention item dropped. |
| EL-13.21 | Transformer pads lack 5-ft horizontal clearance from water lines | moved-within-el | `el/1.md` (UCM 2.9.1.B.2 code reference only — not a discrete checklist item) | UCM 2.9.1.B.2 is listed in `el/1.md` Code References; no transformer-specific water-line clearance checklist item exists. EL-1.14 addresses large-diameter cleanouts to poles (not transformer pads). |
| EL-13.22 | Transformer pads lack 5-ft horizontal clearance from wastewater lines | removed | — | Same as EL-13.21; AW 5-ft standard is not applied to transformer pads as a distinct check. |
| EL-13.23 | Transformer pads lack 5-ft horizontal clearance from storm drain lines | removed | — | Same as EL-13.21. |
| EL-13.24 | Transformer pads lack horizontal clearance from gas lines (24 in / 36 in for ≥60 psi) | partial | `el/1.md` EL-1.9 | EL-1.9 covers 12-inch AE underground clearance at perpendicular crossings (UCM 1.10.5.A) and notes 36-inch for high-pressure gas in regulatory overview, but the 24-in low-pressure threshold is not discretely captured as a transformer-pad-specific check. |
| EL-13.25 | Transformer pads lack 12-inch horizontal/vertical clearance from other underground utilities | moved-within-el | `el/1.md` EL-1.9 | EL-1.9 is the generic 12-inch AE-underground-to-other-utility rule under UCM 1.10.5.A. |
| EL-13.26 | Pads/AE underground over or under other utilities; customer buildings over AE underground | moved-within-el | `el/1.md` EL-1.9; `el/1.md` EL-1.10 | Parallel-routing/joint-trench prohibition expressed in EL-1.10. |
| EL-13.27 | 7.5-ft horizontal sky-to-ground clearance from overhead distribution conductors | moved-cross-department | `el/1.md` EL-1.2 | Moved to overhead-clearance guide as a generic check (not transformer-specific). |
| EL-13.28 | 15-ft radius clearance from overhead distribution primary/neutral conductors | moved-cross-department | `el/1.md` EL-1.3 | Moved to overhead guide, generic. |
| EL-13.29 | Niche locations lack 35-ft vertical clearance inside niche/entrance; no cross-section | removed | — | No 35-ft niche check present in 5.1 corpus. |
| EL-13.30 | Niche service installations lack 3-hr fire wall / ventilation / AE Design consultation | removed | — | Dropped; niche-specific requirements are not covered. |
| EL-13.31 | Cross-section drawings not provided showing vertical clearances in access paths/garages/niches | removed | — | Dropped. |
| EL-13.32 | Grading shows drainage toward building from oil-filled transformer pad | removed | — | Oil-filled drainage-direction check dropped. |
| EL-13.33 | Transformer pads not 100% on private property / in ROW / straddling property lines | combined | `el/2.md` EL-2.13; `el/2.md` EL-2.22; `park/5.md` PARK-5.3; `park/6.md` PARK-6.17 | EL-2.22 requires pad on customer's property; EL-2.13 specifically addresses parkland; PARK-5.3/6.17 cover parkland encumbrance. |
| EL-13.34 | Pads in prohibited easements (drainage/water/sewer/electrical under overhead) without AE approval | removed | — | Prohibited-easement check not captured as a discrete 5.1 item; EL-2.15/EL-2.16 cover different licensing scenarios. |
| EL-13.35 | Transformer easements not shown / easement width inadequate | combined | `el/2.md` EL-2.22 | EL-2.22 requires "dedicated AE easement encumbering the pad area". |
| EL-13.36 | Electrical routing from transformer to meter not 100% on private property | removed | — | Transformer-to-meter routing check not present in 5.1. |
| EL-13.37 | Pad dimensions do not match AE Design-approved transformer pad detail sheets | combined | `el/2.md` EL-2.22 | EL-2.22 states pad must be "sized per AE Design specifications". Regulatory overview also clarifies "no universal fixed dimension". |
| EL-13.38 | Within 4 ft of parking/traffic lacks 4-in galvanized bollards / not spaced for door opening | partial | `zlu/15.md` ZLU-15.40 (h) | ZLU-15.40 (h) refers to pads within 6 ft of parking/traffic needing bollards "when ≤ 4 feet" — the 4-in diameter and door-opening spacing specifics are not carried. |
| EL-13.39 | Customer facilities (buildings/garages/light poles/signs/chimneys/antennas/tanks) under/over AE overhead | moved-cross-department | `el/1.md` EL-1.3 | 5.1 EL-1.3 expresses the under-or-over prohibition for customer facilities generically. |

## Patterns observed

- **Consolidation target ZLU-15.40.** Most of the horizontal/fence/sidewalk/bollard-threshold items (EL-13.1, .3, .7, .10, .11, .38) are squeezed into one multi-clause row under Zoning & Land Use setbacks. This is striking: detailed clearance enforcement has moved out of the Electrical discipline entirely.
- **Reviewer-convention purge.** Every 5.0 "Reviewer Convention" item without a UCM citation (EL-13.2, .8, .12, .16, .17, .18, .19, .20) was removed in 5.1 — 8 of the 17 removals.
- **Niche and oil-filled-equipment coverage lost.** The entire specialized regime for niche service (EL-13.29, .30, .31) and oil-filled equipment (EL-13.5 coverings, .32 drainage direction) was dropped; only the 20-ft fire-escape check (EL-13.9) is likewise gone. This is a substantive coverage loss.
- **Cross-department dispatch.** Tree/shrub/root-barrier items moved to `eptp/10.md` (arborist); parkland encumbrance moved to `park/5.md`+`6.md`; overhead-line customer-facility checks moved to `el/1.md` as generic checks. No single 5.1 guide functions as a "transformer pad" destination.
- **Water/wastewater/storm separation from pads lost.** The three explicit 5-ft AW-to-pad checks (EL-13.21, .22, .23) have no 5.1 equivalent; the only surviving analog (EL-1.14) is for large-diameter cleanouts near poles, not transformer pads.
- **Documentation/variance checks weakened.** EL-13.4 (reduced-clearance documentation) and EL-13.30 (niche 3-hr fire wall documentation) are at best parenthetically alluded to; no 5.1 checklist item exercises the underlying documentation/approval verification.

## Surprises worth flagging to the caller

1. **39 → effectively ~11 covered items** (11 combined + 3 moved-within-el + 5 moved-cross-dept + 3 partial). The retrained corpus lost roughly half of the transformer-pad substantive checks.
2. **No dedicated 5.1 transformer guide.** `el/2.md` treats transformer pads as one aspect among many under "Underground Utility Routing and Placement."
3. **ZLU-15.40's placement is counterintuitive** — a transformer-pad clearance requirement now lives under a zoning "setbacks" guide alongside hazardous-pipeline and compatibility-setback checks.
4. **UCM 1.10.4 footnotes (1, 2, 3, 4) are no longer directly enforced as checklist items** in any 5.1 guide; footnote content is only preserved in overview prose.
5. **Fire escape 20-ft radial (oil-filled) check is completely gone** across the entire 5.1 corpus — no fire/ guide picks it up either.
