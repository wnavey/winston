# EL-13 Audit: el-md-exp → el port coverage

**Source:** `bureau/jurisdictions/austin/review-guides/el-md-exp/13.md` — "Transformer Pad Clearances and Location Requirements" (39 checklist items: EL-13.1 through EL-13.39)

**Scope:** Compared every EL-13 item against the retrained `el/` guides (`el/1.md`, `el/2.md`, `el/3.md`) and every other review guide under `jurisdictions/austin/review-guides/` that references transformers.

**Date:** 2026-04-23

---

## Summary

| Status | Count |
|---|---|
| ✅ Fully ported | 13 |
| 🟡 Partially ported | 4 |
| ❌ Not ported (gap) | 22 |
| **Total** | **39** |

The largest cross-guide migration landed in **`zlu/15.md` → ZLU-15.40**, which bundles most of the UCM 1.10.4 numerical clearance rules into a single deficiency row with sub-parts (a) through (h). Landscape-side items (trees/shrubs near pads) moved to **`eptp/10.md` → EPTP-10.19**. A handful of oblique mentions appear in `park/`, `sduf/`, `fire/`, `ta/`, `sde/`, `fwp/`, and `wwp/`, but only where transformers are incidental to the guide's main topic — none add coverage for the EL-13 gaps below.

---

## Item-by-item audit

Legend: ✅ ported · 🟡 partial · ❌ gap · RC = Reviewer Convention

| EL-13.x | Topic | Status | Where it landed / gap detail |
|---|---|---|---|
| .1 | 5-ft from buildings, structures, foundations | ✅ | `zlu/15.md` ZLU-15.40(b) brick/masonry; (c) 12-ft non-masonry |
| .2 | 5-ft from retaining walls (RC) | ❌ | — |
| .3 | 5/3-ft from fences (operator vs. non-operator sides) | ✅ | `el/2.md` EL-2.22; `zlu/15.md` ZLU-15.40(d,e) |
| .4 | 3-ft reduced clearance requires AE Design written approval + conditions | 🟡 | ZLU-15.40(b) notes reduction exists, does not flag missing documentation (3-hr fire rating, confined-space check, vertical clearance to openings) |
| .5 | 5-ft lateral from balconies/overhangs; no coverings above pad | ❌ | — |
| .6 | 12-ft from windows/doors/ventilating ducts (oil-filled) | ❌ | — (ZLU-15.40(c) is non-masonry structures, not openings) |
| .7 | 2-ft from back of sidewalks | ✅ | `el/2.md` EL-2.22; ZLU-15.40(g) |
| .8 | Clearance from stairwells serving as fire exits (RC) | ❌ | — |
| .9 | 20-ft horizontal/radial from fire escapes (oil-filled) | ❌ | — |
| .10 | 10-ft hot-stick to open area / adjacent building | ✅ | `el/2.md` EL-2.22; ZLU-15.40(a) |
| .11 | 15-ft hot-stick when facing confined space | ✅ | ZLU-15.40(f) |
| .12 | 5-ft from fire hydrants (RC) | ❌ | — |
| .13 | Trees 10-ft pad / 15-ft overhead, utility-compatible species | 🟡 | `eptp/10.md` EPTP-10.19 covers 10-ft only; no utility-compatible species check, no 15-ft overhead conductor provision |
| .14 | Shrubs 10-ft access door / 5-ft other sides | ✅ | `eptp/10.md` EPTP-10.19 |
| .15 | Root barriers for trees within 20 ft of underground electric equipment | ❌ | `eptp/10.md` covers root barriers around Austin Water infrastructure only, not underground electric |
| .16 | 5-ft from dumpsters (RC) | ❌ | — |
| .17 | 5-ft from bike racks (RC) | ❌ | — |
| .18 | 5-ft from light poles (RC) | ❌ | — |
| .19 | 15-ft from fire lanes (RC) | 🟡 | `fire/12.md` FIRE-12.8 flags transformers *within* fire-lane clear width only, not the 15-ft buffer convention |
| .20 | 5-ft from other transformer pads (RC) | ❌ | — |
| .21 | 5-ft from water lines | ❌ | — (`el/1.md` EL-1.14 is about cleanouts near poles, not transformer pads) |
| .22 | 5-ft from wastewater lines | ❌ | — |
| .23 | 5-ft from storm drain lines | ❌ | — |
| .24 | 24-in / 36-in from gas lines (pressure-dependent) | ❌ | — (`el/1.md` EL-1.9 covers AE underground-to-gas, not transformer-pad-to-gas specifically) |
| .25 | 12-in horizontal/vertical from other underground utilities | ✅ | `el/1.md` EL-1.9 (general AE underground facilities — includes transformer conduits) |
| .26 | Transformer pads over/under other utility lines or buildings/foundations over AE underground | ❌ | — |
| .27 | 7.5-ft horizontal sky-to-ground from overhead distribution | ✅ | `el/1.md` EL-1.2 |
| .28 | 15-ft radius from overhead primary and neutral conductors | ✅ | `el/1.md` EL-1.3 |
| .29 | 35-ft vertical clearance in niches and niche entrance | ❌ | — |
| .30 | Niche 3-hr fire wall, ventilation, AE consultation documentation | ❌ | — |
| .31 | Cross-section drawings required for vertical clearances in access paths | ❌ | — |
| .32 | Drainage slopes away from building for oil-filled transformer pads | ❌ | — |
| .33 | Transformer pads 100% on private property / not in ROW / not straddling property lines | 🟡 | `el/2.md` EL-2.22 mentions in applicability only; EL-2.13 covers parkland-specific case |
| .34 | Transformer pads in prohibited easements (drainage/water/sewer/electric under overhead) without AE approval | ❌ | — |
| .35 | Transformer easement not shown or width inadequate for AE access | ✅ | `el/2.md` EL-2.22 |
| .36 | Electrical routing transformer → meter must be 100% on private property | ❌ | — |
| .37 | Pad dimensions match AE Design-approved detail sheets for service type | ✅ | `el/2.md` EL-2.22 |
| .38 | Bollards required when pad within 4 ft of parking/traffic areas | ✅ | `zlu/15.md` ZLU-15.40(h) |
| .39 | Customer facilities (buildings, parking garages, light poles, signs, billboards, chimneys, antennas, tanks) under/over overhead distribution | ✅ | `el/1.md` EL-1.3 |

