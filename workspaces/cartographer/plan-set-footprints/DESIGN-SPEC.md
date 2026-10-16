# Building footprints from plan sets — the first proposed feature through extract-geometry-v2 and anchor-geometry

**Status:** Draft v1.1
**Date:** 2026-10-16

> **Revision note (v1.1, 2026-10-16).** D1 reworked on Will's direction: the document is classified by **looking at page 1** (an agent read of the cover sheet, with the sheet size as a recorded signal), not by a page-count rule. The car-wash plat is itself a 24 × 36 in sheet behind a letter-size recording cover, so neither page count nor sheet size can decide on their own. Classification moves from `1.2-fetch` (script) to a new single-agent step **`1.3-classify`**; D2, C2, §3.1, S4 and P2 updated to match. Nothing else changes.
**Repos touched:** `bureau` (`extract-geometry-v2` steps 1.2, 2.1, 2.2, two new steps 3.4 and 3.5, 4.2, 6.1 and their contracts; `anchor-geometry` steps 2.1, 3.2, 3.3, 5.1), `cartographer` (new `src/lib/geometry/sheet.ts` and `src/lib/features/registry.ts`; new `runbooks/extract-geometry/scripts/trace.ts`; `crop.ts`, `assemble.ts`, `place.ts`, `publish.ts`, `lib/evidence.ts`; `runbooks/anchor-geometry/scripts/{render,publish}.ts`; `/anchored`, `/anchor/[id]`, `/geometry/[id]` colour by posture), `substation` (one migration on `cartographer_geometries`, `cartographer_geometry_evidence` and `geo`; `sir_put_anchored_geo`)
**Repos NOT touched:** `cityhall`, `conductor2`, `surveyor`, `prospector`, `claude-plugins`, `navalbase`, `quarry`
**Prod:** Supabase **Noetic App** (`mgxqsrjutswbciyrltwd`)
**Parent:** [`../north-star/NORTH-STAR-SPEC.md`](../north-star/NORTH-STAR-SPEC.md) (winston#303) — this is the first slice of **P5 (plan sets)**, peeled off for one feature.
**Sibling:** [`../sir-free-anchoring/DESIGN-SPEC.md`](../sir-free-anchoring/DESIGN-SPEC.md) (winston#309, shipped) — the decoupled anchor run this spec hangs the footprint on. Its §6 names eight seams a plan-set reader must not foreclose; §8 below says which this spec opens and which it leaves shut.
**Sizing:** IG report [`2026-10-13-geometry-opportunity-formal-review`](https://inspector-general-gamma.vercel.app/reports/view/2026-10-13-geometry-opportunity-formal-review) — building footprint is the second-most-demanded layer (51 of 134 geometric comments, **30 A-tier**, the most of any layer) and one half of the north star's headline question.

---

## 1. Problem

### 1.1 What this is for

One sentence: **run `extract-geometry-v2` on a site plan set, get the proposed building footprint as a figure beside the lot, run `anchor-geometry`, and have PostGIS answer *how far is the building from each lot line* with a number a reviewer can cite.**

The north star says plan sets need a new reader and reuse identify, place and publish unchanged (§6, D12). This spec builds the smallest reader that proves that — one feature, one geometry type, one file — and names the registry a second feature plugs into, so trees, curbs and driveways are each one entry and one survey paragraph, not a new design.

### 1.2 The file, as it stands in prod (verified 2026-10-16)

`cartographer_files.cc2e3a53-db9b-493f-b270-e9039b03284c` — `White Water Express Car Wash 071326.pdf`, 30 pages, `status: processed`, `project_id: null`, `metadata: {figureCount: 1, lastGeometryRun: "whitewater-cc2e3a53-v2-run1"}`.

| row | state |
|---|---|
| `cartographer_geometries.5ab01b03` | `LOT 1`, `kind: parcel`, `frame-1` / `reference`, `source_pages {2,7,12,19}`, published 2026-10-08 |
| `cartographer_anchors.f290425a` | **accepted** 2026-10-14, `ring_fit` / `gis_fit`, target 2277, `sir_id null`, `anchor_run_slug whitewater-cc2e3a53-anchor-1`; metrics IoU **0.9997**, mean boundary distance **0.006 ft**, Hausdorff 0.031 ft, free scale 0.99999, rotation vs grid ≈ 0 on a grid basis |
| `geo.2ceb7683` | `LOT 1`, `method anchored`, 2277, `file_id` set, `sir_id null`, 43,563 ft² |
| `geo.183eced8` | `0436110202`, `method county_api`, 2277, `file_id` set, the TCAD ring, 43,558 ft² |

So the sibling spec's acceptance run happened and its decoupling is live: the lot is on the grid with no SIR, and the frame-1 transform exists. Everything this spec adds rides that transform.

One fact in the evidence table matters more than it looks. The lot's five courses were read as **`course`** evidence on page 2 (the plat) and as **`context`** evidence on pages **7, 12 and 19** — five `drawing_label` readings per page, each with a page box. The survey already visits every plan-view sheet, and the transcribers already read the property line printed on them. The handle for registering a sheet to the lot is already being recorded; nothing uses it yet.

### 1.3 What the plan set actually contains

Measured with PyMuPDF 1.26 against the local copy of the PDF (Autodesk Civil 3D 2021, `pdfplot16`, 2592 × 1728 pt = 36 × 24 in sheets).

**The CAD layers survived.** The document carries **803 optional content groups**. Sheet 12 (SITE PLAN) has 16,479 paths in 64 named layers; sheet 13 (PAVING PLAN) 11,052 paths in 40; sheet 7 (EXISTING CONDITIONS & DEMOLITION) 8,710 in 44. The names are the firm's Civil 3D layer standard, prefixed by xref (`JCE BASE|`, `JCE UTIL|`, `JCE BORDER|`):

| layer (sheet 12) | items | what it is |
|---|---|---|
| `JCE BASE\|C-BLDG` | 54 | **the proposed building outline** |
| `JCE BASE\|C-BLDG CANOPY` | 80 | the vacuum canopy |
| `JCE BASE\|C-BLDG TEXT` | — | its label |
| `JCE BASE\|C-BNDY LINE` | 95 | the property line, dashed |
| `JCE BASE\|C-SETBACK BLDG` | 109 | the building setback line, dashed |
| `JCE BASE\|C-CURB FOC` / `C-CURB BOC` | 278 / 65 | face and back of curb |
| `JCE BASE\|V-TREE` | 132 | tree symbols |
| `JCE UTIL\|C-WATER LINE` / `C-WW LINE` | 95 / 271 | proposed mains and services |
| `JCE BASE\|C-DUMPSTER PAD`, `C-SIDEWALK`, `C-POND CONC`, `C-ADA PATH`, `C-FIRELANE`, `C-DRAINAGE OUTLINE` | | the rest of the IG demand table, by name |

This is **not** what the IG report found on 2008 San Antonio, and the difference is the design problem. That set (Civil 3D 2025, `pdfplot17`, 53 pages, same sheet size) has **0 OCGs**, sheet 10 has 14,530 paths / 152,532 segments in **one unnamed layer**, **0 closed paths**, and about 30 stroke styles carrying what the layers used to. Two exports from the same product two versions apart, one with identity for free and one without. The reader has to work both ways: **layer-first when layers exist, style-and-vision when they do not.**

**On sheet 12, the building is one closed path.** `C-BLDG`'s 54 segments chain into a single closed ring of 55 vertices, 37,014 pt², with the pilaster rhythm visible in its edge lengths (43.2, 4.8, 9.6, 4.8, 67.2, … pt = 12.0, 1.33, 2.67, 1.33, 18.67 ft). The property line is **not** one path: it is a dashed linetype exploded into 95 short segments that an end-to-end chain cannot join (90 chains of ≤ 3 points), the same failure the IG spike worked around by rebuilding the LOC from 2,367 dashes.

**The text layer is thin.** 142 words on sheet 12. `CAR WASH=2,856 s.f.` and `FFE = 651.0` are real text; the bearings, the dimension strings and the scale are vector glyphs (`C-DIM TEXT` 1,933 items, `V-BNDY-LINE-TEXT` 900). `Scale (Hor.):` in the title block is followed by nothing in the text layer. The printed scale is readable by vision, not by `pdftotext`.

### 1.4 Spike: the footprint, placed against the lot, deterministically

A 20-minute probe on sheet 12, no model in the loop:

1. The lot polygon was walked from the plat's five courses (closure 0.0024 ft, 43,560.1 ft²).
2. The 95 `C-BNDY LINE` dash midpoints were fitted to that polygon's outline by iterated Procrustes (scale, rotation, translation; y flipped for page space).
3. `C-BLDG` was chained and pushed through the solved transform.

| | fixed scale 1″ = 20′ | scale free |
|---|---|---|
| ft per pt | 0.27778 | 0.27777 (**19.999 ft/in**) |
| rotation, sheet → plat north | −15.456° | −15.456° |
| mean residual, dash midpoints to lot outline | **0.004 ft** | 0.004 ft |
| max residual | 0.017 ft | 0.013 ft |

The sheet is drawn rotated 15.5° off north (the frontage is horizontal), and the scale falls out of the fit to four decimals without anyone reading the title block.

| building footprint | |
|---|---|
| vertices / validity / inside the lot | 55 / valid / **yes** |
| area | **2,856.0 ft²** — the sheet prints `CAR WASH=2,856 s.f.` |
| oriented size | 34.03 × 93.67 ft |
| to course 1 (`N15°27'20"E 195.00`) | 53.76 ft |
| to course 2 (`S74°32'40"E 217.63`) | **9.97 ft** |
| to course 3 (`S12°50'40"W 95.83`) | 71.59 ft |
| to course 4 (`S09°53'38"W 99.74`) | 92.32 ft |
| to course 5 (`N74°32'40"W 231.66`) | 151.00 ft |

And the `C-SETBACK BLDG` dashes, pushed through the same transform, sit at a median **29.7 ft** off course 1, **29.5 ft** off course 2, **9.99 ft** off course 3, 11.4 ft off course 4 and **10.00 ft** off course 5. The building is 9.97 ft from course 2 and the dashed setback line on that side is 29.5 ft from it. That is either a setback finding or the dashes near course 2 belong to a different line (a compatibility or ROW-based setback, say) — **this spike is not a review and does not decide**. It is exactly the kind of number the IG report says a reviewer wants to be handed deterministically, and exactly the kind the agent currently scales off an image.

Every number above is reproducible from the PDF and the plat courses. None of it needed the printed scale, the north arrow, a crop, or a model.

### 1.5 Why it cannot run today

| | Where | What stops it |
|---|---|---|
| **C1** | `bureau/runbooks/extract-geometry-v2/steps/2.1-survey/steps/page/prompt.md`, the kinds table; `scripts/plan.py` `GEOMETRY_KINDS` | The survey's vocabulary is a plat's: `metes_and_bounds`, `line_table`, `curve_table`, `coordinate_table`, `drawing_labels`, `plat_notes`, `none`. A building outline is `none`. `plan.py` drops any other kind from the roster. |
| **C2** | `steps/1.2-fetch/scripts/fetch.py`, `source.json`; `steps/2.1-survey/steps/page/prompt.md` | Nothing says what kind of document this is. The run treats a 30-sheet plan set as a 30-page plat and the readout cannot say otherwise. The survey does look at every page, but each worker sees one page and cannot tell the others what the cover sheet said. |
| **C3** | `cartographer/runbooks/extract-geometry/scripts/lib/evidence.ts:258` `courses: z.array(courseSchema).min(2)`; `steps/4.1-merge/contract.test.ts` `courses: z.array(Course).min(2)`; `assemble.ts` walks every figure as a traverse | A figure **is** a list of courses. A traced polygon has no courses, no POB and no misclosure. |
| **C4** | `substation/supabase/migrations/20260918170000_cartographer_geometries.sql` `mete jsonb NOT NULL`; `20260921000000` `placement_method CHECK (reference \| shared_line \| tie \| coordinates \| unplaced)`; `cartographer/src/lib/geometry/placement.ts:37` | The stored figure is mete-only, and placement has no method for "registered to the lot drawn on the same sheet". |
| **C5** | `20260925132000_cartographer_extraction_anchor_metadata.sql`, the `role` and `source_kind` CHECK lists; `steps/3.1-transcribe/.../contract.test.ts` "every reading cites a crop" | Evidence roles are course / tie / pob / … / scale_factor; source kinds are regions, table rows, labels, notes. A vector trace is none of them, and it has a page box but no crop until one is drawn. |
| **C6** | north star §9.3, sir-free §6.7; `geo` has no posture column; `sir_put_anchored_geo` (`geo_helpers.sql:350-379`) writes `kind`, `label`, `method` | Nothing distinguishes *recorded* (a lot) from *proposed* (a building). §1.3 of the north star measures between the two; conflating them "would be a quiet correctness bug". |
| **C7** | `cartographer/src/lib/geometry/anchor.ts` fixes scale at 1 or the stated factor; `DistanceUnits = ft \| ftUS \| varas \| m` | Page points are not a unit the anchor knows, and the sheet-to-frame transform has a scale to solve. (sir-free §6.2, §6.3.) |

What is **not** a coupling, and this spec leans on: `frames.ts` `ringInFrame` and `toInputFigure` read `polygon + offset` and nothing else about how the polygon came to be; `anchor.ts:181-182` returns *every* figure of the frame in grid coordinates, `within` and unmatched ones included; `sir_put_anchored_geo` takes any (Multi)Polygon with a free-text `kind`; the `2.1-correspond` contract already has a `within` relation that "anchors nothing by itself". A traced polygon in frame-1 anchors with **zero changes to the solver, the fetch, or the correspond contract**.

### 1.6 Scope

In: one feature (the proposed building footprint), one geometry type (polygon), vector plan sheets, one figure per document, the registry shape that the next features plug into, and the posture axis on `geo`. Out (§9): every other feature, lines and points, raster sheets, the PostGIS tool surface, multi-sheet identity.

---

## 2. Decisions

### 2.1 Classifying the document

**D1. The document is classified by looking at page 1, in a new single-agent step `1.3-classify`, with the sheet size as a recorded signal and no page-count rule.** A plan set announces itself on its cover sheet: a project title (*SITE PLAN FOR …*), a sheet index, an engineer's title block, a vicinity map. A recorded plat announces itself too: a county clerk's cover or recording stamp, a plat title, a surveyor's certificate, a legal description. Neither page count nor sheet size can decide on their own — the car-wash plat (`2024178771`) is a letter-size recording cover followed by one **24 × 36 in** sheet, and White Water is thirty 36 × 24 in sheets — but a reader looking at page 1 can, in one glance, and that is what this step does.

`1.2-fetch` keeps writing what it can measure (zero tokens) into `source.json`: per page the size in inches, whether it is vector, its word count; per document the creator, the OCG count, and whether page 1 is sheet-sized. `1.3-classify` (runner `vision`, medium effort, one session) reads page 1's raster — and, when page 1 is not sheet-sized (a letter cover, a transmittal), the first page that is — alongside those signals, and writes `document.json`:

```jsonc
{
  "kind": "plan_set",                      // plat | plan_set | unknown
  "decidedBy": "page1",                    // page1 | request
  "inspectedPages": [1],                   // page 1, plus the first sheet-sized page when page 1 is not one
  "sheetIn": [36, 24],                     // the dominant page size, inches
  "seen": ["SITE PLAN FOR WHITEWATER EXPRESS CAR WASH", "SHEET INDEX, 30 entries", "engineer's title block, TX PE firm F-17756", "vicinity map"],
  "signals": { "creator": "Autodesk Civil 3D 2021 …", "pageCount": 30, "ocgCount": 803, "vectorPages": 30, "page1SheetSized": true },
  "note": "a civil site plan set; the recorded plat is reproduced as sheet 2"
}
```

The reader reports what it saw, in the sheet's own words, and the kind it concludes; `unknown` is the honest answer for a scan with no cover sheet or a document that is neither (an easement exhibit, a title commitment), and it is a normal outcome, not a failure. `request.document_kind` (new on 1.1, optional, `plat | plan_set`) overrides it, recorded as `decidedBy: "request"`, and the step then writes `document.json` without reading anything. Typical sheet sizes are around 24 × 36 in for both plats and plan sets, so `sheetIn` is recorded as a signal for the readout and for a future rule, never as the deciding fact.

**D2. The classification switches a vocabulary on; it does not fork the runbook.** On `plat` every step runs exactly as today and the output is byte-identical (S4a). On `plan_set` or `unknown` the survey prompt gains §2.2's plan-sheet section, `plan.py` keeps the new region kinds on the roster, and steps 3.4 and 3.5 have something to do. One graph, one set of contracts, one readout. The vocabulary costs nothing on a page that has no such regions, which is why `unknown` turns it on rather than off. The survey's page workers read `1.3-classify/document.json` the way they read the addendum today: one fact every reader shares before any page is looked at.

### 2.2 The survey learns to see a sheet

**D3. On a plan set the survey reports the sheet and the features on it, with the same discipline as today: regions and kinds, never values.** Per page, `survey.json` gains:

```jsonc
"sheet": { "role": "plan_view", "title": "SITE PLAN", "printedScale": "1\"=20'", "northArrow": true },
      // role: cover | notes | plan_view | profile | detail | plat | other. printedScale is the title block's words or null.
"regions": [
  { "id": "p12-r1", "kind": "drawing_labels", "bbox": [...], "note": "property line calls, five courses" },   // as today
  { "id": "p12-r2", "kind": "feature", "feature": "building", "bbox": [0.31, 0.22, 0.58, 0.61],
    "note": "proposed car wash building, hatched, labelled CAR WASH=2,856 s.f." }
]
```

A `feature` region is a padded box around one drawn feature of a registered kind (D17); v1 registers `building`. The survey marks the box and the printed label it can see; it does not trace, count vertices, or read a dimension. The plan-sheet paragraph of the prompt says what a proposed building looks like on a civil sheet (heavy outline, usually hatched, labelled with a use and an area, distinct from a canopy, a dumpster enclosure and an existing building marked for demolition) and tells the reader to mark one region per building on every plan-view sheet that draws it — the site plan, the paving plan, the grading plan — because the roster for tracing (D6) and the consistency check (Q6) both start from the survey.

`plan.py` renders a crop for a `feature` region as it does for any other, so the confirm step has the same crop-tool evidence trail.

### 2.3 Code traces, an agent confirms

**D4. Tracing is a script, and it is cartographer's.** A new `runbooks/extract-geometry/scripts/trace.ts`, run through `carto trace <page> <regionBox> <feature>`, writes `traces/<regionId>.json`: the candidate outlines for one `feature` region, in page points, with everything the picker and the readout need to know about each:

```jsonc
{
  "regionId": "p12-r2", "page": 12, "feature": "building",
  "raster": false,                                   // true on a page with no vector content: no candidates, the region is `untraceable`
  "layers": ["JCE BASE|C-BLDG", "JCE BASE|C-BLDG CANOPY", "JCE BASE|C-BLDG TEXT", "JCE BASE|C-SETBACK BLDG", …],   // every OCG with paths inside the box, or []
  "candidates": [
    { "id": "p12-r2-t1", "layer": "JCE BASE|C-BLDG", "style": { "width": 0.72, "dashes": null, "fill": null },
      "closed": true, "vertices": 55, "areaPt2": 37014, "bboxPage": [0.33, 0.25, 0.55, 0.58],
      "pathPt": [[1021.4, 612.0], …], "rank": 1, "why": "layer name matches building; closed; largest in region" },
    { "id": "p12-r2-t2", "layer": "JCE BASE|C-BLDG CANOPY", "closed": false, "vertices": 3, "rank": null, "why": "open; layer excluded by pattern (CANOPY)" }
  ]
}
```

How it gets there, in order, and all of it deterministic:

1. **Collect** every path whose bbox lies inside the region box, with its layer (OCG name, or `null`) and its stroke style.
2. **Chain** segments into polylines by endpoint coincidence, then bridge collinear gaps up to a dash tolerance so an exploded linetype rejoins (the 2,367-dash LOC in the IG spike; the 95-dash property line here). Chaining is per (layer, style) group, never across groups.
3. **Keep** what the feature's geometry type wants: for a polygon feature, closed rings above a floor area (a building is not 20 ft²).
4. **Rank**, in this order: a layer whose name matches the feature's registry patterns (D17) and not its exclusions; then closed; then area, largest first. On a layer-less page every candidate is unranked-by-layer and the order is closed-then-area; the picker (D5) does the rest.
5. **Draw** one overlay crop per candidate through the crop tool (D13), so the picker looks at the same kind of image a transcriber does and the choice is citable.

No model, no threshold that moves a vertex. The `pathPt` is the PDF's own vector data, which the IG spike found accurate to the plat to 0.3 ft on another set and this probe found accurate to **0.004 ft** on this one.

**D5. Confirming is vision, reads no coordinates, and is one worker per region.** New step `3.5-confirm` (runner `vision`, fan-out over the trace roster) looks at the region crop and the candidate overlays and writes `confirm.json`:

```jsonc
{ "regionId": "p12-r2", "feature": "building",
  "chosen": "p12-r2-t1",                              // a candidate id, or null with `why`
  "label": { "verbatim": "CAR WASH=2,856 s.f.", "cropId": "p12-r2-lbl", "location": [...] },
  "statedArea": { "verbatim": "2,856 s.f.", "value": 2856, "cropId": "p12-r2-lbl", "location": [...] },
  "attributes": { "ffe": { "verbatim": "FFE = 651.0", "value": 651.0, "cropId": "…", "location": [...] } },   // read, carried, not used
  "printedScale": { "verbatim": "1\"=20'", "ftPerIn": 20, "cropId": "…", "location": [...] },                 // a check for D8, never the source
  "why": "the red outline follows the hatched building; the canopy and dumpster pad are separate outlines" }
```

The contract refuses a `chosen` that is not a candidate, a reading with no crop sidecar, and any key that looks like a coordinate or an area the worker computed. The worker's job is the one thing code cannot do on a layer-less sheet: say which of the closed rings in the box is the building. On a layered sheet it is a check on the ranker; on a raster sheet (`raster: true`) it reports `chosen: null, why: "no vector content"` and the region is published nowhere (Q7).

**D6. One figure per feature per document, from the primary sheet.** The trace step runs on every `feature: building` region the survey marked (zero tokens, so cheap). The confirm step runs on the regions of the **primary sheet** only — the `plan_view` sheet whose title is the site plan, else the first `plan_view` sheet with a building region — and that is the reading that becomes the figure. The other sheets' traces are counted in the readout ("a building outline is drawn on sheets 12, 13, 14; sheet 12 was read") and compared to nothing in v1. Cross-sheet consistency (the IG's `ST_HausdorffDistance` tool, #9) is **Q6** and the obvious second slice: the traces are already on disk.

### 2.4 The lot registers the sheet

**D7. A sheet is placed into the frame by registering it to the lot that is drawn on it — the same lot the run already extracted.** New pure module `cartographer/src/lib/geometry/sheet.ts`:

```ts
registerSheet({ lotRing: Point[] /* lot-local feet, POB at 0,0 */,
                boundary: Segment[] /* page pt, the sheet's property-line segments */,
                initial?: { labelBoxes: Box[] /* the sheet's drawing_labels evidence, page space */ } })
  → { ftPerPt, thetaRad, tPt: Point, residualMeanFt, residualMaxFt, scaleFtPerIn, standardScale: 20 | null, used: number }
```

One 2D similarity, **scale free** (the one place in Cartographer where it is), rotation free, solved by iterated closest-point onto the lot's outline from an initial guess — the lot's centroid against the boundary segments' centroid, rotation 0 — and, when `labelBoxes` are given, refined from the five label centroids first so a sheet rotated 90° does not start in a local minimum. The gate: `residualMeanFt ≤ 0.1` and `residualMaxFt ≤ 0.5` and `scaleFtPerIn` within 0.5 % of an engineering scale (10, 20, 30, 40, 50, 60, 80, 100). A registration that fails the gate is reported and the traced figure is published **`unplaced`** with the attempt in its `trace.sheet` — never silently placed.

Where the boundary segments come from is the tracer's job (D4) with a second feature kind the registry already needs: `boundary` (geometry `polyline`, patterns `BNDY | BOUNDARY | PROP | P/L | PL`, no exclusions). On a layered sheet that is `C-BNDY LINE`. On a layer-less sheet the tracer takes every segment within a band of the lot's edges under the label-initialised transform, which is what the labels are for: the transcribers already put a box around each course call on the sheet (§1.2), and a call sits on its line.

**Which lot.** The figure whose courses were read on that page — as `course` or as `context` evidence — is the sheet's lot. White Water has one. A sheet that shows two lots, or a plan set whose lot is not in the file at all, is **Q4**; v1 stops with the reason.

**D8. The printed scale and the north arrow are checks, not sources.** The confirm step reads the title block's scale when it can (D5); `assemble.ts` compares it with the solved `scaleFtPerIn` and reports agreement, disagreement or `unavailable`, exactly as the sibling spec treats the plat's zone against the ring's SRID (its D7). The sheet's rotation is reported in degrees from plat north; nothing checks it against a drawn arrow in v1.

### 2.5 The figure model

**D9. A figure has a reading method, and the stored row says which.** `cartographer_geometries` gains:

| column | type | meaning |
|---|---|---|
| `reading_method` | `text NOT NULL DEFAULT 'mete'`, CHECK `mete \| traced` | how the shape was read |
| `mete` | becomes **nullable** | null on a traced figure |
| `trace` | `jsonb`, nullable | `{page, layer, style, pathPt, sheet: {ftPerPt, thetaRad, tPt, residualMeanFt, residualMaxFt, scaleFtPerIn, printedScale?, check}, attributes?}` — the source description of a traced figure, as `mete` is of a walked one |
| `posture` | `text NOT NULL DEFAULT 'recorded'`, CHECK `recorded \| proposed \| existing` | D10 |

with a completeness CHECK in the style of `cartographer_geometries_placement_complete_check`: `reading_method = 'mete'` ⇔ `mete IS NOT NULL AND trace IS NULL`, and the converse for `traced`. Every existing row is `mete` / `recorded` by default and nothing behaves differently.

The derived columns keep their meaning: `polygon` is the ring in **frame feet with vertex 0 at (0, 0)** — the lot-local ring, translated so its first vertex is the origin — so "drawn position = polygon + offset" (winston#270 D1) holds unchanged; `closed` is `true`; `misclosure_feet` is **null** (not 0: a traced ring has no closure to measure); `computed_area_sqft` is the ring's area; `stated_area_sqft` is the confirmed label's; `has_approximated_curves` is false in v1 (arcs are chorded by the PDF already).

`placement_method` gains **`sheet_registration`** (DB CHECK and `placement.ts` `PlacementMethod`): the figure's offset is the sheet's lot's offset plus the registered position of vertex 0 in the lot's local frame, and `placement_evidence` carries `{lot: <figure id>, page, residualMeanFt, residualMaxFt, scaleFtPerIn}`.

**D10. Posture is a column on both tables, and it survives into `geo`.** `cartographer_geometries.posture` as above; `geo.posture text` nullable with the same CHECK, written by `sir_put_anchored_geo` from the figure payload (`p_figures[].posture`, defaulting to `recorded` when absent, so today's anchor publish keeps working). County rings keep `null`; the viewer and the tool surface read `null` as recorded. This is north star §9.3 and sir-free §6.7 made concrete: a consumer can write `WHERE posture = 'proposed'` and the headline measurement is *between* a `recorded` row and a `proposed` row. Why a column and not a property: the question it answers is the first filter every review query puts in its `WHERE`, and a jsonb path there is a smell on the table that is meant to become the derived spatial layer (**Q3** asks the audit to confirm).

**D11. A traced figure enters the artifact through code, not the merge agent.** `rawArtifactSchema`'s `figureSchema` becomes a discriminated union on `readingMethod`: the mete figure exactly as today, and

```jsonc
{ "id": "figure-2", "readingMethod": "traced", "label": "CAR WASH", "kind": "building", "posture": "proposed",
  "sourcePages": [12], "statedAreaSqft": 2856, "statedArea": { …reading… },
  "trace": { "page": 12, "regionId": "p12-r2", "candidate": "p12-r2-t1", "layer": "JCE BASE|C-BLDG",
             "style": {…}, "pathPt": [[…]], "cropId": "p12-r2-t1-overlay", "bboxPage": […],
             "lot": "figure-1", "boundary": { "candidate": "p12-r1-b1", "segments": 95 },
             "attributes": { "ffe": {…} }, "printedScale": {…} },
  "notes": null }
```

`4.1-merge` and its agent are **untouched**: the agent still writes every mete figure, and its contract's "one figure per inventoried figure" still holds for them. `assemble.py assemble` (the 4.2 script) appends the traced figures from `3.5-confirm/*/confirm.json` and `3.4-trace/traces/*.json` before calling `assemble.ts`. The rule from `AGENTS.md` holds in both directions: no agent produced a coordinate (the PDF did), and no script decided which outline is the building (the worker did).

`assemble.ts` then, per traced figure: registers the sheet (D7) against the named lot's **derived polygon** (the mete figure is assembled in the same pass, so it is there), pushes `pathPt` through the transform into lot-local feet, writes `derived[figure].polygon` with vertex 0 at the origin and `derived[figure].sheet` with the registration result and the D8 check, and prints one summary line (`figure-2  CAR WASH  traced p12  55 vtx  2856 sq ft (stated 2856)  sheet 1"=20.000' θ=-15.456° resid 0.004/0.017 ft  PLACED`). `place.ts solve` reads `derived[].sheet` and adds a `sheet_registration` edge from the lot to the figure, so the frame and offset come out of the same solver as every other figure's (winston#270's edges, one more kind).

**D12. Publish writes the new columns and nothing else changes about replacement.** `publish.ts` inserts `reading_method`, `trace`, `posture`, `mete: null` for traced rows; the evidence rows of D13; and stamps `metadata.figureCount` as today. Publishing still replaces every figure of the file (winston#266 D5), which means **the accepted anchor `f290425a` goes `stale` on the first publish of this spec's run** (anchoring spec D14, `cartographer_mark_anchors_stale`). That is by design and §6 re-anchors; **Q9** asks whether it should stay that way once plan sets make re-extraction routine.

### 2.6 Evidence

**D13. A traced value is cited like any other: a page box and an image the crop tool made.** Two additions:

- `crop.ts` gains a mode, **`outline`**: `carto crop outline <parentCropId> <cropId> <traceId>` renders the parent crop with one candidate's path drawn on it (the path comes from `traces/*.json`, mapped into the crop through the sidecar's page box) and records it as a transform with `op: "outline"` and `args: [traceId]`. It keeps the crop's footprint, which is the rule `TRANSFORM_OPS` (`crop.ts:75`) enforces for every transform; it is the first that adds ink, and it says so in the sidecar.
- Evidence gets a role **`trace`** and a source kind **`vector_path`**: one row per traced figure, `bbox` = the ring's box on the page, `crop_id` = the overlay crop, `verbatim` = the layer name or the style summary, `value` = `{vertices, areaPt2, candidate}`. The label and the stated area reuse `stated_area` / `area_statement` and a `label` role (new, `source_kind: marker`), each citing the crop the confirm worker read them on. `/geometry/[id]` draws the trace row's box over the sheet with no new UI: it is a box with a crop, like a course.

### 2.7 Anchoring a proposed figure

**D14. The anchor run needs no new inputs and no solver change.** `fetch.ts` → `geometries.json` already carries every figure of the frame as `polygon + offset` (`frames.ts` `ringInFrame`, `toInputFigure`); it gains `posture` and `reading_method` as pass-through fields on `InputFigure`. `2.1-correspond`'s prompt tells the agent that a `posture: proposed` figure is claimed **`within`** its parcel ring (the relation exists, contract unchanged) and is never a fit target; `frames.ts` already excludes `within` from `ringTargets`' fit set. `anchorFrame` transforms it with the frame (`anchor.ts:181`). `3.2-render` draws proposed figures in a second colour and a dashed stroke; `3.3-check` asks one more question — *does the building sit inside its lot where the sheet shows it, and does the overlay's offset from the lot lines look like the sheet's dimension strings?* — and quotes nothing it computed.

**D15. `5.1-publish` passes posture through, and `geo` gets its first proposed row.** `publish.ts` adds `posture` to each `p_figures[]` entry; `sir_put_anchored_geo` writes `geo.posture` (D10) and `geo.kind = 'building'`. The lot and the building land as sibling `anchored` rows under one `anchor_id`, which is what makes §6's query a one-liner. `/anchored` and `/anchor/[id]` colour by posture.

**D16. The payoff is a query, and it is the acceptance test.** With the three rows of §6 in `geo`:

```sql
select l.label as lot, b.label as building, b.posture,
       round(st_area(b.geom_local)::numeric, 1)                       as building_sqft,
       st_within(b.geom_local, l.geom_local)                          as inside_lot,
       round(st_distance(b.geom_local, st_exteriorring(l.geom_local))::numeric, 2) as nearest_lot_line_ft
from geo b join geo l on l.properties->>'anchor_id' = b.properties->>'anchor_id'
where b.posture = 'proposed' and l.kind = 'parcel' and l.method = 'anchored';
```

and per lot line, `st_distance(b.geom_local, st_makeline(v1, v2))` over `st_dumppoints(st_exteriorring(l.geom_local))`. The expected numbers are §1.4's. This is the north star's §1.3 with the plan-set half supplied.

### 2.8 The registry: how the next feature arrives

**D17. Features are entries in one registry, and the pipeline reads the registry, not the feature.** New `cartographer/src/lib/features/registry.ts`, consumed by the survey prompt (which paragraph to include), `plan.py` (which region kinds to keep), `trace.ts` (patterns, exclusions, geometry type, floor area), `assemble.ts` (posture, kind) and the readout:

```ts
export const FEATURES = {
  building: {
    geometry: 'polygon', posture: 'proposed', kind: 'building',
    layerPatterns: [/\bBLDG\b/, /\bBUILDING\b/, /\bA-(BLDG|FOOT)/], layerExclude: [/CANOPY/, /TEXT/, /SETBACK/, /EXIST/, /DEMO/],
    labelPatterns: [/\bs\.?\s?f\.?\b/i, /\bBUILDING\b|\bBLDG\b/i],
    minAreaFt2: 100, tracer: 'closed_ring',
    survey: 'a proposed building: heavy closed outline, usually hatched, labelled with its use and area; not a canopy, a dumpster enclosure, or an existing building marked to be removed',
  },
  boundary: { geometry: 'polyline', posture: 'recorded', kind: 'boundary', layerPatterns: [/\bBNDY\b/, /BOUNDARY/, /\bPROP/, /\bP\/?L\b/], layerExclude: [/TEXT/, /ADJ/, /CRNR/], tracer: 'segments', survey: null /* never surveyed: found from the lot */ },
} as const;
```

**D18. What the next three cost, stated now so the seams are visible.** Each is one registry entry plus one survey paragraph, **plus** the seam it opens:

| feature | geometry | posture | registry entry | the seam it opens (sir-free §6) |
|---|---|---|---|---|
| **trees** (`V-TREE`, the tree survey table) | point + attributes (tag, species, DBH) | existing | `tracer: 'symbol'` — a symbol's centre and the table row its tag keys to; CRZ = `ST_Buffer` at review time, never stored | §6.4 polygon-only: `polygon jsonb` → a `geometry jsonb` (GeoJSON, any type) expand → migrate → contract, and `sir_put_anchored_geo`'s `(Multi)Polygon` gate widens |
| **curbs** (`C-CURB FOC` / `BOC`) | polyline | proposed | `tracer: 'segments'` with dash bridging (already built for `boundary`) | same §6.4, plus `closed` / area columns become nullable-by-type |
| **driveways** | polygon, *derived* from curb returns and the ROW line | proposed | not a tracer at all: north star D14's fourth path, computed from two placed features | §6.1 frame identity — a driveway crosses the lot line, so the ROW (county side) and the curb (sheet side) must share a frame, which is the anchor, not the sheet |

None of these change D1–D16. Trees and curbs change the geometry column; driveways need the county join. The order the IG report suggests (building → trees → curbs/driveways) is also the order of increasing schema work, which is the argument for this slice being the building.

---

## 3. The change, piece by piece

### 3.1 The extract runbook

```diff
 extract-geometry-v2
   1.1-inputs                 request.json              + document_kind? (D1)
   1.2-fetch                  source.json               + per-page size in inches, word count; creator, ocgCount, page1SheetSized (D1 signals)
+  1.3-classify               document.json             one agent looks at page 1 (and the first sheet-sized page): plat | plan_set | unknown (D1)
   2.1-survey/page            survey.json               reads document.json; + sheet {role,title,printedScale,northArrow}; + region kind `feature` (D3)
   2.2-plan                   regions.json              keeps `feature` regions on the roster, renders their crops (D3)
   3.1-transcribe/region      transcript.json           unchanged
   3.2-inventory              figures.json, calls.json  unchanged
   3.3-order/figure           order.json                unchanged
+  3.4-trace                  traces/<region>.json      script, zero tokens: carto trace per `feature` region + the sheet's `boundary` (D4, D7); overlay crops (D13)
+  3.5-confirm/region         confirm.json              vision fan-out over the PRIMARY sheet's feature regions: pick, label, stated area, printed scale (D5, D6)
   4.1-merge                  raw-artifact.json         unchanged (mete figures only)
   4.2-assemble               ws/artifact.json          assemble.py appends traced figures (D11); assemble.ts registers the sheet (D7, D8) and derives them
   5.1-place-claims           claims.json               unchanged
   5.2-place-solve            placement.json            place.ts adds the `sheet_registration` edge (D9)
   6.1-readout                readout.md                + document kind; + a traced-figures section: sheet, scale check, residuals, area vs stated, other sheets not read
   6.2-hitl                   decision.json             unchanged
   7.1-publish                                          publish.ts writes reading_method / trace / posture / evidence (D12, D13)
```

The roster for 3.4 is every `feature` region in every `survey.json` plus one `boundary` item per page that has one; for 3.5 it is the primary sheet's `feature` regions (D6). Both come from `roster.py` reading `2.1-survey`, like `pages` and `figures` do today. On a `plat` document both rosters are empty and the steps complete with nothing to do, which is how S4a stays byte-identical.

### 3.2 Cartographer

```diff
 cartographer/
 ├── src/lib/geometry/
 │   ├── anchor.ts                       unchanged
 │   ├── placement.ts                    + 'sheet_registration' in PlacementMethod; + sheetEdge() (D9)
+│   └── sheet.ts                        registerSheet(): free-scale similarity, ICP onto the lot outline, the gate (D7)
+├── src/lib/features/registry.ts        FEATURES (D17)
 ├── runbooks/extract-geometry/scripts/
 │   ├── crop.ts                         + `outline` mode (D13)
+│   ├── trace.ts                        collect → chain → keep → rank → overlay (D4)
 │   ├── assemble.ts                     traced figures: register, derive, check the printed scale (D8, D11)
 │   ├── place.ts                        the sheet_registration edge (D9)
 │   ├── publish.ts                      reading_method, trace, posture, the trace/label evidence rows (D12, D13)
 │   └── lib/evidence.ts                 figureSchema → union on readingMethod; + role 'trace', 'label'; + source_kind 'vector_path' (D11, D13)
 ├── runbooks/anchor-geometry/scripts/
 │   ├── lib/contracts.ts                InputFigure + posture, reading_method (D14)
 │   ├── render.ts                       proposed figures dashed, second colour (D14)
 │   └── publish.ts                      p_figures[].posture (D15)
 └── src/routes/
     ├── anchored/, anchor/[id]/         colour by posture (D15)
     └── geometry/[id]/                  a traced figure shows its trace row's box + overlay crop; no courses table (D13)
```

### 3.3 Substation

```diff
 cartographer_geometries
+  reading_method   text NOT NULL DEFAULT 'mete'  CHECK (mete | traced)
   mete             jsonb NOT NULL  →  jsonb NULL
+  trace            jsonb
+  posture          text NOT NULL DEFAULT 'recorded'  CHECK (recorded | proposed | existing)
+  CHECK reading_method ⇔ (mete XOR trace)
   placement_method CHECK (… | unplaced)  →  (… | unplaced | sheet_registration)
 cartographer_geometry_evidence
   role        CHECK (…)  →  + trace, label
   source_kind CHECK (…)  →  + vector_path
 geo
+  posture          text  CHECK (recorded | proposed | existing)
 sir_put_anchored_geo(p_anchor_id, p_figures)
+  writes posture from p_figures[].posture, default 'recorded'
```

### 3.4 The anchor runbook

```diff
 anchor-geometry
   1.1-inputs, 1.2-fetch        unchanged (fetch.ts passes posture / reading_method through on InputFigure)
   2.1-correspond               prompt: a proposed figure is `within` its parcel; contract unchanged (D14)
   3.1-solve                    unchanged
   3.2-render                   proposed figures dashed, second colour
   3.3-check                    + the proposed-figure question
   4.1-hitl                     unchanged
   5.1-publish                  posture in the payload (D15)
```

---

## 4. Testing seams

**S1: `trace.ts`'s CLI** (new)
- **Proves:** D4 and D17 — collect, chain with dash bridging, keep, rank. Fixtures: White Water sheet 12, the `building` region → exactly one ranked candidate, `JCE BASE|C-BLDG`, closed, 55 vertices, 37,014 pt² (±1); the `boundary` item → 95 segments on `C-BNDY LINE`; sheet 13 → the same ring; 2008 San Antonio sheet 10 (0 OCGs) → `layers: []`, candidates present, none layer-ranked, no throw; a raster page → `raster: true`, no candidates. Fixture PDFs are the two sets already on disk; the test checks against the recorded numbers, not against a model.
- **Prior art:** `cartographer/runbooks/extract-geometry/scripts/lib/evidence.test.ts`, `lib/page.test.ts`.
- **Runs:** `bun test` in `cartographer`, CI.

**S2: `registerSheet()`** (new, pure)
- **Proves:** D7 and D8 — the White Water lot ring + the 95 dashes → `scaleFtPerIn` 20.00 ± 0.1, θ −15.46° ± 0.05°, mean residual ≤ 0.01 ft, `standardScale: 20`; the same input rotated 90° in page space → the same answer; a synthetic 1″ = 30′ sheet → 30; the wrong lot (the 2008 San Antonio polygon) → the gate fails and says so; a printed scale of 20 agrees, of 30 disagrees.
- **Prior art:** `src/lib/geometry/anchor.test.ts`, `placement.test.ts`.
- **Runs:** `bun test`, CI.

**S3: the extract scripts on a run directory with a traced figure** (existing seam, extended)
- **Proves:** D9, D11, D12, D13 — a `raw-artifact.json` with one mete and one traced figure through `assemble.ts` → `derived[figure-2].polygon` with vertex 0 at (0, 0), area 2,856 ± 1, `derived[figure-2].sheet` with the registration; `place.ts solve` → `figure-2` in `frame-1`, method `sheet_registration`, offset = the lot's offset + the registered vertex; `publish.ts --dry-run` (new flag, mirroring the anchor publisher's) → the rows it would insert: `reading_method: traced`, `mete: null`, `posture: proposed`, one `trace` evidence row citing an `outline` crop. The schema union refuses a traced figure with courses and a mete figure with a trace.
- **Prior art:** `cartographer/runbooks/anchor-geometry/scripts/anchor-e2e.test.ts` (a run directory as the fixture), `src/lib/geometry/__fixtures__`.
- **Runs:** `bun test`, CI.

**S4: the `extract-geometry-v2` runbook, inputs → outputs** (existing)
- **Proves:** D1–D6 end to end, in two runs. **(a) Regression:** the car-wash plat `2024178771` with the request as today → `1.3-classify` reads the clerk's cover and the 24 × 36 plat behind it and says `plat` (`inspectedPages: [1, 2]`), empty 3.4 and 3.5 rosters, and a `raw-artifact.json` / `artifact.json` identical to run5's (`~/noetic/working/extract-geometry-v2/car-wash-2024178771-run5`). **(b) White Water:** `document.kind: plan_set` from the cover sheet (`decidedBy: page1`, `sheetIn: [36, 24]`); the survey marks `feature: building` on sheets 12, 13 and 14 and `sheet.role: plan_view` with `title: SITE PLAN` on 12; 3.5 runs on sheet 12 only; the readout carries the traced-figures section and names the sheets not read; 7.1 publishes **two** figures. A third request with `document_kind: plat` on White Water → `decidedBy: request`, nothing read, one figure.
- **Prior art:** the step contracts themselves; the sibling spec's S1.
- **Runs:** locally with `conductor`, against the two files; (b) is §6 step 1.

**S5: the RPC and the migration, against a local Supabase** (existing suite)
- **Proves:** D9, D10 — the completeness CHECK (a `traced` row with `mete` set is refused, a `mete` row with `trace` set is refused); `sir_put_anchored_geo` writes `posture` from the payload and `recorded` when absent, so a payload shaped like today's publishes unchanged; the three CHECK-list extensions accept the new values and still refuse others.
- **Prior art:** `substation/src/lib/cartographer-anchors.integration.test.ts`, `geo-parcel-native-srid.integration.test.ts`.
- **Runs:** substation's integration suite against a local Supabase.

**S6: the `anchor-geometry` runbook, inputs → outputs** (existing)
- **Proves:** D14–D16 — a request `{file, anchor_run_slug}` on the re-extracted White Water → `correspondences.json` with `LOT 1` `same_as` the county ring and `CAR WASH` `within` it; `anchors.json` with both figures under frame-1; the overlay with the building dashed; three `geo` rows under one `anchor_id`; the D16 query returning §1.4's numbers within 0.05 ft.
- **Prior art:** `anchor-e2e.test.ts`; the sibling spec's S1.
- **Runs:** locally; §6 steps 2–3.

---

## 5. PR plan

**P0: the schema and the RPC** — `substation`
- **Blocked by:** nothing (can start now).
- **Delivers:** D9's columns and CHECKs, D10's `geo.posture`, the three evidence/placement CHECK-list extensions, `sir_put_anchored_geo` reading `posture` with a default. Nothing writes the new columns yet; today's extract and anchor publishes keep working because every new column has a default or is nullable and the RPC defaults `posture`.
- **Tested at:** S5.
- **Door:** two-way (revert = drop the columns and restore the CHECK lists; no data to lose until P1 writes some). `mete` NOT NULL → NULL is the one change that cannot be reverted mechanically once a traced row exists, which is after P2.
- **Blast radius:** none until P1; a wrong CHECK list would refuse the next anchor publish, which S5 catches.

**P1: the geometry library and the extract scripts** — `cartographer`
- **Blocked by:** P0 (`database.ts` regeneration; `publish.ts` typechecks against the new columns).
- **Delivers:** `sheet.ts`, `registry.ts`, `trace.ts`, `crop outline`, the `figureSchema` union, `assemble.ts` / `place.ts` / `publish.ts` for traced figures, `--dry-run` on the extract publisher. After it merges, the scripts can take a hand-built run directory with a traced figure all the way to the database (S3), and `extract-geometry-v2` on main still calls them exactly as before — a run with no traced figures exercises none of the new code.
- **Tested at:** S1, S2, S3.
- **Door:** two-way.
- **Blast radius:** every `extract-geometry-v2` publish (the scripts are shared); S3's mete-only fixture is the guard.

**P2: the extract runbook learns plan sets** — `bureau`
- **Blocked by:** P1.
- **Delivers:** D1–D6 and D8's readout: `document_kind` on the request, 1.2's size and OCG signals, the new `1.3-classify` step and its contract, the survey's plan-sheet section, `plan.py` and `roster.py` for `feature` regions, steps 3.4 and 3.5 with their contracts, `assemble.py`'s append, the readout section. After it merges, §6 step 1 runs.
- **Tested at:** S4 (a) and (b).
- **Door:** two-way for the runbook; **one-way for prod data** once §6 step 1 publishes, since publish replaces the file's figures and marks anchor `f290425a` stale (D12). The rollback is the anchoring spec's: the stale anchor's `geo` rows stay, flagged, until a new anchor replaces them; nothing is deleted.
- **Blast radius:** every `extract-geometry-v2` run; S4 (a) is the guard that a plat run is unchanged.

**P3: the anchor runbook and the viewer carry posture** — `bureau` + `cartographer`
- **Blocked by:** P0 (the RPC must accept `posture` before the publisher sends it). Independent of P1 and P2; can land before them.
- **Delivers:** D14 and D15 — `InputFigure.posture`, the correspond prompt paragraph, the render colour, the check question, `publish.ts`'s payload, the viewer colours. After it merges, an anchor run on a file with only mete figures behaves exactly as today (every figure is `recorded`).
- **Tested at:** S6 (and the sibling spec's S1 as the regression: the car-wash plat anchors unchanged).
- **Door:** two-way.
- **Blast radius:** every anchor publish; the payload default in P0 is the guard.

Deploy order: **P0 → P3 and P1 in either order → P2 → §6.**

---

## 6. Acceptance

On `cc2e3a53` as it stands (§1.2), after P0–P3:

1. **Extract.** `extract-geometry-v2` with `{file: cc2e3a53…, run_slug: whitewater-cc2e3a53-v2-run2}`, no `document_kind`. Expect `1.3-classify` to read the cover sheet and say `plan_set` (`decidedBy: page1`, `sheetIn: [36, 24]`, the sheet index among `seen`); `feature: building` regions on sheets 12, 13, 14; 3.5 on sheet 12 choosing the `C-BLDG` candidate; `assemble.log` printing `1"=20.000'`, θ ≈ −15.46°, residuals ≤ 0.01 / 0.02 ft, area 2,856 vs stated 2,856, printed scale **agrees**; the readout's traced section; a `publish` ruling → two figures (`LOT 1` mete/recorded, `CAR WASH` traced/proposed), anchor `f290425a` marked **stale**, its two `geo` rows flagged.
2. **Anchor.** `anchor-geometry` with `{file, anchor_run_slug: whitewater-cc2e3a53-anchor-2}`. Expect the loose-file path to find the same TCAD ring and reuse the existing `county_api` row (sibling D11 — **one** county row, not two); `LOT 1` `same_as`, `CAR WASH` `within`; `ring_fit` / `gis_fit` with metrics matching anchor 1 to three decimals (the lot did not change); the overlay with the building dashed inside the lot; accept → **three** `geo` rows under the new `anchor_id`, `posture` `recorded` / `proposed` / `null`.
3. **Measure.** D16's query returns `building_sqft` 2,856.0 ± 0.5, `inside_lot` true, and the five per-line distances within 0.05 ft of §1.4 (9.97 / 53.76 / 71.59 / 92.32 / 151.00). The 9.97 ft figure is handed to a human with the setback dashes' 29.5 ft beside it; what it means is a review question, not this spec's.
4. **Regression.** S4 (a) on the car-wash plat, and the sibling spec's S1 on the car-wash anchor, both unchanged.

Two deliberate negatives: the same file with `document_kind: plat` in the request must run as today and publish one figure; and a run where `3.5-confirm` returns `chosen: null` must publish only the lot, with the readout naming the region that was traced and not confirmed.

---

## 7. Open questions

**Q1.** Is `request.document_kind` the right override, or should the operator's `scope_note` carry it as prose the way it carries everything else? A typed field is what D1 records; a note is what every other step reads. Proposed: the field, and the note may say why. A second half, after v1.1: should `1.3-classify` look past the first sheet-sized page when that page is itself ambiguous (a plat reproduced as sheet 2 of a plan set, as on White Water), or is one glance the rule? Proposed: one glance; the survey corrects per page anyway.

**Q2.** Should `registerSheet` be its own function (D7, Procrustes on an exact correspondence) or `anchor.ts`'s `fitToRing` with scale freed — the sibling spec notes `freeScale` is already computed and never applied (§6.2)? Proposed: its own function. A ring fit scores overlap of two shapes that are only approximately the same; this is the same shape twice, and the right tool is point-to-outline least squares. Reuse the metrics vocabulary (`meanDistFt`, `hausdorffFt`) so the readout reads the same.

**Q3.** `geo.posture` as a column (D10) or as `properties.posture` like `accuracy_class` and `method` are today? The column is the first filter of every review query; the property keeps `geo`'s column list short. Proposed: column; the audit should push back if the derived-layer migration (north star D3) is near enough that adding columns now is throwaway.

**Q4.** The sheet's lot (D7) when a sheet draws two lots, or a plan set omits the plat entirely. The second is the common case outside this file: the lot then has to be read **as a mete figure off the plan sheet's own calls** (the `drawing_labels` the transcribers already read as `context` become `course`, which the inventory already supports) — so the real question is whether 3.2-inventory should promote a sheet's property-line calls to a figure when no plat page exists. Proposed: yes, as the next slice; v1 stops with the reason.

**Q5.** The canopy. `C-BLDG CANOPY` is 80 open segments on sheet 12 and Austin counts canopies as impervious cover but not as building coverage. Proposed: a separate registry entry `canopy` later; v1's exclusion pattern keeps it out of `building`.

**Q6.** Multi-sheet consistency (D6). The traces for sheets 13 and 14 are on disk after 3.4; registering those sheets costs one `registerSheet` each and the comparison is one Hausdorff. Is that v1.1 of this spec or part of the identity work (north star P1c)? Proposed: v1.1 here — it is a readout flag, not a feature.

**Q7.** Raster sheets (two of 53 on 2008 San Antonio). `trace.ts` reports `raster: true` and 3.5 confirms nothing. Vision tracing (the model outlines the building on a crop) is a different reader with a different accuracy class. Proposed: out of scope until there is a plan set where the site plan itself is raster.

**Q8.** Who owns the layer patterns in D17, and how firm-specific prefixes (`JCE BASE|`) are handled. The patterns match on the suffix after the last `|`. Proposed: the registry in `cartographer` owns them; a pattern that misses on a new firm's set is a one-line PR, and the confirm step is what keeps a miss from being silent.

**Q9.** Re-extraction stales the accepted anchor (D12). Plan sets will be re-extracted every time a feature is added, so every addition costs a re-anchor and a HITL. Proposed for now: accept it, since the anchoring spec's reasoning (an anchor is keyed by what survives a re-publish, and `frame-1`'s transform is unchanged) means the re-anchor is a formality — but **additive publish** (new figures appended under the same `run_slug`, the anchor kept) is the better answer once features arrive one at a time, and it is a change to winston#266 D5, so it is its own spec.

**Q10.** `existing` posture. Sheet 7 draws the existing building to be demolished; the IG table's "existing driveways" are the same axis. v1 registers only `proposed`. Proposed: the CHECK admits `existing` now so the next registry entry needs no migration; nothing writes it.

---

## 8. Seams, against the sibling's list

The sibling spec (§6) named eight seams a plan-set reader must not foreclose. What this spec does to each:

| sir-free §6 | this spec |
|---|---|
| 6.1 frame identity (`frame_key` per document) | **Left shut, deliberately.** The sheet is registered into the *lot's* frame (D7), so `frame-1` stays the document's frame and nothing links a frame to a sheet. The registration lives on the figure (`trace.sheet`), not in a frame table. Driveways (D18) are where this opens. |
| 6.2 fixed scale | **Opened, in one place.** `registerSheet` solves scale; `anchor.ts` still does not. |
| 6.3 units (no page-pixel member) | **Not opened.** Page points exist only inside `registerSheet`'s inputs; every stored coordinate is still feet. |
| 6.4 polygon-only | **Not opened.** The building is a polygon. Trees and curbs open it (D18). |
| 6.5 reading model | **Opened.** `reading_method` and `trace` beside `mete` (D9). |
| 6.6 correspondence vocabulary | **Not opened.** `within` is enough for a proposed polygon inside its lot. |
| 6.7 posture | **Opened.** `posture` on both tables (D10). |
| 6.8 provenance (file vs sheet) | **Half opened.** `trace.page` names the sheet on the figure; `geo` still names the file. |

---

## 9. Not yet specified

- **The dash-bridging tolerance** in `trace.ts` step 2 — how far along a line two collinear segments may be apart and still join. The IG spike and §1.4's 95 dashes give two data points; the first layer-less plan set will set it.
- **Candidate ranking without layers.** On 2008 San Antonio sheet 10 there are no closed paths at all, so the tracer has to chain open segments by style before it has any ring to rank. How many candidates to show the confirm worker, and how to cap the overlay crops, waits for that run.
- **What the readout shows for a registration that fails the gate** — the attempt's numbers, the overlay, or both; and whether a failed registration should still publish the figure `unplaced` or hold the run at 6.2.
- **The survey prompt's plan-sheet paragraph** in full. D3 says what it must say; the words come with P2 and the first survey outputs.

## 10. Out of scope

- Trees, curbs, driveways and every other registry entry (D18 names the shape and the cost; each is its own slice).
- Line and point geometry; the `polygon` → `geometry` expand/migrate/contract (D18, sir-free §6.4).
- Raster plan sheets and vision tracing (Q7).
- Multi-sheet identity and consistency beyond the readout count (Q6; north star P1c).
- The PostGIS tool surface for agents (north star P4); D16 is a query a person runs.
- Additive publish / keeping an anchor across re-extraction (Q9; a change to winston#266 D5).
- `cityhall`, the SIR runbook, `project.site_outline`, the completeness check's vision path.
- Reading the lot from a plan sheet with no plat page (Q4).

---

## Appendix A: evidence pointers

- **Prod rows (2026-10-16):** `cartographer_files.cc2e3a53…` (`metadata.lastGeometryRun whitewater-cc2e3a53-v2-run1`); `cartographer_geometries.5ab01b03…` (`LOT 1`, `frame-1`, `source_pages {2,7,12,19}`); `cartographer_anchors.f290425a…` (accepted 2026-10-14T17:51Z, `ring_fit`/`gis_fit`, 2277, `sir_id null`, IoU 0.9997, mean 0.0063 ft, Hausdorff 0.031 ft); `geo.2ceb7683…` (anchored LOT 1) and `geo.183eced8…` (county ring `0436110202`, `native_sr.wkid 102739`). Evidence by page/role: p2 course ×5, basis_of_bearings, scale_factor ×2, stated_area; p7/p12/p19 context ×5 each (`drawing_label`).
- **Schema (as applied):** `geo.sir_id` and `cartographer_anchors.sir_id` nullable, `submission_version_id` on both, `geo.file_id` — the sibling spec's P0, confirmed in `information_schema` today.
- **The PDF:** `~/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf` — 30 pages, 2592 × 1728 pt, Civil 3D 2021 / `pdfplot16`, 803 OCGs; sheet 12 = 16,479 paths / 61,649 items / 64 layers / 142 words; `C-BLDG` 54 segments → one closed 55-vertex ring, 37,014 pt²; `C-BNDY LINE` 95 segments; `C-SETBACK BLDG` 109. The comparison set: `~/noetic/tmp/Quiddity/Electronic Submittal/00. 2008 San Antonio St Site Plans.pdf` — 53 pages, Civil 3D 2025 / `pdfplot17`, 0 OCGs; sheet 10 = 14,530 paths / 152,532 items / 0 closed / 883 words.
- **The spike (§1.4):** PyMuPDF 1.26.5 `page.get_drawings()` with `layer` per path; shapely 2.0.7; iterated Procrustes of the 95 dash midpoints onto the lot outline, scale fixed then free; lot walked from the five plat courses. Numbers as tabulated; the script is 80 lines and belongs in S2's fixture.
- **The extract runbook:** `bureau/runbooks/extract-geometry-v2/` — `README.md` (the step map), `AGENTS.md` (agents transcribe, code computes; every image is made by the crop tool), `scripts/{fetch,plan,roster,assemble,publish}.py`, `scripts/carto`, `steps/2.1-survey/steps/page/prompt.md` (the kinds table), `steps/4.1-merge/contract.test.ts` (`courses.min(2)`), `steps/6.2-hitl/contract.test.ts` (the three rulings).
- **The cartographer scripts:** `runbooks/extract-geometry/scripts/assemble.ts` (the honesty boundary), `place.ts` (frames, `referenceId`), `publish.ts` (delete-then-insert, `cartographer_mark_anchors_stale`), `crop.ts:75` (`TRANSFORM_OPS`), `lib/evidence.ts:252-282` (`figureSchema`), `lib/db.ts`.
- **The anchor side:** `runbooks/anchor-geometry/scripts/lib/frames.ts` (`ringInFrame`, `toInputFigure`, `buildAnchorInputs` — `within` excluded from the fit), `src/lib/geometry/anchor.ts:173-185` (`AnchorResult.figures` includes `within` and unmatched), `bureau/runbooks/anchor-geometry/steps/2.1-correspond/{prompt.md,contract.test.ts}` (the relation enum), `substation/supabase/functions/geo_helpers.sql:291-387` (`sir_put_anchored_geo`: polygon gate at :344-347, the insert at :350-379).
- **Migrations this touches:** `20260918170000_cartographer_geometries.sql` (`mete`, `polygon` NOT NULL), `20260921000000_cartographer_geometries_placement.sql` (`placement_method` CHECK, the completeness CHECK pattern), `20260925132000_cartographer_extraction_anchor_metadata.sql` (the `role` / `source_kind` CHECK lists).
- **Prior specs:** `../north-star/NORTH-STAR-SPEC.md` (§1.3 the question, §6 plan sets, §9.3 recorded vs proposed, D14 derived geometry), `../sir-free-anchoring/DESIGN-SPEC.md` (§6 the seams, D7 the check-not-source pattern, D11 the county-row key), `../geometry-placement/DESIGN-SPEC.md` (winston#270: polygon + offset, edges), `../geometry-extraction/evidence/DESIGN-SPEC.md` (winston#274: every reading cites a crop), `../anchoring-geometries/DESIGN-SPEC.md` (winston#279 D14: stale anchors).
- **The IG report:** §4 "Feature layers by demand" (building footprint 51 A+B / 30 A), §4 "Feasibility signal" (no CAD layers on 2008 San Antonio; "the geometry is precise and free; the identity of each line is what costs money"), §5 slice 1 (2D, plan set only, no anchoring needed — this spec takes the anchoring too, because the frame-1 transform already exists).
