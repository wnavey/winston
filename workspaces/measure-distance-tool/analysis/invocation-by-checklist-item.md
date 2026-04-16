# Measure-Distance Tool — Invocations by Checklist Item

**Project:** Valley View Townhomes (`63cead15-41f8-418c-b0ef-bd5c2b44719a`)
**Discipline:** Electric (`el`), workflow `review-4.3` v4.3.0
**Run:** 2026-04-15 local, workflow run `3a773334-8f27-4a92-85ef-5941c4a7d788`
**Companion report:** `measure-distance-tool-usage-report.md`

---

## Attribution caveat — read first

The workflow binds tool invocations to a **guide item** (a markdown file such as `13.md`), not to a specific deficiency ID. The Haiku agent is given an entire guide file's checklist at once and decides for itself when to call the measure-distance tool during its research phase. The logs record *which guide file* was being evaluated when the tool fired, but not which specific deficiency line the agent was thinking about when it made the call.

That means this report distinguishes three levels of confidence about the tool → deficiency mapping:

- **Tier A — Tool explicitly named in the finding.** The strongest evidence. One such case exists.
- **Tier B — Finding contains a quantitative distance claim *and* the guide item had a successful tool call.** Likely tool-informed, but the agent didn't cite the tool.
- **Tier C — Finding contains a quantitative distance claim, but its guide item had no successful tool call.** Almost certainly a visual/scale estimate, not tool-derived.

Tier A is the only category that can be defended as a tool citation in an audit.

---

## Guide items that invoked the tool

Seven of twenty el-discipline guide items invoked measure-distance. Four of these items never got a usable measurement back (all calls timed out in `callPython`):

| Guide item | Title | Invocations | Successes | Failures | Result |
|---|---|---:|---:|---:|---|
| `2.md` — el-2 | Tree Clearances from Overhead Electric Lines | 2 | 1 | 1 | ✅ partial |
| `3.md` — el-3 | Underground Electric Clearances and Utility Separation | 4 | 0 | 4 | ❌ all timeouts |
| `4.md` — el-4 | Transmission Lines and Construction Safety | 1 | 0 | 1 | ❌ timeout |
| `7.md` — el-7 | Electric Easement Legal Documentation | 1 | 1 | 0 | ✅ |
| `13.md` — el-13 | Transformer Pad Clearances and Location Requirements | 5 | 2 | 3 | ✅ partial |
| `14.md` — el-14 | Transformer Access and Installation Requirements | 5 | 0 | 5 | ❌ all failures |
| `16.md` — el-16 | Vegetation Near Electric Facilities | 2 | 1 | 1 | ✅ partial |
| **Total** | | **19** | **6** | **13** | |

Thirteen guide items (`1, 5, 6, 8, 9, 10, 11, 12, 15, 17, 18, 19, 20`) never invoked the tool.

---

## Deficiency IDs referenced during/after tool invocations

Grouped by guide item. Only listing deficiencies whose observation or reasoning text contains a quantitative distance claim *or* an explicit tool reference. Deficiencies without measurement language are omitted even if they're in the same guide file.

---

### Guide `2.md` — Tree Clearances from Overhead Electric Lines

- **Successful calls:** 1 (run-3, sheet 31: mitigation trees → OHE line on southern boundary)
- **Deficiency IDs referencing measurement:**

| Deficiency ID | Tier | Runs observed | Excerpt |
|---|---|---|---|
| EL-2.1 | B | run-1, run-3 | — |
| EL-2.3 | C | run-1, run-3 | "27 inches (Tree 4027), and 24 inches (Tree 4038), all marked as Appendix F species" *(tree caliper, not tool)* |
| EL-2.6 | B | run-1, run-2 | "tree symbols intersect the OHE utility line with zero (0) feet lateral distance measured" |
| EL-2.9 | C | run-2 | "minimum 4 feet deep, positioned 5 feet from equipment" *(code citation)* |
| EL-2.10 | B | run-3 | "three mitigation trees ('M' label) in the southeast corner positioned less than 15 feet from the OHE line" |
| EL-2.11 | C | run-1, run-3 | "Live Oak specimens ranging from 12 to 42 inches DBH" *(tree caliper)* |
| EL-2.12 | C | run-2 | — |
| EL-2.13 | C | run-2 | — |
| EL-2.14 | B | run-1, run-3 | — |
| EL-2.15 | B | run-1, run-2 | "within the restricted clearance zone (< 15 feet from distribution conductors, < 10 feet from utility poles)" |

---

### Guide `3.md` — Underground Electric Clearances and Utility Separation

- **Successful calls:** 0 (all 4 timed out)
- All deficiencies below are **Tier C** — no tool data was actually obtained.

