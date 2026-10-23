# Frontage by outward search — which street each lot side faces, its right-of-way, and the street's curbs

**ID:** FEAT-74  
**Kind:** feature
**Status:** accepted (P1–P5 shipped 2026-10-23; next: P6, the White Water acceptance run)
**Version:** 2.1
**Date:** 2026-10-23
**Implementation:** P1 + P5 bureau#2194, P2 cartographer#53, P3 cityhall#428 (migration applied to prod as `20261023123114 cartographer_context_curb`), P4 cartographer#54, all merged 2026-10-23. **Next:** P6: back up `fbd39936`'s 54 `geo` rows, re-anchor White Water (publish only on Will's accept at `4.1-hitl`), then compute-only on 2008 San Antonio and Lamar + Collier. Status goes to `shipped` when P6 is accepted.
**Repos touched:** `cartographer` (`runbooks/anchor-geometry/scripts/lib/frontage-context.ts` and its test and fixture; `frontage-layers.ts`; `scripts/frontage.ts`), `bureau` (`runbooks/anchor-geometry/scripts/{frontage.py,locate.py}`, `steps/1.3-frontage/contract.test.ts`, `scripts/test_frontage.py`), `cityhall` (`supabase/schemas/public/functions/cartographer_put_context_geo.sql`: accept a `curb` kind; no table change)
**Repos NOT touched:** `surveyor` (Austin's `parcels` role is already tagged), `conductor2`, `prospector`, `claude-plugins`
**Amends:** `workspaces/cartographer/plan-set-driveways-curbs/DESIGN-SPEC.md` (FEAT-71): D16's frontage test ("a `streets` segment within 60 ft of an edge and parallel to it") and "the `right_of_way` polygon(s) touching the frontage"; D24's "the sheet wins inside its survey reach" for the street's curbs and right-of-way (D14 here)

> **Revision note (v2.1, 2026-10-23):** implementation status. P1–P5 merged (header **Implementation** line, and a **Shipped** line on each PR plan entry). D12 gains an **As built** note: P4 samples the union's boundary along D11's rays rather than splitting the whole boundary by the centreline, because White Water's service-road centreline is digitized in front of its pavement. No decision changed.

> **Revision note (v2, 2026-10-22, Will):** the street's curbs come from the City, not the plan set. Plan sets often arrive without the right-of-way width or the distance to the adjacent curb dimensioned. The v1 rays already cross everything between the lot and the parcel across the street, so they now also measure the street's cross-section and publish the City's curb lines. New §5 in the Problem; new D11 (cross-section), D12 (City curb rows), D13 (the far side, and an extension query when the box is not enough), D14 (the City is the reference for the street's curbs and right-of-way; reverses FEAT-71 D24 for those two, openings unchanged). D3 now says the parcel stop decides the frontage and D11 carries the ray past the street. D10 gains the curb and cross-section expectations. New Q5–Q6, seam S5, PR plan P1–P6 (cityhall joins as P3). `cityhall` moves from "not touched" to "touched". Out of scope: the pedestrian line now notes that the cross-section records the sidewalk's span.

## Problem

### 1. Brezza Lane's right-of-way was fetched and then dropped

The accepted White Water anchor (`fbd39936`, anchor run `ea7d824e`, file `cc2e3a53`, 2026-10-22) published one `right_of_way` row, the I-35 frontage road's (OBJECTID 26584). The lot also fronts Brezza Lane on its south side, and no right-of-way row was published for it.

The City layer returned it. `1.3-frontage` asked `https://maps.austintexas.gov/gis/rest/Shared/Transportation_2/MapServer/0` for everything in the ring's box grown by 450 ft and got three polygons: 26584 (I-35, no document id), 37921 (document 201700317, the Brezza strip) and 518 (349 ft away). The run's `1.3-frontage/layers/right_of_way.native.json` holds all three.

`frontagesOf` then kept, for each lot course, only the polygons within `ROW_TOUCH_FT = 3` of one of 20 points sampled along it (`frontage-context.ts:75`, the filter at `:594–601`). Polygon 37921 runs parallel to the south course and 3.28–3.77 ft off it along its whole 231.6 ft, so it missed by 0.28 ft:

