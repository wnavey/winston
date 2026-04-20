# Item Conversion: Baseline → Experiment Run 4

**Review guide**: `el-md-exp` (EL guides 1, 2, 13 — 101 checklist items)
**Baseline**: `runs/baseline-2026-04-15` (no measure-distance tool)
**Experiment**: `runs/experiment-run4` (with tool, two-call Gemini pipeline)

Each table shows the consolidated status transition for every checklist item
that changed or was flagged. Items that were pass in both baseline and
experiment are omitted.

## Union (production: flagged if ≥1 run)

| Status | Baseline | Experiment | Delta |
|---|---:|---:|---:|
| Pass | 5 | 5 | +0 |
| Not-verifiable | 31 | 44 | +13 |
| Fail | 35 | 22 | -13 |

### not-verifiable → pass (4 items)

| ID | Deficiency |
|---|---|
| EL-1.25 | Sidewalks not cleared from existing power poles at each end of property along right-of-way |
| EL-2.13 | Tree clearances measured from tree canopy instead of from tree trunk (planting location) |
| EL-2.8 | Trees proposed within 5 lateral feet of underground electric equipment |
| EL-2.9 | Trees proposed within 20 lateral feet of underground electric equipment lack required root barriers (minimum 4 feet deep, positioned 5 feet from equipment) |

### not-verifiable → fail (8 items)

| ID | Deficiency |
|---|---|
| EL-1.1 | Buildings and permanent structures do not maintain minimum 7 feet 6 inches horizontal sky-to-ground clearance from overhead electric conductors |
| EL-1.14 | Retaining walls do not maintain minimum 7.5-foot horizontal sky-to-ground clearance from outermost electric line where overhead facilities are present |
| EL-1.17 | Retaining walls lack section exhibits showing dimensions from outer electric conductor to outermost edge of wall for clearance verification |
| EL-1.3 | Building projections (overhangs, awnings, balconies, decks, roofs, patios) do not maintain required clearances from overhead electric conductors |
| EL-1.6 | Buildings do not maintain minimum 7.5-foot horizontal sky-to-ground clearance and 15-foot radial clearance from overhead electric facilities in right-of-way adjacent to site |
| EL-2.12 | Tree clearances measured from utility pole centerline or structure instead of from outer electric conductor |
| EL-2.6 | Trees proposed within 10 lateral feet of overhead electric utility pole |
| EL-2.7 | Trees proposed within 10 lateral feet of pad-mounted electric equipment, or between equipment access door and drivable surface |

### not-verifiable → not-verifiable (19 items)

| ID | Deficiency |
|---|---|
| EL-1.18 | Driveways do not maintain minimum 16-foot vertical clearance (parking without truck traffic) or 18-foot vertical clearance (areas with truck traffic) from lowest point of overhead electric facilities including telecommunications attachments |
| EL-1.2 | Customer facilities do not maintain minimum 15-foot radial clearance from outside conductor of overhead distribution primary and neutral conductors |
| EL-13.11 | Transformer pad hot-stick use area (access door side) lacks minimum 15-foot clearance when facing confined space (niche, vault, or enclosed area on 3+ sides) |
| EL-13.14 | Shrubs or low-lying vegetation lack minimum 10 lateral feet clearance from transformer access door side, or lack minimum 5 lateral feet clearance from other sides (non-access door) |
| EL-13.16 | Transformer pads lack minimum 5-foot clearance from dumpsters |
| EL-13.17 | Transformer pads lack minimum 5-foot clearance from bike racks |
| EL-13.18 | Transformer pads lack minimum 5-foot clearance from light poles |
| EL-13.2 | Transformer pads lack minimum 5-foot clearance from retaining walls |
| EL-13.24 | Transformer pads lack minimum horizontal clearance from gas lines (24 inches minimum for gas pipelines less than 60 psi, 36 inches minimum for high-pressure gas 60 psi and over) |
| EL-13.27 | Transformer locations lack minimum 7.5-foot horizontal sky-to-ground clearance from overhead distribution line conductors (primary, neutral, and secondary), extending from ground to sky |
| EL-13.28 | Transformer locations or proposed facilities lack minimum 15-foot radius clearance from overhead distribution primary and neutral conductors (measured from conductors, not pole centerline) |
| EL-13.29 | Transformer locations in enclosed or notched-out areas (niches) lack minimum 35-foot vertical clearance inside niche and niche entrance, or lack cross-section drawings demonstrating clearance |
| EL-13.30 | Niche service installations lack required 3-hour fire wall rating for walls and ceilings, proper ventilation specifications, or documentation of consultation with Austin Energy Design business unit |
| EL-13.39 | Customer facilities (buildings, parking garages, light poles, signs, billboards, chimneys, antennas, tanks) installed under or over Austin Energy overhead distribution facilities |
| EL-13.4 | Transformer pads with reduced clearances (3 feet to brick/masonry buildings) lack documentation of Austin Energy Design written approval or do not meet required conditions (not in confined space, 10 ft+ to windows/doors/ducts, 15 ft+ vertical clearance to windows/doors/ducts, 3-hour fire rating) |
| EL-13.5 | Transformer pads lack minimum 5-foot lateral clearance from balconies and building overhangs, or have coverings/structures directly above pad or minimum equipment area |
| EL-13.8 | Transformer pads lack required clearance from stairwells serving as fire exits |
| EL-13.9 | Transformer pads lack minimum 20-foot horizontal/radial clearance from fire escapes or stairs serving as fire escapes (oil-filled equipment) |
| EL-2.1 | Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment |

### fail → pass (1 items)

| ID | Deficiency |
|---|---|
| EL-1.27 | Customer facilities proposed to be installed under or over Austin Energy overhead distribution facilities in violation of prohibition, or items within electric easements do not maintain minimum 7.5-foot clearance from outside conductor |

### fail → not-verifiable (20 items)

| ID | Deficiency |
|---|---|
| EL-1.23 | Clearance dimensions measured from utility pole or centerline instead of from outside conductor or outermost electric line as required by code |
| EL-13.1 | Transformer pads lack minimum 5-foot clearance from buildings, structures, and building foundations |
| EL-13.10 | Transformer pad hot-stick use area (access door side) lacks minimum 10-foot clearance to open area or adjacent building/structure |
| EL-13.12 | Transformer pads lack minimum 5-foot clearance from fire hydrants |
| EL-13.13 | Trees within 10 lateral feet of pad-mounted equipment are not identified as utility-compatible species per ECM Appendix F, or trees within 15 lateral feet of overhead electric distribution conductors are not utility-compatible |
| EL-13.15 | Trees within 20 lateral feet of underground electric equipment lack required root barriers (minimum 4 feet deep, installed 5 feet from equipment) |
| EL-13.19 | Transformer pads lack minimum 15-foot clearance from fire lanes |
| EL-13.20 | Transformer pads lack minimum 5-foot clearance from other transformer pads |
| EL-13.21 | Transformer pads lack minimum 5-foot horizontal clearance from water lines |
| EL-13.22 | Transformer pads lack minimum 5-foot horizontal clearance from wastewater lines |
| EL-13.23 | Transformer pads lack minimum 5-foot horizontal clearance from storm drain lines |
| EL-13.25 | Transformer pads lack minimum 12-inch horizontal and vertical clearance from other underground utilities (except gas, fuel, steam) |
| EL-13.26 | Transformer pads or AE underground facilities located over or under other utility lines, or customer buildings/foundations/structures installed over AE underground facilities |
| EL-13.3 | Transformer pads lack required clearance from fences and gates - 5 feet for sides with operators/controls, 3 feet for sides without operators/controls (from removable ventilated fences) |
| EL-13.32 | Grading plan shows drainage slopes toward building from oil-filled transformer pad location (liquid flow must be away from building) |
| EL-13.33 | Transformer pads not located 100% on private property, located in public right-of-way, or straddling property lines |
| EL-13.34 | Transformer pads located in prohibited easements including drainage easements, water easements, sewer easements, or electrical easements under overhead lines without Austin Energy Design written approval |
| EL-13.36 | Electrical routing from transformer to meter not 100% on private property |
| EL-13.6 | Transformer pads lack minimum 12-foot horizontal clearance from windows, doors, or ventilating ducts when window/door/duct is less than 12 feet from grade or has less than 5 feet lateral separation (oil-filled equipment) |
| EL-13.7 | Transformer pads not located minimum 2 feet from back of sidewalks |