| Deficiency ID | Tier | Runs observed | Excerpt |
|---|---|---|---|
| EL-3.1 | C | run-1, run-2, run-3 | "within 5 feet of building foundations at all meter connection locations" |
| EL-3.2 | C | run-3 | — |
| EL-3.6 | C | run-1, run-2 | — |
| EL-3.7 | C | run-1, run-2, run-3 | "maintains 5 feet clearance from all sides of the pull box structure" |
| EL-3.8 | C | run-1, run-2, run-3 | — |
| EL-3.9 | C | run-1, run-2, run-3 | "within only a few feet of each other laterally based on visual scaling at 1 inch = 20 feet" |
| EL-3.10 | C | run-1 | — |
| EL-3.11 | C | run-1, run-2, run-3 | — |
| EL-3.17 | C | run-1, run-3 | "yellow Electric line runs parallel and extremely close to magenta Wastewater line for roughly 150-200 feet" |
| EL-3.19 | C | run-1 | — |
| EL-3.24 | C | run-1 | — |
| EL-3.31 | C | run-3 | — |
| EL-3.39 | C | run-2 | — |
| EL-3.42 | C | run-2 | — |

---

### Guide `4.md` — Transmission Lines and Construction Safety

- **Successful calls:** 0 (1 timeout)
- All deficiencies below are **Tier C**.

| Deficiency ID | Tier | Runs observed | Excerpt |
|---|---|---|---|
| EL-4.6 | C | run-2 | "Barricades must be erected 10 feet from electric transmission structures during construction" *(code citation)* |
| EL-4.18 | C | run-1, run-2, run-3 | "Do not dig or grade within 25 feet of the transmission structures" *(code citation)* |
| EL-4.19 | C | run-3 | "cut of approximately 2-3 feet at the NW corner property line" |
| EL-4.22 | C | run-3 | "cannot be visually confirmed if heads are placed within 25 feet of structures or easements" |
| EL-4.27 | C | run-3 | — |
| EL-4.30 | C | run-3 | "clearance purposes ('Do not dig or grade within 25 feet of the transmission structures')" |
| EL-4.44 | C | run-2 | "No trees shall be planted within 25 feet of the base of the transmission structure" *(code citation)* |

---

### Guide `7.md` — Electric Easement Legal Documentation

- **Successful calls:** 1 (run-1, sheet 31: mitigation trees SE → property line / easement)
- Small guide; only 2 deficiencies exist in the grouping output.

| Deficiency ID | Tier | Runs observed | Excerpt |
|---|---|---|---|
| EL-7.2  | B | run-2 | — |
| EL-7.6  | B | run-2 | — |
| EL-7.7  | B | run-2 | — |
| EL-7.10 | B | run-1, run-2 | — |
| EL-7.18 | B | run-1, run-2 | "location of any existing moonlight towers or associated guy wires on or within 100 feet of the property" |

---

### Guide `13.md` — Transformer Pad Clearances and Location Requirements

- **Successful calls:** 2 (run-1 sheet 21: pad → Bldg 2 wall; run-2 sheet 19: pad → driveway)
- **Tier A deficiency (explicit tool citation):** **EL-13.38**

| Deficiency ID | Tier | Runs observed | Excerpt |
|---|---|---|---|
| EL-13.1 | B | run-1, run-3 | "Pad 2 approx 15-20 ft from Bldg 2; Pad 3 approx 10-15 ft from Bldg 8; Pad 4 approx 5-10 ft from Bldg 4 and 5; Pad 5 approx 10-15 ft from Bldg 7" |
| EL-13.7 | B | run-1, run-2, run-3 | "minimum 2 feet from back of sidewalks" |
| EL-13.10 | B | run-1, run-3 | "Pad 4 is approximately 5-10 feet from Buildings 4 and 5 … Pad 5 is approximately 2-5 feet from a parking drive lane" |
| EL-13.11 | B | run-1 | — |
| EL-13.12 | B | run-1, run-2 | — |
| EL-13.13 | B | run-1, run-3 | — |
| EL-13.15 | B | run-1, run-3 | "no root barrier dimensions (minimum 4 feet deep, installed 5 feet from equipment) are documented" |
| EL-13.19 | B | run-3 | — |
| EL-13.21 | B | run-2, run-3 | — |
| EL-13.22 | B | run-3 | — |
| EL-13.23 | B | run-1, run-3 | — |
| EL-13.25 | B | run-1, run-3 | — |
| EL-13.26 | B | run-1 | — |
| EL-13.27 | B | run-3 | "'25 feet of transmission structures; 20-foot clearance for aerial equipment/staging'" |
| EL-13.28 | B | run-3 | "minimum 15-foot radius clearance from overhead distribution primary and neutral conductors, measured from the conductor centerline (not pole centerline)" |
| EL-13.31 | B | run-2 | "no cross-sections showing the vertical space available for hot-stick access (35 feet clearance for standard access)" |
| EL-13.34 | B | run-1, run-3 | — |
| EL-13.37 | B | run-1 | — |
| **EL-13.38** | **A** | run-1, run-2, run-3 | **"The measure-distance tool confirmed the pad NW of Bldg 1 is 0 feet from the driveway edge (touching the driveway)."** |