| Course | Street matched | 26584 (I-35): nearest sample | 37921 (Brezza): nearest sample | Kept today |
|---|---|---|---|---|
| E1 | S IH 35 SVRD SB | 0 ft | 5.76 ft | 26584 |
| E2 | S IH 35 SVRD SB | 0 ft | 90.19 ft | 26584 |
| E3 | S IH 35 SVRD SB | 0 ft | 105.12 ft | 26584 |
| S | BREZZA LN | 3.85 ft | **3.28 ft** | none |

The gap is two public layers disagreeing. The plan set says the south line is the Brezza right-of-way line (FEAT-71 §1.3, course 5). The anchored LOT 1 sits on the county ring at IoU 1.000. The City's polygon was digitized separately and lands about 3.3 ft south of it. A wider tolerance is no fix: at 4–5 ft the I-35 polygon (3.85 ft from the south course near the corner) would be attached to Brezza as well.

### 2. A lot side is paired with a street by searching both ways

`matchStreet` (`frontage-context.ts:270`) samples 20 points on a course. Each point votes for every street whose centreline segment lies within `STREET_MAX_FT = 75` of it and within `STREET_PARALLEL_DEG = 10` of parallel to the course. A street needs `STREET_COVERAGE = 0.5` of the votes. The search looks both ways from the course ("a centreline within this of a course, both ways", `:51`), through the lot as well as away from it. A lot's opposite sides are parallel, so the street along one side is also parallel to the side across from it.

With the cap raised to 2,000 ft in a scratch copy, the real code on this run's files gives:

| Side | 75 ft (published) | No cap |
|---|---|---|
| E1, E2, E3 | S IH 35 SVRD SB, 33–38 ft | same |
| S | BREZZA LN, 37 ft | same |
| W (faces the apartments, parcel 0436110203) | none | **S IH 35 SVRD SB, 259 ft, across the lot** |
| N (faces the apartments) | none | **BREZZA LN, 232 ft, across the lot** |

Downstream, the sheet's north frontage row `frontage/7/n` would be published with `street: BREZZA LN`, because `reconcileFrame` names the sheet's frontage rows with a second `matchStreet` call (`:759–763`). The 75 ft cap is the only thing that says "no street" for a side facing a neighbour.

### 3. The constants have no source

`STREET_MAX_FT`, `STREET_PARALLEL_DEG` and `ROW_TOUCH_FT` were written in cartographer#49 (2026-10-21). That PR says they were set on White Water alone, and that the three-site check FEAT-71 asked for (R1, its §3.5) was still to come. FEAT-71 D16 said 60 ft, borrowed from D5's sheet-side search. None is a City rule. Together they stand in for one question with a direction: walking away from this side of the lot, what is reached first?

### 4. What the outward question gives on White Water

The anchor run never fetches the neighbouring parcels. Prototyped with one extra query to the same county parcel layer `1.2-fetch` uses (`Shared/AppraisalDistricts/MapServer/0`, 7 parcels in the same box): rays from 20 points per side, each running perpendicular to the side and away from the lot, recording the first thing reached.

| Side | First thing reached | First street reached | ROW polygons entered before the far-side parcel | Rays agreeing |
|---|---|---|---|---|
| E1, E2, E3 | ROW 26584 at 0 ft | S IH 35 SVRD SB at 32–38 ft | 26584 (20/20) | 20/20 |
| S | ROW 37921 at 2.9 ft | BREZZA LN at 37 ft | 37921 (20/20) | 20/20 |
| W | parcel 0436110203 at 0 ft | none | none | 20/20 |
| N | parcel 0436110203 at 0 ft | none | none | 20/20 |

That one walk answers both whether a side is a frontage and which right-of-way polygon belongs to it. It needs neither the 75 ft cap nor the 3 ft touch. A visual walk-through of problems 1–4 is the Claude artifact "Cartographer Right-of-Way in Austin" (Figures 3, 6 and 7), https://claude.ai/artifact/2eDe2MVVHAbQPRJTmf1tLh.