### fail → fail (14 items)

| ID | Deficiency |
|---|---|
| EL-1.31 | Survey by registered surveyor showing pole locations and mid-span clearances not provided when existing overhead facilities may not meet minimum vertical clearance requirements |
| EL-1.37 | Trees proposed within 10 lateral feet of overhead distribution conductors or 50 lateral feet of overhead transmission conductors are not from Utility Compatible Shade Trees list, or site grading does not meet required clearances from transmission facilities |
| EL-1.46 | Plans do not include required note that owner/contractor must notify Austin Energy at least 48 hours before work begins near high-voltage overhead lines |
| EL-1.7 | Surveyed elevations and locations of overhead conductors not included on building elevation sheets to demonstrate required clearances are met |
| EL-1.8 | Section and plan view exhibits do not show dimensions from outer electric conductor to outermost edge of buildings and building projections for clearance verification |
| EL-13.31 | Cross-section drawings not provided showing vertical clearances in access paths with overhead structures, parking garages, or enclosed areas |
| EL-13.35 | Transformer easements not shown around pads, or easement width inadequate for Austin Energy accessibility requirements |
| EL-13.37 | Transformer pad dimensions do not match Austin Energy Design-approved transformer pad detail sheets for specified service type (single-phase or three-phase) |
| EL-13.38 | Equipment pad installed within 4 feet of parking areas or vehicle routes lacks required 4-inch minimum diameter galvanized rigid metal posts (bollards) per AE Design equipment pad details, or bollards not spaced to allow equipment door opening |
| EL-2.10 | Plant legend or plant schedule does not identify species of trees proposed near electric facilities |
| EL-2.11 | Large trees (mature height 40+ feet per ECM Appendix F) not differentiated on plans to allow verification of clearances from overhead electric facilities |
| EL-2.14 | Trees not shown on landscape plan in relation to overhead electric facilities, preventing clearance verification |
| EL-2.15 | Plans propose trees within prohibited clearance zones without documented Austin Energy written approval |
| EL-2.3 | Large trees (mature height 40+ feet per ECM Appendix F) proposed within 25 lateral feet of overhead electric distribution conductor or equipment |

### pass → not-verifiable (5 items)

| ID | Deficiency |
|---|---|
| EL-1.19 | Vehicles parked or displayed on concrete pads do not maintain minimum vertical clearance from lowest overhead electric lines, or requirement not noted on site plans |
| EL-1.42 | Down guy anchor points lack dedicated easement 10 feet wide extending 5 feet past where down guy enters ground |
| EL-1.43 | Transformers do not maintain minimum 7.5-foot vertical sky-to-ground clearance from overhead electric lines |
| EL-2.2 | Non-utility-compatible trees proposed within 50 lateral feet of overhead electric transmission conductor or equipment |
| EL-2.4 | Large trees (mature height 40+ feet per ECM Appendix F) proposed within 50 lateral feet of overhead electric transmission conductor or equipment |

---

## Majority Vote (flagged if ≥2 of 3 runs)

| Status | Baseline | Experiment | Delta |
|---|---:|---:|---:|
| Pass | 18 | 27 | +9 |
| Not-verifiable | 19 | 28 | +9 |
| Fail | 34 | 16 | -18 |

### not-verifiable → pass (7 items)

| ID | Deficiency |
|---|---|
| EL-1.2 | Customer facilities do not maintain minimum 15-foot radial clearance from outside conductor of overhead distribution primary and neutral conductors |
| EL-13.39 | Customer facilities (buildings, parking garages, light poles, signs, billboards, chimneys, antennas, tanks) installed under or over Austin Energy overhead distribution facilities |
| EL-13.8 | Transformer pads lack required clearance from stairwells serving as fire exits |
| EL-13.9 | Transformer pads lack minimum 20-foot horizontal/radial clearance from fire escapes or stairs serving as fire escapes (oil-filled equipment) |
| EL-2.6 | Trees proposed within 10 lateral feet of overhead electric utility pole |
| EL-2.8 | Trees proposed within 5 lateral feet of underground electric equipment |
| EL-2.9 | Trees proposed within 20 lateral feet of underground electric equipment lack required root barriers (minimum 4 feet deep, positioned 5 feet from equipment) |

