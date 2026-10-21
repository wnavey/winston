# Driveways and curbs from plan sets: follow-ups after the Phase 1 acceptance run, and the Phase 2 kickoff

**Status:** Draft v1 — PF1 SHIPPED 2026-10-21 (cartographer#48, cityhall#425, migration `20261021120000_geo_course_key`; Q-F1 = side labels); PF2 = the parent's v3.6, which also re-cuts Phase 2 (a ring-keyed fetch, a precedence rule D24, a smaller first pass); §3 below is superseded by the parent's §3 and §6.2
**Date:** 2026-10-21
**Parent:** `workspaces/cartographer/plan-set-driveways-curbs/DESIGN-SPEC.md` v3.5, as built (winston#326; v3.4 was winston#324). Phase 1 shipped as cityhall#421 and #423, cartographer#44–#47, bureau#2174, #2176 and #2177.
**Repos touched:** `cartographer` (a stable course key for frontages and driveways, `feature_key` on every anchored row), `winston` (the parent's v3.6), then Phase 2 as the parent's §3 and §6.2 specify (`surveyor`, `cityhall-new`, `cartographer`, `bureau`)
**Repos NOT touched:** `substation` (retired), `cityhall` (the old app), `conductor2`, `prospector`, `claude-plugins`, `navalbase`, `quarry`

## Problem

Will ran the Phase 1 acceptance on White Water Express Car Wash (`cartographer_files.cc2e3a53-db9b-493f-b270-e9039b03284c`) as one extract and one anchor run: `extract-geometry-v2` with `run_slug: whitewater-cc2e3a53-v2-run3`, then `anchor-geometry` with `anchor_run_slug: whitewater-cc2e3a53-anchor-3`, which is **accepted** (anchors 1 and 2 are now stale). The numbers the parent's §7.1 asks for came out, and they match the test fixtures to the hundredth. The run also showed three things Phase 2 would build on, and those should be fixed or decided first.

The next session does two things, in order: this spec's follow-ups (§2, PR plan PF1–PF2), then Phase 2 as the parent specifies it (§3 below points at it). Everything below was read from prod on 2026-10-21 with read-only queries.

## 1. What the acceptance run produced

**Extract (`cartographer_geometries`, run3):** eleven figures.

| figure | kind / posture / method | geometry | sheet | numbers |
|---|---|---|---|---|
| LOT 1 | parcel / recorded / mete | Polygon | 2 | 5 courses, walked from the **northwest** corner (first course S74°32'40"E 217.63) |
| CAR WASH | building / proposed / traced | Polygon | 12 | as before |
| curb proposed face | curb / proposed / traced | MultiLineString | 12 | 894.6 ft; 19 returns; 17 matched on the back at R − 0.500 ft; paired at 0.500 ft (`pair/12/p12-r3`) |
| curb proposed back | curb / proposed / traced | MultiLineString | 12 | 947.7 ft; 17 returns |
| curb existing | curb / existing / traced | MultiLineString | 7 | 2,939.6 ft; `84 LF` **disagrees** (85.96 ft chain); the survey base reaches w 13.8 / n 8.8 / e 46.4 / s 11.0 ft past the lot |
| frontage · course 1 | frontage / recorded / derived | LineString | 7 | 3.10–3.13 ft, coverage 0.5 (the apartments' side) |
| frontage · course 2 | " | " | 7 | 41.1–41.7 ft, coverage 1 (I-35) |
| frontage · course 3 | " | " | 7 | 37.3–41.1 ft, coverage 0.8 (I-35) |
| frontage · course 4 | " | " | 7 | **11.12–11.66 ft, coverage 1 (Brezza Lane)** |
| driveway 1 · course 4 (existing) | driveway / existing / derived | Polygon | 7 | stations 167.96–201.19; **33.23 ft** at the right-of-way (34.92 outside to outside); throat 23.85 ft; no returns at the line; throat depth **56.26 ft**; side lines true / true; area 382.1 sq ft |
| driveway 1 · course 4 (resulting) | driveway / existing / derived | Polygon | 7 | the same, both edges retained; throat depth **133.51 ft** |

**Anchor (`geo`, under anchor 3's id):** 48 rows: 1 parcel, 1 building, 3 curb MultiLineStrings (face, back, existing), 36 proposed `curb_return` LineStrings plus 1 existing, 4 frontage LineStrings and 2 driveway Polygons. The parent's D12 queries return 894.6 ft of proposed face of curb, the 19 face radii (28.02, 25.02 ×2, 20.02 ×3, 15.02, 10.02 ×3, 5.02, 3.02 ×3, 2.02, 1.52 ×4), and the two driveway rows side by side at 33.23 ft, each width `unlabelled`.

Against the parent's §7.1: every curb number, the opening, the retained edges, the posture and the changed throat depth are met. The differences are in §2.

## 2. Follow-ups

**F1. A frontage's course number, and everything keyed by it, depends on where the transcription started walking the lot.**
- **What happened:** `courseIndex` is the course's place in the mete as transcribed. Run 2 walked LOT 1 from the southwest corner, so Brezza Lane was course 5; run 3 walked from the northwest corner, so it is course 4. As a result:
  - The `feature_key`s are `frontage/7/course-4` and `driveway/7/course-4/1/{existing,resulting}`.
  - The labels read `driveway 1 · course 4`.
  - Stations run from that course's start vertex in walking order, so a walk in the other direction would also flip them, and left and right.
- **Why it matters:**
  - It breaks D23.6's promise that a key is "the same on every republish".
  - The parent's D16 has Phase 2 name the street "on Phase 1b's `frontage` rows by `course_index`".
  - A reader can't predict "course 4".
- **Proposed fix (D-F1):** keep `courseIndex` as the walk's number (it is what the mete says), and add a **`courseKey` that does not depend on the walk**. It is the compass side the course faces: its outward normal's octant, `N`, `NE`, `E`, `SE`, `S`, `SW`, `W` or `NW`. When two courses face the same octant, a clockwise ordinal is added: `E1`, `E2`. White Water's courses come out as:
  - Brezza Lane: `S` (it runs N74°32'40"W, so it faces S15°27'20"W, inside the S octant)
  - the I-35 courses: `E1`, `E2`
  - the apartments' side: `N`

  `feature_key`s, labels (`driveway 1 · S frontage`) and stations then key on `courseKey`. Stations are measured **clockwise around the lot**, from the course's clockwise-start vertex, so left and right are a person's standing in the street looking at the lot. D16 joins by `courseKey`, or better by geometry, since the city's street segment is matched to the course's line anyway.
- **Q-F1:** side labels as above, or a canonical renumbering? The renumbering option is courses numbered clockwise from the lot's southwest-most vertex. It's simpler to compute but no more readable than today's numbers. **Recommendation: side labels**, because a reviewer says "the south frontage", and a street name replaces the label in Phase 2 anyway.
- **Test:** the same White Water sheet-7 derivation run over the lot ring rotated to every start vertex, and reversed, yields identical `courseKey`s, stations, `feature_key`s and measures.
- **Then:** republish White Water. Do it as part of Phase 2's acceptance run (§3), not as a separate run, so anchor 3 goes stale once.

**F2. The parent's D12 query for "the return stays inside the lot" always returns 0.**
- It measures `st_distance(driveway, st_exteriorring(parcel))`. The driveway polygon starts on the right-of-way line, which is the lot's own frontage course, so the distance is 0 by construction. Both rows returned `to_lot_line_ft: 0`.
- The real answer is already on the row as `measures.sideLineClear` (with `sideLines.left` and `.right`).
- **Fix:** in the parent's v3.6, replace that query with one that reads `properties->'measures'->'sideLines'`. If a distance is wanted, measure it from the driveway's `curb_return` rows (or a flare's segment) beyond the right-of-way to the projection of the side course. That would be a new `sideLineClearanceFt` measure, computed by `driveway.ts` where the side line is already known.
- **Recommendation:** the query change now, and the measure only when a review tool asks for the number.

**F3. Two of the 48 anchored rows have no `feature_key`: the lot and the building.**
- D23.6 says every row carries one. As built, only curb, return, frontage and driveway rows do, because the key is computed in `curb-figures.ts` and `derived-figures.ts`.
- **Fix:** the anchor's `frameResult` gives every polygon figure a key from its kind, sheet and label: `parcel/2/lot-1`, `building/12/car-wash`. This uses the `slug()` helper `frames.ts` already has.
- **Test:** a `frames.test.ts` case.

**F4. Look at the map.**
- The parent's §10 left open whether the SIR map and `/anchored` draw a LineString. MapLibre's line layers should, but no one has looked yet.
- Will should open `/anchored` for White Water and anchor 3's overlay (`3.2-render`) and confirm:
  - curbs drawn as lines by posture
  - returns heavier
  - driveways filled
  - frontages along the lot's edges
- A styling fix, if one is needed, is a cityhall-new PR outside this list.

**F5. The plat regression was not run.**
- The parent's §7.1a step 4 asks for an extract on the car-wash plat (`2024178771`) that is byte-identical to the sibling's, and a building-only anchor that still writes `geometry` and `polygon`. Neither was part of this run.
- Run them before Phase 2 changes the anchor publisher again (P8).

**F6. The west side line is `true`, not `shared`.**
- The parent's §2.4 expected White Water's west edge to read `shared`, from the "CALLED 0.0565 ACRES JOINT ACCESS EASEMENT" note. Both conditions read `true / true`.
- **Look in run 3's `3.5-confirm` answers** for whether the worker read the note at all, and with a `location`. An unboxed note can't be within 20 ft of anything, and the note is printed on sheet 12, while the existing curbs and the opening come from sheet 7.
- If it was read and boxed but lies more than 20 ft from the crossing, the 20 ft window (`SHARED_NOTE_FT`) is the number to revisit. That becomes a §10 item in the parent, not a fix.

**F7. Fold the results into the parent (v3.6).**
- Record §1's numbers in the parent's §7.1, marked as run.
- Write F1's decision into D5, D6 (the station convention), D16 and D23.6.
- Replace F2's query and record F3 in D23.6.
- Record F6's finding.
- Do it in the same session as PF1, after F1 is decided, so the spec and the code agree when Phase 2 starts.

## 3. Phase 2: where it is specified, and what it is blocked by

Phase 2 is specified in the parent and needs nothing new here:
- **The design:** §3, D15–D22.
- **Testing:** §5.2, S7–S9.
- **The PRs:** §6.2, P6–P9.
- **Acceptance:** §7.2.

For a session starting it:

- **Blocked by:**
  - **Phase 1b accepted:** done (anchor 3 accepted).
  - **This spec's PF1:** D16 names the street on the frontage rows, and the key it joins by is what F1 changes.
  - **The parent's P6:** surveyor's layer roles. Nothing has started on it.
- **Order:**
  1. PF1
  2. P6 (surveyor) and P7 (cityhall-new `cartographer_put_context_geo`), in either order
  3. P8 (cartographer `frontage.ts`, the render over the aerial tile, the context publish)
  4. P9 (bureau `anchor-geometry` `1.3-frontage`)
  5. §7.2
- **Slugs:** the parent's §7.2 names the Phase 2 anchor run `whitewater-cc2e3a53-anchor-5`. As built, anchor 3 is the accepted one, so the next free slugs are **extract `whitewater-cc2e3a53-v2-run4` and anchor `whitewater-cc2e3a53-anchor-4`**. PF1's republish rides that run.
- **What Phase 1 already provides:**
  - frontage rows with `course_index`, `offset_to_pavement_ft`, `pavement_edge_figure_id`, `coverage` and `parallel_deg` (`street` absent, since nulls are dropped)
  - `curb_return` rows with `pt_start` / `pt_end` for D20's inlet clearance
  - driveway rows with `condition`, `station_ft` and `measures`
  - everything under one `anchor_id`

  cityhall#421's `sir_put_anchored_geo` copies a fixed list of named fields. P7's new function is separate (D19), so the list doesn't need to grow for Phase 2's context rows.
- **Prior art to read first:**
  - `bureau/runbooks/site-research/bin/{arcgis_query.py, abutters.py, access_trace.py}`
  - `surveyor/src/lib/gis-layer-identity.ts` (`LayerRole`)
  - `surveyor/src/sources/coa-gis/layer-identity.json`
  - `cartographer/runbooks/anchor-geometry/scripts/lib/frames.ts` (`carriedDerivedFigure`, where the frontage rows are made)
- **Rules that carry over:**
  - No run, accept, publish or migration push without Will's go on the exact payload.
  - Migrations are written in `supabase/schemas/` and checked by CI's declarative-sync drift check. There's no Docker on Will's Mac, so they're hand-written, and the drift check is the verification.

## 4. Testing seams

**S-F1: the derivation over every walk of the lot** (existing seam, extended)
- **Proves:** D-F1. It runs `findFrontages` + `deriveDriveways` + `buildDerivedFigures` on White Water's sheet-7 fixture with the lot ring started at each of its five vertices, and reversed. The checks:
  - identical `courseKey`, stations, `feature_key`s and measures every time
  - Brezza Lane keyed `S`
  - the synthetic lot's south course keyed `S`
- **Prior art:** `runbooks/extract-geometry/scripts/lib/driveway.test.ts`, `lib/curb.test.ts` (S4 1b).
- **Runs:** `vitest run` in `cartographer`.

**S-F3: the anchored payload** (existing seam, extended)
- **Proves:** F3. Every figure `frameResult` returns carries `properties.feature_key`, the lot and the building included.
- **Prior art:** `runbooks/anchor-geometry/scripts/lib/frames.test.ts`.
- **Runs:** `vitest run`.

## 5. PR plan

**PF1: a stable course key and a key on every row**: `cartographer`
- **Blocked by:** Q-F1 (Will's call).
- **Delivers:**
  - **D-F1:** `lotCourses` gives each course its `courseKey`; stations run clockwise; labels and `feature_key`s use the key; the frontage and driveway traces and the anchored rows carry `course_key` beside `course_index`.
  - **F3:** `feature_key` on the polygon rows.
- **Tested at:** S-F1, S-F3.
- **Door:** two-way in code. White Water's published rows keep their old keys until the next republish (Phase 2's run).
- **Blast radius:** every extract publish with a derived figure, and every anchor publish. Mete and building figures get one new property.

**PF2: the parent's v3.6**: `winston`
- **Blocked by:** PF1, so the spec says what shipped.
- **Delivers:** F7, and F2's query.
- **Door:** two-way.

Then the parent's P6–P9.

## 6. Not yet specified

- **D-F1's octant boundaries.** A course exactly on a boundary (facing due SSW, say) needs a tie-break; take the clockwise octant. A lot whose sides don't face clean directions (a pie-shaped lot) may give two courses the same octant often; the ordinals cover that, but a reader may find `S1` / `S2` less useful than the street name Phase 2 brings.
- **The 20 ft joint-access window** (F6), once run 3's confirm answers show where the note was boxed.

## 7. Out of scope

- **Any change to how a course is walked or transcribed:** the mete's order is the plat's, and the extract runbook's.
- **Phase 2's design:** it stays in the parent, unchanged by this spec, except that D16 joins by the F1 key.
