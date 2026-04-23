# Audit: EL-14 (v5.0) "Transformer Access and Installation Requirements" → v5.1

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/14.md`
**5.1 commit (main):** `aed4f1b13e2fcdf3e9a0c1d2d28179ed92d7ed95` — "Update Austin review guides + glossary from training v5.1 (#245)"
**5.1 corpus root:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` (excluding `el-md-exp/`)

## Summary

The v5.0 `el/14.md` file contained **73 checklist items** on transformer pad/vault/niche siting, access, clearances, design, and fire/flood requirements, anchored largely in UCM §§ 1.3.15–1.3.16, 1.5.2.6, 1.9.x, 1.10.4, 1.10.5, 1.11.1, 1.11.2, 1.14.4, and LDC § 25-12-173.

In v5.1, the `el/` guide was compressed from 20 files to 3 files (`1.md` Overhead & Vertical Clearances, `2.md` Underground Utility Routing, `3.md` AE Service & ROW Coordination). Almost all of EL-14's detailed vault/niche/transformer-access content was **dropped** at the checklist level. A small residue survives:

- Truck access dimensions (12 ft / 16 ft / 20×35 ft) moved to `el/1.md` narrative (EL-1.6 applicability) and `el/2.md` EL-2.21/EL-2.22.
- Transformer pad clearances & AE easement coverage are compressed into a single checklist item **EL-2.22**, with narrative covering UCM § 1.10.4.
- Transformer pad siting on parkland moved cross-department to **PARK-6.17** (and referenced in EL-2.13).
- Transformer placement within fire lanes moved cross-department to **FIRE-12.8**.
- Transformer/electrical equipment in floodplain/CWQZ moved to **FWP-7.43**, **FWP-5.22**, **FWP-7.9** (vaults as ancillary structures).
- Transformer pads in impervious-cover calcs → **SDE-51.6** (tangential).
- The detailed vault construction, fire-rating, ventilation, grounding, oil reservoir, lift-out panel, personnel ladder, landing area, staircase, depth, ramp grade, niche, Network Area, line-of-sight, two-90°-turns, 150-ft sightline, rear-lot-line, bollards, laydown curb, and transmission easement access (25 ft corridor / 46k axle / 8% grade / 16 ft gate / 100 ft obstruction) requirements are **entirely absent** from the v5.1 checklist layer (some transmission ROW items survive in `el/1.md` narrative but not as checklist rows covering EL-14's content).

Where a concept appears only in narrative text (Regulatory Overview / Thresholds / Documents to Review) but NOT in a checklist row that a reviewer would fire on, items are classified `partial` (coverage without actionable check) or `removed` (no coverage).

## Status counts (n = 73)

| Status | Count |
|---|---|
| retained | 0 |
| reworded | 0 |
| renumbered | 0 |
| moved-within-el | 2 |
| moved-cross-department | 4 |
| combined | 7 |
| split | 0 |
| partial | 11 |
| removed | 49 |
| **Total** | **73** |

## Audit Table

| 5.0 ID | Deficiency (~80 chars) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-14.1 | Transformer pad not within 6 ft of drivable surface and no 20-ft all-weather route | partial | el/2.md narrative (Transformer Pad and Clearances; § 1.10.4: "within 6 feet of a parking or traffic area"); EL-2.22 | Narrative mentions 6-ft access; no checklist row on the 20-ft alt route. |
| EL-14.2 | 20 ft × 35 ft set-up area in front of transformer not maintained | partial | el/1.md narrative (UCM 1.3.16; 35-ft vertical for equipment set-up); el/2.md narrative; EL-2.21 applicability | Dimension cited in narrative only; no dedicated checklist row. |
| EL-14.3 | Truck access path <12 ft horizontal width | partial | el/1.md narrative; el/2.md narrative (§ 1.3.16: 12-ft wide); EL-2.21 | Narrative threshold only. |
| EL-14.4 | Truck access path <16 ft vertical clearance | partial | el/1.md narrative; el/2.md narrative; EL-2.21 | Narrative threshold only; no checklist row specific to transformer access. |
| EL-14.5 | Access surface not HMAC/PCC all-weather | removed | — | Covered generically for fire lanes (fire/16.md FIRE-16.x) but not for AE transformer access. |
| EL-14.6 | Access surface not capable of 72,180 lb / 32,530 lb rear axle | removed | — | Load threshold not present anywhere in v5.1. |
| EL-14.7 | Laydown curb absent / <12 ft / inadequate load capacity | removed | — | EPTP-18.48 mentions laydown curb in a different (parking island) context; no AE transformer laydown-curb check. |
| EL-14.8 | No truck turnaround at transformer locations | removed | — | Not covered. |
| EL-14.9 | Transformer pads not accessible 24/7 (gated/restricted) | removed | — | Only transmission-related 24-hour access survives (AEDC 1.16.0(8)(vi), EL-3.32). |
| EL-14.10 | Storm inlets on curb in front of transformer blocking access | removed | — | Not covered. |
| EL-14.11 | Gates swinging toward transformer/vault blocking access | removed | — | Not covered. |
| EL-14.12 | Site features (trees, furniture, dumpster, hydrant) blocking transformer/vault access | combined | EL-2.22 (clearances; confirm pad on customer's property, not ROW); el/2.md narrative | Rolled into the generic transformer clearance/access check; specific obstruction enumeration dropped. |
| EL-14.13 | 10-ft wide vault door clearance zone not free of obstructions | removed | — | No vault-door clearance-zone check in v5.1. |
| EL-14.14 | Bike racks <10 ft from vault doors | removed | — | Not covered. |
| EL-14.15 | Transformer pad in floodplain / CWQZ (below 2 ft above 100-yr) | moved-cross-department | FWP-7.43 (generator/transformer above DFE+2 ft); FWP-5.22 (electrical in CWQZ/floodplain) | FFP/floodplain review owns this now. |
| EL-14.16 | Transformer pad over/within <10 ft of detention pond | removed | — | Not covered. |
| EL-14.17 | Transformer pads within stormwater control measures / rain gardens | removed | — | Not covered. |
| EL-14.18 | Transformer pads in parkland dedication areas or buffer zones | moved-cross-department | PARK-6.17 (utilities/transformers within parkland); EL-2.13 (also retained as a cross-reference in el/2.md) | Parks dept owns the primary check; el/2.md keeps a pointer. |
| EL-14.19 | Transformer pads in fire lanes | moved-cross-department | FIRE-12.8 ("Transformers, utility boxes, or utility infrastructure placed within fire lane clear width") | Clean cross-department move. |
| EL-14.20 | Transformer pads over basements/subgrade garages/subsurface structures | removed | — | Not covered. |
| EL-14.21 | Transformer pad on raised surface rather than at grade | removed | — | Not covered. |
| EL-14.22 | Transformers on riser poles without justification | removed | — | Not covered. |
| EL-14.23 | Vault doors blocked by great streets / furniture / trees | partial | sduf/3.md SDUF-3.39 (transformer vaults in Great Streets frontage — compatibility with streetscape) | SDUF covers the Great Streets angle tangentially; the broader vault-door-access check is gone. |
| EL-14.24 | Subgrade vault lacks proper access (no lift-out/ladder/grade-level doors) | removed | — | Vault access-method check absent. |
| EL-14.25 | Vault lacks direct 20-ft paved road truck access | removed | — | Not covered. |
| EL-14.26 | Vault doors too small for transformer installation or uncoordinated with AE | removed | — | Not covered. |
| EL-14.27 | Vault room fails minimum dimensions (36×30×13 or 28×30×13 ft) | removed | — | Not covered. |
| EL-14.28 | Niche <35 ft vertical clearance inside / at entrance | removed | — | Niches no longer appear anywhere in v5.1 checklists. |
| EL-14.29 | Vault truck access area <35 ft vertical clearance | removed | — | Not covered. |
| EL-14.30 | Area above lift-out panels lacks 35 ft vertical / has overhangs | removed | — | Not covered. |
| EL-14.31 | Garage access to vault doors <8 ft 2 in finished-floor-to-structure | removed | — | Not covered. |
| EL-14.32 | Vault/niche walls/ceilings lack 3-hr fire rating / CMU not concrete filled | removed | — | Not covered. |
| EL-14.33 | Vault exterior door <1½-hr / interior door <3-hr fire rating | removed | — | Not covered. |
| EL-14.34 | Exterior surfaces within 5 ft lat / 12 ft vert of vault openings lack 3-hr fire rating | removed | — | Not covered. |
| EL-14.35 | Vault/niche ventilation inadequate / dampers not 3-hr fire-rated | removed | — | Not covered. |
| EL-14.36 | Vault/niche below 100-yr floodplain elevation (<2 ft above RFD) | partial | FWP-7.9 (secondary/ancillary buildings incl. AE utility vaults must meet FFE freeboard); FWP-7.43 (transformer above DFE+2 ft) | Floodplain review handles the ancillary-structure case; the 2-ft-above-RFD specificity for vaults/niches is implicit, not explicit. |
| EL-14.37 | Vault rooms proposed outside downtown Network Area (prohibited) | removed | — | "Network Area" appears nowhere in v5.1. |
| EL-14.38 | Transformer not in line of sight of meter (obstructions) | removed | — | "Line of sight" transformer↔meter check gone (PARK-1.54 / ZLU-27 references are unrelated trail/dumpster sightlines). |
| EL-14.39 | Transformer↔meter sight distance excessive / undocumented (~150 ft) | removed | — | Not covered. |
| EL-14.40 | More than two 90° turns in electrical routing between transformer and meter | removed | — | UCM § 1.9.1.9.Q rule absent. |
| EL-14.41 | Electrical routing not cleared of drainage infrastructure (12-in / 5-ft) | partial | el/1.md EL-1.9 (12-in AE-underground to other utilities at perpendicular crossings, UCM 1.10.5.A) | EL-1.9 is a general AE-underground-vs-other-utilities rule, not transformer-routing-vs-drainage-specific. |
| EL-14.42 | Electrical routing transformer↔meter not 100% on private property | partial | EL-2.22 ("Confirm pad is on customer's property, not in public ROW") | Applies to pad placement, not the routing line between transformer and meter. |
| EL-14.43 | Load calculations / ESPA not provided for vault sizing | partial | EL-3.1 (ESPA required); el/3.md narrative | ESPA check retained generally; vault-sizing-specific load calc check gone. |
| EL-14.44 | Roads/driveways in transmission easement not designed for 46,000 lb tandem axle | partial | EL-3.32 (AEDC 1.16.0(8)(vii): "all roads and driveways in the transmission easement built to support ≥48,000 lb tandem axle loads") | Note new threshold is 48,000 lb (AEDC 1.16.0(8)(vii)) vs. 46,000 lb (UCM 1.14.4) — EL-3.32 cites the AEDC number. |
| EL-14.45 | Transmission bucket-truck access grade >8% | removed | — | Not covered. |
| EL-14.46 | Transmission access corridor <25 ft wide | combined | EL-1.19 (25-ft access corridor + 16-ft vertical clearance along full transmission ROW) | Merged with vertical-clearance item into a single transmission-corridor check. |
| EL-14.47 | Transmission turning movements / gates <16 ft (32 ft depending on angle) | removed | — | Not covered. |
| EL-14.48 | Curbs in transmission easement not laydown / <46k axle capacity | removed | — | Not covered. |
| EL-14.49 | No all-weather 24/7 access to each building for AE maintenance | removed | — | Not covered. |
| EL-14.50 | Access routes over underground detention not designed for 72,180 lb | removed | — | Fire-lane HS-20 check (FIRE-16.34) is a different standard. |
| EL-14.51 | Rear lot line construction without paved alley / AE-accessible road | removed | — | UCM § 1.3.15 no longer has a checklist row (mentioned briefly in EL-2.21 applicability notes only). |
| EL-14.52 | Area above vault access driveway not clear of vertical structures | removed | — | Not covered. |
| EL-14.53 | 24/7 vault access not maintained before/during/after construction | removed | — | Not covered. |
| EL-14.54 | Bollards missing when transformer within 4 ft of parking/traffic | partial | el/2.md narrative ("pads within 6 feet of parking/traffic area… bollards when ≤4 feet"); EL-2.22 | Narrative only; no dedicated bollard checklist row. |
| EL-14.55 | Transformer pads <2 ft from back of sidewalks | combined | EL-2.22 (includes "2 ft from back of sidewalks" in the consolidated clearance check) | Rolled into EL-2.22. |
| EL-14.56 | Primary conduit routed under buildings/structures | removed | — | Not covered. |
| EL-14.57 | Vault grounding (#4/0 bare Cu under floor, 6-ft stub-up, ≤25 Ω) not shown | removed | — | Not covered. |
| EL-14.58 | Oil reservoir not shown / not concrete-lined / drains to exterior | removed | — | Not covered. |
| EL-14.59 | Transformer landing area missing / <10×10 / not smooth trowel / <15,000 lb | removed | — | Not covered. |
| EL-14.60 | Vault floor not rated for transformer weight / landing extension not smooth trowel | removed | — | Not covered. |
| EL-14.61 | Lift-out panels over vault room / 30×30 fire-rated floor door specs missing | removed | — | Not covered. |
| EL-14.62 | Subsurface vault depth >18 ft from grade at lift-out to vault floor | removed | — | Not covered. |
| EL-14.63 | OSHA galvanized personnel ladder from lid to vault floor not shown | removed | — | Not covered. |
| EL-14.64 | Lighted staircase street-level-to-vault / emergency lighting panel circuit not shown | removed | — | Not covered. |
| EL-14.65 | Above-ground obstructions within 100 ft of transmission structure edge | removed | — | Not covered. |
| EL-14.66 | Transmission ROW gates <16 ft / no AE lock / not offset near structures | removed | — | Not covered. |
| EL-14.67 | Niche outside Network Area without AE Design consultation | removed | — | Niches dropped entirely. |
| EL-14.68 | Vault shown without evidence of AE Network Design approval | partial | EL-3.7 (AE approval for transformer/pull-box design); EL-3.10 (final layout & easement coordinated with AE) | Generic AE design-approval check survives; vault-specific (3–6 month allowance) gone. |
| EL-14.69 | Reduced clearances (3 ft) without AE Design written approval documented | combined | EL-2.22 (narrative notes reduced-clearance scenarios); zlu/15.md ZLU-15.40 (detailed clearance matrix, incl. "may be reduced to 3 ft with AE Design written approval") | ZLU-15.40 is the most faithful retention of the reduced-clearance documentation check. |
| EL-14.70 | Meters not on first floor / not in sight of transformer without AE+Metering approval | removed | — | Not covered. |
| EL-14.71 | Meters behind doors without AE Design written approval | removed | — | Not covered. |
| EL-14.72 | Set-up area / clearances reduced without AE Design deviation approval | partial | EL-2.22 narrative; el/1.md narrative (§ 1.3.16 thresholds) | Narrative mentions thresholds; no dedicated deviation-documentation check. |
| EL-14.73 | Outside ramp to vault entrance grade >12% | removed | — | Not covered. |

## Patterns

- **Detailed vault/niche construction regime eliminated.** Items EL-14.24–14.35, 14.52, 14.57–14.64, 14.73 (vault dimensions, fire-rated walls/doors/ventilation/dampers, grounding, oil reservoir, landing area, lift-out panels, personnel ladder, staircase, depth, ramp grade) are uniformly **removed**. v5.1 does not implement any vault-interior design checks. Niches removed entirely — zero mentions.
- **Network Area framework dropped.** Term "Network Area" appears nowhere in v5.1. EL-14.37 (vault-outside-Network-Area prohibition) and EL-14.67 (niche-outside-Network-Area without AE consult) have no successor.
- **Line-of-sight transformer↔meter removed.** EL-14.38–14.40 (line of sight, 150-ft sightline, two-90°-turns) all gone. UCM § 1.9.3.1 and § 1.9.1.9.Q no longer referenced in any checklist.
- **Cross-department moves are the expected ones.** Floodplain → FWP; fire lane → FIRE; parkland → PARK. These represent ~4 items; no surprise.
- **Compression into EL-2.22.** The surviving el/ checklist rolls all pad-clearance content (hot-stick 10 ft, brick 5 ft, non-op 3 ft, op 5 ft, oil-filled 20 ft, 6-ft traffic, 2-ft sidewalk, AE easement) into a single item. ZLU-15.40 duplicates this with a more thorough clearance matrix — possible cross-dept redundancy worth noting.
- **Truck access thresholds demoted to narrative.** 12-ft / 16-ft / 20×35-ft / 72,180 lb — present in narrative text (el/1.md, el/2.md) but not in any checklist row. Reviewer will not fire on these unless they're converted back to checks.
- **Transmission ROW access retains partial coverage.** EL-1.19 keeps 25-ft corridor + 16-ft vertical; EL-3.32 keeps the plat-notes bundle (incl. 48,000 lb tandem axle per AEDC, not the 46,000 lb UCM figure). EL-14.45–14.48, 14.65–14.66 (grade, turning, laydown curbs, gates, 100-ft obstruction zone) all removed.
- **ESPA / AE-design-approval framework preserved** in el/3.md (EL-3.1, 3.7, 3.10, 3.32) but without the vault-specific granularity (3–6 month vault design allowance, ESPA-for-vault-sizing).
- **Threshold drift:** EL-14.44 cites 46,000 lb (UCM 1.14.4); EL-3.32 cites 48,000 lb (AEDC 1.16.0(8)(vii)). Worth confirming which code is authoritative.

## Surprises

1. **73 → ~7 surviving checklist footprints.** EL-14 was one of the largest 5.0 files; more than two-thirds of its rows have no v5.1 successor at the checklist layer. If AE vault/niche reviews still happen at the City, this is a large visible gap.
2. **"Niche" and "Network Area" vanished entirely** from checklist text — not merged, not renamed, just gone.
3. **Line-of-sight transformer-to-meter** (a load-bearing Austin Energy operational rule, UCM 1.9.3.1) dropped with no successor — striking for an electrical guide.
4. **Threshold mismatch** between EL-14.44 (46k) and surviving EL-3.32 (48k) suggests someone picked the AEDC number without reconciling against UCM 1.14.4.
5. **ZLU-15.40 duplicates EL-2.22** with more detail — transformer pad clearances live in two departments' checklists now.