### not-verifiable → fail (2 items)

| ID | Deficiency |
|---|---|
| EL-1.1 | Buildings and permanent structures do not maintain minimum 7 feet 6 inches horizontal sky-to-ground clearance from overhead electric conductors |
| EL-1.3 | Building projections (overhangs, awnings, balconies, decks, roofs, patios) do not maintain required clearances from overhead electric conductors |

### not-verifiable → not-verifiable (10 items)

| ID | Deficiency |
|---|---|
| EL-1.18 | Driveways do not maintain minimum 16-foot vertical clearance (parking without truck traffic) or 18-foot vertical clearance (areas with truck traffic) from lowest point of overhead electric facilities including telecommunications attachments |
| EL-13.11 | Transformer pad hot-stick use area (access door side) lacks minimum 15-foot clearance when facing confined space (niche, vault, or enclosed area on 3+ sides) |
| EL-13.14 | Shrubs or low-lying vegetation lack minimum 10 lateral feet clearance from transformer access door side, or lack minimum 5 lateral feet clearance from other sides (non-access door) |
| EL-13.17 | Transformer pads lack minimum 5-foot clearance from bike racks |
| EL-13.18 | Transformer pads lack minimum 5-foot clearance from light poles |
| EL-13.24 | Transformer pads lack minimum horizontal clearance from gas lines (24 inches minimum for gas pipelines less than 60 psi, 36 inches minimum for high-pressure gas 60 psi and over) |
| EL-13.27 | Transformer locations lack minimum 7.5-foot horizontal sky-to-ground clearance from overhead distribution line conductors (primary, neutral, and secondary), extending from ground to sky |
| EL-13.28 | Transformer locations or proposed facilities lack minimum 15-foot radius clearance from overhead distribution primary and neutral conductors (measured from conductors, not pole centerline) |
| EL-13.4 | Transformer pads with reduced clearances (3 feet to brick/masonry buildings) lack documentation of Austin Energy Design written approval or do not meet required conditions (not in confined space, 10 ft+ to windows/doors/ducts, 15 ft+ vertical clearance to windows/doors/ducts, 3-hour fire rating) |
| EL-2.1 | Non-utility-compatible trees proposed within 15 lateral feet of overhead electric distribution conductor or equipment |

### fail → pass (5 items)

| ID | Deficiency |
|---|---|
| EL-13.1 | Transformer pads lack minimum 5-foot clearance from buildings, structures, and building foundations |
| EL-13.21 | Transformer pads lack minimum 5-foot horizontal clearance from water lines |
| EL-13.22 | Transformer pads lack minimum 5-foot horizontal clearance from wastewater lines |
| EL-13.23 | Transformer pads lack minimum 5-foot horizontal clearance from storm drain lines |
| EL-2.14 | Trees not shown on landscape plan in relation to overhead electric facilities, preventing clearance verification |

### fail → not-verifiable (16 items)

