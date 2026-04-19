# Recommended Items for Manual Validation

Curated set of checklist items to manually verify the measure-distance tool's
accuracy. Organized into two groups: items from the existing el-md-exp
experiments (where we have before/after data), and simple candidates from the
broader EL department (for future experiment expansion).

The goal: open the debug viewer, look at the sheet + bboxes + measured
distance, and confirm whether the tool got it right.

---

## Group 1: el-md-exp items with measurement evidence (run4)

These converted from `not-verifiable` (baseline) to `fail` (run4) AND cite
specific measured distances. They're the strongest candidates for manual
validation because you can compare the tool's measured value against what
you see on the sheet.

### 1. EL-2.6 — Tree within 10 ft of utility pole ⭐ Best starting point

- **Guide:** 2.md (Tree Clearances)
- **Threshold:** 10 feet
- **Sheet:** 31 (Landscape Plan)
- **Run4 finding:** "Mitigation tree (M symbol) positioned only **9.2 feet**
  from the utility pole on the southeastern property boundary. Violates the
  minimum 10-foot clearance."
- **Why validate this one first:** Clear single-pair measurement (tree to pole),
  specific distance cited (9.2 ft), unambiguous threshold (10 ft), and the
  verdict hinges on whether 9.2 ft is correct. If the real distance is 11 ft,
  the tool produced a false fail. If it's truly ~9 ft, the tool caught a real
  violation.
- **What to check in the viewer:** Open run4, find this call-dir, toggle
  between call 1 and call 2. Is the tree bbox on the correct tree? Is the
  pole bbox on the correct pole? Does 9.2 ft look right given the 1"=20' scale?

### 2. EL-2.7 — Tree within 10 ft of transformer pad

- **Guide:** 2.md (Tree Clearances)
- **Threshold:** 10 feet
- **Sheet:** 31 (Landscape Plan)
- **Run4 finding:** "Tree at **4.3 feet** lateral distance from transformer
  pad located west of Building 1."
- **Why validate:** Another clear single-pair measurement. 4.3 ft is well
  below the 10 ft threshold — is it really that close? Check if the tool
  identified the correct transformer pad (there are 5 on this site).

### 3. EL-13.38 — Transformer pad within 4 ft of parking (run-2/13.md)

- **Guide:** 13.md (Transformer Pad Clearances)
- **Threshold:** 4 feet (trigger for bollard requirement)
- **Sheet:** 21 (Electrical Plan)
- **Run4 finding (fail→fail with measurement):** "Transformer Pad 4 is
  located only **0.6 feet** from a parking or vehicle circulation area."
- **Why validate:** 0.6 feet is extremely close — less than 8 inches. This
  would be a dramatic violation if correct, or a measurement error if the
  tool misidentified the parking edge. Verify in the viewer: is the parking
  area bbox on the actual pavement edge or on a curb/sidewalk?

### 4. EL-2.3 — Large tree within 25 ft of OHE

- **Guide:** 2.md (Tree Clearances)
- **Threshold:** 25 feet
- **Sheet:** 31 (Landscape Plan)
- **Run4 finding:** "Three mitigation trees measured at **0 feet** lateral
  distance from overhead distribution conductor, within the 25-foot
  restriction zone."
- **Why validate:** The 0-foot measurement could mean the tree symbol
  literally overlaps the OHE line on the drawing, OR it could be a
  measurement artifact. Check: does the tree icon sit directly on the
  dashed OHE line? If so, 0 ft is correct (the tree is planted under
  the line).

### 5. EL-1.37 — Trees within 10 ft of OHE (run-1/1.md, fail→fail)

- **Guide:** 1.md (Site Feature Clearances)
- **Threshold:** 10 feet
- **Sheet:** 31 (Landscape Plan)
- **Run4 finding:** "Measured distances **3.3 feet and 0 feet** from OHE
  line per measure-distance tool."
- **Why validate:** Two measurements in one finding — one at 3.3 ft and
  one at 0 ft. This was the first time item 1.md ever produced an MD
  measurement. Check if the 3.3 ft measurement is plausible.

---

## Group 2: Simple candidates outside el-md-exp (for future experiments)

These are distance-only items from guides 3, 4, 5 with clear thresholds and
straightforward object pairs. Good candidates for expanding the experiment
beyond the current 3-guide pilot.

### From Guide 3 — Underground Electric Clearances

| Item | Threshold | Objects | Why it's simple |
|------|-----------|---------|-----------------|
| EL-3.1 | 5 ft | Building foundation ↔ underground duct bank | Two visible features, clear 5-ft threshold |
| EL-3.2 | 5 ft | Fence/patio/retaining wall ↔ duct bank | Same as above but different site feature |
| EL-3.4 | 5 ft | Streetlight conduit ↔ building foundation | Two line features, 5-ft separation |
| EL-3.41 | 3 ft | Electric meter ↔ gas meter | Two small features, tight 3-ft threshold |
| EL-3.42 | 20 ft | Electric meter ↔ disconnect | Two features, larger threshold (easier to verify visually) |

### From Guide 4 — Transmission Lines and Construction Safety

| Item | Threshold | Objects | Why it's simple |
|------|-----------|---------|-----------------|
| EL-4.22 | 25 ft | Irrigation sprinklers ↔ transmission structure | Feature-to-structure, 25-ft threshold |
| EL-4.18 | 25 ft | Grading/excavation ↔ transmission structure | Area-to-structure, same threshold |
| EL-4.11 | 10 ft | Dumpster ↔ transmission facility | Small feature to structure, 10-ft threshold |

### From Guide 5 — Encroachments into Electric Easements

Guide 5 has the highest horizontal item density (87% of items). These
are mostly "is feature X inside/outside the easement boundary" checks:

| Item | Threshold | Objects | Why it's simple |
|------|-----------|---------|-----------------|
| EL-5.3 | 0 ft | Customer facility ↔ easement boundary | Inside/outside check, binary |
| EL-5.11 | 7.5 ft | Structure ↔ overhead conductor in easement | Same threshold as guide 1 items |
| EL-5.15 | 5 ft | Foundation ↔ duct bank in easement | Same as EL-3.1 but easement context |

---

## Validation workflow

For each item above:

1. Open the **debug viewer** (`./viewer/serve.sh`)
2. Navigate to the relevant run/case in the left panel
3. In Step 3 (Detection), toggle between **Call 1** and **Call 2** to see both
   the coarse and refined localizations
4. Check:
   - Are the bboxes on the correct objects? (right tree, right pole, etc.)
   - Does the nearestPoint dot look reasonable? (on the edge of the object
     facing the other object?)
   - Does the measured distance match your visual estimate using the scale bar?
5. Record your assessment: ✅ correct / ⚠️ close but off / ❌ wrong

This becomes the seed of the Phase 2 ground truth dataset from the science
plan.