### 5. The street's curbs come only from the plan set, which often leaves them out

Today the only curb lines along a frontage are the sheet's. White Water's `curb existing` row (2,940.6 ft) is traced from the survey layer `V-CONC-LINE`, which draws the public sidewalk, the curb and gutter, and the existing driveway together (FEAT-71 §1.3). It is published as one row with `edge: unknown`, and the two lines nearest the Brezza lot line are most likely the sidewalk's edges. Plan sets often arrive without the right-of-way width or the distance to the adjacent curb dimensioned, and a reviewer needs both. The City side publishes no curb today: FEAT-71's context rows are `street`, `driveway_opening` and `right_of_way` only.

Austin publishes no curb-line layer. As of 2026-10-22, `maps.austintexas.gov/gis/rest/Shared/PlanimetricsSurvey_1` and `_2` carry building footprints, impervious cover, contours and survey monuments. The 2,184 services in the City's ArcGIS Online organisation include sidewalks, curb ramps and curb inlets, but no curb or edge-of-pavement lines. The nearest thing is the edge of `impervious_cover_2023`'s `Paved Road` polygons, the layer every run already downloads as `paved_areas`. That edge is the edge of pavement, hand-digitized from 2023 aerials (about ±1–2 ft).

The v1 rays, carried past the centreline to the parcel across the street, cross all of it. Medians of 20 rays per side, feet from the lot line:

| | Brezza (S) | I-35 service road (E1, E3) |
|---|---|---|
| City right-of-way starts | 3.4 | 0 |
| Sidewalk (`Sidewalk` polygons) | 2.6–7.9 (17 of 20 rays) | mostly none mapped |
| Near pavement edge | **12.1** | **38.7–41.2** |
| City centreline crossed | 37.0 (28.2–45.8) | 32.6–38.1 |
| Far pavement edge, same roadway | **54.2** | 78–88, then the I-35 main lanes from about 120 |
| Far-side parcel (right-of-way ends) | **92.4** (92.2–92.5) | about 400 (395–401) |
| Edge of the 450 ft box along the ray | — | 472–488 |

The near pavement edge agrees with the sheet's measured offsets within about a foot: Brezza 12.1 against 11.1–11.7 (FEAT-71 D5), the service road 38.7–41.2 against 37–41. The City's centrelines do not mark the pavement's middle. The service road's sits at 33–38 ft, in front of its pavement, so distances must come from the pavement polygons and the centreline only names the street. On White Water the far parcel lies inside the box on every side. A corridor wider than the box would not.

## The change

```diff
 1.3-frontage  (bureau frontage.py)
   locate.frontage_layers(roles)
-    streets, street_levels, paved_areas, right_of_way
+    streets, street_levels, paved_areas, right_of_way, parcels      # D2
   arcgis_query.py envelope, once per role -> layers/<role>.json + .native.json
   frontage.ts --compute
     frontagesOf
-      per course: matchStreet (both ways, <= 75 ft, <= 10 deg, >= 50%)
-      ROW: polygons within 3 ft of a course sample
+      per course: outward rays (D1), stopped for the frontage test by the first neighbour parcel (D3)
+        street = majority centreline crossed (D1, D4)
+        ROW    = polygons the rays enter before the far-side parcel (D5)
+        cross_section = right-of-way, sidewalk, near/far pavement edge, far parcel (D11)
+        city curb lines = Paved Road edges along the frontage (D12)
+      sides.json: every course, frontage or not, and what it faces (D6)
       openings: unchanged (D8)
+  far side not reached in the box -> one extension query beyond that side, recompute (D13)
 3.1-solve
   contextForFrame -> reconcileFrame
-    sheet frontage row named by a second matchStreet over the context streets
+    sheet frontage row named by the context frontage it lies along (D7)
+    sheet existing curb held against the City's near pavement edge (D14)
 5.1-publish
   cartographer_put_context_geo
-    kinds: street, driveway_opening, right_of_way
+    kinds: street, driveway_opening, right_of_way, curb (city_gis lines)   # D12, cityhall
```

## Decisions