---

## Gaps grouped by theme

### 1. Window/door/vent + balcony/overhang clearances (.5, .6)
Substantive UCM 1.10.4 numerical requirements are entirely missing. ZLU-15.40 covers structures generically but not building openings or overhead projections.

### 2. Oil-filled equipment specifics (.9, .32)
No guide flags oil-filled condition at all. 20-ft fire-escape clearance and drainage-away-from-building requirements are absent.

### 3. Niche service configuration (.29, .30, .31)
35-ft vertical clearance, 3-hr fire wall rating, ventilation specs, AE Design consultation, and cross-section drawing requirements — all absent. This is a notable gap given niche service is a named UCM 1.10.4 footnote 3 configuration.

### 4. Point-feature Reviewer Conventions (.2, .8, .12, .16, .17, .18, .20)
Retaining walls, stairwells, fire hydrants, dumpsters, bike racks, light poles, other transformer pads — all RC-grade checks were dropped. These may have been intentionally culled; the remaining Reviewer Convention items (e.g., EL-2.10 under ponds, EL-2.18 abandoned utilities) survived the retrain so the pattern isn't a blanket removal.

### 5. Transformer-pad-to-wet-utility separations (.21, .22, .23, .24)
Water, wastewater, storm, gas clearances from transformer pads are not tied back to transformers in any current guide. `el/1.md` EL-1.9 addresses AE underground vs. other utilities in the general perpendicular-crossing case but does not flag transformer-pad-specific 5-ft/24-in/36-in separations.

### 6. Easement and private-property routing (.26, .33-partial, .34, .36)
Absolute prohibitions on:
- Transformer pads installed in drainage, water, sewer, or electrical easements under overhead lines
- Electrical routing transformer → meter crossing into public ROW
- Transformer pads straddling property lines

are either missing outright (.26, .34, .36) or buried in applicability text rather than surfaced as first-class deficiencies (.33).

