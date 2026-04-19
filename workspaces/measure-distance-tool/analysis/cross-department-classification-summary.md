# Cross-Department Classification Summary

Classification of all 12,278 checklist items across 10 Austin departments
for distance-measurement applicability by the measure-distance tool.

---

## System-wide numbers

| | Count | % |
|---|---:|---:|
| **Total checklist items** | **12,278** | |
| Horizontal (tool CAN measure) | 1,537 | 12.5% |
| — distance-only | 943 | 7.7% |
| — distance-plus | 594 | 4.8% |
| Vertical/mixed (tool CANNOT measure yet) | 1,001 | 8.2% |
| Not applicable | 9,740 | 79.3% |

**The measure-distance tool can address 1,537 of 12,278 items (12.5%).**
Of those, 943 (7.7% of total) are "distance-only" where the measurement
alone resolves the verdict.

Adding a future **vertical distance** capability would address an additional
1,001 items (8.2%), bringing the combined addressable set to **2,538 items
(20.7%)** — roughly 1 in 5 of all checklist items across the city's review
system.

---

## Per-department breakdown

| Dept | Items | Horizontal | D-Only | D-Plus | Vert | N/A | % Horiz |
|------|------:|-----------:|-------:|-------:|-----:|----:|--------:|
| **EL** | 770 | 236 | 198 | 38 | 76 | 458 | **30.6%** |
| **FWP** | 441 | 121 | 32 | 89 | 13 | 307 | **27.4%** |
| **TA** | 1,757 | 436 | 267 | 169 | 127 | 1,194 | **24.8%** |
| **SDUF** | 492 | 115 | 77 | 38 | 33 | 344 | **23.4%** |
| **FIRE** | 831 | 161 | 102 | 59 | 19 | 651 | **19.4%** |
| **EPTP** | 1,197 | 139 | 50 | 89 | 14 | 1,044 | **11.6%** |
| **PARK** | 195 | 16 | 12 | 4 | 1 | 178 | **8.2%** |
| **ZLU** | 1,517 | 78 | 49 | 29 | 97 | 1,342 | **5.1%** |
| **WWP** | 2,640 | 136 | 67 | 69 | 100 | 2,404 | **5.2%** |
| **SDE** | 2,438 | 99 | 89 | 10 | 521 | 1,818 | **4.1%** |

### Ranked by distance-only count (pure MD opportunity)

1. **TA** — 267 distance-only items (driveway spacing, parking dimensions, sidewalk widths)
2. **EL** — 198 distance-only (clearances from electric infrastructure)
3. **FIRE** — 102 distance-only (hydrant spacing, fire lane widths, access distances)
4. **SDE** — 89 distance-only (pond setbacks, drainage easement widths)
5. **SDUF** — 77 distance-only (frontage percentages, tree spacing, sidewalk zones)
6. **WWP** — 67 distance-only (utility separation distances)
7. **EPTP** — 50 distance-only (street tree spacing, island widths)
8. **ZLU** — 49 distance-only (compatibility setbacks, building placement)
9. **FWP** — 32 distance-only (CWQZ setbacks, CEF buffers)
10. **PARK** — 12 distance-only (trail widths, setbacks)

---

## Investment case

### Horizontal measure-distance (current tool)

The tool addresses **1,537 items (12.5%)** across all departments. At the
run4 finding conversion rate of ~15% (all-horizontal) to ~27% (distance-plus
with severe violations), the tool converts previously-unverifiable findings
to concrete pass/fail verdicts with measured evidence.

**Projected impact at scale:**
- 1,537 horizontal items × 15% conversion rate = ~230 findings converted
  per complete review cycle across all departments
- 943 distance-only items × 8% conversion rate = ~75 "clean win" conversions

### Vertical measure-distance (future capability)

An additional **1,001 items (8.2%)** need vertical/3D clearance measurement.
The department with the highest vertical count is **SDE** (521 items — slope
checks, elevation comparisons, depth requirements). Adding vertical
capability would bring the combined addressable set to 2,538 items (20.7%).

### Department priority for experiment expansion

Based on horizontal item count, conversion potential, and variety of
measurement types:

1. **TA** — highest distance-only count (267), diverse measurement types
   (driveways, parking, sidewalks, bike facilities), high practical value
2. **EL** — already validated in runs 1-4, highest % horizontal (30.6%),
   experiment infrastructure exists
3. **FIRE** — 102 distance-only with high-value thresholds (hydrant spacing,
   fire access), clear regulatory impact
4. **SDUF** — 77 distance-only, 23.4% horizontal rate, urban forestry
   measurements (tree spacing, frontage)
5. **FWP** — 121 horizontal but mostly distance-plus (89/121), needs
   waterway classification alongside distance

---

## Methodology

- **EL** (guides 1, 2, 13): human-reviewed classification from el-md-exp
- **EL** (remaining 17 guides): programmatic keyword analysis
- **All other departments**: programmatic keyword analysis of deficiency text
- Sub-classification by keyword detection of additional requirements
  (species, orientation, equipment type, material, bollards, root barriers,
  documentation approval)
- **Should be spot-checked** — programmatic classification has edge cases,
  especially for items with both horizontal and vertical components or
  ambiguous wording
- Source data: `bureau/jurisdictions/austin/review-guides/<dept>/*.md`
- Output: `analysis/guides/<dept>/item-classification.json` per department
