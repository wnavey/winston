# EL-11 Audit: Electric Facility Plan Documentation and Labeling (v5.0) vs. v5.1

**5.0 source guide:** `el/11.md` — *Electric Facility Plan Documentation and Labeling*
**5.1 corpus commit:** `e8b7a31d85913302c053f1674f42023c561ed394` (bureau, `main`, 2026-04-23)
**5.1 el/ files inspected:** `el/1.md`, `el/2.md`, `el/3.md` (excluded `el-md-exp/`)
**Cross-department destinations searched:** `zlu/`, `park/`, `eptp/`, `sde/`, `sduf/`, `fire/`, `fwp/`, `wwp/`, `ta/` (moonlight, CAD-layer, legend/symbol, legibility, easement, property line search)

## Summary

The 5.0 guide `el/11.md` was the "documentation and labeling" catch-all: 33 deficiency items spanning clearance exhibits, facility labeling, symbols/legend, plan legibility, CAD standards, and moonlight tower plan-sheet carry-through. In 5.1, the `el/` guide was compressed from 20 files to 3, and most `el/11.md` items were either absorbed into the two clearance-focused items (`el/1.md` clearance envelopes; `el/3.md` AE coordination + moonlight), folded into the general AEDC 1.16.0 submittal checklist on `el/3.md`, or dropped entirely. **Substantial coverage reductions** in plan-presentation items (symbols, legend, scale, legibility, cut-off labels, consolidated notes) and in CAD technical specs (NAD 83 georeferencing, magenta layer naming, model space / UCS). These are *not* represented anywhere in 5.1 el/ or cross-department.

### Status counts (n = 33)

| Status | Count |
|---|---|
| retained | 0 |
| reworded | 1 |
| renumbered | 0 |
| moved-within-el | 4 |
| moved-cross-department | 1 |
| combined | 9 |
| split | 0 |
| partial | 7 |
| removed | 11 |

> "retained" requires verbatim or near-verbatim coverage; none of the 5.0 items survived unchanged. The closest are rewordings inside a differently-scoped checklist item.

## Audit Table