---

### Guide `14.md` — Transformer Access and Installation Requirements

- **Successful calls:** 0 (4 timeouts, 1 missing-args)
- All deficiencies below are **Tier C**.

| Deficiency ID | Tier | Runs observed | Excerpt |
|---|---|---|---|
| EL-14.1 | C | run-1, run-2 | "All four transformer pads appear to be within approximately 6 feet of drivable surfaces based on visual scale assessment (1\" = 20')" |
| EL-14.2 | C | run-1, run-3 | "one transformer pad adjacent to a 'Tree Well' with tree symbol immediately north (within 2-5 feet)" |
| EL-14.3 | C | run-1 | — |
| EL-14.7 | C | run-1 | "All four transformer pads are shown adjacent to paved driveways within approximately 6 feet based on visual scale (1\" = 20')" |
| EL-14.9 | C | run-2 | — |
| EL-14.12 | C | run-2, run-3 | "'Tree Well' with tree symbol immediately adjacent (within 2-5 feet) to the westernmost transformer pad" |
| EL-14.37 | C | run-2 | — |
| EL-14.38 | C | run-2, run-3 | — |
| EL-14.39 | C | run-3 | "vision analysis measured distances along electrical routing paths: 'Based on the 1\" = 20' scale, distances vary significantly'" |
| EL-14.40 | C | run-2, run-3 | — |
| EL-14.41 | C | run-2, run-3 | — |
| EL-14.54 | C | run-2 | "It is absolutely within 6 feet of this parking space" |
| EL-14.55 | C | run-2, run-3 | "Examined Sheet 9 (Site Plan) to measure distance from transformer pads to sidewalks and pedestrian paths" |
| EL-14.70 | C | run-2 | — |
| EL-14.72 | C | run-1 | "the standard 20 ft × 35 ft set-up area with 35-foot vertical clearance" *(code citation)* |

Notable: EL-14.39 and EL-14.55 use language (*"vision analysis measured distances"*, *"Examined Sheet 9 … to measure distance"*) that sounds tool-derived, but every call on guide 14 failed — these are unsubstantiated visual estimates, not tool outputs.

---

### Guide `16.md` — Vegetation Near Electric Facilities

- **Successful calls:** 1 (run-2, sheet 31: mitigation trees SE → OHE line)

| Deficiency ID | Tier | Runs observed | Excerpt |
|---|---|---|---|
| EL-16.1 | B | run-1, run-3 | "these proposed trees appear to be placed directly on top of, or within 5 feet of, this underground line" |
| EL-16.2 | B | run-1, run-2, run-3 | "to identify root barrier details for trees proposed within 5-20 feet of underground electric equipment" |
| EL-16.3 | B | run-1, run-2 | "minimum 4 feet deep, positioned exactly 5 feet from equipment edge" |
| EL-16.6 | B | run-1 | "four to five transformer pads with tree canopy symbols overlapping multiple pads (Northwest 0 ft, Central-West 0 ft, Southwest 0 ft)" |
| EL-16.7 | B | run-2 | — |
| EL-16.8 | B | run-1, run-2 | "Proposed 2 Live Oaks and 10 Cedar Elms appear to qualify as 'large trees' (mature height >= 40 feet)" |
| EL-16.9 | B | run-3 | "No trees shall be planted within 25 feet of the base of the transmission structure" *(code citation)* |
| EL-16.11 | B | run-1 | — |
| EL-16.14 | B | run-2 | "The proximity of tree canopy circles to the pole symbols suggests distances are measured in single-digit feet, not 10 feet" |
| EL-16.15 | B | run-1 | — |
| EL-16.16 | B | run-3 | — |
| EL-16.19 | B | run-3 | — |
| EL-16.22 | B | run-1, run-2 | — |
| EL-16.23 | B | run-2 | "Live Oak and Cedar Elm are large trees (≥40 feet mature height)" *(code citation)* |
| EL-16.24 | B | run-2 | "Assuming all small trees (<20 feet) are UC without verifying UC column" *(guide language)* |

---

## Bottom-line counts

- **Tier A (explicit tool citation):** **1 deficiency** — `EL-13.38`
- **Tier B (likely tool-informed):** 30 deficiencies across guides 2, 7, 13, 16 (items with ≥1 successful call)
- **Tier C (no tool data — all estimates):** 37 deficiencies across guides 3, 4, 14 (items where every call failed)

Across the three ensemble runs, only **one** deficiency finding in the entire el review (EL-13.38) was defensibly written from tool output. The tool-attribution machinery in `review-saver.ts` is not currently able to recover anything more than this single citation from the evidence on disk.