**D1. A lot side is a frontage when walking straight out from it reaches a street before another parcel.** For each course of the ring at least `MIN_COURSE_FT` long (unchanged), take the 20 sample points `courseSamples` already makes. From each, cast a ray along the course's outward normal, the side away from the lot's interior, starting 0.5 ft outside the line. A ray reaches a street when it crosses a `streets` centreline (D4) before it stops (D3). The course is a frontage when at least `STREET_COVERAGE` (0.5, unchanged) of its rays reach a street. Its street is the name most of those rays reached first; ties go to the nearer median crossing. `centreline_offset_ft` becomes the median crossing distance and `coverage` the share of rays that reached the street. The output shape of `frontage/<course>.json` is otherwise unchanged apart from D11's `cross_section`. `matchStreet`'s both-ways search and `STREET_MAX_FT` are retired.

**D2. The neighbouring parcels come from the jurisdiction's `parcels` role, fetched by `1.3-frontage` in the same box.** `locate.FRONTAGE_ROLES` and cartographer's `FRONTAGE_ROLES` gain `parcels`. For Austin that resolves to the TCAD Parcels layer `1.2-fetch` already uses (`coa-gis/layer-identity.json`, role `parcels`), so surveyor does not change. It is filed as `layers/parcels.json` and `.native.json` like every other role. The subject parcel is the feature covering at least 90% of the ring's area and is left out of the stop set. A jurisdiction with no `parcels` role still runs: D3's cap then does the stopping, and `roles.json` records the role as not tagged, as today.

**D3. For the frontage test, a ray stops at the first parcel other than the subject, or at `RAY_MAX_FT`.** The parcel stop is what makes the W and N sides "faces a neighbour". The cap matters only where no parcel stops the ray: unparcelled land, a gap in the county layer, or a jurisdiction with no `parcels` role. The cap's value is Q1. On a side that is a frontage, D11 carries the same ray on past the street to the far side.

**D4. A centreline crossing counts only where the crossed segment is within `STREET_PARALLEL_DEG` of the course.** This keeps a cross street at a corner from claiming the side when a ray clips it. It is the same constant as today's, now applied at the crossing. Whether 10° holds on curved streets is Q2.

**D5. A frontage's right-of-way is every `right_of_way` polygon at least 10% of its rays enter before the far-side parcel.** A ray that passes the centreline keeps going until the far-side parcel (D13), so a street dedicated in two halves contributes both. On White Water each of the south rays enters 37921 and none enters 26584; each of the east rays enters 26584 alone. The 10% floor drops a polygon a corner ray only clips. `ROW_TOUCH_FT` is retired. Publication is unchanged: one row per polygon however many frontages hold it (`contextPayload`).