### 7. Root barriers for trees near underground electric (.15)
`eptp/10.md` only covers root barriers around Austin Water infrastructure per UCM 2.9.1.C. The separate UCM 1.10.10.4 requirement for 4-ft deep root barriers 5 ft from underground electric equipment (for trees within 20 lateral feet) is absent.

---

## Where transformers appear in other guides (for reference)

Guides outside `el/` that mention transformers, and what each covers:

| Guide | Item(s) | What it covers | Relevant to EL-13? |
|---|---|---|---|
| `eptp/10.md` | EPTP-10.19 | Trees 10-ft from pad-mounted equipment; shrubs 10-ft access / 5-ft other sides | ✅ EL-13.13 (partial), .14 |
| `eptp/6.md` | EPTP-6.9 | Transformers inside tree CRZs must be relocated | Tangential |
| `eptp/21.md` | (regulatory overview only) | Aggregate landscaping around transformer pads | Tangential |
| `park/5.md`, `park/6.md` | PARK-5.3, PARK-6.17 | Transformers within parkland boundary prohibited | Overlaps EL-13.33 (parkland case) |
| `sduf/9.md` | SDUF-9.7, SDUF-9.23, SDUF-9.27 | Transformer screening requirements | Different topic (screening, not clearance) |
| `sduf/3.md` | SDUF-3.39 | Transformer vaults in Great Streets frontage | Different topic |
| `fire/6.md` | FIRE-6.27 | No electrical disconnect between utility transformer and fire pump controller | Unrelated |
| `fire/12.md` | FIRE-12.8 | Transformers within fire-lane clear width | Partially overlaps EL-13.19 |
| `ta/14.md`, `ta/8.md` | TA-14.6, TA-8.41 | Transformers in drive aisle / accessible route | Different topic |
| `sde/51.md` | SDE-51.6 | Transformer pads in impervious-cover calcs | Different topic |
| `fwp/5.md`, `fwp/7.md` | FWP-5.22, FWP-7.43 | Transformer equipment in floodplain/CWQZ; elevated above DFE | Different topic |
| `wwp/37.md` | WWP-37.33 | Transformer pad symbols defined in legend | Different topic |
| `zlu/15.md` | **ZLU-15.40** | UCM 1.10.4 numerical clearances (a)-(h) — hot-stick, brick/masonry, non-masonry, fences, confined space, sidewalks, bollards | ✅ EL-13.1, .3, .4, .7, .10, .11, .38 |
| `zlu/9.md` | (addressing only) | Transformer building-suffix (TNFM) in addressing | Unrelated |
| `el/1.md` | EL-1.2, EL-1.3, EL-1.9 | Overhead sky-to-ground, 15-ft radius, AE underground 12-in | ✅ EL-13.25, .27, .28, .39 |
| `el/2.md` | EL-2.13, EL-2.22 | Transformers in parkland; pad sizing/clearances/easement/AE-truck access | ✅ EL-13.33 (partial), .35, .37 + overview of .3, .7, .10 |
| `el/3.md` | EL-3.7, EL-3.11, EL-3.12 | AE approval for transformer/pull-box; AE AutoCAD submittal; AE access to equipment | Tangential (coordination, not clearance) |

---

## Recommendations (for discussion, not execution)

1. **High-value gaps to restore first:** Oil-filled equipment checks (.9, .32), niche configuration (.29–.31), and windows/doors/vents (.6) are code-cited UCM 1.10.4 requirements with clear deficiency patterns. These feel like retrain-loss rather than intentional cuts.

2. **Medium-value:** Easement prohibitions (.26, .34, .36) and transformer-pad-to-wet-utility separations (.21–.24) — concrete UCM rules with testable dimensions.

3. **Low-value (may have been intentionally dropped):** The seven Reviewer Convention point-feature checks (.2, .8, .12, .16, .17, .18, .20). Confirm with the training team whether RCs of this granularity were deliberately culled.

4. **Natural home for restored items:** `el/2.md` EL-2.22 is already the transformer-pad omnibus — it could absorb additional sub-parts, or the items could spawn new EL-2.x rows. Tree-adjacent items (.13, .15) belong in `eptp/10.md`.
