# Driveways and curbs from plan sets — existing and proposed, with widths, lengths and return radii, and the adjacent driveways the sheet leaves off

**Status:** Draft v3.4
**Date:** 2026-10-20
**Phases:** **Phase 1a — curbs** (§2.1–2.3, §2.5–2.6; D1–D4, D8–D11): every proposed and existing curb line on the sheet with its arcs, paired, measured and carried through `extract-geometry-v2` and `anchor-geometry` as lines; ships and is accepted on its own (§7.1a). **Phase 1b — driveways** (§2.4, §2.7; D5–D7, D12): the lot's frontage edges found by code and every driveway derived from the curbs that cross them, as it exists and as it will exist; blocked by 1a's acceptance (§7.1b). **Phase 2 — adjacent** (§3): the driveways next door, the street, its Level and the curb inlets, fetched from the jurisdiction's public layers and joined to Phase 1's rows on the grid; blocked by Phase 1b's acceptance and by surveyor's layer-role registry.
**Repos touched, Phase 1:** `bureau` (`extract-geometry-v2` steps 1.2, 2.1, 3.4, 3.5, 4.2, 6.1 and their contracts; `anchor-geometry` steps 1.2, 2.1, 3.2, 3.3, 5.1), `cartographer` (`src/lib/features/registry.ts`; `runbooks/extract-geometry/scripts/lib/{pdf_paths.py,trace.ts,evidence.ts,traced.ts}`; new `lib/curb.ts`, `lib/frontage.ts`, `lib/driveway.ts`; `trace.ts`, `crop.ts`, `assemble.ts`, `place.ts`, `publish.ts`; `runbooks/anchor-geometry/scripts/{fetch,render,publish}.ts` and `lib/{contracts,frames}.ts`; `/geometry/[id]`, `/anchored`, `/anchor/[id]` draw lines), `cityhall-new` (`supabase/schemas/public/tables/{cartographer_geometries,cartographer_geometry_evidence}.sql`, `functions/sir_put_anchored_geo.sql`, and the migration `supabase db schema declarative sync` writes)
**Repos touched, Phase 2:** `surveyor` (`src/lib/gis-layer-identity.ts` `LayerRole`; `src/sources/coa-gis/layer-identity.json` role tags), `cityhall-new` (one new function `cartographer_put_context_geo.sql`), `cartographer` (new `runbooks/anchor-geometry/scripts/frontage.ts`; `render.ts`, `publish.ts`), `bureau` (`anchor-geometry` new step `1.3-frontage`; `3.2-render`, `3.3-check`, `5.1-publish`)
**Repos NOT touched:** `substation` (retired 2026-09-29), `cityhall` (the old app), `conductor2`, `prospector` (the generalisation of layer roles to every trained jurisdiction is its own spec, D22), `claude-plugins`, `navalbase`, `quarry`
**Prod:** Supabase **Noetic App** (`mgxqsrjutswbciyrltwd`)
**Parent:** [`../north-star/NORTH-STAR-SPEC.md`](../north-star/NORTH-STAR-SPEC.md) (winston#303) — the second slice of **P5 (plan sets)**, and the first use of its **D14** (derived geometry is a fourth path).
**Sibling:** [`../plan-set-footprints/DESIGN-SPEC.md`](../plan-set-footprints/DESIGN-SPEC.md) (winston#322, **shipped** — cartographer #40, #41, #42; bureau #2132, #2134, #2148; prod migration `20261016210300_plan_set_footprints`). Its registry (D17), tracer ladder (D4), sheet registration (D7), posture (D10) and `within` anchoring (D14) are the ground this spec stands on. Its D18 row for curbs and driveways is what this spec writes out, with one correction (§9).
**Sizing:** IG report [`2026-10-13-geometry-opportunity-formal-review`](https://inspector-general-gamma.vercel.app/reports/view/2026-10-13-geometry-opportunity-formal-review) — **curb / face of curb / returns** is the fifth-most-demanded layer (34 of 134 geometric comments, 18 A-tier) and **driveway / drive aisle** the tenth (19, 12 A-tier); the report lists "neighbouring driveways" among the county-side geometry that 62 of 134 comments (46 %) need, and the only non-PostGIS operation in its ranking is an **arc radius fit**.

> **Revision note (v3, 2026-10-19, after the first audit):** Phase 1 is split into **1a curbs** and **1b driveways** so the plumbing (arcs, the polyline tracer, lines in the figure model, `carried` in the anchor run) is accepted on the simpler feature before any derivation exists; §6.1 is now P0–P3 then P4–P5, §7.1 is 7.1a and 7.1b, Phase 2's PRs are renumbered P6–P9. Four simplifications for the MVP: the registry key `curb` is **`curb_proposed`** (the bare name is a trap once a feature has two postures; `building` keeps its legacy name, D1); **no `length_ft` column** (nothing reads it: D12 takes `st_length` from `geo`, the readout reads the artifact, the viewer sums the GeoJSON — D9); **no frontage worker in Phase 1** (D5 is code-only, every candidate edge is a frontage with `street: null`, and Phase 2's D16 names the streets from the city's layer); **no per-chain `exclude[]` and no `driveway` survey region** in the confirm step (D3, D1; both to §10 until a run shows what needs excluding). D6 is corrected in five places: demolition is a geometric clip of the existing chains, not a per-chain flag (step 8); a pair's two crossings collapse to one and same-station crossings dedupe before the opening rule (step 1); the return search window is 60 ft, the Table 7-1 maximum (step 3); a flare's inner end stands in for its tangency point (step 4); stations run from the course's start vertex (new convention line). The `driveway` entry's posture is `null`, set by the condition (D1). New open questions: **Q13** (does the existing-concrete layer redraw the stretch the demolition layer removes? verify before P4) and **Q14** (the posture word for the resulting-condition row of a retained driveway). §7.1 now says the return radius at the right-of-way is exercised by a synthetic fixture only. §10 records a national fallback (TIGER / OSM / TxDOT Roadway Inventory) for the `streets` roles outside tagged jurisdictions, never for Street Level. **v3.1 (2026-10-20):** a curb's face and back are published as separate rows with `edge: face | back | unknown` (D4, D10), because a review tool measures to a named edge and a merged MultiLineString cannot say which edge it hit; the fixture counts in S4–S6 and §7.1 move up by one. **v3.2 (2026-10-20):** the rows are shaped for the review tools the IG report ranks (§2.10, **D23**): every anchored row carries `source_pages`, `source_figure_id`, `source_crop_id`; each grouped arc becomes a `curb_return` row with its tangent points (1a); each frontage course becomes a `frontage` row (1b — **Q4 reversed**); D7's label verdicts and the survey base's reach past the lot are published on the rows, for the completeness check's CC-22-13 and CC-22-14; a deterministic `feature_key` survives a republish; the `kind` vocabulary this spec introduces is one table; code references stay off geometry rows. Phase 2's inlet clearance (D20) now measures to the return's tangent point, as TCM 7.6.2(C) says. **v3.3 (2026-10-20): Q13 resolved** by `spike/probe8.py` — the removed stretch is drawn once, on the demolition layer only, so the fixture exercises the per-chain drop and S3's synthetic set exercises the clip; P4 is no longer gated on a probe. **v3.4 (2026-10-20): Q14 resolved** — on a derived driveway row, `posture` says whether anything changes (`existing` when every edge is retained, `proposed` when any edge is new) and `condition` says which derivation produced it; no fourth posture word, no DDL (D6 step 8, D10, D12).
>
> **Revision note (v2.1, 2026-10-19):** two Phase 1 gaps closed from the preprocessed content blocks of the three plan sets (§1.3, "What the content blocks say"): the primary sheet is now **per feature, by title pattern** (D1), a matchline pair is one primary sheet and an enlarged inset is never inside a feature region (D3), and throat depth is measured to the first curb chain only, with its basis recorded (D6 step 6). S5 and §7.1 now confirm `curb_existing` on sheet 7.
>
> **Revision note (v2, 2026-10-19):** the spec is split into two phases so Phase 1 can be implemented and tested first. **Phase 1** keeps everything that reads the sheet and anchors it: D1–D14, S1–S6, P0–P3, §7.1. **Phase 2** holds the off-sheet context: D15–D22, S7–S9, P4–P7, §7.2, and is where the surveyor layer-role work and the prospector follow-up live. Decisions are renumbered (v1.1's D13 is now D16–D19; its D14 is split into D12 on-site and D20 adjacent). Five open questions were settled by a spike or a code search and are recorded as decisions: Q1 (no geometric face/back rule survives the test, D4), Q5 (surveyor's layer-identity registry is the home for roles, D15), Q6 (300 ft is the City's own submittal requirement; 200 ft was a review-guide convention, D17), Q10 (no Street Level default, D18), Q11 (TCM 7.6.3 measures along the street, D20). v1.1's two-condition driveway rule (D6) and the no-SIR statement (§1.1) carry over.

---

## 1. Problem

### 1.1 What this is for

One sentence, in three parts: **(Phase 1a) run `extract-geometry-v2` on a site plan set, get every proposed and existing curb line as a figure beside the lot, with its arcs' radii and its length, and run `anchor-geometry` so they sit on the county grid as lines; (Phase 1b) derive each driveway from the curbs that cross the lot's frontage — as it exists and as it will exist — with the numbers TCM Section 7 asks for; (Phase 2) have the grid say how far that driveway sits from the driveways next door, the intersecting street and the curb inlets, which no sheet shows.**

Two things make this harder than the building footprint, and the phases follow them (the 1a/1b split inside Phase 1 is the order the risk is retired in: lines through every layer first, the derivation on top of lines that already work):

1. **A curb is a line with arcs, not a closed ring.** The footprint tracer keeps closed rings and flattens every Bézier to eight chords (`pdf_paths.py` `BEZIER_STEPS = 8`). A curb return's radius is in the Bézier's control points, and the review question (*is the return 15 ft?*) is answered by that radius. Phase 1a; the driveway built from the curbs is Phase 1b.
2. **Dimensioning adjacent driveways is a regulatory requirement, and the sheet does not carry them.** TCM 7.6.2's spacing is measured to the next driveway along the street; the City's submittal checklist asks for adjacent driveways within 300 ft; the White Water survey base stops 10–35 ft past the lot. The answer has to come from somewhere the plan set is not, and it has to land on the same grid as the proposed driveway so one `ST_Distance` can compare them. Phase 2.

On names: the extract runbook is `extract-geometry-v2` (the conductor port). The anchor runbook is `anchor-geometry` — there is no `-v2` directory in bureau; the version this spec changes is the one winston#322 P3 left (`bureau/runbooks/anchor-geometry/`, eight steps).

**No SIR is needed anywhere in this spec, and the acceptance fixture has none.** The anchor run's loose-file path (sir-free anchoring, winston#309, shipped) finds the county ring from the plat's page-1 county and legal description; `cartographer_anchors.sir_id` and `geo.sir_id` are nullable; `sir_put_anchored_geo` writes whatever `sir_id` the anchor carries, and its own comment reads *"sir_id may be NULL on an unowned anchor"*. White Water (`cc2e3a53`) has `project_id: null`, no SIR, an accepted anchor and four `geo` rows (§1.6). The `sir_` prefix on that RPC is a legacy of `geo`'s first life as the SIR map's table, not a dependency; Phase 2's new RPC is named `cartographer_put_context_geo` so it does not repeat the misdirection. A plan set uploaded to Cartographer with nothing else attached runs every step below.

### 1.2 What a reviewer measures, and against what

The numbers come from Bureau's copy of the TCM (`bureau/jurisdictions/austin/codes/tcm/contents/Section 7 - Driveways/…`) and the review guide `bureau/jurisdictions/austin/review-guides/ta/site-access-and-circulation.md` (contract prefix `SAC`, 27 items; `SAC-03` width at the property line is "the single most repeated line in this department's comment slice", 305 atomic comments). Every row is a geometry question with a measurement convention, and the convention is the design input. The last column says which phase produces the number:

| what | the number | measured how | rule | phase |
|---|---|---|---|---|
| curb return radius | Level 1/2 typical 10 ft; Level 2 three-lane and Level 3/4 typical 15; fire access 15–25; industrial 15–50 | the return arc's radius | TCM Table 7-1, §7.5.1.1 | 1a (every radius) / 1b (which return is a driveway's) |
| width | Level 1/2 typical 20 ft; fire 20–25; industrial 25; high-capacity ≤ 32 | **face of curb to face of curb at the throat** (TCM); **at the property line** (`SAC-03`) | TCM Table 7-2, §7.5.1.2 | 1b |
| angle to the street | 90° | the driveway axis against the through lanes | TCM 7.5.1.3 | 1b |
| throat storage | 25–150 ft by use and spaces | **from the property line** to the first interruption (first aisle, stall or crossing drive) | TCM Table 9-5, §9.3.4.3.1 | 1b |
| the return stays inside the lot | — | the curb return may not cross the projected side lot line without the neighbour's consent | TCM 7.6.2(D) | 1b |
| count per frontage | < 300 ft: 1; 300–600: 2; > 600: 3 | existing plus proposed per frontage | TCM Table 7-4, §7.6.1 | 1b (this lot) / 2 (the frontage's others) |
| existing approaches | remove the ones no longer needed; an existing driveway may be required to conform | the existing condition against the resulting condition | LDC 25-6-295, 25-6-321, 25-6-322 | 1b |
| joint use | an easement on the City Attorney's form | — | TCM 7.6.4; LDC 25-6-451 | 1b (read), 2 (the neighbour's apron) |
| spacing to the next driveway, same side | Level 1: minor 50 ft / major 75; Level 2: 75 / 150; Level 3: 200; Level 4: 280 | **inside edge of pavement to inside edge of pavement** (Fig. 7-5); to an intersecting street, from its edge of pavement | TCM Table 7-5, §7.6.2 | 2 |
| clearance to a curb inlet | 10 ft | inlet opening edge to the driveway's **point of tangency** | TCM 7.6.2(C) | 2 |
| offset to an opposing driveway | ≥ 80 ft when offset right; offset left → right-in/right-out only | **throat edge to throat edge**, along the street | TCM 7.6.3 | 2 |
| what must be on the sheet | adjacent driveways within **300 ft**; spacing, widths, radii and opposing offsets dimensioned | — | DSD site plan requirements page; CC Submittal Checklist p.5 (`CC-22-12`–`CC-22-15`) | 2 |

Two conventions decide the derivation in §2.4: **a driveway is bounded by its two curb faces where they cross the right-of-way line**, and **spacing is between pavement edges, not centrelines**. Every TCM row above keys on the street's **Street Level**, which TCM Appendix A defines as "classification of roadways identified in the ASMP Street Network Map" — Phase 1 produces the numbers and leaves the row to the reader; Phase 2 looks the Level up (D18). In Phase 1 the street is not named either (D5): the readout says *course 5*, Phase 2 says *Brezza Lane*.

### 1.3 What the sheets actually contain (verified 2026-10-19)

Measured with PyMuPDF 1.26.5 and shapely 2.0.7 against the three plan sets on disk.

**White Water** (`cartographer_files.cc2e3a53`, 30 sheets, Civil 3D 2021, 803 OCGs). Sheet 12 SITE PLAN, the design layers (xref `JCE BASE|`):

| layer | items | what it is |
|---|---|---|
| `C-CURB FOC` | 233 lines + **44 curves** + 1 quad | the proposed face of curb |
| `C-CURB BOC` | 27 lines + **38 curves** | the proposed back of curb |
| `C-SIDEWALK` | 90 + 30 curves | the proposed sidewalk edges |
| `C-SAWCUT` | 34 | where new pavement meets old |
| `C-EXIST CONC` | 293 | existing concrete, screened, inside the lot |
| `C-FIRELANE`, `C-STRIPING`, `C-ADA PATH` | 876 / 237 / 2,142 | striping |

and the survey base the design was drawn over, present on every plan-view sheet:

| layer | items | length | where |
|---|---|---|---|
| `V-ASPHALT-LINE` | 29 | 493 ft, **all outside the lot** | the street's pavement edge and the neighbour's parking edge |
| `V-CONC-LINE` | 282 | 2,275 ft, 2,063 ft outside | the public sidewalk, the street curb and gutter, the existing driveway |
| `V-BNDY-ADJ-LINE` | 20 | 105 ft | adjacent lot lines |
| `V-ESMT-LINE` | 179 | 771 ft | easements |
| `V-ROAD-TEXT` | 868 | — | `BREZZA LANE`, `S. I-35`: vector glyphs, not text |

Sheet 7 EXISTING CONDITIONS & DEMOLITION adds `C-DEMO CONC` (38 lines: two chains of **86 and 85 ft**, the curb the note says to remove, *"CONTRACTOR TO REMOVE EXIST. CONC. CURB (84 LF)"*) and `C-IC EXIST PAVING` (45 lines: one closed ring, 2,278 ft², 94.6 × 43.6 ft, inside the lot). Every dimension label — `R20.0'`, `R25.0'`, `R28.0'`, `6" CURB`, `2–3' CURB CUTS`, `SAWCUT EXISTING CURB/PAVEMENT`, `EXISTING CONCRETE DRIVEWAY`, `CALLED 0.0565 ACRES JOINT ACCESS EASEMENT` — is drawn as glyphs on `C-DIM TEXT` (1,903 items) and `C-SITE TEXT` (3,661); the text layer has 142 words on sheet 12, none of them a dimension. The labels are read by vision or not at all.

**Arcs are arcs.** `page.get_drawings()` reports the curb returns as cubic Béziers (`'c'` items), not chorded polylines. The footprint tracer's reader flattens each to eight chords (`cartographer/runbooks/extract-geometry/scripts/lib/pdf_paths.py:30-33`, `BEZIER_STEPS = 8`, with the comment *"a building's corners are rarely curves"*). Right for a building; for a curb it discards the one number the review wants.

**The survey base stops short.** How far the sheet's linework extends past the lot line, in feet, west / north / east / south: sheet 12 `V-ASPHALT-LINE` 11 / 26 / 35 / 12, `V-CONC-LINE` 19 / 26 / 34 / 10; sheet 7 `V-CONC-LINE` 28 / 26 / 81 / 10, `V-BNDY-ADJ-LINE` 26 / 112 / 33 / 2. No sheet in the set reaches 200 ft from the lot in any direction.

**What the site's access actually is.** Brezza Lane is the south frontage: course 5 (`N74°32'40"W 231.66`) is the right-of-way line, the public sidewalk sits just outside it, the street's curb 10.8–11.6 ft off it. The I-35 southbound frontage road is the east (courses 3 and 4, TxDOT, no access). The west and north are Lot 1, Lennox Springs Section 2 (apartments). The site's **only** access is the *EXISTING CONCRETE DRIVEWAY* on the west, shared with the apartments under a 0.0565-acre joint access easement (Inst. 2021084780). On sheet 7 that driveway's two curb lines cross the Brezza Lane right-of-way line at stations **76.9–77.8 ft** and **111.0–111.8 ft** from the southwest corner: an opening **33.2 ft** face to face, 34.9 ft outside to outside. On sheet 12 **no proposed curb face crosses any lot line**: the 84 LF of curb marked for removal begins **24.4 ft** inside the lot at the sawcut, the apron's two edges (25.7 and 72 ft chains from the right-of-way line) stay, and the proposed `R28.0'` and `R20.0'` returns sit inside the throat. So White Water is a joint-use, retained-approach case — the questions it raises are TCM 7.6.4 and LDC 25-6-321 (does a 33 ft opening on a Level 1 street conform to Table 7-2's 20 ft?), not a new return at the right-of-way. It is a good first fixture precisely because the derivation has to say *"the opening at the right-of-way line is unchanged; the throat behind it is altered"* rather than find a return that is not there.

**What the preprocessed content blocks say (checked 2026-10-19).** The three sets are in prod as plan set versions `6b4c9887` (White Water v1, 30 sheets, 350 blocks), `6cf68db3` (Lamar + Collier v8, 72 sheets, 642 blocks) and `9ddd2cf1` (2008 San Antonio v1, 53 sheets, 522 blocks), each with per-block embeddings. Asked where the existing curbs and their removal live, the blocks answer the same way on all three, and it is never the site plan:

| set | the sheet with existing curbs and the demolition callouts | its main drawing block, in its own words | the sheets with the proposed curbs |
|---|---|---|---|
| White Water | **7** Existing Conditions & Demolition Plan | "existing curb, sidewalk, driveway … one callout, CONTRACTOR TO REMOVE EXIST. CONC. CURB (84 LF), at the southwest curved driveway curb. No demolition-area hatch" | 12 Site Plan; 13 Paving Plan |
| Lamar + Collier | **8 and 9** Existing Conditions & Demolition Plan (1 of 2, 2 of 2), one matchline | "extensive demolition callouts (structures, fences, poles, utilities to be removed)" / "a large demolition scope of structures, pavement, signs … TO BE REMOVED" | 15 Overall Site & Paving & Striping; 16–17 Dimensional Control & Site Plan — 17 carries DETAIL A, an enlarged driveway plan at 1″ = 20′ with a mountable curb, right-in/right-out and radii |
| 2008 San Antonio | **8** Demolition Plan | "demolish ±97 LF and ±25 LF of curb and gutter, ±412.38 SF of sidewalk and driveway … repave a ±323.73 SF driveway" on the San Antonio Street frontage | 11 Dimension Control Plan (curb returns R5′); 25 Paving Plan (a 20′ driveway ENTRANCE); sheet 10 is titled "Site Plan" and carries neither |

Two methods were tried. The hybrid semantic search the completeness check uses (`search_content_blocks_hybrid`, OpenAI `text-embedding-3-small` through the gateway, pinned to the plan set version) ranks the **standard-detail sheets** first for every curb query on every set — 430S-1 curb and gutter, 432S ramps, 433S Type II driveway, pavement repair parallel to curb — semantically "curb", carrying no site geometry; only the query *demolition plan existing conditions survey* put the demolition sheet first on all three (vector similarity 0.58–0.69). A keyword sweep restricted to `drawing` and `legend` blocks ranked the sheets better, and the sheet titles alone ranked them best. So the primary sheet is chosen by **title pattern per feature** (D1), not by similarity; the blocks' descriptions are kept for what they are good at — the demolition sheet's own lengths (84 LF; ±97 and ±25 LF) are D7's label checks for the existing condition.

**The other two sets are layer-less where it matters.** 2008 San Antonio (53 sheets, 0 OCGs): the IG spike measured its garage entrance at 15.0 × 15.2 ft and face-to-curb at 12.3 ft through stroke styles. 1700 S Lamar v7 (`~/noetic/tmp/TestProjFromLamarCollier/v7/`, Civil 3D 2024, 67 sheets, **440 OCGs in the file** — but sheets 15 and 16, SITE PLAN 1 OF 2 and 2 OF 2, carry **one** layer each). Of three sets, one has curb layers. Rung 2 (stroke style) is the common case for curbs, as D19 of the sibling already predicted for every split sheet.

### 1.4 Spike: radii, pairs, lengths — and the face/back test

Sheet 12, at the registration winston#322 solved for it (1″ = 20.000′, so 0.27778 ft/pt; nothing below reads the title block). A circle fitted through each Bézier's two endpoints and its midpoint, then grouped by centre:

| face of curb | pieces | sweep | back of curb, same centre | printed |
|---|---|---|---|---|
| R **20.05** | 9 | 47.6° | 19.52 | the drive-through loop |
| R **28.02** | 1 | 90.0° | 27.52 | `R28.0'` — the tie-in to the existing driveway |
| R **20.02** | 1 | 88.6° | 19.52 | `R20.0'` — the southwest return |
| R **25.02** | 1 / 5 | 24.2° / 22.9° | 25.52 / 24.52 | `R25.0'` |
| R **15.02** | 2 | 92.6° | 15.52 | `R15.0'` |
| R 10.02 / 10.01 | 6 / 4 | 62.6° / 44.3° | 9.52 / 9.49 | `R10.0'` |
| R 5.01 / 3.02 / 2.02 / 1.52 | 3 / 2 / 2 / 4 | — | 4.52 / 2.52 / 1.52 / 1.02 | `R5.0'`, the dumpster pad corners |

Nineteen centres on the face, seventeen matched on the back at **R − 0.50 ft** on every one: the curb is six inches wide, which is what `6" CURB` says, read from the geometry with no label. The printed radii agree within 0.05 ft; the 0.02–0.05 excess is the three-point fit on a Bézier (a least-squares fit over the sampled curve brings it under 0.01, S2). Lengths: **894 ft** of face of curb on sheet 12 in 170 chains (broken by the 2–3 ft curb cuts, the ramps and every label that sits on the line), 43 back-of-curb chains, 717 ft of sidewalk with five closed rings (the islands). Existing: the two `C-DEMO CONC` chains are 86 and 85 ft against the note's 84 LF. Crossing the Brezza Lane line: the proposed 4 ft sidewalk at stations 66.6–71.0 (4.33 ft; the label says `PROPOSED 4' SIDEWALK`), the existing driveway at 77.8–111.0 (33.2 ft), the proposed curb nowhere.

**The face/back test (Q1, resolved).** Treating sheet 12's layers as unknown, the 17 face/back pairs were paired geometrically and four rules for *which member is the face* were scored against the layer truth: *nearer the striping, firelane and ADA markings* 12 of 17; *nearer the building* 11; *nearer the sidewalk* 11; *the larger radius at a shared-centre return* 16 of 17 (it fails where pavement is on the inside of the curve, the R15 return). None is safe, and the two sides differ by exactly the curb's width, so a rule is not worth a wrong face. D4 follows.

Every number is reproducible from the PDF and the registration. The labels served only to check.

### 1.5 Off the sheet: what Austin publishes (checked 2026-10-19; Phase 2's sources)

Queried at the site's address point (`LOCATION_address_points`: `10416 BREZZA LN` → −97.79374, 30.15016), keyless, from the City of Austin ArcGIS organisation (`services.arcgis.com/0L95CJ0VTaxqcmED`, 2,184 services):

| layer | geometry | what it holds here, within 300 ft | vintage | use |
|---|---|---|---|---|
| `impervious_cover_2023` (ArcGIS item `b2e6c84412534e7793e2b128fc0a715e`; 3,310,165 polygons; stored in EPSG 2277) | polygon; `FEATURE`, `ORIGIN_FEATURE_CLASS` (has a `Driveways` class, 544,485 polygons city-wide), `SOURCE` (per-polygon imagery vintage, 2012–2023) | **0** `Driveways`-class polygons; **16** `Pavement`, **3** `Paved Parking`, **2** `Paved Road` (`Double_Line_Streets`), **9** `Sidewalk`, **4** buildings | "hand-digitized from aerial imagery … updated every 2 years" (Watershed Protection Department); last edit 2025-05-06 | a commercial driveway is a `Pavement` polygon that touches the `Paved Road` polygon. The opening is **derivable** — the shared boundary — not labelled |
| `TRANSPORTATION_sidewalks` | polyline; `PEDESTRIAN_FACILITY_TYPE` includes `DRIVEWAY` | 4 segments, all sidewalks on Brezza Ln and S IH 35 SVRD SB; **no** `DRIVEWAY` here | 2006/07 inventory, edited to 2025 | a cross-check where it has driveways; not an inventory |
| `TRANSPORTATION_street_segment` | polyline; `FULL_STREET_NAME`, `ROAD_CLASS`, `SPEED_LIMIT` | `BREZZA LN`, class 8 = **A45 City Collector**, 30 mph | current | the street, its name and class, the intersecting streets |
| `TRANSPORTATION_asmp_street_network` | polyline; `STREET_LEVEL`, `REQUIRED_ROW_ALPHA` | only `OLD SAN ANTONIO RD`, Level 2, within 200 ft; **Brezza Lane is absent** from the layer, which carries 29,256 Level 1 segments, so absence is not "Level 1" | current | the Table 7-5 row (D18) |
| `UTILITIESCOMMUNICATION_CurbInlet` | point | **3** inlets (two built 2016) | current | TCM 7.6.2(C), the 10 ft rule |
| `PLANNINGCADASTRE_right_of_way` | polygon; "under construction, completion TBD" | 1 polygon, document `201700317` | partial | the street side of the right-of-way where it exists |
| `EXTERNAL_tcad_parcel` | polygon | the abutters | current | whose frontage each opening is on (`abutters.py` already sweeps it at 75 ft) |
| StratMap21 CapArea orthoimagery (`imagery.geographic.texas.gov/…/StratMap21_NCCIR_CapArea_Brazos_Kerr/ImageServer`) | 4-band, **0.1524 m (6 in) pixels**, EPSG 3857, keyless `exportImage` | the frontage as flown January 2021, leaf-off | 2021 (2019 also published) | the picture a checker sees under the overlay; the fallback outside Austin (Q7) |

The honest reading: **no Austin layer names driveways reliably along a commercial frontage** — the `Driveways` class is residential — but the boundary between a paved area and the paved road is a driveway opening, with a width, at the accuracy of a hand digitization over 6 in imagery (about ±1–2 ft). That is enough for Table 7-5 (whose smallest number is 50 ft) and for the count, and it is a prior for the person, never the figure a sheet is held to.

Prior art Phase 2 reuses rather than rewrites: `bureau/runbooks/site-research/bin/arcgis_query.py` (the keyless query with paging in object-id order, `outSR=4326`, ring winding, `--distance` buffers in feet, native-ring capture, and the rule that a zero-feature answer is not an absence), `abutters.py` (sides and shared boundary), `access_trace.py` (frontages from the road network), `_visual_walk_geo.py` (keyless aerial fetches). `anchor-geometry`'s `1.2-fetch` already calls `arcgis_query.py` through `locate` (`cartographer/runbooks/anchor-geometry/scripts/fetch.py:51-70`), and finds the parcels layer through **surveyor's layer-identity registry** (`src/lib/gis-layer-identity.ts` `LayerRole = 'parcels' | 'legal_description' | 'locator'`; `src/sources/coa-gis/layer-identity.json` tags TCAD Parcels `role: parcels` with `fields: {parcel_id: PID_10}`). Roles are set by hand; only `coa-gis` and `travis-county-gis` carry one, and nothing in prospector's `sources-recon` or `sources` sub-runbooks mentions roles (D15, D22).

### 1.6 Why it cannot run today

| | Where | What stops it | phase |
|---|---|---|---|
| **C1** | `cartographer/runbooks/extract-geometry/scripts/lib/trace.ts:388-396` `traceFeature` throws unless `entry.geometry === 'polygon'`; `traceBoundary` (:604) returns raw segments, unchained; `registry.ts:22` `FeatureTracer = 'closed_ring' \| 'segments'` | Nothing chains a polyline feature, ranks a *set* of chains, or draws a set on an overlay. | 1a |
| **C2** | `lib/pdf_paths.py:30-33, 64` | Every Bézier is eight chords; the radius is gone before the tracer sees the path. | 1a |
| **C3** | `lib/evidence.ts:335-396` `traceSchema.pathPt` is one closed ring; `cityhall-new/…/cartographer_geometries.sql` `polygon jsonb NOT NULL`, `closed boolean NOT NULL`, `computed_area_sqft`; `frames.ts:80` `ringInFrame` reads `polygon.rings[0]`; `/geometry/[id]` draws rings | A figure is a polygon all the way down. Sibling §6.4, left shut by winston#322, has to open. | 1a |
| **C4** | `cartographer_geometries.reading_method` CHECK `mete \| traced`; `evidence.ts` `TRACE_METHODS` | A driveway is read from nothing: it is computed from two curb figures and a lot line. North star D14 names the path; no row can say it took it. | 1b |
| **C5** | nowhere | Nothing in a run says which course of the lot fronts which street. `assemble.ts` walks the lot; the survey reads the course calls; no figure, attribute or file names a frontage. | 1b |
| **C6** | `anchor-geometry/scripts/lib/frames.ts:97-104` `toInputFigure` → `ring`; `:440` `toGeoJsonPolygon`; `bureau/…/2.1-correspond/contract.test.ts:18` `relation: z.enum(['same_as','union_of','within'])`; `sir_put_anchored_geo.sql:52-60` refuses anything but `ST_Polygon \| ST_MultiPolygon` | A line cannot be fetched, claimed, transformed or published by the anchor run. The existing street curb is *outside* the lot, so even `within` is the wrong word. | 1a |
| **C7** | `anchor-geometry/1.2-fetch` fetches the parcel ring; surveyor's `LayerRole` has `parcels`, `legal_description`, `locator`; no step fetches a street, a paved area, an inlet or an aerial | The 300 ft context has no producer and no registry role to find it by. | 2 |
| **C8** | `geo.method` is free text (`anchored`, `county_api`, `estimated` in prod); `geo.kind` is free text (`parcel`, `building`, `easement`, `easement_sanitary_drainage`, `right_of_way`) | A vocabulary gap, not a CHECK: no word yet for "a city GIS polygon, clipped to this frontage". | 2 |

What is **not** a coupling, and this spec leans on: D7's sheet registration is one similarity per sheet, and every path on the sheet rides it — a curb registers exactly as the building did, by the lot drawn beside it; `posture` already admits `existing` (sibling Q10: the CHECK was widened, nothing writes it); `anchorFrame` transforms any list of points; `geo.geom_local` is untyped and `geo.geom_wgs84` is `geometry(Geometry, 4326)`, so a LineString is storable today without DDL; `sir_parcels()` returns `st_asgeojson(geom_wgs84)` whatever the type (`sir_parcels.sql:20`), so the map draws a line the day one lands.

**Prod as it stands (2026-10-19).** The sibling's acceptance run happened: `cc2e3a53` carries two figures from `whitewater-cc2e3a53-v2-run2` (`LOT 1` mete/recorded, `CAR WASH` traced/proposed, `sheet_registration`), anchor `53d65a90` (`whitewater-cc2e3a53-anchor-2`) is **accepted** and `f290425a` stale, and `geo` holds four rows for the file (the TCAD ring, the stale and the live `LOT 1`, and `CAR WASH` as the first `proposed` row). `cartographer_geometries` has 14 rows, one of them traced. Phase 1a's first publish stales anchor 2 the same way, and 1b's stales anchor 3 (sibling D12, Q9).

### 1.7 Scope

**Phase 1a, in:** two registry entries (`curb_proposed`, `curb_existing`), arcs preserved in the reader, polyline tracing and confirmation, face/back pairing, label checks on radii and lengths, lines in the figure model and in `geo` (expand only), the anchor run carrying lines, and the curb queries. **Phase 1b, in:** the `driveway` entry, the lot's frontage edges found by code from the sheet, the driveway derived twice (existing and resulting condition) with its measures, the `derived` reading method, and the driveway queries. **Phase 2, in:** the frontage context fetched from the jurisdiction's public layers through surveyor's layer roles, published beside the anchored figures, and the adjacency queries; Austin tagged by hand. **Deferred to §10 (in scope, not in the MVP):** the confirm worker's per-chain `exclude[]`, the `driveway` survey region, a Phase 1 street name, `length_ft`. **Out (§11):** trees, sidewalks and striping as features, grades and Z, vision-drawn openings from the orthophoto, the prospector change that tags roles for every trained jurisdiction (its own spec, D22), the agent tool surface, and the `polygon` column's contract phase.

---

## 2. Phase 1 — on-site curbs (1a) and driveways (1b)

### 2.1 Three registry entries

**D1. Curbs are two registry entries by posture (1a), and the driveway is a third with no tracer and no survey (1b).** `cartographer/src/lib/features/registry.ts` gains:

```ts
curb_proposed: {
  geometry: 'polyline', posture: 'proposed', kind: 'curb',
  layerPatterns: [/\bCURB\b/, /\bFOC\b/, /\bBOC\b/, /CURB.?(FACE|BACK)/],
  layerExclude: [/TEXT/, /EXIST/, /\bEX\b/, /DEMO/, /REMOVE/, /\bV-/, /\bX-/, /\bE-/, /RAMP/, /INLET/],
  labelPatterns: [/\bR\s?\d+(\.\d+)?'/, /\d+"\s*CURB/, /CURB\s*CUT/],
  minAreaFt2: null, minLengthFt: 3, tracer: 'polyline',
  edge: (layer) => /\bFOC\b|FACE/.test(layer) ? 'face' : /\bBOC\b|BACK/.test(layer) ? 'back' : null,
  survey: 'the curb lines of the proposed pavement: paired parallel lines about 6 in apart along every drive aisle, parking bay and island, with rounded returns where one meets another or the street; not striping, not the sidewalk edge, not a screened or lighter existing curb',
},
curb_existing: {
  geometry: 'polyline', posture: 'existing', kind: 'curb',
  layerPatterns: [/EXIST.*(CONC|CURB|PAV)/, /\bEX\b.*CURB/, /V-CONC-LINE/, /V-ASPHALT-LINE/, /\bEOP\b/, /DEMO.*(CONC|CURB)/, /\bX-CURB/, /\bE-CURB/],
  layerExclude: [/TEXT/, /TXT/],
  labelPatterns: [/EXIST(ING)?\.?\s*(CONC(RETE)?)?\s*(CURB|DRIVEWAY|PAV)/, /REMOVE/, /\d+\s*LF/],
  minAreaFt2: null, minLengthFt: 3, tracer: 'polyline',
  demolish: (layer) => /DEMO|REMOVE/.test(layer),
  survey: 'existing curbs and pavement edges, drawn screened or lighter: the street's curb and gutter and edge of pavement, the existing driveways on this lot and the neighbours', and any existing curb marked to be removed',
},
driveway: {                                   // Phase 1b
  geometry: 'polygon', posture: null, kind: 'driveway',   // posture is set by the derivation's condition (D6 step 8), not here
  layerPatterns: [], layerExclude: [], labelPatterns: [/\d+(\.\d+)?'\s*(WIDE|DRIVEWAY|DRWY)/, /\bR\s?\d+/],
  minAreaFt2: null, tracer: null, derive: 'driveway',
  survey: null,                               // never surveyed in the MVP (§10); derived from the two curb entries and the lot
},
```

Why two curb entries rather than one with a posture flag: the layer vocabularies are disjoint by convention (survey base `V-…` and `EXIST` / `DEMO` on one side, design `C-CURB …` on the other), and `curb_proposed`'s exclusion list *is* `curb_existing`'s inclusion list. Both publish `kind: 'curb'`; posture tells them apart in every query. The proposed entry is `curb_proposed`, not `curb` (v3): once a feature has two postures the unsuffixed name stops being a default and becomes a trap, and the suffix is the posture word that lands in the row, so a reader predicts the row from the key. The key never reaches the database, so the rename costs nothing downstream. `building` keeps its bare name as the legacy single-posture entry; renaming it is a follow-up outside this spec. `curb_existing` includes the street's own curb and pavement edge (`V-ASPHALT-LINE`, `V-CONC-LINE`): that is what D5 needs to find the frontage, and TCM's "edge of pavement" is literally that line.

`driveway` has no patterns, no tracer and no survey paragraph: it is **derived** (north star D14) from the other two and the lot, and its posture is whatever condition D6 ran (`existing` or `proposed`), which is why the entry's `posture` is `null` and `FeatureEntry.posture` becomes `Posture | null`. A survey region per driveway (so the readout could count the derivation against what a reader sees) is deferred to §10: one less survey paragraph and region kind for the MVP.

**The primary sheet is per feature, by title pattern, in order.** The sibling confirmed every feature on one primary sheet, the site plan (its D6). The content blocks (§1.3) show that is the wrong sheet for existing curbs on all three sets and the wrong sheet for proposed curbs on one. Each entry carries `primarySheet`, an ordered list of title patterns the picker in `trace.py` tries against the survey's `sheet.title` (role `plan_view` only): `curb_proposed` → `[/DIMENSION(AL)?\s+CONTROL/, /PAVING/, /SITE\s+PLAN/]`; `curb_existing` → `[/EXISTING\s+CONDITIONS/, /DEMOLITION/, /SITE\s+PLAN/]`; `driveway` has no primary sheet, it is derived from both; `building` keeps `[/SITE\s+PLAN/]`. The first pattern with a match wins, and **every sheet matching it is primary** — a set split across a matchline (Lamar + Collier's sheets 8 and 9) is confirmed and registered sheet by sheet, and the registration gate's `edgesCovered` decides whether each half stands on its own. A plan set with no sheet matching any pattern confirms nothing for that feature and the readout says so.

`FeatureTracer` becomes `'closed_ring' | 'polyline' | 'segments' | null`; `FeatureEntry.posture` becomes `Posture | null`; `FeatureEntry` gains `minLengthFt`, `derive`, `edge`, `demolish`, `primarySheet`. `registryJson()` serialises the two functions as their source regexes, so `features.json` (bureau's view) says `edge: {face: "\\bFOC\\b|FACE", back: "\\bBOC\\b|BACK"}`.

### 2.2 The reader keeps the arc

**D2. `pdf_paths.py` emits every cubic Bézier twice: as the eight chords it emits today, and as an `arc` record beside them.** For each `'c'` item: the four control points in page points; a circle fitted by least squares to 17 samples of the curve; `{centrePt, radiusPt, sweepDeg, startPt, endPt, residualPt}`. A Bézier that is not an arc (a spline, a leader's S-curve) has `residualPt > 0.25` and is kept as chords only. The chords are unchanged, so `chain()`, `bridge()` and `ringAreaPt2` behave exactly as today and every S1 fixture of the sibling still passes byte-identical. The arcs ride on the `PathRecord` (`arcs: Arc[]`, `[]` for lines, rectangles and quads).

The tracer carries arcs through onto each chain (D3): a chain's `arcs[]` are the arc records whose chords it contains. `lib/curb.ts groupArcs(arcs, tolPt)` → one `Return` per centre: `{centreFt, radiusFt, sweepDeg, pieces, chainIds}`; radius in feet comes out through the sheet registration like every other length. On sheet 12, 44 face-of-curb Béziers group to 19 centres.

### 2.3 Tracing a polyline feature

**D3. A polyline feature's candidate is a *set* of chains, and the worker's only edit is to remove from it.** `traceFeature` gains the `polyline` branch:

- **Rung 1 (`vector_layer`):** chain the matching layers' segments with the existing `chain` + `bridge` (the dash bridging built for the boundary works unchanged: `BRIDGE_PT = 6`, `BRIDGE_ANGLE_DEG = 10`). Keep open chains and rings alike (a curbed island is a ring). Drop chains shorter than `minLengthFt`. All chains of one layer are **one candidate**, `kind: 'polyline_set'`, ranked 1; a second matching layer (face and back) is a second set ranked by total length. Both are kept (D4 pairs them).
- **Rung 2 (`vector_style`):** when no layer matches, every (layer, style) group becomes a candidate set, ranked by the length of chain inside the region, capped at `MAX_STYLE_CANDIDATES`. This is the common case (§1.3).
- **Rungs 3 and 4** do not apply to a polyline in v1: `handAllowed` refuses with "a line feature has no contour to flood or ring to draw"; a raster sheet's curbs are Q8.

A candidate is `{id, rung, layer, style, kind: 'polyline_set', chains: [{id, pathPt, closed, lengthPt, arcs: [...]}], chainCount, totalLengthPt, edge: 'face' | 'back' | null, rank, why}`. The overlay crop (D13 of the sibling, `crop.ts outline`) draws every chain of the set on the region crop; `outline` already takes one path and gains a list.

The 3.5 worker's answer for a polyline region keeps the sibling's shape (`chosen`, `why`, readings) and adds `labels[]` (D7) and an optional `faceSide` (D4). **In the MVP the worker takes the set whole**: it picks a set or answers `null` with why, and may not add, join, move or draw a chain. Per-chain removal (`exclude: [chainId, …]`, remove-only, refused for a chain outside the set) is the one edit the design allows a worker and it is deferred to §10 (v3): on sheet 12 the face set is 170 chains, a vision worker cannot name chain ids on an overlay that dense, and the readout's unpaired-chain line (D13) is what measures how much noise a whole set lets through before anyone designs the trim.

**An enlarged inset is never inside a feature region.** Lamar + Collier's sheet 17 carries DETAIL A, a second plan of the driveway at 1″ = 20′ beside the 1″ = 30′ site plan. The sheet registration is one similarity per sheet, so a chain traced inside an inset would land at the wrong scale. The survey's paragraph tells the reader to box the main plan view only and to mark an enlarged detail as its own `diagram` region (the preprocessed blocks already do: the inset is a separate block with its own box), and the tracer reads nothing outside the region it is given.

**D4. Face and back are paired in code; the curb's width is measured, not read; on a layer-less sheet the pair is reported, never guessed.** `lib/curb.ts pairEdges(chains)`: for every chain, the chain on the other set (or, on a layer-less sheet, any other chain of the same candidate) that runs parallel within 0.33–1.0 ft for at least 80 % of its sampled length is its partner; a pair is a `Curb {faceChain, backChain, widthFt (median offset), lengthFt (the face's), arcs}`; an unpaired chain is a `Curb` with one edge and `widthFt: null`. On a layered sheet the registry's `edge()` says which is the face. On a layer-less sheet `edge` is `unknown` for every pair, both lines are carried, and every width measure in D6 is reported as the pair **(inner, outer)** — the two differ by exactly the curb width, so a reviewer reading "20.0 / 21.0 ft" knows which to use. §1.4's test is why there is no geometric rule: the best one scores 12 of 17 and the cost of a wrong face is a wrong width. The confirm worker may set `faceSide` from what the drawing shows (the gutter hatch, the side the drive aisle is on), recorded as a reading, never assumed.

**Each edge is its own published row (v3.1).** A curb is one six-inch block with two drawn edges, and every rule that measures to a curb names the edge: TCM's driveway width is face to face, a sidewalk's clear width runs from the back, and the IG report's street-tree offsets came out 3.3–4.0 ft to the back and 3.8–4.5 ft to the face against a 4 ft rule. A PostGIS query cannot pick one part of a MultiLineString by a property, so a figure that merges face and back answers "distance to the curb" with whichever edge is nearer and cannot say which. So `assemble.ts` publishes **one line figure per (set, edge)**: on a layered sheet the face set and the back set are two figures, `edge: 'face'` and `edge: 'back'`, each carrying `pairId` and the pair's `widthFt`; on a layer-less sheet, or for an existing survey line that is neither (`V-CONC-LINE` is the gutter's edge, not a face/back pair), the figure is one row with `edge: 'unknown'` and both lines in it, `widthFt` as the (inner, outer) pair where a pair was found. The `edge` rides into `geo.properties.edge` with `pair_id` and `width_ft` (D10), so a tool asks for the face explicitly and gets `unknown` — never a guess — where the sheet could not say.

### 2.4 The frontage, and the driveway derived from it

**D5. The lot's frontage edges are found by code from the lot and the existing curbs; in Phase 1 nobody names the street (1b).** New pure module `lib/frontage.ts findFrontages({lotRing, existingChainsLotFt})` → for each edge of the lot, the nearest existing-curb chain **outside** the lot that runs parallel to it (≤ 8°) within 3–60 ft for at least half the edge's length: `{edgeIndex, courseIndex, chainId, offsetFt (right-of-way line to pavement edge, sampled), parallelDeg, coverage}`. On White Water that finds three: course 5 at 10.8–11.6 ft (Brezza Lane), courses 3 and 4 at 10.8 ft (the I-35 frontage road), and **course 1 at 11.6 ft — the apartments' parking lot**, which is not a street. Geometry cannot tell a street's pavement edge from a neighbour's. v2 sent a vision worker to read the street name drawn along each candidate; v3 drops it from Phase 1, because Phase 2's D16 answers the same question from the city's street layer with no tokens and a cross-check the worker could not give. So in Phase 1 **every candidate edge is a frontage**, with `street: null`; D6 derives on all of them; a driveway is labelled by its course (*driveway 1 · course 5*); and an opening onto a neighbour's lot is derived like any other and reported as *on an edge with no named street* — which is cross-access, and a thing a reviewer looks at anyway. The frontage is recorded in `frontage.json` at 4.2-assemble, on every derived driveway's trace (D6), and in the readout. Phase 2 joins the city's `streets` segment to each course (D16), names the real streets and marks the rest as non-street edges; the two derivations stay keyed by `courseIndex`, so nothing is re-extracted. What the worker also read — a joint-access label on a side — is carried instead by D7's `note` labels. The two numbers here that no run has yet tested, the 60 ft ceiling and the half-edge coverage, are in §10.

**D6. A driveway is a derived figure — the polygon bounded by the right-of-way line, the two curb faces that cross it, and the throat line — derived twice, as the existing condition and the resulting condition, with its measures computed once each, in lot feet, by code (1b).** New pure module `lib/driveway.ts deriveDriveways({frontages, curbs, lotRing, condition})`, run by `assemble.ts` after the curb figures are registered and before placement:

1. **Crossings.** Every curb face in the condition's chain set that crosses a frontage course, or ends within 1 ft of it, with its station along the course and whether it runs into the lot. Two collapses before anything is paired (v3): a `Curb` pair's two chains (D4) cross as **one** crossing — at the face when the edge is known, else carried as an (inner, outer) station pair — and two crossings of the same side within 1 ft of each other are one (the 170 chains on sheet 12 are broken by labels, so a chain that ends at the right-of-way and its continuation both arrive at the same station).
2. **Openings.** Successive collapsed crossings 8–60 ft apart with no third between them are one opening; an unpaired crossing is reported and makes no figure. The opening's `widthAtRowFt` is the gap between the two faces on the right-of-way line (`SAC-03`'s number).
3. **Returns.** On each edge, the arc within **60 ft** of the right-of-way (Table 7-1's largest radius is 50, and an R-50 return reaches 50 ft in from the line; v2's 40 ft would have missed it) whose circle is tangent to the street's pavement edge (centre-to-chain distance = R ± 0.5 ft) is the return: `returnRadiusFt.left / .right` (Table 7-1's number). No arc → a **flare**: the straight segment from the crossing to the first vertex where the face turns parallel to the axis, with its angle to the right-of-way line. The return's far end is its point of tangency with the throat; a flare's far end stands in for a tangency point it does not have (v3).
4. **The throat.** The line across the driveway at the farther of the two points of tangency; `throatWidthFt` there, face to face (Table 7-2's number).
5. **Angle.** Between the driveway axis (right-of-way midpoint → throat midpoint) and the street's pavement edge; 90 is perpendicular (7.5.1.3).
6. **Throat depth.** From the right-of-way line along the axis to the first **curb chain** crossing it, in the condition's chain set (Table 9-5's "first interruption"); `null` when nothing crosses within 200 ft. Striping is not a Phase 1 feature, so the measure carries `throatDepthBasis: 'curb'` and the readout says so; a `striping` registry entry would widen the basis later with one line.
7. **Side lot lines.** Whether either return's arc crosses the projection of the lot's side course beyond the right-of-way (TCM 7.6.2(D)); `sideLineClear: true | false | 'shared'` — `shared` when a D7 `note` label matching `/JOINT\s+(ACCESS|USE)/` lies within 20 ft of that side's crossing (White Water's *CALLED 0.0565 ACRES JOINT ACCESS EASEMENT*), read by the curb region's confirm worker, not by a frontage worker (v3).
8. **Two conditions, two figures.** The derivation runs twice over the same frontage. The **existing condition** takes existing chains only, demolition flags ignored: what is there today, posture `existing`. The **resulting condition** takes the existing chains **clipped** by the demolition and every proposed chain (v3: a clip, not a per-chain flag — a demolition sheet draws the stretch to remove on its own layer, and the existing layer under it usually still draws the whole curb, so dropping only the chains *on* the demolition layer would leave the removed stretch standing; every existing chain loses the portions that run within half a curb width + 0.5 ft of a `demolish` chain for 3 ft or more, and a chain inside a removal ring such as `C-IC EXIST PAVING` is dropped whole): what will be there, with `trace.edges[]` naming each edge's figure, chain and whether it is `retained` or `new`. **The resulting row's posture is computed from its edges (Q14, v3.4): `existing` when every edge is retained, `proposed` when any edge is new.** So `condition` answers *what will be there* — the question a code-compliance rule asks, Table 7-4's count per frontage and Table 7-2's width apply to the finished site, kept driveways included, and LDC 25-6-321 can require a kept nonconforming one to conform — and `posture` answers *what is being built* — the question a submittal or permit requirement asks: CC-22-13's *is the width dimensioned* attaches to the applicant's work, and a right-of-way sweep wants new aprons, not kept ones. An unchanged driveway yields two rows with the same measures, both `existing`, which says *retained* in the column every query filters on first; a driveway removed outright appears in the existing condition only; a wholly new one in the resulting condition only, `proposed`; an expanded one in both, `existing` then `proposed`, and the difference between the rows *is* the alteration. Both rows carry the same `frontage` and `stationFt`, so a query lines them up. No `altered` or `resulting` posture is needed (Q2, Q3, Q14 resolved). The resulting condition trusts the demolition callouts to be complete: a proposed return drawn over an existing curb with no removal callout pairs wrongly, and the readout's unpaired-crossing line is what catches it. Whether White Water's existing-concrete layer redraws the removed 84 LF was **Q13**, measured 2026-10-20 (`spike/probe8.py`): it does not — the two `C-DEMO CONC` chains (86.0 / 84.7 ft) lie 0 % within 0.25–1.5 ft of `C-EXIST CONC` (155 ft, all of it elsewhere on the sheet) and 0.6–3.5 % within the same bands of `V-CONC-LINE` (the crossing points only). The stretch to remove is drawn once, on the demolition layer, so on this set dropping the `demolish` chains *is* the clip; the clip rule stays for the sets that redraw, and S3's synthetic expansion fixture is what exercises it.
9. **The polygon.** Right-of-way segment → right face to the throat → the throat line → left face back, in lot feet; its area; `vertex 0` at the right-of-way's left crossing.

**Stations** (v3, stated once): a station is feet along the frontage course from the course's **start vertex** in the ring's walking order (course *k* runs from vertex *k − 1* to vertex *k*, the mete convention), so *left* and *right* are the walker's. Both conditions, both labels and Phase 2's context rows use the same number.

The figure: `{id, readingMethod: 'derived', kind: 'driveway', posture, label: "driveway 1 · course 5", sourcePages, trace: {method: 'derived', rule: 'driveway/1', condition: 'existing' | 'resulting', from: [curb figure ids], frontage: {courseIndex, street: null, offsetFt}, stationFt: [a, b], measures: {widthAtRowFt, throatWidthFt, returnRadiusFt: {left, right}, flare: {left, right}, angleDeg, throatDepthFt, throatDepthBasis, sideLineClear}, edges: [{figure, chainId, posture, retained}], labels: [...]}}` (D8). Every number is a function of two traced figures and one walked course; none is a reading.

On White Water (measured 2026-10-19): the existing condition has **one** opening on course 5 at stations 77.8–111.0, `widthAtRowFt` 33.2; the resulting condition has the **same** opening at the same width with **both edges retained**, because the 84 LF of curb marked for removal begins 24.4 ft inside the lot at the sawcut and the apron's two edges stay; the proposed `R28.0'` and `R20.0'` returns sit inside the throat and change only `throatDepthFt` between the two rows; the west edge is `sideLineClear: 'shared'` (the joint access easement note on sheet 12). So the sheet proposes **no change to the opening at the right-of-way line** and an altered throat behind it — the finding a reviewer wants handed over (a retained 33.2 ft opening; LDC 25-6-321), and Phase 1b's acceptance (§7.1b) is that the run says exactly that. Two honest limits of the fixture: the opening's edges are straight apron chains, so `returnRadiusFt` at the right-of-way is null on both sides and the radius path of step 3 is exercised by S3's synthetic fixture only until a second real set is on disk; and `throatDepthFt` changing between the rows depends on the clip in step 8 (Q13).

**D7. Printed dimensions are checks, never sources.** The sibling's D8 pattern, applied to every label the confirm worker reads (`labels[]`: verbatim, crop, location, parsed `{kind: 'radius' | 'width' | 'length' | 'note', valueFt}`): `assemble.ts` matches each parsed value to the nearest derived number of its kind inside the region — a radius to the nearest return centre, a width to the nearest opening, a length (`84 LF`) to the nearest chain — and the readout prints **agrees / disagrees / unlabelled** per measure at 0.1 ft. A `note` label is kept verbatim with its location; D6 step 7 reads a joint-access note from it. In Phase 1a the radius and length checks run; the width check has nothing to match until 1b. White Water: `R20.0'` / `R25.0'` / `R28.0'` against 20.02 / 25.02 / 28.02 (agree); `84 LF` against 86 / 85 (disagrees by 2 ft; the note rounds, the chain does not).

### 2.5 The figure model and the schema

**D8. `reading_method` gains `derived`, and the trace says what it was derived from (schema in P0; first written in 1b).** `cartographer_geometries.reading_method` CHECK `mete | traced | derived`; the completeness CHECK's second arm becomes `reading_method IN ('traced','derived') AND mete IS NULL AND trace IS NOT NULL`; `TRACE_METHODS` gains `derived`; `figureSchema` becomes a three-way union on `readingMethod` with `derivedFigureSchema` (strict: no `pathPt`, no `courses`; `trace.from` non-empty; `trace.condition` required; `trace.measures` by rule). The rule name (`driveway/1`) is versioned in the trace so a second derivation can tell the first's rows from its own.

**D9. Lines enter the figure through an expand-only change: a `geometry` column beside `polygon`.** D18 of the sibling named the seam (§6.4) and the shape (expand → migrate → contract). Phase 1 does the **expand** and as much of the migrate as its own readers need:

| column | change |
|---|---|
| `geometry jsonb` | **new**, `NOT NULL` after backfill: a GeoJSON geometry in frame feet — `Polygon` (rings closed, vertex 0 at the origin as today) or `LineString` / `MultiLineString` (the chains, first vertex at the origin) |
| `polygon jsonb` | `NOT NULL` → **nullable**; CHECK `(polygon IS NOT NULL) = (geometry->>'type' IN ('Polygon','MultiPolygon'))`; written for every polygon figure exactly as today, so nothing that reads `polygon` breaks before it is migrated |
| `closed boolean` | unchanged in type; on a chain set `true` only when every chain is a ring (a set of curbed islands), else `false` (v3) |
| `computed_area_sqft` | `null` on a line |
| `has_approximated_curves` | `true` when `trace.arcs` is non-empty — the stored vertices are chords; the arcs are in the trace, which is what the column has always meant |

No `length_ft` column (v3): v2 had one as the line analogue of `computed_area_sqft`, and nothing reads it — D12 takes `st_length(geom_local)` from `geo`, the readout reads the run's artifact, and `/geometry/[id]` sums the GeoJSON in a few lines; the reviewer's "LF" is printed from those. The migration backfills `geometry` from `polygon` for the 14 rows in prod in the same transaction that adds the column; `NOT NULL` is set by P1b once the writer is live (§6). Readers migrate in P1: `frames.ts ringInFrame` → `geometryInFrame`, `traced.ts`, `publish.ts` (writes both), `/geometry/[id]` (draws paths and rings). The **contract** (dropping `polygon`) is its own spec, after every reader is on `geometry` (Q12).

Evidence (`cartographer_geometry_evidence`): the `trace` role row of a line figure carries `value = {rung, chains, lengthPt, edge, pairId, arcs: [{radiusPt, sweepDeg, centrePt}]}` and cites the set's overlay crop; a `label` row per printed dimension (source kind `marker`, as today); and a new role **`derivation`** for a derived figure: `value = {rule, condition, from, measures}`, `bbox` the apron's box, `crop_id` an overlay of the derived polygon drawn on the region crop (`crop.ts outline` with the derived ring, the same op).

**D10. `geo` needs no DDL for a line; the RPC needs one more branch.** `geo.geom_local` is untyped and `geom_wgs84` is `geometry(Geometry, 4326)`. `sir_put_anchored_geo` keys its validation on the payload's GeoJSON type: `Polygon | MultiPolygon` → today's path (`st_collectionextract(st_makevalid(g), 3)`, polygon-or-refuse); `LineString | MultiLineString` → `st_collectionextract(st_makevalid(g), 2)`, line-or-refuse; anything else refused as today. `kind` carries `curb` / `driveway`; `posture` carries `existing` for the first time; `properties.edge` (`face` / `back` / `unknown`), `properties.pair_id` and `properties.width_ft` ride on every curb row (D4); `properties.trace_method` carries `derived`; `properties.condition`, `properties.station_ft` and `properties.measures` carry D6's numbers so a query can read them without joining back to cartographer (they are frame-exact and do not change on the grid); the `source_*`, `labels`, `sheet_extent_ft` and `feature_key` fields of D23 ride the same way. The RPC copies a **named list** of payload fields into `properties` (today it writes `trace_method` by hand; the list replaces the hand-writing), so a field the publisher does not send is absent, never null. `computed_area` (generated, geography) is 0 for a line and stays as it is.

### 2.6 The anchor run carries lines

**D11. A line figure rides the frame and is claimed against nothing: one new relation, `carried` (1a for the curbs; a derived driveway rides the same relation in 1b).** `InputFigure` (`anchor-geometry/scripts/lib/contracts.ts`) gains `geometryType` and its `ring` becomes `coords`; `buildAnchorInputs` and `fitSets` use only `Polygon` figures with `same_as` / `union_of` (as today: `within` is skipped, and so is `carried`); `anchorFrame` transforms every figure's coordinates (it already transforms the `within` and unmatched ones, `anchor.ts:181`); `toGeoJsonPolygon` gets a sibling `toGeoJsonLine`, chosen by type. `2.1-correspond`'s contract enum becomes `same_as | union_of | within | carried`; its prompt says a `curb` or `driveway` figure is `carried`: placed by the frame's transform, never a fit target, and — unlike `within` — making no claim about the parcel ring, because the street's curb is outside it and a driveway straddles its line. `1.2-fetch` reads `geometry`, not `polygon`, and passes `geometryType`, `posture`, `reading_method` through. `3.2-render` draws lines in the posture colours (proposed solid, existing lighter, the derived driveways filled, the resulting condition over the existing); `3.3-check` asks one more question — *does the existing street curb run parallel to the lot's frontage edge at the offset the sheet gives, and does each derived driveway sit on that edge where the sheet draws it?* — and quotes nothing it computed. `5.1-publish` passes `geometryType`, `posture`, `trace_method`, `condition`, `station_ft` and `measures` per figure.

### 2.7 The on-site payoff

**D12. Phase 1's payoff is a set of queries that need only this file's rows, and they are its acceptance test.** The curb queries (feet by posture, every radius) are 1a's (§7.1a); the driveway queries are 1b's (§7.1b). With the rows of §7.1 in `geo`:

```sql
-- every driveway, existing condition beside resulting condition (what will be there);
-- add `and r.posture = 'proposed'` for what is being built (Q14)
select e.label, e.properties->>'station_ft' as station, r.posture as resulting_posture,
       e.properties->'measures' as existing, r.properties->'measures' as resulting,
       r.properties->'trace'->'edges' as edges
from geo e join geo r on r.properties->>'anchor_id' = e.properties->>'anchor_id'
  and r.kind = 'driveway' and r.properties->>'condition' = 'resulting'
  and r.properties->>'station_ft' = e.properties->>'station_ft'
where e.kind = 'driveway' and e.properties->>'condition' = 'existing';

-- feet of curb by posture, and every return radius
select posture, properties->>'edge' as edge, round(sum(st_length(geom_local))::numeric) as curb_ft from geo
where file_id = :file and kind = 'curb' group by 1, 2;
select label, posture, properties->>'radius_ft' as r, properties->>'sweep_deg' as sweep, properties->>'source_pages' as sheet
from geo where file_id = :file and kind = 'curb_return' order by r desc;

-- the return stays inside the lot (TCM 7.6.2(D)): the derived driveway against the parcel's side edges
select d.label, d.properties->'measures'->>'sideLineClear' as clear,
       round(st_distance(d.geom_local, st_exteriorring(l.geom_local))::numeric, 2) as to_lot_line_ft
from geo d join geo l on l.properties->>'anchor_id' = d.properties->>'anchor_id' and l.kind = 'parcel' and l.method = 'anchored'
where d.kind = 'driveway';
```

The readout prints each measure beside the TCM row it belongs to, for every Street Level, and says which Level applies only when the sheet states it — looking the Level up is Phase 2 (D18). Every number carries `trace_method` (`vector_layer` / `vector_style` / `derived`) and the anchor's `accuracy_class`: *"33.2 ft at the right-of-way line, vector, ring fit"*.

### 2.8 The readouts

**D13. The extract readout gains a curbs-and-driveways section; the anchor readout gains the per-driveway table.** `6.1-readout` (extract): per feature region — the set chosen, pairs found and unpaired chains, feet of curb by posture, every return with its radius and its label check (D7); per frontage (1b) — the course, the offset to the pavement edge, the street (`null` until Phase 2), the openings derived in each condition with their measures and the diff between conditions, and the unpaired crossings, in words; and, loudly, *no frontage found* when `findFrontages` returns nothing, since every driveway depends on it. The anchor readout (`3.3-check` writes it): the D12 numbers as a table with the honesty labels.

### 2.9 Hand-off from preprocessing

**D14. Same as the sibling's D19: read the upload's `source.pdf`, never a split sheet.** The arcs survive Ghostscript as Béziers (verified on White Water: `optimized.pdf` and `sheets/12.pdf` keep 16,479 paths), the layer names do not. For curbs that is a rung-1 loss, which is what rung 2 is for.

### 2.10 What a tool can select, and what it can cite

The IG report (§1.2's sizing) collapses the geometry a formal review needs into seven agent tools — *measure, relate, zone_overlap, dimension, consistency, surface, route* — plus site-wide sweeps, and every one of them starts the same way: select the rows that are the feature the comment names, then compute, then cite. The completeness check asks a different question of the same rows: not *how wide* but *is the width dimensioned*, and *does the sheet show the neighbours within 300 ft*. D23 shapes the rows for both readers. It adds no step, no worker and no DDL (`geo.properties` is free-form); it changes what the publishers write and expands two things the run already computes into rows of their own.

**D23. Every published row says what it is, where it came from and what it was checked against, in names a tool can select by (1a; the frontage row and width verdicts in 1b).**

1. **Source fields on every anchored row.** `properties.source_pages` (the sheet numbers), `properties.source_figure_id` (the `cartographer_geometries` row it was published from) and `properties.source_crop_id` (the trace evidence's overlay crop). Today's payload (`frames.ts anchoredGeoPayload`) carries label, kind, geometry, posture and `trace_method`; the figure knows its pages and its evidence, and the last hop drops them. With the three fields a tool result reads *"33.2 ft, sheet 12, vector, ring fit"* and links the overlay, because the row knows all four. Named `source_*` to match `source_doc`, `source_pages` and Phase 2's `source_layer` / `source_vintage`.
2. **A `curb_return` row per grouped arc.** The anchor publish expands each curb figure's `trace.arcs` (D2, grouped by centre) into one `geo` row: `kind: 'curb_return'`, the arc as a LineString chorded at a stated tolerance (`properties.chord_tol_ft`), `properties: {radius_ft, sweep_deg, centre, pt_start, pt_end (GeoJSON points), edge, pair_id, source_*}`, posture from the curb, `feature_key` from the curb's plus the arc's index. Returns are the layer the report ranks fifth, and its one non-PostGIS operation is the radius fit; TCM 7.6.2(C) measures the inlet clearance to the **point of tangency**, which a polygon row cannot give and `pt_start` / `pt_end` can (D20 is corrected to use it). The cartographer side keeps the arcs in the trace as D9 says; the expansion happens only in the table the tools read.
3. **A `frontage` row per candidate course (1b; Q4 reversed).** `findFrontages` (D5) already produces the course, the pavement-edge chain and the offset; `assemble.ts` publishes each as a derived figure (`readingMethod: 'derived'`, rule `frontage/1`, `trace.from: [lot figure, existing-curb figure]`, no `condition` — D8's `condition` is required by rule `driveway/1` only) whose geometry is the course as a LineString, and the anchor run carries it. `properties: {course_index, street: null, offset_to_pavement_ft, pavement_edge_figure_id, coverage, parallel_deg}`. The report's A-tier cluster is the frontage strip — building face to curb, clear width, tree spacing, setback lines offset from the right-of-way — and every one of those needs the frontage as a line to measure from or offset (`ST_OffsetCurve`, the report's #19). Phase 2's D16 writes `street`, `street_class`, `street_level` and `level_source` onto this row by `course_index` instead of inventing its own, and D19's context rows reference it.
4. **Label verdicts on the row.** D7's agrees / disagrees / unlabelled is published, not only printed: `properties.labels = {<measure>: {status, printed_ft, computed_ft, crop_id}}` — on a `curb_return` row the radius, on a curb row the length, on a driveway row the width at the right-of-way, the throat width and each return. *Unlabelled* is the completeness check's CC-22-13 (*spacing, widths, radii and opposing offsets dimensioned?*) answered per measure, with the crop of the label when there is one.
5. **The survey base's reach past the lot.** §1.3 measures how far the sheet's existing linework extends beyond the lot line per side; `assemble.ts` publishes it on each `curb_existing` figure as `properties.sheet_extent_ft: {w, n, e, s}` (the figure's own sheet, in lot feet). CC-22-14 asks whether adjacent driveways within 300 ft are shown; *"the survey base ends 12–35 ft past the lot on every side"* is the deterministic answer, before any vision looks for a neighbour's apron.
6. **A deterministic `feature_key`.** `properties.feature_key = '<feature>/<sheet>/<set>[/<edge>][/<n>]'` (`curb_proposed/12/FOC`, `curb_proposed/12/FOC/return-7`, `driveway/12/course-5/1`, `frontage/7/course-5`), the same on every republish. `geo` rows are deleted and re-inserted on publish, so a row id a comment cited last week is gone this week; the key is what a comment cites and what a sweep diffs across runs.
7. **The `kind` vocabulary this spec introduces.** `geo.kind` is free text (C8) and the report's *feature layers by demand* is a ready-made controlled list. The values written by this spec, in one place, so a tool never guesses a spelling:

   | kind | geometry | phase | what |
   |---|---|---|---|
   | `curb` | MultiLineString | 1a | a curb's edge; `edge: face \| back \| unknown`, `posture` proposed \| existing |
   | `curb_return` | LineString | 1a | one return arc; radius, sweep, tangent points |
   | `frontage` | LineString | 1b | a lot course that faces a pavement edge; `street` null until Phase 2 |
   | `driveway` | Polygon | 1b | the apron between right-of-way and throat; one row per condition |
   | `driveway_opening` | LineString | 2 | a paved-area / paved-road boundary from the city's layer |
   | `curb_inlet` | Point | 2 | from the city's layer |
   | `right_of_way` | Polygon | 2 | from the city's layer (the value exists in prod already) |

   The north star's vocabulary note (its D14) should carry this table; a CHECK on `kind` waits until the list stops growing.

What D23 deliberately does **not** store: **code references.** Which TCM table a width is held to depends on the street's Level, the use and the jurisdiction, and is the review guide's reading, not the geometry's; the report's own caveat is that *the tool hardens the measurement, not the interpretation*. Keeping the rule off the row is what lets one curb row serve Transportation, Fire and the completeness check without three copies. Nor does it publish the non-primary sheets' traces as figures (the *consistency* tool's input — the curb on sheet 13 against sheet 12): 3.4 traces every sheet for free and the run artifact keeps them, which is enough until that tool exists (§10).

---

## 3. Phase 2 — adjacent driveways and curbs, from off the sheet

Blocked by Phase 1b's acceptance (§7.1b): every query below joins to the rows Phase 1 publishes. Phase 2 adds no reading of the sheet and no change to the extract runbook.

### 3.1 Where the layers are registered

**D15. The jurisdiction's frontage layers are found through surveyor's layer-identity registry, by role, and Phase 2 tags Austin by hand.** `src/lib/gis-layer-identity.ts` `LayerRole` gains `streets`, `street_levels`, `paved_areas`, `sidewalk_inventory`, `curb_inlets`, `right_of_way`, `orthoimagery`, each with the `fields` the role needs (`streets: {name: FULL_STREET_NAME, class: ROAD_CLASS, speed: SPEED_LIMIT}`; `street_levels: {name: NAME, level: STREET_LEVEL}`; `paved_areas: {feature: FEATURE, origin: ORIGIN_FEATURE_CLASS, source: SOURCE}`; `sidewalk_inventory: {type: PEDESTRIAN_FACILITY_TYPE}`; `right_of_way: {document: DOCUMENT_ID}`; `orthoimagery` records the `ImageServer` URL and its pixel size). `src/sources/coa-gis/layer-identity.json` tags the seven Austin layers of §1.5. This is the registry the anchor fetch already reads for `parcels` (winston#309 D6), so the frontage step reads roles the same way and never a layer's name. A jurisdiction whose module carries none of these roles is "not tagged", which the step distinguishes from "this city has no such layer" by a `none` record per role, so the absence is written, not assumed. Making prospector tag these roles for every newly trained jurisdiction, and backfilling the 126 modules that today carry no role at all (not even `parcels`), is its own spec (D22).

### 3.2 The frontage context

**D16. A new script step in `anchor-geometry`, `1.3-frontage`, fetches the 300 ft context of every frontage from the registered layers, and names the street on Phase 1b's `frontage` rows (D23).** Zero tokens; runs after `1.2-fetch` (it needs only the parcel ring and the target SRID, both of which fetch wrote on either path) and before `2.1-correspond`; tolerates "not found" the way `arcgis_query.py` does — a layer that fails is an error in the file, a layer that answers nothing is recorded as nothing, and a jurisdiction with no tagged roles writes `frontage/none.json` with the reason and the run continues (T8). Per frontage of the parcel ring (a `streets` segment within 60 ft of an edge and parallel to it — the same test D5 runs on the sheet, now with the city's own line; a frontage the sheet's worker named that no segment matches, or the reverse, is a line of its own in the readout), the step writes `frontage/<n>.json`: the street's name, class, speed and Level (D18); the openings on this side and the opposite side within 300 ft of the frontage's ends (D17); the `sidewalk_inventory` driveway segments within the window, as a cross-check; `curb_inlets` within 300 ft, as points; the `right_of_way` polygon(s) touching the frontage, when the layer has one; and one orthoimagery tile (`exportImage` with `bbox` = the frontage grown 300 ft along and 150 ft across, `imageSR` = the target SRID, 6 in pixels, with its world file) — the georeferenced picture `3.2-render` draws the overlay on and `3.3-check` looks at, never a source of coordinates in Phase 2 (Q7).

**D17. An opening is the boundary where a paved area meets the paved road, and the window is 300 ft.** Every `paved_areas` polygon of class `Pavement`, `Paved Parking` or origin `Driveways` whose boundary comes within 3 ft of the `Paved Road` polygon's boundary; the shared stretch is the opening — its length (the width at the curb), its station along the street, its centroid, its side (`same` or `opposite`), whether it lies on the subject parcel (`on_subject`, from `EXTERNAL_tcad_parcel` at the opening's inner point), and `{source_layer, object_id, source_vintage}` from the polygon's own `SOURCE`; openings shorter than 8 ft are dropped as noise. The window is **300 ft** because that is the City's own requirement: the DSD site plan requirements page ("Adjacent driveways within 300 feet", p.17) and the CC Submittal Checklist p.5, both pinned verbatim in `completeness-check/v2.7-trimmed/source-citations.json` for `CC-22-14`; the TCM states no window, and the review guide's 200 ft (`SAC-04`) is marked there as a convention (Q6, resolved; the review-guide convention should move to 300 ft, a bureau follow-up outside this spec).

**D18. The Street Level is looked up, never defaulted.** The ASMP layer carries every Level, 29,256 Level 1 segments included, so a street absent from it is *absent*, not Level 1 — Brezza Lane is absent and the city's street-segment layer classes it `A45 City Collector`. TCM Appendix A defines Street Level as "classification of roadways identified in the ASMP Street Network Map", and `SAC-01` records an absent Level as unresolved rather than inferred. So: `street_level` is the ASMP segment's Level when one lies within 60 ft and parallel, else `null` with `level_source: 'absent from ASMP'`; the street-segment class name is carried beside it; and every Table 7-5 comparison on a `null` Level is reported as **unresolved**, with the class as the hint a person needs (Q10, resolved).

**D19. Publish writes the context rows beside the anchored figures, through a second RPC keyed by the anchor alone.** `cartographer_put_context_geo(p_anchor_id, p_features)` (cityhall-new) writes one `geo` row per opening, inlet and right-of-way polygon with `method: 'city_gis'`, `posture: 'existing'`, `kind: 'driveway_opening' | 'curb_inlet' | 'right_of_way'`, and `properties: {anchor_id, source_layer, object_id, source_vintage, accuracy_class: 'digitized', frontage, street, street_class, street_level, level_source, side, on_subject}`. It reads no SIR, project or submission; the anchored figures and their context share an `anchor_id`, which is what makes D20 a join, and `cartographer_mark_anchors_stale` flags them together. Why a second RPC rather than a branch in `sir_put_anchored_geo`: that function stamps `method: 'anchored'` and the anchor's `accuracy_class` on every row, and a context row has neither; two short functions with one honest signature each beat one with a mode flag (Q9, resolved).

### 3.3 The adjacency payoff

**D20. Phase 2's payoff is the join on `anchor_id`, with two honesty labels, and it is Phase 2's acceptance test.**

```sql
-- spacing to every opening on the same frontage, inside edge to inside edge (TCM Table 7-5)
select d.label, o.properties->>'street' as street, o.properties->>'street_level' as level, o.properties->>'level_source' as level_source,
       round(st_distance(d.geom_local, o.geom_local)::numeric, 1) as spacing_ft,
       o.properties->>'accuracy_class' as theirs, d.properties->>'trace_method' as ours
from geo d join geo o on o.properties->>'anchor_id' = d.properties->>'anchor_id'
where d.kind = 'driveway' and d.properties->>'condition' = 'resulting'
  and o.kind = 'driveway_opening' and o.properties->>'side' = 'same' and o.properties->>'on_subject' = 'false'
order by spacing_ft;

-- the nearest curb inlet to a return's point of tangency (TCM 7.6.2(C), 10 ft) — D23's curb_return rows
select r.properties->>'feature_key' as return_key,
       min(least(st_distance(st_geomfromgeojson(r.properties->>'pt_start'), i.geom_local),
                 st_distance(st_geomfromgeojson(r.properties->>'pt_end'), i.geom_local))) as inlet_to_pt_ft
from geo r join geo i on i.properties->>'anchor_id' = r.properties->>'anchor_id' and i.kind = 'curb_inlet'
where r.kind = 'curb_return' and r.posture = 'proposed' group by 1;

-- the count per frontage, this lot plus the neighbours (TCM Table 7-4)
select o.properties->>'street' as street,
       count(*) filter (where o.properties->>'on_subject' = 'true') as on_this_lot, count(*) as on_the_frontage
from geo o where o.properties->>'anchor_id' = :anchor and o.kind = 'driveway_opening' and o.properties->>'side' = 'same' group by 1;
```

plus the opposing-driveway offset — TCM 7.6.3(B) reads *"a minimum of 80 ft. apart measured from the throat edge of an intersecting driveway and the throat edge of the opposite intersecting driveway"*, an along-street gap between near edges, so both throat edges are projected onto the `streets` centreline and the gap taken there; no right-of-way polygon is needed (Q11, resolved) — and the corner clearance (the opening to the intersecting `streets` segment's pavement edge). The site's own existing driveway appears from both sources — the sheet's `driveway` row at 0.01 ft and the city's `driveway_opening` with `on_subject: true` at ±2 ft — and their agreement is Phase 2's first check. Every readout carries both labels: *"33.2 ft at the right-of-way line, vector, ring fit"* on our side and *"a 2023 digitized opening, about ±2 ft"* on theirs (north star §9.4); a spacing computed between the two is a ±2 ft number and says so.

**D21. The anchor run's render, check and readout gain the frontage.** `3.2-render` draws the context rows outlined and the overlay over the orthophoto tile; `3.3-check` asks two more questions — *do the existing curb lines sit on the aerial's curbs, and does each driveway opening sit on an apron in the aerial?* — told that leaf-off 2021 imagery and a 2026 plan set will disagree wherever the site changed; the readout adds a per-frontage table: street, class, Level and its source, openings on each side with widths and stations, inlets, the right-of-way polygon, and the D20 numbers with both labels.

### 3.4 Beyond Austin

**D22. Generalising the roles is prospector's job and its own spec.** Phase 2 ships with Austin tagged by hand (D15). The follow-up spec gives `verify-layer-identity --screen` a role proposer (heuristics from layer name, geometry type and field domains: a polygon layer whose `FEATURE` domain holds road and driveway classes → `paved_areas`; a polyline layer with street-name and class fields → `streets`; a point layer named inlet → `curb_inlets`; proposals only, never written without confirmation), requires prospector's `sources/2-work` step and contract to tag `parcels` on every shipped GIS module and the frontage roles where the jurisdiction publishes them, and runs a one-time confirmed backfill over the existing modules — which also unblocks SIR-free anchoring outside Austin. Where a jurisdiction has no paved-area layer, the orthophoto is the only source and reading openings off it by vision is Q7.

---

## 4. The change, piece by piece

### 4.1 The extract runbook (Phase 1 only)

```diff
 extract-geometry-v2                                       1a = curbs · 1b = driveways
   1.1-inputs                 request.json              unchanged
   1.2-fetch                  source.json, features.json  1a: features.json carries curb_proposed, curb_existing (edge / demolish as regexes); 1b: + driveway (D1)
   1.3-classify               document.json             unchanged
   2.1-survey/page            survey.json               1a: + the two curb survey paragraphs, from the registry; no driveway regions (D1, §10)
   2.2-plan                   regions.json              unchanged (keeps every registered feature kind)
   3.1-transcribe/region      transcript.json           unchanged
   3.2-inventory              figures.json, calls.json  unchanged
   3.3-order/figure           order.json                unchanged
   3.4-trace                  traces.json, ws/          1a: polyline sets per curb region, arcs on every chain, one overlay per set (D2, D3)
   3.5-confirm/region         confirm.json              1a: + labels[], faceSide? for a polyline region; the set is taken whole (no exclude[], §10); the roster is per feature's primary sheet (D1, D3, D4, D7)
   4.1-merge                  raw-artifact.json         unchanged (mete figures only)
   4.2-assemble               ws/artifact.json          1a: assemble.py appends curb figures; assemble.ts registers them, pairs edges, groups arcs, checks radius and length labels. 1b: + finds frontages, derives both conditions, checks width labels (D4–D7)
   5.1-place-claims           claims.json               unchanged (tolerates derived figures as it does traced, bureau#2148)
   5.2-place-solve            placement.json            1a: sheet_registration edge per curb figure; 1b: a derived figure takes its parents' frame (D6)
   6.1-readout                readout.md                1a: + curbs section; 1b: + frontages and driveways (D13)
   6.2-hitl                   decision.json             unchanged
   7.1-publish                                          1a: geometry, lines; 1b: reading_method derived, derivation evidence (D8, D9)
```

The 3.4 roster is every `feature` region of a tracer-bearing kind on every sheet; 3.5's roster is each feature's primary sheet's regions (D1: the site or dimension-control plan for `curb_proposed`, the existing-conditions or demolition plan for `curb_existing`). No step is added and no fan-out gains an item (v3: the frontage item is gone). On a plat every roster is empty and S5 (a) is byte-identical.

### 4.2 Cartographer

```diff
 cartographer/
 ├── src/lib/features/registry.ts        1a: + curb_proposed, curb_existing; FeatureTracer + 'polyline' | null; minLengthFt, edge, demolish, primarySheet. 1b: + driveway, derive; posture nullable (D1)
 ├── src/lib/geometry/
 │   ├── sheet.ts                        unchanged (a curb registers like a building)
 │   └── placement.ts                    1b: + a derived figure's frame = its parents' (D6)
 ├── runbooks/extract-geometry/scripts/
 │   ├── lib/pdf_paths.py                + arc records beside the chords (D2)
 │   ├── lib/trace.ts                    + the polyline branch: sets, minLengthFt, arcs on chains, rung 2 by style; handAllowed refuses lines (D3)
+│   ├── lib/curb.ts                     pairEdges(), groupArcs() (D2, D4)
+│   ├── lib/frontage.ts                 1b: findFrontages() (D5)
+│   ├── lib/driveway.ts                 1b: deriveDriveways(condition): collapse + dedupe crossings, openings, returns, throat, angle, depth, side lines, the demolition clip, polygon (D6)
 │   ├── lib/evidence.ts                 1a: traceSchema takes a chain set; 1b: figureSchema → 3-way union; derivedFigureSchema; TRACE_METHODS + derived; + role derivation (D8, D9)
 │   ├── lib/traced.ts                   deriveTraced() handles a LineString set; has_approximated_curves (D9)
 │   ├── trace.ts                        `carto trace feature` on a polyline entry (D3)
 │   ├── crop.ts                         `outline` takes a list of paths (D3)
 │   ├── assemble.ts                     1a: curb figures → pairs → arcs → radius/length label checks; 1b: → frontages → both conditions → width checks (D4–D7)
 │   ├── place.ts                        1b: derived figures (D6)
 │   └── publish.ts                      1a: geometry + polygon, labels, sheet_extent_ft, feature_key; 1b: reading_method derived, derivation evidence, frontage figures (D9, D23)
 ├── runbooks/anchor-geometry/scripts/
 │   ├── lib/contracts.ts                InputFigure.geometryType, coords; relation + carried (D11)
 │   ├── lib/frames.ts                   geometryInFrame(); toGeoJsonLine(); fitSets ignore carried (D11)
 │   ├── fetch.ts                        reads geometry, not polygon (D9, D11)
 │   ├── render.ts                       lines by posture; Phase 2: over the ortho tile, context rows outlined (D11, D21)
 │   ├── publish.ts                      1a: by geometry type; source_pages / source_figure_id / source_crop_id; one curb_return row per arc; 1b: condition, station_ft, measures, frontage rows; Phase 2: cartographer_put_context_geo for frontage/*.json (D10, D19, D23)
+│   └── frontage.ts                     Phase 2: 1.3-frontage — layers by role, openings from paved ∩ road, inlets, ROW, the ortho tile (D16, D17)
 └── src/routes/
     ├── geometry/[id]/                  1a: draws paths, prints a line's length from the GeoJSON; 1b: a derived figure shows its parents, condition and measures (D9)
     └── anchored/, anchor/[id]/         lines by posture; Phase 2: context rows as a layer (D11, D19)
```

### 4.3 cityhall-new (the schema)

```diff
 Phase 1
 cartographer_geometries
+  geometry         jsonb NOT NULL (P1b)                 GeoJSON in frame feet; backfilled from polygon (D9)
   polygon          jsonb NOT NULL  →  jsonb NULL        CHECK (polygon IS NOT NULL) = (geometry type is a polygon)
   reading_method   CHECK (mete | traced)  →  (mete | traced | derived)   (D8)
   reading_complete CHECK second arm: reading_method IN (traced, derived) AND mete IS NULL AND trace IS NOT NULL
 cartographer_geometry_evidence
   role             CHECK (…)  →  + derivation           (D9)
 geo
   (no DDL: geom columns already take a line; posture already admits existing)
 sir_put_anchored_geo(p_anchor_id, p_figures)
+  LineString | MultiLineString branch: st_collectionextract(st_makevalid(g), 2); a named list of payload fields into properties (source_*, edge, pair_id, width_ft, labels, sheet_extent_ft, feature_key, condition, station_ft, measures, the curb_return fields) when present   (D10, D23)
 Phase 2
+cartographer_put_context_geo(p_anchor_id, p_features)
+  one row per opening / inlet / right-of-way polygon: method city_gis, posture existing, kind by role, properties {source_layer, object_id, source_vintage, accuracy_class: digitized, frontage, street, street_class, street_level, level_source, side, on_subject}   (D19)
```

### 4.4 The anchor runbook

```diff
 anchor-geometry
   1.1-inputs                 unchanged
   1.2-fetch                  Phase 1: reads geometry; passes geometryType, posture, reading_method through (D9, D11)
+  1.3-frontage               Phase 2: frontage/<n>.json + the ortho tile per frontage; frontage/none.json with why (D16–D18)
   2.1-correspond             Phase 1: prompt: curb and driveway figures are `carried`; contract enum + carried (D11)
   3.1-solve                  unchanged (carried figures transformed, never fitted)
   3.2-render                 Phase 1: lines by posture, the derived driveways filled; Phase 2: over the ortho tile, context rows outlined (D11, D21)
   3.3-check                  Phase 1: + the on-site line question, the per-driveway table; Phase 2: + the aerial questions, the frontage table (D11, D13, D21)
   4.1-hitl                   unchanged
   5.1-publish                Phase 1: figures by type with condition, station_ft, measures; Phase 2: context rows through cartographer_put_context_geo (D10, D19)
```

### 4.5 surveyor (Phase 2)

```diff
 surveyor/
 ├── src/lib/gis-layer-identity.ts       LayerRole + streets, street_levels, paved_areas, sidewalk_inventory, curb_inlets, right_of_way, orthoimagery; fields per role (D15)
 ├── src/sources/coa-gis/layer-identity.json   the seven Austin layers tagged by role, with fields (D15)
 └── src/sources/LAYER-IDENTITY.md       the role list and what each consumer may use it for
```

---

## 5. Testing seams

### 5.1 Phase 1

**S1: `trace.ts`'s CLI on a polyline feature** (existing seam, extended)
- **Proves:** D1, D3, D4 — White Water sheet 12, a `curb_proposed` region over the whole site → two candidate sets (`JCE BASE|C-CURB FOC`: 170 chains, 894 ft ± 2; `C-CURB BOC`: 43 chains), `edge` face / back from the layer; the FOC set carries 44 arcs on its chains; `pairEdges` → 17 pairs at 0.50 ± 0.02 ft, the unpaired chains listed; the same sheet with layer names withheld → the pairs found, every `edge: unknown`; sheet 7, a `curb_existing` region → the `C-DEMO CONC` chains (86 and 85 ft ± 1) with `demolish: true`, the `V-CONC-LINE` and `V-ASPHALT-LINE` chains with `demolish: false`; 1700 S Lamar sheet 15 (one layer) → `layers: []`, rung 2 sets by style, ranked by length, capped, no throw; 2008 San Antonio sheet 10 → the entrance's two curb lines in one of the sets; `--seed` or `--vertices` on a polyline region → refused; the primary-sheet picker on the three sets' survey titles → White Water 12 / 7, Lamar + Collier 16–17 / 8+9 (a pair), 2008 San Antonio 11 / 8. Byte-identical output for the sibling's `building` fixtures.
- **Prior art:** the sibling's S1 fixtures in `runbooks/extract-geometry/scripts/trace.test.ts`, `lib/evidence.test.ts`.
- **Runs:** `bun test` in `cartographer`, CI.

**S2: `pdf_paths.py` and `groupArcs()`** (new, pure)
- **Proves:** D2 — a Bézier built from a known circle (κ = 0.5523, 90°) → `radiusPt` within 0.03 %, `sweepDeg` 90.0 ± 0.1, `residualPt` < 0.05; an S-curve → no arc, chords unchanged; sheet 12's 44 face Béziers → 19 centres with the §1.4 radii at the 1″ = 20′ registration (20.0, 28.0, 25.0, 15.0, 10.0, 5.0 within 0.02 ft under least squares; the back set at R − 0.50 ± 0.02); the chord output byte-identical to today's for every path.
- **Prior art:** `lib/page.test.ts` for the Python reader's fixtures.
- **Runs:** `bun test` (the TypeScript side) and `python3 -m pytest runbooks/extract-geometry/scripts/lib/` (the reader), CI.

**S3: `findFrontages()` and `deriveDriveways()`** (new, pure; Phase 1b)
- **Proves:** D5, D6 — the White Water lot ring plus sheet 7's existing chains in lot feet → three frontage candidates (courses 5, 3+4 at 10.8–11.6 ft; course 1 at 11.6 ft), each with its coverage and `street: null`; existing condition → **1** opening, on course 5, at stations 77.8 / 111.0 ± 0.3, `widthAtRowFt` 33.2 ± 0.3, `returnRadiusFt` null both sides, west edge `sideLineClear: 'shared'` from the joint-access note label, nothing on courses 1, 3 or 4; resulting condition → the same opening, both edges `retained`, posture `existing` on both rows (Q14), a different `throatDepthFt`, the existing chains clipped where the two `demolish` chains (86.0 / 84.7 ft) run, the drop beginning 24.4 ± 0.5 ft inside the lot (White Water draws the removed stretch once, on the demolition layer — Q13 — so the real fixture tests the drop and the synthetic expansion below draws the existing curb under the demolition chain to test the clip); a pair of face/back chains crossing the line → one collapsed crossing; a label-broken chain and its continuation at one station → one crossing; a synthetic lot with a straight frontage and a 24 ft driveway with 15 ft returns at 90° → `widthAtRowFt` 24.0, `throatWidthFt` 24.0, radii 15.0 / 15.0, angle 90.0, `sideLineClear: true`, the apron polygon's area to 0.1 ft²; the same with R-50 returns → 50.0 / 50.0 (the 60 ft window); the same at 75° → angle 75.0; one return replaced by a 45° flare → `flare.left` 45°, `returnRadiusFt.left` null; a synthetic expansion (the east edge moved 10 ft outward, the old edge on a `demolish` chain) → existing 24.0 ft, resulting 34.0 ft `proposed`, both rows sharing `frontage` and the west station; a wholly new synthetic driveway → one row, `resulting`, `proposed`; a return whose arc crosses the projected side line → `sideLineClear: false`; two crossings 70 ft apart → no opening, both reported unpaired.
- **Prior art:** `src/lib/geometry/sheet.test.ts`, `placement.test.ts`, `src/lib/geometry/__fixtures__`.
- **Runs:** `bun test`, CI.

**S4: the extract scripts on a run directory with line and derived figures** (existing seam, extended; 1a then 1b)
- **Proves:** D8, D9 — **(1a)** a `raw-artifact.json` with the lot and two curb figures (one `curb_proposed` set with arcs, one `curb_existing` set with a `demolish` chain) and the confirm readings, through `assemble.ts` → `derived[curb].geometry` a `MultiLineString` with its first vertex at the origin, 894 ± 2 ft summed from it, `has_approximated_curves: true`; `place.ts solve` → the curb figures in `frame-1` by `sheet_registration`; `publish.ts --dry-run` → rows with `geometry` and `polygon` both set for the lot, `polygon: null` for the curbs, the proposed set as two rows (`edge: face`, `edge: back`, one `pairId`, `widthFt` 0.50) and the existing set as one (`edge: unknown`), each with its `feature_key`, `labels` (the three radii agree, `84 LF` disagrees) and the existing figure's `sheet_extent_ft`, `trace` rows citing set overlays. **(1b)** the same directory → two derived driveway figures (one per condition) with D6's measures and their polygons, in `frame-1` by their parents; `publish.ts --dry-run` → `geometry` and `polygon` both set for the driveways, `reading_method: derived` and a `derivation` evidence row per driveway. The union refuses a derived figure with `pathPt`, a derived figure without `condition`, a traced polyline with `courses`, and a `curb_existing` figure with posture `proposed`.
- **Prior art:** the sibling's S3 fixture; `anchor-e2e.test.ts` (a run directory as the fixture).
- **Runs:** `bun test`, CI.

**S5: the `extract-geometry-v2` runbook, inputs → outputs** (existing)
- **Proves:** D1–D7, D13 end to end, in three runs. **(a) Regression:** the car-wash plat `2024178771` → byte-identical `raw-artifact.json` / `artifact.json` to the sibling's S4 (a). **(b) White Water, Phase 1a** (`run_slug: whitewater-cc2e3a53-v2-run3`): the survey marks `curb_proposed` on sheets 12 and 13 and `curb_existing` on 7 and 12, no driveway region; 3.4 traces every one; 3.5 confirms the `curb_proposed` region on sheet 12 and the `curb_existing` region on sheet 7 (D1's per-feature primary sheet), each set taken whole; `assemble.log` prints the two registrations (12 and 7, both 1″ = 20.000′), 17 pairs at 0.50 ft, 19 returns with `R20.0'` / `R25.0'` / `R28.0'` **agrees**, `84 LF` **disagrees (86)**, the unpaired chains counted; the readout's curbs section says it in words; `publish` → five figures (`LOT 1`, `CAR WASH`, `curb` proposed face, `curb` proposed back, `curb` existing with `edge: unknown`), anchor `53d65a90` **stale**. **(c) White Water, Phase 1b** (`run_slug: whitewater-cc2e3a53-v2-run4`): everything in (b), plus three frontage candidates with `street: null`, one opening at 33.2 ft on course 5 in both the existing and the resulting condition, both edges retained, the throat depth differing (Q13), the west edge shared from the note label; `publish` → ten figures (the five of (b), three `frontage` figures with `street: null`, `driveway 1 · course 5` in the existing condition and in the resulting condition, both posture `existing` because both edges are retained), anchor 3 **stale**.
- **Prior art:** the step contracts; the sibling's S4.
- **Runs:** locally with `conductor`, against the two files; (b) is §7.1a step 1 and (c) is §7.1b step 1.

**S6: the RPC, the migration and the `anchor-geometry` runbook** (existing suites)
- **Proves:** D8–D12 — against a local Supabase: the migration backfills `geometry` for every existing row and the CHECKs then hold (a polygon row with `polygon: null` refused; a line row with `polygon` set refused; `reading_method: derived` with `mete` set refused); `sir_put_anchored_geo` accepts a `LineString` payload and writes a `ST_LineString` row with `posture: existing` and the named payload fields in `properties` (`source_pages`, `source_figure_id`, `source_crop_id`, `edge`, `feature_key`), refuses a `Point`, leaves an unsent field absent, and still publishes yesterday's payload unchanged. Then the runbook, **Phase 1a**: `{file, anchor_run_slug: whitewater-cc2e3a53-anchor-3}` on the re-extracted file → `correspondences.json` with `LOT 1` `same_as`, `CAR WASH` `within`, the three curb figures `carried`; `anchors.json` with every figure under frame-1 and the fit metrics equal to anchor 2's to three decimals (the lot did not change); the overlay with lines by posture; accept → `geo` rows: three anchored polygons, three anchored lines (`edge` face / back / unknown) and 19 `curb_return` rows with tangent points, under one `anchor_id`, every one with `source_pages: [12]` or `[7]` and a `feature_key`; D12's curb queries return 894 ± 2 ft of proposed face of curb and the 19 radii from the `curb_return` rows. **Phase 1b**: `whitewater-cc2e3a53-anchor-4` on run4 → the two driveway rows `carried` as well; accept → the six rows and the returns plus three `frontage` lines and two anchored derived polygons, the driveway rows' `labels.widthAtRowFt.status` = `unlabelled` (no printed width on sheet 12); D12's driveway queries return the existing and resulting rows side by side at 33.2 ± 0.3 ft and `to_lot_line_ft` consistent with the shared west edge.
- **Prior art:** `cityhall-new/tests/db/anchor-unowned-geo.test.ts`; `anchor-e2e.test.ts`; the sibling's S5 and S6.
- **Runs:** cityhall-new's `tests/db` against the local stack and CI's `supabase db schema declarative sync --no-apply`; the runbook locally; §7.1a and §7.1b steps 2–3.

### 5.2 Phase 2

**S7: surveyor's layer-identity registry with the new roles** (existing suite, extended)
- **Proves:** D15 — `coa-gis/layer-identity.json` validates with the seven role tags and their `fields`; `verify-layer-identity` still guards each tagged layer's name; a malformed role is dropped with a warning as today; a consumer lookup by role returns the pinned service, id and fields for `austin-tx` and `none` records for a jurisdiction without them.
- **Prior art:** `surveyor/scripts/verify-layer-identity.ts`'s own tests; `src/lib/gis-layer-identity.ts` tests.
- **Runs:** surveyor's test suite, CI.

**S8: `frontage.ts` on recorded layer answers** (new, pure)
- **Proves:** D16–D18 — fixtures recorded from the seven Austin layers at the site point (`arcgis_query.py`'s `.json` answers, the way `access_trace.py` records Overpass): one frontage on Brezza Lane (`A45 City Collector`, 30 mph, `street_level: null`, `level_source: 'absent from ASMP'`), the I-35 frontage road reported as TxDOT; N ≥ 1 openings from paved ∩ road on the same side, the site's own flagged `on_subject`, none under 8 ft; 3 inlets; 1 right-of-way polygon; a recorded answer with a `Driveways`-class polygon → an opening from the class alone; a jurisdiction module with no roles → `frontage/none.json` and exit 0; a layer error → an `.err.json` and a non-zero exit.
- **Prior art:** `bureau/runbooks/site-research/bin/test_abutters.py`, `test_arcgis_query.py` and their fixture directories.
- **Runs:** `bun test` in `cartographer` (and the bureau step contract), CI.

**S9: the context RPC and the `anchor-geometry` runbook with the frontage step** (existing suites, extended)
- **Proves:** D19–D21 — against a local Supabase: `cartographer_put_context_geo` writes rows with `method: city_gis`, `posture: existing` and the properties list under the anchor's id, reads no SIR, and `cartographer_mark_anchors_stale` flags them with the anchored rows. Then the runbook on White Water (`whitewater-cc2e3a53-anchor-5`): `1.3-frontage` writes the S8 answers live, the ortho tile with its world file; the overlay over the aerial; accept → the anchored rows and the context rows under one `anchor_id`; D20's queries return `spacing_ft` to each same-side opening with both labels, `inlet_ft`, the count on the frontage, and the site's own opening from both sources within 3 ft of each other.
- **Prior art:** S6; the sibling's S6.
- **Runs:** cityhall-new `tests/db`; the runbook locally; §7.2.

---

## 6. PR plan

### 6.1 Phase 1

Phase 1a is P0–P3 and ends at §7.1a; Phase 1b is P4–P5 and ends at §7.1b. The split is the order the risk is retired in: every schema, figure-model and anchor change is exercised by the curbs before a line of derivation exists.

**P0: the schema and the RPC's line branch** — `cityhall-new`
- **Blocked by:** nothing (can start now).
- **How:** edit the declarative files under `supabase/schemas/public/`, `npx supabase@2.119.0 db schema declarative sync --no-apply -f plan_set_driveways_curbs`, read the migration, add the `geometry` backfill statement to it by hand (declarative sync writes the column, not the data), commit both.
- **Delivers:** D8's CHECKs (`derived` admitted now so P4 needs no second migration), D9's `geometry` (backfilled, nullable until P1b), the `derivation` role, D10's line branch with D23's named-list pass-through into `properties`. Nothing writes the new column yet; today's extract and anchor publishes keep working.
- **Tested at:** S6 (the DB half).
- **Door:** two-way for the column and CHECKs; the backfill is data and re-runnable (`geometry` is a pure function of `polygon`).
- **Blast radius:** none until P1; a wrong CHECK refuses the next publish, which S6 catches.

**P1: the reader keeps the arc, the tracer learns a polyline, lines enter the figure model** — `cartographer` (+ **P1b**: the one-line `geometry NOT NULL` migration in `cityhall-new` once the writer is live)
- **Blocked by:** P0 (`database.ts` regeneration; `publish.ts` typechecks against `geometry`).
- **Delivers:** D1 (the two curb entries, `posture` nullable, `primarySheet`), D2, D3 (the set taken whole), D4, D7's radius and length checks, D9 in code: arcs in `pdf_paths.py`, the polyline branch, `curb.ts`, `traceSchema` on a chain set, `traced.ts` for lines, `assemble.ts` / `publish.ts` for curb figures (one per edge, with `labels`, `sheet_extent_ft`, `feature_key`), `crop outline` on a list, every reader of `polygon` moved to `geometry`, `/geometry/[id]` drawing paths and printing a line's length. After it merges the scripts take a hand-built run directory with curb figures to the database (S4 1a), and a mete-only or building-only run exercises none of the new code.
- **Tested at:** S1, S2, S4 (1a).
- **Door:** two-way.
- **Blast radius:** every `extract-geometry-v2` publish and every `/geometry/[id]` page; the sibling's S3 fixture and S5 (a) are the guards.

**P2: the extract runbook learns curbs** — `bureau`
- **Blocked by:** P1.
- **Delivers:** D1's two survey paragraphs (read from `features.json`), `trace.py` on polyline entries, the 3.5 prompt and contract for a polyline region (`labels`, `faceSide`; no `exclude`), `assemble.py` appending curb figures, the readout's curbs section (D13). After it merges, §7.1a step 1 runs.
- **Tested at:** S5 (a) and (b).
- **Door:** two-way for the runbook; one-way for prod data once §7.1a step 1 publishes (anchor `53d65a90` goes stale; nothing is deleted).
- **Blast radius:** every `extract-geometry-v2` run; S5 (a) is the guard.

**P3: the anchor side carries lines** — `cartographer` + `bureau`
- **Blocked by:** P0 (the RPC's line branch). Independent of P1 and P2 in code; it does nothing until a line figure exists.
- **Delivers:** D10's payload and D11 — `InputFigure.geometryType`, `carried`, `geometryInFrame`, `toGeoJsonLine`, render by posture, the check question, publish by type (with `condition`, `station_ft`, `measures` passed through when a figure carries them, so P5 adds nothing here), the three `source_*` fields and the named-list pass-through, one `curb_return` row per arc, the viewer. After it merges an anchor run on a polygon-only file behaves exactly as today, with three more properties per row.
- **Tested at:** S6 (1a).
- **Door:** two-way.
- **Blast radius:** every anchor publish; the RPC's unchanged polygon branch is the guard.

Deploy order, Phase 1a: **P0 → P1 (then P1b) and P3 in either order → P2 → §7.1a.**

**P4: frontages and the driveway derivation** — `cartographer`
- **Blocked by:** §7.1a accepted (the curb figures it derives from are real). Q13 is measured (v3.3).
- **Delivers:** D1's `driveway` entry and `derive`, D5 (`frontage.ts`, code-only), D6 (`driveway.ts`: collapse and dedupe, openings, returns in 60 ft, flares, throat, angle, depth, side lines from the note label, the demolition clip, both conditions, the polygon), D7's width checks, D8 in code (the three-way union, `derivedFigureSchema`, `TRACE_METHODS`), `assemble.ts` / `place.ts` / `publish.ts` for derived figures (the `frontage` figures and the driveways, with width `labels`), the `derivation` evidence row, `/geometry/[id]` showing a derived figure's parents and measures. After it merges the scripts take the S4 directory to six rows (S4 1b).
- **Tested at:** S3, S4 (1b).
- **Door:** two-way.
- **Blast radius:** every `extract-geometry-v2` publish; a curbs-only or building-only run derives nothing and is unchanged.

**P5: the extract runbook derives driveways** — `bureau`
- **Blocked by:** P4.
- **Delivers:** `assemble.py` handing the confirm readings to the derivation, `frontage.json`, the readout's frontages-and-driveways section (D13) with its *no frontage found* line, `5.2-place-solve` on a derived figure. After it merges, §7.1b step 1 runs; the anchor runbook needs nothing new (P3 already passes the derived figure's fields).
- **Tested at:** S5 (c), S6 (1b).
- **Door:** two-way for the runbook; one-way for prod data once §7.1b publishes (anchor 3 goes stale).
- **Blast radius:** every `extract-geometry-v2` run; S5 (a) and (b) are the guards.

Deploy order, Phase 1b: **§7.1a → P4 → P5 → §7.1b.**

### 6.2 Phase 2

**P6: the layer roles, and Austin tagged** — `surveyor`
- **Blocked by:** nothing in code; shipped after §7.1b by policy, since nothing consumes it before P8.
- **Delivers:** D15 — `LayerRole` and `fields` for the seven roles, `coa-gis/layer-identity.json` tagged, `LAYER-IDENTITY.md` updated.
- **Tested at:** S7. **Door:** two-way. **Blast radius:** none; untagged roles are ignored by every existing consumer.

**P7: the context RPC** — `cityhall-new`
- **Blocked by:** nothing in code; shipped after §7.1b by policy.
- **Delivers:** D19 — `cartographer_put_context_geo`, and `cartographer_mark_anchors_stale` covering its rows.
- **Tested at:** S9 (the DB half). **Door:** two-way. **Blast radius:** none until P9 calls it.

**P8: `frontage.ts`, the render over the tile, the context publish** — `cartographer`
- **Blocked by:** P6 (roles to read), P7 (the RPC), P3 and P5 (the publisher it extends and the driveway rows it joins to).
- **Delivers:** D16–D18, D21's render, D19's publish call. After it merges the scripts take recorded layer answers to context rows (S8, S9 DB half).
- **Tested at:** S8, S9. **Door:** two-way. **Blast radius:** every anchor publish; the step is absent from the runbook until P9, so nothing calls it in prod.

**P9: the anchor runbook gains `1.3-frontage`** — `bureau`
- **Blocked by:** P8.
- **Delivers:** the step and its contract, `3.2-render` and `3.3-check` prompts (D21), the readout table. After it merges, §7.2 runs.
- **Tested at:** S9. **Door:** two-way (the context rows are keyed by `anchor_id` and go stale with it). **Blast radius:** every anchor run in Austin makes seven network calls more; a layer outage is an error in `frontage/<n>.json`, never a failed run.

Deploy order, Phase 2: **P6 and P7 in either order → P8 → P9 → §7.2.** The prospector generalisation (D22) is its own spec and blocks nothing here.

---

## 7. Acceptance

### 7.1a Phase 1a, on `cc2e3a53` as it stands (§1.6), after P0–P3

1. **Extract.** `extract-geometry-v2` with `{file: cc2e3a53…, run_slug: whitewater-cc2e3a53-v2-run3}`. Expect S5 (b): `curb_proposed` confirmed on sheet 12, `curb_existing` on sheet 7, each set taken whole; five figures published (the proposed curb as a face row and a back row); `assemble.log`'s lines for 17 pairs at 0.50 ft, the three printed radii agreeing, the 84 LF disagreeing by 2 ft, the unpaired chains counted; anchor `53d65a90` stale.
2. **Anchor.** `anchor-geometry` with `{file, anchor_run_slug: whitewater-cc2e3a53-anchor-3}`. Expect S6 (1a): the lot `same_as`, the building `within`, the three line figures `carried`; metrics equal to anchor 2's; accept → six anchored rows and 19 `curb_return` rows under one `anchor_id`, postures `recorded` / `proposed` / `existing`, three of the six `ST_MultiLineString` with `edge` face / back / unknown, every row with `source_pages` and a `feature_key`.
3. **Measure.** D12's curb queries: 894 ± 2 ft of proposed face of curb, the existing feet beside it, the 19 `curb_return` rows with radius, sweep and tangent points, each citing sheet 12 and its overlay crop. The readout hands a person: *"894 ft of proposed face of curb in 170 chains and 17 face/back pairs at 6 in; 19 returns, R20.0 / R25.0 / R28.0 agreeing with the labels; 86 ft of existing curb marked for removal (84 LF noted)"* — and decides nothing.
4. **Regression.** S5 (a) on the car-wash plat; the sibling's S6 on the car-wash anchor; a building-only run of the sibling's fixture publishes two figures with `geometry` and `polygon` both set.

One deliberate negative: a `curb_proposed` region whose worker answers `chosen: null` publishes no curb figure, and the readout names it.

### 7.1b Phase 1b, on the same file, after P4–P5

1. **Extract.** `{file, run_slug: whitewater-cc2e3a53-v2-run4}`. Expect S5 (c): everything of 7.1a step 1, plus three frontage candidates with `street: null`, one opening on course 5 at 33.2 ft in **both** conditions, both edges retained so both rows are posture `existing` (Q14), the throat altered (the `demolish` chains dropped from the resulting set, Q13), `returnRadiusFt` null at the right-of-way on both sides (the apron's edges are straight), the west edge shared from the joint-access note; ten figures published (three of them `frontage`); anchor 3 stale.
2. **Anchor.** `{file, anchor_run_slug: whitewater-cc2e3a53-anchor-4}`. Expect S6 (1b): the two driveway rows and three `frontage` rows `carried` beside the lines; accept → eleven anchored rows and the returns under one `anchor_id`; the driveway rows' width verdict reads `unlabelled`.
3. **Measure.** D12's driveway queries: the existing and resulting rows side by side; the driveway against the lot's side lines. The readout hands a person: *"one driveway on course 5 (street not named until the context run), retained, 33.2 ft at the right-of-way line in both the existing and the resulting condition (Table 7-2 typical 20 ft on a Level 1 or 2 street; the Level is not stated on the sheet); no change to the opening; 86 ft of curb removed behind the sawcut (84 LF noted) and R28.0 and R20.0 returns added inside the throat; the west return is on the shared easement"* — and decides nothing.
4. **Honesty.** The return-radius path at the right-of-way (D6 step 3) is proven by S3's synthetic fixture only; the first real plan set with a return at the street is the fixture that proves it on a sheet, and until then §7.1b says so.

One deliberate negative: a lot whose `findFrontages` returns nothing derives no driveway, and the readout says *no frontage found* and lists the crossings it would have paired.

### 7.2 Phase 2, on the same file, after P6–P9

1. **Anchor again.** `{file, anchor_run_slug: whitewater-cc2e3a53-anchor-5}`. Expect S9: `1.3-frontage` with Brezza Lane as `A45 City Collector`, `street_level: null`, `level_source: 'absent from ASMP'`; the I-35 frontage road as TxDOT; the openings from paved ∩ road, the site's own among them flagged `on_subject`; 3 inlets; 1 right-of-way polygon; the aerial under the overlay; accept → the anchored rows and the context rows under one `anchor_id`.
2. **Measure.** D20's queries: `spacing_ft` to each same-side opening with both labels and the Level reported as unresolved; `inlet_ft`; the count on the frontage; the site's own opening from the two sources within 3 ft. The readout's frontage table says which numbers are ±2 ft and why the Table 7-5 row is unresolved.

---

## 8. Open questions

**Resolved in v2** (kept so the audit can disagree):

- **Q1** — face vs back on a layer-less sheet → **D4**: no geometric rule survives §1.4's test (best 12 of 17); report the pair.
- **Q2, Q3** — the resulting condition and a mixed posture → **D6** step 8: two conditions, two rows, no `altered`.
- **Q14** — the posture word for a retained driveway's resulting row → **D6** step 8 (v3.4): posture is computed from the edges (`existing` if every edge is retained, else `proposed`); `condition` carries the derivation. Rejected: leaving every resulting row `proposed` (a right-of-way sweep and CC-22-13 would flag kept aprons), and a fourth posture `resulting` (DDL on two CHECKs, and it repeats `condition`).
- **Gaps found after the split** — the primary sheet for existing curbs and the striping reference in throat depth → **D1** (per-feature primary sheet, from the content blocks of three sets) and **D6** step 6 (`throatDepthBasis: 'curb'`).
- **Q4** — where the frontage lives → **D23** (v3.2, reversing v3): a `frontage` row per candidate course in Phase 1b, `street: null`; Phase 2's D16 names it on that row by `course_index`.
- **Q5** — bureau data file or surveyor registry → **D15**: surveyor's layer-identity roles, the registry the anchor fetch already reads; prospector generalisation is **D22**'s spec.
- **Q6** — 200 or 300 ft → **D17**: 300, the City's own submittal requirement; the TCM states none.
- **Q9** — one RPC or two → **D19**: two.
- **Q10** — a Street Level default → **D18**: none; `null` with the class beside it.
- **Q11** — opposing driveways without a right-of-way polygon → **D20**: TCM 7.6.3 measures along the street between throat edges.
- **Q13** — does the existing-concrete layer redraw the removed 84 LF? → **no** (v3.3, `spike/probe8.py`): 0 % of the demolition chains within 1.5 ft of `C-EXIST CONC`, ≤ 3.5 % within 1.5 ft of `V-CONC-LINE`; drawn once, on the demolition layer. D6 step 8's clip stays for sets that redraw; the real fixture tests the drop, S3's synthetic fixture the clip.

**Open:**

**Q7.** Openings from the orthophoto. Outside Austin, and in Austin where the digitization is stale or the frontage is residential, the aerial is the only source, and reading it is a vision step: a worker boxes each apron on the georeferenced tile, code maps the box through the world file (the sibling's rung 4, on an aerial). Proposed: after Phase 2 — the tile is already fetched and shown to the check worker, so the step is one prompt and one contract when it is wanted.

**Q8.** Raster plan sets (D3). A scanned plan set's curbs are pixels; `contour.ts` floods a region, it does not trace a line. Proposed: out until a raster plan set is on disk; `handAllowed` refuses cleanly.

**Q12.** When the `polygon` column's contract phase runs (D9). Proposed: after P1 has been in prod for one anchor run and one extract run, as its own small spec, together with retiring `rings` from `/geometry/[id]`.

---

## 9. Seams, against the sibling's list

The sibling (§8) scored itself against sir-free's eight seams. The same table for this spec, with one correction to its D18 row: it said driveways open **6.1 frame identity** because "the ROW (county side) and the curb (sheet side) must share a frame, which is the anchor, not the sheet". They do not: the right-of-way line a driveway is derived against is the lot's own frontage course, which is in frame-1 already. What needs the anchor is the *adjacent* driveway, and that is Phase 2's join on the grid, not a frame.

| sir-free §6 | this spec |
|---|---|
| 6.1 frame identity | **Still shut.** Curbs register to the lot's frame like the building; the driveway is derived in it. Phase 2's context rows are on the grid, keyed by `anchor_id`, not by a frame. |
| 6.2 fixed scale | unchanged (`registerSheet` solves it; `anchor.ts` does not). |
| 6.3 units | not opened: page points stay inside the tracer; every stored coordinate is feet. |
| 6.4 polygon-only | **Opened — expand only** (D9); the contract is Q12's spec. |
| 6.5 reading model | **Opened further** (D8): `derived` beside `mete` and `traced`. |
| 6.6 correspondence vocabulary | **Opened** (D11): `carried`. |
| 6.7 posture | **`existing` written for the first time** (D1, D6). |
| 6.8 source of each row | **Opened on both sides** (D23: `source_pages`, `source_figure_id`, `source_crop_id` on every anchored row; D19, Phase 2): `properties.source_layer`, `object_id`, `source_vintage` on every `city_gis` row; `trace.page` still names the sheet on a figure. |

---

## 10. Not yet specified

- **The confirm worker's per-chain `exclude[]`** (D3, v3): the design allows a worker one edit, removing a chain from the chosen set; the MVP takes the set whole. What the trim should look like (how a worker names a chain on a 170-chain overlay, or whether the tracer should offer sub-sets) comes from the unpaired-chain counts of the first runs.
- **A `driveway` survey region** (D1, v3): a paragraph so the survey marks each driveway a reader sees, for the readout to count the derivation against. Worth adding once the derivation has rows to count.
- **Plat adjoiner labels as a frontage signal** (D5): a plat usually names the street along the right-of-way course, and the mete figure already carries the courses. A zero-token name for Phase 1's `street: null`, if the merge step can be made to keep the label; not needed once Phase 2's D16 runs.
- **Secondary-sheet figures for the consistency tool** (D23): the curb as drawn on the paving plan against the site plan is the IG report's *consistency* question (`ST_HausdorffDistance`). 3.4 traces every sheet and the artifact keeps the traces; publishing a non-primary sheet's set as a figure with a `sheet_role: secondary` property is one publisher change when that tool exists.
- **Whether the SIR map draws a line** (D10): `sir_parcels()` returns any geometry type, and cityhall-new's map styling was written for polygons. A line row in `geo` renders or it does not; the first anchored curb says which, and the fix, if one is needed, is a cityhall-new styling PR outside this spec's list.
- **The minimum coverage for a frontage candidate** (D5, "at least half the edge"): a short frontage on a corner lot with a curb return across half of it may fail it; the first corner lot will set the number.
- **The opening pairing window** (D6, 8–60 ft): a high-capacity three-lane driveway is 32 ft wide at the throat and wider at the right-of-way with 25 ft returns; 60 may be tight at R = 50 (industrial). The first industrial set decides.
- **How the rung-2 set is cut down** on a layer-less site plan: 1700 S Lamar sheet 15 has one layer and thousands of paths; by style the curb may share a pen with the building. What the worker sees (how many overlays, each of how many chains) comes with the first run on it.
- **The confirm prompt's words for a polyline region and the frontage item** in full: D3, D5 and D7 say what they must ask; the words come with P2.
- **The opening rule's tolerance** against the impervious layer (D17, 3 ft, ≥ 8 ft): tuned on the first three Austin frontages (Phase 2).
- **A national fallback for the `streets` and `street_levels` roles** (D15, D16; Phase 2): a jurisdiction whose module carries no `streets` role today writes a `none` record and the frontage step produces nothing. The roles could resolve in order — the jurisdiction's own layer first, then a keyless national layer for the street's **name and class** (Census TIGER/Line roads through TIGERweb, or OpenStreetMap through Overpass; both centrelines, both good enough for *which street is this* and for the D16 parallel test, neither for an offset), and in Texas the TxDOT Roadway Inventory for **surface and right-of-way width** (a cross-check on the 3–60 ft offset ceiling above, and a class where a city publishes none). Never a source of Street Level: TCM Appendix A ties the Level to the ASMP map, so D18's `null` with `level_source` stands wherever ASMP is absent, and a fallback row says which layer it came from in `source_layer` like every other context row (D19). Google Maps and Mapbox are out: paid, and Google's terms forbid storing derived data. Whether this lands in D15 as a second resolution tier or waits for D22's prospector spec is decided by the first non-Austin anchor run.
- **What `3.3-check` is told about the aerial** (D21): leaf-off 2021 imagery against a 2026 plan set will disagree wherever the site changed; the prompt has to say so (Phase 2).

## 11. Out of scope

- Trees, sidewalks, striping, drive aisles and parking as features (each a registry entry; sidewalks are the obvious next polyline, the same tracer).
- Grades and Z: throat grades (TCM 7.5.2), the 6 in rise at the right-of-way line, ramp slopes (IG slice 3).
- Vision-drawn openings from the orthophoto (Q7).
- The prospector change that tags layer roles for every trained jurisdiction and backfills the existing modules (D22, its own spec); any jurisdiction but Austin in Phase 2.
- The PostGIS tool surface for agents (north star P4); D12 and D20 are queries a person runs.
- The `polygon` column's contract phase (Q12); additive publish across re-extractions (sibling Q9).
- `cityhall`, the SIR runbook, the completeness check's vision path (`CC-22-12`–`CC-22-15` are checked by a different product; this spec produces what they would check against).

---

## Appendix A: evidence pointers

- **Prod rows (2026-10-19):** `cartographer_geometries` 14 rows, 1 traced; `cc2e3a53` → `240c28fc` (`LOT 1`, mete, recorded, reference) and `160814af` (`CAR WASH`, traced, proposed, `sheet_registration`), both `whitewater-cc2e3a53-v2-run2`; `cartographer_anchors` `f290425a` stale, `53d65a90` accepted (`whitewater-cc2e3a53-anchor-2`, frame-1, `sir_id` null); `geo` for the file: `183eced8` county ring, `2ceb7683` LOT 1 stale, `e1cac23b` LOT 1 live, `387bd2cb` CAR WASH proposed; `geo` vocabulary in prod: kinds `building, easement, easement_sanitary_drainage, parcel, right_of_way`; methods `anchored, county_api, estimated`; geometry types `ST_Polygon, ST_MultiPolygon` only.
- **The PDFs:** `~/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf` (sheet 12 layers and counts as tabulated; sheet 7 `C-DEMO CONC` 38 / `C-IC EXIST PAVING` 45); `~/noetic/tmp/Quiddity/Electronic Submittal/00. 2008 San Antonio St Site Plans.pdf` (0 OCGs); `~/noetic/tmp/TestProjFromLamarCollier/v7/PLAN_SET__260723 Update 1700 S Lamar.pdf` (Civil 3D 2024, 440 OCGs, sheets 15–16 one layer each).
- **The spike (§1.4):** PyMuPDF 1.26.5 `get_drawings()` with `layer`; shapely 2.0.7 `linemerge` for chains, `MultiPoint.convex_hull` for the lot in page space, a three-point circle through each Bézier's ends and midpoint; the frontage edge = the lot edge nearest the `V-ASPHALT-LINE` union; stations by `LineString.project`; the face/back test paired FOC/BOC chains at 0.33–1.0 ft over ≥ 80 % of 20 samples and scored each rule by 11 side samples 8 ft off the pair's midline; the demolished chains' nearest approach to the right-of-way line 24.4 ft at stations 106.6–107.4. Scripts `probe1.py`–`probe7.py` in the session scratchpad; the numbers are the tables above and belong in S1–S3's fixtures.
- **Austin layers (§1.5):** `services.arcgis.com/0L95CJ0VTaxqcmED/ArcGIS/rest/services/{impervious_cover_2023, TRANSPORTATION_sidewalks, TRANSPORTATION_street_segment, TRANSPORTATION_asmp_street_network, UTILITIESCOMMUNICATION_CurbInlet, PLANNINGCADASTRE_right_of_way, EXTERNAL_tcad_parcel, LOCATION_address_points}/FeatureServer/0`; queries at −97.79374, 30.15016 with `distance` 50–300 ft; the ASMP count by `STREET_LEVEL` (1: 29,256; 2: 4,507; 3: 3,659; 4: 2,416; 5: 1,792); `ROAD_CLASS` domain (8 = `A45 - City Collector`); `imagery.geographic.texas.gov/server/rest/services/StratMap/StratMap21_NCCIR_CapArea_Brazos_Kerr/ImageServer` (`pixelSizeX` 0.1524003, `capabilities: Catalog,Image,Metadata`, 4 bands); the impervious layer's catalog page `catalog.data.gov/dataset/impervious-cover-2023`.
- **The content blocks (§1.3):** `plan_set_version` `6b4c9887-d380-4cb1-8b10-5aa76d4e116b` (White Water v1), `6cf68db3-f8b4-4e2d-8c0d-de231c14499d` (Lamar + Collier v8, submission `cf1201c2`), `9ddd2cf1-fd08-48e6-947a-541675ad8775` (2008 San Antonio v1); `content_block` rows by `sheet_version`; RPCs `search_content_blocks_hybrid(target_project_id, search_query, query_embedding, similarity_threshold, max_results, target_plan_set_version_id)` and `search_content_blocks_keyword`; the legacy caller `bureau/workflows/completeness-check/scripts/semantic-search-blocks.ts` (`openai/text-embedding-3-small` via `@ai-sdk/gateway`) run through `runbooks/completeness-check/bin/search.sh`. The blocks quoted: White Water sheet 7 block 2 "Existing Site Plan View"; Lamar sheets 8 and 9 block 1 and sheet 17 block 7 (DETAIL A); 2008 San Antonio sheet 8 block 2 "Site Demolition Plan View", sheet 11 block 2, sheet 25 block 2.
- **The rules (§1.2):** `bureau/jurisdictions/austin/codes/tcm/contents/Section 7 - Driveways/7.5.0 …/7.5.1 …/{7.5.1.1, 7.5.1.2, 7.5.1.3}.md`, `7.6.0 - Access Management/{7.6.1, 7.6.2, 7.6.3, 7.6.4}.md`, `Section 9 …/9.3.4.3.1 - Throat Storage Length..md`, `Appendix a - Definitions.md` (STREET LEVEL); LDC `§ 25-6-295`, `§ 25-6-321`, `§ 25-6-322`, `§ 25-6-451`; `review-guides/ta/site-access-and-circulation.md` `SAC-01`–`SAC-07`, `SAC-26` (the 200 ft "convention" at line 260; "unresolved rather than inferring Level" at line 139); `completeness-check/v2.7-trimmed/cc-22.md` `CC-22-12`–`CC-22-15` and `source-citations.json` `cc-22:CC-22-14` (two verbatim pins of "Adjacent driveways within 300 feet"). Not in Bureau: the standard-detail sheets 433S-1 / 433S-2 / 433S-2A / 433S-3 themselves.
- **The extract runbook:** `bureau/runbooks/extract-geometry-v2/` — `README.md`, `scripts/{trace,assemble,roster}.py` (`trace.py primary_page`, `assemble.py append_traced` :66, `roster.py confirm` :7/:25), `steps/2.1-survey/steps/page/prompt.md` :59-81, `steps/3.5-confirm/steps/region/prompt.md`, `steps/3.4-trace/step.yaml`.
- **The cartographer scripts:** `runbooks/extract-geometry/scripts/lib/trace.ts` (`traceFeature` :388, `traceBoundary` :604, `BRIDGE_PT` :84, `MAX_STYLE_CANDIDATES` :88, `addHandCandidate` :548, `handAllowed` :583), `lib/pdf_paths.py` (:30-33, :64), `lib/evidence.ts` (`traceSchema` :335-372, `tracedFigureSchema` :376, `figureSchema` :396), `lib/traced.ts`, `assemble.ts` (:254-303), `src/lib/features/registry.ts`, `src/lib/geometry/sheet.ts` (`registerSheet` :370), `placement.ts` (`sheetEdge` :269).
- **The anchor side:** `runbooks/anchor-geometry/scripts/lib/frames.ts` (`ringInFrame` :80, `toInputFigure` :97, `buildAnchorInputs` :252, `anchoredGeoPayload` :427, `toGeoJsonPolygon` :440), `publish.ts` :248, `fetch.py` :51-70 (`arcgis` via `locate`; the surveyor registry for `role: parcels`), `bureau/runbooks/anchor-geometry/steps/{1.2-fetch,5.1-publish}/step.yaml`, `steps/2.1-correspond/contract.test.ts` :18, `src/lib/geometry/anchor.ts` :181.
- **Surveyor (Phase 2):** `src/lib/gis-layer-identity.ts` (`LayerRole` :124, `LayerIdentityRecord`), `src/sources/LAYER-IDENTITY.md` ("`role` and `fields` — the manifest as a consumer registry"; "Only `coa-gis` and `travis-county-gis` are tagged so far"), `src/sources/coa-gis/layer-identity.json` (27 layers; TCAD Parcels role `parcels`, OmniParcel role `legal_description`), `scripts/verify-layer-identity.ts` (`--record`, `--screen`); 128 jurisdiction guides under `jurisdictions/`; prospector's `bureau/runbooks/prospector/{sources-recon,sources}/` mention no roles.
- **Schema (cityhall-new `supabase/schemas/public/`):** `tables/cartographer_geometries.sql`, `tables/cartographer_geometry_evidence.sql` (:25-31), `tables/geo.sql`, `functions/sir_put_anchored_geo.sql` (:36 "sir_id may be NULL on an unowned anchor"; :52-60 the polygon gate; :77-78 posture; :93 trace_method), `functions/sir_parcels.sql` :20; migrations `20261016210300_plan_set_footprints.sql` and the five before it.
- **Site-research prior art:** `bureau/runbooks/site-research/bin/{arcgis_query.py, abutters.py, access_trace.py, _visual_walk_geo.py, site-visual-walk.sh}`, `data/road-centerlines.json`.
- **Prior specs:** `../plan-set-footprints/DESIGN-SPEC.md` (D4, D6, D7, D8, D13, D17–D18, D19, Q8–Q10), `../north-star/NORTH-STAR-SPEC.md` (§1.3, D12, D14, §9.3–9.4), `../sir-free-anchoring/DESIGN-SPEC.md` (§6 the seams, D6 the registry role), `../geometry-placement/DESIGN-SPEC.md` (winston#270), `../anchoring-geometries/DESIGN-SPEC.md` (winston#279 D14 stale anchors).
- **The IG report:** §4 "Feature layers by demand" (curb 34 / 18, driveway 19 / 12, street centreline 11 / 7), "Plan set and county geometry, together" (62 of 134 need the county side), the ranked operations ("(non-PostGIS) arc radius fit"), the spike row #28 (entrance 15.0 × 15.2 ft, face-to-curb 12.3 ft), §5 slice 2.