**D6. Every course is accounted for in `frontage/sides.json`.** One entry per course, frontage or not, with:
- `course_key`, `length_ft`;
- `faces`: `street`, `parcel` (with the parcel's id) or `nothing`;
- the ray tallies.

A non-frontage side is a written answer ("W faces parcel 0436110203"), never a missing file. The `1.3-frontage` contract accepts the new file beside the per-frontage files and `none.json`. A frontage with no polygon from D5 says so in the readout ("no City right-of-way polygon on S"), never a silent zero.

**D7. A sheet frontage row takes its street from the context frontage it lies along.** `reconcileFrame` already finds, for each City frontage, the sheet frontage row it lies along (`alongShare`, `SAME_COURSE_FT`). The street fields come from that pairing. The second `matchStreet` over the context's centrelines (`:759–763`) is removed. A sheet row with no City frontage along it gets no street, so `frontage/7/n` stays `street: null`.

**D8. Openings are unchanged.** `homeOf`, the 300 ft window and the 3 / 8 / 150 ft opening tolerances stay as they are; openings attach to the frontages D1 finds. On White Water the three openings stay on S. FEAT-71 D24's precedence still governs openings.

**D9. Every tolerance says where it came from.** Each remaining constant in `frontage-context.ts` carries a one-line comment naming its source: a FEAT-71 or FEAT-74 D-number, or "set on White Water in cartographer#49". It is a comment change only, so a later reader does not mistake a tuned number for a rule.

**D10. Acceptance is a White Water re-anchor plus a compute-only pass on two more Austin sites.**
- **White Water:** a new anchor run (`whitewater-cc2e3a53-anchor-5`) should give:
  - 4 frontages (E1, E2, E3, S); `sides.json` saying W and N face parcel 0436110203;
  - two `right_of_way` rows, 26584 on E1–E3 and 37921 on S;
  - `frontage/7/n` with `street: null`;
  - the same 3 openings and statuses as `fbd39936`;
  - cross-sections matching §5 within a foot: S near edge 12.1, far edge 54.2, right-of-way 3.4–92.4; E near edge 38.7–41.2, far side about 400;
  - City `curb` rows along S and E on both sides of each street (D12);
  - the sheet's existing curb on S and E judged `agrees` against the City's near edge (D14).
  
  It publishes only on Will's explicit accept at `4.1-hitl`.
- **2008 San Antonio and Lamar + Collier:** `frontage.py --compute` on each county ring, no anchor and no publish. Record frontages, right-of-way and cross-section per side, old code against new, in the readout. This is the three-site check cartographer#49 left undone.

**D11. Each frontage's rays measure the street's cross-section.** On a frontage, each ray that reached the street keeps going until the far-side parcel (D13), and records the distance from the lot line to each boundary it crosses:
- `row_start_ft` and `row_end_ft` (the first entry into and last exit from D5's polygons);
- `sidewalk_ft`: the first `Sidewalk` span, or null;
- `near_curb_ft` and `far_curb_ft`: the entry into and exit from the first `Paved Road` span, which is this street's roadway. A later span past a gap is another roadway, such as I-35's main lanes, and is kept only in the ray record.
- `centreline_ft`;
- `far_side_ft`: where the far-side parcel starts, or null with `far_side: not_reached`.

`frontage/<course>.json` gains `cross_section`: the median and range of each, the ray count behind each, and `row_width_ft = row_end_ft − row_start_ft` and `pavement_width_ft = far_curb_ft − near_curb_ft` when both ends were reached. Distances come from polygons, never from the centreline (§5).

**D12. The City's curb lines are published as `curb` rows with `method: 'city_gis'`.** For each frontage, take the boundary of the union of `Paved Road` polygons, keep the stretch inside the frontage's 300 ft window (D8's stations), and split it into the near and far edges:
- `near`: the side facing the lot (`side: 'same'`);
- `far`: the opposite side.

Each is one `curb` row, a LineString or MultiLineString, with `properties: {edge: 'edge_of_pavement', side, frontage, course_key, street, source_layer, object_id: [...], source_vintage, accuracy_class: 'digitized', cross_section}`. The `near` row carries D11's numbers. `cartographer_put_context_geo` (cityhall) adds `curb` to its kinds, as a line kind; no table changes, since `geo.kind` is free text and the sheet's curbs already use `curb` with `method: 'anchored'`. A tool tells the two apart by `method`.

*As built (P4, cartographer#54):* the union's boundary is taken where D11's rays cross it, not split from the whole outline. A ray every foot from the course's line, extended through the window, on rays that cross this street's centreline. The first `Paved Road` span (slivers ≤ `SPAN_GAP_FT` merged) is this street's roadway: its entry is the near edge and its exit the far edge, so a second roadway (I-35's main lanes) is never published and the line agrees with D11 by construction. Splitting the outline by the centreline put White Water's service-road near edge on the far side, since that centreline lies in front of the pavement. Each point goes to the nearest course along the street (E1–E3 do not overlap). A ray starting on pavement (a cross street's mouth) or a jump of more than a foot (a curb return) breaks the line, and runs under 8 ft (`OPENING_MIN_FT`) are dropped. `feature_key` is `curb/<ring course>/<near|far>`: `reconcileFrame` can give two ring courses one sheet name (White Water's ring E1 and E2 are both the sheet's E1).

**D13. The far side is found in the box, or by one extension query beyond it.** The 450 ft box (`frontage.py` `WINDOW_FT`) already holds the parcel across the street on White Water: Brezza's at 92 ft, I-35's at about 400 ft against a box edge at 472–488 ft. When more than half of a frontage's rays reach the box edge with no far-side parcel, `frontage.py` makes one more envelope query for `parcels`, `right_of_way` and `paved_areas`. The box runs along that frontage and outward from it to `EXTEND_FT` (Q6). It files the answers as `layers/<role>.ext.json` and `.ext.native.json` and runs the compute once more. Still not reached means `far_side: not_reached` and null widths, written, never guessed.

**D14. For the street's curbs and right-of-way, the City is the reference and the sheet is checked against it.** This reverses FEAT-71 D24 ("the sheet wins inside its survey reach") for these two; D24 stands for openings. In `reconcileFrame`, each frontage's sheet existing-curb chains that run along the course are compared with D11's `near_curb_ft`, using the median offset of the sheet chain nearest the street. The frontage records `sheet_curb_ft`, `city_curb_ft` and a status:
- `agrees`: within `CURB_AGREE_FT` (Q5);
- `disagrees`: the sheet draws one further off;
- `sheet_missing`: the survey stops short of it.

The sheet's own curb rows are still published as the sheet's (`method: 'anchored'`). A tool that needs the right-of-way width or the distance to the adjacent curb reads the City rows.

## Questions

**Q1. What is `RAY_MAX_FT`?** Proposed: 150 ft, half of a 300 ft right-of-way, wider than any Austin street FEAT-71 measured. It only matters where no parcel stops a ray for the frontage test (D3); the cross-section walk (D11) is bounded by the box and D13 instead. The alternative is to stop at the 450 ft box edge and record "nothing" past the street.

**Q2. Does 10° hold at the crossing on curved streets and cul-de-sacs?** The three D10 sites have no curved frontage. Loosening to 20–30° is safe where D3's parcel stop exists, because a ray can no longer reach across the lot.

**Q3. Is a side that faces a private-drive or common-area parcel before the street a frontage?** Today's rule would count a street 20 ft behind a thin HOA strip; D1 does not. White Water's own access runs through a joint access easement on the apartments' lot (Inst. 2021084780), which is a different case, an easement rather than a parcel. Proposed: D1 as written, and `sides.json` names the parcel so a reviewer sees it.

**Q4. Do some parcel layers carry right-of-way as parcels?** Travis County's does not here (the rays reach ROW 37921 before any parcel). If an appraisal district publishes street strips as parcels, D3 would stop every ray at the street's edge. Proposed: check each jurisdiction when its `parcels` role is tagged (prospector, FEAT-71 D22), with an attribute filter in the role's `fields` if needed. Not needed for Austin.

**Q5. What is `CURB_AGREE_FT`?** Proposed: 2 ft, the City's stated digitizing accuracy, against a gutter lip the aerial sees and a curb face the survey draws. White Water: 12.1 against 11.1–11.7 on Brezza, 38.7–41.2 against 37–41 on the service road, both inside 2 ft.

**Q6. How far does D13's extension reach?** Proposed: `EXTEND_FT = 1,000` ft outward from the frontage. That covers a full interstate corridor; I-35 at White Water is about 400 ft parcel to parcel. One extension per frontage per run, never a loop.

## Testing seams

**S1: `frontagesOf` over recorded layer answers** (existing)
- **Proves:** D1, D3, D4, D5, D6, D8, D11, D12's geometry. White Water must give 4 frontages, the right-of-way assignment of §4, W/N facing the apartments, the §5 cross-sections within a foot, and near and far City curb lines on S and E. Synthetic cases:
  - a half-street dedication (both halves held);
  - a corner where a cross street is clipped (not a frontage);
  - no `parcels` role (the D3 cap stops);
  - a side facing a parcel with a street behind it (Q3);
  - a far side outside the box (`far_side: not_reached`, null widths);
  - two roadways in one right-of-way (only the first is this street's curbs).
- **Prior art:** `cartographer/runbooks/anchor-geometry/scripts/lib/frontage-context.test.ts`, `describe('frontagesOf on White Water (the City alone)')` and `describe('frontagesOf, synthetic')`, over `__fixtures__/frontage-whitewater/` (gains `parcels.json` and `parcels.native.json`, recorded from the TCAD layer).
- **Runs:** `bun run test` in cartographer (vitest), local and CI.

**S2: `contextForFrame` on White Water anchor 3** (existing)
- **Proves:** D7 and D14. The sheet's `frontage/7/n` stays unnamed and `frontage/7/s` is `BREZZA LN`. The sheet's existing curb on S and E is `agrees` against the City's near edge, and a synthetic sheet curb 4 ft off is `disagrees`. The test feeds a context with N and W absent and asserts no second street search happens.
- **Prior art:** the same file, `it('names the sheet’s frontage rows by the street along them, and leaves the neighbour’s side unnamed')`.
- **Runs:** as S1.

**S3: the `frontage.py` command and the `1.3-frontage` contract** (existing)
- **Proves:**
  - D2: the `parcels` role is asked once in the ring's feet and filed, and a jurisdiction without it still computes.
  - D6: the contract accepts `sides.json` and refuses a run with neither frontages, `none.json` nor `sides.json`.
  - D13: a compute that reports `far_side: not_reached` on a frontage triggers exactly one extension query per role, filed as `.ext`, and one recompute.
- **Prior art:** `bureau/runbooks/anchor-geometry/scripts/test_frontage.py` (`test_each_tagged_role_is_asked_once_in_the_rings_own_feet`), `steps/1.3-frontage/contract.test.ts`.
- **Runs:** `python3 -m pytest runbooks/anchor-geometry/scripts/test_frontage.py` and the contract under bun, in bureau.

**S4: the live runbook** (existing)
- **Proves:** D10 end to end, the published `geo` rows included.
- **Runs:** `anchor-geometry` on White Water through the conductor, local lane, personal seat; `frontage.py --compute` on the other two rings.

**S5: `cartographer_put_context_geo`** (existing)
- **Proves:** D12's database side. A `curb` feature with a line geometry is written with `method: 'city_gis'` beside the anchor's other context rows; a `curb` polygon is refused; the replace-by-anchor delete still touches only `city_gis` rows.
- **Prior art:** none in cityhall (it has no SQL tests). cityhall#426 was verified by the White Water publish; the cartographer side has `contextPayload`'s unit tests in `frontage-context.test.ts` (`describe('esriPolygon')`).
- **Runs:** CI's declarative-schema check on the PR, then the D10 publish against prod after Will or Jason applies the migration.

## PR plan

**P1: `1.3-frontage` fetches the neighbouring parcels** — `bureau`
- **Blocked by:** nothing (can start now).
- **Delivers:** D2's fetch and D6's contract change. Every new anchor run files `layers/parcels*.json` and the contract accepts `sides.json`. Cartographer ignores the new role until P2 (`loadLayers` reads only its own `FRONTAGE_ROLES`).
- **Tested at:** S3.
- **Door:** two-way (revert the PR).
- **Blast radius:** one extra keyless query per anchor run; nothing reads the file until P2.
- **Shipped:** bureau#2194, merged 2026-10-23 (with P5).

**P2: frontage by outward search, with the cross-section** — `cartographer`
- **Blocked by:** nothing. It reads `parcels` when present and falls back to D3's cap when not, so it can merge before or after P1. Its fixture is recorded by hand from the TCAD layer.
- **Delivers:** D1, D3, D4, D5, D6's `sides.json`, D7, D8, D9, D11 (`cross_section` in the frontage JSON and the readout) and D14's sheet check. Retires `STREET_MAX_FT`, `ROW_TOUCH_FT` and the both-ways `matchStreet` path. Publishes no curb rows yet.
- **Tested at:** S1, S2.
- **Door:** two-way.
- **Blast radius:** the frontage context of every anchor run from now on. Only White Water and the car-wash plat have run `1.3-frontage` so far, and published rows change only when an anchor is re-run and accepted.
- **Shipped:** cartographer#53, merged 2026-10-23.

**P3: the context RPC accepts City curb lines** — `cityhall`
- **Blocked by:** nothing (can start now).
- **Delivers:** D12's database side: `curb` joins the kinds `cartographer_put_context_geo` accepts, as a line kind. Declarative schema edit plus the migration CI's check prints.
- **Tested at:** S5.
- **Door:** two-way (a function replace; the previous body is in the migration history). Will or Jason applies it to prod.
- **Blast radius:** the one RPC; an existing caller sends no `curb` rows, so nothing changes until P4.
- **Shipped:** cityhall#428, merged 2026-10-23; migration applied to prod first, recorded as `20261023123114`.

**P4: publish the City curb rows** — `cartographer`
- **Blocked by:** P2 (merged), P3 (applied in prod). An accepted anchor publishing a `curb` row before P3 is live would fail the whole context write.
- **Delivers:** D12: `contextPayload` emits the near and far `curb` rows per frontage with D11's numbers on the near one.
- **Tested at:** S1 (payload), S5.
- **Door:** two-way.
- **Blast radius:** the context rows of every anchor accepted after it merges.
- **Shipped:** cartographer#54, merged 2026-10-23 (see D12's as-built note).

**P5: the extension query** — `bureau`
- **Blocked by:** P2 (merged), which reports `far_side: not_reached`.
- **Delivers:** D13: one extension envelope per unreached frontage, filed as `.ext`, and one recompute.
- **Tested at:** S3.
- **Door:** two-way.
- **Blast radius:** runs only on frontages along corridors wider than the box; none at White Water.
- **Shipped:** bureau#2194, merged 2026-10-23 (with P1).

**P6: acceptance runs** — no repo
- **Blocked by:** P1–P5.
- **Delivers:** D10. The White Water re-anchor (publish on Will's accept) and the compute-only pass on 2008 San Antonio and Lamar + Collier, written up in the run's readout.
- **Tested at:** S4.
- **Door:** two-way for the compute-only pass. The White Water publish writes a new anchor and marks `fbd39936` stale; its 54 `geo` rows stay until Will deletes them (the auto-mode classifier refuses an agent's `geo` DELETE). Back them up first, as for anchors 1–3.
- **Blast radius:** White Water's rows on `/anchored` and in any query keyed on its anchor.
- **Status:** next. Not started.

## Not yet specified

- How the completeness check reads `sides.json` and the cross-section: "is this a corner or through lot", "which lines take a street setback", "is the existing right-of-way width dimensioned and does it match" (CC-23-01). It belongs to FEAT-71 §11's consumption spec, and this spec only makes the answers exist.
- Whether `sides.json`'s per-side answer should also be published as a `geo` row (a `lot_side` kind) or stay in the run's files. That waits until a reader asks for it.
- How `/anchored` draws the City curb rows beside the sheet's (style, legend). Today it draws context rows with the tan "county, estimated & City rows" style; a curb line in that style may be enough.

## Out of scope

- **Publishing the pedestrian and vehicular areas inside the right-of-way as rows.** D11 records where the sidewalk and the pavement sit along each frontage. Publishing the `Sidewalk` and `Paved Road` polygons themselves, clipped to the right-of-way, or adding the `sidewalk_inventory` role (FEAT-71 §10), needs a `geo.kind` vocabulary decision; its own spec.
- **Moving the City frontage context out of `anchor-geometry`.** The fetch and compute are ring-keyed (FEAT-71 D16); only the publish key is the anchor (D19). Owning these rows by parcel or project waits on `geo`'s project owner (north star P0a), which Will deferred on 2026-10-21.
- **Tagging `parcels` and the frontage roles for other jurisdictions.** That is prospector's job (FEAT-71 D22, its own spec). This spec runs only where the roles are tagged, which today means Austin.
- **The plan-set side's frontage finder** (`extract-geometry/scripts/lib/frontage.ts`, FEAT-71 D5). It already searches outward only, among curb lines outside the lot.
- **Splitting the sheet's `V-CONC-LINE` into sidewalk and curb.** D14 makes the City the reference for the street's curb, so the sheet's lumped layer is only checked, not repaired.
