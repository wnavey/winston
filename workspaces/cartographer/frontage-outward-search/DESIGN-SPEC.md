# Frontage by outward search — which street each lot side faces, and its right-of-way

**ID:** FEAT-74  
**Kind:** feature
**Status:** draft
**Version:** 1
**Date:** 2026-10-22
**Repos touched:** `cartographer` (`runbooks/anchor-geometry/scripts/lib/frontage-context.ts` and its test and fixture; `frontage-layers.ts`), `bureau` (`runbooks/anchor-geometry/scripts/{frontage.py,locate.py}`, `steps/1.3-frontage/contract.test.ts`, `scripts/test_frontage.py`)
**Repos NOT touched:** `surveyor` (Austin's `parcels` role is already tagged), `cityhall` (no schema or RPC change; `cartographer_put_context_geo` already takes any number of `right_of_way` rows), `conductor2`, `prospector`, `claude-plugins`
**Amends:** `workspaces/cartographer/plan-set-driveways-curbs/DESIGN-SPEC.md` (FEAT-71) D16: the frontage test ("a `streets` segment within 60 ft of an edge and parallel to it") and "the `right_of_way` polygon(s) touching the frontage"

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
+      per course: outward rays (D1), each stopped by the first neighbour parcel (D3)
+        street = majority centreline crossed (D1, D4)
+        ROW    = polygons the rays enter before they stop (D5)
+      sides.json: every course, frontage or not, and what it faces (D6)
       openings: unchanged (D8)
 3.1-solve
   contextForFrame -> reconcileFrame
-    sheet frontage row named by a second matchStreet over the context streets
+    sheet frontage row named by the context frontage it lies along (D7)
```

## Decisions

**D1. A lot side is a frontage when walking straight out from it reaches a street before another parcel.** For each course of the ring at least `MIN_COURSE_FT` long (unchanged), take the 20 sample points `courseSamples` already makes. From each, cast a ray along the course's outward normal, the side away from the lot's interior, starting 0.5 ft outside the line. A ray reaches a street when it crosses a `streets` centreline (D4) before it stops (D3). The course is a frontage when at least `STREET_COVERAGE` (0.5, unchanged) of its rays reach a street. Its street is the name most of those rays reached first; ties go to the nearer median crossing. `centreline_offset_ft` becomes the median crossing distance and `coverage` the share of rays that reached the street. The output shape of `frontage/<course>.json` is otherwise unchanged. `matchStreet`'s both-ways search and `STREET_MAX_FT` are retired.

**D2. The neighbouring parcels come from the jurisdiction's `parcels` role, fetched by `1.3-frontage` in the same box.** `locate.FRONTAGE_ROLES` and cartographer's `FRONTAGE_ROLES` gain `parcels`. For Austin that resolves to the TCAD Parcels layer `1.2-fetch` already uses (`coa-gis/layer-identity.json`, role `parcels`), so surveyor does not change. It is filed as `layers/parcels.json` and `.native.json` like every other role. The subject parcel is the feature covering at least 90% of the ring's area and is left out of the stop set. A jurisdiction with no `parcels` role still runs: D3's cap then does the stopping, and `roles.json` records the role as not tagged, as today.

**D3. A ray stops at the first parcel other than the subject, or at `RAY_MAX_FT`.** The parcel stop is what makes the W and N sides "faces a neighbour". The cap matters only where no parcel stops the ray: unparcelled land, a gap in the county layer, or a jurisdiction with no `parcels` role. The cap's value is Q1.

**D4. A centreline crossing counts only where the crossed segment is within `STREET_PARALLEL_DEG` of the course.** This keeps a cross street at a corner from claiming the side when a ray clips it. It is the same constant as today's, now applied at the crossing. Whether 10° holds on curved streets is Q2.

**D5. A frontage's right-of-way is every `right_of_way` polygon at least 10% of its rays enter before they stop.** A ray that passes the centreline keeps going until the far-side parcel, so a street dedicated in two halves contributes both. On White Water each of the south rays enters 37921 and none enters 26584; each of the east rays enters 26584 alone. The 10% floor drops a polygon a corner ray only clips. `ROW_TOUCH_FT` is retired. Publication is unchanged: one row per polygon however many frontages hold it (`contextPayload`).

**D6. Every course is accounted for in `frontage/sides.json`.** One entry per course, frontage or not, with:
- `course_key`, `length_ft`;
- `faces`: `street`, `parcel` (with the parcel's id) or `nothing`;
- the ray tallies.

A non-frontage side is a written answer ("W faces parcel 0436110203"), never a missing file. The `1.3-frontage` contract accepts the new file beside the per-frontage files and `none.json`. A frontage with no polygon from D5 says so in the readout ("no City right-of-way polygon on S"), never a silent zero.

**D7. A sheet frontage row takes its street from the context frontage it lies along.** `reconcileFrame` already finds, for each City frontage, the sheet frontage row it lies along (`alongShare`, `SAME_COURSE_FT`). The street fields come from that pairing. The second `matchStreet` over the context's centrelines (`:759–763`) is removed. A sheet row with no City frontage along it gets no street, so `frontage/7/n` stays `street: null`.

**D8. Openings are unchanged.** `homeOf`, the 300 ft window and the 3 / 8 / 150 ft opening tolerances stay as they are; openings attach to the frontages D1 finds. On White Water the three openings stay on S.

**D9. Every tolerance says where it came from.** Each remaining constant in `frontage-context.ts` carries a one-line comment naming its source: a FEAT-71 or FEAT-74 D-number, or "set on White Water in cartographer#49". It is a comment change only, so a later reader does not mistake a tuned number for a rule.

**D10. Acceptance is a White Water re-anchor plus a compute-only pass on two more Austin sites.**
- **White Water:** a new anchor run (`whitewater-cc2e3a53-anchor-5`) should give:
  - 4 frontages (E1, E2, E3, S); `sides.json` saying W and N face parcel 0436110203;
  - two `right_of_way` rows, 26584 on E1–E3 and 37921 on S;
  - `frontage/7/n` with `street: null`;
  - the same 3 openings and statuses as `fbd39936`.
  
  It publishes only on Will's explicit accept at `4.1-hitl`.
- **2008 San Antonio and Lamar + Collier:** `frontage.py --compute` on each county ring, no anchor and no publish. Record frontages and right-of-way per side, old code against new, in the readout. This is the three-site check cartographer#49 left undone.

## Questions

**Q1. What is `RAY_MAX_FT`?** Proposed: 150 ft, half of a 300 ft right-of-way, wider than any Austin street FEAT-71 measured. It only matters where no parcel stops a ray (D3). The alternative is to stop at the 450 ft box edge and record "nothing" past the street.

**Q2. Does 10° hold at the crossing on curved streets and cul-de-sacs?** The three D10 sites have no curved frontage. Loosening to 20–30° is safe where D3's parcel stop exists, because a ray can no longer reach across the lot.

**Q3. Is a side that faces a private-drive or common-area parcel before the street a frontage?** Today's rule would count a street 20 ft behind a thin HOA strip; D1 does not. White Water's own access runs through a joint access easement on the apartments' lot (Inst. 2021084780), which is a different case, an easement rather than a parcel. Proposed: D1 as written, and `sides.json` names the parcel so a reviewer sees it.

**Q4. Do some parcel layers carry right-of-way as parcels?** Travis County's does not here (the rays reach ROW 37921 before any parcel). If an appraisal district publishes street strips as parcels, D3 would stop every ray at the street's edge. Proposed: check each jurisdiction when its `parcels` role is tagged (prospector, FEAT-71 D22), with an attribute filter in the role's `fields` if needed. Not needed for Austin.

## Testing seams

**S1: `frontagesOf` over recorded layer answers** (existing)
- **Proves:** D1, D3, D4, D5, D6, D8. White Water must give 4 frontages, the right-of-way assignment of §4 and W/N facing the apartments. Synthetic cases:
  - a half-street dedication (both halves held);
  - a corner where a cross street is clipped (not a frontage);
  - no `parcels` role (the D3 cap stops);
  - a side facing a parcel with a street behind it (Q3).
- **Prior art:** `cartographer/runbooks/anchor-geometry/scripts/lib/frontage-context.test.ts`, `describe('frontagesOf on White Water (the City alone)')` and `describe('frontagesOf, synthetic')`, over `__fixtures__/frontage-whitewater/` (gains `parcels.json` and `parcels.native.json`, recorded from the TCAD layer).
- **Runs:** `bun run test` in cartographer (vitest), local and CI.

**S2: `contextForFrame` on White Water anchor 3** (existing)
- **Proves:** D7. The sheet's `frontage/7/n` stays unnamed and `frontage/7/s` is `BREZZA LN`. The test feeds a context with N and W absent and asserts no second street search happens.
- **Prior art:** the same file, `it('names the sheet’s frontage rows by the street along them, and leaves the neighbour’s side unnamed')`.
- **Runs:** as S1.

**S3: the `frontage.py` command and the `1.3-frontage` contract** (existing)
- **Proves:** D2: the `parcels` role is asked once in the ring's feet and filed, and a jurisdiction without it still computes. D6: the contract accepts `sides.json` and refuses a run with neither frontages, `none.json` nor `sides.json`.
- **Prior art:** `bureau/runbooks/anchor-geometry/scripts/test_frontage.py` (`test_each_tagged_role_is_asked_once_in_the_rings_own_feet`), `steps/1.3-frontage/contract.test.ts`.
- **Runs:** `python3 -m pytest runbooks/anchor-geometry/scripts/test_frontage.py` and the contract under bun, in bureau.

**S4: the live runbook** (existing)
- **Proves:** D10 end to end, the published `geo` rows included.
- **Runs:** `anchor-geometry` on White Water through the conductor, local lane, personal seat; `frontage.py --compute` on the other two rings.

## PR plan

**P1: `1.3-frontage` fetches the neighbouring parcels** — `bureau`
- **Blocked by:** nothing (can start now).
- **Delivers:** D2's fetch and D6's contract change. Every new anchor run files `layers/parcels*.json` and the contract accepts `sides.json`. Cartographer ignores the new role until P2 (`loadLayers` reads only its own `FRONTAGE_ROLES`).
- **Tested at:** S3.
- **Door:** two-way (revert the PR).
- **Blast radius:** one extra keyless query per anchor run; nothing reads the file until P2.

**P2: frontage by outward search** — `cartographer`
- **Blocked by:** nothing. It reads `parcels` when present and falls back to D3's cap when not, so it can merge before or after P1. Its fixture is recorded by hand from the TCAD layer.
- **Delivers:** D1, D3, D4, D5, D6's `sides.json`, D7, D8, D9. Retires `STREET_MAX_FT`, `ROW_TOUCH_FT` and the both-ways `matchStreet` path.
- **Tested at:** S1, S2.
- **Door:** two-way.
- **Blast radius:** the frontage context of every anchor run from now on. Only White Water and the car-wash plat have run `1.3-frontage` so far, and published rows change only when an anchor is re-run and accepted.

**P3: acceptance runs** — no repo
- **Blocked by:** P1, P2.
- **Delivers:** D10. The White Water re-anchor (publish on Will's accept) and the compute-only pass on 2008 San Antonio and Lamar + Collier, written up in the run's readout.
- **Tested at:** S4.
- **Door:** two-way for the compute-only pass. The White Water publish writes a new anchor and marks `fbd39936` stale; its 54 `geo` rows stay until Will deletes them (the auto-mode classifier refuses an agent's `geo` DELETE). Back them up first, as for anchors 1–3.
- **Blast radius:** White Water's rows on `/anchored` and in any query keyed on its anchor.

## Not yet specified

- How the completeness check reads `sides.json`: "is this a corner or through lot", "which lines take a street setback". It belongs to FEAT-71 §11's consumption spec, and this spec only makes the answer exist.
- Whether `sides.json`'s per-side answer should also be published as a `geo` row (a `lot_side` kind) or stay in the run's files. That waits until a reader asks for it.

## Out of scope

- **Pedestrian and vehicular space inside the right-of-way.** Splitting the strip into sidewalk and roadway, by publishing the `Sidewalk` and `Paved Road` polygons `paved_areas` already returns, clipped to the right-of-way, or by adding the `sidewalk_inventory` role (FEAT-71 §10). It needs a `geo.kind` vocabulary decision; its own spec.
- **Moving the City frontage context out of `anchor-geometry`.** The fetch and compute are ring-keyed (FEAT-71 D16); only the publish key is the anchor (D19). Owning these rows by parcel or project waits on `geo`'s project owner (north star P0a), which Will deferred on 2026-10-21.
- **Tagging `parcels` and the frontage roles for other jurisdictions.** That is prospector's job (FEAT-71 D22, its own spec). This spec runs only where the roles are tagged, which today means Austin.
- **The plan-set side's frontage finder** (`extract-geometry/scripts/lib/frontage.ts`, FEAT-71 D5). It already searches outward only, among curb lines outside the lot.