| ID | Deficiency |
|---|---|
| EL-1.23 | Clearance dimensions measured from utility pole or centerline instead of from outside conductor or outermost electric line as required by code |
| EL-13.10 | Transformer pad hot-stick use area (access door side) lacks minimum 10-foot clearance to open area or adjacent building/structure |
| EL-13.12 | Transformer pads lack minimum 5-foot clearance from fire hydrants |
| EL-13.13 | Trees within 10 lateral feet of pad-mounted equipment are not identified as utility-compatible species per ECM Appendix F, or trees within 15 lateral feet of overhead electric distribution conductors are not utility-compatible |
| EL-13.15 | Trees within 20 lateral feet of underground electric equipment lack required root barriers (minimum 4 feet deep, installed 5 feet from equipment) |
| EL-13.19 | Transformer pads lack minimum 15-foot clearance from fire lanes |
| EL-13.20 | Transformer pads lack minimum 5-foot clearance from other transformer pads |
| EL-13.25 | Transformer pads lack minimum 12-inch horizontal and vertical clearance from other underground utilities (except gas, fuel, steam) |
| EL-13.26 | Transformer pads or AE underground facilities located over or under other utility lines, or customer buildings/foundations/structures installed over AE underground facilities |
| EL-13.3 | Transformer pads lack required clearance from fences and gates - 5 feet for sides with operators/controls, 3 feet for sides without operators/controls (from removable ventilated fences) |
| EL-13.32 | Grading plan shows drainage slopes toward building from oil-filled transformer pad location (liquid flow must be away from building) |
| EL-13.33 | Transformer pads not located 100% on private property, located in public right-of-way, or straddling property lines |
| EL-13.34 | Transformer pads located in prohibited easements including drainage easements, water easements, sewer easements, or electrical easements under overhead lines without Austin Energy Design written approval |
| EL-13.36 | Electrical routing from transformer to meter not 100% on private property |
| EL-13.6 | Transformer pads lack minimum 12-foot horizontal clearance from windows, doors, or ventilating ducts when window/door/duct is less than 12 feet from grade or has less than 5 feet lateral separation (oil-filled equipment) |
| EL-13.7 | Transformer pads not located minimum 2 feet from back of sidewalks |

### fail → fail (13 items)

| ID | Deficiency |
|---|---|
| EL-1.31 | Survey by registered surveyor showing pole locations and mid-span clearances not provided when existing overhead facilities may not meet minimum vertical clearance requirements |
| EL-1.37 | Trees proposed within 10 lateral feet of overhead distribution conductors or 50 lateral feet of overhead transmission conductors are not from Utility Compatible Shade Trees list, or site grading does not meet required clearances from transmission facilities |
| EL-1.46 | Plans do not include required note that owner/contractor must notify Austin Energy at least 48 hours before work begins near high-voltage overhead lines |
| EL-1.7 | Surveyed elevations and locations of overhead conductors not included on building elevation sheets to demonstrate required clearances are met |
| EL-1.8 | Section and plan view exhibits do not show dimensions from outer electric conductor to outermost edge of buildings and building projections for clearance verification |
| EL-13.31 | Cross-section drawings not provided showing vertical clearances in access paths with overhead structures, parking garages, or enclosed areas |
| EL-13.35 | Transformer easements not shown around pads, or easement width inadequate for Austin Energy accessibility requirements |
| EL-13.37 | Transformer pad dimensions do not match Austin Energy Design-approved transformer pad detail sheets for specified service type (single-phase or three-phase) |
| EL-13.38 | Equipment pad installed within 4 feet of parking areas or vehicle routes lacks required 4-inch minimum diameter galvanized rigid metal posts (bollards) per AE Design equipment pad details, or bollards not spaced to allow equipment door opening |
| EL-2.10 | Plant legend or plant schedule does not identify species of trees proposed near electric facilities |
| EL-2.11 | Large trees (mature height 40+ feet per ECM Appendix F) not differentiated on plans to allow verification of clearances from overhead electric facilities |
| EL-2.15 | Plans propose trees within prohibited clearance zones without documented Austin Energy written approval |
| EL-2.3 | Large trees (mature height 40+ feet per ECM Appendix F) proposed within 25 lateral feet of overhead electric distribution conductor or equipment |

### pass → not-verifiable (2 items)

| ID | Deficiency |
|---|---|
| EL-13.16 | Transformer pads lack minimum 5-foot clearance from dumpsters |
| EL-13.5 | Transformer pads lack minimum 5-foot lateral clearance from balconies and building overhangs, or have coverings/structures directly above pad or minimum equipment area |

### pass → fail (1 items)

| ID | Deficiency |
|---|---|
| EL-1.6 | Buildings do not maintain minimum 7.5-foot horizontal sky-to-ground clearance and 15-foot radial clearance from overhead electric facilities in right-of-way adjacent to site |

---