| 5.0 ID | Deficiency (truncated) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-11.1 | Clearance verification exhibits not provided, not engineered and scaled, or not included in permitted plan set | partial | el/1.md EL-1.26 | EL-1.26 requires graphical delineation of 7.5-ft and 15-ft envelopes on site/utility plans and AE-provided transmission analysis, but does not call out "engineered and scaled" requirement or explicit permitted-plan-set inclusion language. |
| EL-11.2 | Profile or cross-section drawings not provided demonstrating clearances between proposed structures (incl. overhangs, balconies, awnings, canopies) and electric facilities | removed | — | No 5.1 item requires profile/cross-section drawings with dimensioned building-element clearances. el/1.md Documents-to-Review mentions "Profile drawings" conceptually but no checklist enforces provision. |
| EL-11.3 | Clearance dimensions/heights for building elements not specified; clearances measured from pole centerline instead of outer conductor | partial | el/1.md EL-1.5; el/1.md EL-1.2, EL-1.3 | The pole-centerline vs. outer-conductor rule is preserved cleanly in EL-1.5. The building-element dimensioning (overhang/balcony/awning/canopy) aspect is dropped. |
| EL-11.4 | Clearance lines not depicting required clearances extending across property lines | removed | — | No 5.1 checklist item references clearance lines crossing property lines. |
| EL-11.5 | Clearance exhibits show only one envelope (7'-6" horizontal OR 15-ft radius) instead of both | combined | el/1.md EL-1.26; el/1.md EL-1.2, EL-1.3 | EL-1.26 requires graphical delineation of both envelopes; EL-1.2 and EL-1.3 enforce simultaneous compliance with both thresholds. 5.0 item's "exhibit shows only one" framing is folded into EL-1.26. |
| EL-11.6 | Proposed point of service not shown and labeled on all required plan sheets | removed | — | AEDC 1.16.0 language about "one point of service" appears in el/3.md regulatory overview only; no checklist item enforces labeling across sheets. |
| EL-11.7 | Primary routing from AE transformer to building not shown on plans | removed | — | No 5.1 checklist item covers primary-routing depiction. |
| EL-11.8 | Secondary riser configuration / one-line diagram not provided | removed | — | No 5.1 item references secondary riser or electrical one-line/riser diagram. |
| EL-11.9 | Electric facilities not clearly labeled on plans or labels missing facility type | partial | el/3.md EL-3.11 | EL-3.11 requires AutoCAD drawing showing AE facilities in submittal; it does not explicitly require each facility be labeled with type on the plan sheets. |
| EL-11.10 | Existing electric facilities to be removed or relocated not clearly labeled on demolition plan | removed | — | No 5.1 item covers demolition-plan labeling of removed/relocated AE facilities. (el/1.md EL-1.18 addresses transmission-specific demolition sequencing but not the removal labeling of distribution facilities generally.) |
| EL-11.11 | Electric facility labels missing size (conduit diameter, conductor gauge), depth, voltage, or ownership (AE vs. Customer) | removed | — | None of the 5.1 items require labeling of size/depth/voltage/ownership on facilities. |
| EL-11.12 | Disconnects not shown and labeled on electrical plans | removed | — | No 5.1 item references electrical disconnects. |
| EL-11.13 | Moonlight Tower and guy wire symbols not shown on all required sheets | moved-cross-department | zlu/21.md ZLU-21.6; el/3.md EL-3.13 (note language) | The "show on plan sheets" aspect moved to zlu/21.md ZLU-21.6 (locations identified on plan sheets within 100 ft). el/3.md EL-3.13 covers the permit-note requirement but not plan-sheet symbol carry-through. |
| EL-11.14 | 100-foot protection zones around Moonlight Tower not shown on all required sheets | partial | zlu/21.md ZLU-21.7 | ZLU-21.7 covers "protective barrier details" and tower protection during construction but does not enforce a 100-ft protection-zone graphic on all required sheet types (site, grading, utility, demolition, landscape). |
| EL-11.15 | Electric facility symbols not identified in legend; labels missing from plan features | removed | — | No 5.1 el/ or cross-department item enforces electric-facility legend identification. |
| EL-11.16 | Legend symbols do not match symbols actually used in plans | removed | — | No 5.1 item addresses legend/plan symbol consistency for electric. |
| EL-11.17 | Electric notes duplicated on multiple sheets instead of consolidated | removed | — | No 5.1 item addresses consolidation of electric notes to cover sheet / general notes sheet. |
| EL-11.18 | Call-outs, dimension lines, or labels cut off or incomplete at sheet margins | removed | — | No 5.1 item covers sheet-margin cut-off issues for electric plans. |
| EL-11.19 | Electric facilities not shown clearly/at legible scale; symbols too small to distinguish | removed | — | No 5.1 item addresses electric-facility scale/legibility. |
| EL-11.20 | Utility plan not provided at adequate scale to fill page; excessive white space | removed | — | No 5.1 item addresses utility-plan page-fill scale. |
| EL-11.21 | Landscape plan scale insufficient for electric facilities to be visible | removed | — | No 5.1 item covers landscape-plan scale for electric-facility visibility. |
| EL-11.22 | Electrical plans not legible due to compression, pixelation, inadequate line weights | removed | — | No 5.1 item covers electrical-plan legibility. |
| EL-11.23 | Electric utility easements not clearly delineated | combined | el/3.md EL-3.11; el/2.md EL-2.15, EL-2.16 | EL-3.11 requires public/private easements in the AE AutoCAD submittal. EL-2.15/EL-2.16 cover easement encroachment and licensing. None explicitly require clear on-plan delineation of electric easements with locations/extents, but the coverage is collectively close. |
| EL-11.24 | Property lines and building setbacks not shown on electric facility plans | partial | el/3.md EL-3.11 | EL-3.11 lists "property lines with building setbacks" as required AutoCAD submittal content. No separate checklist item enforces this on site/utility plan sheets. |
| EL-11.25 | Plans do not demonstrate AE personnel access to current/proposed electric facilities | reworded | el/3.md EL-3.12 | EL-3.12 is a direct reworded/elaborated version of the 5.0 item, citing AEDC 1.16.0(4) and adding the 12-ft/16-ft truck access dimension check. Primary. |
| EL-11.26 | Projected load required for electric service not provided | removed | — | No 5.1 item enforces projected-load provision. (Regulatory overview in el/3.md mentions projected load but no checklist asks for it.) |
| EL-11.27 | CAD files not georeferenced with NAD 83 Texas Central Zone 4203 | removed | — | No 5.1 item references NAD 83 coordinate system or georeferencing specifics. el/3.md EL-3.11 asks for "georeferenced AutoCAD drawing (2016 or newer)" generically, but without the coordinate-system test. |
| EL-11.28 | Electric facilities not on correct CAD layers (Elec. UG, Elec. OH, etc.) / not Magenta color | removed | — | No 5.1 item references the Elec. UG / Elec. OH / Elec. MH / Elec. Transf. / Elec. Pole layer names or the Magenta color standard. |
| EL-11.29 | Required electric facility objects not in model space or UCS not set to 'World' | removed | — | No 5.1 item references model space or UCS-to-World CAD settings. |
| EL-11.30 | Permanent structures not shown with both footprint and height | combined | el/3.md EL-3.11 | EL-3.11 names "permanent structures with footprint and height" as required AutoCAD drawing content. Folded into the submittal item — no standalone plan-sheet footprint+height requirement. |
| EL-11.31 | Plans do not show final proposed topology (grades, grade changes, floodplains, detention ponds) | combined | el/3.md EL-3.11 | EL-3.11 lists "final topology (grades, floodplains, detention ponds)" as required AutoCAD content. Same partial absorption pattern as EL-11.24 and EL-11.30. |
| EL-11.32 | Construction plans missing sequencing info for moonlight tower protection | moved-within-el | el/3.md EL-3.13, EL-3.14, EL-3.15; zlu/21.md ZLU-21.7 | Sequencing-specific language is not preserved verbatim, but moonlight protection/notification/barriers are split across el/3.md's three moonlight items and zlu/21.md ZLU-21.7. Closer to combined with cross-dept spillover. |
| EL-11.33 | Excavation/construction plans not provided for excavation within 100 ft of moonlight tower | partial | el/3.md EL-3.13; zlu/21.md ZLU-21.7 | COA § 14-11-173(9) citation itself is gone from the 5.1 corpus; the 100-ft permit requirement is preserved via EL-3.13 (COA § 14-11-201), and protection during construction via ZLU-21.7. The specific excavation-plan deliverable is not enforced. |

## Consolidation patterns observed

1. **AEDC 1.16.0 absorption.** Five 5.0 items (EL-11.23, EL-11.24, EL-11.27, EL-11.30, EL-11.31) all collapse into el/3.md EL-3.11, which enumerates the AEDC 1.16.0(1) AutoCAD submittal contents as a single checklist row. This is a legitimate combine, but each loses its dedicated on-plan enforcement.

2. **Plan-presentation deficiencies eliminated wholesale.** EL-11.15 through EL-11.22 (legend consistency, symbol legibility, scale-to-fill-page, compression/pixelation, cut-off labels, consolidated notes) have *zero* coverage in 5.1 el/ or any cross-department guide. This is the single largest loss: ~8 items representing QA of the plan-sheet presentation itself.

3. **Electrical-plan-detail deficiencies eliminated.** EL-11.6 (point of service labeling), EL-11.7 (primary routing), EL-11.8 (riser/one-line), EL-11.10 (demolition-plan labeling), EL-11.11 (size/depth/voltage/ownership labels), EL-11.12 (disconnects), EL-11.26 (projected load) are all removed. 5.1 does not checklist-enforce any electrical-plan content specifics.

4. **CAD technical-spec deficiencies fully removed.** The NAD 83 coordinate system, magenta layer colors, named Elec. UG/OH/MH/Transf./Pole layers, and model-space/UCS requirements (EL-11.27, EL-11.28, EL-11.29) are absent from 5.1. Only a generic "georeferenced AutoCAD" mention survives inside EL-3.11.

5. **Moonlight tower carry-through split cross-department.** The plan-sheet symbol/protection-zone items (EL-11.13, EL-11.14, EL-11.32, EL-11.33) are partially picked up by `zlu/21.md` (historic preservation / overlay) rather than staying in el/. el/3.md retains the *note* requirements (EL-3.13, EL-3.14, EL-3.15) but none of the plan-sheet carry-through or excavation-plan provision requirements.

6. **Clearance exhibit items compressed into EL-1.26.** EL-11.1, EL-11.3, EL-11.5 collectively collapse into el/1.md EL-1.26 (plus EL-1.2/EL-1.3/EL-1.5 as the arithmetic enforcers). "Engineered and scaled" language and building-element dimensioning (overhangs/balconies/awnings/canopies) are lost in translation.

## Notable surprises

- **Zero "retained" items.** Every single 5.0 EL-11 deficiency was either reshaped or dropped — no verbatim survivors.
- **~33% removal rate.** 11 of 33 items have *no* 5.1 counterpart anywhere (not in el/, not cross-department).
- **Plan QA is the biggest loss.** 5.0 EL-11 was effectively the AE plan-sheet QA checklist (legend, symbols, scale, legibility, cut-off, consolidated notes). None of this is enforced in 5.1.
- **CAD file standards wiped.** The most technically specific requirements in 5.0 EL-11 (NAD 83 zone, magenta, named layers, model space/UCS) are entirely absent from 5.1. This is likely deliberate (these are AE-internal review items, not what reviewers catch), but worth confirming with the training team.
- **Moonlight tower items migrated to zlu/.** The electrical review guide no longer owns the "show moonlight tower and protection zone on sheets" checks — those are now zlu/21.md (zoning/land-use overlay). el/3.md only retains the plan-*note* requirements.
